# Changelog

An index of what each release was about. The detail lives in the release notes for that
version, and is not repeated here — a copy of them would drift, and this file's only job
is to answer "what changed and where do I read about it".

All releases: <https://github.com/Solomag/scryfall-toolkit/releases>

---

### The release-blocking defects from the pre-release review

A pre-release review of the tree found ten defects. All ten are fixed here. What follows is each,
and what it was.

**A 429 repeated at once.** After Scryfall answered 429, the worker set the thirty-second hold on
every queue and then fetched the same URL again immediately, bypassing the wait — the comment and
the documentation promised a pause the code did not take on the one request that needed it most.
The retry now goes through the same wait as every other call, and it is limited to one.

**Turning a feature off asked for its host.** `optionalHostsFor` returned a feature's hosts
whatever the switch said, so unticking EDHREC or CardTrader asked for the access, and refusing put
the switch back on: the feature could not be turned off. Turning a feature off now asks for
nothing and saves the off.

**A feature that was off kept acting.** The bridge reported `off: true` while the wrapped clean up
button and the two toolbar buttons were still there — the settings page and the diagnostics read
"off" while the editor kept changing the deck. Each module has a `disable()` now, and the bridge
calls it when the feature is off; the wrapped button and the handlers read the current settings
rather than the ones they were installed with, so a changed sort takes effect too.

**Two different decks coalesced into one EDHREC request.** The in-flight key was the commanders and
the *number* of cards, so two decks of the same size led by the same commander were one request and
the second reader got the first deck's suggestions. The key carries the whole payload now.

**The EUR box and its source disagreed on load, and a refused source rolled back to the wrong
value.** A profile from before the EUR box carried "show nothing" with no EUR key of its own, and
the model filled that key with its default (on); the source wins now and the pair is written back
in step. And a refused permission rolls the dropdown back to the last value stored, not to whatever
the page opened with.

**A new CardTrader token redrew the switch against a stored off.** The reader's answer outlived the
token's removal, so reconnecting turned the box back on. It goes with the token now.

**The popup invented its own defaults.** It read every missing key as `null`, and `Boolean(null)`
is false, so on a fresh profile it showed Tags and CardClip off while both are on everywhere else.
It reads the same defaults as the full page, and an old boolean theme as the full page reads it.

**The theme read the Caster marker off the raw key.** A stored `caster: true`, which meant hide,
was read as `showCaster: undefined` and shown. The theme goes through the model now, which knows
every old shape.

**The page bridge forwarded any request name.** The check that a message came "from this window"
cannot tell our page-world module from any other script on the page, and the payload's spread came
after `type`, so it could replace it. The bridge forwards only the requests the deck modules make,
and sets `type` last. The token-bearing `cardtrader` request is not among them.

**And the release documents said two things that were not true.** The store listing carried a
"Version to submit: 1.2.0" line that the version tool did not update; it carries no number of its
own now, and says why. And the third-party notices said the extension "asks for no token, stores
none, and sends none" while describing the user's own token — it now says plainly that it has no
token of its own, stores the user's, and sends it only to CardTrader's API.

**Checks:** `npm test` 2384 assertions across nine suites, `npm run render` 176 + 202,
`npm run mutations` 59 of 59. Eight are new: the off-switch asking for its host, a feature left
acting after it was turned off, two decks coalescing, the EUR pair on load, CardTrader's answer
outliving its token, the popup's defaults, the theme's raw marker read, and the bridge forwarding
any name.

### The permission chip reaches every feature, and the documents caught up

**Every feature that takes an optional host now asks for it on its own row.** The inline
**Предоставить** chip was on EDHREC suggestions alone; Commander popularity, Salt Meter and
CardTrader prices still fell back to a status line at the bottom of the page and a "turn the
feature off and on again" when a host went missing. Each of those rows carries a chip now, and its
button asks for that feature's hosts and no others. The status line still names what is missing,
but it is no longer the only way to act on it.

**Diagnostics got more precise.** A report where the page-world adapter never loaded is a fault on
any page — the deck scripts failing is not the same thing as a page without a deckbuilder — so it
is an error and its reason is shown even on a card page, while the expected non-attachment stays
hidden. And the module list is headed **Modules** rather than **Wired**: the flags say a module is
set up, and on a page that is not an editor that means armed and waiting, not attached.

**The documents caught up with the last two releases.** The release checklist still said "all four
modules" and "all printings, grouped by set … the full-page link", and quoted an assertion count
several releases old. The FAQ still answered about a "Hide non-tournament sets" switch that went
with the set rules. The features list still counted card input editing among the integrated
modules, and called the CardTrader and Cardmarket marks' provenance "not settled" after both were
settled. And 52 translation keys for removed features — the grouped table, the site-language
selector, the old deck and legality labels — were deleted from the dictionary. One language
setting covers the whole extension now, and the documents say so.

**Checks:** `npm test` 2350 assertions across nine suites, `npm run render` 176 + 202,
`npm run mutations` 51 of 51. Three are new: the chip list losing a feature, an adapter that never
loaded read as "no editor page open", and the expected non-attachment shown as a fault.

### Diagnostics stops arguing with itself, and CardTrader answered

**Diagnostics no longer lists the expected non-attachment as a fault.** A report from a page that
is not a deck editor said, correctly, "No suitable editor page is open. That is not an error" — and
then, under **What is wrong**, printed the adapter's own words: *Scryfall.deckbuilder is not
available*, *Scryfall.deckbuilder.cleanUp is not available*. Those lines are the module reporting
the page, not a fault: the module cannot attach where there is no deckbuilder, which is every
Scryfall page but the editor. They are shown only on an editor page now, where the same lines mean
something. The report still names the page it came from, so a card-page report is still
distinguishable from a deck-page one.

**And the MoxTags line is gone from the settings page.** The hint under the sections read "Reload
open Scryfall and Tagger tabs after changing settings. MoxTags continues to run separately on
Moxfield." The second sentence is removed. MoxTags is still credited where its data is used, in
the credits block and the third-party notices; it is not a note the settings page has to carry.

**CardTrader answered about their API, and the notices say so.** Asked whether their API may be
used by a project like this one, their support replied that it is public and can also be used for
commercial projects, with limits on the number of calls and a 24-hour cache on some responses.
`THIRD_PARTY_NOTICES.md` records the reply and their documentation link; the CardTrader **mark** is
a separate question, and the notice still says plainly that no permission for it was sought or
granted. The API is still account-bound — every call carries the user's own token — so nothing is
fetched without the user's credential either way.

**And the notices stop speaking about EDHREC's icon.** The EDHREC logo went with the icon-and-link
control in 1.7.6, but the notices still described it as bundled — section 7 said "nothing from
EDHREC is bundled except the logo file listed below", where there is no file below and no file in
the build. Section 8 compared CardTrader's mark to EDHREC's "same basis" as if both shipped, and the
roadmap still listed "the EDHREC and CardTrader marks" as shipped together. EDHREC's mark is not a
permission question any more: nothing of theirs is bundled, and the only thing of EDHREC's in the
build is the data the feature asks for at run time. The notices and the roadmap say so now.

**Checks:** `npm test` 2333 assertions across nine suites, `npm run render` 176 + 202,
`npm run mutations` 49 of 49. One is new: the expected non-attachment shown as a fault on a card
page.

### The experimental card is gone, and the interface language is one setting now

**The whole "Prints table / Experimental" card was removed.** It held a grouped table that
collected every printing of a card and split it by set, with folding groups and a full-page link,
a switch for opening that link in the same tab, and a second language selector for the controls
the extension adds to Scryfall and Tagger. All of it is gone from the extension, not merely hidden
from the settings page: the grouped table and its three settings, the same-tab switch, and the
site-language selector. The prints table is Scryfall's own again, and the **Prints table** place
in Visibility still hides the rows of a platform the reader took out of it — that filter was never
part of the grouped table, it marks Scryfall's own rows, and it is unchanged.

**One language setting for the whole extension.** The removed selector was a second answer to a
question the General section already asked. The controls the extension adds to Scryfall and Tagger
now follow the **Settings language** choice — `Auto` resolves from the browser, so a Russian
browser gets the Russian interface and a pinned English gets English everywhere. The theme script
loads the language helper before it now, so the same resolution runs on the site and on the
settings page.

**Checks:** `npm test` 2332 assertions across nine suites, `npm run render` 176 + 202,
`npm run mutations` 48 of 48. The render suite lost the grouped-table check with the feature it
photographed; the prints-table platform filter is checked on the native rows instead.

### The deck tools are a list now, and the diagnostics moved out of the way

**The Scryfall Deckbuilder section is a list of one-line features.** Each row is a switch and a
name — No Prices, the token list, stacked cards, the Commander check, EDHREC suggestions, deck
search, improved cleanup — and what a feature does is behind its own "?". The paragraphs that used
to stand between the rows are in those dialogs now, the boxes are the same square 18px ones the
other rebuilt sections use rather than the page-wide sliders, and the two fieldsets are gone. The
cleanup feature's settings are behind its row's **Настроить**, collapsed when the page opens:
opening it changes nothing, closing it resets nothing, and neither direction touches the switch.

**The Commander check says it checks cards, not the deck.** It was called "check the deck for
Commander legality" while it asks Scryfall about each card in turn, which is a promise it cannot
keep. It reads **Проверять допустимость карт в Commander** / **Check individual cards for
Commander legality** now, its help states plainly what it does not check — the deck's colour
identity, its size, and the limits on the number of copies — and the deck page's button and
dialog title were brought into line. No new check was added.

**The deck modules' report moved into a collapsed Diagnostics section at the bottom.** It used to
be a fieldset in the middle of the deck section, mixed in with the settings; it is a place to read,
not a step, so it starts closed and opening it changes no setting and asks for no permission. It
names the state: no suitable editor page open, nothing checked yet, a module that works, or a real
error on an editor page. A report from a card page is named as "no editor page open" and never as
a failure, because the modules are not meant to run there; a report always names the page it came
from, because it is always about a page visited before this one. The page path, the object names
and the adapter's own words live in here now, out of the feature descriptions.

**EDHREC suggestions ask for their access from their own row.** The "Grant host access" button is
gone. A chip appears beside the feature only while it is on without the access it needs —
**Требуется разрешение** when none of it is there, **Ограниченный режим** when only part of it is,
since the commander page still loads while the deck-specific advice does not. The button in the
chip asks only for this feature's hosts, and only from a click; the page never asks on its own, and
opening a help dialog asks for nothing. Once the access is there, the chip and the warning are
gone.

**Checks:** `npm test` 2529 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 48 of 48. Six are new: a report from a card page read as an error, the
permission chip asking for every host, the chip never hidden, diagnostics starting open, its
button not saying which way it goes, and a disclosure that writes to storage.

### The euro column gets a box, the block switch moves up, and two names say what they do

**The EUR column is a switch in the price group now, not only a dropdown.** The dropdown beside the
shops chose whose number filled the euro column and could already say "show nothing", but the answer
to "is there a column at all" lived in a control that read as a choice between shops. There is an
**EUR** box with the USD and TIX ones now, and the two controls are kept in step so they cannot
disagree: unticking **EUR** sets the dropdown to **show nothing** and blocks it, and choosing
**show nothing** clears the box. A blocked field is covered by a transparent button rather than being
`disabled`, because a disabled select swallows the click and leaves a reader with a dead control and
no reason for it; reaching for it flashes the box that has to change first and says why. The card
page reads both answers, so a value written by hand cannot put the column back against the reader.

**The "Buy This Card" switch sits above the shops it governs.** A master below the things it masters
reads as a summary of them rather than as a switch over them, and that is how the block switch read
when it sat under the three shop boxes.

**The Caster marker moved to the left column.** It is a marker on the card page, not a price, and the
right column is a list of things about money. It sits under the platforms table now, where the left
column has the room.

**And two feature names say what the feature does.** "Столбец отделки изданий" named a column; the
row shows the finishes a printing is available in, so it reads **Доступная отделка изданий**.
"Поиск по типу и мана-стоимости" named a search; the feature makes the type line and mana cost on a
card page clickable, so it reads **Клик по типу и мана-стоимости для поиска**.

**Checks:** `npm test` 2439 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 43 of 43. Three are new: the EUR source set to "show nothing" while the box stays
ticked, the blocked field left uncovered, and the euro column ignoring the EUR box on the card page.

### Two features cut, a "show nothing" for the euro column, and a disabled box you can see

**The disabled boxes were too quiet to read.** A box that is merely unticked wears `#6a6070` on the
card's own colour and one that is out of reach wore `#5b5462` on `#292830` — two shades apart, which
is a difference a reader has to compare two screenshots to find. It is `#3b3642` on `#232229` now,
and the words beside it go quiet with it: the page's own rule for a label around a disabled switch
was being overridden for the whole section, and it is overridden only in the platforms table now,
where the name is what the reader uses to turn the row back on.

**The euro column has a "show nothing".** The EUR source dropdown chose whose number fills the
column and could not say "no column at all"; the only way to be rid of it was to hide Cardmarket,
which is a shop and not the same question. It is a fourth option now — Cardmarket, CardTrader,
both, or nothing — and it is the *only* control for that column, because answering one question in
two places is the shape this project has spent three releases getting out of. Hiding Cardmarket is
what it sounds like: its links. The advanced search follows the source rather than a shop, so
picking "nothing" drops the euro option there too.

**Two features are gone.**

- **Historical card names** — the line under the prints table showing what Scryfall previewed a card
  as before it was renamed. A switch whose purpose nobody could state, carrying a 396-record data
  file from somebody else for it. The file, its manifest entry, the feature, the row and the help
  all go; Shambleshark stays credited for the deck clean-up module, which is still here.
- **Show the EDHREC icon and link** — the last setting in the **Дополнительные настройки** panel.
  With it gone the panel held nothing, so the button went too: a button over an empty panel is a
  promise this build cannot keep. EDHREC's logo is out of the build with it, and the notices say so
  rather than naming a file that is no longer shipped.

**And the finish column says what it is.** Its row read "Колонка обработки карты", which is not
what the feature does — it shows a printing's finish — so it reads **Столбец отделки изданий** and
carries a "?" explaining the column, because a name alone was clearly not enough.

**Checks:** `npm test` 2423 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 40 of 40. Two are new: the EUR source's "show nothing" leaving the column on
the page, and the disabled boxes drifting back to a grey nobody notices.

### The block switch reaches the shops, and CardTrader is one of them

**Hiding the "Buy This Card" block now takes the shop boxes out of reach.** A shop is a link inside
that block, so with the block hidden there is nowhere for it to be shown and its box has nothing to
say. The three shops are drawn empty and disabled while the block is off — the platform pattern, and
for the same reason: the boxes are drawn from the reader's per-shop choices and do not write to
them, so turning the block off and on again brings the shops back as they were rather than resetting
them.

