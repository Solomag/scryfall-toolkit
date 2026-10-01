// Which part of the site does a rule in theme.css belong to?
//
// The split is into contiguous ranges, never into buckets: CSS has no notion of a
// file, only of order, and two rules of equal specificity decide which wins by
// which came last. Sorting rules by family would silently change that. So this
// only names a block; the split tool cuts where the naming settles.
const FAMILIES = [
  ['tagger', /\.stk-tagger/],
  ['bots', /\.stk-bots-page/],
  ['blog', /\.stk-blog-page/],
  ['team', /\.stk-team-page/],
  ['docs', /\.stk-docs-page/],
  ['info', /\.stk-info-page/],
  ['account', /\.stk-account-page/],
  ['deck-editor', /#deckbuilder|stk-deck\b/],
  ['deck-lists', /\.deck-list|\.left-tray|\.deck-tray|stk-deck-list-expanded/],
  ['card-page', /\.(card-|prints|prints-|toolbox|rulings|currency-|search-highlight)/],
  ['header', /#header|#stores|#stk-tags/],
  // Our own markers. Checked last, because a page family is also an stk- class and
  // the families above are the ones a reader is looking for. stk-dark is excluded:
  // it is on every rule in the file, so counting it would call every rule ours.
  ['ours', /\.stk-(?!dark\b)|#stk-/]
];

function familyOf(selector) {
  for (const [name, pattern] of FAMILIES) {
    if (pattern.test(selector)) return name;
  }
  // Everything else reaches for more than one page of Scryfall's: the shared
  // layer, where a rule that is not about one surface in particular belongs.
  return 'shared';
}

module.exports = { FAMILIES, familyOf };
