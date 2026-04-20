/**
 * Spell-check rule: curated typo lookup (priority 40).
 *
 * Looks up the token in the curated typoFix Map (sourced from the Papertek
 * vocabulary `typos` arrays). Skips tokens that are themselves valid words
 * to avoid false-positive corrections on legitimate spellings that happen
 * to also appear as typos for another word.
 *
 * Rule ID: 'typo' — preserved verbatim from pre-INFRA-03 inline rule.
 *
 * Co-fires with the fuzzy rule (priority 50) on the same span. dedupeOverlapping
 * keeps THIS finding (lower priority = runs first = wins overlap), so curated
 * suggestions take precedence over fuzzy guesses on the same token.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase } = host.__lexiSpellCore || {};

  const rule = {
    id: 'typo',
    languages: ['nb', 'nn'],
    priority: 40,
    explain: 'Kjent skrivefeil — slå opp i ordboken.',
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed } = ctx;
      const validWords = vocab.validWords || new Set();
      const typoFix = vocab.typoFix || new Map();
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (suppressed && suppressed.has(i)) continue; // Phase 4 / SC-02 + SC-04
        if (typoFix.has(t.word) && !validWords.has(t.word)) {
          const correct = typoFix.get(t.word);
          out.push({
            rule_id: 'typo',
            start: t.start,
            end: t.end,
            original: t.display,
            fix: matchCase(t.display, correct),
            message: `Skrivefeil: "${t.display}" → "${correct}"`,
          });
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
