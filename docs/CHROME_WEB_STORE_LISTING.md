# Chrome Web Store listing — Scryfall Toolkit 1.2.0

Everything here is written from the shipped code, so that the answers given in the store
console match what the extension actually does. Where a field needs a decision from the
developer account, it says so.

**Before submitting.** The three deck editor tools described below have been used in a real
deck editor and work there. They run through Scryfall's application internals rather than
the page markup, which is why they are opt-in: internals are not a published contract, and
if a future version of Scryfall changes them these are the features that break first. If
that happens, cut the "In the deck editor" paragraph and the last row of the data table
along with the switches; the rest of this document stands either way.

**The EDHREC suggestions need two hosts**, not one. Their published JSON is on
`json.edhrec.com` and the recommendations for a specific deck are on `edhrec.com` itself.
Both are optional and both are asked for when the feature is turned on. The settings page
has a button that asks for whichever a turned-on feature is still missing.

---

## 1. Store listing

**Item name:** Scryfall Toolkit (Preview)

**Summary** (single purpose, one sentence, shown in search results):

> Shared card clipboard for Scryfall and Scryfall Tagger, card and art tags on card pages,
> extra format legalities, a dark theme, and optional EDHREC and CardTrader data.

**Detailed description:**

> Scryfall Toolkit adds the pieces that were missing from browsing Scryfall. It is an
> independent extension. It is not produced, endorsed, sponsored or approved by Scryfall,
> Wizards of the Coast, EDHREC or CardTrader.
>
> Scryfall Toolkit is unofficial Fan Content permitted under the Wizards of the Coast Fan
> Content Policy. Not approved or endorsed by Wizards. Portions of the materials shown
> are property of Wizards of the Coast. ©Wizards of the Coast LLC.
>
> **Shared clipboard.** Add any printing to a clipboard that follows you across Scryfall
> and Scryfall Tagger, with a names-only menu, duplicate and delete controls, and a copy
> format that includes the printing's set code and collector number. If you used the older
> CardClip extension, its clipboard is imported once, on the first run.
>
> **Card and art tags.** On a single card page, card tags and art tags appear as their own
> tables next to the printings, with the full list one click away. Click a tag to add it to
> Scryfall's search box. Live related cards from Scryfall Tagger appear in a third table
> when the card has relationships, with image previews on hover.
>
> **Extra format legalities.** Heritage, Classic Legacy, Peak Legacy and Premodern sit in
> Scryfall's own legality block, in Scryfall's own badges. Reorder or hide every format row
> by dragging in the settings.
>
> **Dark theme.** A dark theme for Scryfall and Scryfall Tagger that follows your system
> until you pick otherwise.
>
> **Optional extras.** EDHREC and CardTrader are off until you turn them on; the rest have their own defaults and each can be switched off. EDHREC deck usage and Salt Meter
> inside the legality block. CardTrader prices for the exact printing, using your own
> personal access token. Finish badges, card nicknames, type and mana search links, set and
> printing filters, a No Prices mode, a token list and a Commander legality check on deck
> pages.
>
> **In the deck editor.** Three more optional tools, all off by default: a Clean Up button
> that sorts the deck and puts lands back in their column, EDHREC's own card lists for your
> commander, and a Scryfall search that adds cards without leaving the editor.
>
> **Your data stays yours.** Settings and the clipboard live in your browser. There is no
> account, no analytics and no server of ours. The extension asks Scryfall, Scryfall
> Tagger, EDHREC and CardTrader for data, because that is where the features come from. The
> full privacy policy names every request:
> https://github.com/Solomag/scryfall-toolkit/blob/main/PRIVACY.md
>
> **Source code:** https://github.com/Solomag/scryfall-toolkit
> The release ZIP is built from a tagged commit of that repository with `npm run package`,
> so the code in the store is the code you can read. Third-party data, images and code keep
> their own licences; see THIRD_PARTY_NOTICES.md in the extension and in the repository.
> It paints over Scryfall's own styles rather than replacing them, so it depends on
> Scryfall's markup: a page that changes can come out partly unthemed until this
> extension is updated.

