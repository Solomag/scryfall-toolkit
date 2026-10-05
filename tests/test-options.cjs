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
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { listZip } = require('../tools/zip.cjs');
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
  'tags', 'cardTags', 'artTags', 'relationships', 'finishBadges',
  'cardtraderPrices', 'euroPriceSources', 'edhrecUsage',
  'edhrecSalt', 'showSaltScale', 'edhrecLink', 'edhrecUsageDisplay',
  'legalities', 'exportFormat', 'taggerSearchLinks', 'cardSearchLinks',
  'cardNicknames', 'deckNoPrices', 'stackedDeckCards', 'deckLegality',
  'deckCleanUpImprover', 'cleanUpLandsInSingleton', 'sortEntriesPrimary',
  'insertSortingHeadings', 'edhrecSuggestions', 'deckSearch',
  'deckModuleStatus', 'grantDeckHosts',
  'showPaper', 'showArena', 'showMtgo', 'paperDetails', 'paperPanel',
  'showNonTournament', 'showOversized', 'showNoEnglishSets',
  'showBorderFamilies', 'setBorderFamiliesList', 'nonEnglishMode',
  'areaPrints', 'areaSearch', 'areaSets',
  'setPrices', 'setCaster', 'setTokens',
  'printGrouping', 'printFoldGroups', 'printFullPageLink'
];

// The old flat keys are gone from the page, and this is what says so.
//
// They are not only gone from the markup: a control that still wrote one of them would
// look identical to the new one and quietly stop hiding anything, because nothing reads
// those keys any more. That is the exact failure of 1.1.1, where a setting was left
// drawing next to code that had stopped asking it anything.
const REMOVED_IDS = [
  'hideCasterIndicator', 'hideDigitalSets', 'hideNonTournamentSets', 'hideOversizedSets',
  'hideForeignBlackBorder', 'hideNonEnglishPrints', 'onlyCardmarket', 'deckTokens',
  'setFiltersEnabled', 'setsGroup', 'setPlatformsAll', 'setPlatformsPaper',
  'setPlatformsArena', 'setPlatformsMtgo', 'setNonTournament', 'setOversized',
  'setForeignOnly', 'setForeignBlackBorder', 'setForeignBlackBorderList',
  'setNonEnglish', 'setNonEnglishList', 'setPlatformsGroup'
];

// What the archive ships is not the same as what the working tree holds, so the
// notices are checked against the file list the extension is actually packaged
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
    'src/background/worker.js', 'src/card-page/core.js', 'src/card-page/clipboard.js', 'src/card-page/tags.js',
    'src/card-page/legalities.js', 'src/card-page/prints.js', 'src/card-page/edhrec.js', 'src/card-page/prices.js',
    'src/card-page/sets.js', 'src/card-page/card.js', 'src/card-page/deck-lists.js', 'src/styles/content.css',
    'src/core/theme.js',
    'src/styles/theme/01-card-page.css', 'src/styles/theme/02-shared-pages.css', 'src/styles/theme/03-account-and-marketing.css', 'src/styles/theme/04-surfaces.css', 'src/styles/theme/05-tagger.css', 'src/styles/theme/06-shared-surfaces.css', 'src/styles/theme/07-our-own-ui.css',
    'src/ui/options.js', 'src/ui/options.css', 'src/ui/options.html', 'src/core/i18n.js', 'src/core/tag-icons.js',
    'src/card-page/tagger-clipboard.js', 'src/core/format-catalog.js', 'src/core/format-overrides.js',
    'assets/data/set-platforms.js', 'tests/testlib.cjs', 'tests/test-preview.cjs', 'tests/test-background.cjs',
    'tests/test-options.cjs', 'tests/test-theme.cjs', 'tests/test-tagger.cjs', 'package-extension.cjs',
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
    'assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js', 'assets/data/illustration-tags-2.js',
    'assets/data/shambleshark-nicknames.js'
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
  // The model is ours and ships, so it is named where the other files of ours are.
  // It was missing from this list while it was only read by the card page, and a list
  // that a new file has to be added to by hand is a list that will be missed.
  for (const file of ['src/core/set-filters.js', 'src/core/clipboard-format.js']) {
    assert(read(file).includes('subject to the terms of the Mozilla Public'),
      `${file} carries the MPL-2.0 notice`);
  }

  console.log('licensing: the honest status of the third-party marks');
  const notices = read('THIRD_PARTY_NOTICES.md');
  assert(/MPL-2\.0 notice does \*{0,2}not\*{0,2}\s+cover[\s\S]{0,160}icons\/edhrec\.png/.test(notices),
    'the notices say the MPL does not cover the EDHREC mark');
