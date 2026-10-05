// The visibility settings, their migration, and the English-analogue comparison.
//
// Migration is the part that can take something away from a reader who never asked: it
// reads settings written by older builds and has to arrive at the same behaviour. So
// every one of these asserts the behaviour after migrating, not just the shape, and each
// of the two rules that moved is named as a rule that moved.
//
// The shape itself was rewritten twice — the words "hide" became "show", and two surface
// selectors per rule became one shared list of areas — so this file also checks that the
// third spelling cannot be confused with either of the first two. Two migrations that
// disagree about which shape they are looking at is how a reader who hid a third of their
// sets quietly gets all of them back.
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
  assertEqual(Object.keys(d.areas), ['prints', 'search', 'sets'],
    'the three places a filter can apply, one shared list for every rule');
  assertEqual(d.platforms, { paper: true, arena: true, mtgo: true },
    'every platform is shown, which is what a default has to mean');
  assertEqual(d.areas, { prints: true, search: true, sets: true },
    'and every area is in force, because filtering nothing is the same as showing everything');
  assertEqual(d.paper.nonTournament, true, 'non-tournament printings are shown');
  assertEqual(d.paper.oversized, true, 'oversized ones are shown');
  assertEqual(d.paper.noEnglishSets, true, 'and so are sets with no English printing');
  assertEqual(d.paper.foreignBlackBorder, { '4bb': true, fbb: true, bchr: true },
    'all three Foreign Black Border families are shown');
  assertEqual(d.paper.nonEnglish, 'all', 'the language rule starts at All, which hides nothing');
  assertEqual(d.prices, { usd: false, tix: false, tcg: false, cardhoarder: false },
    'all four price kinds stay by default');
  assert(!('setsEnabled' in d), 'there is no master switch, so there is no field for one');
  assert(!('sets' in d), 'and nothing is stored under the old group name');

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
  assertEqual(negative, [],
    'no stored boolean is named as a hide: ' + negative.join(', '));
  // The families are named after Scryfall's own sets, which are called Foreign Black Border,
  // so their name says what they are rather than what to do with them. That distinction is
  // worth a check of its own, because the field holding them sits next to a switch that once
  // meant the opposite of its own name.
  assertEqual(F.paper?.nonEnglish, undefined, 'the model keeps no switch under a name it cannot mean');
  assert(positives.length >= 14, `and the model has ${positives.length} switches, all positive`);

  // The three positions of the language rule, in the order the interface draws them, because
  // the middle one is not the opposite of either end and therefore cannot be reached by
  // flipping a switch.
  assertEqual(Object.keys(F.NON_ENGLISH_MODES), ['all', 'analogue', 'none'],
    'the language rule has three positions, and the middle one is a mode of its own');
  assert(F.NON_ENGLISH_MODES.analogue.label !== F.NON_ENGLISH_MODES.all.label &&
    F.NON_ENGLISH_MODES.analogue.label !== F.NON_ENGLISH_MODES.none.label,
    'which is why it is a named position rather than a boolean');

  // Foreign Black Border is per family, and a family that is not named in storage keeps its
  // default rather than becoming hidden. A fourth family added to the model has to work
  // without a line anywhere else, and this is what says so.
  assertEqual(Object.keys(F.FOREIGN_BLACK_BORDER), ['4bb', 'fbb', 'bchr'],
    'the three families Scryfall names that way');
  assertEqual(F.normalise({ paper: { foreignBlackBorder: { fbb: false } } }).paper.foreignBlackBorder,
    { '4bb': true, fbb: false, bchr: true }, 'one family off leaves the other two on');
}

