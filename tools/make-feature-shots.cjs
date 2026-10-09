// The illustrations in the settings: what the reader gets if they turn that section
// on, cut out of Scryfall's own page.
//
// The first set of these was a picture of our panels on a container of our own, and
// it read as a different program — giant serif links, purple underlined tag names,
// panels at no proportion to anything, and a light page where the product is dark. The
// panels were right. The stage was not a place the extension ever runs.
//
// So the stage is the page: Scryfall's markup, Scryfall's stylesheet, our theme on top
// of it, and our panels where our own feature files put them. That is the arrangement
// on the reader's screen, down to the CSS that makes a tag name small and white instead
// of a large underlined heading.
//
// What it still is not: the extension running in a browser. Stable Chrome 154 refuses
// --load-extension outright — tried headless, tried with an offscreen window, tried
// with --enable-unsafe-extension-debugging — so no service worker of ours is talking to
// a live page here. The panels are driven by the same feature files the extension
// loads, over data fetched from the same two APIs, and placed on the page by hand
// instead of by a content script.
//
// Two things are deliberately not here:
//
//   Scryfall's scripts. They are stripped from the document: they would run against a
//   page whose chrome.* is a stub and whose extension is not installed, and they are
//   tooltips and analytics that have nothing to do with the panels. Their markup and
//   their stylesheet, which is what is being photographed, are untouched.
//
//   EDHREC's numbers. json.edhrec.com answers 403 to anything outside their own site,
//   so a real deck count cannot be fetched when the pictures are made. Rather than
//   print a plausible four thousand decks, the section that would have shown it shows
//   the column of finish badges instead.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, sizeOf, fileUrl } = require('./shots/render.cjs');
const {
  fixture, buildCardPage, waitForSelector, waitForCount, reveal, renderableHtml
} = require('./shots/cardpage.cjs');

const OUT = path.join(ROOT, 'assets', 'shots');
const WORK = path.join(ROOT, 'dist', 'feature-shots');

// Wide enough for the card page's two columns and the toolbox, at the width the reader
// most likely has. Narrower and the right-hand column is pushed down the page, which
// makes the column of panels come out as a very tall thin strip.
const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 2300;

// Scryfall's own stylesheet draws our panels. These are the two numbers it needs and
// does not carry: our tag icons have no size in it, and without one they stretch to
// fill their cell — which made the tag panel five thousand pixels tall and read as a
// page rather than a panel.
const STAGE_CSS = `
  #stk-tags .stk-tag-icon svg { width: 16px; height: 16px; }
`;

// The card page's right-hand column: the prints table with its price columns, and every
// panel this extension adds under it — the tag tables go inside `.prints` on Scryfall's
// own page, so they come with it. A shot may name this instead of a panel, and the
// picture is then the column as the reader sees it rather than one piece of it.
//
// The reason to prefer it is the one the crop gave away. A crop of a panel is a panel
// floating with nothing around it: you cannot tell whether the tags sit above the prints
// or below them, where the extension puts its panel at all, or what the column looks like
// when a rule has taken rows out of it. The column is the arrangement, and the arrangement
// is the thing a reader is trying to picture.
//
// It is `.prints` and not `.card-text`, and getting that wrong is instructive: `.card-text`
// is the card's name, its rules and the legality block, which is the *other* column, and
// the first guess at "the right-hand column" is the element whose class name mentions the
// card rather than the column. `.card-text` and `.prints` are siblings under
// `.inner-flex`; naming both gives a picture of the whole top of the page with a strip of
// the artwork down its left edge, which is the crop problem all over again.
// `.prints-current` is in the union because Scryfall gives it `margin-top: -20px`: it
// deliberately hangs above its own parent, so cropping the parent's border box cuts the
// printing's name in half across the top of the picture. A picture whose first line of
// text is sliced is a picture of a mistake, and the mistake would be in the tool rather
// than on the page.
// The table is in the union for the same reason the banner is: `.prints` is capped at
// 400px by Scryfall's own CSS while its table is wider than that, so cropping the
// container slices the last price column in half — a picture of a price half a digit
// wide, which reads as a broken table rather than as a crop.
const RIGHT_COLUMN = [
  '.card-profile .prints',
  '.card-profile .prints-current',
  '.card-profile .prints .prints-table'
];

