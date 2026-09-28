# Chrome Web Store listing — Scryfall Toolkit 0.49.0

Everything here is written from the shipped code, so that the answers given in the store
console match what the extension actually does. Where a field needs a decision from the
developer account, it says so.

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
> **Optional extras, all off until you turn them on.** EDHREC deck usage and Salt Meter
> inside the legality block. CardTrader prices for the exact printing, using your own
> personal access token. Finish badges, card nicknames, type and mana search links, set and
> printing filters, a No Prices mode and a token list on deck pages.
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
| `storage` | keep the clipboard and the settings between sessions | `content.js`, `options.js`, `theme.js`, `tagger-clipboard.js` |
| `unlimitedStorage` | cache the bundled tag indexes locally instead of re-downloading several megabytes on every card page | `background.js` (`tagIndexes`) |
| `alarms` | refresh the tag data at most once every seven days | `background.js` |
| `https://api.scryfall.com/*` | card, print, set and search lookups, and the tag bulk files | `background.js` |
| `https://data.scryfall.io/*` | the tag bulk files Scryfall serves from this host | `background.js` (through the URL Scryfall returns) |
| `https://tagger.scryfall.com/*` | live tag and related-card data for the card on the page | `background.js` |
| `https://json.edhrec.com/*` | optional EDHREC usage and Salt Meter, only when the user enables it | `background.js` |
| `https://api.cardtrader.com/*` | optional CardTrader prices, only when the user enables it and stores a token | `background.js` |

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
| **Website content** | the card name of the page being viewed, as part of a request URL | `json.edhrec.com`, when the EDHREC feature is enabled |
| **Website content** | Scryfall card UUIDs, Oracle and illustration IDs, set codes, collector numbers, and search queries such as `oracleid:…` | `api.scryfall.com`, `tagger.scryfall.com` |
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
Scryfall Tagger (tagger.scryfall.com), EDHREC (json.edhrec.com), CardTrader
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
   section 7. The 128x128 icon is already in the ZIP at `icons/icon128.png`; use that
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
| `store-assets/01-settings-01-of-05.png` | the header, General (settings language, theme), Tags |
| `store-assets/02-settings-02-of-05.png` | CardClip, Prints, the top of Hide extras |
| `store-assets/03-settings-03-of-05.png` | Hide extras with the set filters and the platform block |
| `store-assets/04-settings-04-of-05.png` | Additional info: EDHREC and CardTrader |
| `store-assets/05-settings-05-of-05.png` | Legality with the format grid, Scryfall Deckbuilder, Experimental, Credits |

All five come from one real capture of the settings page
(`store-assets/settings-page-full.png`, 1280×4322), so nothing is repeated or cropped
away between them. Each tile is scaled uniformly to 800 rows and the margins continue
the page's own colour, so no screenshot is stretched. Rebuild from the source:

```
powershell -File store-assets/make-store-shots.ps1 -Source store-assets/settings-page-full.png -OutDir store-assets -Tiles 5
```

The store accepts up to 5 screenshots, and five is what covers the whole page.

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

> Access is limited to five hosts and every one of them serves a named feature.
> api.scryfall.com — card, print, set and search lookups, sending Scryfall card and set
> identifiers. data.scryfall.io — Scryfall's own published tag bulk files, read into the
> local cache. tagger.scryfall.com — a POST to graphql/registry with the set code and
> collector number of the card being viewed, for card/art tags and related cards.
> json.edhrec.com — optional, off by default; when enabled, the card name is sent as
> part of a request URL. api.cardtrader.com — optional, off by default; with the user's
> own token, the exact printing and its cheapest EUR offers. Content scripts run only
> on scryfall.com, www.scryfall.com and tagger.scryfall.com.

Per host, if the form asks separately:

| Host | Text |
| --- | --- |
| `api.scryfall.com` | Core feature. Card lookups by Scryfall ID, print lists by Oracle ID, set lists and search queries such as `oracleid:…` and `e:<set>`. Sends Scryfall card and set identifiers only, never account data. |
| `data.scryfall.io` | Core feature. Downloads Scryfall's published tag bulk files (`oracle_tags`, `art_tags`) into the local cache. The extension only reads them. |
| `tagger.scryfall.com` | Core feature. A POST to `graphql/registry` carrying the set code and collector number of the card the user is viewing, for card and art tags and related cards. |
| `json.edhrec.com` | Optional feature, off by default. When the user turns on EDHREC indicators, the card name is sent as part of the request URL to read its public JSON. |
| `api.cardtrader.com` | Optional feature, off by default. With the user's own personal access token, looks up the exact printing and its cheapest listed EUR offers. The token is sent only to this host. |

**Remote code — answer "No".** If the form still asks for text:

> This extension does not use remote code. All HTML, CSS and JavaScript is inside the
> package; nothing is fetched from a server and executed. The manifest declares no
> content_security_policy override, so the default Manifest V3 policy (script-src 'self')
> applies. The only data received at run time is JSON from Scryfall, Scryfall Tagger,
> EDHREC and CardTrader, which is rendered as page text and is never executed.
