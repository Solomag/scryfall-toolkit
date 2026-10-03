# Features

What each part of Scryfall Toolkit does, in detail. The [README](../README.md) is the
short version; this is the one to read when you want to know exactly what a setting
changes.

The clipboard, the tag panels and the dark theme are on. The EDHREC and CardTrader
integrations are off until you turn them on, because both of them send something about
what you are looking at to someone else. The other extras have their own defaults and
each can be switched off.

---

## Shared clipboard

On a Scryfall or Tagger search page, press `+` on a card. Open the clipboard at the
bottom right. Each row shows the card's set code and collector number beside its name.

- Copy the whole list from the toolbar, or one card with the small copy button beside
  its name. Both follow the selected export format, which includes set codes by default.
- Hovering the toolbar copy button reveals the **other** format: with set codes chosen it
  offers names, and with names chosen it offers set codes. The main button always does
  what the settings say, so the two can never end up doing the same thing.
- An entry is a **printing**, not a name. On a set page a card is shown as several
  printings — an alternate borderless beside a showcase beside an autograph — and each
  carries its own tick and can be selected alongside the others.
- Without a set on the line, printings of the same card are **counted**: three of Mana
  Drain copy as `3 Mana Drain`, not as three identical lines. With a set on the line they
  stay separate, because that is what tells them apart.
- The same clipboard, formats and rules appear on Tagger pages. The two pages hold one
  clipboard between them and used to format it separately; the rules now live in
  `src/core/clipboard-format.js`, which both load.
- The same clipboard and add/remove button appear on individual Tagger card pages.
- An older **CardClip** clipboard is imported once, on the first Scryfall run, if this
  extension has no `cards` value yet. It reads Scryfall's `localStorage.cardClipboard`
  array, transfers each card's name and link into `chrome.storage.local`, and then the
  two stop syncing. Imported entries may lack the set and collector number the deck
  export wants; newly added cards have both. An older build that already saved an empty
  `cards` array prevents a later import.

## Card and art tags

On a single card page, tags appear in the right column below Prints as separate **Card
Tags** and **Art Tags** tables.

- Each shows six tags initially; expand or collapse the full list with the link
  underneath. Either kind can be switched off in the popup.
- Click a tag to append its search token to Scryfall's search box without moving the
  page; a brief notification confirms it. Click several to combine them, then submit the
  search yourself.

**Related cards.** Tagger's live relationships — similar, better, prototype and other
linked cards — appear in a third table, only when the card has relationships. They are
ordered by relationship type and card name, and can be hidden independently.

- Hover or focus a related card for an image preview; move the cursor onto the preview to
  keep it open, and use the browser's image menu to copy it. Click its name to open that
  card with this extension's features.
- These need a separate request to Tagger's card-edge service. If that service is
  unavailable, the bundled Card and Art Tags still appear with a small notice.

## Prints

Click **View all prints** in a card's Prints section to expand the remaining printings
inside the native Prints table.

- Rows are grouped by set with collapsible headers; the last row keeps a link to
  Scryfall's own full page.
- With the clipboard option on, every printing row — including the current one — shows a
  `+` that adds that printing with its set code.
- **Group printings by set** turns the grouped table off and leaves Scryfall's table
  untouched. **Fold groups** removes the collapse arrows and the "Collapse all groups"
  label. **Full printings link beside it** removes the extra link on the bottom line.
- Opening the full list in the same tab is under **Experimental**.

## Extra format legalities

Heritage, Classic Legacy, Peak Legacy and Premodern sit in Scryfall's own legality
block, in Scryfall's own rows, labels and badges.

- Reorder any format by dragging it in the two-column settings grid, or hide it
  individually. Display is left to right, then top to bottom.
- The extra rows appear when their API results are ready; there is no transient Loading
  badge. Random card pages work even when Scryfall omits the usual metadata tags.
- Results follow the source project's search logic and overrides. Check uncertain cases
  against current format rules before relying on them.

## Dark theme

It paints over Scryfall's own styles rather than replacing them, so it depends on
Scryfall's markup. A page that changes can come out partly unthemed until this
extension is updated; everything else works the same either way.

A theme for card pages, set listings, advanced search, search notices, account and deck
panels, and Tagger.

- **Follow the system** (the default) reads the operating system's own appearance and
  switches with it. Light or dark can be pinned instead.
- The theme is applied before the first paint, so a page does not flash white while the
  stored preference loads.
- Rarity stars keep their rarity colours with a thin dark outline. The header search icon
  stays visible and no longer takes the browser's autofill paint. Caster Mode's large
  button becomes a small indicator at the bottom left while active.
