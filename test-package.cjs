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
  execFileSync('tar', ['-xf', zip, '-C', unpacked], { cwd: ROOT });
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
    ['ru', 'en'], 'the settings page offers both settings languages');
  // The button that opens a new tab must not sit on a page that is already in one.
  const openOptions = page.document.getElementById('openOptions');
  assert(openOptions, 'the settings page still offers the new-tab button where it helps');
}

// -----------------------------------------------------------------------------

(async () => {
  try {
    const dir = buildArchive();
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
