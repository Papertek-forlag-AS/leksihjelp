/**
 * dict-state-builder.test.js — Phase 33-01 Task 1
 *
 * Verifies the buildDictState entry point that lifts popup.js's inline
 * NB-enrichment / inflection-index / bidirectional _generatedFrom walk into
 * a shared pure function, so the lockdown sidepanel host can populate the
 * full dictionary view state on first paint.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const builder = require('./dict-state-builder.js');

// ── Fixtures ─────────────────────────────────────────────────────────────

const minimalGermanBanks = {
  verbbank: {
    sein_verb: {
      word: 'sein',
      translation: 'å være',
      conjugations: {
        presens: { former: { ich: 'bin', du: 'bist', _meta: 'skip' } },
      },
    },
  },
  nounbank: {
    schule_noun: {
      word: 'Schule',
      genus: 'f',
      plural: 'die Schulen',
    },
  },
  _metadata: { language: 'de' },
};

const targetWithNbBacklink = {
  nounbank: {
    schule_noun: {
      word: 'Schule',
      genus: 'f',
      _generatedFrom: 'nb-de/nounbank:skole_noun',
    },
  },
};

const sisterWithLinkedToAndGen = {
  nounbank: {
    skole_noun: {
      word: 'skole',
      falseFriends: [{ note: 'looks like English school' }],
      linkedTo: { de: { primary: 'schule_noun' } },
      _generatedFrom: 'de-nb/nounbank:schule_noun',
    },
  },
};

const fakeVocabCore = {
  buildInflectionIndex: () => new Map([['gehe', [{ entry: { word: 'gehen' }, matchType: 'conjugation' }]]]),
  buildIndexes: ({ raw, lang }) => ({
    nounGenus: new Map([['Schule', 'f']]),
    other: 'preserved',
    _lang: lang,
  }),
};

// ── Tests ────────────────────────────────────────────────────────────────

test('Test 1 — buildDictState with raw only returns flattened state + empty NB maps', () => {
  const state = builder.buildDictState({
    raw: minimalGermanBanks,
    lang: 'de',
    vocabCore: fakeVocabCore,
  });

  assert.ok(Array.isArray(state.allWords), 'allWords is array');
  assert.equal(state.allWords.length, 2, 'sein + schule flattened');
  assert.ok(state.inflectionIndex instanceof Map, 'inflectionIndex is Map');
  assert.ok(state.nounGenusMap instanceof Map, 'nounGenusMap is Map');
  assert.equal(state.nounGenusMap.get('Schule'), 'f', 'nounGenusMap populated via vocabCore');
  assert.ok(state.currentIndexes && state.currentIndexes.other === 'preserved', 'currentIndexes preserved from vocabCore');
  assert.equal(state.noWords.length, 0, 'noWords empty when sisterRaw=null');
  assert.equal(state.nbEnrichmentIndex.size, 0, 'nbEnrichmentIndex empty');
  assert.equal(state.nbTranslationIndex.size, 0, 'nbTranslationIndex empty');
  assert.equal(state.nbIdToTargetIndex.size, 0, 'nbIdToTargetIndex empty');
});

test('Test 2 — sisterRaw with linkedTo + falseFriends → nbEnrichmentIndex populated', () => {
  const state = builder.buildDictState({
    raw: minimalGermanBanks,
    sisterRaw: sisterWithLinkedToAndGen,
    lang: 'de',
    noLang: 'nb',
    vocabCore: fakeVocabCore,
  });

  assert.ok(state.nbEnrichmentIndex.has('schule_noun'), 'enrichment keyed by linkedTo.de.primary');
  const enrich = state.nbEnrichmentIndex.get('schule_noun');
  assert.equal(enrich.falseFriends.length, 1, 'falseFriends carried');
});

test('Test 3 — sister _generatedFrom de-nb/... → nbTranslationIndex populated (NB→target)', () => {
  const state = builder.buildDictState({
    raw: minimalGermanBanks,
    sisterRaw: sisterWithLinkedToAndGen,
    lang: 'de',
    noLang: 'nb',
    vocabCore: fakeVocabCore,
  });

  assert.equal(state.nbTranslationIndex.get('schule_noun'), 'skole', 'NB word resolves for target id');
});

test('Test 4 — target _generatedFrom nb-de/... → nbIdToTargetIndex populated (target→NB)', () => {
  const state = builder.buildDictState({
    raw: targetWithNbBacklink,
    sisterRaw: sisterWithLinkedToAndGen,
    lang: 'de',
    noLang: 'nb',
    vocabCore: fakeVocabCore,
  });

  assert.equal(state.nbIdToTargetIndex.get('skole_noun'), 'schule_noun', 'NB id maps to target id');
  assert.equal(state.nbTranslationIndex.get('schule_noun'), 'skole', 'translation index also populated');
});

test('Test 5 — vocabCore undefined falls back to module-internal builders, allWords still flattens', () => {
  const state = builder.buildDictState({
    raw: minimalGermanBanks,
    lang: 'de',
    // vocabCore undefined
  });

  assert.ok(state.inflectionIndex instanceof Map, 'inflectionIndex is Map (own builder)');
  assert.ok(state.inflectionIndex.has('bin'), 'own buildInflectionIndex indexed conjugation form');
  assert.equal(state.nounGenusMap.size, 0, 'nounGenusMap defaults to empty Map');
  assert.equal(state.currentIndexes, null, 'currentIndexes null without vocabCore');
  assert.equal(state.allWords.length, 2, 'allWords still flattened');
});

test('Test 6 — sisterRaw null (lang === noLang case) → all NB indexes empty', () => {
  const state = builder.buildDictState({
    raw: minimalGermanBanks,
    sisterRaw: null,
    lang: 'nb',
    noLang: 'nb',
    vocabCore: fakeVocabCore,
  });

  assert.equal(state.nbEnrichmentIndex.size, 0, 'nbEnrichmentIndex empty');
  assert.equal(state.nbTranslationIndex.size, 0, 'nbTranslationIndex empty');
  assert.equal(state.nbIdToTargetIndex.size, 0, 'nbIdToTargetIndex empty');
  assert.equal(state.noWords.length, 0, 'noWords empty');
  assert.equal(state.noNounGenusMap.size, 0, 'noNounGenusMap empty');
});
