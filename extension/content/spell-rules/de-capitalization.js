/**
 * Spell-check rule: German noun capitalization (priority 20).
 *
 * German nouns must always start with a capital letter. This rule flags
 * tokens found in the nounGenus index that start with a lowercase letter.
 *
 * Rule ID: 'de-capitalization'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const rule = {
    id: 'de-capitalization',
    languages: ['de'],
    priority: 20,
    explain: (finding) => ({
      nb: `<em>${escapeHtml(finding.original)}</em> er et substantiv. På tysk skal alle substantiv ha stor forbokstav — prøv <em>${escapeHtml(finding.fix)}</em>.`,
      nn: `<em>${escapeHtml(finding.original)}</em> er eit substantiv. På tysk skal alle substantiv ha stor førebokstav — prøv <em>${escapeHtml(finding.fix)}</em>.`,
      en: `<em>${escapeHtml(finding.original)}</em> is a noun. In German, all nouns must be capitalized — try <em>${escapeHtml(finding.fix)}</em>.`,
    }),
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed } = ctx;
      const nounGenus = vocab.nounGenus || new Map();
      const out = [];
      
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (suppressed && suppressed.has(i)) continue;

        // If it's in the noun dictionary and starts with a lowercase letter
        if (nounGenus.has(t.word)) {
          const firstChar = t.display[0];
          if (firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
            const capitalized = t.display[0].toUpperCase() + t.display.slice(1);
            out.push({
              rule_id: 'de-capitalization',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: capitalized,
              message: `Stor forbokstav: "${t.display}" → "${capitalized}"`,
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
