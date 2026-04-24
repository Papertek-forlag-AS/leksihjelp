/**
 * Spell-check rule: English Grammar (priority 20).
 *
 * Includes:
 * - "I" capitalization
 * - a/an article agreement
 * - Modal verb form (can/must/shall/will -> base form)
 * - Subject-Verb agreement (3rd person singular)
 * - Pronoun case (subject vs object)
 * - Much vs. Many
 * - Tense consistency (past -> past)
 * - Common homophone pitfalls (there/their/they're, etc.)
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
      if (finding.subType === 'tense-mix') {
        return {
          nb: `Det ser ut som du blander tider. Siden «${escapeHtml(finding.prev)}» er i fortid, bør kanskje «${escapeHtml(finding.original)}» også være det, eller endres til infinitiv.`,
          nn: `Det ser ut som du blandar tider. Sidan «${escapeHtml(finding.prev)}» er i fortid, bør kanskje «${escapeHtml(finding.original)}» også vere det, eller endrast til infinitiv.`,
          en: `You might be mixing tenses. Since "${escapeHtml(finding.prev)}" is in the past, "${escapeHtml(finding.original)}" should probably be too, or change to an infinitive.`,
        };
      }
      if (finding.subType === 'much-many') {
        return {
          nb: `Bruk <em>${escapeHtml(finding.fix)}</em> foran ${finding.is_countable ? 'tellbare' : 'utellbare'} substantiv.`,
          nn: `Bruk <em>${escapeHtml(finding.fix)}</em> føre ${finding.is_countable ? 'telbare' : 'uteljbare'} substantiv.`,
          en: `Use <em>${escapeHtml(finding.fix)}</em> before ${finding.is_countable ? 'countable' : 'uncountable'} nouns.`,
        };
      }
      if (finding.subType === 'pronoun-case') {
        return {
          nb: `Bruk objektsform av personlig pronomen («${escapeHtml(finding.fix)}») etter verb eller preposisjon.`,
          nn: `Bruk objektsform av personleg pronomen («${escapeHtml(finding.fix)}») etter verb eller preposisjon.`,
          en: `Use the object form of the personal pronoun ("${escapeHtml(finding.fix)}") after a verb or preposition.`,
        };
      }
      if (finding.subType === 'modal-of') {
        return {
          nb: `Modalverb som <em>${escapeHtml(finding.modal)}</em> tar alltid <em>have</em>, aldri <em>of</em> — dette er en vanlig feil fra uttalen av sammendraget "should've".`,
          nn: `Modalverb som <em>${escapeHtml(finding.modal)}</em> tek alltid <em>have</em>, aldri <em>of</em> — dette er ein vanleg feil frå uttalen av samandraget "should've".`,
          en: `Modal verbs like <em>${escapeHtml(finding.modal)}</em> always take <em>have</em>, never <em>of</em> — a common mistake driven by the spoken contraction "should've".`,
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
      return {
        nb: finding.message,
        nn: finding.message,
        en: finding.message,
      };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos } = ctx;
      const verbInfinitive = vocab.verbInfinitive || new Map();
      const validWords = vocab.validWords || new Set();
      const knownPresens = vocab.knownPresens || new Set();
      const knownPreteritum = vocab.knownPreteritum || new Set();
      const verbForms = vocab.verbForms || new Map();
      const pitfalls = vocab.pitfalls || {};
      const out = [];

      const PRONOUN_OBJ_MAP = {
        'i': 'me',
        'he': 'him',
        'she': 'her',
        'we': 'us',
        'they': 'them',
      };

      const PREPOSITIONS = new Set(['to', 'for', 'with', 'from', 'at', 'in', 'on', 'by', 'about']);

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = tokens[i + 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        // 1. Double Negative Check
        if (t.word === 'dont' || t.word === "don't" || t.word === 'doesnt' || t.word === "doesn't") {
          for (let j = i + 1; j < Math.min(i + 5, tokens.length); j++) {
            if (tokens[j].word === 'nothing') {
              out.push({
                rule_id: 'en-grammar',
                subType: 'double-negative',
                priority: rule.priority,
                start: tokens[j].start,
                end: tokens[j].end,
                original: tokens[j].display,
                fix: 'anything',
                suggestion: 'anything',
                message: 'Dobbelt nektelse: Bruk "anything" i stedet for "nothing" etter "don\'t".',
              });
            }
          }
        }

        // 2. Subject-Verb Agreement
        if (next) {
          const inf = verbInfinitive.get(next.word);
          const forms = verbForms.get(inf || next.word);
          let fix = null;

          const is3rdPersonPronoun = (t.word === 'he' || t.word === 'she' || t.word === 'it');
          const is1st2ndPluralPronoun = (t.word === 'i' || t.word === 'you' || t.word === 'we' || t.word === 'they');
          
          const prevWord = i > 0 ? tokens[i - 1].word.toLowerCase() : null;
          const isSingularNoun = !is3rdPersonPronoun && !is1st2ndPluralPronoun && vocab.compoundNouns && vocab.compoundNouns.has(t.word) && !vocab.verbInfinitive.has(t.word) && (prevWord === 'the' || prevWord === 'a' || prevWord === 'an' || prevWord === 'this' || prevWord === 'that' || prevWord === 'my' || prevWord === 'his' || prevWord === 'her' || prevWord === 'our' || prevWord === 'your' || prevWord === 'their');

          const isKnownVerb = forms && forms.present;

          if ((is3rdPersonPronoun || (isSingularNoun && isKnownVerb)) && !MODAL_VERBS.has(next.word)) {
            // Needs -s form — BUT skip if the token is a valid irregular
            // past form (read, cut, put, hit, set, let, etc). Without this
            // gate the rule flags "She read a book" as "read → reads",
            // since `read` is also the 3rd-person-singular present.
            // knownPreteritum contains past FORMS (not infinitives), so a
            // membership hit is enough evidence that the token might be
            // past tense rather than a missing-s present.
            if (knownPreteritum.has(next.word)) {
              // fall through without setting fix
            } else if (verbForms.has(next.word)) {
              if (forms && forms.present) {
                for (const p of forms.present) {
                  if (p.endsWith('s') && p !== next.word) { fix = p; break; }
                }
              }
              if (!fix && !next.word.endsWith('s')) {
                const sForm = next.word + 's';
                const esForm = next.word + 'es';
                if (validWords.has(sForm)) fix = sForm;
                else if (validWords.has(esForm)) fix = esForm;
              }
            }
          } else if (is1st2ndPluralPronoun) {
            // Needs base form (no -s)
            if (next.word.endsWith('s') && inf && inf !== next.word) {
              fix = inf;
            }
          }

          if (fix && fix !== next.word) {
             out.push({
              rule_id: 'en-grammar',
              subType: 'sv-agreement',
              priority: rule.priority,
              start: next.start,
              end: next.end,
              subject: t.display,
              original: next.display,
              fix: matchCase(next.display, fix),
              suggestion: matchCase(next.display, fix),
              message: `Subjekt-verb-samsvar: "${t.display}" skal følges av "${fix}"`,
            });
          }
        }

        // 3. Pronoun Case (Object form after verb/prep)
        if (next && PRONOUN_OBJ_MAP[next.word]) {
          const isVerb = knownPresens.has(t.word) || knownPreteritum.has(t.word);
          const isPrep = PREPOSITIONS.has(t.word);
          if (isVerb || isPrep) {
             const fix = PRONOUN_OBJ_MAP[next.word];
             const fixWithCase = matchCase(next.display, fix);
             out.push({
              rule_id: 'en-grammar',
              subType: 'pronoun-case',
              priority: rule.priority,
              start: next.start,
              end: next.end,
              original: next.display,
              fix: fixWithCase,
              suggestion: fixWithCase,
              message: `Objektsform: Bruk "${fix}" etter "${t.display}"`,
            });
          }
        }

        // 4. Tense Consistency
        if (i > 1 && t.word === 'and' && next && knownPresens.has(next.word)) {
          const prev = tokens[i - 1];
          if (knownPreteritum.has(prev.word)) {
            const inf = verbInfinitive.get(next.word) || next.word;
            let pastForm = null;
            const forms = verbForms.get(inf);
            if (forms && forms.past && forms.past.size > 0) {
              pastForm = Array.from(forms.past)[0];
            }
            if (pastForm) {
               out.push({
                rule_id: 'en-grammar',
                subType: 'tense-mix',
                priority: rule.priority,
                start: t.start, // include 'and' in the span if we want to change it to 'to'
                end: next.end,
                original: `${t.display} ${next.display}`,
                prev: prev.display,
                fix: `${matchCase(next.display, pastForm)} / to ${inf}`,
                suggestion: `${matchCase(next.display, pastForm)} / to ${inf}`,
                suggestions: [
                   `${t.display} ${matchCase(next.display, pastForm)}`,
                   `to ${inf}`
                ],
                message: `Tidssamsvar: "${prev.display}" er fortid.`,
              });
            }
          }
        }

        // 5. Much vs. Many
        if ((t.word === 'much' || t.word === 'many') && next) {
          const looksCountable = next.word.endsWith('s') && next.word.length > 3;
          const expected = looksCountable ? 'many' : 'much';
          if (t.word !== expected) {
            out.push({
              rule_id: 'en-grammar',
              subType: 'much-many',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, expected),
              suggestion: matchCase(t.display, expected),
              is_countable: looksCountable,
              message: `Bruk "${expected}" foran "${next.display}"`,
            });
          }
        }

        // 6. "I" Capitalization
        if (t.word === 'i' && t.display === 'i') {
          out.push({
            rule_id: 'en-grammar',
            subType: 'i-capitalization',
            priority: rule.priority,
            start: t.start,
            end: t.end,
            original: t.display,
            fix: 'I',
            suggestion: 'I',
            message: 'Stor "I": Pronomenet "I" skal alltid ha stor forbokstav.',
          });
        }

        // 7. A/An Agreement
        if ((t.word === 'a' || t.word === 'an') && next) {
          const nextWord = next.word;
          const nextDisplay = next.display;
          const startsWithVowel = VOWELS.has(nextWord[0]);
          
          let expected = startsWithVowel ? 'an' : 'a';

          // Handle Abbreviations (e.g., "an FBI", "an HTML", "a URL")
          // If the word is ALL CAPS and starts with F, H, L, M, N, R, S, X -> "an"
          const isAllCaps = nextDisplay.length > 1 && nextDisplay === nextDisplay.toUpperCase();
          const vowelSoundAbbr = new Set(['f', 'h', 'l', 'm', 'n', 'r', 's', 'x']);
          
          if (isAllCaps && vowelSoundAbbr.has(nextWord[0])) {
            expected = 'an';
          } else if (isAllCaps && nextWord[0] === 'u') {
            expected = 'a'; // a URL, a UFO
          }

          // Phonetic Exceptions for "h" (silent h)
          const silentH = ['hour', 'honor', 'honest', 'heir'];
          if (silentH.some(h => nextWord.startsWith(h))) {
            expected = 'an';
          }

          // Phonetic Exceptions for "u" (consonant y-sound)
          const consonantU = ['uni', 'use', 'url', 'ufo', 'utensil', 'usual', 'user'];
          if (consonantU.some(u => nextWord.startsWith(u))) {
            expected = 'a';
          }

          if (t.word !== expected) {
            out.push({
              rule_id: 'en-grammar',
              subType: 'a-an',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, expected),
              suggestion: matchCase(t.display, expected),
              starts_with_vowel: expected === 'an',
              message: `Artikkel: Bruk "${expected}" foran "${next.display}"`,
            });
          }
        }

        // 8a. "should/could/would of" → "have"
        // Classic learner pitfall driven by the spoken contraction
        // "should've" sounding identical to "should of". The fix is
        // always "have".
        if (MODAL_VERBS.has(t.word) && next && next.word === 'of') {
          out.push({
            rule_id: 'en-grammar',
            subType: 'modal-of',
            priority: rule.priority,
            start: next.start,
            end: next.end,
            original: next.display,
            fix: matchCase(next.display, 'have'),
            suggestion: matchCase(next.display, 'have'),
            modal: t.display,
            message: `"${t.display} of" er en vanlig feil — det skal være "${t.display} have".`,
          });
        }

        // 8b. Sentence-initial "Me and …" as subject → "I and …"
        // (preferred natural phrasing is "X and I", but we surface the
        // minimal case-swap rather than rewriting word order — the popover
        // explainer notes the stylistic preference).
        if (i === 0 && t.word === 'me' && next && next.word === 'and') {
          out.push({
            rule_id: 'en-grammar',
            subType: 'pronoun-case',
            priority: rule.priority,
            start: t.start,
            end: t.end,
            original: t.display,
            fix: 'I',
            suggestion: 'I',
            message: `Som subjekt skal det være "I", ikke "me". Prøv "John and I".`,
          });
        }

        // 8c. he/she/it + don't → doesn't
        // Handles the most common subject-verb-agreement pitfall on the
        // contracted negative. Accepts both "don't" and "dont".
        if (next && (next.word === "don't" || next.word === 'dont') &&
            (t.word === 'he' || t.word === 'she' || t.word === 'it')) {
          out.push({
            rule_id: 'en-grammar',
            subType: 'sv-agreement',
            priority: rule.priority,
            start: next.start,
            end: next.end,
            subject: t.display,
            original: next.display,
            fix: matchCase(next.display, "doesn't"),
            suggestion: matchCase(next.display, "doesn't"),
            message: `Subjekt-verb-samsvar: "${t.display}" skal ha "doesn't", ikke "${next.display}".`,
          });
        }

        // 9. Modal Verb Form
        if (MODAL_VERBS.has(t.word) && next && verbInfinitive.has(next.word)) {
          const inf = verbInfinitive.get(next.word);
          if (inf && inf !== next.word) {
            const isInflected = next.word.endsWith('s') || next.word.endsWith('ed') || next.word.endsWith('ing');
            if (isInflected) {
               out.push({
                rule_id: 'en-grammar',
                subType: 'modal',
                priority: rule.priority,
                start: next.start,
                end: next.end,
                original: next.display,
                modal: t.display,
                fix: matchCase(next.display, inf),
                suggestion: matchCase(next.display, inf),
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
