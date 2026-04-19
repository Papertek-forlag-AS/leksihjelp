/**
 * Spell-check rule: wrong verb form after modal (priority 20).
 *
 * Norwegian modal verbs (kan, må, vil, skal, bør, får, …) take a bare
 * infinitive. Flags inflected forms after a modal: "kan spiser" → "kan spise".
 *
 * Rule ID: 'modal_form' — preserved verbatim from pre-INFRA-03 inline rule.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase } = host.__lexiSpellCore || {};

  const MODAL_VERBS = new Set([
    'kan', 'kunne', 'kunna',
    'må', 'måtte',
    'vil', 'ville',
    'skal', 'skulle',
    'bør', 'burde',
    'får', 'fikk', 'fekk',
  ]);

  const rule = {
    id: 'modal_form',
    languages: ['nb', 'nn'],
    priority: 20,
    explain: 'Etter modalverb skal hovedverbet stå i infinitiv.',
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const verbInfinitive = vocab.verbInfinitive || new Map();
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = tokens[i - 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (prev && MODAL_VERBS.has(prev.word) && verbInfinitive.has(t.word)) {
          const inf = verbInfinitive.get(t.word);
          if (inf && inf !== t.word) {
            out.push({
              rule_id: 'modal_form',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, inf),
              message: `Etter "${prev.display}" skal verbet stå i infinitiv: "${inf}"`,
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
