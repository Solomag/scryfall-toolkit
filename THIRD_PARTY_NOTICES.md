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

Every licence text quoted below is also stored verbatim as a file in `third_party/`, and
all of those files are shipped inside the distributed extension archive.

## The scope of this project's own licence

This project's own code is licensed **MPL-2.0** (see [`LICENSE`](LICENSE)). That licence
covers only the files this project wrote. It is not applied to anything listed in this
document, and it grants no rights in anyone's trademarks, logos, card data or service.

In particular, and stated plainly because it is easy to get wrong:

- The MPL-2.0 notice does **not** cover `icons/edhrec.png`, `icons/cardtrader.svg`,
  `icons/cardtrader.png` or `icons/cardmarket.svg`. Those are third-party brand marks, or
  in one case an icon whose origin is unconfirmed. Their rights stay with their owners.
- **Data access and logos are different questions, and only the first is settled.**
  EDHREC answered with their published data policy and it permits this use, so the data
  side is covered and recorded in section 7. Their policy says nothing about the logo,
  and neither did their answer. CardTrader and Cardmarket have not been asked at all.
  Nothing here claims a logo is cleared: the unresolved status in sections 7 to 9 is
  about the marks, and that is the real status.
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
  [`third_party/CardClip-LICENSE`](third_party/CardClip-LICENSE)
- Used: **visual asset** (3 files) and one data key name.

| File in this repo | What it is |
| --- | --- |
| `icons/clip.svg` | Copied verbatim from CardClip `img/clip.svg` |
| `icons/duplicate.svg` | Copied verbatim from CardClip `img/duplicate.svg` |
| `icons/trash.svg` | Copied verbatim from CardClip `img/trash.svg` |

All three were verified byte-identical to the files in the upstream repository by SHA-256
on 2026-09-25. Because they are copies, CardClip's MIT notice is retained in
`third_party/CardClip-LICENSE`.

The clipboard feature itself is **not** a copy: `content.js` and `tagger-clipboard.js`
are original implementations, and none of CardClip's function names
(`showClipboardList`, `loadClipboardFromStorage`, `transformButton`,
`findExistingButtons`, …) appear in this repository. The one place CardClip's data is
read is `content.js`, which reads the legacy Scryfall-page key `localStorage.cardClipboard`
and its `cardName` / `cardLink` fields to import a user's old clipboard once. That is an
interface with an existing installation, not copied code.

## 2. Paruhas/CardClip — behaviour only

- Upstream: <https://github.com/Paruhas/CardClip> (GitHub reports it as a fork of
  JacobHearst/CardClip, created 2025-09-05)
- Author: the fork's owner; the underlying copyright remains Jacob Hearst, MIT. The fork
  carries the same licence text as its parent, kept here in
  [`third_party/Paruhas-CardClip-LICENSE`](third_party/Paruhas-CardClip-LICENSE)
- Used: **behaviour/idea only** — the export format that appends the printing's set code
  and collector number (`1 Card Name (SET) 123`), exposed as the `moxfield` export option.
- No file from this repository was copied into this project.

## 3. Shambleshark — data copied

- Upstream: <https://github.com/crookedneighbor/shambleshark> ("An Unofficial browser
  extension to add functionality to the Scryfall site. Not affiliated with Scryfall.",
  last pushed 2023-10-07)
- Authors: Samuel Simões (2016), Blade Barringer (2019)
- Licence: MIT — full text in [`third_party/Shambleshark-LICENSE`](third_party/Shambleshark-LICENSE)
- Used: **data copied** (1 file).

| File in this repo | What it is |
| --- | --- |
| `data/shambleshark-nicknames.js` | The 396 card-nickname records from upstream's per-set TypeScript modules under `src/js/lib/card-nicknames/`, re-serialised into a single JSON array |

