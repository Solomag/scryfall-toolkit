# Third-party notices

Scryfall Toolkit is an independent project. It is not produced, endorsed, sponsored or
approved by Scryfall, Scryfall LLC, Wizards of the Coast, EDHREC, CardTrader, Cardmarket,
Moxfield, or the authors of the projects listed below. Product names and logos are the
property of their respective owners and are used only to identify the service a feature
talks to.

This file records, for every external project, exactly what was taken and under which
terms. "Used" is meant literally:

- **code copied** — the file, or a recognisable part of it, is in this repository;
- **data copied** — the file's content is in this repository, possibly re-serialised;
- **visual asset** — an image, icon or logo file is in this repository;
- **behaviour/idea only** — no file was taken; a feature or an approach was followed.

No external project contributed code to this repository. What exists here is either data,
an image, or a behaviour that was followed.

Every licence text quoted below is also stored verbatim as a file in `assets/licences/`, and
all of those files are shipped inside the distributed extension archive.

## The scope of this project's own licence

This project's own code is licensed **MPL-2.0** (see [`LICENSE`](LICENSE)). That licence
covers only the files this project wrote. It is not applied to anything listed in this
document, and it grants no rights in anyone's trademarks, logos, card data or service.

In particular, and stated plainly because it is easy to get wrong:

- The MPL-2.0 notice does **not** cover `assets/icons/edhrec.png`, `assets/icons/cardtrader.svg` or
  `assets/icons/cardtrader.png`. Those are third-party brand marks, and their rights stay with
  their owners.
- **Data access and logos are two different questions, and both are answered.** EDHREC
  answered with their published data policy, which permits this use, so the data side is
  covered and recorded in section 7. Nothing was said about their logo. CardTrader's mark
  was taken from their own site and no permission for it has been given. Both marks ship
  on the basis set out in sections 7 and 8 — nominative use: the mark says whose data is
  on screen, is never altered, and sits on a control that already carries the name in
  words. No permission was sought and none was granted, and nothing here claims one was.
- **Cardmarket's logo is theirs and is used on their terms.** Two of their published
  files head the EUR price column. Their rights stay theirs, the goodwill from use is
  theirs, and nothing here implies they endorse this project. Section 9 has the terms
  and what is done to stay inside them.
- The bundled MoxTags and Shambleshark data and the CardClip icons stay under their own
  MIT terms with their own copyright notices; re-licensing them as MPL-2.0 would be
  wrong and has not been done.

This extension is independent of Scryfall, EDHREC and CardTrader. It is not produced,
endorsed, sponsored or approved by any of them.

---

## 1. CardClip — icons copied

- Upstream: <https://github.com/JacobHearst/CardClip> ("A browser extension that adds
  clipboard functionality for Scryfall", last pushed 2023-08-20)
- Author: Jacob Hearst
- Licence: MIT, `Copyright (c) 2022 Jacob Hearst` — full text in
  [`assets/licences/CardClip-LICENSE`](assets/licences/CardClip-LICENSE)
- Used: **visual asset** (3 files) and one data key name.

| File in this repo | What it is |
| --- | --- |
| `assets/icons/clip.svg` | Copied verbatim from CardClip `img/clip.svg` |
| `assets/icons/duplicate.svg` | Copied verbatim from CardClip `img/duplicate.svg` |
| `assets/icons/trash.svg` | Copied verbatim from CardClip `img/trash.svg` |

All three were verified byte-identical to the files in the upstream repository by SHA-256
on 2026-09-25. Because they are copies, CardClip's MIT notice is retained in
`assets/licences/CardClip-LICENSE`.

The clipboard feature itself is **not** a copy: `src/card-page/clipboard.js` and
`src/card-page/tagger-clipboard.js` are original implementations, and none of CardClip's
function names (`showClipboardList`, `loadClipboardFromStorage`, `transformButton`,
`findExistingButtons`, …) appear in this repository. The one place CardClip's data is
read is `src/card-page/clipboard.js`, which reads the legacy Scryfall-page key
`localStorage.cardClipboard` and its `cardName` / `cardLink` fields to import a user's old
clipboard once. That is an interface with an existing installation, not copied code.

## 2. Paruhas/CardClip — behaviour only

- Upstream: <https://github.com/Paruhas/CardClip> (GitHub reports it as a fork of
  JacobHearst/CardClip, created 2025-09-05)
