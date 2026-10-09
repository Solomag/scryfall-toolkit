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
    chosenForSets,
    chosenForSearch,
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
    // One rule, two surfaces on this page, and two different answers.
    //
    // The list of sets below is the Sets index and the rows of a prints table on this same
    // page are the table. Both are filtered by the same rule — a platform — and the reader
    // answers that rule separately for each, so the two surfaces ask for their own kept
    // platforms rather than sharing one. That is the whole of what the areas are for, and it
    // is why `platformSetVisible` takes the kept platforms as an argument here instead of
    // reading a captured value: a reader who keeps Arena in the table and drops it from the
    // index is a state the page has to be able to be in.
    const setsSurface = /^\/sets\/?$/.test(location.pathname);
    // Whether the index is worth asking for. There is one rule and it is in force on some
    // surface or none, so the question is whether any of the three is filtering — the same
    // answer the boot decision used, asked once.
    const needsSetIndex = setsFilterOn() || printsFilterOn();
    const categoriesRequest = needsSetIndex || platformFilterOn
      ? platformSetRequests().catch(() => ({
        // The empty list is the point of this fallback rather than an omission. It used to
        // answer with the pre-1.1.4 shape, which the removal code read as an array and so
        // yielded nothing for — meaning a failed request quietly produced a page with every
        // rule looking on and hiding nothing. The current shape fails the same way but for
        // the right reason: the shape is right and the answer is empty.
        categories: { digital: [] },
        platforms: {}
      }))
      : Promise.resolve({ categories: { digital: [] }, platforms: {} });

    // Both answers have to be in hand before the rows are walked, because the rows are walked
    // once and the observer below may walk them again on any change to the table.
    categoriesRequest.then(({ categories, platforms }) => {
      if (!categories || !Array.isArray(categories.digital)) return;
      // One per surface, read out of the same classification. The sets index is judged by
      // the platforms kept there and the prints table by the platforms kept on the table, so
      // a reader can have two different answers and the page can be in both states at once.
      const setsVisible = platformSetVisible(categories, platforms, chosenForSets);
      const printsVisible = platformSetVisible(categories, platforms, chosenPlatforms);
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
          row.classList.toggle('stk-digital-set-hidden', Boolean(set && !setsVisible(set)));
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
          row.classList.toggle('stk-digital-set-hidden', Boolean(!row.classList.contains('current') &&
            set && !printsVisible(set)));
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
    // Platforms allowed here: what the Games checkboxes tick, narrowed by the ones kept for
    // this surface in settings — the `search` areas, which are the reader's own answer about
    // this field and nothing else. An empty overlap falls back to the Games choice alone, so
    // the field never ends up without a single set.
    const allowed = () => {
      const ticked = new Set(gamesBoxes.filter(box => box.checked)
        .map(box => box.value).filter(name => PLATFORM_NAMES.includes(name)));
      if (!ticked.size) return chosenForSearch;
      const shared = [...ticked].filter(name => chosenForSearch.has(name));
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
    // One rule, and it is the platform rule. The `search` areas are read by `allowed()` above,
    // which is the only thing this field asks the settings.
    //
    // The platform index is asked for whatever the settings say, because the Games checkboxes
    // above this field decide the list on their own and they are not a setting. Asking for it
    // conditionally would leave every digital set looking like an unplaceable one on a page
    // whose filters are all at their defaults — which is a state a reader is in until they
    // touch something.
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
