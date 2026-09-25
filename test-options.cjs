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
'use strict';
// options.js tests: format list rendering, visibility, keyboard and drag
// reorder, setting persistence and language switching.
const fs = require('node:fs');
const path = require('node:path');
const {
  assert, assertEqual, summary, createPage, click, keyDown, fireEvent,
  dataTransferObject, ROOT
} = require('./testlib.cjs');

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

const REQUIRED_IDS = [
  'status', 'formatList', 'openOptions', 'cardtraderToken', 'tokenStatus',
  'cardtraderTokenLabel', 'saveToken', 'removeToken', 'settingsLanguage',
  'siteLanguage', 'usageColorMetric', 'usageCountThresholds',
  'usagePercentThresholds', 'usageMediumDecks', 'usageHighDecks',
  'usageMediumPercent', 'usageHighPercent', 'saltMediumThreshold',
  'saltHighThreshold', 'clipboard', 'printAddButtons', 'printPageSameTab', 'darkTheme',
  'hideCasterIndicator', 'hideDigitalSets', 'hideNonTournamentSets',
  'hideOversizedSets', 'hideForeignBlackBorder', 'hideNonEnglishPrints',
  'tags', 'cardTags', 'artTags', 'relationships', 'finishBadges',
  'onlyCardmarket', 'cardtraderPrices', 'euroPriceSources', 'edhrecUsage',
  'edhrecSalt', 'showSaltScale', 'edhrecLink', 'edhrecUsageDisplay',
  'legalities', 'exportFormat', 'taggerSearchLinks', 'cardSearchLinks',
  'cardNicknames', 'deckNoPrices', 'stackedDeckCards', 'deckTokens',
  'setPlatformsAll', 'setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo',
  'printGrouping', 'printFoldGroups', 'printFullPageLink'
];

// What the archive ships is not the same as what the working tree holds, so the
// notices are checked against the file list the extension is actually packaged
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