**CardTrader is the fourth link in that block, and it is treated like one.** Its switch adds
CardTrader links to the store block — the euro *column* is the EUR source's business, not this
switch's — so with the block hidden its box is emptied and disabled too, while the token state and
the **Настроить** button stay reachable: the token is still needed for the EUR source. The reader's
own answer for it is kept in a variable rather than read back from the box, because the box is
emptied while the block is hidden and an emptied box is not an answer.

It also moved up, to sit with the stores it belongs to, above the EUR source rather than below it.

**And the EUR source says what it needs.** Choosing CardTrader as the source needs the token, which
is not obvious from a dropdown of three names, so it carries its own "?" — and that help says the
thing the reader would otherwise have to guess: ticking **Предложения CardTrader** is not required
for it, because that switch is about the buy-block links and the column works without them.

**Checks:** `npm test` 2443 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 39 of 39. Three are new: the shop boxes staying in reach, the block switch
writing the shops off instead of drawing them off, and CardTrader staying in reach with the block
hidden.

### CardTrader goes where the prices are, and the whole "Buy This Card" block has a switch

**CardTrader's offers moved to Visibility.** They add a euro column to the prints table and a link
to the store block, which makes them a price feature, and they were in Additional info only because
that section used to hold every switch that was not about sets. With them goes the last of the
price settings: the EUR source moved there in the round before, and now the row that fills it sits
under it. Additional info is five features, its own secondary button, and nothing about money.

**And the block itself has a switch.** Scryfall's card page has one `#stores` column headed "Buy
This Card", holding the three shop links; the per-shop switches empty it and leave the heading and
the column behind, which is not what a reader who buys nowhere wants. `showStores` hides the
container, heading and all, and it is a general switch rather than a fourth shop: it sits under the
group it governs, it turns no shop off on its own, and the per-shop choices are still there when it
is switched back on.

It is not a price kind, so it cannot be found by walking `prices` — and `priceFilter` is gated on
"something is hidden", which is computed from exactly that walk. Left out of the gate, a reader who
hid the block and nothing else would have got a switch that saves and does nothing. That is the
same shape of bug as the TCGplayer one, one function away, and it has a mutation of its own.

**Checks:** `npm test` 2434 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 36 of 36. Three are new: the block never hidden, the block's switch never
booting the feature that hides it, and the model not reading the key back.

### The shop links were never hidden, and Cardmarket has a switch

**A reader reported that the TCGplayer switch does nothing, and it did nothing.** `initPriceFilter`
keeps a map of shop hostnames to the model's key for each — `{ tcgplayer: 'tcg', … }` — and the
filter read the *key* of that map as if it were the model's key. So it asked for
`prices.tcgplayer`, the model stores `tcg`, the answer was `undefined`, and the TCGplayer links
were never hidden. Cardhoarder's worked, because its hostname and its key are the same word.

**Nothing caught it because nothing tested it.** The card-page fixture's store list was empty and
no test had ever looked at `stk-price-hidden` — not for the links and not for the columns either.
There is a test now: it names what is hidden rather than counting it, and it covers each shop and
each currency on its own, because a test of one shop would have passed on the one that happened to
work.

**Cardmarket is a shop, and it is the shop that also owns a column.** Scryfall's native euro column
*is* Cardmarket's price, so "hide Cardmarket" has to mean two things — the column and the
cardmarket.com link — to be one button rather than two. Its switch therefore sits with the other
shops, and it is the one kind that appears in both halves of the filter: the EUR header is matched
to it, and so is the hostname. It was briefly `eur`, in the currencies, in a build that was never
released; a value from that build is read under the new name rather than dropped, and the new key
wins if both are present.

**The EUR source moved to the prices it chooses between.** It says which shop's euro price the
column carries, and it was in the other section with the card-page features — a price setting in a
list of things that are not prices. It sits under the shops now. The advanced search filter also
maps Scryfall's option values (`eur`) to the model's keys (`cardmarket`) instead of assuming they
are the same word, which is the same mismatch as the one above, in a second file.

**Checks:** `npm test` 2416 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 33 of 33. Four are new and three of them are this defect: the shop map read by
its key, the euro column losing its switch, and the advanced filter assuming the option value is
the model key. The fourth is the old `eur` key being dropped rather than read.

### The euro column has a switch, and Additional info is a list of features

**The euro column was the one price with no switch at all.** USD, TIX, TCGplayer and Cardhoarder
each had one; the EUR column — Cardmarket's price, the one Scryfall draws natively — could only be
got rid of by pointing the euro source at CardTrader, which is not the same thing and is not what
a reader who simply does not trade in euros is asking for. It is a fifth price kind now, in the
same group as USD and TIX, because it is a currency and not a shop: it is a column of numbers in
the same table, and the key is `eur` rather than `cardmarket` because the column is what is hidden
and Cardmarket is whose price it is.

Two things had to change with it, and one of them was a defect the change exposed:

- The advanced search filter dropped USD and TIX options when their columns were hidden and
  *renamed* the euro one rather than dropping it, on the reasoning that Cardmarket is the one price
  this extension has a reason to add. It drops it now like the others, and the guard that decided
  whether to touch the select at all counts three currencies instead of two.
- The CardTrader column and the native euro column are the same column, and the euro source
  setting decides whose number goes in it. The new switch decides whether the column exists, so it
  wins: with EUR hidden, `both` does not relabel the column as Cardmarket's and the fallback that
  un-hides it when a CardTrader printing has no offer does not run.
- **The old "only Cardmarket" switch walked the model's price keys to turn them all off.** With a
  euro key in the model that would have hidden the very price the switch is named after — a reader
  who had it on would have lost the euro column on their first page load after an update, silently.
  It names the four kinds it governed instead. That is a real defect this round introduced and
  caught, not a hypothetical one.

The Caster marker also moved: it is its own line under the prices now rather than indented under
the store links, which read as though it belonged to that group.

**Additional info was two fieldsets standing open with every threshold, select and token field in
them.** That says "fill this in" about seven settings, every one of which works untouched. It is a
list of one-line features now, each with its own switch, and the settings behind the feature's own
button:

- **Колонка обработки карты**, **Поиск по типу и мана-стоимости** — a switch and nothing else.
- **Исторические названия карт** — a switch and the one help button the list carries, which is
  where the examples went.
- **Популярность в Commander** — a switch and **Настроить**, opening the display format, the
  colouring metric, both pairs of thresholds with their units, and **Вернуть стандартные
  настройки**.
- **Salt Meter** — the same shape: the «/4» scale, its two thresholds, its own reset.
- **Предложения CardTrader** — see below.
- **Дополнительные настройки** — one secondary button at the bottom for the two settings that
  belong to the section rather than to a row: the EDHREC icon and link, and the EUR price sources.

Every panel is collapsed when the page opens, whatever the feature is set to. Opening one writes
nothing: the settings inside were saved when they were last edited and they work while the panel is
shut, which is the whole of "the button is optional". One level of disclosure, no nested menus, no
dialog and nothing that has to be visited. Each reset restores its own feature's numbers from the
same `defaults` object a fresh install is filled from, and does not move the switch — "these numbers
are wrong" is not "turn this off".

**CardTrader is the one row whose shape depends on what it has.** Without a token there is nothing
for it to fetch, so the row is the feature's name, **Не подключено** and **Подключить** — with the
switch hidden rather than disabled, because a disabled switch says "this exists and you may not have
it" and this one does not exist yet. With a token the switch appears, the state reads **Токен
сохранён ✓**, and the button becomes **Настроить**, opening **Заменить токен** and **Удалить
токен**. The new-token field appears only when replacing, closing the panel with it open does not
delete anything, an empty field saved does not either, and the stored token is never on screen —
the field is emptied the moment it is stored, and it is a password field even then.

The status says **saved**, not **working**, and that is the honest reading: nothing on this page
asks CardTrader anything, so the only thing it can report is what is stored. The project has no
connection check to borrow — the only request that would answer the question is the one a card page
makes — so none was invented.

**The paragraphs moved behind a "?" rather than being deleted.** The examples of historical names,
the explanation of the thresholds and the colours, and what the token is for are one click away in
the same dialog the section "?" opens, which is a `<button>` and so reachable by Tab and opened by
Enter. The dialog now takes an entry with no picture, because what moved there is a paragraph.

**Checks:** `npm test` 2402 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 29 of 29. Nine of the new mutations are about this shape's own failures:
a panel that starts open, a disclosure that writes to storage, a reset that takes the other
feature's numbers, a feature offering its switch before it has what it needs, the euro column
losing its switch or its migration hiding it, and a label restating a layout the page already
gives it.

### The visibility section is two columns, and the boxes are boxes

This is the second half of the entry below and it supersedes its layout: the section is not
three stacks under three headings, it is two columns under two, and the boxes are 18×18 squares
rather than compact pills.

**Two columns.** The table on the left, the prices and the marker on the right, the left one a
little wider than the right, 32px between them. The card is 880px wide and the settings are four
short lines, so one column left two thirds of the card empty and made the reader scroll past
nothing. Below 720px the right column goes under the left rather than either being squeezed.

**Compact, and not stretched.** A table row is 40px with no padding of its own above or below it,
and the name column is left-aligned in its heading as well as in its rows, so the word sits over
the names it names. The table is not given `max-width:100%`: clamping it to its column squeezes
the columns below their min-content width and the headings are then clipped mid-word — "Список
сетов" reading as "Списо / сето". Left at its natural width it overflows its wrapper instead, and
the wrapper scrolls, so nothing is ever cut off. On a narrow window the column padding comes in,
the heading type drops a point and the platform name is allowed to wrap, which is what keeps it
from having to scroll at 420px.

**A platform that is off is not a faded row.** Its name goes a shade quieter and its three place
boxes are drawn empty, muted and disabled, keeping a border a reader can still see; its own box
and its name stay at full contrast, because they are what the reader uses to turn it back on. The
page-wide rule that dims a label around a disabled switch is undone here, where it would take
those three boxes down to a third of the contrast they were just given.

**The boxes are boxes.** 18×18, 4px corners, empty with a thin border when unticked, filled
purple with a white tick when ticked. The page's own switch draws its knob as a **radial gradient
in `background-image`** and rounds itself with a 12px radius, and a rule that sets only a new
`background-color` leaves both of them standing: an unticked box comes out as a grey circle inside
a square. Both are reset, in the base rule and again in `:checked`, so no state can inherit the
knob.

**Prices.** Two groups, each caption directly above the boxes it names, 8px to them and 16px
between the groups. The caption used to sit beside them in a grid column as wide as the longest
caption on the page — a column of empty space on every row but one.

**Two defects found by looking at the page, not by the tests:**

- Every box here transitions its background over 150ms, and a capture taken on the next round
  trip catches twelve of them **mid-fade** — a picture of neither state, in which an unticked box
  reads as a filled square. That is what the first capture after this rework showed. It was
  measured rather than guessed: the colours were sampled out of the PNG and matched `#7b5c8c` at
  42% over the card before the cause was believed. `tools/make-store-shots.cjs` now waits half a
  second before it captures.
- The narrow-window rules for the table were written **above** the rules they override. A media
  query adds no specificity, so they lost, and the headings stayed clipped while the rule that
  was supposed to fix them sat in the file looking correct. They are at the end of the section's
  rules now, with the reason written down.

**Three things tried and rejected:**

- Keeping the caption in a column beside its boxes, with the column as wide as the longest
  caption. Rejected: that column is empty on every row but one, which is the wide grey gap
  between a label and the control it labels. The caption is above its boxes now.
- Clamping the table to its column with `max-width:100%`, so that it could never overflow.
  Rejected: it does not shrink the table, it squeezes the columns below their min-content width
  and clips the headings. Overflowing a scrolling wrapper is the lesser fault, and it is not
  visible at any width this page is read at.
- Taking the card's padding down on a narrow window to buy the table room. Rejected: the card's
  24px inset is a decision about the card, and spending it to avoid a rule about the table is
  the wrong end of the problem. The heading type drops a point at that width instead.

**Checks:** `npm test` 2302 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 22 of 22. Four of those are new and all four are about this layout: the
narrow-window rules in the wrong place, a switched-off platform's places losing their border, the
switch knob left in an unticked box, and the two columns collapsing to one.

Four of the twenty-two are caught by the settings page's own source assertions rather than by a
rendering, and that is weaker than the rest of the file and is said out loud here: nothing in this
repository renders the settings page and checks it. They still prove what they claim — each one
removes a rule the requirement names, and the assertion that fails is the one that names it — but
a rendering check of that page would be the stronger thing, and it does not exist.

### The visibility section is one table, and the Caster switch was dead

**Layout.** "Скрытие лишнего" is **"Видимость"** / "Visibility", in three parts — **Платформы**,
**Цены и ссылки**, **Интерфейс** — with headings and 24px between them instead of three framed
blocks with legends in their borders. A fieldset with a legend in its border says "a group of
related settings" by drawing a box, and three boxes inside a box says it three times; by the
third the reader is looking at frames rather than at what is in them. The decorative vertical
line beside each platform's places is gone with them.

**One table instead of three stacks.** A row per platform, a column per place, every control a
checkbox including the **Show** column: a column of sliders beside a row of boxes is two kinds
of control wearing the same page's colours, and a reader has to stop and work out which is which.
The platform's name is written once down the left, and each box is named by what it does —
"Paper: show in search" — rather than by its column alone, which is what a table of twelve
anonymous checkboxes otherwise gets you.

**A platform off.** The row dims, its three place boxes are drawn empty and disabled, and its
own box stays operable, because it is the only way back and a disabled control that is the only
way out of a state is a trap. None of that reaches the stored value: what is drawn while a
platform is off is what is in force, not what is stored. Turning it back on brings its three
places out as they were, and a reader who unticks all three on a platform that is on has said so
— nothing puts them back and nothing moves the platform's own box on their behalf.

**Prices in two rows** — **USD, TIX** then **TCGplayer, Cardhoarder** — because a currency is a
column of numbers and a shop is a link, and the grouping says so without a paragraph saying so.
The paragraph it replaced is gone, as are the other long notes: what is left is in the "?"
dialog, above the picture rather than under it, so the only explanation this section now has is
not below a screen of screenshot.

**The Caster switch was dead, and the reason is the sort that survives a green build.** The
settings page wrote `setFilters.caster`; `theme.js` read a flat `hideCasterIndicator` that nothing
had written since the settings were folded into `setFilters`. So the switch changed a value nobody
read and the marker never went away. Both tests of it passed — one asked the theme script to read
the flat key, which proved the read, and one ticked the box, which proved the write, and neither
asked whether they were the same key. They are now checked as a pair.

