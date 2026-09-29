# Roadmap

Things that are known, agreed, and not being worked on right now. Nothing here is a
defect: each is either a deliberate deferral or work waiting on a decision.

Last updated 2026-09-29.

---

## Waiting on someone else

| | What | Where it stands |
|---|---|---|
| 1 | **Rights for the EDHREC, CardTrader and Cardmarket marks** | Requests sent, answers awaited. Until they land, `THIRD_PARTY_NOTICES.md` records the status as `Unresolved`, which is the honest state. If an answer is no, the fallback is text labels — the buttons already say "EDHREC" and "CardTrader" beside the icon, so nothing is lost. |
| 2 | **Chrome Web Store review** | 0.48.0 is in review. Later versions follow once it clears. The store is the only place users get the extension, so nothing is "released" until it is there. |
| 3 | **A real end-to-end run as an installed extension** | Waiting on a later version. So far the packaged extension has been checked by unpacking it and turning it on; a friend ran 0.48.0 in daily use and reported it working, which is useful but not systematic. |

## To do

### Check the deck editor modules in a live deck editor

All four Shambleshark deck modules are now ported. They are tested against a stand-in for
`window.Scryfall` and `window.ScryfallAPI`. What that cannot cover is whether Scryfall's
internals are still shaped the way Shambleshark found them in 2023. Until someone opens a
deck, turns a setting on and uses them, all four stay switched off.

Two of the four were written rather than copied. Shambleshark's EDHREC suggestions embed
an iframe to edhrec.com, and this project goes to EDHREC's published JSON instead, behind
a queue and their data policy. Its Scryfall search keeps saved searches and calls the API
straight from the page; this leaves saved searches out and goes through the extension's
queue.

The announced sizes were wrong more than once: `clean-up-improver` looked like 82 lines
and was about a thousand, and `edhrec-suggestions` looks like 58 but is 425 across three
files. Measure from the real files before trusting any estimate.

If they do not hold up, the answer is to say so and drop them, not to ship something that
half works.

### Store screenshot of the extension on Scryfall

The five screenshots show the settings page. Nothing shows what the extension does to
Scryfall itself — tags beside the printings, the clipboard, the extra legality rows. A
listing whose images only show a settings form does not tell a user what they are
installing. At least one shot of a card page in the dark theme, with the tag tables and
the clipboard visible.

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

## Considered and rejected

| | Idea | Why not |
|---|---|---|
| | Detect light surfaces at runtime instead of naming Scryfall's classes | Tried. It mistook wrappers for surfaces and once flattened a logo held as a background image. Colour tells you what something looks like, not what it is for. |
| | A full `CHANGELOG.md` duplicating the release notes | The notes already exist per release. A copy drifts — the README already carried a stale assertion count for exactly this reason. The changelog is an index instead. |
| | Tag panels on search results | Not wanted. Tags belong on the card that has them; a search grid would need a top-N rule and one request per card to show something most users would not look at. |
| | Rewrite in TypeScript / React / a bundler | The extension is 3000 lines of plain JS doing DOM work. The tooling cost would exceed the code it organises. |
