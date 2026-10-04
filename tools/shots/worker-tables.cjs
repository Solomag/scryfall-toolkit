// The worker's own name patterns, read out of its source.
//
// There were once two copies of these tables: one in `worker.js`, which is what ships, and one
// in the tools, which is what draws the pictures and what checks the rules. The copy drifted
// when the two rules became per-category lists with sub-lists a reader can narrow to, and
// nothing said so — the copy's own comment had said a second copy "would quietly show a
// picture of a filter that does not exist", which is exactly what happened: every sub-list
// came back empty and both rules hid nothing.
//
// So there is one copy and this is how it is read. The declarations are located by name and
// evaluated, rather than copied, and a table that has been renamed or removed stops the tool
// with a sentence saying which one — an empty list would not.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const WORKER = path.join(__dirname, '..', '..', 'src', 'background', 'worker.js');

// The set types Scryfall serves that cannot hold a Commander card, which is what makes them
// junk rather than their name. Measured 2026-10-03 against `e:<set> format=commander`: these
// four return nothing, every other type returns cards.
const JUNK_TYPES = ['memorabilia', 'minigame', 'vanguard', 'token'];

function readTable(source, name) {
  const at = source.search(new RegExp('^const ' + name + ' = \\{', 'm'));
  if (at === -1) {
    throw new Error('worker.js has no ' + name + ' table of name patterns any more, so this ' +
      'tool cannot classify sets the way the extension does. Copying the patterns into a ' +
      'second place instead is what caused this: the copy drifted and nothing said so.');
  }
  const from = source.indexOf('{', at);
  let depth = 0;
  let end = from;
  for (; end < source.length; end += 1) {
    if (source[end] === '{') depth += 1;
    else if (source[end] === '}') { depth -= 1; if (depth === 0) break; }
  }
  // The slice is a `const NAME = {…}`, and `return` cannot be followed by a declaration, so
  // the table is declared and then returned rather than returned in place of itself.
  return new Function(source.slice(at, end + 1) + '\nreturn ' + name + ';')();
}

function workerTables() {
  const source = fs.readFileSync(WORKER, 'utf8');
  return { border: readTable(source, 'BORDER_SET_NAMES'), nonEnglish: readTable(source, 'NON_ENGLISH_SET_NAMES') };
}

// The classification itself, in the worker's own shape: `4bb`, `fbb` and `bchr` each carry
// their own codes, `portal` and `secret-lair` each carry their own, and `digital`,
// `nonTournament` and `oversized` are plain lists. Every sub-list has to come out with
// something in it: an empty one hides nothing and looks complete.
function classify(sets, tables) {
  const categories = {
    digital: [], nonTournament: [], oversized: [], foreignBlackBorder: {}, nonEnglish: {}
  };
  for (const set of sets) {
    if (!/^[a-z0-9_-]+$/i.test(set.code || '')) continue;
    const code = set.code.toLowerCase();
    const name = set.name || '';
    if (set.digital === true) categories.digital.push(code);
    for (const [key, pattern] of Object.entries(tables.border)) {
      if (pattern.test(name)) (categories.foreignBlackBorder[key] ||= []).push(code);
    }
    for (const [key, pattern] of Object.entries(tables.nonEnglish)) {
      if (pattern.test(name)) (categories.nonEnglish[key] ||= []).push(code);
    }
    if (/oversiz/i.test(name) || /^o(?:cmd|cd|pr|pd)/i.test(code)) categories.oversized.push(code);
    if (JUNK_TYPES.includes(set.set_type)) categories.nonTournament.push(code);
  }
  return categories;
}

// The dated list of sets with printings and no English printing, read from the file the
// extension loads.
//
// Read as a function call and evaluated, for the same reason the tables above are: the tools
// and the worker must be looking at one list, and a copy in the tools is a copy that drifts.
// `npm run set-rules --write` rewrites the file from a fresh sweep, and the check in that tool
// fails when the file and the sweep disagree, so a stale list is a failed check rather than a
// filter quietly hiding the wrong rows.
function shippedForeignOnly() {
  if (shippedForeignOnly.value) return shippedForeignOnly.value;
  const file = path.join(__dirname, '..', '..', 'assets', 'data', 'set-foreign-only.js');
  const self = {};
  new Function('self', fs.readFileSync(file, 'utf8'))(self);
  const list = self.__STK_SET_FOREIGN_ONLY;
  if (!Array.isArray(list)) {
    throw new Error('assets/data/set-foreign-only.js does not leave a list behind, so the ' +
      'rule that reads it has nothing to act on and would hide nothing without saying so');
  }
  shippedForeignOnly.value = list;
  return list;
}

module.exports = { workerTables, classify, shippedForeignOnly, JUNK_TYPES, WORKER };
