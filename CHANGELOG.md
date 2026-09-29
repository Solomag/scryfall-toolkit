# Changelog

An index of what each release was about. The detail lives in the release notes for that
version, and is not repeated here — a copy of them would drift, and this file's only job
is to answer "what changed and where do I read about it".

All releases: <https://github.com/Solomag/scryfall-toolkit/releases>

---

## Unreleased

Nothing yet.

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
