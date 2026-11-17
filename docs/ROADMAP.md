# Roadmap

Things that are known, agreed, and not being worked on right now. Nothing here is a
defect: each is either a deliberate deferral or work waiting on a decision.

Last updated 2026-11-17.

---

## Decided, with the reasoning

Questions this project answered for itself, kept here because the reasoning is worth more
than the answer and is the first thing a reader will otherwise re-litigate.

| | Question | Decision and why |
|---|---|---|
| 1 | **The CardTrader mark** | **Shipped, on nominative use.** CardTrader's reply was about their API, row 2, and said nothing about the mark. EDHREC's mark is not a question any more: it went with the icon-and-link control that showed it, and no EDHREC image is in the build. The CardTrader mark appears only to say whose data is on screen: never altered, never redrawn, never used as our own identity, on a control that already carries the name in words beside it. This is the basis the law offers a project in this position, and it is the *only* basis claimed — `THIRD_PARTY_NOTICES.md` says plainly that no permission was sought and none was granted, rather than writing "unresolved" next to a file we ship. If they object, the change is deleting one line of markup. |
| 2 | **The CardTrader API** | **Kept, and answered.** Asked about this use, CardTrader's support replied that their APIs are public and can also be used for commercial projects such as this one, with limits on the number of calls and a 24-hour cache on some responses (their docs: <https://www.cardtrader.com/en/docs/api>). Their reference still requires `Authorization: Bearer` with a token from a CardTrader account, and an unauthenticated call is refused with 401, so nothing is fetched without the user's own credential either — the extension is off by default and stores no token of its own. The open question — whether a third party may redistribute their prices — cannot arise under this design, because there is no path to the data that does not start with the user's own account. |
| 3 | **Aliasing Scryfall's class names in the scripts** | **No indirection layer.** CSS cannot alias a selector and JavaScript in a content script cannot import a table, so the alternative is a build step or a runtime lookup, and both were declined. A runtime lookup is worse than useless here: it turns a renamed class into a lookup that returns `undefined`, and a `null` from `querySelector` is a silent no-op — the exact failure this project has been bitten by more than once. The generated contract in `docs/scryfall-dom.md` is the layer instead: it names every name, the page it belongs to, and every file that reaches for it, and a test fails when a name is used and not written down. |
| 4 | **Photographing the panels on the real site** | **Done: the page is real and so is the code that paints it.** Stable Chrome refuses `--load-extension`, but Chrome for Testing does not (`npm run cft` installs it under `dist/cft`). `tools/make-feature-shots.cjs` loads the repository as the extension, will not start unless the extension's own service worker is among the browser's targets, writes each picture's settings through the extension's storage, and photographs the live card page on scryfall.com. The earlier attempt "succeeded" visibly while our worker was not running at all; that check is what makes this one different. |
| 5 | **Drawing the panels instead of photographing them** | **No, and the first set was the argument.** A drawing drifts from the code with nobody noticing, and a picture of a panel that no longer exists is worse than no picture: a reader cannot tell it apart from a working one. The middle ground — a photograph of real code with invented data in it — is worse than either. It had a card called "Test Card" and a commander figure of 4,823, and nothing in the picture said so. |

## Waiting on someone else

| | What | Where it stands |
|---|---|---|
| 3 | **Scryfall's acceptable-use rules** | Their Terms say "You may not scrape Scryfall" and "You may not place undue burden on Scryfall through the use of automated means". This project reads the page being viewed and calls the documented API; it does not crawl and keeps no copy of their data. Their published rate limits are per endpoint class, and the extension was **over the tightest one by about four times** — see the closed item below. That is now fixed and checked by a test. What is still not established is whether they consider this pattern acceptable at all, which is a question for them and not for the repository. |

## To do

Nothing scheduled. The candidates are under Ideas.

The deck editor needs an account, so the tools cannot reach it on their own. It can still
be checked live: sign in once in a visible Chrome for Testing window with the repository
loaded as the extension and a profile kept under `dist/` (with `--remote-debugging-port`),
then drive it over CDP. That is how it was checked on 2026-11-17 (closed row 10). After a
change to `src/deck-page/` or `edhrec.js`, do it again.

## Ideas

