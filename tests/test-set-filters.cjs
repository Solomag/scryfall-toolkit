// The visibility settings, their migration, and the per-platform areas.
//
// Migration is the part that can take something away from a reader who never asked: it reads
// settings written by four older builds and has to arrive at something defensible. The shape
// itself has been rewritten four times, and this is the fourth — the shortest — so the
// migrations are the test, not an afterthought to them.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { assert, assertEqual, summary } = require('./testlib.cjs');

function load() {
  const context = { window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'set-filters.js'), 'utf8'), context);
  return context.window.STK_SET_FILTERS;
}

function defaultsTest() {
  console.log('set-filters: the defaults, which all say "show"');
  const F = load();
  assert(F, 'the module publishes the shape');

  const d = F.defaults();
  assertEqual(Object.keys(d.platforms), ['paper', 'arena', 'mtgo'],
    'the three platforms, and Paper is one of them alongside the digital ones');
  assertEqual(d.platforms.paper, { show: true, areas: { prints: true, search: true, sets: true } },
    'a platform is one switch and its own three places, all shown');
  assertEqual(d.platforms.mtgo.areas, { prints: true, search: true, sets: true },
    'and the same shape for every platform rather than one of them being special');
  assertEqual(Object.keys(F.AREAS), ['prints', 'search', 'sets'],
    'the three places a platform can apply to');

  // And nothing else. This shape has three rules in it and two of them are gone; the whole
  // point of the reduction is that a reader cannot reach a third one.
  assert(!('paper' in d), 'there is no Paper group: Paper is a platform, like the other two');
  assert(!('areas' in d), 'and no shared list of places — each platform has its own');
  for (const gone of ['ancillary', 'nonEnglish', 'noEnglishSets', 'setsEnabled', 'foreignOnly']) {
    assert(!JSON.stringify(d).includes(gone), `the defaults have no "${gone}" anywhere in them`);
  }
  assertEqual(Object.keys(d.platforms.paper).sort(), ['areas', 'show'],
    'and a platform holds exactly a switch and its places');
  assertEqual(d.prices, { usd: true, tix: true, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    'every price kind stays and is shown: three currencies and three shops, and the shops are ' +
    'the ones that used to be negative');
  assertEqual(Object.keys(d.prices).filter(kind =>
    !['usd', 'tix', 'eur', 'tcg', 'cardhoarder', 'cardmarket'].includes(kind)), [],
  'and there is no price kind beyond those six, so the settings page cannot draw a box the ' +
    'model has nowhere to store');
  // Three more switches, all positive: the deck tokens, the Caster marker and the whole "Buy
  // This Card" block. The Caster one used to be the last negative key in the model — `caster`
  // meant *hide*, while its label on the settings page now says "show" — so it is `showCaster`
  // here, and the rename is what lets the migration tell the two senses apart.
  assertEqual([d.tokens, d.showCaster, d.showStores], [true, true, true],
    'and so do the three outside the group');
  assert(!('caster' in d), 'and the key that used to mean the opposite is gone');
  assertEqual(Object.keys(d).sort(),
    ['platforms', 'prices', 'showCaster', 'showStores', 'tokens'],
    'and the whole shape is these five things, which is a change worth stating rather than ' +
    'leaving a reader to find');

  // Every switch in the model is positive. A single field with the opposite sense is the
  // whole reason this file exists, and it cannot be seen by reading the defaults — so it is
  // seen by walking them and naming anything whose meaning is not "show".
  const positives = [];
  const walk = (value, trail) => {
    if (typeof value === 'boolean') positives.push(trail);
    else if (F.isPlainObject(value)) {
      for (const [key, inner] of Object.entries(value)) walk(inner, `${trail}.${key}`);
    }
  };
  walk(d, 'filters');
  const negative = positives.filter(trail => /hide/i.test(trail));
  assertEqual(negative, [], 'no stored boolean is named as a hide: ' + negative.join(', '));
  // Twelve platform switches, six price ones and three outside both. The count is asserted
  // because a thirteenth would be a rule somebody added without deciding what it means here.
  assertEqual(positives.length, 12 + 6 + 3,
    `the model has ${positives.length} switches and all of them are positive`);
}

function perPlatformTest() {
  console.log('set-filters: the places belong to the platform, not to the group');
  const F = load();

  // The case the shape exists for. A reader who wants Arena out of the search dropdown and
  // Arena left in the card page's table: one platform, two answers, and the model can say so.
  const split = F.normalise({
    platforms: {
      arena: { show: true, areas: { prints: true, search: false, sets: false } }
    }
  });
  const on = area => F.PLATFORM_NAMES.filter(name =>
    split.platforms[name].show === true && split.platforms[name].areas[area] === true);
  assertEqual(on('prints'), ['paper', 'arena', 'mtgo'], 'the prints table still has Arena');
  assertEqual(on('search'), ['paper', 'mtgo'], 'the search dropdown has lost it');
  assertEqual(on('sets'), ['paper', 'mtgo'], 'and so has the sets index');
  assert(split.platforms.arena.show === true,
    'while the platform switch itself is untouched — the reader did not turn Arena off, they ' +
    'answered two questions about places');

  // And the other direction: a platform off everywhere stays off everywhere, with nothing to
  // bring back. The three places of a switched-off platform are still stored, which is what
  // "turning a platform off keeps its settings" has to mean when there is no other gate.
  const off = F.normalise({ platforms: { mtgo: { show: false } } });
  assertEqual(F.PLATFORM_NAMES.filter(n => off.platforms[n].show === true),
    ['paper', 'arena'], 'the platform is off');
  assertEqual(off.platforms.mtgo.areas, { prints: true, search: true, sets: true },
    'and its three places are exactly as they were, because nothing rewrote them');

  // Every one of the nine independently. A switch that moved two of them at once would be a
  // reader's choice silently doubled, and "which one" is the only question this group asks.
  for (const platform of F.PLATFORM_NAMES) {
    for (const area of F.AREA_NAMES) {
      const one = F.normalise({ platforms: { [platform]: { areas: { [area]: false } } } });
      const on = name => one.platforms[name].show === true && one.platforms[name].areas[area] === true;
      assertEqual(on(platform), false, `${platform} is out of ${area} alone`);
      assertEqual(F.PLATFORM_NAMES.filter(name => on(name)),
        F.PLATFORM_NAMES.filter(name => name !== platform),
        `and the other two platforms are still in ${area}`);
    }
  }

  // A platform off on every place is a legal, empty state, and the model can hold it.
  const nowhere = F.normalise({
    platforms: {
      arena: { show: true, areas: { prints: false, search: false, sets: false } },
      mtgo: { show: false, areas: { prints: false, search: false, sets: false } }
    }
  });
  assertEqual(F.PLATFORM_NAMES.filter(n => nowhere.platforms[n].show && nowhere.platforms[n].areas.prints),
    ['paper'], 'one platform left on the table is one platform');
  assertEqual(Object.keys(nowhere.platforms.mtgo.areas).length, 3,
    'and the platform nobody kept still has its three places stored, for when it comes back');
}

function malformedTest() {
  console.log('set-filters: a malformed object is completed, not replaced');
  const F = load();
  const half = F.normalise({
    platforms: { arena: { show: false }, mtgo: { areas: { sets: false } } }
  });
  assertEqual(half.platforms.arena.show, false, 'a platform switch that is there is kept');
  assertEqual(half.platforms.arena.areas, { prints: true, search: true, sets: true },
    'and its three places are filled in rather than left absent');
  assertEqual(half.platforms.mtgo.areas, { prints: true, search: true, sets: false },
    'a place that is there is kept and its neighbours keep their defaults');
  assertEqual(half.platforms.paper.areas, { prints: true, search: true, sets: true },
    'and a platform left out entirely keeps the defaults');
  assertEqual(F.normalise({ platforms: { arena: { areas: { sets: 'no' } } } })
    .platforms.arena.areas.sets, true,
    'a value that is not a boolean does not switch anything off');
  assertEqual(F.normalise({ platforms: { arena: 'yes' } }).platforms.arena.show, true,
    'a platform stored as something this build cannot read is shown, not hidden');

  // A platform stored as a bare boolean is the shape two builds wrote. It is read rather than
  // dropped, because dropping it would silently hand a reader every platform back.
  const bare = F.normalise({ platforms: { paper: false, arena: true, mtgo: false } });
  assertEqual([bare.platforms.paper.show, bare.platforms.arena.show, bare.platforms.mtgo.show],
    [false, true, false], 'a bare boolean is read as the platform switch');
  assertEqual(bare.platforms.paper.areas, { prints: true, search: true, sets: true },
    'and its three places are the defaults, because a bare boolean named no place');

  assertEqual(F.normalise('not an object'), F.defaults(),
    'something that is not an object at all is the defaults');
  assertEqual(F.normalise(undefined).platforms.paper.show, true, 'and so is nothing at all');
}

function removedFieldsTest() {
  console.log('set-filters: the removed settings are still in storage and are not read');
  const F = load();
  // A reader on 1.4 or 1.5 has every one of these in their stored object. Each must be
  // inert: a setting the interface no longer offers has to stop affecting the result rather
  // than keep working through a field nobody removed, which is the difference between a
  // removal and a hiding.
  const stored = {
    platforms: { paper: true, arena: true, mtgo: true },
    areas: { prints: true, search: true, sets: true },
    paper: {
      nonTournament: false,
      oversized: false,
      noEnglishSets: false,
      foreignBlackBorder: { '4bb': false, fbb: false, bchr: false },
      nonEnglish: 'none'
    },
    prices: {}, tokens: true, caster: false
  };
  const out = F.upgrade(stored);
  assertEqual(Object.keys(out.platforms.paper).sort(), ['areas', 'show'],
    'nothing from the old shape survives into a platform');
  assert(!('paper' in out), 'and the group holding five of the removed rules is gone too');
  assertEqual(out.platforms.paper.show, true, 'the platforms pass through');
  assertEqual(out.platforms.paper.areas, { prints: true, search: true, sets: true },
    'and the one shared list of places became all three platforms, unchanged');
  // The five removed rules had nothing to migrate into. They are read nowhere, so a reader
  // who had every one of them on gets every set back — which is the only answer available,
  // because "hide this set" is not a thing this shape can say.
  assertEqual(F.normalise(stored).platforms.paper.show, true,
    'the removed rules are not read by normalise, which is what runs on every later page load');
  // Asked of the field itself rather than of the object above: a removed rule read once more
  // would have nowhere to write — a platform has a switch and three places — so the only place
  // it could go wrong quietly is into a place. That is what this asks.
  assertEqual(F.normalise({ platforms: { arena: { ancillary: false, nonEnglish: 'none' } } })
    .platforms.arena.areas, { prints: true, search: true, sets: true },
    'and a removed rule cannot reach a place either, which is the only thing left it could do');
  assertEqual(F.upgrade({ paper: { nonTournament: false, oversized: false, noEnglishSets: false } })
    .platforms.paper.areas, { prints: true, search: true, sets: true },
    'nor by the migration, which is the one path that runs exactly once');
}

function flatMigrationTest() {
  console.log('set-filters: migration from the flat switches of 1.0 and earlier');
  const F = load();

  const untouched = F.read({});
  assertEqual(untouched.filters, F.defaults(), 'nothing set means the defaults');
  assertEqual(untouched.migrated, true, 'and it counts as a first run, so it gets written back');

  assertEqual(F.read({ hideDigitalSets: true }).filters.platforms.mtgo.show, false,
    'hideDigitalSets turns Magic Online off');
  assertEqual(F.read({ hideDigitalSets: true }).filters.platforms.arena.show, false,
    'and Arena too, since that was what it meant');
  assertEqual(F.read({ hideDigitalSets: true }).filters.platforms.paper.show, true,
    'while Paper is left alone');

  assertEqual(F.PLATFORM_NAMES.filter(n => F.read({ setPlatforms: ['paper'] }).filters.platforms[n].show),
    ['paper'], 'a paper-only whitelist keeps Paper');
  assertEqual(F.PLATFORM_NAMES.filter(n =>
    F.read({ setPlatforms: ['paper', 'arena'] }).filters.platforms[n].show),
  ['paper', 'arena'], 'and keeps each platform separately');
  assertEqual(F.PLATFORM_NAMES.filter(n =>
    F.read({ setPlatforms: ['nonsense'] }).filters.platforms[n].show),
  F.PLATFORM_NAMES, 'a whitelist naming nothing recognisable falls back to showing everything, not nothing');

  // Every place keeps its default through this migration: the flat shape had no places, so
  // there is no reader's choice to carry and nothing to invent.
  assertEqual(F.read({ hideDigitalSets: true }).filters.platforms.arena.areas,
    { prints: true, search: true, sets: true },
    'the places are the defaults, because the old shape named none');

  // The one price switch that existed before 1.1.2 said "only Cardmarket", which is the four
  // other kinds off. In the positive shape that is four false, and the migration is the only
  // place the inversion happens — a reader who had it on sees the same page either way.
  //
  // Cardmarket is the one price it must leave alone, and this is the assertion that says so: the
  // euro column *is* Cardmarket's price, and a migration that walked the model's price keys
  // instead of naming the four would hide the very shop the switch is named after. That is a real
  // defect this test was written for, not a hypothetical one.
  assertEqual(F.read({ onlyCardmarket: true }).filters.prices,
    { usd: false, tix: false, eur: true, tcg: false, cardhoarder: false, cardmarket: true },
    'onlyCardmarket becomes the four other price kinds off together, and leaves the euro column');
  assertEqual(F.read({}).filters.prices, { usd: true, tix: true, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    'and with nothing set they are all on, so a first run hides nothing');
  // The euro switch was briefly `eur` meaning the column and nothing else, in a build that was
  // never released; it is `eur` again and means the column again, so there is nothing to migrate.
  // The shop beside it is `cardmarket`, and the two are separate keys: one hides a link and one
  // hides a column.
  assertEqual(F.read({
    setFilters: { platforms: { paper: { show: true, areas: { prints: true, search: true, sets: true } } },
      prices: { eur: false, cardmarket: true } },
    setFiltersMigrated: true
  }).filters.prices, { usd: true, tix: true, eur: false, tcg: true, cardhoarder: true, cardmarket: true },
  'the euro column and the Cardmarket link are two switches and neither reads the other');
  // The Caster marker, whose old switch read "hide" and whose label now reads "show". This is
  // the inversion the requirement is about: a reader who had the marker hidden keeps it hidden,
  // and a reader who had it visible keeps it visible. Reading it the other way round flips the
  // marker for every reader on the first page load after an update.
  assertEqual(F.read({ hideCasterIndicator: true }).filters.showCaster, false,
    'hideCasterIndicator becomes the marker off, because the switch now says show');
  assertEqual(F.read({ hideCasterIndicator: false }).filters.showCaster, true,
    'and its false becomes the marker on');
  assertEqual(F.read({}).filters.showCaster, true,
    'with nothing stored the marker is shown, which is what a reader who never touched it had');
  assertEqual(F.read({ deckTokens: false }).filters.tokens, false,
    'deckTokens was a positive switch, so only its false carries over');

  // The five removed rules have no target. Not read, not moved, not turned into anything: the
  // new shape has one kind of switch and it says which platform, and a set is on one.
  for (const key of ['hideNonTournamentSets', 'hideOversizedSets', 'hideForeignOnlySets',
    'hideForeignBlackBorder', 'hideNonEnglishPrints']) {
    const before = F.defaults();
    const after = F.read({ [key]: true }).filters;
    assertEqual(after.platforms, before.platforms, `${key} reaches no platform at all`);
  }

  const shut = F.read({ hideOversizedSets: true, setFilters: { setsEnabled: false } });
  assertEqual(shut.filters, F.defaults(), 'a closed master puts everything back to showing');
}

function upgradeTest() {
  console.log('set-filters: migration from the three earlier nested shapes');
  const F = load();

  // 1.4.x and 1.5.0: positive platform booleans, a shared list of places, and five rules
  // under `paper` that have nowhere to go.
  const from15 = {
    platforms: { paper: true, arena: false, mtgo: true },
    areas: { prints: false, search: true, sets: true },
    paper: {
      ancillary: false,
      nonEnglish: 'analogue',
      nonTournament: true, oversized: true, noEnglishSets: false,
      foreignBlackBorder: { '4bb': false, fbb: false, bchr: false }
    },
    prices: { usd: false, tix: true, tcg: false, cardhoarder: false },
    caster: true,
    tokens: false,
    caster: true
  };
  const up = F.upgrade(from15);
  assertEqual(F.PLATFORM_NAMES.filter(n => up.platforms[n].show), ['paper', 'mtgo'],
    'the platform switches pass through, one of them off');
  assertEqual(up.platforms.arena.areas, { prints: false, search: true, sets: true },
    'the one shared list became every platform, unchanged — the reader made one answer, not three');
  assertEqual(up.platforms.paper.areas, { prints: false, search: true, sets: true },
    'including Paper, so the same single choice reaches all three');
  assert(up.platforms.arena.areas.prints === false && up.platforms.arena.show === false,
    'and a platform that is off keeps the places it had, so it comes back as it was');
  // The prices are inverted, because the two earlier nested shapes stored them the other way
  // round. The fixture below stores tix off and the rest on; after the migration it is tix
  // shown and the rest off, which is the same page. Read the wrong way round and a reader who
  // had every price on gets every price hidden on their first page load.
  assertEqual(up.prices, { usd: true, tix: false, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    'the price switches outside the group, each inverted from how that shape stored it — and the ' +
    'euro column and Cardmarket arrive at the default, because no shape that old had keys for them');
  // `caster: true` in that shape meant *hide*, so it becomes the marker off. The prices are
  // inverted too, which is the other inversion this model has done, and both are in the same
  // branch because that is the shape that stored both the old way round.
  assertEqual([up.tokens, up.showCaster], [false, false],
    'and the two others, with the Caster marker inverted from hide to show');

  // The three platforms must not share one object. If they did, the settings page writing
  // one of them would change the other two, and nothing in the page could tell.
  assert(up.platforms.paper.areas !== up.platforms.arena.areas,
    'the three areas objects are separate, or one switch would move all three platforms');
  assert(up.platforms.paper.areas !== up.platforms.mtgo.areas, 'and the third is separate too');

  // 1.1.4 to 1.3.0: negative switches under `sets`, and a master beside them.
  const from11 = {
    setsEnabled: true,
    platforms: { paper: true, arena: true, mtgo: true },
    prices: {}, tokens: true, caster: false,
    areas: { prints: true, search: false, sets: true },
    sets: {
      nonTournament: true, oversized: false, foreignOnly: true,
      foreignBlackBorder: { surfaces: 'sets-prints', which: ['4bb', 'fbb', 'bchr'] },
      nonEnglish: { surfaces: 'prints', which: ['portal', 'secret-lair', 'other'] }
    }
  };
  const old = F.upgrade(from11);
  assertEqual(F.PLATFORM_NAMES.filter(n => old.platforms[n].show), F.PLATFORM_NAMES,
    'the platforms were already positive and pass through');
  assertEqual(old.platforms.paper.areas, { prints: true, search: false, sets: true },
    'and the shared list becomes three, the search place still off');
  assert(!('paper' in old), 'nothing from the old group survives');

  const shutOld = F.upgrade({
    setsEnabled: false,
    areas: { prints: false, search: false, sets: false },
    sets: { nonTournament: true, nonEnglish: { surfaces: 'sets-prints' } }
  });
  assertEqual(shutOld, F.defaults(),
    'a closed master puts everything back to showing, in the old shape too — including the ' +
    'places, which is the one a reader would otherwise keep a stale answer to');

  // A value in neither shape is completed rather than read as the oldest one. Reading it as
  // the old shape would reset a master nobody had.
  const neither = F.upgrade({ platforms: { arena: { show: false } } });
  assertEqual(neither.platforms.arena.show, false,
    'a value in neither shape keeps the one thing it says');
  assertEqual(neither.platforms.paper.show, true, 'and defaults the rest');
  assertEqual(neither.platforms.paper.areas, { prints: true, search: true, sets: true },
    'with all three places at their defaults, because it named none');

  // `read` picks the right path and does it once.
  const once = F.read({ hideDigitalSets: true });
  assertEqual(once.migrated, true, 'a first run is one to be migrated');
  assertEqual(once.filters.platforms.mtgo.show, false, 'and the old switch becomes the platform');
  const twice = F.read({ setFilters: once.filters, setFiltersMigrated: true });
  assertEqual(twice.migrated, false, 'a migrated reader is recognised as one');
  assertEqual(twice.filters.platforms.mtgo.show, false, 'and keeps what they had chosen');
  assertEqual(F.read({ hideDigitalSets: false, setFilters: once.filters, setFiltersMigrated: true })
    .filters.platforms.mtgo.show, false,
    'a stale flat switch does not undo a choice the reader already migrated');
  assertEqual(F.read({ setFilters: from15, setFiltersMigrated: true }).filters.platforms.arena.show,
    false, 'a reader whose stored value is the previous shape is translated, not reset');

  // The current shape is read back unchanged, prices included. This is the expensive direction
  // to get wrong: a reader who had every price on would find every price hidden on their first
  // page load after an update, and the four switches on the settings page — which read the
  // stored value — would all be unticked while every price was still on the page.
  const current = F.read({
    setFiltersMigrated: true,
    setFilters: {
      platforms: { paper: { show: true, areas: { prints: true, search: true, sets: false } } },
      prices: { usd: true, tix: false, eur: false, tcg: true, cardhoarder: true, cardmarket: false }
    }
  });
  assertEqual(current.filters.prices, { usd: true, tix: false, eur: false, tcg: true, cardhoarder: true, cardmarket: false },
    'a value already in the current shape keeps its prices exactly as stored, the hidden euro ' +
    'column included');
  assertEqual(current.filters.platforms.paper.areas.sets, false,
    'and keeps its places, which the branch that spreads a shared list would have overwritten');
  assertEqual(F.upgrade({ prices: { usd: false } }).prices.usd, true,
    'while the older shapes are still inverted: a stored "hide USD" becomes "USD not shown"');

  // A value this build wrote itself: everything it stores, and nothing changed. Said as an
  // equality of the whole object rather than field by field, because a field-by-field reading
  // only covers the fields somebody thought of — and a `normalise` that looked for the old
  // `caster` would pass every field it checks and still hand the reader the default marker.
  const own = {
    platforms: {
      paper: { show: true, areas: { prints: true, search: false, sets: true } },
      arena: { show: false, areas: { prints: false, search: true, sets: false } },
      mtgo: { show: true, areas: { prints: true, search: true, sets: true } }
    },
    prices: { usd: false, tix: true, eur: false, tcg: false, cardhoarder: true, cardmarket: false },
    tokens: false,
    showCaster: false,
    showStores: false
  };
  assertEqual(F.upgrade(own), own, 'the current shape is read back exactly as it was stored');
  assertEqual(F.read({ setFilters: own, setFiltersMigrated: true }).filters.showCaster, false,
    'including the marker, which is the one value that has changed sense in this file\'s life');

  // 1.6.0 to 1.6.2 is the awkward one: the current layout — per-platform places, positive
  // prices — with the Caster key still named `caster` and still meaning *hide*. It is
  // indistinguishable from the current shape except by that key, which is why the key was
  // renamed rather than a version number added: a stored version can be missing or wrong, and
  // then a reader's settings are read as the wrong shape. A key either is there or is not.
  const from162 = {
    platforms: { paper: { show: true, areas: { prints: true, search: false, sets: true } } },
    prices: { usd: true, tix: false, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    caster: true
  };
  const out162 = F.upgrade(from162);
  assertEqual(out162.showCaster, false,
    'a stored "hide the marker" from 1.6.x stays hidden, so relabelling it changes nothing');
  assertEqual(out162.prices, from162.prices,
    'and its prices are left alone, because that shape already stored them positively');
  assertEqual(out162.platforms.paper.areas, { prints: true, search: false, sets: true },
    'as are its places');
  assert(!('caster' in out162), 'with the old key gone rather than left beside the new one');
  assertEqual(F.upgrade({ ...from162, caster: false }).showCaster, true,
    'and the other direction: a reader who had the marker visible keeps it visible');
  assertEqual(F.upgrade({ ...from162, caster: undefined }).showCaster, true,
    'while a value that never stored the key arrives at the default, which is shown');
}

function platformTest() {
  console.log('set-filters: the platform of a printing, not of its set');
  const F = load();
  const all = ['paper', 'arena', 'mtgo'];
  // Measured 2026-10-04 on Scryfall: every printing carries `games`, and a paper printing
  // carries "paper" in it. VMA's 171 printings are `["mtgo"]` and four are
  // `["mtgo","arena"]`, which is the case a set-level answer gets wrong.
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['paper'] }, all), true,
    'everything shown keeps everything');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['paper', 'mtgo', 'arena'] }, ['paper', 'mtgo']),
    true, 'a printing that is on paper as well as Arena survives Arena being off');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['mtgo'] }, ['arena']), false,
    'a Magic Online printing is gone when only Arena is kept');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['mtgo', 'arena'] }, ['arena']), true,
    'while the four that are also on Arena stay, because they are');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['paper'] }, ['arena', 'mtgo']), false,
    'and a paper printing is gone when Paper is off, which is what turning Paper off means');

  // A printing that cannot be placed is shown. Hiding on an inability to place is the one
  // failure this filter has never been allowed to make.
  assertEqual(F.printingOnPlatform({ lang: 'en' }, ['paper']), true,
    'a printing with no games at all is shown');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: [] }, ['paper']), true,
    'and so is one with an empty list');
  assertEqual(F.printingOnPlatform(null, ['paper']), true, 'and so is nothing at all');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: ['paper'] }, []), false,
    'while a printing that says where it is, against nothing kept, is hidden');
}

defaultsTest();
perPlatformTest();
malformedTest();
removedFieldsTest();
flatMigrationTest();
upgradeTest();
platformTest();
summary('test-set-filters');