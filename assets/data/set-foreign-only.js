/*
 * Scryfall Toolkit. Copyright (c) 2026 Scryfall Toolkit contributors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Third-party data, images and code in this project keep their own licence
 * and are described in THIRD_PARTY_NOTICES.md. The MPL does not cover them.
 */
// The sets Scryfall has printings for and no English printing among them.
//
// Measured on 2026-10-04 by asking Scryfall about every set it serves: for each of the
// 34 codes here, `e:<code>` answers with printings and `e:<code> lang:en` is
// refused. Both halves are needed. A refusal on its own is ambiguous, because Scryfall refuses
// the same way for a set it indexes no printings for at all, and one set on the day of the
// sweep (pfra) is in that second state and is not in this list.
//
// What these sets have in common is not a border and not a language family: they are foreign
// releases and Japanese-only products, from the French Renaissance (`ren`, 122 printings, all
// French) and the Italian Rinascimento (`rin`) through the Magic Premiere Shop runs to five
// sets of Japanese promo tokens. Nothing here is a Portal or a Secret Lair set — those are
// English sets that were released abroad as well, and they are in the other list.
//
// This is a measurement, not a rule, and it is dated because it goes out of date. A new
// foreign-only set stays visible until the next sweep, which is the safe direction to be stale
// in: a reader sees one promo set they could have hidden, rather than losing a set they meant
// to see. Regenerate with: npm run set-rules -- --write
//
// The platform index beside this one can refresh itself and this cannot, because its candidate
// list is the 61 digital sets and this one's would be every set Scryfall serves.
self.__STK_SET_FOREIGN_ONLY = [
  '4bb',
  'bchr',
  'fbb',
  'jp1',
  'p30t',
  'papc',
  'pinv',
  'pjjt',
  'pjud',
  'pmda',
  'pmps',
  'pmps06',
  'pmps07',
  'pmps08',
  'pmps09',
  'pmps10',
  'pmps11',
  'pody',
  'ppls',
  'pred',
  'ps11',
  'psal',
  'psdg',
  'psvc',
  'ptor',
  'pwcs',
  'ren',
  'rfin',
  'rin',
  'wdmu',
  'wmkm',
  'wmom',
  'wone',
  'wwoe'
];
