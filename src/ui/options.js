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
const defaults = {
  settingsLanguage: 'auto', siteLanguage: 'en',
  clipboard: true, printAddButtons: true, darkTheme: 'auto', tags: true, cardTags: true, artTags: false, relationships: true,
  finishBadges: true, cardtraderPrices: false, cardtraderToken: '', euroPriceSources: 'cm',
  edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: false, edhrecUsageDisplay: 'both',
  usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
  usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
  printPageSameTab: false,
  printGrouping: false, printFoldGroups: false, printFullPageLink: false,
  // Read with no default, for the reason given in src/core/set-filters.js: a default
  // here would make every old key look as though it had a value, and the migration
  // reads those keys to decide what the reader had chosen.
  setFilters: null, setFiltersMigrated: false,
  taggerSearchLinks: false, cardSearchLinks: true, cardNicknames: true, deckNoPrices: true, stackedDeckCards: true,
  deckCleanUpImprover: false, cleanUpLandsInSingleton: true, sortEntriesPrimary: 'none', insertSortingHeadings: true,
  edhrecSuggestions: false, deckSearch: false,
  legalities: true, exportFormat: "moxfield", formatOrder: null, formatVisibility: null,
  discoveredFormats: [], premodern: true, heritage: false, classic: false, peak: false
};
// Two separate things, and one storage key.
//
// `setFilters` holds the whole hiding group; the page saves it as one value, so a
// reader who turns off three prices does not cause three writes and three chances for
// one of them to land without the others. The old code saved each switch under its own
// key, which is how a reader could end up with the master saying one thing and the
// sub-switches saying another — the exact failure the shape was built to prevent.
//
// Nothing under the hiding group is in this list. `basicFields` saves one id per key,
// and the group has controls that do not map to a key at all: the master switch writes
// one flag, the two category rules carry a list under them, and the four price kinds are
// told apart by the model rather than by an id. A key-by-key save would have to be kept
// in step with all three, and there is no test that could tell that it was not.
const basicFields = ["clipboard", "printAddButtons", "printPageSameTab", "tags", "cardTags", "artTags", "relationships", "finishBadges", "cardtraderPrices", "euroPriceSources", "edhrecUsage", "edhrecSalt", "showSaltScale", "edhrecLink", "edhrecUsageDisplay", "usageColorMetric", "legalities", "exportFormat", "taggerSearchLinks", "cardSearchLinks", "cardNicknames", "deckNoPrices", "stackedDeckCards", "deckCleanUpImprover", "cleanUpLandsInSingleton", "sortEntriesPrimary", "insertSortingHeadings", "edhrecSuggestions", "deckSearch", "printGrouping", "printFoldGroups", "printFullPageLink"];
// EDHREC and CardTrader are optional features, and so is the access they need.
// Chrome has a place for exactly this: optional_host_permissions, granted only
// when the user turns one of them on. Turning a switch off and on again is also
// how access is put back after it is revoked or after an update.
const OPTIONAL_HOSTS = {
  edhrecUsage: ['https://json.edhrec.com/*'],
  edhrecSalt: ['https://json.edhrec.com/*'],
  edhrecLink: ['https://json.edhrec.com/*'],
  // Suggestions need both: the commander page comes from their public JSON, and
  // the recommendations for a deck come from the endpoint their own site posts
  // to. The deck list is what that request carries.
  edhrecSuggestions: ['https://json.edhrec.com/*', 'https://edhrec.com/*'],
  cardtraderPrices: ['https://api.cardtrader.com/*']
};
// What each of those is called in the interface. Every key is listed, so adding a
// feature with a host cannot leave the message showing a storage key to a reader.
const OPTIONAL_HOST_NAMES = {
  edhrecUsage: 'EDHREC', edhrecSalt: 'EDHREC', edhrecLink: 'EDHREC',
  edhrecSuggestions: 'EDHREC', cardtraderPrices: 'CardTrader',
  euroPriceSources: 'CardTrader'
};
// The hosts each optional feature needs, and what turns them on. euroPriceSources
// is the one that is easy to miss: choosing CardTrader as the EUR source reaches
// api.cardtrader.com whether or not the CardTrader switch is on, so it has to ask
// for the host too.
// A feature that is already on can still be missing a host it needs: hosts get
// added over time and the grant the user gave covers only what existed then. A
// missing host does not fail loudly — the feature quietly falls back to
// something blander and nobody knows why. So the settings page checks what an
// enabled feature has, and *reports* what is missing.
//
// It does not ask for it. Asking here was what put this error on the reader's screen:
//
//   Unchecked runtime.lastError: This function must be called during a user gesture
//
// Chrome grants an optional permission only from inside a gesture, and this runs while
// the page loads — and one step further out, inside the callback of
// permissions.contains, so by the time it asks there is nothing a gesture could have
// been. The refusal then arrives through the callback rather than as a throw, so the
// try/catch around it catches nothing, and because nobody reads
// chrome.runtime.lastError Chrome prints it as "Unchecked" on every page load.
//
// So the check reports, and the button asks. A reader is told what is missing instead of
// being handed a console line they cannot act on.
function reconcileHostAccess(values) {
  if (!chrome.permissions || !chrome.permissions.contains) return Promise.resolve([]);
  const checks = [];
  for (const [key, hosts] of Object.entries(OPTIONAL_HOSTS)) {
    if (!values[key] || !hosts.length) continue;
    checks.push(new Promise(resolve => {
      chrome.permissions.contains({ origins: hosts }, has => {
        // Reading lastError here matters for the same reason: an unchecked one is
        // printed whether or not anybody looks at it.
        void chrome.runtime.lastError;
        resolve(has ? null : key);
      });
    }));
  }
  return Promise.all(checks).then(results => results.filter(Boolean));
}
function optionalHostsFor(key, value) {
  if (key === 'euroPriceSources') {
    return value === 'ct' || value === 'both' ? ['https://api.cardtrader.com/*'] : [];
  }
  return OPTIONAL_HOSTS[key] || [];
}

