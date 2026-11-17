/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence and
 * are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */

// The reader's own collection: read from a CSV export, kept in the browser, and asked
// "how many of this do I own?" by the pages.
//
// One reader for every export rather than one per site. Moxfield, Manabox, Archidekt,
// Deckbox and the rest all write a header row, and they differ only in what they call
// the same four columns — the count, the name, the set and the collector number. So the
// columns are found by their header, and an export this file has never seen still works
// as long as it names them in one of the usual ways.
//
// Two counts are kept: by printing (set and collector number) and by card (the name, front
// face only, case and punctuation folded). A row without a usable set still counts towards
// its card; that is what Deckbox's full set names and a hand-written list come to.
(() => {
  const HEADERS = {
    count: ['count', 'quantity', 'qty', 'amount', 'copies', 'have'],
    name: ['name', 'card name', 'card'],
    set: ['set code', 'edition code', 'set', 'edition', 'setcode', 'expansion code'],
    number: ['collector number', 'card number', 'collector #', 'number', 'cn', 'collectornumber']
  };

  // RFC 4180, which is what every one of these writes: commas (or semicolons, which some
  // spreadsheet locales use), double quotes around a field that has either, and a doubled
  // quote for a quote inside one.
  function parseRows(text) {
    const source = String(text || '').replace(/^﻿/, '');
    const firstLine = source.split(/\r?\n/, 1)[0] || '';
    const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(cell => cell.trim() !== '')) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
    return rows;
  }

  const cardKey = name => String(name || '').split(' // ')[0].toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const printKey = (set, number) => String(set || '').toLowerCase() + '/' + String(number || '').toLowerCase();

  // { byPrint, byCard, rows, copies, skipped, columns } from the text of an export.
  function parseCollection(text) {
    const rows = parseRows(text);
    if (!rows.length) throw new Error('The file is empty.');
    const header = rows[0].map(cell => cell.trim().toLowerCase());
    const find = names => {
      for (const name of names) {
        const at = header.indexOf(name);
        if (at >= 0) return at;
      }
      return -1;
    };
    const columns = { count: find(HEADERS.count), name: find(HEADERS.name), set: find(HEADERS.set), number: find(HEADERS.number) };
    if (columns.name < 0) throw new Error('No column called Name in the first row, so this does not look like a collection export.');
    const byPrint = {};
    const byCard = {};
    let copies = 0;
    let used = 0;
    let skipped = 0;
    for (const row of rows.slice(1)) {
      const name = (row[columns.name] || '').trim();
      const count = columns.count >= 0 ? Math.floor(Number(String(row[columns.count] || '').replace(/[^\d.]/g, ''))) : 1;
      if (!name || !Number.isFinite(count) || count <= 0) { skipped++; continue; }
      const card = cardKey(name);
      if (!card) { skipped++; continue; }
      byCard[card] = (byCard[card] || 0) + count;
      const set = columns.set >= 0 ? (row[columns.set] || '').trim() : '';
      const number = columns.number >= 0 ? (row[columns.number] || '').trim() : '';
      // A code, not a set's full name: Scryfall's codes are three to six letters and digits.
      if (/^[a-z0-9]{2,6}$/i.test(set) && number) {
        const key = printKey(set, number);
        byPrint[key] = (byPrint[key] || 0) + count;
      }
      copies += count;
      used++;
    }
    if (!used) throw new Error('No rows with a card name and a count were found.');
    return { byPrint, byCard, rows: used, copies, skipped, cards: Object.keys(byCard).length, columns };
  }

  // What a page shows for one card: the copies of the card, and of this printing if known.
  function owned(collection, { name, set, number } = {}) {
    if (!collection || !collection.byCard) return null;
    return {
      card: collection.byCard[cardKey(name)] || 0,
      print: set && number ? collection.byPrint?.[printKey(set, number)] || 0 : null
    };
  }

  self.STK_COLLECTION = { parseRows, parseCollection, owned, cardKey, printKey };
})();
