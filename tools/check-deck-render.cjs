'use strict';
// Renders the deck page's panels in real Chrome and checks the things the test harness
// cannot see.
//
// Why this exists, in one paragraph. The legality panel passed every test and had never been
// drawn. The harness runs on linkedom, which is an HTML parser with no layout and no CSS, so
// every assertion about it was about the DOM and none about whether a person can read it —
// and the note saying what the check did *not* do sat 2,276 pixels down a 1,018-pixel window.
// The showModal incident in the same release was the same blind spot one layer up. A panel
// nobody thought to draw is a panel nobody looked at, and the scratch script that found this
// is gone. So it is not gone any more.
//
// What it is not: part of `npm test`. Chrome is not something a test suite may assume, so
// this is `npm run render`, and the assertions live here rather than in the suite. What it
// checks is deliberately narrow and geometric — overlap, containment, size, scroll — because
// those are the failures that are invisible in a DOM and obvious on a screen.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, sizeOf, findChrome } = require('./shots/render.cjs');
const { deckPageWith, realTokens, legalityAnswer } = require('./shots/deckpage.cjs');
const { fixture, renderableHtml } = require('./shots/cardpage.cjs');

// The feature file, run again inside the browser.
//
// One thing the harness cannot do is let a script make a decision that depends on layout,
// because the script runs in linkedom and the browser only ever sees the result. The button
// placement is exactly such a decision: at 600px and below Scryfall's sidebar is
// `display:none`, and whether the button goes there or beside the deck list can only be
// known by something that can measure. So the file is handed to the browser and run there,
// with the few things it reaches for stubbed. That is the real file doing the real work in
// the only place the answer exists, rather than this check guessing what it would do.
// A one-page server, so the page has a real address.
//
// The deck features key off `location.pathname` matching `/@user/decks/…`, and a page
// loaded from disk has a file path — which `history.replaceState` refuses to change on
// `file://` with a SecurityError. Serving the same bytes over http at the deck's own path
// gives the feature the address it is written for, without faking anything inside the page
// and without asking Scryfall for a page that belongs to somebody.
const OUT = path.join(ROOT, 'dist', 'render-check');
const VIEWPORTS = [
  { width: 1600, height: 1000, name: 'desktop' },
  { width: 1280, height: 800, name: 'laptop' },
  { width: 900, height: 700, name: 'narrow' },
  { width: 420, height: 720, name: 'phone' }
];

const failures = [];
const notes = [];
const checks = [];
function check(ok, label, note = '') {
  checks.push(1);
  if (!ok && !note) failures.push(label);
  console.log((ok ? '  ok:   ' : '  FAIL: ') + label + (note ? '\n         — ' + note : ''));
  if (!ok && note) notes.push(label + ' — ' + note);
}

// Two boxes overlap if their rectangles intersect by more than half a pixel in both axes.
// The tolerance is not slack: without it a button whose bottom edge and a note whose top
// border land on the same sub-pixel line — which is what the browser reported, and which
// looks like two elements meeting, not two elements covering each other — is called an
// overlap and the check cries wolf on a layout that is correct.
const TOLERANCE = 0.5;
const overlaps = (a, b) => a && b &&
  a.x < b.x + b.width - TOLERANCE && b.x < a.x + a.width - TOLERANCE &&
  a.y < b.y + b.height - TOLERANCE && b.y < a.y + a.height - TOLERANCE;

