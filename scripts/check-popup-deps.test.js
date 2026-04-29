#!/usr/bin/env node
/**
 * Self-test for scripts/check-popup-deps.js (Phase 30-01).
 *
 * Plants two scratch files inside extension/popup/views/:
 *   - __scratch-bad.js  — uses chrome.storage.local.get(...) → gate MUST exit 1
 *   - __scratch-good.js — uses only deps.storage.get(...) and
 *                         container.querySelector(...) → gate MUST exit 0
 *
 * The scratch files are removed in a finally block regardless of outcome.
 *
 * Mirrors the check-explain-contract.test.js belt-and-braces pattern: if the
 * gate's regex drifts and goes silently permissive, the bad-scratch step
 * fails loud; if the gate becomes too strict, the good-scratch step fails.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-popup-deps.js');
const VIEWS_DIR = path.join(ROOT, 'extension/popup/views');
const BAD = path.join(VIEWS_DIR, '__scratch-bad.js');
const GOOD = path.join(VIEWS_DIR, '__scratch-good.js');

const BAD_BODY = `'use strict';
// Test scratch — DO NOT SHIP. Used by check-popup-deps.test.js.
(function () {
  function mountScratchBad(container, deps) {
    // Forbidden — reaches for chrome.* directly instead of using deps.storage.
    chrome.storage.local.get(['x'], () => {});
    return { destroy() {} };
  }
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiScratchBad = { mount: mountScratchBad };
})();
`;

const GOOD_BODY = `'use strict';
// Test scratch — DO NOT SHIP. Used by check-popup-deps.test.js.
(function () {
  function mountScratchGood(container, deps) {
    if (!container) throw new Error('container required');
    if (!deps) throw new Error('deps required');
    // Allowed — deps and container.querySelector only.
    const input = container.querySelector('#search-input');
    deps.storage.get('x');
    return { destroy() {} };
  }
  // Module's own self-export is fine; gate whitelists the four real view exports
  // but the gate also tolerates any forbidden-free surface — this scratch file
  // never registers an own __lexi* global, just exports its function.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mount: mountScratchGood };
  }
})();
`;

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  for (const p of [BAD, GOOD]) {
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch (_) { /* best-effort */ }
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

if (!fs.existsSync(VIEWS_DIR)) {
  console.error('FAIL: ' + path.relative(ROOT, VIEWS_DIR) + ' does not exist — cannot plant scratches');
  process.exit(1);
}

// Make sure no lingering scratches.
cleanup();
cleanedUp = false;

// Step 1: Baseline (no scratch). Real view modules should be clean.
const baseline = runGate();
if (baseline.status !== 0) {
  console.error('FAIL: baseline gate run failed (real view modules appear to violate the rule).');
  console.error('  exit:', baseline.status);
  console.error('  stderr:', baseline.stderr.slice(0, 600));
  process.exit(1);
}

// Step 2: Plant the BAD scratch. Gate MUST exit 1, mention the scratch file.
fs.writeFileSync(BAD, BAD_BODY, 'utf8');
const badRun = runGate();
const badDetected = (badRun.status === 1) &&
  badRun.stderr.includes('__scratch-bad.js') &&
  badRun.stderr.includes('chrome');
if (!badDetected) {
  console.error('FAIL: gate did not flag the planted bad scratch (chrome.* call).');
  console.error('  exit:', badRun.status);
  console.error('  stderr:', badRun.stderr.slice(0, 600));
  console.error('  Gate may be silently permissive.');
  cleanup();
  process.exit(1);
}
fs.unlinkSync(BAD);

// Step 3: Plant the GOOD scratch. Gate MUST exit 0.
fs.writeFileSync(GOOD, GOOD_BODY, 'utf8');
const goodRun = runGate();
if (goodRun.status !== 0) {
  console.error('FAIL: gate flagged a clean scratch — gate is too strict.');
  console.error('  exit:', goodRun.status);
  console.error('  stderr:', goodRun.stderr.slice(0, 600));
  cleanup();
  process.exit(1);
}
fs.unlinkSync(GOOD);

cleanup();
console.log('PASS: self-test confirms gate fires on chrome.* and passes on deps-only/container-scoped DOM access.');
process.exit(0);
