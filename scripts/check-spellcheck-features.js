#!/usr/bin/env node
/**
 * Regression gate — spell-check lookup indexes MUST be feature-independent.
 *
 * Phase 05.1-05 post-hoc. User smoke test 2026-04-21 found that in the
 * browser with the default "basic" NB grammar-features preset (presens +
 * genus + flertall only), the modal-verb rule silently failed on
 * `Kan gikk på skolen` — root cause was `vocab-seam-core.buildIndexes`
 * feeding the feature-gated wordList (grammar_preteritum OFF → `gikk` not
 * emitted) into buildLookupIndexes, so verbInfinitive.get('gikk') was
 * undefined.
 *
 * The bug escaped `check-fixtures` because that runner passes
 * `isFeatureEnabled: () => true`, building the full superset.
 *
 * This gate simulates a browser-like FEATURE-GATED predicate (basic preset)
 * and asserts the spell-check lookup indexes still contain forms that would
 * have been filtered out of the word-prediction wordList. The invariant:
 *   - wordList is feature-gated (drives word-prediction output filtering)
 *   - nounGenus / verbInfinitive / validWords / typoFix / compoundNouns are
 *     NOT feature-gated (spell-check needs the full vocabulary superset)
 *
 * Exit 0 when all asserts pass. Exit 1 with a diagnostic on any failure.
 */
'use strict';

const path = require('path');
const core = require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'));

function fail(msg) {
  console.error('[check-spellcheck-features] FAIL:', msg);
  process.exit(1);
}

function buildBasicPresetPredicate() {
  // Mirrors extension/content/vocab-seam.js buildFeaturePredicate with the
  // popup's "basic" NB preset from grammarfeatures-nb.json.
  const enabled = new Set(['grammar_nb_presens', 'grammar_nb_genus', 'grammar_nb_flertall']);
  const genericToLangMap = {
    'grammar_articles': ['grammar_nb_genus'],
    'grammar_plural': ['grammar_nb_flertall', 'grammar_nb_fleirtal'],
    'grammar_present': ['grammar_nb_presens'],
    'grammar_preteritum': ['grammar_nb_preteritum'],
    'grammar_perfektum': ['grammar_nb_perfektum'],
    'grammar_imperativ': ['grammar_nb_imperativ'],
    'grammar_comparative': ['grammar_nb_komparativ'],
    'grammar_superlative': ['grammar_nb_superlativ'],
  };
  return function isFeatureEnabled(featureId) {
    if (enabled.has(featureId)) return true;
    const langIds = genericToLangMap[featureId];
    if (langIds) return langIds.some(id => enabled.has(id));
    return false;
  };
}

