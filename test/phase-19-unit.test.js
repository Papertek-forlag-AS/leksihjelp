#!/usr/bin/env node
/**
 * Phase 19 unit tests -- NB/NN Passiv-s Detection.
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
// Section 1: buildSPassivIndex -- NB
// =====================================================================

test('NB sPassivForms has substantial entries', () => {
  assert.ok(nbVocab.sPassivForms instanceof Map, 'should be a Map');
  assert.ok(
    nbVocab.sPassivForms.size >= 600,
    `expected >= 600 entries, got ${nbVocab.sPassivForms.size}`
  );
});

test('NB sPassivForms contains common s-passive forms', () => {
  const map = nbVocab.sPassivForms;
  const common = ['skrives', 'leses', 'behandles'];
  const found = common.filter(w => map.has(w));
  assert.ok(found.length >= 2, `expected >= 2 of ${common.join(', ')} present, found: ${found.join(', ')}`);
});

test('NB non-deponent s-passives have isDeponent: false', () => {
  const info = nbVocab.sPassivForms.get('skrives');
  assert.ok(info, 'skrives should be in sPassivForms');
  assert.equal(info.isDeponent, false, 'skrives should not be deponent');
});

// =====================================================================
// Section 2: buildSPassivIndex -- NN
// =====================================================================

test('NN sPassivForms has substantial entries', () => {
  assert.ok(nnVocab.sPassivForms instanceof Map, 'should be a Map');
  assert.ok(
    nnVocab.sPassivForms.size >= 400,
    `expected >= 400 entries, got ${nnVocab.sPassivForms.size}`
  );
});

test('NN sPassivForms contains -ast infinitive forms', () => {
  const map = nnVocab.sPassivForms;
  assert.ok(map.has('lesast'), 'lesast should be present');
  assert.ok(map.has('skrivast'), 'skrivast should be present');
});

test('NN derives -est presens from -ast infinitive', () => {
  const map = nnVocab.sPassivForms;
  assert.ok(map.has('lesest'), 'lesest (derived presens) should be present');
  assert.ok(map.has('skrivest'), 'skrivest (derived presens) should be present');
});

test('NN deponent verbs are marked isDeponent: true', () => {
  const map = nnVocab.sPassivForms;
  const check = [
    ['finnast', true],
    ['trivast', true],
  ];
  for (const [form, expected] of check) {
    const info = map.get(form);
    assert.ok(info, `${form} should be in sPassivForms`);
    assert.equal(info.isDeponent, expected, `${form} isDeponent should be ${expected}`);
  }
  // moetast — check separately since it might use 'o' with stroke
  const moetast = map.get('møtast');
  assert.ok(moetast, 'moetast should be in sPassivForms');
  assert.equal(moetast.isDeponent, true, 'moetast isDeponent should be true');
});

test('NN derived deponent presens forms are also deponent', () => {
  const info = nnVocab.sPassivForms.get('møtest');
  assert.ok(info, 'motest (derived presens) should be in sPassivForms');
  assert.equal(info.isDeponent, true, 'motest isDeponent should be true');
});

test('NN non-deponent s-passives have isDeponent: false', () => {
  const info = nnVocab.sPassivForms.get('lesast');
  assert.ok(info, 'lesast should be in sPassivForms');
  assert.equal(info.isDeponent, false, 'lesast should not be deponent');
});

// =====================================================================
// Section 3: nn_passiv_s rule
// =====================================================================

test('nn_passiv_s flags finite s-passive without modal', () => {
  const hits = findingsFor('boka lesast her', 'nn_passiv_s', 'nn');
  assert.equal(hits.length, 1, `expected 1 finding, got ${hits.length}`);
  assert.equal(hits[0].severity, 'error');
});

test('nn_passiv_s flags derived presens form', () => {
  const hits = findingsFor('boka lesest her', 'nn_passiv_s', 'nn');
  assert.equal(hits.length, 1, `expected 1 finding on lesest, got ${hits.length}`);
});

test('nn_passiv_s accepts modal + s-passive', () => {
  const hits = findingsFor('boka kan lesast', 'nn_passiv_s', 'nn');
  assert.equal(hits.length, 0, `modal should license s-passive, got ${hits.length} findings`);
});

test('nn_passiv_s skips deponent verbs', () => {
  const hits = findingsFor('vi møtast her', 'nn_passiv_s', 'nn');
  assert.equal(hits.length, 0, `deponent moetast should not be flagged, got ${hits.length}`);
});

test('nn_passiv_s does not fire on NB', () => {
  const hits = findingsFor('skrives her', 'nn_passiv_s', 'nb');
  assert.equal(hits.length, 0, `rule should not fire on NB, got ${hits.length}`);
});

// =====================================================================
// Section 4: doc-drift-nb-passiv-overuse rule
// =====================================================================

test('nb-passiv-overuse does not hint at 3 or fewer s-passives', () => {
  // Verify the words are in sPassivForms first
  assert.ok(nbVocab.sPassivForms.has('skrives'), 'skrives should be in NB sPassivForms');
  assert.ok(nbVocab.sPassivForms.has('leses'), 'leses should be in NB sPassivForms');
  assert.ok(nbVocab.sPassivForms.has('behandles'), 'behandles should be in NB sPassivForms');

  const hits = findingsFor('dette skrives og leses og behandles', 'doc-drift-nb-passiv-overuse', 'nb');
  assert.equal(hits.length, 0, `3 s-passives should not trigger overuse, got ${hits.length}`);
});

test('nb-passiv-overuse hints at 4+ s-passives', () => {
  // Use 5 known single-word non-deponent NB s-passive forms
  const forms = ['skrives', 'leses', 'behandles', 'aksepteres', 'analyseres'];
  for (const f of forms) {
    assert.ok(nbVocab.sPassivForms.has(f), `${f} should be in NB sPassivForms`);
    assert.equal(nbVocab.sPassivForms.get(f).isDeponent, false, `${f} should not be deponent`);
  }

  const text = forms.join(' og ');
  const hits = findingsFor(text, 'doc-drift-nb-passiv-overuse', 'nb');
  assert.ok(hits.length >= 1, `5 s-passives should trigger overuse, got ${hits.length}`);
  assert.equal(hits[0].severity, 'hint');
});

test('nb-passiv-overuse does not count deponent verbs', () => {
  // 2 real s-passives + 3 deponents = total non-deponent 2, should not trigger
  assert.ok(nbVocab.sPassivForms.get('finnes')?.isDeponent, 'finnes should be deponent');
  assert.ok(nbVocab.sPassivForms.get('synes')?.isDeponent, 'synes should be deponent');
  assert.ok(nbVocab.sPassivForms.get('lykkes')?.isDeponent, 'lykkes should be deponent');

  const hits = findingsFor(
    'dette skrives og leses og finnes og synes og lykkes',
    'doc-drift-nb-passiv-overuse',
    'nb'
  );
  assert.equal(hits.length, 0, `2 real + 3 deponent should not trigger (non-deponent = 2 <= 3), got ${hits.length}`);
});

// =====================================================================
// Report
// =====================================================================

console.log('\n' + '='.repeat(60));
console.log('Phase 19 Unit Tests');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '+' : 'X';
  console.log(`  [${icon}] ${r.name}`);
  if (r.error) console.log(`      ${r.error}`);
}

const failCount = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${results.length} tests: ${results.length - failCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);
