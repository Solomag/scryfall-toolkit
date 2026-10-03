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
// The three formats Scryfall does not have: Classic Legacy, Peak Legacy and Heritage.
//
// Each is a definition this project wrote, not Scryfall's, and the worker answers it with a
// search clause — `legal:legacy AND date<=roe` for Classic, `date<=emn` for Peak, a set-type
// test for Heritage. Those clauses use Scryfall's *current* Legacy verdict, and "current" is
// the whole problem: a card banned from Legacy in 2016 is `legal:legacy` false today, so the
// clause reports it as never having been in the format at all.
//
// This table is the correction, one card at a time. Every entry is a card the clause gets
// wrong and a maintainer has decided by hand. Measured on 2026-10-03: 29 entries over 17
// distinct cards, every id still naming a card Scryfall has, no duplicates within a format,
// and every entry disagreeing with what its clause would have said — so none of them is dead
// weight that reads like a decision. The ones marked `legal` are cards Scryfall has banned
// that the old formats did contain; the ones marked `banned` are the other way round, cards
// Scryfall has as legal that those old formats never had.
//
// What this file cannot say is whether it is complete, and that is not something a live API
// can answer: Scryfall states each card's present verdict and never says what a format
// contained in 2010. So completeness is a judgement call, made here by a person, and a card
// added to a Legacy ban list after the fact is invisible to every check above. Time Walk is
// the obvious question and is deliberately absent — it is not in this table because nobody
// has decided it here from a source, and a decision taken from memory is the one thing this
// file exists to avoid.
self.STK_FORMAT_OVERRIDES = {
  "classic": {
    "c7c7bffa-442d-4ba5-b778-ad394c192f27": "legal",
    "a610c77c-fe31-4465-a1c1-392db4ce4ed1": "legal",
    "4692740f-be90-459f-8d90-c4ae71771595": "legal",
    "299fc083-0834-4064-8344-f895aff68867": "legal",
    "632de66b-2314-4299-847c-16a84bf9121f": "legal",
    "854ad486-0c59-4c57-9a76-ab1dff0ff37c": "legal",
    "b18b9869-8490-4875-a5bb-484c3299f2c5": "legal",
    "b3739b5a-5731-4c64-a244-815a363b0d5c": "banned",
    "37c49483-bef6-47c6-9354-ead8560d48da": "legal",
    "13575cf9-65c1-4861-b21e-eb2155e07766": "legal",
    "124c8663-21f3-4cd8-a060-9d04be35c43f": "legal",
    "119d719d-e965-45b4-9bc9-ac03211b10c2": "legal",
    "7ed52301-81ea-4e7f-b985-cfab0593cae4": "banned",
    "a628186d-b7d9-40a5-9ae2-fbc9d2a14c7c": "banned"
  },
  "heritage": {
    "c7c7bffa-442d-4ba5-b778-ad394c192f27": "legal"
  },
  "peak": {
    "c7c7bffa-442d-4ba5-b778-ad394c192f27": "legal",
    "a610c77c-fe31-4465-a1c1-392db4ce4ed1": "legal",
    "4692740f-be90-459f-8d90-c4ae71771595": "legal",
    "22f1a4a4-c423-4d1c-8775-0ed604a9fa51": "legal",
    "299fc083-0834-4064-8344-f895aff68867": "legal",
    "1d67f5ff-1fce-45e5-b6a1-416c569351e2": "legal",
    "632de66b-2314-4299-847c-16a84bf9121f": "legal",
    "854ad486-0c59-4c57-9a76-ab1dff0ff37c": "legal",
    "b18b9869-8490-4875-a5bb-484c3299f2c5": "legal",
    "b3739b5a-5731-4c64-a244-815a363b0d5c": "banned",
    "37c49483-bef6-47c6-9354-ead8560d48da": "legal",
    "13575cf9-65c1-4861-b21e-eb2155e07766": "legal",
    "124c8663-21f3-4cd8-a060-9d04be35c43f": "legal",
    "ccf5a0d4-69e8-4607-a76c-cfca336899e4": "legal"
  }
};
