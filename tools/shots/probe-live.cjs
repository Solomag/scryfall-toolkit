// Does the live data give a card with something to show? Prints what it found, so a
// picture that comes out empty can be traced to the data rather than to the renderer.
//
// This exists because of how the first attempt failed. It reported "no candidate card
// came back with tags", which sounded like Scryfall had nothing — and the truth was
// four separate wrong turns in one file: a tag snapshot keyed under names that are not
// the ones it uses, a printing list read out of a field the API does not return, a
// collection request with an oracle id in a field that means one printing, and a POST
// with no User-Agent, which Scryfall answers 400 to. Each of them produced the same
// message, and only printing what it found would have shown which.
const { heroCard, clipboardCards, setCategories } = require('./live.cjs');

(async () => {
  const hero = await heroCard();
  console.log('card:      ' + hero.name);
  console.log('oracle:    ' + hero.oracleId);
  console.log('card tags: ' + hero.cardTags.map(t => t.name).join(', '));
  console.log('art tags:  ' + (hero.artTags.map(t => t.name).join(', ') || '(none)'));
  console.log('printings: ' + hero.prints.length);
  for (const p of hero.prints.slice(0, 8)) {
    console.log('    ' + p.setName + ' (' + p.set.toUpperCase() + ') #' + p.number +
      (p.digital ? '  digital' : '') + (p.prices.usd ? '  $' + p.prices.usd : ''));
  }
  const sets = new Set(hero.prints.map(p => p.set));
  console.log('sets:      ' + sets.size + ' (' + [...sets].slice(0, 10).join(', ') + ')');
  const legal = Object.entries(hero.legalities).filter(([, v]) => v === 'legal');
  console.log('legal in:  ' + legal.map(([k]) => k).join(', '));

  console.log('\nclipboard:');
  for (const card of await clipboardCards()) {
    console.log('    ' + card.name + '  (' + card.set.toUpperCase() + ') ' + card.number);
  }

  const categories = await setCategories();
  const digital = hero.prints.filter(p => categories.digital.includes(p.set)).map(p => p.set);
  console.log('\ndigital sets among these printings: ' + (digital.join(', ') || '(none)'));
  console.log('sets classified as digital: ' + categories.digital.length);
  // The formats the extension adds, which the card has to be legal somewhere in or
  // the legality picture would show Scryfall's own rows and nothing of ours.
  console.log('extra formats:  ' + (hero.extraFormats || []).join(', '));
})().catch(error => { console.error(error.message || error); process.exit(1); });