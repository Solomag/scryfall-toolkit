'use strict';
// The deck page, built the way the extension builds it: the same harness the tests use,
// the same feature files, the same routes. This exists because a deck page had no builder at
// all - the two panels on it were only ever built by hand for a screenshot, and a screenshot
// of a card page cannot reach them.
//
// So the page here is not a fixture written to suit a picture. It is the card-page scripts
// over deck markup, which is all a deck page is, and the panels appear where they appear on
// the reader's screen because the feature files put them there.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./render.cjs');
const { createPage, sleep } = require('../../tests/testlib.cjs');

// Scryfall's deck page markup, reduced to what the feature files read. Written from the
// selectors the code uses rather than from a saved page, so it says what it is.
const DECK_HTML = `<!DOCTYPE html><html><body><div id="main">
  <div class="deck-list">
    ${['vma/5/ancestral-recall', 'bchr/2/lurrus-of-the-dream-den', 'penny/1/nineteen-dollar-card',
      'p02/12/pestilence', '2xm/82/timetwister', 'm19/216/sol-ring', 'cmr/355/griselbrand',
      'ktk/185/darksteel-ingot', 'dka/146/dismember', 'c16/106/wear-tear',
      'm21/349/bearer-of-the-heavens', 'khm/165/ultimate-sacrifice', 'jou/6/mana-confluence',
      'dom/244/serpentine-ambush', 'mh3/268/roalesk', 'cmr/355/griselbrand',
      'pre/91/tamiyo-collector-of-tales', 'grn/99/life-to-death', 'dka/146/dismember',
      'mh3/268/roalesk']
      .map((path, i) => `    <div class="deck-list-entry"><span class="deck-list-entry-name">
        <a href="https://scryfall.com/card/${path}">Deck Card ${i + 1}</a></span></div>`).join('\n')}
  </div>
  <div class="sidebar"></div>
</div></body></html>`;

// The answers the panels will be given. Both shapes come from the worker's own code, and
// both were checked against Scryfall while 1.2.0 was being written: Scryfall has four
// verdicts, not two, and a banned card is not a silence.
const NOT_LEGAL = [
  ['Ancestral Recall', 'vma', '1', 'banned'],
  ['Black Lotus', 'vma', '4', 'banned'],
  ['Time Walk', 'vma', '55', 'not_legal'],
  ['Nineteen Dollar Card', 'penny', '1', 'not_legal'],
  ['Pestilence', 'p02', '12', 'not_legal'],
  ['Timetwister', '2xm', '82', 'not_legal'],
  ['Mind\'s Desire', 'vma', '106', 'not_legal'],
  ['Gush', 'vma', '141', 'not_legal'],
  ['Mox Ruby', 'vma', '150', 'not_legal'],
  ['Channel', 'vma', '160', 'not_legal']
];

const legalityAnswer = count => ({
  format: 'commander',
  checked: 20,
  unknown: 2,
  notLegal: Array.from({ length: count }, (_, i) => {
    const [name, set, collector_number, verdict] = NOT_LEGAL[i % NOT_LEGAL.length];
    return { name, set, collector_number, verdict,
      uri: 'https://scryfall.com/card/' + set + '/' + collector_number + '/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') };
  })
});

// Token images are fetched from Scryfall rather than written down: the whole point of the
// token panel is the pictures, and a grid of grey boxes has the layout of a grid of pictures
// and none of the point.
async function realTokens(count) {
  const body = await fetch('https://api.scryfall.com/cards/search?q=' +
    encodeURIComponent('t:token') + '&unique=prints&page=1', {
      headers: { Accept: 'application/json', 'User-Agent': 'scryfall-toolkit-render-check' }
    }).then(r => r.json()).catch(() => null);
  if (!body || !body.data) return [];
  return body.data.slice(0, count).map(card => ({
    name: card.name, uri: card.scryfall_uri, image: (card.image_uris || {}).normal || ''
  }));
}

// Build the page and open one of its panels. `which` is 'legality' or 'tokens'; `count` is
// how many rows the answer carries, because the two ends of that range are different shapes
// and the middle is where a layout goes wrong.
async function deckPageWith({ which, count = 5, tokens, state = {} }) {
  const page = createPage({
    url: 'https://scryfall.com/@reader/decks/abc123/build',
    html: DECK_HTML,
    state: { deckLegality: true, deckTokens: true, clipboard: false, siteLanguage: 'en', ...state },
    routes: {
      deckLegality: () => legalityAnswer(count),
      deckTokens: () => tokens || []
    }
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.cardPage();
  await sleep(80);
  const button = page.document.querySelector(which === 'tokens' ? '.stk-token-button' : '.stk-legality-button');
  if (!button) throw new Error('the deck page has no ' + which + ' button');
  button.dispatchEvent(new page.window.Event('click'));
  await sleep(120);
  return { page, button };
}

module.exports = { ROOT, DECK_HTML, deckPageWith, legalityAnswer, realTokens, NOT_LEGAL, fs, path };