**Category:** Tools

**Language:** English

**Website / Support / Homepage:** https://github.com/Solomag/scryfall-toolkit

**Privacy policy URL (required, must be publicly reachable):**
https://github.com/Solomag/scryfall-toolkit/blob/main/PRIVACY.md

---

## 2. Single purpose statement

Required by the store, one sentence:

> Scryfall Toolkit improves browsing Scryfall and Scryfall Tagger with a shared card
> clipboard, tag panels, extra format legalities, a dark theme and optional EDHREC and
> CardTrader data.

---

## 3. Permission justifications

The store asks why each permission is needed. These are the answers, matched to
`manifest.json` and to the code.

| Requested | Why the extension needs it | Where the code uses it |
| --- | --- | --- |
| `storage` | keep the clipboard and the settings between sessions | `src/background/worker.js`, `src/ui/options.js`, `src/core/theme.js`, `src/card-page/clipboard.js`, `src/card-page/tagger-clipboard.js` |
| `unlimitedStorage` | cache the bundled tag indexes locally instead of re-downloading several megabytes on every card page | `src/background/worker.js` (`tagIndexes`) |
| `alarms` | refresh the tag data at most once every seven days | `src/background/worker.js` |
| `https://api.scryfall.com/*` | card, print, set and search lookups, and the tag bulk files | `src/background/worker.js` |
| `https://data.scryfall.io/*` | the tag bulk files Scryfall serves from this host | `src/background/worker.js` (through the URL Scryfall returns) |
| `https://tagger.scryfall.com/*` | live tag and related-card data for the card on the page | `src/background/worker.js` |
| `https://json.edhrec.com/*` | **optional permission.** Optional EDHREC usage and Salt Meter, off by default. The host is asked for when the user turns EDHREC on, not at install. | `src/background/worker.js` |
| `https://edhrec.com/*` | **optional permission.** The deck-specific EDHREC recommendations. Separate host from the one above, and for the same reason. Asked for when the user turns on EDHREC suggestions. | `src/background/worker.js` |
| `https://api.cardtrader.com/*` | **optional permission.** Optional CardTrader prices, off by default. The host is asked for when the user turns CardTrader on, not at install. Needs the user's own token as well. | `src/background/worker.js` |

Three of them are **optional permissions**: `json.edhrec.com`, `edhrec.com` and
`api.cardtrader.com`. Each serves a feature that is off by default, so the browser is
asked for it when the user turns the feature on and not before. Turning a switch off and on
again is how access is put back if it is ever revoked, and the settings page has a button
that asks for whatever a turned-on feature is still missing.

Content scripts run only on `https://scryfall.com/*`, `https://www.scryfall.com/*` and
`https://tagger.scryfall.com/*`, to render the extension's own panels on those pages.

**Why `web_accessible_resources`:** the bundled icons have to be visible to the Scryfall
and Tagger pages so the extension's buttons can show them. Nothing else is exposed.

**Why host permissions rather than `activeTab`:** the extension's features run
automatically on Scryfall card pages, so it needs standing access to those hosts and to
the API hosts above. It requests no access to any other site.

---

## 4. Privacy tab — the answers to fill in

Chrome's privacy questionnaire, answered from the code.

**Does this item collect or use user data?**
Yes — limited data, for the item's own functionality.

**Is the data sold or shared with third parties?**
No. Nothing is sold, and nothing goes to advertisers or data brokers.

**Is the data transmitted, sold or shared for purposes related to the item's
functionality?**
Yes. Requests go to Scryfall, Scryfall Tagger, EDHREC and CardTrader, and they are what
makes the features work.

