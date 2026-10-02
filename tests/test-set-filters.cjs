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

  // A fresh install hides nothing. The two rules with a scope carry their scope *inside*
  // the mode - Off, Only Prints, Sets and Prints - so they default to Off. A default of
  // 'sets-prints' here was the first version and it hid Foreign Black Border and Portal
  // for everybody who had never touched a setting.
  assertEqual(d.sets.foreignBlackBorder.mode, 'off', 'Foreign Black Border sets stay by default');
  assertEqual(d.sets.nonEnglish.mode, 'off', 'and so do the non-English ones');
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
  assertEqual(F.read({ hideForeignBlackBorder: true }).filters.sets.foreignBlackBorder.mode, 'sets-prints',
    'hideForeignBlackBorder becomes the Foreign Black Border mode');
  assertEqual(F.read({ hideCasterIndicator: true }).filters.caster, true,
    'hideCasterIndicator becomes the caster marker');
  assertEqual(F.read({ deckTokens: false }).filters.tokens, false,
    'deckTokens was a positive switch, so only its false carries over');
  assertEqual(F.read({ deckTokens: true }).filters.tokens, true,
    'and an explicit true stays on');

  // The one that moved, and it moved because the old rule genuinely only reached Prints.
  // Migrating it to the fuller rule would start hiding Portal sets in the Sets index on
  // the next reload, which nobody asked for.
  assertEqual(F.read({ hideNonEnglishPrints: true }).filters.sets.nonEnglish.mode, 'prints',
    'hideNonEnglishPrints becomes Prints only, because that is all it did');
  assertEqual(F.read({ hideForeignBlackBorder: true }).filters.sets.foreignBlackBorder.mode, 'sets-prints',
    'while Foreign Black Border, which always reached both, becomes both');
  // An explicit false has to come through as off, not as the default for the mode, or a
  // reader who deliberately left something visible would find it hidden.
  assertEqual(F.read({ hideNonEnglishPrints: false }).filters.sets.nonEnglish.mode, 'off',
    'an explicit false is off, not the default');
  assertEqual(F.read({ hideForeignBlackBorder: false }).filters.sets.foreignBlackBorder.mode, 'off',
    'for either of the two');

  // The three values mean what the label says, which is worth checking directly because
  // 'prints' and 'sets-prints' are one string apart.
  assertEqual(F.MODES, ['off', 'prints', 'sets-prints'], 'the three modes, in order');
  for (const given of ['prints', 'sets-prints']) {
    const on = F.normalise({ sets: { nonEnglish: { mode: given } } });
    assertEqual(F.effective(on).nonEnglish, given, `mode ${given} survives normalisation unchanged`);
  }

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
    'including the two modes, which are the rules most easily left on behind a gate');
  // Turning the gate off must not lose the reader's choices.
  assertEqual(F.withoutSets(chosen).sets.nonTournament, true,
    'the sub-switches keep their values behind a closed gate');
  assertEqual(F.withSets(F.withoutSets(chosen)).sets.nonTournament, true,
    'and opening the gate brings the same choices back, not the defaults');

  console.log('set-filters: a malformed object is completed, not replaced');
  const half = F.normalise({ platforms: { arena: false }, sets: { foreignBlackBorder: { which: ['fbb'] } } });
  assertEqual(half.platforms, { paper: true, arena: false, mtgo: true },
    'a platform left out keeps its default rather than becoming false');
  assertEqual(half.sets.foreignBlackBorder.which, ['fbb'], 'a subset of the category is kept');
  assertEqual(half.sets.foreignBlackBorder.mode, 'off', 'and a mode left out keeps its default');
  assertEqual(F.normalise({ sets: { nonEnglish: { mode: 'sideways' } } }).sets.nonEnglish.mode, 'off',
    'a mode that is not one of the three is not accepted');
  assertEqual(F.normalise({ sets: { nonEnglish: { mode: 'off' } } }).sets.nonEnglish.which,
    Object.keys(F.NON_ENGLISH), 'an unusable list of categories falls back to all of them');
  assertEqual(F.normalise({ sets: { nonEnglish: { mode: 'prints', which: [] } } }).sets.nonEnglish.which,
    Object.keys(F.NON_ENGLISH),
    'and so does a missing one - an empty list from a build that never wrote it means nothing, not "hide none"');
  assertEqual(F.normalise('not an object').sets.nonTournament, false,
    'something that is not an object at all is the defaults');
}

setFiltersTest();
summary('test-set-filters');
