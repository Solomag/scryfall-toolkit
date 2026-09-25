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

// Everything the licence obligations and this audit require in the archive. The
// icon artwork's vector source and its generator travel too: the PNGs are an
// executable form of that artwork, and the MPL wants the source alongside it.
for (const extra of ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md']) files.add(extra);
for (const name of fs.readdirSync(path.join(ROOT, 'third_party'))) files.add(`third_party/${name}`);
for (const name of fs.readdirSync(path.join(ROOT, 'icons-src'))) files.add(`icons-src/${name}`);
for (const name of fs.readdirSync(path.join(ROOT, 'tools'))) files.add(`tools/${name}`);

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

// The archive is written here rather than handed to tar, because tar stamps every
// entry with the file's own modification time and the hash then changes on every
// rebuild. A published hash is only useful if anyone can reproduce it, so every
// entry gets a fixed timestamp and the file list is sorted.
const zlib = require('node:zlib');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = buffer => {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  return (crc ^ -1) >>> 0;
};

// 2026-09-25 00:00:00, expressed the way the ZIP format wants it.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 25;

const localParts = [];
const centralParts = [];
let offset = 0;

for (const name of list) {
  const data = fs.readFileSync(path.join(ROOT, name));
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = crc32(data);
  // -15 tells zlib to emit raw deflate, which is what the ZIP format stores.
  const packed = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = packed.length < data.length;
  const body = useDeflate ? packed : data;
  const method = useDeflate ? 8 : 0;

  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);          // version needed
  local.writeUInt16LE(0x0800, 6);      // flags: names are UTF-8
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  nameBuf.copy(local, 30);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);        // version made by
  central.writeUInt16LE(20, 6);        // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt16LE(0, 30);        // extra
  central.writeUInt16LE(0, 32);        // comment
  central.writeUInt16LE(0, 34);        // disk number
  central.writeUInt16LE(0, 36);        // internal attributes
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attributes: a regular file
  central.writeUInt32LE(offset, 42);
  nameBuf.copy(central, 46);

  localParts.push(local, body);
  centralParts.push(central);
  offset += local.length + body.length;
}

const centralDirectory = Buffer.concat(centralParts);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(list.length, 8);
eocd.writeUInt16LE(list.length, 10);
eocd.writeUInt32LE(centralDirectory.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

fs.writeFileSync(zip, Buffer.concat([...localParts, centralDirectory, eocd]));

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
  'icons/cardtrader.svg', 'icons/cardtrader.png', 'icons/edhrec.png',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png',
  'icons-src/scryfall-toolkit-icon.svg', 'tools/render-icons.cjs', 'PRIVACY.md'
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