**Is the data used for tracking?**
No. There is no analytics, no telemetry and no advertising in the build. Chrome's own
definition of tracking — following users across sites to target advertising — is not done
here.

**Categories of data collected** (tick these and no others):

| Category | What the extension actually sends | To whom |
| --- | --- | --- |
| **Website content** | the card name of the page being viewed, and — for the EDHREC suggestions feature in the deck editor — the **whole deck list**, every card with its count plus the commanders that lead it, posted to the endpoint EDHREC's own site uses to suggest cards for a deck. Not the account, not other decks, not the collection | `edhrec.com/api/recs/` and `json.edhrec.com`, when the EDHREC feature is enabled |
| **Website content** | Scryfall card UUIDs, Oracle and illustration IDs, set codes, collector numbers, and search queries — both the extension's own, such as `oracleid:…`, and whatever the user types into the deck editor's search box | `api.scryfall.com`, `tagger.scryfall.com` |
| **Authentication info** | the user's CardTrader personal access token, in an `Authorization: Bearer` header | `api.cardtrader.com` only, when the user enables CardTrader and stores a token |
| **User activity** | which cards the user is viewing, as expressed by the identifiers and queries above | the four services named here |

Not collected, and do not tick these: name, email address, physical address, phone number,
personal identifiers, health, financial or payment information, contacts, browsing history
outside the extension's own features, keystrokes, or anything about how the extension is
used.

**How is each category used?** Product functionality. Nothing else.

**How is each category collected?** Automatically, from the page the user is viewing, at
the moment a feature needs data. Nothing is collected in the background at rest except the
seven-day tag refresh, which fetches Scryfall's own published tag files and does not
include anything about the user.

**Data retention:** the clipboard and settings are kept in `chrome.storage.local` until the
user changes them or removes the extension. Requests are made and the answers cached
locally; nothing is kept on any server of ours, because there is none.

**Data deletion:** the settings page has a **Remove** button for the CardTrader token.
Removing the extension deletes all its local storage. There is no account to delete.

**Third parties that receive data:** Scryfall (api.scryfall.com, data.scryfall.io),
Scryfall Tagger (tagger.scryfall.com), EDHREC (json.edhrec.com, and - for the deck
suggestions only - edhrec.com, which receives the whole deck list), CardTrader
(api.cardtrader.com). Each receives only what is listed above, only when the related
feature is on.

---

## 5. Privacy policy

`PRIVACY.md` in this repository, linked from the listing:
https://github.com/Solomag/scryfall-toolkit/blob/main/PRIVACY.md

It is written to match the code and names every request the extension makes. If the store
console asks for a URL rather than text, use the link above.

---

## 6. What still needs a human in the developer account

These cannot be done from here, and each is listed with the exact screen.

1. **Developer registration** — the one-time $5 fee at
   https://chrome.google.com/webstore/devconsole if the account has not paid it yet.
2. **Upload the ZIP** at https://chrome.google.com/webstore/devconsole → **New item** →
   choose `dist/scryfall-toolkit-<version>.zip`.
3. **Privacy practices tab** — fill in the section 4 answers above.
4. **Store listing tab** - paste section 1's fields, and upload the screenshots from
   section 7. The 128x128 icon is already in the ZIP at `assets/icons/icon128.png`; use that
   same file if the form asks for the icon as a separate upload.
5. **Distribution tab** — choose visibility (Public) and the regions.
6. **Review and publish** — the submission is a *review*, not a publication. It becomes
   public only when Google approves it. Tick automatic publication after approval if the
   console offers it.

---

## 7. Screenshots

Ready in `store-assets/`, each exactly **1280×800** (PNG), in English:

