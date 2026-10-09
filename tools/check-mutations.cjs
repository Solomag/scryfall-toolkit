'use strict';
// The mutations each check must catch, so a claim about coverage is not taken on trust.
//
// Two of these are here because they slipped through something. `deckButtonPlace` put the
// buttons back into the hidden sidebar and both `npm run render` and `npm test` passed: the
// render tools cannot see the decision (the features run in the harness and the browser only
// draws what they left) and the suites had never been asked. And a Secret Lair name pattern
// that no longer matched anything would have been reported as covered by everything, because
// the tools that classify sets each kept their own copy of the patterns — the copy that
// drifted, and the reason `tools/shots/worker-tables.cjs` exists. Both patterns are gone with
// the rules that read them, and the three that replaced the border-family ones below are about
// the shape's own new failure: nine switches where there used to be three, so the obvious
// mistake is reading one platform's answer for all three, and it is silent.
//
// The five added for the Caster marker are about a narrower version of the same thing: a
// boolean whose sense changed, where the key was renamed so the two can be told apart, and
// where every wrong reading is silent. The marker's polarity on the card page, the migration
// that renames it, the shape read back through the wrong key, and the two ways a platform that
// is switched off could quietly throw its reader's choices away — all of them draw a page and
// change nothing a reader would be shown.
//
// The four after those are the settings page's layout, and they are caught by reading a
// stylesheet rather than by rendering it. Each removes a rule a requirement names — the
// narrow-window block in the wrong place, the border on a switched-off platform's places, the
// switch's knob left in an unticked box, the two columns collapsing — and the assertion that
// fails is the one that names it. That is weaker than a rendering and it is not pretended
// otherwise: nothing in this repository draws the settings page and checks it.
//
// The eight after those are the same page's behaviour, and they are real: a panel that starts
// open, a disclosure that writes to storage, a reset that takes the other feature's numbers with
// it, a feature that offers its switch before it has what it needs. Each of them leaves a page
// that works and reads correctly, which is why they are mutations rather than tests that cannot
// fail — and the euro column's two are the price that had no switch at all until this round.
//
// So each mutation names the check that must notice it, and this file fails if none does.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const TARGETS = {
  css: path.join(ROOT, 'src/styles/content.css'),
  sets: path.join(ROOT, 'src/card-page/sets.js'),
  setsPage: path.join(ROOT, 'src/card-page/sets.js'),
  core: path.join(ROOT, 'src/card-page/core.js'),
  prints: path.join(ROOT, 'src/card-page/prints.js'),
  prices: path.join(ROOT, 'src/card-page/prices.js'),
  options: path.join(ROOT, 'src/ui/options.js'),
  model: path.join(ROOT, 'src/core/set-filters.js'),
  theme: path.join(ROOT, 'src/core/theme.js'),
  optionsCss: path.join(ROOT, 'src/ui/options.css'),
  optionsHtml: path.join(ROOT, 'src/ui/options.html'),
  deck: path.join(ROOT, 'src/card-page/deck-lists.js'),
  worker: path.join(ROOT, 'src/background/worker.js')
};
const before = {};
for (const [key, file] of Object.entries(TARGETS)) before[key] = fs.readFileSync(file, 'utf8');

