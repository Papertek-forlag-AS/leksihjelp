#!/usr/bin/env node
/**
 * Self-test for scripts/check-exam-marker.js (Phase 27, Plan 27-02).
 *
 * Belt-and-braces against the gate going silently permissive. Plants four
 * scratch rule files with deliberately-broken exam markers (gate must fire
 * on each) and one well-formed scratch rule (gate must pass). Uses the
 * LEXI_EXAM_MARKER_EXTRA_TARGETS env-var injection seam decided in Plan
 * 26-02 (LEXI_PEDAGOGY_GATE_EXTRA_TARGETS).
 *
 * Why four bad scenarios? Each covers a distinct silent-permissive failure
 * mode that a future regex/shape drift could introduce:
 *   1. Malformed marker — `safe` is wrong type AND `reason` is empty
 *   2. Missing marker entirely — no `exam` field at all
 *   3. Invalid category — string but not in the closed set
 *   4. (Implicit via well-formed) — gate is not always-failing
 *
 * Mirrors check-explain-contract.test.js style: scratch files in os.tmpdir()
 * (NOT in the repo), spawnSync the real gate with env override, assert exit
 * codes, cleanup in finally.
 *
 * Usage:
 *   node scripts/check-exam-marker.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE_PATH = path.join(__dirname, 'check-exam-marker.js');

const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lexi-exam-marker-test-'));

// Scratch rule bodies. Each file pushes a single rule onto host.__lexiSpellRules.
// The boilerplate around the rule object mirrors a real rule file's IIFE.

function makeScratchBody(ruleLiteral) {
  return [
    "'use strict';",
    "(function () {",
    "  const host = typeof self !== 'undefined' ? self : globalThis;",
    "  host.__lexiSpellRules = host.__lexiSpellRules || [];",
    "  const rule = " + ruleLiteral + ";",
    "  host.__lexiSpellRules.push(rule);",
    "  if (typeof module !== 'undefined' && module.exports) module.exports = rule;",
    "})();",
    "",
  ].join('\n');
}

const SCRATCH_BAD_MALFORMED = makeScratchBody(
  // safe is string (not boolean), reason is empty
  "{ id: 'scratch-bad-malformed', test: function() { return []; }, exam: { safe: 'yes', reason: '' } }"
);

const SCRATCH_BAD_MISSING = makeScratchBody(
  // No exam field at all
  "{ id: 'scratch-bad-missing', test: function() { return []; } }"
);

const SCRATCH_BAD_CATEGORY = makeScratchBody(
  // category is a string but not in the closed set
  "{ id: 'scratch-bad-category', test: function() { return []; }, exam: { safe: false, reason: 'x', category: 'made-up-category' } }"
);

const SCRATCH_GOOD = makeScratchBody(
  "{ id: 'scratch-good', test: function() { return []; }, exam: { safe: true, reason: 'scratch-test', category: 'spellcheck' } }"
);

function plant(name, body) {
  const p = path.join(TMP_DIR, name);
  fs.writeFileSync(p, body, 'utf8');
  return p;
}

function runGate(extraTargetPath) {
  const env = Object.assign({}, process.env, {
    LEXI_EXAM_MARKER_EXTRA_TARGETS: extraTargetPath,
  });
  return spawnSync(process.execPath, [GATE_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    env,
  });
}

function fail(scenario, expected, result) {
  console.error('FAIL: ' + scenario);
  console.error('  expected: ' + expected);
  console.error('  actual exit status: ' + result.status);
  console.error('  stderr:', (result.stderr || '').slice(0, 800));
  console.error('  stdout:', (result.stdout || '').slice(0, 400));
}

function cleanup() {
  try {
    for (const f of fs.readdirSync(TMP_DIR)) {
      try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch (_) {}
    }
    fs.rmdirSync(TMP_DIR);
  } catch (_) { /* best-effort */ }
}

let exitCode = 0;
try {
  // Scenario 1: malformed marker — gate must fire.
  const p1 = plant('scratch-bad-malformed.js', SCRATCH_BAD_MALFORMED);
  const r1 = runGate(p1);
  if (r1.status !== 1) {
    fail('scenario 1 (malformed marker)', 'exit 1', r1);
    exitCode = 1;
  } else if (!r1.stderr.includes('scratch-bad-malformed')) {
    fail('scenario 1 (malformed marker)', 'stderr to mention scratch-bad-malformed', r1);
    exitCode = 1;
  }

  // Scenario 2: missing marker entirely — gate must fire.
  const p2 = plant('scratch-bad-missing.js', SCRATCH_BAD_MISSING);
  const r2 = runGate(p2);
  if (r2.status !== 1) {
    fail('scenario 2 (missing marker)', 'exit 1', r2);
    exitCode = 1;
  } else if (!r2.stderr.includes('scratch-bad-missing')) {
    fail('scenario 2 (missing marker)', 'stderr to mention scratch-bad-missing', r2);
    exitCode = 1;
  }

  // Scenario 3: invalid category — gate must fire.
  const p3 = plant('scratch-bad-category.js', SCRATCH_BAD_CATEGORY);
  const r3 = runGate(p3);
  if (r3.status !== 1) {
    fail('scenario 3 (invalid category)', 'exit 1', r3);
    exitCode = 1;
  } else if (!r3.stderr.includes('scratch-bad-category')) {
    fail('scenario 3 (invalid category)', 'stderr to mention scratch-bad-category', r3);
    exitCode = 1;
  } else if (!r3.stderr.includes('made-up-category')) {
    fail('scenario 3 (invalid category)', 'stderr to mention the offending category value', r3);
    exitCode = 1;
  }

  // Scenario 4: well-formed marker — gate must pass.
  const p4 = plant('scratch-good.js', SCRATCH_GOOD);
  const r4 = runGate(p4);
  if (r4.status !== 0) {
    fail('scenario 4 (well-formed)', 'exit 0', r4);
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('[OK] check-exam-marker:test — gate fires on malformed/missing/invalid-category, passes on well-formed');
  }
} finally {
  cleanup();
}

process.exit(exitCode);
