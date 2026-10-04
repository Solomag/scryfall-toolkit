'use strict';
// The two name-matched rules, checked against Scryfall, because they are the only rules in
// this extension that are decided by a pattern in a set's *name* rather than by anything
// Scryfall can be asked.
//
// A name is not evidence. `BORDER_SET_NAMES` matches three names, and `NON_ENGLISH_SET_NAMES`
// matches two families by name, and neither list is something the API endorses — a set object
// has no field saying whether it is a Portal release. Measured 2026-10-04: a set object
// carries `arena_code, block, block_code, card_count, code, digital, foil_only, icon_svg_uri,
// id, mtgo_code, name, nonfoil_only, object, printed_size, released_at, scryfall_uri,
// search_uri, set_type, tcgplayer_id, uri` — nothing about languages, nothing about borders.
//
// So each family is asked a question the API can refuse to answer, and what it refuses is the
// finding:
//
//   The border rule is falsifiable and complete. A foreign black border set has no English
//   printing anywhere in it, so `e:<code> lang:en` is *refused* for one and answered for
//   every other set. That refusal is an answer, not a failure — which is what makes the
//   claim checkable at all. This tool sweeps every set Scryfall serves and asks, so the
//   claim is not "these three look right" but "these three and no others have no English
//   printing".
//
//   The non-English rule is not falsifiable, and this is the measured reason rather than an
//   assertion. Portal and Secret Lair are English sets that happened to be released abroad:
//   `sld` has 2,799 English printings out of 2,918, `por` 215 of 1,512. A set-level property
//   that separates them from ordinary sets does not exist, because there is none to find —
//   so their list is read from names and the code says so where a reader will meet it.
//
// Three negation attempts were made first, and all three failed, which is why the sweep asks
// about English rather than about the absence of English:
//
//   lang:!en   is not a negation. On m21 it returns all 397 printings — the same as no term.
//   -lang:en   is not one either. On m21 it returns 3,411 against 397 English.
//   NOT lang:en is honoured and wrong. Refused for m21 (correct: no foreign printing there)
//   and refused for cmd and tsp, which certainly have foreign printings.
//
// The sweep is cached under dist/ and re-run when asked; a full pass is 1,053 requests at
// Scryfall's ten a second, which is about twenty minutes. That is why it is a tool and not
// part of `npm test`.
const fs = require('node:fs');
const path = require('node:path');
const { workerTables, classify } = require('./shots/worker-tables.cjs');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'dist', 'set-name-rules');
const AGENT = 'Scryfall Toolkit build tool (checking the set name rules)';
const SET_INDEX = 'https://api.scryfall.com/sets';

// Between requests. Scryfall allows ten a second; 1.15s is comfortably under it and is what
// every other tool in this repository uses.
const PAUSE = 1150;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const checks = [];
const failures = [];
const notes = [];

function check(ok, label, detail) {
  checks.push(1);
  if (!ok) {
    failures.push(label);
    if (detail) notes.push(label + ' — ' + detail);
  }
  console.log((ok ? '  ok:   ' : '  FAIL: ') + label +
    (!ok && detail ? '\n         — ' + detail : ''));
}

// A refusal and a failure are different things, and the whole border claim rests on telling
// them apart. `not_found` is Scryfall saying "nothing matches"; a 429 or a 500 is the request
// not having been answered, and counting one of those as "no English printing" would invent
// the finding. Earlier sweeps over all 1,053 sets did exactly that, which is why this one
// keeps the three apart and re-asks whatever it could not read.
async function englishIn(code) {
  const url = SET_INDEX.replace('/sets', '/cards/search') + '?q=' +
    encodeURIComponent('e:' + code + ' lang:en') + '&unique=prints';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
    } catch (error) {
      await sleep(PAUSE);
      continue;
    }
    if (response.status === 429) {
      await sleep(Number(response.headers.get('retry-after') || 3) * 1000);
      continue;
    }
    const body = await response.json().catch(() => ({}));
    await sleep(PAUSE);
    if (response.status === 200) return { english: body.total_cards };
    if (response.status === 404 || body.code === 'not_found') return { english: 0 };
    // Anything else is an answer nobody read.
  }
  return { english: null };
}

