#!/usr/bin/env node
/**
 * Self-test for scripts/check-baseline-bundle-size.js (GATES-02 gate).
 *
 * Phase A: plant an oversized baseline (>200 KB). Run gate. Assert exit 1.
 * Phase B: plant a small well-formed baseline (~5 KB). Run gate. Assert exit 0.
 * Phase C: ensure the baseline file is absent. Run gate. Assert exit 0
 *          (the "skipped — baseline not built" branch).
 *
 * Backs up the real baseline file on disk (if any) and restores it in
 * try/finally so an aborted test never leaves the repo in a broken state.
 *
 * Mirrors the structure of check-explain-contract.test.js and
 * check-rule-css-wiring.test.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-baseline-bundle-size.js');
const BASELINE_DIR = path.join(ROOT, 'extension/data');
const BASELINE_PATH = path.join(BASELINE_DIR, 'nb-baseline.json');
const BACKUP_PATH = path.join(BASELINE_DIR, 'nb-baseline.json.self-test-backup');

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

let originalExisted = false;
let cleanedUp = false;

function backupOriginal() {
  if (fs.existsSync(BASELINE_PATH)) {
    originalExisted = true;
    fs.renameSync(BASELINE_PATH, BACKUP_PATH);
  }
}

function restoreOriginal() {
  if (cleanedUp) return;
  cleanedUp = true;
  try {
    if (fs.existsSync(BASELINE_PATH)) fs.unlinkSync(BASELINE_PATH);
  } catch (_) { /* best-effort */ }
  try {
    if (originalExisted && fs.existsSync(BACKUP_PATH)) {
      fs.renameSync(BACKUP_PATH, BASELINE_PATH);
    }
  } catch (e) {
    console.error('WARN: could not restore original nb-baseline.json:', e.message);
  }
}

process.on('exit', restoreOriginal);
process.on('SIGINT', () => { restoreOriginal(); process.exit(130); });
process.on('uncaughtException', (e) => { restoreOriginal(); console.error(e); process.exit(1); });

// Make sure extension/data/ exists.
if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
}

try {
  backupOriginal();

  // ---- Phase A: oversized baseline (250 KB) — gate must fire (exit 1) ----
  // Build a 250 KB JSON file. Use a single padding string so the file is
  // valid JSON yet comfortably over the 200 KB cap.
  const padding = 'x'.repeat(250 * 1024 - 32);
  const oversized = JSON.stringify({ pad: padding });
  fs.writeFileSync(BASELINE_PATH, oversized, 'utf8');
  const oversizedRun = runGate();
  if (oversizedRun.status !== 1) {
    console.error('FAIL Phase A: gate did not fire on a 250 KB baseline.');
    console.error('  exit status:', oversizedRun.status);
    console.error('  stdout:', oversizedRun.stdout);
    console.error('  stderr:', oversizedRun.stderr);
    process.exit(1);
  }
  if (!/FAIL/.test(oversizedRun.stdout) && !/FAIL/.test(oversizedRun.stderr)) {
    console.error('FAIL Phase A: gate exit code was 1 but output did not contain "FAIL" marker.');
    console.error('  stdout:', oversizedRun.stdout);
    process.exit(1);
  }
  fs.unlinkSync(BASELINE_PATH);

  // ---- Phase B: small (5 KB) well-formed baseline — gate must pass (exit 0) ----
  const small = JSON.stringify({ pad: 'x'.repeat(5 * 1024) });
  fs.writeFileSync(BASELINE_PATH, small, 'utf8');
  const smallRun = runGate();
  if (smallRun.status !== 0) {
    console.error('FAIL Phase B: gate did not pass on a 5 KB baseline.');
    console.error('  exit status:', smallRun.status);
    console.error('  stdout:', smallRun.stdout);
    console.error('  stderr:', smallRun.stderr);
    process.exit(1);
  }
  if (!/PASS/.test(smallRun.stdout)) {
    console.error('FAIL Phase B: gate exit code was 0 but output did not contain "PASS" marker.');
    console.error('  stdout:', smallRun.stdout);
    process.exit(1);
  }
  fs.unlinkSync(BASELINE_PATH);

  // ---- Phase C: baseline absent — gate must skip (exit 0) ----
  // The file is already absent (we removed it above and the original was
  // backed up). Confirm and run.
  if (fs.existsSync(BASELINE_PATH)) {
    console.error('FAIL Phase C precondition: baseline still on disk after cleanup.');
    process.exit(1);
  }
  const skipRun = runGate();
  if (skipRun.status !== 0) {
    console.error('FAIL Phase C: gate did not exit 0 when baseline absent.');
    console.error('  exit status:', skipRun.status);
    console.error('  stdout:', skipRun.stdout);
    console.error('  stderr:', skipRun.stderr);
    process.exit(1);
  }
  if (!/SKIP/.test(skipRun.stdout)) {
    console.error('FAIL Phase C: gate exit code was 0 but output did not contain "SKIP" marker.');
    console.error('  stdout:', skipRun.stdout);
    process.exit(1);
  }
} finally {
  restoreOriginal();
}

console.log('PASS — check-baseline-bundle-size correctly fires on oversized (250 KB),');
console.log('passes on well-formed (5 KB), and skips when baseline is absent.');
process.exit(0);
