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
//   node tools/make-store-shots.cjs
//   powershell -File store-assets/make-store-shots.ps1 -Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5
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
    { storage: { settingsLanguage: LANGUAGE, siteLanguage: LANGUAGE } }
  );

  const session = new Session();
  try {
    await session.open();
    await session.open_(page, { width: WIDTH, height: 900 });
    // Paper's detail panel is closed to begin with, and a store screenshot taken with it
    // closed shows three switches, a button and three more switches — which is honest about
    // what a reader first sees and says nothing at all about what the button is for. So it is
    // opened here, by pressing the button rather than by removing `hidden` from the
    // markup: the capture then shows the page as it looks when someone has asked for it,
    // and the button's own script has run, which a hand-edited attribute would not prove.
    //
    // The Foreign Black Border category is switched off in this capture, so the picture shows
    // the rule's list — the part a reader cannot guess at — rather than a switch that looks
    // the same as the three above it. And with a category off its list stays open, which is
    // what a reader who has narrowed that category actually sees: the list is the only place
    // the narrowing is visible at all.
    await session.evaluate(`(() => {
      document.getElementById('paperDetails').click();
      for (const [id, value] of [['showBorderFamilies', false],
        ['nonEnglishMode', 'analogue']]) {
        const box = document.getElementById(id);
        if (!box) continue;
        if (box.tagName === 'SELECT') box.value = value;
        else box.checked = value;
        box.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // The areas are written by options.js rather than put in the markup, so they are
      // addressed the way the page addresses them: the container id plus the name. Asking for
      // "areaSearch" finds nothing, and a capture tool that disagrees with the settings page
      // about an id is a drift this repository has already paid for twice.
      document.getElementById('filterAreasGroup-search').checked = false;
      document.getElementById('filterAreasGroup-search')
        .dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`);
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

    console.log('\nnow cut the full capture into the five the store takes:');
    console.log('  powershell -File store-assets/make-store-shots.ps1 ' +
      '-Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5');
  } finally {
    session.close();
  }
}

main().catch(error => { console.error(error.message || error); process.exit(1); });