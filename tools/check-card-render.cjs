'use strict';
// Renders the card page's panels in a real browser and checks what the test harness cannot see.
//
// The deck page has `tools/check-deck-render.cjs`, and it exists because a feature passed
// every test and had never been drawn: linkedom is an HTML parser with no layout and no CSS,
// so every assertion about a panel was about the DOM and none about whether a person could
// read it.
//
// The six illustrations behind the "?" buttons in the settings are drawn by a real browser,
// but what they check is that a feature produced a picture — not that the picture is a panel
// a reader could use. A panel that renders sideways, overlaps its own close button, stretches
// its icons to fill their cells, or floats off the side of a phone produces a perfectly good
// screenshot of a broken feature. One of those is already known: the pictures carry a size for
// our tag icons that our own stylesheet does not, because Scryfall's has no rule for them and
// without one they stretch to fill the cell and the tag panel becomes five thousand pixels
// tall. The screenshot cannot show that, because the screenshot is what fixed it.
//
// So this covers all six panels, at four widths, in the arrangement a reader has: Scryfall's
// markup, Scryfall's stylesheet, our theme on top, our panels where our feature files put
// them. Nothing is staged to flatter it — no extra CSS, no element moved out from under a
// crop. What is asserted is geometric: containment, overlap, size, overflow, legibility —
// the failures invisible in a DOM and obvious on a screen.
//
// Not part of `npm test`: Chrome is not something a test suite may assume. `npm run render`.
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, Session, findChrome } = require('./shots/render.cjs');
const {
  fixture, buildCardPage, setsFixture, buildSetsPage,
  waitForSelector, waitForCount, reveal, renderableHtml
} = require('./shots/cardpage.cjs');
const { shippedForeignOnly } = require('./shots/worker-tables.cjs');

// The codes the shipped measurement names, read from the file rather than typed here.
const foreignOnlyCodes = () => shippedForeignOnly();

const OUT = path.join(ROOT, 'dist', 'render-check');
const VIEWPORTS = [
  { width: 1600, height: 1000, name: 'desktop' },
  { width: 1280, height: 800, name: 'laptop' },
  { width: 900, height: 700, name: 'narrow' },
  { width: 420, height: 720, name: 'phone' }
];

const checks = [];
const failures = [];
const notes = [];

// A check that does not pass fails the run, whether or not it can say why.
//
// It used to be the other way round: a failure that came with a reason was filed as a note
// and the run still exited 0. That was found by mutation — the non-English rule was made to
// stop reaching the sets index, the tool printed "FAIL: … hides all of them (0 of 5)", and
// then reported success. A reason is worth having; it is not a substitute for failing.
function check(ok, label, detail) {
  checks.push(1);
  if (!ok) {
    failures.push(label);
    if (detail) notes.push(label + ' — ' + detail);
  }
  console.log((ok ? '  ok:   ' : '  FAIL: ') + label +
    (!ok && detail ? '\n         — ' + detail : ''));
}

// Two boxes overlap if their rectangles intersect by more than half a pixel in both axes.
// The tolerance is not slack: a bottom edge and a top border on the same sub-pixel line is
// two elements meeting, not two elements covering each other.
const TOLERANCE = 0.5;

const inside = (child, parent, slack = 1) => child && parent &&
  child.x >= parent.x - slack && child.y >= parent.y - slack &&
  child.x + child.width <= parent.x + parent.width + slack &&
  child.y + child.height <= parent.y + parent.height + slack;

const overlaps = (a, b) => a && b &&
  a.x < b.x + b.width - TOLERANCE && b.x < a.x + a.width - TOLERANCE &&
  a.y < b.y + b.height - TOLERANCE && b.y < a.y + a.height - TOLERANCE;

// Everything is measured in the page, so the numbers are the browser's own and not this
// file's arithmetic about the browser's numbers.
const PROBE = `(() => {
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height,
      scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight, clientHeight: el.clientHeight,
      text: (el.textContent || '').trim().slice(0, 48) }; };
  const many = selector => [...document.querySelectorAll(selector)]
    .map(el => { const b = box(el); if (b) b.selector = selector; return b; })
    .filter(b => b.width > 0 || b.height > 0);
  const first = selector => box(document.querySelector(selector));
  return { box: first(window.__stkPanel), rows: many(window.__stkRows),
    labels: many(window.__stkLabels), icons: many(window.__stkIcons),
    also: Object.fromEntries((window.__stkAlso || []).map(s => [s, first(s)])) };
})()`;

