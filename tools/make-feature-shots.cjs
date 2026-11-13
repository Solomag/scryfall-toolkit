// The illustrations in the settings: what the reader gets if they turn that section
// on, photographed on scryfall.com with this extension loaded and doing the drawing.
//
// The first set of these was a picture of our panels on a container of our own, and it
// read as a different program. The second cut them out of Scryfall's own page, saved to
// disk, with the panels placed there by this tool, because stable Chrome refuses
// --load-extension and no service worker of ours could talk to a live page. That left
// the one thing a reader cannot check: whether the code that paints the panels is the
// code in the picture.
//
// Chrome for Testing still loads an unpacked extension, so this is now the real thing:
// the repository is loaded as the extension, its settings are written through
// chrome.storage from its own options page, and the shot is taken of the live card page
// once the content scripts have drawn on it. Session refuses to start if the extension's
// service worker is not among the targets, so a run cannot quietly photograph a page
// without it. `npm run cft` installs the browser.
//
// EDHREC is still not in a picture: its permission is optional and Chrome only grants it
// after a click, and a plausible invented deck count is what the first pictures were
// full of. The column of finish badges illustrates that section instead.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, sizeOf } = require('./shots/render.cjs');

const OUT = path.join(ROOT, 'assets', 'shots');

// The language is stored rather than guessed: the card page picks it from storage or
// from the browser, and a picture for an English README must not depend on the machine.
const LANGUAGE = 'en';

// The card every column shot is of, and the cards put into the clipboard by pressing
// their own add buttons on a search page, the way a reader fills it.
const HERO = 'https://scryfall.com/card/dsc/114/counterspell';
const CLIPBOARD_FROM = 'https://scryfall.com/search?q=' + encodeURIComponent('!"Sol Ring" or !"Lightning Bolt" or !"Dark Ritual"') + '&unique=cards';

// Wide enough for the card page's two columns and the toolbox, at the width the reader
// most likely has.
const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 2300;

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

// The other column, for the one picture whose subject is not in the right-hand one. The extra
// formats are added to Scryfall's legality block, and the legality block is in `.card-text` —
// the left-hand column, `.prints`'s sibling. The 1.1.7 change that made every "?" picture a
// whole column took the right one for all of them, so the legality picture came out as the
// prints table with none of the formats it exists to show. It is the same arrangement as the
// others — the whole column, not a crop of the block — on the side the block is actually on.
const LEFT_COLUMN = ['.card-profile .card-text'];

// --- the five shots -----------------------------------------------------------
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
    fillClipboard: true,
    waitFor: '#scryfall-toolkit-clipboard .stk-list-row',
    waitCount: ['#scryfall-toolkit-clipboard .stk-list-row', 3]
  },
  {
    // Not EDHREC: their API refuses this machine, and a plausible invented deck count
    // is exactly what the previous pictures were full of. The column of finishes is
    // the other thing this section promises, and every value in it is one Scryfall
    // returned.
    file: 'additional.png',
    column: true,
    storage: { finishBadges: true },
    waitFor: '.stk-finish-header',
    // Every row has to have its badge, not just the first. Waiting for "a badge" is
    // satisfied by the current printing and photographs the rest as missing, which is a
    // picture of a feature that half works. Two is the floor: a printing with several
    // finishes gets an empty cell on purpose.
    waitCount: ['.stk-finish-badge', 2],
  },
  {
    file: 'legality.png',
    // The left-hand column, which holds the legality block the added formats land in. It was
    // the right-hand column, which holds neither, so the picture showed the prints table and
    // none of the formats it exists to show.
    //
    // The whole block and not the first row of it. The block gets an id on whichever row sorts
    // first, and an added format lands in whichever row still has room — so cropping the id
    // gives a picture of Scryfall's own Standard and Modern and none of our work, which is
    // what the version before that showed.
    column: 'left',
    // Premodern on, because that is the one of the four extra formats read off the
    // card's own Scryfall answer. The other three are asked of Scryfall by oracle id
    // through a query this build has no answer for, so turning them on would put
    // "Unavailable" in a picture.
    storage: { legalities: true, premodern: true },
    waitFor: '#stk-legalities',
    waitCount: ['.card-profile .card-legality .card-legality-item', 3],
    // No margin here: the block sits beside the card image, so a few pixels of slack
    // on the left is a strip of somebody's artwork along the edge of the picture.
    // Inside the block by a few pixels: on the live page the card image's shadow reaches
    // over the column's left edge, and a strip of artwork came along with it.
    pad: -8
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
    // What the caption promises: the digital sets gone and the dollar and ticket columns
    // gone, with the paper sets and the euro column left. The prices are positive — a price
    // is shown — so `false` is what hides one. (The storage used to keep every price true
    // while the caption said they were hidden, from before the model was inverted, and the
    // picture had drifted from its own words.)
    storage: {
      setFiltersMigrated: true,
      setFilters: {
        platforms: {
          paper: { show: true, areas: { prints: true, search: true, sets: true } },
          arena: { show: false, areas: { prints: true, search: true, sets: true } },
          mtgo: { show: false, areas: { prints: true, search: true, sets: true } }
        },
        prices: { usd: false, tix: false, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
        tokens: true,
        showCaster: false,
        showStores: true
      }
    },
    waitFor: '.card-profile .prints > .prints-table'
  }
];

