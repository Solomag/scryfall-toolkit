// The facts the documents keep re-stating, written down once.
//
// Every document in this repository asserts things about the project: what the notices
// permit, what the road map has settled, what the privacy policy covers, what the store
// listing declares. Those assertions drifted apart, and a document that says two
// incompatible things about the same mark is worse than one that says nothing — a reader
// cannot tell which half to believe.
//
// The drift was never in a value. It was in a document that kept an older copy of a
// decision next to the newer one. So the facts live here, and a test asks every document
// to agree with them. This is the same pattern the project already uses for the version
// number, the host declarations, the theme contract and the illustrations.
//
// What this file deliberately does NOT do is generate the prose. A generated status block
// reads like a machine talking, and these documents are read by people deciding whether to
// trust the project. So the facts are the source and the documents are the writing, and the
// test is what keeps them honest.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..') + path.sep;

const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// The decisions this project has made about other people's material, and about its own
// dependencies. `basis` is what the notice file must say; `forbidden` is wording that
// would put the old position back, and it is the half that matters: a document can always
// be edited to say something new, but it must not be edited to say the opposite again.
// `must` is per document, because documents do not word the same fact the same way and
// asking them to would be asking one of them to be wrong. `forbidden` is where a document
// states the opposite as a status rather than quoting it — the road map says the word
// "unresolved" once, explaining that it was removed, and that sentence is the opposite of
// drift: it is the record of the fix.
const FACTS = {
  edhrecMark: {
    value: 'nominative-use',
    must: {
      'THIRD_PARTY_NOTICES.md': ['nominative use',
        'We have not asked for permission and have been given none'],
      'docs/ROADMAP.md': ['Shipped, on nominative use']
    },
    forbidden: {
      'THIRD_PARTY_NOTICES.md': [/^\s*unresolved/im, 'not cleared'],
      // The README was the last document still carrying the old wording, and it was
      // found by reading the rendered page after the notices had been fixed — which
      // is the argument for putting the words in a check rather than in a reviewer's
      // memory: a table of licences is exactly where a stale sentence hides.
      'README.md': [/not cleared/i]
    }
  },
  cardTraderMark: {
    value: 'nominative-use',
    must: {
      'THIRD_PARTY_NOTICES.md': ['nominative use'],
      'docs/ROADMAP.md': ['nominative use']
    },
    forbidden: {
      'THIRD_PARTY_NOTICES.md': [/^\s*unresolved/im, 'not cleared'],
      'README.md': [/not cleared/i]
    }
  },
  cardTraderApi: {
    value: 'user-token',
    must: {
      'THIRD_PARTY_NOTICES.md': ["user's own token"],
      'docs/ROADMAP.md': ["user's own credential"]
    },
    forbidden: {}
  },
  cardmarketLogo: {
    value: 'their-published-terms',
    must: { 'THIRD_PARTY_NOTICES.md': ['on their terms'] },
    forbidden: {}
  },
  // Checked in a real deck editor on 2026-10-01. Recorded because a document claiming the
  // opposite is not a stale detail: it tells a reader the code has never run.
  deckModulesLiveTested: {
    value: true,
    must: {},
    forbidden: {
      'THIRD_PARTY_NOTICES.md': ['has yet been checked against a live deck editor',
        'neither has yet been checked']
    }
  },
  // What this project deliberately does not ship, stated so a reader can check it.
  noCardArtwork: {
    value: true,
    must: {},
    forbidden: {}
  }
};