**Its polarity is inverted and its key is renamed.** The switch read "hide" and now reads "show",
so `caster` becomes `showCaster` and the page class is its opposite. A stored boolean cannot carry
two senses, so a value written by a build that stored "hide" and one written by a build that
stores "show" are told apart by the name of the key rather than by a version number nobody writes.
A value from 1.6.0–1.6.2 — the current layout, positive prices, the marker still meaning hide —
gets a branch of its own whose only work is to rename one key and leave everything else alone.
A reader who had the marker hidden keeps it hidden.

**Checks:** `npm test` 2283 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 18 of 18. Five mutations are new: the marker's two inversions, its polarity on
the card page, a platform that is off writing its places into storage, and those places staying
clickable while it is off.

**Two defects the rework introduced and the layout check caught**, both found by looking at the
page rather than at the tests:

- The **Show** cell was prepended to each row instead of appended after the name, so every box
  was drawn under the heading for the column to its left. Every id was right, every box behaved,
  and the table drew wrong. No assertion could see it, because they all read boxes by id; the one
  that reads the row left to right against the header can, and it is the only reading that
  describes what the page looks like.
- An unticked box came out as a **grey circle inside a square**: the page-wide switch draws its
  knob in `background-image`, and overriding only `background-color` left the gradient in place.

**Three things tried and rejected:**

- Giving the table's third column a Russian word of its own, so "Prints table" would not have to
  come from the same dictionary entry as the «Издания» heading further down the page. Rejected:
  the brief names the Russian header, and inventing a different word to protect another section's
  English is the tail wagging the dog. The collision went the other way — the section heading now
  reads "Prints table" in English too, which is what that section is about.
- Laying the price rows out as a two-column **grid**. Rejected: a grid gives every item its own
  row, so USD and TIX came out stacked on a window wide enough to hold them side by side. The
  boxes went into a container of their own, and the grid only holds the caption against them.
- Laying them out as a **flex** row. Rejected: when it wraps, the second box drops under the
  caption, so on a narrow window "Cardhoarder" appears at the left of the page with nothing beside
  it and reads as a control of its own rather than as the second shop.

### The price switches say "show", and the deck tokens moved next to the deck tools

**Prices.** "Какие цены скрывать" is now "Какие цены показывать", and the four switches are
positive: ticked means shown. They were the last four negative keys in the model, read by two
files as `some(Boolean)` and `if (prices[option.value])`, and the group above them needed a
legend saying which way round they ran to make four unticked boxes read as "everything is on"
rather than as the opposite of every other switch on the page. The inversion is in the
migration, and it is the one change in this project where reading it the wrong way round is
expensive and silent: a reader who had every price on would find every price hidden on their
first page load after an update, while the four switches on the settings page — which read the
stored value — showed them all off. Both directions have a mutation against them, and one of
those mutations had to be written against a branch by name because `String.replace` rewrites
only the first match and the bare line appears in two.

**Deck tokens.** "Show tokens created by cards in a deck" is a Deckbuilder feature and always
was. The switch adds one button to one page — Scryfall's deck page, the `/@user/decks/…` URLs,
where Scryfall lists the deck's cards — and nothing else on the site. It sat in "hide extras"
because the price switches lived there and it did not. It is now with the deck tools, where
the other three deck features already are, and the hint says which page it appears on.

**Checks:** `npm test` 2204 assertions, `npm run render` 208 + 202, `npm run mutations` 13 of 13.

### The visibility settings, reduced to one rule and nine switches

The previous three entries describe a group that had been made smaller twice and was still too
much. Paper carried five rules and three of them had lists underneath; the sub-categories crossed
the rules above them, because a border family is a set, a Secret Lair is a set, and a set with no
English printing is a set. A reader choosing between them was choosing between three descriptions
of the same kind of thing and then had to work out which one won.

There is one rule now — which platform — and each of the three platforms carries its own three
switches: **Prints table**, **Search**, **Sets list**.

**The places are per platform**, which is the one structural choice worth arguing for. They were
one shared list for two releases, on the reasoning that "where should filtering apply" is one
question with one answer. It is not: a reader who wants Arena out of the search dropdown and
Arena printings left in the card page's table is answering two questions, and one list can only
hold one answer. With it, switching Arena off for the dropdown also switched it off for the
table — or off for neither.

**Removed entirely**, with their logic rather than only their switches: non-tournament and
ancillary printings, oversized cards, sets with no English printing, Foreign Black Border with
its three families, the non-English categories Portal and Secret Lair, and the unique-art and
unique-treatment rules. So are the five treatment fields the worker carried on every printing
(`illustration_id`, `frame`, `frame_effects`, `border_color`, `full_art`) — they existed for one
comparison rule, and they were sent on every card page and cached for it.

**The worker stopped classifying sets.** It answered with six lists; it now answers with one, the
`digital` flag Scryfall publishes on the set. The oversized walk alone was five pages of
`is:oversized` every time the day turned over, to produce an answer no reader could ask for.

**Migrated.** The platforms pass through, and the one shared list of places becomes all three
platforms' lists — the reader made one answer, not three, and repeating it is the reading that
changes nothing about what they see. A platform stored as a bare boolean, which is what two builds
wrote, is read rather than dropped, because dropping it would silently hand every platform back.
Everything that was a rule about sets has nowhere to go and is not read, so a reader who had
those switches on gets those sets back: the only available reading, and it errs towards showing.

**Checks:** `npm test` 2199 assertions across nine suites, `npm run render` 208 + 202,
`npm run mutations` 11 of 11. Four mutations are new and three are about this shape's own new
failure — nine switches where there used to be three, so the obvious mistake is reading one
platform's answer for all three, and it is silent: the page is drawn and the wrong sets are gone.

### The visibility settings, reduced to two

The previous three releases put five rules under Paper and three of them carried lists
underneath. The sub-categories crossed the rules above them — a border family is a set, a
Secret Lair is a set, and a set with no English printing is a set — so a reader choosing
between them was choosing between three descriptions of the same kind of thing and then
had to work out which one won. They are two settings now, and nothing nests under either.

**Merged.** "Нетурнирные и вспомогательные издания" is one switch covering non-tournament
*and* oversized. A set can be both — Vintage Championship is memorabilia and oversized —
which is why they were separate, and asking the same reader to tick two boxes about the
same set was the cost of that accuracy. Its list comes from Scryfall in both halves:
`set_type` for the four junk categories, a walk of the oversized printings for the other.

**Removed entirely**, with their logic rather than only their switches: sets with no English
printing, Foreign Black Border with its three families, and the non-English sub-categories
Portal and Secret Lair. Every non-English printing is now one question under one dropdown —
All, Only without an English analogue, None — and Никакие covers all of those groups at
once. The worker stopped classifying them, `assets/data/set-foreign-only.js` is gone, and
`npm run set-rules` with it: the sweep existed to check name patterns and to measure a list
no setting reads any more. So are the unique-art and unique-treatment rules, which the
analogue comparison answers per printing.

**A set is never hidden for having only translated printings.** That was the removed switch,
and it is now a property rather than a setting: the language rule is a statement about a
printing, and a row on the sets index is a set. The 34 sets Scryfall prints with no English
printing among them come back, and their printings are decided one at a time by the same
rule as everything else.

**Migrated.** Two old switches became one: either of them hiding hides the merged switch.
The mixed case — one removed, one kept — has no answer in a one-switch shape, and this is
the answer it gets, because the error it can make is showing something a reader removed
rather than hiding something they kept. The two removed set rules have nowhere to go and
are dropped, which returns those sets to readers who had them on: the only available
reading, and it errs towards showing. Everything a reader can still be asking for is
carried; nothing that was removed is left in storage pretending to work.

**Not decided here.** Whether a set with no English printing should be hidden at all was a
question the old interface answered by listing the 34 of them. It no longer answers it, and
that is a deliberate loss rather than a deferral: the answer needed a dated list shipped
inside the extension, and per-printing comparison is the question the middle dropdown
already asks.

### Five defects in the settings the redesign shipped with

The previous entry describes a feature that worked. It did not, in five places, and the
mistakes are worth more than the fixes because each one is a way a settings page can be
wrong while every test still passes.

**Unticking all three platforms did nothing.** The settings page has three switches and no
master above them, and a reader who unticks all three has said so. But the card page reads
the *kept* platforms as a list, three switches off is an empty list, and an empty list was
restored to all three — on the reasoning that it was more likely a value the build could not
read. It cannot tell those apart. So the settings page showed three unticked switches and the
Scryfall page showed everything, and only the settings page had been checked. The fallback is
gone; unreadable values are refused where they can be told from a choice, in `normalise` and
`migrate`, which is where the difference is actually visible.

**The set rules reached the prints table the reader had excluded.** The language rule was
gated on "Prints table" and the four category rules were not. What kept the category rules
quiet was not the gate but the absence of a request: while nothing else wanted the set index
it never arrived, and `excluded` stayed empty. Turning a platform off wants the index for its
own reasons, so from that moment four rules filtered a surface the reader had switched off —
the same settings giving two different answers depending on an unrelated switch. The existing
check for this passed, and passed for exactly that reason.

**A narrowed Foreign Black Border category was invisible.** The list of the three families
was hidden whenever the category switch was on, and the switch is on whenever *any* family is
shown. So a reader who had chosen "everything except FBB" was shown a category reading as
simply on, with no way to see that one of three families was hidden. The setting applied
correctly and could not be seen. The list now opens whenever the families are not all shown,
which is the only state in which it has anything to say.

**"Никакие" left six rows in a thousand on the page.** A translated printing's language was
read from its link, on the stated ground that the link is the only language signal a
Scryfall row carries. Measured over 1762 printings on 2026-10-06: 995 of 1001 translated rows
carry it, and six do not — `sld/1206` and `sld/1207` are Filipino, `acr/272`, `acr/273` and
`ppls/119` are Ancient Greek, `pinv/262` is Latin, and each prints a link shaped exactly like
an English one. Those rows are now identified by what the print list says about that set and
number, which the extension already fetches and the worker already has cached. The link stays
as the fallback, so a failed request leaves the rows it can still tell about.

**A check that only broke the parse was counted as coverage.** The mutation harness counted a
mutation as caught when a suite failed and the expected string appeared anywhere in the
output — including when the file no longer parsed and every suite in the repository failed for
that reason. One mutation written this round did exactly that and was reported as proof. The
harness now rejects a mutation whose output names a syntax error, and the one it caught was
rewritten so the file still parses. A mutation that proves the file is invalid JavaScript is
not a claim about a rule.

Each fix is a test that fails on the previous code, and each has a mutation so that "the test
would notice" is itself checked: 19 of 19, against 14 before.

Also removed, because they were read by nothing and looked live: `settings.hideDigitalSets`,
written once as a constant and read in three places, with a list of twelve online-cube codes
unreachable behind it; the `label` fields of `AREAS` and `PLATFORMS`, which were a fourth copy
of names the markup already carried — the areas' labels now come from the model, which is
where the border families' and the price kinds' already came from; and eleven dictionary
entries for the removed block, which the completeness check could not see because it only
looks one way.

### The set filters stopped being a tree

The visibility settings were five rules, each with its own "where does it apply" selector and,
for two of them, a list of sub-categories underneath. That is twelve switches for a reader who
wants to stop seeing duplicates, and the arrangement had grown a master switch above them that
the two rules with a surface could contradict: a master that was off while a rule was on was a
state the interface could draw and the model could not explain.

It is now three platform switches, one shared list of places, and one dropdown.

**Every switch says the same thing: on is show.** The old shape was negative — "hide
non-tournament", "hide oversized" — and a positive word meaning "not hiding" reads as the
opposite of itself at every call site. Three of the four places that read the shape had to know
which sense a given field was in, and one of them had it wrong in a way nothing tested: the
`hideNonTournamentSets` alias was handed a value the old `effective()` had already inverted, so
the two senses met there.

**One list of places instead of a selector per rule.** "Where should filtering apply" is one
question with one answer. Three rules times three surfaces is nine switches, and a reader who
ticks one has answered a question about a rule rather than about a place.

**The platform is a printing's, not a set's.** Scryfall puts `games` on every printing and
never omits it, and a paper printing carries "paper" in it — measured 2026-10-04 on Vintage
Masters, whose 171 printings are `["mtgo"]` and four are `["mtgo","arena"]`. Answering at the
set level meant turning Arena off took the paper printing of a set that was on both. That is the
requirement stated as a test now.

**No master switch, and no "all platforms".** A reader who unticks all three has said so; the
earlier build restored them and the change came back on reload. Turning a platform off keeps its
own settings, because the switch writes one field and the detail panel writes another and
neither can rewrite the other — which is checked by switching a platform off, changing its
detail, switching it back and asking.

**Only Paper gets a details button.** A digital set is not memorabilia, is not oversized and has
no English printing to speak of, so there was nothing to put behind one.

The middle position of the language rule is the reason it is a dropdown rather than a switch: it
shows a foreign printing only where the same card has no English **Paper** printing with the
same artwork in the same treatment. That is a judgement about a pair of printings and a switch
cannot say it. What counts as the same picture is `illustration_id` (per face, because Scryfall
leaves it off a double-faced card and puts it on the faces), `frame`, `frame_effects`,
`border_color` and `full_art` — and it is not a claim to describe every visual difference, so
every early return in the comparison leaves the printing visible. A set name or a collector
number is not part of the picture, which is the case the requirement names outright and the one
the old set-name categories could not express at all.

Two limits, both honest. Scryfall's own rows in a prints table carry no artwork, so the middle
position does not touch them and the "None" position hides them by their link — which is what
"not enough to compare, therefore leave it visible" has to mean when the page carries a link and
nothing else. And the English half of every comparison is drawn only from printings the reader
kept: an English printing they have already hidden is not a picture they have, so it must not be
allowed to hide anything else.

Existing settings are translated rather than reset, through both old shapes — the flat booleans
of 1.0 and the negative shape of 1.1.4 to 1.3.0 — and a reader who was hiding lands on the
position that hides. The one judgement is the master: it meant "no rule below applies", which
arrives here as every switch at its default, by inverting five switches rather than by keeping a
gate that no longer has a meaning to keep.

**And a bug this work found in itself.** The gate that decides whether the filter runs at all
was written `some(show => show) === false`, which is true only when every border family is off.
Narrow the category to a single family and it stood the whole feature down: untick 4BB, leave
FBB and BCHR on, and not one row moved. Every check that had ever run switched whole categories.
It is now `some(show => show !== true)`, and two render checks and a mutation exist because the
first spelling looked correct.

**One claim from the previous entry, corrected.** That the search the extension uses to fetch a
card's printings — `oracleid:<id>` — returns only English printings, and that the non-English rule
had therefore never worked on the extended prints table. It does return every language, and it
does. The reading came from an `oracle_id` taken off a Chinese Portal printing of a card whose
English identity is a different one; run on Counterspell (88 printings, `en es fr ja`) and
Shivan Dragon (53, `en es fr ja ru`) both queries agree, row for row. The finding it was built
on was real but had the wrong cause, and the rules are unchanged by it.