// Asks for hosts. Only ever from inside a click.
//
// The answer distinguishes "the reader said no" from "the browser would not even ask",
// because they are different problems and a caller that treats them alike reverts a
// switch for no reason the reader can see. Reading chrome.runtime.lastError inside the
// callback is what stops the refusal being printed as an unchecked error.
function requestHostAccess(origins) {
  if (!origins || !origins.length || !chrome.permissions || !chrome.permissions.request) {
    return Promise.resolve({ granted: true, reason: '' });
  }
  return new Promise(resolve => {
    try {
      chrome.permissions.request({ origins }, granted => {
        const refusal = chrome.runtime.lastError;
        resolve({
          granted: Boolean(granted),
          reason: refusal ? refusal.message || String(refusal) : ''
        });
      });
    } catch (error) {
      resolve({ granted: false, reason: (error && error.message) || String(error) });
    }
  });
}

const status = document.getElementById("status");
chrome.storage.local.get(defaults, values => {
  // What the user chose and what the interface speaks are different things. The
  // choice is stored; the language is derived from it and never stored back.
  let selected = ['auto', 'ru', 'en'].includes(values.settingsLanguage)
    ? values.settingsLanguage : 'auto';
  let language = window.STK_I18N.resolveSettingsLanguage(selected);
  const t = text => window.STK_I18N.t(text, language);
  const settingsLanguage = document.getElementById('settingsLanguage');
  const siteLanguage = document.getElementById('siteLanguage');
  settingsLanguage.value = selected;
  siteLanguage.value = values.siteLanguage === 'ru' ? 'ru' : 'en';
  window.STK_I18N.localizeOptions(language);
  const token = document.getElementById('cardtraderToken');
  const tokenStatus = document.getElementById('tokenStatus');
  const label = document.getElementById('cardtraderTokenLabel');
  const save = document.getElementById('saveToken');
  const remove = document.getElementById('removeToken');
  function showTokenState(stored) {
    tokenStatus.dataset.stored = stored ? 'yes' : 'no';
    label.textContent = t(stored ? 'Личный API-токен CardTrader · сохранён ✓' : 'Личный API-токен CardTrader · не задан');
    token.placeholder = t(stored ? 'Введите новый токен для замены сохранённого' : 'Вставь личный токен');
    save.textContent = t(stored ? 'Заменить' : 'Сохранить');
    remove.disabled = !stored;
    tokenStatus.textContent = t(stored ? 'Токен сохранён. Пустое поле означает, что текущий токен продолжает работать. Он передаётся только в API CardTrader.' : 'Для цен CardTrader нужен личный токен. Он хранится локально и передаётся только в API CardTrader.');
  }
  showTokenState(Boolean(values.cardtraderToken));
  settingsLanguage.addEventListener('change', () => {
    // The raw selection is saved, whatever it resolves to right now.
    selected = ['auto', 'ru', 'en'].includes(settingsLanguage.value) ? settingsLanguage.value : 'auto';
    language = window.STK_I18N.resolveSettingsLanguage(selected);
    window.STK_I18N.localizeOptions(language);
    showTokenState(tokenStatus.dataset.stored === 'yes');
    document.querySelectorAll('#formatList .format-item').forEach(row => { row.title = language === 'ru' ? `Перетащи ${formats.get(row.dataset.key)} в нужную колонку` : `Drag ${formats.get(row.dataset.key)} to either column`; });
    status.textContent = t('Сохранено');
    chrome.storage.local.set({ settingsLanguage: selected });
  });
  siteLanguage.addEventListener('change', () => {
    chrome.storage.local.set({ siteLanguage: siteLanguage.value === 'ru' ? 'ru' : 'en' }, () => { status.textContent = t('Сохранено'); });
  });
  document.getElementById('saveToken').addEventListener('click', () => {
    const value = token.value.trim();
    if (!value || /\s/.test(value)) { status.textContent = t('Вставь токен без пробелов'); return; }
    chrome.storage.local.set({ cardtraderToken: value }, () => {
      token.value = '';
      showTokenState(true);
      tokenStatus.dataset.stored = 'yes';
      status.textContent = t('Токен сохранён; цены проверятся на странице карты');
    });
  });
  document.getElementById('removeToken').addEventListener('click', () => {
    chrome.storage.local.remove('cardtraderToken', () => {
      document.getElementById('cardtraderPrices').checked = false;
      document.getElementById('euroPriceSources').value = 'cm';
      chrome.storage.local.set({ cardtraderPrices: false, euroPriceSources: 'cm' });
      token.value = '';
      showTokenState(false);
      tokenStatus.dataset.stored = 'no';
      status.textContent = t('Токен удалён');
    });
  });
  // The popup is a page of its own now, so this page always opens in a tab —
  // which makes "open in a new tab" a button that does nothing. It is shown
  // only in the case where it would actually help.
  const openOptions = document.getElementById('openOptions');
  const offerNewTab = () => {
    if (!chrome.tabs || !chrome.tabs.getCurrent) return;
    chrome.tabs.getCurrent(tab => { if (tab) openOptions.hidden = true; });
  };
  offerNewTab();
  openOptions.addEventListener('click', () => chrome.runtime.openOptionsPage());
  // The "?" beside a section heading opens the picture of that feature. The pictures
  // sit in one dialog rather than in the sections: six large images in the body
  // pushed the settings they explain off the bottom of the page, and the point of
  // the settings page is the settings.
  //
  // Five of the six are the card page's whole right-hand column rather than a panel cut
  // out of it. A crop says what a panel looks like and nothing about where it goes; the
  // column says where the tags sit relative to the prints, what the page looks like once
  // a rule has taken rows out of it, and that the panel is a panel and not part of
  // Scryfall's own page. They are taller than a window, which is why the dialog scrolls.
  //
  // The captions are written in Russian and run through the same translator as the
  // rest of the page, because this text is created after the page is localized.
  const SHOTS = {
    tags: {
      src: '../../assets/shots/tags.png',
      caption: 'Вся правая колонка страницы карты: таблица изданий, под ней таблицы тегов карты и тегов арта.'
    },
    cardclip: {
      src: '../../assets/shots/cardclip.png',
      caption: 'Буфер в углу страницы: собранные карты, каждую можно скопировать отдельно.'
    },
    'hide-extra': {
      src: '../../assets/shots/hide-extra.png',
      caption: 'Та же колонка без цифровых наборов и без цен в долларах и билетах: остались бумажные наборы и цена в евро.'
    },
    additional: {
      src: '../../assets/shots/additional.png',
      caption: 'В той же колонке у каждого издания появляется свой столбец отделки: Nonfoil, Foil, Etched.'
    },
    legality: {
      src: '../../assets/shots/legality.png',
      caption: 'Колонка страницы карты, у которой добавлены форматы, которых нет у Scryfall.'
    },
    prints: {
      src: '../../assets/shots/prints.png',
      caption: 'Вся колонка: все издания собраны в одной таблице и сгруппированы по сетам.'
    }
  };
  const shotDialog = document.getElementById('shotDialog');
  const shotImage = document.getElementById('shotImage');
  const shotCaption = document.getElementById('shotCaption');
  document.querySelectorAll('.shot-button').forEach(button => {
    // A "?" with no picture behind it is worse than no "?" at all, so a name the
    // page does not know fails loudly here rather than opening an empty frame.
    const shot = SHOTS[button.dataset.shot];
    if (!shot) {
      console.error('no illustration named ' + button.dataset.shot + '; the button will do nothing');
      button.disabled = true;
      return;
    }
    button.setAttribute('aria-label', t('Показать, как это выглядит'));
    button.addEventListener('click', () => {
      shotImage.src = shot.src;
      shotImage.alt = t(shot.caption);
      shotCaption.textContent = t(shot.caption);
      shotDialog.showModal();
    });
  });
  // Clicking the dimmed page behind the dialog closes it, the way a dialog is
  // expected to behave; Escape already does, through the form's dialog method.
  shotDialog.addEventListener('click', event => {
    if (event.target === shotDialog) shotDialog.close();
  });
  // The theme choice follows the operating system unless it is set by hand.
  // Installations that predate the choice stored a boolean: true is a dark
  // theme the user asked for, false is the light page they were seeing.
  const darkTheme = document.getElementById('darkTheme');
  const storedTheme = values.darkTheme === true ? 'dark' : values.darkTheme === false ? 'light' : values.darkTheme;
  darkTheme.value = ['auto', 'light', 'dark'].includes(storedTheme) ? storedTheme : 'auto';
  darkTheme.addEventListener('change', () => {
    chrome.storage.local.set({ darkTheme: darkTheme.value }, () => { status.textContent = t('Сохранено'); });
  });
  // An enabled feature may be missing a host it needs, if the host was added
  // after the user granted access. Chrome only answers a permission request
  // from a click, so this is a button rather than something that fires on load.
  const grant = document.getElementById('grantDeckHosts');
  if (grant) {
    grant.addEventListener('click', () => {
      const missing = [...new Set(Object.values(OPTIONAL_HOSTS).flat())];
      requestHostAccess(missing).then(answer => {
        if (answer.granted) {
          status.textContent = t('Доступ к хосту выдан — перезагрузи открытые страницы.');
          return;
        }
        // The browser refusing to ask at all is not the reader saying no, and
        // saying "не выдан" for it would be a message about the wrong thing.
        status.textContent = answer.reason
          ? t('Браузер не дал спросить: ') + answer.reason
          : t('Доступ не выдан.');
      });
    });
  }
  reconcileHostAccess(values).then(missing => {
    // Named, not merely counted, and named by the product rather than by the storage key:
    // a reader who has EDHREC switched on and CardTrader switched off is missing one
    // host, and telling them that two are missing sends them looking for a switch that
    // is deliberately off. A storage key in the message would be worse than either.
    if (!missing.length) return;
    const named = [...new Set(missing.map(key => (OPTIONAL_HOST_NAMES[key] || key)))];
    status.textContent = t('Не выдан доступ к хостам для: ') + named.join(', ') +
      '. Нажми «Выдать доступ к хостам».';
    if (grant) grant.classList.add('stk-needs-grant');
  });
  for (const key of basicFields) {
    const element = document.getElementById(key);
    if (element.type === "checkbox") element.checked = Boolean(values[key]);
    else element.value = values[key];
    element.addEventListener("change", () => {
      const wanted = element.type === "checkbox" ? element.checked : element.value;
      // Turning an optional feature on is the moment the browser is asked for
      // its host. Refusing leaves the switch off rather than saving a feature
      // that cannot reach anything.
      const needs = optionalHostsFor(key, wanted);
      if (needs.length) {
        requestHostAccess(needs).then(answer => {
          if (!answer.granted) {
            // Without its host the feature reaches nothing, so the control goes
            // back to what storage holds rather than saving a switch that only
            // looks like it works. The browser refusing to ask is reported, because
            // a switch that quietly reverts looks like a broken checkbox.
            if (element.type === 'checkbox') element.checked = Boolean(values[key]);
            else if (values[key] !== undefined) element.value = values[key];
            status.textContent = answer.reason
              ? t('Браузер не дал спросить: ') + answer.reason
              : t('Доступ не выдан.');
            return;
          }
          chrome.storage.local.set({ [key]: wanted }, () => { status.textContent = t('Сохранено'); });
        });
        return;
      }
      chrome.storage.local.set({ [key]: wanted }, () => {
        status.textContent = t('Сохранено');
      });
    });
  }
  // Master switches lock the settings that only mean something while they are
  // on, so a disabled control can never look active.
  const lockGroups = [
    { master: 'clipboard', inside: ['exportFormat', 'printAddButtons'] },
    { master: 'tags', inside: ['cardTags', 'artTags', 'relationships'], fieldset: true },
    { master: 'deckCleanUpImprover', inside: ['cleanUpLandsInSingleton', 'sortEntriesPrimary', 'insertSortingHeadings'] }
  ];
  for (const group of lockGroups) {
    const master = document.getElementById(group.master);
    const apply = () => {
      for (const id of group.inside) document.getElementById(id).disabled = !master.checked;
      if (group.fieldset) master.closest('section').querySelector('fieldset').disabled = !master.checked;
    };
    master.addEventListener('change', apply);
    apply();
  }
  // The deck modules run against Scryfall's application internals, and every
  // hook they need is optional. When one does not take, the module says so —
  // and that report is the only way to tell "the feature is off" from "the
  // feature could not attach", so it is shown here rather than left in storage.
  const deckStatus = document.getElementById('deckModuleStatus');
  if (deckStatus) {
    chrome.storage.local.get({ deckModuleStatus: null }).then(({ deckModuleStatus }) => {
      const s = deckModuleStatus;
      if (!s) {
        deckStatus.textContent = t('Открой редактор колоды с включённым модулем, и здесь появится его отчёт.');
        return;
      }
      const lines = [t('Страница') + ': ' + (s.page || '—')];
      const flags = [
        ['cleanUp', t('Очистка колоды')],
        ['edhrecSuggestions', t('Подсказки EDHREC')],
        ['deckSearch', t('Поиск Scryfall')]
      ];
      lines.push(t('Подключено') + ': ' + flags.filter(([key]) => s[key]).map(([, label]) => label).join(', '));
      const inner = s.scryfall || {};
      lines.push(t('Внутренности Scryfall') + ': ' + [
        inner.hasScryfall ? 'window.Scryfall ✓' : 'window.Scryfall ✗',
        inner.hasScryfallApi ? 'ScryfallAPI ✓' : 'ScryfallAPI ✗',
        inner.hooksInstalled ? 'hooks ✓' : 'hooks ✗'
      ].join(' · '));
      if (inner.problems && inner.problems.length) {
        lines.push(t('Что не так') + ':');
        for (const problem of inner.problems) lines.push('— ' + problem);
      }
      deckStatus.textContent = lines.join('\n');
      deckStatus.style.whiteSpace = 'pre-wrap';
    }).catch(() => {});
  }
  // --- the hiding group, drawn from the model -----------------------------------
  //
  // Everything in this block is one storage key, and the block is a function because
  // it needs a second read: the migration has to see the old keys, and a read that asked
  // only for `setFilters` would hand it an object holding nothing else — quietly showing
  // a reader who had chosen to hide four kinds of price the defaults instead. The list
  // of keys to read comes from the model, so the card page and this page cannot be
  // looking at different sets of them.
  function drawHidingGroup(stored) {
  // Everything below is one storage key. The shape is src/core/set-filters.js, and it
  // is read from there rather than repeated here: the card page reads the same object
  // to decide what to hide, and a second copy of the shape in this file is a copy that
  // can be changed on one side only. So this block asks the model what exists and draws
  // that.
  //
  // The migration runs here too, not only on the card page.
  const FILTERS = window.STK_SET_FILTERS;
  const filtersRead = FILTERS.read(stored);
  const filters = filtersRead.filters;
  if (filtersRead.migrated) {
    chrome.storage.local.set({ setFilters: filters, setFiltersMigrated: true });
  }
  const saveFilters = () => chrome.storage.local.set(
    { setFilters: filters, setFiltersMigrated: true }, () => { status.textContent = t('Сохранено'); });

  // The master switch is a gate, and the one thing it must never do is write the
  // switches under it. It is going to be "hide everything", which is a different thing:
  // a switch that writes four others has to be kept in step with them, and when it is
  // not, the master says one and the page does another. So it stores one flag, and
  // everything it governs is drawn dimmed while it is off — the reader's choices are
  // still there, which is the entire point of wanting a gate.
  const gate = document.getElementById('setFiltersEnabled');
  const setsGroup = document.getElementById('setsGroup');
  const platformGroup = document.getElementById('setPlatformsGroup');
  gate.checked = filters.setsEnabled;
  function applyGate() {
    setsGroup.disabled = !gate.checked;
    platformGroup.disabled = !gate.checked;
  }
  gate.addEventListener('change', () => {
    // One key. The sub-switches are not written, and the model's withoutSets/withSets
    // are not used either: both of them copy the whole object, which would also be a
    // way of quietly rewriting sub-switches that were never touched.
    filters.setsEnabled = gate.checked;
    applyGate();
    saveFilters();
  });
  applyGate();

  // The two plain rules in the group. They are booleans and stay booleans.
  for (const [id, key] of [['setNonTournament', 'nonTournament'], ['setOversized', 'oversized']]) {
    const box = document.getElementById(id);
    box.checked = filters.sets[key];
    box.addEventListener('change', () => {
      filters.sets[key] = box.checked;
      saveFilters();
    });
  }

  // A rule with a category under it: a switch plus a list of which parts of the
  // category it covers. The list is built from the model's own tables, so a new entry
  // is one line in set-filters.js and needs nothing here.
  //
  // The list is drawn from the model's labels rather than translated in this file,
  // because STK_I18N already holds the Russian string and the English beside it. A
  // second dictionary would be a second thing to forget.
  function buildWhichList(containerId, table, chosen, onChange) {
    const container = document.getElementById(containerId);
    const boxes = [];
    for (const [key, entry] of Object.entries(table)) {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = containerId + '-' + key;
      box.dataset.which = key;
      box.checked = chosen.includes(key);
      box.addEventListener('change', onChange);
      label.append(box, document.createTextNode(' ' + entry.label));
      container.append(label);
      boxes.push(box);
    }
    return boxes;
  }

  function whichOf(boxes) {
    return boxes.filter(box => box.checked).map(box => box.dataset.which);
  }

  // The two rules that carry a surface, at once, because they are the same shape and
  // writing them separately is how one of them ends up saving and the other not.
  //
  // A select rather than a switch, because the value is the surface and not a yes. The
  // list underneath stays usable in all three positions: picking which of 4BB, FBB and
  // BCHR while the rule is off is how a reader sets it up before switching it on, and
  // hiding the list would throw that away.
  for (const [id, listId, key, table] of [
    ['setForeignBlackBorder', 'setForeignBlackBorderList', 'foreignBlackBorder', FILTERS.FOREIGN_BLACK_BORDER],
    ['setNonEnglish', 'setNonEnglishList', 'nonEnglish', FILTERS.NON_ENGLISH]
  ]) {
    const select = document.getElementById(id);
    const rule = filters.sets[key];
    select.value = FILTERS.SURFACE_NAMES.includes(rule.surfaces) ? rule.surfaces : FILTERS.SURFACES.off;
    const boxes = buildWhichList(listId, table, rule.which, () => {
      rule.which = whichOf(boxes);
      saveFilters();
    });
    select.addEventListener('change', () => {
      rule.surfaces = FILTERS.SURFACE_NAMES.includes(select.value) ? select.value : FILTERS.SURFACES.off;
      saveFilters();
    });
  }

  // Platform checkboxes behave as one control: "All" mirrors the three platforms, and
  // unchecking the last one falls back to All so the set lists never end up empty.
  //
  // The fallback saves what it draws. Drawing all three while storage kept the one that
  // had just been removed meant a reload brought it straight back — which is how this
  // test once passed while doing nothing at all.
  const platformBoxes = ['paper', 'arena', 'mtgo'].map(name => ({
    name, element: document.getElementById('setPlatforms' + name[0].toUpperCase() + name.slice(1))
  }));
  const platformAll = document.getElementById('setPlatformsAll');
  function showPlatforms(chosen) {
    for (const box of platformBoxes) box.element.checked = chosen.includes(box.name);
    platformAll.checked = platformBoxes.every(box => box.element.checked);
  }
  function savePlatforms() {
    const chosen = platformBoxes.filter(box => box.element.checked).map(box => box.name);
    const next = chosen.length ? chosen : platformBoxes.map(box => box.name);
    showPlatforms(next);
    for (const box of platformBoxes) filters.platforms[box.name] = next.includes(box.name);
    saveFilters();
  }
  showPlatforms(platformBoxes.filter(box => filters.platforms[box.name]).map(box => box.name));
  platformAll.addEventListener('change', () => {
    showPlatforms(platformAll.checked ? platformBoxes.map(box => box.name) : []);
    savePlatforms();
  });
  for (const box of platformBoxes) box.element.addEventListener('change', () => {
    platformAll.checked = platformBoxes.every(entry => entry.element.checked);
    savePlatforms();
  });

  // The four price kinds, one row each, from the model's own table. Which row is which
  // is the model's business: prices.js asks `setFilters.prices[kind]` for each of them,
  // so a fifth kind added there has to appear here or the settings page is a rule it
  // cannot store.
  const priceBoxes = buildWhichList('setPrices', FILTERS.PRICE_KINDS,
    Object.keys(FILTERS.PRICE_KINDS).filter(kind => filters.prices[kind]), () => {
      const chosen = whichOf(priceBoxes);
      for (const kind of Object.keys(FILTERS.PRICE_KINDS)) filters.prices[kind] = chosen.includes(kind);
      saveFilters();
    });

  // The two that sit outside the gate, because the model does not put them behind it:
  // effective() returns them whatever setsEnabled says.
  for (const [id, key] of [['setCaster', 'caster'], ['setTokens', 'tokens']]) {
    const box = document.getElementById(id);
    box.checked = filters[key];
    box.addEventListener('change', () => {
      filters[key] = box.checked;
      saveFilters();
    });
  }
  // The rows above were written after the page was localized, so the page is localized
  // again over them. Their labels are the model's own Russian strings, so this is the
  // same translation every other label on the page gets — and the language selector
  // reaches them too, because it localizes the whole body rather than a fixed list.
  window.STK_I18N.localizeOptions(language);
  }

  chrome.storage.local.get(
    Object.fromEntries(window.STK_SET_FILTERS.LEGACY_KEYS.map(key => [key, null])),
    drawHidingGroup);

  const usageMetric = document.getElementById('usageColorMetric');
  function showUsageThresholds() {
    document.getElementById('usageCountThresholds').hidden = usageMetric.value === 'percent';
    document.getElementById('usagePercentThresholds').hidden = usageMetric.value !== 'percent';
  }
  usageMetric.addEventListener('change', showUsageThresholds);
  showUsageThresholds();
  for (const [mediumKey,highKey,max] of [['usageMediumDecks','usageHighDecks',Infinity],['usageMediumPercent','usageHighPercent',100]]) {
    const low = document.getElementById(mediumKey);
    const high = document.getElementById(highKey);
    low.value = values[mediumKey];
    high.value = values[highKey];
    function save() {
      const a = Number(low.value), b = Number(high.value);
      if (!low.value || !high.value || !Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b <= a || b > max) {
        status.textContent = t('Пороги популярности: красный должен быть выше жёлтого');
        return;
      }
      chrome.storage.local.set({ [mediumKey]: a, [highKey]: b }, () => { status.textContent = t('Пороги популярности сохранены'); });
    }
    low.addEventListener('change', save);
    high.addEventListener('change', save);
  }
  const saltMedium = document.getElementById('saltMediumThreshold');
  const saltHigh = document.getElementById('saltHighThreshold');
  saltMedium.value = values.saltMediumThreshold;
  saltHigh.value = values.saltHighThreshold;
  function saveSaltThresholds() {
    const medium = Number(saltMedium.value);
    const high = Number(saltHigh.value);
    if (!saltMedium.value || !saltHigh.value || !Number.isFinite(medium) || !Number.isFinite(high) || medium < 0 || high <= medium || high > 4) {
      status.textContent = t('Укажи пороги от 0 до 4; красный должен быть выше жёлтого');
      return;
    }
    chrome.storage.local.set({ saltMediumThreshold: medium, saltHighThreshold: high }, () => {
      status.textContent = t('Пороги Salt сохранены');
    });
  }
  saltMedium.addEventListener('change', saveSaltThresholds);
  saltHigh.addEventListener('change', saveSaltThresholds);

  const catalog = [...window.STK_FORMAT_CATALOG, ...values.discoveredFormats.map(({ key, label }) => [key, label])];
  const formats = new Map(catalog);
  const order = [...new Set([...(values.formatOrder || []), ...formats.keys()])].filter(key => formats.has(key));
  const visibility = { ...(values.formatVisibility || {}) };
  const isVisible = key => Object.prototype.hasOwnProperty.call(visibility, key)
    ? visibility[key] : ["premodern", "heritage", "classic", "peak"].includes(key) ? values[key] : true;
  const container = document.getElementById("formatList");
  const persist = () => {
    chrome.storage.local.set({ formatOrder: [...order], formatVisibility: { ...visibility } }, () => {
      status.textContent = t('Порядок и видимость сохранены');
    });
  };
  function render() {
    container.replaceChildren();
    order.forEach(key => {
      const row = document.createElement("div");
      row.className = "format-item";
      row.classList.toggle('is-hidden', !isVisible(key));
      row.draggable = true;
      row.tabIndex = 0;
      row.dataset.key = key;
      row.title = language === 'ru' ? `Перетащи ${formats.get(key)} в нужную колонку` : `Drag ${formats.get(key)} to either column`;
      const handle = document.createElement('span');
      handle.className = 'handle';
      handle.textContent = '⠿';
      handle.setAttribute('aria-hidden', 'true');
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isVisible(key);
      checkbox.addEventListener("change", () => { visibility[key] = checkbox.checked; row.classList.toggle('is-hidden', !checkbox.checked); persist(); });
      label.append(checkbox, document.createTextNode(` ${formats.get(key)}`));
      row.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', key);
        event.dataTransfer.effectAllowed = 'move';
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', event => { event.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', event => {
        event.preventDefault();
        row.classList.remove('drag-over');
        const from = event.dataTransfer.getData('text/plain');
        if (!formats.has(from) || from === key) return;
        order.splice(order.indexOf(from), 1);
        order.splice(order.indexOf(key), 0, from);
        render(); persist();
      });
      row.addEventListener('keydown', event => {
        if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key) || event.target !== row) return;
        event.preventDefault();
        const index = order.indexOf(key);
        const step = event.key === 'ArrowUp' ? -2 : event.key === 'ArrowDown' ? 2 : event.key === 'ArrowLeft' ? -1 : 1;
        const target = index + step;
        if (target < 0 || target >= order.length) return;
        [order[index], order[target]] = [order[target], order[index]];
        render(); persist();
        container.querySelector(`[data-key="${key}"]`)?.focus();
      });
      row.append(handle, label);
      container.append(row);
    });
  }
  render();
});