async function measure(session, { panel, rows, labels, icons, also = [] }) {
  await session.evaluate(
    '(() => { window.__stkPanel = ' + JSON.stringify(panel) + ';' +
    'window.__stkRows = ' + JSON.stringify(rows) + ';' +
    'window.__stkLabels = ' + JSON.stringify(labels) + ';' +
    'window.__stkIcons = ' + JSON.stringify(icons) + ';' +
    'window.__stkAlso = ' + JSON.stringify(also) + '; return true; })()');
  // `returnByValue` hands the object back already parsed; JSON.parse of it would be a
  // second reading of a thing that was never a string.
  return session.evaluate(PROBE);
}

// The style of one element, for the questions only a computed style answers.
const STYLE_OF = selector => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) return null;
  const s = getComputedStyle(el);
  return JSON.stringify({ colour: s.color, background: s.backgroundColor,
    fontSize: s.fontSize, opacity: s.opacity, display: s.display,
    overflow: s.textOverflow, whiteSpace: s.whiteSpace });
})()`;

// Every row of Scryfall's sets index with the set it names and whether it is on screen.
// The code is read out of the row's own link, `/sets/<code>`, so what is compared is what
// the page says a row is rather than what the switch was asked about.
const SET_ROWS = `JSON.stringify([...document.querySelectorAll('#js-checklist tbody tr')]
  .map(row => {
    const link = row.querySelector('td:first-child a[href]');
    const found = link && /\\/sets\\/([^/]+)\\/?$/.exec(link.getAttribute('href'));
    return { set: found ? found[1] : null,
      shown: getComputedStyle(row).display !== 'none',
      text: (row.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40) };
  }))`;

// The counter Scryfall repeats above and below the list, which the extension rewrites to
// count what is left rather than what the page holds.
const SET_COUNTER = `(() => {
  const label = document.querySelector('#main .search-controls label[for="order"]');
  return label ? label.textContent.trim() : null;
})()`;

// The sets the classification says are digital — Scryfall's own flag, from the same object
// the page is given, so this asks the same question the filter does.
const digitalSets = sets => sets.categories.digital || [];

// A page panel: it exists, it is drawn, it stays inside the column it sits in, its rows are
// inside it, and it says something. This is the part every column panel shares.
//
// `ours` says whether the panel is one this extension builds. It decides one thing: whether
// a container wider than its column is our defect or theirs. Scryfall's prints table is
// 409px wide in a 383px column and has been since before this extension existed, so failing
// that would be failing somebody else's layout; our own panels have no such excuse. The
// decision is passed in rather than guessed from a selector, because "which of these boxes
// did we draw" is a fact about the extension and only the extension knows it.
function checkPanel(probed, label, ours) {
  const panel = probed.box;
  check(!!panel, label + ': the panel is on the page');
  if (!panel) return null;
  check(panel.width > 0 && panel.height > 0,
    label + ': and it is drawn, not laid out to nothing (' +
    Math.round(panel.width) + 'x' + Math.round(panel.height) + ')');
  const overflows = panel.scrollWidth > panel.clientWidth + 1;
  check(ours ? !overflows : overflows,
    ours
      ? label + ': and it does not scroll sideways, which is what a panel wider than its ' +
        'column does (' + panel.scrollWidth + ' vs ' + panel.clientWidth + ')'
      : label + ': and the container is Scryfall\'s own, which is wider than its column ' +
        'here (' + panel.scrollWidth + ' vs ' + panel.clientWidth + ') — so its rows are ' +
        'checked against its full width, not the part on screen',
    !ours && !overflows
      ? 'their table fits at this width, so this note is stale and should be removed'
      : null);
  check(probed.rows.length > 0, label + ': and it has rows (' + probed.rows.length + ')');
  // Containment is against what the container actually holds, which for a scrolling table
  // is `scrollWidth` rather than `clientWidth`: a cell at x=400 in a 409px-wide table is
  // inside the table and merely off the visible edge.
  const bounds = overflows
    ? { x: panel.x, y: panel.y, width: panel.scrollWidth, height: panel.height }
    : panel;
  const strays = probed.rows.filter(row => !inside(row, bounds, 2));
  check(strays.length === 0,
    label + ': and every row sits inside it' +
    (strays.length ? ' (' + strays.length + ' outside, e.g. "' + strays[0].text + '")' : ''));
  check(probed.labels.length > 0 && probed.labels.every(l => l.text.length > 0),
    label + ': and every row it labels says what the label is');
  return panel;
}

const PANELS = [
  {
    name: 'tags',
    storage: { tags: true, cardTags: true, artTags: true, relationships: false },
    waitFor: '#stk-tags',
    waitCount: ['#stk-tags .prints-table tbody tr', 3],
    ours: true,
    measure: { panel: '#stk-tags', rows: '#stk-tags .prints-table tbody tr',
      labels: '#stk-tags .prints-table tbody td a',
      icons: '#stk-tags .stk-tag-icon svg' },
    async extra(session, probed) {
      // An SVG with no width and no height fills whatever box it is given, so an icon
      // that nothing sizes is not a small icon, it is a panel. The settings illustrations
      // carry an explicit `width:16px;height:16px` for these, and whether that is needed
      // is not something a screenshot can answer — so it is measured here, on the page as
      // the extension builds it and with no extra CSS.
      const sizes = probed.icons.map(i => Math.max(i.width, i.height));
      check(probed.icons.length > 0, 'tags: it has tag icons (' + probed.icons.length + ')');
      check(sizes.every(size => size > 0),
        'tags: and every icon is drawn rather than collapsed to nothing' +
        (sizes.every(s => s > 0) ? '' : ' (smallest ' + Math.round(Math.min(...sizes)) + 'px)'));
      check(sizes.every(size => size <= 24),
        'tags: and every icon is icon-sized rather than filling its cell' +
        (sizes.every(s => s <= 24) ? ' (largest ' + Math.round(Math.max(...sizes)) + 'px)'
          : ' (' + sizes.filter(s => s > 24).length + ' over 24px, largest ' +
            Math.round(Math.max(...sizes)) + 'px)'),
        sizes.every(s => s <= 24)
          ? 'so the STAGE_CSS in make-feature-shots.cjs that sizes these icons is not what ' +
            'makes them the right size — something on the real page already does it'
          : null);
      const heading = await session.evaluate(STYLE_OF('#stk-tags thead th a'));
      check(!!heading, 'tags: it has a heading naming what the tags are');
    }
  },
  {
    name: 'extra legalities',
    storage: { legalities: true, premodern: true },
    waitFor: '#stk-legalities',
    waitCount: ['.card-profile .card-legality .card-legality-item', 3],
    ours: true,
    measure: { panel: '.card-legality', rows: '.card-legality .card-legality-item',
      labels: '.card-legality .card-legality-item',
      also: ['.card-legality h4, .card-legality h3'] },
    async extra(session, probed) {
      const style = await session.evaluate(STYLE_OF('.card-legality .card-legality-item'));
      const parsed = style ? JSON.parse(style) : null;
      check(!!parsed, 'extra legalities: a row has a computed style');
      if (parsed) {
        check(Number.parseFloat(parsed.fontSize) >= 11,
          'extra legalities: and its type is readable at ' + parsed.fontSize);
        check(parsed.colour !== parsed.background,
          'extra legalities: and it is not painted the colour of the background behind it');
      }
    }
  },
  {
    name: 'finish badges',
    // Not a panel of its own: a badge is a glyph in a cell of Scryfall's prints table, in
    // as many cells as there are printings. So what has to hold is that each badge has a
    // size, says which finish it is, and does not sit on top of its neighbour.
    storage: { finishBadges: true, printGrouping: true, printFoldGroups: false },
    waitFor: '.stk-finish-header',
    waitCount: ['.stk-finish-badge', 2],
    ours: false,
    // Scoped to the prints table under the card profile and not to `.prints-table` at
    // large: our tag panel is a `.prints-table` too, and an unscoped selector puts its
    // rows inside a table they have nothing to do with.
    measure: { panel: '#main .prints > .prints-table', rows: '#main .prints > .prints-table tbody tr',
      labels: '.stk-finish-badge', icons: '.stk-finish-badge' },
    async extra(session, probed) {
      const sized = probed.labels.filter(b => b.width > 0 && b.height > 0);
      check(sized.length === probed.labels.length,
        'finish badges: every badge has a size a reader can see (' +
        sized.length + ' of ' + probed.labels.length + ')');
      check(probed.labels.every(b => b.text.length > 0),
        'finish badges: and every badge names its finish');
      // Same row, same line: two badges covering each other is invisible in a screenshot
      // of the whole column and obvious to a reader looking for one printing.
      const byRow = new Map();
      for (const badge of probed.labels) {
        const row = probed.rows.find(r => badge.x >= r.x - 2 &&
          badge.x + badge.width <= r.x + r.width + 2 &&
          badge.y >= r.y - 2 && badge.y + badge.height <= r.y + r.height + 2);
        if (!row) continue;
        const key = row.y + ':' + row.x;
        if (!byRow.has(key)) byRow.set(key, []);
        byRow.get(key).push(badge);
      }
      let clashes = 0;
      for (const group of byRow.values()) {
        for (let a = 0; a < group.length; a += 1) {
          for (let b = a + 1; b < group.length; b += 1) {
            if (overlaps(group[a], group[b])) clashes += 1;
          }
        }
      }
      check(clashes === 0,
        'finish badges: and no two in the same row cover each other' +
        (clashes ? ' (' + clashes + ' pairs)' : ''));
    }
  },
  {
    name: 'prints grouping',
    storage: { printGrouping: true, printFoldGroups: false, printFullPageLink: true },
    waitFor: '.stk-print-group-row',
    ours: false,
    measure: { panel: '#main .prints > .prints-table', rows: '.stk-print-group-row',
      labels: '.stk-print-group-row td > span' },
    async extra(session, probed) {
      // A group row truncates its label with an ellipsis on purpose, so overflow is not a
      // failure here — a clipped label with no ellipsis is.
      const clipped = probed.labels.filter(l => l.scrollWidth > l.clientWidth + 1);
      const style = await session.evaluate(STYLE_OF('.stk-print-group-row td > span'));
      const parsed = style ? JSON.parse(style) : null;
      check(!clipped.length || (!!parsed && parsed.overflow === 'ellipsis'),
        'prints grouping: a label too long for its cell is ellipsised rather than cut' +
        (clipped.length ? ' (' + clipped.length + ' clipped)' : ''),
        clipped.length ? null : 'no label is long enough to be clipped at this width');
      check(!!parsed && parsed.whiteSpace === 'nowrap',
        'prints grouping: and a group label stays on one line rather than wrapping the row');
    }
  },
  {
    name: 'clipboard',
    // Not a panel in a column but a toolbar pinned to a corner of the window with a popover
    // above it, and the popover is what a reader reads. Two things make the usual checks the
    // wrong questions here. The list is `position:absolute; bottom:calc(100% + 7px)`, so it
    // sits *outside* the box of the thing that owns it — "is it inside the panel" is answered
    // no by a design that is correct. And `.stk-list-row` is `display:contents`, so a row is
    // not a box at all; the things worth measuring are the cells inside it.
    storage: { clipboard: true, exportFormat: 'moxfield' },
    seeded: true,
    floating: true,
    waitFor: '#scryfall-toolkit-clipboard .stk-list-row',
    waitCount: ['#scryfall-toolkit-clipboard .stk-list-row', 3],
    prepare: page => reveal(page, '.stk-list'),
    measure: {
      panel: '#scryfall-toolkit-clipboard .stk-toolbar',
      rows: '#scryfall-toolkit-clipboard .stk-list-row > *',
      labels: '#scryfall-toolkit-clipboard .stk-list-row a',
      also: ['#scryfall-toolkit-clipboard .stk-toolbar', '#scryfall-toolkit-clipboard .stk-list']
    },
    async extra(session, probed, viewport) {
      const toolbar = probed.also['#scryfall-toolkit-clipboard .stk-toolbar'];
      const list = probed.also['#scryfall-toolkit-clipboard .stk-list'];
      check(!!toolbar, 'clipboard: it has a toolbar');
      check(!!list && list.width > 0 && list.height > 0,
        'clipboard: and the popover of cards opens (' +
        (list ? Math.round(list.width) + 'x' + Math.round(list.height) : 'nothing') + ')');
      if (!list) return;
      check(!!toolbar && !overlaps(toolbar, list),
        'clipboard: and the popover does not cover the toolbar it is opened from');
      const strays = probed.rows.filter(cell => !inside(cell, list, 2));
      check(probed.rows.length > 0,
        'clipboard: and it has cells to read (' + probed.rows.length + ' across 3 rows)');
      check(strays.length === 0,
        'clipboard: and every one of them sits inside the popover' +
        (strays.length ? ' (' + strays.length + ' outside, e.g. "' + strays[0].text + '")' : ''));
      check(probed.labels.length >= 3 && probed.labels.every(l => l.text.length > 0),
        'clipboard: and every row names the card it holds');
      // The popover is anchored to the bottom-right corner and grows upward, so on a phone
      // the width that matters is its own — `min(340px, 100vw - 36px)` — and the height that
      // matters is the window's.
      check(list.x >= -1 && list.x + list.width <= viewport.width + 1,
        'clipboard: and the popover is inside the window horizontally (' +
        Math.round(list.x) + '..' + Math.round(list.x + list.width) + ' of ' +
        viewport.width + ')');
      check(list.y >= -1,
        'clipboard: and does not run off the top of the window (' +
        Math.round(list.y) + ' from the top)');
      check(list.scrollHeight <= 281,
        'clipboard: and a long clipboard scrolls inside its own 280px rather than growing',
        list.scrollHeight > 281 ? 'it grew to ' + list.scrollHeight + 'px' : null);
    }
  }
];

// The set filters, which are the sixth illustration: not a panel but a decision about which
// rows Scryfall's own page shows.
//
// Checked on the sets index rather than on the prints table, and the reason is worth
// writing down because two earlier attempts on the prints table passed without testing
// anything. On that table the extension takes a window of ten sets around the printing
// being viewed and hides everything outside it, so the sets these rules name — `sld` is the
// eleventh of twenty-four — are behind the window whatever the switch says, and the rows a
// reader would see are identical either way. The window can only be widened by pressing
// "View all prints", and a rendered page cannot be pressed: the features ran in the harness
// and their event handlers did not survive being written out to a file. Two switches were
// tried before that was understood — the black-border filter and the non-tournament one,
// neither of which covers any printing of this card — and both hid nothing and passed.
//
// On the sets index a row *is* a set, so the switch and the row are next to each other with
// nothing in between. Built twice, because "some rows are hidden" only means something next
// to "and exactly those were, and nothing else moved".
//
// The rule used here is Foreign Black Border rather than the language rule, and the reason is
// the redesign's own: the language rule is about a printing, so it has nothing to say about a
// row that is a set, while a border set is exactly what a row on this page is. A check on this
// page that used the language rule would pass with every mutation of the set rules applied.
const SET_FILTERS = {
  name: 'set filters on the sets index',
  waitFor: '#js-checklist tbody tr',
  // The families this check switches off, and the sets it expects to go. Read out of the
  // classification the page is given rather than typed, so a change in the worker's patterns
  // shows up here as a change in what is expected and not as a silent pass.
  families: ['4bb', 'fbb', 'bchr'],
  storage: on => ({
    setFiltersMigrated: true,
    setFilters: {
      platforms: { paper: true, arena: true, mtgo: true },
      areas: { prints: true, search: true, sets: true },
      paper: {
        nonTournament: true, oversized: true, noEnglishSets: true,
        // Every family off means "hide this category"; one family left on is the narrowing
        // case, and it is checked below with its own expectations.
        foreignBlackBorder: { '4bb': !on, fbb: !on, bchr: !on },
        nonEnglish: 'all'
      },
      prices: { usd: false, tix: false, tcg: false, cardhoarder: false },
      tokens: false,
      caster: false
    }
  })
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let chrome = null;
  try { chrome = findChrome(); } catch { /* reported below */ }
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

  for (const viewport of VIEWPORTS) {
    for (const panel of PANELS) {
      console.log(panel.name + ' — ' + viewport.name + ' ' + viewport.width + 'x' + viewport.height);
      // The clipboard is seeded with three real cards rather than pressed in: pressing one
      // card three times gives a single row with a count of three, which is not what a
      // reader with three cards in the clipboard has, and a one-row panel cannot show
      // whether rows overlap each other.
      const storage = panel.seeded
        ? { ...panel.storage, cards: data.clipboard }
        : panel.storage;
      const page = await buildCardPage({ data, storage });
      if (panel.prepare) await panel.prepare(page);
      await waitForSelector(page, panel.waitFor);
      if (panel.waitCount) await waitForCount(page, panel.waitCount[0], panel.waitCount[1]);

      const file = path.join(OUT, 'card-' + panel.name.replace(/[^a-z]+/g, '-') +
        '-' + viewport.name + '.html');
      fs.writeFileSync(file, renderableHtml(page.document, data, { dark: true }), 'utf8');
      await session.open_(file, { width: viewport.width, height: viewport.height });

      const probed = await measure(session, panel.measure);
      // The floating panel is not in a column, so the column checks are not its checks; its
      // own `extra` says everything there is to say about it.
      if (!panel.floating) checkPanel(probed, panel.name, panel.ours);
      await panel.extra(session, probed, viewport);
      console.log('');
    }
  }

  // The set filters: the same page, twice, and the difference between them.
  console.log(SET_FILTERS.name + ' — what it hides is what it said it would');
  {
    const sets = await setsFixture();
    // What the rule is expected to cover, read out of the same classification the page is
    // given — so if the worker's patterns change, this expectation changes with them
    // instead of quietly disagreeing.
    const expected = SET_FILTERS.families
      .flatMap(family => sets.categories.foreignBlackBorder?.[family] || []).slice().sort();

    const rowsWith = async on => {
      const page = await buildSetsPage({ data: sets, storage: SET_FILTERS.storage(on) });
      await waitForSelector(page, SET_FILTERS.waitFor);
      const file = path.join(OUT, 'card-set-filters-' + (on ? 'on' : 'off') + '.html');
      fs.writeFileSync(file, renderableHtml(page.document, sets, { dark: true }), 'utf8');
      await session.open_(file, { width: 1600, height: 1000 });
      return {
        rows: JSON.parse(await session.evaluate(SET_ROWS)),
        counter: await session.evaluate(SET_COUNTER)
      };
    };
    const off = await rowsWith(false);
    const on = await rowsWith(true);
    const named = rows => rows.filter(row => expected.includes(row.set));
    const offNamed = named(off.rows).filter(row => row.shown);
    const onNamed = named(on.rows);
    const hiddenByName = onNamed.filter(row => !row.shown);
    const hiddenElsewhere = on.rows.filter(row => !row.shown && !expected.includes(row.set));
    const shownOff = off.rows.filter(row => row.shown).length;
    const shownOn = on.rows.filter(row => row.shown).length;

    check(off.rows.length > 0 && shownOff === off.rows.length,
      'set filters: every row of the index is on screen with the rule off (' +
      shownOff + ' of ' + off.rows.length + ')');
    check(expected.length > 0,
      'set filters: and the rule covers at least one set (' + expected.join(', ') + ')');
    check(offNamed.length === expected.length,
      'set filters: and every one of them is a row the index shows with the rule off (' +
      offNamed.length + ' of ' + expected.length + ')',
      offNamed.length < expected.length
        ? 'a set the rule names is not in the index, so hiding it cannot be observed'
        : null);
    check(onNamed.length === expected.length && hiddenByName.length === expected.length,
      'set filters: and switching the border category off hides all of them (' +
      hiddenByName.length + ' of ' + expected.length + ')',
      hiddenByName.length === 0 ? 'they are still on screen — the rule matched no set name' : null);
    check(hiddenElsewhere.length === 0,
      'set filters: and nothing else (' + hiddenElsewhere.length + ' other rows hidden)',
      hiddenElsewhere.length
        ? 'hidden but not named by the rule: ' +
          JSON.stringify(hiddenElsewhere.slice(0, 6).map(row => row.set))
        : null);
    check(shownOn > 0,
      'set filters: and the index is not emptied by it (' + shownOn + ' left)');

    // Per family rather than one switch, because unticking one family has to mean something.
    // 4BB is the family with the most sets, so leaving it on while the other two are off is
    // the case where a rule that ignored the list would show all of them or none of them.
    const oneFamily = SET_FILTERS.storage(true);
    oneFamily.setFilters.paper.foreignBlackBorder['4bb'] = true;
    const familyPage = await buildSetsPage({ data: sets, storage: oneFamily });
    await waitForSelector(familyPage, SET_FILTERS.waitFor);
    const familyFile = path.join(OUT, 'card-set-filters-one-family.html');
    fs.writeFileSync(familyFile, renderableHtml(familyPage.document, sets, { dark: true }), 'utf8');
    await session.open_(familyFile, { width: 1600, height: 1000 });
    const familyRows = JSON.parse(await session.evaluate(SET_ROWS));
    const fourBb = (sets.categories.foreignBlackBorder?.['4bb'] || []);
    const otherFamilies = ['fbb', 'bchr']
      .flatMap(family => sets.categories.foreignBlackBorder?.[family] || []);
    const shownFourBb = familyRows.filter(row => fourBb.includes(row.set) && row.shown);
    const shownOthers = familyRows.filter(row => otherFamilies.includes(row.set) && row.shown);
    check(fourBb.length > 0 && otherFamilies.length > 0,
      'set filters: and the index lists sets from more than one border family (' +
      fourBb.length + ' in 4BB, ' + otherFamilies.length + ' in the other two)',
      fourBb.length && otherFamilies.length ? null :
        'the narrowing cannot be observed with sets from one family only');
    check(shownFourBb.length === fourBb.length,
      'set filters: leaving one family on keeps every one of its sets (' +
      shownFourBb.length + ' of ' + fourBb.length + ')',
      shownFourBb.length < fourBb.length
        ? 'still hidden but its family is on: ' + JSON.stringify(shownFourBb.map(row => row.set))
        : null);
    check(shownOthers.length === 0,
      'set filters: while the families that are off still take theirs (' +
      shownOthers.length + ' of ' + otherFamilies.length + ' still shown)',
      shownOthers.length ? 'still shown: ' + JSON.stringify(shownOthers.map(row => row.set)) : null);
    // Scryfall's own counter, which the extension rewrites to count what is left. It is
    // read by what it labels rather than by where it sits, and it is the number a reader
    // would quote.
    check(!!on.counter && on.counter.includes(String(shownOn)),
      'set filters: and the counter above the list says the same number (' +
      on.counter + ' for ' + shownOn + ' shown)',
      on.counter ? null : 'Scryfall\'s counter is not on this page any more');

    // The platform filter, on the same page, because it is the other half of this group and
    // it needs an answer this harness used not to have. `setPlatforms` was routed to `{}`,
    // which says no digital set is on any client: `omb` and every other Alchemy set stayed
    // on the page with paper-only chosen. The index the extension ships is routed instead,
    // so the check can say which sets a client is carrying — measured, not asserted.
    const paperOnly = SET_FILTERS.storage(false);
    paperOnly.setFilters.platforms = { paper: true, arena: false, mtgo: false };
    const platformPage = await buildSetsPage({ data: sets, storage: paperOnly });
    await waitForSelector(platformPage, SET_FILTERS.waitFor);
    const platformFile = path.join(OUT, 'card-platforms-paper.html');
    fs.writeFileSync(platformFile, renderableHtml(platformPage.document, sets, { dark: true }), 'utf8');
    await session.open_(platformFile, { width: 1600, height: 1000 });
    const platformRows = JSON.parse(await session.evaluate(SET_ROWS));
    const digital = platformRows.filter(row => digitalSets(sets).includes(row.set));
    const shownDigital = digital.filter(row => row.shown);
    check(digital.length > 0,
      'set filters: and the card under test has a printing in a set the shipped index places ' +
      'on a client (' + digital.length + ' such sets in the index)',
      digital.length ? null : 'no set the index places is in the list, so the platform ' +
        'filter cannot be observed here');
    check(shownDigital.length === 0,
      'set filters: and with paper alone chosen, none of them is on the page (' +
      shownDigital.length + ' of ' + digital.length + ' still shown)',
      shownDigital.length ? 'still shown: ' +
        JSON.stringify(shownDigital.slice(0, 6).map(row => row.set)) : null);

    // And the third rule in the group, which is a plain switch over a dated measurement.
    // Read from the same file the extension loads, so the row a reader loses is named here by
    // the file rather than by a list typed into this check.
    const foreignOnly = SET_FILTERS.storage(false);
    foreignOnly.setFilters.paper.noEnglishSets = false;
    const foreignPage = await buildSetsPage({ data: sets, storage: foreignOnly });
    await waitForSelector(foreignPage, SET_FILTERS.waitFor);
    const foreignFile = path.join(OUT, 'card-foreign-only.html');
    fs.writeFileSync(foreignFile, renderableHtml(foreignPage.document, sets, { dark: true }), 'utf8');
    await session.open_(foreignFile, { width: 1600, height: 1000 });
    const foreignRows = JSON.parse(await session.evaluate(SET_ROWS));
    const listed = foreignOnlyCodes().filter(code =>
      foreignRows.some(row => row.set === code));
    const stillShown = foreignRows.filter(row => foreignOnlyCodes().includes(row.set) && row.shown);
    const wronglyHidden = foreignRows.filter(row => !row.shown && !foreignOnlyCodes().includes(row.set));
    check(listed.length > 0,
      'set filters: and the index lists sets the shipped measurement names (' + listed.length +
      ' of ' + foreignOnlyCodes().length + ')',
      listed.length ? null : 'none of them is on the page, so the rule cannot be observed here');
    check(stillShown.length === 0,
      'set filters: and with the category off, none of them is on the page (' +
      stillShown.length + ' of ' + listed.length + ' still shown)',
      stillShown.length ? 'still shown: ' +
        JSON.stringify(stillShown.slice(0, 6).map(row => row.set)) : null);
    check(wronglyHidden.length === 0,
      'set filters: and nothing else went with them (' + wronglyHidden.length + ' other rows hidden)',
      wronglyHidden.length ? 'hidden but not in the measurement: ' +
        JSON.stringify(wronglyHidden.slice(0, 6).map(row => row.set)) : null);
  }
  console.log('');

  // The same two panels in the light theme. A panel can be perfectly laid out and still be
  // unreadable, and colour is the one thing this file cannot infer from a box.
  console.log('tags and extra legalities — light theme');
  for (const name of ['tags', 'extra legalities']) {
    const panel = PANELS.find(p => p.name === name);
    for (const viewport of [VIEWPORTS[0], VIEWPORTS[3]]) {
      const page = await buildCardPage({ data, storage: panel.storage });
      await waitForSelector(page, panel.waitFor);
      if (panel.waitCount) await waitForCount(page, panel.waitCount[0], panel.waitCount[1]);
      // `renderableHtml({dark:false})` does not make a page light: it only declines to add
      // the class, and the class is already there because the extension put it on. So a
      // "light" run built that way is a second dark one, and the first version of this
      // check was checking the dark theme twice and calling it a second theme.
      const root = page.document.documentElement;
      root.setAttribute('class',
        ((root.getAttribute('class') || '').replace(/\bstk-dark\b/g, '')).trim());
      const file = path.join(OUT, 'card-light-' +
        name.replace(/[^a-z]+/g, '-') + '-' + viewport.name + '.html');
      fs.writeFileSync(file, renderableHtml(page.document, data, { dark: false }), 'utf8');
      await session.open_(file, { width: viewport.width, height: viewport.height });
      const stillDark = await session.evaluate(
        '/\\bstk-dark\\b/.test(document.documentElement.className)');
      check(stillDark === false,
        name + ' light: the page is not wearing the dark class at ' + viewport.name);
      const style = await session.evaluate(STYLE_OF(panel.measure.labels));
      const parsed = style ? JSON.parse(style) : null;
      check(!!parsed, name + ' light: a row has a computed style at ' + viewport.name);
      if (parsed) {
        check(Number.parseFloat(parsed.fontSize) >= 11,
          name + ' light: and its type is readable at ' + parsed.fontSize);
        // The background of a row is transparent more often than not, so comparing the two
        // colours directly would pass on every panel whose cells have no fill of their own.
        // What matters is that the text is not the colour of whatever is behind it, which
        // for a transparent cell means the colour of the panel.
        const behind = JSON.parse(await session.evaluate(STYLE_OF(panel.measure.panel)));
        const painted = behind && behind.background !== 'rgba(0, 0, 0, 0)'
          ? parsed.colour !== behind.background
          : parsed.colour !== 'rgb(0, 0, 0)';
        check(painted,
          name + ' light: and it is not painted the colour of the background behind it (' +
          parsed.colour + ' on ' + (behind ? behind.background : '?') + ')');
      }
    }
  }

  session.close();
  if (notes.length) {
    console.log('');
    console.log(notes.length + ' of ' + checks.length + ' checks did not pass, each with a reason:');
    for (const note of notes) console.log('  - ' + note);
  }
  if (failures.length) {
    console.error('');
    console.error(failures.length + ' of ' + checks.length + ' checks failed:');
    for (const label of failures) console.error('  - ' + label);
    process.exit(1);
  }
  console.log('');
  console.log('card render-check: ' + checks.length +
    ' checks passed. Pages in dist/render-check.');
})().catch(error => { console.error(error); process.exit(1); });