// Documents that describe the current state, and so must not carry a version, a path or a
// claim that has since stopped being true. History is fine — a paragraph that says what
// the code used to be is not drift — so these are phrases that assert the present.
const CURRENT_STATE = {
  'THIRD_PARTY_NOTICES.md': [
    { forbidden: ['content-*.js'], why: 'the file prefix was removed when the scripts were split up' },
    { forbidden: ['## Open questions\n\nThese could not be settled'], why: 'the list is kept to what is still open' }
  ],
  'README.md': [
    { forbidden: ['content-*.js'], why: 'the same prefix, gone since the split' },
    { forbidden: ['beside a switch is the panel'], why: 'the pictures moved behind the "?"' }
  ],
  'PRIVACY.md': [
    { forbidden: [/Extension version \d+\.\d+\.\d+/], why: 'the version was stale four releases running; the policy changes with the code, not the number' }
  ],
  'docs/CHROME_WEB_STORE_LISTING.md': [
    { forbidden: ['`content.js`'], why: 'one file that no longer exists' },
    {
      forbidden: [/Item name:\*\* Scryfall Toolkit \(Preview\)/],
      why: 'the manifest has not called itself a preview since 0.46.0, so the form would ask a reviewer ' +
        'to type a name Chrome never shows. The two said different things about one fact for four releases.'
    }
  ],
  // Two documents, one fact, and they had been saying different things: FEATURES said
  // four deck modules were ported, the road map said the fourth was taken back out and no
  // code from it is in the package. Nothing here could see it, because each document was
  // checked on its own.
  //
  // So the pairing is asserted from both sides: the count and the taking-back-out have to
  // appear together, and neither document may be edited to claim four.
  'docs/FEATURES.md': [
    {
      forbidden: [/All four Shambleshark deck modules/],
      why: 'the fourth was ported and removed; see the road map'
    },
    { required: [/Three\*\* Shambleshark deck modules are here/], why: 'the count is three, and it is stated' }
  ],
  'docs/ROADMAP.md': [
    { required: ['A fourth Shambleshark module'], why: 'the record of taking it back out stays' }
  ]
};