// How many printings the index has for a set, with no language term at all.
//
// This is asked for every set that `lang:en` refused, and it exists because a refusal is
// ambiguous. `e:<code> lang:en` is refused for a set with no English printing — and it is
// refused just as readily for a set Scryfall indexes no printings for at all. Those are
// different facts and only one of them is about English: on the first sweep, `wmkm` and
// `p30t` came back refused, and both are sets Scryfall has printings for. Counting them as
// "no English printing" would have invented 31 sets that do not exist.
async function printingsIn(code) {
  const url = SET_INDEX.replace('/sets', '/cards/search') + '?q=' +
    encodeURIComponent('e:' + code) + '&unique=prints';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    let response;
    try {
      response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
    } catch {
      await sleep(PAUSE);
      continue;
    }
    if (response.status === 429) {
      await sleep(Number(response.headers.get('retry-after') || 3) * 1000);
      continue;
    }
    const body = await response.json().catch(() => ({}));
    await sleep(PAUSE);
    if (response.status === 200) return body.total_cards;
    if (response.status === 404 || body.code === 'not_found') return 0;
  }
  return null;
}

async function setIndex() {
  const file = path.join(CACHE, 'sets.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const response = await fetch(SET_INDEX, { headers: { 'User-Agent': AGENT, Accept: 'application/json' } });
  if (!response.ok) throw new Error(response.status + ' from the set index');
  const body = await response.json();
  if (!Array.isArray(body.data) || body.has_more) {
    throw new Error('the set index came back incomplete, so a sweep over it would be a sweep ' +
      'over part of Scryfall and every conclusion drawn from it would be about that part');
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(body.data), 'utf8');
  return body.data;
}

// The sweep, cached by the date it was run. Cached because it is twenty minutes of requests
// and the answer does not change within a day; keyed by date because a month-old answer is
// not an answer about today's index.
//
// Written every fifty sets rather than once at the end, because a twenty-minute run gets
// interrupted: the first attempt at this was piped through a pager that closed after twelve
// lines, the process died at a hundred sets, and a cache written only at the end would have
// thrown away every request it had made. A rerun picks up from the file, and `--fresh` asks
// again whatever it finds.
async function sweep(sets, fresh) {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(CACHE, 'english-by-set-' + day + '.json');
  const answers = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (!fresh && Object.keys(answers).length >= sets.length) {
    console.log('using the sweep cached for ' + day + ', ' + Object.keys(answers).length +
      ' sets (pass --fresh to ask Scryfall again)');
    return answers;
  }
  if (Object.keys(answers).length) {
    console.log('resuming: ' + Object.keys(answers).length + ' sets already answered today');
  }
  fs.mkdirSync(CACHE, { recursive: true });
  let asked = 0;
  let unread = 0;
  for (const set of sets) {
    const code = String(set.code || '').toLowerCase();
    if (!/^[a-z0-9_-]+$/i.test(code)) continue;
    if (fresh || answers[code] === undefined) answers[code] = (await englishIn(code)).english;
    asked += 1;
    if (answers[code] === null) unread += 1;
    if (asked % 50 === 0) {
      fs.writeFileSync(file, JSON.stringify(answers), 'utf8');
      process.stdout.write('\r  asked ' + asked + ' of ' + sets.length +
        (unread ? ', ' + unread + ' unread' : '') + '   ');
    }
  }
  process.stdout.write('\r  asked ' + asked + ' of ' + sets.length +
    (unread ? ', ' + unread + ' unread' : '') + '\n');
  fs.writeFileSync(file, JSON.stringify(answers), 'utf8');
  return answers;
}

(async () => {
  const fresh = process.argv.includes('--fresh');
  const sets = await setIndex();
  const tables = workerTables();
  const categories = classify(sets, tables);

  console.log('Scryfall Toolkit: the set name rules, against Scryfall');
  console.log('  sets served: ' + sets.length);
  console.log('  patterns, read out of worker.js:');
  for (const [group, table] of [['foreign black border', tables.border],
    ['non-English', tables.nonEnglish]]) {
    for (const [key, pattern] of Object.entries(table)) {
      const matched = categories[group === 'non-English' ? 'nonEnglish' : 'foreignBlackBorder'][key] || [];
      console.log('    ' + group.padEnd(20) + key.padEnd(13) +
        String(matched.length).padStart(3) + ' set(s)  ' +
        (matched.join(', ') || '—') + '   /' + pattern.source + '/');
    }
  }
  console.log('');

  const english = await sweep(sets, fresh);
  const unread = Object.entries(english).filter(([, count]) => count === null).map(([code]) => code);
  check(unread.length === 0,
    'every set came back with an answer the sweep could read',
    unread.length ? unread.length + ' could not be read and are not counted either way: ' +
      unread.slice(0, 12).join(', ') : null);
  if (unread.length) {
    console.error('');
    console.error('A set nobody answered for is not a set with no English printing. Fix the ' +
      'requests and run it again; the sweep above already saved what it did read.');
    process.exit(1);
  }

  // A refusal from `lang:en` is ambiguous until it is compared with the same query and no
  // language term: a set with no printings in the index is refused too, and says nothing
  // about English. Only the sets that have printings and no English among them are in the
  // state the border rule claims, and the rest are counted separately so neither is quietly
  // folded into the other.
  const refused = Object.entries(english)
    .filter(([, count]) => count === 0)
    .map(([code]) => code)
    .sort();
  // Cached beside the sweep, because this is thirty-five more requests and they are asked on
  // every run while the thousand behind them are not.
  const totalsFile = path.join(CACHE, 'printings-by-set-' + new Date().toISOString().slice(0, 10) + '.json');
  const totals = fs.existsSync(totalsFile) ? JSON.parse(fs.readFileSync(totalsFile, 'utf8')) : {};
  for (const code of refused) {
    if (totals[code] === undefined) {
      totals[code] = await printingsIn(code);
      process.stdout.write('\r  asked for the printings of ' + refused.length + ' refused sets: ' +
        code + '   ');
    }
  }
  fs.writeFileSync(totalsFile, JSON.stringify(totals), 'utf8');
  process.stdout.write('\r  printings counted for ' + Object.keys(totals).length +
    ' refused sets\n');

  const unreadTotals = refused.filter(code => totals[code] === null);
  check(unreadTotals.length === 0,
    'every refused set came back with an answer about its printings',
    unreadTotals.length ? 'still unread: ' + unreadTotals.join(', ') : null);
  const empty = refused.filter(code => totals[code] === 0);
  const withoutEnglish = refused.filter(code => totals[code] > 0);

  console.log('');
  console.log('  ' + refused.length + ' sets were refused for lang:en. Of those, ' +
    withoutEnglish.length + ' have printings and no English printing among them, and ' +
    empty.length + ' have no printings in the index at all, which says nothing about English:');
  if (empty.length) console.log('    no printings: ' + empty.join(', '));

  console.log('');
  console.log('the border rule: every set its patterns name has printings and no English among them');
  for (const key of Object.keys(tables.border)) {
    for (const code of categories.foreignBlackBorder[key] || []) {
      check(english[code] === 0 && (totals[code] ?? 0) > 0,
        '  ' + key + '/' + code + ' has printings and no English printing at all (' +
        (totals[code] ?? '?') + ' printings, 0 English)',
        english[code] !== 0
          ? 'Scryfall counts ' + english[code] + ' English printings in it, so the pattern ' +
            'is naming something else'
          : (totals[code] === 0 ? 'the index has no printings for it at all, so there is ' +
            'nothing here to be a border set or anything else' : null));
    }
  }

  console.log('');
  console.log('the border rule: what else is in that state, and what it is');
  //
  // The first version of this section claimed these three are the *only* sets Scryfall serves
  // with no English printing, and the sweep refused it: 34 sets are in that state, not three.
  // The claim was wrong and the tool said so, which is the only reason this paragraph exists.
  //
  // What is true is narrower and still worth having. These three are the sets Scryfall *calls*
  // Foreign Black Border, and no other set carries that name. The other 31 are foreign-only
  // products — Japanese promos, an Italian release of Renaissance, Salvat boxes, Sega Dreamcast
  // cards, five sets of Japanese promo tokens — which are in the state for a completely
  // different reason and which nobody would call a border release.
  const namedByBorder = new Set(Object.values(categories.foreignBlackBorder).flat());
  const byName = code => sets.find(set => String(set.code).toLowerCase() === code);
  const others = withoutEnglish.filter(code => !namedByBorder.has(code));
  console.log('  ' + others.length + ' more sets have printings and no English printing:');
  const rows = others.map(code => {
    const set = byName(code) || {};
    return '    ' + code.padEnd(6) + String(set.name || '?').padEnd(46).slice(0, 46) +
      String(set.set_type || '?');
  });
  for (const row of rows) console.log(row);

  check(namedByBorder.size === withoutEnglish.length - others.length,
    'the sets the patterns name are exactly the border sets among them',
    'the two counts do not line up, so the list is being read wrong');
  check(others.every(code => !/foreign black border/i.test(byName(code)?.name || '')),
    'and Scryfall calls none of the ' + others.length + ' others a Foreign Black Border set',
    others.filter(code => /foreign black border/i.test(byName(code)?.name || ''))
      .join(', '));
  const namedByLanguage = new Set(Object.values(categories.nonEnglish).flat());
  check(others.every(code => !namedByLanguage.has(code)),
    'and none of them is a Portal or a Secret Lair set either, so the two rules do not overlap',
    others.filter(code => namedByLanguage.has(code)).join(', '));
  const notPromo = others.filter(code => !['promo', 'token'].includes(byName(code)?.set_type));
  console.log('  ' + notPromo.length + ' of them are not a promo or a token set, and those are ' +
    'the ones a reader would recognise as products:');
  for (const code of notPromo) {
    console.log('    ' + code.padEnd(6) + String(byName(code)?.name || '?').padEnd(46).slice(0, 46) +
      String(byName(code)?.set_type || '?'));
  }

  console.log('');
  console.log('both rules are complete for what they claim, which costs nothing to check');
  //
  // The sweep proves each matched set is in the state the rule claims. This proves the other
  // half, and for a rule decided by a name it is the half that can actually fail quietly: a
  // set Scryfall *calls* Portal that no pattern matches is a rule with a hole, and nothing
  // about the matched sets would show it. The names are already in hand, so it is exact and
  // free — measured 2026-10-04: nine sets say Portal or Secret Lair, three say Foreign Black
  // Border, and every one of the twelve is matched.
  const namedSets = (word, patterns) => {
    const table = patterns;
    return sets
      .filter(set => word.test(set.name || ''))
      .filter(set => {
        const code = String(set.code).toLowerCase();
        return !Object.values(table).some(pattern => pattern.test(set.name || '')) ||
          !/^[a-z0-9_-]+$/i.test(code);
      })
      .map(set => String(set.code).toLowerCase() + ' ("' + set.name + '")');
  };
  const unclaimedPortal = namedSets(/portal|secret lair/i, tables.nonEnglish);
  check(unclaimedPortal.length === 0,
    'every set Scryfall names Portal or Secret Lair is matched (' +
    sets.filter(set => /portal|secret lair/i.test(set.name || '')).length + ' of them)',
    unclaimedPortal.length ? 'named but matched by no pattern: ' + unclaimedPortal.join(', ') : null);
  const unclaimedBorder = namedSets(/foreign black border/i, tables.border);
  check(unclaimedBorder.length === 0,
    'and every set Scryfall names Foreign Black Border is matched (' +
    sets.filter(set => /foreign black border/i.test(set.name || '')).length + ' of them)',
    unclaimedBorder.length ? 'named but matched by no pattern: ' + unclaimedBorder.join(', ') : null);

  console.log('');
  console.log('the non-English rule: why it is read from names, with the numbers');
  for (const key of Object.keys(tables.nonEnglish)) {
    for (const code of categories.nonEnglish[key] || []) {
      const count = english[code];
      check(count > 0,
        '  ' + key + '/' + code + ' has English printings, so nothing about the set says ' +
        'why it is here (' + count + ' of them)',
        count > 0 ? null : 'it has no English printing either, which would mean it belongs ' +
          'to the border family rather than this one');
    }
  }
  const englishNamed = Object.values(categories.nonEnglish).flat()
    .every(code => english[code] > 0);
  check(englishNamed,
    'every set the non-English rule names is an English set, which is why a set-level ' +
    'property cannot replace the name');
  const englishTotal = Object.values(english).filter(count => count > 0).length;
  console.log('  ' + englishTotal + ' of ' + Object.keys(english).length +
    ' sets have at least one English printing, ' + withoutEnglish.length +
    ' have printings and none in English, and ' + empty.length + ' are not indexed at all.');

  console.log('');
  if (notes.length) {
    console.log(notes.length + ' of ' + checks.length + ' checks did not pass, each with a reason:');
    for (const note of notes) console.log('  - ' + note);
  }
  if (failures.length) {
    console.error('');
    console.error(failures.length + ' of ' + checks.length + ' checks failed:');
    for (const label of failures) console.error('  - ' + label);
    process.exit(1);
  }
  console.log('');
  console.log('set name rules: ' + checks.length + ' checks passed. Answers in ' +
    path.relative(ROOT, CACHE) + '.');
})().catch(error => { console.error(error); process.exit(1); });
