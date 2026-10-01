// One reading of the theme stylesheet, shared by everything that has to know
// where its rules are.
//
// This exists because tools/css-plan.cjs and tools/css-write-parts.cjs each had
// their own copy of the parser, and they disagreed: the plan found 419 blocks
// where the writer found 364, so the cut points the plan chose were indices into
// a list that no longer existed. Nothing failed loudly — the writer cut the file
// at plausible-looking places and the parts came out holding rules that had
// nothing to do with their names.
//
// Two readers of one file that do not read it the same way is the same failure
// as two halves of a system that do not agree on the protocol between them, and
// it is invisible until something that depends on both is compared.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..') + path.sep;

// A top-level block: the comment above it, if any, and the rule. Blank lines
// belong to the rule that follows them, so a cut between blocks never lands
// between two blank lines.
function parseTheme(text) {
  const source = text.replace(/\r\n/g, '\n');
  const lines = source.split('\n');

  let headerEnd = 0;
  if (!lines[0] || !lines[0].trim().startsWith('/*')) {
    throw new Error('the stylesheet does not open with a licence header');
  }
  while (headerEnd < lines.length && !lines[headerEnd].includes('*/')) headerEnd++;
  headerEnd++;
  const licence = lines.slice(0, headerEnd).join('\n');
  if (!licence.includes('Mozilla Public') || !licence.includes('MPL')) {
    throw new Error('the header at the top of the stylesheet is not the licence notice');
  }

  const segments = [];
  let depth = 0, inComment = false, commentAt = -1, start = 0;
  for (let i = headerEnd; i < lines.length; i++) {
    const line = lines[i];
    if (!inComment && depth === 0 && line.trim().startsWith('/*')) {
      inComment = true;
      commentAt = i;
      continue;
    }
    if (inComment) {
      if (line.includes('*/')) inComment = false;
      continue;
    }
    if (!line.trim()) continue;
    if (depth === 0) start = commentAt >= 0 ? commentAt : i;
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (depth < 0) throw new Error('unbalanced braces at line ' + (i + 1));
    if (depth === 0) {
      segments.push({ from: start, to: i, selector: lines[start] });
      commentAt = -1;
    }
  }
  if (depth !== 0) throw new Error('the stylesheet ends inside a rule');

  // Where a rule's text begins: after the rule above it, which is where the blank
  // lines above it are.
  //
  // Two passes, and the order matters. ownedTo reads the next rule's ownedFrom, so
  // every ownedFrom has to exist before any ownedTo is taken from it. Done in one
  // pass the reads come back undefined, Array.prototype.slice takes that as "to
  // the end of the array", and every part turns out to be the whole file — with no
  // error anywhere, which is the same shape as a tool that quietly stopped working.
  for (let i = 0; i < segments.length; i++) {
    segments[i].ownedFrom = i === 0 ? headerEnd : segments[i - 1].to + 1;
  }
  for (let i = 0; i < segments.length; i++) {
    segments[i].ownedTo = i + 1 < segments.length ? segments[i + 1].ownedFrom : lines.length;
  }
  for (let i = 0; i < segments.length; i++) {
    if (!(segments[i].ownedFrom <= segments[i].ownedTo && segments[i].ownedTo <= lines.length)) {
      throw new Error('rule ' + i + ' has no lines of its own');
    }
  }

  return { source, lines, headerEnd, licence, segments };
}

function readTheme(file) {
  return parseTheme(fs.readFileSync(file, 'utf8'));
}

module.exports = { parseTheme, readTheme, ROOT };