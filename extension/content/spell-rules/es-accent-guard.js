/**
 * Spell-check rule: Spanish accent and special character guard (priority 15).
 *
 * Norweigan keyboards make Spanish accents and 'ñ' tedious to type.
 * This rule flags common missing accents or 'n' instead of 'ñ'.
 *
 * Rule ID: 'es-accent'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const COMMON_MISSING_ACCENTS = {
    'esta': { fix: 'está', context: 'verb' },
    'estas': { fix: 'estás', context: 'verb' },
    'tu': { fix: 'tú', context: 'pronoun' },
    'el': { fix: 'él', context: 'pronoun' },
    'si': { fix: 'sí', context: 'affirmative' },
    'ano': { fix: 'año', note: 'year' },
  };

  const rule = {
    id: 'es-accent',
    languages: ['es'],
    priority: 15,
    explain: (finding) => ({
      nb: `Mangler aksent eller spesialtegn. Bruk <em>${escapeHtml(finding.fix)}</em> her (verbform eller substantiv).`,
      nn: `Manglar aksent eller spesialtegn. Bruk <em>${escapeHtml(finding.fix)}</em> her (verbform eller substantiv).`,
      en: `Missing accent or special character. Use <em>${escapeHtml(finding.fix)}</em> here (verb form or noun).`,
    }),
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const validWords = vocab.validWords || new Set();
      const knownPresens = vocab.knownPresens || new Set();
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = tokens[i + 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        // 1. Context-aware accent checks
        if (COMMON_MISSING_ACCENTS[t.word]) {
          const p = COMMON_MISSING_ACCENTS[t.word];
          let shouldFlag = false;
          
          if (t.word === 'esta' || t.word === 'estas') {
             // If followed by an adjective or participle, it's often the verb 'está'
             if (next && (next.word.endsWith('ado') || next.word.endsWith('ido'))) {
               shouldFlag = true;
             }
          } else if (t.word === 'ano') {
            shouldFlag = true; // 'ano' is almost always 'año' in student texts
          }
          
          if (shouldFlag) {
            out.push({
              rule_id: 'es-accent',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, p.fix),
              message: `Aksent: "${p.fix}"`,
            });
          }
        }

        // 2. Generic 'n' instead of 'ñ' check
        // If word contains 'n', and replacing 'n' with 'ñ' results in a valid word
        // while the original is NOT a valid word (or is much less frequent).
        if (t.word.includes('n') && !validWords.has(t.word)) {
          const withTilde = t.word.replace('n', 'ñ');
          if (validWords.has(withTilde)) {
            out.push({
              rule_id: 'es-accent',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, withTilde),
              message: `Bruk "ñ": "${withTilde}"`,
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
