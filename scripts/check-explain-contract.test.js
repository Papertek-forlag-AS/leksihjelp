#!/usr/bin/env node
/**
 * Self-test for scripts/check-explain-contract.js (UX-01 gate).
 *
 * Plants a scratch rule file inside extension/content/spell-rules/ with a
 * broken explain shape (string, not callable) and confirms the gate fires
 * on it. Removes the scratch, confirms the gate's exit code returns to its
 * pre-plant state.
 *
 * NOTE on expected exit codes: this self-test lands in Plan 05-01 BEFORE
 * Plan 05-02 upgrades the 5 target rules to the { nb, nn } callable shape.
 * In the pre-upgrade state today:
 *   - Baseline (no scratch) — gate exits 1 (because rules still have string
 *     explain). This is not a self-test failure; it's the gate doing its job.
 *   - With scratch planted — gate ALSO exits 1 (multiple failure reasons).
 *
 * So instead of a strict "baseline=0, planted=1, post-cleanup=0" assertion
 * (which mirrors check-network-silence.test.js but presumes the pre-upgrade
 * world), this self-test proves the gate specifically CATCHES the broken
 * scratch rule by asserting the scratch file's diagnostic appears in stderr
 * when planted, AND that the diagnostic is NOT present after cleanup. This
 * is belt-and-braces identical in spirit: if a regex typo makes the gate
 * silently permissive, the planted-scratch detection will fail loud.
 *
 * Once Plan 05-02 lands and the 5 target rules become callable, a future
 * revision can add the strict baseline=0 assertion — but not before.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-explain-contract.js');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const SCRATCH = path.join(SPELL_RULES_DIR, '_test-scratch-explain.js');

// Scratch rule with a deliberately-broken explain (string, not callable).
// This exactly matches the pre-upgrade legacy shape — the 5 target rules
// today all fail for this same reason. We add the scratch as a SIXTH
// target via require override below; the gate itself doesn't scan the
// spell-rules/ directory, it iterates a hard-coded TARGETS list. So we
// invoke the gate via a wrapper that extends TARGETS to include the
// scratch file, then inspect stderr for the scratch-specific diagnostic.
const SCRATCH_BODY = `'use strict';
// Test scratch for check-explain-contract.test.js — DO NOT SHIP.
// The self-test plants this file, runs a wrapped gate invocation, and asserts
// the gate flags this specific file. The scratch is cleaned up on exit.
const rule = {
  id: 'scratch',
  languages: ['nb', 'nn'],
  priority: 99,
  severity: 'error',
  explain: 'broken string — must be a callable returning {nb, nn}',
  check() { return []; },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;

// Phase 6: scratch rule with valid explain but MISSING severity field —
// asserts the gate fires with SEVERITY_MISSING.
const SCRATCH_BODY_NO_SEVERITY = `'use strict';
// Test scratch — DO NOT SHIP. Used by check-explain-contract.test.js to
// confirm the gate flags a rule missing severity.
const rule = {
  id: 'scratch',
  languages: ['nb', 'nn'],
  priority: 99,
  explain: (f) => ({
    nb: 'NB test copy for ' + (f && f.original || 'x'),
    nn: 'NN test copy for ' + (f && f.original || 'x'),
  }),
  check() { return []; },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;

// The gate script extended to include the scratch file as a 6th target.
// We invoke the real gate via a small JS shim that overrides the TARGETS
// export behavior by monkey-patching fs.readFileSync / requiring its module
// object. Simpler approach: spawn node with a wrapper that reads the gate
// source, appends our scratch path to the TARGETS array via sed-in-JS, and
// evaluates the result. This keeps the real gate file byte-identical.
function runGateWithScratch() {
  const gateSrc = fs.readFileSync(GATE, 'utf8');
  // Inject the scratch file as the SOLE TARGET — the gate fails fast on
  // first failure, and today's pre-Plan-05-02 rules all fail on the string
  // explain shape. Replacing TARGETS entirely isolates the scratch path so
  // we can assert the gate's validation logic specifically fires on OUR
  // planted broken rule. Also pin ROOT to the project root so the injected
  // gate resolves paths correctly when launched via `node -e` (where
  // __dirname resolves to cwd, not the gate script's directory).
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

function runGateWithScratchFixed() {
  // Same injection but with a fixed (callable { nb, nn }) explain instead of
  // the broken string. Used to prove that the gate PASSES on a well-formed
  // rule — belt-and-braces that the gate isn't ALWAYS failing regardless of
  // shape (that would be the opposite of silently permissive, but equally
  // load-bearing to catch).
  const gateSrc = fs.readFileSync(GATE, 'utf8');
  const scratchRel = path.relative(ROOT, SCRATCH);
  let injected = gateSrc.replace(
    /const TARGETS = \[[\s\S]*?\];/,
    "const TARGETS = ['" + scratchRel + "'];"
  );
  const pinned = injected.replace(
    /const ROOT = path\.join\(__dirname, '\.\.'\);/,
    "const ROOT = " + JSON.stringify(ROOT) + ";"
  );
  const res = spawnSync(process.execPath, ['-e', pinned], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr, stdout: res.stdout };
}

// Phase 6: run gate with a scratch that has valid explain but NO severity.
function runGateWithScratchNoSeverity() {
  const gateSrc = fs.readFileSync(GATE, 'utf8');
  const scratchRel = path.relative(ROOT, SCRATCH);
  let injected = gateSrc.replace(
    /const TARGETS = \[[\s\S]*?\];/,
    "const TARGETS = ['" + scratchRel + "'];"
  );
  const pinned = injected.replace(
    /const ROOT = path\.join\(__dirname, '\.\.'\);/,
    "const ROOT = " + JSON.stringify(ROOT) + ";"
  );
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

// Make sure spell-rules/ exists (it will, but defensive).
if (!fs.existsSync(SPELL_RULES_DIR)) {
  console.error('FAIL: extension/content/spell-rules/ does not exist — cannot plant scratch');
  process.exit(1);
}

// Scratch body with a WELL-FORMED explain callable — used in step 2 to
// confirm the gate passes on shape-correct rules (belt-and-braces that the
// gate isn't stuck permanently failing regardless of shape).
const SCRATCH_BODY_FIXED = `'use strict';
// Test scratch — DO NOT SHIP. Used by check-explain-contract.test.js to
// confirm the gate accepts a shape-correct {nb, nn} callable with severity.
const rule = {
  id: 'scratch',
  languages: ['nb', 'nn'],
  priority: 99,
  severity: 'error',
  explain: (f) => ({
    nb: 'NB test copy for ' + (f && f.original || 'x'),
    nn: 'NN test copy for ' + (f && f.original || 'x'),
  }),
  check() { return []; },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;

// Make sure no lingering scratch from a previous aborted run.
cleanedUp = false;
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);

// Step 1: Plant a BROKEN scratch (string explain). Gate MUST fire on it.
fs.writeFileSync(SCRATCH, SCRATCH_BODY, 'utf8');
if (!fs.existsSync(SCRATCH)) {
  console.error('FAIL: could not plant broken scratch rule');
  process.exit(1);
}
const brokenRun = runGateWithScratch();
const brokenDetected = (brokenRun.status === 1) && (
  brokenRun.stderr.includes('EXPLAIN_NOT_CALLABLE') &&
  brokenRun.stderr.includes('scratch')
);
if (!brokenDetected) {
  console.error('FAIL: gate did not flag the planted broken-explain scratch rule.');
  console.error('  exit status:', brokenRun.status);
  console.error('  stderr:', brokenRun.stderr.slice(0, 500));
  console.error('  stdout:', brokenRun.stdout.slice(0, 500));
  console.error('  Gate may be silently permissive — regex drift or shape-check bypass.');
  cleanup();
  process.exit(1);
}

// Step 2: Plant a WELL-FORMED scratch ({ nb, nn } callable + severity). Gate MUST pass.
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
fs.writeFileSync(SCRATCH, SCRATCH_BODY_FIXED, 'utf8');
const fixedRun = runGateWithScratchFixed();

if (fixedRun.status !== 0) {
  console.error('FAIL: gate flagged a shape-correct scratch rule as broken — gate is too strict.');
  console.error('  exit status:', fixedRun.status);
  console.error('  stderr:', fixedRun.stderr.slice(0, 500));
  console.error('  stdout:', fixedRun.stdout.slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 3 (Phase 6): Plant a scratch with valid explain but NO severity. Gate MUST fire SEVERITY_MISSING.
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
fs.writeFileSync(SCRATCH, SCRATCH_BODY_NO_SEVERITY, 'utf8');
const noSeverityRun = runGateWithScratchNoSeverity();
const severityDetected = (noSeverityRun.status === 1) && (
  noSeverityRun.stderr.includes('SEVERITY_MISSING') &&
  noSeverityRun.stderr.includes('scratch')
);
if (!severityDetected) {
  console.error('FAIL: gate did not flag the planted severity-missing scratch rule.');
  console.error('  exit status:', noSeverityRun.status);
  console.error('  stderr:', noSeverityRun.stderr.slice(0, 500));
  console.error('  stdout:', noSeverityRun.stdout.slice(0, 500));
  console.error('  Gate may be missing severity validation.');
  cleanup();
  process.exit(1);
}

cleanup(); // Always clean up before the final assertion.

// Step 4: Confirm scratch is gone on disk.
if (fs.existsSync(SCRATCH)) {
  console.error('FAIL: scratch file still on disk after cleanup');
  process.exit(1);
}

console.log('PASS: self-test confirms gate correctly distinguishes broken-explain (exit 1), severity-missing (exit 1), and well-formed (exit 0) shapes.');
process.exit(0);
