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
    const RULES = self.STK_CONTENT.SET_FILTER_RULES;
    const setsSurface = /^\/sets\/?$/.test(location.pathname);
    // The sets index is keyed by set code, so the mode rules can only act on it when
    // they are addressed to it. Asking `!== 'off'` would say yes to 'prints' too, which
    // is the surface that cannot see a set code at all.
    const fbbHidesSets = RULES.reachesSets(settings.foreignBlackBorderSurfaces);
    const langHidesSets = RULES.reachesSets(settings.nonEnglishSurfaces);
    // The same two rules on the prints table. Non-English printings are matched by the
    // printing's own language rather than by its set, so this surface can act on the
    // whole of the rule even where the set code says nothing.
    const fbbHidesPrints = RULES.reachesPrints(settings.foreignBlackBorderSurfaces);
    const langHidesPrints = RULES.reachesPrints(settings.nonEnglishSurfaces);
    const needsSetIndex = settings.hideDigitalSets || settings.hideNonTournamentSets ||
      settings.hideOversizedSets || fbbHidesSets || fbbHidesPrints || langHidesSets;
    const categoriesRequest = needsSetIndex || platformFilterOn
      ? platformSetRequests().catch(() => ({categories: {digital: [], foreignBlackBorder: ['4bb', 'fbb', 'bchr']}, visible: () => true}))
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
        ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
        ...(settings.hideOversizedSets ? categories.oversized || [] : [])
      ].map(code => String(code).toLowerCase());
      // The per-category answers, narrowed by the reader's list. A category left out of
      // the list contributes nothing, which is what unchecking its row on the settings
      // page means — and this is the first code in the extension that acts on the list
      // at all, so before 1.1.4 the rows were drawn and nothing read them.
      const codesFor = (group, which) => which.flatMap(key => codesOf(group?.[key]));
      const fbbRule = setFilters.sets.foreignBlackBorder;
      const langRule = setFilters.sets.nonEnglish;
      const borderCodes = codesFor(categories.foreignBlackBorder, fbbRule.which);
      const langCodes = codesFor(categories.nonEnglish, langRule.which);
      const hiddenOnSets = new Set([...commonHidden,
        ...(fbbHidesSets ? borderCodes : []),
        ...(langHidesSets ? langCodes : [])]);
      const hiddenOnPrints = new Set([...commonHidden,
        ...(fbbHidesPrints ? borderCodes : [])]);
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
          row.classList.toggle('stk-digital-set-hidden', Boolean(set && (hiddenOnSets.has(set.toLowerCase()) || !setVisible(set)) || settings.hideDigitalSets && cube && onlineCubes.has(cube.toLowerCase())));
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
          // The prints table on this page is the other surface, so the same rules are
          // asked again about it rather than reused from the list above. With 'off'
          // chosen neither applies, which is what a reader who has switched something
          // off should see; with 'prints' chosen both apply here and neither touches the
          // sets list.
          row.classList.toggle('stk-digital-set-hidden', Boolean(!row.classList.contains('current') &&
            (set && (hiddenOnPrints.has(set.toLowerCase()) || !setVisible(set)) || langHidesPrints && foreignPrinting)));
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
    platformSetRequests(true).then(index => {
      visible = code => {
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
