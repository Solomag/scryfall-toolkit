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
// the vector source and the PNG sizes Chrome needs. The drawing is original: it is
// not Scryfall's, EDHREC's, CardTrader's or Wizards' symbol, and it reproduces no
// third-party mark. Its palette does come from Scryfall's public stylesheet, which is
// a fact about published colours rather than artwork.
//
//   node tools/render-icons.cjs [iconsDir] [svgDir]
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

// What is written into the SVG's own description, so the file says what it is.
const DESC = 'Original artwork. No third-party mark is used.';

// Every shape is [x, y, width, height, cornerRadius, colour]. They are drawn in
// order, so the clip sits on top of the card exactly as it reads. The clip rises
// above the card the way a clipboard's clip does; nothing here is a brand mark.
const SHAPES = [
  { name: 'backplate', x: 0, y: 0, w: 128, h: 128, r: 28, fill: DARK },
  { name: 'card', x: 30, y: 30, w: 68, h: 80, r: 8, fill: PAPER },
  { name: 'clip', x: 50, y: 16, w: 28, h: 32, r: 8, fill: GREEN }
];

// --- the vector source -------------------------------------------------------

// One shape, two outputs. Every kind below has a vector form and a coverage test, so
// the SVG and the PNGs cannot disagree about where a thing is — which is the whole
// reason the artwork is described rather than drawn.
//
//   rect   { x, y, w, h, r, fill }
//   circle { cx, cy, r, fill }
//   ring   { cx, cy, r, w, fill }        a circle of thickness w
//   poly   { points: [[x, y], …], fill }
//   gear   { cx, cy, r, root, count, toothW, toothH, twist, roundTip, fill }
//
// The last two exist because a wheel is not a circle: its teeth are what make it read
// as a wheel, and they are what a shape list of rounded rectangles cannot express.
function element(s) {
  const n = value => Number(value.toFixed(3));
  switch (s.k) {
    case 'circle':
      return `  <circle cx="${n(s.cx)}" cy="${n(s.cy)}" r="${n(s.r)}" fill="${s.fill}"/>`;
    case 'ring': {
      const outer = n(s.r + s.w / 2);
      const inner = n(s.r - s.w / 2);
      const at = radius => `M ${n(s.cx - radius)},${n(s.cy)} a ${radius},${radius} 0 1,0 ${n(radius * 2)},0 a ${radius},${radius} 0 1,0 ${n(-radius * 2)},0`;
      return `  <path d="${at(outer)} ${at(inner)}" fill="${s.fill}" fill-rule="evenodd"/>`;
    }
    case 'poly':
      return `  <polygon points="${s.points.map(p => n(p[0]) + ',' + n(p[1])).join(' ')}" fill="${s.fill}"/>`;
    case 'gear':
      return wheel(s).map(t => element(t)).join('\n');
    default:
      return `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" ry="${s.r}" fill="${s.fill}"/>`;
  }
}

