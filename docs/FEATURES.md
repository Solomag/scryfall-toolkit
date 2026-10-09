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

**Price filter.** Hides the USD, TIX and EUR columns and the TCGplayer, Cardhoarder and Cardmarket
purchase links, including Buy buttons in deck sidebars. Each is a switch of its own, so a reader
who wants no shop links but keeps the dollar column can say so, and one more switch hides the whole
**Buy This Card** block — the column the links sit in, heading and all — because hiding each shop
leaves the block behind. Existing Scryfall prices are never altered.

**EUR source.** Scryfall's native euro column is Cardmarket's price, and two controls answer for it
on the settings page, kept in step so they cannot disagree. The **EUR** box in the price group says
whether the column exists; the dropdown beside the shops says whose number fills it — Cardmarket,
CardTrader, both (a second column appears beside it), or **show nothing**, which removes the column.
Unticking **EUR** sets the dropdown to **show nothing** and blocks it; a reader who reaches for the
blocked field gets the box flashed and a line saying why, because a disabled select would swallow
the click and explain nothing. Setting the dropdown to **show nothing** clears the box, and any
other choice ticks it back. The shop box is a different question: hiding Cardmarket hides its links
and not the column. CardTrader needs a personal token for the column, set in the CardTrader row
above it, and the row's own switch is not required for it: that switch is about the buy-block links.

**CardTrader prices.** With your own personal API token, the extension matches Scryfall
print IDs against CardTrader blueprints, links the exact printing and shows the cheapest
listed foil and nonfoil offers. Its EUR column fills gradually to respect the marketplace
rate limit, and only EUR offers appear. If CardTrader fails, a CardTrader-only table
restores the native Cardmarket column unless the reader has hidden Cardmarket. Listed prices
exclude shipping and do not guarantee language, condition or stock. The token is stored locally
and sent only to `api.cardtrader.com`. On the settings page the feature cannot be switched on
before there is a token, because a switch that turns on a request that cannot be made is a switch
that lies; the page says **Токен сохранён ✓** and not "connected", because nothing on it asks
CardTrader anything.

**EDHREC indicators.** Usage and Salt Meter sit inside the legality block, each with a
same-size badge before its label. Choose a stacked fraction (decks containing the card /
decks eligible by colour identity), the percentage of eligible decks, or both. Usage
colouring can use absolute deck counts or percentages, with adjustable thresholds. Salt
Meter is EDHREC's community vote average on a 0–4 scale, not a power rating. Usage, salt
and the EDHREC link switch independently; missing data produces no panel. The lookup
sends the card's name to EDHREC only when the feature is on. Both have their settings behind
their own **Настроить** on the settings page, collapsed by default and working while collapsed,
each with a **Вернуть стандартные настройки** that restores only its own numbers.

**Search extras.** A Tagger shortcut on search results, and search links for a card's type and
mana cost.

The historical card names line — an archived nickname under the prints table of a card Scryfall
previewed under another name — was cut in 1.7.6. It was a switch whose purpose nobody could say,
and it carried a 396-record data file of somebody else's for it.

**Deck pages.** A No Prices mode, stacked deck cards, and a Show Tokens dialog that looks
up deck cards and their tokens through Scryfall (at most 150 unique deck cards). These do
not install Shambleshark itself.

All three are Deckbuilder features and only that: they add their controls to Scryfall's deck
page, and the Show Tokens button appears only where Scryfall itself lists a deck's cards — the
`/@user/decks/…` pages — and nowhere else on the site. The switch was in the "hide extras"
group until this release, which is where the price switches lived and not where this one
belongs.

**The settings page presents these as a list of one-line features.** Each row is a switch and a
name, and the name says what the feature does rather than what control it adds. What it does, and
the limits worth knowing, are behind the row's "?" — a button, so it opens by click and by
keyboard and never on hover alone. The paragraphs that used to stand between the rows moved
there; the technical story — the page path, the object names, the adapter's own words — lives in
**Diagnostics**, a collapsed section at the bottom of the page. The cleanup feature's own
settings are behind its row's **Настроить**, collapsed when the page opens: opening it changes
nothing, closing it resets nothing, and neither direction touches the switch. The same square
18px boxes the other rebuilt sections use are used here, rather than the page-wide slider.

