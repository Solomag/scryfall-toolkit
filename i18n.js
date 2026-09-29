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
// Keep the popup language independent of labels added to Scryfall and Tagger.
(() => {
// The settings language can follow the browser rather than being pinned. The
// three languages the interface is written in get Russian; every other
// language gets English, so nobody lands on a page that is neither. These are
// language codes, not countries: uk is Ukrainian, while the United Kingdom is
// GB and arrives as en-GB, which correctly falls through to English.
const SETTINGS_LANGUAGES = ['ru', 'be', 'uk'];
const resolveSettingsLanguage = value => {
  if (value === 'ru' || value === 'en') return value;
  const list = (navigator.languages && navigator.languages.length
    ? navigator.languages : [navigator.language || ''].filter(Boolean));
  return list.some(tag => {
    const base = String(tag).toLowerCase().split('-')[0];
    return SETTINGS_LANGUAGES.includes(base);
  }) ? 'ru' : 'en';
};

  const en = {
    'Настройки расширения для Scryfall': 'Extension settings for Scryfall',
    'Язык настроек': 'Settings language',
    'Язык интерфейса Scryfall и Tagger': 'Scryfall and Tagger interface language',
    'Язык добавляемых элементов и основных элементов Scryfall. Тексты карт и статей не переводятся.': 'Language of extension controls and common Scryfall controls. Card text and articles are not translated.',
    'Русский': 'Russian', 'Английский': 'English',
    'Авторы и сторонние проекты': 'Credits and third-party projects',
    'Расширение независимо: оно не создано, не одобрено и не спонсировано Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket или Moxfield. В сборке лежат файлы других проектов под лицензией MIT с сохранёнными уведомлениями: иконки — CardClip (Jacob Hearst), данные тегов — MoxTags v1.8.3 (Nate Finch), названия карт — Shambleshark (Samuel Simões, Blade Barringer), дополнительные форматы — MTG Enhancements (notsonic). Полный список файлов и лицензий — в THIRD_PARTY_NOTICES.md и third_party/ внутри архива расширения.': 'This extension is independent: it is not produced, endorsed or sponsored by Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket or Moxfield. The build carries files from other projects under their own MIT licences with their notices preserved: icons from CardClip (Jacob Hearst), tag data from MoxTags v1.8.3 (Nate Finch), card nicknames from Shambleshark (Samuel Simões, Blade Barringer), extra formats from MTG Enhancements (notsonic). The full file and licence list is in THIRD_PARTY_NOTICES.md and third_party/ inside the extension archive.',
    'Тема': 'Theme',
    'Открыть все настройки': 'Open all settings',
    'Быстрые настройки': 'Quick settings',
    'Общее': 'General', 'Общий буфер карт на Scryfall и Tagger': 'Shared card clipboard on Scryfall and Tagger',
    'Тема Scryfall и Tagger': 'Scryfall and Tagger theme', 'Как в системе': 'Follow the system', 'Светлая': 'Light', 'Тёмная': 'Dark',
    'По умолчанию тема повторяет системную тему компьютера или телефона и переключается вместе с ней.': 'By default the theme follows the system theme of your computer or phone and switches with it.',
    'Скрытие лишнего': 'Hide extras',
    'Скрывать цены в USD, TIX, TCGplayer и Cardhoarder': 'Hide USD, TIX, TCGplayer and Cardhoarder prices',
    'Дополнительная информация': 'Additional info',
    'Издания': 'Prints',
    'Группировать издания по сетам': 'Group printings by set',
    'Собирает все издания карты в нативной таблице и делит их на группы по сетам. Пока выключено, страница остаётся в обычном виде Scryfall.': 'It collects every printing of the card in the native table and splits them into set groups. While it is off, the page stays in Scryfall’s usual shape.',
    'Сворачивать группы (Collapse all groups)': 'Fold groups (Collapse all groups)',
    'Ссылка на полный список изданий рядом': 'Full printings link beside it',
    'Теги': 'Tags',
    'Таблицы тегов и связанных карт на странице карты. Пока выключено, настройки ниже заблокированы.': 'The tag and related-card tables on a card page. While it is off, the settings below are locked.',
    'Ссылка на Tagger работает независимо от переключателя «Теги».': 'The Tagger link works on its own, whatever the Tags switch says.',
    'Общий буфер карт на Scryfall и Tagger. Пока выключено, формат копирования и плюс у отдельных изданий заблокированы.': 'The card clipboard shared by Scryfall and Tagger. While it is off, the copy format and the per-printing plus button are locked.',
    'Исторические прозвища карт в предпросмотре Scryfall': 'Historical card nicknames in Scryfall previews',
    'Прозвище появляется под таблицей изданий, когда карта выходила под другим именем. Например, Lavabrink Venturer (IKO #19) — «Professional Stunt Performer», Barbed Spike (MH2 #5) — «Barbed Flier».': 'The nickname appears under the prints table when a card was released under another name. For example, Lavabrink Venturer (IKO #19) is “Professional Stunt Performer” and Barbed Spike (MH2 #5) is “Barbed Flier”.',
    'Scryfall Deckbuilder': 'Scryfall Deckbuilder',
    'Тёмная тема Scryfall': 'Scryfall dark theme', 'Скрыть индикатор Caster ON': 'Hide Caster ON indicator',
    'Скрывать цифровые сеты на странице Sets и в Prints': 'Hide digital-only sets on Sets and in Prints',
    'Скрываются цифровые сеты и кубы из списка Scryfall; выбранное издание остаётся видимым на собственной странице карты.': 'Hide Scryfall digital-only sets and online cubes; the currently viewed printing remains visible on its own card page.',
    'Скрывать нетурнирные сеты (сувениры, официальные прокси, токены)': 'Hide non-tournament sets (memorabilia, official proxies, tokens)',
    'Скрывать увеличенные карты (oversized) отдельно': 'Hide oversized sets separately',
    'Скрывать Foreign Black Border сеты (4BB, FBB, BCHR)': 'Hide Foreign Black Border sets (4BB, FBB, BCHR)',
    'Скрывать неанглийские издания в Prints (Portal, Secret Lair и другие)': 'Hide non-English printings in Prints (Portal, Secret Lair and others)',
    'Фильтры сетов действуют в Sets и Prints, фильтр языка — только в Prints. Текущее издание остаётся видимым; смешанные сеты с легальными картами сохраняются.': 'Set filters apply to Sets and Prints; the language filter applies only to Prints. The current printing stays visible, and mixed sets containing legal cards remain listed.',
    'Платформы: какие сеты показывать': 'Platforms: which sets to show',
    'Экспериментальное': 'Experimental',
    'Эта настройка ещё уточняется и может измениться или исчезнуть.': 'This setting is still being worked on and may change or go away.',
    'Эти настройки ещё уточняются и могут измениться или исчезнуть.': 'These settings are still being worked on and may change or go away.',
    'Все (Paper, Arena, Magic Online)': 'All (Paper, Arena, Magic Online)',
    'Отметьте одну или несколько платформ: показываются только сеты выбранных платформ. Paper — все обычные сеты, Arena и Magic Online — только их цифровые сеты. Фильтр работает в Sets и в Prints, а в поле сетов на странице Advanced search учитываются ещё и галки Games над этим полем.': 'Tick one or more platforms: only sets of the chosen platforms are shown. Paper covers every regular set, Arena and Magic Online only their digital sets. The filter works in Sets and in Prints, while the set field of Advanced search also follows the Games checkboxes above it.',
    'Скрываются только целиком цифровые сеты из каталога Scryfall; поиск отдельных карт не меняется.': 'Only sets that exist exclusively in digital form are hidden from Scryfall’s Sets index. Individual card searches are unchanged.',
    'Страница карты': 'Card page', 'Теги карт на странице карты': 'Show tags on card pages',
    'Какие теги показывать': 'Tags to display', 'Связанные карты': 'Related cards',
    'Отдельный столбец отделки выпусков: Nonfoil, Foil, Etched, особый фойл': 'Separate printing finish column: Nonfoil, Foil, Etched, special foil',
    'Плюс для отдельного издания при наведении в полном списке': 'Show add button on hover for each printing in the expanded list',
    'Открывать полный список изданий в этой же вкладке': 'Open the full printings list in this same tab',
    'Скрыть USD, TIX, TCGplayer и Cardhoarder': 'Hide USD, TIX, TCGplayer and Cardhoarder',
    'Показывать использование в колодах Commander': 'Show Commander deck usage',
    'Показывать значок-ссылку EDHREC': 'Show EDHREC icon and link',
    'Как показывать использование': 'Usage display',
    'Дробь и процент': 'Fraction and percentage', 'Только дробь': 'Fraction only', 'Только процент': 'Percentage only',
    'Окрашивать популярность по': 'Color popularity by', 'Количеству колод': 'Deck count', 'Доле подходящих колод': 'Eligible deck percentage',
    'Жёлтый: от': 'Yellow: from', 'Жёлтый: более': 'Yellow: above', 'Красный: от': 'Red: from',
    'Показывать Salt Score карты': 'Show card Salt Meter', 'Жёлтый с': 'Yellow from', 'Красный с': 'Red from',
    'Показывать шкалу «/4» рядом с Salt Meter': 'Show the “/4” scale beside Salt Meter',
    'Показатели встраиваются под форматы. Дробь показывает количество колод с картой среди подходящих по цветовой идентичности. По умолчанию популярность окрашивается по абсолютному количеству: зелёный ниже 50 000, жёлтый от 50 000, красный от 100 000; при выборе доли — до 1% включительно, выше 1% и от 2,6% соответственно. Salt Score — оценка сообщества от 0 до 4, не сила карты: зелёный до 1, жёлтый от 1, красный от 2.': 'Indicators appear under format legality. The fraction is decks containing this card over decks eligible by color identity. By default, deck counts are green below 50,000, yellow from 50,000 and red from 100,000. In percentage mode, green is up to 1%, yellow above 1%, and red from 2.6%. Salt Meter is a community rating from 0 to 4, not card strength; yellow starts at 1 and red at 2.',
    'Показывать предложения CardTrader на странице карты': 'Show CardTrader offers on card pages',
    'Цены в евро в таблице выпусков': 'EUR prices in printing table',
    'Cardmarket и CardTrader': 'Cardmarket and CardTrader',
    'Личный API-токен CardTrader': 'Personal CardTrader API token',
    'Для цен CardTrader нужен токен. Он хранится локально в расширении и передаётся только в API CardTrader. Цены в таблице появляются постепенно; учитываются предложения в EUR. Состояние и язык могут отличаться.': 'CardTrader prices require a personal token. It stays in the extension and is sent only to the CardTrader API. EUR offers load gradually; condition and language may vary.',
    'Легальность': 'Legality', 'Дополнительные форматы': 'Additional formats',
    'Форматы: показывать и порядок': 'Formats: visibility and order', 'Левая колонка': 'Left column', 'Правая колонка': 'Right column',
    'Перетащи формат в нужную позицию любой колонки; чекбокс скрывает его. Порядок на карте: слева направо, сверху вниз.': 'Drag a format to either column; uncheck it to hide it. Cards display formats left to right, then top to bottom.',
    'Экспорт': 'Export', 'Формат копирования': 'Clipboard export format',
    '1 Название карты': '1 Card name', '1 Название карты (SET) номер': '1 Card name (SET) number',
    'Функции Shambleshark': 'Shambleshark features',
    'Ссылка на Tagger поверх карт в результатах поиска': 'Tagger link on search result cards',
    'Поиск по типу и манакосту со страницы карты': 'Search by type and mana cost from card pages',
    'Показать исторические прозвища карт при предпросмотре Scryfall': 'Show historical card nicknames in Scryfall preview',
    'Режим «No Prices» в выпадающем списке колоды': 'No Prices mode in deck menu',
    'Карты колоды стопкой вместо развёрнутой сетки': 'Stack deck cards instead of showing the whole grid',
    'Список токенов, создаваемых картами колоды': 'Show tokens created by cards in a deck',
    'Очистка колоды (Shambleshark)': 'Deck cleanup (Shambleshark)',
    'Улучшенная кнопка Clean Up': 'Improved Clean Up button',
    'Модуль перенесён из Shambleshark. Он работает через внутренний интерфейс Scryfall — window.Scryfall и window.ScryfallAPI, — а не через разметку страницы, и потому стоит по умолчанию выключенным: пока он не проверен в живом редакторе колод, включать его стоит осознанно. Если Scryfall перепишет свой интерфейс, модуль перестанет работать, но редактор не сломается.': 'This module is ported from Shambleshark. It works through Scryfall\'s internals — window.Scryfall and window.ScryfallAPI — rather than through the page markup, which is why it is off by default: until it has been checked in a live deck editor, turning it on is a deliberate choice. If Scryfall rewrites that interface the module stops working, but the editor keeps working.',
    'Перекладывать земли и не-земли по их колонкам': 'Move lands and nonlands into their correct columns',
    'Сортировка карт:': 'Sort cards by:',
    'Как решит Scryfall': 'Let Scryfall decide',
    'По типу карты': 'By card type',
    'По названию': 'By name',
    'Заголовки групп при сортировке': 'Group headings when sorting',
    'Показывать изображение карты при наведении на строку': 'Show the card image when hovering a row',
    'Работает через внутренний интерфейс Scryfall, поэтому по умолчанию выключено.': 'Works through Scryfall\'s internals, so it is off by default.',
    'После изменения настроек обнови открытые страницы Scryfall и Tagger. MoxTags продолжает работать отдельно на Moxfield.': 'Reload open Scryfall and Tagger tabs after changing settings. MoxTags continues to run separately on Moxfield.',
    'Открыть настройки во вкладке': 'Open settings in a tab',
    'Сохранить': 'Save', 'Заменить': 'Replace', 'Удалить': 'Delete',
    'Вставь личный токен': 'Paste your personal token',
    'Введите новый токен для замены сохранённого': 'Enter a new token to replace the saved token',
    'Личный API-токен CardTrader · сохранён ✓': 'Personal CardTrader API token · saved ✓',
    'Личный API-токен CardTrader · не задан': 'Personal CardTrader API token · not set',
    'Токен сохранён. Пустое поле означает, что текущий токен продолжает работать. Он передаётся только в API CardTrader.': 'Token saved. A blank field means the current token remains active. It is sent only to the CardTrader API.',
    'Для цен CardTrader нужен личный токен. Он хранится локально и передаётся только в API CardTrader.': 'CardTrader prices need your personal token. It is stored locally and sent only to the CardTrader API.',
    'Вставь токен без пробелов': 'Paste a token without spaces',
    'Токен сохранён; цены проверятся на странице карты': 'Token saved; prices will load on the card page',
    'Токен удалён': 'Token removed', 'Сохранено': 'Saved',
    'Пороги популярности: красный должен быть выше жёлтого': 'Popularity thresholds: red must be higher than yellow',
    'Пороги популярности сохранены': 'Popularity thresholds saved',
    'Укажи пороги от 0 до 4; красный должен быть выше жёлтого': 'Use thresholds from 0 to 4; red must be higher than yellow',
    'Пороги Salt сохранены': 'Salt thresholds saved',
    'Порядок и видимость сохранены': 'Format order and visibility saved',
    'Закрыть': 'Close', 'Токены колоды': 'Deck tokens', 'Загружаю токены…': 'Loading tokens…',
    'Показать токены': 'Show Tokens', 'Без цен': 'No Prices',
    'Токены не найдены.': 'No tokens found.', 'Не удалось загрузить токены.': 'Could not load tokens.',
    'Открыть теги карты в Tagger': 'Open card tags in Tagger',
    'Цены Cardmarket в евро': 'Cardmarket prices in EUR',
    'CardTrader: минимальное предложение для этого издания в евро': 'CardTrader: lowest EUR offer for this printing',
    'Минимальное предложение CardTrader; состояние и язык могут отличаться': 'Lowest CardTrader offer; condition and language may vary',
    'Цена CardTrader недоступна': 'CardTrader price unavailable',
    'Минимальное предложение; состояние и язык могут отличаться': 'Lowest offer; condition and language may vary',
    'CardTrader недоступен — проверь токен в настройках.': 'CardTrader unavailable — check the token in settings.',
    'Открыть статистику карты на EDHREC': 'Open card statistics on EDHREC',
    'В колодах': 'In decks',
    'Средняя оценка раздражающего эффекта карты по опросу EDHREC; не мера силы карты': 'Average salt rating from EDHREC community votes; not a measure of card strength',
    'Отделка выпуска': 'Printing finish', 'Только Foil': 'Foil only', 'Только Nonfoil': 'Nonfoil only',
    'Только Etched Foil': 'Etched foil only',
    'Показать список карт': 'Show card list', 'Копировать карты': 'Copy cards', 'Копировать карту': 'Copy card', 'Скопировано': 'Copied',
    'Ошибка копирования': 'Copy failed', 'Очистить буфер карт': 'Clear card clipboard',
    'Очистить буфер карт?': 'Clear the card clipboard?', 'Список пуст': 'List is empty',
    'Удалить': 'Remove', 'Добавить': 'Add', 'Загружаю теги…': 'Loading tags…',
    'Загружаю карту…': 'Loading card…', 'Для этой карты тегов нет': 'No tags for this card',
    'Связи Tagger сейчас недоступны; теги показаны из локального списка.': 'Tagger relationships are unavailable; showing tags from the local index.',
    'Теги недоступны — открыть Tagger': 'Tags unavailable — open Tagger',
    'Только названия без сетов': 'Names only, no sets'
  };
  const languages = ['ru','en'];
  const originals = new WeakMap();
  const t = (source, language = 'ru') => language === 'en' ? en[source] || source : source;
  const localizeOptions = language => {
    if (!languages.includes(language)) language = 'ru';
    document.documentElement.lang = language;
    for (const node of document.querySelectorAll('body *')) {
      if (node.matches('script,style')) continue;
      for (const child of node.childNodes) {
        if (child.nodeType !== 3 || !child.textContent.trim()) continue;
        if (!originals.has(child)) originals.set(child, child.textContent);
        const original = originals.get(child);
        const match = original.match(/^(\s*)([\s\S]*?)(\s*)$/);
        child.textContent = match[1] + t(match[2], language) + match[3];
      }
    }
  };
  window.STK_I18N = { t, localizeOptions, resolveSettingsLanguage };
})();
