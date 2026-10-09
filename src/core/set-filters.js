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

// What is shown, where, and which of those three answers goes with which of the other two.
//
// One file because four places have to agree on the shape and none of them can check the
// others: the settings page draws it, the card page reads it on both surfaces, and the worker
// fetches the sets it needs. The shape has been rewritten here four times, and each rewrite
// was a reader saying the last one was too much, so this is the fourth and the shortest.
//
// The whole shape is one sentence: **on means show.** Every switch is positive, in the stored
// value, in the interface and in what `effective()` hands the pages. The first shape was
// negative — "hide non-tournament", "hide oversized" — and a positive word meaning "not
// hiding" reads as the opposite of itself at every call site.
//
//   platforms  paper   { show, areas: { prints, search, sets } }
//             arena   { show, areas: { prints, search, sets } }
//             mtgo    { show, areas: { prints, search, sets } }
//
// Nine area switches and three platform switches, and that is all there is.
//
// The areas are **per platform** rather than one shared list, and that is the second thing
// this file says. One shared list was the shape for two releases, on the reasoning that
// "where should filtering apply" is one question with one answer — and it is not, because the
// platforms are not interchangeable. A reader who wants Arena sets out of the search dropdown
// and Arena printings left in the card page's table is not choosing a rule, they are choosing
// two answers to two questions, and one list cannot hold them: with it, switching Arena off
// for the dropdown also switched it off for the table, or switching it off for neither.
//
// Everything else is gone, and it is worth saying what it was. There were rules about
// ancillary printings and about non-English printings, and before those rules about oversized
// cards, about sets with no English printing, about Foreign Black Border families and about
// the non-English categories Portal and Secret Lair. Every one of them crossed the others: a
// border family is a set, a Secret Lair is a set, and a set with no English printing is a
// set, so a reader choosing between them was choosing between three descriptions of the same
// kind of thing and then had to work out which one won. The rules that survived longest were
// the ones decided by reading a set's name, and the ones that were checked against the API
// rather than against a copy of themselves turned out to be answerable from a field.
//
(function () {
  'use strict';

  // The three places a platform can be shown. `search` is the set field on the advanced search
  // page, which is the only one of the three that is a form control rather than a list.
  //
  // Each entry carries two words, not one: `label` is the column header over the table, which
  // has to be short enough for a 60px column, and `aria` is the phrase a screen reader hears,
  // which is what the checkbox is. They are not the same sentence — "Издания" as a column and
  // "показывать в таблице изданий" as a checkbox — and a header reused as an accessible name
  // is the usual way a table of switches ends up with twelve boxes all named "Поиск".
  //
  // The words live here and not in the markup, because options.js writes every row of the
  // table from this table and a copy typed into options.html would be a second thing to keep
  // in step.
  const AREAS = {
    prints: { label: 'Издания', aria: 'показывать в таблице изданий' },
    search: { label: 'Поиск', aria: 'показывать в поиске' },
    sets: { label: 'Список сетов', aria: 'показывать в списке сетов' }
  };
  const AREA_NAMES = Object.keys(AREAS);

  // The two columns that are not places: the platform's own name, and the switch that turns
  // the platform on everywhere.
  const PLATFORM_COLUMN = { label: 'Платформа', aria: 'платформа' };
  const SHOW_COLUMN = { label: 'Показывать', aria: 'показывать' };

  // The three places a printing can exist, as Scryfall's own `games` field names them.
  // `paper` is in there and printings carry it, so "is this printing on an allowed platform"
  // is a question about the printing rather than about the set it sits in.
  const PLATFORM_NAMES = ['paper', 'arena', 'mtgo'];
  // Scryfall's own product names, in Scryfall's own spelling. They are brands rather than
  // words, and "Арена" would be a translation of a name nobody calls it that — which is the
  // same reason the column header above is a word this extension chose and this one is not.
  const PLATFORM_LABELS = { paper: 'Paper', arena: 'Arena', mtgo: 'Magic Online' };

  // Every storage key the migration has to be able to see, in one list, because two files need
  // it: the card page migrates what the reader chose and the settings page has to show the
  // migrated values or it draws one reader's old switches as another's defaults.
  const LEGACY_KEYS = [
    'hideDigitalSets', 'hideNonTournamentSets', 'hideOversizedSets',
    'hideForeignBlackBorder', 'hideNonEnglishPrints', 'setPlatforms', 'onlyCardmarket',
    'hideCasterIndicator', 'deckTokens', 'setFilters', 'setFiltersMigrated',
    'hideForeignOnlySets'
  ];

  // The six prices, in two groups rather than six switches. `group` is what puts the three
  // currencies and the euro on one line and the three shops on another, and it lives here rather
  // than in the markup for the reason the area labels do: options.js draws both groups from these
  // two tables, and a line typed into options.html would be a second place to forget a price.
  //
  // The split is not cosmetic. A currency is a column of numbers and a shop is a link, and on the
  // page they are different things that happen to both be prices — which is why one switch for all
  // of them was wrong, and why the grouping says so without a paragraph saying so.
  //
  // EUR is the third currency and the one Scryfall draws from Cardmarket. It is a currency rather
  // than a shop: it is a column of numbers in the same table as USD and TIX. Its box and the EUR
  // source dropdown below it are two views of one question — whether that column exists — and the
  // settings page keeps them in step rather than letting them disagree.
  const PRICE_GROUPS = { prices: 'Цены', links: 'Ссылки на магазины' };
  const PRICE_KINDS = {
    usd: { label: 'USD', group: 'prices' },
    tix: { label: 'TIX', group: 'prices' },
    eur: { label: 'EUR', group: 'prices' },
    tcg: { label: 'TCGplayer', group: 'links' },
    cardhoarder: { label: 'Cardhoarder', group: 'links' },
    cardmarket: { label: 'Cardmarket', group: 'links' }
  };
  const PRICE_GROUP_NAMES = Object.keys(PRICE_GROUPS);

  // All nine areas on, all three platforms shown and all four prices shown. That is what a
  // reader who has never touched this section gets, and it has to mean "nothing is hidden",
  // because the default is what every reader starts in and a default that hides something
  // takes rows away from somebody who never asked.
  const platformDefault = () => ({
    show: true,
    areas: { prints: true, search: true, sets: true }
  });

  const defaults = () => ({
    platforms: {
      paper: platformDefault(),
      arena: platformDefault(),
      mtgo: platformDefault()
    },
    // Positive like everything else here, which this one was not: the four keys it started with
    // used to mean "hide this kind", so they were the only negative booleans left in the shape,
    // read by two files with `some(Boolean)` and `if (prices[option.value])` — a reader's four
    // unticked switches meaning "show everything" is the opposite of what every other switch in
    // the group means, and the page had to say "which prices to hide" above them to make it
    // legible. Cardmarket was added later and has only ever meant "show".
    //
    // Inverted, so the switches say what every other switch in the settings says and the
    // group above them does not need a sentence explaining which way round they run. The
    // inversion is in the migration, not here.
    prices: { usd: true, tix: true, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    tokens: true,
    showCaster: true,
    // The whole "Buy This Card" block on a card page, heading and disclaimer included — the
    // container the three shop links live in. It is not a price kind and not a shop: hiding each
    // shop leaves the heading and the block behind, and a reader who buys nowhere wants the block
    // gone rather than emptied. Positive like everything else here, so the box reads "show".
    showStores: true
  });

  const isPlainObject = value =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  // Fill in anything missing without touching what is there, so a partial object written by
  // an older build is completed rather than replaced.
  //
  // A key that arrives with the wrong shape is completed too rather than dropped: a reader who
  // had stored something this build cannot read gets the default, which is "show", so the
  // worst case of not understanding their setting is that nothing is hidden.
  //
  // A platform stored as a bare boolean is accepted, because that is the shape two builds
  // wrote and reading it costs one line rather than a migration that has to run first. What
  // is *not* accepted is any of the removed rules: `ancillary`, `nonEnglish`, `noEnglishSets`,
  // `foreignBlackBorder` and the rest are still sitting in the storage of anybody who used
  // 1.3–1.5, and nothing here looks at them. That is the requirement — a removed setting must
  // stop affecting the result rather than keep working through a field nobody removed.
  function normalise(input) {
    const out = defaults();
    if (!isPlainObject(input)) return out;

    for (const platform of PLATFORM_NAMES) {
      const stored = input.platforms?.[platform];
      if (typeof stored === 'boolean') {
        out.platforms[platform].show = stored;
        continue;
      }
      if (!isPlainObject(stored)) continue;
      if (typeof stored.show === 'boolean') out.platforms[platform].show = stored.show;
      for (const area of AREA_NAMES) {
        if (typeof stored.areas?.[area] === 'boolean') out.platforms[platform].areas[area] = stored.areas[area];
      }
    }

    for (const price of Object.keys(out.prices)) {
      if (typeof input.prices?.[price] === 'boolean') out.prices[price] = input.prices[price];
    }
    if (typeof input.tokens === 'boolean') out.tokens = input.tokens;
    // The "Buy This Card" block, added after the shape settled, so it has no older name to read.
    if (typeof input.showStores === 'boolean') out.showStores = input.showStores;
    // `showCaster`, not `caster`. The old key meant the opposite of what its name in the
    // settings said, and renaming it is what makes the two directions tellable apart: a value
    // carrying `showCaster` was written by a build that stored "show", and one carrying
    // `caster` by a build that stored "hide". Without the rename the two are the same
    // boolean and `normalise` cannot know which sense it is holding — and reading it the
    // wrong way round flips the Caster marker for every reader on the first page load after
    // an update, which is exactly what the relabel must not do.
    if (typeof input.showCaster === 'boolean') out.showCaster = input.showCaster;
    return out;
  }

  // ---- migration ------------------------------------------------------------------
  //
  // Four old shapes end here, and each mapping is a judgement rather than arithmetic. They
  // are written out because three of them are lossy and a reader who lost a setting is a
  // reader who did not choose to lose it.
  //
  // The one rule everywhere: when a choice cannot be carried across, show.

  // The flat booleans of 1.0 and earlier, translated once.
  function migrate(stored) {
    const out = defaults();
    if (!isPlainObject(stored)) return out;

    if (Array.isArray(stored.setPlatforms)) {
      // Only a list naming at least one platform we know. A list of nothing recognisable is
      // not a choice to show nothing — that would blank three surfaces outright — it is a
      // value this build cannot read, and the safe reading of that is the default.
      const known = stored.setPlatforms.filter(name => PLATFORM_NAMES.includes(name));
      if (known.length) {
        for (const platform of PLATFORM_NAMES) out.platforms[platform].show = known.includes(platform);
      }
    }
    if (stored.hideDigitalSets === true) {
      out.platforms.arena.show = false;
      out.platforms.mtgo.show = false;
    }

    // The one switch that meant "every price but Cardmarket". It was the only price setting
    // before 1.1.2, and it says what it says: the four kinds that existed then were hidden,
    // which in the positive shape is those four off.
    //
    // The four are named rather than taken from the model's keys. Cardmarket *is* the euro
    // column, so it is the one price this switch must leave alone — and iterating the keys
    // would hide the very price the switch is named after, which is the kind of thing a
    // migration can only get wrong once and never be told about.
    if (stored.onlyCardmarket === true) {
      for (const price of ['usd', 'tix', 'tcg', 'cardhoarder']) out.prices[price] = false;
    }

    // The Caster marker, whose switch used to read "hide" and now reads "show". Inverted, and the
    // only place the inversion happens: a reader who had the marker hidden keeps it hidden.
    if (stored.hideCasterIndicator === true) out.showCaster = false;
    // The old switch was "show the tokens a deck makes" and defaulted on, so it is already a
    // positive: only an explicit false carries over.
    if (stored.deckTokens === false) out.tokens = false;

    // Five old switches have no target at all and are simply not read: non-tournament,
    // oversized, the sets with no English printing, Foreign Black Border and the non-English
    // categories. All five were whole-set rules and none of them is a platform. Readers who
    // had any of them on get those sets back, which is the only reading available — the new
    // shape has nothing that could mean "hide this set" — and it errs towards showing, which
    // is the direction this project has always taken when it cannot carry a setting across.

    return out;
  }

  // Read the setting, migrating the first time it is seen. The flag is stored so the migration
  // happens once rather than on every page load, and so that a build which later changes the
  // shape has something to compare against.
  //
  // `upgrade` sits between the two older shapes and this one. It reads a value written by
  // 1.1.4–1.3.0 (negative, under `sets`), by 1.4.x–1.5.x (positive, under `paper`) and by
  // 1.5.1+ (a shared list of areas beside the platforms), and every one of them carries
  // fields this shape has no place for.
  function read(stored) {
    return {
      filters: stored.setFiltersMigrated === true
        ? upgrade(stored.setFilters)
        : migrate(stored),
      migrated: stored.setFiltersMigrated !== true
    };
  }

  

// The shape as a stored value from any of the earlier builds of *this* file. Kept separate
  // from `migrate` so neither reads the other's keys: one knows flat booleans, the others
  // know nested objects.
  //
  // Four shapes end here and each is told apart by a key that exists or does not, rather than
  // by a version number nobody writes. That is deliberate: a stored version can be wrong or
  // missing, and then a reader's settings are read as the wrong shape. A key either is there
  // or is not.
  function upgrade(input) {
    if (!isPlainObject(input)) return defaults();

    // The current shape: a value a later build wrote and this one has to read back unchanged,
    // and it is the only shape that stores `showCaster`. Checked first, because the branches
    // below rewrite every platform's places from one shared list, and doing that to a value
    // that already has nine of its own would throw the reader's choices away on the first page
    // load after an update — which is the failure this file has been rewritten to avoid three
    // times.
    if (typeof input.showCaster === 'boolean') return normalise(input);

    // 1.6.0 to 1.6.2: the current layout — per-platform places, positive prices — with the Caster
    // key still named `caster` and still meaning *hide*. This branch exists only to rename that
    // one key, and it is the reason the rename above is a rename rather than a comment: a value
    // from that range has the new layout and the old sense, and the two are otherwise the same
    // object. Prices pass through untouched, because that range already stored them positively.
    if (PLATFORM_NAMES.some(name => isPlainObject(input.platforms?.[name]))) {
      return normalise({
        ...input,
        showCaster: typeof input.caster === 'boolean' ? !input.caster : undefined
      });
    }

    // 1.1.4 to 1.3.0: negative switches under `sets`, and a master beside them. It is the only
    // shape with `sets`, and that one key is what says "this is older" — a value written
    // part-way through a migration holds neither `sets` nor `paper` and must not be read as
    // the old shape, or five switches would act for a reader who had never touched any of them.
    if (isPlainObject(input.sets)) {
      // A master that was off meant none of this was applying, which is now every switch at
      // its default — arriving there by putting them back rather than by keeping a gate.
      if (input.setsEnabled === false) return defaults();
      const out = normalise({
        platforms: input.platforms,
        prices: invertPrices(input.prices),
        tokens: input.tokens,
        showCaster: invertCaster(input.caster)
      });
      const areas = areasFromLegacyAreas(isPlainObject(input.areas) ? input.areas : {});
      return withAreas(out, areas);
    }

    // 1.4.x and 1.5.0: positive switches under `paper`, beside a shared list of areas.
    // Neither the paper rules nor the removed set rules have anywhere to go, and the shared
    // list is spread over the three platforms — which is the last shape that had one, so this
    // is the migration that turns it into three.
    const out = normalise({
      platforms: input.platforms,
      prices: invertPrices(input.prices),
      tokens: input.tokens,
      showCaster: invertCaster(input.caster)
    });
    return withAreas(out, areasFromLegacyAreas(isPlainObject(input.areas) ? input.areas : {}));
  }

  // The Caster key as the shape that stored *hide* it, read into the one that stores *show*.
  //
  // `undefined` rather than a guess: a shape that never stored the key at all has to arrive at
  // the default, and arriving there through `normalise`'s own filling is the only way that
  // default can change without this file changing too.
  function invertCaster(caster) {
    return typeof caster === 'boolean' ? !caster : undefined;
  }

  // The four price keys as the shape that used to hold them, read into the positive one.
//
// Every one of the three earlier nested shapes stored `prices` the other way round, so all
// three go through here and the current shape does not. Getting this wrong in either direction
// is expensive and silent: read positive as negative and a reader who had every price on gets
// every price hidden on the first page load after an update, and the four switches on the
// settings page — which read the stored value — would all be unticked while every price was
// still on the page.
function invertPrices(prices) {
  if (!isPlainObject(prices)) return undefined;
  const out = {};
  for (const price of Object.keys(defaults().prices)) {
    if (typeof prices[price] === 'boolean') out[price] = !prices[price];
  }
  return out;
}

  // The same object with a given list of areas written into all three platforms.
  //
  // Written as a function rather than folded into `normalise` because `normalise` reads the
  // per-platform shape and this is the only place that manufactures one out of a shared list.
  // It copies rather than aliases: two platforms holding the same object would be one reader's
  // mistake on one surface showing up on the other two, and the settings page writes one
  // platform at a time.
  function withAreas(filters, areas) {
    const out = Object.assign({}, filters);
    out.platforms = {};
    for (const platform of PLATFORM_NAMES) {
      out.platforms[platform] = {
        show: Boolean(filters.platforms[platform]?.show),
        areas: { ...areas }
      };
    }
    return out;
  }

  // One rule: was this area stored under the old shape? The old value could name one area or
  // both; there are three now. A rule that named both reaches all three, because this build
  // has one more place and not one fewer, and dropping the reader's choice in the new place
  // would be the migration narrowing somebody's settings on upgrade.
  function areasFromLegacyAreas(areas) {
    const out = { prints: true, search: true, sets: true };
    for (const area of AREA_NAMES) {
      if (typeof areas?.[area] === 'boolean') out[area] = areas[area];
    }
    return out;
  }

  // What the pages are handed. One object, already resolved, so no page re-derives whether a
  // switch means hide or show.
  //
  // There is no gate in it and no `effective` collapse: a platform that is off is off, and its
  // own areas are still stored and still come back when it is switched on. That is the whole
  // of what "turning a platform off preserves its settings" requires — there is nothing to
  // preserve if turning it off also rewrites the values under it.
  function effective(filters) {
    return normalise(filters);
  }

  // The platforms a printing is allowed to be on, for one surface.
  //
  // This is the whole of the platform rule and the whole of the area list: a platform counts
  // on a surface when it is shown *and* it is in force there. Everything else the pages need
  // to know about filtering is this one answer per surface.
  //
  // Answered per printing, from the printing's own `games`, and never from its set. A set can
  // be paper and Arena while one of its cards is Arena-only, and a set-level answer would hide
  // the paper printing along with it.
  //
  // A printing whose `games` is missing is shown. It cannot be placed, and hiding on an
  // inability to place is the failure this filter has never been allowed to make.
  function printingOnPlatform(printing, chosen) {
    const games = printing?.games;
    if (!Array.isArray(games) || !games.length) return true;
    return games.some(game => chosen.includes(game));
  }

  window.STK_SET_FILTERS = {
    AREAS, AREA_NAMES, PLATFORM_NAMES, PLATFORM_LABELS, PLATFORM_COLUMN, SHOW_COLUMN,
    PRICE_KINDS, PRICE_GROUPS, PRICE_GROUP_NAMES, LEGACY_KEYS,
    defaults, normalise, upgrade, migrate, read, effective, isPlainObject,
    printingOnPlatform
  };
})();