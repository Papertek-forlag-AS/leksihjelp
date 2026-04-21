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

  console.log('[check-spellcheck-features] PASS — spell-check lookup indexes are feature-independent.');
  console.log('  verbInfinitive entries verified:', verbForms.length);
  console.log('  nounGenus entries verified:    ', nounChecks.length);
  console.log('  validWords entries verified:   ', validChecks.length);
  console.log('  wordList feature-gated:        yes (preteritum-form absent under basic preset)');
}

try {
  main();
} catch (e) {
  console.error('[check-spellcheck-features] THROW:', e.message);
  process.exit(1);
}