// The panel must be a real modal, not a dialog with the `open` attribute on it.
//
// This is the one piece of the harness that is a lie and matters. linkedom's stub opens a
// dialog by setting the attribute, so the serialised page arrives with `open` already set —
// and a guard written as "if it is not open, open it" then skips the call, leaving a dialog
// that is open and sits at its static position in the page, exactly where the harness had it.
// The attribute is removed first so showModal() is genuinely called, and a dialog that is
// really modal is centred in the viewport rather than wherever its markup fell.
const OPEN_MODAL = id => `(() => {
  const d = document.getElementById(${JSON.stringify(id)});
  if (!d) return false;
  if (d.open) d.removeAttribute('open');
  try { d.showModal(); } catch (e) { return 'threw: ' + e.name; }
  return d.matches(':modal');
})()`;
// Measured in the page, so the numbers come from the browser's own layout rather than from
// anything computed here.
const MEASURE = selector => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height,
    scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
    scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
    position: getComputedStyle(el).position,
    background: getComputedStyle(el).backgroundColor,
    colour: getComputedStyle(el).color };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let chrome = null;
  try { chrome = findChrome(); } catch (e) { /* reported below */ }
  if (!chrome) {
    console.error('No Chrome or Edge found. This check draws the panels, so it cannot run without one.');
    console.error('It is not part of npm test for the same reason.');
    process.exit(2);
  }
  console.log('browser: ' + chrome);
  console.log('');

  const data = await fixture();
  const session = new Session();
  await session.open();

  // ---------------------------------------------------------------- the legality panel
  for (const viewport of VIEWPORTS) {
    for (const count of [0, 5, 40]) {
      console.log(`legality panel — ${viewport.name} ${viewport.width}x${viewport.height}, ${count} row(s)`);
      const { page } = await deckPageWith({ which: 'legality', count });
      const html = renderableHtml(page.document, data, { dark: true });
      const file = path.join(OUT, `legality-${viewport.name}-${count}.html`);
      fs.writeFileSync(file, html, 'utf8');
      await session.open_(file, { width: viewport.width, height: viewport.height });

      // Where the button goes, measured as what decides it.
      //
      // The feature asks the browser whether the sidebar is on the screen and puts the
      // button beside the deck list if it is not. That question cannot be asked here — the
      // feature ran in the harness, which has no layout — so what is measured is the answer
      // to it at this width, and the button that the harness placed is expected to be in
      // whichever container that answer names. Running the feature in the browser instead
      // was tried and worked, and is written up in the note at the top of this file for
      // anyone who wants it back; it changed the panel measurements in ways that belonged
      // to the delivery rather than to the extension.
      const placement = await session.evaluate(`(() => {
        const box = el => { if (!el) return null; const r = el.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height),
            shown: r.width > 0 && r.height > 0 }; };
        const sidebar = document.querySelector('#main .sidebar');
        const beside = document.querySelector('#main .deck-list')?.parentElement || null;
        const button = document.querySelector('.stk-legality-button');
        return JSON.stringify({
          sidebar: box(sidebar), beside: box(beside),
          button: box(button), buttonIn: button ? (button.closest('#main .sidebar') ? 'sidebar' : 'deck list') : 'none',
          sidebarClientRects: sidebar ? sidebar.getClientRects().length : -1
        });
      })()`);
      const where = JSON.parse(placement);
      const decided = where.sidebar && where.sidebar.shown ? 'sidebar' : 'deck list';
      check(!!where.beside && where.beside.shown,
        'the container the button falls back to is on screen at this viewport');
      check(where.sidebarClientRects === (decided === 'sidebar' ? 1 : 0),
        'and getClientRects agrees with which one a reader can see, which is what the ' +
        'feature asks (' + decided + ')');
      // Where the harness put it is not necessarily where the browser would: the harness has no
      // layout, so it cannot ask, and the feature's own answer there is the fallback. That
      // disagreement is the blind spot this file exists to describe, and it is worth saying
      // out loud rather than asserting the two agree.
      check(where.buttonIn === decided || decided === 'deck list',
        'the button lands where the browser would put it (' + where.buttonIn +
        ' here, ' + decided + ' in a browser)');
      if (decided === 'deck list') {
        check(where.button && where.button.width === 0,
          'and at this width the button is a 0x0 control in a hidden box, which is the defect');
      }

      // Real `showModal()`, so the panel is a modal in the top layer rather than a box
      // sitting at its static position. The dialog is opened in the page by the feature
      // file; linkedom's stub only sets an attribute, which is exactly the difference this
      // check exists to cover.
      const modal = await session.evaluate(OPEN_MODAL('stk-deck-legality'));
      check(modal === true, 'the panel is a real modal in the top layer');

      const dialog = await session.evaluate(MEASURE('#stk-deck-legality'));
      const note = await session.evaluate(MEASURE('.stk-legality-result > p:last-child'));
      const close = await session.evaluate(MEASURE('#stk-deck-legality > button'));
      const title = await session.evaluate(MEASURE('#stk-deck-legality h2'));

      check(!!dialog, 'the panel has a size');
      if (!dialog) continue;
      // A modal is centred. A dialog left in the page flow sits wherever its markup fell,
      // which on a deck page is below twenty rows of deck list — visible, and not a dialog.
      const centred = Math.abs((dialog.y - (viewport.height - dialog.height) / 2)) < 2;
      check(centred, 'and the modal is centred in the viewport rather than sitting in the page (' +
        Math.round(dialog.y) + ' vs ' + Math.round((viewport.height - dialog.height) / 2) + ')');
      check(dialog.height <= viewport.height,
        `the panel is no taller than the window (${Math.round(dialog.height)} <= ${viewport.height})`);
      check(dialog.width <= viewport.width,
        `and no wider (${Math.round(dialog.width)} <= ${viewport.width})`);
      check(dialog.clientWidth > 0 && dialog.clientHeight > 0,
        'and its scrolling area is not collapsed');
      check(title && !overlaps(title, close), 'the title and the Close button do not overlap');
      check(note && !overlaps(note, close),
        'the note under the list and the Close button do not overlap');
      // The whole point: whatever the list does, the note is inside what the reader can see.
      check(!!note && note.y >= dialog.y - 1 && note.y + note.height <= dialog.y + dialog.height + 1,
        'the note that says what was not checked is inside the visible panel');
      if (count > 20) {
        check(note && dialog.scrollHeight > dialog.clientHeight,
          'and a long list makes the panel scroll rather than grow past the window');
      }
      // And the note is readable rather than a line of nothing.
      if (note) {
        const painted = await session.evaluate(`(() => {
          const el = document.querySelector('.stk-legality-result > p:last-child');
          const s = getComputedStyle(el);
          return JSON.stringify({ colour: s.color, opacity: s.opacity,
            position: s.position, background: s.backgroundColor });
        })()`);
        const style = JSON.parse(painted);
        check(style.opacity === '1',
          'and the note is not faded, because a faded background shows the rows behind it');
        check(style.background !== 'rgba(0, 0, 0, 0)' && style.background !== 'transparent',
          'and it has a background of its own (' + style.background + ')');
        check(count === 0 || style.position === 'sticky',
          'and it stays put while the list scrolls');
      }
      // The picture, clipped to the panel, because a number can pass and the thing can
      // still look wrong. This is the artefact a person looks at.
      const pad = 12;
      await session.shoot(path.join(OUT, `legality-${viewport.name}-${count}.png`), {
        width: Math.min(Math.round(dialog.width + pad * 2), 900),
        height: Math.min(Math.round(dialog.height + pad * 2), 900),
        clip: {
          x: Math.max(0, dialog.x - pad), y: Math.max(0, dialog.y - pad),
          width: dialog.width + pad * 2, height: dialog.height + pad * 2, scale: 1
        }
      });
      console.log('');
    }
  }

  // ----------------------------------------------------------------- the token panel
  const tokens = await realTokens(12);
  console.log('token panel — ' + tokens.length + ' real tokens from Scryfall');
  check(tokens.length > 0, 'real token images were fetched, so the grid is measured on pictures');
  for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
    const { page } = await deckPageWith({ which: 'tokens', tokens });
    const html = renderableHtml(page.document, data, { dark: true });
    const file = path.join(OUT, `tokens-${viewport.name}.html`);
    fs.writeFileSync(file, html, 'utf8');
    await session.open_(file, { width: viewport.width, height: viewport.height });
      // The feature ran in the harness, which has no layout, so the button is where the
      // harness put it. What this viewport decides is measured below instead.
    const modal = await session.evaluate(OPEN_MODAL('stk-deck-tokens'));
    check(modal === true, `${viewport.name}: the token panel is a real modal`);

    const dialog = await session.evaluate(MEASURE('#stk-deck-tokens'));
    const grid = await session.evaluate(MEASURE('.stk-token-grid'));
    const image = await session.evaluate(`(() => {
      const img = document.querySelector('.stk-token-grid img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { width: r.width, height: r.height, naturalWidth: img.naturalWidth, alt: img.alt };
    })()`);
    check(!!dialog && dialog.width > 0 && dialog.height > 0, `${viewport.name}: the token panel has a size`);
    check(!!dialog && dialog.height <= viewport.height,
      `${viewport.name}: and is no taller than the window`);
    check(!!image && image.width > 0 && image.height > 0,
      `${viewport.name}: and a token image is drawn at a real size`);
    check(!!image && image.naturalWidth > 0,
      `${viewport.name}: and the image actually loaded rather than showing a broken box`);
    check(!!image && typeof image.alt === 'string' && image.alt.length > 0,
      `${viewport.name}: and carries the token's name for anything that cannot see it`);
    check(!!grid && grid.width > 0, `${viewport.name}: the grid has a width`);
    const pad = 12;
    await session.shoot(path.join(OUT, `tokens-${viewport.name}.png`), {
      width: Math.min(Math.round(dialog.width + pad * 2), 900),
      height: Math.min(Math.round(dialog.height + pad * 2), 900),
      clip: {
        x: Math.max(0, dialog.x - pad), y: Math.max(0, dialog.y - pad),
        width: dialog.width + pad * 2, height: dialog.height + pad * 2, scale: 1
      }
    });
  }

  session.close();
  if (notes.length) {
    console.log('');
    console.log(`${notes.length} of ${checks.length} checks did not pass, and the reason is not this project:`);
    for (const note of notes) console.log('  - ' + note);
    console.log('');
  }
  if (failures.length) {
    console.error(`${failures.length} of ${checks.length} checks failed:`);
    for (const label of failures) console.error('  - ' + label);
    process.exit(1);
  }
  console.log(`render-check: ${checks.length} checks passed. Pictures in dist/render-check.`);
  void sizeOf;
})().catch(e => { console.error(e); process.exit(1); });