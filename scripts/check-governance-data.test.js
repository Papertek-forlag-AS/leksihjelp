#!/usr/bin/env node
/**
 * Self-test for scripts/check-governance-data.js (INFRA-09 gate).
 *
 * 1. Baseline scenario: Current repo state has no governance banks in data files.
 *    Assert the gate exits 0 (pass-through on no data).
 * 2. Broken scenario: Create a temporary data file with a malformed registerbank
 *    (entries missing required "word" field). Assert the gate exits 1.
 * 3. Well-formed scenario: Create a temp data file with valid bank shapes.
 *    Assert the gate exits 0.
 *
 * Uses a wrapper approach: the gate reads extension/data/*.json, so we create
 * a temporary test-governance.json and modify the gate source to include it.
 *
 * Usage:
 *   node scripts/check-governance-data.test.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-governance-data.js');
const DATA_DIR = path.join(ROOT, 'extension', 'data');
const SCRATCH_FILE = path.join(DATA_DIR, 'test-governance.json');

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (fs.existsSync(SCRATCH_FILE)) {
    try { fs.unlinkSync(SCRATCH_FILE); } catch (_) { /* best-effort */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

// Helper: run the gate with a modified LANGUAGES list that includes our test language
function runGateWithLanguage(testLang) {
  const gateSrc = fs.readFileSync(GATE, 'utf8');
  // Replace LANGUAGES to include only our test language
  let injected = gateSrc.replace(
    /const LANGUAGES = \[[\s\S]*?\];/,
    "const LANGUAGES = ['" + testLang + "'];"
  );
  if (injected === gateSrc) {
    throw new Error('self-test: could not rewrite LANGUAGES in gate source');
  }
  // Pin ROOT
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

// Make sure no lingering scratch from a previous aborted run
if (fs.existsSync(SCRATCH_FILE)) fs.unlinkSync(SCRATCH_FILE);

// Step 1: Baseline — no governance banks in current data = exit 0
const baselineRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
if (baselineRun.status !== 0) {
  console.error('FAIL: gate did not exit 0 on baseline (no governance data in current repo).');
  console.error('  exit status:', baselineRun.status);
  console.error('  stdout:', (baselineRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (baselineRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 2: Plant BROKEN data — registerbank with missing "word" field
const brokenData = {
  _metadata: { language: 'test-governance', languageName: 'Test' },
  registerbank: {
    bad_entry_1: { formal: 'something' },
    bad_entry_2: { formal: 'another' },
  },
};
fs.writeFileSync(SCRATCH_FILE, JSON.stringify(brokenData, null, 2), 'utf8');

const brokenRun = runGateWithLanguage('test-governance');
if (brokenRun.status !== 1) {
  console.error('FAIL: gate did not exit 1 on broken registerbank (missing "word" field).');
  console.error('  exit status:', brokenRun.status);
  console.error('  stdout:', (brokenRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (brokenRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 3: Plant WELL-FORMED data — all required fields present
const goodData = {
  _metadata: { language: 'test-governance', languageName: 'Test' },
  registerbank: {
    good_entry_1: { word: 'test', formal: 'formelt' },
  },
  collocationbank: {
    good_entry_2: { trigger: 'ta med', fix: 'ta med seg' },
  },
  phrasebank: {
    good_entry_3: { trigger: 'i forhold til', suggestion: 'sammenlignet med' },
  },
};
fs.writeFileSync(SCRATCH_FILE, JSON.stringify(goodData, null, 2), 'utf8');

const goodRun = runGateWithLanguage('test-governance');
cleanup();

if (goodRun.status !== 0) {
  console.error('FAIL: gate did not exit 0 on well-formed governance banks.');
  console.error('  exit status:', goodRun.status);
  console.error('  stdout:', (goodRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (goodRun.stderr || '').slice(0, 500));
  process.exit(1);
}

// Step 4: Verify scratch is cleaned up
if (fs.existsSync(SCRATCH_FILE)) {
  console.error('FAIL: scratch file still on disk after cleanup');
  fs.unlinkSync(SCRATCH_FILE);
  process.exit(1);
}

console.log('PASS: self-test confirms gate rejects broken bank shape (exit 1), accepts valid banks (exit 0), and passes on no-data baseline (exit 0).');
process.exit(0);
