/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence
 * and are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */

// What is shown, where, and what each of those answers means.
//
// One file because four places have to agree on the shape and none of them can check the
// others: the settings page draws it, the card page reads it on both surfaces, and the worker
// fetches the sets it needs. The shape has been rewritten here twice after two copies of one
// rule drifted apart, so it lives in one place with its migration beside it.
//
// The whole shape is one sentence: **on means show.** Every switch below is positive, in the
// stored value, in the interface and in what `effective()` hands the pages. The earlier shape
// was negative — "hide non-tournament", "hide oversized", and a `surfaces` mode reading
// 'off'/'prints'/'sets-prints' where 'off' meant "not hiding" — and a positive word meaning
// "not hiding" reads as the opposite of itself at every call site. Three of the places that
// read it had to know which sense a field was in.
//
//   platforms  { paper, arena, mtgo }     which platforms' things are shown
//   areas      { prints, search, sets }   which surfaces any rule applies to
//   paper      nonTournament             show non-tournament printings
//              oversized                 show oversized printings
//              noEnglishSets             show sets with no English printing
//              foreignBlackBorder        { '4bb', fbb, bchr }  show each family
//              nonEnglish                'all' | 'analogue' | 'none'
//
// `areas` is one list for every rule, deliberately. Per-surface checkboxes for every rule is
// the tree this shape exists to avoid: three rules times three surfaces is nine switches, and
// a reader who ticks one of them has answered a question about a rule rather than about a
// place. "Where should filtering apply" is one question with one answer.
//
// `nonEnglish` is a mode rather than a switch because the middle option is not the opposite
// of either end. 'all' and 'none' are opposites; 'analogue' is neither — it shows a
// non-English printing only where the same card has no English Paper printing of the same
// artwork in the same treatment. That is a judgement about a pair of printings, and a switch
// cannot say it.
(function () {
  'use strict';

  // The three places a filter can apply, and what they are called in Scryfall's own terms.
  // `search` is the set field on the advanced search page, which is the only one of the three
  // that is a form control rather than a list.
  const AREAS = {
    prints: { label: 'Таблица изданий' },
    search: { label: 'Поиск' },
    sets: { label: 'Список сетов' }
  };
  const AREA_NAMES = Object.keys(AREAS);

  // The three places a printing can exist, as Scryfall's own `games` field names them.
  // `paper` is in there and printings carry it, so "is this printing on an allowed platform"
  // is a question about the printing rather than about the set it sits in.
  const PLATFORMS = {
    paper: { label: 'Paper' },
    arena: { label: 'Arena' },
    mtgo: { label: 'Magic Online' }
  };
  const PLATFORM_NAMES = Object.keys(PLATFORMS);

  // The three positions of the non-English rule, in the order they appear in the interface.
  const NON_ENGLISH_MODES = {
    all: {
      label: 'Все',
      hint: 'Язык не влияет: иностранные издания показываются всегда.'
    },
    analogue: {
      label: 'Только без английского аналога',
      hint: 'Иноязычное издание показывается, только если у той же карты нет бумажного ' +
        'английского издания с тем же артом и тем же оформлением.'
    },
    none: {
      label: 'Никакие',
      hint: 'Все неанглийские издания скрываются.'
    }
  };

  // Foreign Black Border, as the three sets Scryfall names that way. Split per family because
  // unticking one has to mean something, and a flat list behind one switch cannot untick one.
  //
  // The worker finds these sets by name off its own index of /sets, so the table holds no
  // codes: a code kept here is a code that can disagree with the API.
  const FOREIGN_BLACK_BORDER = {
    '4bb': { label: 'Fourth Edition Foreign Black Border (4BB)' },
    fbb: { label: 'Foreign Black Border (FBB)' },
    bchr: { label: 'Chronicles Foreign Black Border (BCHR)' }
  };

  // Every storage key the migration has to be able to see, in one list, because two files need
  // it: the card page migrates what the reader chose and the settings page has to show the
  // migrated values or it draws one reader's old switches as another's defaults.
  const LEGACY_KEYS = [
    'hideDigitalSets', 'hideNonTournamentSets', 'hideOversizedSets',
    'hideForeignBlackBorder', 'hideNonEnglishPrints', 'setPlatforms', 'onlyCardmarket',
    'hideCasterIndicator', 'deckTokens', 'setFilters', 'setFiltersMigrated',
    'hideForeignOnlySets'
  ];

  const PRICE_KINDS = {
    usd: { label: 'USD', selects: ['usd'], links: [] },
    tix: { label: 'TIX', selects: ['tix'], links: [] },
    tcg: { label: 'TCGplayer', selects: [], links: ['tcgplayer'] },
    cardhoarder: { label: 'Cardhoarder', selects: [], links: ['cardhoarder'] }
  };

  const defaults = () => ({
    // Positive throughout, and all on: a reader who has never opened this section sees
    // everything Scryfall shows, which is what "no filtering" has to mean to a default.
    platforms: { paper: true, arena: true, mtgo: true },
    areas: { prints: true, search: true, sets: true },
    paper: {
      nonTournament: true,
      oversized: true,
      noEnglishSets: true,
      foreignBlackBorder: { '4bb': true, fbb: true, bchr: true },
      nonEnglish: 'all'
    },
    prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
    tokens: true,
    caster: false
  });

  const isPlainObject = value =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  const knownList = (list, table) =>
    Array.isArray(list) ? list.filter(name => Object.prototype.hasOwnProperty.call(table, name)) : null;

  // Fill in anything missing without touching what is there, so a partial object written by
  // an older build is completed rather than replaced.
  //
  // A key that arrives with the wrong shape is completed too rather than dropped: a reader who
  // had stored something this build cannot read gets the default, which is "show", so the
  // worst case of not understanding their setting is that nothing is hidden.
  function normalise(input) {
    const out = defaults();
    if (!isPlainObject(input)) return out;

    for (const platform of PLATFORM_NAMES) {
      if (typeof input.platforms?.[platform] === 'boolean') out.platforms[platform] = input.platforms[platform];
    }
    for (const area of AREA_NAMES) {
      if (typeof input.areas?.[area] === 'boolean') out.areas[area] = input.areas[area];
    }

    const paper = input.paper;
    if (isPlainObject(paper)) {
      for (const key of ['nonTournament', 'oversized', 'noEnglishSets']) {
        if (typeof paper[key] === 'boolean') out.paper[key] = paper[key];
      }
      if (typeof paper.nonEnglish === 'string' &&
          Object.prototype.hasOwnProperty.call(NON_ENGLISH_MODES, paper.nonEnglish)) {
        out.paper.nonEnglish = paper.nonEnglish;
      }
      for (const key of Object.keys(FOREIGN_BLACK_BORDER)) {
        if (typeof paper.foreignBlackBorder?.[key] === 'boolean') {
          out.paper.foreignBlackBorder[key] = paper.foreignBlackBorder[key];
        }
      }
    }

    for (const price of Object.keys(out.prices)) {
      if (typeof input.prices?.[price] === 'boolean') out.prices[price] = input.prices[price];
    }
    if (typeof input.tokens === 'boolean') out.tokens = input.tokens;
    if (typeof input.caster === 'boolean') out.caster = input.caster;
    return out;
  }

  // The flat booleans of 1.1.x and earlier, translated once.
  //
  // Two of the mappings need saying out loud, because they are judgement and not arithmetic.
  //
  // `setsEnabled` was a master gate over the whole group: off meant "no rule applies", which
  // in the positive shape is every switch at its default. So a reader arriving with it off
  // gets the defaults, which shows everything — the same thing they had, arrived at by
  // inverting five switches instead of by keeping a gate that no longer has a meaning to keep.
  //
  // The two `surfaces` rules become positions rather than switches. Foreign Black Border was
  // per-category "hide these", so a family that was hidden becomes shown and the rest keep
  // what they had. Non-English was one switch hiding every non-English printing, and the
  // closest position in the new three is 'none' — the new middle option did not exist to be
  // migrated into, and pretending otherwise would show a reader rows they had asked to lose.
  function migrate(stored) {
    const out = defaults();
    if (!isPlainObject(stored)) return out;

    if (Array.isArray(stored.setPlatforms)) {
      // Only a list naming at least one platform we know. A list of nothing recognisable is
      // not a choice to show nothing — that would blank three surfaces outright — it is a
      // value this build cannot read, and the safe reading of that is the default.
      const known = stored.setPlatforms
        .filter(name => PLATFORM_NAMES.includes(name));
      if (known.length) {
        for (const platform of PLATFORM_NAMES) out.platforms[platform] = known.includes(platform);
      }
    }
    if (stored.hideDigitalSets === true) {
      out.platforms.arena = false;
      out.platforms.mtgo = false;
    }

    // Inverted, because the old words were "hide" and these are "show".
    if (stored.hideNonTournamentSets === true) out.paper.nonTournament = false;
    if (stored.hideOversizedSets === true) out.paper.oversized = false;
    if (stored.hideForeignOnlySets === true) out.paper.noEnglishSets = false;

    if (stored.hideForeignBlackBorder === true) {
      // The old switch hid every family; the old `which` narrowed that to a list. Both mean
      // "not shown" for the families they named, so the new switches are inverted per family.
      const old = stored.setFilters?.sets?.foreignBlackBorder;
      const which = Array.isArray(old?.which) ? old.which : Object.keys(FOREIGN_BLACK_BORDER);
      for (const key of Object.keys(FOREIGN_BLACK_BORDER)) {
        out.paper.foreignBlackBorder[key] = !which.includes(key);
      }
    }

    if (stored.hideNonEnglishPrints === true) out.paper.nonEnglish = 'none';

    if (stored.onlyCardmarket === true) {
      for (const price of Object.keys(out.prices)) out.prices[price] = true;
    }

    if (stored.hideCasterIndicator === true) out.caster = true;
    // The old switch was "show the tokens a deck makes" and defaulted on, so it is already a
    // positive: only an explicit false carries over.
    if (stored.deckTokens === false) out.tokens = false;

    // The master gate, if it was off, means everything below it was not applying. Arriving at
    // that by putting every switch at its default rather than by keeping a gate.
    if (stored.setFilters?.setsEnabled === false) {
      for (const key of ['nonTournament', 'oversized', 'noEnglishSets']) out.paper[key] = true;
      for (const key of Object.keys(FOREIGN_BLACK_BORDER)) out.paper.foreignBlackBorder[key] = true;
      out.paper.nonEnglish = 'all';
    }

    return out;
  }

  // Read the setting, migrating the first time it is seen. The flag is stored so the migration
  // happens once rather than on every page load, and so that a build which later changes the
  // shape has something to compare against.
  //
  // `upgrade` sits between them on purpose. A reader who has never seen the positive shape has
  // flat booleans to translate; a reader who has seen the negative shape of 1.1.4–1.3.0 has
  // that shape, which is neither of the other two and whose fields are spelled differently.
  // Calling `normalise` on it would return the defaults, which is "show everything" — the
  // migration's worst case, arrived at silently, for a reader who had chosen to hide a third
  // of their sets.
  function read(stored) {
    return {
      filters: stored.setFiltersMigrated === true
        ? upgrade(stored.setFilters)
        : migrate(stored),
      migrated: stored.setFiltersMigrated !== true
    };
  }

  // One rule: was this surface stored under the old shape? A reader who has never touched the
  // new shape gets every area, which is "filter where it is on" — the one reading of a master
  // that survives the removal of the master, and the one that hides nothing on first run.
  //
  // The old value could name one area or both; there are three now. "Sets and prints" becomes
  // all three, because the old rule reached both places it could and this build has one more
  // place, not one fewer, and dropping the reader's choice in the new place would be the
  // migration narrowing somebody's settings on upgrade.
  function areasFromLegacy(areas) {
    const out = { ...defaults().areas };
    if (typeof areas?.prints === 'boolean') out.prints = areas.prints;
    if (typeof areas?.search === 'boolean') out.search = areas.search;
    if (typeof areas?.sets === 'boolean') out.sets = areas.sets;
    return out;
  }

  // The shape as a stored value from an earlier build of *this* file, which is a different
  // migration from the flat booleans and is kept separate so neither reads the other's keys.
  function upgrade(input) {
    if (!isPlainObject(input)) return defaults();
    // Which shape this is, asked before anything is read out of it. The positive shape has
    // `paper` and no `sets`; the negative one has `sets` and no `paper`. Asking "is `paper`
    // there" alone is not enough, because a value written by a build part-way through a
    // migration can have neither, and treating that as the old shape would invert five
    // switches for a reader who had never touched any of them.
    if (isPlainObject(input.paper)) return normalise(input);
    if (!isPlainObject(input.sets)) return normalise(input);

    const out = normalise({
      platforms: input.platforms,
      areas: areasFromLegacy(input.areas),
      prices: input.prices,
      tokens: input.tokens,
      caster: input.caster
    });
    const sets = isPlainObject(input.sets) ? input.sets : {};
    // Everything the old shape hid by default is now shown by default, so each switch is
    // inverted only where the old shape actually carried a value.
    if (typeof sets.nonTournament === 'boolean') out.paper.nonTournament = !sets.nonTournament;
    if (typeof sets.oversized === 'boolean') out.paper.oversized = !sets.oversized;
    if (typeof sets.foreignOnly === 'boolean') out.paper.noEnglishSets = !sets.foreignOnly;

    // The border rule had two spellings and one meaning: "hide", narrowed by which families.
    // Read as one thing, because reading the two halves separately is how an inactive rule
    // with a populated list under it hid that list anyway — which is what this did until the
    // test that stores exactly that value caught it.
    const border = isPlainObject(sets.foreignBlackBorder) ? sets.foreignBlackBorder : {};
    const borderHides = typeof border.on === 'boolean'
      ? border.on
      : SURFACE_NAMES_OLD.includes(border.surfaces) && border.surfaces !== 'off';
    if (borderHides) {
      const which = knownList(border.which, FOREIGN_BLACK_BORDER);
      // No list under an active rule meant every family.
      const hidden = which || Object.keys(FOREIGN_BLACK_BORDER);
      for (const key of Object.keys(FOREIGN_BLACK_BORDER)) {
        out.paper.foreignBlackBorder[key] = !hidden.includes(key);
      }
    }

    // The old non-English rule was one switch, so it maps onto one position. 'none' is the
    // faithful reading of anything that was hiding: the new middle option did not exist when
    // the reader made that choice, and choosing it for them would show rows they had asked to
    // lose.
    const language = isPlainObject(sets.nonEnglish) ? sets.nonEnglish : {};
    if (typeof language.on === 'boolean') out.paper.nonEnglish = language.on ? 'none' : 'all';
    if (SURFACE_NAMES_OLD.includes(language.surfaces)) {
      out.paper.nonEnglish = language.surfaces === 'off' ? 'all' : 'none';
      if (language.surfaces === 'sets-prints') {
        // Two surfaces named in the old value; the third is added rather than dropped.
        out.areas = areasFromLegacy({ prints: true, sets: true });
      }
    }

    // A master that was off meant none of this was applying.
    if (input.setsEnabled === false) {
      for (const key of ['nonTournament', 'oversized', 'noEnglishSets']) out.paper[key] = true;
      for (const key of Object.keys(FOREIGN_BLACK_BORDER)) out.paper.foreignBlackBorder[key] = true;
      out.paper.nonEnglish = 'all';
    }
    return out;
  }

  // The old surface names, named here rather than imported from a shape that no longer exists,
  // because one migration has to recognise a value written by a build that is not this one.
  const SURFACE_NAMES_OLD = ['off', 'prints', 'sets-prints'];

  // What the pages are handed. One object, already resolved, so no page re-derives whether a
  // switch means hide or show.
  //
  // There is no gate in it and no `effective` collapse: a platform that is off is off, and its
  // own settings are still stored and still come back when it is switched on. That is the
  // whole of what "turning a platform off preserves its settings" requires — there is nothing
  // to preserve if turning it off also rewrites the values under it, and there is a test for
  // it below.
  function effective(filters) {
    return normalise(filters);
  }

  // Whether a printing is on a platform the reader kept.
  //
  // Answered per printing, from the printing's own `games`, and never from its set. A set can
  // be paper and Arena while one of its cards is Arena-only, and a set-level answer would hide
  // the paper printing along with it — which is the requirement that turning off Arena must not
  // lose a printing that is also on an allowed platform.
  //
  // A printing whose `games` is missing is shown. It cannot be placed, and hiding on an
  // inability to place is the failure this has been written to avoid since the platform filter
  // first shipped.
  function printingOnPlatform(printing, chosen) {
    const games = printing?.games;
    if (!Array.isArray(games) || !games.length) return true;
    return games.some(game => chosen.includes(game));
  }

  // ---- the English analogue ------------------------------------------------------
  //
  // What makes two printings of one card the same picture, as one comparable string.
  //
  // The parts are the artwork, the base frame, the frame's effects, the border colour and
  // the full-art treatment — which is what Scryfall publishes, measured 2026-10-04. It is
  // deliberately not a claim to describe every visual difference: two printings can differ in
  // ways none of these fields record. The rule below is built so that being wrong about that
  // costs an extra row rather than a missing one.
  //
  // The artwork arrives as a sorted list of per-face illustration ids, because a multi-faced
  // card carries its illustrations on its faces and not on itself. The rest arrive as
  // strings already, so a field that is missing becomes '' — which means a printing with
  // nothing known can only match another with nothing known, and never a printing that does
  // know.
  function pictureKey(printing) {
    // Sorted here rather than trusted to arrive sorted. The worker does sort both lists, and
    // this sorts again: a key that depends on its input's order is a key whose two callers can
    // disagree about the same printing, and a rule about what looks the same has to have one
    // answer.
    const list = value => (Array.isArray(value) ? [...value].sort().join('+') : '');
    return [
      list(printing?.art),
      printing?.frame || '',
      list(printing?.frameEffects),
      printing?.borderColor || '',
      printing?.fullArt === true ? 'full' : ''
    ].join('|');
  }

  // Whether a printing could serve as the English half of the comparison: an English paper
  // printing the reader can actually see.
  //
  // Three refusals, each for a reason about correctness rather than tidiness.
  //
  //   not English   — the comparison is with an English analogue by definition.
  //   not on paper  — the answer is required to be a paper one, so an Arena-only English
  //                   printing of the same art does not count. `games` missing is a refusal
  //                   too: nothing is known about where it was released, and refusing leaves
  //                   a row visible, which is the right way to be wrong here.
  //   filtered away — an English printing the reader has already hidden is not a picture they
  //                   have, so it must not be allowed to hide anything else.
  //
  // A printing with no artwork recorded is refused as an analogue as well: it cannot be
  // compared, so it cannot be evidence.
  function isAnalogueCandidate(printing, keep) {
    if (!printing || printing.lang !== 'en') return false;
    if (!Array.isArray(printing.games) || !printing.games.includes('paper')) return false;
    if (!Array.isArray(printing.art) || !printing.art.length) return false;
    return keep ? keep(printing) !== false : true;
  }

  // The pictures the reader already has in English on paper, built once from the whole print
  // list rather than as rows are walked.
  //
  // Once, and over everything, because the analogue of a printing is regularly *earlier* in
  // the list than the printing being tested — Scryfall returns printings in its own order, not
  // release order. A rule that could only look forwards would call every reprint unique and
  // hide nothing at all, which is the failure this function exists to make impossible.
  function englishPictures(printings, keep) {
    const pictures = new Set();
    for (const printing of Array.isArray(printings) ? printings : []) {
      if (isAnalogueCandidate(printing, keep)) pictures.add(pictureKey(printing));
    }
    return pictures;
  }

  // Whether one non-English printing is redundant against a set of pictures.
  //
  // Every early return leaves the printing visible, and that is the design rather than a
  // caution: this rule can lose a row, so it has to be certain, and Scryfall's fields are
  // enough to be certain about a match and not enough to be certain about a mismatch. An
  // unknown language, unknown artwork and an empty picture set all mean "keep".
  function redundantAgainst(printing, pictures) {
    if (!printing || !printing.lang || printing.lang === 'en') return false;
    if (!Array.isArray(printing.art) || !printing.art.length) return false;
    if (!pictures || !pictures.size) return false;
    return pictures.has(pictureKey(printing));
  }

  window.STK_SET_FILTERS = {
    AREAS, AREA_NAMES, PLATFORMS, PLATFORM_NAMES, NON_ENGLISH_MODES,
    FOREIGN_BLACK_BORDER, PRICE_KINDS, LEGACY_KEYS,
    defaults, normalise, upgrade, migrate, read, effective, isPlainObject,
    printingOnPlatform, pictureKey, isAnalogueCandidate, englishPictures, redundantAgainst
  };
})();