// Per-language configurations for the EN/DE/ES/FR extension of the gate.
// Each config defines a minimal preset (a set of generic + lang-specific
// feature IDs that MUST resolve to false) and the concrete forms that must
// survive in the spell-check lookup indexes regardless.
//
// Why this matters: commit a2725c9 wired grammar-feature gating for EN/DE/
// ES/FR conjugations via TENSE_FEATURES (vocab-seam-core.js:63). The NB gate
// only catches NB regressions — a future refactor could accidentally pipe
// the gated wordList into buildLookupIndexes for EN/DE/ES/FR and the NB gate
// would still pass. This gate closes that gap.
const NON_NB_LANG_CONFIGS = [
  {
    lang: 'en',
    // grammar_en_past is the direct feature ID stored in user preferences —
    // TENSE_FEATURES maps data key `past` to `grammar_en_past` (no generic
    // hop via genericToLangMap). Disabling it filters simple-past forms
    // from wordList. `grammar_en_plural` is the plural gate.
    disabledFeatures: ['grammar_en_past', 'grammar_en_plural', 'grammar_plural'],
    verbForms: [
      { form: 'came', inf: 'come', note: 'simple past of come — past tense gated via grammar_en_past' },
      { form: 'went', inf: 'go', note: 'simple past of go' },
      { form: 'ate', inf: 'eat', note: 'simple past of eat' },
    ],
    // EN has no grammatical gender — nounGenus is sparse for EN. Skip.
    nounChecks: [],
    validChecks: ['came', 'went', 'ate'],
    // wordList filter assertion: `came` tagged as conjugation must be absent
    // under the minimal preset (grammar_en_past disabled).
    wordListFilter: {
      matcher: e => e.type === 'conjugation' && e.word === 'came',
      description: 'conjugation-type entry for "came" (past of come)',
      featureNote: 'grammar_en_past',
    },
  },
  {
    lang: 'de',
    // grammar_preteritum is the generic key TENSE_FEATURES[preteritum] emits.
    // The in-browser predicate would also translate it via genericToLangMap
    // to grammar_de_preteritum — disable both so the gate exercises the
    // gating path regardless of which side is checked.
    disabledFeatures: ['grammar_preteritum', 'grammar_de_preteritum', 'grammar_plural', 'grammar_de_plural'],
    verbForms: [
      { form: 'ging', inf: 'gehen', note: 'preteritum of gehen — gated via grammar_preteritum' },
      { form: 'kam', inf: 'kommen', note: 'preteritum of kommen' },
      { form: 'war', inf: 'sein', note: 'preteritum of sein' },
    ],
    nounChecks: [
      { word: 'haus', genus: 'n', note: 'Haus — neuter' },
      { word: 'mann', genus: 'm', note: 'Mann — masculine' },
    ],
    validChecks: ['ging', 'kam', 'war', 'haus'],
    wordListFilter: {
      matcher: e => e.type === 'conjugation' && e.word === 'ging',
      description: 'conjugation-type entry for "ging" (preteritum of gehen)',
      featureNote: 'grammar_preteritum / grammar_de_preteritum',
    },
  },
  {
    lang: 'es',
    // ES data uses key `preteritum` (not `preterito`) — TENSE_FEATURES maps
    // it to the generic `grammar_preteritum`. Disable both the generic and
    // the Spanish-prefixed variant so the gate is robust to predicate-layer
    // naming drift.
    disabledFeatures: ['grammar_preteritum', 'grammar_es_preteritum', 'grammar_plural', 'grammar_es_plural'],
    verbForms: [
      { form: 'comí', inf: 'comer', note: 'preterito indefinido of comer — gated via grammar_preteritum' },
      { form: 'comió', inf: 'comer', note: 'preterito indefinido (3sg) of comer' },
    ],
    nounChecks: [
      { word: 'casa', genus: 'f', note: 'casa — feminine' },
      { word: 'casas', genus: 'f', note: 'casas (plural) — feminine; must survive with grammar_plural OFF' },
    ],
    validChecks: ['comí', 'comió', 'casa', 'casas'],
    wordListFilter: {
      matcher: e => e.type === 'conjugation' && e.word === 'comí',
      description: 'conjugation-type entry for "comí" (preterito of comer)',
      featureNote: 'grammar_preteritum / grammar_es_preteritum',
    },
  },
  {
    lang: 'fr',
    // FR past tenses are not uniformly covered by TENSE_FEATURES: `imparfait`
    // has no entry (so it's never gated in wordList) and `passe_compose`
    // former values are multi-word ("j'ai aimé"), making a clean wordList-
    // filter assertion structurally awkward. Plural gating is well-behaved
    // though, so anchor the filter assertion there and keep the spell-check
    // invariants (verbInfinitive / validWords) on past-tense forms — those
    // are what matter for this gate's purpose.
    disabledFeatures: ['grammar_plural', 'grammar_fr_plural', 'grammar_passe_compose', 'grammar_fr_passe_compose'],
    verbForms: [
      { form: 'aimais', inf: 'aimer', note: 'imparfait of aimer — must be discoverable by spell-check' },
      { form: 'aimé', inf: 'aimer', note: 'passé composé participle of aimer' },
    ],
    nounChecks: [
      { word: 'maison', genus: 'f', note: 'maison — feminine' },
    ],
    validChecks: ['aimais', 'aimé', 'maison'],
    // For FR we assert via plural filtering — cleaner than passe_compose.
    // Pick a noun with a bundled plural form to verify grammar_plural gates it.
    wordListFilter: {
      matcher: e => e.type === 'plural' && e.word === 'maisons',
      description: 'plural-type entry for "maisons"',
      featureNote: 'grammar_plural / grammar_fr_plural',
    },
  },
];

