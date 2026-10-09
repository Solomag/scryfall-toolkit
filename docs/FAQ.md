# FAQ

Short answers to the questions that actually come up. The [README](../README.md) says
what the extension is; [FEATURES.md](FEATURES.md) says exactly what each setting does.

---

## Getting it

**Where do I get it?**
From the [Chrome Web Store](https://chromewebstore.google.com/detail/scryfall-toolkit-preview/ofpociogpmmgfjgjnfppnllabhjjnclf), or from a [release](https://github.com/Solomag/scryfall-toolkit/releases) as an unpacked extension.

**How do I install it by hand?**
Unzip the release into a folder you keep, then `opera://extensions` → **Developer mode** → **Load unpacked** → choose the folder that has `manifest.json` in it.

**How do I update?**
Replace the contents of that same folder and press **Reload** on the extension. Keeping
the folder keeps your clipboard and settings.

**Nothing on the page changed after I installed it.**
Reload the Scryfall tab. Content scripts do not reach a page that was already open.

**The settings page looks like plain HTML.**
That means `src/ui/options.css` did not load. It happened in one release (0.44.0) where the file
was missing from the archive. Install a build from 0.45.0 or later; the packaging now
checks the archive itself and a smoke test runs it.

---

## What it sends where

**Does this collect anything about me?**
No. Settings and the clipboard are in `chrome.storage.local` and never leave the browser.
There is no account, no analytics, no telemetry and no server of ours. [PRIVACY.md](../PRIVACY.md)
names every request the extension makes.

**Then why does it need network access?**
Because the features are data from other sites. Scryfall for cards, prints, sets and tags;
Scryfall Tagger for live tags and related cards. EDHREC and CardTrader only when you turn
those features on.

**What does EDHREC see?**
The name of the card on the page you are looking at, as part of a request URL. Nothing
else — not your collection, not your account, not your clipboard. Only when the EDHREC
feature is enabled.

**What does CardTrader see?**
Your own personal access token, and the CardTrader identifiers of the printing you are
looking at. The token goes to `api.cardtrader.com` and nowhere else. Only when the
CardTrader feature is enabled.

**Where is my CardTrader token stored?**
In `chrome.storage.local`, on your machine. The settings field stays blank on purpose so
the token is never shown back to you. The **Remove** button deletes it.

**Can I use CardTrader without a token?**
No. Their API needs one. Everything else works without it.

---

## How things behave

**Why do some sets stay in the list even though I hid them?**
Each filter covers its own category. **Hide non-tournament sets** keeps mixed "funny"
sets because some contain tournament-legal cards, and the currently selected printing is
always left visible so you do not lose your place.

**A digital set is showing that I expected to be filtered.**
The platform filter works from a snapshot of which client carries each digital set.
Scryfall's own index does not say, so the extension looks up anything missing through one
card of the set and remembers the answer for a month. A set it cannot place stays visible
rather than being hidden on a guess.

**Why do some prices or panels appear after the page loads?**
Finish badges use Scryfall's collection API, EDHREC and CardTrader have their own
requests, and the extra format legalities wait for their API results. They arrive when
they arrive; nothing is hidden in the meantime.

**EDHREC/CardTrader indicators do not appear at all.**
Those features are off until you enable them. If they are on and still absent, the data
was missing for that card — the extension shows nothing rather than an error.

**Salt Meter is not a power rating.**
It is EDHREC's community vote average on a 0–4 scale, from "not salty" to "very salty".
Higher means the community finds the card more frustrating to play against.

**The dark theme is wrong somewhere.**
The theme paints over Scryfall's own styles, so it depends on Scryfall's markup. If
Scryfall changes a page, that page can come out partly unthemed until this extension is
updated. Screenshots help a lot: the page URL and a picture of what you see.

**Something looked white for a moment while the page loaded.**
That was a real bug: the theme waited for the stored preference before marking the page
dark. Fixed in 0.47.0 — the theme now applies before the first paint.

---

## Its relationship to other things

**Is this official?**
No. It is independent and not produced, endorsed or approved by Scryfall, Wizards of the
Coast, EDHREC, CardTrader or Cardmarket.

**I use MoxTags on Moxfield. Does this replace it?**
No. This extension never runs on Moxfield. Keep MoxTags there.

**Does this replace CardClip, Shambleshark or MTG Enhancements?**
It overlaps them on Scryfall. Disable those on Scryfall if you want to compare; none of
their code is installed here. What is here from Shambleshark is behaviour, rewritten; from
MTG Enhancements, behaviour and three format names.
Nothing from them runs as theirs. See
[THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for what came from where.

**Do you get permission for the logos?**
Mixed, and the differences matter. **Cardmarket** publishes its brand assets for download
with terms attached, and this extension uses their symbol on exactly those terms — the
rights stay theirs, the goodwill from use is theirs, and nothing here implies they endorse
this project. **CardTrader** is different: their mark is in the package and no permission has
been received for it. EDHREC's logo used to be here on the same basis and is gone, with the
control that showed it. `THIRD_PARTY_NOTICES.md` records each one's real status rather than
claiming they are all cleared.

**What licence is the code under?**
MPL-2.0 for this project's own files. Third-party data and images keep their own licences
and are not covered — see the [README](../README.md) for the table.

---

## Getting help

Open an issue: <https://github.com/Solomag/scryfall-toolkit/issues>

The most useful report has three things: the page URL, a screenshot of what you see, and
whether it still happens after reloading the tab.
