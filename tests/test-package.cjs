/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence and
 * are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */

// A smoke test of the packaged extension.
//
// The unit tests check each file in the working tree. This checks the thing a
// user actually installs: it builds the archive, unpacks it, and turns it on.
// Two releases shipped broken because a file was missing from the zip while the
// working tree was fine -- options.css and options.js in 0.44.0, and popup.html
// in 0.46.0 -- and neither showed up until someone installed it.
//
// It answers one question: does the package power on and do its main job?
// Not "is every behaviour right" -- that is what the other suites are for.

'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { extractZip, listZip } = require('../tools/zip.cjs');
const {
  assert, assertEqual, summary, createPage, ROOT
} = require('./testlib.cjs');

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// --- build the package -------------------------------------------------------

function buildArchive() {
  console.log('smoke: building the archive');
  const out = path.join(os.tmpdir(), `stk-smoke-build-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  let code = 0;
  let output = '';
  try {
    output = execFileSync(process.execPath, [path.join(ROOT, 'package-extension.cjs')], {
      cwd: ROOT, encoding: 'utf8',
      env: { ...process.env, STK_PACKAGE_OUT: out },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    code = error.status === undefined ? 1 : error.status;
    output = String(error.stdout || '') + String(error.stderr || '');
  }
  assertEqual(code, 0, 'the package builds with no missing file');
  const manifest = JSON.parse(read('manifest.json'));
  const zip = path.join(out, `scryfall-toolkit-${manifest.version}.zip`);
  assert(fs.existsSync(zip), `the build produced scryfall-toolkit-${manifest.version}.zip`);

  // Unpack it. The archive is the artifact; the folder it unpacks to is what the
  // browser gets.
  const unpacked = path.join(out, 'unpacked');
  fs.mkdirSync(unpacked, { recursive: true });
  extractZip(zip, unpacked);
  return unpacked;
}

function listFiles(dir, base = dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, base, found);
    else found.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return found.sort();
}

// --- turn it on --------------------------------------------------------------

// Lets every promise and storage callback settle, the way a browser does before
// the user sees anything.
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function scriptsParseTest(dir) {
  console.log('smoke: every script in the package parses');
  const scripts = listFiles(dir).filter(f => f.endsWith('.js'));
  assert(scripts.length >= 10, `the package carries its scripts (${scripts.length} found)`);
  for (const file of scripts) {
    const code = fs.readFileSync(path.join(dir, file), 'utf8');
    let failed = null;
    try {
      // Parsing is not running: it catches a truncated or corrupted file without
      // needing the page's chrome API to exist.
      new vm.Script(code, { filename: file });
    } catch (error) {
      failed = error.message;
    }
    assert(!failed, `${file} parses${failed ? ' -- ' + failed : ''}`);
  }
}

function pagesAreCompleteTest(dir) {
  console.log('smoke: every page in the package brings its own files');
  const files = new Set(listFiles(dir));
  const pages = [...files].filter(f => f.endsWith('.html'));
  assertEqual(pages.sort().join(','), 'src/ui/options.html,src/ui/popup.html',
    'the package ships exactly the two extension pages');
  for (const page of pages) {
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    // Relative to the page, not to the archive root. The pages live in src/ui/ and
    // say "options.css" beside them and "../core/i18n.js" a folder up; comparing
    // the text as written would look for src/ui/options.css in the root and call a
    // complete package broken.
    const here = path.posix.dirname(page.split(path.sep).join('/'));
    for (const m of html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="([^"]+)"/gi)) {
      const written = m[1];
      if (written.startsWith('http') || written.startsWith('data:') || written.startsWith('chrome-extension:')) continue;
      const name = path.posix.normalize(path.posix.join(here, written));
      assert(files.has(name), `${page} brings ${written} with it, which is ${name}`);
    }
  }
}

async function themeTurnsOnTest(dir) {
  console.log('smoke: the packaged theme reaches a real page');
  const html = `<!doctype html><html><head></head><body>
    <div id="header"><div class="header-control-row"></div></div>
    <div id="main" class="main">
      <div class="card-page"><h1>Aang, at the Crossroads</h1></div>
    </div>
    <div id="footer"></div>
  </body></html>`;

  const page = createPage({
    url: 'https://scryfall.com/card/tla/203/aang',
    html,
    state: { darkTheme: 'dark' }
  });
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(dir, file), 'utf8'), page.context, { filename: file }
  );

  run('src/core/theme.js');
  await tick();
  const root = page.document.documentElement;
  assert(root.classList.contains('stk-dark'),
    'theme.js marks the page dark from the stored preference');
  assert(root.classList.contains('stk-account-page') === false,
    'and does not call a card page an account page');
}

async function popupPowersOnTest(dir) {
  console.log('smoke: the packaged popup starts and shows its switches');
  const html = fs.readFileSync(path.join(dir, 'src/ui/popup.html'), 'utf8');
  const page = createPage({
    url: 'chrome-extension://smoke/popup.html',
    html,
    state: {
      darkTheme: 'dark', tags: true, clipboard: true,
      edhrecUsage: false, cardtraderPrices: false, settingsLanguage: 'en'
    }
  });
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(dir, file), 'utf8'), page.context, { filename: file }
  );

  run('src/core/i18n.js');
  await tick();
  run('src/ui/popup.js');
  await tick();

  const ids = ['darkTheme', 'tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices', 'openAll'];
  for (const id of ids) {
    assert(page.document.getElementById(id), `the popup has #${id} after starting`);
  }
  // linkedom does not implement HTMLSelectElement.value, so the selection itself
  // is not readable here. What is checkable is that the popup started, filled its
  // controls, and read the stored state into the switches.
  const theme = page.document.getElementById('darkTheme');
  assertEqual([...theme.querySelectorAll('option')].map(o => o.getAttribute('value')),
    ['auto', 'light', 'dark'], 'the popup offers the three theme choices');
  assertEqual(page.document.getElementById('tags').checked, true,
    'the popup shows the stored switch state');
  assertEqual(page.document.getElementById('edhrecUsage').checked, false,
    'and a switch that is off reads as off');
  assertEqual(page.document.getElementById('cardtraderPrices').checked, false,
    'and the optional features start off');
}