function buildDisabledPredicate(disabledIds) {
  const disabled = new Set(disabledIds);
  return function isFeatureEnabled(featureId) {
    return !disabled.has(featureId);
  };
}

function checkLanguage(config) {
  const raw = require(path.join(__dirname, '..', 'extension', 'data', config.lang + '.json'));
  const isFeatureEnabled = buildDisabledPredicate(config.disabledFeatures);
  const state = core.buildIndexes({ raw, lang: config.lang, isFeatureEnabled });

  for (const { form, inf, note } of config.verbForms) {
    const got = state.verbInfinitive.get(form);
    if (got !== inf) {
      fail(
        `[${config.lang}] verbInfinitive.get("${form}") expected "${inf}" but got ${JSON.stringify(got)} — ${note}. ` +
        `Spell-check lookup indexes regressed back into the feature-gated wordList path; see vocab-seam-core.buildIndexes comment.`
      );
    }
  }

  for (const { word, genus, note } of config.nounChecks) {
    const got = state.nounGenus.get(word);
    if (got !== genus) {
      fail(`[${config.lang}] nounGenus.get("${word}") expected "${genus}" but got ${JSON.stringify(got)} — ${note}.`);
    }
  }

  for (const w of config.validChecks) {
    if (!state.validWords.has(w)) {
      fail(`[${config.lang}] validWords missing "${w}" — spell-check fuzzy/curated rules will false-flag this token as a typo.`);
    }
  }

  if (config.wordListFilter) {
    const { matcher, description, featureNote } = config.wordListFilter;
    if (state.wordList.some(matcher)) {
      fail(
        `[${config.lang}] wordList contains ${description} even though ${featureNote} is disabled — ` +
        `feature gating on word-prediction output broke. Check vocab-seam-core.buildWordList.`
      );
    }
  }

  return {
    verb: config.verbForms.length,
    noun: config.nounChecks.length,
    valid: config.validChecks.length,
    filterAsserted: !!config.wordListFilter,
  };
}