Upstream's record shape (`realName`, `setCode`, `collectorNumber`, `nickname`, `source`)
and every nickname string are upstream's. Two differences from upstream's `main` branch
were introduced here: the records were flattened into one array instead of 22 modules, and
Streets of New Capenna is keyed `snc` (Scryfall's current set code) where upstream still
writes `stc`. Both are recorded in the file's own header comment. Shambleshark's MIT
notice is retained in `third_party/Shambleshark-LICENSE`.

The inline card/art tag presentation was **not** copied: none of Shambleshark's
identifiers (`CardNicknameDisplay`, `createViewMoreTagsRow`, `TaggerIcon`,
`TaggerLookupData`, `elementReady`, …) appear in this repository, and the tag panels are
original code.

## 4. MoxTags — data copied verbatim

- Upstream: <https://github.com/natefinch/moxtags> ("A chrome extension to add scryfall
  tags to moxfield's card menu", created 2026-03-04, last pushed 2026-06-10)
- Author: Nate Finch
- Version used: **v1.8.3** (git tag `v1.8.3`, released 2026-06-08)
- Licence: MIT, `Copyright (c) 2026 Nate Finch` — full text in
  [`third_party/MoxTags-LICENSE`](third_party/MoxTags-LICENSE)
- Used: **data copied** (3 files, byte-identical copies).

| File in this repo | Upstream file (`src/data/`) |
| --- | --- |
| `data/oracle-tags.js` | `oracle-tags.js` |
| `data/illustration-tags-1.js` | `illustration-tags-1.js` |
| `data/illustration-tags-2.js` | `illustration-tags-2.js` |

All three were verified byte-identical to MoxTags v1.8.3 by SHA-256 on 2026-09-25; each
file now carries a header naming the source, version, author and licence, and MoxTags'
MIT notice is retained in `third_party/MoxTags-LICENSE`.

No Moxfield functionality is included. MoxTags continues to work on its own on Moxfield;
Scryfall Toolkit deliberately never runs there.

## 5. MTG Enhancements — behaviour and format names only

- Upstream: <https://github.com/notsonic/scryfall-enhancements> ("A browser extension to
  add more stuff to scryfall.com", created 2026-07-16, last pushed 2026-08-13)
- Author: notsonic
- Licence: MIT, `Copyright (c) 2026 notsonic` — full text in
  [`third_party/MTG-Enhancements-LICENSE`](third_party/MTG-Enhancements-LICENSE)
- Used: **behaviour/idea only**, plus the names of three extra formats.

`format-catalog.js` offers `Heritage`, `Classic Legacy` and `Peak Legacy` under exactly
the display names upstream uses for its `heritage`, `classic` and `peak` formats. Nothing
else was taken: upstream derives those formats with Scryfall search queries, while
`format-overrides.js` in this project is an original per-card legality map (17 card UUIDs
with their verdicts) written for this project.

## 6. Scryfall and Scryfall Tagger — service, not source

- <https://scryfall.com/> and <https://tagger.scryfall.com/> (Scryfall, LLC)
- Used: **no code and no artwork is copied.** The extension reads the pages a user is
  already looking at, and calls Scryfall's documented public API
  (`api.scryfall.com`, `data.scryfall.io`) and Tagger's own endpoints.

One derived data file is bundled:

| File in this repo | What it is |
| --- | --- |
| `data/set-platforms.js` | A snapshot, taken 2026-09-25, mapping 61 digital set codes to the client each was released for |

It was produced by reading Scryfall's `/sets` list and the `games` field of one card per
set. It contains set codes and platform names only — no card names, no card text, no
artwork, and nothing from Wizards of the Coast beyond factual set identifiers. Sets missing
from the snapshot are looked up at runtime and cached.

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

**How this project complies.** `background.js` enforces the rate limit rather than
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

| File in this repo | Status |
| --- | --- |
| `icons/edhrec.png` | **Unresolved.** Appears to be EDHREC's own logo. Their data policy covers data use; it says nothing about the logo, and permission to redistribute it has not been established. |

## 8. CardTrader — service, brand marks unresolved

- <https://www.cardtrader.com/> and its documented API v2 (`api.cardtrader.com`)
- Used: **service data fetched at run time only**, using a personal access token the user
  supplies. No CardTrader code is copied.

| File in this repo | Status |
| --- | --- |
| `icons/cardtrader.svg` | **Unresolved.** CardTrader's brand mark. Trademarks are not licensed as MIT. |
| `icons/cardtrader.png` | **Unresolved.** A monochrome version of the same mark. |

## 9. Cardmarket — service, icon unresolved

- <https://www.cardmarket.com/>
- Used: **service only.** A link to the card's Cardmarket listing, plus an icon. No
  Cardmarket code or data is copied.

| File in this repo | Status |
| --- | --- |
| `icons/cardmarket.svg` | **Unresolved.** A hand-and-bag glyph drawn in Scryfall's own icon style (15×15 viewBox, `fill="currentColor"`). The project's README says it follows Scryfall's own purchase-link icon, but that could not be confirmed against a Scryfall asset, and it is not Cardmarket's logo. |

## 10. Development-only dependency (not shipped)

| Package | Version | Licence | Why it is not a shipping dependency |
| --- | --- | --- | --- |
| [linkedom](https://github.com/WebReflection/linkedom) | 0.18.13 | ISC | `devDependencies` only; used by the `test-*.cjs` harness. No shipped file imports or requires anything. |

## 11. Fonts

No font file is bundled. The stylesheets only name font families: `Lato` (Scryfall's own web
font, referenced by name and not redistributed here) and `system-ui` / `Helvetica Neue` /
`Arial` fallbacks.

## 12. This project's own artwork

| File | What it is |
| --- | --- |
| `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png` | Original artwork, MPL-2.0 like the rest of this project's own files |
| `icons-src/scryfall-toolkit-icon.svg` | The vector source of that artwork |
| `tools/render-icons.cjs` | The generator that draws both, so the PNGs can be reproduced from source |

The design is a clipboard with a green clip on a dark plate, using this project's own
interface colours. It is **not** a logo, wordmark or brand colour of Scryfall, Wizards of
the Coast, EDHREC, CardTrader or Cardmarket, and it does not resemble any of them closely
enough to suggest an association. Nothing in the artwork was traced, copied or adapted
from anyone. The MPL covers this artwork; it covers no one else's mark.

---

## Open questions

These could not be settled from the repository or from public sources, and each needs a
decision before the archive is published widely.

1. **`icons/edhrec.png`** — establish whether this is EDHREC's own logo, and whether it may
   be redistributed. If not, replace it with a text label such as "EDHREC" (the feature
   already prints the name next to the value).
2. **`icons/cardtrader.svg` and `icons/cardtrader.png`** — CardTrader's marks. Check
   CardTrader's brand/API terms; if redistribution is not permitted, drop the images and
   use the existing text label, which already reads "CardTrader …" beside the price.
3. **`icons/cardmarket.svg`** — either confirm it is a copy of a Scryfall asset (and get
   permission) or state plainly that it is an original redraw in Scryfall's icon style. Do
   not ship a Scryfall asset without permission.
4. **EDHREC's logo** — their data policy covers using their data and says nothing about
   the mark. Either establish that it may be redistributed or replace it with a text
   label. The policy itself is now recorded in section 7.
5. **CardTrader API terms** — confirm the display rules for a third-party extension
   showing prices with the user's own token.
6. **Scryfall's acceptable-use rules** — the Terms say "You may not scrape Scryfall" and
   "You may not place undue burden on Scryfall through the use of automated means". This
   project reads the page the user is viewing and calls the documented API on a seven-day
   refresh; confirm that this pattern is acceptable, and keep the request rate low.
7. **Nickname data revision** — `data/shambleshark-nicknames.js` matches Shambleshark's
   `main` branch as read on 2026-09-25, with the `stc` → `snc` set-code difference noted
   above. If Shambleshark publishes a new revision, the bundle should be re-derived and
   this file updated.
