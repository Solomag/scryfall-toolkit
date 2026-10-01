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

// Draws the extension icon from one description of its geometry and writes both
// the vector source and the PNG sizes Chrome needs. The artwork is original: it
// is deliberately not Scryfall's, EDHREC's or CardTrader's mark, and it borrows
// nothing from them.
//
//   node tools/render-icons.cjs
//
// The shapes are described once below. The SVG is emitted from that description
// and the PNGs are rasterised from the same numbers, so the two can never drift.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');

// --- the artwork -------------------------------------------------------------

const CANVAS = 128;

// Palette taken from this project's own interface, not from any brand.
const DARK = '#23303e';   // the clipboard panel's ink
const PAPER = '#eef2f6';  // the clipboard panel's paper
const GREEN = '#2f9e44';  // the extension's own "copied" confirmation colour

// Every shape is [x, y, width, height, cornerRadius, colour]. They are drawn in
// order, so the clip sits on top of the card exactly as it reads. The clip rises
// above the card the way a clipboard's clip does; nothing here is a brand mark.
const SHAPES = [
  { name: 'backplate', x: 0, y: 0, w: 128, h: 128, r: 28, fill: DARK },
  { name: 'card', x: 30, y: 30, w: 68, h: 80, r: 8, fill: PAPER },
  { name: 'clip', x: 50, y: 16, w: 28, h: 32, r: 8, fill: GREEN }
];

// --- the vector source -------------------------------------------------------

function svg() {
  const shapes = SHAPES.map(s =>
    `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ry="${s.r}" fill="${s.fill}"/>`
  ).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">
  <title>Scryfall Toolkit</title>
  <desc>Original artwork: a clipboard with a green clip. No third-party mark is used.</desc>
${shapes}
</svg>
`;
}

// --- a small PNG rasteriser --------------------------------------------------

const SUPERSAMPLE = 4;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Coverage of a rounded rectangle at a single point.
function insideRoundedRect(px, py, s) {
  const x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  const r = Math.min(s.r, s.w / 2, s.h / 2);
  const cx = Math.min(Math.max(px, x0 + r), x1 - r);
  const cy = Math.min(Math.max(py, y0 + r), y1 - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
}

function render(size) {
  const big = size * SUPERSAMPLE;
  const rgb = new Uint8Array(big * big * 3); // composited over transparency below
  const alpha = new Float32Array(big * big);

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      // Map the sample point into the 128-unit artwork space.
      const ux = (x + 0.5) * (CANVAS / big);
      const uy = (y + 0.5) * (CANVAS / big);
      const at = y * big + x;
      for (const shape of SHAPES) {
        if (!insideRoundedRect(ux, uy, shape)) continue;
        const [r, g, b] = hexToRgb(shape.fill);
        rgb[at * 3] = r; rgb[at * 3 + 1] = g; rgb[at * 3 + 2] = b;
        alpha[at] = 1;
      }
    }
  }

  // Box-downsample with straight alpha, so the rounded corners stay smooth.
  const out = Buffer.alloc(size * size * 4);
  const area = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const at = (y * SUPERSAMPLE + sy) * big + (x * SUPERSAMPLE + sx);
          a += alpha[at];
          r += rgb[at * 3] * alpha[at];
          g += rgb[at * 3 + 1] * alpha[at];
          b += rgb[at * 3 + 2] * alpha[at];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = a ? Math.round(r / a) : 0;
      out[o + 1] = a ? Math.round(g / a) : 0;
      out[o + 2] = a ? Math.round(b / a) : 0;
      out[o + 3] = Math.round((a / area) * 255);
    }
  }
  return out;
}

// PNG encoding: signature, IHDR, IDAT, IEND.
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;   // bit depth
  header[9] = 6;   // colour type: RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- write everything --------------------------------------------------------

const SIZES = [16, 32, 48, 128];

// The PNGs go where the manifest and web_accessible_resources look for them,
// which is assets/icons/ alongside the artwork that is not ours. Writing to
// ROOT/icons would create a folder nothing reads and leave the build pointing at
// files that were not there.
fs.mkdirSync(path.join(ROOT, 'assets', 'icons'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'icons-src'), { recursive: true });

fs.writeFileSync(path.join(ROOT, 'icons-src', 'scryfall-toolkit-icon.svg'), svg(), 'utf8');
console.log('wrote icons-src/scryfall-toolkit-icon.svg');

for (const size of SIZES) {
  const file = path.join(ROOT, 'assets', 'icons', `icon${size}.png`);
  fs.writeFileSync(file, png(size, render(size)));
  console.log(`wrote assets/icons/icon${size}.png (${fs.statSync(file).size} bytes)`);
}

console.log('\nartwork is original; no third-party logo, wordmark or brand colour is used.');
