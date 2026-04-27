#!/usr/bin/env node
/**
 * Phase 24 unit tests — predictCompound function.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Tests the compound prediction algorithm for NB and DE.
 *
 * Exit 0 = all pass, exit 1 = any failure.
 */
'use strict';
const assert = require('assert').strict;
const path = require('path');

const ROOT = path.join(__dirname, '..');
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));

// ── Build test nounGenus Map with curated entries ──
const testNounGenus = new Map([
  // NB nouns
  ['skole', 'm'], ['dag', 'm'], ['hverdag', 'm'], ['mas', 'n'],
  ['gutt', 'm'], ['klasse', 'm'], ['gate', 'f'], ['tur', 'm'],
  ['skog', 'm'], ['bil', 'm'], ['hus', 'n'], ['time', 'm'],
  // DE nouns
  ['chef', 'm'], ['stuhl', 'm'], ['schule', 'f'], ['tag', 'm'],
  ['buch', 'n'], ['laden', 'm'], ['kind', 'n'], ['garten', 'm'],
]);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (e) {
    console.log(`[FAIL] ${name}`);
    console.log(`       ${e.message}`);
    failed++;
  }
}

// ── Test 1: DE fuge-s compound prediction ──
test('DE fuge-s: "chefsstu" suggests "chefsstuhl"', () => {
  const results = vocabCore.predictCompound('chefsstu', testNounGenus, 'de');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.ok(results.length > 0, 'should have at least one suggestion');
  const words = results.map(r => r.word);
  assert.ok(words.includes('chefsstuhl'), `should include "chefsstuhl", got: ${words}`);
});

// ── Test 2: NB zero-fuge compound prediction ──
test('NB zero-fuge: "skoleg" suggests "skolegutt"', () => {
  const results = vocabCore.predictCompound('skoleg', testNounGenus, 'nb');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.ok(results.length > 0, 'should have at least one suggestion');
  const words = results.map(r => r.word);
  assert.ok(words.includes('skolegutt'), `should include "skolegutt", got: ${words}`);
});

// ── Test 3: NB fuge-s recognized for prefix matching ──
test('NB fuge-s: "hverdags" returns suggestions starting with "hverdags"', () => {
  const results = vocabCore.predictCompound('hverdagsm', testNounGenus, 'nb');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.ok(results.length > 0, 'should have at least one suggestion');
  const words = results.map(r => r.word);
  assert.ok(words.includes('hverdagsmas'), `should include "hverdagsmas", got: ${words}`);
});

// ── Test 4: Unknown first component returns empty ──
test('Unknown first component: "xyzabc" returns []', () => {
  const results = vocabCore.predictCompound('xyzabc', testNounGenus, 'nb');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.equal(results.length, 0, 'should have no suggestions');
});

// ── Test 5: Too short input returns empty ──
test('Too short: "abc" returns []', () => {
  const results = vocabCore.predictCompound('abc', testNounGenus, 'nb');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.equal(results.length, 0, 'should have no suggestions');
});

// ── Test 6: Each suggestion includes decomposition ──
test('Each suggestion includes decomposition with parts, gender, confidence', () => {
  const results = vocabCore.predictCompound('skoleg', testNounGenus, 'nb');
  assert.ok(results.length > 0, 'need at least one result');
  for (const r of results) {
    assert.ok(r.word, 'should have word');
    assert.ok(r.decomposition, 'should have decomposition');
    assert.ok(Array.isArray(r.decomposition.parts), 'decomposition should have parts array');
    assert.ok(r.decomposition.gender, 'decomposition should have gender');
    assert.ok(r.decomposition.confidence, 'decomposition should have confidence');
  }
});

// ── Test 7: No partial second component returns empty ──
test('No partial second component: "skole" alone returns []', () => {
  const results = vocabCore.predictCompound('skole', testNounGenus, 'nb');
  assert.ok(Array.isArray(results), 'should return an array');
  assert.equal(results.length, 0, 'should have no suggestions when no second component partial');
});

// ── Test 8: Results capped at 10 ──
test('Results capped at 10', () => {
  // Build a nounGenus with many nouns starting with 'a'
  const bigMap = new Map(testNounGenus);
  const aWords = ['all', 'alt', 'and', 'ang', 'ann', 'ant', 'app', 'ark', 'arm', 'art', 'ask', 'att'];
  for (const w of aWords) bigMap.set(w, 'm');
  bigMap.set('skog', 'm');
  const results = vocabCore.predictCompound('skoga', bigMap, 'nb');
  assert.ok(results.length <= 10, `should be capped at 10, got ${results.length}`);
});

// ── Test 9: Bound closure on buildIndexes ──
test('predictCompound available as bound closure on buildIndexes result', () => {
  // Build minimal raw data to construct indexes
  const raw = {
    _metadata: { language: 'nb', languageName: 'Norsk' },
    nounbank: {
      skole_noun: { word: 'skole', genus: 'm', translation: 'school' },
      gutt_noun: { word: 'gutt', genus: 'm', translation: 'boy' },
    },
  };
  const indexes = vocabCore.buildIndexes({ raw, lang: 'nb' });
  assert.ok(typeof indexes.predictCompound === 'function', 'should have predictCompound on indexes');
  const results = indexes.predictCompound('skoleg');
  assert.ok(Array.isArray(results), 'bound closure should return array');
});

// ── Test 10: Deduplication ──
test('No duplicate compound words in results', () => {
  const results = vocabCore.predictCompound('skoleg', testNounGenus, 'nb');
  const words = results.map(r => r.word);
  const unique = new Set(words);
  assert.equal(words.length, unique.size, 'should have no duplicates');
});

// ── Report ──
console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exit(failed > 0 ? 1 : 0);