async function settingsPowerOnTest(dir) {
  console.log('smoke: the packaged settings page starts and fills its list');
  const html = fs.readFileSync(path.join(dir, 'src/ui/options.html'), 'utf8');
  const page = createPage({
    url: 'chrome-extension://smoke/options.html',
    html,
    state: { settingsLanguage: 'en', siteLanguage: 'en' }
  });
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(dir, file), 'utf8'), page.context, { filename: file }
  );

  // The scripts the page itself names, resolved the way a browser would resolve them.
  //
  // Listing them here by hand is how this run missed set-filters.js: the page had begun
  // to load it and the test had not, so the smoke test of the packaged settings page
  // died on an undefined property — in the one run whose whole job is to say the page
  // as shipped starts. The list comes from the markup for the same reason the card page's
  // comes from the manifest.
  const pageDir = 'src/ui';
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(match => match[1]);
  assert(scripts.includes('options.js'), 'the packaged page names its own script');
  assert(scripts.includes('../core/set-filters.js'),
    'and the model, which is a separate file the page cannot do without');
  for (const reference of scripts) {
    const file = path.posix.normalize(path.posix.join(pageDir, reference));
    assert(fs.existsSync(path.join(dir, file)), `${reference} is in the archive, as ${file}`);
    run(file);
    await tick();
  }

  const items = page.document.querySelectorAll('#formatList .format-item');
  assert(items.length === 18, `the settings page renders its format list (${items.length} of 18)`);
  assertEqual([...page.document.querySelectorAll('#settingsLanguage option')].map(o => o.getAttribute('value')),
    ['auto', 'ru', 'en'], 'the settings page offers the browser-following choice and both languages');
  // The button that opens a new tab must not sit on a page that is already in one.
  const openOptions = page.document.getElementById('openOptions');
  assert(openOptions, 'the settings page still offers the new-tab button where it helps');

  // The pictures behind the "?" — checked here on the page that ships, not only in the
  // unit test, because this is the one run against the packaged files. A "?" with no
  // picture behind it looks to a reader like a feature that does not work, and the
  // packaged page is what a reviewer opens.
  const buttons = [...page.document.querySelectorAll('.shot-button')];
  assert(buttons.length >= 6, `the settings page carries a "?" per illustrated section (${buttons.length})`);
  const dialog = page.document.getElementById('shotDialog');
  assert(dialog, 'and a dialog to show the picture in');
  for (const button of buttons) {
    const name = button.getAttribute('data-shot');
    assert(name, 'every "?" names the picture it opens');
    assert(!button.disabled, `the "?" for ${name} is not disabled`);
  }
  if (typeof dialog.showModal === 'function') {
    buttons[0].click();
    await tick();
    const image = page.document.getElementById('shotImage');
    const caption = page.document.getElementById('shotCaption');
    assert(/\/assets\/shots\/.+\.png$/.test(image.getAttribute('src') || ''),
      'and clicking a "?" puts a picture in the dialog');
    assert((caption.textContent || '').length > 10, 'with its caption');
  } else {
    // The harness has no dialog, so the click cannot be exercised here. That is a
    // fact about the harness and not a pass: without this the strongest check in the
    // block would be skipped in every run and read as green.
    assert(!/showModal/.test(fs.readFileSync(path.join(dir, 'src/ui/options.js'), 'utf8')),
      'the script uses a dialog API the harness does not provide, so this run cannot ' +
      'test the click — teach testlib showModal rather than leaving this untested');
  }
}

// -----------------------------------------------------------------------------


