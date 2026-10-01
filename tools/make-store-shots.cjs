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
//   node tools/make-store-shots.cjs
//   powershell -File store-assets/make-store-shots.ps1 -Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, copyPage, Session, sizeOf } = require('./shots/render.cjs');

const STORE = path.join(ROOT, 'store-assets');
const WORK = path.join(ROOT, 'dist', 'store-shots');
const WIDTH = 1280;

async function main() {
  fs.mkdirSync(STORE, { recursive: true });
  const page = copyPage(
    path.join(ROOT, 'src', 'ui', 'options.html'),
    path.join(WORK, 'options.html')
  );

  const session = new Session();
  try {
    await session.open();
    await session.open_(page, { width: WIDTH, height: 900 });
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
    console.log('\nnow cut it into the five the store takes:');
    console.log('  powershell -File store-assets/make-store-shots.ps1 ' +
      '-Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5');
  } finally {
    session.close();
  }
}

main().catch(error => { console.error(error.message || error); process.exit(1); });