- Author: the fork's owner; the underlying copyright remains Jacob Hearst, MIT. The fork
  carries the same licence text as its parent, kept here in
  [`assets/licences/Paruhas-CardClip-LICENSE`](assets/licences/Paruhas-CardClip-LICENSE)
- Used: **behaviour/idea only** — the export format that appends the printing's set code
  and collector number (`1 Card Name (SET) 123`), exposed as the `moxfield` export option.
- No file from this repository was copied into this project.

## 3. Shambleshark — data copied

- Upstream: <https://github.com/crookedneighbor/shambleshark> ("An Unofficial browser
  extension to add functionality to the Scryfall site. Not affiliated with Scryfall.",
  last pushed 2023-10-07)
- Authors: Samuel Simões (2016), Blade Barringer (2019)
- Licence: MIT — full text in [`assets/licences/Shambleshark-LICENSE`](assets/licences/Shambleshark-LICENSE)
- Used: **data copied** (1 file) and **behaviour ported** (the clean up improver).

| File in this repo | What it is |
| --- | --- |
| `assets/data/shambleshark-nicknames.js` | The 396 card-nickname records from upstream's per-set TypeScript modules under `src/js/lib/card-nicknames/`, re-serialised into a single JSON array |

Upstream's record shape (`realName`, `setCode`, `collectorNumber`, `nickname`, `source`)
and every nickname string are upstream's. Two differences from upstream's `main` branch
were introduced here: the records were flattened into one array instead of 22 modules, and
Streets of New Capenna is keyed `snc` (Scryfall's current set code) where upstream still
writes `stc`. Both are recorded in the file's own header comment. Shambleshark's MIT
notice is retained in `assets/licences/Shambleshark-LICENSE`.

The inline card/art tag presentation was **not** copied: none of Shambleshark's
identifiers (`CardNicknameDisplay`, `createViewMoreTagsRow`, `TaggerIcon`,
`TaggerLookupData`, `elementReady`, …) appear in this repository, and the tag panels are
original code.

**Behaviour ported — the deck editor modules.** Three of upstream's deck-builder features
are here: the clean up improver (`scryfall-embed/modify-clean-up`, `lib/card-parser`,
`lib/deck-parser`), the EDHREC suggestions and the Scryfall search. A fourth,
`card-input-modifier` with `lib/ui-elements/card-tooltip`, was ported and then removed
before release — see the note below.
`src/deck-page/scryfall.js` stands in for upstream's `scryfall-globals.ts`, and `src/deck-page/bridge.js` for its
`scryfall-embed` entry point and framebus wiring.

Two of the three were written rather than copied, because what upstream does is not
something this project will do. Its EDHREC suggestions reach EDHREC by parking a hidden
iframe on their domain and asking it for recommendations; this reads EDHREC's published
JSON instead, through the queue and the rate in section 7. Its Scryfall search calls the
API straight from the page; this goes through the extension's own worker. Its saved
searches are left out — upstream describes them as unfinished.

The logic is upstream's; the code is rewritten in plain JavaScript, with a local emitter
in place of the message bus and a Scryfall adapter that fails soft where upstream assumes
the shape of `window.Scryfall` and `window.ScryfallAPI` is fixed. Those two globals are
Scryfall's application internals and are not covered by anyone's licence — see section 6.
The preview reuses Scryfall's own `#card-tooltip` element rather than upstream's separate
tooltip markup. Both features are **off by default**, and that is a statement about the
dependency rather than about the port: they run through `window.Scryfall` and
`window.ScryfallAPI`, Scryfall's own application internals, which are covered by no licence
and carry no deprecation cycle (section 6). They were used in a real commander deck on
2026-10-01 and work there — that live pass is what found the four wrong assumptions the
port started with. They stay opt-in because a module that depends on an interface the site
can change without notice should be something a reader turns on deliberately.

Upstream's TypeScript types, webpack aliases and `framebus` dependency are not used, and
no upstream file is present verbatim.

**A fourth module was ported and then removed.** `card-input-modifier`, with
`lib/ui-elements/card-tooltip`, showed the card's image when hovering a row of the deck
editor. It was written, tested and turned on, and it did not survive that: Scryfall's own
tooltip came up over the deck and hid it, and the site already shows a card on hover
elsewhere, so the feature made the editor worse and added nothing the page did not do. It
was removed before release rather than shipped switched off. No code from it is in the
package.

## 4. MoxTags — data copied verbatim

- Upstream: <https://github.com/natefinch/moxtags> ("A chrome extension to add scryfall
  tags to moxfield's card menu", created 2026-03-04, last pushed 2026-06-10)
- Author: Nate Finch
- Version used: **v1.8.3** (git tag `v1.8.3`, released 2026-06-08)
- Licence: MIT, `Copyright (c) 2026 Nate Finch` — full text in
  [`assets/licences/MoxTags-LICENSE`](assets/licences/MoxTags-LICENSE)
- Used: **data copied** (3 files, byte-identical copies).

| File in this repo | Upstream file (`src/data/`) |
| --- | --- |
| `assets/data/oracle-tags.js` | `oracle-tags.js` |
| `assets/data/illustration-tags-1.js` | `illustration-tags-1.js` |
| `assets/data/illustration-tags-2.js` | `illustration-tags-2.js` |

All three were verified byte-identical to MoxTags v1.8.3 by SHA-256 on 2026-09-25; each
file now carries a header naming the source, version, author and licence, and MoxTags'
MIT notice is retained in `assets/licences/MoxTags-LICENSE`.

No Moxfield functionality is included. MoxTags continues to work on its own on Moxfield;
Scryfall Toolkit deliberately never runs there.

## 5. MTG Enhancements — behaviour and format names only

- Upstream: <https://github.com/notsonic/scryfall-enhancements> ("A browser extension to
  add more stuff to scryfall.com", created 2026-07-16, last pushed 2026-08-13)
- Author: notsonic
- Licence: MIT, `Copyright (c) 2026 notsonic` — full text in
  [`assets/licences/MTG-Enhancements-LICENSE`](assets/licences/MTG-Enhancements-LICENSE)
- Used: **behaviour/idea only**, plus the names of three extra formats.

`src/core/format-catalog.js` offers `Heritage`, `Classic Legacy` and `Peak Legacy` under exactly
the display names upstream uses for its `heritage`, `classic` and `peak` formats. Nothing
else was taken: upstream derives those formats with Scryfall search queries, while
`src/core/format-overrides.js` in this project is an original per-card legality map (17 card UUIDs
with their verdicts) written for this project.

## 6. Scryfall and Scryfall Tagger — service, not source

- <https://scryfall.com/> and <https://tagger.scryfall.com/> (Scryfall, LLC)
- Used: **no code and no artwork is copied.** The extension reads the pages a user is
  already looking at, and calls Scryfall's documented public API
  (`api.scryfall.com`, `data.scryfall.io`) and Tagger's own endpoints.

One derived data file is bundled:

| File in this repo | What it is |
| --- | --- |
| `assets/data/set-platforms.js` | A snapshot, taken 2026-09-25, mapping 61 digital set codes to the client each was released for |

It was produced by reading Scryfall's `/sets` list and the `games` field of one card per
set. It contains set codes and platform names only — no card names, no card text, no
artwork, and nothing from Wizards of the Coast beyond factual set identifiers. Sets missing
from the snapshot are looked up at runtime and cached.

One Scryfall asset was copied and then removed. The icon beside the EUR price column
began as the inline SVG from Scryfall's own "Buy at Cardmarket" link, recoloured to
`currentColor`. It was never established that Scryfall's interface assets may be
redistributed, so it has been replaced with an original glyph and is no longer in the
project. Nothing else from Scryfall's markup or artwork is bundled.

Scryfall's Terms of Service state that "portions of Scryfall are unofficial Fan Content
permitted under the Wizards of the Coast Fan Content Policy", that "the literal and
graphical information presented on this site about Magic: The Gathering, including card
images and mana symbols, is copyright Wizards of the Coast, LLC", and that "Scryfall is
not produced by or endorsed by Wizards of the Coast". Scryfall Toolkit is likewise
unofficial, is not endorsed by Scryfall, and bundles none of that material. See
[the terms](https://scryfall.com/terms) for the full text, including the acceptable-use
rules this project's request pattern has to respect.

## 7. EDHREC — service used under their published data policy

- <https://www.edhrec.com/> and the public card JSON at `json.edhrec.com`
- Used: **service data fetched at run time only.** Nothing from EDHREC is bundled except
  the logo file listed below. The card name is sent to EDHREC only when the user has
  enabled the EDHREC feature.

Two parts of that public JSON are read. `pages/cards/<slug>.json` for one card's usage and
salt, and `pages/commanders/<slug>.json` for a commander's page, whose `cardlists` already
hold the cards EDHREC groups and ranks for that commander. Both go through one queue, so a
card lookup and a commander lookup can never between them outrun the rate above.

**One request is not to that public JSON.** `POST https://edhrec.com/api/recs/` is the
endpoint EDHREC's own site posts to when it suggests cards for a deck, and it carries the
deck list. It is not an interface they publish: there is no documentation and no
contract, and it may change or break without notice. It is called from this extension's
own worker with the host permission the user grants when they turn the feature on — not
through a hidden frame on their domain, which is how Shambleshark reaches it and which
this project does not do. Because it may stop working at any time, the suggestions panel
falls back to their published commander page when it does.

Nothing of EDHREC's page markup is used.

**Their data policy.** EDHREC and Space Cow Media encourage community developers to use
EDHREC data, and allow HTTP requests like those a browser makes, subject to a rate limit.
The terms they set out, in their words:

- limit requests to **1 per second**, "especially in the face of errors";
- on a **429 Too Many Requests**, wait **at least 2 seconds** before retrying;
- identify requests with a **User-Agent carrying the project name and a contact email** —
  though "direct requests from user browsers do not need this";
- they provide **no documentation** and may change or remove data, fields or API
  behaviour **at any time and without notice**;
- the policy **is subject to change** while they re-evaluate it.

**How this project complies.** `src/background/worker.js` enforces the rate limit rather than
leaving it to how fast someone clicks through cards: `edhrecRequest()` spaces requests at
least one second apart, and a failure holds the next attempt back by at least the two
seconds they ask for, doubling to a minute so a broken endpoint is not hammered. Responses
are cached for six hours, so a card is looked up at most once. Requests are made by the
user's own browser, which is the case their policy exempts from the User-Agent
requirement; if they ask for identification regardless, it would need
`declarativeNetRequest` to set the header and that is a decision to take then.

The throttle, the hold-back and the EDHREC cache all live in `chrome.storage.local`,
because a Manifest V3 service worker is unloaded when idle and its globals go with it.
The two caches this extension keeps for its own convenience — the previews and print
lists in `cache`, and the CardTrader responses in `traderCache` — are in memory and
last only as long as a worker does; losing them costs a repeat request, nothing more.

Their warning that they may change the data without notice is why the feature shows
nothing at all when a field is missing, rather than an error or a wrong number.

### The mark

`assets/icons/edhrec.png` is EDHREC's own logo, taken from their site and shipped
unmodified. **We have not asked for permission and have been given none.** Their data
policy covers the use of their data and says nothing about their logo, so it is not a
licence for it.

It is shipped on one basis, which is the one the law actually offers a project in this
position: **using a mark to say whose data is on screen.** The mark appears only on
the EDHREC controls and beside EDHREC numbers, it is never altered, never redrawn, and
never used as decoration or as our own identity. This extension is independent, says so
in five places including its own settings page, and makes no claim of any relationship
to EDHREC or Space Cow Media.

**If they object, nothing has to be rebuilt.** The control already reads "EDHREC" in
words next to the icon; removing the image is deleting one line of markup. That is why
the fallback exists, and it is why no part of the feature depends on the mark.

## 8. CardTrader — service reached with the user's own token, mark used to name it

- <https://www.cardtrader.com/> and its documented API v2 (`api.cardtrader.com`)
- Used: **service data fetched at run time only**, using a personal access token the user
  supplies. No CardTrader code is copied.

**What their own documentation says, checked against the live service.** The reference at
<https://www.cardtrader.com/en-US/docs/api/full/reference> states that every call must carry
`Authorization: Bearer [YOUR_AUTH_TOKEN]`, and that the token is obtained from the settings
page of a CardTrader account. A request without one is refused:

```
GET https://api.cardtrader.com/api/v2/products     → 401
{"error_code":"unauthorized","extra":{"message":"You are not authorized to access this page"}}
```

So this is not a matter of reading a public endpoint. It is an account-bound API, and the
account is the user's own. The extension asks for no token, stores none, and sends none; the
CardTrader price source stays off until the user supplies a token they got themselves, and
without one the background refuses the request rather than calling out and being turned
away. Nothing here is a claim that this use is permitted. It has not been established, and
the token in the user's hand is not the same as permission to redistribute a third party's
marks or to publish their data.

### The mark

`assets/icons/cardtrader.svg` is CardTrader's brand mark and `assets/icons/cardtrader.png`
is a monochrome version of it. **We have not asked for permission and have been granted
none.** A trademark is not licensed as MIT and nothing here should be read as a licence.

They are used on the same basis as EDHREC's: **to name the source of the numbers on the
screen.** They appear only on the CardTrader price controls and beside CardTrader prices,
unmodified and undistorted, and never as our own identity. The settings page states in its
own words that this extension is not created, endorsed or sponsored by CardTrader.

Note that the mark here is not load-bearing in any way the data is not: the price source
is off unless the user pastes a token from their own CardTrader account, so the one thing
that would be wrong to distribute — their prices obtained without their say — cannot
happen unless the user supplies their own credential to fetch it.

**If they object**, the same single line goes as EDHREC's: the label already reads
"CardTrader" beside the icon.

## 9. Cardmarket — their published logo, used as they distribute it

- <https://www.cardmarket.com/> (Sammelkartenmarkt GmbH & Co. KG)
- Used: **service, plus two of their published logo files.** The EUR price column is
  headed with their logo, and the values in it link to the card's Cardmarket listing. No
  Cardmarket code or data is copied.

**Their published terms.** Cardmarket puts its brand assets up for download at
<https://help.cardmarket.com/en/Downloads> and says this about using them:

> By downloading a banner or a logo you acknowledge and agree that all rights to the
> brands of Sammelkartenmarkt GmbH & Co. KG are our sole property and that we are the
> exclusive beneficiaries of any goodwill resulting from their use. You shall not take
> any steps contrary to our rights or our property to the brands.

They publish horizontal and vertical wordmarks, with and without a tagline or trademark
notice, in blue, black and white, along with banners and a snippet for embedding them on
other pages. Downloading them for use is what that page is for, and this project takes
the conditions that come with it: their rights stay theirs, the goodwill from use is
theirs, and nothing is done contrary to their rights.

**What this project does with the logo, and what it does not.** Cardmarket's horizontal
lockup is their symbol beside their wordmark. The wordmark is a wide thing and cannot sit
in a table column header, so the column carries **their symbol** — the same artwork, taken
out of the same published file, with the wordmark and the empty margin around it dropped
and nothing else changed. Two versions are bundled: the black one for light backgrounds
and the white one, which they publish for dark ones. Neither is redrawn, recoloured or
rearranged.

Both are stored here as PNG with an alpha channel. The black one already was; the white
one they distribute as a palette PNG whose 256 entries carry their own alpha, and it is
re-encoded here to plain RGBA with the same pixels in the same places. That is a change
of container, not of artwork.

Nothing here suggests Cardmarket endorses, sponsors or is affiliated with this project,
and the opening of this document says so in as many words. The logo marks which column is
Cardmarket's; the numbers in it link to their site, which is what their embedding snippet
is for.

**What used to sit in that slot.** Before this the column was headed by a small
hand-and-bag glyph in a 15×15 viewBox, lifted out of the markup of a Scryfall card page:
the SVG Scryfall puts inside its own "Buy at Cardmarket" link. It was never Cardmarket's
logo at all — their marks are wordmarks. It is gone, both because its real origin was
Scryfall's and because the mark over a Cardmarket column ought to be Cardmarket's.

| File in this repo | What it is | Status |
| --- | --- | --- |
| `assets/icons/cardmarket-white.png` | Cardmarket's symbol, white, from the file they publish for dark backgrounds | **Used under their published terms**, quoted above. The artwork itself is unchanged; the wordmark beside it and the empty margin are what is gone. |

**How it is drawn.** The mark is not shown as an image. It is used as a CSS mask, so the
shape on screen is the alpha of that file and the colour is `currentColor` — the ink of the
column heading it sits in. The artwork is not recoloured, stretched or redrawn; it is the
same outline, and the only thing that varies is the ink it is filled with. This is why
there is one file and not a black one and a white one: a black mark on the dark page
rendered as a dark shape, and choosing between two files needs to know which theme is on.

`assets/icons/cardmarket-black.png` was shipped until this change and is not shipped now. The
earlier approach picked between their two published files by looking for a class on
`<html>`, which is not reliable: the class is not guaranteed to be there at the moment the
heading is built, and when it was missing the black mark went on the dark page.

## 10. Development-only dependency (not shipped)

| Package | Version | Licence | Why it is not a shipping dependency |
| --- | --- | --- | --- |
| [linkedom](https://github.com/WebReflection/linkedom) | 0.18.13 | ISC | `devDependencies` only; used by the `test-*.cjs` harness. No shipped file imports or requires anything. |

## 11. Fonts

No font file is bundled. The stylesheets only name font families: `Lato` (Scryfall's own web
font, referenced by name and not redistributed here) and `system-ui` / `Helvetica Neue` /
`Arial` fallbacks.

## 12. The card page after the split

`content.js` was one file: 1901 lines in a single closure holding the clipboard, the tag
panels, the printings table, CardTrader, EDHREC, the extra formats, the deck page and the
set filters. It is now `src/card-page/core.js` and nine files named for what they draw. The split
changed no licence and no line of logic: every line was moved as it stands, and a check
confirmed that the only code absent afterwards was the four declarations that became one
`shared` object and the eighteen `if (settings.x) initY();` lines that became the boot list.

`tools/content-split.cjs` and `tools/content-core-run.cjs` did the moving, by slicing the old
file by definition name. They read the old file, so they do not run again once it is gone,
and they are kept because they are the record of how the split was made and because the next
split starts from the same place.

## 12. This project's own artwork

| File | What it is |
| --- | --- |
| `assets/icons/icon16.png`, `assets/icons/icon32.png`, `assets/icons/icon48.png`, `assets/icons/icon128.png` | Original artwork, MPL-2.0 like the rest of this project's own files |
| `icons-src/scryfall-toolkit-icon.svg` | The vector source of that artwork |
| `tools/render-icons.cjs` | The generator that draws both, so the PNGs can be reproduced from source |

The design is a clipboard with a green clip on a dark plate, using this project's own
interface colours. It is **not** a logo, wordmark or brand colour of Scryfall, Wizards of
the Coast, EDHREC, CardTrader or Cardmarket, and it does not resemble any of them closely
enough to suggest an association. Nothing in the artwork was traced, copied or adapted
from anyone. The MPL covers this artwork; it covers no one else's mark.

---

## Open questions

What is left open, and why each one is still open. Everything that used to sit in this
list and has since been answered has been **removed** rather than annotated: a list of
settled questions next to the file we ship reads as though the settlement were in doubt,
which is the opposite of what a provenance document is for. The decisions themselves are in
sections 7, 8 and 9, and in `docs/ROADMAP.md` under "Decided, with the reasoning".

**Closed, and removed from this list:**

- the two brand marks, EDHREC's and CardTrader's — shipped on nominative use, basis in
  sections 7 and 8;
- the CardTrader API — nothing is fetched without the user's own token, so there is no
  redistribution to ask about;
- Cardmarket's logo — used on their published terms, section 9.

What remains is a question for the other party rather than for this repository, and each
one says so.

1. **Scryfall's acceptable-use rules** — the Terms say "You may not scrape Scryfall" and
   "You may not place undue burden on Scryfall through the use of automated means", and
   their API documentation says the same in more detail. This project reads the page the
   user is viewing and calls the documented API; it does not crawl, and it does not keep
   a copy of their data. Their published rate limits, from
   <https://scryfall.com/docs/api/rate-limits>, are per endpoint class and the card
   classes are the tight ones:

   | Endpoint | Their limit | What this project allows itself |
   | --- | --- | --- |
   | `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` | 2/second | one every 520 ms |
   | `/cards/manifest` | 10/minute | one every 6.1 s |
   | every other method | 10/second | one every 120 ms |

   The margins are deliberate: these are ceilings, and a timer that wakes a hair early
   must not turn "two a second" into "just under three". A 429 holds every queue for
   thirty seconds, which is the period their page says access is limited for, and one
   request is retried after it. That last part was missing until 2026-10-01: the queue
   had one slot of 130 ms for everything, taken from the "ten a second" figure, which is
   about four times their limit for the card endpoints — the ones the finish column, the
   EDHREC artwork, the deck search and the hover preview all use — and a 429 was treated
   as an ordinary failure, so a burst that crossed a limit kept crossing it.
2. **Nickname data revision** — `assets/data/shambleshark-nicknames.js` matches Shambleshark's
   `main` branch as read on 2026-09-25, with the `stc` → `snc` set-code difference noted
   above. If Shambleshark publishes a new revision, the bundle should be re-derived and
   this file updated.