function check() {
  const problems = [];
  const notes = [];

  for (const [name, fact] of Object.entries(FACTS)) {
    const files = new Set([...Object.keys(fact.must), ...Object.keys(fact.forbidden)]);
    for (const file of files) {
      const text = read(file);
      for (const phrase of fact.must[file] || []) {
        if (!text.includes(phrase)) {
          problems.push(`${name}: ${file} does not say "${phrase}", which is the position this project takes`);
        }
      }
      for (const phrase of fact.forbidden[file] || []) {
        const pattern = phrase instanceof RegExp ? phrase : new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const match = text.match(pattern);
        if (match) {
          problems.push(`${name}: ${file} still says "${match[0]}", which is the position this project left`);
        }
      }
    }
    notes.push(`${name} = ${fact.value}`);
  }

  for (const [file, rules] of Object.entries(CURRENT_STATE)) {
    const text = read(file);
    for (const rule of rules) {
      for (const phrase of rule.forbidden || []) {
        const pattern = phrase instanceof RegExp ? phrase : new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (pattern.test(text)) problems.push(`${file}: ${rule.why}`);
      }
      // `required` is the other half and it is the half that catches a document quietly
      // dropping a fact rather than asserting a wrong one. Two documents once disagreed
      // about how many deck modules there are, and neither was wrong on its own terms:
      // one said four were ported, the other said the fourth had been taken back out.
      // A forbidden phrase finds the first. It cannot find the second, because the second
      // document never made the claim — so the claim has to be required somewhere, in the
      // document that does make it.
      for (const phrase of rule.required || []) {
        const pattern = phrase instanceof RegExp ? phrase : new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (!pattern.test(text)) problems.push(`${file}: ${rule.why}`);
      }
    }
  }

  // The store screenshots, and the one number the listing quotes about them.
  //
  // The listing says the five tiles come from one capture of a stated size. That number
  // went stale for five settings and nobody noticed, because it was prose: the settings
  // page grew, the tiles were re-cut, and the document still said the height before. A
  // reviewer comparing the description against the pictures finds the mismatch, and so
  // does nobody else, because the number is only ever read when the page changes.
  //
  // The height is in the PNG itself — bytes 16 to 23 of any PNG are the width and the
  // height as two big-endian 32-bit integers — so this does not compare a document with a
  // document, it compares the document with the artefact it describes. The tile count is
  // checked the same way, because a fifth tile that stopped being produced would leave a
  // listing pointing at files that do not exist.
  {
    const LISTING = 'docs/CHROME_WEB_STORE_LISTING.md';
    const listing = read(LISTING);
    const full = 'store-assets/settings-page-full.png';
    const size = pngSize(full);
    if (!size) {
      problems.push(`${LISTING}: ${full} is missing or is not a PNG, so the height cannot be confirmed`);
    } else {
      const quoted = listing.match(/settings-page-full\.png`,\s*(\d+)[×x](\d+)/);
      if (!quoted) {
        problems.push(`${LISTING}: no longer states the size of ${full}, and that size is how a reader knows the tiles come from one capture`);
      } else if (Number(quoted[2]) !== size.height) {
        problems.push(`${LISTING}: says the capture is ${quoted[1]}x${quoted[2]}, and it is ${size.width}x${size.height}. Re-cut the tiles and fix the row descriptions, because moving one section into the next tile is the whole failure here.`);
      } else if (Number(quoted[1]) !== size.width) {
        problems.push(`${LISTING}: says the capture is ${size.height === size.width ? 'a square' : quoted[1]} wide and the PNG is ${size.width}`);
      }
    }
    // Each of the tiles the listing names has to exist, and each has to be the size the
    // store takes. A listing that points at a file nobody produced is worse than one that
    // points at an old one: the reviewer finds out at upload.
    const tiles = [...new Set([...listing.matchAll(/store-assets\/(0\d-settings-0\d-of-\d\d)\.png/g)]
      .map(m => m[1]))];
    for (const stem of tiles) {
      const found = pngSize('store-assets/' + stem + '.png');
      if (!found) problems.push(`${LISTING}: names ${stem}.png and store-assets/ does not have it`);
      else if (found.width !== 1280 || found.height !== 800) {
        problems.push(`${LISTING}: ${stem}.png is ${found.width}x${found.height}; the store takes 1280x800`);
      }
    }
    // The tiles have to be one capture cut into a whole number of pieces. The store takes
    // at most five screenshots, so a sixth is a submission that cannot be uploaded, and a
    // denominator that does not match the count means one of them was never named.
    const totals = new Set(tiles.map(stem => Number(stem.match(/-of-(\d+)$/)[1])));
    if (totals.size !== 1) {
      problems.push(`${LISTING}: the tiles are numbered as ${tiles.join(' and ')}, which is not one capture cut into five`);
    } else if (tiles.length !== [...totals][0]) {
      problems.push(`${LISTING}: the tiles say "of ${[...totals][0]}" and ${tiles.length} of them are named, so one was never made or never listed`);
    } else if (tiles.length > 5) {
      problems.push(`${LISTING}: ${tiles.length} tiles are named and the store takes at most 5 screenshots`);
    }
  }

  return { problems, notes };
}

// The width and height out of a PNG's IHDR chunk, which is fixed at the front of every
// PNG: 8 signature bytes, then the chunk length and type, then width and height as
// big-endian 32-bit integers. Returns null when the file is absent or is not a PNG, which
// the caller reports rather than treats as a size of zero.
function pngSize(file) {
  let bytes;
  try { bytes = fs.readFileSync(path.join(ROOT, file)); } catch (e) { return null; }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) return null;
  if (bytes.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

module.exports = { FACTS, CURRENT_STATE, check, pngSize };

if (require.main === module) {
  const { problems, notes } = check();
  for (const note of notes) console.log('  ' + note);
  if (problems.length) {
    console.error('\nthe documents disagree with each other, or with this file:');
    for (const problem of problems) console.error('  ' + problem);
    process.exit(1);
  }
  console.log('\n  every document agrees with every other one');
}