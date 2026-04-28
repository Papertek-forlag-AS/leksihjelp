#!/usr/bin/env node
/**
 * Phase 27 unit tests — exam-mode helper + registry shape/policy.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Tests host.__lexiExam helpers and the exam-registry policy invariants.
 *
 * Exit 0 = all pass, exit 1 = any failure.
 *
 * Coverage gap (deferred): E2E browser tests for the popup toggle, live
 * re-render on chrome.storage.onChanged, widget bail at entry, dual-marker
 * popover gate, and lockdown teacher-lock UI all require a live extension
 * context. The repo has no Playwright/Puppeteer harness today; deferred per
 * project convention (memory: project_phase6_browser_verification.md and
 * project_phase7_browser_verification.md).
 */
'use strict';
const assert = require('assert').strict;
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Load the IIFEs. spell-check-core.js sets globalThis.__lexiExam.
// exam-registry.js sets globalThis.__lexiExamRegistry.
require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));
require(path.join(ROOT, 'extension', 'exam-registry.js'));

const exam = globalThis.__lexiExam;
const registry = globalThis.__lexiExamRegistry;

assert.ok(exam, 'host.__lexiExam should be defined after spell-check-core IIFE');
assert.ok(Array.isArray(registry), 'host.__lexiExamRegistry should be a frozen array');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Phase 27 — exam-mode helper');

// ── isSurfaceSafe ──

test('isSurfaceSafe returns true for any surface when examMode=false', () => {
  assert.equal(exam.isSurfaceSafe('popup.search', false), true);
  assert.equal(exam.isSurfaceSafe('wordPrediction.dropdown', false), true);
  assert.equal(exam.isSurfaceSafe('does-not-exist', false), true);
});

test('isSurfaceSafe returns true for safe-listed surfaces in exam mode', () => {
  assert.equal(exam.isSurfaceSafe('popup.search', true), true);
  assert.equal(exam.isSurfaceSafe('popup.conjugationTable', true), true);
  assert.equal(exam.isSurfaceSafe('popup.ttsButton', true), true);
  assert.equal(exam.isSurfaceSafe('popup.grammarFeaturesPopover', true), true);
  assert.equal(exam.isSurfaceSafe('widget.dictionary', true), true);
  assert.equal(exam.isSurfaceSafe('widget.conjugation', true), true);
  assert.equal(exam.isSurfaceSafe('widget.tts', true), true);
  assert.equal(exam.isSurfaceSafe('sidePanel.fest', true), true);
});

test('isSurfaceSafe returns false for suppressed surfaces in exam mode', () => {
  assert.equal(exam.isSurfaceSafe('wordPrediction.dropdown', true), false);
  assert.equal(exam.isSurfaceSafe('widget.pedagogyPanel', true), false);
});

test('isSurfaceSafe fail-safe: unknown surface IDs return false in exam mode', () => {
  assert.equal(exam.isSurfaceSafe('nonexistent.surface', true), false);
  assert.equal(exam.isSurfaceSafe('', true), false);
  assert.equal(exam.isSurfaceSafe(null, true), false);
});

// ── isRuleSafe ──

test('isRuleSafe returns true for any rule when examMode=false', () => {
  const ruleSafeFalse = { id: 'x', exam: { safe: false, reason: 'r', category: 'grammar-lookup' } };
  const ruleSafeTrue = { id: 'y', exam: { safe: true, reason: 'r', category: 'spellcheck' } };
  assert.equal(exam.isRuleSafe(ruleSafeFalse, false), true);
  assert.equal(exam.isRuleSafe(ruleSafeTrue, false), true);
});

test('isRuleSafe returns true when rule.exam.safe=true and examMode=true', () => {
  const rule = { id: 'x', exam: { safe: true, reason: 'r', category: 'spellcheck' } };
  assert.equal(exam.isRuleSafe(rule, true), true);
});

test('isRuleSafe returns false when rule.exam.safe=false and examMode=true', () => {
  const rule = { id: 'x', exam: { safe: false, reason: 'r', category: 'grammar-lookup' } };
  assert.equal(exam.isRuleSafe(rule, true), false);
});

test('isRuleSafe fail-safe: missing rule, missing exam, or non-boolean safe → false in exam mode', () => {
  assert.equal(exam.isRuleSafe(null, true), false);
  assert.equal(exam.isRuleSafe(undefined, true), false);
  assert.equal(exam.isRuleSafe({}, true), false);
  assert.equal(exam.isRuleSafe({ exam: {} }, true), false);
  assert.equal(exam.isRuleSafe({ exam: { safe: 'true' } }, true), false); // strict bool check
  assert.equal(exam.isRuleSafe({ exam: { safe: 1 } }, true), false);
});

