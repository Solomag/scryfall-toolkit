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
    { forbidden: ['`content.js`'], why: 'one file that no longer exists' }
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
      for (const phrase of rule.forbidden) {
        const pattern = phrase instanceof RegExp ? phrase : new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        if (pattern.test(text)) problems.push(`${file}: ${rule.why}`);
      }
    }
  }

  return { problems, notes };
}

module.exports = { FACTS, CURRENT_STATE, check };

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