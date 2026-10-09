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
    'Как в браузере': 'As in the browser',
    'Язык настроек': 'Settings language',
    'Русский': 'Russian', 'Английский': 'English',
    'Вся правая колонка страницы карты: таблица изданий, под ней таблицы тегов карты и тегов арта.': 'The whole right-hand column of a card page: the prints table, and under it the card tags and art tags tables.',
    'Та же колонка без цифровых наборов и без цен в долларах и билетах: остались бумажные наборы и цена в евро.': 'The same column without digital sets and without dollar and ticket prices: the paper sets and the euro price are left.',
    'В той же колонке у каждого издания появляется свой столбец отделки: Nonfoil, Foil, Etched.': 'In the same column, every printing gets its own finish column: Nonfoil, Foil, Etched.',
    'Колонка страницы карты, у которой добавлены форматы, которых нет у Scryfall.': 'A card page column with the formats Scryfall does not list added to it.',
    'Буфер в углу страницы: собранные карты, каждую можно скопировать отдельно.': 'The clipboard in the corner: the cards you collected, each copyable on its own.',
    'Показать, как это выглядит': 'Show what it looks like',
    'Авторы и сторонние проекты': 'Credits and third-party projects',
    'Расширение независимо: оно не создано, не одобрено и не спонсировано Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket или Moxfield. В сборке лежат файлы других проектов под лицензией MIT с сохранёнными уведомлениями: иконки — CardClip (Jacob Hearst), данные тегов — MoxTags v1.8.3 (Nate Finch), модуль очистки колоды — Shambleshark (Samuel Simões, Blade Barringer), дополнительные форматы — MTG Enhancements (notsonic). Полный список файлов и лицензий — в THIRD_PARTY_NOTICES.md и assets/licences/ внутри архива расширения.': 'This extension is independent: it is not produced, endorsed or sponsored by Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket or Moxfield. The build carries files from other projects under their own MIT licences with their notices preserved: icons from CardClip (Jacob Hearst), tag data from MoxTags v1.8.3 (Nate Finch), the deck clean-up module from Shambleshark (Samuel Simões, Blade Barringer), extra formats from MTG Enhancements (notsonic). The full file and licence list is in THIRD_PARTY_NOTICES.md and assets/licences/ inside the extension archive.',
    'Тема': 'Theme',
    'Открыть все настройки': 'Open all settings',
    'Общее': 'General', 'Общий буфер карт на Scryfall и Tagger': 'Shared card clipboard on Scryfall and Tagger',
    'Тема Scryfall и Tagger': 'Scryfall and Tagger theme', 'Как в системе': 'Follow the system', 'Светлая': 'Light', 'Тёмная': 'Dark',
    'По умолчанию тема повторяет системную тему компьютера или телефона и переключается вместе с ней.': 'By default the theme follows the system theme of your computer or phone and switches with it.',
    // The visibility section. Everything below is drawn from src/core/set-filters.js: the
    // settings page writes the column headings, the price captions and the twelve accessible
    // names into the page at run time, so they cannot be translated where they are written —
    // they are translated the way every other label is, by walking the body afterwards.
    //
    // Two of these keys collide with words elsewhere on the page and the collision is worth
    // stating: 'Издания' is both this table's third column and the heading of the section
    // further down that configures the grouped prints table. One dictionary maps one Russian
    // string to one English string, so the word has one English — and it is the one the table
    // needs, "Prints table", which is also what that other section is about.
    'Видимость': 'Visibility',
    'Платформы': 'Platforms',
    'Платформа': 'Platform',
    'Показывать': 'Show',
    'Издания': 'Prints table',
    'Поиск': 'Search',
    'Список сетов': 'Sets list',
    'Цены и ссылки': 'Prices and links',
    'Цены': 'Prices',
    'Ссылки на магазины': 'Store links',
    'Показывать индикатор Caster ON': 'Show Caster ON indicator',
    // The words a screen reader hears. They are not the column headers: a table of twelve boxes
    // whose accessible names are all "Поиск" tells a reader nothing about which box is which,
    // and these are what each box is named instead.
    'платформа': 'platform',
    'показывать': 'show',
    'показывать в таблице изданий': 'show in the prints table',
    'показывать в поиске': 'show in search',
    'показывать в списке сетов': 'show in the sets list',
    // What the "?" in this section opens with. The main screen carries no paragraphs about
    // internal rules; what a reader would actually want to know is here, and it is one click and
    // one key away rather than eleven lines of grey text under every switch.
    'Каждая платформа включается отдельно в каждом из трёх мест: «Издания», «Поиск» и «Список сетов». Снимите галочку «Показывать», чтобы выключить платформу целиком, — её места запомнятся и вернутся вместе с ней.': 'Each platform is switched on separately in each of three places: Prints table, Search and Sets list. Clear “Show” to turn a platform off everywhere — its places are remembered and come back with it.',
    'Издание может быть на нескольких платформах. Если выключена Arena, карты, доступные ещё и на Paper, остаются.': 'A printing can be on several platforms. With Arena off, cards that are also on Paper stay.',
    'Набор, у которого платформу определить не удалось, остаётся видимым.': 'A set whose platform could not be determined stays visible.',
    'Дополнительная информация': 'Additional info',
    // No second 'Издания' key here. There was one, and it said 'Prints', which is why the table's
    // third column came out reading "Prints" instead of the "Prints table" its own heading
    // asks for: in a JavaScript object literal a repeated key is silently the last one, so the
    // earlier entry was dead and nothing failed. The heading further down the page that says
    // «Издания» now reads "Prints table" too, which is what that section is about.
    'Теги': 'Tags',
    'Таблицы тегов и связанных карт на странице карты. Пока выключено, настройки ниже заблокированы.': 'The tag and related-card tables on a card page. While it is off, the settings below are locked.',
    'Ссылка на Tagger работает независимо от переключателя «Теги».': 'The Tagger link works on its own, whatever the Tags switch says.',
    'Общий буфер карт на Scryfall и Tagger. Пока выключено, формат копирования и плюс у отдельных изданий заблокированы.': 'The card clipboard shared by Scryfall and Tagger. While it is off, the copy format and the per-printing plus button are locked.',
    'Scryfall Deckbuilder': 'Scryfall Deckbuilder',
    'Какие теги показывать': 'Tags to display', 'Связанные карты': 'Related cards',
    'Плюс для отдельного издания при наведении в полном списке': 'Show add button on hover for each printing in the expanded list',
    // The feature rows of Additional info. Each is the name of a feature and nothing more: what
    // it does and how to change it are the help button and the panel behind the second button.
    // The names are short because they are read as a list, and a list of paragraphs is not a
    // list — which is what this section was.
    'Доступная отделка изданий': 'Available printing finishes',
    'Клик по типу и мана-стоимости для поиска': 'Click the type and mana cost to search',
    'Популярность в Commander': 'Commander popularity',
    'Salt Meter': 'Salt Meter',
    'Предложения CardTrader': 'CardTrader offers',
    'Настроить': 'Set up',
    'Подключить': 'Connect',
    'Не подключено': 'Not connected',
    'Токен сохранён ✓': 'Token saved ✓',
    'Заменить токен': 'Replace token',
    'Удалить токен': 'Remove token',
    'Вернуть стандартные настройки': 'Restore defaults',
    'Стандартные настройки восстановлены': 'Defaults restored',
    'Дополнительные настройки': 'More settings',
    'Формат отображения': 'Display format',
    'Окрашивать по': 'Colour by',
    'Показывать шкалу «/4»': 'Show the “/4” scale',
    'Показывать блок «Купить карту»': 'Show the “Buy This Card” block',
    'Столбец EUR на Scryfall — это цена Cardmarket. Здесь выбирается, чем его заполнять: Cardmarket, CardTrader или обоими — тогда рядом появляется второй столбец. «Не показывать» убирает столбец целиком и снимает галочку EUR в группе «Цены»: это одна настройка с двумя ручками.': 'Scryfall’s EUR column is Cardmarket’s price. This chooses what fills it: Cardmarket, CardTrader, or both — in which case a second column appears beside it. “Show nothing” removes the column entirely and clears the EUR box in the Prices group: it is one setting with two handles.',
    'Пока галочка EUR снята, список заблокирован: выбирать источник для столбца, которого нет, нечего.': 'While the EUR box is clear the list is blocked: there is nothing to choose a source for a column that is not there.',
    'Нельзя выбрать источник цены, пока цена не показывается.': 'The price source cannot be chosen while the price is not shown.',
    'Для цен CardTrader нужен личный токен, и задаётся он в строке «Предложения CardTrader» выше, в том же блоке магазинов.': 'CardTrader prices need a personal token, and it is set in the “CardTrader offers” row above, in the same store block.',
    'Включать саму галочку «Предложения CardTrader» для этого не обязательно: она добавляет ссылки CardTrader в блок покупки, а столбец работает и без них.': 'Ticking “CardTrader offers” itself is not required for that: it adds CardTrader links to the buy block, and the column works without them.',
    'Источники EUR-цен в таблице изданий': 'EUR price sources in the prints table',
    'Что это': 'What this does',
    'Дробь и процент': 'Fraction and percentage', 'Только дробь': 'Fraction only', 'Только процент': 'Percentage only',
    'Количеству колод': 'Deck count', 'Доле подходящих колод': 'Eligible deck percentage',
    'Жёлтый: от': 'Yellow: from', 'Жёлтый: более': 'Yellow: above', 'Красный: от': 'Red: from', 'колод': 'decks',
    'Жёлтый с': 'Yellow from', 'Красный с': 'Red from',
    // The help. These paragraphs used to stand in the body under the switches they explain, and
    // a page that argues about thresholds before the reader has decided to change one reads as a
    // form to fill in. Every one of these settings works untouched, so the argument belongs
    // behind a button.
    'У издания бывает не вся отделка: только фойл, только нефойл, только etched или особый фойл. Когда это так, в таблице изданий между названием и ценами появляется узкий столбец с тем, что у издания есть.': 'A printing does not always come in every finish: foil only, nonfoil only, etched only, or a known special foil treatment. When that is the case, a narrow column appears in the prints table between the names and the prices, showing what the printing has.',
    'Обычные звёздочки фойла в названиях изданий при этом не дублируются. Данные приходят из Scryfall и могут появиться после загрузки страницы.': 'The usual foil stars in the printing names are not duplicated. The data comes from Scryfall and may arrive after the page has loaded.',
    'Показатели встраиваются под форматы. Дробь показывает количество колод с картой среди подходящих по цветовой идентичности.': 'The indicators appear under format legality. The fraction is the decks containing this card over the decks eligible by colour identity.',
    'По умолчанию популярность окрашивается по абсолютному количеству колод: зелёный ниже 50 000, жёлтый от 50 000, красный от 100 000. При выборе доли — зелёный до 1% включительно, жёлтый выше 1%, красный от 2,6%.': 'By default popularity is coloured by the absolute deck count: green below 50,000, yellow from 50,000 and red from 100,000. In percentage mode, green is up to and including 1%, yellow is above 1%, and red is from 2.6%.',
    'Salt Score — оценка сообщества от 0 до 4, не сила карты. По умолчанию зелёный до 1, жёлтый от 1, красный от 2.': 'Salt Score is a community rating from 0 to 4, not a measure of card strength. By default green is below 1, yellow from 1 and red from 2.',
    'Шкала «/4» показывает рядом с показателем, какому значению соответствует цвет.': 'The “/4” scale shows, beside the rating, which value the colour stands for.',
    'Для цен CardTrader нужен токен. Он хранится локально в расширении и передаётся только в API CardTrader.': 'CardTrader prices need a token. It is stored locally in the extension and sent only to the CardTrader API.',
    'Цены в таблице появляются постепенно; учитываются предложения в EUR. Состояние и язык могут отличаться.': 'Prices in the table load gradually; EUR offers are used. Condition and language may vary.',
    'Сохранённый токен не проверяется этой страницей: она не делает запросов к CardTrader. Работает он или нет, видно на странице карты.': 'A saved token is not checked by this page: it makes no requests to CardTrader. Whether it works is visible on a card page.',
    'Cardmarket и CardTrader': 'Cardmarket and CardTrader',
    'Не показывать': 'Show nothing',
    'Личный API-токен CardTrader': 'Personal CardTrader API token',
    'Легальность': 'Legality', 'Дополнительные форматы': 'Additional formats',
    'Форматы: показывать и порядок': 'Formats: visibility and order', 'Левая колонка': 'Left column', 'Правая колонка': 'Right column',
    'Перетащи формат в нужную позицию любой колонки; чекбокс скрывает его. Порядок на карте: слева направо, сверху вниз.': 'Drag a format to either column; uncheck it to hide it. Cards display formats left to right, then top to bottom.',
    'Формат копирования': 'Clipboard export format',
    '1 Название карты': '1 Card name', '1 Название карты (SET) номер': '1 Card name (SET) number',
    'Ссылка на Tagger поверх карт в результатах поиска': 'Tagger link on search result cards',
    'Scryfall не ответил ни по одной карте.': 'Scryfall did not answer about a single card.',
    'Все карты колоды Scryfall считает легальными в Commander.': 'Scryfall counts every card in the deck as legal in Commander.',
    'Scryfall считает эти карты нелегальными в Commander:': 'Scryfall counts these cards as not legal in Commander:',
    'запрещена в Commander': 'banned in Commander',
    'ограничена в Commander': 'restricted in Commander',
    'Про %s карт Scryfall не сказал ничего; это не то же самое, что «легально».': 'Scryfall said nothing about %s cards; that is not the same as “legal”.',
    'Проверена только легальность каждой карты отдельно. Цветовая идентичность командира, ограничение в 100 карт и правило одной копии для карт с надписью «только Commander» не проверялись.': 'Only each card’s legality on its own was checked. The commander’s colour identity, the hundred-card limit and the one-copy rule for cards marked “Commander only” were not.',
    'Не удалось проверить легальность.': 'Could not check legality.',
    'Перекладывать земли и не-земли по их колонкам': 'Move lands and nonlands into their correct columns',
    'Как решит Scryfall': 'Let Scryfall decide',
    'По типу карты': 'By card type',
    'По названию': 'By name',
    'Заголовки групп при сортировке': 'Group headings when sorting',
    'Модули': 'Modules',
    'Очистка колоды': 'Clean up',
    'Подсказки EDHREC': 'EDHREC suggestions',
    'Поиск Scryfall': 'Scryfall search',
    'Внутренности Scryfall': 'Scryfall internals',
    'Что не так': 'What is wrong',
    'Доступ к хосту выдан — перезагрузи открытые страницы.': 'Host access granted — reload any open Scryfall pages.',
    'Доступ не выдан.': 'Access was not granted.',
    'Браузер не дал спросить: ': 'The browser would not let the extension ask: ',
    'Не выдан доступ к хостам для: ': 'No host access for: ',
    // The deck tools are a list of one-line features now: a switch and a name, and what a
    // feature does is behind its own "?". The names say what the feature does rather than
    // what control it adds, and the paragraphs that used to stand between them are in the
    // help entries below.
    'Режим без цен в меню колоды': 'No Prices mode in the deck menu',
    'Показывать создаваемые картами токены': 'Show tokens created by cards in the deck',
    'Отображать карты стопками': 'Show deck cards as stacks',
    'Проверять допустимость карт в Commander': 'Check individual cards for Commander legality',
    'Рекомендации EDHREC в редакторе колод': 'EDHREC suggestions in the deck editor',
    'Поиск карт в редакторе': 'Search cards in the deck editor',
    'Улучшенная уборка колоды': 'Improved deck cleanup',
    'Сортировка карт': 'Sort cards',
    'Требуется разрешение': 'Permission needed',
    'Ограниченный режим': 'Limited mode',
    'Предоставить': 'Grant',
    'Показать': 'Show',
    'Скрыть': 'Hide',
    'Диагностика': 'Diagnostics',
    // The deck features' own help. Short, and about the result and its limits: the technical
    // detail — the page path, the object names, the adapter's own words — lives in Diagnostics.
    'Добавляет в меню «Показывать» на странице колоды вариант «Без цен». Он скрывает цены и данные о ценах рядом с картами в списке колоды.': 'Adds a “No Prices” choice to the “Show” menu on a deck page. It hides prices and the price data beside the cards in the deck list.',
    'Добавляет на страницу колоды кнопку «Показать токены»: она собирает токены, которые создают карты этой колоды, и показывает их списком.': 'Adds a “Show Tokens” button to a deck page: it collects the tokens the deck’s cards create and shows them as a list.',
    'Кнопка появляется только там, где Scryfall уже показывает список карт колоды, — на странице колоды в Deckbuilder.': 'The button appears only where Scryfall already shows the deck’s card list — on a deck page in Deckbuilder.',
    'Показывает карты колоды стопкой вместо развёрнутой сетки. Компактнее при большой колоде; видны имена и количества.': 'Shows deck cards as stacks instead of the full grid. More compact for a large deck; names and counts are visible.',
    'Проверяет допустимость отдельных карт в Commander. Не проверяет цветовую идентичность колоды, её размер и ограничения на число копий.': 'Checks individual cards for Commander legality. It does not check the deck’s colour identity, its size, or the limits on the number of copies.',
    'Кнопка появляется на странице колоды. Формат не выбирается: редактор Scryfall собирает командные колоды.': 'The button appears on a deck page. The format is not chosen: Scryfall’s editor builds commander decks.',
    'Добавляет в редактор колоды кнопку со списком карт, которые EDHREC советует для вашего командира, и с долей колод, где они встречаются.': 'Adds a button to the deck editor with the cards EDHREC suggests for your commander, and the share of decks that play each one.',
    'Для полного списка нужен доступ к данным EDHREC. Без него показывается только страница командира, а не советы по вашей колоде.': 'The full list needs access to EDHREC’s data. Without it, only the commander’s page is shown, not advice about your deck.',
    'Добавляет в редактор колоды поиск по синтаксису Scryfall: результаты и кнопку добавления карты в колоду.': 'Adds a search in Scryfall’s own syntax to the deck editor: results and a button that adds a card to the deck.',
    'Поиск можно ограничить цветами командира и скрыть шуточные карты.': 'The search can be narrowed to the commander’s colours, and funny cards can be hidden.',
    'Дополняет кнопку Clean Up в редакторе колоды: переносит земли и не-земли в нужные колонки, сортирует карты и вставляет заголовки групп.': 'Adds to the Clean Up button in the deck editor: it moves lands and nonlands into the right columns, sorts the cards and inserts group headings.',
    'Сортировка и заголовки работают, если выбраны в настройках. Содержимое колоды не меняется — только порядок и колонки.': 'Sorting and headings work when they are chosen in the settings. The deck’s contents do not change — only the order and the columns.',
    // Diagnostics. The state is named first and the technical detail is quieter, because the
    // state is what a reader came for and the rest is what they copy into a bug report.
    'Проверка ещё не выполнена: открой редактор колоды Scryfall с включённым модулем.': 'Not checked yet: open a Scryfall deck editor with a module turned on.',
    'Проверка ещё не выполнена: ни один модуль редактора не включён.': 'Not checked yet: no deck module is turned on.',
    'Подходящая страница редактора не открыта. Это не ошибка: на других страницах Scryfall модули и не должны работать.': 'No suitable editor page is open. That is not an error: the modules are not meant to run on other Scryfall pages.',
    'Обнаружена ошибка на странице редактора.': 'An error was found on the editor page.',
    'Обнаружена ошибка: модули редактора не загрузились.': 'An error was found: the deck modules did not load.',
    'Модуль работает.': 'The module is working.',
    'Проверка ещё не выполнена.': 'Not checked yet.',
    'Данные последней проверки, страница': 'Data from the last check, page',
    '. Выключи и включи нужную функцию, чтобы запросить доступ.': '. Turn the feature off and on again to request access.',
    // The deck page's own labels, aligned with the setting's wording: the button checks cards,
    // not the deck as a whole.
    'Проверить карты в Commander': 'Check cards for Commander',
    'Допустимость карт в Commander': 'Card legality in Commander',
    'Проверяю карты…': 'Checking cards…',
    'После изменения настроек обнови открытые страницы Scryfall и Tagger.': 'Reload open Scryfall and Tagger tabs after changing settings.',
    'Открыть настройки во вкладке': 'Open settings in a tab',
    'Сохранить': 'Save', 'Удалить': 'Delete',
    'Вставь личный токен': 'Paste your personal token',
    'Введите новый токен для замены сохранённого': 'Enter a new token to replace the saved token',
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