- Every purple in the theme is the same lifted one, wherever it appears: link ink, icon
  fill, a member's picture frame, a deck curve meter, a notice bar. The repair judges the
  colour itself rather than one literal, so a purple dark enough to sink into a dark
  surface is lifted wherever Scryfall wrote it.
- A band that carries a logo is treated as a picture and never flattened. A repainted
  surface is never filled through the `background` shorthand, so a logo held as a
  background image survives.
- A wrapper that only holds a control is not a surface: Scryfall's file-input box paints
  nothing of its own and is left alone.

Tagger is a separate app with its own dark design, so the theme states each of its
surfaces explicitly and repaints only the panels Tagger itself marks light. Tagger's own
page field and its soft glow behind the header are left exactly as the app paints them.

## Optional extras

**Finish column.** When a card has finish-only printings, one narrow column appears
between printing names and prices: foil-only, nonfoil-only, etched-only, or a known
special foil treatment. Hover for the meaning. Native foil stars in printing names are
not duplicated. Uses Scryfall's collection API and may arrive after the page loads.

**Price filter.** Hides the USD and TIX columns and the TCGplayer and Cardhoarder
purchase links, including Buy buttons in deck sidebars. Keeps Cardmarket links. Existing
Scryfall prices are never altered. Choose Cardmarket, CardTrader or both as the EUR
source in the Prints table; with both, their columns carry provider icons.

**CardTrader prices.** With your own personal API token, the extension matches Scryfall
print IDs against CardTrader blueprints, links the exact printing and shows the cheapest
listed foil and nonfoil offers. Its EUR column fills gradually to respect the marketplace
rate limit, and only EUR offers appear. If CardTrader fails, a CardTrader-only table
restores the native Cardmarket column. Listed prices exclude shipping and do not
guarantee language, condition or stock. The token is stored locally and sent only to
`api.cardtrader.com`.

**EDHREC indicators.** Usage and Salt Meter sit inside the legality block, each with a
same-size badge before its label. Choose a stacked fraction (decks containing the card /
decks eligible by colour identity), the percentage of eligible decks, or both. Usage
colouring can use absolute deck counts or percentages, with adjustable thresholds. Salt
Meter is EDHREC's community vote average on a 0–4 scale, not a power rating. Usage, salt
and the EDHREC link switch independently; missing data produces no panel. The lookup
sends the card's name to EDHREC only when the feature is on.