function licenceAndPrivacyTest() {
  console.log('licensing: MPL-2.0 covers our code and nothing else');
  const licence = read('LICENSE');
  assert(licence.startsWith('Mozilla Public License Version 2.0'),
    'LICENSE holds the full official MPL-2.0 text');
  for (const clause of [
    '1. Definitions', '3.1. Distribution of Source Form', '3.2. Distribution of Executable Form',
    '10.2. Effect of New Versions', 'Exhibit A', 'Exhibit B',
    'https://mozilla.org/MPL/2.0/'
  ]) assert(licence.includes(clause), `the MPL text keeps "${clause}"`);
  assert(/"as is"/.test(licence) && /merchantable/.test(licence),
    'the MPL warranty disclaimer is present, in the wording Mozilla publishes');

  // Every file the project wrote carries the notice; no file copied from another
  // project does, because re-licensing someone else's MIT work would be wrong.
  const ours = [
    'background.js', 'content.js', 'content.css', 'theme.js', 'theme.css',
    'options.js', 'options.css', 'options.html', 'i18n.js', 'tag-icons.js',
    'tagger-clipboard.js', 'format-catalog.js', 'format-overrides.js',
    'data/set-platforms.js', 'testlib.cjs', 'test-preview.cjs', 'test-background.cjs',
    'test-options.cjs', 'test-theme.cjs', 'test-tagger.cjs', 'package-extension.cjs',
    'tools/render-icons.cjs'
  ];
  for (const file of ours) {
    const text = read(file);
    assert(text.includes('subject to the terms of the Mozilla Public'),
      `${file} carries the MPL-2.0 notice`);
    assert(text.includes('https://mozilla.org/MPL/2.0/'),
      `${file} points at the MPL text`);
    assert(text.includes('Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors'),
      `${file} names its copyright holder`);
  }
  const thirdParty = [
    'data/oracle-tags.js', 'data/illustration-tags-1.js', 'data/illustration-tags-2.js',
    'data/shambleshark-nicknames.js'
  ];
  for (const file of thirdParty) {
    assert(!read(file).includes('Mozilla Public License'),
      `${file} keeps its own MIT notice and is not re-licensed`);
  }
  // JSON cannot hold a comment, so those two are covered by the list in the README
  // and must not silently fall out of it.
  const readme = read('README.md');
  for (const file of ['manifest.json', 'package.json']) {
    assert(readme.includes(file), `the README's licence list names ${file}`);
  }
  assert(readme.includes('MPL-2.0'), 'the README states the project licence');

  console.log('licensing: the honest status of the third-party marks');
  const notices = read('THIRD_PARTY_NOTICES.md');
  assert(/MPL-2\.0 notice does \*{0,2}not\*{0,2}\s+cover[\s\S]{0,160}icons\/edhrec\.png/.test(notices),
    'the notices say the MPL does not cover the EDHREC mark');
  assert(/No permission was\s+requested from them and none was received/.test(notices),
    'the notices say plainly that no permission was requested or received');
  assert(/This extension is independent of Scryfall, EDHREC and CardTrader/.test(notices),
    'the notices state independence from Scryfall, EDHREC and CardTrader');
  assert((notices.match(/Unresolved/g) || []).length >= 3,
    'the notices keep the unresolved status of the brand marks instead of implying they are cleared');

  console.log('privacy: the policy describes the behaviour the code actually has');
  const privacy = read('PRIVACY.md');
  // The claims have to match the code, so each one is checked against the call sites.
  const background = read('background.js');
  assert(background.includes('json.edhrec.com/pages/cards/'),
    'the code really does call EDHREC');
  assert(/json\.edhrec\.com/.test(privacy) && /the card name, as part of the URL/i.test(privacy),
    'the policy says EDHREC receives the card name');
  assert(background.includes('api.cardtrader.com'),
    'the code really does call CardTrader');
  assert(/Authorization/.test(background) && /Bearer/.test(background),
    'the token really is sent as a bearer token');
  assert(/Bearer/.test(privacy) && /only\s+to CardTrader/i.test(privacy),
    'the policy says the token goes only to CardTrader');
  assert(background.includes("credentials: 'omit'") || background.includes('credentials:"omit"') ||
    /credentials:\s*'omit'/.test(background),
    'the code omits cookies on API requests, so the policy can say so');
  for (const service of ['api.scryfall.com', 'tagger.scryfall.com']) {
    assert(privacy.includes(service), `the policy names ${service}`);
    assert(background.includes(service), `and the code really calls ${service}`);
  }
  // The bulk-data host is only reached through the URL Scryfall hands back, so the
  // code has no literal for it; the manifest is what grants it.
  const manifest = JSON.parse(read('manifest.json'));
  assert((manifest.host_permissions || []).some(host => host.includes('data.scryfall.io')),
    'the manifest grants the Scryfall bulk-data host the policy names');
  assert((manifest.host_permissions || []).some(host => host.includes('json.edhrec.com')),
    'the manifest grants exactly the EDHREC host the policy names');
  assert((manifest.host_permissions || []).some(host => host.includes('api.cardtrader.com')),
    'the manifest grants exactly the CardTrader host the policy names');
  assert(!/analytics|telemetry|gtag|google-analytics|posthog|mixpanel|amplitude|sentry/i.test(
    [background, read('content.js'), read('options.js'), read('theme.js'), read('tagger-clipboard.js')].join('\n')),
    'the code contains no analytics or telemetry');
  assert(privacy.includes('We have no server'), 'the policy says where data would go if it were collected');
  assert(/cardtraderToken/.test(privacy) || /personal access token/i.test(privacy),
    'the policy covers the user token');
  // The extension must not load code from anywhere but itself.
  const optionsHtml = read('options.html');
  for (const tag of optionsHtml.matchAll(/<script[^>]*src="([^"]+)"/g)) {
    assert(!/^https?:/.test(tag[1]), `options.html loads only its own file: ${tag[1]}`);
  }
}

