#!/usr/bin/env node
/**
 * Phase 18 unit tests — spell-check polish rules.
 *
 * nb-demonstrative-gender: demonstrative + noun gender mismatch detection.
 * nb-triple-letter: triple consecutive character typo detection.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Exit 0 = all pass, exit 1 = any failure.
 */
'use strict';
const assert = require('assert').strict;
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// -- Load core + rules --
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));

const SPELL_RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');
fs.readdirSync(SPELL_RULES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort()
  .forEach(f => require(path.join(SPELL_RULES_DIR, f)));

// -- Build vocab from real data --
const nbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'nb.json'), 'utf8'));
const nbVocab = vocabCore.buildIndexes({ raw: nbRaw, lang: 'nb', isFeatureEnabled: () => true });

function findingsFor(text, ruleId, lang = 'nb') {
  const all = spellCore.check(text, nbVocab, { lang });
  return all.filter(f => f.rule_id === ruleId);
}

// -- Test runner --
const results = [];
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failCount++;
  }
}

// =====================================================================
// Section 1: nb-demonstrative-gender
// =====================================================================

test('nb-demonstrative-gender flags "det boka" (n dem + f noun)', () => {
  // Precondition: boka is feminine in nounGenus
  assert.ok(nbVocab.nounGenus.has('boka'), 'boka must be in nounGenus');
  assert.equal(nbVocab.nounGenus.get('boka'), 'f', 'boka must be feminine');

  const hits = findingsFor('det boka', 'nb-demonstrative-gender');
  assert.equal(hits.length, 1, 'should flag one mismatch');
  assert.ok(
    hits[0].fix.toLowerCase().includes('den'),
    `fix should suggest "den", got "${hits[0].fix}"`
  );
});

test('nb-demonstrative-gender accepts "den boka" (mf dem + f noun)', () => {
  const hits = findingsFor('den boka', 'nb-demonstrative-gender');
  assert.equal(hits.length, 0, 'den + f noun is valid (common gender)');
});

test('nb-demonstrative-gender accepts "det huset" (n dem + n noun)', () => {
  // Precondition: huset is neuter
  assert.ok(nbVocab.nounGenus.has('huset'), 'huset must be in nounGenus');
  assert.equal(nbVocab.nounGenus.get('huset'), 'n', 'huset must be neuter');

  const hits = findingsFor('det huset', 'nb-demonstrative-gender');
  assert.equal(hits.length, 0, 'det + n noun is valid');
});

test('nb-demonstrative-gender flags "dette boka" (n proximal + f noun)', () => {
  const hits = findingsFor('dette boka', 'nb-demonstrative-gender');
  assert.equal(hits.length, 1, 'should flag one mismatch');
  assert.ok(
    hits[0].fix.toLowerCase().includes('denne'),
    `fix should suggest "denne", got "${hits[0].fix}"`
  );
});

test('nb-demonstrative-gender handles adjective gap: "det store boka"', () => {
  // Precondition: 'store' is NOT in nounGenus (it is an adjective)
  assert.ok(!nbVocab.nounGenus.has('store'), 'store should not be in nounGenus');

  const hits = findingsFor('det store boka', 'nb-demonstrative-gender');
  assert.equal(hits.length, 1, 'should flag mismatch through adjective gap');
  assert.ok(
    hits[0].fix.toLowerCase().includes('den'),
    `fix should suggest "den", got "${hits[0].fix}"`
  );
});

test('nb-demonstrative-gender does not flag unknown nouns', () => {
  const hits = findingsFor('det xyzword', 'nb-demonstrative-gender');
  assert.equal(hits.length, 0, 'unknown noun should not trigger rule');
});

// =====================================================================
// Section 2: nb-triple-letter
// =====================================================================

// Find a valid base word with a double letter for triple-letter tests.
// Must use words NOT caught by typo-fuzzy at lower priority (vann, fjell, grønn work;
// bakke, ball, full do not — typo-fuzzy catches those first).
const tripleBase = (() => {
  const candidates = ['vann', 'fjell', 'grønn'];
  for (const c of candidates) {
    if (nbVocab.validWords.has(c)) return c;
  }
  return null;
})();

// Build the triple-letter form by finding the doubled char and inserting one more
function makeTriple(word) {
  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] === word[i + 1]) {
      return word.slice(0, i + 2) + word[i] + word.slice(i + 2);
    }
  }
  // Fallback: triple the last char
  return word + word[word.length - 1] + word[word.length - 1];
}

assert.ok(tripleBase, 'need at least one valid double-letter word for triple-letter tests');
const tripleForm = makeTriple(tripleBase);

test(`nb-triple-letter flags "${tripleForm}" -> "${tripleBase}"`, () => {
  const hits = findingsFor('han ' + tripleForm + ' her', 'nb-triple-letter');
  assert.equal(hits.length, 1, `should flag triple-letter word "${tripleForm}"`);
  assert.equal(hits[0].fix, tripleBase, `fix should be "${tripleBase}"`);
});

test(`nb-triple-letter does not flag valid word "${tripleBase}" (double letter only)`, () => {
  const hits = findingsFor('han ' + tripleBase + ' her', 'nb-triple-letter');
  assert.equal(hits.length, 0, 'valid double-letter word should not be flagged');
});

test('nb-triple-letter does not flag triple-letter when collapse is unknown', () => {
  const hits = findingsFor('han xxxx her', 'nb-triple-letter');
  assert.equal(hits.length, 0, 'collapsed "xx" is not a valid word, should not flag');
});

test('nb-triple-letter fix preserves leading capital', () => {
  const capitalTriple = tripleForm[0].toUpperCase() + tripleForm.slice(1);
  const capitalBase = tripleBase[0].toUpperCase() + tripleBase.slice(1);
  const hits = findingsFor('Han ' + capitalTriple + ' her', 'nb-triple-letter');
  assert.equal(hits.length, 1, `should flag "${capitalTriple}"`);
  assert.equal(hits[0].fix, capitalBase, `fix should preserve case: "${capitalBase}"`);
});

// =====================================================================
// Summary
// =====================================================================

console.log('\n' + results.map(r => `[${r.status}] ${r.name}`).join('\n'));
console.log(`\n${results.length} tests: ${results.length - failCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
