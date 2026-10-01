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
//   Scryfall's own page. The stage is a card-page-shaped container with our own
//   stylesheets loaded, not a copy of Scryfall's markup: the shot is about our
//   panels, and reproducing their page would be a second thing to keep true.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, sizeOf, fileUrl } = require('./shots/render.cjs');
const { buildCardPage, waitForSelector, cropOf, reveal } = require('./shots/cardpage.cjs');

// Three cards in the clipboard, as the feature stores them. Seeded rather than
// pressed in: pressing the same card three times gives one row with a count of
// three, which is not what a reader with three cards in the clipboard sees.
const CLIPBOARD_CARDS = [
  { name: 'Test Card', set: 'm19', number: '1', uri: 'https://scryfall.com/card/m19/1/test-card' },
  { name: 'Counterspell', set: 'm21', number: '57', uri: 'https://scryfall.com/card/m21/57/counterspell' },
  { name: 'Memory Jar', set: 'mh3', number: '42', uri: 'https://scryfall.com/card/mh3/42/memory-jar' }
];

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
    storage: { tags: true, cardTags: true, artTags: true, relationships: true },
    waitFor: '#stk-tags',
    build: html => page('<div class="prints">' + html + '</div>')
  },
  {
    file: 'cardclip.png',
    about: '#scryfall-toolkit-clipboard',
    storage: { clipboard: true, cards: CLIPBOARD_CARDS, exportFormat: 'moxfield' },
    prepare: page_ => reveal(page_, '.stk-list'),
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
    file: 'additional.png',
    about: '#stk-edhrec',
    storage: {
      edhrecUsage: true, edhrecLink: true, edhrecSalt: true, edhrecUsageDisplay: 'both',
      usageColorMetric: 'decks', usageMediumDecks: 500, usageHighDecks: 2000,
      saltMediumThreshold: 0.2, saltHighThreshold: 0.3
    },
    waitFor: '#stk-edhrec',
    build: html => page('<div class="card-text">' + html + '</div>')
  },
  {
    file: 'legality.png',
    about: '#stk-legalities',
    storage: { legalities: true },
    waitFor: '#stk-legalities',
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
  const session = new Session();
  const done = [];
  try {
    await session.open();
    for (const shot of SHOTS) {
      const card = await buildCardPage({ storage: shot.storage });
      if (shot.prepare) await shot.prepare(card);
      await waitForSelector(card, shot.waitFor);
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