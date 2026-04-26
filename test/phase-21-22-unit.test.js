#!/usr/bin/env node
/**
 * v2.2 unit tests -- Phases 21-22 (Dictionary Intelligence + å/og Confusion).
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

// -- Build vocab for NB and NN --
const nbRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'nb.json'), 'utf8'));
const nbVocab = vocabCore.buildIndexes({ raw: nbRaw, lang: 'nb', isFeatureEnabled: () => true });

const nnRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'nn.json'), 'utf8'));
const nnVocab = vocabCore.buildIndexes({ raw: nnRaw, lang: 'nn', isFeatureEnabled: () => true });

function findingsFor(text, ruleId, lang) {
  const v = lang === 'nn' ? nnVocab : nbVocab;
  const all = spellCore.check(text, v, { lang });
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
// Section 1: å/og Direction 1 — "og" should be "å"
// =====================================================================

test('aa_og flags "og" after infinitive trigger + before verb', () => {
  const hits = findingsFor('hun liker og lese', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'å');
  assert.equal(hits[0].original, 'og');
});

test('aa_og flags "og" after preteritum trigger', () => {
  const hits = findingsFor('han prøvde og skrive', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'å');
});

test('aa_og flags "og" after adjective trigger', () => {
  const hits = findingsFor('det er viktig og lese', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'å');
});

test('aa_og does not flag "og" in coordinate structure', () => {
  const hits = findingsFor('hun leser og skriver', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `coordinate "og" should not be flagged, got ${hits.length}`);
});

// =====================================================================
// Section 2: å/og Direction 2 — "å" should be "og"
// =====================================================================

test('aa_og flags "å" between two nouns', () => {
  const hits = findingsFor('kaffe å kake', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'og');
});

test('aa_og flags "å" before pronoun', () => {
  const hits = findingsFor('boka å jeg', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'og');
});

test('aa_og flags "å" before article', () => {
  const hits = findingsFor('hunden å den katten', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'og');
});

test('aa_og flags "å" before preposition', () => {
  const hits = findingsFor('hjem å til skolen', 'aa_og', 'nb');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix, 'og');
});

test('aa_og does not flag "å" before verb (valid infinitive marker)', () => {
  const hits = findingsFor('hun liker å lese', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `valid infinitive "å lese" should not be flagged, got ${hits.length}`);
});

test('aa_og does not flag sentence-initial "å" + verb', () => {
  const hits = findingsFor('å lese er gøy', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `sentence-initial "å lese" should not be flagged, got ${hits.length}`);
});

// =====================================================================
// Section 3: Posture-verb exceptions
// =====================================================================

test('aa_og does not flag "sitter og leser" (posture verb)', () => {
  const hits = findingsFor('sitter og leser', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `posture verb exception, got ${hits.length}`);
});

test('aa_og does not flag "hun sitter og leser" (pronoun + posture verb)', () => {
  const hits = findingsFor('hun sitter og leser', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `pronoun + posture verb exception, got ${hits.length}`);
});

test('aa_og does not flag "står og venter" (posture verb)', () => {
  const hits = findingsFor('han står og venter', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `posture verb "står" exception, got ${hits.length}`);
});

test('aa_og does not flag "ligger og sover" (posture verb)', () => {
  const hits = findingsFor('ligger og sover', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `posture verb "ligger" exception, got ${hits.length}`);
});

test('aa_og does not flag "går og tenker" (motion verb)', () => {
  const hits = findingsFor('går og tenker', 'aa_og', 'nb');
  assert.equal(hits.length, 0, `motion verb "går" exception, got ${hits.length}`);
});

// =====================================================================
// Section 4: NN support
// =====================================================================

test('aa_og fires on NN text (direction 2: å before non-verb)', () => {
  const hits = findingsFor('kaffe å kake', 'aa_og', 'nn');
  assert.equal(hits.length, 1, `expected 1 finding on NN, got ${hits.length}`);
  assert.equal(hits[0].fix, 'og');
});

test('aa_og posture verb exception works on NN', () => {
  const hits = findingsFor('sit og les', 'aa_og', 'nn');
  assert.equal(hits.length, 0, `NN posture "sit" should be exempt, got ${hits.length}`);
});

// =====================================================================
// Section 5: Explain contract
// =====================================================================

test('aa_og explain returns NB and NN strings', () => {
  const aaOgRule = (typeof self !== 'undefined' ? self : globalThis).__lexiSpellRules.find(r => r.id === 'aa_og');
  assert.ok(aaOgRule, 'aa_og rule should be registered');
  assert.ok(typeof aaOgRule.explain === 'function', 'explain should be a function');

  const result = aaOgRule.explain({ original: 'og', fix: 'å' });
  assert.ok(result.nb && result.nb.length > 0, 'explain.nb should be non-empty');
  assert.ok(result.nn && result.nn.length > 0, 'explain.nn should be non-empty');
});

test('aa_og explain mentions both å and og', () => {
  const aaOgRule = (typeof self !== 'undefined' ? self : globalThis).__lexiSpellRules.find(r => r.id === 'aa_og');
  const result = aaOgRule.explain({ original: 'å', fix: 'og' });
  assert.ok(result.nb.includes('Å') || result.nb.includes('å'), 'NB explain should mention å');
  assert.ok(result.nb.includes('Og') || result.nb.includes('og'), 'NB explain should mention og');
});

// =====================================================================
// Section 6: Priority and severity
// =====================================================================

test('aa_og has priority 15 (higher than homophones)', () => {
  const aaOgRule = (typeof self !== 'undefined' ? self : globalThis).__lexiSpellRules.find(r => r.id === 'aa_og');
  assert.equal(aaOgRule.priority, 15);
});

test('aa_og has severity error', () => {
  const aaOgRule = (typeof self !== 'undefined' ? self : globalThis).__lexiSpellRules.find(r => r.id === 'aa_og');
  assert.equal(aaOgRule.severity, 'error');
});

// =====================================================================
// Section 7: Homophones regression — å/og removed
// =====================================================================

test('homophone rule does NOT flag å/og (moved to aa_og)', () => {
  const hits1 = findingsFor('hun liker og lese', 'homophone', 'nb');
  assert.equal(hits1.length, 0, `homophones should not flag "og" for å/og, got ${hits1.length}`);

  const hits2 = findingsFor('kaffe å kake', 'homophone', 'nb');
  assert.equal(hits2.length, 0, `homophones should not flag "å" for å/og, got ${hits2.length}`);
});

test('homophone rule still flags da/når', () => {
  const hits = findingsFor('da jeg går på skolen', 'homophone', 'nb');
  assert.ok(hits.length >= 1, `homophones should still flag da/når, got ${hits.length}`);
});

// =====================================================================
// Section 8: No double-flagging between aa_og and homophone
// =====================================================================

test('å/og text produces aa_og findings but not homophone findings', () => {
  const text = 'hun liker og lese';
  const aaOg = findingsFor(text, 'aa_og', 'nb');
  const homo = findingsFor(text, 'homophone', 'nb');
  assert.ok(aaOg.length >= 1, `aa_og should flag, got ${aaOg.length}`);
  assert.equal(homo.length, 0, `homophone should NOT flag, got ${homo.length}`);
});

// =====================================================================
// Section 9: Dictionary Intelligence — NB data integrity (Phase 21)
// =====================================================================

test('NB vocab has falseFriends entries', () => {
  let count = 0;
  for (const bank of Object.keys(nbRaw)) {
    if (bank.startsWith('_')) continue;
    const bankData = nbRaw[bank];
    if (!bankData || typeof bankData !== 'object') continue;
    for (const entry of Object.values(bankData)) {
      if (entry.falseFriends && entry.falseFriends.length > 0) count++;
    }
  }
  assert.ok(count >= 40, `expected >= 40 NB entries with falseFriends, got ${count}`);
});

test('NB falseFriends entries have required schema fields', () => {
  for (const bank of Object.keys(nbRaw)) {
    if (bank.startsWith('_')) continue;
    const bankData = nbRaw[bank];
    if (!bankData || typeof bankData !== 'object') continue;
    for (const [id, entry] of Object.entries(bankData)) {
      if (!entry.falseFriends) continue;
      for (const ff of entry.falseFriends) {
        assert.ok(ff.lang, `${id} falseFriend missing lang`);
        assert.ok(ff.form, `${id} falseFriend missing form`);
        assert.ok(ff.meaning, `${id} falseFriend missing meaning`);
      }
    }
  }
});

test('NB vocab has senses entries for polysemy', () => {
  let count = 0;
  for (const bank of Object.keys(nbRaw)) {
    if (bank.startsWith('_')) continue;
    const bankData = nbRaw[bank];
    if (!bankData || typeof bankData !== 'object') continue;
    for (const entry of Object.values(bankData)) {
      if (entry.senses && entry.senses.length > 0) count++;
    }
  }
  assert.ok(count >= 1, `expected >= 1 NB entry with senses, got ${count}`);
});

test('NB senses entries have translations object', () => {
  for (const bank of Object.keys(nbRaw)) {
    if (bank.startsWith('_')) continue;
    const bankData = nbRaw[bank];
    if (!bankData || typeof bankData !== 'object') continue;
    for (const [id, entry] of Object.entries(bankData)) {
      if (!entry.senses) continue;
      for (const sense of entry.senses) {
        assert.ok(sense.translations && typeof sense.translations === 'object',
          `${id} sense missing translations object`);
      }
    }
  }
});

// =====================================================================
// Section 10: Dictionary Intelligence — linkedTo enrichment (Phase 21.1/21.2)
// =====================================================================

test('NB entries with falseFriends have linkedTo for cross-language lookup', () => {
  let withLinkedTo = 0;
  let total = 0;
  for (const bank of Object.keys(nbRaw)) {
    if (bank.startsWith('_')) continue;
    const bankData = nbRaw[bank];
    if (!bankData || typeof bankData !== 'object') continue;
    for (const entry of Object.values(bankData)) {
      if (!entry.falseFriends || !entry.falseFriends.length) continue;
      total++;
      if (entry.linkedTo && Object.keys(entry.linkedTo).length > 0) withLinkedTo++;
    }
  }
  assert.ok(total > 0, 'should have entries with falseFriends');
  const ratio = withLinkedTo / total;
  assert.ok(ratio >= 0.8, `expected >= 80% of falseFriend entries to have linkedTo, got ${(ratio * 100).toFixed(0)}% (${withLinkedTo}/${total})`);
});

test('NB "på" senses entry has linkedTo for DE', () => {
  const paEntry = nbRaw.generalbank?.['på_contr'] || nbRaw.generalbank?.['paa_contr'];
  assert.ok(paEntry, '"på" entry should exist in generalbank');
  assert.ok(paEntry.senses && paEntry.senses.length >= 1, '"på" should have senses');
  assert.ok(paEntry.linkedTo?.de, '"på" should have linkedTo.de for enrichment');
});

// =====================================================================
// Report
// =====================================================================

console.log('\n' + '='.repeat(60));
console.log('v2.2 Unit Tests — Phases 21-22');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '+' : 'X';
  console.log(`  [${icon}] ${r.name}`);
  if (r.error) console.log(`      ${r.error}`);
}

const failCount = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${results.length} tests: ${results.length - failCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
