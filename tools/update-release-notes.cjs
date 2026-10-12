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

// Rewrite the notes of releases already published, from CHANGELOG.md.
//
// The releases were published with the same CI note for every tag, and the changelog says the detail
// lives in the release notes for that version — which were never written. The workflow now reads the
// notes from the changelog for every tag from here on; this does the same for the tags that were
// published before that, which nothing can retro-fit at build time.
//
// It needs a token with permission to write releases: a classic personal access token with `repo`,
// or a fine-grained one with "Contents: read and write". It never runs in CI and is not part of the
// test suite — it is run once by hand, by whoever owns the repository.
//
//   GITHUB_TOKEN=... node tools/update-release-notes.cjs            every release with an entry
//   GITHUB_TOKEN=... node tools/update-release-notes.cjs 2.4.2 2.4.1  only the named versions
//   GITHUB_TOKEN=... node tools/update-release-notes.cjs --dry-run  print, change nothing
//
// A tag with no changelog entry is left alone rather than blanked: an older release whose story was
// never written into the changelog keeps the note it has.
const { notes } = require('./release-notes.cjs');

const REPO = process.env.GITHUB_REPOSITORY || 'Solomag/scryfall-toolkit';
const API = 'https://api.github.com';
const CI_NOTE = [
  'Built by CI from this tag. The SHA-256 is printed in the workflow run that produced this file,',
  'so the bytes published here can be tied to the commit and the runner that made them.'
].join('\n');

function body(version) {
  const section = notes(version);
  if (!section) return '';
  return section.trim() + '\n\n---\n\n' + CI_NOTE + '\n\nVerify against the run: **Actions → Release → v' + version + '**\n';
}

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      // Only when there is one: listing a public repository's releases needs no token, and the
      // dry run is the one that is useful before anybody has one to hand.
      ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}),
      'User-Agent': 'scryfall-toolkit-release-notes',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${path}: ${(await response.text()).slice(0, 200)}`);
  return response.status === 204 ? null : response.json();
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const only = argv.filter(arg => arg !== '--dry-run').map(arg => arg.replace(/^v/, ''));
  if (!process.env.GITHUB_TOKEN && !dryRun) {
    throw new Error('set GITHUB_TOKEN (a token with permission to write releases)');
  }

  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/repos/${REPO}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
  }

  let changed = 0;
  for (const release of releases) {
    const version = String(release.tag_name || '').replace(/^v/, '');
    if (only.length && !only.includes(version)) continue;
    const wanted = body(version);
    if (!wanted) {
      console.log(`skip  v${version}: no changelog entry`);
      continue;
    }
    if (release.body === wanted) {
      console.log(`same  v${version}`);
      continue;
    }
    if (dryRun) {
      console.log(`would update v${version} (${wanted.length} chars)`);
      continue;
    }
    await api(`/repos/${REPO}/releases/${release.id}`, { method: 'PATCH', body: JSON.stringify({ body: wanted }) });
    changed++;
    console.log(`updated v${version}`);
  }
  console.log(`${changed} release${changed === 1 ? '' : 's'} updated`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
