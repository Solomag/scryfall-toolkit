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
  clipboard: true, printAddButtons: true, darkTheme: 'auto', hideDigitalSets: false, hideNonTournamentSets: false, hideOversizedSets: false, hideForeignBlackBorder: false, hideNonEnglishPrints: false, tags: true, cardTags: true, artTags: false, relationships: true, onlyCardmarket: false,
  finishBadges: true, cardtraderPrices: false, cardtraderToken: '', euroPriceSources: 'cm',
  edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecLink: false, edhrecUsageDisplay: 'both',
  usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
  usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
  hideCasterIndicator: false, printPageSameTab: false,
  printGrouping: false, printFoldGroups: false, printFullPageLink: false,
  setPlatforms: ['paper', 'arena', 'mtgo'],
  taggerSearchLinks: false, cardSearchLinks: true, cardNicknames: true, deckNoPrices: true, stackedDeckCards: true, deckTokens: true,
  deckCleanUpImprover: false, cleanUpLandsInSingleton: true, sortEntriesPrimary: 'none', insertSortingHeadings: true,
  edhrecSuggestions: false, deckSearch: false,
  legalities: true, exportFormat: "moxfield", formatOrder: null, formatVisibility: null,
  discoveredFormats: [], premodern: true, heritage: false, classic: false, peak: false
};
const basicFields = ["clipboard", "printAddButtons", "printPageSameTab", "hideCasterIndicator", "hideDigitalSets", "hideNonTournamentSets", "hideOversizedSets", "hideForeignBlackBorder", "hideNonEnglishPrints", "tags", "cardTags", "artTags", "relationships", "finishBadges", "onlyCardmarket", "cardtraderPrices", "euroPriceSources", "edhrecUsage", "edhrecSalt", "showSaltScale", "edhrecLink", "edhrecUsageDisplay", "usageColorMetric", "legalities", "exportFormat", "taggerSearchLinks", "cardSearchLinks", "cardNicknames", "deckNoPrices", "stackedDeckCards", "deckTokens", "deckCleanUpImprover", "cleanUpLandsInSingleton", "sortEntriesPrimary", "insertSortingHeadings", "edhrecSuggestions", "deckSearch", "printGrouping", "printFoldGroups", "printFullPageLink"];
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
// The hosts each optional feature needs, and what turns them on. euroPriceSources
// is the one that is easy to miss: choosing CardTrader as the EUR source reaches
// api.cardtrader.com whether or not the CardTrader switch is on, so it has to ask
// for the host too.
// A feature that is already on can still be missing a host it needs: hosts get
// added over time and the grant the user gave covers only what existed then. A
// missing host does not fail loudly — the feature quietly falls back to
// something blander and nobody knows why. So the settings page checks what an
// enabled feature has and asks for what is missing.
function reconcileHostAccess(values) {
  if (!chrome.permissions || !chrome.permissions.contains) return;
  for (const [key, hosts] of Object.entries(OPTIONAL_HOSTS)) {
    if (!values[key] || !hosts.length) continue;
    chrome.permissions.contains({ origins: hosts }, has => {
      if (has) return;
      // Silent by design: Chrome only wants a request that follows a click, and
      // one fired while the page loads is refused. The button below is the
      // deliberate way, and this just stops a feature running half granted.
      requestHostAccess(hosts);
    });
  }
}
function optionalHostsFor(key, value) {
  if (key === 'euroPriceSources') {
    return value === 'ct' || value === 'both' ? ['https://api.cardtrader.com/*'] : [];
  }
  return OPTIONAL_HOSTS[key] || [];
}
function requestHostAccess(origins) {
  if (!origins || !origins.length || !chrome.permissions || !chrome.permissions.request) return Promise.resolve(true);
  return new Promise(resolve => {
    try {
      chrome.permissions.request({ origins }, granted => resolve(Boolean(granted)));
    } catch (error) {
      resolve(false);
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
  // The captions are written in Russian and run through the same translator as the
  // rest of the page, because this text is created after the page is localized.
  const SHOTS = {
    tags: {
      src: '../../assets/shots/tags.png',
      caption: 'Так это выглядит на странице карты: таблицы тегов карты и тегов арта.'
    },
    cardclip: {
      src: '../../assets/shots/cardclip.png',
      caption: 'Буфер в углу страницы: собранные карты, каждую можно скопировать отдельно.'
    },
    'hide-extra': {
      src: '../../assets/shots/hide-extra.png',
      caption: 'Таблица изданий без цифровых сетов и без цен в валютах, которые вы скрыли.'
    },
    additional: {
      src: '../../assets/shots/additional.png',
      caption: 'Отдельный столбец отделки у каждого издания: Nonfoil, Foil, Etched.'
    },
    legality: {
      src: '../../assets/shots/legality.png',
      caption: 'Форматы, которых нет на странице карты Scryfall, добавлены в блок легальности.'
    },
    prints: {
      src: '../../assets/shots/prints.png',
      caption: 'Все издания собраны в одной таблице и сгруппированы по сетам.'
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
      requestHostAccess(missing).then(granted => {
        status.textContent = granted
          ? t('Доступ к хосту выдан — перезагрузи открытые страницы.')
          : t('Доступ не выдан.');
      });
    });
  }
  reconcileHostAccess(values);
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
        requestHostAccess(needs).then(granted => {
          if (!granted) {
            // Without its host the feature reaches nothing, so the control goes
            // back to what storage holds rather than saving a switch that only
            // looks like it works.
            if (element.type === 'checkbox') element.checked = Boolean(values[key]);
            else if (values[key] !== undefined) element.value = values[key];
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
  // Platform checkboxes behave as one control: "All" mirrors the three
  // platforms, and unchecking the last one falls back to All so the set lists
  // never end up empty.
  const platformBoxes = ['paper', 'arena', 'mtgo'].map(name => ({ name, element: document.getElementById('setPlatforms' + name[0].toUpperCase() + name.slice(1)) }));
  const platformAll = document.getElementById('setPlatformsAll');
  function selectedPlatforms() {
    return platformBoxes.filter(box => box.element.checked).map(box => box.name);
  }
  function showPlatforms(chosen) {
    for (const box of platformBoxes) box.element.checked = chosen.includes(box.name);
    platformAll.checked = platformBoxes.every(box => box.element.checked);
  }
  function savePlatforms() {
    // A list with nothing in it is not a choice this setting can hold, so it
    // snaps back to all. It has to save that too: drawing all three while
    // storage kept the one the user had just removed meant a reload brought it
    // straight back.
    const chosen = selectedPlatforms();
    const next = chosen.length ? chosen : platformBoxes.map(box => box.name);
    showPlatforms(next);
    chrome.storage.local.set({ setPlatforms: next }, () => { status.textContent = t('Сохранено'); });
  }
  const storedPlatforms = Array.isArray(values.setPlatforms) ? values.setPlatforms.filter(name => platformBoxes.some(box => box.name === name)) : [];
  showPlatforms(storedPlatforms.length ? storedPlatforms : platformBoxes.map(box => box.name));
  platformAll.addEventListener('change', () => {
    if (platformAll.checked) showPlatforms(platformBoxes.map(box => box.name));
    else showPlatforms([]);
    savePlatforms();
  });
  for (const box of platformBoxes) box.element.addEventListener('change', () => {
    platformAll.checked = platformBoxes.every(entry => entry.element.checked);
    savePlatforms();
  });

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