// The marks are shipped, on nominative use, by a recorded decision. So what the
  // notices have to say is the basis, and what they must not say is that a permission
  // exists. A notice that says "unresolved" beside a file we ship is a document
  // telling a reader we use something we have no right to use.
  for (const mark of ['assets/icons/edhrec.png', 'assets/icons/cardtrader.svg']) {
    assert(notices.includes(mark), `the notices name ${mark}`);
  }
  assert(/have not asked for permission and\s+(?:have been granted|been given)\s+none/i.test(notices),
    'the notices say plainly that no permission was sought and none was granted');
  assert(!/permission (?:to redistribute it )?has been established\b/.test(notices),
    'and do not leave the old half-claim standing');
  assert(!/(licen[cs]ed|granted|permitted|cleared|approved) by (?:EDHREC|CardTrader)/i.test(notices),
    'and nowhere say a party granted or licensed the mark');
  assert(/to say whose data is (?:on screen|in the numbers)/i.test(notices) ||
         /naming the source of the numbers/i.test(notices) ||
         /to name the source of the numbers/i.test(notices),
    'and state the basis: the mark names whose data is on screen');
  assert(/This extension is independent of Scryfall, EDHREC and CardTrader/.test(notices),
    'the notices state independence from Scryfall, EDHREC and CardTrader');

  console.log('privacy: the policy describes the behaviour the code actually has');
  const privacy = read('PRIVACY.md');
  // The claims have to match the code, so each one is checked against the call sites.
  const background = read('src/background/worker.js');
  assert(background.includes('json.edhrec.com/pages/'),
    'the code really does call EDHREC');
  assert(/json\.edhrec\.com/.test(privacy) &&
    /card name or the commander name, as part of the URL/i.test(privacy),
    'the policy says EDHREC receives the card name');
  // Suggestions are the one feature that sends a deck rather than one card, so
  // the policy names the request and what it carries instead of a general
  // statement that would understate it.
  assert(/edhrec\.com\/api\/recs\//.test(privacy) && /the whole deck list/i.test(privacy),
    'and that EDHREC suggestions send the deck list, and say which request carries it');
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
  // EDHREC and CardTrader are optional features and so is their access: the
  // host is asked for when the switch goes on, not at install time.
  assert(!(manifest.host_permissions || []).some(host => host.includes('json.edhrec.com')),
    'the EDHREC host is not demanded at install');
  assert((manifest.optional_host_permissions || []).some(host => host.includes('json.edhrec.com')),
    'and is asked for when the EDHREC feature is turned on');
  assert(!(manifest.host_permissions || []).some(host => host.includes('api.cardtrader.com')),
    'the CardTrader host is not demanded at install');
  assert((manifest.optional_host_permissions || []).some(host => host.includes('api.cardtrader.com')),
    'and is asked for when the CardTrader feature is turned on');
  assert(!/analytics|telemetry|gtag|google-analytics|posthog|mixpanel|amplitude|sentry/i.test(
    [background, read('src/card-page/core.js'), read('src/card-page/prices.js'),
   read('src/ui/options.js'), read('src/core/theme.js'), read('src/card-page/tagger-clipboard.js')].join('\n')),
    'the code contains no analytics or telemetry');
  assert(privacy.includes('We have no server'), 'the policy says where data would go if it were collected');
  assert(/cardtraderToken/.test(privacy) || /personal access token/i.test(privacy),
    'the policy covers the user token');
  // The extension must not load code from anywhere but itself.
  const optionsHtml = read('src/ui/options.html');
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
    // Under assets/ with everything else that is not code. The pattern is anchored
    // so a renamed folder fails here rather than as a missing file in the archive.
    assert(/^assets\/icons\/icon\d+\.png$/.test(manifest.icons[size]),
      `the ${size}px icon is this project's own file, not a third-party logo`);
    assert(fs.existsSync(path.join(ROOT, manifest.icons[size])),
      `and ${manifest.icons[size]} is there`);
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

  // Now make the guarantee the comment above claims. Re-run the generator into a
  // scratch folder and compare the bytes with what ships.
  //
  // Checking that the generator mentions some words is not the same thing, and it was
  // the only check there was: the comment promised the PNGs could not drift from the
  // source, and nothing tested it. A hand-touched PNG, or a geometry change committed
  // without re-running the tool, leaves the two describing different artwork while
  // every existing assertion stays green. The icons are the one thing in this project
  // nobody looks at until it is wrong.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'stk-icons-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'render-icons.cjs'), scratch, scratch],
      { stdio: 'ignore' });
    for (const size of ['16', '32', '48', '128']) {
      const shipped = fs.readFileSync(path.join(ROOT, 'assets', 'icons', `icon${size}.png`));
      const rebuilt = fs.readFileSync(path.join(scratch, `icon${size}.png`));
      assert(shipped.equals(rebuilt),
        `icon${size}.png is byte for byte what the generator produces from the source`);
    }
  } finally {
    // A scratch folder left behind is a scratch folder nobody will clean up.
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  // The ground is Scryfall's darkest background, which is a colour value and not any
  // artwork of theirs. Said here so the next person editing the palette has to decide
  // to keep saying it rather than discovering the dependency from this file's palette.
  assert(/#16161d/.test(generator),
    'the generator says where the ground colour came from');

  // The mark has to be readable against its own ground, measured rather than looked at.
  //
  // These values were computed against the ground to clear 3:1 when they were chosen and
  // that promise was never checked.
  //
  // They are read out of the generator rather than written here, and that is the whole
  // trick. The first version of this check named the expected colours as literals in the
  // test, so it compared five constants with five constants, passed, and would have gone
  // on passing through any change to the palette - somebody could darken the bronze to
  // near the ground, regenerate the icons, and this test would still be measuring the
  // colours it had memorised. Six mutations were applied to the generator with the icons
  // regenerated each time and all six went through it.
  //
  // The numbers being asserted are the thing, so they come from the source. The rate
  // limits are read the same way for the same reason.
  const toLinear = value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const luminance = hex => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * toLinear((n >> 16) & 255)
      + 0.7152 * toLinear((n >> 8) & 255)
      + 0.0722 * toLinear(n & 255);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const named = constant => {
    const found = generator.match(new RegExp(`const ${constant} = '(#[0-9a-f]{6})';`, 'i'));
    assert(found, `the generator names ${constant} as a hex colour, so the palette can be read`);
    return found[1];
  };
  const ground = named('INK_GROUND');
  assert(luminance(ground) < 0.02, 'the ground is dark, which is what the mark was built for');
  // The comment at the top of the generator names the same colour in prose. A comment and
  // the constant beside it can drift apart silently, and a reader who trusts the comment
  // is then misled about where the colour came from - which is the one thing that comment
  // is for. So the two are checked against each other.
  const prose = generator.match(/ground is Scryfall's own darkest background, (#[0-9a-f]{6})/i);
  assert(prose, 'the generator says in prose which colour the ground is');
  assertEqual(prose[1], ground,
    'and the colour it names in prose is the one the artwork uses');

  // 3:1 is the bar, not 4.5: WCAG 1.4.11 asks 3:1 of a non-text part, and this is a
  // shape rather than text. The steel is held to 4.5 anyway because it is small, it is the
  // brightest thing in the mark, and it can afford to be pushed further.
  for (const constant of ['BRONZE', 'COPPER', 'WOOD']) {
    const colour = named(constant);
    const ratio = contrast(colour, ground);
    assert(ratio >= 3,
      `${constant} ${colour} reads against the ground ${ground} — ${ratio.toFixed(2)}:1, needs 3:1`);
  }
  for (const constant of ['STEEL', 'STEEL_DARK']) {
    const colour = named(constant);
    const ratio = contrast(colour, ground);
    assert(ratio >= 4.5,
      `${constant} ${colour} reads clearly against the ground — ${ratio.toFixed(2)}:1, needs 4.5:1`);
  }
}

// The 0.44.0 archive shipped options.html without options.css and options.js: the
// manifest names the page, but only the html itself was packaged, so the settings
// page arrived as bare markup with dead switches. The working tree always had the
// files, which is why checking the tree did not catch it. This builds the archive
function popupTest() {
  console.log('popup: compact controls, and the same settings as the full page');
  const manifest = JSON.parse(read('manifest.json'));
  assertEqual(manifest.action.default_popup, 'src/ui/popup.html',
    'the toolbar button opens the small popup, not the whole settings page');
  assert(!/\(Preview\)/.test(manifest.name),
    'the name does not call a released extension a preview');
  assert(manifest.homepage_url === 'https://github.com/Solomag/scryfall-toolkit',
    'the manifest links the source repository');

  // A page's references are relative to the page, so the page is src/ui/popup.html
  // and says "popup.css" where it is beside it and "../core/i18n.js" where it is
  // one folder up. What matters is where the reference lands, not how it is
  // written — so it is resolved rather than compared as text.
  const html = read('src/ui/popup.html');
  const pageDir = 'src/ui';
  const resolves = reference => path.posix.normalize(path.posix.join(pageDir, reference));
  const referenced = [];
  for (const m of html.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) referenced.push(m[1]);
  for (const file of ['popup.css', 'popup.js', '../core/i18n.js']) {
    assert(referenced.includes(file), `popup.html says ${file} directly`);
    assert(fs.existsSync(path.join(ROOT, resolves(file))), `which is ${resolves(file)}, and it exists`);
  }
  // Two folders up, because the page is src/ui/popup.html.
  assert(referenced.includes('../../assets/icons/icon32.png'),
    'and it points at the toolbar icon, two folders up');
  assert(fs.existsSync(path.join(ROOT, resolves('../../assets/icons/icon32.png'))),
    'which is assets/icons/icon32.png, and it exists');
  for (const id of ['darkTheme', 'tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices', 'openAll']) {
    assert(html.includes(`id="${id}"`), `the popup has a control for ${id}`);
  }
  assert(/Открыть все настройки/.test(html),
    'the popup offers the full settings page');

  const popup = read('src/ui/popup.js');
  const options = read('src/ui/options.js');
  // Whatever the popup writes, the full page must write too.
  for (const key of ['darkTheme', 'tags', 'clipboard', 'edhrecUsage', 'cardtraderPrices']) {
    assert(popup.includes(`'${key}'`) || popup.includes(`"${key}"`),
      `the popup handles ${key}`);
    assert(options.includes(key),
      `the full settings page handles ${key} too, so the two cannot disagree`);
  }
  assert(/openOptionsPage\(\)/.test(popup),
    'the popup opens the real settings page rather than growing its own');

  // The settings page used to offer "open in a new tab" even when it was already
  // in one. Now that the popup is separate the page is always in a tab, and the
  // button hides itself instead of sitting there doing nothing.
  const page = read('src/ui/options.js');
  assert(/openOptions.*hidden\s*=\s*true|hidden\s*=\s*true.*openOptions/s.test(page),
    'the redundant "open in a new tab" button hides when the page is already in a tab');
  assert(/chrome\.tabs\.getCurrent/.test(page),
    'and it asks the browser where it is running before deciding');
}

// The settings language follows the browser. Russian, Belarusian and Ukrainian
// get the Russian interface; everything else gets English rather than a page
// that is neither.
// The choice and the outcome are different things and were being confused: the
// page showed the resolved language and saved it back, which turned Auto into a
// pinned language the first time anyone touched the select. This walks the whole
// chain rather than the pieces of it.
async function settingsLanguageChainTest() {
  console.log('settings: the language choice survives the round trip');
  const page = await loadOptions({ settingsLanguage: 'auto', siteLanguage: 'en' });
  const select = page.document.getElementById('settingsLanguage');
  assertEqual(select.value, 'auto', 'storage: auto shows as auto');

  // Choosing Auto again must store Auto, not what it resolves to right now.
  select.value = 'auto';
  fireEvent(select, 'change');
  // The request resolves on the next turn even when it is granted at once.
  await tick();
  assertEqual(page.mock.state.settingsLanguage, 'auto', 'choosing Auto stores Auto');

  // A pinned choice stores the choice and speaks its language.
  select.value = 'ru';
  fireEvent(select, 'change');
  assertEqual(page.mock.state.settingsLanguage, 'ru', 'choosing Russian stores Russian');

  select.value = 'en';
  fireEvent(select, 'change');
  assertEqual(page.mock.state.settingsLanguage, 'en', 'choosing English stores English');

  // And a reload of a pinned choice shows the pin, not its outcome.
  const pinned = await loadOptions({ settingsLanguage: 'en', siteLanguage: 'en' });
  assertEqual(pinned.document.getElementById('settingsLanguage').value, 'en',
    'a pinned choice is shown as pinned');
}


// Choosing CardTrader as the EUR source reaches api.cardtrader.com whether or not
// the CardTrader switch is on. It used to save without asking for the host, so a
// user could end up with a setting that looked on and reached nothing. This walks
// the flow rather than checking that the domain appears in the manifest.

// The old test began with every platform checked, so it never reached the case
// that broke: one platform left, and the user takes it away.
//
// It stores `setPlatforms`, which is now read by the migration rather than written by
// the page: a reader whose old switch is in storage has not been to the card page yet,
// and the settings page is the one place they are looking. So the case is set up the
// way such a reader's storage looks, and the answer is checked in the new key.
async function lastPlatformTest() {
  console.log('settings: the old platform whitelist migrates, and turning the last one off is kept');
  const page = await loadOptions({ setPlatforms: ['mtgo'] });
  await groupReady(page);
  const { document, mock } = page;
  const boxes = ['showPaper', 'showArena', 'showMtgo']
    .map(id => document.getElementById(id));

  assertEqual(boxes.map(box => box.checked), [false, false, true],
    'the old stored platform list is migrated into the only one shown');

  // The behaviour this test used to assert has been removed on purpose. There is no master
  // above these switches, so there is nothing to restore them and no state where the page
  // disagrees with storage: three boxes mean what they say.
  boxes[2].checked = false;
  fireEvent(boxes[2], 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms,
    { paper: false, arena: false, mtgo: false },
    'turning the last platform off is stored as that');
  assertEqual(boxes.map(box => box.checked), [false, false, false],
    'and the page shows that, rather than drawing all three and keeping one in storage');
  assertEqual(mock.state.setPlatforms, ['mtgo'],
    'and the old key is left alone rather than written over the reader\'s choice');

  const again = await loadOptions({ setFilters: mock.state.setFilters, setFiltersMigrated: true });
  await groupReady(again);
  assertEqual(
    ['showPaper', 'showArena', 'showMtgo']
      .map(id => again.document.getElementById(id).checked),
    [false, false, false], 'and a reload does not bring a platform back on its own');
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

async function optionalHostsTest() {
  console.log('settings: optional features ask for their host before saving');
  const page = await loadOptions({
    cardtraderPrices: false, euroPriceSources: 'cm',
    edhrecUsage: false, edhrecSalt: false, edhrecLink: false
  });
  const { document, mock } = page;
  const select = document.getElementById('euroPriceSources');

  // Choosing Cardmarket needs no host at all.
  select.value = 'cm';
  fireEvent(select, 'change');
  await tick();
  assertEqual(mock.permissions.grantedOrigins.length, 0,
    'the Cardmarket source asks for nothing');

  // Choosing CardTrader does.
  select.value = 'ct';
  fireEvent(select, 'change');
  await tick();
  assertEqual(mock.permissions.grantedOrigins, ['https://api.cardtrader.com/*'],
    'the CardTrader source asks for the CardTrader host');
  assertEqual(mock.state.euroPriceSources, 'ct', 'and the choice is saved once granted');

  // Both is the same case.
  select.value = 'both';
  fireEvent(select, 'change');
  await tick();
  assert(mock.permissions.grantedOrigins.includes('https://api.cardtrader.com/*'),
    '"both" is covered too');

  // And the EDHREC switches ask for EDHREC.
  const usage = document.getElementById('edhrecUsage');
  usage.checked = true;
  fireEvent(usage, 'change');
  await tick();
  // The request resolves on the next turn even when it is granted at once.
  await tick();
  assert(mock.permissions.grantedOrigins.includes('https://json.edhrec.com/*'),
    'the EDHREC switch asks for the EDHREC host');

  // Refusing the permission must not leave a setting saved that cannot work.
  const second = await loadOptions({
    cardtraderPrices: false, euroPriceSources: 'cm', edhrecUsage: false
  });
  second.mock.permissions.deny = true;
  const refused = second.document.getElementById('euroPriceSources');
  refused.value = 'ct';
  fireEvent(refused, 'change');
  await tick();
  // The request resolves on the next turn even when it is granted at once.
  await tick();
  assertEqual(second.mock.state.euroPriceSources, 'cm',
    'a refused permission leaves the previous source in storage');
  assertEqual(refused.value, 'cm', 'and the control goes back to it');
}


function settingsLanguageTest() {
  console.log('settings: the language follows the browser');
  const page = createPage({ url: 'https://scryfall.com/', html: '<!doctype html><html><body></body></html>', state: {} });
  page.script('src/core/i18n.js');
  const resolve = page.context.STK_I18N.resolveSettingsLanguage;
  const as = tags => {
    page.context.navigator.languages = tags;
    page.context.navigator.language = tags[0] || '';
    return resolve('auto');
  };

  for (const tag of ['ru', 'ru-RU', 'be', 'be-BY', 'uk', 'uk-UA']) {
    assertEqual(as([tag]), 'ru', `${tag} gets the Russian interface`);
  }
  for (const tag of ['en', 'en-US', 'de', 'de-DE', 'fr', 'ja', 'pt-BR', 'zh-CN', '']) {
    assertEqual(as([tag]), 'en', `${tag || '(empty)'} gets English`);
  }
  // A Russian browser with English pinned still gets English.
  assertEqual(as(['ru-RU']), 'ru', 'the browser language is used when nothing is pinned');
  page.context.navigator.languages = ['ru-RU'];
  assertEqual(resolve('en'), 'en', 'a pinned English stays English');
  assertEqual(resolve('ru'), 'ru', 'a pinned Russian stays Russian');
}

function htmlIdCheck() {
  console.log('options.html: element ids');
  const html = read('src/ui/options.html');
  for (const id of REQUIRED_IDS) {
    assert(html.includes(`id="${id}"`), `options.html has #${id}`);
  }
}

// Every Russian sentence the page shows must be in the dictionary.
//
// The English settings page is what a reviewer and a reader get, and a half-translated
// paragraph is worse than an untranslated one because it reads as a finished page. The
// page is written in Russian and translated by walking its text nodes afterwards, so the
// dictionary is the only thing standing between a new sentence and an English reader —
// and nothing about writing the sentence connects it to the dictionary.
//
// It happened while this was being built: a hint about how platforms are resolved was
// written with one wording and put into the dictionary with another. Every check was
// green, the store screenshots came out with that one paragraph in Russian, and it was
// only found by looking at the picture. A check over the page's own text catches it
// before anything is published.
function untranslatedTextTest() {
  console.log('options.html: every sentence on the page is in the dictionary');
  const html = read('src/ui/options.html');
  const i18n = read('src/core/i18n.js');
  // What a reader sees: the text of the page's own elements, minus the values of
  // attributes and minus anything inside a <script>, which is not shown.
  const visible = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(text => text.trim())
    // A bare option or value is a control's own word, and the ones that are not proper
    // nouns are short and covered by the test below anyway.
    .filter(text => text.length > 3);

  const missing = [];
  for (const text of new Set(visible)) {
    if (i18n.includes("'" + text.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'")) continue;
    // Not in the dictionary as a whole phrase. Either it is already English — a label
    // that says "Paper" or "CardClip" and needs no translation — or it is a sentence
    // nobody put in, and the difference between those two is the whole question.
    missing.push(/[Ѐ-ӿ]/.test(text) ? text : null);
  }
  const untranslated = missing.filter(Boolean);
  assertEqual(untranslated, [],
    'no Russian sentence on the page is missing from the dictionary (already-English labels are fine)');
}

// The same question for the strings options.js creates at run time rather than the ones
// written into the markup: the labels of the category lists, which come from the model.
//
// These are the worst case of the same defect, because nothing in the markup mentions
// them at all. A model label that is not in the dictionary is a checkbox with an
// untranslatable name beside it.
function modelLabelsTest() {
  console.log('options.js: the labels the model supplies are in the dictionary');
  const i18n = read('src/core/i18n.js');
  const filters = read('src/core/set-filters.js');
  // Read the labels out of the source rather than out of a vm: the same reason the rate
  // limits and the icon colours are read this way. A `const` inside a script run in a
  // context is not reachable from the test, and the strings are the thing being
  // asserted.
  const labels = ['FOREIGN_BLACK_BORDER', 'NON_ENGLISH_MODES', 'PRICE_KINDS']
    .flatMap(table => {
      const block = new RegExp(`const ${table} = \\{[\\s\\S]*?\\n  \\};`).exec(filters);
      assert(block, `the model still declares ${table}, so the labels can be found in it`);
      return [...block[0].matchAll(/label: '([^']+)'/g)].map(match => match[1]);
    });
  assert(labels.length >= 10, `the model's tables carry ${labels.length} labels to translate`);
  const untranslated = labels.filter(label => /[Ѐ-ӿ]/.test(label) && !i18n.includes("'" + label + "'"));
  assertEqual(untranslated, [],
    'every Russian label the model supplies is in the dictionary, so an English page is not half Russian');
}

function switchStyleTest() {
  console.log('options.css: checkboxes are drawn as switches');
  const css = read('src/ui/options.css');
  assert(/input\[type=checkbox\]\s*\{[^}]*appearance:\s*none/.test(css), 'the native checkbox look is removed');
  assert(/input\[type=checkbox\]\s*\{[^}]*width:\s*40px[^}]*height:\s*22px/.test(css), 'the control is a pill of a fixed size');
  assert(/input\[type=checkbox\]\s*\{[^}]*background-image:\s*radial-gradient/.test(css),
    'the knob is a background of the input, because a pseudo-element on a form control never paints');
  assert(/input\[type=checkbox\]:checked\s*\{[^}]*background-image/.test(css), 'the checked state moves the knob');
  assert(/label:has\(> input\[type=checkbox\]\)\s*\{[^}]*display:\s*flex/.test(css), 'the label puts the switch in a row with its text');
  assert(/input\[type=checkbox\]:disabled\s*\{[^}]*opacity/.test(css), 'a locked switch is dimmed');
  assert(/fieldset:disabled\s*\{[^}]*opacity/.test(css), 'and so is a locked block');
// The platform rows and the detail panel, which the new shape introduced. The switch has to
// keep its shape on a platform row — a pill is what tells a reader it is a switch and not a
// label — and the panel it opens has to sit inside the row above it rather than as another
// framed box, because the frame is what says "this is a group of settings" and nesting one
// inside another says it twice for no extra meaning.
assert(/\.platform-row\s*\{[^}]*display:\s*flex/.test(css),
  'a platform switch and its details button share one row');
assert(/\.platform-row>label\s*\{[^}]*display:\s*flex/.test(css),
  'and the switch on that row keeps the switch shape rather than becoming a plain label');
assert(/\.details-button\s*\{/.test(css),
  'the details button has a class of its own so it can shrink to its label');
assert(/\.sub-panel\s*\{[^}]*border:\s*0/.test(css),
  "Paper's detail panel has no frame of its own, so the switch above it is what says which platform it belongs to");
assert(/\.sub-panel\s*\{[^}]*border-left/.test(css),
  "and a rule down the side takes the frame's place, which reads as belonging to the row above");
}

function sectionOrderTest() {
  console.log('options.html: section order and grouping');
  const html = read('src/ui/options.html');
  const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]);
  assertEqual(headings, ['Общее', 'Tags', 'CardClip', 'Скрытие лишнего', 'Дополнительная информация',
    'Легальность', 'Scryfall Deckbuilder', 'Издания', 'Экспериментальное', 'Авторы и сторонние проекты'],
    'sections follow the agreed order, with the Prints group and Experimental before the credits block');
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
    'assets/licences/'
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
  // The visibility group: the three platforms, the areas, and the prices. There is no
  // master switch and no "all platforms" row, and both absences are checked — a control
  // that is only not in the markup by accident comes back the next time someone tidies up.
  assertEqual(sectionOf('showPaper'), 'Скрытие лишнего', 'the platforms live in the hiding category');
  assertEqual(sectionOf('showArena'), 'Скрытие лишнего', 'and so does the second one');
  assertEqual(sectionOf('showMtgo'), 'Скрытие лишнего', 'and the third');
  assertEqual(sectionOf('areaPrints'), 'Скрытие лишнего', 'the areas are one group of their own');
  assertEqual(sectionOf('areaSearch'), 'Скрытие лишнего', 'and all three of them are in it');
  assertEqual(sectionOf('areaSets'), 'Скрытие лишнего', 'including the sets list');
  assertEqual(sectionOf('setPrices'), 'Скрытие лишнего', 'the price switches are one group of their own');
  assertEqual(sectionOf('setCaster'), 'Скрытие лишнего', 'the Caster marker stays in Hide extras');
  assertEqual(sectionOf('setTokens'), 'Скрытие лишнего', 'and the deck tokens, which the model groups with them');
  assert(!html.includes('id="setFiltersEnabled"') && !html.includes('id="setPlatformsAll"'),
    'the master switch and the all-platforms row are both gone from the markup');
  // Paper's categories sit inside the panel its own button opens, and the areas sit outside
  // it — which is the whole arrangement: what is shown, then what is shown within Paper, then
  // where the rules apply.
  assert(html.indexOf('id="paperDetails"') < html.indexOf('id="showNonTournament"') &&
    html.indexOf('id="showNonTournament"') < html.indexOf('id="areaPrints"'),
    'Paper\'s detail categories are drawn after its button and before the areas');
  assert(html.indexOf('id="showPaper"') < html.indexOf('id="paperDetails"') &&
    html.indexOf('id="showArena"') < html.indexOf('id="areaPrints"'),
    'the platforms and their details are the first thing in the group');
  // Only Paper gets a details button. Arena and Magic Online have nothing to put behind one,
  // and a button that opens an empty panel is a promise this build cannot keep.
  assert(html.includes('id="paperDetails"'), 'Paper has a details button');
  assert(!html.includes('id="arenaDetails"') && !html.includes('id="mtgoDetails"'),
    'and the two digital platforms do not, because there is nothing to put in one');
  assertEqual(sectionOf('finishBadges'), 'Дополнительная информация', 'the finish column moved to Additional info');
  assertEqual(sectionOf('cardSearchLinks'), 'Дополнительная информация', 'type and mana search moved to Additional info');
  assertEqual(sectionOf('cardNicknames'), 'Дополнительная информация', 'card nicknames moved to Additional info');
  assertEqual(sectionOf('edhrecUsage'), 'Дополнительная информация', 'EDHREC is a sub-category of Additional info');
  assertEqual(sectionOf('cardtraderPrices'), 'Дополнительная информация', 'CardTrader is a sub-category of Additional info');
  assertEqual(sectionOf('setTokens'), 'Скрытие лишнего',
    'the deck token switch moved to the hiding group, which is where the model keeps it');
assertEqual(sectionOf('deckNoPrices'), 'Scryfall Deckbuilder', 'the other deck options share one category');
  assertEqual(sectionOf('deckLegality'), 'Scryfall Deckbuilder',
    'the legality check is a deck tool and sits with the deck tools, not with the hiding rules');
  assertEqual(sectionOf('deckCleanUpImprover'), 'Scryfall Deckbuilder',
    'the clean up improver is a deck option');
  assertEqual(sectionOf('sortEntriesPrimary'), 'Scryfall Deckbuilder',
    'and so are the settings that only matter while it is on');
  assertEqual(sectionOf('deckModuleStatus'), 'Scryfall Deckbuilder',
    'and the report the modules give about themselves');
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
    html: read('src/ui/options.html'),
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
  // The hiding group is drawn from the model, so the model is loaded here. It is the
  // same file the page names in options.html, and the list of scripts a page loads is
  // the list a test has to load: reading them out of the page is what stops a file
  // being added to the page and left out of every test, which is how the shared
  // clipboard module went missing from all of them once.
  page.script('src/core/set-filters.js');
  page.script('src/core/i18n.js');
  page.script('src/core/format-catalog.js');
  page.script('src/ui/options.js');
  return page;
}

// The hiding group is written after a second storage read, so a test that wants to look
// at it has to let that read land first. Without this every assertion about the group
// reads a page that has not drawn itself yet, which passes for the wrong reason.
const groupReady = async page => { await new Promise(resolve => setTimeout(resolve, 0)); return page; };

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

// The deck modules work through Scryfall's internals and every hook they need is
// optional, so "the feature does not work" has two very different causes: it is
// off, or it could not attach. The page world reports which, and settings is
// where that report has to be readable.
async function deckModuleStatusTest() {
  console.log('options.js: the deck modules report what they found');
  const none = loadOptions({});
  await settle();
  const idle = none.document.getElementById('deckModuleStatus').textContent;
  assert(idle.length > 0, 'with nothing reported yet it says what to do');
  assert(!/decks\//.test(idle), 'and does not invent a page');

  const page = loadOptions({
    settingsLanguage: 'en',
    deckModuleStatus: {
      at: Date.now(),
      page: '/decks/abc123/build',
      cleanUp: true,
      cardPreview: false,
      edhrecSuggestions: true,
      deckSearch: false,
      scryfall: {
        hasScryfall: true,
        hasScryfallApi: true,
        hooksInstalled: true,
        problems: ['deckbuilder.entries is a computed property; the deck edits hook is not installed']
      }
    }
  });
  await settle();
  const text = page.document.getElementById('deckModuleStatus').textContent;
  assert(text.includes('/decks/abc123/build'), 'it names the page the report came from');
  assert(text.includes('hooks'), 'whether the hooks into Scryfall took');
  assert(text.includes('deckbuilder.entries is a computed property'),
    'and what went wrong, in the adapter\'s own words');
  assert(text.indexOf('/decks/abc123/build') < text.indexOf('deckbuilder.entries'),
    'with the page first and the problem after it');
}

// Chrome answers a permission request only from a click, so the way to give
// access has to be a thing the user can press. Without it a feature that needs
// a newly added host falls back silently and nobody knows why.
async function grantHostsTest() {
  console.log('options.js: there is a way to give the hosts a feature needs');
  const page = loadOptions({ edhrecSuggestions: true, settingsLanguage: 'en' });
  const { document, mock } = page;
  await settle();
  const button = document.getElementById('grantDeckHosts');
  assert(button, 'the deck section has a button for it');
  button.dispatchEvent(new page.window.Event('click'));
  await settle();
  const asked = (mock.permissions && mock.permissions.grantedOrigins) || [];
  assert(asked.some(origin => String(origin).includes('edhrec.com')), 'and it asks for edhrec.com');
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
  console.log('options.js: three platform switches, no master');
  const page = await groupReady(loadOptions({}));
  const { document, mock } = page;
  const boxes = ['showPaper', 'showArena', 'showMtgo'].map(id => document.getElementById(id));
  assertEqual(boxes.map(box => box.checked), [true, true, true],
    'every platform starts shown, which is what a default has to mean');

  // Each change is fired on its own, because a switch that also wrote the other two would
// pass a test that unticked two and fired once — which is what this test did for years.
boxes[1].checked = false;
fireEvent(boxes[1], 'change');
await tick();
boxes[2].checked = false;
fireEvent(boxes[2], 'change');
await tick();
assertEqual(mock.state.setFilters.platforms, { paper: true, arena: false, mtgo: false },
    'leaving Paper alone is stored as the only platform');

  // All three off is a choice, not a state to be rescued. The earlier build put a master
  // above these and quietly restored them, which meant unchecking the last one appeared to
  // do nothing and came back on reload.
  boxes[0].checked = false;
  fireEvent(boxes[0], 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms, { paper: false, arena: false, mtgo: false },
    'and turning the last one off is stored as that, rather than undone');
  assertEqual(boxes.map(box => box.checked), [false, false, false], 'the boxes show it');

  // The requirement that a platform keeps its own settings while it is off. The switch and
  // the detail panel write different fields, and this is what proves neither rewrites the
  // other: a change made while Paper is off is still there when it comes back.
  const oversized = document.getElementById('showOversized');
  oversized.checked = false;
  fireEvent(oversized, 'change');
  await tick();
  assertEqual(mock.state.setFilters.paper.oversized, false,
    "Paper's own categories are still editable while Paper is off");
  boxes[0].checked = true;
  fireEvent(boxes[0], 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.paper, true, 'Paper comes back');
  assertEqual(mock.state.setFilters.paper.oversized, false,
    'and its categories are exactly as they were left');

  const stored = await groupReady(loadOptions({
    setFilters: { platforms: { paper: false, arena: false, mtgo: true } },
    setFiltersMigrated: true
  }));
  assertEqual(
    ['showPaper', 'showArena', 'showMtgo'].map(id => stored.document.getElementById(id).checked),
    [false, false, true],
    'a stored single-platform choice is restored'
  );
  assert(!stored.document.getElementById('setPlatformsAll'),
    'and there is no all-platforms row to restore');
}

// The hiding group, drawn from the model. The point of these is that the page cannot
// drift away from src/core/set-filters.js: a list the page shows and the model does not
// store is a switch that looks on and does nothing, which is the defect this whole
// group was rebuilt to end.
async function hidingGroupTest() {
  console.log('options.js: the hiding group is the model, drawn and not retyped');
  const page = await groupReady(loadOptions({ settingsLanguage: 'en' }));
  const { document, mock, context } = page;
  const F = context.STK_SET_FILTERS;

  // Every row under a category comes from the model's own table, and nothing else.
  // Checked both ways: a row the model has and the page did not draw is a rule the
  // reader cannot set, and a row the page drew and the model has not is a rule that
  // cannot be stored.
  const rowsOf = containerId => [...document.getElementById(containerId)
    .querySelectorAll('input[data-which]')].map(box => box.dataset.which);
  assertEqual(rowsOf('setBorderFamiliesList'), Object.keys(F.FOREIGN_BLACK_BORDER),
    'one row per Foreign Black Border family in the model, and no others');
  // The non-English rule has no list at all any more, and that is the point of the
  // redesign: Portal, Secret Lair and the rest were three categories of a set name, and
  // the question the reader actually has is about a printing rather than a set.
  assert(!document.getElementById('setNonEnglishList'),
    'the non-English rule has no category list, so there is nothing to re-derive');
  assertEqual(rowsOf('setPrices'), Object.keys(F.PRICE_KINDS),
    'one row per price kind in the model, and no others');

  // Prices are told apart, which is the whole reason they are four switches. Ticking one
  // must not touch the other three — the bug that made `onlyCardmarket` a single switch
  // was that there was no way to say it.
  const priceBox = kind => document.getElementById('setPrices-' + kind);
  priceBox('tcg').checked = true;
  fireEvent(priceBox('tcg'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.prices,
    { usd: false, tix: false, tcg: true, cardhoarder: false },
    'hiding one kind of price hides that one alone');

  // Foreign Black Border is per family, and positive: a family that is shown is a family
  // that is left alone, so unticking one stores `false` for that family alone.
  const fbb = document.getElementById('setBorderFamiliesList-fbb');
  fbb.checked = false;
  fireEvent(fbb, 'change');
  await tick();
  assertEqual(mock.state.setFilters.paper.foreignBlackBorder,
    { '4bb': true, fbb: false, bchr: true },
    'unticking one family stores that family off and leaves the other two on');
  assertEqual(F.effective(mock.state.setFilters).paper.foreignBlackBorder.fbb, false,
    'and the model hands the page the same thing, so the page and the rules cannot disagree');

  // The non-English rule is one select with three positions, and the middle one is not the
  // opposite of either end — so it is checked by value rather than by being on or off.
  const mode = document.getElementById('nonEnglishMode');
  assertEqual([...mode.options].map(option => option.value), Object.keys(F.NON_ENGLISH_MODES),
    'one option per position in the model, in the model\'s order');
  assertEqual(mode.value, 'all', 'and it starts at All, which shows everything');
  mode.value = 'analogue';
  fireEvent(mode, 'change');
  await tick();
  assertEqual(mock.state.setFilters.paper.nonEnglish, 'analogue',
    'the middle position is stored as itself and not flattened into a switch');
  assertEqual(mock.state.setFilters.paper.nonEnglish !== 'none', true,
    'which is what makes it different from the third');

  // The areas, and the requirement that a rule on with no area chosen removes nothing.
  const area = document.getElementById('areaSets');
  area.checked = false;
  fireEvent(area, 'change');
  await tick();
  assertEqual(mock.state.setFilters.areas.sets, false,
    'one area is stored on its own');
  assertEqual(mock.state.setFilters.areas.prints, true, 'and the other two are untouched');

  // Paper's categories: positive, and each one about a whole category.
  const before = JSON.parse(JSON.stringify(mock.state.setFilters));
  const nonTournament = document.getElementById('showNonTournament');
  nonTournament.checked = false;
  fireEvent(nonTournament, 'change');
  await tick();
  assertEqual(mock.state.setFilters.paper.nonTournament, false,
    'a category that is switched off is stored as off');
  assertEqual(F.effective(mock.state.setFilters).paper.nonTournament, false,
    'and the model agrees, so a page drawing it as on would be visibly wrong');

  // Paper's detail panel is a disclosure, closed to begin with, and the areas sit outside
  // it. Nothing dims anything any more, because there is no master to dim with — which is
  // checked by asking whether the blocks are still usable, not by asking for a flag.
  assertEqual(document.getElementById('paperPanel').hidden, true,
    "Paper's categories start closed, so the main screen is three lines and an areas group");
  click(document.getElementById('paperDetails'));
  assertEqual(document.getElementById('paperPanel').hidden, false,
    'and the button opens them');
  assertEqual(document.getElementById('paperDetails').getAttribute('aria-expanded'), 'true',
    'telling a screen reader what it just did');
  assert(!document.getElementById('visibilityGroup').disabled,
    'nothing is dimmed, because there is no master switch to dim anything with');
  assert(!document.getElementById('filterAreasGroup').disabled,
    'and the areas are usable whatever Paper is doing');
  assertEqual(before.paper.nonTournament, true,
    'the state before this block is the default, so the change above really was stored');

  // The labels under the switches are the model's own strings, translated by the same
  // walk that translates the rest of the page. An English page that says a Russian sentence
  // beside a select is a page that is half in one language — and the middle position's
  // explanation is the one that has to survive translation, since it is the only place the
  // reader is told what "English analogue" means.
  // The English page is the one this block loads, so "translated" means the option and the
  // hint say it in English rather than carrying the Russian through unchanged. Asserting it
  // against the model's Russian label would be asserting the opposite of what is wanted.
  assertEqual(mode.options[1].textContent, 'Only without an English analogue',
    'the middle option is drawn in the page language, not the model\'s');
  assert(/only where the same card has no English/.test(document.getElementById('nonEnglishHint').textContent),
    'and the hint under it says what the middle position means (' +
      document.getElementById('nonEnglishHint').textContent.trim().slice(0, 60) + '…)');
  assert(!/[А-Яа-я]/.test(document.getElementById('nonEnglishHint').textContent),
    'with no Russian left in it');

  // The old flat keys are gone from the page. A control that still wrote one of them
  // would look exactly like the new one and stop hiding anything, because nothing
  // reads those keys any more.
  const script = read('src/ui/options.js');
  for (const key of ['hideNonTournamentSets', 'hideOversizedSets', 'hideForeignBlackBorder',
    'hideNonEnglishPrints', 'hideDigitalSets', 'onlyCardmarket', 'hideCasterIndicator']) {
    assert(!new RegExp(`storage\\.local\\.set\\(\\{[^}]*${key}`).test(script),
      `options.js never writes ${key} any more`);
  }
  for (const id of REMOVED_IDS) {
    assert(!read('src/ui/options.html').includes(`id="${id}"`), `options.html has no #${id}`);
  }
}

// The one thing that must not go wrong quietly: a reader whose old switches were never
// migrated must see them on the settings page, not the defaults. They are shown the
// card page only if they visit one.
async function hidingMigrationTest() {
  console.log('options.js: the settings page migrates what the card page would have');
  const old = {
    hideNonTournamentSets: true,
    hideForeignBlackBorder: true,
    hideNonEnglishPrints: true,
    onlyCardmarket: true,
    hideCasterIndicator: true,
    deckTokens: false,
    setPlatforms: ['paper']
  };
  const page = await groupReady(loadOptions(old));
  const { document, mock } = page;
  const F = page.context.STK_SET_FILTERS;

  assertEqual(mock.state.setFilters, F.migrate(old),
    'the same shape the card page would have stored, key for key');
  assertEqual(mock.state.setFiltersMigrated, true, 'and the flag is written, so it is not done twice');

  assertEqual([document.getElementById('showNonTournament').checked,
    document.getElementById('nonEnglishMode').value,
    document.getElementById('setCaster').checked], [false, 'none', true],
    'and every one of them is drawn as the reader left it — inverted where the old words were "hide"');
  assertEqual([...document.getElementById('setBorderFamiliesList').querySelectorAll('input')]
    .map(box => box.checked), [false, false, false],
    'with all three border families off, which is what the old single switch meant');
  assertEqual([...document.getElementById('setPrices').querySelectorAll('input')].map(box => box.checked),
    [true, true, true, true], 'including four price kinds from the one switch that used to hide them');
  assertEqual(document.getElementById('setTokens').checked, false,
    'and the deck tokens, whose old switch was positive');
  assertEqual([document.getElementById('showPaper').checked,
    document.getElementById('showArena').checked], [true, false],
    'and the platform list, which was a whitelist');

  // A reader who has already migrated to the previous shape must not be migrated twice, and
  // their choices must survive the change of words. This is the case the shape rewrite is
  // most likely to lose: a stored `sets` block written by 1.1.4–1.3.0 is neither the flat
  // booleans of the first migration nor the positive shape of this one.
  const stale = await groupReady(loadOptions({
    ...old, setFiltersMigrated: true,
    setFilters: {
      setsEnabled: true,
      sets: {
        nonTournament: true,
        oversized: false,
        foreignOnly: false,
        foreignBlackBorder: { surfaces: 'off', which: ['4bb', 'fbb', 'bchr'] },
        nonEnglish: { surfaces: 'sets-prints', which: ['portal', 'secret-lair', 'other'] }
      }
    }
  }));
  // What is asserted here is what the page drew, because that is what the reader sees: a
  // value already marked migrated is not written back, so storage still holds the old
  // shape and asking `effective()` about it would test the stored value rather than the
  // migration.
  assertEqual(stale.document.getElementById('showNonTournament').checked, false,
    'a stored hide is drawn as not-shown');
  assertEqual(stale.document.getElementById('showOversized').checked, true,
    'and a stored not-hide is drawn as shown');
  assertEqual(stale.document.getElementById('showNoEnglishSets').checked, true,
    'including the measured foreign-only switch, which was stored as a hide');
  assertEqual(stale.document.getElementById('nonEnglishMode').value, 'none',
    'and the non-English rule keeps the position that hides, because that is what it was set to');
  assertEqual([...stale.document.getElementById('setBorderFamiliesList').querySelectorAll('input')]
    .map(box => box.checked), [true, true, true],
    'with every border family shown, which is what a rule that was off meant');
  assertEqual(F.upgrade(stale.mock.state.setFilters).paper.nonTournament, false,
    'and the model reads that stored value the same way the page drew it');
}

async function lockedDependentsTest() {
  console.log('options.js: master switches lock their own settings');
  const page = await groupReady(loadOptions({}));
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
  assertEqual(settingsLanguage.value, 'auto', 'the language select starts on the browser-following choice');
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

// The illustrations behind the "?" beside each section heading. Photographs of the
// real panels, and the ways they can fall out of step with the page.
function featureShotsTest() {
  console.log('settings: the illustrations match the page, the folder and the tool');
  const html = read('src/ui/options.html');
  const script = read('src/ui/options.js');
  const dir = path.join(ROOT, 'assets', 'shots');
  assert(fs.existsSync(dir), 'there is a folder of illustrations');
  const onDisk = fs.readdirSync(dir).filter(name => name.endsWith('.png')).sort();
  assert(onDisk.length >= 6, 'and it holds one per illustrated section (' + onDisk.length + ')');

  // The pictures are opened from a dialog rather than shown in the sections, so the
  // page carries only the buttons and the script carries the pictures. Named by
  // the script, because the script is what a reader's click reaches.
  assert(/<dialog id="shotDialog"/.test(html), 'the page has a dialog to show a picture in');
  assert(/id="shotImage"/.test(html) && /id="shotCaption"/.test(html), 'with somewhere for the picture and its caption');
  // The dialog scrolls, because a picture can be taller than the window and there was
  // nothing to reach the rest of it with. Five of the six are a card page's right-hand
  // column and are over a thousand pixels tall at the size they are shown, so this is
  // not a precaution: without it the bottom of every one of them — the tag tables, the
  // end of the grouped prints — is simply not on the screen.
  assert(/\.shot-dialog\s*\{[^}]*overflow:\s*auto/.test(read('src/ui/options.css')),
    'the dialog scrolls, so a picture taller than the window can be read to the end');
  assert(!/<figure/.test(html) && !/assets\/shots\//.test(html),
    'and no picture is laid out in the body of the page any more');

  const shots = [...script.matchAll(/^\s{4}'?([a-z-]+)'?:\s*\{\s*$/gm)].map(match => match[1]);
  const named = [...script.matchAll(/src: '\.\.\/\.\.\/assets\/shots\/([a-z-]+\.png)'/g)]
    .map(match => match[1]).sort();
  assertEqual(named.length, shots.length, 'every entry in the list of pictures names a file');
  const missing = named.filter(name => !onDisk.includes(name));
  assertEqual(missing, [], 'every illustration the page can open is on disk');
  const unseen = onDisk.filter(name => !named.includes(name));
  assertEqual(unseen, [], 'and no illustration is made and then never shown');

  // Every button has something to open. A "?" with no picture behind it looks like
  // a feature that does not work.
  const buttons = [...html.matchAll(/class="shot-button" data-shot="([a-z-]+)"/g)].map(match => match[1]).sort();
  assertEqual(buttons, shots.slice().sort(), 'every "?" opens a picture that exists');

  // The tool has to agree with the page too, or regenerating quietly swaps one set
  // of illustrations for another.
  const tool = read('tools/make-feature-shots.cjs');
  const fromTool = [...tool.matchAll(/file: '([a-z-]+\.png)'/g)].map(match => match[1]).sort();
  assertEqual(fromTool, named,
    'the tool makes exactly the illustrations the page can open');

  // Five of the six are the card page's right-hand column, and the sixth is the
  // clipboard, which is not in any column. A check over the pictures alone cannot tell
  // which is which, so the tool's own declaration is what is checked — and the two
  // things that make it a column are named, because both were got wrong first:
  //
  //   `.prints-current` hangs 20px above its own parent on Scryfall's page (a negative
  //   margin), so a union that leaves it out slices the printing's name across the top.
  //   `.card-text` is the card's rules and its legality, which is the *other* column.
  const shotTool2 = read('tools/make-feature-shots.cjs');
  const columnBlock = /const RIGHT_COLUMN = (\[[\s\S]*?\]);/.exec(shotTool2);
  assert(columnBlock, 'the tool names the right-hand column it crops');
  assert(/\.card-profile \.prints'/.test(columnBlock[1]),
    'and the column is the prints table, which is where Scryfall puts it');
  assert(/\.prints-current'/.test(columnBlock[1]),
    'together with the printing banner, which hangs above its own box and would be sliced otherwise');
  assert(!/card-text/.test(columnBlock[1]),
    'and not the card text, which is the other column and was the first guess');
  // Per shot, not per line: three of the six carry a comment between the file name and
  // the flag, and a check written to the shape of the file rather than to what it says
  // is a check that fails on a comment and passes on a missing flag.
  const declaredColumn = shotTool2
    .split(/file: '/).slice(1)
    .filter(block => /\n\s*column: true,/.test(block.split(/\n\s*};/)[0]))
    .map(block => block.slice(0, block.indexOf("'")).trim())
    .sort();
  assertEqual(declaredColumn, ['additional.png', 'hide-extra.png', 'legality.png', 'prints.png', 'tags.png'],
    'every picture that lives in the column is cropped as the whole column');
  assert(!declaredColumn.includes('cardclip.png'),
    'and the clipboard is not one of them, because it is a panel floating over the page rather than a part of the column');
  // A column picture is a picture of an arrangement, so it has to show more than one
  // panel. A tool that silently went back to cropping would still make a valid PNG of a
  // plausible size, and this is the only thing here that would notice.
  for (const name of declaredColumn) {
    const height = fs.readFileSync(path.join(dir, name)).readUInt32BE(20);
    assert(height > 1100,
      name + ' is the whole column and not a panel inside it (' + height + ' px)');
  }

  // Each one is a real PNG and none of them is a blank rectangle.
  for (const name of onDisk) {
    const buffer = fs.readFileSync(path.join(dir, name));
    assertEqual(buffer.readUInt32BE(0), 0x89504e47, name + ' is a PNG');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert(width > 200 && height > 80,
      name + ' is a panel and not a sliver (' + width + 'x' + height + ')');
    // The ceiling is the tool's own bound for the whole column, not an arbitrary one:
    // five of the six pictures are a card page's right-hand column rather than a panel
    // inside it, and that column is between one and two thousand pixels tall depending on
    // how many printings the card has. The bound still means something — a picture that
    // passes it is a column or a panel, and not a page — but it is the bound the tool
    // refuses to exceed, so the two cannot drift apart silently.
    const ceiling = Number(read('tools/make-feature-shots.cjs')
      .match(/const bound = wholeColumn \? (\d+) : \d+;/)[1]);
    assert(height <= ceiling,
      name + ' is not a page (' + height + ' pixels tall, ceiling ' + ceiling + ')');
    assert(buffer.length > 2000, name + ' carries something');
  }

  // Nothing in a picture is written by hand. The tool fills them from Scryfall and
  // from Tagger, and a caption that promises EDHREC's numbers cannot be shown
  // because their API refuses this machine — the pictures must not claim otherwise.
  assert(/live\.cjs|heroCard/.test(read('tools/shots/cardpage.cjs')),
    'the pictures are filled with fetched data, not typed');
  // The stage is Scryfall's own page, fetched whole, with their stylesheet inlined.
  //
  // It used to be a container of ours, and the panels came out looking like a
  // different program — oversized serif links, purple underlined tag names, a light
  // page where the product is dark. Nothing in the panels was wrong; the picture was
  // taken somewhere the extension never runs. This is the check that says so.
  const stage = read('tools/shots/cardpage.cjs');
  assert(/realpage|realPage/.test(stage), 'the pictures are cut out of a real Scryfall page');
  assert(/card-legality-row|prints-table/.test(read('tools/shots/realpage.cjs')) ||
    /realPage/.test(stage), 'and the page is Scryfall\'s own document, not a stand-in');
  assert(/stk-dark/.test(stage), 'in the extension\'s own dark theme');
  const shotTool = read('tools/make-feature-shots.cjs');
  assert(/\.card-profile|\.prints/.test(shotTool),
    'and the crops are Scryfall\'s own elements, where the extension puts them');
  // Comments are stripped first: the fixture explains what it used to contain, and
  // naming that in a check would fail on its own explanation.
  const code = read('tools/shots/cardpage.cjs')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
  assert(!/Test Card|Memory Jar|4,823|Core Set 2019 #6/.test(code),
    'and none of the invented text from the first version is left in the fixture');
  assert(!/numDecks:\s*\d+|potentialDecks:\s*\d+/.test(code),
    'and no deck counts are written down, which are the numbers we cannot fetch');

  // The caption of each picture is translated like every other string on the page.
  const captions = [...script.matchAll(/caption: '([^']+)'/g)].map(match => match[1]);
  assertEqual(captions.length, named.length,
    'every illustration has a caption, and every caption has an illustration');
  const i18n = read('src/core/i18n.js');
  const untranslated = captions.filter(text => !i18n.includes(text));
  assertEqual(untranslated, [], 'and every caption is in the dictionary, so an English page is not half Russian');
}

// The bug a reader reported, and the two things it was made of.
//
// Opening the settings page printed:
//
//   Unchecked runtime.lastError: This function must be called during a user gesture
//
// twice over. The page asked for an optional host while it was loading, from inside the
// callback of permissions.contains — so there was no gesture left to ask with, and
// Chrome refused. A refusal arrives through the callback rather than as a throw, so the
// try/catch around the call caught nothing; and because nobody read
// chrome.runtime.lastError, Chrome printed it as "Unchecked" on every load.
async function hostAccessTest() {
  console.log('options.js: host access is asked for from a click, and every refusal is read');

  // Loading the page must ask for nothing. Not "ask and fail quietly" — ask nothing.
  const page = loadOptions({ edhrecUsage: true, edhrecSalt: true, cardtraderPrices: false });
  const { document, mock } = page;
  await tick();
  await tick();
  assertEqual(mock.permissions.grantedOrigins, [],
    'loading the settings page asks for no host at all');
  assertEqual(mock.permissions.requestCount, 0,
    'and makes no request to be refused');

  // What it does instead is name what is missing, so a reader has something to act on.
  const status = document.getElementById('status');
  assert(/EDHREC/.test(status.textContent),
    'a feature that is on without its host is named in the status line (' +
      status.textContent.slice(0, 60) + ')');
  assert(document.getElementById('grantDeckHosts').classList.contains('stk-needs-grant'),
    'and the button that grants it is marked on the page');

  // A refusal must be read, or Chrome prints it as unchecked.
  mock.permissions.unchecked.length = 0;
  mock.permissions.refuseWith = 'This function must be called during a user gesture';
  const prices = document.getElementById('cardtraderPrices');
  assert(prices.checked === false, 'the feature under test starts switched off');
  prices.checked = true;
  fireEvent(prices, 'change');
  await tick();
  await tick();
  assertEqual(mock.permissions.unchecked, [],
    'a refused request is read through chrome.runtime.lastError, so nothing is printed');
  assert(prices.checked === false, 'and the switch goes back rather than looking switched on');
  assert(mock.state.cardtraderPrices !== true, 'and nothing was saved as if it had worked');
  assert(/не дал спросить|would not let/.test(status.textContent),
    'saying the browser would not ask, which is not the reader saying no (' +
      status.textContent.slice(0, 60) + ')');
  mock.permissions.refuseWith = null;

  // And the way that works: the button, from a click.
  const grant = document.getElementById('grantDeckHosts');
  grant.click();
  await tick();
  await tick();
  assert(mock.permissions.grantedOrigins.includes('https://json.edhrec.com/*'),
    'the button grants what the page said was missing');
  assertEqual(mock.permissions.unchecked, [],
    'and a refusal there is read as well');
}

(async () => {
  try {
    htmlIdCheck();
    untranslatedTextTest();
    modelLabelsTest();
    switchStyleTest();
    sectionOrderTest();
    popupTest();
    await optionalHostsTest();
    await hostAccessTest();
    await lastPlatformTest();
    settingsLanguageTest();
    await settingsLanguageChainTest();
    licenceAndPrivacyTest();
    iconArtworkTest();
    await formatListTest();
    await settingsTest();
    await setPlatformsTest();
    await hidingGroupTest();
    await hidingMigrationTest();
    await themeModeTest();
    await lockedDependentsTest();
    await languageTest();
    await discoveredFormatsTest();
    await deckModuleStatusTest();
    await grantHostsTest();
    featureShotsTest();
    summary('test-options');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