**Search and nickname extras.** A Tagger shortcut on search results; search links for a
card's type and mana cost; archived card nicknames under the prints table of a card
Scryfall previewed under another name (for example Lavabrink Venturer (IKO #19) as
"Professional Stunt Performer"). The bundled list holds 396 of them across 21 sets.

**Deck pages.** A No Prices mode, stacked deck cards, and a Show Tokens dialog that looks
up deck cards and their tokens through Scryfall (at most 150 unique deck cards). These do
not install Shambleshark itself.

**Clean up improver** *(off by default)*. The first Shambleshark deck module to be
ported. When a deck is cleaned up it moves lands out of the nonland column and nonlands
out of the land one, and it can sort every column by card type or by name and head each
group with its name and count.

It is worth being clear about why this one is off by default. Everything else in the
extension works through the page's markup or Scryfall's documented API. This works
through `window.Scryfall` and `window.ScryfallAPI`, which are Scryfall's application
internals and were never published as an interface. So a script now runs in the page's
own world to reach them, with a bridge back to the content script for settings.

The module is written to fail soft: if Scryfall reshapes any of the things it touches,
that hook simply does not happen and the deck editor keeps working — the feature stops
rather than breaking anything. Until it has been checked in a live deck editor it stays
off, and turning it on is a deliberate choice.

**EDHREC suggestions** *(off by default)*. On a commander deck, an EDHREC button in the
toolbar opens the card lists EDHREC shows for that commander — its own grouping, its own
ranking — with the share of the commander's decks that play each card, and a button that
adds one to the deck through Scryfall.

Worth being explicit about what this does not do. Shambleshark has a feature of the same
name that parks a hidden iframe on edhrec.com and asks it for recommendations. This reads
EDHREC's published JSON instead — the commander page's `cardlists` already carry what the
feature shows — through the same queue and the same rate their data policy asks for. No
frame, no page markup, no endpoint that was not already being used.

**Scryfall search** *(off by default)*. A Search button in the deck editor's toolbar opens
a query box in Scryfall's own syntax, lists what comes back, and puts a card in the deck.
Two checkboxes narrow it: only the commander's colours, and no funny cards. Requests go
through the extension's Scryfall queue rather than firing out of the page.

Upstream's version also keeps saved searches; theirs describes that as not finished, and
this leaves it out rather than shipping something half done.

All four Shambleshark deck modules are now ported. Three of them run through Scryfall's
application internals rather than the page markup, which is why the extension has a script
in the page's own world, one adapter over those internals, and a bridge back to the
content script for settings and for the two data requests.

## Hiding and filtering

These affect the **Sets** index and the **Prints** table on a card page. Card searches,
individual set pages and decks are not changed, and the currently selected printing
stays visible.

These are one setting in the interface, grouped the way they are decided: which
platforms, which sets are junk, which prices. There is a master switch over the set
rules and the platforms.

**The master switch is a gate, not a shortcut.** Turning it off leaves every switch
under it exactly where you put it and hides nothing; turning it back on brings your own
choices back rather than the defaults. It never rewrites them.

- **Hide non-tournament sets** — memorabilia, minigame, Vanguard and token categories,
  plus official proxy set codes (Collector's Edition, 30th Anniversary Edition, World
  Championship Decks). Mixed "funny" sets stay, because some contain tournament-legal
  cards.
- **Hide oversized sets** — its own toggle, independent of the one above: a set can be
  both, a Vintage Championship being memorabilia *and* oversized, and turning one on does
  not turn the other off. The list comes from Scryfall and not from a guess: oversized is
  a flag on the printing, not a field on the set, so the sets holding an oversized
  printing are collected by asking for the printings.
- **Foreign Black Border** and **Non-English printings** — each has three positions rather
  than a switch: not at all, the Prints table only, or both the Sets index and the Prints
  table. They differ because the two surfaces are different things. On the Prints table a
  set is a row and a printing is a row, and each printing carries its own language, so a
  Japanese printing of Portal can go while the English printings beside it stay. On the
  Sets index there are only sets: hiding one removes the whole set, English printings
  included. Which you want is a real choice, and neither answer is the default for the
  other.
- Under each, a list of which parts: 4BB, FBB and BCHR; Portal, Secret Lair and the rest.
  On the Sets index the non-English rule recognises only Portal and Secret Lair, because
  those are named; every other set that prints a second language is only found by reading
  its printings, so that category applies on the Prints table.
- **Hide USD, TIX, TCGplayer and Cardhoarder prices** — four separate checkboxes, see
  the price filter above. They sit outside the master switch, because they are not a set
  rule.

The **set index is cached for one day**, and the Caster marker and the deck token list
sit in the same section.

**Platforms** (experimental) — All, Paper, Arena, Magic Online. Decides which sets appear
in `/sets` and in the Prints table. Paper is every set Scryfall does not mark digital;
Arena and Magic Online are their digital-only sets. Taking away the last one falls back
to All, because a set list with nothing in it is not a choice this setting can hold.
Scryfall's index does not name the client behind a digital set, so the extension ships a
snapshot of every known digital set's platform, looks up anything missing through one
card of the set, and keeps that answer for a month. A set the lookup cannot place stays
visible rather than being hidden on a guess.

The set field of Advanced search follows the **Games** checkboxes Scryfall already shows
above it. Hidden sets are marked, never removed, so the field can widen again at any
time.

---

## What is not done yet

- Tag panels appear on single card pages. Panels in search results are **not planned**:
  a search grid would need a rule for which of a card's thousands of tags to show, and a
  request per card to fetch them. Tags belong on the card that has them.
- Shambleshark's deckbuilder search, EDHREC suggestions, cleanup and card input editing
  **are** integrated; see the deck page section above. Its Card Notes and Legality Check
  modules are empty placeholders upstream, so there is nothing there to port. A legality
  check over the deck is the obvious thing to build next and it is deliberately left out
  rather than overlooked: the data is already here, but which format a deck is being
  judged against is a question the deck editor does not answer, and a check that guesses
  is worse than none.
- The dark theme is applied over Scryfall's own styles, so it depends on Scryfall's
  markup. A page that changes its markup can come out partly unthemed until this
  extension is updated. Behaviour on private, signed-in pages depends on what that page
  renders and has been checked in ordinary use rather than in automated tests.
- Tag data ships from MoxTags v1.8.3 (June 2026). The extension tries to refresh it from
  Scryfall's published tag bulk files on installation and every seven days; the bundled
  snapshot stays usable if that fails.
- The CardTrader and Cardmarket icons are third-party marks, and the EDHREC icon appears
  to be one. Their provenance is not settled. `THIRD_PARTY_NOTICES.md` records exactly
  what is unconfirmed and what has to be established before wider distribution.
