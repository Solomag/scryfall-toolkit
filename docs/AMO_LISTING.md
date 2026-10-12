# addons.mozilla.org listing — Scryfall Toolkit

Everything here is written from the shipped code, so that what is typed into the AMO form matches
what the extension actually does. Where a field needs a decision from the developer account, it says
so.

The Firefox archive is built by the same tool as the Chrome one, from the same files:
`scryfall-toolkit-<version>-firefox.zip`, attached to every release. Its `manifest.json` is derived
from the Chrome one, so the two cannot drift — see section 3.

---

## 1. The listing fields

**Name:** Scryfall Toolkit

That is the name in `manifest.json`, and AMO shows it on the listing.

**Summary** (shown in search and used by reviewers — this is the manifest's own `description`,
verbatim, and a test asserts the two are the same):

> Scryfall clipboard, tags, legality, dark theme, optional CardTrader prices and EDHREC statistics.

**Description:**

> Scryfall Toolkit adds the things Scryfall does not, without changing anything it already does.
>
> **Shared clipboard.** Press `+` on any printing and it joins a list that follows you between
> Scryfall and Scryfall Tagger. Copy the whole list as a deck list, in either of two formats.
>
> **Card and art tags.** The Tagger card and art tags for the card you are looking at, beside its
> printings, with related cards and image previews. Click a tag to add it to the search box.
>
> **Extra format legalities.** Heritage, Classic Legacy, Peak Legacy and Premodern, in Scryfall's
> own legality block and its own badges. Reorder or hide any row.
>
> **Dark theme.** For Scryfall and Tagger. It follows your system until you pick otherwise.
>
> **Optional extras, off until you turn them on.** EDHREC deck usage and Salt Meter; CardTrader
> prices for the exact printing, which need your own CardTrader API token.
>
> **In the deck editor.** A Clean Up button that sorts the deck and puts lands back in their
> column, EDHREC's suggestions for your commander, and a Scryfall search that adds cards without
> leaving the editor.
>
> Nothing is sent anywhere except to the services the features come from — Scryfall (including its
> data host), Scryfall Tagger, EDHREC and CardTrader — and only for the card or the deck you are
> looking at. There is no account, no analytics and no server of ours: your settings and your
> clipboard stay in your browser. The privacy policy names every request.
>
> This extension is independent: it is not produced, endorsed or sponsored by Scryfall, Wizards of
> the Coast, EDHREC, CardTrader, Cardmarket or Moxfield.

**Experimental:** No.

**Requires payment or additional software:** No. CardTrader prices need a CardTrader account, but
that account is free; EDHREC needs nothing.

**Categories** (up to three): **Games & Entertainment**, **Search Tools**, **Appearance**.

**Support email:** a real address the developer account can receive mail at.

**Support site:** <https://github.com/Solomag/scryfall-toolkit/issues>.

**License:** **Mozilla Public License 2.0** — the project's own code is MPL-2.0. Third-party
material (icons, tag data, the deck clean-up module, extra format data) keeps its own licence and
its own notice, listed in `THIRD_PARTY_NOTICES.md` and shipped inside the archive.

**Privacy policy:** yes — <https://github.com/Solomag/scryfall-toolkit/blob/main/PRIVACY.md>.

---

## 2. What it transmits, declared in the manifest

AMO has required `browser_specific_settings.gecko.data_collection_permissions` of every new
extension since 2025-11-03, and Firefox shows it in the install prompt. It has to say what the
extension transmits, and it has to match the privacy policy.

| Data type | Required? | Why |
| --- | --- | --- |
| `websiteContent` | required | The card being viewed — its set and collector number — and, when EDHREC's suggestions are asked for, the whole deck list. Both are content from the page. |
| `searchTerms` | required | The reader's search queries, sent to Scryfall in its own syntax. |
| `authenticationInfo` | optional | The CardTrader personal API token, sent only to CardTrader. That feature is off by default, so this is optional rather than required. |

`PRIVACY.md` names every request, host by host, and the same list is in the Chrome listing. A host
the code talks to but no document mentions is what a test in the suite exists to catch.

The six hosts, and what each is asked for:

| Host | What it is asked for |
| --- | --- |
| `api.scryfall.com` | card, print, set and search lookups |
| `data.scryfall.io` | Scryfall's published tag bulk files, read into the local cache |
| `tagger.scryfall.com` | the card's tags and related cards |
| `json.edhrec.com` | the card's EDHREC usage and Salt Meter (optional) |
| `edhrec.com` | the commander's page and the deck's suggestions (optional) |
| `api.cardtrader.com` | the printing's CardTrader offers (optional, and needs the token) |

---

## 3. The Firefox archive

One source, two archives. `package-extension.cjs` walks the same file list and runs the same checks
for both, and the Firefox `manifest.json` is derived from the Chrome one, so nothing is kept in step
by hand. Two things differ, and both are Firefox's:

- **The background is a `scripts` event page**, not a `service_worker`. Firefox's MV3 does not run a
  service worker, so `background.scripts` names the same worker file.
- **`chrome` there is the old callback namespace**, while the promise API is `browser`. The
  extension is written against `chrome` with promises, so `src/core/browser-shim.js` is loaded first
  in every context — the content scripts and the background alike — and points `chrome` at
  `browser`, giving the three calls still made with a callback (`runtime.sendMessage`, and
  `permissions.request` and `permissions.contains`) their callback form back. On Chrome the shim
  does nothing at all.

The gecko id is `scryfall-toolkit@solomag.github.io`. The desktop floor is Firefox 140 and the
Android floor is 142 — the versions where `data_collection_permissions` is read — and
`gecko_android` is what makes the listing available on Firefox for Android rather than desktop-only.

---

## 4. Notes for the reviewers

> The archive is the extension: there is no build step, no bundler and no minifier, and every file
> in the zip is the source as written. The Firefox `manifest.json` in the zip is generated by
> `package-extension.cjs` from the Chrome one, but the shipped manifest is the final one, so nothing
> has to be built to reproduce it.
>
> There is no remote code, no `eval` and no `new Function`; the markup the extension builds at run
> time is built with `document.createElement`, never parsed from a string.
>
> The extension adds panels to Scryfall card pages and, for the three deck tools, to Scryfall's deck
> editor. Those tools run in the page's own world (`world: "MAIN"`) because they read
> `window.Scryfall` and `window.ScryfallAPI`, Scryfall's own application internals; they are on by
> default and each has its own switch on the options page.
>
> What it transmits is declared in
> `browser_specific_settings.gecko.data_collection_permissions` and matches `PRIVACY.md` request by
> request.
>
> To try it: open any Scryfall card page, for example
> <https://scryfall.com/card/dsc/114/counterspell> — the tag panel, the extra format legalities and
> the dark theme are there, and the clipboard is the button in the bottom corner. The settings are
> the options page (`about:addons` → **Preferences**, or the toolbar button). EDHREC and CardTrader
> ask for their hosts from their own row on the settings page, and stay off until they are granted.

---

## 5. Screenshots

AMO takes screenshots the same way the Chrome Web Store does, and the five tiles in `store-assets/`
serve both: each is exactly **1280×800**, in English, and described in
`docs/CHROME_WEB_STORE_LISTING.md` section 7. Nothing is Firefox-specific in them — the settings page
is the same page — so they are used as they are.

---

## 6. What still needs a human in the developer account

These cannot be done from the repository, and each is listed with the exact screen.

1. **A Mozilla account**, at <https://addons.mozilla.org/developers/>.
2. **Submit or sign.** Either upload `dist/scryfall-toolkit-<version>-firefox.zip` in the Developer
   Hub — **Submit a New Add-on**, choosing **On your own** (self-distribution) to get a signed
   `.xpi` without a public listing, or **Listed** to appear on AMO — or sign it from a terminal with
   `web-ext sign` and the API keys from
   <https://addons.mozilla.org/developers/addon/api/key/>:
   ```
   npx web-ext sign --source-dir=<the unzipped archive> --artifacts-dir=dist \
     --channel=unlisted --api-key=<issuer> --api-secret=<secret>
   ```
3. **Fill the fields** from section 1, and the categories, licence and privacy policy URL with them.
4. **Paste the reviewer notes** from section 4 if the form asks.
5. **Wait for review.** A first submission usually signs automatically; a manual review takes days.

A signed, self-distributed `.xpi` installs by opening it in Firefox, but does not appear on AMO and
does not update itself unless an `update_url` is provided. A listed add-on is updated by Firefox on
its own.