### A legality check that says what it did not check

The obvious next thing, and the one this project left out three times on purpose: a check
over a deck, and the reason it was left out was that **which format a deck is being judged
against is a question the deck editor does not answer**, and a check that guesses is worse
than none.

It is answered now, and the answer is not a setting. Scryfall's deck editor builds
commander decks and the deck names its commander, so the format follows from the page the
check runs on. There is nothing to pick from, which is also why the format is not a
parameter: a parameter is a promise of formats this build does not offer. The answer names
the format it judged, so a reader is never left to work it out.

**It costs no new request.** `/cards/collection` — the endpoint the Show Tokens dialog
already posts the deck's identifiers to — returns each card's `legalities`. The two were
separate readings of the same list doing the same kind of call, so they are now one
function, and the check is the parsing after a request the page was making anyway.

**And the panel prints its own boundary, under the answer, always.** It checks one thing:
whether Scryfall counts each card as legal in Commander. It does not check the commander's
colour identity, the hundred-card limit, or the one-copy rule for cards marked "Commander
only" — rules about the deck as a whole, which Scryfall has no endpoint for, and which
would mean writing a mana-symbol parser and then trusting it. The panel says so on a clean
deck as well as a dirty one, because a clean answer is the one most worth qualifying.

A card Scryfall says nothing about is counted **apart** from a card it calls illegal.
"No answer" is not "legal", and a reader who acted on the difference would swap a card
that was fine.

---

### Scryfall has four verdicts, and the check was written for two

Every test of this feature so far answered the worker's question with a fixture that
answers it, which proves the branch parses the shape it was written for and nothing about
whether that shape is the one Scryfall sends. So the branch was run against Scryfall for
real, with a deck read out of a search rather than written down.

The vocabulary came back at once: Black Lotus is **`banned`** in Commander. Not
`not_legal` — banned. Across every format in `legalities`, Scryfall uses four words:
`legal`, `not_legal`, `banned` and `restricted`. The branch acted on the first two and
filed everything else under "Scryfall said nothing".

Which means **the two most iconic cards in the format were invisible to the check built to
catch them**, and a reader with Ancestral Recall in their deck was told Scryfall had no
answer about it — the opposite of the answer Scryfall gave, arrived at by having a
dictionary with two entries instead of four.

Fixed, and the panel now says which: `banned in Commander`, `restricted in Commander`.
Paraphrasing all three refusals as "not legal" would throw away a distinction Scryfall took
the trouble to make, and a reader told only "not legal" about Ancestral Recall would go
looking for a different printing of it. Banned cards sort above not-legal ones, because a
card you cannot play at all in this format is a harder stop than one that is simply outside
it. A verdict outside Scryfall's four is still counted as no answer: a value this build has
never seen is not one to invent a meaning for.

**The set-code bound was looser than Scryfall's own.** Scryfall refused a two-letter set
code with "a `set` identifier must be between 3-6 characters". The worker was accepting one
to sixteen, so a malformed entry got through the check that exists to catch malformed
entries and failed later as a 400 from the API. All 1,053 set codes in `/sets` are three to
six characters, so the bound is now what Scryfall says it is.

And the fixture for this test was written from memory: it listed Force of Will and Dark
Ritual as not legal in Commander, and both are legal. Which is why the live script prints
its verdicts rather than asserting them — a fixture written from memory about the format is
a fixture that is wrong about the format, and it was wrong in the direction that would have
hidden the bug.

---

### Nine codes in a rule that never caught anything

The same question asked of the next hand-written rule: which sets count as non-tournament.
It named four set types — `memorabilia`, `minigame`, `vanguard`, `token` — **and nine code
prefixes**: `30a`, `cei`, `ced`, `wc97` through `wc04`.

All eleven codes are `memorabilia` sets. 30th Anniversary, both Collectors' Editions, the
World Championship Decks. So the alternation caught nothing the type list did not, on any of
the 1,053 sets Scryfall serves, and removing it changes the answer by zero sets.

It is worth noticing what that looked like in the source: a list of types *and* a list of
codes, reading like a second independent way of catching the same thing. It was not one. A
second condition in a rule like this is normally a second source of truth, and this one was
a mirror of the first that happened to be written down.

The four types are the right four, and that was measured rather than assumed. Asking
Scryfall for `e:<set> format=commander` across the first two sets of every set type, those
four return nothing and **every one of the other eighteen returns cards Commander accepts**.
A set cannot be junk because of its name, so it is asked.

The test fixture had been hiding this by spelling `cei` as an `expansion` — a type
Scryfall does not give it. Under that fiction the code list was load-bearing. With the real
type it is not, and the fixture now also carries a set whose name reads like a product and
whose type is `commander`, so the rule is held to the type rather than to how a name sounds.

---

### Vintage Masters was never on Arena, as far as the platform filter could tell

The last of the rules, and the one whose mistake would have been a fact rather than a name.

It reads `games` off a single card of a set — `page_size=1` — on the reasonable assumption
that a set was released for the same clients throughout. Asked of all 61 digital sets, with
each card compared against the union of its set: **one set disagrees.** `vma`, Vintage
Masters, has 320 printings saying `mtgo` and 5 saying `arena` and `mtgo`.

The five are Dack Fayden, Fireblast, Hymn to Tourach, Library of Alexandria and Strip
Mine, and nothing about them marks them: not a promo, not a border printing, not a
different finish. So the first card said `mtgo` and the extension reported that Vintage
Masters was never on Arena. False, in the one direction a reader would act on — unticking
Arena would not hide a single Vintage Masters card.

It now reads a page and takes the union, sorted, because the order rows arrive in is
Scryfall's and the settings page shows this as a set of switches.

The oversize walk was checked at the same time and is exact: 726 printings in five pages,
every one with `oversized=true`, 38 sets — the comment's numbers, unchanged.

Two notes on how the checks went, because both are the failure this project keeps meeting.
The fixture for `vma` originally ignored `page_size` and returned twenty rows to a request
for one, so **a mutation that put the bug back did not fail the suite** — the stub could not
tell "read a page" from "read a card", which is the entire difference. It honours `page_size`
now, and both mutations are caught. And two mutations run through a PowerShell string replace
were reported as passing because the shell ate a backtick and the replacement never happened;
the ones that count were re-run reading the file directly.

---

### The snapshot repeated the mistake, and nothing could have caught it

Fixing the walk did not fix the answer. `assets/data/set-platforms.js` is the file of
platform answers the extension ships, so the filter works before it has asked anything; and
a set already in the snapshot is **never looked up again**. So `vma` kept saying `mtgo`, and
would have kept saying it for ever, with the walk now correct and no longer involved.

Measured against Scryfall: of the snapshot's 61 entries, one was wrong, and it was the same
one. Corrected, and all 61 now agree.

Which raised the question of who was checking that file, and the answer was nobody. The
message tests substitute a two-entry snapshot — `{ysos: arena, omb: both}` — so they can
exercise the runtime lookup, and every one of them passed with `vma` wrong in the shipped
file. A test cannot check a file it replaces.

There is now a check that reads `assets/data/set-platforms.js` itself: that it carries a
snapshot's worth of sets rather than a sample, that every entry names at least one platform
and lists none twice, that every entry is sorted (the walk now sorts, so the two must agree),
that the platform names are exactly the four Scryfall states, and that `vma` lists both
clients. Putting the wrong value back fails it, verified by doing so.

The package check that reads the header wanted the old date, 2026-09-25, which was correct
while that file held a single-card reading and is not now. It is dated 2026-10-03 and the
check names how each entry was read, because a reader who finds an entry wrong needs to know
which measurement to re-run — and "read one card" is the answer that was wrong.

This is the fifth rule measured and the fourth found wrong, and the first one whose error
was in a file rather than in code. Same shape: something written once by hand, never
re-checked, and protected by tests that stood in for it.

---

### The other three data files, checked against the thing they claim to be copies of

The platform snapshot raised the obvious next question about the rest of the package's
data. Three files, twelve megabytes, and each one says in its own header that it is a
byte-identical copy of MoxTags v1.8.3, verified by SHA-256 on 2026-09-25. That claim is
checkable against the upstream tag, and nobody had checked it since.

All three are intact. Compared from `self.` onward — the licence header is ours, so whole
files cannot be identical — the payloads hash the same as upstream's to the byte:
3,930,789 / 4,593,598 / 3,754,848 bytes. The data was never the problem.

And yet nothing in the suite could have told us that. Every check on these files read the
first 600 bytes, so a truncated payload, a re-encoded one or a hand-edited entry passes all
of them and the tag panels quietly show fewer tags. A header check is a check on the
comment.

There is now a check on the payload. These are compact indexes — `t` is the list of tag
names and `d` maps a UUID to positions in it, which is what `lookup` reads — so the
assertions are the ones that format needs: names present, sorted, unique; entries a real
number; every position inside the list, or a card's tag reads as `undefined`; and the two
halves of the art index disjoint, since a card with an art tag has to land in exactly one.
Three mutations, all caught.

Worth recording what the measurement found that a test could not have: `illustration-tags-1`
and `-2` carry the **same 11,555 names** and 25,098 / 25,097 entries with no UUID in both.
That is one list split in two, which is what the split is for and what nobody had checked.

---

### The table of hand-made format decisions had no header

Three formats Scryfall does not have — Classic Legacy, Peak Legacy, Heritage — are answered
by search clauses written here. Checked on 2026-10-03: the syntax works, `date<=` with a set
code filters as intended, and the answers for the cards I could check are right.

The clauses use Scryfall's **current** Legacy verdict, and that is the whole problem. A card
banned from Legacy in 2016 is `legal:legacy` false today, so the clause reports it as never
having been in the format at all. `STK_FORMAT_OVERRIDES` is the correction, one card at a
time — 29 entries over 17 cards, and it works: every id still names a card Scryfall has, no
duplicates within a format, and every entry disagrees with what its clause would have said,
so none of it is dead weight that reads like a decision.

And it had **no header at all**. Twenty-nine hand-made verdicts about Magic formats, in a
file whose first line after the licence was `self.STK_FORMAT_OVERRIDES = {`. What the entries
are, why they exist, and what they are for is written down now, including the part that
matters: completeness is a judgement call a person made, Scryfall states only present
verdicts and never says what a format contained in 2010, and a card added to a Legacy ban
list after the fact is invisible to every check that exists.

Time Walk is named there as the obvious open question and is deliberately **not** answered.
It is not in the table because nobody has decided it here from a source, and a verdict taken
from memory is the one thing that file exists to avoid.

Three of my own readings in this thread were wrong, all three the same mistake: an
`oracleid:` uuid asked for as a printing id, a `d` index compared against a tag name, and a
column of "what the clause should say" invented from memory of the format rather than read
from anything. The first two produced confident numbers about data that was perfectly fine.
The third would have become a 170-card finding and was worth nothing.

---

### What was measured and found correct, written down so it is not measured again

The audit found four wrong things out of nine it looked at. The other five were right, and
a list of right answers is worth as much as the wrong ones here — it is what stops the next
person spending an afternoon re-deriving it, and it is the difference between "this was
checked" and "this looked fine".

- **The oversized walk.** `is:oversized` to exhaustion: 726 printings over five pages, every
  one with `oversized=true`, 38 sets. The comment's numbers, unchanged.
- **The foreign black border rule.** All three sets the patterns name have zero English
  printings, and they are the only three sets Scryfall calls Foreign Black Border.
- **The overrides table.** 29 entries over 17 cards, every id still naming a card Scryfall
  has, no duplicates within a format, and every entry disagreeing with what its clause would
  have said — so none of it is dead weight that reads like a decision.
- **The tag icon map.** Its three tag types are exactly the three Tagger emits. Of fourteen
  relation classifiers, seven turned up in fifteen live cards and all seven are covered;
  nothing Tagger emitted is missing from the map.
- **`promo_types`.** Absent from most of the 62 keys a printing carries and present on some
  — an optional field, not a renamed one, so the finish badges' read of it is correct. Worth
  stating because its absence from a key list looks exactly like the two renames this
  release did find.

And one that looked like a defect and was not: the catalog's `compbrawl` key reads like a
misspelling of Scryfall's `competitivebrawl`. It is this project's own key for the row
Scryfall labels "Comp. Brawl", the value is read from the page's own markup, and only
`premodern` reads `card.legalities`. Chasing it would have meant changing a key that works.

---

### The render check exists now, and it was right to be fussy about its own harness

The scratch script that found the 2,276-pixel caveat was gone, and "a panel nobody thought
to draw is a panel nobody looked at" was a sentence in a changelog doing the work of a tool.
So there is one: `npm run render`. It builds the deck page the way the extension builds it
— the same feature files over deck markup, which is all a deck page is — opens both panels
with a **real `showModal()`**, and measures them in Chrome at four viewports from 1600 wide
down to a phone. 175 checks, and pictures clipped to the panels in `dist/render-check`.

It is not in `npm test` and will not be: Chrome is not something a test suite may assume.

Writing it turned up three things, and the first is the one worth reading.

**The harness's dialog stub is a lie, and this tool walked into it.** linkedom opens a
dialog by setting the `open` attribute, so the serialised page arrives already open, and a
guard written as "if it is not open, open it" skips the call. The panel was open and sat at
its static position in the page — below twenty rows of deck list — for the whole first run,
and one of my own checks passed it, because I had written `position === 'fixed' || width > 0`
and the second half is always true. The attribute comes off before `showModal()` is called
now, and the check that the modal is *centred* is worth more than the one that it has a
size. A check that cannot fail is worse than no check, because it is counted.

**A sub-pixel edge touch was reported as an overlap**, at zero rows, three times. The Close
button's bottom edge and the note's top border land on the same line, which looks like two
elements meeting and not like two elements covering each other. The overlap test now needs a
half-pixel of real intersection in both axes.

**And the one finding, which turned out to be fixable after all.** At 420px the sidebar is
`display:none` — Scryfall's stylesheet shows `.sidebar` only from `min-width:800px`, and
keeps one on a narrow screen with the class `always-visible`. Both deck buttons are prepended
into that sidebar, so **on a phone neither the token dialog nor the legality check could be
opened**, because the thing they hang on was not on the page.

It is fixed, and the fix is four lines in this project's own code: put the button in the
sidebar when the sidebar is *on screen*, and beside the deck list when it is not. The second
container was already named in the old fallback — it was simply never reached, because the
test was whether the sidebar was **absent** rather than whether it was **shown**. And
`getClientRects()` is the browser's own answer: an element with `display:none` produces no
boxes, so a button in one measures 0x0 rather than merely looking wrong. Scryfall's layout is
untouched.

