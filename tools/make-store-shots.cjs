// Re-takes the one full-page capture the store screenshots are cut from.
//
// The five tiles in store-assets/ come from a single capture of the settings page,
// so that nothing is repeated between them and nothing is cropped away. Cutting them
// needs an image library, which this project does not have, so that half stays in
// store-assets/make-store-shots.ps1 — it takes the capture and writes the tiles. This
// tool only produces the capture, and it produces it from the real page with the
// real stylesheet and the real script, so the tiles can be re-made after any change
// to the page instead of being a screenshot somebody took once.
//
// The capture is in English, and it has to be. The settings page picks its language from
// storage or from the browser, so a machine set to Russian produced Russian screenshots
// for an English listing and an English README — a page in a language nobody chose. The
// language is stored rather than guessed, because there is no other way to ask for it.
//
// The first two store slots are not the settings page: they are scryfall.com as the reader
// sees it with the extension loaded — a card page, and a search page with the clipboard
// open — taken in Chrome for Testing, which still loads an unpacked extension (`npm run cft`).
// They are viewport captures at the store's own 1280x800, so nothing is cropped, scaled or
// drawn over: the page as the browser drew it, card and copyright line included.
//
//   node tools/make-store-shots.cjs
//   powershell -File store-assets/make-store-shots.ps1 -Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 3 -FirstSlot 3
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, copyPage, Session, sizeOf } = require('./shots/render.cjs');

const STORE = path.join(ROOT, 'store-assets');
const WORK = path.join(ROOT, 'dist', 'store-shots');
const WIDTH = 1280;
const LANGUAGE = 'en';

async function main() {
  fs.mkdirSync(STORE, { recursive: true });
  const page = copyPage(
    path.join(ROOT, 'src', 'ui', 'options.html'),
    path.join(WORK, 'options.html'),
    { storage: { settingsLanguage: LANGUAGE } }
  );

  const session = new Session();
  try {
    await session.open();
    await session.open_(page, { width: WIDTH, height: 900 });
    // One platform switched off, and one place switched off. That is what the section looks
    // like to somebody who has actually used it, and a capture that shows every box ticked
    // says nothing at all about the two states the layout has to cope with: a dimmed row whose
    // own box is still the way back, and a place that is genuinely out.
    //
    // Both are pressed rather than set by hand. `checked = false` on its own would draw the
    // box empty and leave the stored value and the row's dimming exactly as they were, and the
    // capture would then show a state the page cannot actually be in.
    //
    // And then the page is given a moment. Every box here transitions its background over
    // 150ms, so a capture taken on the next round trip catches twelve of them mid-fade — a
    // picture of neither state, with an unticked box looking like a filled square. That is not
    // hypothetical: it is what the first capture after this rework showed, and it was measured
    // pixel by pixel before it was believed.
    await session.evaluate(`(() => {
      for (const [id, value] of [['showArena', false], ['showMtgo-prints', false]]) {
        const box = document.getElementById(id);
        if (!box) throw new Error('no such box on the page: ' + id);
        box.checked = value;
        box.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    })()`);
    await new Promise(resolve => setTimeout(resolve, 500));
    const tall = await session.fullHeight();
    const out = path.join(STORE, 'settings-page-full.png');
    await session.shootWholePage(out, { width: WIDTH });
    const size = sizeOf(out);
    console.log('source: ' + size.width + ' x ' + size.height + '  (' +
      Math.round(fs.statSync(out).size / 1024) + ' KB)');
    if (size.width !== WIDTH) {
      console.error('the browser did not give the width asked for, so the tiles would be the wrong shape');
      process.exit(1);
    }

    // And one capture for the project page, at the height a window is.
    //
    // The full capture above is right for the store — five tiles have to come from one
    // document, so nothing repeats and nothing is cut away — and wrong for a README,
    // where it is a strip six times taller than it is wide and reads as a line. A page
    // shown the way a window shows it is also the more honest picture: nobody scrolls
    // through 4860 pixels of settings to find out what the settings look like.
    //
    // It is a new filename on purpose. A repository page caches an image by its path,
    // so re-writing the old one can leave a reader looking at the picture that was
    // there before, unchanged, and wondering why nothing happened.
    const readme = path.join(STORE, 'readme-settings.png');
    await session.shoot(readme, { clip: { x: 0, y: 0, width: WIDTH, height: 1080, scale: 1 } });
    console.log('readme: ' + sizeOf(readme).width + ' x ' + sizeOf(readme).height +
      '  (' + Math.round(fs.statSync(readme).size / 1024) + ' KB)');
  } finally {
    session.close();
  }

  await liveShots();
  console.log('\nnow cut the settings capture into store slots 3 to 5:');
  console.log('  powershell -File store-assets/make-store-shots.ps1 ' +
    '-Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 3 -FirstSlot 3');
}

