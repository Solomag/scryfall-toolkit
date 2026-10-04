// The hiding settings and their migration, on their own.
//
// Migration is the part that can take something away from a reader who never asked: it
// reads settings written by older builds and has to arrive at the same behaviour. So
// every one of these asserts the behaviour after migrating, not just the shape, and the
// two rules that moved are named as the two rules that moved.
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

function setFiltersTest() {
  console.log('set-filters: the shape, and what the old settings meant');
  const F = load();
  assert(F, 'the module publishes the shape');

  const d = F.defaults();
  assertEqual(Object.keys(d.platforms), ['paper', 'arena', 'mtgo'],
    'the three platforms, and Paper is one of them alongside the digital ones');
  assertEqual(d.setsEnabled, true, 'the gate over the group is on by default');

  // A fresh install hides nothing. The two rules with a surface carry it in one field —
  // off, prints, or sets-prints — and they default to off. A default of 'sets-prints' here
  // was the first version and it hid Foreign Black Border and Portal for everybody who had
  // never touched a setting.
  assertEqual(d.sets.foreignBlackBorder.surfaces, 'off', 'Foreign Black Border sets stay by default');
  assertEqual(d.sets.nonEnglish.surfaces, 'off', 'and so do the non-English ones');
  assertEqual(d.sets.nonTournament, false, 'non-tournament sets stay by default');
  assertEqual(d.sets.oversized, false, 'oversized printings stay by default');
  assertEqual(d.prices, { usd: false, tix: false, tcg: false, cardhoarder: false },
    'all four price kinds stay by default');
  assertEqual(F.effective(d).nonEnglish, 'off', 'and nothing is in force to begin with');
  assertEqual(F.effective(d).foreignBlackBorder, 'off', 'in either of the two');

  console.log('set-filters: migration');
  // Everything off, which is what a reader who has touched nothing has.
  const untouched = F.read({});
  assertEqual(untouched.filters, d, 'nothing set means the defaults');
  assertEqual(untouched.migrated, true, 'and it counts as a first run, so it gets written back');

  // The five flat switches, one at a time.
  assertEqual(F.read({ hideNonTournamentSets: true }).filters.sets.nonTournament, true,
    'hideNonTournamentSets becomes the non-tournament switch');
  assertEqual(F.read({ hideOversizedSets: true }).filters.sets.oversized, true,
    'hideOversizedSets becomes the oversized switch');
  assertEqual(F.read({ hideForeignBlackBorder: true }).filters.sets.foreignBlackBorder.surfaces, 'sets-prints',
    'hideForeignBlackBorder becomes the Foreign Black Border rule, on both surfaces');
  assertEqual(F.read({ hideCasterIndicator: true }).filters.caster, true,
    'hideCasterIndicator becomes the caster marker');
  assertEqual(F.read({ deckTokens: false }).filters.tokens, false,
    'deckTokens was a positive switch, so only its false carries over');
  assertEqual(F.read({ deckTokens: true }).filters.tokens, true,
    'and an explicit true stays on');

  // The one that moved. It only ever applied to the Prints table, and it maps to
  // 'sets-prints' rather than to 'prints' — the rule can now reach the Sets index too, and
  // a reader who had it on had asked for the non-English printings to go, not for a
  // narrower version of that. Mapping it to 'prints' would be the migration deciding on
  // the reader's behalf that they had meant less than they said.
  assertEqual(F.read({ hideNonEnglishPrints: true }).filters.sets.nonEnglish.surfaces, 'sets-prints',
    'hideNonEnglishPrints becomes the non-English rule on both surfaces');
  // An explicit false has to come through as off, not as the default, or a reader who
  // deliberately left something visible would find it hidden.
  assertEqual(F.read({ hideNonEnglishPrints: false }).filters.sets.nonEnglish.surfaces, 'off',
    'an explicit false is off, not the default');
  assertEqual(F.read({ hideForeignBlackBorder: false }).filters.sets.foreignBlackBorder.surfaces, 'off',
    'for either of the two');

  // A build that shipped the boolean `on` maps to the surface it reached, which was both.
  assertEqual(F.normalise({ sets: { nonEnglish: { on: true } } }).sets.nonEnglish.surfaces, 'sets-prints',
    'the old boolean maps to the surface it actually reached');
  assertEqual(F.normalise({ sets: { nonEnglish: { on: false } } }).sets.nonEnglish.surfaces, 'off',
    'and its false maps to off');

  // The mode is back, and it is one field naming a surface rather than a boolean with extra
// steps. These are the three questions each surface asks, and they are separate functions
// because answering one with another is the whole of the earlier bug: `reachesSets` used
// to be "is this on", which is true for 'prints' as well, and the sets index then acted on
// a mode addressed to the prints table.
assertEqual(F.SURFACES, { off: 'off', prints: 'prints', 'sets-prints': 'sets-prints' },
  'the three surfaces are off, the prints table alone, and both');
assertEqual([F.reachesSets('off'), F.reachesPrints('off')], [false, false], 'off reaches neither');
assertEqual([F.reachesSets('prints'), F.reachesPrints('prints')], [false, true],
  '"prints" reaches the prints table and not the sets index');
assertEqual([F.reachesSets('sets-prints'), F.reachesPrints('sets-prints')], [true, true],
  '"sets-prints" reaches both');
assertEqual([F.anySurface('off'), F.anySurface('prints'), F.anySurface('sets-prints')], [false, true, true],
  'and "is anything on" is still answerable, which is what a request for the index needs');
// The whole shape, for the two rules that carry it. One value, one meaning, no pair of
// fields that can disagree.
for (const key of ['foreignBlackBorder', 'nonEnglish']) {
  assertEqual(Object.keys(F.defaults().sets[key]).sort(), ['surfaces', 'which'],
    `${key} carries a surface and a list, and nothing else`);
}
assertEqual(F.normalise({ sets: { nonEnglish: { surfaces: 'nowhere' } } }).sets.nonEnglish.surfaces, 'off',
  'a surface this build does not have falls back to off rather than being stored');

  // onlyCardmarket was one switch that turned all four price kinds off at once.
  const cardmarket = F.read({ onlyCardmarket: true }).filters.prices;
  assertEqual(cardmarket, { usd: true, tix: true, tcg: true, cardhoarder: true },
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

  // A migrated reader must not be migrated twice.
  const once = F.read({ hideOversizedSets: true });
  const twice = F.read({ setFilters: once.filters, setFiltersMigrated: true });
  assertEqual(twice.migrated, false, 'a migrated reader is recognised as one');
  assertEqual(twice.filters.sets.oversized, true, 'and keeps what they had chosen');
  // The flat switches must not still be consulted after that: they are stale now.
  const afterMigration = F.read({ hideOversizedSets: false, setFilters: once.filters, setFiltersMigrated: true });
  assertEqual(afterMigration.filters.sets.oversized, true,
    'a stale flat switch does not undo the choice the reader already migrated');

  console.log('set-filters: the gate');
  const chosen = F.read({ hideNonTournamentSets: true }).filters;
  assertEqual(F.effective(chosen).nonTournament, true, 'with the gate on, the rules apply');
  assertEqual(F.effective(F.withoutSets(chosen)).nonTournament, false,
    'with the gate off, nothing is hidden');
  assertEqual(F.effective(F.withoutSets(chosen)).platforms,
    { paper: true, arena: true, mtgo: true },
    'and the platforms come back too, since a platform switched off is a platform being hidden');
  assertEqual(F.effective(F.withoutSets(chosen)).nonEnglish, 'off',
    'including the rules that carry a surface, the easiest thing to leave on behind a gate');
  // The gate turns a surface off rather than deleting it, so opening the gate brings the
  // reader's own choice back rather than a default — and not 'off', which would silently
  // drop a rule they had set up and not yet switched on.
  const gated = F.read({ hideNonEnglishPrints: true }).filters;
  assertEqual(F.effective(F.withoutSets(gated)).nonEnglish, 'off', 'the gate shuts the rule');
  assertEqual(F.effective(F.withSets(F.withoutSets(gated))).nonEnglish, 'sets-prints',
    'and opening it brings back the surface the reader chose');
  // Turning the gate off must not lose the reader's choices.
  assertEqual(F.withoutSets(chosen).sets.nonTournament, true,
    'the sub-switches keep their values behind a closed gate');
  assertEqual(F.withSets(F.withoutSets(chosen)).sets.nonTournament, true,
    'and opening the gate brings the same choices back, not the defaults');

  console.log('set-filters: the foreign-only switch, which has no surface of its own');
  const withForeignOnly = F.normalise({ sets: { foreignOnly: true } });
  assertEqual(withForeignOnly.sets.foreignOnly, true, 'it is read and kept');
  assertEqual(F.defaults().sets.foreignOnly, false, 'and it is off by default, like the other two');
  assertEqual(F.effective(withForeignOnly).foreignOnly, true,
    'effective() carries it, so a surface can ask the gate-respecting question');
  assertEqual(F.effective(F.withoutSets(withForeignOnly)).foreignOnly, false,
    'and the gate shuts it like everything else under it');
  assertEqual(F.withoutSets(withForeignOnly).sets.foreignOnly, true,
    'while the choice itself survives a closed gate');
  // A plain boolean and nothing else. It is a property of a set, so there is no surface to
  // choose and no sub-list to narrow: a set with no English printing has nothing to show on
  // either surface, and the 34 sets it covers are foreign releases and Japanese-only products
  // with nothing in common to narrow by. If this ever grows a `which`, that is a different
  // rule and the two mode rules already are one.
  assertEqual(Object.keys(F.effective(withForeignOnly)).includes('foreignOnly'), true,
    'it is one of the answers effective() gives');
  assertEqual(F.effective(withForeignOnly).foreignOnly === 'sets-prints', false,
    'and it is a boolean rather than a surface string, which is what the two mode rules use');
  assertEqual(F.normalise({ sets: { foreignOnly: 'yes' } }).sets.foreignOnly, false,
    'a value that is not a boolean does not switch it on');
  assertEqual(F.normalise({ sets: { foreignOnly: true } }).sets.oversized, false,
    'and it does not disturb the switches beside it');

  console.log('set-filters: a malformed object is completed, not replaced');
  const half = F.normalise({ platforms: { arena: false }, sets: { foreignBlackBorder: { which: ['fbb'] } } });
  assertEqual(half.platforms, { paper: true, arena: false, mtgo: true },
    'a platform left out keeps its default rather than becoming false');
  assertEqual(half.sets.foreignBlackBorder.which, ['fbb'], 'a subset of the category is kept');
  assertEqual(half.sets.foreignBlackBorder.surfaces, 'off', 'and a surface left out keeps its default');
  assertEqual(F.normalise({ sets: { nonEnglish: { surfaces: 'yes' } } }).sets.nonEnglish.surfaces, 'off',
    'something that is not one of the three surfaces is not accepted as a surface');
  assertEqual(F.normalise({ sets: { nonEnglish: { surfaces: 'prints' } } }).sets.nonEnglish.which,
    Object.keys(F.NON_ENGLISH), 'an unusable list of categories falls back to all of them');
  assertEqual(F.normalise({ sets: { nonEnglish: { on: true, which: [] } } }).sets.nonEnglish.which,
    Object.keys(F.NON_ENGLISH),
    'and so does a missing one - an empty list from a build that never wrote it means nothing, not "hide none"');
  assertEqual(F.normalise('not an object').sets.nonTournament, false,
    'something that is not an object at all is the defaults');
}

setFiltersTest();
summary('test-set-filters');
