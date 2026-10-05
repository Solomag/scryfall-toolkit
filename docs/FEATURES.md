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

**Deck legality check.** A button on a deck page asks Scryfall about each of the deck's
cards and lists the ones it counts as not legal in Commander. Commander is not chosen: the
editor on Scryfall builds commander decks, and that is a fact about the page rather than a
setting, so there is nothing to pick from.

**What it does not check, and says so beside the answer:** the commander's colour
identity, the hundred-card limit, and the one-copy rule for cards marked "Commander
only". Those are rules about the deck as a whole. Scryfall has no endpoint that applies
them to a deck, and computing them here would mean writing a mana-symbol parser and then
trusting it — so the panel reports one thing well and prints its own boundary underneath.
A card Scryfall says nothing about is counted apart from a card it calls illegal, because
the two call for different actions.

Scryfall's own word is kept, because it is not one word: across every format it says
`legal`, `not_legal`, `banned` or `restricted`. A deck with Ancestral Recall in it reads
"banned in Commander" rather than a paraphrase, and banned cards are listed above the ones
that are merely outside the format.

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

**Three** Shambleshark deck modules are here. A fourth was ported and taken back out:
`card-input-modifier` showed a card image when the cursor was over a deck row, which
Scryfall's own tooltip covers, and the site already previews cards on hover — so it made
the editor worse and duplicated what was already there. No code from it is in the package.
The three that remain run through Scryfall's application internals rather than the page
markup, which is why the extension has a script in the page's own world, one adapter over
those internals, and a bridge back to the content script for settings and for the two data
requests.

## Hiding and filtering

These affect the **Sets** index and the **Prints** table on a card page. Card searches,
individual set pages and decks are not changed, and the currently selected printing
stays visible.

These are one group in the interface, and every switch in it means the same thing:
**on is show.** Nothing here says "hide", and that is deliberate — a negative word read
next to positive ones is the opposite of itself at every call site, and three of the four
places that read this setting had to know which sense a given field was in.

**There is no master switch.** A reader who wants Paper, Arena and Magic Online has all
three on by default, so a switch over them had no use except as a shortcut that loses
per-platform settings when pressed. The earlier one was exactly that, and it could be
drawn in a state the model could not explain — a master off with a rule on.

- **Paper / Arena / Magic Online** — three switches, and each one says whether that
  platform is shown. Turning one off keeps its own settings and brings them back when it
  returns: the switch writes one field and the detail panel writes another, and neither can
  rewrite the other.

  A printing can be on several platforms, so this is asked **per printing** rather than
  per set. Scryfall records `games` on every printing and never omits it, and a paper
  printing carries "paper" in it — Vintage Masters has 171 printings marked Magic Online
  and four marked for Arena as well. Answering at the set level meant turning Arena off
  took the paper printing of a set that was on both.

- **Paper → Настроить** — Paper's own settings, behind a button, closed to begin with:
  **Нетурнирные и вспомогательные издания** (memorabilia, minigame, Vanguard and token
  categories, plus official proxy set codes — Collector's Edition, 30th Anniversary
  Edition, World Championship Decks; mixed "funny" sets stay, because some contain
  tournament-legal cards), **Увеличенные карты**, **Наборы без английских изданий**, and
  **Foreign Black Border** with its list of 4BB / FBB / BCHR behind another switch.
  Arena and Magic Online have no details button: a digital set is not memorabilia, is not
  oversized and has no English printing to speak of.

- **Неанглийские издания** — one dropdown, three positions: **Все**, **Только без
  английского аналога**, **Никакие**. The middle one shows a foreign printing only where
  the same card has no English **Paper** printing with the same artwork in the same
  treatment — compared on `illustration_id`, `frame`, `frame_effects`, `border_color` and
  `full_art`, and on every face of a multi-faced card, because Scryfall leaves the card's
  own `illustration_id` off a double-faced card and puts it on the faces. A set name, a
  collector number or the language is not part of that comparison. It is not a claim to
  catch every visual difference Scryfall does not record, so anything it cannot compare
  stays visible: an extra row is better than a missing one.

  Scryfall's own rows in a Prints table carry no artwork, so the middle position does not
  touch them; "Никакие" hides them by their link. The middle position does apply to the
  printings the extension adds itself, which come from the API with those fields.

- **Где применять** — one list of three places for every rule: **Таблица изданий**,
  **Поиск**, **Список сетов**. One list rather than a selector per rule, because three
  rules times three surfaces is nine switches and a reader who ticks one has answered a
  question about a rule rather than about a place.

  Set rules remove a set whole; the language rule removes an individual printing. A set
  having some hidden cards in it does not by itself hide the set.

**Oversized** is its own switch, independent of the one above it: a set can be both, a
  Vintage Championship being memorabilia *and* oversized, and turning one off does not turn
  the other off. Its list comes from Scryfall and not from a guess — oversized is a flag on
  the printing, not a field on the set, so the sets holding an oversized printing are
  collected by asking for the printings.

  **Foreign Black Border** has its list of 4BB, FBB and BCHR behind another switch, because
  unticking one family has to mean something. A set is found by name, because Scryfall has
  nothing else to say: a set object carries `code`, `name`, `set_type`, `digital`,
  `card_count`, `released_at` and fifteen more, and nothing about borders.

