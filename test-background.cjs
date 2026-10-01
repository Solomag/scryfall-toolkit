/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence and
 * are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */
'use strict';
// background.js service-worker tests: message protocol, tag pipeline,
// set categorisation, legality queries, previews and index refresh.
const {
  assert, assertEqual, summary, createChrome, createPage
} = require('./testlib.cjs');

const ORACLE_ID = '00000000-0000-4000-8000-000000000001';
const ILLUS_ID = '99999999-9999-4999-8999-999999999999';
const ILLUS_REL_ID = '77777777-7777-4777-8777-777777777777';
const REL_ID = '55555555-5555-4555-8555-555555555555';
const CARD_ID = '11111111-1111-4111-8111-111111111111';
const QUERY_ID = '33333333-3333-4333-8333-333333333333';
const QUERY_404_ID = '44444444-4444-4444-8444-444444444444';
const EVIL_PRINTS_ID = '22222222-2222-4222-8222-222222222222';
const PREVIEW_ID = '55555555-5555-4555-8555-555555555555';
const PREVIEW_BAD_ID = '66666666-6666-4666-8666-666666666666';
const CLASSIC_OVERRIDE_ID = 'c7c7bffa-442d-4ba5-b778-ad394c192f27';
const FIN_ID_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FIN_ID_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const SCRYFALL_CARD = {
  id: CARD_ID, name: 'Test Card', oracle_id: ORACLE_ID, illustration_id: ILLUS_ID,
  legalities: { legacy: 'banned', modern: 'not_legal' }
};

const REL_FORWARD = {
  __typename: 'Relationship', foreignKey: 'oracleId',
  subjectName: 'Test Card', subjectId: ORACLE_ID,
  relatedName: 'Other Card', relatedId: REL_ID,
  classifier: 'BETTER_THAN', classifierInverse: 'WORSE_THAN'
};

const registryResponse = { data: { card: {
  oracleId: ORACLE_ID,
  illustrationId: ILLUS_ID,
  edges: [
    { __typename: 'Tagging', tag: { type: 'ORACLE_CARD_TAG', name: 'Aggro', slug: 'aggro' } },
    { __typename: 'Tagging', tag: { type: 'ILLUSTRATION_TAG', name: 'Skyline', slug: 'skyline' } },
    { __typename: 'Tagging', tag: { type: 'UNKNOWN_TAG', name: 'Weird', slug: 'weird' } },
    REL_FORWARD,
    { __typename: 'Relationship', foreignKey: 'illustrationId',
      subjectName: 'Ill Subject', subjectId: ILLUS_ID,
      relatedName: 'Ill Related', relatedId: ILLUS_REL_ID,
      classifier: 'DEPICTS', classifierInverse: 'DEPICTED_IN' },
    { __typename: 'Relationship', foreignKey: 'oracleId',
      subjectName: 'Broken', subjectId: ORACLE_ID,
      relatedName: 'Bad Target', relatedId: 'not-a-uuid',
      classifier: 'A', classifierInverse: 'B' }
  ]
} } };

const setsResponse = {
  has_more: false,
  data: [
    { code: 'MH3', set_type: 'expansion', name: 'Modern Horizons 3' },
    { code: 'mtgo', digital: true, set_type: 'online', name: 'MTGO Sets' },
    { code: 'OCMD', set_type: 'memorabilia', name: 'Commander Oversized Deck' },
    { code: 'token', set_type: 'token', name: 'Tokens' },
    { code: 'CEI', set_type: 'expansion', name: "Collector's Edition" },
    { code: '4BB', set_type: 'expansion', name: 'Fourth Edition Foreign Black Border' },
    { code: 'bad code!', name: 'Ignored' }
  ]
};

const collectionResponse = { data: [
  { id: FIN_ID_1, finishes: ['foil'], promo_types: ['textured'] },
  { id: FIN_ID_2, finishes: ['nonfoil'], promo_types: [] }
] };

const PRINT_A = {
  id: 'card-a', name: 'Test Card', scryfall_uri: 'https://scryfall.com/card/tst/1/test',
  set: 'tst', set_name: 'Test Set', collector_number: '1', lang: 'en',
  digital: false, finishes: ['nonfoil'], prices: { eur: '1.00' },
  released_at: '2024-01-02', image_uris: { normal: 'https://cards.scryfall.io/normal/front/a/aa/test.jpg' }
};
const PRINT_B = {
  id: 'card-b', name: 'Test Card', scryfall_uri: 'https://scryfall.com/card/mh3/42/test',
  set: 'mh3', set_name: 'Modern Horizons 3', collector_number: '42', lang: 'jp',
  digital: false, finishes: ['foil'], prices: {}
};