**Diagnostics is a place to read, not a step.** It is closed when the page opens, and opening it
changes no setting and asks for no permission. It names the state rather than leaving it to be
inferred: no editor page open (which is not an error — the modules do not run anywhere else),
nothing checked yet, a module that works, or a real error on an editor page. A report is always
about a page visited before the settings page, so it names which page that was. Absence of the
deckbuilder on a card page is therefore reported as "no suitable editor page open", never as a
failure of the feature.

**Deck legality check.** A button on a deck page asks Scryfall about each of the deck's cards,
one at a time, and lists the ones it counts as not legal in Commander. It checks **individual
cards**, not the deck as a whole, and both the setting's name and the help say so. Commander is
not chosen: the editor on Scryfall builds commander decks, and that is a fact about the page
rather than a setting, so there is nothing to pick from.

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

**Its access is asked for from its own row, and only when it is missing.** The feature needs two
hosts; if either is missing the row shows a chip — **Требуется разрешение** when none of the
access is there, **Ограниченный режим** when only part of it is, because the commander page still
loads while the deck-specific advice does not. The button in the chip is the only thing on the
page that asks, and it asks only for this feature's hosts, from a click. The page never asks on
its own — a request made while loading is refused by the browser and printed as an unchecked
error, which is the bug the page already fixed once — and opening a help dialog asks for nothing.
Once the access is there the chip and the warning are gone rather than left standing.

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

These are one section in the interface, called **Visibility** / **Видимость**, and every
control in it means the same thing: **on is show.** Nothing here says "hide", and that is
deliberate — a negative word read next to positive ones is the opposite of itself at every call
site, and three of the four places that read this setting had to know which sense a given field
was in. The one that used to be negative is now positive too, and its stored key was **renamed**
rather than flipped in place; see the Caster marker below.

The section is two columns on a window with the room for them — the table on the left, and the
four short lines on the right — and one column below the width where they stop fitting. The card
is wide and the settings are not, so a single column left two thirds of it empty. There are no
frames and two headings rather than three: a fieldset with a legend in its border says "a group
of related settings" by drawing a box, and boxes inside boxes says it three times; by the third
the reader is looking at frames rather than at what is in them. The long paragraphs about
internal rules are gone from the page too, and the few notes worth having are one click away in
the "?" dialog, above the picture rather than under it.

**There is no master switch.** A reader who wants Paper, Arena and Magic Online has all
three on by default, so a switch over them had no use except as a shortcut that loses
per-platform settings when pressed. The earlier one was exactly that, and it could be
drawn in a state the model could not explain — a master off with a rule on.

- **Platforms** — one table: a row per platform and a column per place, 40px a row with no
  padding above or below it. Every control in it is an 18×18 checkbox rather than a slider,
  including the **Show** column, because a column of pills beside a row of boxes is two kinds of
  control wearing the same page's colours. An unticked box is empty with a thin border and a
  ticked one is filled purple with a white tick; nothing in the section keeps the switch's
  rounded knob, which is drawn as a gradient in `background-image` and has to be cleared in
  every state rather than only recoloured. The platform's name is written once, down the left,
  on the same edge as the heading over it, and each box is named by what it does — "Paper: show
  in search" — rather than by its column alone, which is what a table of twelve anonymous
  checkboxes otherwise gets.

  **The three places are per platform, and that is the one choice worth arguing for.** For two
  releases they were one shared list, on the reasoning that "where should filtering apply" is
  one question with one answer. It is not, because the platforms are not interchangeable: a
  reader who wants Arena out of the search dropdown and Arena printings left in the card page's
  table is answering two questions, and one list cannot hold two answers. With it, switching
  Arena off for the dropdown also switched it off for the table, or switching it off for
  neither.

  Turning a platform off keeps its three places: the switch writes `show` and the places write
  their own keys, and neither can rewrite the other. Its three place boxes are drawn empty,
  muted and disabled while its own box stays operable — it is the only way back, and a disabled
  control that is the only way out of a state is a trap. The row as a whole is **not** faded:
  the name and the platform's own box are what the reader uses to read the row and turn it back
  on, so only the name goes a shade quieter and only the three places go quiet at all, keeping a
  border a reader can still see. Nothing reaches the stored value: what is drawn while a
  platform is off is what is in force, not what is stored, and the three places come back with
  it.

  **All three off is a choice, and the page acts on it.** There is no master above them to put
  them back, so unchecking the last one leaves the index empty rather than restoring them —
  which is what the settings page stores and what the Scryfall pages then show. A platform with
  all three places off is the same, and is a state one shared list could not hold. The page does
  not tidy it up: nothing puts a place back and nothing moves the platform's own box on the
  reader's behalf.

  A printing can be on several platforms, so this is asked **per printing** rather than per
  set. Scryfall records `games` on every printing and never omits it, and a paper printing
  carries "paper" in it — Vintage Masters has 171 printings marked Magic Online and four
  marked for Arena as well. Answering at the set level meant turning Arena off took the paper
  printing of a set that was on both.

  Scryfall names four clients and this extension offers three: `astral` and `sega` are the two
  Astral and Sega Dreamcast releases, and a reader keeping Paper and Magic Online has kept
  nothing those are on, so they go with the rest.


