#!/usr/bin/env node
/**
 * Leksihjelp — Explain Contract Release Gate (UX-01, Phase 5-01)
 *
 * Every popover-surfacing spell-check rule MUST expose `rule.explain` as a
 * function `(finding) => ({ nb: string, nn: string })`. This gate loads each
 * target rule file under `extension/content/spell-rules/` and asserts:
 *
 *   1. `typeof rule.explain === 'function'`                      (callable)
 *   2. `rule.explain(fakeFinding)` does not throw                (safe)
 *   3. Return value is an object (not null / not string / not array)
 *   4. `typeof result.nb === 'string'` && `result.nb.length > 0` (NB register)
 *   5. `typeof result.nn === 'string'` && `result.nn.length > 0` (NN register)
 *
 * Target files (the 5 rules that surface to the spell-check popover):
 *   - extension/content/spell-rules/nb-gender.js
 *   - extension/content/spell-rules/nb-modal-verb.js
 *   - extension/content/spell-rules/nb-sarskriving.js
 *   - extension/content/spell-rules/nb-typo-curated.js
 *   - extension/content/spell-rules/nb-typo-fuzzy.js
 *
 * Excluded (never reach the popover — emit return [] only):
 *   - extension/content/spell-rules/nb-codeswitch.js       (priority 1, pre-pass)
 *   - extension/content/spell-rules/nb-propernoun-guard.js (priority 5, pre-pass)
 *
 * Exits 0 when all 5 target rules satisfy the contract. Exits 1 with a
 * per-failure diagnostic on any violation.
 *
 * This gate lands BEFORE Plan 05-02 upgrades the rules. On first run it is
 * EXPECTED to exit 1 — today's rules still carry the legacy string explain.
 * Plan 05-02 flips each rule to the { nb, nn } callable, flipping this gate
 * to exit 0.
 *
 * Usage:
 *   node scripts/check-explain-contract.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-network-silence.js style.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const CORE_PATH = path.join(ROOT, 'extension/content/spell-check-core.js');

// The 5 popover-surfacing rule files, relative to ROOT. Order matches the
// priority-ascending sequence in the runner (gender 10 → modal 20 →
// sarskriving 30 → typo-curated 40 → typo-fuzzy 50).
const TARGETS = [
  'extension/content/spell-rules/de-capitalization.js',
  'extension/content/spell-rules/de-gender.js',
  'extension/content/spell-rules/de-grammar.js',
  'extension/content/spell-rules/de-modal-verb.js',
  'extension/content/spell-rules/en-grammar.js',
  'extension/content/spell-rules/es-accent-guard.js',
  'extension/content/spell-rules/es-coordination.js',
  'extension/content/spell-rules/es-grammar.js',
  'extension/content/spell-rules/es-fr-gender.js',
  'extension/content/spell-rules/es-fr-modal-verb.js',
  'extension/content/spell-rules/fr-contraction.js',
  'extension/content/spell-rules/fr-grammar.js',
  'extension/content/spell-rules/fr-preposition.js',
  'extension/content/spell-rules/nb-gender.js',
  'extension/content/spell-rules/nb-compound-gender.js',
  'extension/content/spell-rules/nb-demonstrative-gender.js',
  'extension/content/spell-rules/nb-modal-verb.js',
  'extension/content/spell-rules/nb-sarskriving.js',
  'extension/content/spell-rules/universal-agreement.js',
  'extension/content/spell-rules/nb-dialect-mix.js',      // Phase 05.1 Gap D
  'extension/content/spell-rules/nb-typo-curated.js',
  'extension/content/spell-rules/nb-triple-letter.js',
  'extension/content/spell-rules/nb-typo-fuzzy.js',
  'extension/content/spell-rules/nb-homophones.js',
  'extension/content/spell-rules/universal-context-typo.js',
  'extension/content/spell-rules/register.js',
  'extension/content/spell-rules/collocation.js',
  'extension/content/spell-rules/redundancy.js',
  'extension/content/spell-rules/es-ser-estar.js',
  'extension/content/spell-rules/es-por-para.js',
  'extension/content/spell-rules/es-personal-a.js',
  'extension/content/spell-rules/de-prep-case.js',
  'extension/content/spell-rules/de-separable-verb.js',
  'extension/content/spell-rules/de-v2.js',
  'extension/content/spell-rules/de-verb-final.js',
  'extension/content/spell-rules/fr-bags.js',
  'extension/content/spell-rules/nb-v2.js',
  'extension/content/spell-rules/quotation-suppression.js',
  'extension/content/spell-rules/de-perfekt-aux.js',
  'extension/content/spell-rules/de-compound-gender.js',
  'extension/content/spell-rules/fr-elision.js',
  'extension/content/spell-rules/fr-etre-avoir.js',
  'extension/content/spell-rules/fr-pp-agreement.js',
  'extension/content/spell-rules/es-subjuntivo.js',
  'extension/content/spell-rules/es-imperfecto-hint.js',
  'extension/content/spell-rules/fr-subjonctif.js',
  'extension/content/spell-rules/fr-aspect-hint.js',
  'extension/content/spell-rules/es-pro-drop.js',
  'extension/content/spell-rules/es-gustar.js',
  'extension/content/spell-rules/fr-clitic-order.js',
  'extension/content/spell-rules/en-morphology.js',
  'extension/content/spell-rules/en-word-family.js',
  'extension/content/spell-rules/fr-adj-gender.js',
  'extension/content/spell-rules/doc-drift-de-address.js',
  'extension/content/spell-rules/doc-drift-fr-address.js',
  'extension/content/spell-rules/doc-drift-nb-register.js',
  'extension/content/spell-rules/doc-drift-nn-infinitive.js',
  'extension/content/spell-rules/nb-nn-passiv-s.js',
  'extension/content/spell-rules/nb-aa-og.js',
  'extension/content/spell-rules/doc-drift-nb-passiv-overuse.js',
];

// Reset the shared globals the rule files register onto. Without this the
// registry accumulates across loads — not strictly harmful to the gate's
// correctness but keeps the per-file assertions cleanly isolated.
function resetGlobals() {
  if (typeof global.self === 'undefined') global.self = global;
  global.self.__lexiSpellRules = [];
  delete global.self.__lexiSpellCore;
}

function clearRequireCache() {
  const corePath = require.resolve(CORE_PATH);
  if (require.cache[corePath]) delete require.cache[corePath];
  for (const rel of TARGETS) {
    try {
      const abs = require.resolve(path.join(ROOT, rel));
      if (require.cache[abs]) delete require.cache[abs];
    } catch (_) { /* not loaded yet, fine */ }
  }
}

