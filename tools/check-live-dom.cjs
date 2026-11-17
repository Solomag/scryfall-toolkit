// Is Scryfall's markup still what this extension expects?
//
// docs/scryfall-dom.md lists every Scryfall class the theme and the scripts reach for.
// This opens the public pages of scryfall.com and tagger.scryfall.com in a real browser,
// collects every class and id that is actually on them, and compares. A name that was there
// last time and is not any more is the signature of a rename on Scryfall's side — the kind
// of change that otherwise shows up only as a feature that quietly stopped working.
//
// Not every listed name can be seen this way: some appear only after a click (menus,
// dialogs), and some only on pages behind a sign-in (settings, deck editor). Those are kept
// in tools/live-dom-baseline.json as "not seen on public pages", and only a name that drops
// out of sight *outside* that list is reported. So the run says nothing when nothing changed.
//
// The baseline has a second list, `stale`: names that should be on a public page and are
// not, because Scryfall has already changed that page. They are printed on every run as a
// reminder, without failing it, until the theme or the script that uses them is fixed and
// the name leaves the contract.
//
//   node tools/check-live-dom.cjs            check; exit 1 if a name went missing
//   node tools/check-live-dom.cjs --update   rewrite the baseline from this run
//
// The pages are opened without the extension: the question is what Scryfall serves.
const fs = require('node:fs');
const path = require('node:path');
const { Session, ROOT } = require('./shots/render.cjs');

const DOC = path.join(ROOT, 'docs', 'scryfall-dom.md');
const BASELINE = path.join(__dirname, 'live-dom-baseline.json');

const PAGES = [
  'https://scryfall.com/',
  'https://scryfall.com/card/m10/146/lightning-bolt',
  'https://scryfall.com/card/isd/51/delver-of-secrets-insectile-aberration',
  'https://scryfall.com/card/sta/42/ja',
  'https://scryfall.com/search?q=t%3Agoblin+c%3Ar',
  'https://scryfall.com/search?q=t%3Agoblin+c%3Ar&as=text',
  'https://scryfall.com/search?q=t%3Agoblin+c%3Ar&as=checklist',
  'https://scryfall.com/search?q=t%3Agoblin+c%3Ar+mv%3D1&as=full',
  'https://scryfall.com/search?q=zzzzqqqq',
  'https://scryfall.com/advanced',
  'https://scryfall.com/sets',
  'https://scryfall.com/sets/mh3',
  'https://scryfall.com/docs/syntax',
  'https://scryfall.com/docs/api',
  'https://scryfall.com/docs/faqs',
  'https://scryfall.com/bots',
  'https://scryfall.com/blog',
  'https://scryfall.com/blog/new-webp-images-jpeg-deprecations-237',
  'https://scryfall.com/team',
  'https://tagger.scryfall.com/card/m10/146',
  'https://tagger.scryfall.com/tags/card/burn'
];

// Every name the document lists, with the section it is under and, for the scripts' own
// selectors, the files that use it.
function readContract() {
  const text = fs.readFileSync(DOC, 'utf8');
  const names = new Map();
  let section = '';
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^## (.+)/);
    if (heading) { section = heading[1].trim(); continue; }
    const css = line.match(/^\| `\.([^`]+)` \| \d+ \| (.+) \|$/);
    if (css) {
      const entry = names.get('class:' + css[1]) || { kind: 'class', name: css[1], sections: [], files: [] };
      entry.sections.push(section);
      names.set('class:' + css[1], entry);
      continue;
    }
    const js = line.match(/^\| `([^`]+)` \| (class|id) \| (.+) \|$/);
    if (js) {
      const key = js[2] + ':' + js[1];
      const entry = names.get(key) || { kind: js[2], name: js[1], sections: [], files: [] };
      entry.sections.push('scripts');
      entry.files.push(...js[3].split(',').map(file => file.trim()));
      names.set(key, entry);
    }
  }
  return names;
}

async function collect() {
  const seen = new Set();
  const failed = [];
  const session = new Session({});
  await session.open();
  try {
    for (const url of PAGES) {
      try {
        await session.go(url, { settle: 3500 });
        const found = await session.evaluate(`(() => {
          const out = [];
          for (const node of document.querySelectorAll('*')) {
            for (const name of node.classList) out.push('class:' + name);
            if (node.id) out.push('id:' + node.id);
          }
          return [...new Set(out)];
        })()`);
        for (const key of found || []) seen.add(key);
        process.stdout.write('.');
      } catch (error) {
        failed.push(url + ' — ' + (error.message || error));
        process.stdout.write('x');
      }
    }
  } finally {
    await session.close();
  }
  process.stdout.write('\n');
  return { seen, failed };
}

(async () => {
  const contract = readContract();
  const { seen, failed } = await collect();
  if (failed.length > PAGES.length / 3) {
    console.error(`Too many pages did not load (${failed.length} of ${PAGES.length}); not judging the markup:\n` + failed.join('\n'));
    process.exit(2);
  }
  const unseen = [...contract.keys()].filter(key => !seen.has(key)).sort();

  if (process.argv.includes('--update')) {
    // `stale` is kept as written: it is a judgement about a page, not something this run can make.
    const before = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
    const stale = (before.stale || []).filter(key => unseen.includes(key));
    fs.writeFileSync(BASELINE, JSON.stringify({
      note: 'Names from docs/scryfall-dom.md not seen on the public pages tools/check-live-dom.cjs opens. `unseen`: they appear only after a click or behind a sign-in. `stale`: they should be on a public page and are not, because Scryfall changed it; fix the theme or script that uses them. `unseen` is rewritten by `node tools/check-live-dom.cjs --update`; `stale` is kept by hand.',
      updated: new Date().toISOString().slice(0, 10),
      stale,
      unseen: unseen.filter(key => !stale.includes(key))
    }, null, 2) + '\n');
    console.log(`Baseline written: ${unseen.length} of ${contract.size} names are not on the public pages.`);
    return;
  }

  const saved = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const stale = (saved.stale || []).filter(key => contract.has(key) && !seen.has(key));
  const baseline = new Set([...(saved.unseen || []), ...stale]);
  const gone = unseen.filter(key => !baseline.has(key));
  const back = [...baseline].filter(key => contract.has(key) && seen.has(key));
  const newInContract = [...contract.keys()].filter(key => !baseline.has(key) && !seen.has(key));
  if (stale.length) {
    console.log(`Already gone, known, not yet fixed (${stale.length}): ` +
      stale.map(key => (contract.get(key).kind === 'id' ? '#' : '.') + contract.get(key).name).join(' '));
  }
  if (failed.length) console.log(`Pages that did not load (their names were not checked):\n  ${failed.join('\n  ')}`);
  if (back.length) console.log(`Seen now though the baseline expected not to (run --update to tidy): ${back.join(', ')}`);
  if (!gone.length) {
    console.log(`OK: every name that was on Scryfall's public pages still is (${contract.size - unseen.length} checked on ${PAGES.length - failed.length} pages).`);
    return;
  }
  console.log(`Gone from Scryfall's public pages — likely renamed or removed (${gone.length}):`);
  for (const key of gone) {
    const entry = contract.get(key);
    const where = entry.files.length ? entry.files.join(', ') : 'the theme: ' + entry.sections.filter(s => s !== 'scripts').join('; ');
    console.log(`  ${entry.kind === 'id' ? '#' : '.'}${entry.name}  →  ${where}`);
  }
  if (newInContract.length && newInContract.length === gone.length) {
    console.log('(These may be names added to the contract since the baseline was written; if so, run --update.)');
  }
  process.exit(1);
})().catch(error => { console.error(error); process.exit(2); });
