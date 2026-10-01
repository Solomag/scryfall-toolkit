// Cut src/styles/theme.css into contiguous parts.
//
// A one-shot: it cut the stylesheet once, and it stays as the record of how —
// the same reason tools/content-split.cjs is still here after content.js stopped
// existing. The parts are the source now, not the file it read.
//
// Three things held it together, and all three are load-bearing:
//
//   Contiguous only. CSS has no notion of a file, only of order: two rules of
//   equal specificity decide which wins by which came last, so grouping rules by
//   page would change what the stylesheet does without saying so.
//
//   The licence header is in every part. They are one work under one licence,
//   and MPL 2.0 asks for the notice in the source file — a notice in the first
//   part and nowhere else is a notice about six sevenths of the stylesheet that
//   nobody would find.
//
//   The parts reassemble into the file they came from. That is checked below, by
//   putting them back together and comparing, and it is the only thing here that
//   would catch a rule that went missing without anyone noticing.
//
// It will not run again as it stands: src/styles/theme.css does not exist, because
// this is the tool that split it. To run it, take the file out of the history first
// (`git show <the commit before the split>:src/styles/theme.css > src/styles/theme.css`),
// run this, and delete the single file again. The reason to keep it at all is that
// a split decided by hand and a split decided by a checked rule are not the same
// thing, and this is the record of which one happened and why the boundaries are
// where they are.
const fs = require('node:fs');
const path = require('node:path');
const { readTheme, ROOT } = require('./css-parts.cjs');
const { familyOf } = require('./css-families.cjs');

const OUT = ROOT + 'src/styles/theme';
const theme = readTheme(ROOT + 'src/styles/theme.css');
const { lines, licence, segments } = theme;

// Cut points are rule indices into the reading tools/css-parts.cjs gives, taken
// from the runs tools/css-plan.cjs prints. `named` is the family the part's name
// claims; it is checked below, because a part called Tagger that holds mostly
// something else is worse than one big file — it sends a reader to the wrong
// place with confidence.
const PARTS = [
  { file: '01-card-page.css', from: 0, to: 79, named: 'card-page',
    about: 'the card page: its text, the prints table, the toolbox and the header' },
  { file: '02-shared-pages.css', from: 79, to: 178, named: 'shared',
    about: 'rules that reach for more than one page: the deck lists, the jump bar, the marketing pages' },
  { file: '03-account-and-marketing.css', from: 178, to: 234, named: 'account',
    about: 'the account pages, and the blog, team and bots pages beside them' },
  { file: '04-surfaces.css', from: 234, to: 279, named: 'shared',
    about: 'surfaces more than one page asks for, and the palette they share' },
  { file: '05-tagger.css', from: 279, to: 300, named: 'tagger',
    about: 'the MoxTags Tagger site, which brings its own surfaces and its own ink' },
  { file: '06-shared-surfaces.css', from: 300, to: 328, named: 'shared',
    about: 'more shared surfaces: the deck tray, the select lists, the narrow-viewport search' },
  { file: '07-our-own-ui.css', from: 328, to: segments.length, named: 'ours',
    about: 'the panels, rows, previews and controls this project adds to Scryfall' }
];

fs.mkdirSync(OUT, { recursive: true });
const bodies = [];
const report = [];

