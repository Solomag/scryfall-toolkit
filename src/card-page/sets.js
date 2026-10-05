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

// The set list filters, on /sets and on the advanced search page.
// Loaded after content-core.js: everything this file needs is on self.STK_CONTENT, and
// nothing here is needed by the files around it. What runs, and in which order, is
// decided in content-core.js — where this file sits in the manifest does not decide it.
(async () => {
  // The settings have not been read yet when this file is injected, so the context is
  // waited for rather than read. Destructuring at load time would give every name
  // below as undefined, and nothing would say so until a feature asked for a card page
  // that was not there.
  const {
    settings,
    setFilters,
    language,
    t,
    cardPath,
    cardPage,
    advancedPage,
    identity,
    PLATFORM_NAMES,
    chosenPlatforms,
    platformFilterOn,
    setsFilterOn,
    searchFilterOn,
    printsFilterOn,
    setPlatformsOf,
    platformSetVisible,
    platformSetRequests,
    request,
    button,
    iconButton,
    attachPrintButton,
    printKey,
    refreshPrintButtons,
    flashCopied,
    hidePreview,
    positionPreview,
    enablePreview,
    ctQueuedCells,
    printButtonRefreshers,
    shared
  } = await self.STK_CONTENT.context;

  function initSetFilter() {
    // Scryfall lists these curated online cubes under /cubes/, outside its
    // /sets API. Restrict this exception to the twelve online-only cubes.
    const onlineCubes = new Set(['apcube','arena','chromatic','livethedream','tinkerer','grixis','protour','vintage','uncommon','modern','legacy','twisted']);
    // Which of the two surfaces this page is, asked of the mode rather than assumed.
    //
    // The list of sets below is the Sets index. The rows of a prints table on this same
    // page are the other surface, and they are a different surface: a set is named by
    // its code in both, but only the prints table knows a printing's language, which is
    // what the non-English rule is really about.
    //
    // This is the first of the three places 1.1.0 got wrong. It asked
    // `settings.hideForeignBlackBorder`, a boolean alias of the mode, and with 'prints'
    // chosen that was false: the index was never fetched, the rule did nothing on the
    // sets index, and it did nothing on the prints table either because the request
    // never happened. A setting that appeared to work did not work anywhere.
    const setsSurface = /^\/sets\/?$/.test(location.pathname);
    // Whether the index is worth asking for at all. Only a rule that removes something, on a
    // surface that is switched on, needs it — and the platform filter needs it whatever the
    // rules say, because it is the one thing here that is answered from the index.
    const wantsRemoving = !settings.showNonTournament || !settings.showOversized ||
      !settings.showNoEnglishSets ||
      Object.values(settings.showForeignBlackBorder || {}).some(show => show !== true);
    // Only the two surfaces this file can act on with a set code. The search field has its own
    // list and its own code path, and counting it here would fetch the index on a page whose
    // filter is off — the request this whole `needsSetIndex` exists to avoid.
    const setsWantedForIndex = setsFilterOn();
    const printsWantedForIndex = printsFilterOn();
    const needsSetIndex = (setsWantedForIndex || printsWantedForIndex) && wantsRemoving;
    const categoriesRequest = needsSetIndex || platformFilterOn
      ? platformSetRequests().catch(() => ({
        // The empty per-category objects are the point of this fallback rather than an
        // omission. It used to answer with the pre-1.1.4 shape, a flat
        // `foreignBlackBorder: ['4bb','fbb','bchr']`, which `codesFor` reads as an array and
        // so yields nothing for — meaning a failed request quietly produced a page with
        // every rule looking on and hiding nothing. The current shape fails the same way but
        // for the right reason: the shape is right and the answer is empty.
        categories: {digital: [], foreignOnly: [], foreignBlackBorder: {}, nonEnglish: {}},
        visible: () => true
      }))
      : Promise.resolve({categories: {digital: []}, visible: () => true});
    categoriesRequest
      .then(({categories, visible: setVisible}) => {
      if (!categories || !Array.isArray(categories.digital)) return;
      // Two lists of set codes, one per surface, because the rules differ between them and a
      // single list applied to both is how a rule addressed to the Prints table ended up
      // hiding rows of the Sets index.
      //
      // Digital, non-tournament and oversized are asked of both: they are properties of a
      // set, and a set has the same code wherever it is listed. The two mode rules join
      // whichever list their mode names.
      //
      // The non-English list the index has is the two sets whose names say what they
      // are — Portal and Secret Lair — and not the third category, which no set name
      // describes. So on this surface the rule is narrower than on the Prints table,
      // and the settings page says so rather than the page implying otherwise.
      const codesOf = value => (value || []).map(code => String(code).toLowerCase());
      const commonHidden = [
        ...(settings.hideDigitalSets ? categories.digital : []),
        ...(settings.showNonTournament ? [] : categories.nonTournament || []),
        ...(settings.showOversized ? [] : categories.oversized || []),
        // A set with no English printing has nothing to show on either surface, so this one
        // needs no surface of its own and no list under it.
        ...(settings.showNoEnglishSets ? [] : categories.foreignOnly || [])
      ].map(code => String(code).toLowerCase());
      // Only the categories the reader has switched off. Positive switches in, a list of codes to
      // remove out, and the two are inverted here so that no other line has to know which way
      // round a switch reads.
      //
      // Foreign Black Border is per family: a family that is off removes its sets and a family
      // that is on leaves them, which is why this cannot be one `some()` over the whole
      // table.
      const codesFor = (group, keys) => keys.flatMap(key => codesOf(group?.[key]));
      const borderOff = Object.entries(settings.showForeignBlackBorder || {})
        .filter(([, show]) => show !== true)
        .map(([key]) => key);
      const borderCodes = codesFor(categories.foreignBlackBorder, borderOff);
      const hiddenOnSets = new Set([...commonHidden, ...borderCodes]);
      const hiddenOnPrints = new Set([...commonHidden, ...borderCodes]);
      // The sets index and the search field are set-level surfaces, and each rule is asked
      // only where the reader said it should apply. Before this the two rules carried their
      // own surface list and each surface read its own copy of the mode, which is how a rule
      // addressed to one surface ended up acting on the other.
      const setsWanted = setsFilterOn();
      const printsWanted = printsFilterOn();
      const main = document.querySelector('#main');
      if (!main) return;
      const apply = () => {
        const rows = [...main.querySelectorAll('#js-checklist tbody tr')];
        for (const row of rows) {
          const link = row.querySelector('td:first-child a[href]');
          let path;
          try { path = new URL(link?.href || '',location.href).pathname; }
          catch { /* Ignore malformed unrelated links. */ }
          const set = path?.match(/^\/sets\/([^/]+)\/?$/)?.[1];
          const cube = path?.match(/^\/cubes\/([^/]+)\/?$/)?.[1];
          row.classList.toggle('stk-digital-set-hidden', Boolean(set &&
            ((setsWanted && hiddenOnSets.has(set.toLowerCase())) || !setVisible(set)) ||
            settings.hideDigitalSets && cube && onlineCubes.has(cube.toLowerCase())));
        }
        // Printings are identified by the set in the card URL. Keep the
        // selected printing visible so its own detail page remains coherent.
        for (const row of main.querySelectorAll('.prints-table tbody tr')) {
          const link = row.querySelector('td:first-child a[href]');
          // Scryfall prints the link of a printing as a path, but the same row
          // can carry a full URL; the path is what names the set.
          let path;
          try { path = new URL(link?.getAttribute('href') || '', location.href).pathname; }
          catch { /* Ignore malformed unrelated links. */ }
          const set = path?.match(/^\/card\/([^/]+)\//)?.[1];
          // English links end after the card slug. A language-specific link
          // has an extra /lang/ segment before that slug (e.g. /ptk/1/ja/name).
          const foreignPrinting = /^\/card\/[^/]+\/[^/]+\/(?:[a-z]{2,3})\/[^/]+/i.test(path || '');
          // The prints table on this page is the other surface. It gets a narrower reading
          // of the language rule than the extended table does: 'none' hides a foreign row by
          // that link, and 'analogue' does not touch it at all.
          //
          // That is the honest limit rather than a shortcut. Deciding whether one of Scryfall's
          // own rows has an English analogue means comparing its artwork with another
          // printing's, and this page carries the link and the text and nothing else —
          // no illustration, no frame, no border. There is nothing to compare, so the row stays,
          // which is what "insufficient data leaves it visible" has to mean.
          const languageHidesRow = settings.nonEnglishMode === 'none';
          row.classList.toggle('stk-digital-set-hidden', Boolean(!row.classList.contains('current') &&
            (set && ((printsWanted && hiddenOnPrints.has(set.toLowerCase())) || !setVisible(set)) ||
             printsWanted && languageHidesRow && foreignPrinting)));
        }
        // Scryfall repeats the counter above and below the list, so both are
        // rewritten; the label is found by what it labels, not by its place.
        const shown = rows.filter(row => !row.classList.contains('stk-digital-set-hidden')).length;
        for (const counter of main.querySelectorAll('.search-controls label[for="order"]')) {
          counter.textContent = language === 'ru' ? `${shown} из ${rows.length} сетов в` : `${shown} of ${rows.length} sets in`;
        }
      };
      apply();
      const table = main.querySelector('#js-checklist') || main.querySelector('.prints-table');
      if (table) new MutationObserver(apply).observe(table, {childList:true,subtree:true});
    });
  }

  function initAdvancedSetFilter() {
    // The Games checkboxes sit right above this field, so the set list follows
    // the platforms that are ticked there as well as the ones kept in settings.
    const select = document.querySelector('#main select[name="set[]"]');
    const gamesField = select?.closest('.form-row')?.previousElementSibling
      || document.querySelector('#main input[name="games[]"]')?.closest('.form-row-content-band');
    if (!select) return;
    const gamesBoxes = [...document.querySelectorAll('#main input[name="games[]"]')];
    // Scryfall builds this dropdown only when the field is opened, and it puts
    // the container into the form rather than next to the select, so the list
    // is looked up again on every change inside the form.
    const containerOf = () => {
      const results = document.getElementById(`select2-${select.id || 'set'}-results`);
      const owner = results?.closest('.select2-container');
      if (owner) return owner;
      const sibling = select.nextElementSibling;
      if (sibling?.classList?.contains('select2-container')) return sibling;
      return [...(select.parentElement?.querySelectorAll('.select2-container') || [])]
        .find(node => node.previousElementSibling === select) || null;
    };
    // Platforms allowed here: what the Games checkboxes tick, narrowed by the
    // ones kept in settings. An empty overlap falls back to the Games choice
    // alone, so the field never ends up without a single set.
    const allowed = () => {
      const ticked = new Set(gamesBoxes.filter(box => box.checked)
        .map(box => box.value).filter(name => PLATFORM_NAMES.includes(name)));
      if (!ticked.size) return chosenPlatforms;
      const shared = [...ticked].filter(name => chosenPlatforms.has(name));
      return new Set(shared.length ? shared : ticked);
    };
    const hide = (node, hidden) => {
      node.hidden = hidden;
      if (node.tagName === 'OPTION') node.disabled = hidden;
    };
    // Every option carries the set symbol of its set, which names the code.
    const setCodeOf = item => {
      const use = item.querySelector('use');
      const href = use?.getAttribute('xlink:href') || use?.getAttribute('href') || '';
      return href.match(/^#sets-(.+)-svg$/)?.[1]?.toLowerCase() || '';
    };
    let visible = () => true;
    const apply = () => {
      const chosen = new Set([...select.options].filter(option => option.selected).map(option => option.value.toLowerCase()));
      for (const option of [...select.options]) {
        const code = option.value.toLowerCase();
        // Sets already chosen stay put, exactly like the printing on a card page.
        hide(option, Boolean(code && !chosen.has(code) && !visible(code)));
      }
      const container = containerOf();
      if (!container) return;
      for (const item of container.querySelectorAll('.select2-results__option[role="treeitem"]')) {
        const set = setCodeOf(item);
        if (set) item.hidden = !visible(set);
      }
      for (const group of container.querySelectorAll('.select2-results__option[role="group"]')) {
        const rows = [...group.querySelectorAll('.select2-results__option[role="treeitem"]')];
        group.hidden = Boolean(rows.length) && rows.every(row => row.hidden);
      }
    };
    // The set-level rules, asked about once and folded into the same answer as the platforms.
    //
    // Only the rules that can be answered from a set code are applied here. The non-English
    // rule is not one of them: it is a statement about a printing, and this field lists sets,
    // so "does this set have an English analogue" has no meaning on a dropdown that picks a
    // set rather than a printing.
    //
    // The border families are asked as "some family is off" for the reason given in core.js:
    // written as "not every family is on" is the same answer, and written as `some(show => show)`
    // it would be true only when all of them are off.
    const categoriesWanted = searchFilterOn() &&
      (!settings.showNonTournament || !settings.showOversized || !settings.showNoEnglishSets ||
        Object.values(settings.showForeignBlackBorder || {}).some(show => show !== true));
    // The platform index is asked for whatever the rules say, because the Games checkboxes above
  // this field decide the list on their own and they are not a setting. Asking for it
  // conditionally would leave every digital set looking like an unplaceable one on a page
  // whose filters are all at their defaults — which is a state a reader is in until they
  // touch something.
    platformSetRequests(true).then(index => {
      let excluded = new Set();
      if (categoriesWanted && index.categories && Array.isArray(index.categories.digital)) {
        const codesOf = value => (value || []).map(code => String(code).toLowerCase());
        const borderOff = Object.entries(settings.showForeignBlackBorder || {})
          .filter(([, show]) => show !== true)
          .map(([key]) => key);
        excluded = new Set([
          ...(settings.showNonTournament ? [] : codesOf(index.categories.nonTournament)),
          ...(settings.showOversized ? [] : codesOf(index.categories.oversized)),
          ...(settings.showNoEnglishSets ? [] : codesOf(index.categories.foreignOnly)),
          ...borderOff.flatMap(key => codesOf(index.categories.foreignBlackBorder?.[key]))
        ]);
      }
      visible = code => {
        if (excluded.has(String(code || '').toLowerCase())) return false;
        const games = setPlatformsOf(index.categories, index.platforms, code);
        return !games.length || games.some(game => allowed().has(game));
      };
      apply();
    });
    for (const box of gamesBoxes) box.addEventListener('change', apply);
    if (gamesField) new MutationObserver(apply).observe(gamesField, { attributes: true, subtree: true, attributeFilter: ['checked', 'disabled'] });
    new MutationObserver(apply).observe(select.closest('form') || document.body, { childList: true, subtree: true });
  }


  self.STK_CONTENT.on("setFilter", () => initSetFilter());
  self.STK_CONTENT.on("advancedSetFilter", () => initAdvancedSetFilter());
})();