function malformedTest() {
  console.log('set-filters: a malformed object is completed, not replaced');
  const F = load();
  const half = F.normalise({ platforms: { arena: false }, paper: { oversized: false } });
  assertEqual(half.platforms, { paper: true, arena: false, mtgo: true },
    'a platform left out keeps its default rather than becoming false');
  assertEqual(half.paper.oversized, false, 'and a switch that is there is kept');
  assertEqual(half.paper.nonTournament, true, 'while its neighbour keeps its default');
  assertEqual(F.normalise({ paper: { nonEnglish: 'yes' } }).paper.nonEnglish, 'all',
    'a value that is not one of the three positions is not accepted as one');
  assertEqual(F.normalise({ paper: { nonEnglish: 'none' } }).paper.nonEnglish, 'none',
    'and the position this build does have is taken as it stands');
  assertEqual(F.normalise({ paper: { oversized: 'yes' } }).paper.oversized, true,
    'a switch that is not a boolean does not switch anything off');
  assertEqual(F.normalise('not an object'), F.defaults(),
    'something that is not an object at all is the defaults');
  assertEqual(F.normalise(undefined).paper.nonEnglish, 'all',
    'and so is nothing at all');
}

function migrationTest() {
  console.log('set-filters: migration from the flat switches of 1.0 and earlier');
  const F = load();

  const untouched = F.read({});
  assertEqual(untouched.filters, F.defaults(), 'nothing set means the defaults');
  assertEqual(untouched.migrated, true, 'and it counts as a first run, so it gets written back');

  // The five flat switches, one at a time, and every one of them is inverted: the old words
  // were "hide" and these are "show". Getting this backwards is the single worst thing a
  // migration can do, because it turns a reader's tidying into its opposite.
  assertEqual(F.read({ hideNonTournamentSets: true }).filters.paper.nonTournament, false,
    'hideNonTournamentSets becomes the category switched off');
  assertEqual(F.read({ hideNonTournamentSets: false }).filters.paper.nonTournament, true,
    'and an explicit false becomes the category shown');
  assertEqual(F.read({ hideOversizedSets: true }).filters.paper.oversized, false,
    'hideOversizedSets becomes the category switched off');
  assertEqual(F.read({ hideForeignOnlySets: true }).filters.paper.noEnglishSets, false,
    'the measured foreign-only switch becomes the category switched off');
  assertEqual(F.read({ hideCasterIndicator: true }).filters.caster, true,
    'hideCasterIndicator becomes the caster marker');
  assertEqual(F.read({ deckTokens: false }).filters.tokens, false,
    'deckTokens was a positive switch, so only its false carries over');
  assertEqual(F.read({ deckTokens: true }).filters.tokens, true,
    'and an explicit true stays on');

  // Foreign Black Border became per family, so a single old switch becomes three new ones.
  // The old switch hid every family, so all three are off — and the list under it, when
  // there was one, narrows that.
  assertEqual(F.read({ hideForeignBlackBorder: true }).filters.paper.foreignBlackBorder,
    { '4bb': false, fbb: false, bchr: false },
    'the old single switch becomes all three families off');
  assertEqual(F.read({
    hideForeignBlackBorder: true,
    setFilters: { sets: { foreignBlackBorder: { which: ['fbb'] } } }
  }).filters.paper.foreignBlackBorder, { '4bb': true, fbb: false, bchr: true },
    'a stored list under it narrows that to the families it named');
  assertEqual(F.read({ hideForeignBlackBorder: false }).filters.paper.foreignBlackBorder,
    { '4bb': true, fbb: true, bchr: true }, 'an explicit false leaves every family shown');

  // The language rule became three positions, and a reader who was hiding has to land on the
  // position that hides. Choosing 'analogue' for them would show rows they had asked to lose,
  // and choosing 'all' would be the same thing with more steps.
  assertEqual(F.read({ hideNonEnglishPrints: true }).filters.paper.nonEnglish, 'none',
    'the old switch becomes the position that hides every non-English printing');
  assertEqual(F.read({ hideNonEnglishPrints: false }).filters.paper.nonEnglish, 'all',
    'an explicit false becomes All, not the default by accident');
  assert(F.read({ hideNonEnglishPrints: true }).filters.paper.nonEnglish !== 'analogue',
    'and never the middle position, which did not exist when the choice was made');

  // onlyCardmarket was one switch that turned all four price kinds off at once.
  assertEqual(F.read({ onlyCardmarket: true }).filters.prices,
    { usd: true, tix: true, tcg: true, cardhoarder: true },
    'onlyCardmarket becomes all four price kinds together');

  // The platform whitelist and the digital switch were opposites. Both land in the same
  // place, and the whitelist wins because it is the more specific of the two.
  assertEqual(F.read({ hideDigitalSets: true }).filters.platforms,
    { paper: true, arena: false, mtgo: false }, 'hideDigitalSets turns off Arena and Magic Online');
  assertEqual(F.read({ setPlatforms: ['paper'] }).filters.platforms,
    { paper: true, arena: false, mtgo: false }, 'and a paper-only whitelist says the same');
  assertEqual(F.read({ setPlatforms: ['paper', 'arena'] }).filters.platforms,
    { paper: true, arena: true, mtgo: false }, 'a whitelist keeps each platform separately');
  assertEqual(F.read({ setPlatforms: ['paper'], hideDigitalSets: false }).filters.platforms,
    { paper: true, arena: false, mtgo: false },
    'with both present the whitelist wins, being the more specific of the two');
  assertEqual(F.read({ setPlatforms: ['nonsense'] }).filters.platforms,
    { paper: true, arena: true, mtgo: true },
    'a whitelist with nothing recognisable in it falls back to showing everything, not nothing');
  assertEqual(F.read({ setPlatforms: [] }).filters.platforms,
    { paper: true, arena: true, mtgo: true },
    'and so does an empty one, because three unchecked switches are a newer thing than this');
}