function loadCore() {
  // The core IIFE attaches __lexiSpellCore onto self; importing it once per
  // rule-file load keeps the helper surface available to rules that
  // destructure from host.__lexiSpellCore in their IIFE preamble.
  require(CORE_PATH);
}

function fail(code, ruleId, file, detail) {
  process.stderr.write(
    '[check-explain-contract] FAIL: ' + code + ' ' +
    (ruleId || '<no id>') + ' ' +
    path.relative(ROOT, file) + ' :: ' + detail + '\n'
  );
  process.exit(1);
}

function validateRule(rule, file) {
  const ruleId = rule && rule.id;
  if (!rule || typeof rule !== 'object') {
    return { ok: false, code: 'RULE_NOT_OBJECT', ruleId: '<no id>', detail: 'require() did not return a rule object' };
  }
  if (typeof rule.explain !== 'function') {
    return {
      ok: false,
      code: 'EXPLAIN_NOT_CALLABLE',
      ruleId,
      detail: 'typeof rule.explain is ' + typeof rule.explain + ' (expected: function)',
    };
  }

  // Placeholder finding — every field the current rule set references on
  // findings, plus the rule's own id/priority so disambiguation-aware copy
  // can read them.
  const fakeFinding = {
    rule_id: rule.id,
    priority: rule.priority,
    original: 'testword',
    fix: 'testfix',
    start: 0,
    end: 8,
    message: 'test',
  };

  let result;
  try {
    result = rule.explain(fakeFinding);
  } catch (e) {
    return { ok: false, code: 'EXPLAIN_THREW', ruleId, detail: String(e && e.message || e) };
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return {
      ok: false,
      code: 'EXPLAIN_RETURN_NOT_OBJECT',
      ruleId,
      detail: 'explain() returned ' + (result === null ? 'null' : Array.isArray(result) ? 'array' : typeof result) + ' (expected: {nb, nn})',
    };
  }

  const missing = [];
  if (typeof result.nb !== 'string') missing.push('nb (' + typeof result.nb + ')');
  if (typeof result.nn !== 'string') missing.push('nn (' + typeof result.nn + ')');
  if (missing.length) {
    return {
      ok: false,
      code: 'EXPLAIN_MISSING_REGISTER',
      ruleId,
      detail: 'missing/wrong-type register(s): ' + missing.join(', '),
    };
  }

  if (result.nb.length === 0 || result.nn.length === 0) {
    return {
      ok: false,
      code: 'EXPLAIN_EMPTY_STRING',
      ruleId,
      detail: 'nb.length=' + result.nb.length + ' nn.length=' + result.nn.length + ' (both must be non-empty)',
    };
  }

  // Phase 6: severity field is mandatory on all rules.
  const VALID_SEVERITIES = new Set(['error', 'warning', 'hint']);
  if (!VALID_SEVERITIES.has(rule.severity)) {
    return {
      ok: false,
      code: 'SEVERITY_MISSING',
      ruleId: rule.id || ruleId,
      detail: 'rule.severity must be one of: error, warning, hint. Got: ' + rule.severity,
    };
  }

  // Phase 32-01: optional pedagogy-shape validation.
  //
  // When a rule's explain() returns a `pedagogy` field, validate its shape.
  // This is additive — rules that don't return pedagogy (the legacy { nb, nn }
  // contract) continue to pass unchanged. The shape mirrors the JSON authored
  // in papertek-vocabulary (DE preposition pedagogy + FR aspect_choice).
  //
  // Required fields when `pedagogy` is present:
  //   - pedagogy.summary.nb     non-empty string
  //   - pedagogy.summary.en     non-empty string
  //   - pedagogy.explanation.nb non-empty string
  //
  // Optional sub-shapes that get validated when present:
  //   - pedagogy.examples       must be array; each entry must have non-empty
  //                             `sentence` string
  //   - pedagogy.common_error   must have non-empty `wrong` AND `correct`
  //                             strings
  //
  // To exercise the pedagogy branch the validator may need a finding that
  // carries pedagogy. Most pedagogy-bearing rules attach the pedagogy block
  // either through `finding.pedagogy` (de-prep-case convention) or by
  // returning it from explain() directly (fr-aspect-hint convention). We
  // always look at result.pedagogy (the explain() return) AND, as a
  // fallback, retry explain() with a `pedagogy` field on the fakeFinding —
  // this exercises the de-prep-case-style pass-through code path too.
  let pedagogy = result && result.pedagogy;
  if (!pedagogy) {
    // Re-invoke explain() with a synthetic pedagogy block on the finding so
    // rules that pass-through (rather than load from data) get a chance to
    // expose their pedagogy shape via explain(). This is a no-op for rules
    // that don't reference finding.pedagogy.
    const synthetic = {
      summary: { nb: 'x', nn: 'x', en: 'x' },
      explanation: { nb: 'x', nn: 'x', en: 'x' },
    };
    let retryResult;
    try {
      retryResult = rule.explain(Object.assign({}, fakeFinding, { pedagogy: synthetic }));
    } catch (_) {
      retryResult = null;
    }
    if (retryResult && retryResult.pedagogy && retryResult.pedagogy !== synthetic) {
      pedagogy = retryResult.pedagogy;
    }
  }
  if (pedagogy) {
    const pedErr = validatePedagogy(pedagogy);
    if (pedErr) {
      return {
        ok: false,
        code: 'PEDAGOGY_MALFORMED',
        ruleId: rule.id || ruleId,
        detail: pedErr,
      };
    }
  }

  return { ok: true, ruleId };
}