// --- the six shots ------------------------------------------------------------
//
// Each one: the storage that has the feature on, the element the shot is about, and
// the wait that has to pass before the picture is taken. The wait is what makes a shot
// fail rather than come out empty — and waiting for one thing turned out not to be
// enough, which is the second item in the list of failures below.

const SHOTS = [
  {
    file: 'tags.png',
    // The tag tables themselves, not the prints column they sit under. The column is
    // Scryfall's, and a picture of it says nothing about the switch beside the heading.
    column: true,
    storage: { tags: true, cardTags: true, artTags: true, relationships: false },
    waitFor: '#stk-tags',
    waitCount: ['#stk-tags .prints-table tbody tr', 3],
  },
  {
    file: 'cardclip.png',
    // The toolbar and the list together, which is what a reader sees with the button
    // pressed. Not the aside: it is stretched down the side of the page, so cropping
    // it gives a column of empty space with two rows of interest at the top.
    about: ['#scryfall-toolkit-clipboard .stk-toolbar', '#scryfall-toolkit-clipboard .stk-list'],
    // Seeded rather than pressed in: pressing the same card three times gives one row
    // with a count of three, which is not what a reader with three cards in the
    // clipboard sees. The cards are real ones, looked up by name.
    storage: { clipboard: true, exportFormat: 'moxfield' },
    prepare: card => reveal(card, '.stk-list'),
    waitFor: '#scryfall-toolkit-clipboard .stk-list-row',
    waitCount: ['#scryfall-toolkit-clipboard .stk-list-row', 3],
    // The clipboard is an aside fixed to the corner of a page, outside every column.
    // It is put below the card rather than on top of it: a panel floating over the
    // card's own text is a panel photographed through somebody's typesetting.
    extraCss: 'aside { position: absolute !important; right: 40px; top: 1700px; width: 420px; }'
  },
  {
    // Not EDHREC: their API refuses this machine, and a plausible invented deck count
    // is exactly what the previous pictures were full of. The column of finishes is
    // the other thing this section promises, and every value in it is one Scryfall
    // returned.
    file: 'additional.png',
    column: true,
    storage: { finishBadges: true, printGrouping: true, printFoldGroups: false },
    waitFor: '.stk-finish-header',
    // Every row has to have its badge, not just the first. Waiting for "a badge" is
    // satisfied by the current printing and photographs the rest as missing, which is a
    // picture of a feature that half works. Two is the floor: a printing with several
    // finishes gets an empty cell on purpose.
    waitCount: ['.stk-finish-badge', 2],
  },
  {
    file: 'legality.png',
    // The whole legality block, not the first row of it. The block gets an id on
    // whichever row sorts first, and an added format lands in whichever row still has
    // room — so cropping the id gives a picture of Scryfall's own Standard and Modern
    // and none of our work, which is what the previous version of this shot showed.
    column: true,
    // Premodern on, because that is the one of the four extra formats read off the
    // card's own Scryfall answer. The other three are asked of Scryfall by oracle id
    // through a query this build has no answer for, so turning them on would put
    // "Unavailable" in a picture.
    storage: { legalities: true, premodern: true },
    waitFor: '#stk-legalities',
    waitCount: ['.card-profile .card-legality .card-legality-item', 3],
    // No margin here: the block sits beside the card image, so a few pixels of slack
    // on the left is a strip of somebody's artwork along the edge of the picture.
    pad: 0
  },
  {
    file: 'prints.png',
    // The prints column with every printing the card has, grouped by set — which is
    // what a reader with the switch on is looking at, and what the reader cannot get
    // from Scryfall's own page, which shows ten.
    column: true,
    storage: { printGrouping: true, printFoldGroups: false, printFullPageLink: true },
    waitFor: '.stk-print-group-row',
  },
  {
    file: 'hide-extra.png',
    column: true,
    // The hiding group is one storage key, written the way the card page reads it and in the
    // shape the model has now. It was writing `on: true` when the mode came back, and later a
    // `sets` block that the settings page had stopped writing — both still worked, because the
    // migration reads them, so the picture was right while the tool was describing a shape
    // nothing else uses any more. A fixture that only works through the compatibility path is
    // a fixture that stops working the day that path goes.
    //
    // Arena is out of the prints table and in everywhere else, so the picture shows the one
    // state a shared list of places could not hold.
    storage: {
      setFiltersMigrated: true,
      setFilters: {
        platforms: {
          paper: { show: true, areas: { prints: true, search: true, sets: true } },
          arena: { show: true, areas: { prints: false, search: true, sets: true } },
          mtgo: { show: true, areas: { prints: true, search: true, sets: true } }
        },
        prices: { usd: true, tix: true, tcg: true, cardhoarder: true },
        tokens: true,
        caster: false
      }
    },
    waitFor: '.card-profile .prints > .prints-table'
  }
];