// A printing shown twice in the group it belongs to — the defect an earlier fixture
// photographed and the extension does not have. Checked on the live page now, keyed on
// what the reader sees.
const REPEATED_PRINTINGS = `(() => {
  const table = document.querySelector('.card-profile .prints > .prints-table');
  if (!table) return [];
  const seen = new Set(), repeated = [];
  for (const link of table.querySelectorAll('tbody tr a')) {
    const label = link.textContent.trim();
    if (!label) continue;
    if (seen.has(label)) repeated.push(label); else seen.add(label);
  }
  return repeated;
})()`;

async function waitFor(session, expression, what) {
  for (let attempt = 0; attempt < 150; attempt++) {
    // A page that is still replacing its own document throws "context destroyed" for a
    // moment; that is a page not ready yet, not a failure.
    if (await session.evaluate(expression).catch(() => false)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('waited 30 s for ' + what + ' on the live page, and it never came');
}

// Settings go in through the extension's own storage, from its content-script world, so the content
// scripts read them exactly as they read a user's.
async function setStorage(session, storage) {
  if (!/^https:\/\/scryfall\.com\//.test(await session.evaluate('location.href'))) {
    await session.go('https://scryfall.com/', { settle: 1500 });
  }
  await session.inExtension(`chrome.storage.local.clear().then(() => chrome.storage.local.set(${JSON.stringify(storage)})).then(() => true)`);
}

async function fillClipboard(session) {
  await session.go(CLIPBOARD_FROM, { width: STAGE_WIDTH, height: STAGE_HEIGHT, settle: 3000 });
  await waitFor(session, `document.querySelectorAll('.card-grid-item .stk-add').length >= 3`, 'three add buttons');
  await session.evaluate(`(() => { [...document.querySelectorAll('.card-grid-item .stk-add')].slice(0, 3).forEach(b => b.click()); return true; })()`);
  await new Promise(resolve => setTimeout(resolve, 800));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const session = new Session({ extension: path.resolve(ROOT) });
  const done = [];
  try {
    await session.open();
    console.log('extension ' + session.extensionId + ' loaded; stage ' + HERO + '\n');
    for (const shot of SHOTS) {
      await setStorage(session, { settingsLanguage: LANGUAGE, ...shot.storage });
      if (shot.fillClipboard) await fillClipboard(session);
      await session.go(HERO, { width: STAGE_WIDTH, height: STAGE_HEIGHT, settle: 2000 });
      await waitFor(session, `!!document.querySelector(${JSON.stringify(shot.waitFor)})`, shot.waitFor);
      if (shot.waitCount) {
        await waitFor(session, `document.querySelectorAll(${JSON.stringify(shot.waitCount[0])}).length >= ${shot.waitCount[1]}`,
          shot.waitCount[1] + ' of ' + shot.waitCount[0]);
      }
      if (shot.fillClipboard) {
        // The list opens on its own button, the one a reader presses.
        await session.evaluate(`(() => { const list = document.querySelector('#scryfall-toolkit-clipboard .stk-list');
          if (list.hidden) document.querySelector('#scryfall-toolkit-clipboard .stk-icon-clip').click();
          return !list.hidden; })()`);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const repeated = await session.evaluate(REPEATED_PRINTINGS);
      if (repeated.length) throw new Error(shot.file + ': printings appear twice: ' + repeated.slice(0, 3).join('; '));
      // Hover effects and the hover preview are not part of any panel.
      await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
      await new Promise(resolve => setTimeout(resolve, 400));

      // One selector, or several: a shot about a toolbar and the panel it opens has to
      // be the two of them, and cropping the element that owns both gives a strip of
      // empty page between them.
      // `column` names a whole column — the right-hand one by default, the left-hand one for
      // the legality picture — and `about` names a panel inside it. A shot that wants a column
      // says so rather than repeating the selector, so the two are different properties and
      // not one string that happens to be long.
      const target = shot.column === 'left' ? LEFT_COLUMN
        : shot.column ? RIGHT_COLUMN : shot.about;
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
          ' pixels tall' + (wholeColumn ? ', and it is a whole column' : ', which is not a panel') +
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
        String(size.height).padStart(4) + '  ' + String(kb).padStart(4) + ' KB  ' + wanted_by.join(', ') +
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