function iconArtworkTest() {
  console.log('artwork: the extension ships its own icons, drawn from source');
  const manifest = JSON.parse(read('manifest.json'));
  for (const size of ['16', '32', '48', '128']) {
    const file = manifest.icons && manifest.icons[size];
    assert(file, `manifest declares a ${size}px icon`);
    assert(fs.existsSync(path.join(ROOT, file)), `${file} exists`);
    const buf = fs.readFileSync(path.join(ROOT, file));
    assert(buf[0] === 0x89 && buf.slice(1, 4).toString('ascii') === 'PNG', `${file} is a PNG`);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    assertEqual([width, height], [Number(size), Number(size)], `${file} is exactly ${size} by ${size}`);
  }
  for (const size of ['16', '32', '48']) {
    const file = manifest.action.default_icon && manifest.action.default_icon[size];
    assert(file && fs.existsSync(path.join(ROOT, file)), `the toolbar button has a ${size}px icon`);
  }
  // The artwork is this project's own: the store requires an icon, and reaching for
  // a service's logo to fill the gap would be exactly the wrong thing.
  for (const size of ['16', '32', '48', '128']) {
    assert(/^icons\/icon\d+\.png$/.test(manifest.icons[size]),
      `the ${size}px icon is this project's own file, not a third-party logo`);
  }
  assert(fs.existsSync(path.join(ROOT, 'icons-src', 'scryfall-toolkit-icon.svg')),
    'the vector source of the artwork ships with the extension');
  const source = read('icons-src/scryfall-toolkit-icon.svg');
  assert(source.includes('<svg') && source.includes('viewBox="0 0 128 128"'),
    'the icon source is a real SVG the rasteriser reads');
  assert(/original artwork|no third-party mark/i.test(source),
    'the icon source states that the artwork is original');
  // The generator must still reproduce what is shipped, so a future edit cannot
  // leave the PNGs out of step with the source.
  const generator = read('tools/render-icons.cjs');
  for (const statement of ['Scryfall Toolkit', 'Mozilla Public', 'SHAPES', 'SUPERSAMPLE']) {
    assert(generator.includes(statement), `the icon generator names ${statement}`);
  }
  assert(/EDHREC|CardTrader|Cardmarket/.test(generator) === true,
    'the generator says out loud which marks it deliberately does not use');
}

function htmlIdCheck() {
  console.log('options.html: element ids');
  const html = read('options.html');
  for (const id of REQUIRED_IDS) {
    assert(html.includes(`id="${id}"`), `options.html has #${id}`);
  }
}

function switchStyleTest() {
  console.log('options.css: checkboxes are drawn as switches');
  const css = read('options.css');
  assert(/input\[type=checkbox\]\s*\{[^}]*appearance:\s*none/.test(css), 'the native checkbox look is removed');
  assert(/input\[type=checkbox\]\s*\{[^}]*width:\s*40px[^}]*height:\s*22px/.test(css), 'the control is a pill of a fixed size');
  assert(/input\[type=checkbox\]\s*\{[^}]*background-image:\s*radial-gradient/.test(css),
    'the knob is a background of the input, because a pseudo-element on a form control never paints');
  assert(/input\[type=checkbox\]:checked\s*\{[^}]*background-image/.test(css), 'the checked state moves the knob');
  assert(/label:has\(> input\[type=checkbox\]\)\s*\{[^}]*display:\s*flex/.test(css), 'the label puts the switch in a row with its text');
  assert(/input\[type=checkbox\]:disabled\s*\{[^}]*opacity/.test(css), 'a locked switch is dimmed');
  assert(/fieldset:disabled\s*\{[^}]*opacity/.test(css), 'and so is a locked block');
}

