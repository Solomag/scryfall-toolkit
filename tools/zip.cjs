// Replaces every tar call that read the release archive.
//
// The packager writes the ZIP itself, so reading it back should not depend on
// whichever tar the machine happens to have: bsdtar on Windows reads ZIP, GNU tar
// on the ubuntu runner does not, and CI was red because of exactly that.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findCentralDirectory(buffer) {
  // The end-of-central-directory record sits at the very end, before a comment of
  // at most 64 KB.
  for (let back = 22; back <= Math.min(buffer.length, 22 + 65535); back++) {
    const at = buffer.length - back;
    if (buffer.readUInt32LE(at) === EOCD) {
      return {
        count: buffer.readUInt16LE(at + 10),
        offset: buffer.readUInt32LE(at + 16)
      };
    }
  }
  throw new Error('Not a ZIP archive: no end-of-central-directory record');
}

function readEntry(buffer, at) {
  if (buffer.readUInt32LE(at) !== CENTRAL) throw new Error('Not a ZIP archive: bad central directory');
  return {
    method: buffer.readUInt16LE(at + 10),
    compressedSize: buffer.readUInt32LE(at + 20),
    uncompressedSize: buffer.readUInt32LE(at + 24),
    nameLength: buffer.readUInt16LE(at + 28),
    extraLength: buffer.readUInt16LE(at + 30),
    commentLength: buffer.readUInt16LE(at + 32),
    localOffset: buffer.readUInt32LE(at + 42),
    name: buffer.slice(at + 46, at + 46 + buffer.readUInt16LE(at + 28)).toString('utf8')
  };
}

function entriesOf(zip) {
  const buffer = fs.readFileSync(zip);
  const { count, offset } = findCentralDirectory(buffer);
  const entries = [];
  let at = offset;
  for (let i = 0; i < count; i++) {
    const entry = readEntry(buffer, at);
    entries.push(entry);
    at += 46 + entry.nameLength + entry.extraLength + entry.commentLength;
  }
  return { buffer, entries };
}

// The names in the archive, in the order they were written.
function listZip(zip) {
  return entriesOf(zip).entries.map(entry => entry.name);
}

// Writes every file into dest. Directories in the archive are skipped; the file
// paths create them.
function extractZip(zip, dest) {
  const { buffer, entries } = entriesOf(zip);
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    // The local header repeats the name and carries its own extra field, so the
    // data starts at a different offset than the central directory records.
    if (buffer.readUInt32LE(entry.localOffset) !== LOCAL) throw new Error('Bad local header for ' + entry.name);
    const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
    const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    const raw = buffer.slice(start, start + entry.compressedSize);
    const data = entry.method === 8 ? zlib.inflateRawSync(raw) : raw;
    if (data.length !== entry.uncompressedSize) throw new Error('Wrong size after decompressing ' + entry.name);
    const target = path.join(dest, entry.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  return entries.map(entry => entry.name);
}

module.exports = { listZip, extractZip };
