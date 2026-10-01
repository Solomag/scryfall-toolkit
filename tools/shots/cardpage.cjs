// The card page the illustrations are cut from: Scryfall's own document, with our
// panels placed on it by our own feature files.
//
// It used to be a card-page-shaped container of ours. Nothing was wrong with the
// panels — they were simply photographed on a stage that does not exist, and the
// result read as a different program: giant serif links, purple underlined tag names,
// panels at no proportion to anything, a light theme where the product is dark. A
// reader who knows what the extension looks like sees a picture of something else.
//
// Scryfall serves the whole page as plain HTML with one stylesheet, and both are
// reachable, so the stage is the page: their markup, their CSS, our theme on top.
// That is the same arrangement the user sees, minus our code having run in a browser —
// which Chrome 154 will not allow, because it refuses --load-extension outright.
//
// The run itself happens in the same harness the tests use, because that harness runs
// the real feature files against real data. What comes out is a document; rendering it
// with the two stylesheets is the tool's other half.
const path = require('node:path');
const fs = require('node:fs');
const { createPage, sleep } = require('../../tests/testlib.cjs');
const { ROOT, fileUrl } = require('./render.cjs');
const realpage = require('./realpage.cjs');
const live = require('./live.cjs');

// Everything a shot needs, gathered once and fetched rather than written. The card is
// the one whose page we are rendering, not a card picked to suit a picture: the page
// and the data have to be about the same card, or the tag panel shows one card's tags
// beside another card's name.
async function fixture(pageName = 'counterspell') {
  const page = await realpage.realPage(pageName);
  const hero = await live.heroCard({ set: page.set, number: page.number, name: page.cardName });
  const cards = await live.clipboardCards();
  const categories = await live.setCategories();

  const prints = hero.prints.map(printing => ({
    id: printing.id,
    name: printing.name,
    uri: printing.uri,
    set: printing.set,
    setName: printing.setName,
    number: printing.number,
    lang: printing.lang || 'en',
    digital: Boolean(printing.digital),
    finishes: printing.finishes || [],
    promoTypes: printing.promoTypes || [],
    typeLine: printing.typeLine || '',
    prices: printing.prices || {}
  }));

  return {
    page,
    hero,
    prints,
    categories,
    clipboard: cards,
    name: hero.name
  };
}

// The answers the worker would send, in the shape the content scripts read them. Real
// values from Scryfall and Tagger, in the normalised shape the worker normalises to —
// `number`, `setName`, `lang`, `digital` — because a fixture that sends the API's own
// field names produces rows labelled "#undefined" and looks like a broken feature.
function routesFor(data) {
  const byId = {};
  for (const printing of data.prints) {
    byId[printing.id] = { finishes: printing.finishes, promoTypes: printing.promoTypes };
  }
  return {
    tags: () => ({
      card: data.hero.cardTags,
      art: data.hero.artTags,
      fallback: false
    }),
    finishes: message => {
      const found = {};
      for (const id of message.ids || []) if (byId[id]) found[id] = byId[id];
      return found;
    },
    card: () => ({ oracle_id: data.hero.oracleId, legalities: data.hero.legalities || {} }),
    allPrints: () => ({ prints: data.prints, truncated: false }),
    setCategories: () => data.categories,
    setPlatforms: () => ({}),
    preview: name => ({ name, image: '', uri: 'https://scryfall.com/card/' })
  };
}

// Runs the real feature files over Scryfall's real document, and hands back the
// document they produced.
//
// The URL is Scryfall's, because the features decide what page they are on from it, and
// a card page reached under any other address is a page where every feature switches
// itself off — which looks exactly like a set of panels that do not work.
async function buildCardPage({ data, storage = {}, routes: overrides = {}, waitFor = null } = {}) {
  if (!data) throw new Error('no data was given, so the page would carry invented text again');
  const routes = { ...routesFor(data), ...overrides };
  const page = createPage({
    url: data.page.url,
    html: data.page.html,
    state: { cards: [], ...storage },
    routes
  });
  await page.script('src/core/i18n.js');
  await page.script('src/core/format-catalog.js');
  await page.script('src/core/tag-icons.js');
  await page.script('assets/data/shambleshark-nicknames.js');
  await page.cardPage();
  await sleep(150);
  if (waitFor) await waitForSelector(page, waitFor);
  await sleep(120);
  return page;
}