- **Prices and links** — **USD, TIX**, then **TCGplayer, Cardhoarder, Cardmarket**, as two groups
  rather than five switches. A currency is a column of numbers and a shop is a link, and the grouping
  says so without a paragraph saying so. Each caption sits directly above the boxes it names, because
  beside them it needs a column as wide as the longest caption and that column is empty on every
  other row. They say what every other control in the section says: on is on. Four of them were
  the last negative keys in the model, and the group above them needed a legend reading "which
  prices to hide" to make four unticked boxes mean "everything is shown" rather than the opposite;
  Cardmarket was added later and has only ever meant "show". The inversion is in the migration, and
  both directions have a mutation against them because reading it the wrong way round hides every
  price a reader had switched on, on their first page load after an update, while the boxes on the
  settings page show them all off. See the price filter above. They are in this section because
  they are settings about what is shown, not because they have anything to do with sets.

  **And one switch over the block they sit in.** Scryfall draws one column headed "Buy This Card",
  holding the three links; emptying it shop by shop leaves the heading and the column behind, which
  is not what a reader who buys nowhere is asking for. That switch is not a fourth shop: it sits at
  the top of the shop group, above the boxes it governs, it turns no shop off on its own, and the
  per-shop choices are still there when it comes back on. With it off the shop boxes are drawn empty
  and disabled, because a link inside a hidden block has nowhere to be shown — and CardTrader is
  drawn with them, since its switch is what puts CardTrader links in that block. It is also not a
  price kind, so `priceFilter`'s gate — which is "something is hidden", computed by walking the price
  keys — has to name it, or the switch saves and does nothing.

  **Cardmarket is a shop here and nothing more.** Scryfall's native euro column *is* Cardmarket's
  price, and it is tempting to make one button hide both — but the column and the links are two
  questions, and answering one question in two places is the shape this file has been rewritten to
  get out of three times. So the shop box hides the cardmarket.com link and the EUR source hides the
  column, including with a "show nothing" of its own. The old "only Cardmarket" switch walked the
  model's price keys to turn them all off, which would have hidden the very shop it is named after;
  it names the four kinds it governed instead.

  **The EUR source sits with the prices it chooses between**, under the shops, and so does
  CardTrader: it fills that column and adds a link to that block. It says whose number the euro
  column carries, and it was in the other section with the card-page features — a price setting in a
  list of things that are not prices. Its own **EUR** box is in the price group above it, and the two
  are kept in step: unticking the box blocks the dropdown and sets it to **show nothing**, and
  choosing **show nothing** clears the box. The dropdown carries its own "?", because choosing
  CardTrader there needs a token that is set up in the CardTrader row and ticking
  **Предложения CardTrader** is not required for it — the switch is about the buy-block links and the
  column works without them.

