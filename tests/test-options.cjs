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
  'edhrecSalt', 'showSaltScale', 'edhrecUsageDisplay',
  'legalities', 'exportFormat', 'taggerSearchLinks', 'cardSearchLinks',
  'deckNoPrices', 'stackedDeckCards', 'deckLegality',
  'deckCleanUpImprover', 'cleanUpLandsInSingleton', 'sortEntriesPrimary',
  'insertSortingHeadings', 'edhrecSuggestions', 'deckSearch',
  'deckModuleStatus', 'grantDeckHosts',
  // The platforms table is written by options.js, so the page holds only its head, its body and
  // the price container. Every control in this section is drawn at run time from
  // STK_SET_FILTERS.PLATFORM_NAMES, its AREAS and its PRICE_GROUPS.
  'visibilityGroup', 'platformHead', 'platformBody', 'priceList', 'shotNotes',
  'setCaster', 'setTokens',
  'printGrouping', 'printFoldGroups', 'printFullPageLink',
  // Additional info: a row per feature, and one panel per disclosure. The ids are here because
  // the page holds the panels in its own markup — unlike the platforms table, there is nothing
  // in the model that could draw them — and a panel whose id a button names but the page does
  // not have is a button that does nothing.
  'cardtraderRow', 'cardtraderMain', 'cardtraderToggle', 'cardtraderPanel',
  'cardtraderTokenRow', 'cardtraderTokenActions', 'replaceToken',
  'edhrecUsageToggle', 'edhrecUsagePanel', 'edhrecSaltToggle', 'edhrecSaltPanel',
  'resetUsage', 'resetSalt'
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
  'setNonEnglish', 'setNonEnglishList', 'setPlatformsGroup',
  // The containers this section used before the rework, and the legend that told a reader which
  // way round its four switches ran. The prices are two rows of boxes now rather than a
  // vertical list, so the list it was built by is gone with it.
  'setPrices', 'platformList',
  // And the controls the two simplifications removed. They are named here rather than left
  // out of the list: an id that is gone from the page by accident and gone on purpose look
  // the same to a reader, and only one of them is a decision.
  'paperDetails', 'showNonTournament', 'showOversized', 'showNoEnglishSets',
  'showBorderFamilies', 'setBorderFamiliesList', 'showAncillary', 'ancillaryHint',
  'nonEnglishMode', 'nonEnglishHint', 'paperPanel', 'filterAreasGroup',
  // And the two features that were cut, with the container that had nothing left to hold once
  // they were gone. Named here rather than left out of the list: an id that is gone from the
  // page by accident and gone on purpose look the same to a reader, and only one is a decision.
  'cardNicknames', 'edhrecLink', 'extraSettingsToggle', 'extraSettingsPanel'
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
    'assets/data/oracle-tags.js', 'assets/data/illustration-tags-1.js', 'assets/data/illustration-tags-2.js'
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
  assert(/MPL-2\.0 notice does \*{0,2}not\*{0,2}\s+cover[\s\S]{0,160}icons\/cardtrader\.svg/.test(notices),
    'the notices say the MPL does not cover the CardTrader mark');
  // EDHREC's logo used to ship for the icon-and-link control. That control is gone and so is the
  // image, so the notices must no longer claim to ship it — a document naming a file that is not
  // in the build is as wrong as one that omits a file that is.
  assert(!/icons\/edhrec\.png/.test(notices) && !fs.existsSync(path.join(ROOT, 'assets/icons/edhrec.png')),
    'and do not name the EDHREC logo, which went with the control that showed it');
// The marks are shipped, on nominative use, by a recorded decision. So what the
  // notices have to say is the basis, and what they must not say is that a permission
  // exists. A notice that says "unresolved" beside a file we ship is a document
  // telling a reader we use something we have no right to use.
  for (const mark of ['assets/icons/cardtrader.svg']) {
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
  const F = page.context.STK_SET_FILTERS;
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
  assertEqual(F.PLATFORM_NAMES.filter(name =>
    mock.state.setFilters.platforms[name].show === true), [],
    'turning the last platform off is stored as that');
  assertEqual(F.PLATFORM_NAMES.every(name =>
    mock.state.setFilters.platforms[name].areas.prints === true), true,
    'and each of the three keeps its own places, so switching it back is not a reset');
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
    edhrecUsage: false, edhrecSalt: false
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
  // `AREAS` is in this list because its three switches are written by options.js from the
  // table, so the page cannot be asked for a sentence it would then be found to be missing.
  // The check on the rendered page below would catch it anyway; this catches it earlier and
  // says which table is short.
  const labels = ['PRICE_KINDS', 'AREAS']
    .flatMap(table => {
      const block = new RegExp(`const ${table} = \\{[\\s\\S]*?\\n  \\};`).exec(filters);
      assert(block, `the model still declares ${table}, so the labels can be found in it`);
      return [...block[0].matchAll(/label: '([^']+)'/g)].map(match => match[1]);
    });
  // Seven rather than seventeen. The count is asserted as a floor and not a shape, because the
// number of labels is not the point — what the point is, is that a model label which is not
  // in the dictionary is a checkbox with an untranslatable name beside it, and that is
  // invisible in the markup.
  assert(labels.length >= 7, `the model's tables carry ${labels.length} labels to translate`);
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
// The visibility section's layout: a two-column grid, a table in the left of it and the prices
// and the marker in the right.
//
// These are the things a reader would notice if they were wrong — a frame inside a frame, a
// column of sliders beside a row of boxes, a table where the name and its boxes are so far
// apart that the row stops reading as a row, a checkbox that still has a switch's knob in it.
// The colours and the type are the page's own.
assert(/#visibilityGroup\{[^}]*padding:24px/.test(css),
  'the card is inset by 24px, because a table against an 18px edge looks like it is falling ' +
  'out of the card rather than sitting in it');
assert(/#visibilityGroup h3\{[^}]*color:#e4c7ea/.test(css),
  'the sub-headings use the colour this page already used for a sub-heading, not a new one');
assert(/#visibilityGroup h3\{[^}]*margin:0/.test(css),
  'and carry no top margin of their own: each sits at the top of its own column, and a top ' +
  'margin would push the two out of line with each other');
// The grid. Two columns, the left one wider, 32px between them, and every track able to shrink.
assert(/\.visibility-grid\{[^}]*display:grid/.test(css) &&
    /\.visibility-grid\{[^}]*minmax\(0,1\.15fr\)[^}]*minmax\(0,1fr\)/.test(css) &&
    /\.visibility-grid\{[^}]*gap:32px/.test(css),
  'the card is two columns, the table\'s a little wider than the prices\', 32px apart');
assert(/\.visibility-grid\{[^}]*align-items:start/.test(css),
  'and the shorter column is not stretched to the taller one, so the card is as tall as its ' +
  'contents and nothing is distributed down it');
assert(/@media \(max-width:720px\)\{\.visibility-grid\{[^}]*minmax\(0,1fr\)\}\}/.test(css),
  'and below the width where the two stop fitting, one column — not two squeezed ones');
