/**
 * Leksihjelp — Vocab Seam Core (pure index-building)
 *
 * Pure, side-effect-free module that takes raw vocab JSON + optional bigrams
 * and returns the full set of derived indexes consumed by the extension
 * (word-prediction.js, spell-check.js) and by Node-side tooling
 * (scripts/check-fixtures.js — Plan 03).
 *
 * Dual-export footer: writes `self.__lexiVocabCore` in the browser and
 * `module.exports` in Node — same API, same code path.
 *
 * Contents — moved verbatim from:
 *   - word-prediction.js:440–760   (loadWordList emission loop)
 *   - word-prediction.js:763–785   (loadBigrams normalization)
 *   - spell-check.js:136–172       (rebuildIndexes)
 *
 * This file MUST NOT read from disk, call fetch, or reference chrome.*,
 * window.*, or document.* (the footer's `self` reference is the only
 * allowed global touchpoint).
 */

(function () {
  'use strict';

  // ── Constants (copied verbatim from word-prediction.js:166–219) ──

  const BANKS = [
    'verbbank', 'nounbank', 'adjectivebank', 'articlesbank',
    'generalbank', 'numbersbank', 'phrasesbank', 'pronounsbank'
  ];

  // Pronoun labels per language — maps array index to pronoun string
  // Used to label Spanish/French conjugations where former is an array
  const LANGUAGE_PRONOUNS = {
    es: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'],
    fr: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles']
  };

  // NB/NN form-level feature gating — maps individual conjugation form keys
  // to grammar features so each can be toggled independently
  const NB_NN_FORM_FEATURES = {
    presens:              'grammar_present',
    preteritum:           'grammar_preteritum',
    perfektum_partisipp:  'grammar_perfektum',
    imperativ:            'grammar_imperativ',
    // infinitiv: always shown (base form, no gating)
  };

  // Tense normalization — maps language-specific tense keys to common group names
  // Used for cross-language tense consistency detection
  const TENSE_GROUP = {
    presens: 'present', presente: 'present',
    preteritum: 'past', preterito: 'past',
    perfektum: 'perfect', perfecto: 'perfect', passe_compose: 'perfect',
    perfektum_partisipp: 'perfect', // NB/NN form key
  };

  // Tense keys to feature mapping (supports multiple languages)
  const TENSE_FEATURES = {
    presens: 'grammar_present',
    presente: 'grammar_present',
    preteritum: 'grammar_preteritum',
    preterito: 'grammar_preterito',
    perfektum: 'grammar_perfektum',
    perfecto: 'grammar_perfecto',
    passe_compose: 'grammar_passe_compose'
  };

  // Pronoun-feature sets per language (extracted from word-prediction.js:128–157
  // getAllowedPronouns). In the pure core the caller's isFeatureEnabled selects
  // which subset applies; if no pronoun feature is enabled, we default to the
  // widest set (same behaviour as the browser fallback).
  const LANG_PRONOUN_FEATURES = {
    de: [
      { id: 'grammar_pronouns_all', pronouns: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] },
      { id: 'grammar_pronouns_singular_wir', pronouns: ['ich', 'du', 'er/sie/es', 'wir'] },
      { id: 'grammar_pronouns_ich_du', pronouns: ['ich', 'du'] }
    ],
    es: [
      { id: 'grammar_es_pronouns_all', pronouns: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'] },
      { id: 'grammar_es_pronouns_singular_nosotros', pronouns: ['yo', 'tú', 'él/ella/usted', 'nosotros'] },
      { id: 'grammar_es_pronouns_yo_tu', pronouns: ['yo', 'tú'] }
    ],
    fr: [
      { id: 'grammar_fr_pronouns_all', pronouns: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] },
      { id: 'grammar_fr_pronouns_singular_nous', pronouns: ['je', 'tu', 'il/elle/on', 'nous'] },
      { id: 'grammar_fr_pronouns_je_tu', pronouns: ['je', 'tu'] }
    ]
  };

  // ── Helpers ──

  function getAllowedPronouns(lang, isFeatureEnabled) {
    const features = LANG_PRONOUN_FEATURES[lang];
    if (features) {
      for (const pf of features) {
        if (isFeatureEnabled(pf.id)) return new Set(pf.pronouns);
      }
      return new Set(features[0].pronouns);
    }
    return null; // No filtering for NB/NN/EN
  }

  // ── buildWordList — copied verbatim from word-prediction.js:465–755 ──
  //
  // Preserves every emitted field on each entry. Consumers (spell-check.js
  // rebuildIndexes) rely on: word, display, translation, type, bank,
  // baseWord, pronoun, genus, formKey, tenseKey, number, definiteness,
  // caseName. Do NOT "clean up" the shape — pitfall #2 in RESEARCH.md.
  function buildWordList(data, lang, isFeatureEnabled) {
    const wordList = [];
    if (!data) return wordList;

    const isNorwegian = lang === 'nb' || lang === 'nn';
    const allowedPronouns = getAllowedPronouns(lang, isFeatureEnabled);

    for (const bank of BANKS) {
      const bankData = data[bank];
      if (!bankData || typeof bankData !== 'object') continue;

      for (const entry of Object.values(bankData)) {
        if (!entry.word) continue;

        const translation = entry.translation || entry.translations?.nb || '';

        // Add base word
        wordList.push({
          word: entry.word.toLowerCase(),
          display: entry.word,
          translation: translation,
          type: 'base',
          bank: bank,
          genus: bank === 'nounbank' ? (entry.genus || null) : null
        });

        // Add Norwegian translation for reverse prediction
        if (translation) {
          wordList.push({
            word: translation.toLowerCase(),
            display: translation,
            translation: entry.word,
            type: 'translation'
          });
        }

        // Add known typos — when student types a common misspelling,
        // suggest the correct word with high priority
        if (entry.typos && Array.isArray(entry.typos)) {
          for (const typo of entry.typos) {
            wordList.push({
              word: typo.toLowerCase(),
              display: entry.word,  // Show the correct word
              translation: translation,
              type: 'typo',
              bank: bank,
              baseWord: entry.word
            });
          }
        }

        // Add accepted forms — alternative valid spellings
        if (entry.acceptedForms && Array.isArray(entry.acceptedForms)) {
          for (const form of entry.acceptedForms) {
            wordList.push({
              word: form.toLowerCase(),
              display: form,
              translation: `${entry.word} (${translation || ''})`,
              type: 'accepted',
              bank: bank,
              baseWord: entry.word
            });
          }
        }

        // Add conjugated verb forms
        if (bank === 'verbbank' && entry.conjugations) {
          for (const [tense, tenseData] of Object.entries(entry.conjugations)) {
            // For DE/ES/FR: gate by tense feature
            if (!isNorwegian) {
              const featureId = TENSE_FEATURES[tense];
              if (featureId && !isFeatureEnabled(featureId)) continue;
            }

            if (tenseData.former) {
              if (Array.isArray(tenseData.former)) {
                // Spanish/French: array of forms, map index to pronoun label
                const pronounLabels = LANGUAGE_PRONOUNS[lang] || [];
                const arrTenseKey = TENSE_GROUP[tense] || null;
                tenseData.former.forEach((form, index) => {
                  if (!form) return;
                  const pronoun = pronounLabels[index] || `${index}`;
                  // Filter by allowed pronouns (if set)
                  if (allowedPronouns && !allowedPronouns.has(pronoun)) return;
                  const formLower = form.toLowerCase();
                  wordList.push({
                    word: formLower,
                    display: form,
                    translation: `${entry.word} (${pronoun})`,
                    type: 'conjugation',
                    pronoun: pronoun,
                    baseWord: entry.word,
                    tenseKey: arrTenseKey
                  });
                });
              } else if (typeof tenseData.former === 'object') {
                // Object with keys: German uses pronouns (ich, du, ...),
                // NB/NN uses form labels (infinitiv, presens, ...),
                // EN uses English pronouns (I, you, he/she, ...)
                for (const [key, form] of Object.entries(tenseData.former)) {
                  // Only apply pronoun filtering for German
                  if (lang === 'de' && allowedPronouns && !allowedPronouns.has(key)) continue;

                  // NB/NN: gate each form individually by its own grammar feature
                  if (isNorwegian && NB_NN_FORM_FEATURES[key]) {
                    if (!isFeatureEnabled(NB_NN_FORM_FEATURES[key])) continue;
                  }

                  // NB/NN: tense is derived from form key (presens, preteritum, etc.)
                  // DE: tense is the outer loop variable (presens, preteritum, perfektum)
                  const objTenseKey = isNorwegian ? (TENSE_GROUP[key] || null) : (TENSE_GROUP[tense] || null);
                  const formLower = form.toLowerCase();

                  wordList.push({
                    word: formLower,
                    display: form,
                    translation: `${entry.word} (${key})`,
                    type: 'conjugation',
                    pronoun: lang === 'de' ? key : null,
                    formKey: isNorwegian ? key : null,
                    baseWord: entry.word,
                    tenseKey: objTenseKey
                  });
                }
              }
            }

            // EN perfect tense: participle/present_participle (no former)
            if (tenseData.participle) {
              wordList.push({
                word: tenseData.participle.toLowerCase(),
                display: tenseData.participle,
                translation: `${entry.word} (past participle)`,
                type: 'conjugation',
                baseWord: entry.word
              });
            }
            if (tenseData.present_participle) {
              wordList.push({
                word: tenseData.present_participle.toLowerCase(),
                display: tenseData.present_participle,
                translation: `${entry.word} (-ing)`,
                type: 'conjugation',
                baseWord: entry.word
              });
            }
          }
        }

        // Add noun case forms (v2.0 format)
        if (bank === 'nounbank' && entry.cases) {
          for (const [caseName, caseData] of Object.entries(entry.cases)) {
            // Feature gating per case
            if (caseName === 'akkusativ' && !isFeatureEnabled('grammar_accusative_nouns')) continue;
            if (caseName === 'dativ' && !isFeatureEnabled('grammar_dative')) continue;
            if (caseName === 'genitiv' && !isFeatureEnabled('grammar_genitiv')) continue;

            if (!caseData.forms) continue;

            for (const [number, numberForms] of Object.entries(caseData.forms)) {
              if (!numberForms) continue; // plurale tantum: singular is null
              for (const [article, form] of Object.entries(numberForms)) {
                if (!form) continue;
                wordList.push({
                  word: form.toLowerCase(),
                  display: form,
                  translation: `${entry.word} (${caseName} ${number})`,
                  type: 'case',
                  baseWord: entry.word,
                  genus: entry.genus || null,
                  caseName: caseName
                });
              }
            }
          }
        }

        // Add NB/NN noun forms (ubestemt/bestemt × entall/flertall)
        if (bank === 'nounbank' && entry.forms) {
          for (const [formType, forms] of Object.entries(entry.forms)) {
            if (!forms || typeof forms !== 'object') continue;
            for (const [number, form] of Object.entries(forms)) {
              if (!form || form.toLowerCase() === (entry.word || '').toLowerCase()) continue;
              wordList.push({
                word: form.toLowerCase(),
                display: form,
                translation: `${entry.word} (${formType} ${number})`,
                type: 'nounform',
                bank: bank,
                baseWord: entry.word,
                genus: entry.genus || null,
                number: number,
                definiteness: formType,
              });
            }
          }
        }

        // Add plural forms
        if (bank === 'nounbank' && entry.plural && isFeatureEnabled('grammar_plural')) {
          wordList.push({
            word: entry.plural.toLowerCase(),
            display: entry.plural,
            translation: `${entry.word} (flertall)`,
            type: 'plural',
            baseWord: entry.word,
            genus: entry.genus || null
          });
        }

        // Add adjective comparison forms
        // German: entry.komparativ (string), Spanish/French: entry.comparison.komparativ.form (nested)
        if (bank === 'adjectivebank') {
          const komparativ = entry.komparativ
            || entry.comparison?.komparativ?.form || entry.comparison?.komparativ
            || entry.comparison?.comparativo?.form
            || entry.comparison?.comparatif?.form
            || entry.comparison?.comparative;
          const superlativ = entry.superlativ
            || entry.comparison?.superlativ?.form || entry.comparison?.superlativ
            || entry.comparison?.superlativo?.form
            || entry.comparison?.superlatif?.form
            || entry.comparison?.superlative;

          if (komparativ && isFeatureEnabled('grammar_comparative')) {
            wordList.push({
              word: komparativ.toLowerCase(),
              display: komparativ,
              translation: `${entry.word} (komparativ)`,
              type: 'comparative',
              baseWord: entry.word
            });
          }
          if (superlativ && isFeatureEnabled('grammar_superlative')) {
            wordList.push({
              word: superlativ.toLowerCase(),
              display: superlativ,
              translation: `${entry.word} (superlativ)`,
              type: 'superlative',
              baseWord: entry.word
            });
          }

          // NB/NN: emit declined adjective forms (maskulin/feminin/noytrum/flertall/bestemt)
          // so gender+number+definiteness agreement can surface the right form.
          if (isNorwegian && entry.declension?.positiv) {
            const ADJ_FORM_META = {
              maskulin: { genus: 'm', number: 'entall', definiteness: 'ubestemt' },
              feminin: { genus: 'f', number: 'entall', definiteness: 'ubestemt' },
              noytrum: { genus: 'n', number: 'entall', definiteness: 'ubestemt' },
              flertall: { genus: null, number: 'flertall', definiteness: null },
              bestemt: { genus: null, number: 'entall', definiteness: 'bestemt' },
            };
            const baseLower = (entry.word || '').toLowerCase();
            for (const [formKey, form] of Object.entries(entry.declension.positiv)) {
              if (!form || typeof form !== 'string') continue;
              const meta = ADJ_FORM_META[formKey];
              if (!meta) continue;
              const lower = form.toLowerCase();
              if (lower === baseLower) continue;
              // Intentionally emit duplicates by word (e.g. flertall & bestemt
              // both "store") — display-level dedup downstream keeps the
              // highest-scoring match for the current agreement context.
              wordList.push({
                word: lower,
                display: form,
                translation: `${entry.word} (${formKey})`,
                type: 'adjform',
                baseWord: entry.word,
                genus: meta.genus,
                number: meta.number,
                definiteness: meta.definiteness,
              });
            }
          }
        }
      }
    }

    return wordList;
  }

  // ── normalizeBigrams — copied verbatim from word-prediction.js:769–781 ──
  //
  // Deletes raw._metadata; lowercases both outer ("prev word") and inner
  // ("next word") keys; merges duplicates (e.g. "Guten"+"guten") by keeping
  // the higher weight. Mutates the input by deleting _metadata — matches the
  // original semantics exactly. Pass a fresh parse to this function.
  function normalizeBigrams(raw) {
    if (!raw) return null;
    delete raw._metadata;
    const out = {};
    for (const [key, pairs] of Object.entries(raw)) {
      const lowerKey = key.toLowerCase();
      const merged = out[lowerKey] || {};
      for (const [word, weight] of Object.entries(pairs)) {
        const lowerWord = word.toLowerCase();
        merged[lowerWord] = Math.max(merged[lowerWord] || 0, weight);
      }
      out[lowerKey] = merged;
    }
    return out;
  }

  // ── buildLookupIndexes — copied verbatim from spell-check.js:136–172 ──
  //
  // Every Map/Set key is lowercase. Caller MUST pass a wordList where
  // entry.word is already lowercased (buildWordList guarantees this).
  function buildLookupIndexes(wordList, lang) {
    const nounGenus = new Map();        // 'hus' → 'n'
    const verbInfinitive = new Map();   // 'spiser' → 'spise'
    const validWords = new Set();       // every known lowercase form
    const typoFix = new Map();          // 'komer' → 'kommer'
    const compoundNouns = new Set();    // noun-bank base entries

    for (const entry of wordList) {
      const w = entry.word;
      if (!w) continue;
      validWords.add(w);
      // Verb infinitives are stored as "å sykle" / "å være" — also accept the
      // bare infinitive so unprefixed usage doesn't get flagged as unknown.
      if (w.startsWith('å ')) validWords.add(w.slice(2));

      if ((entry.bank === 'nounbank' || entry.type === 'nounform' || entry.type === 'plural') && entry.genus) {
        // Only set genus if not already present, so the base form wins
        // for common ambiguous words.
        if (!nounGenus.has(w)) nounGenus.set(w, entry.genus);
      }

      // For særskriving: only consider noun-bank base entries, to avoid
      // flagging "stor by" (valid phrase) as a compound of the adjective form.
      if (entry.bank === 'nounbank' && entry.type !== 'typo') {
        compoundNouns.add(w);
      }

      if (entry.type === 'conjugation' && entry.baseWord) {
        const inf = entry.baseWord.replace(/^å\s+/i, '').trim();
        if (inf && inf !== w) verbInfinitive.set(w, inf);
      }

      if (entry.type === 'typo' && entry.display) {
        typoFix.set(w, entry.display);
      }
    }

    return { nounGenus, verbInfinitive, validWords, typoFix, compoundNouns };
  }

  // ── Public API ──

  function buildIndexes({ raw, bigrams, lang, isFeatureEnabled } = {}) {
    // Default predicate: emit all forms (Node / test use — "superset" policy
    // per CONTEXT: consumers filter further at the seam level).
    const iff = typeof isFeatureEnabled === 'function' ? isFeatureEnabled : () => true;

    const wordList = buildWordList(raw, lang, iff);
    const { nounGenus, verbInfinitive, validWords, typoFix, compoundNouns } =
      buildLookupIndexes(wordList, lang);
    const normBigrams = bigrams ? normalizeBigrams(bigrams) : null;

    return {
      wordList,
      nounGenus,
      verbInfinitive,
      validWords,
      typoFix,
      compoundNouns,
      bigrams: normBigrams,
      // Phase 1: freq table is always empty. DATA-01 in Phase 2 populates it
      // from the frequency layer; the getter signature does not change.
      freq: new Map(),
      // typoBank is an alias (same Map reference) of typoFix — the data-
      // oriented name used by consumers doing lookup/autocorrect work.
      typoBank: typoFix,
    };
  }

  // ── Dual-export footer ──
  // Writes `self.__lexiVocabCore` in the browser (content script) AND
  // `module.exports` in Node — same API, same code path. `self` is defined
  // both in service workers / content scripts and in Node 18+.
  const api = { buildIndexes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') self.__lexiVocabCore = api;
})();