function upgradeTest() {
  console.log('set-filters: migration from the negative shape of 1.1.4 to 1.3.0');
  const F = load();

  // The shape that shipped last: `sets` holding three hides and two rules that carry a
  // surface. Every field in it is inverted, and that has to be recognised as its own shape
  // rather than fed to normalise, which would return the defaults and hand the reader back
  // every set they had hidden.
  const negative = {
    setsEnabled: true,
    platforms: { paper: true, arena: false, mtgo: true },
    prices: { usd: false, tix: true, tcg: false, cardhoarder: false },
    tokens: false,
    caster: true,
    sets: {
      nonTournament: true,
      oversized: false,
      foreignOnly: true,
      foreignBlackBorder: { surfaces: 'sets-prints', which: ['4bb', 'fbb', 'bchr'] },
      nonEnglish: { surfaces: 'prints', which: ['portal', 'secret-lair', 'other'] }
    }
  };
  const up = F.upgrade(negative);
  assertEqual(up.paper.nonTournament, false, 'a stored hide becomes a stored not-show');
  assertEqual(up.paper.oversized, true, 'and a stored not-hide becomes a stored show');
  assertEqual(up.paper.noEnglishSets, false,
    'the measured foreign-only switch, which was stored as a hide');
  assertEqual(up.paper.foreignBlackBorder, { '4bb': false, fbb: false, bchr: false },
    'an active border rule with all three families named switches all three off');
  assertEqual(up.paper.nonEnglish, 'none',
    'the language rule keeps the position that hides, because that is what it was set to');
  assertEqual(up.platforms, { paper: true, arena: false, mtgo: true },
    'the platforms were already positive and pass through unchanged');
  assertEqual(up.tokens, false, 'and so do the switches outside the group');

  // The two halves of the old border rule read as one thing. An inactive rule with a list
  // under it hides nothing, which is what 'off' meant, and reading the list on its own
  // would hide all three families for a reader who had the rule switched off.
  assertEqual(F.upgrade({
    sets: { foreignBlackBorder: { surfaces: 'off', which: ['4bb', 'fbb', 'bchr'] } }
  }).paper.foreignBlackBorder, { '4bb': true, fbb: true, bchr: true },
    "a border rule that was off leaves every family shown, whatever list sits under it");

  // The old rule that only ever applied to the prints table keeps that area rather than
  // gaining the other two: the areas list was new, and adding a surface the reader had
  // chosen would hide a set they had chosen to keep.
  assertEqual(F.upgrade({ sets: { nonEnglish: { surfaces: 'prints' } } }).areas,
    { prints: true, search: true, sets: true },
    'an old rule named one surface and the new list covers all three by default');
  assertEqual(F.upgrade({ sets: { nonEnglish: { surfaces: 'sets-prints' } } }).areas,
    { prints: true, search: true, sets: true },
    'and one that named two gets the third rather than losing either of its own');

  // The old boolean spelling of the language rule, from the build before the surface select.
  assertEqual(F.upgrade({ sets: { nonEnglish: { on: true } } }).paper.nonEnglish, 'none',
    'the old boolean maps to the position that hides');
  assertEqual(F.upgrade({ sets: { nonEnglish: { on: false } } }).paper.nonEnglish, 'all',
    'and its false maps to All');

  // The master, off. It meant no rule below it was applying, which in the positive shape is
  // every switch at its default. Arriving there by putting five switches back is what this
  // does; keeping a gate is what it does not, because a gate has no meaning once every
  // switch says the same thing.
  const shut = F.upgrade({
    setsEnabled: false,
    sets: {
      nonTournament: true,
      foreignOnly: true,
      foreignBlackBorder: { surfaces: 'sets-prints', which: ['4bb'] },
      nonEnglish: { surfaces: 'sets-prints' }
    }
  });
  assertEqual(shut.paper.nonTournament, true, 'a closed master puts every rule back to showing');
  assertEqual(shut.paper.noEnglishSets, true, 'including the measured one');
  assertEqual(shut.paper.foreignBlackBorder, { '4bb': true, fbb: true, bchr: true },
    'and every border family');
  assertEqual(shut.paper.nonEnglish, 'all', 'and the language rule back to All');
  assert(!('setsEnabled' in shut), 'and the master itself is gone from the stored shape');

  // A value already in the positive shape must pass through untouched, which is what stops a
  // reader from being migrated twice and losing a choice they had already made.
  const positive = { platforms: { paper: false, arena: true, mtgo: true },
    areas: { prints: false, search: true, sets: true },
    paper: { oversized: false, nonEnglish: 'analogue', foreignBlackBorder: { '4bb': true, fbb: false, bchr: true } } };
  const kept = F.upgrade(positive);
  assertEqual(kept.platforms, positive.platforms, 'the platforms come through as they stand');
  assertEqual(kept.areas, positive.areas, 'and so do the areas, including one that is off');
  assertEqual(kept.paper,
    { nonTournament: true, oversized: false, noEnglishSets: true,
      foreignBlackBorder: { '4bb': true, fbb: false, bchr: true }, nonEnglish: 'analogue' },
    'and the Paper block is completed rather than replaced: what it left out keeps a default');
  assertEqual(kept.paper.nonEnglish, 'analogue', 'the middle position survives a round trip');
  assertEqual(kept.paper.foreignBlackBorder.fbb, false, 'and so does one family being off');
  // And a value in neither shape is completed rather than inverted: there is nothing in it
  // saying "hide", so treating it as the negative shape would switch five things off.
  const neither = { platforms: { arena: false } };
  assertEqual(F.upgrade(neither).platforms, { paper: true, arena: false, mtgo: true },
    'a value in neither shape keeps the one thing it says and defaults the rest');
  assertEqual(F.upgrade(neither).paper, F.defaults().paper,
    'rather than being read as the negative shape and having every switch turned round');

  // `read` picks the right one of the two, and only does it once.
  const once = F.read({ hideOversizedSets: true });
  assertEqual(once.migrated, true, 'a first run is one to be migrated');
  assertEqual(once.filters.paper.oversized, false, 'and the old switch becomes a new one');
  const twice = F.read({ setFilters: once.filters, setFiltersMigrated: true });
  assertEqual(twice.migrated, false, 'a migrated reader is recognised as one');
  assertEqual(twice.filters.paper.oversized, false, 'and keeps what they had chosen');
  assertEqual(F.read({ hideOversizedSets: false, setFilters: once.filters, setFiltersMigrated: true })
    .filters.paper.oversized, false,
    'a stale flat switch does not undo the choice the reader already migrated');
  // A reader who has the negative shape and the flag is recognised as migrated still gets
  // the negative shape translated, which is the case this rewrite was most likely to lose.
  const fromNegative = F.read({ setFilters: negative, setFiltersMigrated: true });
  assertEqual(fromNegative.filters.paper.nonTournament, false,
    'the flag says do not migrate again, and the shape is still translated');
}

