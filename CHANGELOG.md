# Changelog

An index of what each release was about. The detail lives in the release notes for that
version, and is not repeated here — a copy of them would drift, and this file's only job
is to answer "what changed and where do I read about it".

All releases: <https://github.com/Solomag/scryfall-toolkit/releases>

---

## Unreleased

The dark theme was one 753-line stylesheet. It is seven files now, under
`src/styles/theme/`: the card page, shared pages, the account and marketing pages,
surfaces, Tagger, more shared surfaces, and our own panels. The manifest lists them in
cascade order, because CSS only knows the order a stylesheet is loaded in — moving a
rule from one part to another can change which of two equally specific rules wins.

The split is contiguous, not grouped by page. That was the constraint worth
understanding: a stylesheet cannot be reorganised by what a rule is about without
changing what it does, and no amount of care afterwards gets that back. So the parts
are unbroken runs of the original, and the boundaries are placed where a run of rules
settles on one subject. `tools/css-write-parts.cjs` puts the parts back together and
compares the result with the file they came from, character for character; the
contract document came out with the same 361 class names and the same 404 rules.

Each part carries the MPL notice in its own header. Seven files are one work under one
licence, and a notice in the first part is a notice about six sevenths of the
stylesheet that nobody would find.

`docs/scryfall-dom.md` now names the part each dependency is written in, which is the
question the split was made to answer: when Scryfall renames a class, one file to open.
It is generated, and a test runs the generator and fails if the committed document is
not what it produces, so a rule that moves without the document moving says so.

The checks that read the theme read it as the concatenation, in manifest order, through
one harness function. Six of them read a single file before, and after the split a
check that read one part would have been checking a page of the theme and calling it
the theme.

## [v0.52.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.52.0) — 2026-09-29

The EUR column is now headed by Cardmarket's own symbol, cropped from the logo files they
publish for download and used on their terms. Before that the slot held a glyph lifted
from Scryfall's page markup, which was nobody's to lift. And three of Shambleshark's deck
modules are shipped — the clean up improver, EDHREC suggestions and Scryfall search. Two were written rather than copied: the EDHREC one goes
to their published JSON instead of Shambleshark's hidden iframe, and the search goes
through this extension's queue instead of out of the page. All three need Scryfall's own
page world rather than the page markup, so the extension has a script there, an adapter
over Scryfall's internals and a bridge back to the content script. All three ship switched
off, because none has been checked against a live deck editor.

## [v0.51.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.51.0) — 2026-09-28

What an outside review found: the EDHREC rate limit was not actually enforced, its cache
and backoff did not survive a service worker restart, the language setting destroyed
itself, `package.json` claimed the wrong licence, there was no CI, and 12 MB of tag data
was parsed on every worker start. Optional features now take optional permissions.

## [v0.49.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.49.0) — 2026-09-28

New defaults, EDHREC's published data policy, and a README that answers first instead of
last. The settings language follows the browser; the Prints group moved into
Experimental rather than rewriting Scryfall's table unasked.

## [v0.48.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.48.0) — 2026-09-28

The last of the dark-theme reports from use, and a smoke test of the package: it builds
the archive, unpacks it and turns it on. Store screenshots re-shot from the current
settings page.

## [v0.47.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.47.0) — 2026-09-28

Dark theme fixes from use: white flashes while a page loaded, three black mana symbols,
a lost purple on the docs sidebar, a missing row highlight, a white block in the narrow
search controls, a grey slab by the deck button, an unreadable team page title, and black
text in a dropdown.

## v0.46.0 — not released

Toolbar popup with the five switches reached for most, and the name stops calling a
released extension a preview. Superseded by 0.47.0.

## [v0.45.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.45.0) — 2026-09-28

Fixes the settings page that 0.44.0 shipped without its stylesheet or script. The build
now reads the archive back instead of the working folder.

## [v0.44.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.44.0) — 2026-09-26

MPL-2.0 for this project's own code, a privacy policy, third-party notices, and the
Chrome Web Store submission materials. The settings page is broken in this build; use
0.45.0 or later.

## [v0.43.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.43.0) — 2026-09-25

Provenance and licensing audit: every external origin checked against the repository
rather than the old README, with per-file attribution and a packaging step that fails
when a licence or notice is missing from the archive.
