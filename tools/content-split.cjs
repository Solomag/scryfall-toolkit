// Slice content.js into files by definition name. Nothing is retyped: every line
// is moved as it stands, so the split cannot quietly change a character of logic.
const fs = require('node:fs');
const ROOT = 'H:/Solo/Downloads/scryfall-toolkit/';
// Normalised on read. A Windows checkout has CRLF and a Linux one does not, and an
// anchor written as `$` silently stops matching on whichever has the carriage
// return — which is how every line of the boot can come back as zero matches with
// no error anywhere. Everything generated from here is written out as LF.
const src = fs.readFileSync(ROOT + 'content.js', 'utf8').replace(/\r\n/g, '\n');
const lines = src.split('\n');

// 1. Where each top-level definition begins (the `const x =` / `function x(` line).
const defs = [];
lines.forEach((l, i) => {
  let m = /^  (?:const|let) ([a-zA-Z0-9_]+)\s*=/.exec(l);
  if (m) { defs.push({ name: m[1], defLine: i }); return; }
  m = /^  (?:async )?function ([a-zA-Z0-9_]+)\s*\(/.exec(l);
  if (m) { defs.push({ name: m[1], defLine: i }); return; }
  m = /^  window\.addEventListener/.exec(l);
  if (m) { defs.push({ name: '@windowListener', defLine: i }); return; }
  m = /^  chrome\.storage\.onChanged/.exec(l);
  if (m) { defs.push({ name: '@storageListener', defLine: i }); return; }
});

// 2. The block starts at the definition or at the comment block directly above it.
for (const d of defs) {
  let from = d.defLine;
  while (from > 0 && lines[from - 1].trim().startsWith('//')) from--;
  d.start = from;
}
const ordered = defs.slice().sort((a, b) => a.defLine - b.defLine);
// The IIFE terminator is not part of any definition. It is found rather than
// assumed, because assuming it is how the last function came to own a stray
// `})();` and the generated core would not parse.
let lastStatement = lines.length - 1;
while (lastStatement > 0 && lines[lastStatement].trim() === '') lastStatement--;
if (lines[lastStatement].trim() === '})();') lastStatement--;
for (let k = 0; k < ordered.length; k++) {
  const d = ordered[k];
  d.end = k + 1 < ordered.length ? ordered[k + 1].defLine - 1 : lastStatement;
}
// 3. Blocks must not overlap. Where two definitions are separated by nothing but
//    comments, the comments go to the one they are written above.
let previousEnd = 11; // line 12 (1-based) is the first statement after the IIFE head
for (const d of ordered) {
  if (d.start < previousEnd) d.start = previousEnd;
  previousEnd = d.end + 1;
  d.lead = d.start;
}

const byName = new Map(ordered.map(d => [d.name, d]));
const take = name => {
  const d = byName.get(name);
  if (!d) throw new Error('no such definition: ' + name);
  return lines.slice(d.start, d.end + 1).join('\n');
};
const span = name => {
  const d = byName.get(name);
  if (!d) throw new Error('no such definition: ' + name);
  return (d.start + 1) + '..' + (d.end + 1);
};

// The boot: the `if (condition) initX();` lines that sat between `request` and
// the first feature. They are read out of the source rather than written out
// again here, so the conditions that end up in the new core are the conditions
// that were there — not a list typed out from memory, which is how a feature ends
// up running on a page it has no business on.
//
// The step name is the function's own name without `init` and with a lower-case
// first letter: `initCardNicknames` registers as `cardNicknames`. Both sides of
// the split derive it the same way, so the two cannot drift apart.
function stepNameOf(fn) {
  const bare = fn.startsWith('init') ? fn.slice(4) : fn;
  return bare.charAt(0).toLowerCase() + bare.slice(1);
}

function bootSteps() {
  const request = byName.get('request');
  const firstFeature = byName.get('initSetFilter');
  const region = lines.slice(request.defLine, firstFeature.defLine);
  const steps = [];
  for (const line of region) {
    const m = /^ {2}if \((.+)\) (await )?([A-Za-z0-9_$]+)\(\);$/.exec(line);
    if (m) steps.push([stepNameOf(m[3]), m[1], Boolean(m[2]), m[3]]);
  }
  if (steps.length < 10) {
    throw new Error('found only ' + steps.length + ' boot steps; the boot is not where it was expected');
  }
  return steps;
}

module.exports = { lines, ordered, byName, take, span, src, bootSteps, stepNameOf };

if (require.main === module) {
  for (const d of ordered) console.log(d.name.padEnd(26) + span(d.name).padStart(14));
  console.log('total lines: ' + lines.length);
}