function platformTest() {
  console.log('set-filters: the platform of a printing, not of its set');
  const F = load();
  const all = ['paper', 'arena', 'mtgo'];
  // Measured 2026-10-04 on Scryfall: every printing carries `games`, and a paper printing
  // carries "paper" in it. VMA's 171 printings are `["mtgo"]` and four are
  // `["mtgo","arena"]`, which is the case a set-level answer gets wrong.
  const vmaMtgoOnly = { lang: 'en', games: ['mtgo'] };
  const vmaBoth = { lang: 'en', games: ['mtgo', 'arena'] };
  const paperSetArena = { lang: 'en', games: ['paper', 'mtgo', 'arena'] };
  const paperOnly = { lang: 'en', games: ['paper'] };

  assertEqual(F.printingOnPlatform(paperOnly, all), true, 'everything shown keeps everything');
  // The requirement, stated as a test: turning Arena off must not lose a printing that is
  // still on a platform the reader kept.
  assertEqual(F.printingOnPlatform(paperSetArena, ['paper', 'mtgo']), true,
    'a printing that is on paper as well as Arena survives turning Arena off');
  assertEqual(F.printingOnPlatform(vmaMtgoOnly, ['arena']), false,
    'a Magic Online printing is gone when only Arena is kept');
  assertEqual(F.printingOnPlatform(vmaBoth, ['arena']), true,
    'while the four that are also on Arena stay, because they are');
  assertEqual(F.printingOnPlatform(paperOnly, ['arena', 'mtgo']), false,
    'and a paper printing is gone when Paper is off, which is what turning Paper off means');

  // A printing that cannot be placed is shown. Hiding on an inability to place is the one
  // failure this filter has never been allowed to make.
  assertEqual(F.printingOnPlatform({ lang: 'en' }, ['paper']), true,
    'a printing with no games at all is shown');
  assertEqual(F.printingOnPlatform({ lang: 'en', games: [] }, ['paper']), true,
    'and so is one with an empty list');
  assertEqual(F.printingOnPlatform(null, ['paper']), true, 'and so is nothing at all');
  assertEqual(F.printingOnPlatform(paperOnly, []), false,
    'while a printing that says where it is, against nothing kept, is hidden');

  // No master anywhere: three switches that can all be off is a state the model has to be
  // able to hold, because the page can produce it.
  assertEqual(F.printingOnPlatform(paperOnly, []), false,
    'no platform kept hides every printing that says where it is');
}

