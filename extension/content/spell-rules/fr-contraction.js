/**
 * Spell-check rule: French contraction (priority 15).
 *
 * French articles 'le' and 'la' contract to 'l\'' before a vowel or silent 'h'.
 *
 * Rule ID: 'fr-contraction'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

  const rule = {
    id: 'fr-contraction',
    languages: ['fr'],
    priority: 15,
    severity: 'error',
    explain: (finding) => ({
      nb: `Bruk <em>l'</em> foran ord som starter med vokal eller h — prøv <em>${escapeHtml(finding.fix)}</em>.`,
      nn: `Bruk <em>l'</em> føre ord som startar med vokal eller h — prøv <em>${escapeHtml(finding.fix)}</em>.`,
      en: `Use <em>l'</em> before words starting with a vowel or h — try <em>${escapeHtml(finding.fix)}</em>.`,
    }),
    check(ctx) {
      const { tokens, cursorPos } = ctx;
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = tokens[i + 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        if ((t.word === 'le' || t.word === 'la') && next) {
          const nextWord = next.word;
          // Most words starting with 'h' in French are silent (h muet) and require contraction.
          const startsWithVowelOrH = VOWELS.has(nextWord[0]) || nextWord[0] === 'h';
          
          if (startsWithVowelOrH) {
            out.push({
              rule_id: 'fr-contraction',
              priority: rule.priority,
              start: t.start,
              end: next.end,
              original: `${t.display} ${next.display}`,
              fix: `l'${next.display}`,
              message: `Kontraksjon: "l'${next.display}"`,
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
