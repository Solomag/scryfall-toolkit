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

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

async function fetchMock(url) {
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
  if (target === 'https://api.scryfall.com/cards/collection') return jsonResponse(collectionResponse);
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
    if (q.includes(PREVIEW_BAD_ID)) {
      return jsonResponse({ data: [{ name: 'Bad Image', image_uris: { normal: 'https://evil.example/img.jpg' }, scryfall_uri: 'https://scryfall.com/card/bad/1' }] });
    }
    return jsonResponse({ data: [{ name: 'Other Card', image_uris: { normal: 'https://cards.scryfall.io/normal/o.jpg' }, scryfall_uri: 'https://scryfall.com/card/oth/1/other-card' }] });
  }
  if (target.startsWith('https://api.scryfall.com/cards/')) return jsonResponse(SCRYFALL_CARD);
  throw new Error(`Unmocked fetch: ${target}`);
}

const mock = createChrome({});

const page = createPage({
  url: 'chrome-extension://scryfall-toolkit/background.js',
  html: '<!DOCTYPE html><html><body></body></html>',
  mock,
  fetch: fetchMock
});
page.context.importScripts = (...files) => {
  for (const file of files) {
    // The multi-megabyte bundled tag files are replaced with fixtures below;
    // test-theme.cjs compiles them to prove they are valid JavaScript.
    if (file.startsWith('data/')) continue;
    page.script(file);
  }
};
page.context.__MOXTAGS_ORACLE = { t: ['aggro', 'combo'], d: { [ORACLE_ID]: [0, 1] } };
page.context.__MOXTAGS_ILLUS_1 = { t: ['sky'], d: { [ILLUS_ID]: [0] } };
page.context.__MOXTAGS_ILLUS_2 = { t: [], d: {} };
page.script('background.js');

const ctx = page.context;
const listener = mock.messageListeners[0];

function send(message, senderUrl = 'https://scryfall.com/card/tst/1/test-card') {
  return new Promise(resolve => {
    let done = false;
    const respond = response => { if (!done) { done = true; resolve(response); } };
    listener(message, { url: senderUrl }, respond);
    setTimeout(() => { if (!done) { done = true; resolve({ noResponse: true }); } }, 100);
  });
}

const setsFetches = () => fetchLog.filter(url => url === 'https://api.scryfall.com/sets').length;

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
    if (!tags.ok) console.error('DEBUG tags error:', tags.error);
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

    summary('test-background');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
