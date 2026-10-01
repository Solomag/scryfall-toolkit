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
const { extractZip, listZip } = require('./tools/zip.cjs');
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
  assertEqual(pages.sort().join(','), 'options.html,popup.html',
    'the package ships exactly the two extension pages');
  for (const page of pages) {
    const html = fs.readFileSync(path.join(dir, page), 'utf8');
    for (const m of html.matchAll(/<(?:script|link|img)[^>]+(?:src|href)="([^"]+)"/gi)) {
      const name = m[1].replace(/^\.\//, '');
      if (name.startsWith('http') || name.startsWith('data:') || name.startsWith('chrome-extension:')) continue;
      assert(files.has(name), `${page} brings ${name} with it`);
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

  run('theme.js');
  await tick();
  const root = page.document.documentElement;
  assert(root.classList.contains('stk-dark'),
    'theme.js marks the page dark from the stored preference');
  assert(root.classList.contains('stk-account-page') === false,
    'and does not call a card page an account page');
}

async function popupPowersOnTest(dir) {
  console.log('smoke: the packaged popup starts and shows its switches');
  const html = fs.readFileSync(path.join(dir, 'popup.html'), 'utf8');
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

  run('i18n.js');
  await tick();
  run('popup.js');
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
  const html = fs.readFileSync(path.join(dir, 'options.html'), 'utf8');
  const page = createPage({
    url: 'chrome-extension://smoke/options.html',
    html,
    state: { settingsLanguage: 'en', siteLanguage: 'en' }
  });
  const run = file => vm.runInContext(
    fs.readFileSync(path.join(dir, file), 'utf8'), page.context, { filename: file }
  );

  run('i18n.js');
  await tick();
  run('format-catalog.js');
  await tick();
  run('options.js');
  await tick();

  const items = page.document.querySelectorAll('#formatList .format-item');
  assert(items.length === 18, `the settings page renders its format list (${items.length} of 18)`);
  assertEqual([...page.document.querySelectorAll('#settingsLanguage option')].map(o => o.getAttribute('value')),
    ['auto', 'ru', 'en'], 'the settings page offers the browser-following choice and both languages');
  // The button that opens a new tab must not sit on a page that is already in one.
  const openOptions = page.document.getElementById('openOptions');
  assert(openOptions, 'the settings page still offers the new-tab button where it helps');
}

// -----------------------------------------------------------------------------


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
    'manifest.json', 'background.js', 'content.js', 'content.css', 'theme.js', 'theme.css',
    'options.html', 'options.js', 'options.css', 'i18n.js', 'tag-icons.js', 'tagger-clipboard.js',
    'format-catalog.js', 'format-overrides.js', 'data/oracle-tags.js', 'data/illustration-tags-1.js',
    'data/illustration-tags-2.js', 'data/shambleshark-nicknames.js', 'data/set-platforms.js',
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

  // The licence text of each project whose material is actually in the archive.
  const licences = {
    'third_party/CardClip-LICENSE': 'Copyright (c) 2022 Jacob Hearst',
    'third_party/Paruhas-CardClip-LICENSE': 'Copyright (c) 2022 Jacob Hearst',
    'third_party/Shambleshark-LICENSE': 'Copyright (c) 2016 Samuel Simões',
    'third_party/MoxTags-LICENSE': 'Copyright (c) 2026 Nate Finch',
    'third_party/MTG-Enhancements-LICENSE': 'Copyright (c) 2026 notsonic'
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
  for (const file of ['data/oracle-tags.js', 'data/illustration-tags-1.js', 'data/illustration-tags-2.js']) {
    const head = read(file).slice(0, 600);
    for (const statement of ['MoxTags v1.8.3', 'natefinch/moxtags', 'Copyright (c) 2026 Nate Finch', 'MIT']) {
      assert(head.includes(statement), `${file} header states ${statement}`);
    }
  }
  const nicknames = read('data/shambleshark-nicknames.js').slice(0, 700);
  for (const statement of [
    'crookedneighbor/shambleshark', 'Samuel Sim\u00f5es', 'Blade Barringer', 'MIT', 'third_party/Shambleshark-LICENSE'
  ]) {
    assert(nicknames.includes(statement), `data/shambleshark-nicknames.js header states ${statement}`);
  }
  // The derived Scryfall snapshot says what it is and when it was taken.
  const platforms = read('data/set-platforms.js');
  assert(/Scryfall/.test(platforms) && /2026-09-25/.test(platforms),
    'the set-platform snapshot names its source and the date it was taken');
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
  for (const file of ['options.html', 'options.css', 'options.js', 'popup.html', 'popup.css', 'popup.js', 'i18n.js', 'format-catalog.js']) {
    assert(listed.includes(file), `${file} is inside the archive, so no page ships bare`);
  }
  // And the second: the tag snapshot is named through a map in background.js
  // rather than a literal, and a walker that only read literals let it leave the
  // archive -- a 143 KB package with no tags in it.
  for (const file of ['data/oracle-tags.js', 'data/illustration-tags-1.js', 'data/illustration-tags-2.js']) {
    assert(listed.includes(file), `${file} is inside the archive, so the tag panels have data`);
  }
  const tagBytes = ['data/oracle-tags.js', 'data/illustration-tags-1.js', 'data/illustration-tags-2.js']
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
  for (const file of listed.filter(name => /\.html$/.test(name))) {
    const html = read(file);
    for (const m of html.matchAll(/<(?:script|link)[^>]+(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
      const name = m[1].replace(/^\.\//, '');
      if (name.startsWith('http') || name.startsWith('data:')) continue;
      assert(listed.includes(name), `${file} references ${name}, which is inside the archive`);
    }
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
