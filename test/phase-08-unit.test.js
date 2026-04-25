#!/usr/bin/env node
/**
 * Phase 8 unit tests — German grammar rule files.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Loads spell-check-core.js + grammar-tables.js + rule files,
 * then builds vocab from real de.json data to exercise each rule.
 *
 * Exit 0 = all pass, exit 1 = first failure.
 */
'use strict';
const assert = require('assert').strict;
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// ── Load core + rules (same order as check-fixtures.js) ──
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));

const SPELL_RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');
fs.readdirSync(SPELL_RULES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort()
  .forEach(f => require(path.join(SPELL_RULES_DIR, f)));

// ── Load grammar tables directly for table-shape tests ──
const tables = require(path.join(SPELL_RULES_DIR, 'grammar-tables.js'));

// ── Build vocab from real de.json ──
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'de.json'), 'utf8'));
const vocab = vocabCore.buildIndexes({ raw, lang: 'de', isFeatureEnabled: () => true });

// ── Helper: run spell-check and return findings for a specific rule ──
function findingsFor(text, ruleId) {
  const all = spellCore.check(text, vocab, { lang: 'de' });
  return all.filter(f => f.rule_id === ruleId);
}

// ── Test runner ──
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
// grammar-tables.js — table shape and content
// =====================================================================

test('PREP_CASE has expected accusative prepositions', () => {
  const pc = tables.PREP_CASE;
  assert.ok(pc, 'PREP_CASE should exist');
  assert.equal(pc['für'], 'acc');
  assert.equal(pc['durch'], 'acc');
  assert.equal(pc['gegen'], 'acc');
  assert.equal(pc['ohne'], 'acc');
  assert.equal(pc['um'], 'acc');
});

test('PREP_CASE has expected dative prepositions', () => {
  const pc = tables.PREP_CASE;
  assert.equal(pc['mit'], 'dat');
  assert.equal(pc['von'], 'dat');
  assert.equal(pc['zu'], 'dat');
  assert.equal(pc['aus'], 'dat');
  assert.equal(pc['bei'], 'dat');
  assert.equal(pc['nach'], 'dat');
  assert.equal(pc['seit'], 'dat');
});

test('PREP_CASE has two-way prepositions as acc/dat', () => {
  const pc = tables.PREP_CASE;
  assert.equal(pc['in'], 'acc/dat');
  assert.equal(pc['auf'], 'acc/dat');
  assert.equal(pc['an'], 'acc/dat');
  assert.equal(pc['über'], 'acc/dat');
  assert.equal(pc['unter'], 'acc/dat');
});

test('DEF_ARTICLE_CASE has correct shape for der/die/das', () => {
  const dac = tables.DEF_ARTICLE_CASE;
  assert.ok(Array.isArray(dac['der']), 'der should have array of readings');
  assert.ok(Array.isArray(dac['die']), 'die should have array of readings');
  assert.ok(Array.isArray(dac['das']), 'das should have array of readings');
  assert.ok(Array.isArray(dac['dem']), 'dem should have array of readings');
  assert.ok(Array.isArray(dac['den']), 'den should have array of readings');
  assert.ok(Array.isArray(dac['des']), 'des should have array of readings');
  // Each entry has genus + case
  for (const reading of dac['der']) {
    assert.ok(reading.genus, 'reading should have genus');
    assert.ok(reading.case, 'reading should have case');
  }
});

test('INDEF_ARTICLE_CASE has correct shape for ein/eine/einem', () => {
  const iac = tables.INDEF_ARTICLE_CASE;
  assert.ok(Array.isArray(iac['ein']), 'ein should have array of readings');
  assert.ok(Array.isArray(iac['eine']), 'eine should have array of readings');
  assert.ok(Array.isArray(iac['einem']), 'einem should have array of readings');
  assert.ok(Array.isArray(iac['einer']), 'einer should have array of readings');
  assert.ok(Array.isArray(iac['eines']), 'eines should have array of readings');
  assert.ok(Array.isArray(iac['einen']), 'einen should have array of readings');
});

test('SEPARABLE_PREFIXES is a Set with known prefixes', () => {
  const sp = tables.SEPARABLE_PREFIXES;
  assert.ok(sp instanceof Set, 'SEPARABLE_PREFIXES should be a Set');
  for (const prefix of ['ab', 'an', 'auf', 'aus', 'bei', 'ein', 'mit', 'vor', 'zu', 'zurück']) {
    assert.ok(sp.has(prefix), `missing prefix: ${prefix}`);
  }
});