function analogueTest() {
  console.log('set-filters: what counts as the same picture');
  const F = load();
  const key = F.pictureKey;

  // One printing, and one field changed at a time, so each part of the key is shown to take
  // part rather than being present in the object and doing nothing.
  const base = { lang: 'en', art: ['art-1'], frame: '2015', frameEffects: [],
    borderColor: 'black', fullArt: false, games: ['paper'] };
  assertEqual(key(base), key({ ...base }), 'a printing is the same picture as itself');
  assert(key(base) !== key({ ...base, art: ['art-2'] }), 'a different artwork is a different picture');
  assert(key(base) !== key({ ...base, frame: '1997' }),
    'a different base frame is a different picture: modern against retro');
  assert(key(base) !== key({ ...base, frameEffects: ['inverted'] }),
    'a different frame effect is a different picture');
  assert(key(base) !== key({ ...base, borderColor: 'borderless' }),
    'a different border colour is a different picture: black against white against borderless');
  assert(key(base) !== key({ ...base, fullArt: true }),
    'a full-art treatment is a different picture from the plain version of the same art');
  assertEqual(key({ ...base, frameEffects: ['inverted', 'etched'] }),
    key({ ...base, frameEffects: ['etched', 'inverted'] }),
    'and the order two effects arrive in does not decide it');
  assert(key({ ...base, frameEffects: ['inverted', 'etched'] }) !== key(base),
    'while a second effect at all does: one frame effect is not two');

  // Multi-faced cards. Measured 2026-10-04: a double-faced card carries its illustrations on
  // its faces and its own `illustration_id` is absent, so the artwork of a card is the sorted
  // list of its faces' illustrations and nothing else.
  const dfc = { lang: 'en', art: ['face-a', 'face-b'], frame: '2015', frameEffects: [],
    borderColor: 'borderless', fullArt: false, games: ['paper'] };
  assertEqual(key(dfc), key({ ...dfc, art: ['face-b', 'face-a'] }),
    'the two faces in either order are the same card');
  assert(key(dfc) !== key({ ...dfc, art: ['face-a'] }),
    "and a card is not the same picture as one of its own faces");
  assert(key(dfc) !== key({ ...dfc, art: ['face-a', 'face-c'] }),
    'a different back face is a different picture');

  // A printing with nothing known about it must not match a printing that does know. Both
  // produce empty parts, so this is the case where a careless join would compare them equal.
  assert(key({ lang: 'en' }) !== key(base),
    'a printing with no recorded treatment matches nothing that has one');
}

