#!/usr/bin/env node
/**
 * Self-test for scripts/check-rule-css-wiring.js (Phase 05.1 Gap D follow-up gate).
 *
 * Belt-and-braces against the gate going silently permissive (e.g. via
 * regex drift in `cssHasBindingForId`). Mirrors the structure of
 * check-explain-contract.test.js:
 *
 *   Step 1: Plant a scratch rule whose id is NOT wired in content.css.
 *           Invoke the gate with TARGETS replaced by the scratch path.
 *           Assert exit status 1 AND the scratch id appears in stderr.
 *
 *   Step 2: Plant a scratch rule whose id IS wired (reuse `sarskriving`
 *           which has an existing CSS binding).
 *           Invoke the gate with TARGETS replaced by the scratch path.
 *           Assert exit status 0 (gate accepts the shape-correct wiring).
 *
 *   Step 3: Clean up scratch, confirm gate still passes on real TARGETS.
 *
 * Uses the same `runGateWith*` pattern as check-explain-contract.test.js:
 * rewrite the gate source to inject a single-element TARGETS and pin ROOT,
 * then evaluate via `node -e`. This keeps the real gate file
 * byte-identical and isolates the scratch's binding check.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-rule-css-wiring.js');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const SCRATCH = path.join(SPELL_RULES_DIR, '_test-scratch-css-wiring.js');

// Scratch rule with a UNIQUE id that is guaranteed NOT to have a CSS
// binding in content.css (the `-css-wiring-scratch-xyz` suffix makes
// collision extremely unlikely).
const SCRATCH_BODY_UNWIRED = `'use strict';
// Test scratch for check-rule-css-wiring.test.js — DO NOT SHIP.
// Id is deliberately NOT wired to a CSS dot colour; the gate must flag it.
const rule = {
  id: 'css-wiring-scratch-xyz',
  languages: ['nb', 'nn'],
  priority: 99,
  explain: (f) => ({ nb: 'x', nn: 'x' }),
  check() { return []; },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;

// Scratch rule whose id REUSES an existing wired id ('sarskriving' already
// has a CSS binding in content.css:865). The gate must accept this.
const SCRATCH_BODY_WIRED = `'use strict';
// Test scratch for check-rule-css-wiring.test.js — DO NOT SHIP.
// Id reuses 'sarskriving' which has an existing wired CSS binding; the
// gate must accept it.
const rule = {
  id: 'sarskriving',
  languages: ['nb', 'nn'],
  priority: 99,
  explain: (f) => ({ nb: 'x', nn: 'x' }),
  check() { return []; },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;

// Invoke the gate with TARGETS rewritten to the scratch path only, and
// ROOT pinned to the project root (so `node -e` resolution works).
function runGateWithScratchAsSoleTarget() {
  const gateSrc = fs.readFileSync(GATE, 'utf8');
  const scratchRel = path.relative(ROOT, SCRATCH);
  let injected = gateSrc.replace(
    /const TARGETS = \[[\s\S]*?\];/,
    "const TARGETS = ['" + scratchRel + "'];"
  );
  if (injected === gateSrc) {
    throw new Error('self-test: could not rewrite TARGETS in gate source');
  }
  const pinned = injected.replace(
    /const ROOT = path\.join\(__dirname, '\.\.'\);/,
    "const ROOT = " + JSON.stringify(ROOT) + ";"
  );
  if (pinned === injected) {
    throw new Error('self-test: could not pin ROOT in gate source');
  }
  const res = spawnSync(process.execPath, ['-e', pinned], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr, stdout: res.stdout };
}

function runGateBaseline() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr, stdout: res.stdout };
}

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (fs.existsSync(SCRATCH)) {
    try { fs.unlinkSync(SCRATCH); } catch (_) { /* best-effort */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

if (!fs.existsSync(SPELL_RULES_DIR)) {
  console.error('FAIL: extension/content/spell-rules/ does not exist — cannot plant scratch');
  process.exit(1);
}

// No lingering scratch from a prior aborted run.
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);

// Step 0: Baseline — gate must pass on the real TARGETS right now.
const baselineBefore = runGateBaseline();
if (baselineBefore.status !== 0) {
  console.error('FAIL: baseline gate exited', baselineBefore.status, '— expected 0.');
  console.error('  stderr:', baselineBefore.stderr.slice(0, 500));
  console.error('  (is the dialect-mix CSS binding in place?)');
  process.exit(1);
}

// Step 1: Plant a scratch with an UNWIRED id. Gate MUST fire on it.
fs.writeFileSync(SCRATCH, SCRATCH_BODY_UNWIRED, 'utf8');
const unwiredRun = runGateWithScratchAsSoleTarget();
const unwiredDetected = (unwiredRun.status === 1) && (
  unwiredRun.stderr.includes('MISSING_CSS_BINDING') &&
  unwiredRun.stderr.includes('css-wiring-scratch-xyz')
);
if (!unwiredDetected) {
  console.error('FAIL: gate did not flag the planted UNWIRED scratch rule.');
  console.error('  exit status:', unwiredRun.status);
  console.error('  stderr:', unwiredRun.stderr.slice(0, 500));
  console.error('  stdout:', unwiredRun.stdout.slice(0, 500));
  console.error('  Gate may be silently permissive — regex drift or binding-check bypass.');
  cleanup();
  process.exit(1);
}

// Step 2: Plant a scratch with a WIRED id (reuses 'sarskriving'). Gate MUST pass.
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
fs.writeFileSync(SCRATCH, SCRATCH_BODY_WIRED, 'utf8');
const wiredRun = runGateWithScratchAsSoleTarget();
if (wiredRun.status !== 0) {
  console.error('FAIL: gate flagged a shape-correct (wired id) scratch rule as missing — gate is too strict.');
  console.error('  exit status:', wiredRun.status);
  console.error('  stderr:', wiredRun.stderr.slice(0, 500));
  console.error('  stdout:', wiredRun.stdout.slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 3: Clean up scratch, confirm real-TARGETS baseline still passes.
cleanup();
if (fs.existsSync(SCRATCH)) {
  console.error('FAIL: scratch file still on disk after cleanup');
  process.exit(1);
}
const baselineAfter = runGateBaseline();
if (baselineAfter.status !== 0) {
  console.error('FAIL: real-TARGETS baseline failing after scratch cleanup');
  console.error('  exit status:', baselineAfter.status);
  console.error('  stderr:', baselineAfter.stderr.slice(0, 500));
  process.exit(1);
}

console.log('PASS: self-test confirms gate correctly distinguishes unwired (exit 1, diagnostic) vs wired (exit 0) rule ids.');
process.exit(0);
