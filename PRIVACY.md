# Privacy policy — Scryfall Toolkit

**Last updated: 2026-09-25 · Extension version 0.51.0**

This is what this extension actually does with data, written from the shipped code in
this repository rather than from intention. If the code changes, this document changes
with it.

Scryfall Toolkit is an independent extension. It is not produced, endorsed or approved by
Scryfall, EDHREC or CardTrader. There is no account, no server of ours, and no analytics.

## The short version

- Your settings and your card clipboard stay in your browser.
- Nothing is sold, shared with advertisers, or sent to any server of ours. We have no
  server and collect nothing.
- The extension does talk to Scryfall, Tagger, EDHREC and CardTrader, because that is
  where the features get their data. Those requests contain card identifiers and, for
  EDHREC, the card name. Details below.
- Your CardTrader personal access token is stored only in your browser and is sent only
  to CardTrader's API.

## What is stored, and where

All of it is in `chrome.storage.local`, which is local to your browser profile and is not
synchronised to any account.

| Stored | Why |
| --- | --- |
| Your card clipboard: card name, set code, collector number, Scryfall link | the shared clipboard feature |
| Every setting in the popup: theme, tag and price options, thresholds, format order and visibility, language choices | so the extension behaves the same next time |
| Your CardTrader personal access token | the optional CardTrader price feature |
| Cached data: tag indexes, Scryfall set categories, set platforms, discovered format names | to avoid re-downloading large lists |
| The extension reads Scryfall's own `localStorage.cardClipboard` **once** | to import an older CardClip clipboard. It is read, not written, and the read stops after the import. |

The token field in the settings stays empty on purpose: a blank field is only used to
replace a stored token, so your token is never shown back to you or logged. The **Remove**
button deletes the stored token and turns the feature off.

## What leaves your browser

Every request is made by the extension's background worker. There is no background
telemetry, no error reporting and no usage tracking. Chrome's own network layer sees these
requests, and so does each service named below.

**Scryfall (`api.scryfall.com`, `data.scryfall.io`) — used for core features**

- Card lookups by Scryfall card ID, print lists by Oracle ID, set lists, and search
  queries such as `oracleid:…`, `illustrationid:…` and `e:<set>`.
- A POST to `/cards/collection` carrying Scryfall card UUIDs, in batches of up to 75.
- The tag bulk files (`oracle_tags`, `art_tags`) are downloaded and cached locally.
- Sent: Scryfall card and set identifiers, and search queries. Not your account, not your
  clipboard content, not your token.
- Requests to the API use `credentials: 'omit'`, so your Scryfall login cookies are not
  attached to them.

**Scryfall Tagger (`tagger.scryfall.com`) — card and art tags, related cards**

- A POST to `graphql/registry` with the set code and collector number of the card you are
  viewing, to fetch tag and relationship data.
- Sent: the printing you are looking at. `credentials: 'omit'` here too.

**EDHREC (`json.edhrec.com`) — optional, off by default**

- When you turn on the EDHREC feature, the extension requests
  `json.edhrec.com/pages/cards/<card-name>.json` for the card on the page you are viewing.
- Sent: the card name, as part of the URL. This reveals which card you are looking at, and
  EDHREC can see your IP address like any website can. Nothing else about you or your
  collection is sent.
- The clickable "EDHREC" link on the page is a normal link to `edhrec.com/cards/<card-name>`.
  It is only followed if you click it.

**CardTrader (`api.cardtrader.com`) — optional, needs your own token**

- When you enable CardTrader prices and store a token, the extension requests
  `expansions`, `blueprints/export` and `marketplace/products` to match the printing on the
  page and find the cheapest listed offers.
- Sent: your CardTrader personal access token in the `Authorization: Bearer` header, and
  the CardTrader expansion and blueprint identifiers for the card being viewed.
- The token is never sent anywhere else. It is not sent to Scryfall, EDHREC or Tagger.
- The listed prices link to `www.cardtrader.com/en/cards/<blueprint>`, which is only
  followed if you click it.

**Cardmarket** — the extension renders a link to the card's Cardmarket listing. No request
is made to Cardmarket unless you click it.

## What is not collected

Not by this extension, in this version: your name, your email, your browsing history, your
deck lists, your Scryfall account, your payment details, your IP address (as data we keep),
your keystrokes, or anything about how you use the extension. We have no server to send it
to and no analytics SDK in the build.

To be exact about what that claim rests on: the extension's only network calls are the
four services listed above, and its only persistent storage is `chrome.storage.local`. The
build ships no analytics, no remote code and no third-party script — `options.html` loads
only this project's own files.

## Permissions this extension asks for

| Permission | Why |
| --- | --- |
| `storage`, `unlimitedStorage` | your settings, clipboard and the cached tag indexes, which are large |
| `alarms` | refresh the bundled tag data at most once every seven days |
| Host access to `api.scryfall.com`, `data.scryfall.io`, `tagger.scryfall.com` | the features above |
| Host access to `json.edhrec.com` *(asked for when the feature is turned on)* | the optional EDHREC feature |
| Host access to `api.cardtrader.com` *(asked for when the feature is turned on)* | the optional CardTrader price feature |

Content scripts run only on `scryfall.com`, `www.scryfall.com` and `tagger.scryfall.com`.

## Your choices

Everything optional is off by default except the core clipboard and theme features. You
can turn the EDHREC and CardTrader features off at any time; turning them off stops the
requests. Removing the stored CardTrader token stops the token being used immediately. To
delete everything at once, remove the extension: Chrome deletes its local storage with it.

## Changes

If the code changes what it collects or where it sends data, this document is updated in
the same commit as the code change, and the release notes name the change.

## Contact

Questions belong in the issue tracker of the source repository:
<https://github.com/Solomag/scryfall-toolkit/issues>
