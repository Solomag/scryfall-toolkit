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

// The ground is Scryfall's own darkest background, #16161d, taken from their
// stylesheet — it is the twenty-fourth most common colour in it and the one their dark
// theme is built on. It is their colour, and it is also the only one of the three
// purples they use that a dark wooden handle can sit on: against their brand purple
// #634496 that handle has to come out at 3.03:1, which in practice means pale tan, and
// at pale tan the bronze, the copper and the wood are all the same colour. The bar is
// met and the drawing is lost. That was measured, not guessed, and the losing version is
// kept at the bottom of this file as the reason.
const INK_GROUND = '#16161d';

// The mark. Three materials, which is the whole point of it: a mark painted in one
// colour has nothing for the eye to hold on to, and this one spent its life as a flat
// clipboard before anyone said so.
//
//   the wheels   bronze, the far one a shade darker
//   the handle   wood
//   the head     steel, and the only thing in the mark that is not brown
//
// Every one of these was computed against the ground above to clear 3:1, which is the
// WCAG bar for a non-text part, and the steel to clear 4.5. They are not the values that
// looked best on a light background: those do not survive being moved onto a dark one.
const BRONZE = '#a57139';
const COPPER = '#8c592d';
const WOOD = '#8e5a2c';
const STEEL = '#cfd3d9';
const STEEL_DARK = '#979da6';

// What is written into the SVG's own description, so the file says what it is.
const DESC = 'Original artwork: a hammer above two wheels. No third-party mark is used.';

// A hammer above two wheels. The hammer is square to the canvas, which is the only
// reason its ends can be rounded at all: a bar turned to an angle cannot have a rounded
// end without becoming an arc. Square corners on a mark whose other corners are all
// round are what make it read as cut out rather than drawn.
//
// The wheels are two sizes on purpose. One wheel is a gear; two wheels of the same size
// is a pattern, and a pattern says nothing about a tool that works on cards. The far one
// has no spokes, because five spokes across thirty pixels is not detail, it is noise,
// and the difference between them is also what tells them apart.
const SHAPES = [
  { name: 'ground', x: 0, y: 0, w: 128, h: 128, r: 36, fill: INK_GROUND },

  { name: 'wheel-near', k: 'gear', cx: 42, cy: 86, r: 24, root: 19,
    count: 8, toothW: 12, toothH: 8, roundTip: true,
    spokes: 5, hub: 7, spokeW: 5, spokeTilt: 0.31, fill: BRONZE },
  { name: 'wheel-far', k: 'gear', cx: 97, cy: 82, r: 15, root: 12,
    count: 6, toothW: 9, toothH: 6, roundTip: true,
    // Turned against the near wheel, so where the two come close the gaps of one fall
    // against the teeth of the other. They are not meshing properly and are not meant
    // to be: what matters is that they do not read as one wheel with a lump on it.
    twist: Math.PI / 6, fill: COPPER },
  { name: 'far-bore', k: 'ring', cx: 97, cy: 82, r: 5, w: 4, fill: INK_GROUND },

  { name: 'handle', x: 17, y: 26, w: 86, h: 13, r: 6.5, fill: WOOD },
  { name: 'head', x: 94, y: 13, w: 17, h: 39, r: 7.5, fill: STEEL },
  // The striking face, a shade darker. This is the one place two tones on a single
  // object earn their keep; without it the head reads as a capsule.
  { name: 'face', x: 103, y: 13, w: 8, h: 39, r: 7.5, fill: STEEL_DARK }
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
//   gear   { cx, cy, r, root, count, toothW, toothH, twist, roundTip, hollow,
//            spokes, hub, spokeW, spokeTilt, fill }
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
      // Read the wheel's own expansion rather than re-deriving the geometry here. A
      // second copy of this list is a second answer to where the wheel is, and the
      // vector and the raster would eventually disagree — which is the one thing this
      // file is arranged so that they cannot.
      return wheel(s).some(part => covers(px, py, part));
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

// A wheel is described once here and expanded once here, and the SVG and the rasteriser
// both take their geometry from the result. That is the whole reason this file describes
// shapes instead of drawing them: there is one answer to where a thing is, and both
// outputs read it.
//
// The expansion is cached because the rasteriser asks about the same wheel a quarter of
// a million times, and rebuilding five spokes and eight teeth per sample is the
// difference between a second and a minute.
//
// Three forms, and which one you get is what the fields say:
//   nothing       a disc and its teeth
//   hollow        the teeth only, so the ground shows through the middle
//   spokes: n     a rim, a hub, n spokes, and the ground in the gaps between them
function wheel(gear) {
  if (expanded.has(gear)) return expanded.get(gear);
  const parts = [];
  if (gear.spokes) {
    // The rim, as a ring between the two radii rather than as a disc with a hole cut
    // in it: a hole cut in it would need a colour, and a hole is not a colour.
    parts.push({
      k: 'ring', cx: gear.cx, cy: gear.cy,
      r: (gear.root + gear.r) / 2, w: gear.r - gear.root, fill: gear.fill
    });
    parts.push({ k: 'circle', cx: gear.cx, cy: gear.cy, r: gear.hub, fill: gear.fill });
    const step = (Math.PI * 2) / gear.spokes;
    const tilt = gear.spokeTilt || 0;
    for (let i = 0; i < gear.spokes; i++) {
      const a = i * step + tilt;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const px = (-dy * gear.spokeW) / 2;
      const py = (dx * gear.spokeW) / 2;
      // The ends are square: the hub and the rim are drawn over them.
      parts.push({
        k: 'poly',
        fill: gear.fill,
        points: [
          [gear.cx + dx * gear.hub + px, gear.cy + dy * gear.hub + py],
          [gear.cx + dx * gear.root + px, gear.cy + dy * gear.root + py],
          [gear.cx + dx * gear.root - px, gear.cy + dy * gear.root - py],
          [gear.cx + dx * gear.hub - px, gear.cy + dy * gear.hub - py]
        ]
      });
    }
  } else if (!gear.hollow) {
    parts.push({ k: 'circle', cx: gear.cx, cy: gear.cy, r: gear.r, fill: gear.fill });
  }
  parts.push(...wheelTeeth(gear));
  expanded.set(gear, parts);
  return parts;
}

const expanded = new WeakMap();

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
