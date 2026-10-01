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

### Split `content.js` and `theme.css`

From an outside review, and the right call: `content.js` is 1814 lines holding clipboard,
tags, print manipulation, CardTrader, EDHREC, formats, deckbuilder and set filtering;
`theme.css` is 648 rules with 949 references to Scryfall's own class names.

Suggested shape when the next feature needs it:

```
features/
  prints
  tags
  edhrec
  cardtrader
  deckbuilder
  sets

scryfall-dom/
  selectors
  card-page
  prints-table
  deck-page
```

The second layer matters more than the first: one changed class name in Scryfall's markup
now breaks whatever rule happened to reach it. If the DOM contract sits in one place, a
Scryfall change is one file to look at instead of thirty.

Do this before the next feature, not before a release — it is a refactor with no
user-visible benefit.

## Closed

| | What | Outcome |
|---|---|---|
| 1 | **Check the deck editor modules in a live deck editor** | Done, 2026-10-01. All three were used in a real commander deck and work there. This took four rounds of fixes, and every one of them was a bug the stand-in could not catch: the permission for `edhrec.com` was never granted because Chrome only answers a request that follows a click; the percentages were a hundred times too large because `score` arrives as a whole number out of 100 and the code treated it as a fraction; there was no art at all, because the endpoint sends no image and no printing; and the art request was refused because a list of suggestions is a hundred cards and Scryfall takes seventy-five identifiers at a time. A stand-in for `window.Scryfall` proves the code runs. It does not prove the response is what you assumed, and here it was not. |
| 2 | **A fourth Shambleshark module** | Ported and removed. `card-input-modifier` showed a card image on hovering a deck row; Scryfall's own tooltip covered the deck and the site already previews cards on hover, so it made the editor worse and duplicated the site. No code from it is in the package. |
| 3 | **Rate limits, checked against the page that states them** | Done, 2026-10-01. Reading <https://scryfall.com/docs/api/rate-limits> rather than trusting the number already in the code found that one 130 ms slot for everything was about four times their limit for `/cards/search`, `/cards/named` and `/cards/collection` — the endpoints the finish column, the EDHREC artwork, the deck search and the hover preview all use. There was also no hold-back on a 429, and their page says a 429 means thirty seconds of limitation and then a possible ban. Each class now has its own queue at their published ceiling plus a margin, every call to the host goes through one of them, and a 429 holds all of them. The test that checks this reads the ceilings out of the source, because a `const` in a `vm` script is not reachable from the test context and because the numbers are the thing being asserted. |

## Considered and rejected

| | Idea | Why not |
|---|---|---|
| | Detect light surfaces at runtime instead of naming Scryfall's classes | Tried. It mistook wrappers for surfaces and once flattened a logo held as a background image. Colour tells you what something looks like, not what it is for. |
| | A full `CHANGELOG.md` duplicating the release notes | The notes already exist per release. A copy drifts — the README already carried a stale assertion count for exactly this reason. The changelog is an index instead. |
| | Tag panels on search results | Not wanted. Tags belong on the card that has them; a search grid would need a top-N rule and one request per card to show something most users would not look at. |
| | Rewrite in TypeScript / React / a bundler | The extension is 3000 lines of plain JS doing DOM work. The tooling cost would exceed the code it organises. |
