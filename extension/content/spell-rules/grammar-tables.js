/**
 * Shared grammar tables for German case/agreement rules (Phase 8).
 *
 * Exports onto self.__lexiGrammarTables as an IIFE so all rule files
 * loaded after this script can read the tables without duplication.
 *
 * Tables: PREP_CASE, DEF_ARTICLE_CASE, INDEF_ARTICLE_CASE,
 *         SEPARABLE_PREFIXES, SEIN_VERBS, BOTH_AUX_VERBS.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;

  // ── Preposition → required case ──
  // acc = accusative, dat = dative, gen = genitive, acc/dat = two-way (Wechselpräposition)
  const PREP_CASE = {
    // Accusative prepositions
    durch: 'acc',
    für: 'acc',
    gegen: 'acc',
    ohne: 'acc',
    um: 'acc',
    // Dative prepositions
    aus: 'dat',
    bei: 'dat',
    mit: 'dat',
    nach: 'dat',
    seit: 'dat',
    von: 'dat',
    zu: 'dat',
    // Two-way prepositions (accusative or dative depending on motion/location)
    an: 'acc/dat',
    auf: 'acc/dat',
    hinter: 'acc/dat',
    in: 'acc/dat',
    neben: 'acc/dat',
    über: 'acc/dat',
    unter: 'acc/dat',
    vor: 'acc/dat',
    zwischen: 'acc/dat',
    // Genitive prepositions
    wegen: 'gen',
    statt: 'gen',
    trotz: 'gen',
    während: 'gen',
  };

  // ── Definite article → possible { genus, case } interpretations ──
  // Articles are ambiguous: "der" can be masc-nom, fem-dat, or fem-gen.
  const DEF_ARTICLE_CASE = {
    der: [
      { genus: 'm', case: 'nominativ' },
      { genus: 'f', case: 'dativ' },
      { genus: 'f', case: 'genitiv' },
    ],
    die: [
      { genus: 'f', case: 'nominativ' },
      { genus: 'f', case: 'akkusativ' },
      { genus: 'pl', case: 'nominativ' },
      { genus: 'pl', case: 'akkusativ' },
    ],
    das: [
      { genus: 'n', case: 'nominativ' },
      { genus: 'n', case: 'akkusativ' },
    ],
    den: [
      { genus: 'm', case: 'akkusativ' },
      { genus: 'pl', case: 'dativ' },
    ],
    dem: [
      { genus: 'm', case: 'dativ' },
      { genus: 'n', case: 'dativ' },
    ],
    des: [
      { genus: 'm', case: 'genitiv' },
      { genus: 'n', case: 'genitiv' },
    ],
  };

  // ── Indefinite article → possible { genus, case } interpretations ──
  const INDEF_ARTICLE_CASE = {
    ein: [
      { genus: 'm', case: 'nominativ' },
      { genus: 'n', case: 'nominativ' },
      { genus: 'n', case: 'akkusativ' },
    ],
    eine: [
      { genus: 'f', case: 'nominativ' },
      { genus: 'f', case: 'akkusativ' },
    ],
    einen: [
      { genus: 'm', case: 'akkusativ' },
    ],
    einem: [
      { genus: 'm', case: 'dativ' },
      { genus: 'n', case: 'dativ' },
    ],
    einer: [
      { genus: 'f', case: 'dativ' },
      { genus: 'f', case: 'genitiv' },
    ],
    eines: [
      { genus: 'm', case: 'genitiv' },
      { genus: 'n', case: 'genitiv' },
    ],
  };

  // ── Separable verb prefixes ──
  // Canonical source — rule files read from here instead of maintaining local copies.
  const SEPARABLE_PREFIXES = new Set([
    'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'her', 'hin',
    'los', 'mit', 'nach', 'um', 'vor', 'weg', 'zu', 'zurück',
    'zusammen', 'weiter', 'vorbei', 'herum', 'heraus', 'hinaus',
  ]);

  // ── Verbs requiring "sein" as Perfekt auxiliary ──
  // 30+ common sein-verbs at A1–B1 level. Does NOT include verbs in
  // BOTH_AUX_VERBS (those accept haben OR sein depending on transitivity).
  const SEIN_VERBS = new Set([
    'gehen', 'kommen', 'fahren', 'fliegen', 'laufen', 'fallen',
    'sterben', 'werden', 'sein', 'bleiben', 'passieren', 'geschehen',
    'wachsen', 'entstehen', 'verschwinden', 'reisen', 'wandern',
    'erscheinen', 'gelingen', 'begegnen', 'ankommen', 'abfahren',
    'aufstehen', 'einschlafen', 'aufwachen', 'umziehen', 'zurückkehren',
    'eintreten', 'auswandern', 'stattfinden', 'rennen', 'springen',
    'steigen', 'sinken', 'schwimmen', 'treten', 'ziehen', 'schmelzen',
    'gleiten', 'kriechen', 'rutschen', 'stolpern',
  ]);

  // ── Verbs accepting BOTH haben and sein ──
  // Transitive use → haben ("Ich habe das Auto gefahren")
  // Intransitive use → sein ("Ich bin nach Berlin gefahren")
  // DE-03 skips these to avoid false positives.
  const BOTH_AUX_VERBS = new Set([
    'fahren', 'fliegen', 'laufen', 'schwimmen', 'ausziehen', 'wegfahren',
  ]);

  const tables = {
    PREP_CASE,
    DEF_ARTICLE_CASE,
    INDEF_ARTICLE_CASE,
    SEPARABLE_PREFIXES,
    SEIN_VERBS,
    BOTH_AUX_VERBS,
  };

  host.__lexiGrammarTables = tables;
  if (typeof module !== 'undefined' && module.exports) module.exports = tables;

  // ── Phase 9/10 consumer stub documentation ──
  // Phase 9 (ES): will consume PREP_CASE pattern → ES preposition-case tables
  //   (por/para, a/en distinction — Spanish prepositions don't have German-style
  //   case government but the table-lookup pattern transfers).
  // Phase 10 (FR): will consume DEF_ARTICLE_CASE pattern → FR article-gender
  //   tables (le/la/les with elision/contraction rules).
  // Both phases will add their own language-specific tables to this IIFE
  // alongside the DE tables, accessed via host.__lexiGrammarTables.
})();