const MUTATIONS = [
  {
    name: 'tag icons with no size of their own',
    file: 'css',
    run: 'render-card',
    find: '#stk-tags .stk-card-table .stk-tag-icon svg{padding:4px!important;overflow:visible!important}',
    replace: '#stk-tags .stk-card-table .stk-tag-icon svg{padding:4px!important;overflow:visible!important;' +
      'width:100%!important;height:auto!important}',
    expect: 'icon-sized rather than filling its cell'
  },
{
    // Whether anything is hidden at all, which is what decides whether the set index is fetched
    // and whether the feature boots. With one rule there is one line here, and reading it the
    // wrong way round stands the whole feature down: the page looks filtered and nothing moves.
    name: 'the boot decision reads the rule as still on',
    file: 'core',
    run: 'test',
    find: 'return filteringOn(\'prints\') || filteringOn(\'sets\') || filteringOn(\'search\');',
    replace: 'return !(filteringOn(\'prints\') || filteringOn(\'sets\') || filteringOn(\'search\'));',
    expect: 'the one digital set the index places on Arena is marked'
  },
  {
    // The per-printing platform. Answering it from the set is what made turning Arena off lose
    // the paper printing of a set that was on both, and this is the line that moved.
    name: 'a printing is placed by its set rather than by itself',
    file: 'model',
    run: 'test-model',
    find: 'return games.some(game => chosen.includes(game));',
    replace: 'return true;',
    expect: 'a Magic Online printing is gone when only Arena is kept'
  },
  {
    name: 'the deck button goes back into the hidden sidebar',
    file: 'deck',
    run: 'test',
    find: 'if (shown(sidebar)) return sidebar;',
    replace: 'if (sidebar) return sidebar;\n    if (shown(sidebar)) return sidebar;',
    expect: 'not the unreachable one inside the hidden sidebar'
  },
{
    // The worker's answer stops naming the digital sets. The rule that reads it then sees an
    // empty list, removes nothing, and looks switched on — which is the failure this whole
    // shape of bug has been about, and the reason the cache guard in `loadSetCategories`
    // names the list rather than assuming it.
    name: 'the worker stops answering with the digital sets',
    file: 'worker',
    run: 'test-background',
    find: 'if (set.digital === true) categories.digital.push(String(set.code).toLowerCase());',
    replace: 'if (set.digital === true) { /* Scryfall says digital; nothing is recorded */ }',
    expect: 'the worker answers with the digital sets and nothing else'
  },
  {
    // The five pages of `is:oversized` the worker used to walk on every rebuild of the day.
    // Nothing reads the list it produces, so a walk creeping back in costs a reader a thousand
    // requests a day and buys an answer nobody asked for — and the fixture routes the request
    // so that it shows up as pages in a log the test asserts is empty.
    name: 'the worker walks the oversized printings again',
    file: 'worker',
    run: 'test-background',
    find: 'const result = await scryfallJSON(\'https://api.scryfall.com/sets\',',
    replace: 'await oversizedSetCodes();\n      const result = await scryfallJSON(\'https://api.scryfall.com/sets\',',
    expect: 'the worker answers with the digital sets and nothing else'
  },
  {
    // The three treatment fields the analogue comparison needed, which nothing reads now. A
    // build that puts one back would be answering a question the settings page does not offer,
    // and the payload would grow on every card page for it.
    name: 'the worker starts sending a treatment field again',
    file: 'worker',
    run: 'test-background',
    find: 'games: Array.isArray(card.games) ? card.games.slice().sort() : []',
    replace: 'games: Array.isArray(card.games) ? card.games.slice().sort() : [],\n' +
      '            frame: card.frame ?? null',
    expect: 'scryfall print fields are renamed for the content script'
  },
  {
    // The places are per platform, and the mutation that matters is one platform's place being
    // read for all three. With one shared list the whole group was a single answer and this was
    // impossible to get wrong; with nine switches, reading the wrong platform's three is the
    // obvious mistake and it is silent — the page is drawn and the wrong sets are gone.
    name: 'every platform reads one platform\'s places',
    file: 'core',
    run: 'test',
    find: 'hiding.platforms[name]?.show === true && hiding.platforms[name]?.areas?.[area] === true);',
    replace: 'hiding.platforms[name]?.show === true &&\n' +
      '    hiding.platforms[\'paper\']?.areas?.[area] === true);',
    // The search dropdown is where one platform's place read for all three shows first: the
    // Arena place is answered on the search surface, and reading Paper's instead keeps the
    // Arena set in the list.
    expect: 'one platform out of the search place takes its set out of the dropdown, leaving the Arena set'
  },
  {
    // And the other way: one platform's *switch* read for all three, which is what a reader
    // would see if "keep Arena everywhere" quietly became "keep Arena on the table only".
    name: 'one platform\'s switch is read for all three',
    file: 'core',
    run: 'test',
    find: 'const platformsOn = area => PLATFORM_NAMES.filter(name =>\n' +
      '    hiding.platforms[name]?.show === true && hiding.platforms[name]?.areas?.[area] === true);',
    replace: 'const platformsOn = area => PLATFORM_NAMES.filter(name =>\n' +
      '    hiding.platforms[name]?.show === true && hiding.platforms.arena?.areas?.[area] === true);',
    // The prints place is the surface that catches this one: Paper's place is switched off
    // there alone, and reading Arena's instead keeps Paper in the table, so the paper rows
    // never go.
    expect: 'paper rows hidden by the place'
  },
  {
    // The one shared list of places becoming three is the migration this shape needed, and the
    // mistake it can make is losing the reader's answer: writing it to one platform instead of
    // all three would quietly reset the other two on their next page load.
    name: 'the shared list of places reaches one platform only',
    file: 'model',
    run: 'test-model',
    find: '        areas: { ...areas }\n      };',
    // Not `if (platform !== 'paper') return;`: that leaves the other two platforms with no
    // `areas` at all, and the suite then dies with a TypeError instead of an assertion. A
    // mutation has to break a claim, not the run.
    replace: '        areas: platform === \'paper\' ? { ...areas } :\n' +
      '          { ...defaults().platforms[platform].areas }\n      };',
    expect: 'the one shared list became every platform, unchanged'
  },
  {
    // The price inversion, in the one place it happens. Reading the current shape's prices as
    // if they were the old shape's would hide every price a reader had switched on, on their
    // first page load after an update — and the four boxes on the settings page, which read
    // the stored value, would all be unticked while every price was still on the page.
    name: 'the model inverts the prices of a value already in the current shape',
    file: 'model',
    run: 'test-model',
    find: '    if (typeof input.showCaster === \'boolean\') return normalise(input);',
    replace: '    if (typeof input.showCaster === \'boolean\') return normalise({ ...input, prices: invertPrices(input.prices) });',
    expect: 'a value already in the current shape keeps its prices exactly as stored'
  },
  {
    // And the other direction: the current shape read without inverting, which is what a build
    // that forgot the change entirely looks like. A reader who had prices hidden would find
    // them all shown instead.
    name: 'the older shapes keep their prices un-inverted',
    file: 'model',
    run: 'test-model',
    // The 1.4.x branch specifically, named by the `const out =` in front of it: both older
    // branches invert, and `String.replace` rewrites only the first match, so a mutation
    // written against the bare line would land on the other one and prove nothing about this.
    find: '    const out = normalise({\n      platforms: input.platforms,\n' +
      '      prices: invertPrices(input.prices),',
    replace: '    const out = normalise({\n      platforms: input.platforms,\n' +
      '      prices: input.prices,',
    expect: 'the price switches outside the group, each inverted from how that shape stored it'
  },
  {
    // The Caster marker, whose switch stopped reading "hide". The key was renamed rather than
    // the boolean flipped in place, because a stored boolean cannot carry two senses and a
    // reader who had the marker hidden would find it shown on the first page load after an
    // update. This is the line that does the renaming.
    name: 'the 1.6.x branch keeps the Caster marker the old way round',
    file: 'model',
    run: 'test-model',
    find: '        showCaster: typeof input.caster === \'boolean\' ? !input.caster : undefined',
    replace: '        showCaster: typeof input.caster === \'boolean\' ? input.caster : undefined',
    expect: 'a stored "hide the marker" from 1.6.x stays hidden, so relabelling it changes nothing'
  },
  {
    // And `normalise` reading the old key, which is the other half: the branches above write
    // `showCaster`, and a `normalise` that looked for `caster` would discard it and land every
    // reader on the default — the marker shown, whatever they had chosen.
    //
    // Named by the assertion that fires, not by the one about the current shape. A suite stops
    // at its first failure, so an `expect` naming a later assertion reports "not caught" for a
    // mutation that was caught three assertions earlier.
    name: 'the current shape is read through the key it no longer stores',
    file: 'model',
    run: 'test-model',
    find: '    if (typeof input.showCaster === \'boolean\') out.showCaster = input.showCaster;',
    replace: '    if (typeof input.caster === \'boolean\') out.showCaster = input.caster;',
    expect: 'and the two others, with the Caster marker inverted from hide to show'
  },
  {
    // The polarity on the card page. The model stores "show" and the class is its opposite, so
    // reading the key the other way round hides the marker for every reader who left the box
    // ticked — and the box is ticked by default, so that is everyone.
    name: 'the Caster class is toggled from the marker key without the inversion',
    file: 'theme',
    run: 'test-theme',
    find: 'document.documentElement.classList.toggle(\'stk-hide-caster\',\n' +
      '    !(changes.setFilters.newValue?.showCaster !== false));',
    replace: 'document.documentElement.classList.toggle(\'stk-hide-caster\',\n' +
      '    changes.setFilters.newValue?.showCaster !== false);',
    expect: 'storage change restores caster indicator'
  },
  {
    // A platform switched off, and the page tidying up after itself: writing the three places
    // as they are drawn rather than as they are stored. The stored value would then say the
    // places were off, and the platform would come back empty — the one thing "turning a
    // platform off keeps its settings" must not mean, and a mutation that is invisible on the
    // settings page because that page is showing the tidied value.
    name: 'a platform that is off writes its places into storage',
    file: 'options',
    run: 'test-options',
    find: '      box.checked = on && filters.platforms[name].areas[area] !== false;\n' +
      '      box.disabled = !on;',
    replace: '      box.checked = filters.platforms[name].areas[area] !== false;\n' +
      '      filters.platforms[name].areas[area] = box.checked;\n' +
      '      box.disabled = !on;',
    expect: 'and leaves its three places exactly as they were, while it is off'
  },
  {
    // And the boxes staying clickable while the platform is off. The reader could then answer a
    // question about a platform that is not in force, and the answer would be stored as though
    // it applied — which is the same silent loss with a different trigger.
    name: 'the places of a platform that is off are still editable',
    file: 'options',
    run: 'test-options',
    find: '      box.checked = on && filters.platforms[name].areas[area] !== false;\n' +
      '      box.disabled = !on;',
    replace: '      box.checked = on && filters.platforms[name].areas[area] !== false;\n' +
      '      box.disabled = false;',
    expect: 'its three place boxes are drawn empty and disabled'
  },
  {
    // A removed rule still being read is the failure the removal was supposed to prevent, and it
    // is silent in the worst way: the page is drawn, the storage still holds the field, and
    // nothing says the setting stopped working.
    name: 'the model reads a removed rule again',
    file: 'model',
    run: 'test-model',
    find: 'if (typeof stored.show === \'boolean\') out.platforms[platform].show = stored.show;',
    replace: 'if (typeof stored.show === \'boolean\') out.platforms[platform].show = stored.show;\n' +
      '      if (stored.ancillary === false) out.platforms[platform].areas.prints = false;',
    expect: 'the removed rules are not read by normalise'
  },
  {
    // The narrow-window rules written above the rules they override. This is the defect the
    // rework actually shipped and the tests actually passed with: a media query adds no
    // specificity, so the block lost to the base rule below it, the file still contained it, and
    // the heading stayed clipped mid-word on a phone. The mutation puts a second copy of the
    // block in front of the base rule, which is what writing it in the wrong place looks like.
    name: 'the narrow-window table rules are written above the rules they override',
    file: 'optionsCss',
    run: 'test-options',
    find: '.platform-table{border-collapse:collapse}',
    replace: '@media (max-width:720px){\n' +
      '  .platform-table thead th{padding:0 4px 6px;font-size:11px}\n' +
      '}\n.platform-table{border-collapse:collapse}',
    expect: 'the narrow-window rules sit after the table rules they override'
  },
  {
    // The places of a platform that is switched off, losing the border that makes them readable.
    // Without it they fall back to the page-wide rule that dims a disabled switch to an opacity,
    // which is the state the brief says they must not be in — and the contrast against an
    // unticked box is the whole message, so losing the border loses that too.
    name: 'the disabled places of a switched-off platform lose their border',
    file: 'optionsCss',
    run: 'test-options',
    find: '  background-color:#232229;border-color:#3b3642;opacity:1;cursor:default;',
    replace: '  background-color:#232229;opacity:1;cursor:default;',
    expect: 'and the disabled places keep a border and a recessed fill instead of an opacity'
  },
  {
    // The switch's knob coming back on an unticked box. The page draws it as a radial gradient in
    // `background-image`, and a rule that only recolours the box leaves the gradient standing —
    // which is a grey circle in the middle of a square, the exact thing the brief asks about.
    name: 'the switch knob is left in the unticked box',
    file: 'optionsCss',
    run: 'test-options',
    find: '  background-color:transparent;background-image:none;background-repeat:no-repeat;',
    replace: '  background-color:transparent;background-repeat:no-repeat;',
    expect: 'and the switch knob\'s gradient cleared in the base rule *and* in :checked'
  },
  {
    // And the grid going back to one column, which is the whole of the layout this round is
    // about: the card is 880px wide and the settings are four short lines, so one column leaves
    // two thirds of it empty.
    name: 'the two columns collapse to one at every width',
    file: 'optionsCss',
    run: 'test-options',
    find: '.visibility-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:32px;align-items:start}',
    replace: '.visibility-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:32px;align-items:start}',
    expect: 'the card is two columns, the table\'s a little wider than the prices\', 32px apart'
  },
  {
    // The shop that owns a column, gone from the model the settings page draws its boxes from.
    // Nothing else would notice: the page would draw four price boxes and look exactly as it did
    // before, and the euro column would have no switch again.
    name: 'the Cardmarket switch is gone from the model again',
    file: 'model',
    run: 'test-options',
    find: '    cardhoarder: { label: \'Cardhoarder\', group: \'links\' },\n' +
      '    cardmarket: { label: \'Cardmarket\', group: \'links\' }',
    replace: '    cardhoarder: { label: \'Cardhoarder\', group: \'links\' }',
    expect: 'and each holds the kinds the model put in it'
  },
  {
    // And the migration that walks the model's price keys instead of naming the four. Cardmarket
    // *is* the euro column, so the old "only Cardmarket" switch would hide the very shop it is
    // named after — a reader who had it on would lose the euro column on their first page load
    // after an update, silently.
    name: 'the only-Cardmarket migration hides the euro column it is named after',
    file: 'model',
    run: 'test-model',
    find: '      for (const price of [\'usd\', \'tix\', \'tcg\', \'cardhoarder\']) out.prices[price] = false;',
    replace: '      for (const price of Object.keys(out.prices)) out.prices[price] = false;',
    expect: 'onlyCardmarket becomes the four other price kinds off together, and leaves the euro column'
  },
  {
    // A disclosure that starts open. The section would still work and every setting in it would
    // still be right, which is why this is worth a mutation: it makes the section a form to fill
    // in again, and that is the thing this shape exists to stop being.
    name: 'a panel starts open instead of collapsed',
    file: 'optionsHtml',
    run: 'test-options',
    find: '<div class="feature-panel" id="edhrecUsagePanel" hidden>',
    replace: '<div class="feature-panel" id="edhrecUsagePanel">',
    expect: 'every panel starts hidden, whatever the feature it belongs to is set to'
  },
  {
    // And a disclosure that writes to storage when it is opened, which would make looking at a
    // panel a decision. Every disclosure on the page goes through this one handler now, so the
    // first test to open one — diagnostics, which is opened to be read — is the one that
    // catches it, and the same handler covers the cleanup panel and the two in Additional info.
    name: 'opening a panel writes to storage',
    file: 'options',
    run: 'test-options',
    find: '      const open = panel.hidden;\n' +
      '      panel.hidden = !open;\n' +
      '      button.setAttribute(\'aria-expanded\', String(open));',
    replace: '      const open = panel.hidden;\n' +
      '      panel.hidden = !open;\n' +
      '      chrome.storage.local.set({ finishBadges: true });\n' +
      '      button.setAttribute(\'aria-expanded\', String(open));',
    expect: 'and none of that touched a setting'
  },
  {
    // A reset that takes the whole section rather than its own feature's numbers. The two resets
    // are the only controls here that write more than one key, so they are the only place this
    // can go wrong — and the numbers it would take with it are the other feature's.
    name: 'the popularity reset reaches into the Salt settings',
    file: 'options',
    run: 'test-options',
    find: '  resetFeature(\'resetUsage\', [\'edhrecUsageDisplay\', \'usageColorMetric\',',
    replace: '  resetFeature(\'resetUsage\', [\'saltMediumThreshold\', \'edhrecUsageDisplay\', \'usageColorMetric\',',
    expect: 'while the Salt thresholds are exactly where the reader left them'
  },
  {
    // CardTrader offering its switch before it has the token that makes it work. The switch would
    // save, the card page would ask for prices, and the worker would refuse — a feature that
    // looks on and does nothing, which is the state the requirement names.
    name: 'CardTrader offers its switch without a token',
    file: 'options',
    run: 'test-options',
    find: '    cardtraderMain.classList.toggle(\'is-unconnected\', !stored);',
    replace: '    cardtraderMain.classList.toggle(\'is-unconnected\', false);',
    expect: 'and the switch is hidden, not merely disabled'
  },
  {
    // A feature row's label restating the layout the page's own label rule already gives it. The
    // page rule is more specific, so the number here is one the browser never uses — a rule that
    // reads as if it were doing something and is not, which is the class of mistake this file
    // keeps finding.
    name: 'the feature row restates a layout the page already gives it',
    file: 'optionsCss',
    run: 'test-options',
    find: '.feature-main{flex:1 1 auto;min-width:0;margin:0;font-size:14px;color:#e9e5ee;cursor:pointer}',
    replace: '.feature-main{display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0;margin:0;font-size:14px;color:#e9e5ee;cursor:pointer}',
    expect: 'and does not restate the flex, the centring or the gap'
  },
  {
    // The bug a reader reported, restored: the shop map read by its key instead of by its value.
    // `tcgplayer` is the hostname and `tcg` is the model's key, so the TCGplayer links were never
    // hidden — and Cardhoarder's worked only because its hostname and its key are the same word,
    // which is why one case passing is not the group passing.
    name: 'the shop map is read by its key instead of by its model key',
    file: 'prices',
    run: 'test',
    find: '    const hiddenShops = Object.keys(shops).filter(shop => setFilters.prices[shops[shop]] === false);',
    replace: '    const hiddenShops = Object.keys(shops).filter(shop => setFilters.prices[shop] === false);',
    expect: 'turning TCGplayer off hides the TCGplayer link, which it did not do before'
  },
  {
    // And the advanced search filter dropping the euro option for the wrong reason — or not at
    // all. The option is Scryfall's `eur` and the source is one of four words, so the two are
    // compared as words; a filter that treats them as the same thing leaves the euro search
    // standing when the reader has said they want no euro price.
    name: 'the advanced price filter ignores the EUR source',
    file: 'prices',
    run: 'test',
    find: '        if (option.value === \'eur\') {\n' +
      '          if (noEuro) option.remove();\n' +
      '          else option.textContent = \'Cardmarket (€)\';\n' +
      '          continue;\n' +
      '        }',
    replace: '        if (option.value === \'eur\') {\n' +
      '          option.textContent = \'Cardmarket (€)\';\n' +
      '          continue;\n' +
      '        }',
    expect: 'and the euro search goes with the EUR source being "show nothing"'
  },
  {
    // The general switch over the store block, doing nothing. A reader who hid the whole block
    // would keep the heading, the disclaimer and the three links — the switch would save and
    // change nothing on the page, which is the shape of bug this file keeps finding.
    name: 'the whole store block is never hidden',
    file: 'prices',
    run: 'test',
    find: '    if (setFilters.showStores === false) stores?.classList.add(\'stk-price-hidden\');',
    replace: '    void setFilters.showStores;',
    expect: 'and hiding it hides the whole block, heading and all'
  },
  {
    // And the same switch never booting the feature that would hide it. `priceFilter` is gated on
    // "something is hidden", and the block is not a price kind, so it cannot be found by walking
    // them — a reader who hid the block and nothing else gets a switch that saves and does nothing.
    name: 'the store block switch does not boot the price filter',
    file: 'core',
    run: 'test',
    find: '["priceFilter", () => settings.onlyCardmarket || settings.showStores === false, false],',
    replace: '["priceFilter", () => settings.onlyCardmarket, false],',
    expect: 'and hiding it hides the whole block, heading and all'
  },
  {
    // And the model forgetting the key, which is where the settings page reads its boxes from.
    // The switch would be drawn, save, and be read back as the default on the next load.
    name: 'the store block switch is not read back',
    file: 'model',
    run: 'test-model',
    find: '    if (typeof input.showStores === \'boolean\') out.showStores = input.showStores;',
    replace: '    void input.showStores;',
    expect: 'the current shape is read back exactly as it was stored'
  },
  {
    // The block switch leaving the shop boxes in reach. A reader could then answer about a shop
    // whose link is inside a hidden block, and the answer would be stored as though it applied —
    // the same silent loss as the platform case, one section over.
    name: 'the shop boxes stay in reach while the block is hidden',
    file: 'options',
    run: 'test-options',
    find: '      box.disabled = !on;\n' +
      '      box.checked = on && filters.prices[kind] !== false;',
    replace: '      box.disabled = false;\n' +
      '      box.checked = on && filters.prices[kind] !== false;',
    expect: 'and the three shop boxes are drawn empty and disabled while the block is off'
  },
  {
    // And the block switch writing the shops off as it goes, which loses the reader's choices:
    // turning the block back on would bring back three unticked shops rather than the three they
    // had chosen.
    name: 'the block switch writes the shops off instead of drawing them off',
    file: 'options',
    run: 'test-options',
    find: '      box.disabled = !on;\n' +
      '      box.checked = on && filters.prices[kind] !== false;',
    replace: '      box.disabled = !on;\n' +
      '      box.checked = on && filters.prices[kind] !== false;\n' +
      '      filters.prices[kind] = box.checked;',
    expect: 'and it turns no shop off in storage'
  },
  {
    // And CardTrader, which is the fourth link in that block: left in reach while the block is
    // hidden, a reader could switch on a feature whose link has nowhere to be shown.
    name: 'CardTrader stays in reach while the store block is hidden',
    file: 'options',
    run: 'test-options',
    find: '    cardtraderBox.disabled = !connected || !block;',
    replace: '    cardtraderBox.disabled = !connected;',
    expect: 'and takes it out of reach, because its link has nowhere to go'
  },
  {
    // The EUR source's "show nothing" doing nothing. The column would stay on the page with a
    // dropdown that says it is gone, and the reader who picked it has no other switch for it —
    // the shop boxes answer a different question.
    name: 'the EUR source "show nothing" leaves the euro column on the page',
    file: 'prices',
    run: 'test',
    find: '      if (setFilters.prices.eur === false || sources === \'none\' || sources === \'ct\') {',
    replace: '      if (setFilters.prices.eur === false || sources === \'ct\') {',
    expect: 'and "show nothing" as the EUR source hides the euro column'
  },
  {
    // And the disabled contrast going back to the grey nobody noticed. This was reported from
    // use — "the difference in brightness is too subtle" — and the fix is a colour, which is
    // exactly the kind of thing that drifts back without a check that names the number.
    name: 'the disabled boxes go back to a grey nobody notices',
    file: 'optionsCss',
    run: 'test-options',
    find: '  background-color:#232229;border-color:#3b3642;opacity:1;cursor:default;',
    replace: '  background-color:#292830;border-color:#3b3642;opacity:1;cursor:default;',
    expect: 'and a disabled one is dark enough to be told apart from it at a glance'
  },
  {
    // The two handles on the euro column disagreeing. The box says the column exists and the
    // dropdown says whose number is in it; a dropdown set to "show nothing" while the box stays
    // ticked is a page showing one setting in two states.
    name: 'the EUR source can be set to nothing while the EUR box stays ticked',
    file: 'options',
    run: 'test-options',
    find: '    filters.prices.eur = euroSource.value !== \'none\';\n' +
      '    euroBox.checked = filters.prices.eur;',
    replace: '    filters.prices.eur = euroSource.value !== \'none\';',
    expect: 'and setting the dropdown to "show nothing" clears the box, because it is the same answer'
  },
  {
    // And the blocked dropdown left uncovered. `disabled` on a select swallows clicks, so without
    // the shield a reader who reaches for it finds a dead control and no reason for it.
    name: 'the blocked EUR source is left uncovered',
    file: 'options',
    run: 'test-options',
    find: '    euroShield.hidden = on;',
    replace: '    euroShield.hidden = false;',
    expect: 'with the EUR box ticked the source is free and nothing covers it'
  },
  {
    // And the card page's currency map forgetting the euro column — the one place that decides
    // whether a hidden currency's column is drawn. `initCardTrader` hides the column too, but only
    // when it runs at all, which is when the EUR source is not the default `cm`; so with the
    // default source this map is the only thing between a reader who unticked EUR and the column
    // they said they did not want.
    name: 'the euro column ignores the EUR box on the card page',
    file: 'prices',
    run: 'test',
    find: '    const currency = new Map([[\'USD\', \'usd\'], [\'TIX\', \'tix\'], [\'EUR\', \'eur\']]);',
    replace: '    const currency = new Map([[\'USD\', \'usd\'], [\'TIX\', \'tix\']]);',
    expect: 'and unticking the EUR box hides the same column'
  },
  {
    // And the whole-block switch drawn below the shops it governs, where it reads as a summary of
    // them rather than as a switch over them.
    name: 'the whole-block switch is drawn below the shops',
    file: 'optionsHtml',
    run: 'test-options',
    find: '<label class="stores-row"><input type="checkbox" class="stk-check" id="setStores"> Показывать блок «Купить карту»</label>\n' +
      '<div class="pair-items"></div>',
    replace: '<div class="pair-items"></div>\n' +
      '<label class="stores-row"><input type="checkbox" class="stk-check" id="setStores"> Показывать блок «Купить карту»</label>',
    expect: 'and the whole-block switch is above the shop boxes inside their group'
  },

  {
    // A report from a card page read as an error. The deck modules do not run there, and the
    // adapter says so in its own words — but that is not a failure of the feature.
    name: 'a report from a card page is read as an error',
    file: 'options',
    run: 'test-options',
    find: '      } else if (!onEditorPage) {\n' +
      '        add(t(\'Подходящая страница редактора не открыта. Это не ошибка: на других страницах Scryfall модули и не должны работать.\'), \'diagnostic-state\');\n' +
      '      } else if (s.wired === false || problems.length) {',
    replace: '      } else if (s.wired === false || problems.length) {',
    expect: 'a report from a card page is named as "no editor page open"'
  },
  {
    // The permission chip asking for every host the extension might ever need rather than the
    // ones this feature does. A permission dialog that lists a shop the reader never turned on
    // is how a request comes to look like a demand.
    name: 'the permission chip asks for every host',
    file: 'options',
    run: 'test-options',
    find: '      requestHostAccess(OPTIONAL_HOSTS.edhrecSuggestions).then(answer => {',
    replace: '      requestHostAccess([...new Set(Object.values(OPTIONAL_HOSTS).flat())]).then(answer => {',
    expect: 'pressing it asks for both hosts the feature needs, and no others'
  },
  {
    // The chip never hidden once the access is there, which is a warning a reader learns to
    // ignore — and the requirement says the opposite.
    name: 'the permission chip is never hidden',
    file: 'options',
    run: 'test-options',
    find: '      if (!missing.length) { edhrecPermission.hidden = true; return; }',
    replace: '      if (false) { edhrecPermission.hidden = true; return; }',
    expect: 'and the chip goes away once the access is granted'
  },
  {
    // Diagnostics standing open when the page loads. The report is a place to read, not a step,
    // and a section that starts open is the form this rework exists to stop being.
    name: 'diagnostics starts open',
    file: 'optionsHtml',
    run: 'test-options',
    find: '<div class="feature-panel feature-panel-wide" id="diagnosticsPanel" hidden>',
    replace: '<div class="feature-panel feature-panel-wide" id="diagnosticsPanel">',
    expect: 'diagnostics starts closed'
  },
  {
    // And the diagnostics button keeping the same word in both states, so it stops saying which
    // way it goes. `aria-expanded` still carries it for a screen reader; the reader looking at
    // the button does not.
    name: 'the diagnostics button does not say which way it goes',
    file: 'options',
    run: 'test-options',
    find: '        button.textContent = t(open ? opened : closed);',
    replace: '        button.textContent = t(closed);',
    expect: 'and the button says which way it goes'
  },
  {
    // And the adapter's complaints shown on a page that is not an editor, under a heading
    // that says "what is wrong" — right under a line that has just said this is not an
    // error. The module cannot attach where there is no deckbuilder and says so; that is the
    // page, not a fault.
    name: 'the expected non-attachment is listed as a fault on a card page',
    file: 'options',
    run: 'test-options',
    find: '      if (onEditorPage && problems.length) {',
    replace: '      if (problems.length) {',
    expect: 'and the expected non-attachment is not listed under "what is wrong"'
  },
];