| File | What it shows |
| --- | --- |
| `store-assets/01-settings-01-of-05.png` | the header, General (settings language, theme), Tags with its per-tag switches, CardClip, and the Hide extras heading opening |
| `store-assets/02-settings-02-of-05.png` | Hide extras in full — the master switch, the junk rules, Foreign Black Border and non-English with their category lists, the platform block, and the four price switches |
| `store-assets/03-settings-03-of-05.png` | the end of the price switches with the Caster marker and deck tokens, then Additional info: EDHREC deck usage and Salt Meter, CardTrader with its token field |
| `store-assets/04-settings-04-of-05.png` | Legality and the format grid, then Scryfall Deckbuilder with the opt-in tools and the host-access button |
| `store-assets/05-settings-05-of-05.png` | the deck clean-up block, Prints, Experimental, and Credits and third-party projects |

All five come from one real capture of the settings page
(`store-assets/settings-page-full.png`, 1280×5712), so nothing is repeated or cropped
away between them. Each tile is scaled uniformly to 800 rows and the margins continue
the page's own colour, so no screenshot is stretched.

**The row descriptions are read off the pictures, and they go stale the moment the page
changes.** Two rounds of refactoring moved everything between them — the pictures went from
the body of the page into the "?" dialogs, which took about a thousand pixels out of it —
and the descriptions went on describing where the sections used to be. The dimensions and
the file names are checked by the test suite; what each tile *shows* is not, because
reading a picture is a job for a person and a regex cannot do it.

The capture is rendered from `src/ui/options.html` by the tool below: the real page,
with the real stylesheet and the real script, at 1280 pixels wide and as tall as it
turns out to be. That is the point of doing it this way — the paragraph this replaces
told a reader to rebuild the tiles from a capture, and the capture itself could only
be taken by hand, so the screenshots drifted out of date with the page every time the
page changed.

```
node tools/make-store-shots.cjs
powershell -File store-assets/make-store-shots.ps1 -Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5
```

The first command needs Chrome or Edge on the machine and finds either; set
`STK_CHROME` if it is somewhere unusual. The second needs nothing but PowerShell,
because cutting the tiles means resampling an image and this project has no image
library.

**The page the capture shows** is the one a reader lands on: the "?" beside each section
is part of it, and the pictures it opens are made by `node tools/make-feature-shots.cjs`
from the feature files themselves — see the note on them below. The pictures sit behind
the "?" rather than in the page because six large images in the body pushed the settings
they explain off the bottom of the page, and the point of the settings page is the
settings.

The store accepts up to 5 screenshots, and five is what covers the whole page.

### The illustrations in the settings

Six of them, one behind the "?" beside the section whose switch turns the feature on. A
reviewer sees the "?" in the screenshots and can open each picture, so what is inside
matters:

- **They are cut out of a real Scryfall card page** — their markup, their stylesheet,
  this project's theme on top of it, and our panels where our own feature files put
  them. `node tools/make-feature-shots.cjs` fetches the page, runs the feature files
  over it in the same harness the tests use, and takes the card page's whole right-hand
  column out of the rendered result — the printing's banner, the prints table with its
  price columns, and the tag tables underneath. Nothing in them is drawn, and nothing is a
  mock-up. The sixth is the clipboard, which is a panel floating over the page rather than
  part of any column.

  They were crops of a single panel until 1.1.7, which says what a panel looks like and
  nothing about where it goes: not that the tag tables sit under the prints, not that a
  panel is a panel rather than part of Scryfall's own page, and not what the column looks
  like once a rule has taken rows out of it. They are between 1,200 and 1,800 pixels tall
  now, and the settings dialog scrolls, because a picture taller than the window that
  cannot be scrolled is a picture with its bottom cut off.

  An earlier version built them on a container of our own, and they read as a different
  program: oversized serif links, purple underlined tag names, panels at no proportion to
  anything, a light page where the product is dark. The panels were correct; the stage
  was not a place the extension ever runs.
