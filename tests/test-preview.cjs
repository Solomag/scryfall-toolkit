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
'use strict';
// The card page end to end: the core and the nine feature files over linkedom.
const vm = require('node:vm');
const {
  assert, assertEqual, summary, sleep, waitFor, createPage, click, fireEvent
} = require('./testlib.cjs');

const ORACLE_ID = '00000000-0000-4000-8000-000000000001';
const REL_ID = '55555555-5555-4555-8555-555555555555';
const PRINT_CURRENT = '22222222-2222-4222-8222-222222222222';
const PRINT_TST2 = '33333333-3333-4333-8333-333333333333';
const PRINT_MH3 = '44444444-4444-4444-8444-444444444444';

const CARD_HTML = `<!DOCTYPE html><html><head>
<meta name="scryfall:card:id" content="11111111-1111-4111-8111-111111111111">
<meta name="scryfall:oracle:id" content="${ORACLE_ID}">
<title>Test Card</title></head><body>
<div id="main"><div class="inner-flex">
  <div class="card-image"><img src="https://cards.scryfall.io/normal/x.jpg" alt=""></div>
  <div class="card-text"><div class="card-text-card-name">Test Card</div></div>
  <div class="prints">
    <table class="prints-table">
      <thead><tr><th>Name</th><th>Set</th><th><span>USD</span></th><th><span>EUR</span></th><th><span>TIX</span></th></tr></thead>
      <tbody>
        <tr class="current"><td><a data-card-id="${PRINT_CURRENT}" href="https://scryfall.com/card/tst/1/test-card">Test Set
          #1</a></td><td>TST</td><td><a class="currency-usd" href="https://partner.tcgplayer.com/x">✶$7.82</a></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_TST2}" href="https://scryfall.com/card/tst/2/test-card">Test Set
          #2</a></td><td>TST</td><td></td><td></td><td></td></tr>
        <tr><td><a data-card-id="${PRINT_MH3}" href="https://scryfall.com/card/mh3/42/test-card">Modern Horizons 3
          #42</a></td><td>MH3</td><td></td><td></td><td></td></tr>
        <tr class="view-all"><td colspan="5"><a href="https://scryfall.com/search?unique=prints&amp;include=extras">View all prints →</a></td></tr>
      </tbody>
    </table>
  </div>
  <div id="stores"><ul class="toolbox-links"></ul></div>
  <div class="card-legality">
    <div class="card-legality-row">
      <div class="card-legality-item"><dt>Standard</dt><dd class="legal">Legal</dd></div>
      <div class="card-legality-item"><dt>Modern</dt><dd class="legal">Legal</dd></div>
    </div>
  </div>
</div></div>
</body></html>`;

// The stored shape, in one place. Three platforms, each with a switch of its own and three
// places of its own, and nothing else in the group — so every fixture below is a list of the
// platforms to switch off plus, where a test needs it, a list of the places to switch off.
//
// Written once because the alternative is eight copies of a nested object in which the only
// thing any of them varies is one boolean, and a copy is a second thing that can be wrong.
// Every test that uses it passes `setFiltersMigrated: true`, because without that flag the
// stored value goes through the migration and the cases that hide nothing would pass without
// their settings ever having been set — which is what they did, the first time this ran.
const PLATFORMS = ['paper', 'arena', 'mtgo'];
const hideOnly = (off = [], places = {}) => ({
  setFiltersMigrated: true,
  setFilters: {
    platforms: Object.fromEntries(PLATFORMS.map(name => [name, {
      show: !(off || []).includes(name),
      areas: { prints: true, search: true, sets: true, ...(places || {})[name] }
    }])),
    prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
    tokens: true,
    caster: false
  }
});
// The same, for a reader who has switched nothing off — the shape a page load should make
// quietly, since it is the state every reader starts in and a default that hides something
// takes rows away from somebody who never asked.
const showEverything = (places = {}) => hideOnly([], places);

