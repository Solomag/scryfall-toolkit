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

// Builds the release archive from the files the extension actually needs, then
// verifies the archive rather than the working tree: a file that exists in the
// folder but not in the zip is exactly what a user ends up installing.
//
// The file list is not written down here. It is walked out of the manifest and
// then out of every file already in the list, so a page that references its own
// stylesheet cannot be shipped without it. That is what happened to options.css
// and options.js in 0.44.0: the manifest names options.html, but only the html
// itself was packaged, and the settings page arrived as bare markup.
//
//   node package-extension.cjs
//
// Set STK_PACKAGE_OUT to build somewhere other than dist/, which the tests use.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { ROOT } = require('./tests/testlib.cjs');
const { listZip } = require('./tools/zip.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// --- what the extension needs ------------------------------------------------

// A packaged file can refer to more of the project than the manifest does, so
// every reference found in an already-accepted file is added and walked too.
function referencedBy(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const found = new Set();
  // A reference inside a file is relative to that file, not to the archive root.
  // The extension pages live in src/ui/ and reach up into src/core/ with "../",
  // and resolving those from the root would either drop them or, worse, add a
  // path that does not exist and leave the page without its script in the build.
  //
  // Not every reference is like that. chrome.runtime.getURL takes a path from the
  // root of the extension whatever file calls it, so it gets its own way in.
  const here = path.posix.dirname(file.split(path.sep).join('/'));
  const clean = value => {
    const bare = value.split(/[?#]/)[0];
    if (!bare || bare.includes('${') || bare.startsWith('http') || bare.startsWith('data:')) return '';
    return bare;
  };
  const add = value => {
    const name = clean(value);
    if (!name) return;
    const resolved = name.startsWith('/') ? name.slice(1) : path.posix.normalize(path.posix.join(here, name));
    // Never let a reference walk out of the archive.
    if (!resolved.startsWith('..')) found.add(resolved);
  };
  const addRelative = value => {
    const name = clean(value);
    if (!name) return;
    const resolved = name.startsWith('/') ? name.slice(1) : path.posix.normalize(path.posix.join(here, name));
    if (!resolved.startsWith('..')) found.add(resolved);
  };
  // A path from the root of the extension, as getURL and every manifest entry are.
  const addRoot = value => {
    const name = clean(value);
    if (name && !name.startsWith('..')) found.add(name);
  };

  if (file.endsWith('.html')) {
    for (const m of text.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of text.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of text.matchAll(/<img[^>]+src\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
    for (const m of text.matchAll(/<source[^>]+src\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  }
  if (file.endsWith('.css')) {
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) add(m[1]);
  }
  if (file.endsWith('.js')) {
    // importScripts resolves against the worker's own URL, so it is relative to
    // the file that calls it.
    for (const call of text.matchAll(/importScripts\s*\(([^)]*)\)/g)) {
      for (const argument of call[1].split(',')) addRelative(argument.trim().replace(/^["']|["']$/g, ''));
    }
    // chrome.runtime.getURL takes a path from the root of the extension, not one
    // relative to the calling file. Resolving it against the file's folder turns
    // "assets/icons/x.svg" inside src/card-page into src/card-page/assets/... and
    // the icon goes missing in a build that otherwise looks complete.
    for (const m of text.matchAll(/chrome\.runtime\.getURL\s*\(\s*["']([^"'$]+)["']/g)) addRoot(m[1]);
    // Files can be named through a map or a variable rather than a literal, as
    // the tag snapshot is. Anything that names a file of this project is a
    // reference to it, and these are written from the root.
    //
    // The pattern covers .png and .svg because the illustrations are named this way.
    // They were outside the archive until this was widened: the settings page put
    // every picture in a <figure> with an <img>, and when the pictures moved behind
    // the "?" and into a dialog, the only place a name appeared was a string in the
    // script — so the walk found nothing and shipped a settings page whose six "?"
    // buttons open nothing. The build reported itself complete.
    for (const m of text.matchAll(/["']([^"'\s]+\.(?:js|css|png|svg|jpg|jpeg|webp|json|woff2?))["']/g)) {
      // A name that climbs out of its own folder is relative, not from the root:
      // options.js sits two folders down and reaches its pictures as
      // "../../assets/shots/x.png". Resolved against the root that becomes a path
      // starting with "..", which the guard then throws away — and the archive builds
      // without the pictures while reporting itself complete.
      if (m[1].startsWith('..')) add(m[1]);
      else if (m[1].includes('/') || fs.existsSync(path.join(ROOT, m[1]))) addRoot(m[1]);
    }
  }
  return [...found];
}

function expandGlob(pattern) {
  if (!pattern.includes('*')) return [pattern];
  const dir = path.dirname(pattern);
  const expression = new RegExp('^' + path.basename(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*') + '$');
  if (!fs.existsSync(path.join(ROOT, dir))) return [];
  return fs.readdirSync(path.join(ROOT, dir))
    .filter(name => expression.test(name))
    .map(name => path.join(dir, name).split(path.sep).join('/'));
}

const files = new Set(['manifest.json']);

// Every file the manifest itself names. Missing one of these is how 0.44.0 lost
// options.css and 0.46.0 nearly lost the popup: the manifest was read for some
// of its fields and not others. Read all of them.
const namedByManifest = () => {
  const found = ['manifest.json'];
  for (const entry of manifest.content_scripts || []) found.push(...(entry.js || []), ...(entry.css || []));
  if (manifest.background) {
    if (manifest.background.service_worker) found.push(manifest.background.service_worker);
    if (manifest.background.scripts) found.push(...manifest.background.scripts);
  }
  if (manifest.options_page) found.push(manifest.options_page);
  if (manifest.options_ui && manifest.options_ui.page) found.push(manifest.options_ui.page);
  if (manifest.action) {
    if (manifest.action.default_popup) found.push(manifest.action.default_popup);
    if (manifest.action.default_icon) found.push(...Object.values(manifest.action.default_icon));
  }
  if (manifest.options_ui && manifest.options_ui.page) found.push(manifest.options_ui.page);
  for (const size of Object.values(manifest.icons || {})) found.push(size);
  for (const entry of manifest.web_accessible_resources || []) {
    for (const pattern of entry.resources) found.push(...expandGlob(pattern));
  }
  return found;
};

for (const file of namedByManifest()) files.add(file);

// Walk whatever those files pull in, until nothing new appears.
const queue = [...files];
const walked = new Set();
while (queue.length) {
  const file = queue.shift();
  if (walked.has(file)) continue;
  walked.add(file);
  if (!/\.(html|js|css)$/.test(file)) continue;
  if (!fs.existsSync(path.join(ROOT, file))) continue;
  for (const name of referencedBy(file)) {
    if (!files.has(name)) { files.add(name); queue.push(name); }
  }
}

// What the licence obligations and this audit require alongside the code.
for (const extra of ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md']) files.add(extra);
for (const dir of ['assets/licences', 'icons-src']) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) for (const name of fs.readdirSync(full)) files.add(`${dir}/${name}`);
}
// tools/ is build tooling. The icon generator alone is shipped, because it is the
// source of the PNG artwork and the MPL asks for that source beside the PNGs.
files.add('tools/render-icons.cjs');

const list = [...files].sort();
const missing = list.filter(file => !fs.existsSync(path.join(ROOT, file)));
if (missing.length) {
  console.error('these packaged files do not exist: ' + missing.join(', '));
  process.exit(1);
}

// --- build it ----------------------------------------------------------------

// The archive is written here rather than handed to tar, because tar stamps every
// entry with the file's own modification time and the hash then changes on every
// rebuild. A published hash is only useful if anyone can reproduce it, so every
// entry gets a fixed timestamp and the file list is sorted.

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

const dist = process.env.STK_PACKAGE_OUT || path.join(ROOT, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `scryfall-toolkit-${manifest.version}.zip`);
fs.rmSync(zip, { force: true });
fs.writeFileSync(zip, Buffer.concat([...localParts, centralDirectory, eocd]));

console.log('packaged files:');
for (const file of list) console.log('  ' + file);
console.log(`\narchive: ${zip} (${fs.statSync(zip).size} bytes)`);

// --- read it back ------------------------------------------------------------

const listed = listZip(zip);

let bad = 0;
for (const file of list) {
  if (listed.includes(file)) continue;
  bad++;
  console.log(`MISSING from the archive    ${file}`);
}

// The manifest is the contract with the browser: if it names a file, that file
// has to be inside. Checking only what happened to be walked let the popup go
// missing once already.
for (const file of namedByManifest()) {
  if (!listed.includes(file)) {
    bad++;
    console.log(`manifest names ${file}, which is not in the archive`);
  }
}

// The check that would have caught 0.44.0: every file a packaged page or script
// references must be in the archive, or the page ships half-built.
for (const file of listed) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  for (const name of referencedBy(file)) {
    if (!listed.includes(name)) {
      bad++;
      console.log(`${file} references ${name}, which is not in the archive`);
    }
  }
}

for (const required of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'PRIVACY.md']) {
  if (!listed.includes(required)) { bad++; console.log(`MISSING licence or notice    ${required}`); }
}
for (const name of fs.readdirSync(path.join(ROOT, 'assets/licences'))) {
  if (!listed.includes(`assets/licences/${name}`)) { bad++; console.log(`MISSING third-party licence  ${name}`); }
}

const stray = listed.filter(name => !files.has(name));
if (stray.length) { console.log('unexpected entries: ' + stray.join(', ')); bad++; }
const leaked = listed.filter(name => /(^|\/)(node_modules|test-|package-extension|debug-harness|store-assets|\.git)/.test(name));
if (leaked.length) { console.log('LEAKED dev files: ' + leaked.join(', ')); bad++; }

console.log(bad ? `\nFAILED: ${bad} problem(s)` : '\nOK: every file the archive needs is inside it, and the pages are complete');
process.exit(bad ? 1 : 0);