PARTS.forEach((part, index) => {
  const last = Math.min(part.to, segments.length) - 1;
  if (last < part.from) {
    console.error(part.file + ': an empty part');
    process.exit(1);
  }
  // Every line of the original is terminated, so a slice that ends on a rule gets
  // its newline back here. Without it the last rule of one part and the first of
  // the next would be glued into a single line, which is a difference in the
  // middle of a selector.
  const slice = lines.slice(segments[part.from].ownedFrom, segments[last].ownedTo);
  const joined = slice.join('\n');
  const body = joined.endsWith('\n') ? joined : joined + '\n';
  const prefix = [
    licence,
    '/* ' + part.file + ' — ' + part.about + '.',
    ' *',
    ' * Part ' + (index + 1) + ' of ' + PARTS.length + ' of the dark theme, in cascade order.',
    ' * The manifest lists these in this order, and CSS only knows the order a stylesheet',
    ' * is loaded in: moving a rule from one part to another can change which of two',
    ' * equally specific rules wins. If a rule has to move, move it and check the page it',
    ' * was on.',
    ' */'
  ].join('\n') + '\n';
  const text = prefix + body;
  fs.writeFileSync(path.join(OUT, part.file), text, 'utf8');

  // The whole file is compared, not a piece of it. A check that has to work out
  // where the header stops is a check that can pass for the wrong reason, and
  // this is the one place where a wrong answer ships a theme that is not the
  // theme that was tested.
  const read = fs.readFileSync(path.join(OUT, part.file), 'utf8').replace(/\r\n/g, '\n');
  if (read !== text) {
    const at = [...text].findIndex((c, i) => c !== read[i]);
    console.error(part.file + ': what came back is not what was written');
    console.error('  wrote ' + text.length + ' characters, read ' + read.length);
    console.error('  first difference at ' + at + ':');
    console.error('    wrote ' + JSON.stringify(text.slice(Math.max(0, at - 20), at + 60)));
    console.error('    read  ' + JSON.stringify(read.slice(Math.max(0, at - 20), at + 60)));
    process.exit(1);
  }
  bodies.push(read.slice(prefix.length));

  const families = new Map();
  for (let i = part.from; i < part.to; i++) {
    const family = familyOf(segments[i].selector);
    families.set(family, (families.get(family) || 0) + 1);
  }
  const ranked = [...families].sort((a, b) => b[1] - a[1]);
  if (ranked[0][0] !== part.named) {
    console.error(part.file + ': the name claims ' + part.named + ' and the part is mostly ' +
      ranked[0][0] + ' (' + ranked.map(([f, n]) => f + ' ' + n).join(', ') + ')');
    process.exit(1);
  }
  report.push({ file: part.file, lines: read.split('\n').length, bodyLines: body.split('\n').length,
    prefixLines: prefix.split('\n').length, rules: part.to - part.from, ranked });
});

// --- verify -----------------------------------------------------------------
// Put the parts back together and compare against the file they came from. Every
// mistake this tool could make — a dropped comment, a rule in two parts, a
// boundary inside a run of blank lines, an off-by-one at the end — is a
// difference here.
const rebuilt = bodies.join('');
const whole = lines.slice(theme.headerEnd).join('\n').replace(/^\n/, '');
const expected = whole.endsWith('\n') ? whole : whole + '\n';
if (rebuilt !== expected) {
  const a = rebuilt.split('\n');
  const b = expected.split('\n');
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) at++;
  console.error('the parts do not reassemble into the original');
  console.error('  first difference at line ' + (at + 1) + ' of ' + b.length +
    ' (rebuilt has ' + a.length + ' lines)');
  for (let i = Math.max(0, at - 3); i <= at + 2; i++) {
    console.error('  ' + String(i + 1).padStart(5) +
      '  rebuilt:  ' + JSON.stringify((a[i] || '').slice(0, 78)));
    console.error('  ' + String(i + 1).padStart(5) +
      '  original: ' + JSON.stringify((b[i] || '').slice(0, 78)));
  }
  console.error('  tail of the rebuild:  ' + JSON.stringify(rebuilt.slice(-60)));
  console.error('  tail of the original: ' + JSON.stringify(expected.slice(-60)));
  process.exit(1);
}

for (const r of report) {
  console.log('  ' + r.file.padEnd(28) + String(r.lines).padStart(4) + ' lines (' +
    r.prefixLines + ' header + ' + r.bodyLines + ')  ' + String(r.rules).padStart(3) +
    ' rules   ' + r.ranked.map(([f, n]) => f + ' ' + n).join(', '));
}
console.log('\n' + PARTS.length + ' parts, ' + segments.length + ' rules, and they reassemble into the original.');