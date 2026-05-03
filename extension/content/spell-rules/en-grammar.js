/**
 * Spell-check rule: English Grammar (priority 20).
 *
 * Includes basic morphology and capitalization allowed in exams.
 * - "I" capitalization
 * - a/an article agreement
 * - Modal verb form (basic)
 * - Subject-Verb agreement (basic)
 *
 * Rule ID: 'en-grammar'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const MODAL_VERBS = new Set(['can', 'could', 'must', 'shall', 'should', 'will', 'would', 'may', 'might']);
  const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

  const rule = {
    id: 'en-grammar',
    languages: ['en'],
    priority: 20,
    exam: {
      safe: true,
      reason: "Basic morphology and capitalization (en-grammar) — matches native browser spellcheck behavior.",
      category: "grammar-lookup",
    },
    severity: 'error',
    explain: (finding) => {
      if (finding.subType === 'i-capitalization') {
        return {
          nb: `Personlig pronomen «I» (jeg) skal alltid ha stor forbokstav på engelsk.`,
          nn: `Personleg pronomen «I» (eg) skal alltid ha stor førebokstav på engelsk.`,
          en: `The personal pronoun "I" must always be capitalized in English.`,
        };
      }
      if (finding.subType === 'a-an') {
        return {
          nb: `Bruk <em>${escapeHtml(finding.fix)}</em> foran ord som starter med ${finding.starts_with_vowel ? 'vokal' : 'konsonant'}-lyd.`,
          nn: `Bruk <em>${escapeHtml(finding.fix)}</em> føre ord som startar med ${finding.starts_with_vowel ? 'vokal' : 'konsonant'}-lyd.`,
          en: `Use <em>${escapeHtml(finding.fix)}</em> before words starting with a ${finding.starts_with_vowel ? 'vowel' : 'consonant'} sound.`,
        };
      }
      if (finding.subType === 'modal') {
        return {
          nb: `Etter modalverb (som <em>${escapeHtml(finding.modal)}</em>) skal verbet stå i grunnform — bruk <em>${escapeHtml(finding.fix)}</em>.`,
          nn: `Etter modalverb (som <em>${escapeHtml(finding.modal)}</em>) skal verbet stå i grunnform — bruk <em>${escapeHtml(finding.fix)}</em>.`,
          en: `After modal verbs (like <em>${escapeHtml(finding.modal)}</em>), use the base form — try <em>${escapeHtml(finding.fix)}</em>.`,
        };
      }
      if (finding.subType === 'sv-agreement') {
        const subj = escapeHtml(finding.subject);
        const fix = escapeHtml(finding.fix);
        const orig = escapeHtml(finding.original);
        return {
          nb: `Når «${subj}» er subjekt (tredje person entall), må verbet bøyes med -s i presens. Bruk <em>${fix}</em>, ikke <em>${orig}</em>.`,
          nn: `Når «${subj}» er subjekt (tredje person eintal), må verbet bøyast med -s i presens. Bruk <em>${fix}</em>, ikkje <em>${orig}</em>.`,
          en: `When "${subj}" is the subject, the verb needs the -s ending in the present tense. Use <em>${fix}</em>, not <em>${orig}</em>.`,
        };
      }
      return { nb: finding.message, nn: finding.message, en: finding.message };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const verbInfinitive = vocab.verbInfinitive || new Map();
      const validWords = vocab.validWords || new Set();
      const knownPresens = vocab.knownPresens || new Set();
      const knownPreteritum = vocab.knownPreteritum || new Set();
      const verbForms = vocab.verbForms || new Map();
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = tokens[i + 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        // 1. "I" Capitalization
        if (t.word === 'i' && t.display === 'i') {
          out.push({
            rule_id: 'en-grammar', subType: 'i-capitalization', priority: rule.priority,
            start: t.start, end: t.end, original: t.display, fix: 'I', suggestion: 'I',
            message: 'Stor "I": Pronomenet "I" skal alltid ha stor forbokstav.',
          });
        }

        // 2. A/An Agreement
        if ((t.word === 'a' || t.word === 'an') && next) {
          const nextWord = next.word;
          const startsWithVowel = VOWELS.has(nextWord[0]);
          let expected = startsWithVowel ? 'an' : 'a';
          const isAllCaps = next.display.length > 1 && next.display === next.display.toUpperCase();
          const vowelSoundAbbr = new Set(['f', 'h', 'l', 'm', 'n', 'r', 's', 'x']);
          if (isAllCaps && vowelSoundAbbr.has(nextWord[0])) expected = 'an';
          else if (isAllCaps && nextWord[0] === 'u') expected = 'a';
          const silentH = ['hour', 'honor', 'honest', 'heir'];
          if (silentH.some(h => nextWord.startsWith(h))) expected = 'an';
          const consonantU = ['uni', 'use', 'url', 'ufo', 'utensil', 'usual', 'user'];
          if (consonantU.some(u => nextWord.startsWith(u))) expected = 'a';

          if (t.word !== expected) {
            out.push({
              rule_id: 'en-grammar', subType: 'a-an', priority: rule.priority,
              start: t.start, end: t.end, original: t.display,
              fix: matchCase(t.display, expected), suggestion: matchCase(t.display, expected),
              starts_with_vowel: expected === 'an',
              message: `Artikkel: Bruk "${expected}" foran "${next.display}"`,
            });
          }
        }

        // 3. Subject-Verb Agreement (basic)
        if (next) {
          const inf = verbInfinitive.get(next.word);
          const forms = verbForms.get(inf || next.word);
          let fix = null;

          if ((next.word === "don't" || next.word === 'dont') && (t.word === 'he' || t.word === 'she' || t.word === 'it')) {
            fix = "doesn't";
          } else {
            const is3rdPersonPronoun = (t.word === 'he' || t.word === 'she' || t.word === 'it');
            const is1st2ndPluralPronoun = (t.word === 'i' || t.word === 'you' || t.word === 'we' || t.word === 'they');
            const prevWord = i > 0 ? tokens[i - 1].word.toLowerCase() : null;
            
            // Heuristic: if 'it' follows a verb, it's likely an object (e.g. "completed it")
            // We only apply this to 'it' because he/she are rarely objects.
            const followsVerb = t.word === 'it' && prevWord && (knownPresens.has(prevWord) || knownPreteritum.has(prevWord));
            
            const isSingularNoun = !is3rdPersonPronoun && !is1st2ndPluralPronoun && vocab.compoundNouns && vocab.compoundNouns.has(t.word) && !vocab.verbInfinitive.has(t.word) && (prevWord === 'the' || prevWord === 'a' || prevWord === 'an' || prevWord === 'this' || prevWord === 'that' || prevWord === 'my' || prevWord === 'his' || prevWord === 'her' || prevWord === 'our' || prevWord === 'your' || prevWord === 'their');

            if ((is3rdPersonPronoun || (isSingularNoun && forms && forms.present)) && !MODAL_VERBS.has(next.word) && !followsVerb) {
              if (!knownPreteritum.has(next.word)) {
                // Heuristic: only flag if it's a known verb sense and it's NOT already -s form
                if (forms && forms.present && !next.word.endsWith('s')) {
                  for (const p of forms.present) {
                    if (p.endsWith('s')) { fix = p; break; }
                  }
                }
              }
            } else if (is1st2ndPluralPronoun) {
              if (next.word.endsWith('s') && inf && inf !== next.word && !knownPreteritum.has(next.word)) fix = inf;
            }
          }

          if (fix && fix !== next.word) {
             out.push({
              rule_id: 'en-grammar', subType: 'sv-agreement', priority: rule.priority,
              start: next.start, end: next.end, subject: t.display, original: next.display,
              fix: matchCase(next.display, fix), suggestion: matchCase(next.display, fix),
              message: `Subjekt-verb-samsvar: "${t.display}" skal ha "${fix}"`,
            });
          }
        }

        // 4. Modal Verb Form (basic)
        if (MODAL_VERBS.has(t.word) && next && verbInfinitive.has(next.word)) {
          const inf = verbInfinitive.get(next.word);
          if (inf && inf !== next.word) {
            const isInflected = next.word.endsWith('s') || next.word.endsWith('ed') || next.word.endsWith('ing');
            if (isInflected) {
               out.push({
                rule_id: 'en-grammar', subType: 'modal', priority: rule.priority,
                start: next.start, end: next.end, original: next.display, modal: t.display,
                fix: matchCase(next.display, inf), suggestion: matchCase(next.display, inf),
                message: `Etter "${t.display}" skal verbet stå i grunnform: "${inf}"`,
              });
            }
          }
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