// The two things the README was wrong about, both of them reported by a reader.
//
// Its picture was a 1280x4860 strip of the settings page — an unreadable sliver at the
// width a README is read at — and it was in Russian, because the settings page takes its
// language from storage or else from the browser, and the machine that took the capture
// is set to Russian. The store listing is English and the README is English, so the
// capture asks for English and has it stored; there is no other way to ask.
function documentationTest() {
  console.log('docs: the README shows pictures that exist, and the capture is in English');

  const readme = read('README.md');
  const shots = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]);
  assert(shots.length >= 3, `the README shows what the extension looks like (${shots.length} pictures)`);
  for (const file of shots) {
    assert(fs.existsSync(path.join(ROOT, file)), `the README's picture ${file} is in the repository`);
  }
  // A strip three times taller than it is wide reads as a line, not a picture.
  const full = path.join(ROOT, 'store-assets', 'settings-page-full.png');
  if (fs.existsSync(full)) {
    const buffer = fs.readFileSync(full);
    const height = buffer.readUInt32BE(20);
    const width = buffer.readUInt32BE(16);
    assert(height < width * 8, `the settings capture is a picture and not a strip (${width}x${height})`);
  }
  // The language is stored, not guessed: the page would otherwise take it from the
  // browser, which is how an English listing ended up with Russian screenshots.
  const tool = read('tools/make-store-shots.cjs');
  assert(/settingsLanguage:\s*LANGUAGE/.test(tool),
    'the store capture asks for a language instead of taking the browser\'s');
  assert(/const LANGUAGE = 'en'/.test(tool), 'and that language is English');
  // The "?" replaced the pictures in the page, so the README must not still describe
  // pictures sitting beside the switches.
  assert(!/beside a switch is the panel/.test(readme),
    'the README describes where the pictures actually are');
  // And the tall capture is not in the README. It is right for the store, where five
  // tiles have to come from one document, and unreadable in a README — and a page caches
  // an image by its path, so a reader can be looking at the previous one while the file
  // on disk is already correct.
  assert(!/settings-page-full\.png/.test(readme),
    'the README shows the settings page at a readable size, not the store capture');
  assert(fs.existsSync(path.join(ROOT, 'store-assets', 'readme-settings.png')),
    'and that picture exists');
}

// The store listing's screenshots, described against the pictures themselves.
//
// The listing says how big the capture is and names the five tiles. Both had gone stale
// while the capture itself was being kept current: the tiles were correct to the byte and
// the document said 1280x4896 over a capture that was 1280x4860. Nothing in the suite
// compared the two, because a document and a picture are different kinds of file and the
// checks had only ever read documents.
//
// What this cannot check is what each tile *shows*. Two rounds of refactoring moved the
// sections between the tiles and the descriptions went on describing where the sections
// used to be. That is said out loud, because a check that cannot catch everything about a
// thing should say so rather than be pointed at as if it could.
function storeShotsTest() {
  console.log('store: the listing describes the screenshots that exist');
  const listing = read('docs/CHROME_WEB_STORE_LISTING.md');
  const dir = path.join(ROOT, 'store-assets');
  const size = name => {
    const buffer = fs.readFileSync(path.join(dir, name));
    assertEqual(buffer.readUInt32BE(0), 0x89504e47, name + ' is a PNG');
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  };

  // The capture, and the height the document claims for it. Read out of the PNG rather
  // than out of a tool: the document is the thing being checked, so the picture has to be
  // the source of truth.
  const capture = size('settings-page-full.png');
  assertEqual(capture.width, 1280, 'the capture is 1280 wide, which is what the tiles are cut from');
  const claimed = listing.match(/settings-page-full\.png`?,\s*(\d+)[^\d]+(\d+)/);
  assert(claimed, "the listing states the capture's size");
  assertEqual(Number(claimed[1]), capture.width, 'and the width it states is the width it has');
  assertEqual(Number(claimed[2]), capture.height, 'and the height it states is the height it has');

  // The five tiles: every one named by the listing, and nothing named by it that is
  // not there. Counting the listing's references was wrong — it also refers to the full
  // capture, which lives in the same folder and is not a tile.
  const named = [...new Set([...listing.matchAll(/`(store-assets\/[^`]+\.png)`/g)].map(match => match[1]))];
  const onDisk = fs.readdirSync(dir).filter(name => name.endsWith('.png'))
    .map(name => 'store-assets/' + name);
  const tiles = onDisk.filter(file => /^store-assets\/0\d-/.test(file)).sort();
  assertEqual(tiles.length, 5, 'there are five store screenshots, which is all the store takes');
  for (const file of tiles) {
    assert(named.includes(file), `the listing names ${file}`);
    assertEqual(size(file.split('/').pop()).width, 1280, `${file} is 1280 wide`);
    assertEqual(size(file.split('/').pop()).height, 800, `${file} is 800 tall, which is what the store takes`);
  }
  for (const file of named) {
    assert(onDisk.includes(file), `the listing names ${file}, which exists`);
  }

  // The capture has to cover the page, or a tile is cut away from something. The floor is a
  // guard against a window-sized capture — about 1080 rows — rather than the page's height: the
  // height itself is asserted against the PNG where the listing states it, so this only has to
  // catch the case where the tool captured a viewport and called it a page. It was 4000, which
  // was the page's height when it was written and would now fail on a page that is genuinely
  // shorter — a threshold that tracks the thing it measures is not a threshold.
  assert(capture.height > 2000,
    'the capture is the whole page rather than a window of it (' + capture.height + ' px)');

  // The README's own picture is a different file for a different reader: one screen of
  // settings at a width that can be read, not a strip six times taller than it is wide.
  assert(fs.existsSync(path.join(dir, 'readme-settings.png')), 'the README picture exists');
  const readmeShot = size('readme-settings.png');
  assert(readmeShot.height <= 1200,
    'and the README picture is a screen, not the whole page (' + readmeShot.height + ' px)');
  assert(readmeShot.height < capture.height,
    'so the store capture and the README picture are not the same file twice');
}

