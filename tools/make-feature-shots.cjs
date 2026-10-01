// The illustrations on the settings page: one per section, showing what the reader
// gets if they turn that section on.
//
// They are photographs of the real panels, not drawings of them. Each one is a crop
// of markup the actual feature files produced, on the actual stylesheets, rendered
// by the browser already on the machine. That is the only version of this that can
// be trusted twice: a drawing drifts from the code without anybody noticing, and a
// picture of a panel that no longer exists is worse than no picture, because a
// reader cannot tell it apart from a working one.
//
// So each shot names the element it is about and the tool waits for it. A feature
// that stops rendering produces an error, not a small empty rectangle.
//
// Two things are deliberately not here:
//
//   Card art. These panels are tables, badges and lists, and shipping Wizards' card
//   images inside a distributed extension is a question this project has no reason
//   to take on. Nothing in a shot needs one.
//
//   EDHREC's numbers. json.edhrec.com answers 403 to anything outside their own
//   site, so there is no way to put a real deck count in a picture from a build
//   machine. Rather than print a plausible four thousand decks, the section it would
//   have illustrated is shown with what the extension computes itself: the column of
//   finish badges next to every printing.
//
//   Scryfall's own page. A real screenshot needs the extension loaded into a
//   browser, and Chrome 154 refuses --load-extension, so the stage is a
//   card-page-shaped container with our own stylesheets loaded. Everything inside the
//   panels is real; the surface around them is ours.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, sizeOf, fileUrl } = require('./shots/render.cjs');
const { buildCardPage, waitForSelector, waitForCount, cropOf, reveal, fixture } = require('./shots/cardpage.cjs');

const OUT = path.join(ROOT, 'assets', 'shots');
const WORK = path.join(ROOT, 'dist', 'feature-shots');

// The stage the crops sit in. Its width is what the settings page has to show them
// in, and the stylesheets are the ones that ship.
const STAGE_WIDTH = 560;

function stylesheetLinks() {
  const parts = fs.readdirSync(path.join(ROOT, 'src', 'styles', 'theme'))
    .filter(name => name.endsWith('.css')).sort()
    .map(name => 'src/styles/theme/' + name);
  return ['src/styles/content.css', ...parts].map(file =>
    '<link rel="stylesheet" href="' + fileUrl(path.join(ROOT, file)) + '">' ).join('\n');
}

// The page a crop is rendered in. `stk-dark` because that is where our panels are
// easiest to tell apart from Scryfall's own, and because it is this project's own
// look; the same panels appear in the light theme too.
function page(body, { extra = '' } = {}) {
  return `<!DOCTYPE html><html class="stk-dark"><head><meta charset="utf-8">
<title>feature shot</title>
<style>
html, body { margin: 0; padding: 0; background: var(--stk-page, #191820); }
#main { margin: 0; padding: 0; background: var(--stk-page, #191820); }
.inner-flex { display: block; padding: 16px 18px; }
.stage-clipboard { position: relative; width: ${STAGE_WIDTH}px; height: 260px; }
/* Scryfall's own stylesheet gives the tag icons their size, and it is not part of a
   shot. Without it they stretch to fill their cell and the panel comes out five
   thousand pixels tall. Twenty is the size they have on the page; it is set here
   rather than invented per shot, and if it is ever wrong it is one number. */
#stk-tags .stk-tag-icon svg { width: 20px; height: 20px; }
${extra}
</style>
${stylesheetLinks()}
</head><body>
<div id="main"><div class="inner-flex">
${body}
</div></div>
</body></html>`;
}

// --- the six shots ------------------------------------------------------------
//
// Each one: the storage that has the feature on, the element the shot is about, and
// how the crop should sit on the page. The waitFor is what makes the shot fail
// rather than come out empty.