const ORACLE_BULK = Array.from({ length: 110 }, (_, i) => ({ slug: `tag-${i}`, oracle_ids: [`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`] }));
const ART_BULK = Array.from({ length: 110 }, (_, i) => ({ slug: `art-${i}`, illustration_ids: [`99999999-9999-4999-8999-${String(i).padStart(12, '0')}`] }));

const fetchLog = [];
let registryBehavior = 'ok';

// The bundled tag snapshot is read as text and parsed, the way upstream ships
// it: a global assignment whose value is JSON.
function textResponse(text, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function fetchMock(url, init) {
  const target = String(url);
  fetchLog.push(target);
  if (target.startsWith('https://tagger.scryfall.com/graphql/registry')) {
    if (registryBehavior === 'fail') throw new Error('Tagger unavailable');
    return jsonResponse(registryResponse);
  }
  if (target === 'https://api.scryfall.com/bulk-data/oracle_tags') {
    return jsonResponse({ download_uri: 'https://data.scryfall.io/bulk/oracle-tags.json' });
  }
  if (target === 'https://api.scryfall.com/bulk-data/art_tags') {
    return jsonResponse({ download_uri: 'https://data.scryfall.io/bulk/art-tags.json' });
  }
  if (target === 'https://data.scryfall.io/bulk/oracle-tags.json') return jsonResponse(ORACLE_BULK);
  if (target === 'https://data.scryfall.io/bulk/art-tags.json') return jsonResponse(ART_BULK);
  if (target === 'https://api.scryfall.com/sets') return jsonResponse(setsResponse);
  if (target === 'https://api.scryfall.com/cards/collection') {
    // One endpoint serves two callers: the finish column, which identifies by
    // printing, and EDHREC's suggestions, which identify by oracle id. Answer
    // each the way Scryfall does — the oracle id is echoed back so the caller
    // can match, and a bad identifier fails the whole batch rather than being
    // quietly dropped.
    let identifiers = [];
    try { identifiers = (JSON.parse((init && init.body) || '{}').identifiers) || []; } catch (e) { identifiers = []; }
    if (identifiers.some(item => item.oracle_id === '00000000-0000-0000-0000-000000000000')) {
      return jsonResponse({ object: 'error', code: 'bad_identifiers' }, 400);
    }
    if (identifiers.length && identifiers.every(item => item.oracle_id)) {
      return jsonResponse({ data: identifiers.map(item => {
        // A real UUID, because the background checks the shape of what comes
        // back and drops a row it cannot trust.
        const id = '00000000-0000-4000-8000-' + item.oracle_id.replace(/-/g, '').slice(0, 12);
        return {
          id,
          oracle_id: item.oracle_id,
          name: 'Oracle Card',
          type_line: 'Creature',
          image_uris: { normal: 'https://cards.scryfall.io/normal/front/a/aa/' + id.slice(-12) + '.jpg' }
        };
      }) });
    }
    return jsonResponse(collectionResponse);
  }
  if (target.startsWith('https://api.scryfall.com/cards/search')) {
    const parsed = new URL(target);
    const q = parsed.searchParams.get('q') || '';
    if (q.includes(' AND ')) { // legality query
      if (q.includes(QUERY_404_ID)) return jsonResponse({}, 404);
      if (q.includes(QUERY_ID)) return jsonResponse({ total_cards: 1, data: [{ legalities: { legacy: 'legal' } }] });
      return jsonResponse({ total_cards: 0, data: [] });
    }
    if (parsed.searchParams.get('unique') === 'prints') { // allPrints
      if (q.includes(EVIL_PRINTS_ID)) {
        return jsonResponse({ data: [PRINT_A], has_more: true, next_page: 'https://evil.example/steal' });
      }
      return jsonResponse({ data: [PRINT_A, PRINT_B], has_more: false });
    }
    if (q === 'e:mtgo') return jsonResponse({ data: [{ name: 'Online Card', games: ['mtgo'] }] });
    if (q.includes(PREVIEW_BAD_ID)) {
      return jsonResponse({ data: [{ name: 'Bad Image', image_uris: { normal: 'https://evil.example/img.jpg' }, scryfall_uri: 'https://scryfall.com/card/bad/1' }] });
    }
    return jsonResponse({ data: [{ name: 'Other Card', image_uris: { normal: 'https://cards.scryfall.io/normal/o.jpg' }, scryfall_uri: 'https://scryfall.com/card/oth/1/other-card' }] });
  }
  if (target.startsWith('chrome-extension://scryfall-toolkit/data/')) {
    const name = target.slice(target.lastIndexOf('/') + 1);
    const fixture = bundledTagFixtures['data/' + name];
    if (!fixture) throw new Error('Unmocked bundled file: ' + name);
    return textResponse('self.__MOXTAGS_FIXTURE = ' + JSON.stringify(fixture) + ';');
  }
  if (/^https:\/\/json\.edhrec\.com\/pages\/(cards|commanders)\//.test(target)) {
    edhrecFetches.push(Date.now());
    if (edhrecNextStatus) { const status = edhrecNextStatus; edhrecNextStatus = null; return jsonResponse({}, status); }
    const slug = target.slice(target.lastIndexOf('/') + 1).replace(/\.json$/, '');
    return jsonResponse({ container: { json_dict: { card: { ...edhrecCard, name: slug.replace(/-/g, ' ') } } } });
  }
  if (target.startsWith('https://api.scryfall.com/cards/')) return jsonResponse(SCRYFALL_CARD);
  throw new Error(`Unmocked fetch: ${target}`);
}

const edhrecFetches = [];
let edhrecNextStatus = null;
const edhrecCard = { name: 'Test Card', num_decks: 1200, potential_decks: 40000, salt: 1.5 };

const mock = createChrome({});

const page = createPage({
  url: 'chrome-extension://scryfall-toolkit/background.js',
  html: '<!DOCTYPE html><html><body></body></html>',
  mock,
  fetch: fetchMock
});
page.context.importScripts = (...files) => {
  for (const file of files) {
    // The tag data is no longer imported at start-up; the fixtures below stand
    // in for it and are read through getURL instead.
    if (file.startsWith('data/')) continue;
    page.script(file);
  }
};
// The worker reads the bundled tag snapshot as text and parses it. The mock
// serves fixtures in the same shape: a global assignment whose value is JSON.
const bundledTagFixtures = {
  'data/oracle-tags.js': { t: ['aggro', 'combo'], d: { [ORACLE_ID]: [0, 1] } },
  'data/illustration-tags-1.js': { t: ['sky'], d: { [ILLUS_ID]: [0] } },
  'data/illustration-tags-2.js': { t: [], d: {} }
};
// The platform snapshot is bundled as data; the fixture keeps a few sets and
// leaves "mtgo" out so the runtime lookup is exercised.
page.context.__STK_SET_PLATFORMS = { ysos: ['arena'], omb: ['arena', 'mtgo'] };
page.script('background.js');

const ctx = page.context;
const listener = mock.messageListeners[0];

// The Scryfall queue spaces requests 130 ms apart on purpose, so a test that
// waits 100 ms for an answer gives up before the answer is allowed to start.
function send(message, senderUrl = 'https://scryfall.com/card/tst/1/test-card', timeoutMs = 2000) {
  return new Promise(resolve => {
    let done = false;
    const respond = response => { if (!done) { done = true; resolve(response); } };
    listener(message, { url: senderUrl }, respond);
    setTimeout(() => { if (!done) { done = true; resolve({ noResponse: true }); } }, timeoutMs);
  });
}

const setsFetches = () => fetchLog.filter(url => url === 'https://api.scryfall.com/sets').length;

// EDHREC's published policy: one request a second at most, at least two seconds
// before trying again after a 429, and no hammering while something is broken.
// Their note says violators may be banned, so this is checked rather than assumed.
async function edhrecThrottleTest() {
  console.log('background.js: EDHREC asks no faster than their policy allows');
  const name = 'Test Card';
  edhrecFetches.length = 0;
  edhrecNextStatus = null;

  await send({ type: 'edhrec', name }, undefined, 4000);
  await send({ type: 'edhrec', name: 'Second Card' }, undefined, 4000);
  const spacing = edhrecFetches[1] - edhrecFetches[0];
  assert(edhrecFetches.length === 2, 'two EDHREC requests were made');
  assert(spacing >= 1000, `requests are at least a second apart (${spacing}ms)`);

  // Three tabs, three cards, all at once. The slot has to be taken before the
  // wait, not after, or these three sleep into the same second and fetch
  // together -- which is what the first version did.
  edhrecFetches.length = 0;
  await Promise.all([
    send({ type: 'edhrec', name: 'Parallel Card A' }, undefined, 8000),
    send({ type: 'edhrec', name: 'Parallel Card B' }, undefined, 8000),
    send({ type: 'edhrec', name: 'Parallel Card C' }, undefined, 8000)
  ]);
  assertEqual(edhrecFetches.length, 3, 'three at once still make three requests');
  const gaps = [edhrecFetches[1] - edhrecFetches[0], edhrecFetches[2] - edhrecFetches[1]];
  assert(gaps.every(gap => gap >= 1000),
    'and each lands at least a second after the one before (' + gaps.join(', ') + 'ms)');
  assert(edhrecFetches[2] - edhrecFetches[0] >= 2000,
    'so the three are spread over at least two seconds');

  // A 429 must hold the next attempt back by at least the two seconds they ask for.
  edhrecNextStatus = 429;
  const rejected = await send({ type: 'edhrec', name: 'Third Card' }, undefined, 4000);
  assert(rejected && rejected.ok === false, 'a 429 is reported to the page');
  const heldFrom = Date.now();
  await send({ type: 'edhrec', name: 'Fourth Card' }, undefined, 8000);
  const held = Date.now() - heldFrom;
  assert(held >= 2000, `a 429 holds the next request back (${held}ms)`);

  // The other race: a request already waiting its turn when the 429 lands. It
  // must see the new hold after it wakes rather than the one it computed before.
  edhrecNextStatus = 429;
  edhrecFetches.length = 0;
  const one = send({ type: 'edhrec', name: 'Queued Victim One' }, undefined, 8000);
  const two = send({ type: 'edhrec', name: 'Queued Victim Two' }, undefined, 8000);
  await Promise.all([one, two]);
  assertEqual(edhrecFetches.length, 2, 'both queued requests are made');
  const spread = edhrecFetches[1] - edhrecFetches[0];
  assert(spread >= 2000, 'the queued request sees the hold the 429 set (' + spread + 'ms)');
}

(async () => {
  try {
    console.log('background.js: registration');
    assert(typeof listener === 'function', 'onMessage listener registered');
    assertEqual(mock.installedListeners.length, 1, 'onInstalled listener registered');
    assertEqual(mock.alarmListeners.length, 1, 'alarm listener registered');
    assertEqual(mock.changeListeners.length, 1, 'storage.onChanged listener registered');
    assert(ctx.STK_FORMAT_OVERRIDES, 'format-overrides.js loaded through importScripts');

    console.log('background.js: sender guard');
    const fetchesBefore = fetchLog.length;
    const guarded = await send({ type: 'tags', set: 'tst', number: '1' }, 'https://evil.example/page');
    assertEqual(guarded, { noResponse: true }, 'foreign senders get no response at all');
    assertEqual(fetchLog.length, fetchesBefore, 'guarded request performed no network calls');

    console.log('background.js: EDHREC suggestions are resolved through Scryfall');
    // EDHREC names a card by its oracle id and sends no art and no printing, so
    // the panel cannot draw it or add it until Scryfall has been asked. That ask
    // is one batched call, and the oracle id comes back so the caller can match.
    {
      const oracleA = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
      const oracleB = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
      const before = fetchLog.length;
      const rows = (await send({ type: 'cardImages', oracleIds: [oracleA, oracleB] })).data;
      const calls = fetchLog.slice(before).filter(u => u === 'https://api.scryfall.com/cards/collection');
      assertEqual(calls.length, 1, 'both suggestions are asked for in one request');
      assertEqual(rows.length, 2, 'and both come back');
      assertEqual(rows[0].oracleId, oracleA, 'each row carries the oracle id it was asked by');
      assert(/^[0-9a-f-]{36}$/.test(rows[0].id), 'and the Scryfall id needed to add it');
      assert(/^https:\/\/cards\.scryfall\.io\//.test(rows[0].image), 'with its art');
    }
    {
      // Scryfall rejects a whole batch when one identifier is bad, so a
      // malformed one must fail the request rather than slip through and leave
      // the panel showing cards that were never looked up.
      const bad = await send({ type: 'cardImages', oracleIds: ['not-a-uuid'] });
      assertEqual(bad, { ok: false, error: 'Invalid card identifiers' },
        'a malformed oracle id is refused rather than passed on');
    }

    {
      // A list of suggestions is longer than Scryfall's 75 identifiers per call.
      // EDHREC sends a hundred at a time, and the art is the whole point of the
      // panel, so this has to be split rather than refused.
      const many = Array.from({ length: 100 }, (_, i) =>
        '00000000-0000-4000-8000-' + String(i).padStart(12, '0'));
      const before = fetchLog.length;
      const rows = (await send({ type: 'cardImages', oracleIds: many })).data;
      const calls = fetchLog.slice(before).filter(u => u === 'https://api.scryfall.com/cards/collection');
      assertEqual(calls.length, 2, 'a hundred suggestions go as two calls, not one refused call');
      assertEqual(rows.length, 100, 'and every one of them comes back with art');
      assert(rows.every(row => /^https:\/\/cards\.scryfall\.io\//.test(row.image)),
        'each with the art it was asked for');
    }

    console.log('background.js: Scryfall is asked no faster than they publish');
    // https://scryfall.com/docs/api/rate-limits publishes a different ceiling per
    // endpoint class, and the card classes are the tight ones:
    //
    //   /cards/search, /cards/named, /cards/random, /cards/collection  2/second
    //   /cards/manifest                                                 10/minute
    //   everything else                                                 10/second
    //
    // This was one queue with a 130 ms slot for everything, taken from the
    // "ten a second" figure — about four times their limit on exactly the endpoints
    // the extension leans on hardest — and with no hold-back on a 429 at all. What
    // follows checks the numbers still match what they publish, that every call goes
    // through the queue, and that the queue actually holds.
    {
      // The numbers are read out of the source rather than off the context: a const in
      // a vm script is not a property of the context object, and these numbers are the
      // thing being asserted — they have to keep matching the page quoted above.
      const source = require('node:fs')
        .readFileSync(require('node:path').join(__dirname, 'background.js'), 'utf8');
      const digitsAfter = marker => {
        const at = source.indexOf(marker);
        if (at < 0) return 0;
        // The number is written after a space, so skip anything that is not a digit
        // first and then take the run of digits.
        const rest = source.slice(at + marker.length).replace(/^\s+/, '');
        let n = '';
        for (const ch of rest) {
          if (ch < '0' || ch > '9') break;
          n += ch;
        }
        return n ? Number(n) : 0;
      };
      assert(digitsAfter('slowCards:') >= 500,
        'the card endpoints are held to at least the 500ms their 2/second limit means');
      assert(digitsAfter('manifest:') >= 6000,
        'the manifest endpoint is held to at least the 6s their 10/minute limit means');
      assert(digitsAfter('other:') >= 100,
        'and the rest to at least the 100ms their 10/second limit means');
      assert(digitsAfter('SCRYFALL_HOLD_MS =') >= 30000,
        'a 429 holds the queue back for the thirty seconds they say access is limited');

      // Which class a URL lands in. This is where the single-queue version went
      // wrong: there was nowhere in the code that knew what the limits were.
      const host = 'https://api.' + 'scryfall.com';
      assertEqual(ctx.scryfallClass(host + '/cards/search?q=x'), 'slowCards',
        'a search is one of the two-a-second class');
      assertEqual(ctx.scryfallClass(host + '/cards/named?exact=x'), 'slowCards',
        'and so is a named lookup');
      assertEqual(ctx.scryfallClass(host + '/cards/collection'), 'slowCards',
        'and so is a collection, which the finish column and the deck art both use');
      assertEqual(ctx.scryfallClass(host + '/cards/manifest'), 'manifest',
        'the manifest endpoint is on its own, much slower one');
      assertEqual(ctx.scryfallClass(host + '/sets'), 'other',
        'set lists are in the ordinary class');

      // And nothing may reach api.scryfall.com except through the queue. An unpaced
      // /cards/search is ten a second against a limit of two, which is the whole bug.
      // A URL built into a variable first is not a call, so those are left alone —
      // the call that uses it is checked on its own.
      const notIdentifier = ch => {
        if (!ch) return true;
        const c = ch.charCodeAt(0);
        const letter = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
        const digit = c >= 48 && c <= 57;
        return !(letter || digit || ch === '_' || ch === '$');
      };
      const paced = ['scryfallJSON', 'scryfallGet', 'scryfallClass'];
      const unpaced = [];
      for (let at = source.indexOf(host); at >= 0; at = source.indexOf(host, at + 1)) {
        // Walk back over the quote, any space and the opening bracket, then take the
        // identifier being called with this URL. Reading the whole text rather than
        // the line matters: several call sites put the URL on a line of its own and
        // the function name is on the one above — which is exactly how a paced
        // /cards/search stayed unpaced for a while without showing up here.
        let end = at;
        while (end > 0 && (notIdentifier(source[end - 1]) || source[end - 1] === ' ')) end--;
        let start = end;
        while (start > 0 && !notIdentifier(source[start - 1])) start--;
        const name = source.slice(start, end);
        // Only a call is a problem. `let url = \`...\`` is a variable.
        const isCall = source[end] === '(';
        if (name && isCall && !paced.includes(name)) {
          const lineStart = source.lastIndexOf(String.fromCharCode(10), at) + 1;
          unpaced.push(name + '() -> ' + source.slice(lineStart, at).trim().slice(0, 60));
        }
      }
      assertEqual(unpaced, [],
        'nothing reaches api.scryfall.com except through the paced queue');
    }
    {
      // The queue holds, timed for real rather than with a fake clock, so this is the
      // same thing the extension would actually do.
      const started = Date.now();
      await Promise.all([0, 1, 2].map(() => send({
        type: 'cardImages', oracleIds: ['00000000-0000-4000-8000-000000000001']
      }).catch(() => null)));
      const elapsed = Date.now() - started;
      assert(elapsed >= 2 * 500,
        'three card requests are spread across their slots, not fired together (' + elapsed + 'ms)');
    }


    console.log('background.js: parseTaggerCard classifier direction');
    const forward = ctx.parseTaggerCard({ oracleId: ORACLE_ID, edges: [REL_FORWARD] });
    assertEqual(forward.card[0],
      { name: 'Other Card', targetId: REL_ID, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' },
      'viewing the subject side shows classifier and related name');
    const reverse = ctx.parseTaggerCard({ oracleId: REL_ID, edges: [REL_FORWARD] });
    assertEqual(reverse.card[0],
      { name: 'Test Card', targetId: ORACLE_ID, tagType: 'WORSE_THAN', relation: true, targetKind: 'card' },
      'viewing the related side flips to classifierInverse and subject name');
    const tagging = ctx.parseTaggerCard({ edges: [
      { __typename: 'Tagging', tag: { type: 'ORACLE_CARD_TAG', name: 'Aggro', slug: 'aggro' } },
      { __typename: 'Tagging', tag: { type: 'ILLUSTRATION_TAG', name: 'Skyline', slug: 'skyline' } },
      { __typename: 'Tagging', tag: { type: 'PRINTING_TAG', name: 'P1', slug: 'p1' } },
      { __typename: 'Tagging', tag: { type: 'OTHER_TAG', name: 'X', slug: 'x' } },
      { __typename: 'Tagging', tag: { type: 'ORACLE_CARD_TAG', name: 'NoSlug' } },
      { __typename: 'Relationship', foreignKey: 'somethingElse', subjectName: 'S', subjectId: ORACLE_ID,
        relatedName: 'R', relatedId: REL_ID, classifier: 'C', classifierInverse: 'I' }
    ] });
    assertEqual(tagging.card.map(item => item.slug), ['aggro'], 'oracle tags land on the card list only');
    assertEqual(tagging.art.map(item => item.slug), ['skyline', 'p1'], 'illustration and printing tags land on the art list');
    assertEqual(tagging.fallback, false, 'parse result never claims a fallback');
    const badTarget = ctx.parseTaggerCard({ oracleId: ORACLE_ID, edges: [{
      __typename: 'Relationship', foreignKey: 'oracleId', subjectName: 'S', subjectId: ORACLE_ID,
      relatedName: 'Bad', relatedId: 'not-a-uuid', classifier: 'C', classifierInverse: 'I'
    }] });
    assertEqual(badTarget.card.length, 0, 'relationships with invalid target ids are dropped');
    const artRelation = ctx.parseTaggerCard({ illustrationId: ILLUS_ID, edges: [{
      __typename: 'Relationship', foreignKey: 'illustrationId', subjectName: 'Ill Subject', subjectId: ILLUS_ID,
      relatedName: 'Ill Related', relatedId: ILLUS_REL_ID, classifier: 'DEPICTS', classifierInverse: 'DEPICTED_IN'
    }] });
    assertEqual(artRelation.art[0],
      { name: 'Ill Related', targetId: ILLUS_REL_ID, tagType: 'DEPICTS', relation: true, targetKind: 'art' },
      'illustration relationships stay on the art list');

    console.log('background.js: lookup and compact units');
    const built = ctx.compact([
      { slug: 'dragons', oracle_ids: [ORACLE_ID, CARD_ID] },
      { slug: 'combo', taggings: [{ oracle_id: ORACLE_ID }] },
      { label: 'art-only', illustration_ids: [ILLUS_ID] },
      { nothing: true }
    ], 'oracle_id');
    assertEqual(built, {
      t: ['dragons', 'combo'],
      d: { [ORACLE_ID]: [0, 1], [CARD_ID]: [0] }
    }, 'compact groups ids under shared labels');
    assertEqual(ctx.lookup(built, ORACLE_ID),
      [{ name: 'dragons', slug: 'dragons' }, { name: 'combo', slug: 'combo' }],
      'lookup resolves ids back to tag entries');
    assertEqual(ctx.lookup(built, '99999999-9999-4999-8999-999999999999'), [], 'unknown ids resolve to nothing');
    assertEqual(ctx.lookup(undefined, ORACLE_ID), [], 'missing index resolves to nothing');
    assertEqual(ctx.lookup(built, undefined), [], 'missing id resolves to nothing');

    console.log('background.js: tags message');
    const invalidSet = await send({ type: 'tags', set: 'bad set', number: '1' });
    assertEqual(invalidSet, { ok: false, error: 'Invalid card identity' }, 'invalid set is rejected');
    const invalidNumber = await send({ type: 'tags', set: 'tst', number: 'bad number!' });
    assertEqual(invalidNumber, { ok: false, error: 'Invalid card identity' }, 'invalid collector number is rejected');

    const tags = await send({ type: 'tags', set: 'tst', number: '1' });
    if (!tags.ok) assert(false, 'tags lookup failed: ' + tags.error);
    assertEqual(tags.ok, true, 'valid tags request succeeds');
    assertEqual(tags.data.card.map(item => item.name), ['Aggro', 'Other Card', 'combo'],
      'live card tags merge with bundled tags, deduplicated by slug');
    assertEqual(tags.data.art.map(item => item.name), ['Skyline', 'Ill Related', 'sky'],
      'live art tags merge with bundled art tags');
    assertEqual(tags.data.card[1],
      { name: 'Other Card', targetId: REL_ID, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' },
      'relationship entry keeps classifier direction end to end');
    assertEqual(tags.data.fallback, false, 'successful registry lookup is not a fallback');

    const fetchesAfterTags = fetchLog.length;
    const cached = await send({ type: 'tags', set: 'tst', number: '1' });
    assertEqual(cached.ok, true, 'repeated tags request succeeds');
    assertEqual(fetchLog.length, fetchesAfterTags, 'repeated tags request is served from cache');

    registryBehavior = 'fail';
    const fallback = await send({ type: 'tags', set: 'fb', number: '1' });
    registryBehavior = 'ok';
    assertEqual(fallback.ok, true, 'registry outage still answers from bundled data');
    assertEqual(fallback.data.fallback, true, 'registry outage is marked as fallback');
    assertEqual(fallback.data.card.map(item => item.name), ['aggro', 'combo'], 'fallback returns bundled card tags');
    assertEqual(fallback.data.art.map(item => item.name), ['sky'], 'fallback returns bundled art tags');

    console.log('background.js: setCategories caching');
    const categories = await send({ type: 'setCategories' });
    assertEqual(categories.data, {
      digital: ['mtgo'], nonTournament: ['token', 'cei'], oversized: ['ocmd'], foreignBlackBorder: ['4bb']
    }, 'set categories are classified correctly');
    assertEqual(setsFetches(), 1, 'first setCategories call fetched /sets once');
    assert(mock.state.digitalSetIndex && mock.state.digitalSetIndex.expires > Date.now(),
      'set index persisted with a future expiry');
    const cachedCategories = await send({ type: 'setCategories' });
    assertEqual(cachedCategories.data, categories.data, 'second call answers from the stored index');
    assertEqual(setsFetches(), 1, 'second setCategories call performed no fetch');
    const digitalOnly = await send({ type: 'digitalSets' });
    assertEqual(digitalOnly.data, ['mtgo'], 'digitalSets returns only the digital list');
    assertEqual(setsFetches(), 1, 'digitalSets also answers from cache');

    console.log('background.js: setPlatforms message');
    const gameSearches = () => fetchLog.filter(url => url.includes('q=e%3Amtgo')).length;
    const platforms = await send({ type: 'setPlatforms' });
    assertEqual(platforms.data.ysos, ['arena'], 'the bundled snapshot answers for a known Arena set');
    assertEqual(platforms.data.omb, ['arena', 'mtgo'], 'a set released for both clients keeps both platforms');
    assertEqual(platforms.data.mtgo, ['mtgo'], 'a digital set missing from the snapshot is looked up');
    assertEqual(gameSearches(), 1, 'only sets missing from the snapshot are searched');
    assert(mock.state.setPlatformIndex && mock.state.setPlatformIndex.expires > Date.now(),
      'platform index persisted with a future expiry');
    const cachedPlatforms = await send({ type: 'setPlatforms' });
    assertEqual(cachedPlatforms.data, platforms.data, 'the platform index answers from the stored index');
    assertEqual(gameSearches(), 1, 'a stored platform index performs no further search');

    console.log('background.js: finishes message');
    const finishes = await send({ type: 'finishes', ids: [FIN_ID_1, FIN_ID_2] });
    assertEqual(finishes.data, {
      [FIN_ID_1]: { finishes: ['foil'], promoTypes: ['textured'] },
      [FIN_ID_2]: { finishes: ['nonfoil'], promoTypes: [] }
    }, 'finishes are mapped with promo types renamed');
    const badFinishes = await send({ type: 'finishes', ids: ['not-a-uuid'] });
    assertEqual(badFinishes, { ok: false, error: 'Invalid printing IDs' }, 'malformed ids are rejected');
    const tooMany = await send({ type: 'finishes', ids: Array.from({ length: 76 }, () => FIN_ID_1) });
    assertEqual(tooMany, { ok: false, error: 'Invalid printing IDs' }, 'more than 75 ids are rejected');

    console.log('background.js: allPrints message');
    const badOracle = await send({ type: 'allPrints', oracleId: 'nope' });
    assertEqual(badOracle, { ok: false, error: 'Invalid Oracle ID' }, 'malformed oracle id is rejected');
    const allPrints = await send({ type: 'allPrints', oracleId: CARD_ID });
    assertEqual(allPrints.ok, true, 'allPrints request succeeds');
    assertEqual(allPrints.data.truncated, false, 'single page result is not truncated');
    assertEqual(allPrints.data.prints.length, 2, 'both prints returned');
    assertEqual(allPrints.data.prints[0], {
      id: 'card-a', name: 'Test Card', uri: 'https://scryfall.com/card/tst/1/test',
      set: 'tst', setName: 'Test Set', number: '1', lang: 'en',
      digital: false, finishes: ['nonfoil'], prices: { eur: '1.00' },
      image: 'https://cards.scryfall.io/normal/front/a/aa/test.jpg'
    }, 'scryfall print fields are renamed for the content script, art included');
    assertEqual(allPrints.data.prints[1].image, null, 'a printing without art reports no image');
    const evilPage = await send({ type: 'allPrints', oracleId: EVIL_PRINTS_ID });
    assertEqual(evilPage, { ok: false, error: 'Invalid next page' }, 'next_page from a foreign host is rejected');

    console.log('background.js: query message');
    const badFormat = await send({ type: 'query', oracleId: CARD_ID, format: 'premodern' });
    assertEqual(badFormat, { ok: false, error: 'Invalid format' }, 'only classic/peak/heritage use the query path');
    const badQueryOracle = await send({ type: 'query', oracleId: 'nope', format: 'classic' });
    assertEqual(badQueryOracle, { ok: false, error: 'Invalid Oracle ID' }, 'malformed oracle id is rejected');
    for (const format of ['classic', 'heritage', 'peak']) {
      const overridden = await send({ type: 'query', oracleId: CLASSIC_OVERRIDE_ID, format });
      assertEqual(overridden, { ok: true, data: { legality: 'legal' } }, `${format} override answers without network`);
      assert(!fetchLog.some(url => url.includes(CLASSIC_OVERRIDE_ID)),
        `${format} override performed no fetch`);
    }
    const queried = await send({ type: 'query', oracleId: QUERY_ID, format: 'classic' });
    assertEqual(queried, { ok: true, data: { legality: 'legal' } }, 'miss falls back to a Scryfall search');
    const notLegal = await send({ type: 'query', oracleId: QUERY_404_ID, format: 'classic' });
    assertEqual(notLegal, { ok: true, data: { legality: 'not_legal' } }, 'empty search result maps to not_legal');

    console.log('background.js: preview message');
    const badKind = await send({ type: 'preview', kind: 'name', id: PREVIEW_ID });
    assertEqual(badKind, { ok: false, error: 'Invalid preview identity' }, 'unsupported preview kind is rejected');
    const badId = await send({ type: 'preview', kind: 'oracleid', id: 'nope' });
    assertEqual(badId, { ok: false, error: 'Invalid preview identity' }, 'malformed preview id is rejected');
    const preview = await send({ type: 'preview', kind: 'oracleid', id: PREVIEW_ID });
    assertEqual(preview, { ok: true, data: {
      name: 'Other Card',
      image: 'https://cards.scryfall.io/normal/o.jpg',
      uri: 'https://scryfall.com/card/oth/1/other-card'
    } }, 'preview returns name, safe image and card page');
    const badImage = await send({ type: 'preview', kind: 'oracleid', id: PREVIEW_BAD_ID });
    assertEqual(badImage, { ok: false, error: 'No preview available' }, 'preview images must come from cards.scryfall.io');

    console.log('background.js: card message and unknown requests');
    const badCard = await send({ type: 'card', id: 'nope' });
    assertEqual(badCard, { ok: false, error: 'Invalid Scryfall ID' }, 'malformed Scryfall id is rejected');
    const card = await send({ type: 'card', id: CARD_ID });
    assertEqual(card, { ok: true, data: SCRYFALL_CARD }, 'card lookup proxies Scryfall');
    const unknown = await send({ type: 'definitely-not-a-request' });
    assertEqual(unknown, { ok: false, error: 'Unknown request' }, 'unknown request types fail explicitly');

    console.log('background.js: refreshIndexes');
    await ctx.refreshIndexes();
    const stored = mock.state.tagIndexes;
    assert(stored && stored.oracle && stored.art1 && stored.art2, 'refresh persists all three index parts');
    assertEqual(stored.oracle.t.length, 110, 'oracle labels stored');
    assertEqual(Object.keys(stored.oracle.d).length, 110, 'oracle index covers every id');
    assertEqual(Object.keys(stored.art1.d).length, 55, 'art index first half');
    assertEqual(Object.keys(stored.art2.d).length, 55, 'art index second half');
    assert(fetchLog.includes('https://data.scryfall.io/bulk/oracle-tags.json'), 'oracle bulk file downloaded');
    assert(fetchLog.includes('https://data.scryfall.io/bulk/art-tags.json'), 'art bulk file downloaded');

    await edhrecThrottleTest();
    summary('test-background');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
