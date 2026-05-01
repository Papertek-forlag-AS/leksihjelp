#!/usr/bin/env node
/**
 * Self-test for scripts/check-version-alignment.js (Phase 37 / HYG-04).
 *
 * Three-step plant-restore against backend/public/index.html (the lowest-risk
 * of the three version sources — display only, not consumed by build/test
 * pipeline; per RESEARCH Pitfall 3).
 *
 *   1. Baseline:    real state has all three at the same version → gate exits 0.
 *   2. Plant bad:   rewrite `Versjon X.Y.Z` to `Versjon 9.9.9` → gate exits 1
 *                   AND stderr mentions backend/public/index.html + drift.
 *   3. Plant good:  restore original → gate exits 0 again (the restore IS the
 *                   well-formed plant for this gate).
 *
 * The original index.html bytes are saved into a closure variable BEFORE any
 * mutation; cleanup() restores from that variable. process.on('exit'),
 * SIGINT, and uncaughtException are all wired so a kill mid-test never leaves
 * the working tree dirty (RESEARCH Pitfall 2).
 *
 * Mirrors scripts/check-popup-deps.test.js shape line-for-line.
 *
 * Paired gate: scripts/check-version-alignment.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-version-alignment.js');
const PLANT_TARGET = path.join(ROOT, 'backend/public/index.html');

if (!fs.existsSync(PLANT_TARGET)) {
  console.error('FAIL: ' + path.relative(ROOT, PLANT_TARGET) + ' does not exist — cannot plant');
  process.exit(1);
}

// Save original bytes BEFORE any mutation so cleanup is always safe.
const ORIGINAL = fs.readFileSync(PLANT_TARGET, 'utf8');

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  try { fs.writeFileSync(PLANT_TARGET, ORIGINAL, 'utf8'); }
  catch (_) { /* best-effort */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

// Step 1: Baseline — current 2.9.18 alignment must pass.
const baseline = runGate();
if (baseline.status !== 0) {
  console.error('FAIL: baseline gate run failed (real state appears to have version drift).');
  console.error('  exit:', baseline.status);
  console.error('  stderr:', baseline.stderr.slice(0, 800));
  console.error('  stdout:', baseline.stdout.slice(0, 400));
  process.exit(1);
}

// Step 2: Plant bad — rewrite the Versjon line in index.html to a divergent version.
const bad = ORIGINAL.replace(/Versjon\s+\d+\.\d+\.\d+/, 'Versjon 9.9.9');
if (bad === ORIGINAL) {
  console.error('FAIL: could not plant — no `Versjon X.Y.Z` line found in original index.html.');
  process.exit(1);
}
fs.writeFileSync(PLANT_TARGET, bad, 'utf8');

const badRun = runGate();
const badDetected = (badRun.status === 1) &&
  badRun.stderr.includes('backend/public/index.html') &&
  /drift|FAIL/i.test(badRun.stderr) &&
  badRun.stderr.includes('9.9.9');
if (!badDetected) {
  console.error('FAIL: gate did not flag the planted version drift in backend/public/index.html.');
  console.error('  exit:', badRun.status);
  console.error('  stderr:', badRun.stderr.slice(0, 800));
  console.error('  Gate may be silently permissive.');
  cleanup();
  process.exit(1);
}

// Step 3: Plant good (restore) — gate must exit 0 again.
fs.writeFileSync(PLANT_TARGET, ORIGINAL, 'utf8');
const goodRun = runGate();
if (goodRun.status !== 0) {
  console.error('FAIL: gate flagged a clean (restored) state — gate is too strict.');
  console.error('  exit:', goodRun.status);
  console.error('  stderr:', goodRun.stderr.slice(0, 800));
  cleanup();
  process.exit(1);
}

cleanup();
console.log('PASS: self-test confirms gate fires on planted drift in backend/public/index.html and passes on aligned state.');
process.exit(0);
