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
    'Ссылка «Все издания» открывается в этой же вкладке': 'The “View all prints” link opens in this same tab',
    'Язык настроек': 'Settings language',
    'Язык интерфейса Scryfall и Tagger': 'Scryfall and Tagger interface language',
    'Язык добавляемых элементов и основных элементов Scryfall. Тексты карт и статей не переводятся.': 'Language of extension controls and common Scryfall controls. Card text and articles are not translated.',
    'Русский': 'Russian', 'Английский': 'English',
    'Так это выглядит на странице карты: таблицы тегов карты и тегов арта.': 'On a card page: the card tags and art tags tables.',
    'Вся правая колонка страницы карты: таблица изданий, под ней таблицы тегов карты и тегов арта.': 'The whole right-hand column of a card page: the prints table, and under it the card tags and art tags tables.',
    'Та же колонка без цифровых наборов и без цен в долларах и билетах: остались бумажные наборы и цена в евро.': 'The same column without digital sets and without dollar and ticket prices: the paper sets and the euro price are left.',
    'В той же колонке у каждого издания появляется свой столбец отделки: Nonfoil, Foil, Etched.': 'In the same column, every printing gets its own finish column: Nonfoil, Foil, Etched.',
    'Колонка страницы карты, у которой добавлены форматы, которых нет у Scryfall.': 'A card page column with the formats Scryfall does not list added to it.',
    'Вся колонка: все издания собраны в одной таблице и сгруппированы по сетам.': 'The whole column: every printing in one table, grouped by set.',
    'Буфер в углу страницы: собранные карты, каждую можно скопировать отдельно.': 'The clipboard in the corner: the cards you collected, each copyable on its own.',
    'Таблица изданий без цифровых сетов и без цен в валютах, которые вы скрыли.': 'The prints table without digital sets, and without the prices you hid.',
    'Отдельный столбец отделки у каждого издания: Nonfoil, Foil, Etched.': 'A separate finish column for every printing: Nonfoil, Foil, Etched.',
    'Показать, как это выглядит': 'Show what it looks like',
    'Форматы, которых нет на странице карты Scryfall, добавлены в блок легальности.': 'Formats Scryfall does not list, added to the legality block.',
    'Все издания собраны в одной таблице и сгруппированы по сетам.': 'Every printing in one table, grouped by set.',
    'Авторы и сторонние проекты': 'Credits and third-party projects',
    'Расширение независимо: оно не создано, не одобрено и не спонсировано Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket или Moxfield. В сборке лежат файлы других проектов под лицензией MIT с сохранёнными уведомлениями: иконки — CardClip (Jacob Hearst), данные тегов — MoxTags v1.8.3 (Nate Finch), названия карт — Shambleshark (Samuel Simões, Blade Barringer), дополнительные форматы — MTG Enhancements (notsonic). Полный список файлов и лицензий — в THIRD_PARTY_NOTICES.md и assets/licences/ внутри архива расширения.': 'This extension is independent: it is not produced, endorsed or sponsored by Scryfall, Wizards of the Coast, EDHREC, CardTrader, Cardmarket or Moxfield. The build carries files from other projects under their own MIT licences with their notices preserved: icons from CardClip (Jacob Hearst), tag data from MoxTags v1.8.3 (Nate Finch), card nicknames from Shambleshark (Samuel Simões, Blade Barringer), extra formats from MTG Enhancements (notsonic). The full file and licence list is in THIRD_PARTY_NOTICES.md and assets/licences/ inside the extension archive.',
    'Тема': 'Theme',
    'Открыть все настройки': 'Open all settings',
    'Быстрые настройки': 'Quick settings',
    'Общее': 'General', 'Общий буфер карт на Scryfall и Tagger': 'Shared card clipboard on Scryfall and Tagger',
    'Тема Scryfall и Tagger': 'Scryfall and Tagger theme', 'Как в системе': 'Follow the system', 'Светлая': 'Light', 'Тёмная': 'Dark',
    'По умолчанию тема повторяет системную тему компьютера или телефона и переключается вместе с ней.': 'By default the theme follows the system theme of your computer or phone and switches with it.',
    'Скрытие лишнего': 'Hide extras',
    // The hiding group, drawn from src/core/set-filters.js. The four category labels
    // below are the model's own Russian strings and the settings page writes them into
    // the page at run time, so they cannot be translated at the point of writing — they
    // are translated the way every other label is, by walking the body afterwards.
    'Что показывать': 'What to show',
    'Настроить': 'Configure',
    'Платформа выключается целиком, её собственные настройки при этом сохраняются и возвращаются вместе с ней. Издание может быть на нескольких платформах: выключение Arena не убирает то, что осталось и на Paper.': 'A platform is turned off as a whole and its own settings are kept, coming back with it. A printing can be on several platforms: turning Arena off does not remove what is still on Paper.',
    'Paper: дополнительные категории': 'Paper: additional categories',
    'Нетурнирные и вспомогательные издания': 'Non-tournament and ancillary printings',
    'Наборы без английских изданий': 'Sets with no English printing',
    'Где применять': 'Where to apply',
    'Таблица изданий': 'Prints table',
    'Поиск': 'Search',
    'Список сетов': 'Sets list',
    'Правила наборов убирают набор целиком, правило языка — отдельное издание. Наличие в наборе скрытых карт само по себе набор не скрывает.': 'Set rules remove a set whole; the language rule removes an individual printing. A set having some hidden cards in it does not by itself hide the set.',
    'Режим «Только без английского аналога» сравнивает иноязычное издание со всеми бумажными английскими изданиями той же карты — не только с теми, что попали в текущую таблицу. Сравниваются арт, рамка, её особенности, цвет бордера и полноформатное оформление; у многолицевых карт — каждое лицо. Если сравнить нельзя, издание остаётся видимым: лишняя строка лучше пропавшей.': '"Only without an English analogue" compares a foreign-language printing with every English Paper printing of the same card, not only with those that happen to be in the current table. What is compared is the artwork, the frame, its effects, the border colour and the full-art treatment; on a card with more than one face, every face. If there is not enough to compare, the printing stays visible: an extra row is better than a missing one.',
    'Этот режим не возвращает то, что убрали другие правила. Например, Secret Lair останется скрытым при выключенной категории Foreign Black Border, даже если аналог у него есть.': 'This mode does not bring back what another rule removed. A Secret Lair printing stays hidden while the Foreign Black Border category is off, even if it does have an analogue.',
    'Увеличенные карты (oversized)': 'Oversized cards',
    'Галочки независимы: набор может быть увеличенным и одновременно нетурнирным — например, Vintage Championship это сувенирная увеличенная колода. Включение одной не выключает другую.': 'The switches are independent: a set can be oversized and non-tournament at once — a Vintage Championship is memorabilia and oversized. Turning one on does not turn the other off.',
    'Foreign Black Border': 'Foreign Black Border',
    'Какие именно': 'Which ones',
    'Неанглийские издания': 'Non-English printings',
    'Все': 'All',
    'Только без английского аналога': 'Only without an English analogue',
    'Никакие': 'None',
    'Язык не влияет: иностранные издания показываются всегда.': 'Language makes no difference: foreign-language printings are always shown.',
    'Иноязычное издание показывается, только если у той же карты нет бумажного английского издания с тем же артом и тем же оформлением.': 'A foreign-language printing is shown only where the same card has no English Paper printing with the same artwork and the same treatment.',
    'Все неанглийские издания скрываются.': 'Every non-English printing is hidden.',
    'Фильтры сетов действуют в Sets и Prints. Английские издания внутри этих наборов остаются: правило про наборы, а не про язык каждого выпуска. Текущее издание остаётся видимым; смешанные наборы с легальными картами сохраняются.': 'Set filters apply in Sets and Prints. English printings inside those sets stay: the rule is about sets, not about the language of each printing. The current printing stays visible, and mixed sets containing legal cards remain listed.',
    'Индекс сетов Scryfall не называет клиент за цифровым набором, поэтому расширение везёт снимок известных наборов и уточняет недостающие через одну карту набора. Набор, который уточнить не удалось, остаётся видимым.': 'Scryfall’s set index does not name the client behind a digital set, so the extension ships a snapshot of the known sets and looks up anything missing through one card of the set. A set the lookup cannot place stays visible.',
    'Какие цены скрывать': 'Which prices to hide',
    'Цены в долларах и билетах — это столбцы чисел, а TCGplayer и Cardhoarder — ссылки на магазины, поэтому они и скрываются по отдельности. Цена в евро и всё, что добавляет само расширение, не скрывается никогда.': 'Dollar and ticket prices are columns of numbers, while TCGplayer and Cardhoarder are shop links, which is why they are hidden separately. The euro price, and everything this extension adds itself, is never hidden.',
    'Токены показываются на странице колоды: кнопка Show Tokens находит токены карт колоды через Scryfall.': 'Tokens are shown on the deck page: the Show Tokens button finds the tokens of your deck’s cards through Scryfall.',
    'Portal, Portal Second Age и Portal Three Kingdoms': 'Portal, Portal Second Age and Portal Three Kingdoms',
    'Другие языки': 'Other languages',
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
    'Проверка легальности колоды в Commander': 'Check the deck for Commander legality',
    'Кнопка на странице колоды спрашивает у Scryfall легальность каждой карты отдельно и показывает те, которые Scryfall считает нелегальными в Commander. Это ответ на формат для каждой карты, а не проверка колоды целиком: цветовая идентичность командира, ограничение в 100 карт и правило одной копии для карт с надписью «только Commander» не проверяются, и панель говорит об этом рядом со списком. Формат не выбирается — редактор Scryfall собирает командные колоды, и это факт о странице, а не настройка.': 'A button on the deck page asks Scryfall about each card’s legality one at a time and shows the ones Scryfall counts as not legal in Commander. That is a per-card format answer, not a check of the deck as a whole: the commander’s colour identity, the hundred-card limit and the one-copy rule for cards marked “Commander only” are not checked, and the panel says so beside the list. The format is not chosen — Scryfall’s editor builds commander decks, which is a fact about the page rather than a setting.',
    'Проверить легальность': 'Check legality',
    'Легальность колоды': 'Deck legality',
    'Проверяю легальность…': 'Checking legality…',
    'Scryfall не ответил ни по одной карте.': 'Scryfall did not answer about a single card.',
    'Все карты колоды Scryfall считает легальными в Commander.': 'Scryfall counts every card in the deck as legal in Commander.',
    'Scryfall считает эти карты нелегальными в Commander:': 'Scryfall counts these cards as not legal in Commander:',
    'запрещена в Commander': 'banned in Commander',
    'ограничена в Commander': 'restricted in Commander',
    'Про %s карт Scryfall не сказал ничего; это не то же самое, что «легально».': 'Scryfall said nothing about %s cards; that is not the same as “legal”.',
    'Проверена только легальность каждой карты отдельно. Цветовая идентичность командира, ограничение в 100 карт и правило одной копии для карт с надписью «только Commander» не проверялись.': 'Only each card’s legality on its own was checked. The commander’s colour identity, the hundred-card limit and the one-copy rule for cards marked “Commander only” were not.',
    'Не удалось проверить легальность.': 'Could not check legality.',
    'Очистка колоды (Shambleshark)': 'Deck cleanup (Shambleshark)',
    'Улучшенная кнопка Clean Up': 'Improved Clean Up button',
    'Модуль перенесён из Shambleshark. Он работает через внутренний интерфейс Scryfall — window.Scryfall и window.ScryfallAPI, — а не через разметку страницы, и потому стоит по умолчанию выключенным: пока он не проверен в живом редакторе колод, включать его стоит осознанно. Если Scryfall перепишет свой интерфейс, модуль перестанет работать, но редактор не сломается.': 'This module is ported from Shambleshark. It works through Scryfall\'s internals — window.Scryfall and window.ScryfallAPI — rather than through the page markup, which is why it is off by default: until it has been checked in a live deck editor, turning it on is a deliberate choice. If Scryfall rewrites that interface the module stops working, but the editor keeps working.',
    'Перекладывать земли и не-земли по их колонкам': 'Move lands and nonlands into their correct columns',
    'Сортировка карт:': 'Sort cards by:',
    'Как решит Scryfall': 'Let Scryfall decide',
    'По типу карты': 'By card type',
    'По названию': 'By name',
    'Заголовки групп при сортировке': 'Group headings when sorting',
    'Подсказки EDHREC в редакторе командных колод': 'EDHREC suggestions in the commander deck editor',
    'Кнопка EDHREC в панели инструментов открывает списки карт, которые EDHREC показывает для твоего командира, с процентом колод, где они встречаются. Данные берутся из открытого JSON EDHREC по их опубликованной политике — не чаще запроса в секунду и с кешем.': 'An EDHREC button in the toolbar opens the card lists EDHREC shows for your commander, with the share of decks that play each one. The data comes from EDHREC\'s published JSON under their published data policy — at most one request a second, and cached.',
    'Поиск Scryfall прямо в редакторе колоды': 'Scryfall search inside the deck editor',
    'Кнопка Search в панели инструментов: запрос по языку Scryfall, выдача и добавление карты в колоду. Можно ограничить поиск цветами командира и убрать шуточные карты. Запросы идут через очередь Scryfall расширения.': 'A Search button in the toolbar: a query in Scryfall\'s own syntax, results, and a button that adds a card to the deck. Searches can be narrowed to the commander\'s colours and can keep funny cards out. Requests go through the extension\'s Scryfall queue.',
    'Что говорят модули редактора': 'What the deck modules report',
    'Все четыре модуля работают через внутренний интерфейс Scryfall, а не через разметку. Пока они не проверены в живом редакторе, это единственный способ понять, принялись ли они: открой редактор колоды, а затем вернись сюда.': 'All four modules work through Scryfall\'s internals rather than the page markup. Until they have been checked in a live deck editor this is the only way to tell whether they attached: open the deck editor, then come back here.',
    'Открой редактор колоды с включённым модулем, и здесь появится его отчёт.': 'Open the deck editor with a module turned on and its report appears here.',
    'Страница': 'Page',
    'Подключено': 'Wired',
    'Очистка колоды': 'Clean up',
    'Подсказки EDHREC': 'EDHREC suggestions',
    'Поиск Scryfall': 'Scryfall search',
    'Внутренности Scryfall': 'Scryfall internals',
    'Что не так': 'What is wrong',
    'Доступ к хосту выдан — перезагрузи открытые страницы.': 'Host access granted — reload any open Scryfall pages.',
    'Доступ не выдан.': 'Access was not granted.',
    'Браузер не дал спросить: ': 'The browser would not let the extension ask: ',
    'Не выдан доступ к хостам для: ': 'No host access for: ',
    '. Нажми «Выдать доступ к хостам».': '. Press “Grant host access”.',
    'Выдать доступ к хостам': 'Grant host access',
    'Рекомендации EDHREC ходят на edhrec.com, а не только на их открытый JSON. Если доступа нет, они молча показывают страницу командира вместо советов по колоде. Кнопка запрашивает недостающее.': 'EDHREC suggestions go to edhrec.com, not only to their public JSON. Without access they quietly show the commander\'s page instead of advice about your deck. This button asks for whatever is missing.',
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