// ── isExplainSafe ──

test('isExplainSafe returns true when examMode=false', () => {
  const rule = { id: 'x', exam: { safe: false }, explain: Object.assign(() => {}, { exam: { safe: false } }) };
  assert.equal(exam.isExplainSafe(rule, false), true);
});

test('isExplainSafe falls through to isRuleSafe when no rule.explain.exam present', () => {
  const ruleSafe = { id: 'x', exam: { safe: true, reason: 'r', category: 'spellcheck' } };
  const ruleUnsafe = { id: 'y', exam: { safe: false, reason: 'r', category: 'grammar-lookup' } };
  assert.equal(exam.isExplainSafe(ruleSafe, true), true);
  assert.equal(exam.isExplainSafe(ruleUnsafe, true), false);
});

test('isExplainSafe reads rule.explain.exam.safe when present (dual-marker)', () => {
  // de-prep-case shape: rule.exam.safe=false (current default) AND
  // rule.explain.exam.safe=false (independent pedagogy axis).
  const fn = () => {};
  fn.exam = { safe: false, reason: 'pedagogy', category: 'pedagogy' };
  const dualBothFalse = {
    id: 'de-prep-case',
    exam: { safe: false, reason: 'r', category: 'grammar-lookup' },
    explain: fn,
  };
  assert.equal(exam.isExplainSafe(dualBothFalse, true), false);
});

test('isExplainSafe browser-parity case: rule.exam.safe=true but explain.exam.safe=false', () => {
  // Hypothetical future shape: dot shows in exam mode (browser-native parity)
  // but the Lær mer pedagogy popover is still suppressed.
  const fn = () => {};
  fn.exam = { safe: false, reason: 'pedagogy hidden', category: 'pedagogy' };
  const rule = {
    id: 'browser-parity',
    exam: { safe: true, reason: 'r', category: 'spellcheck' },
    explain: fn,
  };
  assert.equal(exam.isRuleSafe(rule, true), true, 'dot stays');
  assert.equal(exam.isExplainSafe(rule, true), false, 'popover suppressed');
});

test('isExplainSafe handles missing rule / missing explain gracefully', () => {
  assert.equal(exam.isExplainSafe(null, true), false);
  assert.equal(exam.isExplainSafe({}, true), false);
  assert.equal(exam.isExplainSafe({ exam: { safe: true } }, true), true); // no explain → falls through
  assert.equal(exam.isExplainSafe({ exam: { safe: false } }, true), false);
});

// ── getExamMode ──

test('getExamMode resolves to false in Node (no chrome.storage)', async () => {
  const result = await exam.getExamMode();
  assert.equal(result, false);
});

// ── Registry shape + policy invariants ──

console.log('\nPhase 27 — exam-registry policy');

const REQUIRED_SURFACE_IDS = [
  'popup.search',
  'popup.conjugationTable',
  'popup.ttsButton',
  'popup.grammarFeaturesPopover',
  'widget.dictionary',
  'widget.conjugation',
  'widget.tts',
  'widget.pedagogyPanel',
  'wordPrediction.dropdown',
  'sidePanel.fest',
];

test('registry contains all 10 required surface IDs', () => {
  const ids = registry.map(e => e.id).sort();
  assert.deepEqual(ids, [...REQUIRED_SURFACE_IDS].sort());
});

test('every registry entry has well-formed exam marker', () => {
  const VALID_CATEGORIES = new Set([
    'spellcheck', 'grammar-lookup', 'dictionary', 'tts',
    'prediction', 'pedagogy', 'popup', 'widget',
  ]);
  for (const e of registry) {
    assert.ok(typeof e.id === 'string' && e.id.length > 0, `id missing on ${JSON.stringify(e)}`);
    assert.ok(e.exam, `exam marker missing on ${e.id}`);
    assert.equal(typeof e.exam.safe, 'boolean', `${e.id}: exam.safe must be boolean`);
    assert.ok(typeof e.exam.reason === 'string' && e.exam.reason.length > 0, `${e.id}: exam.reason missing`);
    assert.ok(VALID_CATEGORIES.has(e.exam.category), `${e.id}: exam.category "${e.exam.category}" not in closed set`);
  }
});

test('policy: static-reference surfaces are exam-safe', () => {
  // Per Plan 27 UAT round 1: "static reference info is allowed in exam".
  // A printed dictionary on the desk is allowed → digital equivalent is too.
  const STATIC_REFERENCE = [
    'popup.search', 'popup.conjugationTable', 'popup.ttsButton',
    'popup.grammarFeaturesPopover', 'widget.dictionary',
    'widget.conjugation', 'widget.tts', 'sidePanel.fest',
  ];
  for (const id of STATIC_REFERENCE) {
    const e = registry.find(x => x.id === id);
    assert.equal(e.exam.safe, true, `${id} should be exam-safe (static reference policy)`);
  }
});

