/**
 * Spell-check rule: særskriving compound noun (priority 30).
 *
 * Flags two adjacent words whose concatenation is a known compound noun:
 * "skole sekk" → "skolesekk". A blocklist of common short words (i, på,
 * av, til, …) prevents false positives where the concatenation happens to
 * match a compound but the surface form is a normal preposition phrase.
 *
 * Rule ID: 'sarskriving' — preserved verbatim from pre-INFRA-03 inline rule.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  // Words that should never trigger særskriving even when the concatenation
  // happens to exist as a compound. Tuned conservatively to avoid false
  // positives.
  const SARSKRIVING_BLOCKLIST = new Set([
    'i', 'på', 'av', 'til', 'med', 'for', 'om', 'er', 'og', 'å', 'at',
    'som', 'en', 'ei', 'et', 'ein', 'eit', 'det', 'den', 'de', 'dei',
    'du', 'jeg', 'eg', 'han', 'hun', 'ho', 'vi', 'dere', 'dykk', 'meg',
    'deg', 'oss', 'dem', 'seg', 'min', 'din', 'sin', 'vår', 'ikke',
    'ikkje', 'nei', 'ja',
  ]);

  const rule = {
    id: 'sarskriving',
    languages: ['nb', 'nn'],
    priority: 30,
    explain: 'To ord som hører sammen som ett sammensatt ord skal skrives uten mellomrom.',
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const compoundNouns = vocab.compoundNouns || new Set();
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = tokens[i - 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (
          prev &&
          prev.word.length >= 2 && t.word.length >= 2 &&
          !SARSKRIVING_BLOCKLIST.has(prev.word) &&
          !SARSKRIVING_BLOCKLIST.has(t.word) &&
          compoundNouns.has(prev.word + t.word)
        ) {
          out.push({
            rule_id: 'sarskriving',
            start: prev.start,
            end: t.end,
            original: `${prev.display} ${t.display}`,
            fix: prev.display + t.display.toLowerCase(),
            message: `Særskriving: "${prev.display} ${t.display}" skrives som ett ord`,
          });
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
