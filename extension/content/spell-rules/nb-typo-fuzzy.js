/**
 * Spell-check rule: fuzzy typo neighbor lookup (priority 50).
 *
 * Final-resort branch: for tokens that aren't in validWords and aren't likely
 * proper nouns, search validWords for a Damerau-Levenshtein neighbor within
 * the bounded edit distance and pick the highest-scoring candidate (see
 * spell-check-core.js scoreCandidate for the heuristic).
 *
 * Rule ID: 'typo' — preserved verbatim from pre-INFRA-03 inline rule.
 *
 * Plan 03 (SC-01) extends THIS file with a Zipf frequency tiebreaker. This
 * plan ships byte-equivalent behavior to today's fuzzy rule.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const core = host.__lexiSpellCore || {};
  const { findFuzzyNeighbor, isLikelyProperNoun, matchCase } = core;

  const rule = {
    id: 'typo',
    languages: ['nb', 'nn'],
    priority: 50,
    explain: 'Ord ikke funnet i ordboken — foreslår nærmeste treff.',
    check(ctx) {
      const { text, tokens, vocab, cursorPos } = ctx;
      const validWords = vocab.validWords || new Set();
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (
          t.word.length >= 4 &&
          !validWords.has(t.word) &&
          !isLikelyProperNoun(t, i, tokens, text)
        ) {
          const fuzzy = findFuzzyNeighbor(t.word, validWords);
          if (fuzzy) {
            out.push({
              rule_id: 'typo',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, fuzzy),
              message: `Skrivefeil: "${t.display}" → "${fuzzy}"`,
            });
          }
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