// Phase 32-01: pedagogy-shape validator. Returns null if the pedagogy block
// is well-formed, otherwise a string naming the malformed field path.
function validatePedagogy(pedagogy) {
  if (!pedagogy || typeof pedagogy !== 'object' || Array.isArray(pedagogy)) {
    return 'pedagogy is not a non-array object';
  }
  if (!pedagogy.summary || typeof pedagogy.summary !== 'object') {
    return 'pedagogy.summary is missing or not an object';
  }
  if (typeof pedagogy.summary.nb !== 'string' || pedagogy.summary.nb.length === 0) {
    return 'pedagogy.summary.nb is missing or empty';
  }
  if (typeof pedagogy.summary.en !== 'string' || pedagogy.summary.en.length === 0) {
    return 'pedagogy.summary.en is missing or empty';
  }
  if (!pedagogy.explanation || typeof pedagogy.explanation !== 'object') {
    return 'pedagogy.explanation is missing or not an object';
  }
  if (typeof pedagogy.explanation.nb !== 'string' || pedagogy.explanation.nb.length === 0) {
    return 'pedagogy.explanation.nb is missing or empty';
  }
  // Optional examples: if present, must be array of objects with non-empty `sentence`.
  if (pedagogy.examples !== undefined) {
    if (!Array.isArray(pedagogy.examples)) {
      return 'pedagogy.examples is present but not an array';
    }
    for (let i = 0; i < pedagogy.examples.length; i++) {
      const ex = pedagogy.examples[i];
      if (!ex || typeof ex !== 'object') {
        return 'pedagogy.examples[' + i + '] is not an object';
      }
      if (typeof ex.sentence !== 'string' || ex.sentence.length === 0) {
        return 'pedagogy.examples[' + i + '].sentence is missing or empty';
      }
    }
  }
  // Optional common_error: if present, must have non-empty wrong + correct.
  if (pedagogy.common_error !== undefined) {
    const ce = pedagogy.common_error;
    if (!ce || typeof ce !== 'object') {
      return 'pedagogy.common_error is present but not an object';
    }
    if (typeof ce.wrong !== 'string' || ce.wrong.length === 0) {
      return 'pedagogy.common_error.wrong is missing or empty';
    }
    if (typeof ce.correct !== 'string' || ce.correct.length === 0) {
      return 'pedagogy.common_error.correct is missing or empty';
    }
  }
  return null;
}

function main() {
  let passed = 0;
  for (const rel of TARGETS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      fail('RULE_FILE_MISSING', '<no id>', abs, 'expected rule file not found on disk');
    }

    resetGlobals();
    clearRequireCache();
    try {
      loadCore();
    } catch (e) {
      fail('CORE_LOAD_THREW', '<no id>', CORE_PATH, String(e && e.message || e));
    }

    let rule;
    try {
      rule = require(abs);
    } catch (e) {
      fail('RULE_LOAD_THREW', '<no id>', abs, String(e && e.message || e));
    }

    const res = validateRule(rule, abs);
    if (!res.ok) {
      fail(res.code, res.ruleId, abs, res.detail);
    }
    passed++;
  }

  console.log('[check-explain-contract] PASS: ' + passed + '/' + TARGETS.length + ' popover-surfacing rules have valid explain contract');
  process.exit(0);
}

main();
