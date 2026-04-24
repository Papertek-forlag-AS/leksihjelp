#!/usr/bin/env node
/**
 * Self-test for scripts/check-benchmark-coverage.js (INFRA-08 gate).
 *
 * 1. Broken scenario: Creates a temp expectations.json with a fake entry
 *    pointing to a nonexistent rule. Asserts the gate exits 1.
 * 2. Well-formed scenario: Restores the real expectations.json (empty entries).
 *    Asserts the gate exits 0.
 *
 * Usage:
 *   node scripts/check-benchmark-coverage.test.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-benchmark-coverage.js');
const EXPECTATIONS_PATH = path.join(ROOT, 'benchmark-texts', 'expectations.json');

// Save original expectations.json content
const originalContent = fs.readFileSync(EXPECTATIONS_PATH, 'utf8');

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  // Restore original expectations.json
  try { fs.writeFileSync(EXPECTATIONS_PATH, originalContent, 'utf8'); } catch (_) { /* best-effort */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

// Step 1: Plant a BROKEN expectations.json with a fake entry
// Use nb.99999 — line 99999 doesn't exist, and rule "nonexistent-rule" won't fire.
const brokenManifest = {
  _doc: 'Temporary broken manifest for self-test',
  entries: {
    'nb.99999': {
      rule_id: 'nonexistent-rule',
      severity: 'error',
      priority_band: 'P1',
    },
  },
};
fs.writeFileSync(EXPECTATIONS_PATH, JSON.stringify(brokenManifest, null, 2), 'utf8');

const brokenRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
if (brokenRun.status !== 1) {
  console.error('FAIL: gate did not exit 1 on broken expectation (nb.99999 with nonexistent rule).');
  console.error('  exit status:', brokenRun.status);
  console.error('  stdout:', (brokenRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (brokenRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 2: Restore real expectations.json (empty entries) — gate should exit 0
fs.writeFileSync(EXPECTATIONS_PATH, originalContent, 'utf8');

const goodRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
if (goodRun.status !== 0) {
  console.error('FAIL: gate did not exit 0 on valid (empty) expectations.');
  console.error('  exit status:', goodRun.status);
  console.error('  stdout:', (goodRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (goodRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 3: Confirm cleanup
cleanup();
cleanedUp = false; // Allow exit handler to run again if needed

// Verify the file is restored
const restored = fs.readFileSync(EXPECTATIONS_PATH, 'utf8');
if (restored !== originalContent) {
  console.error('FAIL: expectations.json was not restored to original content');
  fs.writeFileSync(EXPECTATIONS_PATH, originalContent, 'utf8');
  process.exit(1);
}

console.log('PASS: self-test confirms gate correctly rejects broken expectations (exit 1) and accepts empty expectations (exit 0).');
process.exit(0);