Collected 2026-11-17. The extension has no reviews in either store and no issues on GitHub
yet, so these come from what users of the neighbouring tools keep asking for (Archidekt and
Moxfield forums, Scryfall's own deckbuilder notes) and from data this extension already
holds. None is agreed; each is a candidate, in rough order of usefulness.

| | Idea | Where the ask comes from | Notes |
|---|---|---|---|
| 1 | **Done, unreleased.** **What the deck does, by tag** — a panel on deck pages counting the deck's cards per Tagger oracle tag (ramp, removal, card draw, board wipe…), each count opening the cards behind it | Archidekt forum: "compile a list of what tags they fall under from the Scryfall Tagger Project" | The tag index is already cached locally for the card-page panels, so this needs no new request per card: the deck's Oracle IDs come from the `/cards/collection` answer the token and legality buttons already make. A short default list of tags, editable. |
| 2 | **Done, unreleased.** **Saved searches for a deck** — the deck editor's search keeps its own list of saved queries per deck | Archidekt forum: "a list of saved scryfall searches associated with a deck" | Builds on the saved searches from 2.4.5; the key is the deck's id. Small. |
| 3 | **Done, unreleased.** **Owned copies** — import a collection export (Moxfield, Manabox, Archidekt CSV) and show "owned ×N" on card pages, search results and deck rows | Archidekt and Moxfield forums: the most repeated request found; Deckplanet shipped it as "long requested" | Local only, in browser storage, nothing uploaded. The work is the importers (three CSV shapes) and matching by set and collector number. Large; worth it only if the first two land well. |
| 4 | **Done, unreleased.** **Select a range** — shift-click a second `+` in search results to add every card between the two | Archidekt forum: multi-select cards | Small: the clipboard already knows every add button on the page and its order. |
| 5 | **Done, unreleased.** **Clipboard total** — the clipboard shows the sum of its cards' prices in the currency the reader keeps visible | — | Prices come with the `/cards/collection` answer; one call per 75 cards, through the paced queue. Respects the price-hiding settings. |
| 6 | **Done, unreleased.** **More than one clipboard** — named lists, switched from the toolbar | — | Done without changing the storage shape: `cards` stays the list in use and the others wait under `clipLists`, so nothing needed migrating. |

## Closed

| | What | Outcome |
|---|---|---|
| 1 | **Check the deck editor modules in a live deck editor** | Done, 2026-10-01. All three were used in a real commander deck and work there. This took four rounds of fixes, and every one of them was a bug the stand-in could not catch: the permission for `edhrec.com` was never granted because Chrome only answers a request that follows a click; the percentages were a hundred times too large because `score` arrives as a whole number out of 100 and the code treated it as a fraction; there was no art at all, because the endpoint sends no image and no printing; and the art request was refused because a list of suggestions is a hundred cards and Scryfall takes seventy-five identifiers at a time. A stand-in for `window.Scryfall` proves the code runs. It does not prove the response is what you assumed, and here it was not. |
| 2 | **A fourth Shambleshark module** | Ported and removed. `card-input-modifier` showed a card image on hovering a deck row; Scryfall's own tooltip covered the deck and the site already previews cards on hover, so it made the editor worse and duplicated the site. No code from it is in the package. |
| 3 | **Rate limits, checked against the page that states them** | Done, 2026-10-01. Reading <https://scryfall.com/docs/api/rate-limits> rather than trusting the number already in the code found that one 130 ms slot for everything was about four times their limit for `/cards/search`, `/cards/named` and `/cards/collection` — the endpoints the finish column, the EDHREC artwork, the deck search and the hover preview all use. There was also no hold-back on a 429, and their page says a 429 means thirty seconds of limitation and then a possible ban. Each class now has its own queue at their published ceiling plus a margin, every call to the host goes through one of them, and a 429 holds all of them. The test that checks this reads the ceilings out of the source, because a `const` in a `vm` script is not reachable from the test context and because the numbers are the thing being asserted. |
| 4 | **Split `content.js`** | Done, 2026-10-01. `content.js` was 1901 lines in one closure holding the clipboard, tags, print manipulation, CardTrader, EDHREC, formats, the deck page and the set filters. It is now `src/card-page/core.js` (the settings, what page this is, the request wrapper, the shared clipboard, the hover preview, and the boot) and nine feature files. Every line of logic was moved as it stands rather than retyped, and a check confirmed it: of 1692 code lines, the only ones absent afterwards are the four `let` declarations that became one `shared` object and the eighteen `if (settings.x) initY();` lines that became the boot list. Nothing else moved. The CSS half and the contract layer it was really about followed: the theme is seven files under `src/styles/theme/`, and `docs/scryfall-dom.md` names every Scryfall class and the file that uses it (below). |
| 5 | **Store review** | 2.4.4 (2026-11-13) and 2.4.5 (2026-11-14) were both submitted by the release workflow itself (`.github/workflows/release.yml`) and both passed review. 2.4.6 (2026-11-17) went to AMO the same way; the Chrome Web Store refused the automatic submit until the new `contextMenus` permission had a justification and the privacy-policy URL was filled in on the Privacy practices tab, which was done by hand in the console the same day. It is in review in both stores. |
| 6 | **Illustrations of the panels, on real data** | Done, 2026-11-13. The five pictures in `assets/shots/` are photographs of scryfall.com with the extension loaded in Chrome for Testing and drawing its own panels (`npm run shots`); see decided row 4. EDHREC is still not pictured: its permission is optional and Chrome grants it only after a click. |
| 7 | **Store screenshots of Scryfall itself** | Done, 2026-11-13. Store slots 1 and 2 are live captures — a card page, and a search page with the clipboard open beside one row of cards — at the store's 1280×800, uncropped and with nothing drawn over a card. Slots 3–5 are the settings page in three tiles instead of five. See section 7 of the store listing. |
| 8 | **Review fixes checked on the live site** | Done, 2026-11-13, for 2.4.4. With the extension loaded in Chrome for Testing: a card page, a double-faced card, search results, a set page, a Tagger card page and the home page all drew their panels, and none logged an error. |
| 9 | **Search suggestions and saved searches** | Shipped in 2.4.5 (2026-11-14), with the add button in the text, checklist and full search views. The first two items of the extension survey (Ideas, above). |
| 10 | **2.4.5 checked live in Chrome and Firefox** | Done, 2026-11-17. Chrome for Testing: search in all four views, suggestions, the save star, a card page; signed in, the deck editor and EDHREC suggestions, where Add and Remove changed the deck on the server. Firefox 159, with the AMO package installed over WebDriver BiDi: the same search and card-page checks, and no console errors. The deck editor was not repeated in Firefox (no signed-in profile there). |
| 11 | **The 2026-11-13 extension survey** | Shipped in 2.4.6 (2026-11-17), all six: a default filter added to every search, `+ All` for the clipboard, deck legality in any format, search links to Card Kingdom, Mana Pool and Cardsphere, search from the right-click menu and the `sf` address-bar keyword, and a small query builder. Checked live in Chrome for Testing before release; the deck-format check on a signed-in deck. |

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
