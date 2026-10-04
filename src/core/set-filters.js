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

// What the hiding settings are, what they used to be called, and how to read the old
// ones.
//
// It is one file because three places need to agree on the shape and none of them can
// check the others: the settings page draws it, the card page reads it, and the worker
// fetches the sets it hides. That is the third time this project has had two copies of
// one rule that had already drifted, so the shape lives here with the migration beside
// it.
//
// The shape:
//
//   platforms  { paper, arena, mtgo }        which platforms' sets are shown at all
//   sets       nonTournament, oversized      plain switches
//              foreignOnly                   plain switch, and a measured list behind it
//              foreignBlackBorder            { surfaces, which }
//              nonEnglish                    { surfaces, which }
//   prices     { usd, tix, tcg, cardhoarder }
//   tokens     show the tokens a deck makes
//   caster     hide the Caster ON marker
//
// `which` is the subset of a category the rule applies to: which of 4BB, FBB and BCHR,
// which of Portal, Secret Lair and the rest.
//
// `surfaces` is where the rule applies, and there are two surfaces: the Sets index and
// the Prints table. Three values — 'off', 'prints', 'sets-prints' — because the two
// rules that carry it genuinely differ between them, and a reader who hides Portal
// wants it gone from the prints table and gone from the list of sets alike, while one
// who hides 4BB may want the sets listed and only the printings gone.
//
// Everything lives under one key rather than as a dozen flat booleans, because the
// grouping is the point: these are the same decision taken at different depths, and a
// flat list is how "hide oversized" ended up meaning something unrelated to
// "hide non-tournament".
(function () {
  'use strict';

  // The mode is back, and this time both surfaces act on it.
  //
  // 1.1.0 shipped `on` as a mode with three values. The shape was right and the
  // migration mapped the old switches onto it, and neither surface acted on the
  // difference: two of the three places that read it asked a boolean alias that
  // collapses both values into one, and the third never asked at all. With "Prints
  // only" chosen, `needsSetIndex` in sets.js and `needsCategories` in prints.js both
  // read the alias, the alias was false, the set index was never fetched, and the rule
  // did nothing at all anywhere. So 1.1.1 took it out of the shape rather than leaving
  // it in as a promise.
  //
  // What changed since is that the two surfaces are written, and they are different:
  // sets.js hides rows in a list keyed by set code, prints.js drops entries out of the
  // API's answer keyed by set *and* by the printing's language. That second one cannot
  // be reached at all from a set code, which is why "Prints only" was never one click
  // away for the non-English rule: hiding a set from the index is a different act from
  // hiding a non-English printing, and only one of them can be done through a code.
  //
  // So the rule is not a boolean with extra steps. It is one field naming a surface, and
  // each surface asks whether it is the one being addressed. That is the shape that
  // failed before — a boolean the reader could not see the difference between — and the
  // difference this time is that both readers of it are the code below and both are
  // checked. If a surface ever stops asking, the value stops having any meaning, and
  // the tests below are what say so.

  const SURFACES = {
    off: 'off',
    prints: 'prints',
    'sets-prints': 'sets-prints'
  };
  const SURFACE_NAMES = Object.keys(SURFACES);

  // The categories a rule with a category under it is broken into. The keys are storage
  // keys and the labels are what the settings page shows; nothing else is read out of
  // these tables, and they used to carry more: a `code` and a `setName` for each entry,
  // neither of which anything has ever read.
  //
  // Both were wrong. Read from https://api.scryfall.com/sets on 2026-10-03, the sets
  // Scryfall names Foreign Black Border are:
  //
  //   4bb    Fourth Edition Foreign Black Border
  //   fbb    Foreign Black Border
  //   bchr   Chronicles Foreign Black Border
  //
  // `fbb` was labelled "Future Sight (FBB)". Future Sight is `fut`, an ordinary set with
  // no border edition; `fbb` is a set of its own. And the `setName` patterns were worse
  // than the labels: /fourth edition/i matches the ordinary Fourth Edition, and
  // /chronicles/i matches the ordinary Chronicles, so both would have hidden the
  // versions nobody asked about. `portal` and `secret-lair` were not set codes at all —
  // Portal is `por`, and Secret Lair is a family (sld, slc, slu, slp, pssc and others).
  //
  // So the tables hold the two things that are used, and the codes and patterns are
  // gone rather than corrected. The worker finds these sets by name off the same index,
  // which is where the codes come from now; a table that keeps a copy of them is a copy
  // that can disagree with the API.
  const FOREIGN_BLACK_BORDER = {
    '4bb': { label: 'Fourth Edition Foreign Black Border (4BB)' },
    fbb: { label: 'Foreign Black Border (FBB)' },
    bchr: { label: 'Chronicles Foreign Black Border (BCHR)' }
  };

  // Portal, Secret Lair, and everything else that prints a language other than English
  // while still being an English-legal printing. Matched by printing on the Prints
  // table, where the printing says which language it is, and by name on the Sets index,
  // where only the first two of these can be found at all — the third is every other
  // set that prints a second language, which no set name states.
  const NON_ENGLISH = {
    portal: { label: 'Portal, Portal Second Age и Portal Three Kingdoms' },
    'secret-lair': { label: 'Secret Lair' },
    // Not a set: the rest of them, recognised by the language on the printing. There is
    // no name to match, so the name matching in the worker finds nothing for this one
    // and the rule reaches it only on the Prints table.
    other: { label: 'Другие языки' }
  };

  // Every storage key the migration has to be able to see.
  //
  // It is a list rather than a read of the whole of storage, and it is here rather
  // than in the file that needs it, because there are now two files that need it: the
  // card page, which migrates what the reader had chosen, and the settings page, which
  // has to show the same migrated values or it draws one reader's old switches as
  // another reader's defaults.
  //
  // Two copies of this list would be a place for a key to be added to one and missed
  // in the other, and the symptom would not be a failure: the migration would quietly
  // not see a setting it was written for, and the reader's choice would be the
  // default. This project has been bitten by that shape of thing more than once, and
  // the fix each time was to move the list somewhere both callers could reach.
  const LEGACY_KEYS = [
    'hideDigitalSets', 'hideNonTournamentSets', 'hideOversizedSets',
    'hideForeignBlackBorder', 'hideNonEnglishPrints', 'setPlatforms', 'onlyCardmarket',
    'hideCasterIndicator', 'deckTokens', 'setFilters', 'setFiltersMigrated'
  ];

  const PRICE_KINDS = {
    usd: { label: 'USD', selects: ['usd'], links: [] },
    tix: { label: 'TIX', selects: ['tix'], links: [] },
    tcg: { label: 'TCGplayer', selects: [], links: ['tcgplayer'] },
    cardhoarder: { label: 'Cardhoarder', selects: [], links: ['cardhoarder'] }
  };

  const defaults = () => ({
    // The gate over the whole group. On by default: every rule in it is off, so the
    // default is to hide nothing, and this only matters once something is switched on.
    setsEnabled: true,
    platforms: { paper: true, arena: true, mtgo: true },
    sets: {
      nonTournament: false,
      oversized: false,
      // A plain switch, like the two above it and unlike the two below, because it is a
      // property of a set and not a decision about a surface: a set with no English printing
      // has nothing to show on either the index or a prints table. It has no sub-list either
      // — the 34 sets it covers are foreign releases and Japanese-only products with nothing
      // in common to narrow by, and a list of one category is a list of no information.
      foreignOnly: false,
      foreignBlackBorder: { surfaces: SURFACES.off, which: Object.keys(FOREIGN_BLACK_BORDER) },
      nonEnglish: { surfaces: SURFACES.off, which: Object.keys(NON_ENGLISH) }
    },
    prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
    tokens: true,
    caster: false
  });

  const isPlainObject = value =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const knownList = (list, table) =>
    Array.isArray(list) ? list.filter(name => Object.prototype.hasOwnProperty.call(table, name)) : null;

  // Fill in anything missing without touching anything that is there, so a partial
  // object written by an older build is completed rather than replaced.
  function normalise(input) {
    const base = defaults();
    if (!isPlainObject(input)) return base;
    const out = base;
    for (const platform of Object.keys(out.platforms)) {
      if (typeof input.platforms?.[platform] === 'boolean') out.platforms[platform] = input.platforms[platform];
    }
    if (typeof input.sets?.nonTournament === 'boolean') out.sets.nonTournament = input.sets.nonTournament;
    if (typeof input.sets?.oversized === 'boolean') out.sets.oversized = input.sets.oversized;
    if (typeof input.sets?.foreignOnly === 'boolean') out.sets.foreignOnly = input.sets.foreignOnly;
    for (const [key, table] of [['foreignBlackBorder', FOREIGN_BLACK_BORDER], ['nonEnglish', NON_ENGLISH]]) {
      const given = input.sets?.[key];
      if (SURFACE_NAMES.includes(given?.surfaces)) out.sets[key].surfaces = given.surfaces;
      // An `on` from a build that shipped the boolean, mapped to the surface that
      // boolean actually reached. Both of them reached both surfaces, so both of them
      // become 'sets-prints' rather than one of them becoming 'prints': choosing the
      // narrower one would quietly stop hiding what the reader had been hiding.
      if (typeof given?.on === 'boolean') {
        out.sets[key].surfaces = given.on ? SURFACES['sets-prints'] : SURFACES.off;
      }
      const which = knownList(given?.which, table);
      // An empty list means "nothing in this category is hidden", which is a real
      // choice, so it is kept. An unusable one falls back to all of them.
      if (which && which.length) out.sets[key].which = which;
    }
    for (const price of Object.keys(out.prices)) {
      if (typeof input.prices?.[price] === 'boolean') out.prices[price] = input.prices[price];
    }
    if (typeof input.tokens === 'boolean') out.tokens = input.tokens;
    if (typeof input.caster === 'boolean') out.caster = input.caster;
    if (typeof input.setsEnabled === 'boolean') out.setsEnabled = input.setsEnabled;
    return out;
  }

  // What the flat booleans meant, translated once.
  //
  // `hideNonEnglishPrints` only ever applied to the Prints table, and its migration
  // said so at the time. It maps to 'sets-prints' rather than to 'prints' for one
  // reason: the rule has since been able to reach the Sets index as well, through the
  // set code, and a reader who had this on had asked for the non-English printings to
  // go — not for a narrower version of that. Choosing 'prints' here would be the
  // migration deciding, on the reader's behalf, that they had meant less than they
  // said.
  //
  // `onlyCardmarket` was one switch that turned all four price kinds off at once, so all
  // four come on together.
  //
  // `setPlatforms` was a whitelist of visible platforms and `hideDigitalSets` hid the
  // digital ones, which are opposites; both land in the same place, and the whitelist
  // wins when both are present because it is the more specific of the two.
  function migrate(stored) {
    const out = defaults();
    if (!isPlainObject(stored)) return out;

    if (Array.isArray(stored.setPlatforms)) {
      // Only a list naming at least one platform we know is used. A list of nothing
      // recognisable is not a choice to show no sets - that would blank the sets index
      // and the prints table outright - it is a value this build cannot read, and the
      // safe reading of that is the default. The settings page already does the same
      // with an empty selection.
      const known = stored.setPlatforms.filter(name => Object.prototype.hasOwnProperty.call(out.platforms, name));
      if (known.length) {
        for (const platform of Object.keys(out.platforms)) out.platforms[platform] = known.includes(platform);
      }
    }
    if (stored.hideDigitalSets === true) {
      out.platforms.arena = false;
      out.platforms.mtgo = false;
    }

    if (stored.hideNonTournamentSets === true) out.sets.nonTournament = true;
    if (stored.hideOversizedSets === true) out.sets.oversized = true;
    // Both of these reached both surfaces before there was a choice, so both migrate to
    // 'sets-prints': what the reader had was both, and 'sets-prints' is what both is
    // now called. Mapping them to 'prints' would be the migration quietly narrowing
    // somebody's settings on upgrade.
    if (stored.hideForeignBlackBorder === true) out.sets.foreignBlackBorder.surfaces = SURFACES['sets-prints'];
    if (stored.hideNonEnglishPrints === true) out.sets.nonEnglish.surfaces = SURFACES['sets-prints'];

    if (stored.onlyCardmarket === true) {
      for (const price of Object.keys(out.prices)) out.prices[price] = true;
    }

    if (stored.hideCasterIndicator === true) out.caster = true;
    // The old switch was "show the tokens a deck makes", and it defaulted on, so it is a
    // positive: only an explicit false carries over.
    if (stored.deckTokens === false) out.tokens = false;

    return out;
  }

  // Read the setting, migrating it the first time it is seen. The flag is stored so the
  // migration happens once rather than on every page load, and so that a build which
  // later changes the shape has something to compare against.
  function read(stored) {
    const migrated = stored.setFiltersMigrated === true ? normalise(stored.setFilters) : migrate(stored);
    return {
      filters: migrated,
      // Whether this is a first run, which the caller uses to decide about writing it
      // back rather than guessing by comparing objects.
      migrated: stored.setFiltersMigrated !== true
    };
  }

  // The master switch is a gate, not a setter.
  //
  // It was going to be "hide everything", which is a different thing and a worse one: a
  // switch that writes four other switches has to be kept in step with them, and when it
  // is not, the master says one thing and the page does another. A gate stores one flag
  // and turning it off leaves every sub-switch exactly where the reader put it, which is
  // the whole point of wanting it: 99% of the time the junk is hidden, and the one time
  // in a while it is not, one click brings it all back without redoing the tidying.
  //
  // It sits above the platform switches too, because a platform switched off is a
  // platform being hidden, and a reader who hits the master expects everything it governs
  // to come back at once.
  const copy = filters => JSON.parse(JSON.stringify(normalise(filters)));
  function withoutSets(filters) { const next = copy(filters); next.setsEnabled = false; return next; }
  function withSets(filters) { const next = copy(filters); next.setsEnabled = true; return next; }

  // What is actually being hidden, once the gate has been applied. Everything that acts on
  // a set or a printing asks this rather than reading the switches itself, so the gate
  // cannot be forgotten in one place and honoured in another.
  function effective(filters) {
    const normalised = normalise(filters);
    if (normalised.setsEnabled === false) {
      return {
        platforms: { paper: true, arena: true, mtgo: true },
        nonTournament: false, oversized: false, foreignOnly: false,
        foreignBlackBorder: SURFACES.off, nonEnglish: SURFACES.off
      };
    }
    return {
      platforms: normalised.platforms,
      nonTournament: normalised.sets.nonTournament,
      oversized: normalised.sets.oversized,
      foreignOnly: normalised.sets.foreignOnly,
      // The surfaces, as surfaces. Not a boolean derived from them: a surface that asked
      // whether the rule is "on" would be unable to tell 'prints' from 'sets-prints',
      // which is precisely what went wrong in 1.1.0 and why this went out of the shape.
      foreignBlackBorder: normalised.sets.foreignBlackBorder.surfaces,
      nonEnglish: normalised.sets.nonEnglish.surfaces
    };
  }

  // What a surface asks about a mode. Two separate questions, asked separately, because
  // answering one of them with the other is the whole of the earlier bug.
  //
  // A surface is either addressed by this mode or it is not. 'sets-prints' addresses
  // both; 'prints' addresses the Prints table and not the Sets index; 'off' addresses
  // neither. Asking `mode !== 'off'` answers "is any of this on", which is what
  // needsSetIndex wanted, and it is not what either surface wants.
  const reachesSets = mode => mode === SURFACES['sets-prints'];
  const reachesPrints = mode => mode === SURFACES.prints || mode === SURFACES['sets-prints'];
  const anySurface = mode => mode !== SURFACES.off;

  window.STK_SET_FILTERS = {
    FOREIGN_BLACK_BORDER, NON_ENGLISH, PRICE_KINDS, LEGACY_KEYS, SURFACES, SURFACE_NAMES,
    reachesSets, reachesPrints, anySurface,
    defaults, normalise, migrate, read, effective, withoutSets, withSets, isPlainObject
  };
})();
