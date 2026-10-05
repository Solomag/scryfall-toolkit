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
    printAddButtons: true, printPageSameTab: false,
    legalities: true, finishBadges: true, cardtraderPrices: false, euroPriceSources: 'cm',
    printGrouping: false, printFoldGroups: false, printFullPageLink: false,
    edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: false, edhrecUsageDisplay: 'both',
    usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
    usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
    taggerSearchLinks: false, cardSearchLinks: true, cardNicknames: true, deckNoPrices: true, stackedDeckCards: true, deckLegality: true,
    premodern: true, heritage: false, classic: false, peak: false,
    formatOrder: null, formatVisibility: null,
    deckCleanUpImprover: false, cleanUpLandsInSingleton: true,
    sortEntriesPrimary: 'none', insertSortingHeadings: true,
    edhrecSuggestions: false, deckSearch: false, deckResultsView: 'images',
    exportFormat: "moxfield", cards: null,
    // Read with no default, on purpose: passing one here would make every old key look
    // as though it had a value, and the migration reads those keys to decide what the
    // reader had chosen. The second read below is the whole of storage.
    setFilters: null, setFiltersMigrated: false
  };
  const settings = await chrome.storage.local.get(defaults);

  // The hiding settings, and the old flat ones, in one place. See src/core/set-filters.js
  // for the shape and for what each old key meant.
  //
  // The old keys are named explicitly rather than the whole of storage being read,
  // because the migration has to see them, and a read that asked only for the new pair
  // would hand it an object holding nothing else - quietly resetting everybody's
  // settings to the defaults. That is the worst thing this change could do, so what it
  // reads is written down in the model rather than implied, because the settings page
  // has to read the very same keys to draw the very same migrated values.
  const stored = await chrome.storage.local.get(
    Object.fromEntries(window.STK_SET_FILTERS.LEGACY_KEYS.map(key => [key, null])));
  const filtersRead = window.STK_SET_FILTERS.read(stored);
  const setFilters = filtersRead.filters;
  const hiding = window.STK_SET_FILTERS.effective(setFilters);
  // Written back once, so the migration is not repeated on every page load and a later
  // build has something to compare against. The old keys are left in place: a reader who
  // installs an older build again should not find their settings silently reset, and
  // nothing reads them any more either way.
  if (filtersRead.migrated) {
    chrome.storage.local.set({ setFilters, setFiltersMigrated: true });
  }
  // What the feature files read, and it is the stored shape: positive switches, a list of
  // platforms kept and three areas. No alias, no derived boolean, and nothing named "hide".
  //
  // The aliases this replaces were the third place a rule could be spelled, and one of them
  // was wrong in a way nothing tested: `hideNonTournamentSets` was handed `hiding.nonTournament`
  // where the old shape meant *hide*, and the old shape's `effective()` returned the opposite,
  // so the two senses met there. The shape now says "show" everywhere and the feature files
  // read it under its own name.
  settings.showNonTournament = hiding.paper.nonTournament;
  settings.showOversized = hiding.paper.oversized;
  settings.showNoEnglishSets = hiding.paper.noEnglishSets;
  settings.showForeignBlackBorder = hiding.paper.foreignBlackBorder;
  settings.nonEnglishMode = hiding.paper.nonEnglish;
  settings.filterAreas = hiding.areas;
  settings.setPlatforms = window.STK_SET_FILTERS.PLATFORM_NAMES
    .filter(name => hiding.platforms[name]);
  // Deliberately false, and still derived from nothing. Which platforms are shown and which
  // sets are digital are the same decision: the platform switches already hide every Arena and
  // Magic Online set, so deriving this from them hid those sets twice over, and took Arena
  // sets with it even when Arena was the platform being kept.
  settings.hideDigitalSets = false;
  settings.onlyCardmarket = Object.values(setFilters.prices).some(Boolean);
  settings.deckTokens = setFilters.tokens;
  settings.hideCasterIndicator = setFilters.caster;
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
  // Whether a filter is wanted at all, for a given surface. One question asked once, because
  // three surfaces asking it separately is how a rule reached one of them and not another.
  //
  // The areas are the reader's answer to "where should filtering apply", and every rule
  // consults them together with its own switch: a rule that is off is off everywhere, and a
  // rule that is on applies only where the reader asked. So "all" is not a way of bringing
  // back printings that a category switch has removed.
  const filteringOn = area => settings.filterAreas?.[area] === true;
  // The set index and the search field are set-level surfaces; the prints table is where
  // individual printings can be removed. Keeping the distinction here rather than at each
  // call site is what stops a printing-level rule from being asked to remove whole sets.
  const setsFilterOn = () => filteringOn('sets');
  const searchFilterOn = () => filteringOn('search');
  const printsFilterOn = () => filteringOn('prints');
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

  // Defined once, in src/core/clipboard-format.js, and taken from there. It used to be
  // written out here as well, which made three copies of one rule: two of them
  // reachable from the Tagger page, which does not load this file, so those two could
  // only ever agree by coincidence.
  const printKey = window.STK_CLIPBOARD_FORMAT.printKey;
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
    setsFilterOn,
    searchFilterOn,
    printsFilterOn,
    setPlatformsOf,
    platformSetVisible,
    platformSetRequests,
    // The hiding rules as they are actually in force, gate applied. Anything that hides a
    // set or a printing reads these rather than the settings, so the gate cannot be
    // honoured in one place and forgotten in another.
    setFilters,
    hiding,
    SET_FILTER_RULES: window.STK_SET_FILTERS,
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
  // Whether anything in the hiding group is in force for a surface, which is what decides
  // if the set filter runs at all. The mode rules are asked per surface rather than
  // collapsed to a boolean, because this one line is the third of the three places that
  // read the mode and it is where 1.1.0 went wrong: `settings.hideForeignBlackBorder`
  // there was the collapsed alias, so with 'prints' chosen it was false and the whole
  // feature did not run — on either surface, including the one it had been asked for.
  const setFilterNeeded = (() => {
    // A rule that wants to remove something, and a surface it wants to remove it from. Both
    // halves are needed and either alone is wrong: a rule on with no surface chosen removes
    // nothing, and a surface chosen with every rule off removes nothing.
    //
    // The two rule families are asked apart because they act on different things and the
    // surfaces can differ: the category rules are properties of a set, and the non-English
    // rule is a property of a printing.
    // A category is on while at least one of its families is, and it removes a set while any
    // family is off. The two are not the same question and only the second is written here.
    //
    // "Some family is off", spelled as "not every family is on". The other spelling —
    // `some(show => show)` being false — is what this said first, and it is true only when
    // every family is off. So narrowing the category to a single family read as "nothing to
    // do" and the whole feature stood down: untick 4BB, leave FBB and BCHR on, and not one
    // row moved. A check that only ever switched whole categories passed.
    const someFamilyOff = Object.values(settings.showForeignBlackBorder || {})
      .some(show => show !== true);
    const ruleWantsSomething =
      !settings.showNonTournament || !settings.showOversized || !settings.showNoEnglishSets ||
      someFamilyOff;
    const languageWantsSomething = settings.nonEnglishMode !== 'all';
    return (platformFilterOn ||
      (ruleWantsSomething && (setsFilterOn() || printsFilterOn())) ||
      (languageWantsSomething && printsFilterOn()));
  })();
  const setFilterPage = /^\/sets\/?$/.test(location.pathname) || cardPage;
  const BOOT = [
    ["clipboard", () => settings.clipboard, true],
    ["setFilter", () => setFilterNeeded && setFilterPage, false],
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
    ["deckLegality", () => settings.deckLegality && /^\/@[^/]+\/decks\//.test(location.pathname), false],
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
