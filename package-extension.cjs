// Builds the extension archive from the files the extension actually needs, then
// verifies the archive rather than the working tree: a notice that only exists in
// the folder but not in the zip is not a notice the user received.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('./testlib.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const files = new Set(['manifest.json']);
for (const entry of manifest.content_scripts) {
  for (const file of [...(entry.js || []), ...(entry.css || [])]) files.add(file);
}
if (manifest.background) files.add(manifest.background.service_worker);
if (manifest.options_page) files.add(manifest.options_page);

// The service worker pulls its data in with importScripts, so those files belong to
// the extension exactly as much as the manifest does. They are read out of the code
// instead of being written down here, so a new import cannot slip out unnoticed.
if (manifest.background) {
  const worker = fs.readFileSync(path.join(ROOT, manifest.background.service_worker), 'utf8');
  for (const call of worker.matchAll(/importScripts\(([^)]*)\)/g)) {
    for (const argument of call[1].split(',')) {
      const file = argument.trim().replace(/^["']|["']$/g, '');
      if (file) files.add(file);
    }
  }
}

for (const entry of manifest.web_accessible_resources || []) {
  for (const pattern of entry.resources) {
    if (!pattern.includes('*')) {
      files.add(pattern);
      continue;
    }
    // A web_accessible_resources pattern is a glob: "icons/*.svg" has to match
    // icons/cardtrader.svg, and "*.svg" must not be read as the literal name.
    const dir = path.dirname(pattern);
    const expression = new RegExp('^' + path.basename(pattern)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[^/]*') + '$');
    for (const name of fs.readdirSync(path.join(ROOT, dir))) {
      if (expression.test(name)) files.add(path.join(dir, name).split(path.sep).join('/'));
    }
  }
}

// Everything the licence obligations and this audit require in the archive.
for (const extra of ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md']) files.add(extra);
for (const name of fs.readdirSync(path.join(ROOT, 'third_party'))) files.add(`third_party/${name}`);

const list = [...files].sort();
const missing = list.filter(file => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) {
  console.error('these packaged files do not exist: ' + missing.join(', '));
  process.exit(1);
}

const dist = path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `scryfall-toolkit-${manifest.version}.zip`);
fs.rmSync(zip, { force: true });

// --no-xattrs, not -X: this bsdtar build reads -X as a flag that takes the next
// argument, which silently swallowed the first file in the list.
execFileSync('tar', ['-a', '-c', '-f', zip, '--no-xattrs', ...list], { cwd: ROOT, stdio: 'inherit' });

console.log('packaged files:');
for (const file of list) console.log('  ' + file);
console.log(`\narchive: ${zip} (${fs.statSync(zip).size} bytes)`);

// Read the archive back and check the notices are really inside it.
const listed = execFileSync('tar', ['-tf', zip], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').map(line => line.trim()).filter(Boolean);
const required = [
  'THIRD_PARTY_NOTICES.md', 'LICENSE',
  'third_party/CardClip-LICENSE', 'third_party/Paruhas-CardClip-LICENSE',
  'third_party/Shambleshark-LICENSE', 'third_party/MoxTags-LICENSE',
  'third_party/MTG-Enhancements-LICENSE',
  'data/oracle-tags.js', 'data/illustration-tags-1.js', 'data/illustration-tags-2.js',
  'data/shambleshark-nicknames.js', 'data/set-platforms.js', 'format-overrides.js',
  'icons/clip.svg', 'icons/duplicate.svg', 'icons/trash.svg', 'icons/cardmarket.svg',
  'icons/cardtrader.svg', 'icons/cardtrader.png', 'icons/edhrec.png'
];
let bad = 0;
for (const file of required) {
  const ok = listed.includes(file);
  if (!ok) bad++;
  console.log(`${ok ? 'in archive ' : 'MISSING   '} ${file}`);
}
const stray = listed.filter(name => !files.has(name));
if (stray.length) { console.log('unexpected entries: ' + stray.join(', ')); bad++; }
const leaked = listed.filter(name => /(^|\/)(node_modules|test-|package-extension|debug-harness|\.git)/.test(name));
if (leaked.length) { console.log('LEAKED dev files: ' + leaked.join(', ')); bad++; }
console.log(bad ? `\nFAILED: ${bad} problem(s)` : '\nOK: notices, licences and data are all inside the archive');
process.exit(bad ? 1 : 0);
