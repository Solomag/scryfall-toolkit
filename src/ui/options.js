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
  edhrecUsage: false, edhrecSalt: false, showSaltScale: false, edhrecUsageDisplay: 'both',
  usageColorMetric: 'decks', usageMediumDecks: 50000, usageHighDecks: 100000,
  usageMediumPercent: 1, usageHighPercent: 2.6, saltMediumThreshold: 1, saltHighThreshold: 2,
  printPageSameTab: false,
  printGrouping: false, printFoldGroups: false, printFullPageLink: false,
  // Read with no default, for the reason given in src/core/set-filters.js: a default
  // here would make every old key look as though it had a value, and the migration
  // reads those keys to decide what the reader had chosen.
  setFilters: null, setFiltersMigrated: false,
  taggerSearchLinks: false, cardSearchLinks: true, deckNoPrices: true, stackedDeckCards: true, deckLegality: true,
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
const basicFields = ["clipboard", "printAddButtons", "printPageSameTab", "tags", "cardTags", "artTags", "relationships", "finishBadges", "cardtraderPrices", "euroPriceSources", "edhrecUsage", "edhrecSalt", "showSaltScale", "edhrecUsageDisplay", "usageColorMetric", "legalities", "exportFormat", "taggerSearchLinks", "cardSearchLinks", "deckNoPrices", "stackedDeckCards", "deckLegality", "deckCleanUpImprover", "cleanUpLandsInSingleton", "sortEntriesPrimary", "insertSortingHeadings", "edhrecSuggestions", "deckSearch", "printGrouping", "printFoldGroups", "printFullPageLink"];
// EDHREC and CardTrader are optional features, and so is the access they need.
// Chrome has a place for exactly this: optional_host_permissions, granted only
// when the user turns one of them on. Turning a switch off and on again is also
// how access is put back after it is revoked or after an update.
const OPTIONAL_HOSTS = {
  edhrecUsage: ['https://json.edhrec.com/*'],
  edhrecSalt: ['https://json.edhrec.com/*'],
  // Suggestions need both: the commander page comes from their public JSON, and
  // the recommendations for a deck come from the endpoint their own site posts
  // to. The deck list is what that request carries.
  edhrecSuggestions: ['https://json.edhrec.com/*', 'https://edhrec.com/*'],
  cardtraderPrices: ['https://api.cardtrader.com/*']
};
// What each of those is called in the interface. Every key is listed, so adding a
// feature with a host cannot leave the message showing a storage key to a reader.
const OPTIONAL_HOST_NAMES = {
  edhrecUsage: 'EDHREC', edhrecSalt: 'EDHREC',
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
// The CardTrader box is drawn from two things at once — whether the reader has the token the
// feature needs, and whether the block it adds its links to is on screen — and those two are
// wired in two different storage callbacks, because the token lives with the settings page and
// the block lives with the hiding group. One of them publishes a repaint and the other calls it,
// so there is one place that decides what the box looks like rather than two that disagree.
let repaintCardtrader = null;
let cardtraderWanted = false;
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
  // ---- CardTrader ------------------------------------------------------------------
  //
  // The one feature in this section that cannot work without being set up, so it is the one
  // row whose shape depends on whether it has what it needs. Without a token there is nothing
  // to fetch, and a switch that turns on a request that cannot be made is a switch that lies;
  // so the row shows the feature's name, says it is not connected, and offers to connect. With
  // a token the switch appears and the token becomes something to replace or remove.
  //
  // The status says "saved", not "working", and that is deliberate: nothing on this page asks
  // CardTrader anything, so the only honest thing it can report is what is stored. Whether the
  // token works is answered on a card page, by the request that uses it.
  const token = document.getElementById('cardtraderToken');
  const tokenStatus = document.getElementById('tokenStatus');
  const label = document.getElementById('cardtraderTokenLabel');
  const save = document.getElementById('saveToken');
  const replace = document.getElementById('replaceToken');
  const remove = document.getElementById('removeToken');
  const tokenRow = document.getElementById('cardtraderTokenRow');
  const tokenActions = document.getElementById('cardtraderTokenActions');
  const cardtraderMain = document.getElementById('cardtraderMain');
  const cardtraderToggle = document.getElementById('cardtraderToggle');
  const cardtraderPanel = document.getElementById('cardtraderPanel');
  function showTokenState(stored, replacing = false) {
    tokenStatus.dataset.stored = stored ? 'yes' : 'no';
    tokenStatus.textContent = t(stored ? 'Токен сохранён ✓' : 'Не подключено');
    // A checkbox the reader cannot see is not a control, it is a decoration: without a token
    // the switch is hidden rather than disabled, because a disabled switch says "this exists
    // and you may not have it" and this one does not exist yet.
    cardtraderMain.classList.toggle('is-unconnected', !stored);
    cardtraderToggle.textContent = t(stored ? 'Настроить' : 'Подключить');
    label.textContent = t('Личный API-токен CardTrader');
    token.placeholder = t(stored ? 'Введите новый токен для замены сохранённого' : 'Вставь личный токен');
    save.textContent = t('Сохранить');
    tokenRow.hidden = stored && !replacing;
    tokenActions.hidden = !stored;
    if (!stored || replacing) token.value = '';
    // Whatever the token state is, the box is redrawn: with a token it appears, and it appears
    // disabled if the block its links go in is hidden.
    repaintCardtrader?.();
  }
  showTokenState(Boolean(values.cardtraderToken));
  // The reader's own answer for CardTrader, kept here rather than read back from the box: the
  // box is drawn empty while the store block is hidden, and an empty box is not an answer.
  cardtraderWanted = values.cardtraderPrices === true;
  document.getElementById('cardtraderPrices').addEventListener('change', event => {
    cardtraderWanted = event.target.checked;
    repaintCardtrader?.();
  });
  settingsLanguage.addEventListener('change', () => {
    // The raw selection is saved, whatever it resolves to right now.
    selected = ['auto', 'ru', 'en'].includes(settingsLanguage.value) ? settingsLanguage.value : 'auto';
    language = window.STK_I18N.resolveSettingsLanguage(selected);
    window.STK_I18N.localizeOptions(language);
    showTokenState(tokenStatus.dataset.stored === 'yes', !tokenRow.hidden);
    document.querySelectorAll('#formatList .format-item').forEach(row => { row.title = language === 'ru' ? `Перетащи ${formats.get(row.dataset.key)} в нужную колонку` : `Drag ${formats.get(row.dataset.key)} to either column`; });
    status.textContent = t('Сохранено');
    chrome.storage.local.set({ settingsLanguage: selected });
  });
  siteLanguage.addEventListener('change', () => {
    chrome.storage.local.set({ siteLanguage: siteLanguage.value === 'ru' ? 'ru' : 'en' }, () => { status.textContent = t('Сохранено'); });
  });
  save.addEventListener('click', () => {
    const value = token.value.trim();
    if (!value || /\s/.test(value)) { status.textContent = t('Вставь токен без пробелов'); return; }
    chrome.storage.local.set({ cardtraderToken: value }, () => {
      token.value = '';
      // The field is emptied as soon as the token is stored, so a stored token is never on
      // screen — not even in a password field, which is one Tab and one screen-share away
      // from being read out.
      showTokenState(true, false);
      status.textContent = t('Токен сохранён; цены проверятся на странице карты');
    });
  });
  // Replacing is a second step on purpose: the field appears when it is asked for and not
  // before, so a reader who opened the panel to look at something else cannot overwrite a
  // working token by typing into a box that was already there.
  replace.addEventListener('click', () => showTokenState(true, true));
  remove.addEventListener('click', () => {
    chrome.storage.local.remove('cardtraderToken', () => {
      document.getElementById('cardtraderPrices').checked = false;
      document.getElementById('euroPriceSources').value = 'cm';
      chrome.storage.local.set({ cardtraderPrices: false, euroPriceSources: 'cm' });
      showTokenState(false);
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
    // The visibility section's picture, and the notes that used to be eleven lines of grey text
    // under the switches.
    //
    // The paragraphs went because they described the rules rather than answering anything: an
    // empty list does not put the platforms back, a legitimate choice, a set whose platform
    // could not be determined. A reader who has not hit one of those cannot act on it, and a
    // reader who has can get the same answer from the switch they are looking at. What is here
    // instead is the one thing that is not visible from the controls: that a platform keeps its
    // places while it is off, and why a card stays when one of two platforms is switched off.
    visibility: {
      src: '../../assets/shots/hide-extra.png',
      caption: 'Та же колонка без цифровых наборов и без цен в долларах и билетах: остались бумажные наборы и цена в евро.',
      notes: [
        'Каждая платформа включается отдельно в каждом из трёх мест: «Издания», «Поиск» и «Список сетов». Снимите галочку «Показывать», чтобы выключить платформу целиком, — её места запомнятся и вернутся вместе с ней.',
        'Издание может быть на нескольких платформах. Если выключена Arena, карты, доступные ещё и на Paper, остаются.',
        'Набор, у которого платформу определить не удалось, остаётся видимым.',
        'Цена в евро — это цена Cardmarket; её можно скрыть так же, как доллары и билеты.'
      ]
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
  // The help that belongs to one feature rather than to a section: no picture, because what
  // moved here is a paragraph and not a panel. It is the same dialog, so a reader who has used
  // one "?" on this page has used all of them — and it is a button, so it is reachable by Tab
  // and opened by Enter or Space, which a `title` tooltip is not.
  //
  // These paragraphs used to stand in the body under the switches they explain. A settings page
  // that argues with itself about thresholds before the reader has decided to change one is a
  // page that looks like a form to fill in, and every one of these settings works untouched.
  const FEATURE_HELP = {
    finishes: {
      caption: 'Доступная отделка изданий',
      notes: [
        'У издания бывает не вся отделка: только фойл, только нефойл, только etched или особый фойл. Когда это так, в таблице изданий между названием и ценами появляется узкий столбец с тем, что у издания есть.',
        'Обычные звёздочки фойла в названиях изданий при этом не дублируются. Данные приходят из Scryfall и могут появиться после загрузки страницы.'
      ]
    },
    usage: {
      caption: 'Популярность в Commander',
      notes: [
        'Показатели встраиваются под форматы. Дробь показывает количество колод с картой среди подходящих по цветовой идентичности.',
        'По умолчанию популярность окрашивается по абсолютному количеству колод: зелёный ниже 50 000, жёлтый от 50 000, красный от 100 000. При выборе доли — зелёный до 1% включительно, жёлтый выше 1%, красный от 2,6%.'
      ]
    },
    salt: {
      caption: 'Salt Meter',
      notes: [
        'Salt Score — оценка сообщества от 0 до 4, не сила карты. По умолчанию зелёный до 1, жёлтый от 1, красный от 2.',
        'Шкала «/4» показывает рядом с показателем, какому значению соответствует цвет.'
      ]
    },
    cardtrader: {
      caption: 'Предложения CardTrader',
      notes: [
        'Для цен CardTrader нужен токен. Он хранится локально в расширении и передаётся только в API CardTrader.',
        'Цены в таблице появляются постепенно; учитываются предложения в EUR. Состояние и язык могут отличаться.',
        'Сохранённый токен не проверяется этой страницей: она не делает запросов к CardTrader. Работает он или нет, видно на странице карты.'
      ]
    },
    eursource: {
      caption: 'Источники EUR-цен в таблице изданий',
      notes: [
        'Столбец EUR на Scryfall — это цена Cardmarket. Здесь выбирается, чем его заполнять: Cardmarket, CardTrader или обоими — тогда рядом появляется второй столбец. «Не показывать» убирает столбец целиком и снимает галочку EUR в группе «Цены»: это одна настройка с двумя ручками.',
        'Пока галочка EUR снята, список заблокирован: выбирать источник для столбца, которого нет, нечего.',
        'Для цен CardTrader нужен личный токен, и задаётся он в строке «Предложения CardTrader» выше, в том же блоке магазинов.',
        'Включать саму галочку «Предложения CardTrader» для этого не обязательно: она добавляет ссылки CardTrader в блок покупки, а столбец работает и без них.'
      ]
    }
  };
  const shotDialog = document.getElementById('shotDialog');
  const shotImage = document.getElementById('shotImage');
  const shotCaption = document.getElementById('shotCaption');
  const shotNotes = document.getElementById('shotNotes');
  // One dialog, two kinds of entry: a section's illustration with its caption, and a feature's
  // help with no picture at all. `replaceChildren` on the notes and `hidden` on the image, both
  // every time, because the dialog is reused and a picture must not keep the last entry's notes
  // or the other way round.
  const openDialog = entry => {
    shotCaption.textContent = t(entry.caption);
    shotNotes.replaceChildren(...(entry.notes || []).map(note => {
      const line = document.createElement('p');
      line.textContent = t(note);
      return line;
    }));
    shotNotes.hidden = !(entry.notes || []).length;
    if (entry.src) {
      shotImage.src = entry.src;
      shotImage.alt = t(entry.caption);
      shotImage.hidden = false;
    } else {
      shotImage.removeAttribute('src');
      shotImage.alt = '';
      shotImage.hidden = true;
    }
    shotDialog.showModal();
  };
  // A "?" with nothing behind it is worse than no "?" at all, so a name the page does not know
  // fails loudly here rather than opening an empty frame.
  const wireDialogButton = (button, table, key) => {
    const entry = table[key];
    if (!entry) {
      console.error('no help named ' + key + '; the button will do nothing');
      button.disabled = true;
      return;
    }
    button.addEventListener('click', () => openDialog(entry));
  };
  document.querySelectorAll('.shot-button').forEach(button => {
    button.setAttribute('aria-label', t('Показать, как это выглядит'));
    wireDialogButton(button, SHOTS, button.dataset.shot);
  });
  document.querySelectorAll('.feature-help').forEach(button => {
    button.setAttribute('aria-label', t('Что это'));
    wireDialogButton(button, FEATURE_HELP, button.dataset.help);
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

// The platforms table: one row per platform, a column per place, and every control a checkbox.
//
// Written rather than typed, so a fourth platform is one entry in the model's PLATFORM_NAMES and
// a fourth place one entry in its AREAS. A column of sliders and a row of boxes do not read as
// one thing, so the "Show" column is a checkbox like the other three.
//
// A platform's own box writes `show` and its three place boxes write their own keys, and neither
// writes the other's. That is the whole of "turning a platform off keeps its settings", and it
// is achieved by neither control being able to rewrite the other rather than by saving and
// restoring.
const head = document.getElementById('platformHead');
const body = document.getElementById('platformBody');

// The header, from the model: the platform's name column, the Show column, then one per place.
// `scope` on each so a screen reader says the column when a box is reached, and the boxes carry
// their own name — "Paper: показывать в поиске" rather than the column header alone, which is
// what a table of twelve checkboxes otherwise gets you.
const headCell = (text, scope) => {
  const cell = document.createElement('th');
  // `setAttribute`, not the `scope` property: a browser reflects one into the other and a
  // stand-in DOM does not, so the property form is the kind that looks right here and is
  // absent under test. The attribute is what the browser reads anyway.
  cell.setAttribute('scope', scope);
  cell.textContent = text;
  return cell;
};
head.append(headCell(t(FILTERS.PLATFORM_COLUMN.label), 'col'));
head.append(headCell(t(FILTERS.SHOW_COLUMN.label), 'col'));
for (const area of FILTERS.AREA_NAMES) head.append(headCell(t(FILTERS.AREAS[area].label), 'col'));

for (const name of FILTERS.PLATFORM_NAMES) {
  const row = document.createElement('tr');
  const label = FILTERS.PLATFORM_LABELS[name];

  const nameCell = document.createElement('th');
  nameCell.setAttribute('scope', 'row');
  nameCell.textContent = label;
  row.append(nameCell);

  // A checkbox in a cell, with the label wrapping it so the whole cell is the hit area. That is
  // what makes a 18px box comfortable to press: the target is the cell, not the glyph.
  const cellWith = (box, aria) => {
    const cell = document.createElement('td');
    const wrap = document.createElement('label');
    wrap.className = 'stk-cell-check';
    box.setAttribute('aria-label', `${label}: ${t(aria)}`);
    wrap.append(box);
    cell.append(wrap);
    return cell;
  };

  const show = document.createElement('input');
  show.type = 'checkbox';
  show.className = 'stk-check';
  show.id = 'show' + name[0].toUpperCase() + name.slice(1);
  show.dataset.platform = name;
  show.dataset.kind = 'show';
  // In the header's order: the name, then the platform's own box, then its three places. The
  // row was once assembled by appending the places and then prepending the box, which put the
  // Show box in the *name* column and shifted every heading one column to the left of the box
  // it named — a table that looks right in its markup and draws every control under the wrong
  // heading. Nothing could see it: the ids were right and the assertions read the boxes by id.
  row.append(cellWith(show, FILTERS.SHOW_COLUMN.aria));
  const places = {};
  for (const area of FILTERS.AREA_NAMES) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'stk-check';
    box.id = show.id + '-' + area;
    box.dataset.which = area;
    box.dataset.platform = name;
    places[area] = box;
    row.append(cellWith(box, FILTERS.AREAS[area].aria));
  }

  // One place where the row's state is written to the page, because a platform off means two
  // things at once — three boxes emptied and disabled — and doing that in two listeners is how
  // one of them ends up disagreeing with the other.
  //
  // Nothing here touches the stored value. A platform switched off keeps its three places
  // exactly as they were, and switching it back on brings them out again; the dimming is the
  // page saying what is in force, not the page throwing the answer away. Nothing corrects an
  // empty row either: a reader who unticks all three places on a platform that is on has said
  // so, and neither the places nor the platform's own box is moved on their behalf.
  const paint = () => {
    const on = filters.platforms[name].show !== false;
    row.classList.toggle('is-off', !on);
    for (const area of FILTERS.AREA_NAMES) {
      const box = places[area];
      box.checked = on && filters.platforms[name].areas[area] !== false;
      box.disabled = !on;
    }
    // The platform's own box stays operable whatever else is true of the row: it is the only
    // way back, and a disabled control that is the only way out of a state is a trap.
    show.checked = on;
  };
  show.addEventListener('change', () => {
    filters.platforms[name].show = show.checked;
    paint();
    saveFilters();
  });
  for (const area of FILTERS.AREA_NAMES) {
    places[area].addEventListener('change', () => {
      filters.platforms[name].areas[area] = places[area].checked;
      paint();
      saveFilters();
    });
  }
  paint();
  body.append(row);
}

// The prices in two groups: a currency is a column of numbers, a shop is a link, and the grouping
// says so without a paragraph saying so.
//
// The blocks are in the markup and this fills them, because the general switch over the shop block
// is markup too and belongs above the shops it governs: a master drawn after them would read as a
// summary. Filling rather than creating keeps the model the only list of shops — a fourth shop is
// one entry in PRICE_KINDS and nothing here — and a group the markup does not have a block for is
// reported rather than silently dropped.
//
// Each caption sits directly above the boxes it names. Beside them it needed a column as wide as
// the longest caption, and that column is empty on every other row.
//
// Positive — ticked means shown — like everything else in this section. These were the last
// negative switches on the page, and the group above them needed a legend reading "which prices to
// hide" to make unticked boxes mean "everything is on".
const priceBoxes = {};
for (const group of FILTERS.PRICE_GROUP_NAMES) {
  const block = document.getElementById('priceGroup-' + group);
  if (!block) {
    console.error('no block for the price group ' + group + '; its prices cannot be shown');
    continue;
  }
  block.querySelector('.pair-caption').textContent = t(FILTERS.PRICE_GROUPS[group]);
  const items = block.querySelector('.pair-items');
  for (const [kind, entry] of Object.entries(FILTERS.PRICE_KINDS)) {
    if (entry.group !== group) continue;
    const label = document.createElement('label');
    label.className = 'pair-item';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'stk-check';
    box.id = 'price-' + kind;
    box.dataset.which = kind;
    box.checked = filters.prices[kind] !== false;
    box.setAttribute('aria-label', `${entry.label}: ${t('показывать')}`);
    box.addEventListener('change', () => {
      filters.prices[kind] = box.checked;
      saveFilters();
    });
    priceBoxes[kind] = box;
    label.append(box, document.createTextNode(' ' + entry.label));
    items.append(label);
  }
}

  // The switches that live outside this section's rules and are not drawn from a table: the
  // Caster marker, the deck tokens and the whole "Buy This Card" block. The tokens sit with the
  // deck tools and the other two here, and this loop does not care which is where — the model
  // does not group them and neither does it.
  for (const [id, key] of [['setCaster', 'showCaster'], ['setTokens', 'tokens']]) {
    const box = document.getElementById(id);
    box.checked = filters[key] !== false;
    box.addEventListener('change', () => {
      filters[key] = box.checked;
      saveFilters();
    });
  }

  // The whole "Buy This Card" block, which is the general switch over the shops.
  //
  // A shop is a link inside that block, so with the block hidden there is nowhere for it to be
  // shown and its box has nothing to say. It is drawn off and out of reach while the block is
  // hidden — the platform pattern, and for the same reason: the reader's per-shop choices are
  // what the boxes are drawn from, not what they write, so turning the block off and on again
  // brings the shops back as they were rather than resetting them.
  //
  // CardTrader is one of those links, and this is where that is visible: its box is governed by
  // the same switch, and the two are drawn together. What the reader wants for it is kept in
  // `cardtraderWanted` rather than read back from the box, because the box is emptied while the
  // block is hidden and an emptied box is not an answer.
  //
  // The block itself is stored on its own key. It is not a price kind, so nothing that walks
  // `prices` can find it, and the card page's boot gate names it separately.
  const setStores = document.getElementById('setStores');
  const cardtraderBox = document.getElementById('cardtraderPrices');
  repaintCardtrader = () => {
    const connected = tokenStatus.dataset.stored === 'yes';
    const block = filters.showStores !== false;
    cardtraderBox.disabled = !connected || !block;
    cardtraderBox.checked = connected && block && cardtraderWanted;
  };
  const paintStores = () => {
    const on = filters.showStores !== false;
    for (const [kind, entry] of Object.entries(FILTERS.PRICE_KINDS)) {
      if (entry.group !== 'links') continue;
      const box = priceBoxes[kind];
      if (!box) continue;
      box.disabled = !on;
      box.checked = on && filters.prices[kind] !== false;
    }
    repaintCardtrader();
  };
  setStores.checked = filters.showStores !== false;
  setStores.addEventListener('change', () => {
    filters.showStores = setStores.checked;
    paintStores();
    saveFilters();
  });
  paintStores();

  // The EUR box and the EUR source are two views of one question, and this is where they are kept
  // in step. The box says whether the euro column exists; the dropdown says whose number is in it.
  // The dropdown cannot choose a source for a column that is not there, so it is blocked while the
  // box is unticked and set to "show nothing" to say so.
  //
  // Blocking is a transparent button over the select rather than `disabled` on it, because a
  // disabled select swallows the click and a reader who reaches for it would find a dead control
  // with no explanation. The button is reachable by keyboard and says why when it is pressed.
  const euroBox = priceBoxes.eur;
  const euroSource = document.getElementById('euroPriceSources');
  const euroShield = document.getElementById('euroSourceShield');
  const paintEuro = () => {
    const on = filters.prices.eur !== false;
    euroSource.disabled = !on;
    euroShield.hidden = on;
    euroShield.setAttribute('aria-label', t('Нельзя выбрать источник цены, пока цена не показывается.'));
  };
  const flashEuro = () => {
    euroBox.classList.remove('stk-blink');
    // Read back a layout property so the class is re-added to an element the browser has already
    // animated: without it, pressing the shield twice in a row flashes once.
    void euroBox.offsetWidth;
    euroBox.classList.add('stk-blink');
    setTimeout(() => euroBox.classList.remove('stk-blink'), 1600);
    status.textContent = t('Нельзя выбрать источник цены, пока цена не показывается.');
  };
  euroShield.addEventListener('click', flashEuro);
  euroBox.addEventListener('change', () => {
    filters.prices.eur = euroBox.checked;
    if (!euroBox.checked) {
      euroSource.value = 'none';
      chrome.storage.local.set({ euroPriceSources: 'none' });
    } else if (euroSource.value === 'none') {
      // Something to fill the column with, because the box just said there is one. The default,
      // and the only value this page can pick without inventing a preference.
      euroSource.value = 'cm';
      chrome.storage.local.set({ euroPriceSources: 'cm' });
    }
    paintEuro();
    saveFilters();
  });
  euroSource.addEventListener('change', () => {
    // The dropdown can still be set to "show nothing" by a reader who wants the column gone, and
    // that is the same answer as unticking the box: they are one setting with two handles, so the
    // box follows the dropdown the same way the dropdown follows the box.
    filters.prices.eur = euroSource.value !== 'none';
    euroBox.checked = filters.prices.eur;
    paintEuro();
    saveFilters();
  });
  paintEuro();

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

  // ---- the feature rows and their panels -------------------------------------------
  //
  // One rule for every disclosure on the page: the button carries `aria-controls` and
  // `aria-expanded`, and the panel is the element it names. Nothing here writes to storage,
  // which is the whole of "opening a panel changes nothing": the settings inside it were saved
  // when they were last edited and they keep working while the panel is shut.
  //
  // `aria-expanded` is on the button rather than on the panel because that is what a screen
  // reader reads out when the button is reached — "Настроить, collapsed" — and a state a
  // reader cannot hear is a state that does not exist for them.
  document.querySelectorAll('button[aria-controls]').forEach(button => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) {
      console.error('no panel named ' + button.getAttribute('aria-controls') + '; the button will do nothing');
      button.disabled = true;
      return;
    }
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
    });
  });
  // A reset is one feature's parameters and nothing else. It writes the same defaults the page
  // starts a new reader with — the numbers live in `defaults` above, which is also what
  // `chrome.storage.local.get` fills a fresh install from, so the two cannot drift — and it
  // does not touch the switch, because "these numbers are wrong" is not "turn this off".
  const resetFeature = (buttonId, keys) => {
    document.getElementById(buttonId).addEventListener('click', () => {
      const restored = {};
      for (const key of keys) restored[key] = defaults[key];
      chrome.storage.local.set(restored, () => {
        for (const key of keys) {
          const element = document.getElementById(key);
          if (!element) continue;
          if (element.type === 'checkbox') element.checked = Boolean(defaults[key]);
          else element.value = defaults[key];
        }
        showUsageThresholds();
        status.textContent = t('Стандартные настройки восстановлены');
      });
    });
  };
  resetFeature('resetUsage', ['edhrecUsageDisplay', 'usageColorMetric',
    'usageMediumDecks', 'usageHighDecks', 'usageMediumPercent', 'usageHighPercent']);
  resetFeature('resetSalt', ['showSaltScale', 'saltMediumThreshold', 'saltHighThreshold']);

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