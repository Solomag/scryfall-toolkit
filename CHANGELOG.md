# Changelog

An index of what each release was about. The detail lives in the release notes for that
version, and is not repeated here — a copy of them would drift, and this file's only job
is to answer "what changed and where do I read about it".

All releases: <https://github.com/Solomag/scryfall-toolkit/releases>

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
