// The worker's own reading of /sets, read out of its source.
//
// There were once two copies of this rule: one in `worker.js`, which is what ships, and one in
// the tools, which is what draws the pictures. The copy drifted when the two rules became
// per-category lists with sub-lists a reader could narrow to, and nothing said so — the copy's
// own comment had said a second copy "would quietly show a picture of a filter that does not
// exist", which is exactly what happened: every sub-list came back empty and both rules hid
// nothing.
//
// So there is one copy and this is how it is read. What is left of it is a single boolean
// Scryfall publishes on the set, which is read here rather than restated because a second copy
// of a classification is a second thing that can be wrong about the same sets.
//
// The name-pattern tables this file used to read are gone with the rules that used them, and so
// is the type list: there is no set type in this group any more. What used to be a second
// copy is now the only copy, which is why this file is forty lines rather than a hundred.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const WORKER = path.join(__dirname, '..', '..', 'src', 'background', 'worker.js');

function classify(sets) {
  const categories = { digital: [] };
  for (const set of sets) {
    if (!/^[a-z0-9_-]+$/i.test(set.code || '')) continue;
    if (set.digital === true) categories.digital.push(String(set.code).toLowerCase());
  }
  // Every list must come out with something in it. An empty one hides nothing and looks
  // complete, which is the whole failure this guards against — Scryfall marked 61 sets digital
  // on 2026-10-06.
  if (!categories.digital.length) {
    throw new Error('not one set came out as digital, so the classification in the picture ' +
      'would be an empty claim');
  }
  return categories;
}

// The worker is read at least once so that a rename there is a failure here rather than a
// picture of a page the extension no longer draws. It looks for the list the worker builds,
// not for a table of names.
function assertWorkerClassifies() {
  const source = fs.readFileSync(WORKER, 'utf8');
  if (!/categories\.digital\.push/.test(source)) {
    throw new Error('worker.js no longer fills categories.digital, so the picture would be ' +
      'drawn from a classification the extension does not use');
  }
}

module.exports = { classify, assertWorkerClassifies, WORKER };