function sectionOrderTest() {
  console.log('options.html: section order and grouping');
  const html = read('options.html');
  const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]);
  assertEqual(headings, ['Общее', 'Tags', 'CardClip', 'Издания', 'Скрытие лишнего', 'Дополнительная информация',
    'Легальность', 'Scryfall Deckbuilder', 'Экспериментальное', 'Авторы и сторонние проекты'],
    'sections follow the agreed order, with Experimental before the credits block');
  // The installed extension has to say out loud what it is not, and where the
  // full notices are, because a reviewer reads the settings page and not the repo.
  const credits = html.slice(html.indexOf('<section class="credits">'));
  for (const statement of [
    'не создано, не одобрено и не спонсировано',
    'CardClip (Jacob Hearst)',
    'MoxTags v1.8.3 (Nate Finch)',
    'Shambleshark (Samuel Simões, Blade Barringer)',
    'MTG Enhancements (notsonic)',
    'THIRD_PARTY_NOTICES.md',
    'third_party/'
  ]) assert(credits.includes(statement), `credits block states: ${statement}`);
  // Every control belongs to the section the user asked for.
  const sectionOf = id => {
    const at = html.indexOf(`id="${id}"`);
    const before = html.slice(0, at);
    const heading = [...before.matchAll(/<h2>([^<]+)<\/h2>/g)].pop();
    return heading ? heading[1] : null;
  };
  assertEqual(sectionOf('settingsLanguage'), 'Общее', 'the settings language sits in Общее');
  assertEqual(sectionOf('darkTheme'), 'Общее', 'the theme selector sits in Общее');
  assertEqual(sectionOf('tags'), 'Tags', 'card page tags got their own category');
  assertEqual(sectionOf('cardTags'), 'Tags', 'the tag kinds stay with the tag switch');
  assertEqual(sectionOf('taggerSearchLinks'), 'Tags', 'the Tagger link on search results stays in Tags');
  assertEqual(sectionOf('clipboard'), 'CardClip', 'the shared buffer moved to CardClip');
  assertEqual(sectionOf('exportFormat'), 'CardClip', 'the copy format stays in CardClip');
  assertEqual(sectionOf('printAddButtons'), 'CardClip', 'the per-printing plus button moved to CardClip');
  assertEqual(sectionOf('printGrouping'), 'Издания', 'the grouped prints table has its own category');
  assertEqual(sectionOf('printFoldGroups'), 'Издания', 'the fold line is configurable next to it');
  assertEqual(sectionOf('printFullPageLink'), 'Издания', 'the full-page link is configurable next to it');
  assertEqual(sectionOf('hideCasterIndicator'), 'Скрытие лишнего', 'the Caster indicator moved to Скрытие лишнего');
  assertEqual(sectionOf('onlyCardmarket'), 'Скрытие лишнего', 'hiding prices moved to Скрытие лишнего');
  assertEqual(sectionOf('hideNonEnglishPrints'), 'Скрытие лишнего', 'the set filters live in one category');
  assertEqual(sectionOf('setPlatformsAll'), 'Скрытие лишнего', 'the platform filter is nested under Скрытие лишнего');
  assert(html.indexOf('id="setPlatformsAll"') > html.indexOf('class="experimental-sub"'),
    'the platform filter sits inside the experimental sub-block');
  assertEqual(sectionOf('finishBadges'), 'Дополнительная информация', 'the finish column moved to Additional info');
  assertEqual(sectionOf('cardSearchLinks'), 'Дополнительная информация', 'type and mana search moved to Additional info');
  assertEqual(sectionOf('cardNicknames'), 'Дополнительная информация', 'card nicknames moved to Additional info');
  assertEqual(sectionOf('edhrecUsage'), 'Дополнительная информация', 'EDHREC is a sub-category of Additional info');
  assertEqual(sectionOf('cardtraderPrices'), 'Дополнительная информация', 'CardTrader is a sub-category of Additional info');
  assertEqual(sectionOf('deckTokens'), 'Scryfall Deckbuilder', 'deck options share one category');
  assertEqual(sectionOf('printPageSameTab'), 'Экспериментальное', 'the same-tab printings switch stays in Experimental');
  assertEqual(sectionOf('siteLanguage'), 'Экспериментальное', 'the site language selector moved to the bottom');
  assert(html.indexOf('id="siteLanguage"') > html.indexOf('id="deckTokens"'),
    'the site language selector is the last control of the page');
  // EDHREC and CardTrader are grouped, not separate sections of their own.
  const additional = html.slice(html.indexOf('<h2>Дополнительная информация</h2>'), html.indexOf('<h2>Легальность</h2>'));
  assertEqual([...additional.matchAll(/<legend>([^<]+)<\/legend>/g)].map(match => match[1]), ['EDHREC', 'CardTrader'],
    'EDHREC and CardTrader are labelled sub-categories inside Additional info');
}

function loadOptions(state) {
  const page = createPage({
    url: 'chrome-extension://scryfall-toolkit/options.html',
    html: read('options.html'),
    state
  });
  // linkedom does not implement <select>.value; give every select a working
  // value accessor so options.js can read and write selections.
  for (const select of page.document.querySelectorAll('select')) {
    let value = select.querySelector('option')?.value ?? '';
    Object.defineProperty(select, 'value', {
      configurable: true,
      get: () => value,
      set: next => { value = String(next); }
    });
  }
  page.script('i18n.js');
  page.script('format-catalog.js');
  page.script('options.js');
  return page;
}

