#!/usr/bin/env node
/**
 * Paired self-test for check-pedagogy-id-coverage.js.
 *
 * Plants an orphan pedagogy id in extension/data/de.json (no matching
 * rule and not in ALLOWLIST), confirms the gate fires; restores the file,
 * confirms the gate passes. Mirrors the pattern from
 * check-pedagogy-shape.test.js / check-popup-deps.test.js — backup +
 * try/finally restore, signal-safe.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'extension/data/de.json');
const GATE = path.join(__dirname, 'check-pedagogy-id-coverage.js');

function runGate() {
  try {
    execFileSync('node', [GATE], { stdio: 'pipe' });
    return { code: 0 };
  } catch (e) {
    return { code: e.status || 1, stderr: (e.stderr || Buffer.from('')).toString() };
  }
}

function main() {
  const original = fs.readFileSync(DATA_FILE, 'utf8');

  // Restore on any signal.
  const restore = () => {
    try { fs.writeFileSync(DATA_FILE, original); } catch (_) {}
  };
  process.on('SIGINT', () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });

  let failures = 0;
  try {
    // Step 1: clean baseline passes.
    const baseline = runGate();
    if (baseline.code !== 0) {
      console.error('[test] FAIL: baseline gate run did not pass (exit ' + baseline.code + ')');
      console.error(baseline.stderr || '');
      failures++;
    } else {
      console.log('[test] OK: baseline gate passes on clean data.');
    }

    // Step 2: plant an orphan id, gate must fail.
    const data = JSON.parse(original);
    if (!data.grammarbank) data.grammarbank = {};
    if (!data.grammarbank.pedagogy) data.grammarbank.pedagogy = {};
    data.grammarbank.pedagogy['de-bogus-rule-id-for-test'] = {
      note: { nb: 'x', nn: 'x', en: 'x' },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    const planted = runGate();
    if (planted.code === 0) {
      console.error('[test] FAIL: gate did not fire on planted orphan id.');
      failures++;
    } else if (!/de-bogus-rule-id-for-test/.test(planted.stderr || '')) {
      console.error('[test] FAIL: gate fired but did not name the orphan id.');
      console.error(planted.stderr || '');
      failures++;
    } else {
      console.log('[test] OK: gate fires on planted orphan id.');
    }
  } finally {
    restore();
  }

  // Step 3: confirm restore returned to baseline.
  const after = runGate();
  if (after.code !== 0) {
    console.error('[test] FAIL: gate failing after restore — file may be dirty.');
    console.error(after.stderr || '');
    failures++;
  } else {
    console.log('[test] OK: gate passes after restore.');
  }

  if (failures > 0) {
    console.error('[test] FAIL: ' + failures + ' assertion(s) failed.');
    process.exit(1);
  }
  console.log('[test] PASS: paired self-test green.');
}

main();