function analogueRuleTest() {
  console.log('set-filters: which non-English printings are redundant, and which stay');
  const F = load();
  const en = over => ({ lang: 'en', art: ['art-1'], frame: '2015', frameEffects: [],
    borderColor: 'black', fullArt: false, games: ['paper'], set: 'en1', ...over });
  const ja = over => ({ lang: 'ja', art: ['art-1'], frame: '2015', frameEffects: [],
    borderColor: 'black', fullArt: false, games: ['paper'], set: 'ja1', ...over });

  // The same picture in English on paper.
  const pictures = F.englishPictures([en()]);
  assertEqual(F.redundantAgainst(ja(), pictures), true,
    'an English paper printing with the same art and treatment makes it redundant');

  // The four expected behaviours, each one on a printing that really exists in that shape.
  // The names are Scryfall's, and each was measured rather than assumed.
  const retroEn = en({ frame: '2015' });
  const retroJa = ja({ frame: '1997' });
  assertEqual(F.redundantAgainst(retroJa, F.englishPictures([retroEn])), false,
    "the same art only in a modern frame on the English side, retro on the other: kept");

  const blackEn = en({ borderColor: 'black' });
  const whiteJa = ja({ borderColor: 'white' });
  assertEqual(F.redundantAgainst(whiteJa, F.englishPictures([blackEn])), false,
    'the same art and frame only with a black border on the English side, white on the other: kept');

  const borderlessJa = ja({ borderColor: 'borderless', frame: '2015' });
  assertEqual(F.redundantAgainst(borderlessJa, F.englishPictures([en()])), false,
    'a borderless treatment absent from the English side: kept');

  const noArtAtAll = ja({ art: ['art-2'] });
  assertEqual(F.redundantAgainst(noArtAtAll, F.englishPictures([en()])), false,
    'artwork that does not appear on the English side at all: kept');

  // The English analogue has to be one the reader can see, and has to be paper. These are
  // three separate refusals and each of them would let the rule hide a row against a
  // printing that is not there.
  assertEqual(F.redundantAgainst(ja(), F.englishPictures([en({ games: ['mtgo'] })])), false,
    'an English Magic Online printing is not a Paper analogue');
  assertEqual(F.redundantAgainst(ja(), F.englishPictures([en({ set: 'vintage' })], p => p.set !== 'vintage')), false,
    'an English printing the reader has filtered out is not an analogue');
  assertEqual(F.redundantAgainst(ja(), F.englishPictures([en({ art: [] })])), false,
    'an English printing with no artwork recorded is not evidence of anything');
  assertEqual(F.redundantAgainst(ja(), F.englishPictures([])), false,
    'no English printing at all means nothing to be redundant with');
  assertEqual(F.redundantAgainst(ja({ art: [] }), pictures), false,
    'a printing with no artwork recorded cannot be compared, so it stays');

  // The set name and the collector number are not part of the picture. This is the case the
  // requirement names outright, and it is the reason the key is built from treatment fields
  // and nothing else.
  assertEqual(F.redundantAgainst(ja({ set: 'sld', number: '123' }), F.englishPictures([en({ set: 'znc', number: '999' })])), true,
    'a different set and a different number do not make a printing unique');

  // An English printing is never redundant against itself, whatever the mode says.
  assertEqual(F.redundantAgainst(en(), pictures), false,
    'an English printing is not judged by the language rule');

  // Order independence. Scryfall returns printings in its own order, and the analogue of a
  // printing is regularly the row before it, so this is not a detail: a rule that only
  // looked at printings it had already passed would hide nothing.
  const list = [ja(), en()];
  assertEqual(F.redundantAgainst(list[0], F.englishPictures(list)), true,
    'the analogue may come after the printing being tested');
  assertEqual(F.redundantAgainst(list[0], F.englishPictures([...list].reverse())), true,
    'and the order of the whole list does not matter either');
  assertEqual(F.redundantAgainst(ja({ lang: 'ru' }), F.englishPictures(list)), true,
    'the same picture in Russian is as redundant as the same picture in Japanese');
}