test('policy: answer-generating surfaces are suppressed in exam mode', () => {
  // Word prediction actively writes for the student.
  // Pedagogy panel surfaces worked examples that can leak grammar answers.
  const ANSWER_GENERATING = ['wordPrediction.dropdown', 'widget.pedagogyPanel'];
  for (const id of ANSWER_GENERATING) {
    const e = registry.find(x => x.id === id);
    assert.equal(e.exam.safe, false, `${id} should be suppressed (answer-generating policy)`);
  }
});

test('registry is frozen (immutable at runtime)', () => {
  assert.ok(Object.isFrozen(registry), 'registry array should be frozen');
  assert.ok(Object.isFrozen(registry[0]), 'registry entries should be frozen');
  assert.ok(Object.isFrozen(registry[0].exam), 'registry entry exam blocks should be frozen');
});

// ── Spell-rule contract: every registered rule has a well-formed exam marker ──
// (Loads every spell-rule file just like check-exam-marker, but asserts
// the unit-level invariants that runtime suppression in spell-check.js
// depends on. Catches the same regressions from a different angle than
// the CI gate.)

console.log('\nPhase 27 — spell-rule exam markers (runtime contract)');

const fs = require('fs');
const RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');
const ruleFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));

// Reset and load all rule registrants.
globalThis.__lexiSpellRules = [];
for (const f of ruleFiles) {
  // Each rule file is an IIFE that pushes onto __lexiSpellRules.
  // Some rules import from spell-check-core.js (already loaded above).
  delete require.cache[path.join(RULES_DIR, f)];
  require(path.join(RULES_DIR, f));
}
const rules = globalThis.__lexiSpellRules;

test('every spell-rule has an exam marker with required fields', () => {
  const VALID_CATEGORIES = new Set([
    'spellcheck', 'grammar-lookup', 'dictionary', 'tts',
    'prediction', 'pedagogy', 'popup', 'widget',
  ]);
  assert.ok(rules.length > 0, 'at least one rule should register');
  for (const r of rules) {
    assert.ok(r && r.id, `rule missing id`);
    assert.ok(r.exam, `${r.id}: exam marker missing`);
    assert.equal(typeof r.exam.safe, 'boolean', `${r.id}: exam.safe must be boolean`);
    assert.ok(typeof r.exam.reason === 'string' && r.exam.reason.length > 0, `${r.id}: exam.reason missing`);
    if (r.exam.category !== undefined) {
      assert.ok(VALID_CATEGORIES.has(r.exam.category), `${r.id}: exam.category "${r.exam.category}" not in closed set`);
    }
  }
});

test('isRuleSafe filter is consistent with rule markers across the registry', () => {
  // For every registered rule, isRuleSafe(rule, true) === rule.exam.safe.
  // This is the contract the spell-check.js findings filter relies on.
  for (const r of rules) {
    assert.equal(
      exam.isRuleSafe(r, true),
      r.exam.safe === true,
      `${r.id}: isRuleSafe(rule, true) disagrees with rule.exam.safe`,
    );
  }
});

test('de-prep-case carries the dual-marker shape (rule.explain.exam present)', () => {
  const r = rules.find(x => x.id === 'de-prep-case');
  assert.ok(r, 'de-prep-case rule should be registered');
  assert.ok(typeof r.explain === 'function', 'explain should still be callable');
  assert.ok(r.explain.exam, 'de-prep-case must carry the dual marker on explain');
  assert.equal(typeof r.explain.exam.safe, 'boolean', 'explain.exam.safe must be boolean');
  assert.ok(typeof r.explain.exam.reason === 'string' && r.explain.exam.reason.length > 0, 'explain.exam.reason missing');
});

test('de-prep-case explain still returns the {nb, nn} contract', () => {
  // Phase 27-01 wrapped the explain function with Object.assign — must not
  // break the existing explain contract enforced by check-explain-contract.
  const r = rules.find(x => x.id === 'de-prep-case');
  const synthetic = {
    prep: 'mit',
    requiredCase: 'Dativ',
    fix: 'dem Hund',
    original: 'der Hund',
  };
  const out = r.explain(synthetic);
  assert.ok(out && typeof out.nb === 'string' && out.nb.length > 0, 'explain.nb missing');
  assert.ok(typeof out.nn === 'string' && out.nn.length > 0, 'explain.nn missing');
});

// ── Result ──

console.log('');
console.log(`Phase 27 unit tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