test('SEIN_VERBS is a Set with known sein-verbs', () => {
  const sv = tables.SEIN_VERBS;
  assert.ok(sv instanceof Set, 'SEIN_VERBS should be a Set');
  for (const v of ['gehen', 'kommen', 'fahren', 'laufen', 'fallen', 'werden', 'sein', 'bleiben']) {
    assert.ok(sv.has(v), `missing sein-verb: ${v}`);
  }
  assert.ok(sv.size >= 30, `expected >=30 sein-verbs, got ${sv.size}`);
});

test('BOTH_AUX_VERBS is a Set with ~6 entries', () => {
  const bav = tables.BOTH_AUX_VERBS;
  assert.ok(bav instanceof Set, 'BOTH_AUX_VERBS should be a Set');
  assert.ok(bav.has('fahren'), 'should include fahren');
  assert.ok(bav.has('schwimmen'), 'should include schwimmen');
  assert.ok(bav.size >= 4 && bav.size <= 10, `expected 4-10 entries, got ${bav.size}`);
});

// =====================================================================
// de-prep-case — preposition-case governance
// =====================================================================

test('de-prep-case: flags "mit den Schule" (wrong case after dativ prep)', () => {
  const hits = findingsFor('Ich gehe mit den Schule.', 'de-prep-case');
  assert.ok(hits.length > 0, 'should flag wrong case after mit');
  assert.equal(hits[0].original.toLowerCase(), 'den');
});

test('de-prep-case: passes "mit der Schule" (correct dativ)', () => {
  const hits = findingsFor('Ich gehe mit der Schule.', 'de-prep-case');
  assert.equal(hits.length, 0, 'should not flag correct dativ article');
});

test('de-prep-case: flags "für dem Mann" (wrong case after acc prep)', () => {
  const hits = findingsFor('Das ist für dem Mann.', 'de-prep-case');
  assert.ok(hits.length > 0, 'should flag wrong case after für');
  assert.equal(hits[0].original.toLowerCase(), 'dem');
});

test('de-prep-case: passes "für den Mann" (correct accusative)', () => {
  const hits = findingsFor('Das ist für den Mann.', 'de-prep-case');
  assert.equal(hits.length, 0, 'should not flag correct accusative');
});

test('de-prep-case: two-way preposition does not false-positive on ambiguous case', () => {
  // "in dem Haus" is valid dative (location), so should not flag
  const hits = findingsFor('Er ist in dem Haus.', 'de-prep-case');
  assert.equal(hits.length, 0, 'two-way prep with valid dativ should not flag');
});

// =====================================================================
// de-separable-verb — separable-verb split detection
// =====================================================================

test('de-separable-verb: flags unsplit infinitive form in main clause', () => {
  // "einkaufen" = ein + kaufen; must split in main clause.
  // Using the infinitive form because finite conjugations (e.g. "aufstehe")
  // are caught first by the typo rule (priority 50) and removed by dedup,
  // so we cannot observe de-separable-verb (priority 69) on those tokens.
  const hasKaufen = vocab.knownPresens && vocab.knownPresens.has('kaufen');
  if (!hasKaufen) {
    console.log('  (skipped: kaufen not in knownPresens)');
    return;
  }
  const hits = findingsFor('Wir einkaufen jeden Tag.', 'de-separable-verb');
  assert.ok(hits.length > 0, 'should flag unsplit separable verb in main clause');
  assert.equal(hits[0].prefix, 'ein', `prefix should be 'ein', got '${hits[0].prefix}'`);
  assert.equal(hits[0].stem, 'kaufen', `stem should be 'kaufen'`);
});

test('de-separable-verb: passes correctly split form', () => {
  const hits = findingsFor('Ich stehe um sieben auf.', 'de-separable-verb');
  assert.equal(hits.length, 0, 'should not flag correctly split separable verb');
});

test('de-separable-verb: passes unsplit form in subordinate clause', () => {
  // "dass" is a subordinator — unsplit form is correct in verb-final position
  const hits = findingsFor('Er sagt, dass ich aufstehe.', 'de-separable-verb');
  assert.equal(hits.length, 0, 'should not flag unsplit form after subordinator');
});

// =====================================================================
// de-perfekt-aux — Perfekt auxiliary choice
// =====================================================================

