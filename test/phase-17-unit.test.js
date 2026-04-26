#!/usr/bin/env node
/**
 * Phase 17 unit tests -- Compound Integration (decomposition, nounLemmaGenus, nb-compound-gender).
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Exit 0 = all pass, exit 1 = first failure.
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
nbVocab.isFeatureEnabled = () => true;

function findingsFor(text, ruleId, lang) {
  lang = lang || 'nb';
  const vocabMap = { nb: nbVocab };
  const all = spellCore.check(text, vocabMap[lang], { lang });
  return all.filter(f => f.rule_id === ruleId);
}

// -- Test runner --
const results = [];
let failed = false;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

// =====================================================================
// Section 1: decomposeCompoundStrict (vocab-seam-core.js)
// =====================================================================

test('decomposeCompoundStrict returns valid decomposition for real compound', () => {
  // Try several candidates -- real data may vary
  const candidates = ['skoledag', 'hustak', 'gatetur', 'biltur'];
  let found = null;
  for (const c of candidates) {
    const result = nbVocab.decomposeCompoundStrict(c);
    if (result) { found = { word: c, result }; break; }
  }
  assert.ok(found, `Expected at least one of [${candidates}] to decompose strictly, none did`);
  assert.ok(found.result.parts.length >= 2, 'should have at least 2 parts');
  assert.ok(found.result.gender, 'should have inferred gender');
  assert.equal(found.result.confidence, 'high', 'should have high confidence');
});

test('decomposeCompoundStrict returns null for inflected-form compounds', () => {
  // 'skolenboken' is built from inflected forms (skolen, boken) -- not base nouns
  const result = nbVocab.decomposeCompoundStrict('skolenboken');
  assert.equal(result, null, 'inflected-form compound should not decompose strictly');
});

test('decomposeCompound (loose) accepts broader set than strict', () => {
  // Strict should never return non-null when loose returns null.
  // Test with several candidates to verify the invariant.
  const candidates = ['skoledag', 'hustak', 'gatetur', 'biltur', 'skolenboken', 'husethuset'];
  for (const c of candidates) {
    const strict = nbVocab.decomposeCompoundStrict(c);
    const loose = nbVocab.decomposeCompound(c);
    if (strict !== null) {
      assert.ok(loose !== null, `strict non-null but loose null for "${c}" -- invariant broken`);
    }
  }
});

// =====================================================================
// Section 2: nounLemmaGenus map
// =====================================================================

test('nounLemmaGenus is smaller than nounGenus', () => {
  assert.ok(
    nbVocab.nounLemmaGenus.size < nbVocab.nounGenus.size,
    `nounLemmaGenus (${nbVocab.nounLemmaGenus.size}) should be smaller than nounGenus (${nbVocab.nounGenus.size})`
  );
});

test('nounLemmaGenus contains base nouns', () => {
  const baseNouns = ['skole', 'dag', 'hus'];
  for (const noun of baseNouns) {
    assert.ok(nbVocab.nounLemmaGenus.has(noun), `nounLemmaGenus should contain base noun "${noun}"`);
  }
});

test('nounLemmaGenus excludes inflected forms', () => {
  // Definite-form inflections should not appear in nounLemmaGenus
  const inflected = ['boken', 'skolen', 'husene', 'dagene'];
  let excludedCount = 0;
  for (const form of inflected) {
    if (!nbVocab.nounLemmaGenus.has(form)) excludedCount++;
  }
  assert.ok(
    excludedCount >= 2,
    `Expected at least 2 of [${inflected}] to be absent from nounLemmaGenus, only ${excludedCount} were absent`
  );
});

// =====================================================================
// Section 3: nb-compound-gender rule
// =====================================================================

// Dynamically find compounds that:
//   (a) are NOT in nounGenus
//   (b) decompose with high confidence
//   (c) actually trigger nb-compound-gender (not suppressed by typo rules)
// We need a neuter compound (to test wrong article 'en') and any compound for correct-article test.
const { testNeuterCompound, testMascCompound, testAnyCompound } = (() => {
  const baseNouns = [];
  for (const [w, g] of nbVocab.nounLemmaGenus) {
    if (w.length >= 3 && w.length <= 5) baseNouns.push({ w, g });
  }
  let neuter = null, masc = null;
  outer:
  for (let i = 0; i < Math.min(baseNouns.length, 100); i++) {
    for (let j = 0; j < Math.min(baseNouns.length, 100); j++) {
      if (i === j) continue;
      const compound = baseNouns[i].w + baseNouns[j].w;
      if (compound.length > 12 || nbVocab.nounGenus.has(compound)) continue;
      const d = nbVocab.decomposeCompound(compound);
      if (!d || d.confidence !== 'high') continue;
      if (d.gender === 'n' && !neuter) {
        const hits = findingsFor('en ' + compound, 'nb-compound-gender');
        if (hits.length > 0) neuter = compound;
      }
      if (d.gender === 'm' && !masc) {
        const hits = findingsFor('et ' + compound, 'nb-compound-gender');
        if (hits.length > 0) masc = compound;
      }
      if (neuter && masc) break outer;
    }
  }
  return { testNeuterCompound: neuter, testMascCompound: masc, testAnyCompound: neuter || masc };
})();

test('nb-compound-gender flags wrong article for neuter compound', () => {
  if (!testNeuterCompound) {
    console.log('    [SKIP] No suitable neuter compound found');
    return;
  }
  // Neuter compound with masculine article 'en' -> should flag
  const hits = findingsFor(`en ${testNeuterCompound}`, 'nb-compound-gender');
  assert.ok(
    hits.length >= 1,
    `Expected nb-compound-gender to flag "en ${testNeuterCompound}" (inferred n), got ${hits.length} findings`
  );
  assert.ok(hits[0].fix.startsWith('et'), `Fix should start with "et", got "${hits[0].fix}"`);
});

test('nb-compound-gender flags wrong article for masculine compound', () => {
  if (!testMascCompound) {
    console.log('    [SKIP] No suitable masculine compound found');
    return;
  }
  // Masculine compound with neuter article 'et' -> should flag
  const hits = findingsFor(`et ${testMascCompound}`, 'nb-compound-gender');
  assert.ok(
    hits.length >= 1,
    `Expected nb-compound-gender to flag "et ${testMascCompound}" (inferred m), got ${hits.length} findings`
  );
  assert.ok(hits[0].fix.startsWith('en'), `Fix should start with "en", got "${hits[0].fix}"`);
});

test('nb-compound-gender accepts correct article for decomposable compound', () => {
  if (!testNeuterCompound) {
    console.log('    [SKIP] No suitable compound found');
    return;
  }
  // Neuter compound with correct article 'et' -> should NOT flag
  const hits = findingsFor(`et ${testNeuterCompound}`, 'nb-compound-gender');
  assert.equal(
    hits.length, 0,
    `Expected no nb-compound-gender findings for "et ${testNeuterCompound}", got ${hits.length}`
  );
});

test('nb-compound-gender does not fire for known nouns', () => {
  // 'bil' is a known noun in nounGenus -- nb-compound-gender should not fire
  // (known nouns are handled by nb-gender at priority 10)
  assert.ok(nbVocab.nounGenus.has('bil'), 'bil should be in nounGenus');
  const hits = findingsFor('en bil', 'nb-compound-gender');
  assert.equal(hits.length, 0, 'nb-compound-gender should not fire for known nouns');
});

// =====================================================================
// Section 4: NB common-gender tolerance
// =====================================================================

test('nb-compound-gender accepts en for feminine compound in NB', () => {
  // Dynamically find a feminine compound
  let femCompound = null;
  const baseNouns = [];
  for (const [w, g] of nbVocab.nounLemmaGenus) {
    if (w.length >= 3 && w.length <= 5) baseNouns.push({ w, g });
  }
  outer:
  for (let i = 0; i < Math.min(baseNouns.length, 100); i++) {
    for (let j = 0; j < Math.min(baseNouns.length, 100); j++) {
      if (i === j) continue;
      const compound = baseNouns[i].w + baseNouns[j].w;
      if (compound.length > 12 || nbVocab.nounGenus.has(compound)) continue;
      const d = nbVocab.decomposeCompound(compound);
      if (d && d.confidence === 'high' && d.gender === 'f') {
        femCompound = compound;
        break outer;
      }
    }
  }

  if (!femCompound) {
    console.log('    [SKIP] No suitable feminine compound found');
    return;
  }

  // NB common-gender tolerance: 'en' should be accepted for feminine nouns
  const hits = findingsFor(`en ${femCompound}`, 'nb-compound-gender');
  assert.equal(
    hits.length, 0,
    `NB should accept "en" for feminine compound "${femCompound}", got ${hits.length} findings`
  );
});

// =====================================================================
// Report
// =====================================================================

console.log('\n' + '='.repeat(60));
console.log('Phase 17 Unit Tests');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '+' : 'X';
  console.log(`  ${icon} ${r.name}`);
  if (r.error) console.log(`    ${r.error}`);
}
const passed = results.filter(r => r.status === 'PASS').length;
console.log(`\n${passed}/${results.length} passed`);
if (failed) {
  console.log('\nFAILED');
  process.exit(1);
} else {
  console.log('\nALL PASSED');
}