- **Sets with no English printing** — the third switch inside Paper, and a plain one. There
  are 34 of them: the French `ren` and Italian `rin` releases of Renaissance, Salvat 2005 and
  2011, Sega Dreamcast Cards, the Magic Premiere Shop runs, Japanese promo sets and five sets
  of Japanese promo tokens.

  **Its list is dated and ships inside the extension, and it says so on the settings page.**
  There is no short list of sets to check: these are a subset of all 1,053, so "the ones we do
  not know about" is most of Scryfall and looking each one up would be a thousand requests a
  day for every reader. Unlike the platform index beside it, which can refresh itself because
  its candidates are the 61 digital sets, this one cannot. It goes stale in the safe
  direction: a foreign-only set released since the measurement stays visible until the next
  one. `npm run set-rules --write` regenerates it, and the check in that tool fails when the
  file and a fresh sweep disagree.

- **Hide USD, TIX, TCGplayer and Cardhoarder prices** — four separate checkboxes, see
  the price filter above. They are in the same group because they are set rules about what
  is shown, not because they have anything to do with sets.
The **set index is cached for one day**, and the Caster marker and the deck token list
sit in the same section.

**The set index and the platform index.** Paper is every set Scryfall does not mark digital;
Arena and Magic Online are their digital-only sets. Scryfall's index does not name the
client behind a digital set, so the extension ships a snapshot of every known digital set's
platform, looks up anything missing through a page of the set's printings, and keeps that
answer for a month. A set the lookup cannot place stays visible rather than being hidden on
a guess.

The lookup takes every printing's answer rather than one printing's, because they do not
always agree: Vintage Masters has 320 printings marked Magic Online and 5 marked for Arena
as well, with nothing about those five to tell them apart. Reading one card reported a set
that had been on Arena as never having been there.

The set field of Advanced search follows the **Games** checkboxes Scryfall already shows
above it. Hidden sets are marked, never removed, so the field can widen again at any
time.

**What these rules are checked against.** The name-matched border rule is verified on the Sets
index, in a real browser: with the category off, every row is on the page; with it off, exactly
the border sets go and nothing else does, and Scryfall's own counter is rewritten to match.
Narrowing it to a single family is checked separately, because "unticking one has to mean
something" is a different claim from "the category works". With paper alone chosen, all 61
digital sets go. The rule's names are read out of `worker.js` rather than copied into the check,
so a change to a pattern changes what is expected instead of quietly disagreeing with it.

They are not verified on the Prints table, and the reason is worth knowing before reading
that as a gap in the feature. That table shows a window of ten sets around the printing being
viewed, and the sets these rules name sit outside it for most cards — for Counterspell, `sld`
is the eleventh of twenty-four. The window widens when "View all prints" is pressed, which no
automated check can do to a page whose features have already run. So the Prints table's own
behaviour is checked in the extension's unit tests, where the fixture supplies the API's
answer directly, and the browser check is on the surface where the switch and the row are
next to each other.

**Why the border rule reads names at all.** Nothing on Scryfall says a set has a black border:
a set object carries `code`, `name`, `set_type`, `digital`, `card_count`, `released_at` and
fifteen more, and nothing about borders. `npm run set-rules` sweeps all 1,053 sets and asks
Scryfall about each, which settles both halves of a name-based rule — that each matched set
really is in the state claimed, and that nothing Scryfall *names* Foreign Black Border was left
out. Three sets say it and all three are matched.

That half is falsifiable: a foreign black border set has no English printing anywhere in it, so
`e:<code> lang:en` is refused for one and answered for every other set. All three hold — 378,
307 and 125 printings, none of them English.

**The language rule asks a different question, and that is why it is not a set list.** The
question is whether a *printing* has an English counterpart that looks the same, so the answer
comes from the printings rather than from a set's name. Three ways of asking about the
*absence* of English were tried and all three fail: `lang:!en` is not a negation and returns
all 397 printings of `m21`; `-lang:en` is not one either and returns 3,411 against 397; and
`NOT lang:en` is honoured and wrong, refused for `m21` correctly and for `cmd` and `tsp`
incorrectly.

**34 sets have no English printing at all**, and three of them are the border releases. The rest
are foreign-only products — 21 promo sets, five sets of Japanese promo tokens, three box sets
(Salvat 2005 and 2011, Sega Dreamcast Cards) and two master sets, the French `ren` and the
Italian `rin` of Renaissance. The switch inside Paper hides all 34; the three border releases
are in it too, since they have no English printing either, and hiding them twice is harmless.

**What the middle position can and cannot decide.** It compares a foreign printing with the
English Paper printings of the same card across the whole print list, not only the rows the
current window happens to show — the analogue of a printing is regularly *earlier* in the list
than the printing being tested, and a rule that could only look forwards would call every
reprint unique and hide nothing at all. It also refuses to use an English printing the reader
has themselves hidden, since that is not a picture they have.

What it cannot decide is a visual difference Scryfall does not record. `frame`,
`frame_effects`, `border_color` and `full_art` cover the ones the API knows about; a treatment
that differs in some other way is not visible to the comparison, and the consequence is a
duplicate row rather than a missing one. That is the intended direction, and it is why every
unresolved case — no artwork recorded, no English printing on paper, an empty comparison — keeps
the printing on screen.

---

## What is not done yet

- Tag panels appear on single card pages. Panels in search results are **not planned**:
  a search grid would need a rule for which of a card's thousands of tags to show, and a
  request per card to fetch them. Tags belong on the card that has them.
- Shambleshark's deckbuilder search, EDHREC suggestions, cleanup and card input editing
  **are** integrated; see the deck page section above. Its Card Notes and Legality Check
  modules are empty placeholders upstream, so there is nothing there to port. A legality
  check over the deck is now ours, and is described under Deck pages: it judges Commander
  per card and prints the rules it did not apply rather than guessing them.
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