// The documents agreeing with each other.
//
// This is the one class of check the project did not have, and it is the one that would
// have caught the defect a reader's review found: the notices file stated a decision and
// its own opposite in the same document, and the road map had settled a question the
// notices still listed as open. Every value in those documents was right. What was wrong
// was that two places said two different things about the same fact, which no test that
// reads one file can see.
function documentsAgreeTest() {
  console.log('docs: the documents do not contradict each other');
  const { problems, notes } = require('../tools/project-status.cjs').check();
  for (const problem of problems) assert(false, problem);
  assert(notes.length >= 5, `the project states its own facts in one place (${notes.length})`);
}

// Every host the manifest asks for, whether required or optional, as a bare
// hostname. Chrome shows this list to the user and the store asks about it in
// review, so what the code talks to and what the documents declare have to be the
// same set.
function declaredHosts(manifest) {
  const hosts = new Set();
  for (const origin of [...(manifest.host_permissions || []), ...(manifest.optional_host_permissions || [])]) {
    try { hosts.add(new URL(origin).hostname); } catch (e) { /* not an origin: nothing to name */ }
  }
  return [...hosts].sort();
}

// from, and every licence that third-party material requires is kept verbatim.
function packagedNoticesTest() {
  console.log('package: third-party notices ship with the extension');
  const manifest = JSON.parse(read('manifest.json'));
  const shipped = [
    'manifest.json', 'src/background/worker.js', 'src/card-page/core.js', 'src/card-page/clipboard.js',
    'src/card-page/tags.js', 'src/card-page/legalities.js', 'src/card-page/prints.js', 'src/card-page/edhrec.js',
    'src/card-page/prices.js', 'src/card-page/sets.js', 'src/card-page/card.js', 'src/card-page/deck-lists.js',
    'src/styles/content.css', 'src/core/theme.js',
    'src/styles/theme/01-card-page.css', 'src/styles/theme/02-shared-pages.css', 'src/styles/theme/03-account-and-marketing.css', 'src/styles/theme/04-surfaces.css', 'src/styles/theme/05-tagger.css', 'src/styles/theme/06-shared-surfaces.css', 'src/styles/theme/07-our-own-ui.css',
    'src/ui/options.html', 'src/ui/options.js', 'src/ui/options.css', 'src/core/i18n.js', 'src/core/tag-icons.js', 'src/card-page/tagger-clipboard.js',
    'src/core/format-catalog.js', 'src/core/format-overrides.js', 'assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js',
    'assets/data/illustration-tags-2.js', 'assets/data/set-platforms.js',
    'THIRD_PARTY_NOTICES.md', 'LICENSE', 'README.md', 'PRIVACY.md'
  ];
  for (const file of shipped) {
    assert(fs.existsSync(path.join(ROOT, file)), `${file} is part of the extension and is present`);
  }
  // Every file the manifest loads has to exist, and every loaded data file has to
  // say where it came from.
  for (const entry of manifest.content_scripts) {
    for (const file of [...(entry.js || []), ...(entry.css || [])]) {
      assert(fs.existsSync(path.join(ROOT, file)), `manifest loads ${file} and it exists`);
    }
  }
  for (const script of manifest.background ? [manifest.background.service_worker] : []) {
    assert(fs.existsSync(path.join(ROOT, script)), `service worker ${script} exists`);
  }
  const notice = read('THIRD_PARTY_NOTICES.md');
  for (const source of [
    'https://github.com/JacobHearst/CardClip', 'https://github.com/Paruhas/CardClip',
    'https://github.com/crookedneighbor/shambleshark', 'https://github.com/natefinch/moxtags',
    'https://github.com/notsonic/scryfall-enhancements', 'https://scryfall.com/',
    'https://tagger.scryfall.com/', 'https://www.edhrec.com/', 'https://www.cardtrader.com/',
    'https://www.cardmarket.com/', 'https://github.com/WebReflection/linkedom'
  ]) assert(notice.includes(source), `notices link ${source}`);
  assert(/not produced, endorsed, sponsored or\s+approved by/i.test(notice),
    'the notices state that nothing here is an official product');
  // The privacy policy and the store listing are filled in from the manifest, by
  // hand, and a host added in a later version leaves both quietly wrong. Chrome
  // shows a user the permission list and the store asks about it in review, so a
  // host the code talks to but no document mentions is a real problem: it is how
  // a permission appears that nobody declared.
  //
  // The deck suggestions are what made this bite: `edhrec.com` was added to the
  // manifest, and the listing still said five hosts and offered no text for it.
  for (const [file, label] of [['PRIVACY.md', 'privacy policy'], ['docs/CHROME_WEB_STORE_LISTING.md', 'store listing']]) {
    const text = read(file);
    for (const host of declaredHosts(manifest)) {
      assert(text.includes(host), `${label} names ${host}, which the manifest asks for`);
    }
  }
  // The counts, which are easy to leave behind when a host is added. The listing
  // spells the number out, because it is prose the reviewer reads.
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const count = declaredHosts(manifest).length;
  const listing = read('docs/CHROME_WEB_STORE_LISTING.md');
  const readme = read('README.md');
  assert(listing.includes('limited to ' + words[count] + ' hosts'),
    `the store listing says how many hosts there are (${words[count]})`);

  // The README lists the tools in the deck editor. The fourth was ported and then
  // removed, and the count went with it — the table said "four" and then described
  // three, which is the kind of thing a reader notices.
  const deckRow = readme.split('\n').find(line => line.includes('In the deck editor'));
  assert(deckRow && /^\|\s+\*\*In the deck editor\*\*\s+\|\s+Three more tools/.test(deckRow),
    'the README counts the deck editor tools it actually ships');
  const privacy = read('PRIVACY.md');
  assert(!/\b(five|six|seven) hosts\b/.test(privacy), 'the privacy policy states no host count that can go stale');

  // The DOM contract has to be current, or it is worse than nothing: it is the
  // place to look when Scryfall renames a class, and a stale one describes a page
  // that no longer exists.
  //
  // It went stale once already. The tool had its own list of scripts to scan and
  // that list named content.js; content.js was split into a core and nine feature
  // files, the tool skipped the one that was not there, and it went on writing a
  // document describing a card page with none of the files that draw it. Nothing
  // noticed, because nothing ran it. So: it reads the manifest now, and this test
  // runs it and compares what comes out with what is committed.
  {
    const out = path.join(os.tmpdir(), `stk-dom-contract-${process.pid}.md`);
    fs.rmSync(out, { force: true });
    // Run the tool as it is. It writes where STK_CONTRACT_OUT says, so the
    // comparison is against its real output and not against a rewrite of its
    // source that happens to behave the same.
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'dom-contract.cjs')], {
      encoding: 'utf8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, STK_CONTRACT_OUT: out }
    });
    const fresh = fs.readFileSync(out, 'utf8');
    fs.rmSync(out, { force: true });

    const committed = read('docs/scryfall-dom.md');

    // Reported as the line that differs, not as the two documents. Both are about four
    // hundred lines, and a failure that prints both of them to say that one row
    // changed is a failure nobody reads — and a check whose report is unreadable is
    // a check that gets skipped past.
    if (fresh !== committed) {
      const produced = fresh.split(/\r?\n/);
      const stored = committed.split(/\r?\n/);
      const first = produced.findIndex((line, i) => line !== stored[i]);
      const where = first < 0
        ? 'the committed document has ' + (stored.length - produced.length) + ' extra line(s) at the end'
        : 'line ' + (first + 1);
      console.error('  the contract is out of date at ' + where);
      console.error('    the tool produces: ' + JSON.stringify((produced[first] || '').slice(0, 100)));
      console.error('    the document has:  ' + JSON.stringify((stored[first] || '').slice(0, 100)));
      console.error('    fix: node tools/dom-contract.cjs');
    }
    assert(fresh === committed,
      'the DOM contract in docs is what the tool produces from the current source');

    // And it must describe the card page as it is now, not as it was. A file that
    // reaches for a class of Scryfall's own is a file whose selectors break when
    // Scryfall renames it, and those are the ones the contract exists to list.
    const ours = ['stk-', 'modal-dialog', 'button-n', 'tiny-n', 'tooltip-', 'data-heading-'];
    const shipped = JSON.parse(read('manifest.json')).content_scripts
      .flatMap(entry => entry.js || [])
      .filter(file => file.startsWith('content-'));
    const silent = [];
    for (const file of shipped) {
      const text = read(file);
      const queries = [...text.matchAll(/querySelector(?:All)?\(\s*['"`]([^'"`]+)['"`]/g)]
        .map(m => m[1]);
      // Only the selectors that name something of Scryfall's, and not one of ours.
      const theirs = queries.some(q => /[.#][a-zA-Z]/.test(q) && !ours.some(o => q.includes(o)));
      if (theirs && !committed.includes(file)) silent.push(file);
    }
    assertEqual(silent, [],
      'every shipped feature that queries the page is named in the contract');
    assert(!/(^|[^\w-])content\.js([^\w-]|$)/.test(committed),
      'and the contract does not still describe content.js, which is not a file any more');

    assert(!committed.includes('src/styles/theme.css'),
      'nor the single stylesheet it replaced, which is seven files now');
  }

  // The Part column is the answer the split was made for: one class name, one file
  // to open. Generated is not the same as checked, and an unchecked column is a
  // column that goes quietly wrong the moment a rule moves between parts.
  {
    const contract = read('docs/scryfall-dom.md');
    const dir = 'src/styles/theme';
    const parts = fs.readdirSync(path.join(ROOT, dir)).filter(n => n.endsWith('.css')).sort();
    const names = parts.map(name => name.replace(/\.css$/, ''));
    const uses = new Map();
    for (const name of parts) {
      const text = read(dir + '/' + name).replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
        for (const c of m[1].matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
          if (c[1].startsWith('stk-')) continue;
          if (!uses.has(c[1])) uses.set(c[1], new Set());
          uses.get(c[1]).add(name.replace(/\.css$/, ''));
        }
      }
    }
    const wrong = [];
    const unnamed = [];
    for (const m of contract.matchAll(
      /^\| `\.([a-zA-Z][a-zA-Z0-9_-]*)` \| \d+ \| (.*?) \|$/gm)) {
      const [, cls, column] = m;
      const said = [...column.matchAll(/`([^`]+)`/g)].map(hit => hit[1]).sort();
      const actual = [...(uses.get(cls) || [])].sort();
      if (!actual.length) continue;
      if (!said.length) { unnamed.push(cls + ' names no part'); }
      else if (said.join() !== actual.join()) {
        wrong.push(cls + ': the document says ' + said.join(', ') +
          ' and it is in ' + actual.join(', '));
      }
      for (const part of said) {
        if (!names.includes(part)) unnamed.push(cls + ' names a part that does not exist: ' + part);
      }
    }
    assertEqual(wrong, [], 'the contract names the right part for every class it lists');
    assertEqual(unnamed, [], 'and every part it names is one of the seven files');
  }

  // The card page is a core and nine feature files, and the two things that make
  // that work are easy to undo by accident: a feature that destructures the
  // context at load time instead of waiting for it gets undefined for everything,
  // and a boot that runs before the features have registered silently skips
  // whichever one had not been given its turn. Neither shows up as an error.
  {
    const core = read('src/card-page/core.js');
    assert(core.includes('self.STK_CONTENT = { on, reportFeature, context: arrived }'),
      'the core publishes its context as a promise, so a feature cannot read it too early');
    assert(/setTimeout\(\(\) => \{[\s\S]*booted = true/.test(core),
      'and waits a macrotask before the boot, so every feature file has registered by then');
    const manifestOrder = JSON.parse(read('manifest.json')).content_scripts
      .flatMap(entry => entry.js || [])
      .filter(file => file.startsWith('src/card-page/'));
    assertEqual(manifestOrder[0], 'src/card-page/core.js', 'the core is injected before the features that read it');
    // Only the files that read the core are bound by this. tagger-clipboard.js is
    // injected beside i18n.js on the Tagger site and has no part in the card page,
    // so there is no context for it to wait for.
    for (const file of manifestOrder.slice(1)) {
      const text = read(file);
      if (text.indexOf('self.STK_CONTENT') < 0) continue;
      assert(text.includes('} = await self.STK_CONTENT.context;'),
        file + ' waits for the context rather than destructuring it at load time');
      assert(!/^\s*const \{[^}]*\} = self\.STK_CONTENT;/m.test(text),
        file + ' has no other, load-time read of the core');
    }
    // Every step in the boot is registered, and every registration is in the boot.
    // The generator checks this too; a test checks it after the files are edited.
    const bootSteps = [...core.matchAll(/^\s{4}\["([A-Za-z]+)", \(\) =>/gm)].map(m => m[1]);
    const registered = manifestOrder.slice(1)
      .flatMap(file => [...read(file).matchAll(/STK_CONTENT\.on\("([A-Za-z]+)"/g)].map(m => m[1]));
    assert(bootSteps.length >= 15, 'the boot names every feature the old file started (' + bootSteps.length + ')');
    assertEqual(bootSteps.filter(step => !registered.includes(step)), [],
      'every step in the boot has a feature file registering for it');
    assertEqual(registered.filter(step => !bootSteps.includes(step)), [],
      'and no feature file registers a step the boot does not run');
    // One feature failing must not stop the ones below it. Before the split a
    // throw in the boot took every later feature with it.
    assert(core.includes('.catch(error => reportFeature(step, error))'),
      'a feature that throws is reported and the rest still run');
  }

  // The licence text of each project whose material is actually in the archive.
  const licences = {
    'assets/licences/CardClip-LICENSE': 'Copyright (c) 2022 Jacob Hearst',
    'assets/licences/Paruhas-CardClip-LICENSE': 'Copyright (c) 2022 Jacob Hearst',
    'assets/licences/Shambleshark-LICENSE': 'Copyright (c) 2016 Samuel Simões',
    'assets/licences/MoxTags-LICENSE': 'Copyright (c) 2026 Nate Finch',
    'assets/licences/MTG-Enhancements-LICENSE': 'Copyright (c) 2026 notsonic'
  };
  for (const [file, noticeLine] of Object.entries(licences)) {
    assert(fs.existsSync(path.join(ROOT, file)), `${file} ships with the extension`);
    const text = read(file);
    assert(text.includes(noticeLine), `${file} keeps the copyright line "${noticeLine}"`);
    assert(/Permission is hereby granted, free of charge/.test(text), `${file} keeps the full MIT permission text`);
    assert(notice.includes(file), `the notices point at ${file}`);
  }
  // Data copied from another project names its source, author, version and licence
  // in the file itself, not only in the notices document.
  for (const file of ['assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js', 'assets/data/illustration-tags-2.js']) {
    const head = read(file).slice(0, 600);
    for (const statement of ['MoxTags v1.8.3', 'natefinch/moxtags', 'Copyright (c) 2026 Nate Finch', 'MIT']) {
      assert(head.includes(statement), `${file} header states ${statement}`);
    }
  }
  // The header is not the data. Every check above reads the first 600 bytes, so a truncated
  // payload, a re-encoded one or a hand-edited entry would pass all of them and the tag
  // panels would quietly show fewer tags. The platform snapshot was the same shape of hole —
  // checked by nobody at all — so the payload is checked here on its own terms.
  //
  // These files are compact indexes: `t` is the list of tag names and `d` maps a UUID to
  // positions in it, which is what `lookup` in the worker reads. So the properties worth
  // asserting are the ones that format needs: names present and sorted, no duplicates, every
  // position inside the list, and the two halves of the art index disjoint so no card is
  // found twice or missed once.
  {
    const parse = file => {
      const text = read(file);
      const at = text.indexOf('self.__');
      return JSON.parse(text.slice(text.indexOf('=', at) + 1).replace(/;\s*$/, ''));
    };
    const indexes = {
      oracle: parse('assets/data/oracle-tags.js'),
      art1: parse('assets/data/illustration-tags-1.js'),
      art2: parse('assets/data/illustration-tags-2.js')
    };
    for (const [label, index] of Object.entries(indexes)) {
      const names = index.t;
      assert(Array.isArray(names) && names.length > 1000,
        `${label}: the index carries a real list of tag names (${Array.isArray(names) ? names.length : 'none'})`);
      assertEqual(names.length - new Set(names).size, 0, `${label}: no tag name appears twice`);
      assertEqual(JSON.stringify(names), JSON.stringify(names.slice().sort()),
        `${label}: the names are sorted, so a lookup's order is the file's and not Scryfall's`);
      const entries = Object.entries(index.d || {});
      assert(entries.length > 10000, `${label}: the index has a real number of entries (${entries.length})`);
      assert(entries.every(([, tags]) => Array.isArray(tags)), `${label}: every entry is a list of positions`);
      let outside = 0;
      let total = 0;
      for (const [, tags] of entries) {
        for (const at of tags) {
          total += 1;
          if (!Number.isInteger(at) || at < 0 || at >= names.length) outside += 1;
        }
      }
      assert(total > 10000, `${label}: and a real number of assignments (${total})`);
      assertEqual(outside, 0,
        `${label}: every position is inside the name list, or a card's tag reads as undefined`);
    }
    // The art index is split in two to keep each file a size Chrome will load. A card with
    // an art tag must land in exactly one half.
    const ids1 = Object.keys(indexes.art1.d);
    const ids2 = new Set(Object.keys(indexes.art2.d));
    assertEqual(ids1.filter(id => ids2.has(id)).length, 0,
      'no illustration is in both halves of the art index');
    assert(ids1.length > 10000 && ids2.size > 10000,
      `and both halves carry their share (${ids1.length} and ${ids2.size})`);
    // Both halves name the same tags: they are one list split, not two lists.
    assertEqual(JSON.stringify(indexes.art1.t), JSON.stringify(indexes.art2.t),
      'both halves of the art index carry the same tag names');
  }
  // The derived Scryfall snapshot says what it is and when it was taken.
  const platforms = read('assets/data/set-platforms.js');
  // The date is not decorative: the file holds facts about Scryfall's sets as they stood on
  // that day, and a reader who finds an entry wrong needs to know which measurement to
  // re-run. It changed from 2026-09-25 to 2026-10-03 when every entry was re-read from a page
  // of printings instead of a single card, which is what corrected vma.
  assert(/Scryfall/.test(platforms) && /2026-10-03/.test(platforms),
    'the set-platform snapshot names its source and the date it was taken');
  assert(/page of the set's printings/.test(platforms),
    'and says how each entry was read, since reading one card is what got vma wrong');
  assert(!/oracle_text|printed_type|layout|watermark|image_uris/.test(platforms),
    'the bundled set-platform snapshot carries no Wizards card content, only set codes and platform names');
}


// and inspects the archive.
function packagedArchiveTest() {
  console.log('package: the built archive is complete');
  const out = path.join(os.tmpdir(), `stk-package-test-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  let output = '';
  let code = 0;
  try {
    output = execFileSync(process.execPath, [path.join(ROOT, 'package-extension.cjs')], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, STK_PACKAGE_OUT: out },
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    code = error.status === undefined ? 1 : error.status;
    output = String(error.stdout || '') + String(error.stderr || '');
  }
  for (const line of output.split('\n')) {
    if (/MISSING|references|FAILED|LEAKED|unexpected|archive:/.test(line)) console.log('   ' + line.trim());
  }
  assertEqual(code, 0, 'npm run package succeeds and reports no missing file');

  const manifest = JSON.parse(read('manifest.json'));
  const zip = path.join(out, `scryfall-toolkit-${manifest.version}.zip`);
  assert(fs.existsSync(zip), `the build produced scryfall-toolkit-${manifest.version}.zip`);
  const listed = listZip(zip);

  // The exact regression: the settings page must bring its own styles and script.
  for (const file of ['src/ui/options.html', 'src/ui/options.css', 'src/ui/options.js', 'src/ui/popup.html', 'src/ui/popup.css', 'src/ui/popup.js', 'src/core/i18n.js', 'src/core/format-catalog.js', 'src/core/set-filters.js']) {
    assert(listed.includes(file), `${file} is inside the archive, so no page ships bare`);
  }
  // And the second: the tag snapshot is named through a map in background.js
  // rather than a literal, and a walker that only read literals let it leave the
  // archive -- a 143 KB package with no tags in it.
  for (const file of ['assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js', 'assets/data/illustration-tags-2.js']) {
    assert(listed.includes(file), `${file} is inside the archive, so the tag panels have data`);
  }
  const tagBytes = ['assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js', 'assets/data/illustration-tags-2.js']
    .reduce((sum, file) => sum + fs.statSync(path.join(ROOT, file)).size, 0);
  assert(tagBytes > 10 * 1024 * 1024, 'the bundled tag snapshot is the size it should be');
  // Whatever the manifest names has to be in the archive. This is what let the
  // popup go missing: the manifest was read for content scripts and options_page
  // but not for action.default_popup.
  const named = [];
  for (const entry of manifest.content_scripts || []) named.push(...(entry.js || []), ...(entry.css || []));
  if (manifest.background && manifest.background.service_worker) named.push(manifest.background.service_worker);
  if (manifest.options_page) named.push(manifest.options_page);
  if (manifest.action) {
    if (manifest.action.default_popup) named.push(manifest.action.default_popup);
    if (manifest.action.default_icon) named.push(...Object.values(manifest.action.default_icon));
  }
  named.push(...Object.values(manifest.icons || {}));
  for (const file of named) {
    assert(listed.includes(file), `the manifest names ${file}, which is inside the archive`);
  }
  // Every script and stylesheet a packaged page names must travel with it.
  //
  // A page's references are relative to the page, so they are resolved rather
  // than compared as written: options.html sits in src/ui/ and says "options.css"
  // where it is beside it, and the archive holds src/ui/options.css.
  for (const file of listed.filter(name => /\.html$/.test(name))) {
    const html = read(file);
    const dir = path.posix.dirname(file.split(path.sep).join('/'));
    for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const written = m[1];
      if (written.startsWith('http') || written.startsWith('data:')) continue;
      const name = path.posix.normalize(path.posix.join(dir, written));
      assert(!name.startsWith('..'), `${file} does not reference outside the extension: ${written}`);
      assert(listed.includes(name), `${file} references ${written}, which is ${name} in the archive`);
    }
  }
  // The illustrations, and the third way a reference can go missing.
  //
  // An <img> in the page brought them along: the walker reads src attributes. Then
  // the pictures moved behind the "?" and into a dialog, and the only place a name
  // appeared was a string in options.js — which the walker reads, but only from the
  // root of the extension, and these are written "../../assets/shots/x.png". The
  // archive built without all six, reported itself complete, and shipped a settings
  // page whose buttons open nothing.
  //
  // So this reads the names the way the script will hand them to the <img>: out of the
  // file, resolved against the file's own folder, and then asks the archive.
  const optionsScript = listed.includes('src/ui/options.js') ? 'src/ui/options.js' : null;
  assert(optionsScript, 'the settings script is in the archive, or there is nothing to check');
  const shotsDir = path.posix.dirname(optionsScript.split(path.sep).join('/'));
  const shotNames = [...read(optionsScript).matchAll(/src:\s*["']([^"']+\.png)["']/g)].map(m => m[1]);
  assert(shotNames.length >= 6, `the settings script names the illustrations (${shotNames.length})`);
  for (const written of shotNames) {
    const name = path.posix.normalize(path.posix.join(shotsDir, written));
    assert(!name.startsWith('..'), `the illustrations are not named outside the extension: ${written}`);
    assert(listed.includes(name), `${written}, which is ${name}, is inside the archive`);
  }
  fs.rmSync(out, { recursive: true, force: true });
}

// The toolbar popup is a compact view of the same settings the full page edits.
// It has to reach for the same keys, or the two views will disagree and the user
// will not know which one is true.

(async () => {
  try {
    const dir = buildArchive();
    packagedNoticesTest(dir);
    packagedArchiveTest(dir);
    scriptsParseTest(dir);
    pagesAreCompleteTest(dir);
    documentationTest();
    storeShotsTest();
    documentsAgreeTest();
    await themeTurnsOnTest(dir);
    await popupPowersOnTest(dir);
    await settingsPowerOnTest(dir);
    summary('test-package');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