Getting to a check that could see this took most of a round and is worth recording, because
every wrong turn was the same mistake. The feature ran in the harness, which has no layout, so
the button landed in the sidebar — and no amount of re-running the feature fixed it, because
the browser never re-runs what the harness already did. Serving the page over http at a deck
URL and running the file in the browser *did* work, and reported the fix plainly: "placed
somewhere visible (deck list, 762px wide)" where before it was a 0x0 control. Then it started
reporting the panel 560px wide inside a 420px viewport — which the same CSS does not do when
the same page is loaded from disk — and that machinery was pulled out rather than shipped.

So the check measures the input to the decision instead: which of the two containers is on
screen at each width, that `getClientRects` agrees with what a reader can see, and that the
button the harness placed is the unreachable one. The fix itself stays, small, in the
feature's own code, keyed on the browser's answer.

---

### The render check grows to the card page, and its own fixture was three releases out of date

The gap I reported last round was that `npm run render` draws one page and the other six
features are not drawn at all. That is closed: `tools/check-card-render.cjs` renders all six
panels behind the settings illustrations, at four widths from 1600px to a phone, in the
arrangement a reader has — Scryfall's markup, Scryfall's stylesheet, our theme on top, our
panels where our feature files put them, and no extra CSS to flatter any of it. 205 checks.

Writing it turned up four things, and the first is the reason this entry exists.

**The fixture that draws the pictures was classifying sets the way the extension did before
1.1.4.** `tools/shots/live.cjs` kept its own copy of the rules — a flat `foreignBlackBorder`
array matched by the words "foreign black border" in a set's name, and no `nonEnglish` at
all. The copy had drifted from `worker.js` when the two rules became per-category lists with
sub-lists a reader can narrow to. Nothing failed. Every sub-list came back empty, both rules
hid nothing, and the sixth settings illustration was a picture of a filter the extension no
longer has. The file's own comment said the rules were "copied from worker.js on purpose: a
second, slightly different copy here would quietly show a picture of a filter that does not
exist", and the second copy is what happened.

The tables are read out of the worker now, by name, and a renamed table stops the tool rather
than emptying it. Measured against `/sets` on 2026-10-04: `4bb`, `fbb`, `bchr` for the
border rule; `por`, `ptk`, `p02`, `pptk` for Portal; `pssc`, `slc`, `sld`, `slp`, `slu` for
Secret Lair. Same rule, one copy, and the check that reads the worker's own answer is the
same object the page is given.

**And the platform index was routed as `{}`.** The same file answered `setPlatforms` with an
empty object, which says no digital set is on any client — so with paper alone chosen, `omb`
and all sixty other digital sets stayed on the page. The index the extension ships is routed
instead, read from `assets/data/set-platforms.js` rather than copied, so a check can now say
which sets a client carries instead of assuming none do.

Both fixtures were wrong in the direction that hides nothing, which is the direction that
looks like a working feature. Neither picture changed when they were fixed, which is worth
saying plainly: `hide-extra.png` shows the price columns, and the set filters in its fixture
name sets that are not among the ten rows Scryfall shows on that card, so they do nothing
visible there. The picture was not lying. It was not demonstrating either.

**A check that failed with a reason did not fail the run.** Both render tools filed a failure
that came with an explanation as a note and exited 0. Found by mutation: the non-English rule
was made to stop reaching the sets index, the tool printed `FAIL: … hides all of them (0 of
5)`, and then reported success. A reason is worth printing; it is not a substitute for
failing. Both tools now fail on any check that does not pass.

**And the phone fix was covered by nothing.** `deckButtonPlace` put back the way it was —
the sidebar whenever the sidebar exists — passed `npm run render`, which cannot see the
decision, and passed `npm test`, which had never been asked. `npm run mutations` exists
because of that, and the third mutation is now caught by a test in `test-preview.cjs` that
gives the harness the answer the browser would give: one box for the sidebar and it is used,
no boxes and the button goes beside the deck list, and with no `getClientRects` at all the
sidebar is used, as it was before.

**Where the rules are checked, and why not on the prints table.** The two name-matched rules
are checked on Scryfall's sets index, where a row *is* a set. On the prints table they are
masked: the extension takes a window of ten sets around the printing being viewed, `sld` is
the eleventh of twenty-four for this card, and the window can only be widened by pressing
"View all prints" — which a rendered page cannot do, because the features ran in the harness
and their event handlers did not survive being written out to a file. Two switches were tried
there first, the black-border filter and the non-tournament one, and both hid nothing and
passed. A check like that is worse than no check.

Measured, with the rule in force on the index: 1,064 rows, the five Secret Lair sets found and
shown with it off, all five hidden with it on, nothing else hidden, and Scryfall's own counter
rewritten to `1059 of 1064`. With paper alone chosen, all 61 digital sets go.

Checked and left alone, so it need not be decided again: the tag icons are 18px on the real
page, so the `STAGE_CSS` in `make-feature-shots.cjs` that sizes them is belt and braces and
not the thing making them the right size; Scryfall's prints table is 409px wide in a 383px
column and always has been, so the group rows are checked against the table's full width
rather than against the window; `sets.js` falls back to
`{digital:[], foreignBlackBorder:['4bb','fbb','bchr']}` when the set index request fails,
which is the old flat shape — harmless, because an array yields no per-category answers and a
failed request hides nothing anyway, but it is the pre-1.1.4 shape and should not be.

---

### A switch for the 34 sets Scryfall has no English printing for

The list came out of the sweep as a by-product and then sat in the changelog for a round as a
finding, which is where findings go to be forgotten. It is a switch now.

**It is a plain switch, beside the two junk rules and not among the two mode rules.** A set
with no English printing has nothing to show on either surface, so there is no surface to
choose and nothing to narrow: the 34 are foreign releases and Japanese-only products with no
property in common beyond the one the rule is about. The two rules below it have three
positions each and a list under them because they are decisions about a surface and a
category; this one is a fact about a set, like `oversized`.

**Its list ships as a dated measurement, because it cannot refresh itself.** The platform index
beside it can: its candidates are the 61 sets Scryfall marks digital, so an unknown one is worth
a page of its printings. This list's candidates are every set Scryfall serves — the 34 are a
subset of 1,053, so "the ones we do not know about" is most of Scryfall, and looking each up
would be a thousand requests a day for every reader. So it is `assets/data/set-foreign-only.js`,
dated 2026-10-04, narrowed at read time to the codes `/sets` still serves so a retired set
leaves the answer. It goes stale in the safe direction: a foreign-only set released since the
measurement stays visible, which is the same policy the platform lookup already follows — a set
it cannot place stays visible rather than being hidden on a guess.

`npm run set-rules --write` regenerates the file from a fresh sweep, and the checker fails when
the file and the sweep disagree — so a stale list is a red run, not a filter quietly hiding the
wrong rows.

**Three of the 34 are the border releases**, which have no English printing either, so a reader
with both rules on hides them twice. That is harmless and not worth a special case.

**The cache guard now names every list.** `loadSetCategories` already refused a cached index
whose `foreignBlackBorder` was the old flat array, and `foreignOnly` had to be added to that
test for the same reason: a cache written before a list existed still passes a guard that only
knows about the older ones, the missing list arrives as `undefined`, and the rule that reads it
hides nothing while looking switched on. The fallback in `sets.js` had the pre-1.1.4 flat shape
in it and now carries the current one — empty per-category objects rather than an array, so a
failed request produces the right shape with nothing in it instead of the right answer by
accident.

**And the harness had been quietly emptying a snapshot for three releases.** `test-background.cjs`
skipped every `assets/data/` import, which it needed to do when the tag bulk was imported at
start-up and stopped being. The effect was that `bundledSetPlatforms` was `{}` in every test in
the file, so "the shipped snapshot answers for this set" was asserted by none of them — and a
test was asserting that a *lookup* happened for `vma`, a set the snapshot covers. The skip is
now an explicit allowlist of the two directories the worker's own files live in, `vma` is
asserted to cost no request, and the walk's real test — a page rather than one card, and the
union of a set whose printings disagree about their client — moved onto `mtgo`, which the
snapshot genuinely does not cover.

Seven mutations are caught now, two of them for this rule: the worker answering without the
list, and the page not asking for it. The second is the shape of bug this file has been about
all along — a rule that reads `undefined` and hides nothing looks exactly like a rule switched
off.

---

### The two name-matched rules, asked about rather than read — and my completeness claim was wrong

`BORDER_SET_NAMES` and `NON_ENGLISH_SET_NAMES` are the only rules in this extension decided
by a pattern in a set's *name*, and a name is not evidence. The reason they are patterns is
that nothing on Scryfall says otherwise, and that is now measured rather than remembered. A
set object carries `arena_code, block, block_code, card_count, code, digital, foil_only,
icon_svg_uri, id, mtgo_code, name, nonfoil_only, object, printed_size, released_at,
scryfall_uri, search_uri, set_type, tcgplayer_id, uri`. Nothing about languages, nothing
about borders. `npm run set-rules` sweeps all 1,053 sets and asks Scryfall about each one.

**The claim I wrote is the one the sweep refused, and it is worth reading how it went.** The
border rule is falsifiable — a foreign black border set has no English printing anywhere in
it, so `e:<code> lang:en` is *refused* for one and answered for every other set, and that
refusal is an answer rather than a failure. So I wrote that these three are the only sets
Scryfall serves with no English printing, and the first full sweep came back with **34**.
Three are the border releases. The other 31 are foreign-only products, and they are in that
state for an unrelated reason:

| | |
|---|---|
| 22 promo sets | Hobby Japan Promos, Japan Junior Tournament, the Magic Premiere Shop 2005–2011 runs, Planeswalker Championship Promos, the Japanese release promos of Apocalypse, Invasion, Judgment, Odyssey, Planeshift and Torment, Redemption Program, Summer Vacation Promos 2022, 30th Anniversary Celebration Tokyo, Final Fantasy Regional Promos |
| 5 token sets | the Japanese promo tokens for DMU, MKM, MOM, ONE and WOE |
| 3 box sets | Salvat 2005 and 2011, Sega Dreamcast Cards |
| 2 master sets | `ren` Renaissance — 122 printings, **all French** — and `rin` Rinascimento, its Italian release, 69 printings, all Italian |

So the true claim is the narrower one: these three are the sets Scryfall *calls* Foreign Black
Border, and no other set carries that name. The check now asserts that, and lists the other
31 rather than asserting them away. Written as "only these three lack English" it was simply
false, and only a sweep would have said so.

**The other half of a name rule is completeness, and it costs nothing to check.** The sweep
proves each matched set is in the state claimed. What it cannot show is a set Scryfall *calls*
Portal that no pattern matches — a hole in the rule that every matched set looks fine beside.
The names are already in hand, so this is exact and free: **nine** sets say Portal or Secret
Lair and all nine are matched (`por`, `p02`, `ptk`, `pptk`, `pssc`, `slp`, `slc`, `sld`,
`slu`); **three** say Foreign Black Border and all three are matched. Both rules are complete
for what they claim, and that is now a check rather than an assurance.

**And the non-English rule cannot be falsified, now for a measured reason.** Portal and the
Secret Lairs are English sets that happened to be released abroad — `sld` counts 2,799 English
printings, `ptk` 180, `por` 215. No set-level property separates them from an ordinary set,
because there is none to find. Their list stays name-based, and the code says so where a reader
meets it.

**Three ways of asking about the absence of English, and all three fail.** This is why the
sweep asks about English rather than about its absence, and it cost three probes to learn:

| query | m21 | sld | por | 4bb | ren |
|---|---|---|---|---|---|
| `e:<set> lang:en` | 397 | 2,799 | 215 | refused | refused |
| `e:<set> lang:!en` | 397 | 2,799 | 215 | refused | refused |
| `e:<set> -lang:en` | 3,411 | 119 | 1,297 | 1,871 | 244 |
| `e:<set> NOT lang:en` | refused | 9 | 2 | refused | refused |

`lang:!en` is not a negation — it returns everything, which is what was recorded on 2026-10-03.
`-lang:en` is not one either: 3,411 against 397 English for a set with no foreign printing, and
244 against 122 for a set with 122. `NOT lang:en` is honoured and wrong — refused for `m21`,
correctly, and refused for `cmd` and `tsp`, which certainly have foreign printings.

**A refusal is ambiguous, and the first sweep got that wrong too.** `e:<code> lang:en` is
refused for a set with no English printing *and* for a set Scryfall indexes no printings for at
all. One set here is the second kind (`pfra`), and had it been several hundred the sweep would
have invented them. So every refused set is asked again with no language term, and only the 34
that have printings and no English among them count as being in the border state. The three
border sets: 378, 307 and 125 printings, none of them English.

**The "rest" category reaching the Sets index is not cheap, and now has a price.** Which sets
print a language besides English cannot be read from `/sets`. Getting it by search does not
work either: `unique=sets` is not honoured for `lang:<code>` — `lang:en` comes back as 33,649
"sets" over 193 pages — and eleven useful languages is about 1,400 requests. Walking every
set's printings is not much better. So the category stays stated as applying where a printing
says its own language, and the settings page says so rather than the page implying otherwise.

**And the reader of those patterns is now one file.** `tools/shots/worker-tables.cjs` locates
`BORDER_SET_NAMES` and `NON_ENGLISH_SET_NAMES` in `worker.js` by name and evaluates them, and
both `live.cjs` and the new checker use it. Two of the five mutations in `npm run mutations`
exist to keep it that way: a Secret Lair pattern that stops matching, caught by the
completeness check; and a border pattern widened to `/^Fourth Edition/`, which also claims
`4ed` and is caught against the API. A renamed table stops the tool instead of emptying it —
an empty list hides nothing and looks complete, which is how the copy that drifted went
unnoticed for three releases.

Two things about the sweep itself, because both cost an hour. It runs at 1.15 seconds a
request: 1,053 requests, about twenty minutes, so it is a tool and not part of `npm test`. And
it writes its answers every fifty sets rather than at the end — the first attempt was piped
through a pager that closed after twelve lines, the process died at a hundred sets, and a cache
written once at the end would have discarded every request it had made. It resumes from the
file now, and `--fresh` asks again whatever it finds.

---

### `lang:!en` is not a negation, and it answered confidently

The same treatment for the two rules left. Both name sets by their names, which is the one
thing Scryfall cannot be asked about directly — a set object has no field saying whether it
is a border release or a Portal. So the question became: **can either rule be checked at
all?**

The border rule can, and the reason is that its name is falsifiable. A foreign black border
set has no English printing anywhere in it, so `e:<code> lang:en` settles it — and it is
refused outright when nothing matches, which is the answer rather than a failure. Measured
on 2026-10-03: all three sets the patterns name have **zero** English printings, and they
are the only three sets Scryfall calls Foreign Black Border. Complete for what it claims,
which is not something reading names off `/sets` could have established.