function intersectionTest() {
  console.log('set-filters: a rule on with no area chosen removes nothing');
  const F = load();
  // The two halves of the answer, asked the way the pages ask them: the rule wants to
  // remove something, and the surface is in force. Neither alone removes anything, and the
  // pair is the only thing that can remove anything — which is the whole of the requirement
  // that "where to apply" is one shared answer rather than a tree.
  const ruleWants = f => !f.paper.nonTournament || !f.paper.oversized || !f.paper.noEnglishSets ||
    Object.values(f.paper.foreignBlackBorder).some(show => show !== true);
  const languageWants = f => f.paper.nonEnglish !== 'all';

  const base = F.defaults();
  assertEqual([ruleWants(base), languageWants(base)],
    [false, false], 'with nothing switched off no rule wants to remove anything');

  const offOversized = F.normalise({ paper: { oversized: false } });
  assertEqual([ruleWants(offOversized), languageWants(offOversized)],
    [true, false], 'switching a category off is the rule wanting something, on its own');

  const noAreas = F.normalise({ areas: { prints: false, search: false, sets: false },
    paper: { oversized: false, nonEnglish: 'none' } });
  assertEqual([ruleWants(noAreas), languageWants(noAreas)],
    [true, true], 'and the areas are a separate answer, with a rule on and nowhere to act');
  assertEqual(Object.values(noAreas.areas).some(Boolean), false,
    'every area off is a state the model can hold, because the page can produce it');
  assertEqual(Object.values(noAreas.areas).some(Boolean), false,
    'so a rule that is on with no area chosen is on with nowhere to act');

  // Every combination of "All" and something else, to say the property rather than three
  // examples of it: a rule only acts where an area says so.
  let combinations = 0;
  for (const want of [false, true]) {
    for (const areas of [{ prints: true, search: true, sets: true },
      { prints: false, search: false, sets: false },
      { prints: true, search: false, sets: false }]) {
      const filters = F.normalise({
        paper: { oversized: !want, nonEnglish: want ? 'none' : 'all' },
        areas
      });
      const acts = filters.paper.oversized === false || filters.paper.nonEnglish === 'none';
      assertEqual(acts, want, 'a rule acts wherever an area is in force');
      combinations += 1;
    }
  }
  assertEqual(combinations, 6, 'across the three shapes tried and both answers');

  // And the parts of the old shape are gone from the model, so a feature file asking for one
  // by name fails rather than quietly getting a value of the wrong sense.
  assert(!('SURFACES' in F), 'the surface names are gone: there is one list of areas now');
  assert(!('reachesSets' in F) && !('reachesPrints' in F) && !('anySurface' in F),
    'and with them the three functions each surface asked, which is how 1.1.0 answered the');
  assert(!('withoutSets' in F) && !('withSets' in F),
    'the gate helpers are gone too, because there is no gate to open and shut');
  assert(!('NON_ENGLISH' in F),
    'and the non-English categories, which were set names and the question is about a printing');
  assert(F.LEGACY_KEYS.includes('setFiltersMigrated') && F.LEGACY_KEYS.includes('hideNonEnglishPrints'),
    'while the old storage keys are still named, so a page can clear them on purpose');
}

defaultsTest();
malformedTest();
migrationTest();
upgradeTest();
platformTest();
analogueTest();
analogueRuleTest();
intersectionTest();
summary('test-set-filters');