assert(/@media \(max-width:720px\)\{[\s\S]*?\.platform-table th\[scope=row\]\{[^}]*white-space:normal/.test(css),
  'where the platform name is allowed to wrap and the columns come closer together, because ' +
  'five headings of unbreakable words need more than a 420px card can give them');
// And it has to come *after* the rules it overrides. A media query adds no specificity, so a
// narrow-window rule written above the rule it means to replace simply loses — the file still
// contains it, it still reads correctly, and the heading stays clipped. That was a real defect
// here, found by looking at the page after the tests had passed.
assert(css.search(/@media \(max-width:720px\)\{\s*\.platform-table thead th/) >
    css.indexOf('.platform-table thead th{'),
  'the narrow-window rules sit after the table rules they override, because a media query adds ' +
  'no specificity and written above them they lose silently');
assert(!/\.visibility-grid\{[^}]*min-height/.test(css) &&
    !/\.visibility-column\{[^}]*min-height/.test(css),
  'with no minimum height on either the grid or a column, because the card is as tall as what ' +
  'is in it');
// The table. Compact by content, not by width; 40px rows; the name column left in its heading
// as well as in its rows.
assert(/\.platform-table\{[^}]*border-collapse:collapse/.test(css),
  'the platforms table is a real table, collapsed rather than spaced');
assert(!/\.platform-table\{[^}]*[;{]width:100%/.test(css),
  'and is sized by its content rather than stretched: five columns across the card put the ' +
  'boxes so far apart that the row stops reading as a row');
assert(/\.platform-table tbody tr\{[^}]*height:40px/.test(css),
  'a row is 40px tall — the box has the whole of it to be pressed in and none of it is padding');
assert(/\.platform-table tbody tr\{[^}]*padding/.test(css) === false,
  'and a row carries no padding of its own');
assert(/\.platform-table th\[scope=row\]\{[^}]*text-align:left/.test(css),
  'the platform name is named once, down the left');
assert(/\.platform-table th,\.platform-table td\{[^}]*text-align:center/.test(css),
  'and every box is centred in its own column');
assert(/\.platform-table thead th:first-child\{[^}]*text-align:left/.test(css),
  'including the heading over the name column, which sits on the same edge as the names it names');
assert(/\.stk-cell-check\{[^}]*height:40px/.test(css) && /\.stk-cell-check\{[^}]*cursor:pointer/.test(css),
  'the target is the cell rather than the glyph, so the whole row-height of it is pressable');
assert(/\.stk-cell-check\{[^}]*margin:0/.test(css),
  'and it carries no margin of its own, because the page\'s 9px on every label would otherwise ' +
  'add 18px of nothing to a 40px row and put the rows 58px apart');
// A platform that is off. The row is not faded; only the name goes a shade quieter, and the
// three places it governs keep a border rather than fading to nothing.
assert(!/tr\.is-off\{[^}]*opacity/.test(css),
  'a switched-off platform does not fade its whole row: the name and the platform\'s own box ' +
  'are what the reader uses to turn it back on');
assert(/tr\.is-off th\[scope=row\]\{[^}]*color:#b9b2c4/.test(css),
  'the name goes a shade quieter and stays readable, rather than disappearing');
assert(/#visibilityGroup input\[type=checkbox\]\.stk-check:disabled,[^}]*\{[^}]*border-color:#3b3642/.test(css) &&
    !/#visibilityGroup input\[type=checkbox\]\.stk-check:disabled,[^}]*\{[^}]*opacity:\./.test(css),
  'and the disabled places keep a border and a recessed fill instead of an opacity, ' +
  'because a control that has faded to nothing reads as a fault rather than as a state');
// And the difference from a box that is merely unticked has to be visible, because that
// difference is the whole message. An unticked box is #6a6070 on the card's own colour; a
// disabled one is #3b3642 on #232229, which is a grey nobody has to compare two screenshots to
// see. This was reported as too subtle once, which is why it is asserted rather than eyeballed.
assert(/input\[type=checkbox\]\.stk-check\{[^}]*border:1px solid #6a6070/.test(css),
  'an unticked box wears the lighter border');
assert(/#visibilityGroup input\[type=checkbox\]\.stk-check:disabled,[^}]*\{[^}]*background-color:#232229/.test(css),
  'and a disabled one is dark enough to be told apart from it at a glance');
assert(/#visibilityGroup label\.stk-cell-check:has\(> input\[type=checkbox\]\.stk-check:disabled\)\{[^}]*opacity:1/.test(css),
  'while the platform name keeps its colour, because it is what the reader uses to turn the row ' +
  'back on — and every other label around a disabled box goes quiet with it');
// The boxes themselves: 18x18 squares, no switch left in them. One class for every square box
// on the page rather than one set of rules per section, so a reader can tell a checkbox from a
// switch without working out which part of the settings they are looking at.
assert(/input\[type=checkbox\]\.stk-check\{[^}]*appearance:none/.test(css) &&
    /input\[type=checkbox\]\.stk-check\{[^}]*width:18px/.test(css) &&
    /input\[type=checkbox\]\.stk-check\{[^}]*height:18px/.test(css),
  'every square box on the page is an 18x18 control rather than a slider');
assert(/input\[type=checkbox\]\.stk-check\{[^}]*border-radius:4px/.test(css),
  'with the brief\'s 4px corners rather than the switch\'s pill');
assert(/input\[type=checkbox\]\.stk-check\{[^}]*background-image:none/.test(css) &&
    /input\[type=checkbox\]\.stk-check:checked\{[^}]*background-image:none/.test(css),
  'and the switch knob\'s gradient cleared in the base rule *and* in :checked: left in either ' +
  'one, it paints a grey circle in the middle of the box, which is what an unticked box here ' +
  'used to look like');
assert(/input\[type=checkbox\]\.stk-check\{[^}]*background-color:transparent/.test(css) &&
    !/input\[type=checkbox\]\.stk-check\{[^}]*border-radius:1[0-9]px/.test(css),
  'unticked is empty rather than grey: nothing but a thin border on the card\'s own colour');
assert(/input\[type=checkbox\]\.stk-check:checked\{[^}]*background-color:#7b5c8c/.test(css),
  'and ticked is the page\'s own purple');
assert(/input\[type=checkbox\]\.stk-check:checked::after\{/.test(css),
  'with a tick drawn on it, so checked still reads as checked at 18px');
assert(/input\[type=checkbox\]:focus-visible\{outline:2px solid #c9a4d5/.test(css) &&
    /input\[type=checkbox\]\.stk-check:focus-visible\{outline:2px solid #c9a4d5/.test(css),
  'keyboard focus is visible on both the square boxes and the page\'s own switches, and never removed');
// The selector carries the attribute *and* the class, because `.stk-check` alone ties with the
// page-wide `input[type=checkbox]` on specificity and would then depend on where in the file
// this block happens to sit.
assert(/input\[type=checkbox\]\.stk-check\{/.test(css),
  'and the class is written together with the attribute, so the square rules cannot lose to the ' +
  'switch rules by file order');
// The prices: a caption, and under it the boxes it names. No caption column, and no grid any
// more — a caption beside its boxes needs a column as wide as the longest caption, and that
// column is empty on every other row.
assert(/\.pair-caption\{[^}]*margin:0 0 8px/.test(css),
  'each price caption sits 8px above the boxes it names');
assert(/\.pair-group\{[^}]*margin:0 0 16px/.test(css),
  'and the two groups are 16px apart');
assert(/\.pair-items\{[^}]*display:flex/.test(css) && /\.pair-items\{[^}]*flex-wrap:wrap/.test(css),
  'with the boxes able to sit on one line or wrap under each other');
assert(!/\.pair-caption\{[^}]*grid-column/.test(css) && !/\.pair-row\{/.test(css),
  'and no caption column at all, which is the wide grey gap removed rather than restyled');
assert(/\.caster-row\{[^}]*margin:24px/.test(css),
  'the Caster marker is 24px under the prices, with no heading of its own over one box');
// Additional info: a row per feature, the settings behind a button, and the panel indented.
assert(/\.feature-row\{[^}]*min-height:40px/.test(css) && /\.feature-row\{[^}]*display:flex/.test(css),
  'a feature row is 40px tall and lays its label and its buttons out on one line');
assert(/\.feature-main\{[^}]*flex:1 1 auto/.test(css),
  'the label takes the free space, which is what puts every "Настроить" on the same right edge');
// And it does not restate the layout the page's own label rule already gives a label holding a
// checkbox. That rule is more specific, so a `gap:10px` here would be a number the browser never
// uses — a rule that reads as if it were doing something and is not.
assert(!/\.feature-main\{[^}]*\bgap:/.test(css) && !/\.feature-main\{[^}]*\bdisplay:/.test(css),
  'and does not restate the flex, the centring or the gap, which come from the page-wide label rule');
assert(/\.feature-panel\{[^}]*margin:2px 0 12px 28px/.test(css),
  'a panel is indented from the row it belongs to, which is how a reader sees what it belongs to');
assert(/\.feature-panel\[hidden\]\{display:none\}/.test(css),
  'and hidden really hides it: the page sets `display` on the controls inside, which would beat ' +
  'the browser\'s own rule for the hidden attribute');
assert(/\.feature-panel select\{[^}]*max-width:260px/.test(css),
  'a select in a panel is capped in width rather than stretched across the card');
assert(/\.feature-main\.is-unconnected input\{display:none\}/.test(css),
  'and CardTrader without a token hides its switch rather than disabling it');
assert(/\.shot-notes\{[^}]*border-bottom/.test(css),
  'and the notes that used to sit on the page now have a place in the "?" dialog');
const dialogMarkup = read('src/ui/options.html');
assert(dialogMarkup.indexOf('id="shotCaption"') < dialogMarkup.indexOf('id="shotImage"'),
  'above the picture rather than below it: the pictures are a screen tall, so a dialog that ' +
  'opens on one puts the only explanation this page now has below the fold');
assert(!/\.platform-block\{/.test(css) && !/\.sub-panel\{/.test(css),
  'the two rules that drew a vertical line beside a platform\'s places are gone');
}

function sectionOrderTest() {
  console.log('options.html: section order and grouping');
  const html = read('src/ui/options.html');
  const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map(match => match[1]);
  assertEqual(headings, ['Общее', 'Tags', 'CardClip', 'Видимость', 'Дополнительная информация',
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
  //
  // Two ways of asking, because the page has both shapes. A section may carry its own id, and
  // then "the nearest heading above the id" answers with the *previous* section's heading —
  // the wrong answer rather than a missing one, which reads as though the control had been
  // moved. And one section holds two headings, so "the first heading in the enclosing section"
  // answers with the wrong one of the two. So: when the id is on the section tag itself, read
  // that section's own first heading; otherwise read the last heading above the control.
  const sectionOf = id => {
    const at = html.indexOf(`id="${id}"`);
    if (at < 0) return null;
    const open = html.lastIndexOf('<section', at);
    const openTag = open < 0 ? '' : html.slice(open, html.indexOf('>', open) + 1);
    if (openTag.includes(`id="${id}"`)) {
      const heading = /<h2>([^<]+)<\/h2>/.exec(html.slice(open, html.indexOf('</section>', at)));
      return heading ? heading[1] : null;
    }
    const headings = [...html.slice(0, at).matchAll(/<h2>([^<]+)<\/h2>/g)];
    return headings.length ? headings[headings.length - 1][1] : null;
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
// The visibility section. Its controls are all written by options.js at run time, so the
  // markup holds the table's head, its body, the price container and one checkbox — and the
  // section is that section, which has to be inside the Visibility category rather than a
  // sibling of it, or the platforms end up in a category of their own with no heading.
  //
  // The ids that are absent are absent on purpose, and the removal list and the runtime block
  // below each say so. A control that is gone from the page by accident and one that is gone by
  // decision look identical to a reader.
  assertEqual(sectionOf('visibilityGroup'), 'Видимость',
    'the section is the visibility one, which is what it is now called');
  assertEqual(sectionOf('platformHead'), 'Видимость', 'and the table head sits inside it');
  assertEqual(sectionOf('platformBody'), 'Видимость', 'as does the table body');
  assertEqual(sectionOf('priceList'), 'Видимость', 'and the two price rows');
  // The visibility section's own markup, for the assertions about its arrangement.
  const group = html.slice(html.indexOf('<section id="visibilityGroup"'),
    html.indexOf('<h2>Дополнительная информация</h2>'));
  // The sub-headings are in the markup, not written: they are the section's own structure and a
  // model has nothing to say about them. There are two, one over each column — the Caster row
  // and the CardTrader row have none, because a heading over a row is a level of structure that
  // holds nothing.
  assertEqual([...html.matchAll(/<h3>([^<]+)<\/h3>/g)]
    .filter(match => ['Платформы', 'Цены и ссылки', 'Интерфейс'].includes(match[1]))
    .map(match => match[1]), ['Платформы', 'Цены и ссылки'],
  'the section has exactly the two sub-headings, in that order, and no Interface heading left');
  assertEqual(sectionOf('setCaster'), 'Видимость',
    'and the Caster row is in the section, though not in the prices column any more');
  assertEqual(sectionOf('cardtraderPanel'), 'Видимость',
    'as does CardTrader, with the prices it fills');
  // The two columns are real elements, and each holds the one heading that belongs to it. This
  // is the arrangement the whole rework is about: a wrong nesting here puts the table under the
  // prices, which is a page that still works and reads in the wrong order.
  //
  // Position rather than slicing: the columns hold divs of their own, so a non-greedy match to the
  // next `</div>` stops inside the first column and every assertion about the second reads the
  // first.
  const at = id => group.indexOf(`id="${id}"`);
  const column1 = group.indexOf('<div class="visibility-column">');
  const column2 = group.indexOf('<div class="visibility-column">', column1 + 1);
  const inFirst = id => at(id) > column1 && at(id) < column2;
  const inSecond = id => at(id) > column2;
  assert(column1 >= 0 && column2 > column1 && /<h3>Платформы<\/h3>/.test(group.slice(column1, column2)),
    'the first column is the platforms, under its own heading');
  assert(inFirst('platformBody') && inFirst('setCaster'),
    'and holds the table and the Caster marker, which is not a price and has no heading of its own');
  assert(inSecond('priceList') && inSecond('cardtraderPrices') && inSecond('euroPriceSources'),
    'the second is the prices: the price groups, CardTrader with the stores it belongs to, and the ' +
    'EUR source');
  assert(!inSecond('setCaster'),
    'and the Caster marker is not among them, because it is not about money');
  // The general switch over the shop block sits inside the shop group and above the shops it
  // governs: a master drawn below the things it masters reads as a summary of them.
  const linksGroup = group.slice(at('priceGroup-links'));
  assert(linksGroup.indexOf('id="setStores"') < linksGroup.indexOf('class="pair-items"'),
    'and the whole-block switch is above the shop boxes inside their group');
  // The EUR box is a price and is drawn from the model, so it is not typed into the currencies
  // group — the only thing the markup says about that group is that it exists.
  const pricesGroup = group.slice(at('priceGroup-prices'), at('priceGroup-links'));
  assert(!/id="price-eur"/.test(pricesGroup),
    'the EUR box is drawn from the model rather than typed into the group');
  // The deck tokens moved out of the hiding group and into the Deckbuilder section, which is
  // where they always belonged and were not. The switch adds one button to one page — the deck
  // page, where Scryfall lists the deck's cards — and nowhere else on the site; it was in the
  // hiding group only because that group used to hold the price and token switches together.
  assertEqual(sectionOf('setTokens'), 'Scryfall Deckbuilder',
    'the deck tokens sit with the deck tools, because that is the only page they appear on');
  assert(!html.includes('id="setFiltersEnabled"') && !html.includes('id="setPlatformsAll"'),
    'the master switch and the all-platforms row are both gone from the markup');
  // Nothing in the table is written out, so a fourth platform or a fourth place is one entry in
  // the model and nothing here. The check that the ids are absent is what says so: a literal
  // row would be a second copy of three names with nothing to notice when they differ.
  assert(!html.includes('id="showPaper"') && !html.includes('id="showArena"') &&
    !html.includes('id="showMtgo"'),
    'the three platform switches are not written out, so the model is their only source');
  assert(!html.includes('id="showPaper-prints"') && !html.includes('id="showArena-search"'),
    'and neither are the nine places, which are the same three names three times over');
  assert(!html.includes('id="price-usd"') && !html.includes('id="price-tcg"'),
    'and the four prices, which the model groups into two rows');
  // The section holds no fieldset at all. Three frames inside a frame says "a group of related
  // settings" three times, and by the third the reader is looking at frames rather than at what
  // is in them; headings and space say it once.
  assert(!/<fieldset/.test(group) && !/<legend/.test(group),
    'and no fieldset or legend anywhere in it, so nothing is drawn as a nested frame');
  assert(!/<p class="hint">/.test(group),
    'and no paragraph of explanation on the page: the notes are in the "?" dialog instead');
  // The controls the markup holds, which is the four that are not drawn from a table: the
  // Caster marker, the whole "Buy This Card" block, and CardTrader's switch and token field.
  // Everything else in the section — the platforms table, the nine places and the five prices —
  // is written by options.js from the model.
  assertEqual([...group.matchAll(/<input[^>]*id="([A-Za-z0-9_-]+)"/g)].map(match => match[1]).sort(),
    ['cardtraderPrices', 'cardtraderToken', 'setCaster', 'setStores'],
    'and exactly the four controls the model cannot draw for it');
  // No platform has a button to open settings, and there is no disclosure over the three
  // places: twelve boxes standing open is the whole shape, and a button over nine of them would
  // be a click for nothing.
  assert(!html.includes('paperDetails') && !html.includes('arenaDetails') &&
    !html.includes('mtgoDetails'),
    'no platform has a settings button, because a button that opens an empty panel is a ' +
    'promise this build cannot keep');
  assertEqual(sectionOf('finishBadges'), 'Дополнительная информация', 'the finish column moved to Additional info');
  assertEqual(sectionOf('cardSearchLinks'), 'Дополнительная информация', 'type and mana search moved to Additional info');
  assertEqual(sectionOf('edhrecUsage'), 'Дополнительная информация', 'EDHREC is a sub-category of Additional info');
  assertEqual(sectionOf('cardtraderPrices'), 'Видимость',
    'CardTrader moved to Visibility, with the prices it fills: it adds a euro column to the ' +
    'prints table and a link to the store block, and it was in Additional info only because that ' +
    'section used to hold every switch that was not about sets');
  assertEqual(sectionOf('setStores'), 'Видимость',
    'and the general switch over the store block sits with the shops it governs');
  assertEqual(sectionOf('setTokens'), 'Scryfall Deckbuilder',
    'the deck token switch moved into the deck tools, which is the only page it appears on');
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
  // Additional info is a list of features, not a pair of sub-categories: no fieldset, no legend,
  // one line per feature, and everything a feature needs beyond its switch behind its own button.
  const additional = html.slice(html.indexOf('<h2>Дополнительная информация</h2>'), html.indexOf('<h2>Легальность</h2>'));
  assert(!/<fieldset/.test(additional) && !/<legend/.test(additional),
    'Additional info holds no fieldset and no legend, so nothing in it is drawn as a frame');
  const rows = [...additional.matchAll(/<div class="feature-row"[^>]*>[\s\S]*?<\/div>/g)];
  assert(rows.length >= 4,
    'the section is a list of feature rows, one per feature (' + rows.length + ' found)');
  // Every disclosure is a button that names the panel it opens, and the panel is a sibling.
  // A button whose `aria-controls` names nothing is a button that does nothing, and it looks
  // exactly like one that works.
  const toggles = [...additional.matchAll(/id="([A-Za-z]+Toggle)"[^>]*aria-controls="([A-Za-z]+)"/g)];
  assertEqual(toggles.map(match => match[2]), ['edhrecUsagePanel', 'edhrecSaltPanel'],
    'the two disclosures name their panels, in the order the section reads');
  for (const [, , panel] of toggles) {
    assert(additional.includes(`id="${panel}"`), `and the panel ${panel} is in the markup`);
  }
  // Collapsed when the page opens, whatever the feature is set to. A panel that starts open
  // makes the section a form again, which is the thing this shape exists to stop being.
  assertEqual([...additional.matchAll(/<div class="feature-panel[^>]*>/g)]
    .filter(match => !/hidden/.test(match[0])).length, 0,
  'every panel starts hidden, whatever the feature it belongs to is set to');
  // The panels hold the fields that used to stand in the body, and nothing is left standing
  // outside one: a threshold outside a panel is a threshold with no button to explain it.
  //
  // Containment is worked out by counting div tags rather than by looking for the next `</div>`,
  // because a panel holds divs of its own — a threshold row is a div — and the first close tag
  // after a field is the end of the row it is in, not the end of the panel.
  const closeOfDiv = (text, open) => {
    const re = /<div\b|<\/div>/g;
    re.lastIndex = open;
    let depth = 0;
    let match;
    while ((match = re.exec(text))) {
      depth += match[0] === '</div>' ? -1 : 1;
      if (depth === 0) return match.index;
    }
    return -1;
  };
  for (const id of ['edhrecUsageDisplay', 'usageColorMetric', 'usageMediumDecks', 'usageHighDecks',
    'usageMediumPercent', 'usageHighPercent', 'showSaltScale', 'saltMediumThreshold',
    'saltHighThreshold']) {
    const at = additional.indexOf(`id="${id}"`);
    const panel = additional.lastIndexOf('<div class="feature-panel', at);
    assert(panel >= 0 && at < closeOfDiv(additional, panel),
      `${id} sits inside a panel rather than in the list`);
  }
  // And the two that left. CardTrader is a price feature — it adds a euro column and a store
  // link — so it lives with the prices now, and the EUR source with the shops it chooses
  // between. A price setting in a list of things that are not prices is a setting nobody looks
  // for where it is.
  for (const id of ['euroPriceSources', 'cardtraderPrices', 'cardtraderToken', 'cardtraderPanel']) {
    assert(!additional.includes(`id="${id}"`), `${id} is not in Additional info at all`);
    assertEqual(sectionOf(id), 'Видимость', `${id} sits in Visibility`);
  }
  // The one help icon the list carries, and the help the panels carry. `data-help` names an
  // entry in the page's own help table, and a name the table does not have disables the button
  // rather than opening an empty dialog. CardTrader's is in Visibility now, with the row it
  // explains, and the section-wide check below still counts it.
  const helps = [...additional.matchAll(/data-help="([a-z]+)"/g)].map(match => match[1]);
  assertEqual(helps, ['finishes', 'usage', 'salt'],
    'each feature that has more to say than its name carries a help button');
  // The one that used to be here and is not: the nicknames feature was cut, so its row and its
  // help went with it. A "?" whose feature is gone is a button that explains nothing.
  assert(!additional.includes('data-help="nicknames"'),
    'and the nicknames help is gone with the feature it explained');
  // The long paragraphs are gone from the body. Every one of them is in the help table instead,
  // which is what `untranslatedTextTest` above cannot see: a paragraph moved into the dialog is
  // still a paragraph, and one left behind is a paragraph nobody reads.
  assert(!/<p class="hint">/.test(additional),
    'and no paragraph of explanation stands in the section: the long ones are behind a "?"');
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
  console.log('options.js: three platform switches, no master, each with its own three places');
  const page = await groupReady(loadOptions({}));
  const { document, mock } = page;
  const F = page.context.STK_SET_FILTERS;
  const boxes = ['showPaper', 'showArena', 'showMtgo'].map(id => document.getElementById(id));
  const kept = () => F.PLATFORM_NAMES.filter(name =>
    mock.state.setFilters.platforms[name].show === true);
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
  assertEqual(kept(), ['paper'], 'leaving Paper alone is stored as the only platform');

  // All three off is a choice, not a state to be rescued. The earlier build put a master
  // above these and quietly restored them, which meant unchecking the last one appeared to
  // do nothing and came back on reload.
  boxes[0].checked = false;
  fireEvent(boxes[0], 'change');
  await tick();
  assertEqual(kept(), [], 'and turning the last one off is stored as that, rather than undone');
  assertEqual(boxes.map(box => box.checked), [false, false, false], 'the boxes show it');

  // The requirement that a platform keeps its own places while it is off. The switch and the
  // three switches under it write different keys, and this is what proves neither rewrites
  // the other: a place changed while Paper is off is still there when it comes back.
  const paperSets = document.getElementById('showPaper-sets');
  paperSets.checked = false;
  fireEvent(paperSets, 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.paper.areas.sets, false,
    "Paper's own places are still editable while Paper is off");
  assertEqual(kept(), [], 'and changing one of them did not switch Paper back on');
  boxes[0].checked = true;
  fireEvent(boxes[0], 'change');
  await tick();
  assertEqual(kept(), ['paper'], 'Paper comes back');
  assertEqual(mock.state.setFilters.platforms.paper.areas,
    { prints: true, search: true, sets: false },
    'and its places are exactly as they were left');
  // Nothing dims anything, and there is nothing to dim with: a switch that writes one key and
  // nine switches under it stay operable, because a disabled control is one the reader cannot
  // answer with — and the three places are the only record of what comes back with the switch.
  assert(!document.getElementById('visibilityGroup').disabled,
    'and nothing dims them, because there is no master switch to dim anything with');
  assert(!paperSets.disabled, 'including the place that is switched off itself');

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
// The visibility section, drawn from the model. The point of these is that the page cannot
// drift away from src/core/set-filters.js: a column the page shows and the model does not
// store is a switch that looks on and does nothing, which is the defect this whole
// section was rebuilt to end.
async function hidingGroupTest() {
  console.log('options.js: the visibility section is the model, drawn and not retyped');
  const page = await groupReady(loadOptions({ settingsLanguage: 'en' }));
  const { document, mock, context } = page;
  const F = context.STK_SET_FILTERS;
  const t = context.STK_I18N.t;
  const q = id => document.getElementById(id);

  // The shape first: a table of platforms, because a reader asking two questions about one
  // platform — "out of the dropdown, but still in the table" — needs a column and a row, and a
  // stack of three blocks with a disclosure under each cannot hold both answers at once.
  const heads = [...document.getElementById('platformHead').querySelectorAll('th')];
  assertEqual(heads.map(cell => cell.textContent),
    ['Platform', 'Show', 'Prints table', 'Search', 'Sets list'],
    'the five column headings are the model\'s own words, in the model\'s order');
  assert(heads.every(cell => cell.getAttribute('scope') === 'col'),
    'and every one of them is a column header, so a screen reader says the column when a box in it ' +
    'is reached rather than leaving the reader to count');

  const rows = [...document.getElementById('platformBody').querySelectorAll('tr')];
  assertEqual(rows.length, F.PLATFORM_NAMES.length, 'one row per platform in the model, and no others');
  for (const [index, name] of F.PLATFORM_NAMES.entries()) {
    const row = rows[index];
    const label = row.querySelector('th');
    assertEqual(label.textContent, F.PLATFORM_LABELS[name],
      `the row for ${name} is named with the platform, not with a setting`);
    assertEqual(label.getAttribute('scope'), 'row',
      `and it is a row header, so it is read out with each box in the row rather than once at the top`);
    // The platform's own box and its three places: four controls, all of them from the model.
    const places = [...row.querySelectorAll('input[data-which]')];
    assertEqual(places.map(box => box.dataset.which), F.AREA_NAMES,
      `${name} has one place per area in the model, in the model's order`);
    assertEqual(row.querySelectorAll('input[data-kind=show]').length, 1,
      `and exactly one box of its own for ${name}`);
    assertEqual(places.every(box => box.checked), true,
      `every place starts in force, like every other switch on a page nobody has touched`);
    // Every cell of the row, against every heading above it — in order, by column.
    //
    // This is the assertion that was missing when the Show box was prepended instead of
    // appended: every id was right, every box behaved, and the table drew each control under
    // the heading for the column to its left. Reading boxes by id cannot see that; reading the
    // row left to right against the header can, and it is the only reading that describes what
    // the page looks like.
    assertEqual([...row.children].map(cell => {
      const box = cell.querySelector('input');
      return box ? box.dataset.which || 'show' : cell.textContent.trim();
    }),
      [F.PLATFORM_LABELS[name], 'show', ...F.AREA_NAMES],
      `the ${name} row has a cell for each heading, in the headings' order, so no box is drawn ` +
      'under the wrong column');
  }

  // Checked means shown, everywhere in the table, with no exception to remember. The columns
  // are not labelled "hide", the boxes are not inverted, and a default is everything ticked —
  // so the page can be read with no knowledge of this file at all.
  assertEqual([q('showPaper').checked, q('showArena').checked, q('showMtgo').checked], [true, true, true],
    'Paper starts shown, and the two digital platforms start shown too');

  // Every box is named by what it does, in words that include the platform. Twelve checkboxes
  // are twelve anonymous targets otherwise, and the row header is not enough: a screen reader
  // announces a row header once, so three of the four boxes in it would go by unsaid.
  for (const name of F.PLATFORM_NAMES) {
    const platform = F.PLATFORM_LABELS[name];
    assertEqual(q('show' + name[0].toUpperCase() + name.slice(1)).getAttribute('aria-label'),
      `${platform}: show`, `${name} is announced by its name and what its own box is for`);
    for (const area of F.AREA_NAMES) {
      const box = q('show' + name[0].toUpperCase() + name.slice(1) + '-' + area);
      // `t` and not the model's own string: the model holds Russian and the page is English, so
      // comparing against the model would pass only if the name were never translated. The
      // language is named rather than left to the default, which is Russian.
      assertEqual(box.getAttribute('aria-label'), `${platform}: ${t(F.AREAS[area].aria, 'en')}`,
        `${name}'s ${area} box is announced by name and purpose, not by its column alone`);
      assert(!/[А-Яа-я]/.test(box.getAttribute('aria-label')),
        'and in the page language rather than the model\'s');
    }
  }

  // The two answers a reader who wants Arena in the table but out of the dropdown has to be
  // able to give, and they are two boxes on one row. With one shared list of places this was
  // impossible: the same three boxes would have moved all three platforms, or answering about
  // one place would have moved the other two.
  const arenaSearch = q('showArena-search');
  const arenaPrints = q('showArena-prints');
  arenaSearch.checked = false;
  fireEvent(arenaSearch, 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.arena.areas.search, false,
    'one place of one platform is stored on its own');
  assertEqual(mock.state.setFilters.platforms.arena.areas.prints, true,
    'the same platform keeps its other places');
  assertEqual(mock.state.setFilters.platforms.paper.areas.search, true,
    'and Paper keeps all of its own, which is the whole point of the shape');
  assertEqual(mock.state.setFilters.platforms.mtgo.areas.search, true,
    'as does Magic Online');
  arenaPrints.checked = false;
  fireEvent(arenaPrints, 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.arena.areas,
    { prints: false, search: false, sets: true },
    'and the third place is untouched by the two that were changed');
  assertEqual(mock.state.setFilters.platforms.paper.areas,
    { prints: true, search: true, sets: true },
    'while Paper is still entirely in force, so the page can be in two states at once');

  // A platform switched off: its own box is empty, its three place boxes are empty and out of
  // reach, and its row is dimmed. That is the page saying what is in force.
  //
  // None of it is allowed to reach the stored value. The three places are what the reader
  // chose, and a page that empties them because the platform is off would throw the choice
  // away — which is the one thing "turning a platform off keeps its settings" must not mean.
  const arena = q('showArena');
  arena.checked = false;
  fireEvent(arena, 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.arena.show, false,
    'the platform box stores its own key');
  assertEqual(mock.state.setFilters.platforms.arena.areas,
    { prints: false, search: false, sets: true },
    'and leaves its three places exactly as they were, while it is off');
  assertEqual(arena.checked, false, 'and its own box is drawn empty');
  assertEqual(arena.disabled, false,
    'while the platform box stays operable, because it is the only way back and a disabled ' +
    'control that is the only way out of a state is a trap');
  assertEqual([...rows[1].querySelectorAll('input[data-which]')]
    .map(box => [box.checked, box.disabled]),
    [[false, true], [false, true], [false, true]],
    'its three place boxes are drawn empty and disabled, and the one that is still on in the ' +
    'stored value is drawn empty too — the boxes say what is in force, not what is stored');

  // Re-enabling brings the places back as they were, rather than as the defaults. This is the
  // case where the two answers above survive: a reader who turns Arena off for a moment and
  // back on has not asked to have Arena's places reset.
  arena.checked = true;
  fireEvent(arena, 'change');
  await tick();
  assertEqual(mock.state.setFilters.platforms.arena.show, true, 'the platform comes back');
  assertEqual(mock.state.setFilters.platforms.arena.areas,
    { prints: false, search: false, sets: true },
    'with all three of its own choices intact, which is what came back with it');
  assertEqual([...rows[1].querySelectorAll('input[data-which]')]
    .map(box => [box.checked, box.disabled]), [[false, false], [false, false], [true, false]],
    'and the boxes show those choices again, editable');

  // A reader who unticks all three places on a platform that is on has said so. Nothing puts
  // them back, and nothing moves the platform's own box either — the page has no opinion about
  // a choice like that, and one that tidied it up would be a setting the reader cannot set.
  for (const id of ['showPaper-prints', 'showPaper-search', 'showPaper-sets']) {
    q(id).checked = false;
    fireEvent(q(id), 'change');
  }
  await tick();
  assertEqual(mock.state.setFilters.platforms.paper.areas,
    { prints: false, search: false, sets: false }, 'all three places of a shown platform can be off');
  assertEqual(q('showPaper').checked, true, 'and the platform box is not moved on the reader\'s behalf');
  for (const id of ['showPaper-prints', 'showPaper-search', 'showPaper-sets']) {
    q(id).checked = true;
    fireEvent(q(id), 'change');
  }
  await tick();

  // And the model hands the page back exactly what the page stored, so the page and the
  // rules cannot disagree about what a reader chose.
  const stored = mock.state.setFilters;
  assertEqual(F.effective(stored).platforms.arena.areas,
    stored.platforms.arena.areas,
    'the model reads the page\'s own value back');
  assertEqual(Object.keys(stored.platforms.arena).sort(), ['areas', 'show'],
    'and a platform holds nothing but a box and its three places');

  // The prices: two groups rather than four switches, because a currency is a column of numbers
  // and a shop is a link. Positive, like everything else here, and the assertion is in the
  // direction that matters — unticking one turns that one off and leaves the other three on.
  //
  // Read as caption-then-boxes, which is the arrangement: a caption beside its boxes needs a
  // column as wide as the longest caption and that column is empty on every other row.
  const priceList = document.getElementById('priceList');
  const priceGroups = [...priceList.querySelectorAll('.pair-group')];
  assertEqual(priceGroups.map(row => row.querySelector('.pair-caption').textContent),
    ['Prices', 'Store links'],
    'the two groups are the model\'s two, in the model\'s order, each with its own caption');
  assertEqual(priceGroups.map(row => [...row.querySelectorAll('.pair-items input[data-which]')]
    .map(box => box.dataset.which)),
    [['usd', 'tix', 'eur'], ['tcg', 'cardhoarder', 'cardmarket']],
    'and each holds the kinds the model put in it, so a kind cannot be left out of a group');
  assert(priceGroups.every(group => group.firstElementChild.classList.contains('pair-caption')),
    'with the caption above the boxes rather than beside them, so there is no empty column ' +
    'between a label and the control it labels');
  assertEqual([...priceList.querySelectorAll('input[data-which]')].map(box => box.checked),
    [true, true, true, true, true, true],
    'all six start shown, which is what a default has to mean');
  assertEqual([...priceList.querySelectorAll('input[data-which]')]
    .map(box => box.getAttribute('aria-label')),
    ['USD: show', 'TIX: show', 'EUR: show', 'TCGplayer: show', 'Cardhoarder: show', 'Cardmarket: show'],
    'and each is announced by its name and what it is for');
  const priceBox = kind => q('price-' + kind);
  priceBox('tcg').checked = false;
  fireEvent(priceBox('tcg'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.prices,
    { usd: true, tix: true, eur: true, tcg: false, cardhoarder: true, cardmarket: true },
    'unticking one kind of price turns that one off alone');
  assertEqual(mock.state.setFilters.platforms.paper.areas.prints, true,
    'and touching a price touches no platform');
  // Cardmarket is a shop and the euro column is a currency, so the two are two switches: one hides
  // a link and the other hides a column. The old build had one button doing both, which meant the
  // answer to "hide the euro price" lived under a shop's name.
  priceBox('cardmarket').checked = false;
  fireEvent(priceBox('cardmarket'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.prices.cardmarket, false,
    'and Cardmarket can be hidden on its own, which is what a reader who does not trade there ' +
    'needs');
  priceBox('cardmarket').checked = true;
  fireEvent(priceBox('cardmarket'), 'change');
  await tick();
  // And the box reads back what it stored, which is the half an inverted group gets wrong: the
  // page writes "shown" and reads "hidden", or the other way round, and the boxes end up showing
  // the opposite of what the page is doing.
  priceBox('tcg').checked = true;
  fireEvent(priceBox('tcg'), 'change');
  await tick();
  assertEqual([...priceList.querySelectorAll('input[data-which]')].map(box => box.checked),
    [true, true, true, true, true, true],
    'and ticking it back shows all six again rather than leaving one stuck');

  // The EUR box and the EUR source are two handles on one question, and this is where they are
  // kept in step. The box says whether the euro column exists; the dropdown says whose number is
  // in it. A dropdown that chooses what fills a column that is not there has nothing to do, so it
  // is blocked and set to "show nothing" while the box is clear.
  const euroBox = q('price-eur');
  const euroSource = q('euroPriceSources');
  const euroShield = q('euroSourceShield');
  assertEqual([euroBox.checked, euroSource.disabled, euroShield.hidden], [true, false, true],
    'with the EUR box ticked the source is free and nothing covers it');
  euroBox.checked = false;
  fireEvent(euroBox, 'change');
  await tick();
  assertEqual(mock.state.setFilters.prices.eur, false, 'unticking EUR stores that the column is off');
  assertEqual(mock.state.euroPriceSources, 'none',
    'and sets the source to "show nothing" rather than leaving it choosing a column that is gone');
  assertEqual([euroSource.value, euroSource.disabled, euroShield.hidden], ['none', true, false],
    'with the dropdown blocked and covered');
  // A disabled select swallows clicks, so the thing a reader presses is the shield over it. It is
  // a real button, it is reachable by keyboard, and it says why.
  euroShield.click();
  await tick();
  assert(euroBox.classList.contains('stk-blink'),
    'pressing the blocked dropdown flashes the box that has to change first');
  assert(/price source cannot be chosen/.test(q('status').textContent),
    'and says why, in the page\'s own status line (' + q('status').textContent.slice(0, 60) + ')');
  // The dropdown is the other handle: a reader who sets it to "show nothing" has said the same
  // thing as clearing the box, and the two must not be able to disagree.
  euroBox.checked = true;
  fireEvent(euroBox, 'change');
  await tick();
  assertEqual([mock.state.setFilters.prices.eur, mock.state.euroPriceSources], [true, 'cm'],
    'ticking the box back gives the source something to fill the column with');
  assertEqual([euroSource.disabled, euroShield.hidden], [false, true], 'and frees the dropdown');
  euroSource.value = 'none';
  fireEvent(euroSource, 'change');
  await tick();
  assertEqual([euroBox.checked, mock.state.setFilters.prices.eur], [false, false],
    'and setting the dropdown to "show nothing" clears the box, because it is the same answer');
  euroSource.value = 'both';
  fireEvent(euroSource, 'change');
  await tick();
  assertEqual([euroBox.checked, mock.state.setFilters.prices.eur], [true, true],
    'while any real source ticks it back, since a column that is filled is a column that is there');

  // The Caster marker. Its old switch read "hide" and this one reads "show", so the stored key
  // was renamed rather than inverted in place — the rename is what lets the migration tell the
  // two senses apart, and a rename that were done as a bare inversion would flip the marker for
  // every reader on the first page load after an update.
  assertEqual(q('setCaster').checked, true, 'the Caster marker starts shown');
  assertEqual(q('setCaster').parentElement.textContent.trim(), 'Show Caster ON indicator',
    'and it says what the box does, in the page language');
  q('setCaster').checked = false;
  fireEvent(q('setCaster'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.showCaster, false, 'unticking it stores "not shown"');
  q('setCaster').checked = true;
  fireEvent(q('setCaster'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.showCaster, true, 'and ticking it back stores "shown"');

  // The whole "Buy This Card" block. It is not a price kind — it is the container the three shop
  // links live in — so it is stored on its own key, and the box is the general switch over the
  // shops the group above it lists one by one.
  assertEqual(q('setStores').checked, true, 'the store block starts shown');
  assertEqual(q('setStores').parentElement.textContent.trim(), 'Show the “Buy This Card” block',
    'and it names the block rather than a shop, because that is what it hides');
  q('setStores').checked = false;
  fireEvent(q('setStores'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.showStores, false,
    'unticking it stores that the whole block is hidden');
  assertEqual(mock.state.setFilters.prices,
    { usd: true, tix: true, eur: true, tcg: true, cardhoarder: true, cardmarket: true },
    'and it turns no shop off in storage: the block is the general switch and the shops are the ' +
    'particular ones, so hiding the block does not lose the reader\'s per-shop choices');
  // What the reader sees instead: a shop is a link inside that block, so with the block hidden
  // its box has nowhere to be shown and is drawn off and out of reach. The three currencies are
  // columns and are not in the block, so they are left alone.
  assertEqual([...priceList.querySelectorAll('input[data-which]')].map(box => [box.checked, box.disabled]),
    [[true, false], [true, false], [true, false], [false, true], [false, true], [false, true]],
    'and the three shop boxes are drawn empty and disabled while the block is off');
  q('setStores').checked = true;
  fireEvent(q('setStores'), 'change');
  await tick();
  assertEqual(mock.state.setFilters.showStores, true, 'and ticking it back stores "shown"');
  assertEqual([...priceList.querySelectorAll('input[data-which]')].map(box => [box.checked, box.disabled]),
    [[true, false], [true, false], [true, false], [true, false], [true, false], [true, false]],
    'with the shops back as the reader left them, which is what drawing them from the stored ' +
    'values rather than writing to them buys');

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
    hideOversizedSets: true,
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

  // What the reader is shown. The platform whitelist was the only one of the old switches
  // with somewhere to go; the four set rules had none, and a page that drew them would be
  // offering a setting nothing reads.
  assertEqual([document.getElementById('showPaper').checked,
    document.getElementById('showArena').checked,
    document.getElementById('showMtgo').checked], [true, false, false],
    'and the platform list is drawn as the whitelist left it');
  assertEqual([...document.getElementById('platformBody').querySelectorAll('input[data-which]')]
    .slice(0, 3).map(box => box.checked), [true, true, true],
    'with all three of its places in force, because that old shape named no place');
  // Arena was off in that old whitelist, and its three places are drawn with it — not kept at
  // their defaults and shown as if they were live. What they hold underneath is not thrown away.
  assertEqual([...document.getElementById('platformBody').querySelectorAll('tr')[1]
    .querySelectorAll('input[data-which]')].map(box => [box.checked, box.disabled]),
    [[false, true], [false, true], [false, true]],
    'and the two platforms that were off are drawn dimmed and out of reach, with their places intact');
  assertEqual(mock.state.setFilters.platforms.arena.areas,
    { prints: true, search: true, sets: true },
    'while the stored places under them are untouched, so the platforms come back as they were');
  assertEqual([...document.getElementById('priceList').querySelectorAll('input[data-which]')]
    .map(box => box.checked),
  [false, false, true, false, false, true],
  'and the kinds that one switch used to turn off are all drawn as off — which is what "only ' +
  'Cardmarket" meant — while Cardmarket and the euro column, which is its price, stay ticked');
  // The marker used to be stored as "hide". Its box now reads "show", so a reader who had it
  // hidden is drawn with it unticked. Reading the old boolean the new way round would have
  // drawn it ticked — a box that looks like the setting they had, meaning the opposite.
  assertEqual(document.getElementById('setCaster').checked, false,
    'and the Caster marker, which was stored as a hide and is now a "show" box drawn empty');
  assertEqual(mock.state.setFilters.showCaster, false,
    'stored the way the box reads, which is the opposite of what the old key said');
  assert(document.getElementById('setTokens').checked === false,
    'and the deck tokens, whose old switch was positive');
  // The four removed rules are not on the page and nothing of them is in what was stored, so
  // a reader who had every one of them on gets every set back. That is the one part of the
  // migration that cannot be carried across: "hide this set" is not a thing this shape can
  // say, and answering it any other way would be inventing a setting.
  assertEqual(Object.keys(mock.state.setFilters).sort(),
    ['platforms', 'prices', 'showCaster', 'showStores', 'tokens'],
    'and nothing from any of the four removed rules is left in the stored shape');
  assert(!('caster' in mock.state.setFilters),
    'and the key that stored the marker the other way round is gone rather than kept beside it');

  // A reader already migrated to one of the earlier nested shapes must not be migrated twice,
  // and their platform choice must survive the change of words. This is the case the reduction
  // is most likely to lose: a stored block written by 1.1.4–1.3.0 or by 1.4.x–1.5.x is neither
  // the flat booleans of the first migration nor the per-platform shape of this one.
  const stale = await groupReady(loadOptions({
    ...old, setFiltersMigrated: true,
    setFilters: {
      setsEnabled: true,
      platforms: { paper: true, arena: false, mtgo: true },
      areas: { prints: false, search: true, sets: true },
      sets: {
        nonTournament: true,
        oversized: false,
        foreignOnly: true,
        foreignBlackBorder: { surfaces: 'sets-prints', which: ['4bb'] },
        nonEnglish: { surfaces: 'sets-prints', which: ['portal', 'secret-lair', 'other'] }
      }
    }
  }));
  // What is asserted here is what the page drew, because that is what the reader sees: a
  // value already marked migrated is not written back, so storage still holds the old
  // shape and asking `effective()` about it would test the stored value rather than the
  // migration.
  assertEqual(
    ['showPaper', 'showArena', 'showMtgo'].map(id => stale.document.getElementById(id).checked),
    [true, false, true], 'the 1.1.4 platform switches are drawn as stored');
  assertEqual(
    ['showPaper-prints', 'showPaper-search', 'showPaper-sets']
      .map(id => stale.document.getElementById(id).checked),
    [false, true, true],
    'and its one shared list of places is drawn on every platform, unchanged — the reader ' +
    'made one answer, not three');

  // The same reader one shape later, from 1.4.x–1.5.x, where the shared list still existed and
  // Paper carried five rules that are gone.
  const newer = await groupReady(loadOptions({
    ...old, setFiltersMigrated: true,
    setFilters: {
      platforms: { paper: true, arena: true, mtgo: false },
      areas: { prints: true, search: false, sets: true },
      paper: {
        ancillary: false,
        nonEnglish: 'analogue',
        nonTournament: true, oversized: true, noEnglishSets: false,
        foreignBlackBorder: { '4bb': false, fbb: false, bchr: false }
      }
    }
  }));
  assertEqual(
    ['showPaper', 'showArena', 'showMtgo'].map(id => newer.document.getElementById(id).checked),
    [true, true, false], 'and the 1.4.x platform switches are drawn as stored');
  assertEqual(
    ['showArena-search', 'showArena-prints', 'showArena-sets']
      .map(id => newer.document.getElementById(id).checked),
    [false, true, true],
    'with that build\'s single list of places spread over all three platforms, Magic Online ' +
    'included — a platform that is switched off keeps the places it had, so it comes back ' +
    'as it was rather than as the defaults');

  // Storage still holds the old shapes, and that is correct: a value already marked migrated
  // is not written back, because writing a half-translated one back would destroy the very
  // thing that says which of the two older shapes this reader is on. The page drew this
  // shape's answer from it and left the original alone.
  assertEqual(Object.keys(stale.mock.state.setFilters).sort(),
    ['areas', 'platforms', 'sets', 'setsEnabled'],
    'and the 1.1.4 value is left in storage rather than half-rewritten');

  // Both stored values are still in their old shape, so asking the model to read them is
  // asking about the migration, and it has to give the same answer the page drew above. Two
  // readers, two old shapes, one model, and the page and the model agreeing on both.
  const staleStored = F.upgrade(stale.mock.state.setFilters);
  assertEqual([staleStored.platforms.arena.show, staleStored.platforms.paper.areas.prints],
    [false, false], 'and the model reads the 1.1.4 value the same way the page drew it');
  const newerStored = F.upgrade(newer.mock.state.setFilters);
  assertEqual([newerStored.platforms.mtgo.show, newerStored.platforms.arena.areas.search],
    [false, false], 'and the 1.4.x value too');
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

  // Read out of the `SHOTS` object only. `FEATURE_HELP` below it has the same shape — a name, a
  // brace, a caption — and a regex that walked the whole file would count the help entries as
  // pictures and then look for a PNG named "salt".
  const shotsBlock = script.slice(script.indexOf('const SHOTS = {'), script.indexOf('const FEATURE_HELP'));
  const shots = [...shotsBlock.matchAll(/^\s{4}'?([a-z-]+)'?:\s*\{\s*$/gm)].map(match => match[1]);
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

  // The caption of each picture is translated like every other string on the page, and so is
  // every help entry — a caption is read by the same reader, and an English page with a Russian
  // paragraph behind one "?" is half in one language for exactly the thing that was moved there
  // to be read carefully.
  const captions = [...shotsBlock.matchAll(/caption: '([^']+)'/g)].map(match => match[1]);
  assertEqual(captions.length, named.length,
    'every illustration has a caption, and every caption has an illustration');
  const helpBlock = script.slice(script.indexOf('const FEATURE_HELP'), script.indexOf('const shotDialog'));
  const helpText = [...helpBlock.matchAll(/'([^']{5,})'/g)].map(match => match[1]);
  assert(helpText.length >= 10,
    'the help table carries a caption and its paragraphs (' + helpText.length + ' strings)');
  const i18n = read('src/core/i18n.js');
  const untranslated = [...captions, ...helpText].filter(text => !i18n.includes(text));
  assertEqual(untranslated, [], 'and every caption and every help paragraph is in the dictionary, ' +
    'so an English page is not half Russian');
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

// Additional info is a list of features, each with its own settings behind a button, and the
// settings work whether or not the button has ever been pressed.
//
// Three claims, and each of them is a way this shape could be wrong while looking right: a
// panel that starts open (which makes the section a form again), a disclosure that writes to
// storage (which would make opening a panel a decision), and a reset that takes the whole
// section with it instead of its own feature's numbers.
async function featureRowsTest() {
  console.log('options.js: Additional info is a list of features, each with its own panel');
  const page = await groupReady(loadOptions({
    finishBadges: true,
    edhrecUsage: true, edhrecSalt: false,
    edhrecUsageDisplay: 'percent', usageColorMetric: 'percent',
    usageMediumPercent: 3, usageHighPercent: 9,
    showSaltScale: true, saltMediumThreshold: 1.5, saltHighThreshold: 3
  }));
  const { document, mock } = page;
  const q = id => document.getElementById(id);
  // The two disclosures this section has left. CardTrader's moved to Visibility with the prices
  // it fills, and the "Дополнительные настройки" button went with the last setting it held.
  const panels = ['edhrecUsagePanel', 'edhrecSaltPanel'];
  const toggles = ['edhrecUsageToggle', 'edhrecSaltToggle'];

  // Collapsed when the page opens, whatever the feature is set to. One of these two is on and
  // has been configured, and its panel is still shut: the panel is about changing the numbers,
  // and a reader who has already chosen them does not need it.
  for (const panel of panels) assert(q(panel).hidden === true, `${panel} starts collapsed`);
  for (const toggle of toggles) {
    assertEqual(q(toggle).getAttribute('aria-expanded'), 'false',
      `${toggle} tells a screen reader it is collapsed, and the panel is what says otherwise`);
    assertEqual(q(toggle).getAttribute('aria-controls'), panels[toggles.indexOf(toggle)],
      'and names the panel it opens, so the two cannot come apart');
  }

  // The switch on the row is the whole of turning a feature on: it saves on its own, with no
  // panel opened and nothing else visited.
  q('finishBadges').checked = false;
  fireEvent(q('finishBadges'), 'change');
  await tick();
  assertEqual(mock.state.finishBadges, false,
    'a feature switch saves without its panel ever being opened');

  // Opening and closing writes nothing at all. This is the assertion that keeps "Настроить" a
  // disclosure rather than a step: a reader who opens a panel to look at it has changed nothing,
  // and one who never opens it has lost nothing.
  const before = JSON.stringify(mock.state);
  q('edhrecUsageToggle').click();
  await tick();
  assertEqual(q('edhrecUsagePanel').hidden, false, 'the button opens its own panel');
  assertEqual(q('edhrecUsageToggle').getAttribute('aria-expanded'), 'true', 'and says so');
  assertEqual(q('edhrecSaltPanel').hidden, true, 'and only its own panel');
  q('edhrecUsageToggle').click();
  await tick();
  assertEqual(q('edhrecUsagePanel').hidden, true, 'the second press closes it again');
  assertEqual(q('edhrecUsageToggle').getAttribute('aria-expanded'), 'false', 'and says so');
  assertEqual(JSON.stringify(mock.state), before,
    'and none of that touched a setting, which is what makes the panel optional');

  // What is stored is what the panel shows, so a reader who set these numbers once finds them
  // where they left them rather than at the defaults.
  assertEqual(q('edhrecUsageDisplay').value, 'percent', 'the panel shows the saved display format');
  assertEqual(q('usageColorMetric').value, 'percent', 'and the saved colouring metric');
  assertEqual([q('usageMediumPercent').value, q('usageHighPercent').value], ['3', '9'],
    'and the saved thresholds, not the defaults');
  assertEqual([q('saltMediumThreshold').value, q('saltHighThreshold').value], ['1.5', '3'],
    'and the Salt ones, in the panel that is shut');

  // A reset is that feature's numbers and nothing else. The popularity reset must not touch the
  // Salt ones, must not touch the switches, and must not touch the other feature's block.
  q('resetUsage').click();
  await tick();
  assertEqual([mock.state.edhrecUsageDisplay, mock.state.usageColorMetric], ['both', 'decks'],
    'the popularity reset restores the display format and the metric');
  assertEqual([mock.state.usageMediumPercent, mock.state.usageHighPercent], [1, 2.6],
    'and the percentage thresholds');
  assertEqual(mock.state.usageMediumDecks, 50000, 'and the deck-count ones, which it did not show');
  assertEqual([mock.state.saltMediumThreshold, mock.state.saltHighThreshold], [1.5, 3],
    'while the Salt thresholds are exactly where the reader left them');
  assertEqual(mock.state.edhrecUsage, true,
    'and the switch is not moved: "these numbers are wrong" is not "turn this off"');
  q('resetSalt').click();
  await tick();
  assertEqual([mock.state.showSaltScale, mock.state.saltMediumThreshold, mock.state.saltHighThreshold],
    [false, 1, 2], 'and the Salt reset restores its own three');
  assertEqual([mock.state.edhrecUsageDisplay, mock.state.usageColorMetric], ['both', 'decks'],
    'without reaching into the popularity settings the other reset had just put back');

  // The help. It is the same dialog the section "?" uses, so a reader who has opened one has
  // opened them all — and it is a button, so it is reached by Tab and opened by Enter, which a
  // `title` tooltip is not. Every one of them is checked as wired, because a `data-help` that
  // names nothing leaves the button disabled and looking exactly like one that works — and
  // CardTrader's moved sections this round, which is when a name gets typed wrong.
  for (const button of document.querySelectorAll('.feature-help')) {
    assert(!button.disabled,
      `the help named ${button.dataset.help} is an entry in the page's help table`);
  }
  document.querySelector('[data-help="finishes"]').click();
  await tick();
  assertEqual(document.getElementById('shotCaption').textContent, 'Доступная отделка изданий',
    'the feature help names the feature it is about');
  assertEqual(document.getElementById('shotImage').hidden, true,
    'and carries no picture, because what moved here is a paragraph');
  assert(/фойл/.test(document.getElementById('shotNotes').textContent),
    'with the explanation that used to stand in the body of the page');
  document.querySelector('.shot-button[data-shot="additional"]').click();
  await tick();
  assertEqual(document.getElementById('shotImage').hidden, false,
    'while a section "?" still shows its picture, in the same dialog');
}

// CardTrader is the one feature that cannot work without being set up, so its row has a second
// shape. Without a token the switch is not offered at all — a switch that turns on a request
// that cannot be made is a switch that lies — and with one it appears, and the token becomes
// something to replace or remove rather than something still to find.
async function cardtraderRowTest() {
  console.log('options.js: CardTrader asks for what it needs before it offers a switch');
  const page = await groupReady(loadOptions({ cardtraderPrices: false }));
  const { document, mock } = page;
  const q = id => document.getElementById(id);

  assertEqual(q('tokenStatus').textContent, 'Не подключено',
    'with no token the row says so rather than showing a switch that would do nothing');
  assertEqual(q('cardtraderToggle').textContent, 'Подключить', 'and the button offers to connect');
  assert(q('cardtraderMain').classList.contains('is-unconnected'),
    'and the switch is hidden, not merely disabled: it is not a control the reader may not have');
  assertEqual(q('cardtraderTokenRow').hidden, false, 'the field is what the row is asking for');

  q('cardtraderToggle').click();
  await tick();
  assertEqual(q('cardtraderPanel').hidden, false, 'and the panel opens on it');
  q('cardtraderToken').value = 'ct-token-1';
  q('saveToken').click();
  await tick();
  assertEqual(mock.state.cardtraderToken, 'ct-token-1', 'saving stores the token');
  assertEqual(q('tokenStatus').textContent, 'Токен сохранён ✓',
    'and the row says the token is saved — saved, not verified, because this page asks ' +
    'CardTrader nothing and cannot know more than that');
  assert(!q('cardtraderMain').classList.contains('is-unconnected'),
    'the switch appears once there is something for it to turn on');
  assertEqual(q('cardtraderToggle').textContent, 'Настроить', 'and the button becomes a disclosure');
  assertEqual(q('cardtraderToken').value, '',
    'the field is emptied, so a stored token is never on screen');
  assertEqual(q('cardtraderTokenRow').hidden, true, 'and put away');
  assertEqual(q('cardtraderTokenActions').hidden, false, 'with replace and remove in its place');

  // Replacing is a second step, and the two ways to lose a token by accident are both closed:
  // closing the panel while the field is open, and pressing save with it empty.
  q('replaceToken').click();
  assertEqual(q('cardtraderTokenRow').hidden, false, 'replacing shows the field again');
  q('cardtraderToggle').click();
  await tick();
  assertEqual(mock.state.cardtraderToken, 'ct-token-1',
    'closing the panel with the field open does not delete the token');
  q('cardtraderToggle').click();
  await tick();
  q('saveToken').click();
  await tick();
  assertEqual(mock.state.cardtraderToken, 'ct-token-1',
    'and an empty field saved does not delete it either');

  q('removeToken').click();
  await tick();
  assert(!('cardtraderToken' in mock.state), 'removing deletes the stored token');
  assertEqual(q('tokenStatus').textContent, 'Не подключено', 'and the row goes back to asking');
  assertEqual(mock.state.cardtraderPrices, false,
    'and the switch is put back off, because a feature that cannot reach anything is not on');

  // And the second thing the box is drawn from: the block its links go in. CardTrader adds a
  // link to the "Buy This Card" block, so with that block hidden there is nowhere for the link
  // to be — the box is emptied and taken out of reach like the three shops beside it, and what
  // the reader chose is kept rather than written off.
  const hidden = await groupReady(loadOptions({ cardtraderToken: 'ct-token-1', cardtraderPrices: true }));
  const d = hidden.document;
  const box = d.getElementById('cardtraderPrices');
  assertEqual(box.checked, true, 'with a token and the block shown, the box is on');
  const block = d.getElementById('setStores');
  block.checked = false;
  fireEvent(block, 'change');
  await tick();
  assertEqual(box.checked, false, 'hiding the store block empties the CardTrader box');
  assertEqual(box.disabled, true, 'and takes it out of reach, because its link has nowhere to go');
  assertEqual(hidden.mock.state.setFilters.cardtraderPrices, undefined,
    'while the reader\'s own answer for it is not written off: storage is not touched');
  assertEqual(d.getElementById('tokenStatus').textContent, 'Токен сохранён ✓',
    'and the token is still there, so the row still says so');
  block.checked = true;
  fireEvent(block, 'change');
  await tick();
  assertEqual([box.checked, box.disabled], [true, false],
    'and the block coming back brings the box back as the reader had it');
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
    await featureRowsTest();
    await cardtraderRowTest();
    summary('test-options');
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();