const SHOTS = [
  {
    file: 'tags.png',
    about: '#stk-tags',
    storage: { tags: true, cardTags: true, artTags: true, relationships: false },
    waitFor: '#stk-tags',
    build: html => page('<div class="prints">' + html + '</div>')
  },
  {
    file: 'cardclip.png',
    about: '#scryfall-toolkit-clipboard',
    // Seeded rather than pressed in: pressing the same card three times gives one
    // row with a count of three, which is not what a reader with three cards in the
    // clipboard sees. The cards are real ones, looked up by name.
    storage: { clipboard: true, exportFormat: 'moxfield' },
    prepare: card => reveal(card, '.stk-list'),
    waitFor: '#scryfall-toolkit-clipboard .stk-list-row',
    // Cropped on the stage, not on the aside. The list is positioned above the
    // toolbar and outside the aside's own box, exactly as it is on the page, so a
    // crop of the aside is a picture of an 80-pixel toolbar.
    build: html => page('<div class="stage-clipboard">' + html + '</div>', {
      extra: '.stage-clipboard { width: 400px; height: 250px; }' +
        '#scryfall-toolkit-clipboard { position: absolute !important; left: 26px; bottom: 18px; }'
    })
  },
  {
    // Not EDHREC: their API refuses this machine, and a plausible invented deck
    // count is exactly what the previous pictures were full of. The column of
    // finishes is the other thing this section promises, and every value in it is a
    // value Scryfall returned.
    file: 'additional.png',
    about: '#main .prints > .prints-table',
    // Grouping on as well, so this is not the same picture as the hiding one below:
    // the finish column is the subject here, but the set headers are what make a
    // table of many printings readable, and the two crops are side by side in the
    // settings.
    storage: { finishBadges: true, printGrouping: true, printFoldGroups: false },
    waitFor: '#main .prints > .prints-table .stk-finish-header',
    // Every row has to have its badge, not just the first one. Waiting for "a
    // badge" is satisfied by the current printing and photographs the rest as
    // missing, which is a picture of a feature that half works. Two is the floor:
    // a printing with several finishes gets an empty cell on purpose.
    waitCount: ['#main .prints > .prints-table .stk-finish-badge', 2],
    waitFor: '.stk-print-group-row',
    build: html => page('<div class="prints">' + html + '</div>')
  },
  {
    file: 'legality.png',
    // The whole legality block, not the first row of it. The block gets an id on
    // whichever row comes first after the sorting, and an added format lands in
    // whatever row still has room — so cropping the id gives a picture of Scryfall's
    // own Standard and Modern and none of our work, which is what the previous
    // version of this shot showed.
    about: '#main .card-legality',
    // Premodern on, because that is the one of the four extra formats read off the
    // card's own Scryfall answer. The other three are asked of Scryfall by oracle id
    // through a query this build has no answer for, so turning them on would put
    // "error" in a picture.
    storage: { legalities: true, premodern: true },
    waitFor: '#stk-legalities',
    // The added format is the point, so waiting for the block's id is not enough:
    // that id lands on the first row, which Scryfall's own rows already fill.
    waitCount: ['#main .card-legality .card-legality-item', 3],
    build: html => page('<div class="card-text"><div class="card-legality">' + html + '</div></div>')
  },
  {
    file: 'prints.png',
    // The table Scryfall renders, named by where it sits rather than by a class of
    // ours: our tag tables deliberately reuse Scryfall's prints-table so they look
    // native, so ".prints-table" matches four elements and a crop of it is a picture
    // of two features at once.
    about: '#main .prints > .prints-table',
    storage: { printGrouping: true, printFoldGroups: false, printFullPageLink: true },
    waitFor: '.stk-print-group-row',
    build: html => page('<div class="prints">' + html + '</div>')
  },
  {
    file: 'hide-extra.png',
    about: '#main .prints > .prints-table',
    storage: {
      hideDigitalSets: true, hideNonTournamentSets: true, hideNonEnglishPrints: true,
      setPlatformsAll: false, setPlatformsPaper: true
    },
    waitFor: '#main .prints > .prints-table',
    build: html => page('<div class="prints">' + html + '</div>')
  }
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const data = await fixture();
  console.log('card: ' + data.hero.name + ', ' + data.prints.length + ' printings, ' +
    data.hero.cardTags.length + ' card tags, ' + data.hero.artTags.length + ' art tags');
  const session = new Session();
  const done = [];
  try {
    await session.open();
    for (const shot of SHOTS) {
      const storage = shot.file === 'cardclip.png'
        ? { ...shot.storage, cards: data.clipboard }
        : shot.storage;
      const card = await buildCardPage({ data, storage });
      if (shot.prepare) await shot.prepare(card, data);
      await waitForSelector(card, shot.waitFor);
      if (shot.waitCount) await waitForCount(card, shot.waitCount[0], shot.waitCount[1]);
      let crop = cropOf(card.document, shot.about);
      if (/^\s*$/.test(crop)) throw new Error(shot.file + ': the crop came out empty');
      const htmlFile = path.join(WORK, shot.file.replace(/\.png$/, '.html'));
      fs.mkdirSync(WORK, { recursive: true });
      fs.writeFileSync(htmlFile, shot.build(crop), 'utf8');

      await session.open_(htmlFile, { width: STAGE_WIDTH + 40, height: 900 });
      const box = await session.boxOf(shot.clip || 'body > #main > .inner-flex > *');
      const clip = box && box.width > 4 && box.height > 4
        ? { x: box.x, y: box.y, width: box.width, height: box.height }
        : null;
      if (!clip) throw new Error(shot.file + ': the stage has no size, so the crop would be empty');
      // A panel is a panel, not a page. An illustration thousands of pixels tall means
      // something in the stage is unbounded — an icon with no size, a float that never
      // cleared — and the failure is a picture that looks like a very long panel rather
      // than like an error.
      if (clip.height > 1200) {
        throw new Error(shot.file + ': the crop is ' + Math.round(clip.height) +
          ' pixels tall, which is not a panel. Something in the stage has no size.');
      }

      const out = path.join(OUT, shot.file);
      await session.shoot(out, { clip, scale: 2 });
      const size = sizeOf(out);
      done.push({ file: shot.file, ...size, kb: Math.round(fs.statSync(out).size / 1024) });
      console.log('  ' + shot.file.padEnd(16) + String(size.width).padStart(5) + ' x ' +
        String(size.height).padStart(4) + '  ' + String(Math.round(fs.statSync(out).size / 1024)).padStart(4) + ' KB  ' +
        shot.about);
    }
  } finally {
    session.close();
  }
  const total = done.reduce((sum, shot) => sum + shot.kb, 0);
  console.log('\n' + done.length + ' illustrations, ' + total + ' KB in total');
  console.log('  written to ' + OUT.slice(ROOT.length));
}

main().catch(error => { console.error(error.message || error); process.exit(1); });