- **The Caster marker** — its own line in the left column, under the platforms table, with no
  heading of its own: a heading over a single box is a level of structure that holds nothing. It is
  not a price and not a platform, so the right column — a list of things about money — is the wrong
  place for it, and it was there for one release, indented under the store links, where it read as
  though it belonged to that group.

  **The Caster marker was dead, and it was dead because its key was renamed rather than
  inverted.** The settings page wrote `setFilters.caster` while `theme.js` read a flat
  `hideCasterIndicator` that nothing had written since the settings were folded into
  `setFilters` — so the switch changed a value nobody read and the marker never went away. Both
  tests of it passed: one asked the theme script to read the flat key, which proved the read, and
  one ticked the box, which proved the write, and neither asked whether they were the same key.
  They are now checked as a pair — one writer, one reader, and the flat key named by neither.

  Its switch read **hide** and now reads **show**, so the stored key is `showCaster` and the
  class on the page is its opposite. **A stored boolean cannot carry two senses**, so a value
  written by a build that stored "hide" and one written by a build that stores "show" are told
  apart by the name of the key rather than by a version number nobody writes. Prices had the same
  problem and were inverted in 1.6.1, before this shape existed; the marker is inverted by the
  rename, and a value from 1.6.0–1.6.2 gets its own branch whose only work is to rename one key
  and leave its prices alone. Getting that wrong flips the marker for every reader on the first
  page load after an update, and both directions have a mutation against them.

The **set index is cached for one day**.

## Additional info: a list of features, not a form

The section is a list of one-line features. Each row is a switch and the feature's name, and the
settings a feature has beyond its switch are behind its own **Настроить** — collapsed when the page
opens, whatever the feature is set to. Opening one writes nothing: the numbers inside were saved
when they were last edited, and they work while the panel is shut. That is the whole of "the button
is optional", and it is why there is exactly one level of disclosure here: no panel holds another,
none holds a menu, and nothing has to be visited.

The section used to be two fieldsets standing open with every threshold, select and token field in
them. That reads as a form to fill in, and every one of these settings works untouched — a reader
who has never opened the section gets the finish column and the type search.

- **Доступная отделка изданий**, **Клик по типу и мана-стоимости для поиска** — a switch and
  nothing else. Both names were rewritten because the old ones named the control rather than what
  it does: the first shows the finishes a printing is available in, and the second makes the type
  line and mana cost on a card page clickable, each opening a search. The finish column carries a
  "?" as well, because even a better name was not enough.
- **Популярность в Commander** — the display format, the colouring metric, both pairs of thresholds
  with their units, and **Вернуть стандартные настройки**.
- **Salt Meter** — the «/4» scale, its two thresholds, its own reset.

**CardTrader is not in this list.** It adds a euro column to the prints table and a link to the
store block, so it lives in Visibility with the prices it fills, next to the EUR source that chooses
whose number goes in that column. It was here because this section used to hold every switch that
was not about sets.

**Two features were cut in 1.7.6, and their rows and settings went with them.** *Historical card
names* was a line under the prints table showing what Scryfall previewed a card as before it was
renamed — a switch nobody could say the purpose of, carrying a third-party data file. *Show the
EDHREC icon and link* was the last setting in the **Дополнительные настройки** panel, and with it
gone the panel held nothing, so the button went too: a button over an empty panel is a promise this
build cannot keep.

**A reset is its own feature's numbers.** Each restores from the same `defaults` object a fresh
install is filled from, so the two cannot drift, and neither touches the switch: "these numbers are
wrong" is not "turn this off". The popularity reset does not reach into the Salt settings and the
Salt reset does not reach into the popularity ones.

**CardTrader asks for what it needs first.** Without a token there is nothing for it to fetch, so
the row is the name, **Не подключено** and **Подключить** — and the switch is *hidden* rather than
disabled, because a disabled switch says "this exists and you may not have it" and this one does not
exist yet. With a token the switch appears, the state reads **Токен сохранён ✓**, and the button
becomes **Настроить**, opening **Заменить токен** and **Удалить токен**. The new-token field
appears only when replacing; closing the panel with it open does not delete anything, and an empty
field saved does not either. The stored token is never on screen — the field is emptied the moment
it is stored. The switch is also drawn empty and disabled while the **Buy This Card** block is
hidden, because what it adds is a link in that block; the token stays reachable, because the EUR
source needs it too.

