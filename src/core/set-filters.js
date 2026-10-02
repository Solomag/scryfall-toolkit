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
//              foreignBlackBorder            { on, which }
//              nonEnglish                    { on, which }
//   prices     { usd, tix, tcg, cardhoarder }
//   tokens     show the tokens a deck makes
//   caster     hide the Caster ON marker
//
// `which` is the subset of a category the rule applies to: which of 4BB, FBB and BCHR,
// which of Portal, Secret Lair and the rest. A rule with a category has a switch plus a
// list underneath it; one without does not. The switch is the whole rule either way.
//
// Everything lives under one key rather than as a dozen flat booleans, because the
// grouping is the point: these are the same decision taken at different depths, and a
// flat list is how "hide oversized" ended up meaning something unrelated to
// "hide non-tournament".
(function () {
  'use strict';

  // There is no mode here, and there was one. 'prints' and 'sets-prints' were meant to
  // mean "the prints table only" and "both surfaces", the shapes were written, the
  // migration mapped the old switches onto them — and neither surface acted on the
  // difference. Two of the places that read them were asking a boolean alias that
  // collapses both values to one, and the third never asked at all.
  //
  // A switch that reads the same whichever way it is set is worse than no switch,
  // because a reader who sets it cannot tell whether they got what they asked for. So
  // the distinction came out of the shape entirely rather than being left in it as a
  // promise. What stays is the grouping, which does work: which platforms, which sets
  // are junk, which price kinds.
  //
  // When the two surfaces are done, this is the field to widen, and widening it will be
  // a small change precisely because everything else already lives in one place.

  const FOREIGN_BLACK_BORDER = {
    // Read off the sets themselves, by code: 4BB is Fourth Edition, FBB is Future Sight,
    // BCHR is the Chronicles set that came with it.
    '4bb': { code: '4bb', label: 'Fourth Edition (4BB)', setName: /fourth edition/i },
    fbb: { code: 'fbb', label: 'Future Sight (FBB)', setName: /future sight/i },
    bchr: { code: 'bchr', label: 'Chronicles (BCHR)', setName: /chronicles/i }
  };

  // Portal, Secret Lair, and everything else that prints a language other than English
  // while still being an English-legal printing. These are matched by set, not by the
  // printing's language, because the rule is about which sets, and a Secret Lair drop
  // has English printings in it that stay.
  const NON_ENGLISH = {
    portal: { code: 'portal', label: 'Portal и Portal II', setName: /portal/i },
    'secret-lair': { code: 'secret-lair', label: 'Secret Lair', setName: /secret lair/i },
    other: { code: 'other', label: 'Другие языки', languages: true }
  };

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
      foreignBlackBorder: { on: false, which: Object.keys(FOREIGN_BLACK_BORDER) },
      nonEnglish: { on: false, which: Object.keys(NON_ENGLISH) }
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
    for (const [key, table] of [['foreignBlackBorder', FOREIGN_BLACK_BORDER], ['nonEnglish', NON_ENGLISH]]) {
      const given = input.sets?.[key];
      if (typeof given?.on === 'boolean') out.sets[key].on = given.on;
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
  // `hideNonEnglishPrints` only ever applied to the Prints table. It maps to a plain
  // switch, so it keeps reaching exactly what it reached before: the rule is the whole
  // rule, and a shape that could promise "Prints only" and quietly not keep that
  // promise was worse than one that says nothing about surfaces at all.
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
    if (stored.hideForeignBlackBorder === true) out.sets.foreignBlackBorder.on = true;
    if (stored.hideNonEnglishPrints === true) out.sets.nonEnglish.on = true;

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
        nonTournament: false, oversized: false,
        foreignBlackBorder: false, nonEnglish: false
      };
    }
    return {
      platforms: normalised.platforms,
      nonTournament: normalised.sets.nonTournament,
      oversized: normalised.sets.oversized,
      foreignBlackBorder: normalised.sets.foreignBlackBorder.on,
      nonEnglish: normalised.sets.nonEnglish.on
    };
  }

  window.STK_SET_FILTERS = {
    FOREIGN_BLACK_BORDER, NON_ENGLISH, PRICE_KINDS,
    defaults, normalise, migrate, read, effective, withoutSets, withSets, isPlainObject
  };
})();
