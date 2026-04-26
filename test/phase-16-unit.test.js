#!/usr/bin/env node
/**
 * Phase 16 unit tests — decomposeCompound function.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Tests the compound decomposition algorithm for NB/NN/DE.
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
  ['skole', 'm'], ['dag', 'm'], ['hverdag', 'm'], ['mas', 'm'],
  ['gutt', 'm'], ['klasse', 'm'], ['natt', 'f'], ['time', 'm'],
  ['skog', 'm'], ['tur', 'm'], ['vei', 'm'], ['gate', 'f'],
  ['bil', 'm'], ['hus', 'n'], ['lykt', 'f'], ['bok', 'f'],
  ['sol', 'm'], ['lys', 'n'],
  // DE nouns
  ['arbeit', 'f'], ['tag', 'm'], ['strasse', 'f'], ['bahn', 'f'],
  ['frau', 'f'], ['haus', 'n'], ['kind', 'n'], ['schule', 'f'],
  ['buch', 'n'],
  ['hund', 'm'], ['land', 'n'],
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

// ── Test 1: NB zero-fuge 2-part ──
test('NB zero-fuge: skoledag -> skole + dag', () => {
  const result = vocabCore.decomposeCompound('skoledag', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts.length, 2);
  assert.equal(result.parts[0].word, 'skole');
  assert.equal(result.parts[0].genus, 'm');
  assert.equal(result.parts[1].word, 'dag');
  assert.equal(result.parts[1].genus, 'm');
  assert.equal(result.gender, 'm');
});

// ── Test 2: NB fuge-s 2-part ──
test('NB fuge-s: hverdagsmas -> hverdag + s + mas', () => {
  const result = vocabCore.decomposeCompound('hverdagsmas', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts.length, 2);
  assert.equal(result.parts[0].word, 'hverdag');
  assert.equal(result.parts[0].linker, 's');
  assert.equal(result.parts[1].word, 'mas');
  assert.equal(result.parts[1].linker, '');
});

// ── Test 3: NB fuge-e 2-part ──
test('NB fuge-e: gutteklasse -> gutt + e + klasse', () => {
  const result = vocabCore.decomposeCompound('gutteklasse', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts.length, 2);
  assert.equal(result.parts[0].word, 'gutt');
  assert.equal(result.parts[0].linker, 'e');
  assert.equal(result.parts[1].word, 'klasse');
  assert.equal(result.parts[1].genus, 'm');
});

// ── Test 4: DE fuge-s ──
test('DE fuge-s: arbeitstag -> arbeit + s + tag', () => {
  const result = vocabCore.decomposeCompound('arbeitstag', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'arbeit');
  assert.equal(result.parts[0].linker, 's');
  assert.equal(result.parts[1].word, 'tag');
  assert.equal(result.gender, 'm');
});

// ── Test 5: DE fuge-n ──
test('DE fuge-n: strassenbahn -> strasse + n + bahn', () => {
  const result = vocabCore.decomposeCompound('strassenbahn', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'strasse');
  assert.equal(result.parts[0].linker, 'n');
  assert.equal(result.parts[1].word, 'bahn');
  assert.equal(result.gender, 'f');
});

// ── Test 6: DE fuge-en ──
test('DE fuge-en: frauenhaus -> frau + en + haus', () => {
  const result = vocabCore.decomposeCompound('frauenhaus', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'frau');
  assert.equal(result.parts[0].linker, 'en');
  assert.equal(result.parts[1].word, 'haus');
  assert.equal(result.gender, 'n');
});

// ── Test 7: DE fuge-er ──
test('DE fuge-er: kinderhaus -> kind + er + haus', () => {
  const result = vocabCore.decomposeCompound('kinderhaus', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'kind');
  assert.equal(result.parts[0].linker, 'er');
  assert.equal(result.parts[1].word, 'haus');
  assert.equal(result.gender, 'n');
});

// ── Test 8: 3-part recursive NB compound ──
// skolegatelykt = skole + gate + lykt (zero-fuge chains)
test('NB 3-part recursive: skolegatelykt -> skole + gate + lykt', () => {
  const result = vocabCore.decomposeCompound('skolegatelykt', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts.length, 3);
  assert.equal(result.parts[0].word, 'skole');
  assert.equal(result.parts[1].word, 'gate');
  assert.equal(result.parts[2].word, 'lykt');
  assert.equal(result.gender, 'f'); // gender of lykt
});

// ── Test 9: 4-part recursive (depth=3) ──
// skolegatelyktbok = skole + gate + lykt + bok
test('NB 4-part recursive: skolegatelyktbok -> 4 parts (depth=3)', () => {
  const result = vocabCore.decomposeCompound('skolegatelyktbok', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts.length, 4);
  assert.equal(result.parts[3].word, 'bok');
  assert.equal(result.gender, 'f'); // gender of bok
});

// ── Test 10: 5-part too deep returns null ──
// skolegatelyktbokhus = 5 parts, depth > 3
test('NB 5-part too deep returns null', () => {
  const result = vocabCore.decomposeCompound('skolegatelyktbokhus', testNounGenus, 'nb');
  assert.equal(result, null, 'depth > 3 should return null');
});

// ── Test 11: stored entry returns null ──
test('Stored entry returns null: hverdag is in nounGenus', () => {
  const result = vocabCore.decomposeCompound('hverdag', testNounGenus, 'nb');
  assert.equal(result, null, 'stored entry should return null');
});

// ── Test 12: too short returns null ──
test('Too short returns null: word < 6 chars', () => {
  const result = vocabCore.decomposeCompound('bilsk', testNounGenus, 'nb');
  assert.equal(result, null, 'short word should return null');
});

// ── Test 13: left unknown returns null ──
test('Left side unknown returns null', () => {
  // "xyzdag" - xyz is not a known noun
  const result = vocabCore.decomposeCompound('xyzdag', testNounGenus, 'nb');
  assert.equal(result, null, 'unknown left side should return null');
});

// ── Test 14: triple-consonant elision ──
test('Triple-consonant elision: nattime -> natt + time', () => {
  // "natt" ends with tt, "time" starts with t -> written "nattime" (not "natttime")
  const result = vocabCore.decomposeCompound('nattime', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'natt');
  assert.equal(result.parts[1].word, 'time');
});

// ── Test 15: confidence is always 'high' ──
test('Confidence is always high', () => {
  const result = vocabCore.decomposeCompound('skoledag', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.confidence, 'high');
});

// ── Test 16: gender comes from last (rightmost) component ──
test('Gender comes from rightmost component', () => {
  // skolehus: skole(m) + hus(n) -> gender should be 'n' from hus
  const result = vocabCore.decomposeCompound('skolehus', testNounGenus, 'nb');
  assert.ok(result, 'should not be null');
  assert.equal(result.gender, 'n', 'gender should come from rightmost part (hus=n)');
});

// ── Test 17: DE fuge-e ──
test('DE fuge-e: hundehaus -> hund + e + haus', () => {
  const result = vocabCore.decomposeCompound('hundehaus', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'hund');
  assert.equal(result.parts[0].linker, 'e');
  assert.equal(result.parts[1].word, 'haus');
  assert.equal(result.gender, 'n');
});

// ── Test 18: DE fuge-es ──
test('DE fuge-es: landestag -> land + es + tag', () => {
  const result = vocabCore.decomposeCompound('landestag', testNounGenus, 'de');
  assert.ok(result, 'should not be null');
  assert.equal(result.parts[0].word, 'land');
  assert.equal(result.parts[0].linker, 'es');
  assert.equal(result.parts[1].word, 'tag');
  assert.equal(result.gender, 'm');
});

// ══════════════════════════════════════════════════════════════════
// False-Positive Validation against real nounbank data
// ══════════════════════════════════════════════════════════════════
const fs = require('fs');

function runFPValidation(langCode, langLabel) {
  const dataPath = path.join(ROOT, 'extension', 'data', `${langCode}.json`);
  if (!fs.existsSync(dataPath)) {
    console.log(`[SKIP] ${langLabel}: ${dataPath} not found`);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  // Build real indexes using buildIndexes to get nounGenus and compoundNouns
  const indexes = vocabCore.buildIndexes({ raw, lang: langCode });
  const { nounGenus, compoundNouns } = indexes;

  // Collect single-word nouns: nounGenus entries that are NOT in compoundNouns
  // and do not contain spaces (multi-word entries) and are >= 6 chars (decompose min)
  const singleNouns = [];
  for (const [word] of nounGenus) {
    if (word.includes(' ')) continue;
    if (word.length < 6) continue;
    // Skip entries already in compoundNouns — they ARE compounds by data definition
    if (compoundNouns.has(word)) continue;
    singleNouns.push(word);
  }

  let falsePositives = 0;
  const fpList = [];
  for (const word of singleNouns) {
    const result = vocabCore.decomposeCompound(word, nounGenus, langCode);
    if (result !== null) {
      falsePositives++;
      fpList.push(`  ${word} -> ${result.parts.map(p => p.word).join(' + ')}`);
    }
  }

  const rate = singleNouns.length > 0 ? (falsePositives / singleNouns.length * 100) : 0;
  console.log(`[FP-CHECK] ${langLabel}: tested ${singleNouns.length} nouns, ${falsePositives} false positives (${rate.toFixed(2)}%)`);
  if (fpList.length > 0 && fpList.length <= 20) {
    for (const line of fpList) console.log(line);
  } else if (fpList.length > 20) {
    for (const line of fpList.slice(0, 20)) console.log(line);
    console.log(`  ... and ${fpList.length - 20} more`);
  }

  test(`${langLabel} false-positive rate < 2%`, () => {
    assert.ok(rate < 2, `FP rate ${rate.toFixed(2)}% exceeds 2% threshold (${falsePositives}/${singleNouns.length})`);
  });
}

console.log('\n── False-Positive Validation ──');
runFPValidation('nb', 'NB');
runFPValidation('de', 'DE');

// ── Summary ──
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