The non-English rule cannot be checked, and that is now said in the code rather than left
as a shrug. Portal and Secret Lair both have English printings in every one of their sets —
`ptk` is 180 of 180, `p02` 165 of 165, `sld` 2,793 of 2,821. They are English sets that
happened to be released abroad; only the border sets have no English at all. So the two
families are not two instances of one property, and a property-based rule would not
reproduce them.

**And the term that nearly produced a wrong answer.** `lang:!en` reads as a negation. It is
not one: on m21, which has no foreign printing in its own sets, `e:m21 lang:!en` returns
all 397 printings — the same as no term at all. A rule built on it would call every set a
foreign-language set, and would report a confident number while doing it. `lang:en` is
honoured; `NOT lang:en` is refused outright. That is written into the comment above the
rule, because the first attempt at this measurement used `lang:!en` and got a number out of
a term that was not doing the job.

### The sweep that produced 35 sets, and why the number was dropped

The first pass asked which sets have no English printing and found 35, against 3 from the
rule — a gap big enough to be worth chasing. It was an artefact, three times over.

`/sets/<code>/cards` does not exist; it is a 404 on every set, and an empty card list from
it means nothing. `search e:psal` was read as "unsearchable" when it in fact returns 720 —
the script was reading a refused response as an empty one. And a sweep over all 1,052 sets
one request at a time answered "no such set" for 147 of them, then 904 on a rerun, which
is Scryfall's rate limit being mistaken for a fact about the data.

So 35 is not reported. The three-request measurement above replaces it, and it was run with
a 429 treated as a retry rather than an answer, because the failure that produced all three
artefacts is the same one in each case: **a request that did not succeed, read as a request
that succeeded with nothing in it.** That is worth more than the number was.

### The token dialog had no test and could not have had one

Writing the first test for the new deck panel failed on `showModal is not a function`, and
the reason is worth recording: **the harness patched `showModal` onto the `<dialog>`
elements it found in the markup.** Both the token dialog and the legality panel are built
at run time, so neither had it — which is why the token button has had no test since it
shipped, and why a test for it could not simply have been written now.

The patch is on the prototype, so a dialog a page creates for itself behaves like one it
shipped in. Verified by the token path being reachable at all.

---

### The caveat was 2,276 pixels down a 1,018-pixel window

A passing test says the panel builds the right DOM. It says nothing about whether the
panel is readable, because the harness has no layout and no CSS: linkedom is an HTML
parser, not a browser. So the new panel was rendered in real Chrome, with Scryfall's own
stylesheet in front of it, in both themes.

It renders correctly — 560 pixels wide, 283 tall for five cards, the list indented, the
note under it. And with a hundred cards, which is what a Commander deck actually holds,
the note that says what was *not* checked sat **2,276 pixels down a 1,018-pixel window**,
at the bottom of the scroll area.

That is the failure this feature exists to avoid. A legality check that qualifies its
answer is no use if the qualification is the one part the reader never sees, and the deck
where they would not see it is the deck where they most needed it.

The note is pinned to the foot of the scrollport. Pinning it turned up a second thing
immediately: it was dimmed with `opacity`, which fades a background as well as a text, so
the rows behind it showed straight through the note in both themes. The dimming is a
colour now.

Both halves are checked. The test asserts the note is the last thing in the panel and is
the paragraph that names the limits; the stylesheet check asserts it is pinned and that it
has no `opacity` on it. Both were verified by breaking them.

Worth noting what this cost and what it did not: no new tool ships, and the render was a
scratch script that is gone. What remains is the finding, the numbers that produced it,
and two checks that fail if the arrangement is undone.

---

### The other panel was fine, which is worth writing down too

The token dialog has had no test since it shipped, so it got the same render. Thirty real
tokens, asked of Scryfall rather than written down, because a grid of grey boxes has the
layout of a grid of pictures and none of the point.

It is sound: three columns, 578 pixels, names legible because they are printed on the
cards themselves, the Close button in its own strip to the right of the grid with no cell
underneath it, scrolling correctly at both ends of the count.

One thing looked wrong and turned out not to be. The stylesheet caps the panel at 860
pixels and it is never that wide — a dialog is shrink-to-fit, and a grid of `auto-fill`
columns is exactly the thing that cannot decide its own width, because the column count
is what the width is. Stating it as a `width` so it would bind was tried: one column
gained, no scrolling saved, and a two-token deck left with an 860-pixel dialog holding two
pictures. Reverted, and written into the stylesheet, because it is a plausible thing to
try and it does not work.

An eyeball said the Close button overlapped the third column. Measuring said it did not:
the grid is shortened to 488 pixels by the float, and the button sits in the 56 pixels
beside it. Two of this release's findings were guesses that measurement refused.

---

### The "?" opens the whole column, not a piece of it

Five of the six illustrations behind the "?" were crops of a panel. Now they are the card
page's whole right-hand column: the printing's banner, the prints table with its price
columns, and the tag tables underneath it.

A crop says what a panel looks like and nothing about where it goes. It cannot show that
the tag tables sit under the prints, that a panel is a panel and not part of Scryfall's own
page, or what the column looks like once a rule has taken rows out of it — which is the
question the "Hide extras" picture exists to answer. The arrangement is the thing a reader
is trying to picture, and a crop is not it.

**Two things had to be in the crop that a first guess leaves out, and both were found by
looking at the pictures.** Scryfall gives `.prints-current` a negative top margin, so the
printing's name hangs twenty pixels above its own parent and cropping the parent's box
slices that name in half across the top. And `.prints` is capped at 400px by their CSS
while its table is wider, so cropping the container cuts the last price column in half —
a price with one digit, which reads as a broken table rather than as a crop.

**And the column is `.prints`, not `.card-text`.** The first guess was the element whose
class name mentions the card; `.card-text` is the card's rules and its legality block,
which is the *other* column. Naming both gives a picture of the whole top of the page with
a strip of the artwork down its left edge, which is the crop problem again.

### The dialog could not show a tall picture, which is why these were crops

Reading the stylesheet while working on the above turned up a plain defect: `.shot-dialog`
carried `max-height: 88vh` and nothing else, so a picture taller than the window simply
ran off the bottom of the dialog with no way to reach the rest of it. No picture was tall
enough to show it, because every one of them was a crop.

That is a check of its own now. The six pictures are between three hundred and seventeen
hundred pixels tall, and the bound that says "this is not a page" is now read out of the
tool that takes them rather than written beside them, so the two cannot drift apart.

### One fixture was still writing a shape the settings page stopped writing

`hide-extra.png` was still asking for `foreignBlackBorder: { on: true }`, the boolean that
1.1.5 replaced with a surface. It worked — `normalise` maps the old boolean onto
'sets-prints' — so the picture was right while the tool described a shape nothing produces
any more. A fixture that only works through the compatibility path is a fixture that stops
working the day that path goes, and it is now written the way the card page reads it.

---

### The gap 1.1.5 wrote down, closed

1.1.5 finished with a gap it named rather than papered over: the grouped table
`prints.js` builds from the API's answer was not covered, because the page that harness
builds for it does not render the groups and nothing distinguished it from one that does.

**It was never the harness.** It was two things the table does on purpose, which a check
has to know before it can measure anything:

- **A set with a single printing gets no group header at all.** The row repeats the set
  name instead. The first fixture had one printing in each extra set and asked for a
  header, so it was asking for something that can never be there — and it failed for a
  long time on a table behaving exactly as written.
- **Past ten units the table stops placing groups** and offers the rest behind a link, so
  a check reading group headers has to keep the table short or it is reading a rendering
  rule rather than the filter.

The check now runs in `setPlatformTest`, beside the pages that demonstrably render, and
covers the mode on the surface it is easy to forget exists: `prints` and `sets-prints`
**agree** here, because both address this table, and only the Sets index tells them
apart. Two mutations of `prints.js` are caught by it — asking the wrong surface, and
ignoring the reader's list.

One more thing the fixture had to learn, and it is in the model rather than in the test:
**an empty category list is not "hide nothing".** `normalise` deliberately refuses to keep
one, reading it as a build that never wrote the list, so a fixture that stores `[]` hides
everything — the opposite of what it meant. "Nothing in this category" is stored as a
non-empty list naming categories that are not in play.

---

### The surface mode, back, and this time both surfaces answer it

1.1.0 shipped a mode on the two rules that could have one: Off, Only Prints, or Sets and
Prints. 1.1.1 took it out again because nothing acted on it. **It is in the shape now**,
and the reason it could not be before is the reason it works now.

The two surfaces are different code. `sets.js` hides rows in a list keyed by set code.
`prints.js` drops entries out of the API's answer, where each printing carries its own
language. **A non-English printing cannot be reached from a set code at all**, so "Prints
only" was never one click away for that rule — the surface that could see the language
was the one being asked, and it was being asked a yes/no question.

So each surface asks whether it is the one being addressed, through two separate functions
rather than one boolean. `reachesSets` is true only for `sets-prints`; `reachesPrints` is
true for `prints` and `sets-prints`. Asking "is anything on" collapses both values into
one and is exactly what 1.1.0 did.

There is no `settings.hideForeignBlackBorder` any more. A boolean alias cannot be asked
which surface without a comparison that collapses the two modes, and that collapse is
what made `prints` do nothing at all. A feature file that wants the old name back gets a
missing property, which fails, rather than a boolean that is quietly wrong for one of the
three values.

**The test 1.1.0 needed and did not have.** Every one of the three positions is now asked
of each surface separately, on a page carrying both a set list and a prints table. Six
mutations were applied to `sets.js` and two to the model; four are caught and **two are
not, because they are equivalent** — for the Prints table, "is anything on" and "does
this reach the prints table" are the same question, so replacing one with the other
changes nothing and a test that "passed" would have passed for the wrong reason.

### What the mode exposed: two sets of names that were never Scryfall's

The category tables in the model carried a `code` and a `setName` per entry that nothing
had ever read, and both were wrong. Read from `https://api.scryfall.com/sets` on
2026-10-03:

- **`fbb` was labelled "Future Sight (FBB)".** `fbb` is a real set — a set called
  *Foreign Black Border*, 307 cards, released 1994-04-11. Future Sight is `fut`, an
  ordinary set with no border edition at all.
- **`/fourth edition/i` and `/chronicles/i` would have hidden the wrong sets.** Both match
  the ordinary `4ed` and `chr` as readily as `4bb` and `bchr`.
- **`portal` and `secret-lair` were not set codes.** Portal is `por`, and Secret Lair is a
  family: `sld`, `slc`, `slu`, `slp`, `pssc`.

The codes and the patterns are deleted rather than corrected. The worker finds these sets
by name off the same index, so a table keeping a copy of them is a copy that can disagree
with the API, and the labels now say what Scryfall says.

### And the sub-lists finally do something

The settings page has drawn a list under each of these two rules since 1.1.4 — which of
4BB, FBB and BCHR, which of Portal, Secret Lair and the rest. **Nothing in the extension
read that list.** The checkboxes were decorative, which is the same defect as a switch
that writes a key nothing reads, one level down.

The worker now answers **per category** rather than as one flat list of codes, because a
list cannot narrow a flat answer. Unticking a category now removes its sets from both
surfaces, and a test asserts it.

The one thing the Sets index cannot do is the third non-English category: every other set
that prints a language besides English is not named anywhere, and finding them means
walking their printings and reading each one's language — the oversized walk, repeated. So
the index recognises Portal and Secret Lair by name, the Prints table recognises all of
them by the printing's own language, and **the settings page says so rather than the
page implying otherwise**.

### Where this round stopped short, and why

*(Superseded by 1.1.6 below: the gap named here was closed.)*

The grouped table `prints.js` builds from the API's answer — the second Prints surface,
with its own `needsCategories` and its own excluded set — **was not covered by a check**.

---

### The hiding settings, drawn as the shape they had become

The model arrived in 1.1.0 and the page never met it. `src/core/set-filters.js` held one
grouped object, and `options.html` still drew the seven flat switches it had replaced,
writing storage keys nothing reads any more. A switch that looks on and stores into a
key that is never looked at is the same defect as 1.1.1's mode: the reader cannot tell
whether they got what they asked for, and this time it is every switch in the section
rather than two of them.

So the section is drawn from the model instead. The platforms, the two rules with a
category list under them, the four price kinds, the tokens and the Caster marker all come
out of `set-filters.js` — the page asks the model what exists and builds those rows. **A
fourth border treatment is now one line in the model**, and the settings page is right
without being told, which is the only arrangement in which that can be true.

**The master switch is a gate, and the test says it must stay one.** It stores one flag
and writes nothing under it. A master that set its sub-switches would have to be kept in
step with them, and when it is not, the master says one thing and the page does another
— so the assertion is not "the gate works" but "the gate does not touch anything below
it", which is the property that is easy to lose. A mutation that clears every sub-switch
when the gate closes is caught; so is one that stops dimming the block it governs.

Prices and tokens stay outside the gate, because the model does not put them behind it,
and a page that dimmed them would be promising something the hiding rules do not do.
That is asserted against the model rather than against the page.

### The settings page now migrates what the card page would have

The migration used to run only on a card page. **A reader who had chosen to hide all four
kinds of price and never visited one was shown the defaults** — the page was not reporting
their choice was never made, it was making it. So the settings page reads the same old
keys, runs the same migration, and draws the result. The list of keys it reads comes out
of the model, because the card page and the page that shows the values cannot be looking
at different sets of them.

The old flat controls are gone from the markup, and that is asserted as well as the new
ones being present: a control still writing `hideNonTournamentSets` would look identical
to the new one and quietly stop hiding anything.

### The English settings page had two untranslated sentences, and one was ours

The store screenshots are captured in English, because the listing and the README are in
English and a machine set to Russian had produced Russian pictures. Re-reading the tiles
after the rebuild found **a paragraph about how platforms are resolved, sitting in
Russian, in the middle of an English listing** — the sentence went into the dictionary
with different wording from the sentence in the markup, and nothing noticed.

It was found by looking at the picture, which is the second time a picture has caught
something every automated check was green about, and it is the whole reason the check
that would have caught it now exists: **every Russian sentence the page shows is compared
against the dictionary**, and the labels the model supplies are compared separately,
because those appear at run time and nothing in the markup mentions them.

Running that check over the whole page found two more sentences that were never in the
dictionary at all — the browser-following language choice and the same-tab printings
link. Both have been in the English listing for some time.

Both checks were verified by removing an entry from the dictionary and watching each one
fail with the sentence named.

### What else changed

The store screenshots are re-taken: the capture is 1280×5582 rather than 1280×4860, and
the tile descriptions were re-read off the pictures rather than left describing where the
sections used to be — they had already gone stale twice for exactly that reason.