// A printing shown twice in the group it belongs to.
//
// This is not a hypothetical. It happened because the fixture sent each printing's API
// address where the worker sends the address of the card's page — and the table decides
// whether Scryfall has already drawn a printing by comparing that address with the rows
// on the page. An API address matches nothing, so every printing Scryfall had already
// listed was added again: ten duplicated rows, in a picture of a defect the extension
// does not have, next to a claim that nothing in the pictures was invented.
//
// The picture was not wrong about the product and wrong about itself at the same time,
// which is the worst kind of wrong.
function assertNoRepeatedPrinting(page, file) {
  const table = page.document.querySelector('.card-profile .prints > .prints-table');
  if (!table) return;
  let group = '(none)';
  let seen = new Map();
  const repeated = [];
  for (const row of table.querySelectorAll('tbody tr')) {
    const classes = row.className || '';
    if (/\bstk-print-group-row\b/.test(classes)) {
      group = (row.textContent || '').trim();
      seen = new Map();
      continue;
    }
    const link = row.querySelector('a');
    if (!link) continue;
    // Keyed on what the reader sees, not on the card id — because the row that was
    // duplicated had no id to key on, which is why the first version of this check
    // passed over the very defect it was written for. A printing in another language
    // reads "#2 · JA", so the same number twice is not the same label twice.
    const label = link.textContent.trim();
    if (!label) continue;
    if (seen.has(label)) repeated.push(group + ' — "' + label + '"');
    else seen.set(label, true);
  }
  if (repeated.length) {
    throw new Error(file + ': ' + repeated.length + ' printings appear twice, each in its own group (' +
      repeated.slice(0, 3).join('; ') + '). Either the table is adding what Scryfall already lists, ' +
      'or the data gives one printing an address the page does not use.');
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  const data = await fixture();
  console.log('page: ' + data.page.title);
  console.log('  ' + data.prints.length + ' printings, ' + data.hero.cardTags.length + ' card tags, ' +
    data.hero.artTags.length + ' art tags, legal in ' + (data.hero.extraFormats || []).join(', '));
  console.log('  stage: ' + data.page.url);
  console.log("  stylesheet: " + Math.round(data.page.css.length / 1024) + " KB of Scryfall's own, inlined\n");

  const session = new Session();
  const done = [];
  try {
    await session.open();
    for (const shot of SHOTS) {
      const storage = shot.file === 'cardclip.png'
        ? { ...shot.storage, cards: data.clipboard }
        : shot.storage;
      const card = await buildCardPage({ data, storage });
      if (shot.prepare) await shot.prepare(card);
      await waitForSelector(card, shot.waitFor);
      if (shot.waitCount) await waitForCount(card, shot.waitCount[0], shot.waitCount[1]);
      assertNoRepeatedPrinting(card, shot.file);

      const htmlFile = path.join(WORK, shot.file.replace(/\.png$/, '.html'));
      fs.writeFileSync(htmlFile, renderableHtml(card.document, data, { extraCss: shot.extraCss || STAGE_CSS }),
        'utf8');

      await session.open_(htmlFile, { width: STAGE_WIDTH, height: STAGE_HEIGHT });
      // One selector, or several: a shot about a toolbar and the panel it opens has to
      // be the two of them, and cropping the element that owns both gives a strip of
      // empty page between them.
      // `column` names the whole right-hand column and `about` names a panel inside it. A shot
      // that wants the column says so rather than repeating the selector, so the two are
      // different properties and not one string that happens to be long.
      const target = shot.column ? RIGHT_COLUMN : shot.about;
      const wanted_by = Array.isArray(target) ? target : [target];
      const boxes = [];
      for (const selector of wanted_by) {
        const box = await session.boxOf(selector);
        if (!box || box.width < 4 || box.height < 4) {
          throw new Error(shot.file + ': ' + selector + ' has no size in the rendered page, ' +
            'so the crop would be empty. Either the panel did not render or the selector is wrong.');
        }
        boxes.push(box);
      }
      const box = {
        x: Math.min(...boxes.map(b => b.x)),
        y: Math.min(...boxes.map(b => b.y)),
        width: Math.max(...boxes.map(b => b.x + b.width)) - Math.min(...boxes.map(b => b.x)),
        height: Math.max(...boxes.map(b => b.y + b.height)) - Math.min(...boxes.map(b => b.y))
      };

      // A panel is a panel, not a page. Four thousand pixels tall means something in the
      // stage is unbounded — an icon with no size, a float that never cleared — and that
      // is an error, because the failure looks like a very long panel rather than like a
      // failure.
      //
      // A table of this card's seventy-three printings being long is not that. It is
      // cut off at the top of the shot instead, and the cut is said out loud: a picture
      // that silently stops halfway down a table is a picture of a table that ends
      // there.
      //
      // The whole column is the other case: it is legitimately tall, because it holds a
      // card's rules text, its legality block and a prints table. A shot that asked for
      // it says so, and is then held to a larger bound rather than waved through — a
      // column that grows past nine thousand pixels is something unbounded again, and
      // this is the one place that would catch it.
      const wholeColumn = Boolean(shot.column);
      const bound = wholeColumn ? 9000 : 4000;
      if (box.height > bound) {
        throw new Error(shot.file + ': the crop is ' + Math.round(box.height) +
          ' pixels tall' + (wholeColumn ? ', and it is the whole right-hand column' : ', which is not a panel') +
          '. Something in the stage has no size.');
      }
      // The column is taken whole. Cropping it at a thousand pixels would be the crop the
      // column was meant to replace, only higher up.
      const wanted = shot.maxHeight || (wholeColumn ? bound : 1000);
      const cut = box.height > wanted;

      // The crop is the element plus a little room. A panel's own left edge is not the
      // edge of what it shows: our tag icons sit in a cell that hangs outside the box,
      // and cropping exactly to the box cuts them in half, which reads as a broken icon
      // rather than as a crop.
      const pad = shot.pad === undefined ? 10 : shot.pad;
      const clip = {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(STAGE_WIDTH, box.width + pad * 2),
        // Capped from the top, because a table of 73 printings is a long scroll and the
        // first rows are the part that shows what the column is.
        height: Math.min(box.height + pad * 2, wanted)
      };
      const out = path.join(OUT, shot.file);
      await session.shoot(out, { clip, scale: 2 });
      const size = sizeOf(out);
      const kb = Math.round(fs.statSync(out).size / 1024);
      done.push({ file: shot.file, kb });
      console.log('  ' + shot.file.padEnd(16) + String(size.width).padStart(5) + ' x ' +
        String(size.height).padStart(4) + '  ' + String(kb).padStart(4) + ' KB  ' + shot.about +
        (cut ? '  (cut at ' + wanted + ' of ' + Math.round(box.height) + ' px)' : ''));
    }
  } finally {
    session.close();
  }
  const total = done.reduce((sum, shot) => sum + shot.kb, 0);
  console.log('\n' + done.length + ' illustrations, ' + total + ' KB in total');
  console.log('  written to ' + OUT.slice(ROOT.length));
}

main().catch(error => { console.error(error.message || error); process.exit(1); });