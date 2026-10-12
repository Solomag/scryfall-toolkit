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

// The release notes for one tag, read from CHANGELOG.md.
//
// The changelog says the detail lives in the release notes for that version and is not repeated in
// it — which only holds if the release notes are written from the changelog. They were not: the
// workflow published the same CI note for every tag, and the detail lived nowhere. So the section
// the tag names is read here, and the workflow puts it in the release body.
//
// A version's section runs from its `### <version> - …` heading to the next `###`. A heading that
// is prose rather than a version ("### The AMO listing, …") is not a release and never matches.
//
// Usage: node tools/release-notes.cjs 2.4.2   (a leading `v` is accepted)
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');

function notes(version, changelog) {
  const text = changelog ?? fs.readFileSync(CHANGELOG, 'utf8');
  const wanted = String(version || '').trim().replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+$/.test(wanted)) return '';
  // `split` rather than a pattern that stops at the next heading: the sections hold blank lines and
  // lists, and the split is the same rule with fewer ways to be wrong.
  for (const block of text.split(/^### /m).slice(1)) {
    const heading = block.split('\n', 1)[0].trim();
    if (heading === wanted || heading.startsWith(wanted + ' ') || heading.startsWith(wanted + ' -')) {
      return '### ' + block.trim() + '\n';
    }
  }
  return '';
}

module.exports = { notes };

if (require.main === module) {
  const body = notes(process.argv[2]);
  if (!body) {
    // Not an error: a tag with no changelog entry still gets a release, with the CI note alone.
    process.stderr.write('no changelog entry for ' + (process.argv[2] || '(no version given)') + '\n');
    process.exit(0);
  }
  process.stdout.write(body);
}
