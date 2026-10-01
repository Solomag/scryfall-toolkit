# Release checklist

What has to be true before a version is tagged, beyond `npm test` passing.

The tests here are strong on **repository invariants**: that the archive contains what the
pages reference, that the version is written in all the files that show it, that the CSS
contract matches the CSS, that no host is used without being declared. They cannot see
Scryfall.

That is the whole risk in one sentence. A feature here reads another site's markup and, for
the deck editor, another site's application internals. Scryfall can change either with no
deprecation cycle and no changelog entry, and a suite of 1658 assertions running against a
stand-in will pass on code that stopped working last Tuesday.

## Why this is a checklist and not a test

A stand-in for `window.Scryfall` proves the code runs. It does not prove the answer is what
was assumed, and on 2026-10-01 it was not: four separate wrong assumptions about response
shapes and permission flow were found in a live deck in one sitting, none of which any test
could have caught.

Automating it is worse than not having it. Driving Scryfall's deck editor is a browser
automation suite with its own maintenance burden, it would break on their CSS, and it would
need credentials and rate limits. A checklist a person runs is honest about what it costs.

## Before tagging

Run against a real browser with the extension loaded. Ten minutes, and it is the only step
that cannot be automated.

- [ ] **Load** the archive unpacked, and reload it. No error in the page console — the
      console line that used to appear on every visit to the settings page is the one to
      watch for here.
- [ ] **Card page.** Tags and art tags appear next to the printings, with the "View all
      tags" link. Click a tag: it goes into the search box.
- [ ] **Related cards.** Previews on hover.
- [ ] **Printings.** All printings, grouped by set, finish badges on the rows, the
      full-page link works.
- [ ] **Legalities.** At least one extra format appears, with the right badge, in the
      position the format list asks for.
- [ ] **Clipboard.** `+` on a printing, the list follows to another tab, copy works in both
      formats.
- [ ] **Deck editor.** All four modules. They are **off by default**, so this is the step
      that needs them turned on first, and the step most likely to find something.
- [ ] **Tagger page.** Clipboard and the Tagger link on search results.
- [ ] **A Scryfall page in the light theme**, if the dark theme has just changed: the theme
      paints over their stylesheet and depends on their class names.

## Then, in this order

1. `npm test`
2. `npm run package` — and read the last line. It fails if any file a page needs is
   missing from the archive.
3. `node tools/project-status.cjs` — the documents agreeing with each other.
4. `node tools/make-feature-shots.cjs` — only if a feature's appearance changed. It fetches
   the live card page, so a network failure stops it rather than producing a stale picture.
5. Tag the version and let the release workflow build and publish it. **Not** a local
   build: the archive in a release has to come from the tag, or the SHA-256 printed in the
   release notes describes something nobody installed.

## Known limits that are not defects

Recorded so that finding them during a pass is not a surprise, and so that fixing one means
deciding rather than stumbling into it.

- **The dark theme depends on Scryfall's class names.** It paints over their stylesheet
  rather than replacing it, so a rename shows up as a partly unthemed page until this
  extension is updated. `docs/scryfall-dom.md` names every class and the theme part that
  reaches for it; the contract is generated and tested.
- **The deck editor modules depend on undocumented internals.** `window.Scryfall` and
  `window.ScryfallAPI` are theirs and covered by no licence. They stay off by default for
  that reason.
- **The illustrations in the settings are not a photograph of the extension running.** They
  are cut from a real card page with the real feature files over it, because Chrome 154
  refuses `--load-extension`. The panels are placed by the tool rather than by a content
  script.