async function formatListTest() {
  console.log('options.js: format list');
  const page = loadOptions({});
  const { document, mock } = page;

  const rows = [...document.querySelectorAll('#formatList .format-item')];
  const { STK_FORMAT_CATALOG } = page.context;
  assertEqual(rows.length, STK_FORMAT_CATALOG.length, 'one row per catalog format');
  assertEqual(rows[0].dataset.key, 'standard', 'first row follows catalog order');
  assert(rows[0].title.includes('Standard'), 'row title names the format');
  assertEqual(rows[0].querySelector('.handle').textContent, '⠿', 'drag handle rendered');
  assertEqual(rows[0].draggable, true, 'row is draggable');
  assertEqual(rows[0].getAttribute('tabindex'), '0', 'row is focusable');

  const standard = rows.find(row => row.dataset.key === 'standard');
  assertEqual(standard.querySelector('input[type="checkbox"]').checked, true,
    'standard is visible by default');
  const premodern = rows.find(row => row.dataset.key === 'premodern');
  assertEqual(premodern.querySelector('input[type="checkbox"]').checked, true,
    'extra formats follow their own setting default');

  // Visibility checkbox persists formatVisibility.
  const standardBox = standard.querySelector('input[type="checkbox"]');
  standardBox.checked = false;
  fireEvent(standardBox, 'change');
  assertEqual(mock.state.formatVisibility, { standard: false },
    'hiding a format persists to formatVisibility');
  assert(standard.classList.contains('is-hidden'), 'hidden row gets is-hidden');
  assertEqual(document.getElementById('status').textContent, 'Порядок и видимость сохранены',
    'status confirms the reorder/visibility save');

  // Re-hide for a deterministic reorder test below.
  standardBox.checked = true;
  fireEvent(standardBox, 'change');
  assert(!standard.classList.contains('is-hidden'), 're-checking shows the row again');

  // ArrowRight swaps with the next row.
  keyDown(standard, 'ArrowRight');
  assertEqual(mock.state.formatOrder.slice(0, 2), ['alchemy', 'standard'],
    'ArrowRight moves the row one slot forward');

  // Drag and drop reorders too.
  const orderAfterKeys = [...mock.state.formatOrder];
  const dt = dataTransferObject();
  const pioneer = document.querySelector('#formatList [data-key="pioneer"]');
  const modern = document.querySelector('#formatList [data-key="modern"]');
  fireEvent(pioneer, 'dragstart', { dataTransfer: dt });
  assertEqual(dt.store['text/plain'], 'pioneer', 'dragstart records the dragged format');
  fireEvent(modern, 'drop', { dataTransfer: dt });
  const expected = [...orderAfterKeys];
  expected.splice(expected.indexOf('pioneer'), 1);
  expected.splice(expected.indexOf('modern'), 0, 'pioneer');
  assertEqual(mock.state.formatOrder, expected, 'drop moves the row next to the target');
  assertEqual(document.getElementById('status').textContent, 'Порядок и видимость сохранены',
    'drop confirms the save');
}

async function settingsTest() {
  console.log('options.js: basic settings');
  const page = loadOptions({});
  const { document, mock } = page;

  const darkTheme = document.getElementById('darkTheme');
  assertEqual(darkTheme.value, 'auto', 'the theme follows the system until it is chosen by hand');
  darkTheme.value = 'dark';
  fireEvent(darkTheme, 'change');
  assertEqual(mock.state.darkTheme, 'dark', 'choosing the dark theme persists the mode as text');
  assertEqual(document.getElementById('status').textContent, 'Сохранено', 'save confirmed in Russian');

  const sameTab = document.getElementById('printPageSameTab');
  assertEqual(sameTab.checked, false, 'printPageSameTab starts unchecked');
  sameTab.checked = true;
  fireEvent(sameTab, 'change');
  assertEqual(mock.state.printPageSameTab, true, 'the same-tab printings link setting persists');

  const exportFormat = document.getElementById('exportFormat');
  assertEqual(exportFormat.value, 'moxfield', 'export format defaults to with-sets');
  exportFormat.value = 'names';
  fireEvent(exportFormat, 'change');
  assertEqual(mock.state.exportFormat, 'names', 'export format persists');

  click(document.getElementById('openOptions'));
  assertEqual(mock.openOptionsPageCalls.length, 1, 'openOptions opens the options page');
}

async function setPlatformsTest() {
  console.log('options.js: platform checkboxes');
  const page = loadOptions({});
  const { document, mock } = page;
  const all = document.getElementById('setPlatformsAll');
  const boxes = ['setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo']
    .map(id => document.getElementById(id));
  assertEqual([all.checked, ...boxes.map(box => box.checked)], [true, true, true, true],
    'every platform starts checked, so All is checked as well');

  boxes[1].checked = false;
  boxes[2].checked = false;
  fireEvent(boxes[1], 'change');
  assertEqual(mock.state.setPlatforms, ['paper'], 'leaving Paper alone is stored as the only platform');
  assertEqual(all.checked, false, 'All is cleared once a platform is dropped');

  all.checked = true;
  fireEvent(all, 'change');
  assertEqual(mock.state.setPlatforms, ['paper', 'arena', 'mtgo'], 'All restores every platform');

  boxes[0].checked = false;
  boxes[1].checked = false;
  boxes[2].checked = false;
  fireEvent(boxes[2], 'change');
  assertEqual(mock.state.setPlatforms, ['paper', 'arena', 'mtgo'],
    'dropping the last platform falls back to All instead of an empty list');
  assertEqual([all.checked, ...boxes.map(box => box.checked)], [true, true, true, true], 'and the boxes show it');

  const stored = loadOptions({ setPlatforms: ['mtgo'] });
  assertEqual(
    [stored.document.getElementById('setPlatformsAll').checked,
      ...['setPlatformsPaper', 'setPlatformsArena', 'setPlatformsMtgo'].map(id => stored.document.getElementById(id).checked)],
    [false, false, false, true],
    'a stored single-platform choice is restored'
  );
}

