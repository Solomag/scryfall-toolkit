// Where the theme could be cut, in the reading tools/css-parts.cjs gives.
//
// Prints the runs of one family through the file, so the cut points are chosen
// against the list the writer will actually use rather than against a second
// guess at the same thing.
//
// The second guess is what went wrong the first time: this tool and the writer each
// parsed the stylesheet their own way, found 419 blocks and 364, and the cut points
// this one printed were indices into a list that no longer existed. One reader,
// shared — see tools/css-parts.cjs.
//
// Like the writer, it reads a file that the writer then splits apart, so it needs
// the single stylesheet put back first. The parts as they stand can be read with
// the same parser by pointing it at them one at a time.
const { readTheme } = require('./css-parts.cjs');
const { familyOf } = require('./css-families.cjs');
const { ROOT } = require('./css-parts.cjs');

const theme = readTheme(ROOT + 'src/styles/theme.css');
const runs = [];
theme.segments.forEach((segment, index) => {
  const family = familyOf(segment.selector);
  if (!runs.length || runs[runs.length - 1].family !== family) {
    runs.push({ family, from: index, to: index });
  } else {
    runs[runs.length - 1].to = index;
  }
});

console.log(theme.segments.length + ' rules, ' + runs.length + ' runs\n');
console.log('  from     to  count  family');
for (const run of runs) {
  const count = run.to - run.from + 1;
  console.log('  ' + String(run.from).padStart(5) + String(run.to).padStart(7) +
    String(count).padStart(7) + '  ' + run.family);
}