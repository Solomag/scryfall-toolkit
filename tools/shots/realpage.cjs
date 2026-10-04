// The real Scryfall card page, fetched once and cached.
//
// The illustrations used to be built on a container of our own with our own
// stylesheets — and the result looked nothing like the product: giant serif links,
// purple underlined tag names, panels at the wrong proportions. Nothing was wrong
// with the panels; they were simply photographed on a stage that does not exist.
// A reader looking at that picture and then at the extension sees two different
// programs.
//
// Scryfall serves the whole page as plain HTML, with one stylesheet, and both are
// reachable. So the stage can be the page itself: their markup, their CSS, our theme
// on top, and our panels where their code would put them.
//
// What this still is not: our extension running in a browser. The panels are driven by
// the same feature files the extension loads, against data fetched from the same two
// APIs, but Chrome 154 refuses --load-extension and so nothing here is the service
// worker talking to a live page. It is a photograph of the page with our panels
// placed on it by hand — a great deal closer, and not the same as the thing.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..', '..') + path.sep;
const CACHE = path.join(ROOT, 'dist', 'real-page');
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';

// The page a reader lands on. Chosen for what the pictures need: a card with tags, a
// long list of printings across many sets, and legality somewhere in the four formats
// the extension adds — otherwise a panel comes out empty and an empty panel is
// indistinguishable from a broken one.
const PAGES = {
  // Counterspell — the card in the reader's own screenshot, and one with tags, with
  // printings across dozens of sets, and with legality in Premodern, which is one of
  // the four extra formats the extension reads.
  counterspell: { set: 'dsc', number: '114' },
  darkRitual: { set: 'dom', number: '126' },
  lightningBolt: { set: 'm19', number: '170' },
  solRing: { set: 'lea', number: '1' },
  // The sets index, and it is here for one reason. The two name-matched rules — the
  // foreign black border sets and the Portal and Secret Lair sets — act on a set code, and
  // this is the surface where a row *is* a set. On the prints table the same rules are
  // masked by the ten-unit window the extension takes around the printing being viewed,
  // and nothing in a rendered page can widen that window, because the rendered page's
  // features have already run and their event handlers did not survive being written to a
  // file. So a check there can only ever report that the rule did nothing visible, which
  // is not the same as reporting that it works.
  sets: { url: 'https://scryfall.com/sets' }
};

// The whole key, hashed. Truncating it was the second version of this file's only
// mistake: the API's answer for a card and the card's own page were both written to
// one file, so the page was read back as JSON, found to name no stylesheet, and the
// tool reported a page that does not exist.
function cacheFile(key) {
  const digest = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
  const tail = key.replace(/[^a-z0-9]+/gi, '_').slice(-46);
  return path.join(CACHE, digest + '_' + tail + '.txt');
}

async function fetchText(url) {
  const file = cacheFile(url);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const response = await fetch(url, { headers: { 'User-Agent': AGENT, Accept: 'text/html' } });
  if (!response.ok) throw new Error(response.status + ' from ' + url);
  const text = await response.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return text;
}

// The page, and the stylesheet it names.
//
// The stylesheet is downloaded rather than linked because the page is rendered from
// disk: a <link> to scryfall.com would be fetched by the browser at render time, which
// makes the picture depend on the network and on whatever they serve that minute. A
// copy in dist/ makes it reproducible, and it is their stylesheet byte for byte.
async function realPage(name) {
  const wanted = PAGES[name];
  if (!wanted) throw new Error('no page named ' + name + ' among ' + Object.keys(PAGES).join(', '));

  // Set code and collector number are enough: /card/<set>/<number> answers with the
  // page whether or not the slug is right. The card object's own `uri` is not it —
  // that address is the API, which answers with JSON, and a page fetched from there
  // names no stylesheet and reads as a page that does not exist. A page that is not a
  // card's carries its own address instead.
  const url = wanted.url || ('https://scryfall.com/card/' +
    encodeURIComponent(wanted.set) + '/' + encodeURIComponent(wanted.number));
  const html = await fetchText(url);
  if (!/<title>[^<]+<\/title>/.test(html)) {
    throw new Error('no page at ' + url + ': the answer is not a document');
  }

  const sheets = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map(m => m[1]);
  if (!sheets.length) throw new Error('the page names no stylesheet, so it cannot be rendered as itself');
  const css = [];
  for (const sheet of sheets) {
    css.push({ url: sheet, text: await fetchText(new URL(sheet, url).href) });
  }

  // Scryfall's own scripts are removed. They would run against a page whose chrome.*
  // is ours and whose extension is not installed, and half of them are tooltips and
  // analytics that have nothing to do with the panels. What is left is the document:
  // their markup and their styling, which is the thing being photographed.
  const page = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/>/gi, '');

  return {
    name,
    url,
    // The printing the page is about, which is what Tagger's tags are keyed by — and
    // what the picture's panel has to describe.
    set: wanted.set,
    number: wanted.number,
    cardName: ((page.match(/<title>([^<·]+)·/) || [])[1] || wanted.cardName || '').trim(),
    html: page,
    css: css.map(sheet => sheet.text).join('\n'),
    // What the features read out of the document rather than out of our own fixtures.
    cardId: (page.match(/<meta name="scryfall:card:id" content="([^"]+)"/) || [])[1],
    oracleId: (page.match(/<meta name="scryfall:oracle:id" content="([^"]+)"/) || [])[1],
    title: (page.match(/<title>([^<]*)<\/title>/) || [])[1]
  };
}

module.exports = { realPage, PAGES };