The smoke test of the packaged settings page **was loading three scripts by name and
missing a fourth**, so the one run whose job is to say the page as shipped starts died on
an undefined property. It now reads the list out of the page's own markup, which is the
same reason the card page's test list comes out of the manifest.

---

### A switch that reads the same either way is worse than no switch

1.1.0 shipped a `mode` on two of the hiding rules, with three values: Off, Only Prints,
and Sets and Prints. The shape was right, the migration mapped the old switches onto it,
and **neither surface acted on the difference.** Two of the three places that read it were
asking a boolean alias that collapses both values into one, and the third never asked at
all.

So a reader could set "Prints only" for Foreign Black Border and could not tell whether
they got what they asked for. The rule reached the sets index and the prints table
identically, and nothing said so.

The distinction has come **out of the shape** rather than being left in it as a promise.
Both rules are plain switches again, which is what they were before, and they keep
reaching exactly what they reached before. The grouping stays, because the grouping is
the part that works and is the reason the rest was worth doing: which platforms, which
sets are junk, which price kinds, in one place with one migration beside it.

What remains is honest: a rule that has a category under it has a switch plus a list
beneath it - which of 4BB, FBB and BCHR, which of Portal, Secret Lair and the rest. When
the two surfaces are done this is the one field to widen, and widening it will be small
because everything else already lives in one file.

Trying to make it work first found two real bugs on the way, recorded in the file and
reverted with it.

`needsSetIndex` in `sets.js` and `needsCategories` in `prints.js` both asked the boolean
alias. With "Prints only" chosen the alias is false, the set index was never fetched, and
the rule did **nothing at all** on either surface. The version that looked like it worked
did not work anywhere - the same shape of bug as the oversized one, where a setting
appeared to work on exactly the cases its author had tried.

Removing the mode found a fourth bug of mine: the aliases in `core.js` still compared
against the mode strings, and with the mode gone a boolean is never 'off', so the
non-English rule read as permanently on and a whole set of printings went missing from a
test that had switched nothing on.

---

### Oversized printings were found by reading set names

"Hide oversized" did not hide most oversized printings. It was not broken in an obvious
way: the sets it knew about were the ones that really were oversized, and it marked
nothing that was not.

The rule looked for the word "Oversized" in a set name and matched a few code prefixes
like `ocmd`. Measured against Scryfall on 2026-10-02, it found **14 of the 38 sets that
actually hold an oversized printing**, and nothing it found was wrong. The other
twenty-four stayed visible, which is what a reader reported as oversized cards showing up
in the prints table with the switch on.

The reason is that **oversized is not a property of a set.** Scryfall's set object has no
field for it - checked, the fields are the fourteen a set has - and the flag is on the
printing. An oversized printing sits inside an ordinary set: a Planechase plane, a Magic
Online promo, a Commander release, a promo from 2009, a Vintage Championship. There was
nothing in `Planechase Anthology Planes` to guess from.

So the list is now built by asking Scryfall for the printings - 726 of them, five pages -
and collecting the sets they are in. The set index is still one request for `/sets` plus
this walk, still cached for a day.

Two things came out of measuring it rather than fixing it by feel:

**A set can be more than one of these.** The categories were filled down a single chain
of `else if`, so a set classified as oversized was never classified as non-tournament. A
Vintage Championship is memorabilia *and* oversized, and Magic Online Promos are digital
*and* oversized. Turning on "hide oversized" and "hide non-tournament" together used to
hide such a set once, not twice, and the second switch had nothing to do about it. The
categories are now independent.

**A failed walk must not look like a short list.** If the request for the printings fails
and the index is built anyway, the result is an index with no oversized sets in it: it
hides nothing, it looks complete, and nothing anywhere says the twenty-four are missing.
That is the original bug with extra steps. So the failure is not swallowed - it falls
through to the previous index served whole, and with no index to fall back on the request
fails rather than answering.

Five mutations were applied one at a time: guessing from the names again, guessing while
still asking (which passes on a small fixture), stopping at the first page, swallowing
the failure, and putting the categories back down one chain. All five are caught. One
earlier mutation was discarded because it could not fail - it tested a list inside a loop
that runs before that list is filled - and it had reported itself as a gap in the tests.

---

### One name is not one printing

Three defects in the clipboard, found together, because fixing the first one creates the
need for the second.

**Pressing `+` on a set page ticked every copy of that card.** A set page legitimately
shows one card as several printings - an alternate borderless beside a showcase beside
an autograph - and they all carry the same name. The selection was keyed on the name, so
adding one printing ticked all of them, and adding a second found the first and removed
it instead: you could not pick two printings of one card at all. Entries are now keyed
by set and collector number, which is what a printing actually is. The per-printing
buttons in the prints table were already keyed that way, which is why this was only ever
visible on a set page.

**The export format setting did not fully apply.** An entry added one printing at a time
carried a flag meaning "chosen as a printing", and that flag was enough on its own to put
a set on the line whatever format was asked for. Choosing "1 Card name" produced a list
in which some lines had a set and some did not, under a setting whose name promised one
or the other. The flag is still recorded - it says something true about the entry - but
the format now decides what is printed.

**Repeat names are counted.** With no set on the line, three printings of Mana Drain were
three identical lines. They now copy as `3 Mana Drain`. The counting happens only where
the lines could not be told apart: with a set on each line the printings stay apart and
the count stays one.

**The alternative button now names the format you are not using.** It was fixed at "names
only, no sets", so anyone who had chosen names in the settings had two buttons doing the
same thing and no way to reach the set format from the toolbar at all.

The card page and the Tagger page hold one clipboard between them, and each had its own
copy of these rules. They had already drifted: the card page honoured the printing flag
and the Tagger page ignored it, so a list built on one site and copied on the other came
out differently depending on which way round you did it. There is one file now,
`src/core/clipboard-format.js`, both pages load it, and it is tested on its own.

That move immediately failed, which is the interesting part. The test harness read the
script list from the manifest and then threw away everything outside `src/card-page/`, so
the new shared module was in no test at all and the only symptom was an undefined property
where a clipboard should have been. The filter is gone, `page.script()` no longer runs a
file twice, and the Tagger test now reads its list from the manifest too.

Seven mutations of the new rules were applied one at a time and every one was caught. The
first harness had a mutation that could not fail - it added a parameter and read it
without passing anything - and reported the gap as a missing test, which was the harness's
fault rather than the tests'.

---

### A new icon, drawn from a source instead of generated

The old one was a clipboard with a green clip. It was drawn by this project's own tool
and it was never anybody's mark, but it said "one feature" about an extension with
several, and at sixteen pixels the clip was a green speck on a white rectangle.

What it is now: a hammer above two wheels, in bronze, copper, wood and steel on a dark
ground. Three materials rather than one, because a mark painted in a single colour has
nothing for the eye to hold on to, which is exactly what the old one was.

The drawing is still ours and still reproduces no third-party symbol. The ground is
Scryfall's own `#16161d`, taken from their published stylesheet, and the notices now say
so in those words rather than claiming the colours came from this project's interface.

**Three of their colours were measured and one was rejected.** Their brand purple
`#634496` is the one that says "Scryfall" loudest, and it is the wrong ground for this
drawing: a dark wooden handle has to be lightened to clear 3:1 against it, and at the
pale tan that lightening arrives at, bronze, copper and wood are all the same colour.
The bar is met and the drawing is lost. Their deep purple `#551a8b` keeps the materials
apart; their ink `#16161d` keeps them apart most comfortably of all, and is what shipped.

**The tool had to grow, and it had a bug in it.** A wheel could not be drawn at all,
because only rounded rectangles existed, so circles, rings, polygons and wheels were
added, each with a vector form and a coverage test so the SVG and the PNGs still cannot
disagree. The polygon test turned out to be inverted: it asked for an edge whose ends
were on the same side of the point rather than opposite sides, so every polygon came out
backwards and the render was diagonal stripes. Nothing threw. Rounded rectangles were
the only shapes in use, which is why it survived as long as it did.

**The test suite was claiming a guarantee it did not make.** `iconArtworkTest` said the
generator must still reproduce what is shipped, and then only checked that the generator
mentions some words. It now re-runs the generator into a scratch folder and compares the
bytes. A hand-edited PNG, or a geometry change committed without re-running the tool,
now fails; both were tried, and both are caught.

---

### The deck editor's panels, in the light theme

The live pass found one thing wrong, and it was not a small thing.

Every colour in the EDHREC suggestions panel is a dark-theme colour: the card name in
`#e6e3df`, the type line in `#a29bb0`, the count in `#c9c3d4`. All thirty-three rules in
that part of the stylesheet said so — and none of them said "dark", because the background
was not among them. The panel inherited it from Scryfall's own dialog, which is white
unless this extension's dark theme is on.

While the two halves agreed the text was readable, so nothing was wrong. Set the theme to
light and they stopped agreeing: a white dialog with near-white card names. Every name in
the list disappeared while the type lines, the percentages and the Add buttons stayed
legible, which is what makes it read as a rendering fault rather than as a missing colour —
and it is why it took a person looking at a browser rather than a suite looking at a
repository.

The panels now declare their own surface next to their text. The deck editor is dark
whatever this extension's setting says, because Scryfall draws it that way and the dark
theme here only repaints what it can, so the panel is dark on both settings. The clipboard
in the corner of that page had the same cause from the other direction — a light box on a
dark page — and is now styled there from Scryfall's own `#deckbuilder` root rather than
from our switch.

**And the check that would have caught it, which nothing in the suite was.** A colour is a
statement about what it sits on, and that statement cannot be checked while the other half
of it lives in somebody else's stylesheet. So the test now reads the panel's own
background and computes the contrast ratio of every text colour against it: 13.1:1 for the
card name, 6.3:1 for the type line, 9.4:1 for the percentages. A panel set to white now
fails at 1.3:1.

The first version of that check asked only whether a background was declared, and it passed
against a white one — which is the bug, in the exact form it was reported in. It also
matched the tail of `background-color` when looking for `color`, and read the background as
the text: a contrast ratio of one to one, on a broken panel. Both of those were found by
mutating the stylesheet and watching the check not complain, which is the only way a check
about legibility can be trusted at all.

Tests: 1724 assertions pass across eight suites.

### What the store listing said about the pictures it does not have

The store screenshots were current to the byte and the document describing them was not.
It gave the capture as 1280×4896 over a capture that was 1280×4860, and its five rows
described sections where they had not been since two rounds of refactoring: "Prints" in
the second tile, Prints is in the fifth; "Hide extras with the set filters" in the third,
that is the second. The illustrations moving behind the "?" took about a thousand pixels
out of the page, and everything below that point moved up a tile while the descriptions
stayed where they were.

The dimensions and the file names are now compared against the pictures themselves — read
out of the PNG's header, because the document is the thing being checked and the picture
has to be the source. What each tile *shows* cannot be checked that way and is said out
loud in the listing instead: the descriptions are a person's reading of five pictures, and
they went stale twice while every automated check in this repository was green.

1724 assertions pass across eight suites.

## [v1.0.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v1.0.0) — 2026-10-02

The first version whose behaviour this project calls settled.

That is a promise about the extension, not about Scryfall. From here a change that alters
what a reader sees is a breaking change and gets a major number; before this, it was a
patch. Nothing about the dependency on Scryfall's markup is settled by the number — that
can change under us with no notice, which is why `docs/scryfall-dom.md` is generated from
the code and the dark theme is the one feature that depends on their class names by name.
The deck editor modules stay opt-in for the same reason, and saying so here rather than
only in a settings hint is the point of the version.

Everything below is what the five days before it were about. The store listing is the
document to read for what the extension asks for and why.

The illustrations in the settings are photographs of the real thing, and they sit behind
a "?" instead of inside the page.

**Nothing in a picture is written by hand.** The previous set was full of invented text:
a card called "Test Card", a set whose printing #6 did not exist, a commander figure of
4,823. A reader cannot tell any of that from a picture of a working feature, which is
exactly why it is wrong. Every card name, set name, collector number, price, finish and
legality in a picture now comes from Scryfall's public API, and every tag name comes from
Tagger's registry — the two sources the extension itself asks. The card is not chosen by
hand either: the tool takes the first real card that satisfies what each panel needs, a
card with tags to show, printings across several sets, and legality somewhere in the four
formats the extension adds. If none of them qualifies, the tool stops.

**What is still not real, and is written down in the tool that makes the pictures:**

- *The page.* A true screenshot needs this extension loaded into a browser, and stable
  Chrome 154 refuses `--load-extension` outright — tried headless, tried with an offscreen
  window, tried with `--enable-unsafe-extension-debugging` and with the removal flag
  turned off. The extension never appears among the targets. So the panels hang off a
  reduced card-page container of our own, and everything inside a panel is real.
- *EDHREC's deck counts.* `json.edhrec.com` answers 403 to anything outside their own
  site, so a real number cannot be fetched here. Rather than print a plausible four
  thousand decks, the section that would have shown it now illustrates the column of
  finish badges — the other thing that section promises, computed from what Scryfall
  returned.

**Three silent failures, found by looking at the pictures rather than at the code:**

- The finish column had one badge where there should be several. Not a race: a printing
  with two finishes gets an empty cell on purpose, so the tool now waits for a *number*
  of badges rather than for one.
- The legality picture showed Scryfall's own Standard and Modern and none of our work.
  The block's id lands on whichever row sorts first, and an added format goes into
  whichever row still has room — so the crop was of the wrong element, and it had been
  for as long as the picture existed.
- Two pictures came out identical, showing the same three rows, because the rows on the
  page are picked by Scryfall and happened to be ones the settings change nothing about.
  The rows now include a digital set and a non-English printing, so the picture of
  hiding shows something actually hidden.

**The "?" instead of pictures in the page.** Six large images in the body pushed the
settings they explain off the bottom of the page; the point of the settings page is the
settings. Each section heading now carries a "?" that opens the picture over the page, in
a dialog: Escape closes it, so does a click on the dimmed page behind it, and a name the
dialog does not know disables the button rather than opening an empty frame.

**And the archive was missing all six pictures.** The build walks the files to find what
they reference, and it read `<img src>` in the page — which is how the pictures travelled
before they moved into a dialog. Afterwards the only place a name appeared was a string
in `options.js`, written `../../assets/shots/x.png`, and the walker resolved strings from
the root of the extension, so a path that climbs out of its own folder became one starting
with `..` and was thrown away by the guard that stops a reference escaping the archive.
The build reported itself complete, at 4.35 MB instead of 4.73 MB. It now resolves a
climbing path against the file it is written in, and the packaged test resolves the same
names the same way and asks the archive — the check that the old one was missing.

Also in this release: the brand marks ship with the basis for using them written down
rather than a status nobody had resolved.