async function lockedDependentsTest() {
  console.log('options.js: master switches lock their own settings');
  const page = loadOptions({});
  const { document, mock } = page;
  const cardClip = document.getElementById('clipboard');
  const format = document.getElementById('exportFormat');
  const plus = document.getElementById('printAddButtons');
  assertEqual([format.disabled, plus.disabled], [false, false], 'CardClip on leaves its settings usable');

  cardClip.checked = false;
  fireEvent(cardClip, 'change');
  assertEqual([format.disabled, plus.disabled], [true, true], 'turning CardClip off locks the copy format and the plus button');
  assertEqual(mock.state.clipboard, false, 'the CardClip switch persists');
  cardClip.checked = true;
  fireEvent(cardClip, 'change');
  assertEqual([format.disabled, plus.disabled], [false, false], 'and turning it back on releases them');

  const tags = document.getElementById('tags');
  const kinds = document.querySelector('section fieldset');
  const taggerLink = document.getElementById('taggerSearchLinks');
  tags.checked = false;
  fireEvent(tags, 'change');
  assertEqual([document.getElementById('cardTags').disabled, document.getElementById('artTags').disabled,
    document.getElementById('relationships').disabled], [true, true, true], 'turning tags off locks their kinds');
  assertEqual(kinds.disabled, true, 'and the block around them');
  assertEqual(taggerLink.disabled, false, 'the Tagger link stays available on its own');
  assertEqual(taggerLink.checked, false, 'and keeps its own value');
}

async function themeModeTest() {
  console.log('options.js: theme mode');
  // Installations from before the three-way choice stored a boolean, so the
  // page has to show what that boolean meant.
  const legacy = loadOptions({ darkTheme: true });
  assertEqual(legacy.document.getElementById('darkTheme').value, 'dark', 'a stored true opens on the dark theme');
  const legacyLight = loadOptions({ darkTheme: false });
  assertEqual(legacyLight.document.getElementById('darkTheme').value, 'light', 'a stored false opens on the light theme');
  const stored = loadOptions({ darkTheme: 'light' });
  assertEqual(stored.document.getElementById('darkTheme').value, 'light', 'a stored mode is shown as it is');
}

async function languageTest() {
  console.log('options.js: settings language');
  const page = loadOptions({});
  const { document, mock } = page;
  assertEqual(document.documentElement.lang, 'ru', 'document language starts Russian');

  const settingsLanguage = document.getElementById('settingsLanguage');
  assertEqual(settingsLanguage.value, 'ru', 'language select starts Russian');
  settingsLanguage.value = 'en';
  fireEvent(settingsLanguage, 'change');
  assertEqual(mock.state.settingsLanguage, 'en', 'language choice persists');
  assertEqual(document.documentElement.lang, 'en', 'document language switches to English');
  assertEqual(document.getElementById('status').textContent, 'Saved', 'status is translated on the fly');
}

async function discoveredFormatsTest() {
  console.log('options.js: discovered formats');
  const page = loadOptions({ discoveredFormats: [{ key: 'myformat', label: 'My Format' }] });
  const { document } = page;
  const rows = [...document.querySelectorAll('#formatList .format-item')];
  const { STK_FORMAT_CATALOG } = page.context;
  assertEqual(rows.length, STK_FORMAT_CATALOG.length + 1, 'discovered formats add a row');
  const extra = rows.find(row => row.dataset.key === 'myformat');
  assert(extra, 'discovered format row rendered');
  assert(extra.textContent.includes('My Format'), 'discovered format shows its label');
}

(async () => {
  try {
    htmlIdCheck();
    switchStyleTest();
    sectionOrderTest();
    packagedNoticesTest();
    licenceAndPrivacyTest();
    iconArtworkTest();
    await formatListTest();
    await settingsTest();
    await setPlatformsTest();
    await themeModeTest();
    await lockedDependentsTest();
    await languageTest();
    await discoveredFormatsTest();
    summary('test-options');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
