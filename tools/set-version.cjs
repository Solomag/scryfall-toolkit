// One place that knows the version, so the files that have to agree are updated
// together and a partial bump cannot happen.
//
// The version lives in package-lock.json and nowhere else. That is not a choice
// anyone made: the lock has been the file nobody remembered to touch since the
// first commit, so the test that compares it to the manifest is the only thing
// that has ever caught the mismatch — and it caught it by failing, after the
// push, on the runner, as a red X in a notification. A helper that rewrites them
// all in one go is a better answer to that than another test.
//
// README.md is deliberately not one of them. Its title carried the number, and a
// number in a project page's title is a promise the page cannot keep: `main` moves
// every day, the releases move only when somebody tags, and a reader comparing the two
// is told a version exists that nobody can install. So the page said 0.58.0 while the
// newest release was 0.51.0, and both numbers were true. The version belongs in the
// releases, where it is stamped, and in the manifest inside the archive, where it is what
// Chrome actually reads.
//
// The store listing keeps its number: it is the document a reviewer holds against a
// submitted archive, so there the two have to match.
const fs = require('node:fs');
const path = require('node:path');
// The repository root, not this file's directory: the script lives in tools/
// and the files it edits do not.
const ROOT = path.join(__dirname, '..');

// Each entry: the file, and how the version appears in it. A marker of `json`
// means the file is JSON and the version is its `version` field, written back
// with the indentation the file already uses.
const TARGETS = [
  { file: 'package-lock.json', how: 'json' },
  { file: 'package.json', how: 'json' },
  { file: 'manifest.json', how: 'json' },
  { file: 'docs/CHROME_WEB_STORE_LISTING.md', how: 'title' }
];

function currentVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')).version;
}

function bump(next) {
  if (!/^\d+\.\d+\.\d+$/.test(String(next))) {
    throw new Error('the version has to look like 0.54.0, not ' + JSON.stringify(next));
  }
  const changed = [];
  for (const target of TARGETS) {
    const full = path.join(ROOT, target.file);
    if (!fs.existsSync(full)) throw new Error('no such file: ' + target.file);
    const before = fs.readFileSync(full, 'utf8');
    let after = before;
    if (target.how === 'json') {
      // Only the version field, and only the top-level one. Rewriting the whole
      // file through JSON.stringify would reformat it, and these files are read
      // by people as often as by machines.
      //
      // The lock has the version in two places: its own `version` and the root
      // entry's. `npm ci` compares them, so both are written.
      const parsed = JSON.parse(before);
      if (parsed.version === next && (!parsed.packages || !parsed.packages[''] || parsed.packages[''].version === next)) {
        continue;
      }
      after = before
        .replace(/("version"\s*:\s*)"[^"]*"/,
          (match, prefix) => prefix + JSON.stringify(next))
        .replace(/(""\s*:\s*\{[^}]*?"version"\s*:\s*)"[^"]*"/,
          (match, prefix) => prefix + JSON.stringify(next));
      const check = JSON.parse(after);
      if (check.version !== next || (check.packages && check.packages[''] && check.packages[''].version !== next)) {
        throw new Error('could not set the version in ' + target.file);
      }
    } else {
      after = before.replace(/^(# .*?Scryfall Toolkit )\d+\.\d+\.\d+/m,
        (match, prefix) => prefix + next);
      if (!after.includes('Scryfall Toolkit ' + next)) {
        throw new Error('could not find the version in the title of ' + target.file);
      }
    }
    if (after !== before) {
      fs.writeFileSync(full, after);
      changed.push(target.file);
    }
  }
  return changed;
}

module.exports = { currentVersion, bump, TARGETS };

if (require.main === module) {
  const next = process.argv[2];
  if (!next) {
    console.log('current: ' + currentVersion());
    console.log('usage: node tools/set-version.cjs 0.55.0');
    process.exit(0);
  }
  const changed = bump(next);
  console.log('version ' + currentVersion() + ', written to: ' + (changed.join(', ') || 'nothing'));
}