// Waits for an element, or says plainly that it never arrived. A picture of an empty
// panel is worse than no picture: a reader cannot tell it apart from a working one.
async function waitForSelector(page, selector) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (page.document.querySelector(selector)) {
      await sleep(80);
      return page;
    }
    await sleep(50);
  }
  throw new Error('the page never produced ' + selector +
    ', so there is nothing to photograph. The feature is either off, renamed, or broken.');
}

// Waits for a number of things, not merely for one.
//
// This exists because of a picture that was wrong rather than empty: the shot waited
// for "a finish badge", the current printing already had one, and the photograph was
// taken while the rest were still on their way round the message round trip.
async function waitForCount(page, selector, min) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const found = page.document.querySelectorAll(selector);
    if (found && found.length >= min) {
      await sleep(80);
      return page;
    }
    await sleep(50);
  }
  throw new Error('the page produced ' +
    (page.document.querySelectorAll(selector) || []).length + ' of ' + min +
    ' ' + selector + ', so the picture would show a half-built feature');
}

// Shows what a reader has to press to see.
function reveal(page, selector) {
  const el = page.document.querySelector(selector);
  if (!el) throw new Error('there is no ' + selector + ' to open');
  el.hidden = false;
  if (typeof el.removeAttribute === 'function') el.removeAttribute('hidden');
  return page;
}

// The document the features produced, as a file the browser can render with
// Scryfall's stylesheet and ours.
//
// Scryfall's own CSS is inlined rather than linked. The page is rendered from disk, so
// a link to scryfall.com would be fetched at render time and the picture would depend
// on the network and on whatever they served that minute. Inlining their stylesheet
// makes it reproducible and keeps it theirs, byte for byte.
//
// Our theme goes after it, because that is the order a browser loads them in: the
// manifest appends our parts to the page's own.
//
// The dark theme is put on by hand, with the class the extension's own code adds. It
// is not a decision for the tool: a card page is light or dark according to a setting,
// and the settings page this picture lives in is showing a reader what their own
// browser will look like, which is the extension's own look.
function renderableHtml(document, data, { extraCss = '', dark = true } = {}) {
  if (dark) {
    const root = document.documentElement;
    const current = root.getAttribute && (root.getAttribute('class') || '');
    if (!/\bstk-dark\b/.test(current)) root.setAttribute('class', (current + ' stk-dark').trim());
  }
  const html = document.documentElement.outerHTML
    // The extension's own icons are named by an address that only exists inside
    // Chrome. Rendered from disk it is unresolvable, and every icon comes out as a
    // broken-image box — which reads as a broken feature rather than as a path that
    // cannot work here. The trailing separator is added by hand: path.resolve drops it,
    // and without it every icon resolves to "…/scryfall-toolkitassets/icons/clip.svg".
    .replace(/chrome-extension:\/\/scryfall-toolkit\//g, extensionFiles());
  const head = '<style>' + data.page.css + '</style>';
  const theme = themeCss();
  const injected = head + '<style>' + theme + '</style>' +
    (extraCss ? '<style>' + extraCss + '</style>' : '');
  return html.includes('</head>') ? html.replace('</head>', injected + '</head>') : injected + html;
}

// The extension's own files, as a file:// prefix.
const extensionFiles = () => fileUrl(ROOT).replace(/\/$/, '') + '/';

// Our theme, as one stylesheet: the parts concatenated in the order the manifest lists
// them, which is the only order that means anything. The same reading the tests use,
// so a picture cannot be styled by a different theme than the one that ships.
function themeCss() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const sheets = (manifest.content_scripts || [])
    .flatMap(entry => entry.css || []);
  return sheets.map(sheet => fs.readFileSync(path.join(ROOT, sheet), 'utf8')).join('\n');
}

module.exports = { fixture, buildCardPage, routesFor, waitForSelector, waitForCount, reveal,
  renderableHtml, themeCss };