- **Every name, number and price in them is real, and none of it is written by hand.**
  Set names, collector numbers, prices, finishes and legalities come from Scryfall's
  public API, tag names from Tagger's registry — the two sources the extension itself
  asks. The card and its printing are the ones the page is about. An earlier version had
  invented text in it, a card called "Test Card" and a commander figure of 4,823, which
  a reader cannot tell from a picture of a working feature; the fixture is now checked
  for exactly that.
- **No card image appears in any of them.** Every crop is a table, a badge or a list —
  none includes the artwork, and the extension ships no card imagery. The column's left
  edge is the column's own, so no strip of the card beside it comes along either. So the
  conditions in the next subsection are not engaged by the illustrations, though they are
  by the
  store screenshots below.
- **They are not photographs taken by the extension running in a browser**, and it is
  worth being exact about why: stable Chrome 154 refuses `--load-extension` outright —
  tried headless, tried with an offscreen window, tried with
  `--enable-unsafe-extension-debugging`. So no service worker of ours is talking to a
  live page here. The panels are driven by the same feature files the extension loads,
  over the same two APIs, and placed on the page by the tool rather than by a content
  script. Scryfall's own scripts are stripped from the document; their markup and
  stylesheet, which is what is being photographed, are not.
- **EDHREC's deck counts are in none of them.** `json.edhrec.com` answers 403 to anything
  outside their own site, so a real count cannot be fetched when the pictures are made.
  Rather than show a plausible invented number, the Additional info section illustrates
  the column of finish badges instead — computed from what Scryfall returned.
- **No third-party marks are in them.** The EDHREC and CardTrader icons are not on any
  panel these six pictures show, so the basis recorded in `THIRD_PARTY_NOTICES.md` for
  those marks is not exercised here.
- They are regenerated by a test-backed tool: if a feature stops rendering, the tool
  fails rather than producing a picture of an empty panel, and a check fails if the page,
  the folder and the tool ever disagree about which illustrations exist. A picture cut
  off part-way down a long table says so when it is made, rather than quietly ending
  where the crop ended.
- The column is taken whole and nothing in it is sliced. Two elements have to be in the
  crop that a first guess leaves out, and both were found by looking at the pictures:
  Scryfall's `.prints-current` hangs 20px above its own parent on a negative margin, and
  `.prints` is capped at 400px by their CSS while its table is wider. Cropping either one
  alone cuts a printing's name or a price column in half. The tool's own bound on height
  is the number a check compares the pictures against, so the two cannot drift apart.

### Whether a card may appear in one

Yes. A card on a Scryfall page in a screenshot is a card as Scryfall shows it, which is
what Scryfall's own imagery rules ask for and what the Wizards Fan Content Policy is
written to allow — Scryfall itself is unofficial Fan Content and displays the same images
the same way. The conditions are specific and cheap to keep:

- **Do not crop, clip, mask or blur the card.** Their rules call out the copyright and
  artist line at the bottom of every card by name: it has to stay visible.
- **Do not recolour, sharpen, desaturate, skew or stretch it.** A screenshot of the page
  as the browser drew it complies by construction; a re-graded or resized card does not.
- **Do not put anything on top of it** — no badge, no arrow, no callout box over the art.
- **Do not imply the card came from anywhere but Magic.** No "our" framing.
- **The listing carries the fan-content note** (section 1) and does not use any Wizards
  logo. Our own icon is original artwork and does not resemble theirs.

So the useful screenshots — a card page in the dark theme with the tag tables and the
clipboard open, and the deck editor with its three tools — are all allowed as long as
nothing is drawn over the cards. What is not allowed is a cropped card used as a
decorative element, which is also not something worth doing: it tells a reader less than
the page does.

---

## 8. Privacy practices tab — the justifications, ready to paste

Chrome's privacy tab asks for a justification per permission and for a purpose
description. Every line below is true of the shipped code: the tag data really is
11.7 MB, the alarm really is a 7-day refresh, and there really is no remote code
(`eval`, `new Function`, dynamic `import`, remote `<script>`/`<link>` appear in no
shipped file, and the manifest declares no CSP override, so the Manifest V3 default
`script-src 'self'` applies).

