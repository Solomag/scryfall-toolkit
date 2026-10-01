# Roadmap

Things that are known, agreed, and not being worked on right now. Nothing here is a
defect: each is either a deliberate deferral or work waiting on a decision.

Last updated 2026-10-01.

---

## Waiting on someone else

| | What | Where it stands |
|---|---|---|
| 1 | **Rights for the EDHREC, CardTrader and Cardmarket marks** | Cardmarket answered: they publish their assets for download on terms this project meets, and that item is closed. EDHREC's and CardTrader's marks are still `Unresolved` in `THIRD_PARTY_NOTICES.md`, which is the honest state. If an answer is no, the fallback is text labels — the buttons already say "EDHREC" and "CardTrader" beside the icon, so nothing is lost. |
| 2 | **CardTrader API terms** | Their reference states every call needs `Authorization: Bearer` with a token from a CardTrader account, and an unauthenticated call is refused with 401. So this is an account-bound API, not a public one. The extension asks for no token and stores none; the price source stays off until the user supplies their own. Whether a third-party extension may show those prices at all is still not established. |
| 3 | **Scryfall's acceptable-use rules** | Their Terms say "You may not scrape Scryfall" and "You may not place undue burden on Scryfall through the use of automated means". This project reads the page being viewed and calls the documented API; it does not crawl and keeps no copy of their data. Their published rate limits are per endpoint class, and the extension was **over the tightest one by about four times** — see the closed item below. That is now fixed and checked by a test. What is still not established is whether they consider this pattern acceptable at all, which is a question for them and not for the repository. |
| 4 | **Chrome Web Store review** | 0.48.0 went in. Later versions follow once it clears. The store is the only place users get the extension, so nothing is "released" until it is there. |

## To do

### Store screenshots of Scryfall itself

The five screenshots show the settings page. Nothing shows what the extension does to
Scryfall — tags beside the printings, the clipboard, the extra legality rows, the deck
editor tools. A listing whose images only show a settings form does not tell a user what
they are installing. At least one shot of a card page in the dark theme with the tag tables
and the clipboard visible, and one of the deck editor with the three tools in use.

A card may appear in one. What may not: cropping the card so the copyright and artist line
goes with it, recolouring or rescaling it, or putting anything on top of it. A screenshot
of the page as the browser drew it complies by construction. The rules are written out in
section 7 of the store listing.

## Closed

| | What | Outcome |
|---|---|---|
| 1 | **Check the deck editor modules in a live deck editor** | Done, 2026-10-01. All three were used in a real commander deck and work there. This took four rounds of fixes, and every one of them was a bug the stand-in could not catch: the permission for `edhrec.com` was never granted because Chrome only answers a request that follows a click; the percentages were a hundred times too large because `score` arrives as a whole number out of 100 and the code treated it as a fraction; there was no art at all, because the endpoint sends no image and no printing; and the art request was refused because a list of suggestions is a hundred cards and Scryfall takes seventy-five identifiers at a time. A stand-in for `window.Scryfall` proves the code runs. It does not prove the response is what you assumed, and here it was not. |
| 2 | **A fourth Shambleshark module** | Ported and removed. `card-input-modifier` showed a card image on hovering a deck row; Scryfall's own tooltip covered the deck and the site already previews cards on hover, so it made the editor worse and duplicated the site. No code from it is in the package. |
| 3 | **Rate limits, checked against the page that states them** | Done, 2026-10-01. Reading <https://scryfall.com/docs/api/rate-limits> rather than trusting the number already in the code found that one 130 ms slot for everything was about four times their limit for `/cards/search`, `/cards/named` and `/cards/collection` — the endpoints the finish column, the EDHREC artwork, the deck search and the hover preview all use. There was also no hold-back on a 429, and their page says a 429 means thirty seconds of limitation and then a possible ban. Each class now has its own queue at their published ceiling plus a margin, every call to the host goes through one of them, and a 429 holds all of them. The test that checks this reads the ceilings out of the source, because a `const` in a `vm` script is not reachable from the test context and because the numbers are the thing being asserted. |
| 4 | **Split `content.js`** | Done, 2026-10-01. `content.js` was 1901 lines in one closure holding the clipboard, tags, print manipulation, CardTrader, EDHREC, formats, the deck page and the set filters. It is now `src/card-page/core.js` (the settings, what page this is, the request wrapper, the shared clipboard, the hover preview, and the boot) and nine feature files. Every line of logic was moved as it stands rather than retyped, and a check confirmed it: of 1692 code lines, the only ones absent afterwards are the four `let` declarations that became one `shared` object and the eighteen `if (settings.x) initY();` lines that became the boot list. Nothing else moved. The CSS half of this item is still open, and so is the contract layer it was really about. |

**The second layer, done.** 270 names of Scryfall's own markup are no longer reached for from
wherever they are needed. `docs/scryfall-dom.md` lists every one of them, the page family it
belongs to, and **the part of the theme that reaches for it** — so a class Scryfall renames
names the one file to open, rather than leaving a reader to search 404 rules. The document is
generated and a test fails if it is not what the generator produces, so a rule that gains a
dependency without the document gaining a line stops the build.

On the stylesheet side that meant splitting it: `src/styles/theme.css` was 753 lines and is
seven files under `src/styles/theme/`. The cut is contiguous rather than grouped by page —
a stylesheet cannot be reorganised by what a rule is about without changing what it does,
because two rules of equal specificity are decided by which came last. `tools/css-write-parts.cjs`
puts the parts back together and compares against the file they came from, character for
character; the contract came out with the same 361 class names and the same 404 rules.

**What is still open.** Selectors spelled out in the JavaScript are recorded in the same
document, but they are still spelled in the code: `querySelector('.card-legality')` in four
feature files names the same class four times, and renaming it means four edits. CSS cannot
alias a selector, so closing this properly means either a build step that expands names from
one table, or a runtime lookup. Both are a real cost against a project that has otherwise
chosen plain files and no bundler, and the honest position is that it is not decided.

The tool meant to support it, `tools/dom-contract.cjs`, was itself an example of the
problem. It had its own list of scripts to scan, that list named `content.js`, and when
`content.js` was split it did not fail: a file that is not there is skipped. So it went on
writing a document describing a card page that no longer existed, with none of the nine
files that draw it in it, and nothing noticed because nothing ran it. It reads the manifest
now, and a test runs it and fails if `docs/scryfall-dom.md` is not what it produces.

## Considered and rejected

| | Idea | Why not |
|---|---|---|
| | Detect light surfaces at runtime instead of naming Scryfall's classes | Tried. It mistook wrappers for surfaces and once flattened a logo held as a background image. Colour tells you what something looks like, not what it is for. |
| | A full `CHANGELOG.md` duplicating the release notes | The notes already exist per release. A copy drifts — the README already carried a stale assertion count for exactly this reason. The changelog is an index instead. |
| | Tag panels on search results | Not wanted. Tags belong on the card that has them; a search grid would need a top-N rule and one request per card to show something most users would not look at. |
| | Rewrite in TypeScript / React / a bundler | The extension is 3000 lines of plain JS doing DOM work. The tooling cost would exceed the code it organises. |