The illustrations are photographs of the real panels, not drawings of them. Each one
is a crop of markup the actual feature files produced, on the project's own
stylesheets, rendered by the browser already installed on the machine — the debugging
protocol, over Node's own WebSocket, because Chrome's `--screenshot` captures a window
rather than a page and `--dump-dom`, which would have let a page report its height,
prints nothing at all in Chrome 154.

That is the only version of this that can be trusted twice. A drawing drifts from the
code without anybody noticing; a picture of a panel that no longer exists is worse
than no picture, because a reader cannot tell it apart from a working one. So each
shot names the element it is about and the tool waits for it: a feature that stops
rendering is an error, not a small empty rectangle. Waiting for one thing turned out to
be not enough, though, which is the first bullet above: two of the three failures were a
picture that was not empty and not wrong in any way a check could see. There is a test
that the page, the folder and the tool never disagree about which illustrations exist,
and it now also refuses a fixture that has invented text left in it — and it earns its
keep, because a `git checkout` during a mutation test took the six figures out of the
page and it said so.

No card art is in any of them, and the extension does not ship card imagery: the panels
that matter are tables, badges and lists. What the pictures do carry is Scryfall's data —
its set names, its prices, its legalities — and Tagger's tag names, because those are the
data the features put on screen, and anything else in a picture would be a fiction.

The store screenshots were stale the moment the page changed, and there was no way to
refresh them: the listing told a reader to rebuild the tiles from a capture, and the
capture could only be taken by hand. Both halves are reproducible now.

The EDHREC and CardTrader marks stay in the release. That decision made the notices
wrong as they stood — "Unresolved" beside a file we ship is a document telling a
reader we use something we have no right to use — so what replaced it is the basis we
actually rely on: the mark names whose data is on screen, is never altered, and sits
on a control that already carries the name in words. What the notices must not say is
now checked, and so is what they must.

Three questions moved out of "waiting on someone else" into a decided section with
their reasoning kept, because the reasoning is worth more than the answer: the two
marks, the CardTrader API — narrower than it looked, since nothing is fetched without
the user's own token — and whether to alias Scryfall's class names in the scripts. That
last one is no, and the reason is the shape of the failure: an indirection layer turns a
renamed class into a lookup returning undefined, and a null from querySelector is a
silent no-op.

### On the real page

The stage was the problem, not the panels. They were being built on a card-page-shaped
container of ours, with our own stylesheets and no Scryfall CSS — which is why the tag
names came out as giant purple underlined serif links, the panels sat at no proportion to
anything, and the whole thing was light while the product is dark. A reader who knows the
extension sees a picture of a different program.

Scryfall serves the whole page as plain HTML with one stylesheet, and both are reachable.
So the stage is now the page: their markup, their stylesheet inlined, our theme on top, and
our panels where our own feature files put them — which, checked, is exactly where they
sit in the reader's own screenshot. Card and tags come from that page's printing, so the
panel cannot show one card's tags beside another card's name.

Still not the extension running in a browser: Chrome 154 refuses `--load-extension`, so
nothing here is our service worker talking to a live page. The feature files are the same
ones the extension loads and the two APIs are the same ones it asks. Scryfall's scripts
are stripped; their markup and stylesheet are not.

Four things that were wrong only because nothing looked at the pictures:

- the extension's own icons are named `chrome-extension://…`, which resolves to nothing
  when the page is rendered from disk, so every icon came out as a broken-image box;
- the clipboard is an aside the height of the page, so cropping it gave a strip of empty
  page with two rows of interest at the top, floating over the card's own text;
- the legality block sits beside the artwork, so the ten pixels of slack the crop gives
  every panel was a strip of somebody's card along the edge;
- a card's printings table is a hundred rows long, which is not an error — so the length
  that meant "something has no size" and the length that means "cut it here" are two
  different checks, and the cut is printed when it happens.

### Two bugs, and both of them were in the tool

Worth stating plainly, because the question is the obvious one: **the extension had no bug
in any of this.** The pictures disagreed with the product, and the product was right.

One of the two was found by looking at a picture. Ten printings appeared twice in the
group they belong to — `#7010`, `#1933`, `#1589` and seven more — which reads as a table
that adds what Scryfall has already drawn. The cause was in the fixture, not the table: it
sent each printing's API address where the worker sends the address of the card's *page*,
and the table decides "has Scryfall already listed this?" by comparing that address with
the rows on the page. An API address matches no row, so every printing already on the
page was added again. The picture was simultaneously faithful to a defect that did not
exist and wrong about the product — the worst kind of wrong, and one that no amount of
checking the *values* would ever have found.

The other was the mirror image: `oracleid:` search appeared to return one printing, which
would have meant the extension's whole print grouping was broken against the live API. It
returns 88 printings of Counterspell. The single-printing answer came from asking without
`unique=prints`, which is what the fixture did and the worker does not. The three
addresses that genuinely return one printing each are listed in the tool, so the next
person does not spend an afternoon on them.

And the check that found the first one had to be written twice. It keyed on
`data-card-id` — which the duplicated row does not have, because that is exactly why it was
duplicated. It passes over the defect it was written for. It now keys on the label a reader
sees, and it was verified by breaking the fixture on purpose: the tool fails with the ten
duplicates named.

### The error a reader reported

```
Unchecked runtime.lastError: This function must be called during a user gesture
```

On every visit to the settings page. This one is in the extension, not in the tooling, and
it was two mistakes stacked.

The settings page checked whether an enabled feature had the host it needs, and asked for
the missing one — while the page was loading, from inside the callback of
`permissions.contains`. Chrome grants an optional permission only from within a gesture,
and by that point there is no gesture left to ask with, so the request is refused.

Then the refusal arrives. Chrome delivers it through the callback and not as a throw, so
the `try`/`catch` around the call caught nothing. And nobody read
`chrome.runtime.lastError`, which is the part that turned a refusal into a *console line*:
Chrome prints any error that is left unread as "Unchecked", on every load, forever. The
comment above that call said the request was refused silently "by design". It was refused
loudly, at the reader, and the design was wrong.

So the page asks for nothing on load. It reports instead: which features are on without a
host, named as the interface names them rather than as storage keys — a reader with EDHREC
on and CardTrader off is missing one host, and "two" would send them hunting for a switch
that is deliberately off. The button that grants access is marked on the page so it is
findable, and it is the only thing that asks. Where the browser refuses even to ask, that
is now said, because it is a different problem from a reader clicking "no" and it used to
be reported as one.

The same unread error was in the popup's helper, where it is unreachable in practice — the
call is inside a click — and is fixed anyway, because the cost of the guard is one line
and the cost of the bug was a console line on every page.

The test that holds this down records what the old code did: the mock browser refuses the
question the way Chrome does, remembers whether the refusal was read, and the check is
that it was. Verified by putting the old code back — the page then throws on load, which
is the loudest way it could fail.

### The picture on the project page

The README led with a 1280×4860 strip of the settings page — at the width a README is read
at that is a line, not a picture — and it was **in Russian**, because the settings page
takes its language from storage or else from the browser, and the machine that took the
capture is set to Russian. The README is English and so is the store listing, so a reader
of either was looking at a page in a language nobody asked for. The capture now stores
`settingsLanguage: 'en'`; the page has no other way to be told, which is why this was a
tool change and not a switch someone remembered to flip.

The README now opens with what the extension does rather than what it is configured to do:
four pictures cut from a real Scryfall card page — printings grouped by set with finish
badges, the tag tables, the legality block with Premodern added, the clipboard. Its
sentence about "a picture beside each switch" described a layout the page no longer has,
since the pictures moved behind the "?".

Two checks hold this down: every picture the README names must exist, and the capture must
be a picture rather than a strip. Both were verified by breaking them.

### The documents had started to disagree with each other

An external review of the repository found six defects, and they were all in this project's
own paperwork rather than in its code. Worth recording because the shape of the problem is
the point: **every value in those documents was correct.** What was wrong was that two
places said two different things about the same fact, which no test that reads one file can
see.

- `THIRD_PARTY_NOTICES.md` said "only the first is settled, the unresolved status in
  sections 7 and 8 is the real status" while sections 7 and 8 stated a settled position.
  A document that claims two incompatible things about a licence is worse than one that
  claims nothing: a reader cannot tell which half to believe.
- The same file still listed, as open questions, three things the road map had already
  decided. A list of settled questions next to a file we ship reads as doubt about it.
- The notices said the deck editor modules were off by default "because neither has yet
  been checked against a live deck editor", while the road map recorded that all three were
  used in a real commander deck on 2026-10-01. That is not a stale detail — it tells a
  reader the code has never run.
- `PRIVACY.md` said version 0.51.0 while the code was at 0.58.0, because it was the one
  release-facing file `set-version` did not write. The version is gone from the policy
  rather than synchronised: the policy changes when the code changes, and a number beside
  the date says nothing a reader can act on.
- The road map's "waiting on someone else" had the same two rows twice.
- `README.md` still licensed `content-*.js`, a file prefix removed when the scripts were
  split, and the notices and store listing still named `content.js`.

So the facts are now written down once, in `tools/project-status.cjs`, with what each
document **must** say and — the half that matters — the wording that would put the old
position back. `node tools/project-status.cjs` reports; the package suite asserts. It
generates no prose: these documents are read by people deciding whether to trust the
project, and a generated status block reads like a machine talking.

### A release checklist, because the tests cannot see Scryfall

The review's other point is right and worth acting on: this project's suites check
repository invariants, and every one of them can pass while the extension is broken on
Scryfall's own site. Scryfall can change its markup or its application internals with no
deprecation cycle, and the live pass on 2026-10-01 already found four wrong assumptions that
1659 assertions could not.

`docs/RELEASE_CHECKLIST.md` is that pass, written down: ten minutes in a browser, seven
things to look at, then the order to run the tools in and the rule that the release archive
comes from the tag rather than from a laptop. It also lists the limits that are **not**
defects — the theme's dependence on their class names, the deck modules' dependence on
undocumented internals, and why the settings illustrations are not a photograph of the
extension running — so that finding one during a pass is a decision rather than a surprise.

### Work that had not been pushed

Six commits from the previous rounds were committed and never pushed. The working tree
was clean, every suite was green, and the project page was still showing a version from a
week earlier. Nothing in a test suite can catch this: a test can prove a commit exists and
has no way of knowing whether it left the machine, and "the tree is clean" reads like
"the work is done" when it means only the first.

The version came out of the README title for the same reason. A number there is a promise
the page cannot keep — `main` moves every day and the releases move only when somebody
tags — so the page said 0.58.0 while the newest release was 0.51.0, and both were true.
The title is now just the name, the version tool no longer writes it, and the test checks
for the opposite: that a version has not crept back in. The store listing keeps its number,
because that is the document a reviewer holds against a submitted archive.

And the seventh defect, found by reading the rendered project page rather than the file:
the README's licence table still said the two brand marks were "not cleared", which is the
wording this project left behind five releases ago and which the notices no longer use. It
is now checked in the README too, and the check was verified by putting the sentence back.

### The theme, in seven files

The dark theme was one 753-line stylesheet. It is seven files now, under
`src/styles/theme/`: the card page, shared pages, the account and marketing pages,
surfaces, Tagger, more shared surfaces, and our own panels. The manifest lists them in
cascade order, because CSS only knows the order a stylesheet is loaded in — moving a
rule from one part to another can change which of two equally specific rules wins.

The split is contiguous, not grouped by page. That was the constraint worth
understanding: a stylesheet cannot be reorganised by what a rule is about without
changing what it does, and no amount of care afterwards gets that back. So the parts
are unbroken runs of the original, and the boundaries are placed where a run of rules
settles on one subject. `tools/css-write-parts.cjs` puts the parts back together and
compares the result with the file they came from, character for character; the
contract document came out with the same 361 class names and the same 404 rules.

Each part carries the MPL notice in its own header. Seven files are one work under one
licence, and a notice in the first part is a notice about six sevenths of the
stylesheet that nobody would find.

`docs/scryfall-dom.md` now names the part each dependency is written in, which is the
question the split was made to answer: when Scryfall renames a class, one file to open.
It is generated, and a test runs the generator and fails if the committed document is
not what it produces, so a rule that moves without the document moving says so.

The checks that read the theme read it as the concatenation, in manifest order, through
one harness function. Six of them read a single file before, and after the split a
check that read one part would have been checking a page of the theme and calling it
the theme.

## [v0.52.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.52.0) — 2026-09-29

The EUR column is now headed by Cardmarket's own symbol, cropped from the logo files they
publish for download and used on their terms. Before that the slot held a glyph lifted
from Scryfall's page markup, which was nobody's to lift. And three of Shambleshark's deck
modules are shipped — the clean up improver, EDHREC suggestions and Scryfall search. Two were written rather than copied: the EDHREC one goes
to their published JSON instead of Shambleshark's hidden iframe, and the search goes
through this extension's queue instead of out of the page. All three need Scryfall's own
page world rather than the page markup, so the extension has a script there, an adapter
over Scryfall's internals and a bridge back to the content script. All three ship switched
off, because none has been checked against a live deck editor.

## [v0.51.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.51.0) — 2026-09-28

What an outside review found: the EDHREC rate limit was not actually enforced, its cache
and backoff did not survive a service worker restart, the language setting destroyed
itself, `package.json` claimed the wrong licence, there was no CI, and 12 MB of tag data
was parsed on every worker start. Optional features now take optional permissions.

## [v0.49.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.49.0) — 2026-09-28

New defaults, EDHREC's published data policy, and a README that answers first instead of
last. The settings language follows the browser; the Prints group moved into
Experimental rather than rewriting Scryfall's table unasked.

## [v0.48.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.48.0) — 2026-09-28

The last of the dark-theme reports from use, and a smoke test of the package: it builds
the archive, unpacks it and turns it on. Store screenshots re-shot from the current
settings page.

## [v0.47.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.47.0) — 2026-09-28

Dark theme fixes from use: white flashes while a page loaded, three black mana symbols,
a lost purple on the docs sidebar, a missing row highlight, a white block in the narrow
search controls, a grey slab by the deck button, an unreadable team page title, and black
text in a dropdown.

## v0.46.0 — not released

Toolbar popup with the five switches reached for most, and the name stops calling a
released extension a preview. Superseded by 0.47.0.

## [v0.45.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.45.0) — 2026-09-28

Fixes the settings page that 0.44.0 shipped without its stylesheet or script. The build
now reads the archive back instead of the working folder.

## [v0.44.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.44.0) — 2026-09-26

MPL-2.0 for this project's own code, a privacy policy, third-party notices, and the
Chrome Web Store submission materials. The settings page is broken in this build; use
0.45.0 or later.

## [v0.43.0](https://github.com/Solomag/scryfall-toolkit/releases/tag/v0.43.0) — 2026-09-25

Provenance and licensing audit: every external origin checked against the repository
rather than the old README, with per-file attribution and a packaging step that fails
when a licence or notice is missing from the archive.
