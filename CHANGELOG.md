# Changelog

An index of what each release was about. The detail lives in the release notes for that
version, and is not repeated here — a copy of them would drift, and this file's only job
is to answer "what changed and where do I read about it".

All releases: <https://github.com/Solomag/scryfall-toolkit/releases>

---

## Unreleased

The illustrations in the settings are photographs of the real thing, and they sit behind
a "?" instead of inside the page.

**Nothing in a picture is written by hand.** The previous set was full of invented text:
a card called "Test Card", a set whose printing #6 did not exist, a commander figure of
4,823. A reader cannot tell any of that from a picture of a working feature, which is
exactly why it is wrong. Every card name, set name, collector number, price, finish and
legality in a picture now comes from Scryfall's public API, and every tag name comes from
Tagger's registry — the two sources the extension itself asks. The card is not chosen by
hand either: the tool takes the first real card that satisfies what each panel needs, a
card with tags to show, printings across several sets, and legality somewhere in the four
formats the extension adds. If none of them qualifies, the tool stops.

**What is still not real, and is written down in the tool that makes the pictures:**

- *The page.* A true screenshot needs this extension loaded into a browser, and stable
  Chrome 154 refuses `--load-extension` outright — tried headless, tried with an offscreen
  window, tried with `--enable-unsafe-extension-debugging` and with the removal flag
  turned off. The extension never appears among the targets. So the panels hang off a
  reduced card-page container of our own, and everything inside a panel is real.
- *EDHREC's deck counts.* `json.edhrec.com` answers 403 to anything outside their own
  site, so a real number cannot be fetched here. Rather than print a plausible four
  thousand decks, the section that would have shown it now illustrates the column of
  finish badges — the other thing that section promises, computed from what Scryfall
  returned.

**Three silent failures, found by looking at the pictures rather than at the code:**

- The finish column had one badge where there should be several. Not a race: a printing
  with two finishes gets an empty cell on purpose, so the tool now waits for a *number*
  of badges rather than for one.
- The legality picture showed Scryfall's own Standard and Modern and none of our work.
  The block's id lands on whichever row sorts first, and an added format goes into
  whichever row still has room — so the crop was of the wrong element, and it had been
  for as long as the picture existed.
- Two pictures came out identical, showing the same three rows, because the rows on the
  page are picked by Scryfall and happened to be ones the settings change nothing about.
  The rows now include a digital set and a non-English printing, so the picture of
  hiding shows something actually hidden.

**The "?" instead of pictures in the page.** Six large images in the body pushed the
settings they explain off the bottom of the page; the point of the settings page is the
settings. Each section heading now carries a "?" that opens the picture over the page, in
a dialog: Escape closes it, so does a click on the dimmed page behind it, and a name the
dialog does not know disables the button rather than opening an empty frame.

**And the archive was missing all six pictures.** The build walks the files to find what
they reference, and it read `<img src>` in the page — which is how the pictures travelled
before they moved into a dialog. Afterwards the only place a name appeared was a string
in `options.js`, written `../../assets/shots/x.png`, and the walker resolved strings from
the root of the extension, so a path that climbs out of its own folder became one starting
with `..` and was thrown away by the guard that stops a reference escaping the archive.
The build reported itself complete, at 4.35 MB instead of 4.73 MB. It now resolves a
climbing path against the file it is written in, and the packaged test resolves the same
names the same way and asks the archive — the check that the old one was missing.

Also in this release: the brand marks ship with the basis for using them written down
rather than a status nobody had resolved.

The illustrations are photographs of the real panels, not drawings of them. Each one
is a crop of markup the actual feature files produced, on the project's own
stylesheets, rendered by the browser already installed on the machine — the debugging
protocol, over Node's own WebSocket, because Chrome's `--screenshot` captures a window
rather than a page and `--dump-dom`, which would have let a page report its height,
prints nothing at all in Chrome 154.

That is the only version of this that can be trusted twice. A drawing drifts from the
code without anybody noticing; a picture of a panel that no longer exists is worse
than no picture, because a reader cannot tell it apart from a working one. So each
shot names the element it is about and the tool waits for it: a feature that stops
rendering is an error, not a small empty rectangle. Waiting for one thing turned out to
be not enough, though, which is the first bullet above: two of the three failures were a
picture that was not empty and not wrong in any way a check could see. There is a test
that the page, the folder and the tool never disagree about which illustrations exist,
and it now also refuses a fixture that has invented text left in it — and it earns its
keep, because a `git checkout` during a mutation test took the six figures out of the
page and it said so.

No card art is in any of them, and the extension does not ship card imagery: the panels
that matter are tables, badges and lists. What the pictures do carry is Scryfall's data —
its set names, its prices, its legalities — and Tagger's tag names, because those are the
data the features put on screen, and anything else in a picture would be a fiction. The
surface a panel sits on is a plain card-page-shaped container of our own, which is also
why the store listing's question — may a card appear in a screenshot — does not arise for
the illustrations at all.

The store screenshots were stale the moment the page changed, and there was no way to
refresh them: the listing told a reader to rebuild the tiles from a capture, and the
capture could only be taken by hand. Both halves are reproducible now.

The EDHREC and CardTrader marks stay in the release. That decision made the notices
wrong as they stood — "Unresolved" beside a file we ship is a document telling a
reader we use something we have no right to use — so what replaced it is the basis we
actually rely on: the mark names whose data is on screen, is never altered, and sits
on a control that already carries the name in words. What the notices must not say is
now checked, and so is what they must.

Three questions moved out of "waiting on someone else" into a decided section with
their reasoning kept, because the reasoning is worth more than the answer: the two
marks, the CardTrader API — narrower than it looked, since nothing is fetched without
the user's own token — and whether to alias Scryfall's class names in the scripts. That
last one is no, and the reason is the shape of the failure: an indirection layer turns a
renamed class into a lookup returning undefined, and a null from querySelector is a
silent no-op.

Tests: 1633 assertions pass across eight suites.
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
