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
(async () => {
  const defaults = {
    siteLanguage: 'en',
    clipboard: true, tags: true, cardTags: true, artTags: false, relationships: true,
    onlyCardmarket: false, printAddButtons: true, printPageSameTab: false, hideDigitalSets: false, hideNonTournamentSets: false, hideOversizedSets: false,
    hideForeignBlackBorder: false, hideNonEnglishPrints: false, legalities: true, finishBadges: true, cardtraderPrices: false, euroPriceSources: 'cm',
    setPlatforms: ['paper', 'arena', 'mtgo'],
    printGrouping: false, printFoldGroups: false, printFullPageLink: false,
    edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: false, edhrecUsageDisplay: 'both',
    usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
    usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
    taggerSearchLinks: false, cardSearchLinks: true, cardNicknames: true, deckNoPrices: true, stackedDeckCards: true, deckTokens: true,
    premodern: true, heritage: false, classic: false, peak: false,
    formatOrder: null, formatVisibility: null,
    deckCleanUpImprover: false, cleanUpLandsInSingleton: true,
    sortEntriesPrimary: 'none', insertSortingHeadings: true,
    cardPreviewOnHover: false, edhrecSuggestions: false, deckSearch: false,
    exportFormat: "moxfield", cards: null
  };
  const settings = await chrome.storage.local.get(defaults);
  // --- the page-world bridge -------------------------------------------------
  // The deck features have to run in Scryfall's own page world, because they
  // work through window.Scryfall and window.ScryfallAPI and this script lives
  // in an isolated world that can see neither. Only this side can read the
  // settings. So the two meet at the window itself.
  const deckSettingsNow = () => {
    const wanted = settings.deckCleanUpImprover || settings.cardPreviewOnHover ||
      settings.edhrecSuggestions || settings.deckSearch;
    if (!wanted) return {};
    const value = {};
    if (settings.deckCleanUpImprover) {
      value.cleanUpLandsInSingleton = settings.cleanUpLandsInSingleton;
      value.sortEntriesPrimary = settings.sortEntriesPrimary;
      value.insertSortingHeadings = settings.insertSortingHeadings;
    }
    if (settings.cardPreviewOnHover) value.cardPreviewOnHover = true;
    if (settings.edhrecSuggestions) value.edhrecSuggestions = true;
    if (settings.deckSearch) value.deckSearch = true;
    return value;
  };
  const sendDeckSettings = () => window.postMessage({
    channel: 'scryfall-toolkit', version: 1, source: 'content',
    type: 'settings', value: deckSettingsNow()
  }, '*');
  window.addEventListener('message', event => {
    if (event.source !== window && event.source !== self) return;
    const data = event.data;
    if (!data || data.channel !== 'scryfall-toolkit' || data.version !== 1) return;
    // The page side announces itself when it is listening, which may be before
    // or after this script runs.
    if (data.source === 'page' && data.type === 'ready') sendDeckSettings();
    // What the page world reports back about the deck modules: whether the hooks
    // into Scryfall took, and what did not. It is kept so that "the feature does
    // not work" can be answered with a reason instead of a guess.
    if (data.source === 'page' && data.type === 'status') {
      chrome.storage.local.set({
        deckModuleStatus: Object.assign({ at: Date.now(), page: location.pathname }, data.value || {})
      }).catch(() => {});
    }
    // The page world cannot reach the extension's background worker; this is
    // the only bridge to it. The name is the request type the worker answers.
    if (data.source === 'page' && data.type === 'request' && data.value && data.value.id) {
      const { id, name, value } = data.value;
      const reply = (ok, result) => window.postMessage({
        channel: 'scryfall-toolkit', version: 1, source: 'content', type: 'response',
        value: ok ? { id, value: result } : { id, error: String(result && result.message || result) }
      }, '*');
      if (!/^[a-zA-Z]+$/.test(String(name))) return reply(false, 'Unknown request');
      chrome.runtime.sendMessage({ type: name, ...(value || {}) })
        .then(result => reply(true, result))
        .catch(error => reply(false, error));
    }
  });
  sendDeckSettings();
  // Turning the feature on or off should not need a page reload.
  chrome.storage.onChanged.addListener(changes => {
    const keys = ['deckCleanUpImprover', 'cleanUpLandsInSingleton', 'sortEntriesPrimary', 'insertSortingHeadings', 'cardPreviewOnHover', 'edhrecSuggestions', 'deckSearch'];
    if (!keys.some(key => changes[key])) return;
    keys.forEach(key => { if (changes[key]) settings[key] = changes[key].newValue; });
    sendDeckSettings();
  });
  const language = settings.siteLanguage === 'ru' ? 'ru' : 'en';
  const t = text => window.STK_I18N.t(text, language);
  const cardPath = location.pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
  const cardPage = Boolean(cardPath && document.querySelector('.card-image') && document.querySelector('#main .prints-table'));
  const advancedPage = location.pathname === '/advanced';
  // Paper is every set Scryfall does not mark digital; Arena and Magic Online
  // sets answer for themselves in the platform index.
  const PLATFORM_NAMES = ['paper', 'arena', 'mtgo'];
  const chosenPlatforms = new Set(
    (Array.isArray(settings.setPlatforms) ? settings.setPlatforms : PLATFORM_NAMES).filter(name => PLATFORM_NAMES.includes(name))
  );
  if (!chosenPlatforms.size) for (const name of PLATFORM_NAMES) chosenPlatforms.add(name);
  const platformFilterOn = chosenPlatforms.size < PLATFORM_NAMES.length;
  // Tells whether a set belongs to a platform the user kept. A digital set the
  // index could not place stays visible: hiding a set on a guess is worse.
  const setPlatformsOf = (categories, platforms, code) => {
    const key = String(code || '').toLowerCase();
    // Paper is every set Scryfall does not mark digital.
    if (!(categories?.digital || []).includes(key)) return ['paper'];
    const games = (platforms || {})[key];
    return Array.isArray(games) ? games : [];
  };
  const platformSetVisible = (categories, platforms) => code => {
    const games = setPlatformsOf(categories, platforms, code);
    return !games.length || games.some(game => chosenPlatforms.has(game));
  };
  const platformSetRequests = async (withPlatforms = platformFilterOn) => {
    const [categories, platforms] = await Promise.all([
      request({type: 'setCategories'}).catch(() => ({ digital: [] })),
      // The set field on /advanced needs the index even when the settings keep
      // every platform, because the Games checkboxes decide the list there.
      withPlatforms ? request({type: 'setPlatforms'}).catch(() => ({})) : Promise.resolve({})
    ]);
    return { categories, platforms, visible: platformSetVisible(categories, platforms) };
  };
  const identity = cardPage ? { set: cardPath[1], number: decodeURIComponent(cardPath[2]) } : null;
  // Shared with the in-table prints expansion: the Finish column header lands
  // asynchronously (so expansions wait for it before counting columns) and the
  // throttled CardTrader queue is reused for rows that are created later.
  let finishesSettled = Promise.resolve();
  let enqueueCardTraderPrint = null;
  // A printing's CardTrader cell is fetched once no matter how often the table
  // is regrouped; the set is keyed on the DOM node so a re-expand while the
  // queue is still draining can never fill the same cell twice.
  const ctQueuedCells = new WeakSet();
  // Print-row buttons follow the clipboard: a printing counts as selected when
  // a buffered card points at the same set and number, and every button
  // refreshes whenever the clipboard changes here or in another tab.
  let clipboardCards = Array.isArray(settings.cards) ? settings.cards : [];
  const printButtonRefreshers = new Set();
  const printKey = (set, number) => `${String(set || '').toLowerCase()}\u0000${String(number || '').toLowerCase()}`;
  function refreshPrintButtons() { for (const sync of printButtonRefreshers) sync(); }
  function attachPrintButton(cell, key, payload, addTitle) {
    if (!settings.clipboard || !settings.printAddButtons || cell.querySelector('.stk-native-print-add')) return null;
    const add = button('+', async () => {
      add.disabled = true;
      try { await window.STK_ADD_PRINT(payload); }
      finally { add.disabled = false; refreshPrintButtons(); }
    });
    add.className = 'stk-native-print-add';
    add.title = addTitle;
    add.setAttribute('aria-label', addTitle);
    cell.append(add);
    const removeTitle = language === 'ru' ? 'Убрать это издание из буфера' : 'Remove this printing from the clipboard';
    const sync = () => {
      const selected = clipboardCards.some(card => printKey(card.set, card.number) === key);
      // A selected printing keeps its check mark on screen at all times; an
      // unselected one only shows up while its row is hovered.
      add.textContent = selected ? '✓' : '+';
      add.classList.toggle('stk-print-selected', selected);
      add.title = selected ? removeTitle : addTitle;
      add.setAttribute('aria-label', add.title);
    };
    printButtonRefreshers.add(sync);
    sync();
    return add;
  }
  // Copy feedback: a repeat copy has to restart the pop, and the timer left over
  // from the previous copy must not cut the new one short.
  const copiedTimers = new WeakMap();
  function flashCopied(control, restTitle) {
    clearTimeout(copiedTimers.get(control));
    control.classList.remove('stk-copied');
    void control.offsetWidth;
    control.classList.add('stk-copied');
    control.title = t('Скопировано');
    copiedTimers.set(control, setTimeout(() => {
      control.classList.remove('stk-copied');
      control.title = restTitle;
      copiedTimers.delete(control);
    }, 1000));
  }
  // Set by the stats panel so a re-arranged legality block can realign it.
  let realignStatsPanel = null;

  // One hover preview shared by the tag panel and the expanded print rows.
  let previewBox, previewTimer, previewHideTimer, activePreview;
  function hidePreview(immediate = false) {
    clearTimeout(previewTimer);
    clearTimeout(previewHideTimer);
    if (immediate) { activePreview = null; if (previewBox) previewBox.hidden = true; return; }
    previewHideTimer = setTimeout(() => {
      if (previewBox?.matches(':hover')) return;
      activePreview = null;
      if (previewBox) previewBox.hidden = true;
    }, 450);
  }
  function positionPreview(link) {
    const rect = link.getBoundingClientRect();
    const width = 240, height = 340;
    const left = rect.left > width + 24 ? rect.left - width - 12 : rect.right + 12;
    previewBox.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    previewBox.style.top = `${Math.max(8, Math.min(rect.top, window.innerHeight - height - 8))}px`;
  }
  // `resolve` returns the card to show, so a print row can answer from the print
  // list it already has while a tag row asks the background for it.
  function enablePreview(link, resolve) {
    const show = () => {
      hidePreview(true);
      activePreview = link;
      previewTimer = setTimeout(async () => {
        try {
          if (!previewBox) {
            previewBox = document.createElement('div');
            previewBox.id = 'stk-card-preview';
            previewBox.addEventListener('mouseenter', () => clearTimeout(previewHideTimer));
            previewBox.addEventListener('mouseleave', () => hidePreview());
            document.body.append(previewBox);
            window.addEventListener('scroll', () => hidePreview(true), { passive: true });
          }
          previewBox.textContent = t('Загружаю карту…');
          previewBox.classList.add('stk-card-preview-loading');
          positionPreview(link);
          previewBox.hidden = false;
          const card = await resolve();
          if (activePreview !== link || !card?.image) return;
          if (card.uri) link.href = card.uri;
          const img = document.createElement('img');
          img.src = card.image;
          img.alt = card.name || '';
          previewBox.setAttribute('aria-label', card.name || '');
          previewBox.replaceChildren(img);
          previewBox.classList.remove('stk-card-preview-loading');
          positionPreview(link);
          previewBox.hidden = false;
        } catch { if (activePreview === link) hidePreview(true); }
      }, 160);
    };
    link.addEventListener('mouseenter', show);
    link.addEventListener('focus', show);
    link.addEventListener('mouseleave', () => hidePreview());
    link.addEventListener('blur', () => hidePreview());
  }

  function request(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Request failed"));
        resolve(response.data);
      });
    });
  }

  if (settings.clipboard) await initClipboard();
  if ((platformFilterOn || settings.hideDigitalSets || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideNonEnglishPrints) && (/^\/sets\/?$/.test(location.pathname) || cardPage)) initSetFilter();
  if (cardPage && settings.tags) initTags();
  if (cardPage) initLegalities();
  if (cardPage && settings.finishBadges) initPrintFinishes();
  if (cardPage && settings.clipboard && settings.printAddButtons) initNativePrintButtons();
  // The grouped prints table is the extension's own rework of the card page, so
  // it can be switched off and Scryfall's own table stays untouched.
  if (cardPage && settings.printGrouping) initExpandedPrints();
  if (cardPage && (settings.edhrecUsage || settings.edhrecSalt)) initEdhrecStats();
  if (settings.onlyCardmarket) initPriceFilter();
  if (advancedPage) initAdvancedPriceFilter();
  if (advancedPage) initAdvancedSetFilter();
  if (cardPage && (settings.cardtraderPrices || settings.euroPriceSources !== 'cm')) initCardTrader();
  if (cardPage && settings.cardSearchLinks) initCardSearchLinks();
  if (cardPage && settings.cardNicknames) initCardNicknames();
  if (settings.taggerSearchLinks) initSearchTaggerLinks();
  if (settings.deckNoPrices) initDeckPriceOption();
  if (settings.stackedDeckCards) initStackedDeckCards();
  if (settings.deckTokens) initDeckTokens();

  function initSetFilter() {
    // Scryfall lists these curated online cubes under /cubes/, outside its
    // /sets API. Restrict this exception to the twelve online-only cubes.
    const onlineCubes = new Set(['apcube','arena','chromatic','livethedream','tinkerer','grixis','protour','vintage','uncommon','modern','legacy','twisted']);
    const needsSetIndex = settings.hideDigitalSets || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder;
    const categoriesRequest = needsSetIndex || platformFilterOn
      ? platformSetRequests().catch(() => ({categories: {digital: [], foreignBlackBorder: ['4bb', 'fbb', 'bchr']}, visible: () => true}))
      : Promise.resolve({categories: {digital: []}, visible: () => true});
    categoriesRequest
      .then(({categories, visible: setVisible}) => {
      if (!categories || !Array.isArray(categories.digital)) return;
      const hidden = new Set([
        ...(settings.hideDigitalSets ? categories.digital : []),
        ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
        ...(settings.hideOversizedSets ? categories.oversized || [] : []),
        ...(settings.hideForeignBlackBorder ? categories.foreignBlackBorder || ['4bb','fbb','bchr'] : [])
      ].map(code => code.toLowerCase()));
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
          row.classList.toggle('stk-digital-set-hidden', Boolean(set && (hidden.has(set.toLowerCase()) || !setVisible(set)) || settings.hideDigitalSets && cube && onlineCubes.has(cube.toLowerCase())));
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
          row.classList.toggle('stk-digital-set-hidden', Boolean(!row.classList.contains('current') &&
            (set && (hidden.has(set.toLowerCase()) || !setVisible(set)) || settings.hideNonEnglishPrints && foreignPrinting)));
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

  function initDeckTokens() {
    if (!/^\/@[^/]+\/decks\//.test(location.pathname)) return;
    const anchors = [...document.querySelectorAll('.deck-list-entry .deck-list-entry-name a, a.card-grid-item-card[href]')];
    const entries = [...new Map(anchors.map(a => {
      const path = new URL(a.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      return path && [path[1] + '/' + path[2], {set:path[1],collector_number:decodeURIComponent(path[2])}];
    }).filter(Boolean)).values()].slice(0,150);
    const place = document.querySelector('#main .sidebar') || document.querySelector('#main .deck-list')?.parentElement;
    if (!entries.length || !place) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button-n stk-token-button';
    button.textContent = language === 'ru' ? 'Показать токены' : 'Show Tokens';
    const dialog = document.createElement('dialog');
    dialog.id = 'stk-deck-tokens';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'button-n';
    close.textContent = t('Закрыть');
    close.addEventListener('click', () => dialog.close());
    const title = document.createElement('h2');
    title.textContent = t('Токены колоды');
    const content = document.createElement('div');
    content.className = 'stk-token-grid';
    dialog.append(title, close, content);
    document.body.append(dialog);
    let pending;
    button.addEventListener('click', async () => {
      dialog.showModal();
      if (!pending) {
        content.textContent = t('Загружаю токены…');
        pending = request({type:'deckTokens',entries}).catch(error => { pending = null; throw error; });
      }
      try {
        const tokens = await pending;
        content.replaceChildren();
        if (!tokens.length) { content.textContent = t('Токены не найдены.'); return; }
        for (const token of tokens) {
          const link = document.createElement('a');
          link.href = token.uri;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          const img = document.createElement('img');
          img.src = token.image;
          img.alt = token.name;
          img.loading = 'lazy';
          link.append(img);
          content.append(link);
        }
      } catch { content.textContent = t('Не удалось загрузить токены.'); }
    });
    place.prepend(button);
  }

  function initStackedDeckCards() {
    if (!document.querySelector('.deck-list')) return;
    const grid = document.querySelector('.card-grid');
    const cards = [...(grid?.querySelectorAll('.card-grid-item[data-card-id]') || [])];
    if (!cards.length) return;
    grid.classList.add('stk-stacked-deck');
    cards.at(-1).classList.add('stk-stacked-last');
  }

  function initCardNicknames() {
    const entry = window.STK_NICKNAMES?.find(item => item.setCode === identity.set && item.collectorNumber === identity.number);
    if (!entry) return;
    const parent = document.querySelector('#main .prints-info-section') || document.querySelector('#main .prints');
    if (!parent) return;
    const line = document.createElement('div');
    line.className = 'prints-info-section-note stk-card-nickname';
    line.textContent = `${entry.source}: “${entry.nickname.join(' // ')}”`;
    parent.append(line);
  }

  function initCardSearchLinks() {
    const typeLine = document.querySelector('#main .card-text-type-line');
    if (typeLine) {
      const indicator = typeLine.querySelector('.color-indicator');
      const text = typeLine.textContent.trim();
      const words = text.split(/(\s+|—)/);
      typeLine.replaceChildren();
      if (indicator) typeLine.append(indicator);
      for (const word of words) {
        if (!word.trim() || word === '—') { typeLine.append(document.createTextNode(word)); continue; }
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`type:${word.toLowerCase()}`)}`;
        link.textContent = word;
        typeLine.append(link);
      }
    }
    const cost = document.querySelector('#main .card-text-mana-cost');
    const symbols = [...(cost?.querySelectorAll('.card-symbol') || [])];
    if (cost && symbols.length) {
      const query = symbols.map(symbol => symbol.textContent.replace(/[{}]/g, '')).join('');
      if (query) {
        const link = document.createElement('a');
        link.href = `/search?q=${encodeURIComponent(`mana="${query}"`)}`;
        while (cost.firstChild) link.append(cost.firstChild);
        cost.append(link);
      }
    }
  }

  function initSearchTaggerLinks() {
    function scanTaggerLinks() { for (const item of document.querySelectorAll('.card-grid-item')) {
      if (item.querySelector('.stk-tagger-link')) continue;
      const link = item.querySelector('a.card-grid-item-card[href]');
      const match = link?.href && new URL(link.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!match) continue;
      const tagger = document.createElement('a');
      tagger.className = 'stk-tagger-link';
      tagger.href = `https://tagger.scryfall.com/card/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`;
      tagger.title = t('Открыть теги карты в Tagger');
      tagger.textContent = '◆';
      tagger.setAttribute('aria-label', tagger.title);
      item.append(tagger);
    } }
    scanTaggerLinks();
    new MutationObserver(scanTaggerLinks).observe(document.querySelector('#main') || document.body, { childList: true, subtree: true });
  }

  function initDeckPriceOption() {
    const select = document.querySelector('#with');
    if (!select) return;
    if (!select.querySelector('[value="no-prices"]')) {
      const option = document.createElement('option');
      option.value = 'no-prices';
      option.textContent = language === 'ru' ? 'Без цен' : 'No Prices';
      select.append(option);
    }
    const apply = () => {
      const hidden = select.value === 'no-prices';
      for (const node of document.querySelectorAll('.sidebar-prices,.deck-list-entry-axial-data')) {
        node.classList.toggle('stk-price-hidden', hidden);
      }
    };
    if (new URL(location.href).searchParams.get('with') === 'no-prices') select.value = 'no-prices';
    select.addEventListener('change', apply);
    apply();
  }

  function initCardTrader() {
    const id = document.querySelector('meta[name="scryfall:card:id"]')?.content ||
      document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
    const links = document.querySelector('#stores .toolbox-links');
    if (!id || !links) return;
    const sources = ['cm','ct','both'].includes(settings.euroPriceSources) ? settings.euroPriceSources : 'cm';
    const showTable = sources !== 'cm';
    const table = document.querySelector('#main .prints > .prints-table');
    const eurIndex = [...(table?.querySelectorAll('thead th') || [])].findIndex(th => th.textContent.trim().toUpperCase() === 'EUR');
    if (table && eurIndex >= 0) {
      const heading = table.querySelectorAll('thead th')[eurIndex];
      const nativeEurCells = [...table.querySelectorAll('tbody tr')].map(row => row.children[eurIndex]);
      if (sources === 'both') {
        heading.classList.add('stk-cm-price-header');
        heading.replaceChildren(priceHeading('cardmarket'));
        heading.title = t('Цены Cardmarket в евро');
      }
      if (sources === 'ct') {
        heading.classList.add('stk-price-hidden');
        for (const cell of nativeEurCells) cell?.classList.add('stk-price-hidden');
      }
      if (showTable) {
        const th = document.createElement('th');
        th.className = 'stk-ct-price-header';
        th.title = t('CardTrader: минимальное предложение для этого издания в евро');
        th.append(priceHeading('cardtrader'));
        heading.after(th);
        const rows = [...table.querySelectorAll('tbody tr')];
        const queue = [];
        for (const row of rows) {
          const cell = document.createElement('td');
          cell.className = 'stk-ct-price-cell';
          if (sources === 'both') row.children[eurIndex]?.classList.add('stk-cm-price-cell');
          row.children[eurIndex]?.after(cell);
          const print = row.querySelector('a[data-card-id]');
          const path = print?.href && new URL(print.href, location.href).pathname.match(/^\/card\/([^/]+)\//);
          if (path) { ctQueuedCells.add(cell); queue.push({ cell, id: print.dataset.cardId, set: path[1] }); }
        }
        // Start with the current printing. Remaining rows arrive gradually to respect the marketplace rate limit.
        queue.sort((a,b) => Number(b.id === id) - Number(a.id === id));
        queue.splice(75);
        const showEurFallback = () => {
          heading.classList.remove('stk-price-hidden');
          for (const row of table.querySelectorAll('tbody tr')) row.children[eurIndex]?.classList.remove('stk-price-hidden');
        };
        const fetchPrint = async print => {
          try {
            const result = await request({ type: 'cardtrader', id: print.id, set: print.set });
            const price = result.nonfoil?.currency === 'EUR' ? result.nonfoil : result.foil?.currency === 'EUR' ? result.foil : null;
            // A CardTrader account in another currency answers with a real
            // price in that currency, and the EUR column cannot use it. For the
            // printing being viewed that is the same as having nothing to show,
            // so the native EUR column comes back rather than leaving an empty
            // one where a price was expected.
            if (print.id === id && sources === 'ct' && (!result.available || !price)) showEurFallback();
            if (price) {
              const a = document.createElement('a');
              a.href = result.url;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.title = t('Минимальное предложение CardTrader; состояние и язык могут отличаться');
              a.textContent = new Intl.NumberFormat('en-IE', { style:'currency', currency:'EUR' }).format(price.cents / 100);
              print.cell.append(a);
            }
          } catch {
            print.cell.title = t('Цена CardTrader недоступна');
            if (print.id === id) {
              if (sources === 'ct') showEurFallback();
              return true;
            }
          }
          return false;
        };
        // One throttled queue shared with the expansion: rows that appear after
        // "View all prints" join the same request stream.
        let pumping = false;
        const pump = async () => {
          if (pumping) return;
          pumping = true;
          try {
            while (queue.length) { if (await fetchPrint(queue.shift())) break; }
          } finally { pumping = false; }
        };
        enqueueCardTraderPrint = (cell, cardId, set) => {
          if (ctQueuedCells.has(cell)) return;
          ctQueuedCells.add(cell);
          queue.push({ cell, id: cardId, set });
          pump();
        };
        pump();
      }
    }
    if (!settings.cardtraderPrices) return;
    request({ type: 'cardtrader', id, set: identity.set }).then(result => {
      if (!result.available) return;
      for (const [kind, price] of [['nonfoil',result.nonfoil],['foil',result.foil]]) {
        if (!price) continue;
        const row = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'button-n stk-cardtrader-link';
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const text = document.createElement('span');
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icons/cardtrader.svg');
        icon.alt = '';
        text.append(icon, document.createTextNode(` CardTrader${kind === 'foil' ? ' foil' : ''}`));
        const value = document.createElement('span');
        value.textContent = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency }).format(price.cents / 100);
        link.title = t('Минимальное предложение; состояние и язык могут отличаться');
        link.append(text, value);
        row.append(link);
        links.append(row);
      }
    }).catch(() => {
      const note = document.createElement('p');
      note.className = 'stk-cardtrader-error';
      note.textContent = t('CardTrader недоступен — проверь токен в настройках.');
      links.after(note);
    });
  }

  // Providers whose own published logo is used as it stands. Cardmarket puts its
  // marks up for download, black for light backgrounds and white for dark, and
  // this is that white one — so the dark theme blends its black backing away
  // rather than recolouring anyone's artwork.
  function brandLogoFiles(provider) {
    if (provider === 'cardmarket') {
      return { light: 'icons/cardmarket-black.png', dark: 'icons/cardmarket-white.png' };
    }
    return null;
  }

  function priceHeading(provider) {
    const wrapper = document.createElement('span');
    wrapper.className = 'stk-price-heading';
    const logo = brandLogoFiles(provider);
    if (logo) {
      for (const mode of ['light', 'dark']) {
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL(logo[mode]);
        icon.alt = '';
        icon.className = `stk-brand-logo stk-on-${mode}`;
        wrapper.append(icon);
      }
    } else {
      const icon = document.createElement('img');
      icon.src = chrome.runtime.getURL(`icons/${provider}.svg`);
      icon.alt = '';
      wrapper.append(icon);
    }
    wrapper.append(document.createTextNode('EUR'));
    return wrapper;
  }

  function initPriceFilter() {
    for (const table of document.querySelectorAll('#main .prints-table')) {
      const headers = [...table.querySelectorAll('thead th')];
      for (const [index, header] of headers.entries()) {
        if (!['USD', 'TIX'].includes(header.textContent.trim().toUpperCase())) continue;
        header.classList.add('stk-price-hidden');
        for (const row of table.querySelectorAll('tbody tr')) row.children[index]?.classList.add('stk-price-hidden');
      }
    }
    const stores = document.querySelector('#stores');
    for (const link of stores?.querySelectorAll('a[href]') || []) {
      let host;
      try { host = new URL(link.href).hostname; } catch { continue; }
      if (!/(^|\.)(tcgplayer\.com|cardhoarder\.com)$/.test(host)) continue;
      link.classList.add('stk-price-hidden');
    }
    for (const row of stores?.querySelectorAll('.toolbox-links li') || []) {
      const links = [...row.querySelectorAll('a[href]')];
      if (links.length && links.every(link => link.classList.contains('stk-price-hidden'))) row.classList.add('stk-price-hidden');
    }
    stores?.querySelector('.toolbox-disclaimer')?.classList.add('stk-price-hidden');
    if (/^\/(?:@[^/]+\/decks\/|decks\/)/.test(location.pathname)) {
      for (const control of document.querySelectorAll('#main .sidebar-toolbox :is(a,button)')) {
        if (/^Buy on (?:TCGplayer|Cardhoarder)\b/i.test(control.textContent.trim())) control.classList.add('stk-price-hidden');
      }
    }
  }

  function initAdvancedPriceFilter() {
    if (!settings.onlyCardmarket) return;
    // The Prices filter on /advanced offers USD, Euros and MTGO Tickets per row.
    // With dollar and ticket columns hidden, only the Cardmarket (EUR) search
    // still makes sense, so the other currencies are dropped and Euros renamed.
    const isCurrency = select => select.name && select.name.startsWith('price_') && !select.name.endsWith('_mode');
    const relabel = select => {
      if (select.dataset.stkPriceFiltered) return;
      select.dataset.stkPriceFiltered = '1';
      for (const option of [...select.querySelectorAll('option')]) {
        if (option.value === 'usd' || option.value === 'tix') option.remove();
        else if (option.value === 'eur') option.textContent = 'Cardmarket (€)';
      }
    };
    for (const select of document.querySelectorAll('select[name^="price_"]')) {
      if (isCurrency(select)) relabel(select);
    }
    // Adding another price row duplicates the template, which is caught here.
    new MutationObserver(mutations => {
      for (const mutation of mutations) for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        for (const select of (node.matches?.('select[name^="price_"]') ? [node] : node.querySelectorAll?.('select[name^="price_"]') || [])) {
          if (isCurrency(select)) relabel(select);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
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

  function initEdhrecStats() {
    const legality = document.querySelector('#main .card-text .card-legality');
    const name = [...document.querySelectorAll('#main .card-text-card-name')]
      .map(node => node.textContent.trim()).filter(Boolean).join(' // ');
    if (!legality || !name || document.getElementById('stk-edhrec')) return;
    request({ type: 'edhrec', name }).then(stats => {
      const hasUsage = settings.edhrecUsage && Number.isFinite(stats.numDecks) &&
        Number.isFinite(stats.potentialDecks) && stats.potentialDecks > 0;
      const hasSalt = settings.edhrecSalt && Number.isFinite(stats.salt);
      if (!hasUsage && !hasSalt) return;
      const panel = document.createElement('div');
      panel.id = 'stk-edhrec';
      panel.className = 'stk-edhrec-rows';
      if (!settings.edhrecLink) panel.classList.add('stk-no-source');
      let source;
      if (settings.edhrecLink) {
        source = document.createElement('a');
        source.href = stats.url;
        source.target = '_blank';
        source.rel = 'noopener noreferrer';
        source.className = 'stk-edhrec-source';
        const logo = document.createElement('img');
        logo.src = chrome.runtime.getURL('icons/edhrec.png');
        logo.alt = 'EDHREC';
        source.append(logo);
        source.title = t('Открыть статистику карты на EDHREC');
      }
      if (hasUsage) {
        const usage = document.createElement('div');
        usage.className = 'stk-edhrec-item stk-edhrec-usage';
        const label = document.createElement('span');
        label.className = 'stk-edhrec-label';
        label.textContent = t('В колодах');
        const display = ['fraction','percent','both'].includes(settings.edhrecUsageDisplay) ? settings.edhrecUsageDisplay : 'both';
        const number = new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US');
        const percent = `${new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(stats.numDecks / stats.potentialDecks * 100)}%`;
        const value = document.createElement('span');
        value.className = 'stk-edhrec-value stk-stat-badge';
        const metric = settings.usageColorMetric === 'percent' ? 'percent' : 'decks';
        const actual = metric === 'percent' ? stats.numDecks / stats.potentialDecks * 100 : stats.numDecks;
        const medium = Number(settings[metric === 'percent' ? 'usageMediumPercent' : 'usageMediumDecks']);
        const high = Number(settings[metric === 'percent' ? 'usageHighPercent' : 'usageHighDecks']);
        const valid = Number.isFinite(medium) && Number.isFinite(high) && medium >= 0 && high > medium;
        const lowBoundary = valid ? medium : metric === 'percent' ? 1 : 50000;
        const highBoundary = valid ? high : metric === 'percent' ? 2.6 : 100000;
        const tier = actual >= highBoundary ? 'high' : (metric === 'decks' ? actual >= lowBoundary : actual > lowBoundary) ? 'medium' : 'low';
        value.classList.add(`stk-usage-${tier}`);
        let fraction;
        if (display !== 'percent') {
          fraction = document.createElement('span');
          fraction.className = 'stk-edhrec-fraction';
          const numerator = document.createElement('span');
          numerator.textContent = number.format(stats.numDecks);
          const denominator = document.createElement('span');
          denominator.textContent = number.format(stats.potentialDecks);
          fraction.append(numerator, denominator);
          if (display === 'fraction') value.append(fraction);
        }
        if (display !== 'fraction') {
          const percentage = document.createElement('span');
          percentage.className = 'stk-edhrec-percent';
          percentage.textContent = percent;
          value.append(percentage);
        }
        value.title = language === 'ru' ? `${number.format(stats.numDecks)} из ${number.format(stats.potentialDecks)} подходящих по цветовой идентичности колод EDHREC (${percent})` : `${number.format(stats.numDecks)} of ${number.format(stats.potentialDecks)} color-identity-eligible EDHREC decks (${percent})`;
        if (source) label.append(source);
        usage.append(value, label);
        if (display === 'both') usage.append(fraction);
        panel.append(usage);
      }
      if (hasSalt) {
        const item = document.createElement('div');
        item.className = 'stk-edhrec-item stk-edhrec-salt';
        const label = document.createElement('span');
        label.className = 'stk-edhrec-label';
        label.textContent = 'Salt Meter';
        const salt = document.createElement('span');
        const medium = Number(settings.saltMediumThreshold);
        const high = Number(settings.saltHighThreshold);
        const valid = Number.isFinite(medium) && Number.isFinite(high) && medium >= 0 && high > medium && high <= 4;
        const tier = stats.salt >= (valid ? high : 2) ? 'high' : stats.salt >= (valid ? medium : 1) ? 'medium' : 'low';
        salt.className = `stk-salt-meter stk-stat-badge stk-salt-${tier}`;
        salt.textContent = stats.salt.toFixed(2) + (settings.showSaltScale ? ' / 4' : '');
        salt.title = t('Средняя оценка раздражающего эффекта карты по опросу EDHREC; не мера силы карты');
        if (source) label.append(source);
        item.append(salt, label);
        panel.append(item);
      }
      legality.append(panel);
      legality.hidden = false;
      // The panel's two columns have to sit exactly under the two status
      // columns of the legality block above. Those columns are content-sized,
      // so the few-pixel offset depends on the format names, the column width
      // and the browser zoom: it is measured instead of hard-coded.
      realignStatsPanel = () => {
        const salt = panel.querySelector('.stk-edhrec-salt');
        const meter = panel.querySelector('.stk-salt-meter');
        if (!salt || !meter) return;
        salt.style.marginLeft = '0px';
        const pills = [...legality.querySelectorAll('.card-legality-item dd')];
        const target = meter.getBoundingClientRect().left;
        let best = null;
        let bestGap = Infinity;
        for (const pill of pills) {
          const gap = Math.abs(pill.getBoundingClientRect().left - target);
          if (gap < bestGap) { bestGap = gap; best = pill; }
        }
        if (best && bestGap < 40) {
          salt.style.marginLeft = `${best.getBoundingClientRect().left - target}px`;
        }
      };
      realignStatsPanel();
      let realignTimer;
      addEventListener('resize', () => {
        clearTimeout(realignTimer);
        realignTimer = setTimeout(realignStatsPanel, 120);
      }, { passive: true });
    }).catch(() => {});
  }

  function initPrintFinishes() {
    const table = document.querySelector('#main .prints > .prints-table');
    const printLinks = [...(table?.querySelectorAll('tbody tr td:first-child a[data-card-id]') || [])];
    const ids = [...new Set(printLinks.map(link => link.dataset.cardId))];
    if (!ids.length || ids.length > 75) return;
    finishesSettled = request({ type: 'finishes', ids }).then(byId => {
      const marked = [];
      for (const link of printLinks) {
        const entry = byId[link.dataset.cardId];
        const finishes = Array.isArray(entry) ? entry : entry?.finishes;
        if (!Array.isArray(finishes)) continue;
        const special = entry?.promoTypes?.find(type => /^(surgefoil|textured|galaxyfoil|confettifoil|fracturefoil|halofoil|gilded|rainbowfoil|cosmicfoil)$/.test(type));
        const kind = special && finishes.length === 1 && finishes.includes('foil') ? 'special' : finishes.length === 1 ? finishes[0] : null;
        if (!['foil','nonfoil','etched','special'].includes(kind)) continue;
        // Scryfall already prints ★ in a foil-only collector number.
        if (kind === 'foil' && /★|✶/.test(link.textContent)) continue;
        marked.push({ link, kind, special });
      }
      if (!marked.length || !table || table.querySelector('.stk-finish-header')) return;
      const header = document.createElement('th');
      header.className = 'stk-finish-header';
      header.title = t('Отделка выпуска');
      header.setAttribute('aria-label', header.title);
      table.querySelector('thead th')?.after(header);
      const byLink = new Map(marked.map(item => [item.link, item]));
      for (const link of printLinks) {
        const cell = document.createElement('td');
        cell.className = 'stk-finish-cell';
        link.closest('tr')?.children[0]?.after(cell);
        const item = byLink.get(link);
        if (!item) continue;
        const badge = document.createElement('span');
        badge.className = `stk-finish-badge stk-finish-${item.kind}`;
        badge.title = item.kind === 'special' ? (language === 'ru' ? `Особый фойл: ${item.special}` : `Special foil: ${item.special}`) : t({ foil:'Только Foil', nonfoil:'Только Nonfoil', etched:'Только Etched Foil' }[item.kind]);
        badge.setAttribute('aria-label', badge.title);
        badge.textContent = { foil:'✶', nonfoil:'○', etched:'◈', special:'✧' }[item.kind];
        cell.append(badge);
      }
      // Scryfall marks a foil-only printing with a star inside the price cells.
      // The finish column already says it, so the star is dropped there.
      for (const price of table.querySelectorAll('td .currency-usd, td .currency-usd-promo, td .currency-eur, td .currency-tix')) {
        const textNode = [...price.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
        if (textNode) textNode.textContent = textNode.textContent.replace(/^[\s✶★]+/, '');
      }
    }).catch(() => {});
  }

  function initExpandedPrints() {
    const foldGroups = settings.printFoldGroups !== false;
    const withPageLink = settings.printFullPageLink !== false;
    const table = document.querySelector('#main .prints > .prints-table');
    const native = document.querySelector('#main .prints .prints-all a') ||
      [...(table?.querySelectorAll('a[href]') || [])].find(link => /^(?:view all prints|показать все издания)/i.test(link.textContent.trim()));
    const tbody = table?.querySelector('tbody');
    if (!native || !tbody || table.dataset.stkPrints) return;
    table.dataset.stkPrints = '1';
    // The native link is hijacked to expand in place, so the real full page
    // keeps a permanent sibling on the same line.
    const nativeRow = native.closest('tr');
    const nativeLabel = native.textContent;
    // "Open on a new page" can become "Open on this page", which also stops the
    // link from opening a new tab.
    const sameTab = Boolean(settings.printPageSameTab);
    const pageLink = document.createElement('a');
    pageLink.className = 'stk-print-new-page';
    pageLink.href = native.getAttribute('href');
    if (!sameTab) {
      pageLink.target = '_blank';
      pageLink.rel = 'noopener noreferrer';
    }
    // The line only exists for the pair; without the full-page link the native
    // expand link stays exactly where Scryfall put it.
    const pageLine = document.createElement('span');
    pageLine.className = 'stk-print-new-page-line';
    if (withPageLink) {
      native.parentNode?.insertBefore(pageLine, native);
      pageLine.append(native, pageLink);
    }
    table.classList.toggle('stk-fold-groups', foldGroups);
    const openPageLabel = () => language === 'ru'
      ? (sameTab ? 'Открыть на этой странице' : 'Открыть на новой странице')
      : (sameTab ? 'Open on this page' : 'Open on a new page');
    const fullPageLabel = () => language === 'ru'
      ? (sameTab ? 'Все издания на этой странице' : 'Все издания на новой странице →')
      : (sameTab ? 'View all prints on this page' : 'View all prints on a new page →');
    const expandLabel = () => language === 'ru' ? 'Развернуть все группы' : 'Expand all groups';
    const collapseLabel = () => language === 'ru' ? 'Свернуть все группы' : 'Collapse all groups';
    const fewerLabel = language === 'ru' ? 'Показать меньше изданий ↑' : 'Show fewer prints ↑';
    const headCells = () => [...(table.querySelector('thead')?.querySelectorAll('th') || [])];
    const columns = () => headCells().length || 1;
    const statusRow = text => {
      const row = document.createElement('tr');
      row.className = 'stk-print-status stk-print-extra';
      const cell = document.createElement('td');
      cell.colSpan = columns();
      cell.textContent = text;
      row.append(cell);
      return row;
    };
    let builtGroups = new Map();
    let truncatedResult = false;
    let extraRows = [];
    let collapsibleRows = [];
    let loaded = false;
    let showingAll = false;
    // Each group remembers whether the user folded it, so regrouping never
    // changes a group's state behind their back.
    const groupFolded = new Map();
    let placedUnits = [];
    let totalUnits = 0;
    let defaultFolded = true;
    // Where every printing sits in the API answer (newest first), so native rows
    // and added ones can share one order.
    let printIndex = new Map();
    let printNewestFirst = true;
    // Everything added here goes in front of the View-all line, so the line
    // itself ends up as the last row of the table.
    const insertAtEnd = node => tbody.insertBefore(node, nativeRow && nativeRow.parentNode === tbody ? nativeRow : null);
    const clearExtra = () => {
      for (const row of extraRows) row.remove();
      extraRows = [];
      for (const row of collapsibleRows) row.hidden = false;
      collapsibleRows = [];
      for (const row of document.querySelectorAll('#main .prints > .prints-table tr.stk-group-end')) {
        row.classList.remove('stk-group-end');
      }
      // Rows inside a group show the bare collector number; Scryfall's own text
      // comes back when the table is regrouped without that group.
      for (const link of document.querySelectorAll('#main .prints > .prints-table a[data-stk-label]')) {
        link.textContent = link.dataset.stkLabel;
        delete link.dataset.stkLabel;
      }
      // Printings the window skipped are back on the page while the next
      // placement decides where each of them belongs.
      for (const row of tbody.querySelectorAll('tr[hidden]')) row.hidden = false;
    };
    // Fetches the complete print list once; the default view groups it too, so
    // the ten-entry cap covers the whole card, not only Scryfall's subset.
    const loadPrints = async () => {
      if (loaded) return;
      let oracleId = document.querySelector('meta[name="scryfall:oracle:id"]')?.content;
      if (!oracleId) {
        const id = document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
        if (!id) throw new Error('Card identity unavailable');
        oracleId = (await request({type:'card', id})).oracle_id;
      }
      const {prints, truncated} = await request({type:'allPrints', oracleId});
      const needsCategories = platformFilterOn || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideDigitalSets;
      // The platform index only says which client carries a digital set, so the
      // set index is what tells the two apart.
      const [categories, platforms] = needsCategories
        ? await Promise.all([
          request({type:'setCategories'}).catch(() => ({})),
          platformFilterOn ? request({type:'setPlatforms'}).catch(() => ({})) : Promise.resolve({})
        ])
        : [{}, {}];
      const platformVisible = platformFilterOn ? platformSetVisible(categories, platforms) : () => true;
      const excluded = new Set([
        ...(settings.hideDigitalSets ? categories.digital || [] : []),
        ...(settings.hideNonTournamentSets ? categories.nonTournament || [] : []),
        ...(settings.hideOversizedSets ? categories.oversized || [] : []),
        ...(settings.hideForeignBlackBorder ? categories.foreignBlackBorder || [] : [])
      ]);
      const groups = new Map();
      for (const card of prints) {
        if (excluded.has(card.set) || settings.hideDigitalSets && card.digital ||
            !platformVisible(card.set) ||
            settings.hideNonEnglishPrints && card.lang !== 'en') continue;
        const group = groups.get(card.set) || [];
        group.push(card);
        groups.set(card.set, group);
      }
      // The API answers newest first. Scryfall's own rows reveal the page's print
      // preference: the same order as the API means newest first, the opposite
      // order means oldest first. That reads the page itself rather than dates,
      // so it holds for any set order Scryfall uses.
      const apiIndex = new Map();
      let position = 0;
      for (const cards of groups.values()) {
        for (const card of cards) apiIndex.set(printKey(card.set, card.number), position++);
      }
      printIndex = apiIndex;
      const nativePositions = [];
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row === nativeRow) continue;
        const identity = rowSet(row);
        const index = identity && apiIndex.get(printKey(identity.set, identity.number));
        if (index !== undefined) nativePositions.push(index);
      }
      let inversions = 0;
      for (let index = 1; index < nativePositions.length; index++) {
        if (nativePositions[index] < nativePositions[index - 1]) inversions++;
      }
      const newestFirst = nativePositions.length < 2 || inversions * 2 <= nativePositions.length - 1;
      printNewestFirst = newestFirst;
      const byApi = (a, b) => (apiIndex.get(printKey(a.set, a.number)) ?? 0) - (apiIndex.get(printKey(b.set, b.number)) ?? 0);
      const compare = newestFirst ? byApi : (a, b) => -byApi(a, b);
      const ordered = new Map([...groups.entries()]
        .sort((a, b) => compare(a[1][0], b[1][0]))
        .map(([set, cards]) => [set, cards.slice().sort(compare)]));
      // The Finish column header is added by a separate response; wait for
      // it so column spans and cell indexes match the settled header row.
      await finishesSettled;
      builtGroups = buildRows(ordered);
      truncatedResult = !!truncated;
      loaded = true;
    };
    native.setAttribute('aria-expanded', 'false');
    native.addEventListener('click', async event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      // One link, three jobs: fold the table back, reveal the printings behind
      // the cap, or unfold every group when there is nothing left to reveal.
      if (showingAll) {
        showingAll = false;
        placeGroups();
        return;
      }
      if (totalUnits > 10) {
        if (!loaded) {
          const status = statusRow(language === 'ru' ? 'Загружаю издания…' : 'Loading printings…');
          insertAtEnd(status);
          try { await loadPrints(); status.remove(); }
          catch {
            status.querySelector('td').textContent =
              language === 'ru' ? 'Не удалось загрузить издания. Откройте отдельную страницу.' : 'Could not load printings. Open the separate page.';
            return;
          }
        }
        showingAll = true;
        placeGroups();
        return;
      }
      // Nothing left to reveal: fold or unfold every group in one go.
      const grouped = placedUnits.filter(unit => unit.grouped);
      const anyFolded = grouped.some(unit => groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded);
      for (const unit of grouped) groupFolded.set(unit.set, !anyFolded);
      placeGroups();
    });
    // The default view is already grouped from the complete print list.
    (async () => {
      await finishesSettled;
      try { await loadPrints(); } catch { /* the click still offers the full page */ }
      placeGroups();
    })();

    const rowSet = row => {
      const link = row.querySelector('td:first-child a[href]');
      let match = null;
      try { match = link && new URL(link.href, location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/); } catch { match = null; }
      return match ? { set: match[1].toLowerCase(), number: decodeURIComponent(match[2]) } : null;
    };
    // Scryfall puts the collector number on its own line inside the link and
    // marks a foil-only printing with a star, so the whitespace is collapsed and
    // both the number and the star are cut off.
    const setNameOf = row => (row.querySelector('td:first-child a[href]')?.textContent || '')
      .replace(/\s+/g, ' ').trim().replace(/\s*#.*$/, '').replace(/[\s✶★]+$/, '').trim();
    const normName = name => String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const baseName = name => normName(name).replace(/\s+promos?$/, '');
    // A star never belongs in a set name: the finish column already says it.
    const cleanSetName = name => String(name || '').replace(/[\s✶★]+/g, ' ').replace(/\s+/g, ' ').trim();
    // The API and the row link keep the star inside the collector number itself
    // ("67★" is a foil-only printing), so it is cut off whenever a number is shown.
    const cleanNumber = number => String(number || '').replace(/\s*[✶★]+\s*$/, '').trim();
    // A lone printing keeps Scryfall's own wording, star included, so the star
    // that trails its collector number is cut here as well.
    const cleanRowLabel = label => String(label || '')
      .replace(/\s+/g, ' ').trim()
      .replace(/(\s*#\s*[^\s★✶]+)\s*[★✶]+/g, '$1')
      .replace(/\s*[★✶]+$/, '').trim();
    const groupHead = (setName, set, count) => {
      const head = document.createElement('tr');
      head.className = 'stk-print-group-row stk-print-extra';
      const cell = document.createElement('td');
      cell.colSpan = columns();
      // A span inside the cell mirrors Scryfall's own first-column markup, so
      // the native padding, alignment and single-line rhythm apply unchanged.
      const label = document.createElement('span');
      label.textContent = `${cleanSetName(setName)} (${set.toUpperCase()}) · ${count}`;
      cell.append(label);
      head.append(cell);
      return head;
    };
    const wireGroup = (head, rows, set) => {
      collapsibleRows.push(...rows);
      const setCollapsed = collapsed => {
        head.classList.toggle('stk-group-collapsed', collapsed);
        // A folded group ends at its own header, an open one at its last row.
        head.classList.toggle('stk-group-folded-end', collapsed);
        for (const row of rows) row.hidden = collapsed;
      };
      if (!foldGroups) return;
      // Groups start folded, unless the whole table fits into ten rows anyway.
      setCollapsed(groupFolded.has(set) ? groupFolded.get(set) : defaultFolded);
      head.addEventListener('click', () => {
        const collapsed = !head.classList.contains('stk-group-collapsed');
        groupFolded.set(set, collapsed);
        setCollapsed(collapsed);
        updateLine();
      });
    };
    // The line at the bottom of the table offers whatever is still worth
    // pressing: more printings, groups to unfold, or nothing but the full page.
    function updateLine() {
      const grouped = placedUnits.filter(unit => unit.grouped);
      const folded = grouped.filter(unit => groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded);
      let left = showingAll ? fewerLabel : totalUnits > 10 ? nativeLabel : '';
      if (!left && foldGroups && grouped.length) left = folded.length ? expandLabel() : collapseLabel();
      native.hidden = !left;
      native.textContent = left;
      const bare = !left;
      if (withPageLink) {
        pageLink.textContent = bare ? fullPageLabel() : openPageLabel();
        pageLine.classList.toggle('stk-print-line-end', bare);
      }
      const open = showingAll || grouped.some(unit => !(groupFolded.has(unit.set) ? groupFolded.get(unit.set) : defaultFolded));
      table.classList.toggle('stk-prints-expanded', open);
      native.setAttribute('aria-expanded', String(open));
    }
    // A promo set belongs to its parent set: "Ixalan Promos" shares the group of
    // "Ixalan", and only its own code tells the two apart inside the group.
    function mergePromoUnits(units) {
      const merged = [];
      for (const unit of units) {
        const index = merged.findIndex(other =>
          other.setName !== unit.setName && baseName(other.setName) === baseName(unit.setName));
        if (index < 0) { merged.push(unit); continue; }
        const target = merged[index];
        // The parent set keeps the group's name and code even when the promo
        // printing was met first.
        if (normName(unit.setName) === baseName(unit.setName) && normName(target.setName) !== baseName(target.setName)) {
          target.setName = unit.setName;
          target.set = unit.set;
        }
        target.sets = [...new Set([...target.sets, ...unit.sets])];
        target.nativeRows = [...target.nativeRows, ...unit.nativeRows];
        target.added = [...target.added, ...unit.added];
      }
      return merged;
    }
    // One set is one group: the printings Scryfall already lists and the ones
    // added here share a single header, so two printings of one set (for
    // example #304 and #304★) end up under the same group instead of apart. The
    // grouping is already in place before "View all prints" is pressed, and a
    // long print list keeps the first ten entries of the closed table (a closed
    // group counts as one); the rest stays behind the full-page link.
    function placeGroups() {
      clearExtra();
      const nativeGroups = new Map();
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row === nativeRow) continue;
        const identity = rowSet(row);
        if (!identity) continue;
        if (!nativeGroups.has(identity.set)) nativeGroups.set(identity.set, []);
        nativeGroups.get(identity.set).push(row);
      }
      const units = [];
      for (const [set, nativeSetRows] of nativeGroups) {
        const extra = builtGroups.get(set);
        const added = extra ? extra.rows : [];
        // Even a set with a single printing joins the list: it may still be the
        // parent a promo set has to be merged into.
        units.push({
          set, sets: [set], setName: extra?.setName || setNameOf(nativeSetRows[0]),
          nativeRows: nativeSetRows, added, grouped: nativeSetRows.length + added.length > 1
        });
      }
      for (const [set, extra] of builtGroups) {
        if (nativeGroups.has(set)) continue;
        units.push({
          set, sets: [set], setName: extra.setName, nativeRows: [],
          added: extra.rows, grouped: extra.rows.length > 1
        });
      }
      // After a promo merge the set holds more than one printing, so it earns a
      // header even when one side arrived as a single native row.
      const merged = mergePromoUnits(units)
        .map(unit => ({ ...unit, grouped: unit.nativeRows.length + unit.added.length > 1 }));
      // Native rows take part in the order like any other printing: the whole
      // table reads as one list in the direction the page itself uses, with the
      // rows Scryfall renders where their release date puts them.
      const rowRank = row => {
        const identity = rowSet(row);
        const rank = identity && printIndex.get(printKey(identity.set, identity.number));
        return rank === undefined ? Infinity : rank;
      };
      const unitRank = unit => Math.min(...[...unit.nativeRows, ...unit.added].map(rowRank));
      merged.sort((a, b) => {
        const left = unitRank(a);
        const right = unitRank(b);
        if (left === right) return 0;
        return (left < right ? -1 : 1) * (printNewestFirst ? 1 : -1);
      });
      totalUnits = merged.length;
      // A card whose printings all fit into ten rows has nothing to fold away,
      // so its groups start open.
      defaultFolded = merged.reduce((sum, unit) => sum + unit.nativeRows.length + unit.added.length, 0) > 10;
      // Ten entries fit on the page (a closed group counts as one). Scryfall
      // keeps the printing being viewed on screen, so the window is taken around
      // its group instead of from the top.
      const cap = 10;
      let start = 0;
      if (!showingAll && totalUnits > cap) {
        const currentRow = tbody.querySelector('tr.current');
        const at = currentRow ? merged.findIndex(unit => unit.nativeRows.includes(currentRow)) : -1;
        start = at < 0 ? 0 : Math.max(0, Math.min(at - 4, totalUnits - cap));
      }
      placedUnits = showingAll ? merged : merged.slice(start, start + cap);
      const sequence = [];
      for (const unit of placedUnits) {
        // Inside a group the set name lives in the header, so every row there
        // shows the bare collector number; a lone printing repeats the set name.
        const all = [...unit.nativeRows, ...unit.added];
        for (const row of all) {
          const link = row.querySelector('td:first-child a[href]');
          if (!link) continue;
          if (unit.grouped) {
            const identity = rowSet(row);
            // Scryfall's own wording is kept aside so regrouping can restore it.
            if (identity && link.dataset.stkLabel === undefined) link.dataset.stkLabel = link.textContent;
            const code = identity && identity.set !== unit.set ? ` (${identity.set.toUpperCase()})` : '';
            link.textContent = row.stkShortLabel
              ? `${row.stkShortLabel}${code}`
              : `#${identity ? cleanNumber(identity.number) : ''}${code}`;
          } else {
            link.textContent = cleanRowLabel(row.stkFullLabel || link.textContent);
          }
        }
        if (unit.grouped) {
          const head = groupHead(unit.setName, unit.set, all.length);
          // The set of the card being viewed gets a light accent so it is easy
          // to find among the other groups.
          if (unit.nativeRows.some(row => row.classList.contains('current'))) head.classList.add('stk-current-group');
          wireGroup(head, all, unit.set);
          extraRows.push(head);
          sequence.push(head);
        }
        sequence.push(...all);
        for (const row of unit.added) {
          // The CardTrader queue only ever sees the rows that made it into the
          // table, so the printings behind the ten-entry cap cost no requests.
          row.stkEnqueueCT?.();
        }
        extraRows.push(...unit.added);
        // A light rule under the group's last row tells the grouped printings
        // apart from the ones that stand on their own.
        if (unit.grouped && all.length) {
          const last = all[all.length - 1];
          last.classList.add('stk-group-end');
          collapsibleRows.push(last);
        }
      }
      // The whole body is moved into the chosen order, Scryfall's own rows
      // included, so the table reads as one list from top to bottom.
      for (const row of sequence) insertAtEnd(row);
      // Printings the window skipped wait off screen until "View all prints"
      // brings the whole list in.
      for (const row of [...tbody.querySelectorAll('tr:not(.stk-print-extra)')]) {
        if (row !== nativeRow && !sequence.includes(row)) row.hidden = true;
      }
      if (truncatedResult) {
        const notice = statusRow(language === 'ru' ? 'Часть изданий не загрузилась; откройте полную страницу.' : 'More printings are available on the full page.');
        insertAtEnd(notice);
        extraRows.push(notice);
      }
      updateLine();
    }

    // Rows are inserted into Scryfall's own prints table so the expansion stays
    // part of the original Prints section instead of a detached panel. One set
    // is one group, so the headers are built in placeGroups().
    function buildRows(groups) {
      const total = columns();
      const heads = headCells();
      const finishIdx = heads.findIndex(th => th.classList.contains('stk-finish-header'));
      const usdIdx = heads.findIndex(th => /^usd/i.test(th.textContent.trim()));
      const eurIdx = heads.findIndex(th => /^eur/i.test(th.textContent.trim()));
      const tixIdx = heads.findIndex(th => /^tix/i.test(th.textContent.trim()));
      const setIdx = heads.findIndex(th => /^set$/i.test(th.textContent.trim()));
      const ctIdx = heads.findIndex(th => th.classList.contains('stk-ct-price-header'));
      // Columns the price filter or the CardTrader switch already hid must stay
      // hidden in rows that are created after those settings were applied.
      const hiddenIdx = new Set(heads.map((th, i) => th.classList.contains('stk-price-hidden') ? i : -1).filter(i => i >= 0));
      const euroSources = ['cm', 'ct', 'both'].includes(settings.euroPriceSources) ? settings.euroPriceSources : 'cm';
      const fillPrice = (cell, text, currency) => {
        if (!text) return;
        const span = document.createElement('span');
        span.className = `price currency-${currency}`;
        span.textContent = text;
        cell.append(span);
      };
      const priceText = (card, key, foilKey, symbol) =>
        card.prices?.[key] ? `${symbol}${card.prices[key]}`
          : card.prices?.[foilKey] ? `${symbol}${card.prices[foilKey]}` : '';
      const path = uri => {
        try { return new URL(uri, location.href).pathname.replace(/\/+$/, ''); }
        catch { return ''; }
      };
      const nativeHrefs = new Set(
        [...tbody.querySelectorAll('tr:not(.stk-print-extra) td:first-child a[href]')].map(link => path(link.href)).filter(Boolean)
      );
      const built = new Map();
      for (const cards of groups.values()) {
        // Printings already listed by the native table are skipped so the
        // expansion only adds what is missing.
        const entries = cards.filter(card => !nativeHrefs.has(path(card.uri)));
        if (!entries.length) continue;
        const group = { setName: cards[0].setName, rows: [] };
        for (const card of entries) {
          const row = document.createElement('tr');
          row.className = 'stk-print-entry stk-print-extra';
          const number = `#${cleanNumber(card.number)}${card.lang !== 'en' ? ` · ${card.lang.toUpperCase()}` : ''}`;
          // Under a group header the set name would repeat on every row, so the
          // bare number is used there and the full label outside groups.
          row.stkShortLabel = number;
          row.stkFullLabel = `${cards[0].setName} ${number}`;
          for (let i = 0; i < total; i++) {
            const cell = document.createElement('td');
            if (i === 0) {
              const link = document.createElement('a');
              link.href = path(card.uri);
              link.textContent = number;
              cell.append(link);
              // The printing's own art comes with the print list, so the hover
              // preview needs no extra request.
              if (card.image) enablePreview(link, async () => ({ image: card.image, name: card.name, uri: link.href }));
              attachPrintButton(cell, printKey(card.set, card.number), card,
                language === 'ru' ? 'Добавить конкретное издание с кодом сета в буфер' : 'Add this printing with its set code to the clipboard');
            } else if (i === finishIdx) {
              // One glyph only: a printing with several finishes gets no badge,
              // exactly like Scryfall's own rows.
              const glyphs = { nonfoil: '○', foil: '✶', etched: '◈' };
              const text = (card.finishes || []).length === 1 ? glyphs[card.finishes[0]] || '' : '';
              if (text) {
                cell.className = 'stk-finish-cell';
                const badge = document.createElement('span');
                badge.className = 'stk-finish-badge';
                badge.textContent = text;
                badge.title = (card.finishes || []).join(' / ');
                cell.append(badge);
              }
            } else if (i === setIdx) {
              const span = document.createElement('span');
              span.textContent = card.set.toUpperCase();
              cell.append(span);
            } else if (i === ctIdx) {
              cell.className = 'stk-ct-price-cell';
              // Same throttled background queue that fills the native rows, but
              // only once the row is actually placed in the table.
              row.stkEnqueueCT = () => {
                if (!cell.querySelector('a')) enqueueCardTraderPrint?.(cell, card.id, card.set);
              };
            } else if (i === usdIdx || i === eurIdx || i === tixIdx) {
              if (i === usdIdx) fillPrice(cell, priceText(card, 'usd', 'usd_foil', '$'), 'usd');
              else if (i === eurIdx) {
                fillPrice(cell, priceText(card, 'eur', 'eur_foil', '€'), 'eur');
                if (euroSources === 'both') cell.classList.add('stk-cm-price-cell');
              } else fillPrice(cell, priceText(card, 'tix', 'tix', ''), 'tix');
            }
            if (hiddenIdx.has(i)) cell.classList.add('stk-price-hidden');
            row.append(cell);
          }
          group.rows.push(row);
        }
        built.set(cards[0].set.toLowerCase(), group);
      }
      return built;
    }
  }

  function initNativePrintButtons() {
    const name = [...document.querySelectorAll('#main .card-text-card-name')].map(node => node.textContent.trim()).filter(Boolean).join(' // ');
    if (!name) return;
    for (const row of document.querySelectorAll('#main .prints > .prints-table tbody tr')) {
      const cell = row.querySelector('td:first-child');
      // The View-all line spans the whole table and is not a printing.
      if (!cell || cell.colSpan > 1) continue;
      const link = cell.querySelector('a[href^="/card/"],a[href^="https://scryfall.com/card/"]');
      const parts = link && new URL(link.href,location.href).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
      if (!parts) continue;
      const set = parts[1];
      const number = decodeURIComponent(parts[2]);
      attachPrintButton(cell, printKey(set, number), { name, uri: link.href, set, number },
        language === 'ru' ? 'Добавить это издание с сетом' : 'Add this printing with its set');
    }
  }

  async function initClipboard() {
    let cards = settings.cards;
    if (!Array.isArray(cards)) {
      try {
        const old = JSON.parse(localStorage.getItem("cardClipboard") || "[]");
        cards = Array.isArray(old) ? old.filter(c => c && typeof c.cardName === "string")
          .map(c => ({ name: c.cardName, url: c.cardLink || "", set: "", number: "" })) : [];
      } catch { cards = []; }
      await chrome.storage.local.set({ cards });
    }

    const root = document.createElement("aside");
    root.id = "scryfall-toolkit-clipboard";
    root.setAttribute("aria-label", "Card clipboard");
    const toolbar = document.createElement("div");
    toolbar.className = "stk-toolbar";
    const list = document.createElement("div");
    list.className = "stk-list";
    const open = iconButton('clip', t('Показать список карт'), () => { list.hidden = !list.hidden; });
    const badge = document.createElement('span');
    badge.className = 'stk-count';
    badge.setAttribute('aria-hidden', 'true');
    open.append(badge);
    const writeClipboard = async (format, control, restLabel, stripSets) => {
      const text = cards.map(c => formatCard(c, format, stripSets)).join("\n");
      try { await navigator.clipboard.writeText(text); flashCopied(control, restLabel); }
      catch { control.title = t('Ошибка копирования'); }
    };
    // Copy keeps the export format; hovering it reveals a small menu above with
    // a one-off "names only" choice, so sets stay the default action.
    const wrap = document.createElement('span');
    wrap.className = 'stk-copy-wrap';
    const menu = document.createElement('span');
    menu.className = 'stk-copy-menu';
    menu.hidden = true;
    const plain = document.createElement('button');
    plain.type = 'button';
    plain.className = 'stk-copy-plain';
    plain.textContent = t('Только названия без сетов');
    menu.append(plain);
    const copy = iconButton('duplicate', t('Копировать карты'), async () => {
      const format = (await chrome.storage.local.get({ exportFormat: "moxfield" })).exportFormat;
      await writeClipboard(format, copy, t('Копировать карты'));
    });
    plain.addEventListener('click', async () => {
      menu.hidden = true;
      await writeClipboard('names', plain, t('Только названия без сетов'), true);
    });
    wrap.append(menu, copy);
    let hideMenuTimer;
    const showMenu = () => { clearTimeout(hideMenuTimer); menu.hidden = false; };
    const scheduleHideMenu = () => {
      clearTimeout(hideMenuTimer);
      hideMenuTimer = setTimeout(() => { menu.hidden = true; }, 200);
    };
    for (const type of ['mouseenter', 'focusin']) wrap.addEventListener(type, showMenu);
    for (const type of ['mouseleave', 'focusout']) wrap.addEventListener(type, scheduleHideMenu);
    menu.addEventListener('mouseenter', showMenu);
    const clear = iconButton('trash', t('Очистить буфер карт'), async () => {
      if (!cards.length || !confirm(t('Очистить буфер карт?'))) return;
      cards = [];
      await persist();
    });
    toolbar.append(wrap, clear, open);
    root.append(toolbar, list);
    document.body.append(root);
    list.hidden = true;

    async function persist() {
      await chrome.storage.local.set({ cards });
      clipboardCards = cards;
      render();
      scan();
      refreshPrintButtons();
    }
    function formatCard(card, format, stripSets) {
      const suffix = !stripSets && (format === 'moxfield' || card.forceSet) && card.set && card.number ? ` (${card.set.toUpperCase()}) ${card.number}` : '';
      return `1 ${card.name}${suffix}`;
    }
    function render() {
      badge.textContent = String(cards.length);
      badge.hidden = !cards.length;
      open.setAttribute('aria-label', `${t('Показать список карт')} (${cards.length})`);
      list.replaceChildren();
      if (!cards.length) { const empty = document.createElement("p"); empty.textContent = t('Список пуст'); list.append(empty); return; }
      for (const [index, card] of cards.entries()) {
        const row = document.createElement("div");
        row.className = "stk-list-row";
        const link = document.createElement("a");
        link.href = /^https:\/\/(?:www\.)?scryfall\.com\/card\//.test(card.url) ? card.url : "#";
        link.textContent = card.name;
        const copyCard = iconButton('duplicate', `${t('Копировать карту')} ${card.name}`, async () => {
          const { exportFormat } = await chrome.storage.local.get({ exportFormat: 'moxfield' });
          try { await navigator.clipboard.writeText(formatCard(card, exportFormat)); flashCopied(copyCard, `${t('Копировать карту')} ${card.name}`); }
          catch { copyCard.title = t('Ошибка копирования'); }
        });
        copyCard.classList.add('stk-copy-card');
        const set = document.createElement('span');
        set.className = 'stk-list-set';
        if (card.set && card.number) set.textContent = `(${card.set.toUpperCase()}) ${card.number}`;
        const remove = button("×", async () => {
          cards.splice(index, 1);
          await persist();
        });
        remove.setAttribute("aria-label", `${t('Удалить')} ${card.name}`);
        row.append(link);
        if (set.textContent) row.append(set);
        row.append(copyCard, remove);
        list.append(row);
      }
    }

    function scan() {
      const targets = cardPage ? [document.querySelector(".card-image")].filter(Boolean) :
        [...document.querySelectorAll(".card-grid-item:not([aria-hidden='true'])")];
      for (const target of targets) {
        const link = cardPage ? location.href : target.querySelector("a.card-grid-item-card[href]")?.href;
        if (!link) continue;
        const match = new URL(link).pathname.match(/^\/card\/([^/]+)\/([^/]+)/);
        if (!match) continue;
        const name = (cardPage ?
          [...document.querySelectorAll(".card-text-card-name")].map(e => e.textContent.trim()).filter(Boolean).join(" // ") :
          target.querySelector(".card-grid-item-invisible-label")?.textContent.trim()) ||
          target.querySelector("img[alt]")?.getAttribute("alt")?.split(" (")[0];
        if (!name) continue;
        let add = target.querySelector(":scope > .stk-add");
        if (!add) {
          add = button("+", async () => {
            const idx = cards.findIndex(c => c.name === name);
            if (idx >= 0) cards.splice(idx, 1);
            else cards.push({ name, url: link, set: match[1], number: decodeURIComponent(match[2]) });
            await persist();
          });
          add.className = "stk-add";
          target.append(add);
        }
        const selected = cards.some(c => c.name === name);
        add.textContent = selected ? "✓" : "+";
        add.setAttribute("aria-label", `${t(selected ? 'Удалить' : 'Добавить')} ${name}`);
        add.classList.toggle("stk-selected", selected);
      }
    }
    render();
    scan();
    let pending = false;
    new MutationObserver(mutations => {
      if (!mutations.some(m => [...m.addedNodes].some(n => n.nodeType === 1 &&
        (n.matches?.(".card-grid-item, .card-image") || n.querySelector?.(".card-grid-item, .card-image"))))) return;
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; scan(); }, 100);
    }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.onChanged.addListener(changes => {
      if (changes.cards && Array.isArray(changes.cards.newValue)) {
        cards = changes.cards.newValue;
        clipboardCards = cards;
        render();
        scan();
        refreshPrintButtons();
      }
    });
    window.STK_ADD_PRINT = async card => {
      if (!card?.name || !card?.set || !card?.number) return;
      const index = cards.findIndex(item => item.name === card.name && item.set === card.set && item.number === card.number);
      if (index >= 0) cards.splice(index, 1);
      else cards.push({ name:card.name, url:card.uri, set:card.set, number:card.number, forceSet:true });
      await persist();
      return index < 0;
    };
  }

  function iconButton(name, label, onClick) {
    const control = button('', onClick);
    control.className = `stk-icon-button stk-icon-${name}`;
    control.title = label;
    control.setAttribute('aria-label', label);
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = chrome.runtime.getURL(`icons/${name}.svg`);
    control.append(icon);
    return control;
  }

  function initTags() {
    if ((!settings.cardTags && !settings.artTags && !settings.relationships) || document.getElementById("stk-tags")) return;
    const prints = document.querySelector("#main .prints");
    const anchor = [...(prints?.querySelectorAll(".prints-table") || [])].at(-1);
    if (!anchor) return;
    prints.closest(".inner-flex")?.classList.add("stk-has-tags");
    const panel = document.createElement("div");
    panel.id = "stk-tags";
    panel.classList.add('stk-loading');
    panel.textContent = t('Загружаю теги…');
    anchor.after(panel);
    let noticeTimeout;
    function showTagNotice(token) {
      let notice = document.getElementById("stk-tag-notice");
      if (!notice) {
        notice = document.createElement("div");
        notice.id = "stk-tag-notice";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        document.body.append(notice);
      }
      notice.textContent = language === 'ru' ? `Добавлено в поиск: ${token}` : `Added to search: ${token}`;
      clearTimeout(noticeTimeout);
      noticeTimeout = setTimeout(() => notice.remove(), 2200);
    }
    function tagIcon(type) {
      const icon = document.createElement("span");
      icon.className = "stk-tag-icon";
      if (["WITHOUT_BODY"].includes(type)) icon.classList.add("icon-upside-down");
      if (["COMES_BEFORE", "DEPICTS", "REFERENCES_TO", "WORSE_THAN"].includes(type)) icon.classList.add("icon-flipped");
      // Only render SVG literals bundled from Shambleshark; never insert API markup.
      const icons = window.STK_TAG_ICONS;
      icon.innerHTML = Object.prototype.hasOwnProperty.call(icons, type)
        ? icons[type] : icons.ORACLE_CARD_TAG;
      icon.title = type.toLowerCase().replaceAll("_", " ");
      return icon;
    }
    request({ type: "tags", ...identity }).then(tags => {
      panel.classList.remove('stk-loading');
      panel.replaceChildren();
      const relations = [...(tags.card || []), ...(tags.art || [])].filter(item => item.relation);
      const relationOrder = ['SIMILAR_TO', 'BETTER_THAN', 'WORSE_THAN', 'COMES_BEFORE', 'COMES_AFTER', 'MIRRORS', 'RELATED_TO', 'DEPICTED_IN', 'DEPICTS', 'REFERENCED_BY', 'REFERENCES_TO'];
      relations.sort((a, b) => {
        const rank = item => { const i = relationOrder.indexOf(item.tagType); return i < 0 ? relationOrder.length : i; };
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      });
      for (const [enabled, kind, heading, prefix, entries] of [
        [settings.cardTags, "card", "Card Tags", "otag", (tags.card || []).filter(item => !item.relation)],
        [settings.artTags, "art", "Art Tags", "art", (tags.art || []).filter(item => !item.relation)],
        [settings.relationships, "related", "Related Cards", null, relations]
      ]) {
        if (!enabled || !entries.length) continue;
        const table = document.createElement("table");
        table.className = `prints-table stk-tags-table stk-${kind}-table`;
        const head = document.createElement("thead");
        const headRow = document.createElement("tr");
        const th = document.createElement("th");
        const title = document.createElement("a");
        title.href = `https://tagger.scryfall.com/card/${encodeURIComponent(identity.set)}/${encodeURIComponent(identity.number)}`;
        title.textContent = language === 'ru' ? ({'Card Tags':'Теги карты','Art Tags':'Теги рисунка','Related Cards':'Связанные карты'}[heading] || heading) : heading;
        th.append(title);
        headRow.append(th);
        head.append(headRow);
        const body = document.createElement("tbody");
        let expanded = false;
        const render = () => {
          body.replaceChildren();
          for (const tag of expanded ? entries : entries.slice(0, 6)) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            const a = document.createElement("a");
            const tagType = tag.tagType || (kind === "art" ? "ILLUSTRATION_TAG" : "ORACLE_CARD_TAG");
            const token = `${prefix}:${tag.slug}`;
            if (tag.relation) {
              const kind = tag.targetKind === 'art' ? 'illustrationid' : 'oracleid';
              const query = `${kind}:${tag.targetId}`;
              a.href = `/search?q=${encodeURIComponent(query)}`;
              a.title = `${tagType.toLowerCase().replaceAll("_", " ")}: ${tag.name}`;
              enablePreview(a, () => request({ type: 'preview', kind, id: tag.targetId }));
              // Open the actual card detail so prices, tags and legality load.
              // Keep the search URL as a usable fallback if the API fails.
              a.addEventListener('click', async event => {
                if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                try {
                  const card = await request({type:'preview', kind, id:tag.targetId});
                  location.assign(card.uri);
                } catch { location.assign(a.href); }
              });
            } else if (tagType === "PRINTING_TAG") {
              a.href = `https://tagger.scryfall.com/tags/print/${encodeURIComponent(tag.slug)}`;
              a.title = language === 'ru' ? `Открыть печатный тег ${tag.name} в Tagger` : `Open printing tag ${tag.name} in Tagger`;
            } else {
              a.href = `/search?q=${encodeURIComponent(token)}`;
              a.title = language === 'ru' ? `Добавить ${token} в поиск` : `Add ${token} to search`;
              a.addEventListener("click", event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                const input = document.querySelector("#header-search-field") || document.querySelector("input[name='q']");
                if (!input) return;
                event.preventDefault();
                const next = [input.value.trim(), token].filter(Boolean).join(" ");
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
                if (setter) setter.call(input, next); else input.value = next;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                showTagNotice(token);
              });
            }
            const label = document.createElement("span");
            label.textContent = (tag.name || tag.slug).replace(/-/g, " ");
            a.append(tagIcon(tagType), label);
            cell.append(a);
            row.append(cell);
            body.append(row);
          }
          if (entries.length > 6) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            const toggle = document.createElement('a');
            toggle.href = '#';
            toggle.textContent = expanded ? (language === 'ru' ? 'Скрыть теги ↑' : 'Show fewer tags ↑') : (language === 'ru' ? 'Показать все теги →' : 'View all tags →');
            toggle.addEventListener('click', event => {
              event.preventDefault();
              expanded = !expanded;
              render();
            });
            toggle.className = "stk-tags-toggle";
            toggle.setAttribute("aria-expanded", String(expanded));
            cell.append(toggle);
            row.append(cell);
            body.append(row);
          }
        };
        render();
        table.append(head, body);
        panel.append(table);
      }
      if (!panel.children.length) panel.textContent = t('Для этой карты тегов нет');
      if (tags.fallback) {
        const fallback = document.createElement("p");
        fallback.className = "stk-tag-fallback";
        fallback.textContent = t('Связи Tagger сейчас недоступны; теги показаны из локального списка.');
        panel.append(fallback);
      }
    }).catch(error => {
      panel.classList.remove('stk-loading');
      panel.replaceChildren();
      const link = document.createElement("a");
      link.href = `https://tagger.scryfall.com/card/${encodeURIComponent(identity.set)}/${encodeURIComponent(identity.number)}`;
      link.textContent = t('Теги недоступны — открыть Tagger');
      link.title = error.message;
      panel.append(link);
    });
  }

  async function initLegalities() {
    const table = document.querySelector("#main .card-legality");
    const id = document.querySelector('meta[name="scryfall:card:id"]')?.content ||
      document.querySelector('#main .prints-table tbody tr.current a[data-card-id]')?.dataset.cardId;
    let oracleId = document.querySelector('meta[name="scryfall:oracle:id"]')?.content;
    if (!table || document.getElementById("stk-legalities")) return;
    const catalog = window.STK_FORMAT_CATALOG;
    const keys = new Map(catalog.map(([key, label]) => [label.toLowerCase(), key]));
    const formatKey = name => keys.get(name.trim().toLowerCase()) || `other:${name.trim().toLowerCase()}`;
    const visible = key => {
      if (Object.prototype.hasOwnProperty.call(settings.formatVisibility || {}, key)) return settings.formatVisibility[key];
      if (["premodern", "heritage", "classic", "peak"].includes(key)) return settings[key];
      return true;
    };
    const order = Array.isArray(settings.formatOrder) ? settings.formatOrder : catalog.map(([key]) => key);
    let nextOrder = 0;
    function arrange() {
      const stats = table.querySelector(':scope > #stk-edhrec');
      const cells = [...table.querySelectorAll(":scope > .card-legality-row > .card-legality-item")]
        .map(cell => ({ cell, key: formatKey(cell.querySelector("dt")?.textContent || ""), index: nextOrder++ }))
        .filter(item => visible(item.key));
      cells.sort((a,b) => {
        const ai = order.indexOf(a.key), bi = order.indexOf(b.key);
        return (ai < 0 ? order.length + a.index : ai) - (bi < 0 ? order.length + b.index : bi);
      });
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < cells.length; i += 2) {
        const row = document.createElement("div");
        row.className = "card-legality-row stk-legality-row";
        if (i === 0) row.id = "stk-legalities";
        row.append(cells[i].cell);
        if (cells[i + 1]) row.append(cells[i + 1].cell);
        fragment.append(row);
      }
      table.replaceChildren(fragment);
      if (stats) table.append(stats);
      table.hidden = cells.length === 0 && !stats;
    }
    const unknown = [...table.querySelectorAll(":scope > .card-legality-row .card-legality-item dt")]
      .map(el => ({ key: formatKey(el.textContent), label: el.textContent.trim() }))
      .filter(item => item.key.startsWith("other:"));
    if (unknown.length) {
      chrome.storage.local.get({ discoveredFormats: [] }).then(({ discoveredFormats }) => {
        const all = new Map(discoveredFormats.map(item => [item.key, item]));
        for (const item of unknown) all.set(item.key, item);
        if (all.size !== discoveredFormats.length) chrome.storage.local.set({ discoveredFormats: [...all.values()] });
      });
    }
    arrange();
    if (!settings.legalities || !id) return;
    const enabled = ["premodern", "heritage", "classic", "peak"].filter(visible);
    if (!enabled.length) return;
    let card;
    if (!oracleId || enabled.includes('premodern')) {
      try { card = await request({ type: 'card', id }); oracleId ||= card.oracle_id; }
      catch { /* Extra formats may still be available from the page. */ }
    }
    const names = { premodern: "Premodern", heritage: "Heritage", classic: "Classic Legacy", peak: "Peak Legacy" };
    const results = await Promise.all(enabled.map(async key => {
      try {
        if (key === "premodern") {
          return card?.legalities?.premodern;
        }
        if (!oracleId) return 'error';
        const found = await request({ type: "query", oracleId, format: key });
        return found.legality;
      } catch { return "error"; }
    }));
    for (let i = 0; i < enabled.length; i++) {
      const cell = document.createElement("div");
      cell.className = "card-legality-item";
      const label = document.createElement("dt");
      label.textContent = names[enabled[i]];
      const state = document.createElement("dd");
      const value = results[i];
      state.textContent = value === "legal" ? "Legal" : value === "banned" ? "Banned" :
        value === "restricted" ? "Restricted" : value === "not_legal" ? "Not Legal" : "Unavailable";
      state.className = value === "not_legal" || !["legal", "banned", "restricted"].includes(value)
        ? "not-legal" : value;
      cell.append(label, state);
      let row = table.lastElementChild;
      if (!row || !row.classList.contains("card-legality-row") || row.children.length === 2) {
        row = document.createElement("div");
        row.className = "card-legality-row";
        table.append(row);
      }
      row.append(cell);
    }
    table.hidden = false;
    arrange();
    // The stats panel under the block has to follow the new column layout.
    realignStatsPanel?.();
  }

  function button(label, click) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", click);
    return b;
  }
})();
