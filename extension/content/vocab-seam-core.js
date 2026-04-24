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
    'generalbank', 'numbersbank', 'phrasesbank', 'pronounsbank',
    'languagesbank',      // Phase 05.1 Gap B
    'nationalitiesbank'   // Phase 05.1 Gap B
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
    presens: 'present', presente: 'present', present: 'present',
    preteritum: 'past', preterito: 'past', past: 'past', simple: 'past',
    perfektum: 'perfect', perfecto: 'perfect', passe_compose: 'perfect',
    perfektum_partisipp: 'perfect',
    participle: 'perfect',
    present_participle: 'continuous'
  };

  // Tense keys to feature mapping (supports multiple languages)
  const TENSE_FEATURES = {
    presens: 'grammar_present',
    presente: 'grammar_present',
    present: 'grammar_en_present',
    past: 'grammar_en_past',
    perfect: 'grammar_en_perfect',
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

  // ── Phonetic equivalence rules per language ──
  // Maps common spelling confusions for dyslexic learners
  const PHONETIC_RULES = {
    de: [
      // Vowel confusions
      ['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue'],
      ['ß', 'ss'],
      ['ei', 'ai'], ['ei', 'ey'], ['ai', 'ey'],
      // Consonant confusions
      ['sch', 'sh'], ['sch', 'sk'],
      ['ch', 'k'], ['ch', 'ck'],
      ['v', 'f'], ['v', 'w'],
      ['th', 't'],
      ['ph', 'f'],
      ['ie', 'i'], ['ie', 'ih'],
      ['z', 'ts'], ['z', 'tz'],
      ['qu', 'kw'],
      ['chs', 'x'], ['cks', 'x'],
      ['dt', 't'], ['d', 't'],  // Word-final devoicing
      ['b', 'p'], ['g', 'k'],   // Word-final devoicing
    ],
    es: [
      // Common Spanish confusions
      ['b', 'v'],
      ['c', 's'], ['c', 'z'], ['s', 'z'],
      ['ll', 'y'],
      ['j', 'g'],  // before e/i
      ['qu', 'k'], ['qu', 'c'],
      ['h', ''],  // Silent h
      ['rr', 'r'],
      ['ñ', 'ny'], ['ñ', 'ni'],
      ['gü', 'gu'],
    ],
    fr: [
      // Common French confusions
      ['é', 'e'], ['è', 'e'], ['ê', 'e'], ['ë', 'e'],
      ['à', 'a'], ['â', 'a'],
      ['ù', 'u'], ['û', 'u'],
      ['î', 'i'], ['ï', 'i'],
      ['ô', 'o'],
      ['ç', 's'], ['ç', 'c'],
      ['ph', 'f'],
      ['qu', 'k'],
      ['eau', 'o'], ['au', 'o'],
      ['ai', 'e'], ['ei', 'e'],
      ['ou', 'u'],
      ['oi', 'wa'],
      ['ch', 'sh'],
      ['gn', 'ny'],
    ],
    nb: [
      // Double vs single consonants (most common Norwegian spelling error)
      ['ll', 'l'], ['mm', 'm'], ['nn', 'n'], ['tt', 't'],
      ['kk', 'k'], ['pp', 'p'], ['ss', 's'], ['dd', 'd'],
      ['gg', 'g'], ['ff', 'f'], ['bb', 'b'], ['rr', 'r'],
      // Sibilant confusions
      ['skj', 'sj'], ['sk', 'sj'],
      ['kj', 'tj'], ['kj', 'k'],
      // Silent/weak consonants
      ['hv', 'v'],       // hva/va, hvor/vor
      ['gj', 'j'],       // gjøre/jøre
      ['hj', 'j'],       // hjemme/jemme
      ['lj', 'j'],       // ljug/jug
      // Final devoicing / confusion
      ['d', 't'], ['g', 'k'],
      ['nd', 'nn'],       // band/bann
      // Vowel confusions
      ['æ', 'e'], ['ø', 'o'], ['å', 'o'],
      ['ei', 'e'], ['ai', 'e'],
      ['au', 'ø'],
      ['y', 'i'],
    ],
    nn: [
      // Double vs single consonants
      ['ll', 'l'], ['mm', 'm'], ['nn', 'n'], ['tt', 't'],
      ['kk', 'k'], ['pp', 'p'], ['ss', 's'], ['dd', 'd'],
      ['gg', 'g'], ['ff', 'f'], ['bb', 'b'], ['rr', 'r'],
      // Sibilant confusions
      ['skj', 'sj'], ['sk', 'sj'],
      ['kj', 'tj'], ['kj', 'k'],
      // Silent/weak consonants
      ['hv', 'v'],
      ['gj', 'j'],
      ['hj', 'j'],
      ['lj', 'j'],
      // Final devoicing / confusion
      ['d', 't'], ['g', 'k'],
      ['nd', 'nn'],
      // Vowel confusions
      ['æ', 'e'], ['ø', 'o'], ['å', 'o'],
      ['ei', 'e'], ['ai', 'e'],
      ['au', 'ø'],
      ['y', 'i'],
    ]
  };

  /**
   * Normalize a string using phonetic rules for the current language.
   * Replaces common confusable patterns with a canonical form.
   */
  function phoneticNormalize(str, lang) {
    const rules = PHONETIC_RULES[lang] || [];
    let normalized = str.toLowerCase();

    for (const [a, b] of rules) {
      // Normalize both sides to the shorter/canonical form
      const canonical = a.length <= b.length ? a : b;
      const variant = a.length <= b.length ? b : a;

      // Replace the variant with the canonical form
      if (variant && normalized.includes(variant)) {
        normalized = normalized.split(variant).join(canonical);
      }
    }

    // Also strip accents as a final normalization
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return normalized;
  }

  /**
   * Score a phonetically normalized query against a phonetically normalized target.
   * Used when standard matching fails, to catch spelling confusions.
   */
  function phoneticMatchScore(queryPhonetic, targetPhonetic) {
    // Phonetic starts-with
    if (targetPhonetic.startsWith(queryPhonetic)) {
      return 70 + (queryPhonetic.length / targetPhonetic.length) * 20;
    }

    // Phonetic contains
    if (targetPhonetic.includes(queryPhonetic)) {
      return 35;
    }

    // Phonetic fuzzy (Levenshtein on normalized forms)
    if (queryPhonetic.length >= 3) {
      const maxDist = queryPhonetic.length <= 4 ? 1 : 2;
      const targetPrefix = targetPhonetic.slice(0, queryPhonetic.length + maxDist);
      const dist = levenshtein(queryPhonetic, targetPrefix);
      if (dist <= maxDist) {
        return 20 - dist * 5;
      }
    }

    return 0;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[m][n];
  }

  // ── Helpers ──



  // Shared "all features enabled" predicate singleton. Declared at module
  // scope so buildIndexes can reference-compare against it to skip a
  // duplicate buildWordList call when the caller already passed the same
  // identity predicate (fixture harness + first-load Node path).
  const iffTrue = () => true;

  function getAllowedPronouns(lang, isFeatureEnabled) {
    const features = LANG_PRONOUN_FEATURES[lang];
    if (features) {
      for (const pf of features) {
        if (isFeatureEnabled(pf.id)) return new Set(pf.pronouns);
      }
      return new Set(features[0].pronouns);
    }
    // For NB/NN/EN, we don't filter by default, so return a Set that always returns true or handle as null
    return null;
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

        // Pitfall 7 (Phase 3-04): raw `entry.frequency` scales differ wildly
        // per language (DE 0–48k+, similar shape elsewhere). Normalize once
        // at seam-build time to a Zipf-alike float so the word-prediction
        // ranker can feed all 6 languages into one signal without per-language
        // scale math. For NB/NN we PREFER VOCAB.getFrequency (Zipf sidecar
        // populated from freq-{nb,nn}.json), but `entry.zipf` here is the
        // fallback + the only source for de/es/fr/en. Computed once per
        // source entry; attached to every emitted wordList push so consumers
        // never need to know the bank-row shape.
        const rawFrequency = entry.frequency;
        const zipf = (typeof rawFrequency === 'number' && rawFrequency > 0)
          ? Math.log10(rawFrequency + 1)
          : 0;

        const baseWords = entry.word.split(';').map(w => w.trim()).filter(Boolean);
        for (const w of baseWords) {
          wordList.push({
            word: w.toLowerCase(),
            display: w,
            translation: translation,
            type: 'base',
            bank: bank,
            genus: bank === 'nounbank' ? (entry.genus || null) : null,
            zipf: zipf
          });
        }

        // Add Norwegian translation for reverse prediction
        if (translation) {
          wordList.push({
            word: translation.toLowerCase(),
            display: translation,
            translation: entry.word,
            type: 'translation',
            zipf: zipf
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
              baseWord: entry.word,
              zipf: zipf
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
              baseWord: entry.word,
              zipf: zipf
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
                    tenseKey: arrTenseKey,
                    zipf: zipf
                  });
                });
              } else if (typeof tenseData.former === 'object') {
                // Object with keys: German uses pronouns (ich, du, ...),
                // NB/NN uses form labels (infinitiv, presens, ...),
                // EN uses English pronouns (I, you, he/she, ...)
                for (const [key, form] of Object.entries(tenseData.former)) {
                  // Only apply pronoun filtering for German/English if allowedPronouns is set
                  if ((lang === 'de' || lang === 'en') && allowedPronouns && !allowedPronouns.has(key)) continue;

                  // NB/NN: gate each form individually by its own grammar feature
                  if (isNorwegian && NB_NN_FORM_FEATURES[key]) {
                    if (!isFeatureEnabled(NB_NN_FORM_FEATURES[key])) continue;
                  }

                  // NB/NN: tense is derived from form key (presens, preteritum, etc.)
                  // Other: tense is the outer loop (tense)
                  const objTenseKey = isNorwegian
                    ? (TENSE_GROUP[key] || null)
                    : (TENSE_GROUP[tense] || null);
                  const formValues = Array.isArray(form) ? form : [form];
                  for (const formStr of formValues) {
                    const formLower = formStr.toLowerCase();
                    wordList.push({
                      word: formLower,
                      display: formStr,
                      translation: `${entry.word} (${key})`,
                      type: 'conjugation',
                      pronoun: isNorwegian ? null : key,
                      formKey: isNorwegian ? key : null,
                      baseWord: entry.word,
                      tenseKey: objTenseKey,
                      zipf: zipf
                    });
                  }
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
                baseWord: entry.word,
                zipf: zipf
              });
            }
            if (tenseData.present_participle) {
              wordList.push({
                word: tenseData.present_participle.toLowerCase(),
                display: tenseData.present_participle,
                translation: `${entry.word} (-ing)`,
                type: 'conjugation',
                baseWord: entry.word,
                zipf: zipf
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
                  caseName: caseName,
                  zipf: zipf
                });
              }
            }
          }
        }

        // Add NB/NN noun forms (ubestemt/bestemt × entall/flertall)
        if (bank === 'nounbank' && entry.forms) {
          for (const [formType, forms] of Object.entries(entry.forms)) {
            if (!forms || typeof forms !== 'object') continue;
            for (const [number, formRaw] of Object.entries(forms)) {
              const formValues = Array.isArray(formRaw) ? formRaw : [formRaw];
              for (const form of formValues) {
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
                  zipf: zipf
                });
              }
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
            genus: entry.genus || null,
            zipf: zipf
          });
        }

        // Phase 05.1 Gap B — nationalitiesbank morphology seeding.
        // Entries carry noun-shape fields (plural, definite, plural_definite) but
        // stay out of the nounGenus pipe per the typed-bank-shield pattern
        // (Plan 05.1-02). Seed the forms into wordList with genus: null so they
        // populate validWords (preventing typo-fuzzy false-flags on plurals like
        // "Nordmenn" / "svensker") without seeding nounGenus.
        if (bank === 'nationalitiesbank') {
          if (entry.plural) {
            wordList.push({
              word: entry.plural.toLowerCase(),
              display: entry.plural,
              translation: `${entry.word} (flertall)`,
              type: 'nationalityform',
              baseWord: entry.word,
              genus: null,
              zipf: zipf
            });
          }
          if (entry.definite) {
            wordList.push({
              word: entry.definite.toLowerCase(),
              display: entry.definite,
              translation: `${entry.word} (bestemt)`,
              type: 'nationalityform',
              baseWord: entry.word,
              genus: null,
              zipf: zipf
            });
          }
          if (entry.plural_definite) {
            wordList.push({
              word: entry.plural_definite.toLowerCase(),
              display: entry.plural_definite,
              translation: `${entry.word} (flertall bestemt)`,
              type: 'nationalityform',
              baseWord: entry.word,
              genus: null,
              zipf: zipf
            });
          }
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
              baseWord: entry.word,
              zipf: zipf
            });
          }
          if (superlativ && isFeatureEnabled('grammar_superlative')) {
            wordList.push({
              word: superlativ.toLowerCase(),
              display: superlativ,
              translation: `${entry.word} (superlativ)`,
              type: 'superlative',
              baseWord: entry.word,
              zipf: zipf
            });
          }

          // NB/NN: emit declined adjective forms (maskulin/feminin/noytrum/flertall/bestemt)
          // so gender+number+definiteness agreement can surface the right form.
          //
          // Iterates all three degrees (positiv, komparativ, superlativ) so that
          // inflected comparison forms like `beste` (superlativ.bestemt of `god`)
          // enter validWords. Previously only `declension.positiv` was iterated,
          // which meant the superlative-definite (`beste`) and comparative
          // declension slots silently dropped — flipping typo-fuzzy into false-
          // positive mode on clean sentences like "den beste venen min".
          //
          // Array values are tolerated: phase-36 NN migration introduced
          // array-valued declension slots (e.g. `["sol-en", "sola", "solen"]`
          // for multi-variant forms). Each array element is emitted.
          if (isNorwegian && entry.declension) {
            const ADJ_FORM_META = {
              maskulin: { genus: 'm', number: 'entall', definiteness: 'ubestemt' },
              feminin: { genus: 'f', number: 'entall', definiteness: 'ubestemt' },
              noytrum: { genus: 'n', number: 'entall', definiteness: 'ubestemt' },
              flertall: { genus: null, number: 'flertall', definiteness: null },
              bestemt: { genus: null, number: 'entall', definiteness: 'bestemt' },
              ubestemt: { genus: null, number: 'entall', definiteness: 'ubestemt' },
              alle: { genus: null, number: null, definiteness: null },
            };
            const baseLower = (entry.word || '').toLowerCase();
            for (const degree of ['positiv', 'komparativ', 'superlativ']) {
              const degreeBlock = entry.declension[degree];
              if (!degreeBlock || typeof degreeBlock !== 'object') continue;
              for (const [formKey, formRaw] of Object.entries(degreeBlock)) {
                const formValues = Array.isArray(formRaw) ? formRaw : [formRaw];
                for (const form of formValues) {
                  if (!form || typeof form !== 'string') continue;
                  const meta = ADJ_FORM_META[formKey] || { genus: null, number: null, definiteness: null };
                  const lower = form.toLowerCase();
                  if (degree === 'positiv' && lower === baseLower) continue;
                  // Intentionally emit duplicates by word (e.g. flertall & bestemt
                  // both "store") — display-level dedup downstream keeps the
                  // highest-scoring match for the current agreement context.
                  wordList.push({
                    word: lower,
                    display: form,
                    translation: `${entry.word} (${degree} ${formKey})`,
                    type: degree === 'komparativ' ? 'comparative'
                        : degree === 'superlativ' ? 'superlative'
                        : 'adjform',
                    baseWord: entry.word,
                    genus: meta.genus,
                    number: meta.number,
                    definiteness: meta.definiteness,
                    zipf: zipf
                  });
                }
              }
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
    const isAdjective = new Set();      // 'stor' → true
    const typoFix = new Map();          // 'komer' → 'kommer'
    const compoundNouns = new Set();    // noun-bank base entries
    const knownPresens = new Set();     // 'spiser' → true
    const knownPreteritum = new Set();  // 'spiste' → true
    const verbForms = new Map();        // 'spise' → { present: Set, past: Set }
    const nounForms = new Map();        // 'hus' → { singular: Set, plural: Set }

    const isNorwegian = lang === 'nb' || lang === 'nn';

    for (const entry of wordList) {
      const w = entry.word;
      if (!w) continue;

      if (entry.bank === 'adjectivebank' || entry.type === 'adjective' || (entry.type === 'plural' && entry.bank === 'adjectivebank')) {
        isAdjective.add(w);
      }

      if ((entry.bank === 'nounbank' || entry.type === 'nounform' || entry.type === 'plural') && entry.baseWord) {
        const base = entry.baseWord.toLowerCase();
        if (!nounForms.has(base)) {
          nounForms.set(base, { singular: new Set(), plural: new Set() });
        }
        const forms = nounForms.get(base);
        if (entry.type === 'plural' || entry.wordKey === 'plural') {
          forms.plural.add(w);
        } else {
          forms.singular.add(w);
        }
      }

      if (entry.type === 'conjugation') {
        const inf = (entry.baseWord || '').replace(/^å\s+/i, '').trim();
        if (inf) {
          if (!verbForms.has(inf)) {
            verbForms.set(inf, { present: new Set(), past: new Set() });
          }
          const forms = verbForms.get(inf);
          if (isNorwegian) {
            if (entry.formKey === 'presens') {
              knownPresens.add(w);
              forms.present.add(w);
            } else if (entry.formKey === 'preteritum') {
              knownPreteritum.add(w);
              forms.past.add(w);
            }
          } else {
            if (entry.tenseKey === 'present') {
              knownPresens.add(w);
              forms.present.add(w);
            } else if (entry.tenseKey === 'past') {
              knownPreteritum.add(w);
              forms.past.add(w);
            }
          }
        }
      }
      // Typo-type entries must NOT be added to validWords — they are
      // misspellings, not valid forms. The curated-typo branch in
      // spell-check-core.js skips any token that's in validWords, so
      // adding typos here silently disables the curated-fix path (and
      // the fuzzy path too, since it also respects validWords). This
      // bug was masked in Phase 1 because the baseline NB typo fixtures
      // happened to use typos that weren't in the bank at all. Phase 2
      // DATA-02's typo-bank expansion surfaced it — the seeded cases
      // couldn't hit the curated branch because their own typos had
      // been shadowed into validWords. Fixed here as a Rule-1 auto-fix.
      if (entry.type !== 'typo') {
        validWords.add(w);
      }
      // Verb infinitives are stored as "å sykle" / "å være" — also accept the
      // bare infinitive so unprefixed usage doesn't get flagged as unknown.
      if (entry.type !== 'typo' && w.startsWith('å ')) validWords.add(w.slice(2));

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

    return { nounGenus, verbInfinitive, validWords, isAdjective, knownPresens, knownPreteritum, verbForms, nounForms, typoFix, compoundNouns };
  }

  // ── Public API ──

  function buildIndexes({ raw, bigrams, freq, sisterRaw, lang, isFeatureEnabled } = {}) {
    // Default predicate: emit all forms (Node / test use — "superset" policy
    // per CONTEXT: consumers filter further at the seam level).
    const iff = typeof isFeatureEnabled === 'function' ? isFeatureEnabled : iffTrue;

    // wordList is feature-gated and drives word-PREDICTION — the student sees
    // only the forms whose grammar features are enabled in the popup.
    const wordList = buildWordList(raw, lang, iff);

    // Spell-check lookup indexes (nounGenus / verbInfinitive / validWords /
    // typoFix / compoundNouns) MUST NOT be feature-gated. Example regression:
    // with the default "basic" NB preset, grammar_nb_preteritum is OFF, so
    // preteritum forms like `gikk` never enter the feature-gated wordList and
    // verbInfinitive.get('gikk') returns undefined — the modal_form rule
    // then silently fails on `Kan gikk` because the spell-check rule does
    // not know `gikk` is a verb inflection of `gå`. Fixture harness missed
    // this because it calls buildIndexes with isFeatureEnabled: () => true.
    // Fix: always build lookup indexes from the unfiltered superset. Reuse
    // the already-built wordList when iff is the identity predicate — avoids
    // a second O(N) pass in the Node / test path. (Phase 05.1-05 post-hoc.)
    const unfilteredWordList = (iff === iffTrue)
      ? wordList
      : buildWordList(raw, lang, iffTrue);
    const { 
      nounGenus, verbInfinitive, validWords, isAdjective, 
      knownPresens, knownPreteritum, verbForms, nounForms, typoFix, compoundNouns 
    } = buildLookupIndexes(unfilteredWordList, lang);
     const normBigrams = bigrams ? normalizeBigrams(bigrams) : null;    // Hydrate Zipf frequency map from the sidecar shipped by Phase 2 DATA-01.
    // Freq is null for languages without a freq-{lang}.json sidecar (de/es/fr/en) —
    // consumers get an empty Map and VOCAB.getFrequency returns null for every word,
    // matching today's behaviour for those languages.
    const freqMap = new Map();
    if (freq && typeof freq === 'object') {
      for (const [k, v] of Object.entries(freq)) {
        if (typeof v === 'number') freqMap.set(k.toLowerCase(), v);
      }
    }

    // Phase 4 / SC-03: cross-dialect tolerance. For NB sessions, also derive
    // the NN validWords Set (lowercased, type!=='typo' filtered per Pitfall 1
    // in 04-RESEARCH.md — we must NOT inherit the sister dialect's typo
    // entries, or a word that's WRONG in both dialects would be silently
    // accepted because the other side has it in its typo bank). For de/es/fr/en,
    // sisterRaw is null and the Set stays empty.
    const sisterValidWords = new Set();
    if (sisterRaw && (lang === 'nb' || lang === 'nn')) {
      const sisterLang = lang === 'nb' ? 'nn' : 'nb';
      const sisterList = buildWordList(sisterRaw, sisterLang, () => true);
      for (const entry of sisterList) {
        if (entry.type === 'typo') continue;
        if (entry.word) sisterValidWords.add(entry.word.toLowerCase());
      }
    }

    return {
      wordList,
      nounGenus,
      isAdjective,
      knownPresens,
      knownPreteritum,
      verbForms,
      nounForms,
      verbInfinitive,
      validWords,
      typoFix,
      compoundNouns,
      bigrams: normBigrams,
      // Phase 3-01: hydrated from freq-{lang}.json sidecar (NB/NN today; empty Map for other languages).
      freq: freqMap,
      // Phase 4 / SC-03: cross-dialect validWords Set (NB session → NN lemmas; NN session → NB lemmas).
      // Empty Set for de/es/fr/en. Typo-type entries intentionally excluded (Pitfall 1).
      sisterValidWords,
      // typoBank is an alias (same Map reference) of typoFix — the data-
      // oriented name used by consumers doing lookup/autocorrect work.
      typoBank: typoFix,
    };
  }

  // ── Dual-export footer ──
  // Writes `self.__lexiVocabCore` in the browser (content script) AND
  // `module.exports` in Node — same API, same code path.
  const api = { buildIndexes, phoneticNormalize, phoneticMatchScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiVocabCore = api;
})();