const STORE_W = 1280;
const STORE_H = 800;
const CARD = 'https://scryfall.com/card/dsc/114/counterspell';
const SEARCH = 'https://scryfall.com/search?q=' + encodeURIComponent('!"Counterspell" or !"Brainstorm" or !"Ponder"') + '&unique=cards';

async function waitFor(session, expression, what) {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (await session.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('waited 30 s for ' + what + ' on the live page');
}

async function liveShots() {
  const session = new Session({ extension: path.resolve(ROOT) });
  try {
    await session.open();
    await session.go('https://scryfall.com/', { width: STORE_W, height: STORE_H, settle: 1500 });
    await session.inExtension('chrome.storage.local.clear().then(() => chrome.storage.local.set(' +
      JSON.stringify({ settingsLanguage: LANGUAGE, clipboard: true }) + ')).then(() => true)');

    // 1. A card page: the prints with their finishes, the tag tables, the extra formats.
    await session.go(CARD, { width: STORE_W, height: STORE_H, settle: 2000 });
    await waitFor(session, "document.querySelectorAll('#stk-tags .prints-table tbody tr').length >= 3", 'the tag tables');
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await new Promise(resolve => setTimeout(resolve, 500));
    await session.shoot(path.join(STORE, '01-card-page.png'), { width: STORE_W, height: STORE_H });

    // 2. A search page of three cards — one row, so the clipboard list in the corner sits on
    // the page and over no card (section 7 of the store listing) — the three put into the clipboard with their own add buttons and
    // the list opened with its own button.
    await session.go(SEARCH, { width: STORE_W, height: STORE_H, settle: 2000 });
    await waitFor(session, "document.querySelectorAll('.card-grid-item .stk-add').length >= 3", 'the add buttons');
    await session.evaluate("(() => { [...document.querySelectorAll('.card-grid-item .stk-add')].slice(0, 3).forEach(b => b.click()); return true; })()");
    await waitFor(session, "document.querySelectorAll('#scryfall-toolkit-clipboard .stk-list-row').length >= 3", 'three clipboard rows');
    await session.evaluate("(() => { const list = document.querySelector('#scryfall-toolkit-clipboard .stk-list');" +
      " if (list.hidden) document.querySelector('#scryfall-toolkit-clipboard .stk-icon-clip').click(); return true; })()");
    await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
    await new Promise(resolve => setTimeout(resolve, 600));
    await session.shoot(path.join(STORE, '02-search-clipboard.png'), { width: STORE_W, height: STORE_H });

    for (const file of ['01-card-page.png', '02-search-clipboard.png']) {
      const size = sizeOf(path.join(STORE, file));
      if (size.width !== STORE_W || size.height !== STORE_H) throw new Error(file + ' is ' + size.width + 'x' + size.height);
      console.log('live: ' + file + '  ' + size.width + ' x ' + size.height);
    }
  } finally {
    session.close();
  }
}

main().catch(error => { console.error(error.message || error); process.exit(1); });