function svg(desc) {
  const shapes = SHAPES.flatMap(s => (s.k === 'gear' ? wheel(s) : [s])).map(element).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">
  <title>Scryfall Toolkit</title>
  <desc>${desc}</desc>
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

// Coverage at a single point: is this sample inside the shape? Each kind below is one
// test and nothing else. That is what keeps a shape list readable — a wheel is
// described as a wheel, not as nine polygons somebody worked out by trigonometry at
// three in the morning.
function covers(px, py, s) {
  switch (s.k) {
    case 'circle':
      return (px - s.cx) ** 2 + (py - s.cy) ** 2 <= s.r * s.r;
    case 'ring': {
      const d = Math.sqrt((px - s.cx) ** 2 + (py - s.cy) ** 2);
      return Math.abs(d - s.r) <= s.w / 2;
    }
    case 'poly':
      return insidePolygon(px, py, s.points);
    case 'gear':
      // The disc the teeth stand on is part of the wheel. Without it a gear is a
      // starburst, which is what the first attempt looked like.
      if ((px - s.cx) ** 2 + (py - s.cy) ** 2 <= s.r * s.r) return true;
      return wheelTeeth(s).some(tooth => covers(px, py, tooth));
    default: {
      const x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
      if (px < x0 || px > x1 || py < y0 || py > y1) return false;
      const r = Math.min(s.r, s.w / 2, s.h / 2);
      const cx = Math.min(Math.max(px, x0 + r), x1 - r);
      const cy = Math.min(Math.max(py, y0 + r), y1 - r);
      return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
    }
  }
}

// Even-odd crossing count. Convex outlines would take any winding rule; the claw on a
// hammer is not convex, and even-odd is the rule that holds there too.
//
// An edge can only cross the horizontal line through the point when its two ends are
// on *opposite* sides of it, so the test is `!==` between the two comparisons. Written
// as `===` it inverts the whole polygon, which is silent: the render comes out as
// stripes and nothing throws.
function insidePolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A wheel: the disc, then the teeth standing on it. One entry in the shape list, two
// forms in the SVG, because a wheel is a thing rather than a pair of coordinates.
function wheel(gear) {
  return [{ k: 'circle', cx: gear.cx, cy: gear.cy, r: gear.r, fill: gear.fill }].concat(wheelTeeth(gear));
}

// The teeth of a wheel, as trapezoids set at even angles. Flat-topped and slightly
// tapered: a trapezoid reads as a tooth at 48 pixels, where a rectangle reads as a
// bump and an involute reads as a smudge.
//
// With `roundTip`, each tooth also gets a disc at its tip, which turns the flat end
// into a semicircle of that disc's radius. Rounding is done by adding a shape, never by
// moving the trapezoid's corners: the shapes are unioned as they are painted, so a disc
// laid over a flat end is a rounded end, and no arithmetic is needed to describe an
// arc. The radius is a half of the tooth's width at the tip, which is what a round end
// of that width actually is — any more and the teeth swell into blobs.
//
// The rotation happens once, in `place`, rather than in every coordinate below.
// `twist` turns the whole wheel in radians, which is what lets two wheels of different
// counts sit side by side without their teeth lining up into one lumpy outline. It is
// an angle and so is never scaled with the rest of the shape.
function wheelTeeth(gear) {
  const out = [];
  const step = (Math.PI * 2) / gear.count;
  const twist = gear.twist || 0;
  const outer = gear.r + gear.toothH;
  const wRoot = gear.toothW / 2;
  const wTip = gear.toothW * 0.3;
  for (let i = 0; i < gear.count; i++) {
    // One tooth's own frame: radius runs out of the hub, offset runs across the tooth.
    const angle = i * step + twist;
    const place = (radius, offset) => [
      gear.cx + Math.cos(angle) * radius - Math.sin(angle) * offset,
      gear.cy + Math.sin(angle) * radius + Math.cos(angle) * offset
    ];
    out.push({
      k: 'poly',
      fill: gear.fill,
      points: [
        place(gear.root, -wRoot), place(outer, -wTip),
        place(outer, wTip), place(gear.root, wRoot)
      ]
    });
    if (gear.roundTip) {
      const tip = place(outer - wTip, 0);
      out.push({ k: 'circle', cx: tip[0], cy: tip[1], r: wTip, fill: gear.fill });
    }
  }
  return out;
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
        if (!covers(ux, uy, shape)) continue;
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

// The sizes Chrome and the store actually ask for, and nothing else by default: the
// manifest names exactly these four, and a fifth file in this folder is a file nothing
// reads. STK_ICON_SIZES adds sizes for review renders, where the point is to see the
// artwork at a size nobody ships, at true size.
const SIZES = process.env.STK_ICON_SIZES
  ? process.env.STK_ICON_SIZES.split(',').map(n => Number(n.trim()))
  : [16, 32, 48, 128];
for (const size of SIZES) {
  if (!Number.isInteger(size) || size < 1) {
    console.error('FAILED: STK_ICON_SIZES must be a list of whole positive numbers.');
    process.exit(1);
  }
}

// The PNGs go where the manifest and web_accessible_resources look for them,
// which is assets/icons/ alongside the artwork that is not ours. Writing to
// ROOT/icons would create a folder nothing reads and leave the build pointing at
// files that were not there.
//
// Both destinations can be pointed elsewhere, which is what makes it possible to try
// artwork out without replacing the artwork that ships. A tool that can only write to
// the live path is a tool you cannot experiment with.
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'assets', 'icons');
const SRC_DIR = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'icons-src');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SRC_DIR, { recursive: true });

fs.writeFileSync(path.join(SRC_DIR, 'scryfall-toolkit-icon.svg'), svg(DESC), 'utf8');
console.log('wrote ' + path.join(SRC_DIR, 'scryfall-toolkit-icon.svg'));

for (const size of SIZES) {
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, png(size, render(size)));
  // The path it actually wrote to, not the one it would have written to by default.
  // A log that names a file you did not write is worse than no log at all.
  console.log(`wrote ${file} (${fs.statSync(file).size} bytes)`);
}

console.log('\n' + DESC);