const prints = [
  { id: 'p1', name: 'Test Card', uri: 'https://scryfall.com/card/tst/1/test-card', set: 'tst', setName: 'Test Set', number: '1', lang: 'en', digital: false, finishes: ['nonfoil'], prices: { eur: '1.00' } },
  { id: 'p2', name: 'Test Card', uri: 'https://scryfall.com/card/tst/3/test-card', set: 'tst', setName: 'Test Set', number: '3', lang: 'en', digital: false, finishes: ['foil', 'nonfoil'], prices: { eur: '2.00', usd: '3.50', tix: '0.05' } },
  { id: 'p4', name: 'Test Card', uri: 'https://scryfall.com/card/tst/4/test-card', set: 'tst', setName: 'Test Set', number: '4', lang: 'en', digital: false, finishes: ['foil'], prices: { usd_foil: '9.99' } },
  { id: 'p3', name: 'Test Card', uri: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', setName: 'Modern Horizons 3', number: '42', lang: 'jp', digital: false, finishes: ['foil'], prices: {} },
  { id: 'p5', name: 'Test Card', uri: 'https://scryfall.com/card/mh3/43/test-card', set: 'mh3', setName: 'Modern Horizons 3', number: '43', lang: 'jp', digital: false, finishes: ['foil'], prices: {} }
];

const routes = {
  tags: () => ({
    card: [
      { name: 'Aggro', slug: 'aggro', tagType: 'ORACLE_CARD_TAG' },
      { name: 'Other Card', targetId: REL_ID, tagType: 'BETTER_THAN', relation: true, targetKind: 'card' },
      { name: 'Worse Card', targetId: '66666666-6666-4666-8666-666666666666', tagType: 'WORSE_THAN', relation: true, targetKind: 'card' }
    ],
    art: [],
    fallback: false
  }),
  finishes: message => Object.fromEntries(message.ids.map((id, index) =>
    [id, { finishes: [['nonfoil'], ['foil'], ['etched']][index % 3], promoTypes: [] }])),
  card: () => ({ oracle_id: ORACLE_ID, legalities: { premodern: 'legal', legacy: 'banned' } }),
  allPrints: () => ({ prints, truncated: false }),
  cardtrader: () => ({ available: true, url: 'https://www.cardtrader.com/en/cards/test', nonfoil: { cents: 1234, currency: 'EUR' } }),
  preview: () => ({ name: 'Other Card', image: 'https://cards.scryfall.io/normal/o.jpg', uri: 'https://scryfall.com/card/oth/1/other-card' }),
  // The three lists the worker answers with, and nothing else. It used to answer with six —
  // two of them name-pattern categories with sub-lists under them and one was a measured list
  // of thirty-four codes — and every one of the three extras belonged to a setting that no
  // longer exists. The fixture is trimmed to match, so a test cannot pass by feeding the
  // page a field the worker no longer sends.
  setCategories: () => ({
    digital: ['ysos', 'me2'], nonTournament: [], oversized: []
  }),
  setPlatforms: () => ({ ysos: ['arena'], me2: ['mtgo'] })
};

// The deck page, for the features that only exist there. It is the same card-page scripts
// over different markup and a different address, which is all a deck page is.
//
// `before` runs after the document exists and before any feature file does, which is the
// only place a stand-in for something the document has to answer can go. A feature that
// asks a question at load time cannot be given that answer afterwards: the question has
// already been answered wrongly and the page is already built.
async function loadDeckPage(state, pageRoutes = routes, html = DECK_HTML, before = null) {
  // English unless the case asks otherwise: the injected UI now follows the one language
  // setting, and the test browser is Russian, so an English page has to say so.
  const page = createPage({
    url: 'https://scryfall.com/@reader/decks/abc123/build', html,
    state: { settingsLanguage: 'en', ...state }, routes: pageRoutes
  });
  if (before) await before(page);
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(60);
  return page;
}

// The deck legality check, which is the one deck feature that asks a question.
//
// What is being asserted is not only that it lists the cards Scryfall calls not legal:
// it is that the panel says which rules it did **not** apply. A legality check that
// reports a deck as fine after asking about each card in turn is the check that guesses,
// and the guess is the part this project has refused three times over.
async function deckLegalityTest() {
  console.log('deck page: the legality check lists what Scryfall says and names its own limits');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="deck-list">
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/mh3/42/test-card">Test Card</a></span></div>
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/penny/1/nineteen-dollar-card">Nineteen Dollar Card</a></span></div>
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/dom/126/dark-ritual">Dark Ritual</a></span></div>
    </div>
    <div class="sidebar"></div>
  </div></body></html>`;
  const answer = {
    format: 'commander', checked: 3, unknown: 1,
    notLegal: [
      { name: 'Nineteen Dollar Card', set: 'penny', collector_number: '1', verdict: 'not_legal',
        uri: 'https://scryfall.com/card/penny/1/nineteen-dollar-card' },
      { name: 'Ancestral Recall', set: 'vma', collector_number: '1', verdict: 'banned',
        uri: 'https://scryfall.com/card/vma/1/ancestral-recall' }
    ]
  };
  const sent = [];
  const page = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: message => { sent.push(message); return answer; } }, html);

  const button = page.document.querySelector('.stk-legality-button');
  assert(button, 'the deck page has a button for it');
  assertEqual(button.textContent, 'Check cards for Commander',
    'and it says what it does — check cards, not the deck — in the page language rather than ' +
    'the one it was written in');
  button.dispatchEvent(new page.window.Event('click'));
  await sleep(60);

  assertEqual(sent.length, 1, 'pressing it asks the worker once');
  assertEqual(sent[0].entries, [
    { set: 'mh3', collector_number: '42' },
    { set: 'penny', collector_number: '1' },
    { set: 'dom', collector_number: '126' }
  ], 'and the deck is read off the page as set and collector number, not names');

  const dialog = page.document.getElementById('stk-deck-legality');
  assert(dialog, 'the answer opens in a dialog');
  const text = dialog.textContent;
  assert(/Nineteen Dollar Card/.test(text), 'the card Scryfall calls not legal is named');
  assert(/PENNY #1/.test(text), 'with its set and number, so two printings of one name are told apart');
  // Scryfall has four verdicts, not two, and a banned card is a different problem from a
  // card that was simply never legal here. Paraphrasing both as "not legal" would throw
  // away a distinction Scryfall took the trouble to make - and a reader who was told only
  // "not legal" about Ancestral Recall would go looking for a different printing of it.
  assert(/Ancestral Recall/.test(text) && /VMA #1/.test(text), 'a banned card is named too');
  assert(/banned in Commander/.test(text), 'and says Scryfall called it banned, in the reader\'s words');
  // Per row, not across the dialog: the two cards are both on the list and one row after
  // another, so a whole-dialog match would pair every card with every verdict.
  const rows = [...page.document.querySelectorAll('.stk-legality-list li')];
  const rowFor = needle => rows.find(row => row.textContent.includes(needle));
  assert(!/banned/.test(rowFor('Nineteen Dollar Card').textContent),
    'and a card that is merely not legal is not given the banned wording');
  assert(!/Test Card(?![^\n]*#42)|Test Card —/.test(text.replace(/\s+/g, ' ')) || /mh3|MH3/.test(text),
    'and a card Scryfall calls legal is not on the list');
  // The limits, which is the half a list of card names cannot give. In the page's own
  // language: these are strings written in Russian and translated, and a panel whose
  // warnings are the only part not translated is the worst place for that to show.
  assert(/commander.{0,3}s colour identity/i.test(text),
    'the panel names the commander colour identity it did not check');
  assert(/hundred-card limit/i.test(text), 'and the hundred-card limit');
  assert(/one-copy rule/i.test(text), 'and the one-copy rule');
  assert(/said nothing about/i.test(text), 'and says that one card had no answer, apart from not-legal');
  assert(/Commander/.test(text), 'and says which format it judged');

  const ru = await loadDeckPage({ deckLegality: true, clipboard: false, settingsLanguage: 'ru' },
    { ...routes, deckLegality: () => answer }, html);
  ru.document.querySelector('.stk-legality-button').dispatchEvent(new ru.window.Event('click'));
  await sleep(60);
  const ruText = ru.document.getElementById('stk-deck-legality').textContent;
  assertEqual(ru.document.querySelector('.stk-legality-button').textContent, 'Проверить карты в Commander',
    'the button is Russian when the page is, and says it checks cards rather than the deck');
  assert(/цветовая идентичность командира/i.test(ruText),
    'and the limits are named in Russian too, not left in English');
  assert(/одной копии/i.test(ruText), 'all three of them');

  // The note is last on purpose and the stylesheet pins it there: a hundred-card deck
  // puts it 2,276 pixels down a 1,018-pixel window otherwise. The two halves are one
  // arrangement, so both are asserted — what the panel builds, and what keeps it there.
  const result = page.document.querySelector('.stk-legality-result');
  const last = result.lastElementChild;
  assert(last && last.className === 'stk-legality-note' && last.parentElement === result,
    'the note is the last thing in the panel, so a scrollbar has nothing to hide it behind');
  assert(/hundred-card limit/.test(last.textContent) && /one-copy rule/.test(last.textContent),
    'and the last thing in it is the paragraph that names the limits, not the line about the cards Scryfall would not answer for');

  // The other answers, because a check that only ever has one result is not a check.
  const clean = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: () => ({ format: 'commander', checked: 3, unknown: 0, notLegal: [] }) }, html);
  clean.document.querySelector('.stk-legality-button')
    .dispatchEvent(new clean.window.Event('click'));
  await sleep(60);
  assert(/every card in the deck/i.test(clean.document.getElementById('stk-deck-legality').textContent),
    'a clean deck says so rather than showing an empty list');
  assert(/colour identity/i.test(clean.document.getElementById('stk-deck-legality').textContent),
    'and still names what it did not check, because a clean answer is the one most worth qualifying');

  const silent = await loadDeckPage({ deckLegality: true, clipboard: false },
    { ...routes, deckLegality: () => ({ format: 'commander', checked: 0, unknown: 0, notLegal: [] }) }, html);
  silent.document.querySelector('.stk-legality-button')
    .dispatchEvent(new silent.window.Event('click'));
  await sleep(60);
  assert(/did not answer about a single card/i.test(silent.document.getElementById('stk-deck-legality').textContent),
    'and a deck Scryfall said nothing about is not reported as a clean deck');

  // The switch, because a feature that cannot be turned off is a feature everybody has.
  const off = await loadDeckPage({ deckLegality: false, clipboard: false }, routes, html);
  assert(!off.document.querySelector('.stk-legality-button'),
    'with the switch off the button is not on the page at all');
  // And only on a deck, not on a card page that happens to have the markup.
  const elsewhere = await loadDeckPage({ deckLegality: true, clipboard: false }, routes,
    html.replace('https://scryfall.com/@reader/decks/abc123/build', ''));
  assert(elsewhere, 'a deck page built at another address still loads');
}

// Where the deck buttons go, which is the one decision on this page that depends on
// something a test has to supply.
//
// Scryfall's stylesheet shows `.sidebar` only from 800px up and keeps one on a narrow
// screen with the class `always-visible`, so below that the sidebar is `display:none`:
// present in the markup, zero pixels on screen. Both buttons used to be prepended into it
// whenever it existed, and it exists at every width — so on a phone the token dialog and
// the legality check were 0x0 controls and neither could be opened. The fix asks the
// browser whether the sidebar is on screen and puts the button beside the deck list when it
// is not; the second container was already named in the old fallback and was simply never
// reached, because the test was whether the sidebar was *absent* rather than *shown*.
//
// `getClientRects()` is the browser's own answer and the reason this is testable here: an
// element with `display:none` produces no boxes. linkedom has no layout and no
// `getClientRects` at all, so the harness has to say which way the answer goes — and that
// is the whole content of this test. It cannot be checked by `npm run render`, which is
// where that limitation is written down: the features run in the harness and the browser
// only draws what they left behind, so a decision made here cannot be revisited there.
async function deckButtonPlacementTest() {
  console.log('deck page: the buttons go where a reader can see them, not into a hidden box');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="deck-list">
      <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/mh3/42/test-card">Test Card</a></span></div>
    </div>
    <div class="sidebar"></div>
  </div></body></html>`;

  // What the browser says about the sidebar, given as an argument rather than as a stub on
  // the prototype: two pages, two answers, and the page is otherwise identical.
  const pageWhereSidebarHas = boxes => loadDeckPage(
    { deckTokens: true, deckLegality: true }, routes, html,
    page => {
      // One box per element that is on screen. `display:none` produces none, which is the
      // answer the feature reads and the only thing this test varies.
      page.document.querySelector('#main .sidebar').getClientRects =
        () => boxes.map(() => ({ width: 540, height: 900 }));
    });

  // One box: the sidebar is on screen, which is the desktop.
  const shown = await pageWhereSidebarHas([{}]);
  assert(shown.document.querySelector('#main .sidebar .stk-token-button'),
    'a sidebar that is on screen is where the token button goes');
  assert(shown.document.querySelector('#main .sidebar .stk-legality-button'),
    'and the legality button with it, so the two are never in different places');

  // No boxes: `display:none`, which is every width below 800px — the phone.
  const hidden = await pageWhereSidebarHas([]);
  const main = hidden.document.getElementById('main');
  const tokenButton = hidden.document.querySelector('.stk-token-button');
  const legalityButton = hidden.document.querySelector('.stk-legality-button');
  assert(tokenButton, 'a sidebar with no boxes still gets a button — beside the deck list');
  assert(!hidden.document.querySelector('#main .sidebar .stk-token-button'),
    'and not the unreachable one inside the hidden sidebar');
  assert(!hidden.document.querySelector('#main .sidebar .stk-legality-button'),
    'the legality button too');
  assert(tokenButton && tokenButton.parentElement === main,
    'the token button is in the deck list\'s own container, which is on screen at every width');
  assert(legalityButton && legalityButton.parentElement === main,
    'and the legality button in the same place');
  assert(main.contains(hidden.document.querySelector('.deck-list')),
    'which is the container the deck list is in, so there is something to sit above');

  // The degradation, pinned because the rest of this file depends on it: with no
  // `getClientRects` at all — linkedom's own state — the sidebar is used, which is what the
  // code did before there was a question to ask. Guessing "hidden" would move the buttons
  // somewhere these tests never look and fail for a reason that is not a defect.
  const silent = await loadDeckPage({ deckTokens: true }, routes, html);
  assertEqual(typeof silent.document.querySelector('#main .sidebar').getClientRects,
    'undefined', 'the harness has no getClientRects of its own, so the tests supply it');
  assert(silent.document.querySelector('#main .sidebar .stk-token-button'),
    'and with no answer available the sidebar is used, as it was before');
}

// The sets index, which is the other surface the set filters act on.
//
// It is built the way the extension builds it — the same scripts, over Scryfall's own row
// markup, at Scryfall's own address — because the rule is decided by what a row's link says
// and a fixture that did not look like the page could not tell a working filter from a broken
// one. `#js-checklist` and `/sets/<code>` are the page's own names, not this file's.
const SETS_HTML = `<!DOCTYPE html><html><body><div id="main">
  <div class="search-controls"><label for="order">1059 of 1064 sets in</label></div>
  <table class="checklist" id="js-checklist"><tbody>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/mh3">Modern Horizons 3</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/por">Portal</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/wmkm">MKM Japanese Promo Tokens</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/sld">Secret Lair Drop</a></td></tr>
    <tr><td class="flexbox"><a href="https://scryfall.com/sets/ysos">Alchemy: Innistrad</a></td></tr>
  </tbody></table>
</div></body></html>`;

async function loadSetsPage(state, pageRoutes = routes, html = SETS_HTML) {
  const page = createPage({
    url: 'https://scryfall.com/sets', html,
    state: { settingsLanguage: 'en', ...state }, routes: pageRoutes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(80);
  return page;
}

// The set codes of the rows the page has marked, read out of each row's own link. The link is
// a full address on this page, and the code is the last segment, so it is read from there
// rather than from a path this file assumes.
const hiddenSets = page => [...page.document.querySelectorAll('#js-checklist tbody tr')]
  .filter(row => row.classList.contains('stk-digital-set-hidden'))
  .map(row => (/\/sets\/([^/?#]+)/.exec(
    row.querySelector('td:first-child a[href]')?.getAttribute('href') || '') || [])[1])
  .filter(Boolean);

async function loadCardPage(state, pageRoutes = routes) {
  // English unless the case asks otherwise: the injected UI now follows the one language
  // setting, and the test browser is Russian, so an English page has to say so.
  const page = createPage({
    url: 'https://scryfall.com/card/tst/1/test-card', html: CARD_HTML,
    state: { settingsLanguage: 'en', ...state }, routes: pageRoutes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(60);
  return page;
}

async function cardPageTest() {
  console.log('content scripts: card page');
  const page = await loadCardPage({ cards: [], euroPriceSources: 'both' });
  const { document, mock, location } = page;

  // Clipboard shell.
  const aside = document.getElementById('scryfall-toolkit-clipboard');
  assert(aside, 'clipboard aside is injected');
  assertEqual(aside.querySelector('.stk-toolbar').children.length, 3, 'toolbar has wrapped copy, clear and open buttons');
  const list = aside.querySelector('.stk-list');
  assert(list.hidden, 'clipboard list starts hidden');
  click(aside.querySelector('.stk-icon-clip'));
  assert(!list.hidden, 'clip button reveals the list');

  // Card page scan button.
  const scanButton = document.querySelector('.card-image .stk-add');
  assert(scanButton, 'grid-less card page gets an add button on the card image');
  assertEqual(scanButton.textContent, '+', 'fresh card is not selected yet');

  // Native print buttons live inside the prints table.
  const buttonOf = href => [...document.querySelectorAll('#main .prints-table .stk-native-print-add')]
    .find(button => button.closest('tr').querySelector('a[href]')?.getAttribute('href').includes(href));
  assert(buttonOf('/tst/1/'), 'current printing row gets an add button');
  assert(buttonOf('/tst/2/'), 'second native row gets an add button');
  assert(buttonOf('/mh3/42/'), 'third native row gets an add button');
  assertEqual(document.querySelectorAll('#main .prints-table .stk-native-print-add').length, 3,
    'every printing row Scryfall shows has an add button');

  // Finish badges from the finishes response.
  assert(document.querySelector('.stk-finish-header'), 'finish column header is added');
  assertEqual(document.querySelectorAll('.stk-finish-nonfoil').length, 1, 'nonfoil badge rendered');
  assertEqual(document.querySelectorAll('.stk-finish-foil').length, 1, 'foil badge rendered');
  assertEqual(document.querySelectorAll('.stk-finish-etched').length, 1, 'etched badge rendered');
  assertEqual(document.querySelector('.currency-usd').textContent, '$7.82',
    'Scryfall’s star in a price is dropped, the finish column carries it');

  // Tags panel.
  const tagsPanel = await waitFor(
    () => (document.getElementById('stk-tags') && !document.getElementById('stk-tags').classList.contains('stk-loading')
      ? document.getElementById('stk-tags') : null),
    '#stk-tags to load'
  );
  assert(tagsPanel.querySelector('.stk-card-table'), 'card tags table rendered');
  const relationLink = await waitFor(
    () => tagsPanel.querySelector('.stk-related-table a[title*="better than"]'),
    'relation link with correct tooltip'
  );
  assertEqual(relationLink.title, 'better than: Other Card', 'BETTER_THAN relation tooltip reads better than');
  assertEqual(
    relationLink.getAttribute('href'),
    `/search?q=${encodeURIComponent(`oracleid:${REL_ID}`)}`,
    'relation link falls back to an oracle search URL'
  );
  const tagIcon = relationLink.closest('tr').querySelector('.stk-tag-icon');
  assert(tagIcon, 'relation row has a tag icon');
  assert(tagIcon.title.toLowerCase().includes('better'), 'icon tooltip says better, not worse');
  assert(!tagIcon.classList.contains('icon-flipped'), 'better-than icon keeps its original direction');
  const worseLink = tagsPanel.querySelector('.stk-related-table a[title*="worse than"]');
  assert(worseLink, 'worse relation row rendered');
  assertEqual(worseLink.title, 'worse than: Worse Card', 'WORSE_THAN relation tooltip reads worse than');
  const worseIcon = worseLink.closest('tr')?.querySelector('.stk-tag-icon');
  assert(worseIcon && worseIcon.classList.contains('icon-flipped'), 'worse-than icon is inverted');

  // Related card click opens its real card page via preview.
  click(relationLink);
  await waitFor(() => location.assigned.includes('https://scryfall.com/card/oth/1/other-card'), 'relation navigation');

  // Legalities: extra premodern row from the card response.
  await waitFor(() => /Premodern/.test(document.querySelector('#main .card-legality').textContent), 'premodern legality cell');
  const legalityTable = document.querySelector('#main .card-legality');
  assertEqual(legalityTable.querySelectorAll('dt').length, 3, 'catalog rows plus Premodern row are present');
  const premodernCell = [...legalityTable.querySelectorAll('.card-legality-item')]
    .find(cell => cell.querySelector('dt').textContent === 'Premodern');
  assertEqual(premodernCell.querySelector('dd').textContent, 'Legal', 'Premodern legality is Legal');

  // Add the current printing through the scan button.
  click(scanButton);
  await waitFor(() => scanButton.textContent === '✓', 'scan button selected');
  assertEqual(mock.state.cards.length, 1, 'card added through scan button');
  assertEqual(mock.state.cards[0], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/1/test-card', set: 'tst', number: '1'
  }, 'scan card saved with set and number, without forceSet');

  // Native print buttons add printings with forceSet. Their label updates only
  // after the async add resolves, so wait on the label itself. The first row is
  // the current printing and mirrors the scan button, so it is skipped here.
  const tst2Add = buttonOf('/tst/2/');
  click(tst2Add);
  await waitFor(() => tst2Add.textContent === '✓', 'first native print button selected');
  assertEqual(mock.state.cards.length, 2, 'first native print added');
  assertEqual(mock.state.cards[1], {
    name: 'Test Card', url: 'https://scryfall.com/card/tst/2/test-card', set: 'tst', number: '2', forceSet: true
  }, 'native print saved with forceSet');
  const mh3Add = buttonOf('/mh3/42/');
  click(mh3Add);
  await waitFor(() => mh3Add.textContent === '✓', 'second native print button selected');
  assertEqual(mock.state.cards.length, 3, 'second native print added');
  assertEqual(mock.state.cards[2], {
    name: 'Test Card', url: 'https://scryfall.com/card/mh3/42/test-card', set: 'mh3', number: '42', forceSet: true
  }, 'second native print saved with forceSet');

  // Rows display the set code and collector number.
  const setSpans = [...list.querySelectorAll('.stk-list-set')].map(span => span.textContent);
  assertEqual(setSpans, ['(TST) 1', '(TST) 2', '(MH3) 42'], 'buffer rows show set code and number');

  // Copy all: the settings' format on a plain click; the other format in the hover
  // menu. The menu names whichever format the setting is NOT using, so the two buttons
  // can never do the same thing.
  const copyWrap = aside.querySelector('.stk-copy-wrap');
  assert(copyWrap, 'copy button wrapped in a hover menu');
  const copyMenu = copyWrap.querySelector('.stk-copy-menu');
  assert(copyMenu.hidden, 'alternative-format menu starts hidden');
  const copyAll = copyWrap.querySelector('.stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'default copy includes set codes');

  // The menu reads the setting when it opens, so it appears a turn later than the hover.
  fireEvent(copyWrap, 'mouseenter');
  await waitFor(() => !copyMenu.hidden, 'hovering copy opens the menu above');
  const plain = copyMenu.querySelector('.stk-copy-plain');
  // With moxfield chosen, the menu offers the other format, by its own name. It used
  // to say "Names only, no sets" always, which meant that whoever had chosen names in
  // the settings had two buttons doing the same thing and could not reach the set
  // format from here at all.
  assertEqual(plain.textContent, '1 Card name', 'menu offers the format the setting is not using');
  click(plain);
  await waitFor(() => mock.clipboardWrites.length === 2, 'alternative-format copy wrote to clipboard');
  // Three printings of one card, and no set on any line to tell them apart, so they
  // are counted instead. Writing "1 Test Card" three times says the same thing more
  // slowly and pastes into a deck list as three copies.
  assertEqual(mock.clipboardWrites[1], '3 Test Card',
    'without a set on the line, repeat names are counted rather than repeated');
  assert(copyMenu.hidden, 'menu closes after choosing');
  fireEvent(copyWrap, 'mouseleave');
  assert(copyMenu.hidden, 'menu stays closed after leaving');

  // The options setting still picks the default for the plain click. Two of the three
  // entries carry forceSet, which used to be enough on its own to print a set whatever
  // format was asked for — so this one line was '1 Test Card' and the next two carried
  // sets, under a setting whose name promised one or the other.
  mock.state.exportFormat = 'names';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 3, 'setting-driven copy wrote to clipboard');
  assertEqual(mock.clipboardWrites[2], '3 Test Card',
    'the names format means names, including for printings added one by one');

  // And the other way round: with names chosen, the menu offers the set format and
  // gives the sets, because asked for moxfield is asked for moxfield.
  fireEvent(copyWrap, 'mouseenter');
  await waitFor(() => plain.textContent === '1 Card name (SET) number',
    'the menu follows the setting instead of being fixed');
  assertEqual(plain.textContent, '1 Card name (SET) number',
    'the menu follows the setting instead of being fixed');
  click(plain);
  await waitFor(() => mock.clipboardWrites.length === 4, 'the set format is reachable from the menu');
  assertEqual(mock.clipboardWrites[3],
    '1 Test Card (TST) 1\n1 Test Card (TST) 2\n1 Test Card (MH3) 42',
    'the alternative is the set format, and it carries sets');

  // Clear the clipboard.
  click(aside.querySelector('.stk-icon-trash'));
  await waitFor(() => mock.state.cards.length === 0, 'clipboard cleared');
  assert(aside.querySelector('.stk-count').hidden, 'badge hidden for an empty clipboard');
}

async function searchPageTest() {
  console.log('content scripts: search page');
  const html = `<!DOCTYPE html><html><body><div id="main" class="card-grid">
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/grid/9/grid-card"></a>
      <span class="card-grid-item-invisible-label">Grid Card</span><img alt="Grid Card (GRID) 9"></div>
    <div class="card-grid-item" aria-hidden="true"><a class="card-grid-item-card" href="https://scryfall.com/card/hidden/1/hidden"></a>
      <span class="card-grid-item-invisible-label">Hidden Card</span><img alt="Hidden Card"></div>
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/14/janeway-borderless"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/15/janeway-showcase"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
    <div class="card-grid-item"><a class="card-grid-item-card" href="https://scryfall.com/card/trk/22/janeway-autograph"></a>
      <span class="card-grid-item-invisible-label">Captain Janeway</span></div>
  </div></body></html>`;
  const page = createPage({
    url: 'https://scryfall.com/search?q=grid', html,
    state: { settingsLanguage: 'en', cards: [] }, routes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(60);
  const { document, mock } = page;

  assert(!document.getElementById('stk-tags'), 'search page does not build a tag panel');
  const addButtons = [...document.querySelectorAll('.card-grid-item:not([aria-hidden="true"]) .stk-add')];
  assertEqual(addButtons.length, 4, 'only visible grid items get add buttons');
  assertEqual(addButtons[0].getAttribute('aria-label'), 'Add Grid Card', 'button label names the card');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 1, 'grid card added');
  assertEqual(mock.state.cards[0], {
    name: 'Grid Card', url: 'https://scryfall.com/card/grid/9/grid-card', set: 'grid', number: '9'
  }, 'grid card saved with set and number');

  const copyAll = document.querySelector('#scryfall-toolkit-clipboard .stk-toolbar .stk-icon-duplicate');
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 1, 'grid copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[0], '1 Grid Card (GRID) 9', 'default format includes set and number');

  click(addButtons[0]);
  await waitFor(() => mock.state.cards.length === 0, 'grid card toggled off');

  // One name, three printings. This is the set-page case: a card is legitimately shown
  // as an alternate borderless, a showcase and an autograph, all three carrying the same
  // name. The selection used to be keyed on the name, so adding the first ticked all
  // three, and adding a second removed the first instead of adding it.
  const janeway = addButtons.slice(1);
  click(janeway[0]);
  await waitFor(() => mock.state.cards.length === 1, 'first printing added');
  assertEqual(janeway[0].textContent, '✓', 'the printing that was clicked is ticked');
  assertEqual([janeway[1].textContent, janeway[2].textContent], ['+', '+'],
    'the other printings of the same card are not ticked along with it');
  assertEqual(mock.state.cards[0].number, '14', 'the set and number name the printing, not the name');

  click(janeway[1]);
  await waitFor(() => mock.state.cards.length === 2,
    'a second printing of the same card can be added as well');
  assertEqual([janeway[0].textContent, janeway[1].textContent, janeway[2].textContent], ['✓', '✓', '+'],
    'each printing carries its own tick');

  // And removing one leaves the others alone.
  click(janeway[0]);
  await waitFor(() => mock.state.cards.length === 1, 'clicking a tick removes only its own printing');
  assertEqual([janeway[0].textContent, janeway[1].textContent], ['+', '✓'],
    'the other printing is still selected');

  // Two printings of one card, and no set to tell the lines apart, so the export counts
  // them rather than writing the name twice.
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 2, 'repeat-name copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[1], '1 Captain Janeway (TRK) 15', 'a single printing is still one of it');
  click(janeway[2]);
  await waitFor(() => mock.state.cards.length === 2, 'third printing added');
  mock.state.exportFormat = 'names';
  click(copyAll);
  await waitFor(() => mock.clipboardWrites.length === 3, 'names-only copy-all wrote to clipboard');
  assertEqual(mock.clipboardWrites[2], '2 Captain Janeway',
    'two printings of one card copy as a count, not as the name twice');
}

async function clipboardDisabledTest() {
  console.log('content scripts: clipboard disabled');
  const page = await loadCardPage({ clipboard: false, cards: [] });
  const { document } = page;
  assert(!document.getElementById('scryfall-toolkit-clipboard'), 'no clipboard when disabled');
  assert(!document.querySelector('.stk-native-print-add'), 'no native print buttons when clipboard disabled');
  assertEqual(page.context.STK_ADD_PRINT, undefined, 'no STK_ADD_PRINT handler when clipboard disabled');
}








async function legacyMigrationTest() {
  console.log('content scripts: legacy cardClipboard migration');
  const page = createPage({
    url: 'https://scryfall.com/search?q=x',
    html: '<!DOCTYPE html><html><body><div id="main"></div></body></html>',
    state: {},
    localStorage: { cardClipboard: JSON.stringify([{ cardName: 'Old Card', cardLink: 'https://scryfall.com/card/lea/1/old' }]) },
    routes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(60);
  assertEqual(page.mock.state.cards, [
    { name: 'Old Card', url: 'https://scryfall.com/card/lea/1/old', set: '', number: '' }
  ], 'legacy localStorage entries migrated into storage.cards');
}

async function advancedPriceFilterTest() {
  console.log('content scripts: advanced search price filter follows the hidden columns');
  const html = `<!DOCTYPE html><html><body><div id="main">
    <div class="form-row-content-band">
      <select name="price_1" id="price_1">
        <option value="usd">USD</option><option value="eur">Euros</option><option value="tix">MTGO Tickets</option>
      </select>
      <select name="price_1_mode" id="price_1_mode">
        <option value="&lt;">less than</option><option value="&gt;">greater than</option>
      </select>
    </div>
  </div></body></html>`;
  const load = async (state, url) => {
    const page = createPage({ url, html, state: { settingsLanguage: 'en', ...state }, routes });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
      await page.cardPage();
    await sleep(60);
    return page;
  };

  const on = await load({ onlyCardmarket: true, clipboard: false }, 'https://scryfall.com/advanced');
  const { document } = on;
  const options = () => [...document.querySelectorAll('#price_1 option')].map(option => `${option.value}:${option.textContent}`);
  assertEqual(options(), ['eur:Cardmarket (€)'], 'with dollar and ticket columns hidden only the Cardmarket search remains');
  assertEqual(document.querySelectorAll('#price_1_mode option').length, 2, 'the comparison select is left alone');

  const off = await load({ onlyCardmarket: false, clipboard: false }, 'https://scryfall.com/advanced');
  assertEqual([...off.document.querySelectorAll('#price_1 option')].map(option => option.value), ['usd', 'eur', 'tix'],
    'with every column visible the currency choices stay as Scryfall made them');

  // The switches are independent, which is the whole point of having one per kind.
  // `onlyCardmarket` was one switch hiding both currencies and every shop together, so a reader
  // who wanted no TCGplayer links but kept the dollar column had no way to say so.
  //
  // The fixture is the current shape — platforms and all — because a value with prices and no
  // platforms is read as the 1.4.x shape and its prices are inverted, which is right for that
  // shape and would make these cases test the migration instead of the filter.
  const withPrices = async (prices, storage = {}) => {
    const page = await load({
      clipboard: false,
      setFiltersMigrated: true,
      ...storage,
      setFilters: {
        platforms: Object.fromEntries(PLATFORMS.map(name =>
          [name, { show: true, areas: { prints: true, search: true, sets: true } }])),
        prices
      }
    }, 'https://scryfall.com/advanced');
    return [...page.document.querySelectorAll('#price_1 option')].map(option => option.value);
  };
  assertEqual(await withPrices({ tix: false }), ['usd', 'eur'],
    'hiding only MTGO Tickets leaves the dollar search alone');
  assertEqual(await withPrices({ usd: false }), ['eur', 'tix'],
    'and hiding only the dollar column leaves the ticket search alone');
  assertEqual(await withPrices({}), ['usd', 'eur', 'tix'],
    'an empty prices object is no prices hidden, not all of them');
  // The euro option follows the EUR source, not a shop's switch: `none` is the reader saying
  // they want no euro column, and there is no price kind that means that. The euro option is
  // Scryfall's `eur` and the source is one of four words, so the two are compared as words
  // rather than assumed to be the same thing — the mismatch that left the TCGplayer links
  // unhidden, in another file.
  assertEqual(await withPrices({}, { euroPriceSources: 'none' }), ['usd', 'tix'],
    'and the euro search goes with the EUR source being "show nothing"');
  assertEqual(await withPrices({}, { euroPriceSources: 'ct' }), ['usd', 'eur', 'tix'],
    'while choosing CardTrader as the source keeps the euro search, since the column is there');
  for (const prices of [{ usd: false }, { tix: false }, { usd: false, tix: false }]) {
    assert((await withPrices(prices)).includes('eur'),
      `the euro option survives with prices ${JSON.stringify(prices)}`);
  }
}

// The price filter, which had no test at all until this one — and that is why it shipped broken.
//
// `initPriceFilter` read the *key* of its shop map as if it were the model's key for that shop.
// The map is `hostname: modelKey`, and TCGplayer's model key is `tcg` while its hostname is
// `tcgplayer.com`, so `prices.tcgplayer` was asked for, found nothing, and the TCGplayer links
// were never hidden. Cardhoarder's worked only because its hostname and its key are the same
// word, which is exactly the shape of bug that a test covering one case would have missed and a
// test covering the group catches.
async function priceFilterTest() {
  console.log('content scripts: the price filter hides the columns and the shop links it names');
  const html = `<!DOCTYPE html><html><head>
    <meta name="scryfall:card:id" content="${PRINT_CURRENT}">
    <title>Test Card</title></head><body>
    <div id="main">
      <!-- The card-image block is what makes this a card page, and the EUR source lives in a
           step gated on that: without it the source cases below would test nothing. -->
      <div class="card-image"><img src="https://cards.scryfall.io/normal/x.jpg" alt=""></div>
      <div class="prints">
      <table class="prints-table">
        <thead><tr><th>Name</th><th>Set</th><th><span>USD</span></th><th><span>EUR</span></th><th><span>TIX</span></th></tr></thead>
        <tbody><tr class="current">
          <td><a data-card-id="${PRINT_CURRENT}" href="https://scryfall.com/card/tst/1/test-card">Test Set #1</a></td>
          <td>TST</td><td>$7.82</td><td>€3.92</td><td>0.05</td>
        </tr></tbody>
      </table>
    </div>
    <div id="stores"><ul class="toolbox-links">
      <li><a href="https://partner.tcgplayer.com/x">Buy on TCGplayer</a></li>
      <li><a href="https://www.cardhoarder.com/cards/x">Buy on Cardhoarder</a></li>
      <li><a href="https://www.cardmarket.com/en/Magic/Products/x">Buy on Cardmarket</a></li>
    </ul></div>
  </div></body></html>`;
  const load = async (prices, filters = {}, storage = {}) => {
    const page = createPage({
      url: 'https://scryfall.com/card/tst/1/test-card', html, routes,
      // Two places, because the settings are in two places: the hiding group is one storage key
      // and the EUR source is another. Putting the source inside `setFilters` is how this
      // fixture first tested nothing at all — the page read the default and the case passed for
      // the wrong reason.
      state: {
        settingsLanguage: 'en',
        clipboard: false,
        setFiltersMigrated: true,
        ...storage,
        setFilters: {
          platforms: Object.fromEntries(PLATFORMS.map(name =>
            [name, { show: true, areas: { prints: true, search: true, sets: true } }])),
          prices,
          ...filters
        }
      }
    });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
    await page.cardPage();
    await sleep(60);
    return page;
  };
  // Named by what is hidden rather than by counting: a count would pass with the wrong three.
  const hiddenHeads = document => [...document.querySelectorAll('#main .prints-table thead th')]
    .filter(th => th.classList.contains('stk-price-hidden')).map(th => th.textContent.trim()).sort();
  const hiddenCells = document => [...document.querySelectorAll('#main .prints-table tbody td')]
    .filter(td => td.classList.contains('stk-price-hidden')).map(td => td.textContent.trim()).sort();
  const hiddenLinks = document => [...document.querySelectorAll('#stores .toolbox-links a')]
    .filter(a => a.classList.contains('stk-price-hidden')).map(a => new URL(a.href).hostname).sort();

  // Every switch on: nothing is hidden. This is the default a reader who has never opened the
  // settings gets, and it is the one case where the feature must do nothing at all.
  const all = await load({ usd: true, tix: true, tcg: true, cardhoarder: true, cardmarket: true });
  assertEqual([hiddenHeads(all.document), hiddenCells(all.document), hiddenLinks(all.document)],
    [[], [], []], 'with every price shown nothing is hidden, and the filter does not run at all');

  // One shop off. This is the assertion the old code failed: `tcg` and `tcgplayer` are different
  // words, and the one the model stores is the one that has to be read.
  const noTcg = await load({ usd: true, tix: true, tcg: false, cardhoarder: true, cardmarket: true });
  assertEqual(hiddenLinks(noTcg.document), ['partner.tcgplayer.com'],
    'turning TCGplayer off hides the TCGplayer link, which it did not do before');
  assertEqual(hiddenHeads(noTcg.document), [],
    'and hides no column: a shop is a link and a currency is a column, which is why they are two kinds');
  assertEqual([...noTcg.document.querySelectorAll('#stores .toolbox-links li')]
    .filter(li => li.classList.contains('stk-price-hidden')).length, 1,
  'and the row around it goes too, so the list has no empty line in it');

  // Cardhoarder, the case that used to work by accident.
  const noCardhoarder = await load({ usd: true, tix: true, tcg: true, cardhoarder: false, cardmarket: true });
  assertEqual(hiddenLinks(noCardhoarder.document), ['www.cardhoarder.com'],
    'turning Cardhoarder off hides the Cardhoarder link and leaves the other two');

  // Cardmarket is a shop here and nothing more: its box hides the cardmarket.com link, and the
  // euro column it prices is not this filter's business. That column is the EUR source setting's,
  // which has a "show nothing" of its own — answering it in two places would be two controls for
  // one question.
  const noCardmarket = await load({ usd: true, tix: true, tcg: true, cardhoarder: true, cardmarket: false });
  assertEqual(hiddenLinks(noCardmarket.document), ['www.cardmarket.com'],
    'turning Cardmarket off hides the Cardmarket link');
  assertEqual(hiddenHeads(noCardmarket.document), [],
    'and hides no column: the euro column is the EUR source setting\'s to remove, not a shop\'s');

  // The euro column, removed by the source setting rather than by a shop.
  const noEuro = await load({ usd: true, tix: true, tcg: true, cardhoarder: true, cardmarket: true },
    {}, { euroPriceSources: 'none' });
  assertEqual(hiddenHeads(noEuro.document), ['EUR'],
    'and "show nothing" as the EUR source hides the euro column');
  assertEqual(hiddenCells(noEuro.document), ['€3.92'],
    'and the cells under it, so the column is gone rather than emptied');
  assertEqual(hiddenLinks(noEuro.document), [],
    'while no shop link is touched, because a source is not a shop');

  // And the other handle on the same column: the EUR box in the price group. The settings page
  // keeps the two in step, and the card page reads both, because a value written by hand should
  // not be able to put the column back against the reader's answer.
  const noEurBox = await load({ usd: true, tix: true, eur: false, tcg: true, cardhoarder: true, cardmarket: true });
  assertEqual(hiddenHeads(noEurBox.document), ['EUR'],
    'and unticking the EUR box hides the same column');
  assertEqual(hiddenCells(noEurBox.document), ['€3.92'], 'with its cells');
  assertEqual(hiddenLinks(noEurBox.document), [],
    'and no link, because the euro column is a price and not a shop');

  // The currencies, which are columns and not links.
  const noCurrencies = await load({ usd: false, tix: false, tcg: true, cardhoarder: true, cardmarket: true });
  assertEqual(hiddenHeads(noCurrencies.document), ['TIX', 'USD'],
    'turning the two currencies off hides their columns and leaves the euro one');
  assertEqual(hiddenLinks(noCurrencies.document), [],
    'and touches no shop link, because a currency is not a shop');

  // The general switch over the block the three shops sit in. It is not a shop and not a price:
  // hiding each shop leaves the heading and the block itself behind, and a reader who buys
  // nowhere wants the block gone rather than emptied.
  const allPrices = { usd: true, tix: true, tcg: true, cardhoarder: true, cardmarket: true };
  const withBlock = await load(allPrices);
  assert(!withBlock.document.querySelector('#stores').classList.contains('stk-price-hidden'),
    'the store block is shown by default, like every other switch here');
  const noBlock = await load(allPrices, { showStores: false });
  assert(noBlock.document.querySelector('#stores').classList.contains('stk-price-hidden'),
    'and hiding it hides the whole block, heading and all — not just its links');
  assertEqual([hiddenHeads(noBlock.document), hiddenCells(noBlock.document), hiddenLinks(noBlock.document)],
    [[], [], []],
  'while no price and no individual link is touched: the block is the general switch and the ' +
  'shops are the particular ones, and neither writes the other');
}


async function setPlatformTest() {
  console.log('content scripts: platform filter decides which sets are shown');
  const load = async (state, url, html, pageRoutes = routes) => {
    const page = createPage({
      url, html, state: { settingsLanguage: 'en', ...state }, routes: pageRoutes
    });
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
      await page.cardPage();
    await sleep(80);
    return page;
  };

  const setsHtml = `<!DOCTYPE html><html><body><div id="main">
    <div class="search-controls"><label for="order">3 of 3 sets in</label><select id="order"><option>Name</option></select></div>
    <table id="js-checklist"><tbody>
      <tr><td><a href="https://scryfall.com/sets/mh3">Modern Horizons 3</a></td><td>MH3</td></tr>
      <tr><td><a href="https://scryfall.com/sets/ysos">Alchemy: Secrets of Strixhaven</a></td><td>YSOS</td></tr>
      <tr><td><a href="https://scryfall.com/sets/me2">Magic Online</a></td><td>ME2</td></tr>
    </tbody></table>
  </div></body></html>`;
  const hidden = document => [...document.querySelectorAll('#js-checklist tbody tr')]
    .filter(row => row.classList.contains('stk-digital-set-hidden'))
    .map(row => row.querySelector('a').textContent);

  const paper = await load({ clipboard: false, setPlatforms: ['paper'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(paper.document), ['Alchemy: Secrets of Strixhaven', 'Magic Online'],
    'with only Paper kept the digital sets are hidden from the set list');
  assertEqual(paper.document.querySelector('.search-controls label[for="order"]').textContent, '1 of 3 sets in',
    'the set counter follows the platform filter');

  const arena = await load({ clipboard: false, setPlatforms: ['arena'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(arena.document), ['Modern Horizons 3', 'Magic Online'],
    'with only Arena kept the paper set and the Magic Online set are hidden');

  const all = await load({ clipboard: false, setPlatforms: ['paper', 'arena', 'mtgo'] }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(all.document), [], 'with every platform kept no set is hidden');

  // The same choice, written the way the settings page writes it — as three booleans that
  // are all false — rather than as the old whitelist. An empty whitelist was rescued by the
  // settings page and so never reached here; three falses produce an empty kept list on the
  // page's own terms, and an empty kept list used to be read as "nothing this build can
  // read" and turned back into three.
  const noneKept = await load({
    clipboard: false,
    ...hideOnly(['paper', 'arena', 'mtgo'])
  }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(noneKept.document).length, 3,
    'with every platform switched off every set on the index is hidden');
  assertEqual(noneKept.document.querySelector('.search-controls label[for="order"]').textContent,
    '0 of 3 sets in', 'and the counter above the list says so rather than still counting three');
  // The one state in which that is not a bug: a reader who unticks Paper *and* Arena and
  // Magic Online has asked for nothing, and the page is allowed to show them nothing.
  const paperOnlyIndex = await load({
    clipboard: false,
    ...hideOnly(['arena', 'mtgo'])
  }, 'https://scryfall.com/sets', setsHtml);
  assertEqual(hidden(paperOnlyIndex.document), ['Alchemy: Secrets of Strixhaven', 'Magic Online'],
    'and Paper alone still keeps the one set it is supposed to');

  // The same choice decides which printings the card page's own prints table keeps. The
  // table is Scryfall's; the filter hides the rows of a platform the reader took out and
  // leaves the printing being viewed alone. A grouped table that rebuilt the list from the
  // complete print list used to live here and is gone; this is the native surface now.
  const hiddenPrints = doc => [...doc.querySelectorAll('.prints-table tbody tr')]
    .filter(row => row.classList.contains('stk-digital-set-hidden'))
    .map(row => row.querySelector('td:first-child a[href]')?.getAttribute('href') || '');
  const paperRowsHidden = doc => hiddenPrints(doc).length > 0;

  const everyPlatform = await loadCardPage({ cards: [], setPlatforms: ['paper', 'arena', 'mtgo'] });
  assertEqual(hiddenPrints(everyPlatform.document), [],
    'with every platform kept the card page hides no printing row');

  const arenaOnly = await loadCardPage({ cards: [], setPlatforms: ['arena'] });
  await waitFor(() => paperRowsHidden(arenaOnly.document) ? true : null,
    'native paper printings hidden');
  assert(hiddenPrints(arenaOnly.document).every(href => /\/card\/(?:tst|mh3)\//.test(href)),
    'keeping Arena alone hides the paper printings on the card page');
  assert(!arenaOnly.document.querySelector('.prints-table tbody tr.current')
    .classList.contains('stk-digital-set-hidden'),
  'the printing being viewed stays visible even when its platform is not kept');

  // The place, not the switch: Paper is on, but Paper is out of the prints table alone. The
  // kept list for the table is then Arena and Magic Online, and the paper rows go — the same
  // visible state as switching Paper off, reached the other way. This is the state a single
  // shared list of places could not hold.
  const paperPlaceOff = await loadCardPage({
    cards: [], ...hideOnly([], { paper: { prints: false } })
  });
  await waitFor(() => paperRowsHidden(paperPlaceOff.document) ? true : null,
    'paper rows hidden by the place');
  assert(hiddenPrints(paperPlaceOff.document).every(href => /\/card\/(?:tst|mh3)\//.test(href)),
    'taking Paper out of the prints table alone hides the paper rows there');
  assertEqual(await vm.runInContext(
    'JSON.stringify([...self.STK_CONTENT.chosenForSets])', paperPlaceOff.context),
    '["paper","arena","mtgo"]',
    'while the sets index keeps every platform, because only one place was answered');
}

// The platform rule on both surfaces of one page, asked separately.
//
// The sets index and the rows of a prints table sit on the same document, and each is answered
// from the reader's own places for that surface. This is the test 1.1.0 needed and did not
// have: a rule shipped, the migration mapped onto it, and no check ever asked what one surface
// did as opposed to the other — so a version that looked like it worked did not work anywhere.
//
// So each surface is asked with a different answer, and the fixture is arranged so that only
// one platform can be on one surface and off the other. With a single shared list of places
// that state could not be built at all, which is why it is the case this block is made of.

async function advancedSetFilterTest() {
  console.log('content scripts: advanced search set field follows Games and the platform filter');
  const html = `<!DOCTYPE html><html><body><div id="main"><form class="form-layout">
    <div class="form-row"><div class="form-row-content-band">
      <label><input type="checkbox" name="games[]" value="paper" checked> Paper</label>
      <label><input type="checkbox" name="games[]" value="arena"> Arena</label>
      <label><input type="checkbox" name="games[]" value="mtgo"> Magic Online</label>
    </div></div>
    <div class="form-row">
      <div class="inner-flex">
        <select name="set[]" id="set" multiple>
          <option value="mh3">Modern Horizons 3 (MH3)</option>
          <option value="ysos" selected>Alchemy: Secrets of Strixhaven (YSOS)</option>
          <option value="me2">Magic Online (ME2)</option>
        </select>
      </div>
      <span class="select2 select2-container select2-container--default">
        <span class="select2-results"><ul class="select2-results__options" id="select2-set-results">
        <li class="select2-results__option" role="group"><strong class="select2-results__group">Expansions</strong>
          <ul class="select2-results__options select2-results__options--nested">
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-mh3-svg"></use></svg><span>Modern Horizons 3 (MH3)</span></li>
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-ysos-svg"></use></svg><span>Alchemy: Secrets of Strixhaven (YSOS)</span></li>
          </ul>
        </li>
        <li class="select2-results__option" role="group"><strong class="select2-results__group">Online</strong>
          <ul class="select2-results__options select2-results__options--nested">
            <li class="select2-results__option" role="treeitem"><svg><use xlink:href="#sets-me2-svg"></use></svg><span>Magic Online (ME2)</span></li>
          </ul>
        </li>
      </ul></span>
    </span>
    </div>
  </form></div></body></html>`;
  const load = async (state, pageHtml = html, pageOptions = {}) => {
    const page = createPage({
      url: 'https://scryfall.com/advanced', html: pageHtml,
      state: { settingsLanguage: 'en', ...state }, routes, ...pageOptions
    });
    // linkedom keeps the checked attribute out of the property Scryfall's own
    // markup would set, so the fixture states it before the script reads it.
    for (const box of page.document.querySelectorAll('#main input[name="games[]"]')) {
      box.checked = box.hasAttribute('checked');
    }
    await page.script('src/core/i18n.js');
    await page.script('src/core/format-catalog.js');
    await page.script('src/core/tag-icons.js');
      await page.cardPage();
    await sleep(80);
    return page;
  };
  // Sets are hidden rather than removed, so a wider platform choice can bring
  // them back; only the ones on screen count.
  const selectValues = page => [...page.document.querySelectorAll('select[name="set[]"] option')]
    .filter(option => !option.hidden).map(option => option.value);
  const listValues = page => [...page.document.querySelectorAll('.select2-results__option[role="treeitem"]')]
    .filter(item => !item.hidden)
    .map(item => (item.querySelector('use').getAttribute('xlink:href') || '').replace('#sets-', '').replace('-svg', ''));
  const groups = page => [...page.document.querySelectorAll('.select2-results__option[role="group"]')]
    .filter(group => !group.hidden).map(group => group.querySelector('strong').textContent);
  const tick = (page, value, on) => {
    const box = [...page.document.querySelectorAll('#main input[name="games[]"]')]
      .find(input => input.value === value);
    box.checked = on;
    fireEvent(box, 'change');
  };

  // The Games field above the set field is what the user works with: with only
  // Paper ticked, only paper sets stay in the list.
  const paper = await load({ clipboard: false });
  assertEqual(selectValues(paper), ['mh3', 'ysos'], 'with only Paper ticked in Games the Arena and Magic Online sets are hidden');
  assertEqual(listValues(paper), ['mh3'], 'the rendered dropdown follows the same choice');
  assertEqual(groups(paper), ['Expansions'], 'a group that loses every set is hidden with it');

  // Ticking another platform there brings its sets back, both ways.
  tick(paper, 'arena', true);
  tick(paper, 'paper', false);
  assertEqual(selectValues(paper), ['ysos'], 'switching Games to Arena shows the Arena set again');
  assertEqual(listValues(paper), ['ysos'], 'in the dropdown as well');
  tick(paper, 'mtgo', true);
  assertEqual(selectValues(paper), ['ysos', 'me2'], 'and so does the next platform ticked');
  assertEqual(groups(paper), ['Expansions', 'Online'], 'both groups are on screen again');
  tick(paper, 'paper', true);
  assertEqual(selectValues(paper), ['mh3', 'ysos', 'me2'], 'ticking Paper back restores the paper set');
  tick(paper, 'arena', false);
  tick(paper, 'mtgo', false);

  // The settings choice narrows the same field further.
  const arena = await load({ clipboard: false, setPlatforms: ['arena'] });
  assertEqual(selectValues(arena), ['mh3', 'ysos'], 'with Games on Paper the Arena-only setting has nothing to show, so Games wins');
  tick(arena, 'paper', false);
  tick(arena, 'arena', true);
  assertEqual(selectValues(arena), ['ysos'], 'with Arena ticked in Games the setting takes over');
  assertEqual(listValues(arena), ['ysos'], 'and so does the dropdown');

  // With every Games box ticked the field is Scryfall's own again.
  const all = await load({ clipboard: false });
  tick(all, 'arena', true);
  tick(all, 'mtgo', true);
  assertEqual(selectValues(all), ['mh3', 'ysos', 'me2'], 'with every platform ticked in Games the select is untouched');
  assertEqual(listValues(all), ['mh3', 'ysos', 'me2'], 'and so is the rendered dropdown');
  assertEqual(groups(all), ['Expansions', 'Online'], 'no group disappears without a platform filter');

// The search dropdown and the `search` places. This is the third surface and the one with a
  // control of Scryfall's own right above it, so the two are told apart: the Games checkboxes
  // are not a setting and this file never stores them.
  //
  // The case one shared list of places could not hold is here in its sharpest form — Paper out
  // of the dropdown while it stays in the table and the sets index — because this is the only
  // surface where a set appears as an option rather than as a row.
  //
  // The Games box is ticked for Arena first, because with only Paper ticked the two answers
  // do not meet and the field falls back to the Games choice rather than emptying itself.
  // That fallback is deliberate and is checked on its own below; here we want the overlap.
  const paperOutOfDropdown = await load({ clipboard: false, ...hideOnly([], { paper: { search: false } }) },
    html);
  tick(paperOutOfDropdown, 'arena', true);
  assertEqual(selectValues(paperOutOfDropdown), ['ysos'],
    'one platform out of the search place takes its set out of the dropdown, leaving the Arena set');
  assertEqual(listValues(paperOutOfDropdown), ['ysos'],
    'and the rendered dropdown follows the same answer');
  assertEqual(groups(paperOutOfDropdown), ['Expansions'],
    'while the group that lost its paper set keeps the one it still has');

  // The control: the same fixture with nothing switched off, so the line above is about the
  // place and not about the fixture having nothing to hide.
  const nothingOff = await load({ clipboard: false, ...hideOnly([]) }, html);
  tick(nothingOff, 'arena', true);
  assertEqual(selectValues(nothingOff), ['mh3', 'ysos'],
    'with nothing switched off and Arena ticked the dropdown has both of those sets');
  // And the same page asked with the platform switched off rather than the place, which is a
  // different stored state with the same answer here.
  const platformOff = await load({ clipboard: false, ...hideOnly(['paper']) }, html);
  tick(platformOff, 'arena', true);
  assertEqual(selectValues(platformOff), ['ysos'],
    'and switching the platform off reaches the dropdown too, which is what it says it does');

  // The fallback, which is the reason the two answers above are not the only thing that decides
  // this list. The Games boxes are not a setting and they can empty the overlap, and a field
  // with no set at all is worse than a field showing something the reader did not ask for.
  const noOverlap = await load({ clipboard: false, ...hideOnly([], { paper: { search: false } }) }, html);
  assertEqual(selectValues(noOverlap), ['mh3', 'ysos'],
    'with the Games choice and the setting naming nothing in common the Games choice wins, ' +
    'so the field never ends up with no set at all');



  // Scryfall only builds the dropdown when the field is opened, so the list
  // arrives long after the script has run.
  const closedHtml = html.replace(/<span class="select2 select2-container[\s\S]*?\n    <\/span>\n/, '');
  const late = await load({ clipboard: false }, closedHtml, { mutationObserver: true });
  assertEqual(late.document.querySelectorAll('.select2-results__option').length, 0, 'the field starts without a rendered list');
  late.document.querySelector('.form-row:last-child').insertAdjacentHTML('beforeend', html.match(/<span class="select2 select2-container[\s\S]*?\n    <\/span>\n/)[0]);
  late.flushObservers();
  assertEqual(listValues(late), ['mh3'], 'a list that appears later is filtered as soon as it is rendered');
  assertEqual(groups(late), ['Expansions'], 'and its empty group is hidden with it');
}


// The clipboard's identity and formatting rules, on their own.
//
// They were moved out of the two page scripts precisely so they could be tested without
// a page, and because the card page and the Tagger page had each grown their own copy of
// them and the copies had already disagreed. A rule that only has a copy is a rule with
// no owner; these are checked here so neither page can drift away from them again.
function clipboardFormatTest() {
  console.log('clipboard: one set of rules, shared by both pages');
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const context = { window: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'clipboard-format.js'), 'utf8'), context);
  const F = context.window.STK_CLIPBOARD_FORMAT;

  assert(F, 'the module publishes its rules on the window the page scripts read');
  for (const name of ['printKey', 'entryKey', 'formatCard', 'clipboardText', 'otherFormat']) {
    assert(typeof F[name] === 'function', `${name} is published`);
  }

  // Identity. Two printings of one card are two entries; the same printing reached by
  // a differently-cased set code is one.
  assert(F.printKey('TRK', '14') === F.printKey('trk', '14'), 'a set code is not case sensitive');
  assert(F.printKey('trk', '14') !== F.printKey('trk', '22'), 'the collector number is part of the identity');
  assert(F.entryKey({ name: 'Janeway', set: 'trk', number: '14' }) !== F.entryKey({ name: 'Janeway', set: 'trk', number: '22' }),
    'two printings of one card are two entries');
  assertEqual(F.entryKey({ name: 'Janeway' }), F.entryKey({ name: 'janeway' }),
    'an entry with no set falls back to its name, and case does not split it');

  // The format that carries sets. forceSet is no longer a way to force one, which is
  // what used to make 'names only' produce some lines with a set and some without.
  const forced = { name: 'Test Card', set: 'tst', number: '2', forceSet: true };
  assertEqual(F.formatCard(forced, 'names', false), '1 Test Card',
    'the names format means names, even for a printing added one at a time');
  assertEqual(F.formatCard(forced, 'moxfield', false), '1 Test Card (TST) 2',
    'the set format carries the set');
  assertEqual(F.formatCard(forced, 'moxfield', true), '1 Test Card',
    'stripping sets still strips them');

  // Grouping, which happens only where the lines could not be told apart.
  const list = [
    { name: 'Mana Drain', set: 'dom', number: '15' },
    { name: 'Mana Drain', set: 'dom', number: '16' },
    { name: 'Mana Drain', set: 'sta', number: '68' },
    { name: 'Island', set: 'dom', number: '51' }
  ];
  assertEqual(F.clipboardText(list, 'names', false), '3 Mana Drain\n1 Island',
    'repeat names are counted when there is no set to tell them apart');
  assertEqual(F.clipboardText(list, 'moxfield', false),
    '1 Mana Drain (DOM) 15\n1 Mana Drain (DOM) 16\n1 Mana Drain (STA) 68\n1 Island (DOM) 51',
    'with a set on the line, printings stay apart and the count is one');
  assertEqual(F.clipboardText(list, 'names', false).split('\n')[0], '3 Mana Drain',
    'the count leads the name, which is what a deck list wants');

  // Case-insensitive grouping: Magic card names are unique that way, so two spellings
  // differing only in case are one card and one count. The spelling kept is the one that
  // arrived first, so the output is not reshuffled into whatever case came last.
  assertEqual(F.clipboardText([
    { name: 'mana drain', set: 'dom', number: '15' },
    { name: 'Mana Drain', set: 'sta', number: '68' }
  ], 'names', false), '2 mana drain',
    'two spellings differing only in case are one card and one count, in the first spelling seen');

  assertEqual(F.clipboardText([], 'names', false), '', 'an empty clipboard copies nothing, not a blank line');
  assertEqual(F.clipboardText(undefined, 'names', false), '', 'a missing clipboard is treated as empty');

  // The alternative button, and the guarantee it rests on: with two formats the
  // alternative is always the other one, so the two buttons cannot do the same thing.
  assertEqual(F.otherFormat('moxfield'), 'names', 'the alternative to the set format is names');
  assertEqual(F.otherFormat('names'), 'moxfield', 'and the other way round');
  assertEqual(F.otherFormat(F.otherFormat('moxfield')), 'moxfield', 'so there are exactly two');
  assertEqual(F.FORMATS.names.withSets, false, 'the names format has no set on it');
  assertEqual(F.FORMATS.moxfield.withSets, true, 'the set format has one');
}

// The sets index on its own, asked the question it can be asked.
//
// One rule reaches this surface and it is the platform rule, so the index is checked over the
// digital sets the platform index places rather than over a list of set names — which is what
// the two rules that used to be here were checked over, and neither of those rules is on the
// page any more. A reader who had either of them gets those sets back.
//
// What matters here is that the page asks the worker for the classification and acts on the
// answer. A rule that reads `undefined` and hides nothing looks exactly like a rule switched
// off, which is why the mutation list has one for the worker's answer.
async function setsIndexPlatformTest() {
  console.log('sets index: the platform rule, and a set the index cannot place');
  const on = await loadSetsPage(hideOnly(['arena']), routes);
  assertEqual(hiddenSets(on), ['ysos'],
    'the one digital set the index places on Arena is marked');

  const off = await loadSetsPage(hideOnly([]), routes);
  assertEqual(hiddenSets(off), [], 'with nothing switched off nothing is hidden, so the two differ');

  // A platform index that answers with nothing. Scryfall's `/sets` marks a set digital and
  // says nothing about which client carries it, so the extension ships a snapshot and looks up
  // what the snapshot misses; a set it cannot place stays visible rather than being hidden on a
  // guess, which is the direction this filter has always taken.
  const empty = await loadSetsPage(hideOnly([]), { ...routes, setPlatforms: () => ({}) });
  assertEqual(hiddenSets(empty), [],
    'a set the index cannot place is shown, not hidden on an inability to place');

  // And the counter, which is the number a reader would quote: one of five gone, four counted.
  const counter = on.document.querySelector('#main .search-controls label[for="order"]');
  assert(counter && /4 of 5/.test(counter.textContent),
    'the counter above the list counts what is left, not what the page holds ("' +
    (counter ? counter.textContent.trim() : 'absent') + '")');

  // The five rows the fixture holds are three paper sets and two digital ones, so the sets
  // index has a paper set, an Arena set and a Magic Online set in it — and Paper is a platform
  // like the other two, which is why switching it off hides the three paper sets and not a
  // category of sets called "paper".
  const paperOff = await loadSetsPage(hideOnly(['paper']), routes);
  assertEqual(hiddenSets(paperOff), ['mh3', 'por', 'wmkm', 'sld'],
    'switching Paper off takes the four paper sets of the five, which is what it says it does');
  assertEqual(hiddenSets(paperOff).includes('ysos'), false,
    'and leaves the digital set, which is not on Paper');
  assertEqual(hiddenSets(paperOff).includes('me2'), false,
    'and the Magic Online one with it');
}

(async () => {
  try {
    clipboardFormatTest();
    await setsIndexPlatformTest();
    await cardPageTest();
    await searchPageTest();
    await clipboardDisabledTest();
    await legacyMigrationTest();
    await advancedPriceFilterTest();
await priceFilterTest();
    await deckLegalityTest();
await deckButtonPlacementTest();
    await setPlatformTest();
await advancedSetFilterTest();
    summary('test-preview');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();