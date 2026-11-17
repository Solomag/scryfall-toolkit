// The collection reader: one reader for every export, finding its columns by their header.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { assert, assertEqual } = require('./testlib.cjs');

const context = { self: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src/core/collection.js'), 'utf8'), context);
const { parseCollection, parseRows, owned } = context.self.STK_COLLECTION;
const plain = value => JSON.parse(JSON.stringify(value));

console.log('collection: the CSV reader');
assertEqual(plain(parseRows('a,"b, c","say ""hi"""\r\n\r\n1,2,3')), [['a', 'b, c', 'say "hi"'], ['1', '2', '3']],
  'quoted fields keep their commas and doubled quotes, and blank lines are skipped');
assertEqual(plain(parseRows('Name;Count\nBolt;4')), [['Name', 'Count'], ['Bolt', '4']],
  'a semicolon file, as some spreadsheet locales write, is read too');

console.log('collection: the exports people actually have');
const moxfield = `"Count","Tradelist Count","Name","Edition","Condition","Language","Foil","Tags","Last Modified","Collector Number","Alter","Proxy","Purchase Price"
"4","0","Lightning Bolt","m10","Near Mint","English","","","2026-01-01 00:00:00.000000","146","False","False",""
"1","0","Delver of Secrets // Insectile Aberration","isd","Near Mint","English","foil","","2026-01-01 00:00:00.000000","51","False","False",""`;
const manabox = `Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency
Lightning Bolt,2xm,Double Masters,129,normal,uncommon,2,1,x,0.5,false,false,near_mint,en,USD
Sol Ring,c21,Commander 2021,263,normal,uncommon,1,2,y,1,false,false,near_mint,en,USD`;
const archidekt = `Quantity,Name,Finish,Condition,Date Added,Language,Purchase Price,Tags,Edition Name,Edition Code,Multiverse Id,Scryfall ID,MTGO ID,Collector Number
3,Counterspell,Normal,NM,2026-01-01,EN,,,Mirage,mir,0,z,0,54`;
const deckbox = `Count,Tradelist Count,Name,Edition,Card Number,Condition,Language,Foil
2,0,Counterspell,Mirage,54,Near Mint,English,`;

const fromMox = parseCollection(moxfield);
assertEqual([fromMox.copies, fromMox.cards], [5, 2], 'Moxfield: counts and cards');
assertEqual(plain(owned(fromMox, { name: 'Lightning Bolt', set: 'm10', number: '146' })), { card: 4, print: 4 }, 'by card and by printing');
assertEqual(plain(owned(fromMox, { name: 'Delver of Secrets' })), { card: 1, print: null },
  'a double-faced card is found by its front face');

const fromBox = parseCollection(manabox);
assertEqual(plain(owned(fromBox, { name: 'Lightning Bolt', set: 'm10', number: '146' })), { card: 2, print: 0 },
  'Manabox: the card is owned, though not this printing');
const fromArch = parseCollection(archidekt);
assertEqual(plain(owned(fromArch, { name: 'counterspell', set: 'MIR', number: '54' })), { card: 3, print: 3 },
  'Archidekt: names and set codes match whatever their case');
const fromDeckbox = parseCollection(deckbox);
assertEqual(plain(owned(fromDeckbox, { name: 'Counterspell', set: 'mir', number: '54' })), { card: 2, print: 0 },
  'Deckbox writes the set\'s full name, so it counts for the card and not the printing');

let refused = '';
try { parseCollection('Card,Qty\n'); } catch (error) { refused = error.message; }
assert(/no rows/i.test(refused), 'a file with no rows is refused with a reason');
try { parseCollection('Foo,Bar\n1,2'); refused = ''; } catch (error) { refused = error.message; }
assert(/Name/.test(refused), 'and so is one with no name column, saying which column it looked for');
const noCount = parseCollection('Name\nBolt\nBolt');
assertEqual(plain(owned(noCount, { name: 'bolt' })), { card: 2, print: null }, 'a list without counts counts one per row');
assertEqual(owned(null, { name: 'Bolt' }), null, 'and with no collection loaded there is no answer at all');

console.log('test-collection: all assertions passed');