The status says **saved**, not **working**. Nothing on the settings page asks CardTrader anything,
so what is stored is all it can honestly report; whether the token works is answered on a card page,
by the request that uses it. The project has no connection check to borrow, and none was invented.

**The paragraphs moved behind a "?" rather than being deleted.** The examples of historical names,
the explanation of the thresholds and the colours, and what the token is for are one click away in
the same dialog the section "?" opens — which is a button, so it is reachable by Tab and opened by
Enter, unlike a `title` tooltip.

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

**What this rule is checked against.** The platform rule is verified on the Sets index, in a
real browser: with all three platforms kept, every row is on the page; keeping Paper alone, every
digital set goes and nothing else does, and Scryfall's own counter is rewritten to match. The
places are checked there too, which is the check one shared list of places could not have: Arena
out of the sets index while it stays in the table and the search field, and the index hiding
exactly the digital sets no kept client carries.

They are not verified on the Prints table, and the reason is worth knowing before reading that as
a gap in the feature. That table shows a window of ten sets around the printing being viewed, so
the sets a platform rule would remove sit outside it for most cards, and the window widens only
when "View all prints" is pressed — which no automated check can do to a page whose features have
already run. So the Prints table's own behaviour is checked in the extension's unit tests, where
the fixture supplies the API's answer directly. Those tests count the rows the table *builds*,
rather than the group headers: a header can also be built from Scryfall's own rows, including the
row for the printing being viewed, which is deliberately never hidden. So a group header is not
a thing this rule controls and the built rows are.

**Why there are no set names in this group any more.** Nothing on Scryfall says a set has a black
border: a set object carries `code`, `name`, `set_type`, `digital`, `card_count`, `released_at` and
fifteen more, and nothing about borders. Every rule that used to be decided by reading a name was
a list of exceptions that grew — and where one was checked against the API instead of against a
copy of itself, what it found was that the name was not the interesting part. All eleven of the
official proxy codes a non-tournament rule used to spell out are `memorabilia` sets, which
`set_type` already answers. What is left is one rule, and it is not a name.

**The measurements that decided the removed rules.** They are kept here because they are the
reason the rules are not coming back, and because a reader who had them on will notice their
absence.

- **34 sets have no English printing at all**, three of them the black-border releases. The
  rest are foreign-only products — 21 promo sets, five sets of Japanese promo tokens, three box
  sets (Salvat 2005 and 2011, Sega Dreamcast Cards) and two master sets, the French `ren` and
  the Italian `rin` of Renaissance. This used to ship as a dated list and a switch of its own.
- **Scryfall names four clients and this extension offers three.** `astral` and `sega` are the
  two Astral and Sega Dreamcast releases; a reader keeping Paper and Magic Online has kept
  nothing those are on.
- **Oversized is not a property of a set.** It is a flag on the printing, and those printings
  sit inside ordinary sets: a Planechase plane, a Magic Online promo, a Commander release, a
  promo from 2009. A name rule measured against Scryfall on 2026-10-02 found 14 of the 38 sets
  that hold one, and nothing that was not one — too narrow rather than wrong, which is the worst
  shape of bug to have: the setting looked like it worked and the other twenty-four stayed
  visible with nothing to say why. Getting the right answer cost five pages of `is:oversized`
  every time the index was rebuilt, which is what the extension was doing daily for a list
  nobody asked for.
- **Three ways of asking Scryfall about the absence of English all fail.** `lang:!en` is not a
  negation and returns all 397 printings of `m21`; `-lang:en` is not one either and returns
  3,411 against 397; and `NOT lang:en` is honoured and wrong, refused for `m21` correctly and
  for `cmd` and `tsp` incorrectly.

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
- The CardTrader and Cardmarket icons are third-party marks. Their provenance is not settled.
  `THIRD_PARTY_NOTICES.md` records exactly what is unconfirmed and what has to be established
  before wider distribution. EDHREC's logo was here too, and is not any more: it went with the
  icon-and-link control it was shown on.