function main() {
  const raw = require(path.join(__dirname, '..', 'extension', 'data', 'nb.json'));
  const sisterRaw = require(path.join(__dirname, '..', 'extension', 'data', 'nn.json'));
  const isFeatureEnabled = buildBasicPresetPredicate();

  const state = core.buildIndexes({ raw, sisterRaw, lang: 'nb', isFeatureEnabled });

  // Assertion 1: verbInfinitive must contain preteritum forms even when
  // grammar_preteritum is OFF — modal-verb rule depends on this for Kan gikk.
  const verbForms = [
    { form: 'gikk', inf: 'gå', note: 'preteritum of å gå (Phase 05.1-05 regression)' },
    { form: 'leste', inf: 'lese', note: 'preteritum of å lese' },
    { form: 'kjøpte', inf: 'kjøpe', note: 'preteritum of å kjøpe' },
    { form: 'spiser', inf: 'spise', note: 'presens of å spise (control — in gated wordList)' },
  ];
  for (const { form, inf, note } of verbForms) {
    if (state.verbInfinitive.get(form) !== inf) {
      fail(
        `verbInfinitive.get("${form}") expected "${inf}" but got ${JSON.stringify(state.verbInfinitive.get(form))} — ${note}. ` +
        `Spell-check lookup indexes regressed back into the feature-gated wordList path; see vocab-seam-core.buildIndexes comment.`
      );
    }
  }

  // Assertion 2: nounGenus must contain feminine-definite forms even when
  // grammar_plural is OFF (example: boka is a bestemt/entall feminine).
  const nounChecks = [
    { word: 'boka', genus: 'f', note: 'bok bestemt entall — feminine' },
    { word: 'bok', genus: 'f', note: 'bok base — feminine' },
    { word: 'hus', genus: 'n', note: 'hus base — neuter' },
    { word: 'bil', genus: 'm', note: 'bil base — masculine' },
  ];
  for (const { word, genus, note } of nounChecks) {
    if (state.nounGenus.get(word) !== genus) {
      fail(
        `nounGenus.get("${word}") expected "${genus}" but got ${JSON.stringify(state.nounGenus.get(word))} — ${note}.`
      );
    }
  }

  // Assertion 3: validWords must include preteritum forms even when gated.
  const validChecks = ['gikk', 'leste', 'kjøpte', 'spiser', 'boka', 'bøker'];
  for (const w of validChecks) {
    if (!state.validWords.has(w)) {
      fail(`validWords missing "${w}" — spell-check fuzzy/curated rules will false-flag this token as a typo.`);
    }
  }

  // Assertion 4: wordList (word-prediction source) IS still feature-gated.
  // With basic preset (grammar_preteritum OFF), the preteritum-form entry
  // for `gikk` must be absent from wordList — otherwise word-prediction is
  // emitting forms the student asked to hide.
  const hasPreteritumInWordList = state.wordList.some(
    e => e.type === 'conjugation' && e.word === 'gikk' && e.formKey === 'preteritum'
  );
  if (hasPreteritumInWordList) {
    fail(
      'wordList contains preteritum-form `gikk` even though grammar_preteritum is OFF — ' +
      'feature gating on word-prediction output broke. Check vocab-seam-core.buildWordList.'
    );
  }

  // Phase 6: governance index presence — registerWords, collocations,
  // redundancyPhrases must exist on the indexes object (values may be empty
  // when no governance bank data has been synced yet, but the keys must be
  // present so downstream rules don't crash).
  if (!(state.registerWords instanceof Map)) {
    fail('state.registerWords is not a Map — vocab-seam-core.buildIndexes Phase 6 governance extraction missing.');
  }
  if (!Array.isArray(state.collocations)) {
    fail('state.collocations is not an Array — vocab-seam-core.buildIndexes Phase 6 governance extraction missing.');
  }
  if (!Array.isArray(state.redundancyPhrases)) {
    fail('state.redundancyPhrases is not an Array — vocab-seam-core.buildIndexes Phase 6 governance extraction missing.');
  }

  // Extend the same invariant to every non-NB target language. Each config
  // simulates a minimal preset (a disabled-features set) and reasserts that
  // past-tense / plural / noun-gender lookup keys survive in the spell-check
  // indexes while the wordList filter actually fires.
  const perLangStats = NON_NB_LANG_CONFIGS.map(cfg => ({ lang: cfg.lang, ...checkLanguage(cfg) }));

  console.log('[check-spellcheck-features] PASS — spell-check lookup indexes are feature-independent.');
  console.log('  [nb] verbInfinitive:', verbForms.length, ' nounGenus:', nounChecks.length, ' validWords:', validChecks.length, ' wordList-filter: yes');
  for (const s of perLangStats) {
    console.log(
      `  [${s.lang}] verbInfinitive: ${s.verb}  nounGenus: ${s.noun}  validWords: ${s.valid}  wordList-filter: ${s.filterAsserted ? 'yes' : 'skipped'}`
    );
  }
}

try {
  main();
} catch (e) {
  console.error('[check-spellcheck-features] THROW:', e.message);
  process.exit(1);
}
