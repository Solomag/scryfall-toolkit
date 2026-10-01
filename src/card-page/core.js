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

// The part of the card page every other content script is built on: the settings,
// what page this is, the request wrapper, the shared clipboard list and the hover
// preview. It also owns the boot.
//
// This file used to be content.js and held all of this and every feature, 1901
// lines in one closure. The features are now their own files and read what they
// need from self.STK_CONTENT. The one thing that made that safe is written down
// at the foot: the order the features run in is a list here, not implied by the
// order the manifest happens to list the files in.
(async () => {
  // --- the registry, before anything can need it -----------------------------
  //
  // A feature file is injected one after another, and the first thing this file
  // does is wait for storage, so a feature file runs while this one is still
  // loading. Two things follow, and both are the reason this shape is here:
  //
  //  - `context` is a promise, because a feature file cannot destructure a
  //    settings object that has not been read yet. Destructuring at load time
  //    gives every feature undefined for everything, quietly.
  //  - `on()` only registers. The boot runs later, in a macrotask, by which time
  //    every feature file has been given the chance to register.
  const pending = {};
  let context = null;
  let booted = false;
  let releaseContext;
  const arrived = new Promise(resolve => { releaseContext = resolve; });
  // Function declarations, not consts: on() can reach start() before the settings
  // arrive, and a const would be in its temporal dead zone until then.
  function on(step, run) {
    (pending[step] = pending[step] || []).push(run);
    // Only if the boot has already been and gone, which should not happen: a
    // feature file registers in a microtask and the boot waits for a macrotask.
    if (booted) start(step, run);
  }
  function start(step, run) {
    Promise.resolve()
      .then(() => run(context))
      // One feature failing is one feature failing. Before the split a throw here
      // stopped every feature below it from running, and the only sign was an empty
      // panel and nothing in the log.
      .catch(error => reportFeature(step, error));
  }
  function reportFeature(step, error) {
    // Reported rather than swallowed. This is a content script with nowhere useful
    // to write it, so it goes to the console the developer has open.
    try {
      console.warn('Scryfall Toolkit: ' + step + ' failed:', error);
    } catch (ignored) { /* nothing left to report it to */ }
  }
  self.STK_CONTENT = { on, reportFeature, context: arrived };

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
    edhrecSuggestions: false, deckSearch: false, deckResultsView: 'images',
    exportFormat: "moxfield", cards: null
  };
  const settings = await chrome.storage.local.get(defaults);
  // --- the page-world bridge -------------------------------------------------
  // The deck features have to run in Scryfall's own page world, because they
  // work through window.Scryfall and window.ScryfallAPI and this script lives
  // in an isolated world that can see neither. Only this side can read the
  // settings. So the two meet at the window itself.
  const deckSettingsNow = () => {
    const wanted = settings.deckCleanUpImprover || settings.edhrecSuggestions || settings.deckSearch;
    if (!wanted) return {};
    const value = {};
    if (settings.deckCleanUpImprover) {
      value.cleanUpLandsInSingleton = settings.cleanUpLandsInSingleton;
      value.sortEntriesPrimary = settings.sortEntriesPrimary;
      value.insertSortingHeadings = settings.insertSortingHeadings;
    }
    if (settings.edhrecSuggestions) value.edhrecSuggestions = true;
    if (settings.deckSearch) value.deckSearch = true;
    // Whichever way the reader last looked at results, in either panel.
    if (settings.deckResultsView) value.deckResultsView = settings.deckResultsView;
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
      // Which way results are shown is the page's business and this script's to
      // store; it is not a question for the background worker.
      if (name === 'setDeckResultsView') {
        const view = value && value.view === 'list' ? 'list' : 'images';
        settings.deckResultsView = view;
        chrome.storage.local.set({ deckResultsView: view }).catch(() => {});
        return reply(true, view);
      }
      chrome.runtime.sendMessage({ type: name, ...(value || {}) })
        .then(result => {
          // The worker answers in an envelope: {ok, data} or {ok, error}. The
          // page modules want the data or the reason, not the wrapper — leaving
          // it on made every one of them read an object where it expected a list.
          if (result && result.ok === false) return reply(false, result.error);
          reply(true, result && typeof result === 'object' && 'data' in result ? result.data : result);
        })
        .catch(error => reply(false, error));
    }
  });
  sendDeckSettings();
  // Turning the feature on or off should not need a page reload.
  chrome.storage.onChanged.addListener(changes => {
    const keys = ['deckCleanUpImprover', 'cleanUpLandsInSingleton', 'sortEntriesPrimary', 'insertSortingHeadings', 'edhrecSuggestions', 'deckSearch', 'deckResultsView'];
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
  function request(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || "Request failed"));
        resolve(response.data);
      });
    });
  }
  function button(label, click) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", click);
    return b;
  }
  function iconButton(name, label, onClick) {
    const control = button('', onClick);
    control.className = `stk-icon-button stk-icon-${name}`;
    control.title = label;
    control.setAttribute('aria-label', label);
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = chrome.runtime.getURL(`assets/icons/${name}.svg`);
    control.append(icon);
    return control;
  }

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
      const selected = shared.clipboardCards.some(card => printKey(card.set, card.number) === key);
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
  //   // Four things are written to after they are made, by different files. They live on
  // one object so a write in one file is a read in another; a destructured name would
  // not be, which is the only reason this is an object and not four plain lets.
  const shared = {
    clipboardCards: Array.isArray(settings.cards) ? settings.cards : [],
    finishesSettled: Promise.resolve(),
    enqueueCardTraderPrint: null,
    realignStatsPanel: null
  };


  // One hover preview shared by the tag panel and the expanded print rows.
  let previewBox, previewTimer, previewHideTimer, activePreview;
  const ctQueuedCells = new WeakSet();
  // Print-row buttons follow the clipboard: a printing counts as selected when
  // a buffered card points at the same set and number, and every button
  // refreshes whenever the clipboard changes here or in another tab.
  const printButtonRefreshers = new Set();

  // What the feature files read. Published only once it is complete, so a feature
  // cannot see a half-built core.
  context = {
    settings,
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
  };
  Object.assign(self.STK_CONTENT, context);
  releaseContext(context);

  // The boot, in one place: which feature, whether it runs, and whether the next
  // one waits for it.
  //
  // Read out of the `if (condition) initX();` lines that were at the foot of
  // content.js by tools/content-core-run.cjs, rather than written out again here.
  // A condition typed from memory is how a feature ends up running on a page it
  // has no business on, and nothing in the feature file would say so.
  //
  // The conditions are functions rather than strings. A Manifest V3 content script
  // runs under a policy that forbids eval, so a condition kept as text would break
  // the extension rather than the test.
  const BOOT = [
    ["clipboard", () => settings.clipboard, true],
    ["setFilter", () => (platformFilterOn || settings.hideDigitalSets || settings.hideNonTournamentSets || settings.hideOversizedSets || settings.hideForeignBlackBorder || settings.hideNonEnglishPrints) && (/^\/sets\/?$/.test(location.pathname) || cardPage), false],
    ["tags", () => cardPage && settings.tags, false],
    ["legalities", () => cardPage, false],
    ["printFinishes", () => cardPage && settings.finishBadges, false],
    ["nativePrintButtons", () => cardPage && settings.clipboard && settings.printAddButtons, false],
    ["expandedPrints", () => cardPage && settings.printGrouping, false],
    ["edhrecStats", () => cardPage && (settings.edhrecUsage || settings.edhrecSalt), false],
    ["priceFilter", () => settings.onlyCardmarket, false],
    ["advancedPriceFilter", () => advancedPage, false],
    ["advancedSetFilter", () => advancedPage, false],
    ["cardTrader", () => cardPage && (settings.cardtraderPrices || settings.euroPriceSources !== 'cm'), false],
    ["cardSearchLinks", () => cardPage && settings.cardSearchLinks, false],
    ["cardNicknames", () => cardPage && settings.cardNicknames, false],
    ["searchTaggerLinks", () => settings.taggerSearchLinks, false],
    ["deckPriceOption", () => settings.deckNoPrices, false],
    ["stackedDeckCards", () => settings.stackedDeckCards, false],
    ["deckTokens", () => settings.deckTokens, false],
  ];

  // On a macrotask, not a microtask. Every feature file is waiting on `arrived`
  // and registers in the microtask that follows it; this runs after all of them.
  // A boot that started here would find the register empty for whichever feature
  // file had not been given its turn, and that feature would simply never run —
  // which is the quietest possible failure and the one this comment is about.
  setTimeout(() => {
    booted = true;
    for (const [step, when, awaited] of BOOT) {
      // The feature's own test, moved here from the list this replaced. A step
      // that should not run is not even looked up.
      if (!when()) continue;
      for (const run of pending[step] || []) {
        if (awaited) {
          run(context).catch(error => reportFeature(step, error));
        } else {
          start(step, run);
        }
      }
    }
  }, 0);
})();