**Purpose description / Single purpose:**

> Scryfall Toolkit improves browsing Scryfall and Scryfall Tagger with a shared card
> clipboard, card and art tag panels, extra format legalities, a dark theme, and
> optional EDHREC and CardTrader data.

**`alarms`:**

> The extension bundles a large index of Scryfall card and art tags. The single alarm
> "stk-tags-refresh" runs once every 7 days (periodInMinutes 10080) to re-download
> Scryfall's published tag bulk files and replace the cached copy. The alarm does
> nothing else: no other network call, no tracking, no user activity of any kind.

**`storage`:**

> Storage holds the user's settings (theme, feature switches, format order and
> visibility, thresholds), the shared card clipboard (card name, set code, collector
> number, Scryfall link), and the cached tag index. All of it is local to the browser
> profile and is never uploaded anywhere. A CardTrader API token, if the user chooses
> to enter one, is kept here too and is sent only to api.cardtrader.com.

**`unlimitedStorage`:**

> The cached tag index exceeds the 10 MB default quota of chrome.storage.local: the
> three tag data files alone are 11.7 MB (3.75 + 4.38 + 3.58). Without this permission
> the card and art tag panels on card pages cannot work. Nothing else in the extension
> grows without bound.

**Host permissions** — if the form gives one box, use the block below; if it gives one
box per host, use the matching line:

> Access is limited to six hosts and every one of them serves a named feature.
> api.scryfall.com — card, print, set and search lookups, sending Scryfall card and set
> identifiers. data.scryfall.io — Scryfall's own published tag bulk files, read into the
> local cache. tagger.scryfall.com — a POST to graphql/registry with the set code and
> collector number of the card being viewed, for card/art tags and related cards.
> json.edhrec.com — optional, off by default; when enabled, the card name is sent as
> part of a request URL. edhrec.com — optional, off by default; used only by the deck
> editor's suggestion feature, which sends the commander and the whole deck list to
> EDHREC's own recommendation endpoint. api.cardtrader.com — optional, off by default;
> with the user's own token, the exact printing and its cheapest EUR offers. Content
> scripts run only on scryfall.com, www.scryfall.com and tagger.scryfall.com.

Per host, if the form asks separately:

| Host | Text |
| --- | --- |
| `api.scryfall.com` | Core feature. Card lookups by Scryfall ID, print lists by Oracle ID, set lists and search queries such as `oracleid:…` and `e:<set>`. Sends Scryfall card and set identifiers only, never account data. |
| `data.scryfall.io` | Core feature. Downloads Scryfall's published tag bulk files (`oracle_tags`, `art_tags`) into the local cache. The extension only reads them. |
| `tagger.scryfall.com` | Core feature. A POST to `graphql/registry` carrying the set code and collector number of the card the user is viewing, for card and art tags and related cards. |
| `json.edhrec.com` | Optional feature, off by default. When the user turns on EDHREC indicators, the card name is sent as part of the request URL to read its public JSON. |
| `edhrec.com` | Optional feature, off by default, and only the deck editor's EDHREC suggestions use it. That feature sends the commander and the whole deck list — every card with its count — to EDHREC's own recommendation endpoint. No account, no other decks, no collection. |
| `api.cardtrader.com` | Optional feature, off by default. With the user's own personal access token, looks up the exact printing and its cheapest listed EUR offers. The token is sent only to this host. |

**Remote code — answer "No".** If the form still asks for text:

> This extension does not use remote code. All HTML, CSS and JavaScript is inside the
> package; nothing is fetched from a server and executed. The manifest declares no
> content_security_policy override, so the default Manifest V3 policy (script-src 'self')
> applies. The only data received at run time is JSON from Scryfall, Scryfall Tagger,
> EDHREC and CardTrader, which is rendered as page text and is never executed.
