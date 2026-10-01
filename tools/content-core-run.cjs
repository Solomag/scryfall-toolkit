// Build content-core.js from the template and the spine of content.js, then
// delete content.js.
//
// The template is a real file with two markers in it, so the shape of the output
// is something you can read and edit as JavaScript rather than as an array of
// quoted lines. Everything that comes from the old file is moved as it stands:
// no line of logic is retyped, so the split cannot quietly change a character.
//
// The boot is read out of the `if (condition) initX();` lines content.js ended
// with, and the feature files register against the step names those lines imply.
// Deriving both sides from the same place is the point: a condition or a step name
// typed out twice is a place for the two to disagree.
const fs = require('node:fs');
const path = require('node:path');
const { take, bootSteps, stepNameOf } = require('./content-split.cjs');
// The project root, one folder up. These files used to sit in it.
const ROOT = path.join(__dirname, '..') + path.sep;

// The four names that are written to after they are made, by different files: the
// clipboard list, the hook that realigns the stats panel when the legality block
// moves, the finish column promise the grouped printings waits for, and the
// throttled CardTrader queue the price column hands to rows created later. They
// live on one object so a write in one file is a read in another; a destructured
// name would not be.
const MUTABLE = ['clipboardCards', 'realignStatsPanel', 'finishesSettled', 'enqueueCardTraderPrint'];

const mutate = text => {
  let out = text;
  for (const name of MUTABLE) {
    out = out.replace(new RegExp('(^|[^.\\w$])' + name + '\\b', 'g'), '$1shared.' + name);
  }
  return out;
};

const SPINE = [
  'defaults', 'settings',
  'deckSettingsNow', 'sendDeckSettings', '@windowListener', '@storageListener',
  'language', 't', 'cardPath', 'cardPage', 'advancedPage',
  'PLATFORM_NAMES', 'chosenPlatforms', 'platformFilterOn', 'setPlatformsOf',
  'platformSetVisible', 'platformSetRequests', 'identity',
  'request', 'button', 'iconButton',
  'hidePreview', 'positionPreview', 'enablePreview',
  'printKey', 'refreshPrintButtons', 'attachPrintButton',
  'copiedTimers', 'flashCopied'
];

// `realignStatsPanel` is on the shared object rather than declared here, but its
// block is not only that declaration: the same block holds the hover preview's
// state, and skipping the block to skip the declaration took the preview's
// variables with it. `previewBox` undefined is a preview that never appears and
// no error anywhere, so the block is taken and one line of it dropped.
function takeWithout(name, drop) {
  return take(name).split('\n').filter(line => !line.includes(drop)).join('\n');
}

// `request` is followed by the old boot. Those `if` statements are not definitions,
// so the span of `request` runs straight past them and they arrive inside it. They
// are replaced by the BOOT list below, and the old ones have to go: left in, they
// call functions that no longer exist in this file.
function takeSpine(name) {
  const block = take(name).split('\n');
  const at = block.findIndex(line => /^ {2}if \(/.test(line));
  return at < 0 ? block.join('\n') : block.slice(0, at).join('\n').replace(/\s+$/, '');
}

const SHARED = [
  '  // Four things are written to after they are made, by different files. They live on',
  '  // one object so a write in one file is a read in another; a destructured name would',
  '  // not be, which is the only reason this is an object and not four plain lets.',
  '  const shared = {',
  '    clipboardCards: Array.isArray(settings.cards) ? settings.cards : [],',
  '    finishesSettled: Promise.resolve(),',
  '    enqueueCardTraderPrint: null,',
  '    realignStatsPanel: null',
  '  };',
  ''
].join('\n');

// The shared object goes in before the body does: the body carries a placeholder
// for it, and the template's own markers are filled first.
const body = [
  ...SPINE.map(name => (name === 'request' ? takeSpine(name) : mutate(take(name)))),
  '  // @@SHARED@@',
  takeWithout('realignStatsPanel', 'let realignStatsPanel'),
  mutate(take('ctQueuedCells')),
  mutate(take('printButtonRefreshers'))
].join('\n').replace('@@SHARED@@', SHARED);

const boot = bootSteps().map(([step, when, awaited]) =>
  '    ["' + step + '", () => ' + when + ', ' + (awaited ? 'true' : 'false') + '],'
).join('\n');

const template = fs.readFileSync(path.join(ROOT, 'tools', 'content-core.template.js'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace('@@BOOT@@', boot)
  .replace('@@BODY@@', () => body);

if (template.includes('@@')) {
  throw new Error('a marker was left unfilled: ' + (template.match(/@@\w+@@/) || [])[0]);
}

fs.writeFileSync(path.join(ROOT, 'src/card-page/core.js'), template);
fs.rmSync(path.join(ROOT, 'content.js'), { force: true });
console.log('content-core.js: ' + template.split('\n').length + ' lines, ' + bootSteps().length + ' boot steps');
console.log('content.js: removed');

// The step names in the boot and the step names the feature files registered
// against have to be the same set, or a feature silently never runs.
const registered = new Set();
for (const file of fs.readdirSync(ROOT)) {
  if (!/^content-(?!core)/.test(file)) continue;
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/STK_CONTENT\.on\("([^"]+)"/g)) registered.add(m[1]);
}
const expected = bootSteps().map(step => step[0]);
const neverRuns = expected.filter(step => !registered.has(step));
const notInBoot = [...registered].filter(step => !expected.includes(step));
if (neverRuns.length || notInBoot.length) {
  console.error('the boot and the registrations disagree');
  console.error('  in the boot with nothing registered: ' + neverRuns.join(', '));
  console.error('  registered but not in the boot: ' + notInBoot.join(', '));
  process.exit(1);
}
console.log('every boot step has a registration, and no registration is stray (' + expected.length + ')');
console.log('step names come from the function names: ' + stepNameOf('initCardNicknames') + ' <- initCardNicknames');