const RUNS = {
  'render-card': () => [path.join(ROOT, 'tools/check-card-render.cjs')],
  'render-deck': () => [path.join(ROOT, 'tools/check-deck-render.cjs')],
  test: () => [path.join(ROOT, 'tests/test-preview.cjs')],
  'test-background': () => [path.join(ROOT, 'tests/test-background.cjs')],
  'test-model': () => [path.join(ROOT, 'tests/test-set-filters.cjs')],
  'test-options': () => [path.join(ROOT, 'tests/test-options.cjs')],
  'test-theme': () => [path.join(ROOT, 'tests/test-theme.cjs')],
  };

function restore(key) {
  fs.writeFileSync(TARGETS[key], before[key], 'utf8');
}

let wrong = 0;
try {
  for (const mutation of MUTATIONS) {
    const source = before[mutation.file];
    if (!source.includes(mutation.find)) {
      console.log('FAIL: ' + mutation.name + ' — the text to mutate is not in ' +
        mutation.file + ' any more, so this mutation is stale and proves nothing');
      wrong += 1;
      continue;
    }
    fs.writeFileSync(TARGETS[mutation.file],
      source.replace(mutation.find, mutation.replace), 'utf8');
    let output = '';
    let code = 0;
    const run = RUNS[mutation.run];
    if (!run) {
      console.log('FAIL: ' + mutation.name + ' — no runner named "' + mutation.run +
        '", so this mutation was never applied. A mutation pointing at a runner that does ' +
        'not exist passes by not running.');
      wrong += 1;
      restore(mutation.file);
      continue;
    }
    try {
      output = execFileSync(process.execPath, run(),
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 2400000 });
    } catch (error) {
      code = error.status === undefined ? -1 : error.status;
      output = (error.stdout || '') + (error.stderr || '');
    }
    restore(mutation.file);
    // A run that only reports a parse error has not tested the rule. Mutating an expression
    // so that the file stops being valid JavaScript fails every suite in the repository, and
    // calling that coverage is the same mistake this file exists to catch: the check "passed"
    // for a reason that has nothing to do with what it claims to check.
    //
    // So a mutation whose output names the expected assertion *and* also reports a syntax
    // error is not counted. It is reported as a broken mutation instead, which is a different
    // failure with a different fix — rewrite the mutation so the file still parses.
    const syntaxOnly = /SyntaxError|Unexpected token|Unexpected identifier/.test(output);
    const caught = code !== 0 && output.includes(mutation.expect) && !syntaxOnly;
    if (!caught) wrong += 1;
    console.log((caught ? 'ok:   ' : syntaxOnly ? 'BROKEN: ' : 'FAIL: ') + mutation.name + ' — ' +
      (caught ? 'caught by ' + mutation.run
        : syntaxOnly ? 'only broke the parse, so it proved nothing (exit ' + code + ')'
          : 'NOT caught by ' + mutation.run + ' (exit ' + code + ')'));
    if (!caught) {
      for (const line of output.split('\n').filter(l => /FAIL|Error|Syntax/.test(l)).slice(0, 5)) {
        console.log('       ' + line.trim());
      }
    }
  }
} finally {
  for (const key of Object.keys(TARGETS)) restore(key);
}

console.log('');
console.log(wrong
  ? wrong + ' of ' + MUTATIONS.length +
    ' mutations did not prove what they claim: either nothing noticed, or the run failed ' +
    'only because the file stopped parsing'
  : 'all ' + MUTATIONS.length +
    ' mutations were caught by the check that names them, and every file is back as it was');
process.exit(wrong ? 1 : 0);