test('de-perfekt-aux: flags "habe gegangen" (gehen requires sein)', () => {
  // Need 'gegangen' in participleToAux mapped to 'sein'
  const ptaMap = vocab.participleToAux;
  if (!ptaMap || !ptaMap.has('gegangen')) {
    console.log('  (skipped: gegangen not in participleToAux)');
    return;
  }
  const hits = findingsFor('Ich habe gestern gegangen.', 'de-perfekt-aux');
  assert.ok(hits.length > 0, 'should flag haben + sein-verb participle');
  assert.equal(hits[0].original.toLowerCase(), 'habe');
  // Fix should suggest 'bin'
  assert.equal(hits[0].fix.toLowerCase(), 'bin');
});

test('de-perfekt-aux: passes "bin gegangen" (correct sein auxiliary)', () => {
  const hits = findingsFor('Ich bin gestern gegangen.', 'de-perfekt-aux');
  assert.equal(hits.length, 0, 'should not flag correct sein auxiliary');
});

test('de-perfekt-aux: skips both-aux verbs (gefahren)', () => {
  // fahren is in BOTH_AUX_VERBS — should not flag either auxiliary
  const ptaMap = vocab.participleToAux;
  if (!ptaMap || !ptaMap.has('gefahren')) {
    console.log('  (skipped: gefahren not in participleToAux)');
    return;
  }
  const hitsHaben = findingsFor('Ich habe das Auto gefahren.', 'de-perfekt-aux');
  const hitsSein = findingsFor('Ich bin nach Berlin gefahren.', 'de-perfekt-aux');
  assert.equal(hitsHaben.length, 0, 'should not flag haben with both-aux verb');
  assert.equal(hitsSein.length, 0, 'should not flag sein with both-aux verb');
});

test('de-perfekt-aux: flags "hat gekommen" (kommen requires sein)', () => {
  const ptaMap = vocab.participleToAux;
  if (!ptaMap || !ptaMap.has('gekommen')) {
    console.log('  (skipped: gekommen not in participleToAux)');
    return;
  }
  const hits = findingsFor('Er hat gestern gekommen.', 'de-perfekt-aux');
  assert.ok(hits.length > 0, 'should flag haben with sein-verb');
  assert.equal(hits[0].fix.toLowerCase(), 'ist', 'fix should suggest ist for er/sie/es');
});

// =====================================================================
// de-compound-gender — compound-noun gender inference
// =====================================================================

test('de-compound-gender: flags "das Handtasche" (die, from -tasche suffix)', () => {
  // Verify 'tasche' is in nounGenus as feminine
  if (!vocab.nounGenus || !vocab.nounGenus.has('tasche')) {
    console.log('  (skipped: tasche not in nounGenus)');
    return;
  }
  // Handtasche should NOT be in nounGenus (it's a compound not in the vocab)
  if (vocab.nounGenus.has('handtasche')) {
    console.log('  (skipped: handtasche already in nounGenus — de-gender handles it)');
    return;
  }
  const hits = findingsFor('Ich sehe das Handtasche.', 'de-compound-gender');
  assert.ok(hits.length > 0, 'should flag wrong article for compound noun');
  assert.equal(hits[0].fix.toLowerCase(), 'die', 'fix should suggest die');
});

test('de-compound-gender: passes correct "die Handtasche"', () => {
  if (!vocab.nounGenus || !vocab.nounGenus.has('tasche')) {
    console.log('  (skipped: tasche not in nounGenus)');
    return;
  }
  if (vocab.nounGenus.has('handtasche')) {
    console.log('  (skipped: handtasche already in nounGenus)');
    return;
  }
  const hits = findingsFor('Ich sehe die Handtasche.', 'de-compound-gender');
  assert.equal(hits.length, 0, 'should not flag correct article for compound');
});

test('de-compound-gender: handles linking elements (Arbeitszimmer)', () => {
  // zimmer should be in nounGenus as neuter, "s" is a linking element
  if (!vocab.nounGenus || !vocab.nounGenus.has('zimmer')) {
    console.log('  (skipped: zimmer not in nounGenus)');
    return;
  }
  if (vocab.nounGenus.has('arbeitszimmer')) {
    console.log('  (skipped: arbeitszimmer already in nounGenus)');
    return;
  }
  const hits = findingsFor('Er geht in die Arbeitszimmer.', 'de-compound-gender');
  assert.ok(hits.length > 0, 'should flag die for neuter compound with linking -s-');
  assert.equal(hits[0].fix.toLowerCase(), 'das', 'fix should suggest das');
});

// =====================================================================
// Print results
// =====================================================================

console.log('\n--- Phase 8 Unit Tests ---\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS  ${r.name}`);
  } else {
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${passCount} passed, ${failCount} failed out of ${results.length} tests.\n`);

process.exit(failed ? 1 : 0);
