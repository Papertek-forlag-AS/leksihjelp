#!/usr/bin/env node

/**
 * Leksihjelp — Bundle-size gate + minification TDD harness (Plan 02-04 Task 1)
 *
 * Runs behavior tests from 02-04-PLAN.md Task 1. Each test is a small shell +
 * Node probe that either passes (silently) or throws with a readable error.
 *
 * Exit codes:
 *   0 — all tests passed
 *   1 — any test failed
 *
 * Zero npm deps. Node 18+. CommonJS. Matches the style of scripts/check-fixtures.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT, 'backend', 'public', 'lexi-extension.zip');
// Phase 23-05: nb.json deleted; nb-baseline.json is the sole bundled vocab file
const SOURCE_NB_JSON = path.join(ROOT, 'extension', 'data', 'nb-baseline.json');
const PACKAGE_HELPER = path.join(ROOT, 'scripts', 'package-extension.js');
const GATE_SCRIPT = path.join(ROOT, 'scripts', 'check-bundle-size.js');
const CEILING_BYTES = 20 * 1024 * 1024;

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log('  PASS  ' + name);
  } catch (err) {
    failures++;
    console.log('  FAIL  ' + name);
    console.log('        ' + err.message);
  }
}

function run(cmd, opts) {
  return execSync(cmd, Object.assign({ cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts || {}));
}

console.log('check-bundle-size.test.js — Plan 02-04 Task 1 behavior tests\n');

test('Script files exist on disk', () => {
  if (!fs.existsSync(PACKAGE_HELPER)) throw new Error('missing scripts/package-extension.js');
  if (!fs.existsSync(GATE_SCRIPT)) throw new Error('missing scripts/check-bundle-size.js');
});

test('package.json delegates package + registers check-bundle-size', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (pkg.scripts.package !== 'node scripts/package-extension.js') {
    throw new Error('package script is not "node scripts/package-extension.js" (got: ' + pkg.scripts.package + ')');
  }
  if (pkg.scripts['check-bundle-size'] !== 'node scripts/check-bundle-size.js') {
    throw new Error('check-bundle-size script missing or wrong (got: ' + pkg.scripts['check-bundle-size'] + ')');
  }
});

test('.gitignore contains .package-staging/', () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  if (!/\.package-staging\/?/.test(gi)) throw new Error('.package-staging/ not in .gitignore');
});

test('npm run package produces the zip', () => {
  // Remove any stale zip so we measure THIS run's output
  if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);
  run('npm run package', { stdio: 'pipe' });
  if (!fs.existsSync(ZIP_PATH)) throw new Error('zip was not produced at ' + ZIP_PATH);
});

test('Test 1 (behavior): data/*.json inside zip are minified', () => {
  // Phase 23-05: nb.json deleted; check nb-baseline.json (sole bundled vocab)
  const head = run("unzip -p '" + ZIP_PATH + "' data/nb-baseline.json | head -c 400");
  if (head.includes('\n')) {
    throw new Error('data/nb-baseline.json in zip contains newlines — minification did not apply. Head was:\n' + head);
  }
  if (!head.startsWith('{')) throw new Error('zip data/nb-baseline.json does not start with `{` — got: ' + head.slice(0, 50));
});

test('Test 2 (behavior): minified JSON in zip parses correctly', () => {
  const body = run("unzip -p '" + ZIP_PATH + "' data/nb-baseline.json");
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== 'object') throw new Error('parsed body is not an object');
  } catch (err) {
    throw new Error('JSON.parse failed on zip data/nb-baseline.json: ' + err.message);
  }
});

test('Test 6 (source-tree invariant): extension/data/nb-baseline.json is valid JSON on disk', () => {
  // Phase 23-05: nb-baseline.json may be minified (compact for 200 KB cap) or
  // pretty-printed — either is valid. The invariant is that the file exists and
  // parses correctly.
  const src = fs.readFileSync(SOURCE_NB_JSON, 'utf8');
  try {
    const parsed = JSON.parse(src);
    if (!parsed || typeof parsed !== 'object') throw new Error('parsed body is not an object');
  } catch (err) {
    throw new Error('SOURCE extension/data/nb-baseline.json does not parse as JSON: ' + err.message);
  }
});

test('Test 3 (behavior): check-bundle-size runs end-to-end and reports honestly', () => {
  // Both exit 0 and exit 1 are valid for this plan. What must hold:
  //   - the script runs without throwing (i.e., it completes and prints a result)
  //   - stdout includes PASS or FAIL
  //   - stdout includes a byte count
  //   - exit code is consistent with the reported bytes vs cap
  const result = spawnSync('node', [GATE_SCRIPT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const combined = (result.stdout || '') + (result.stderr || '');
  if (result.status !== 0 && result.status !== 1) {
    throw new Error('check-bundle-size exited with unexpected code ' + result.status + '. Output:\n' + combined);
  }
  const sawPassOrFail = /\b(PASS|FAIL)\b/.test(combined);
  if (!sawPassOrFail) throw new Error('check-bundle-size output missing PASS/FAIL marker. Got:\n' + combined);
  const sawBytes = /\d[\d,]+\s*bytes/.test(combined);
  if (!sawBytes) throw new Error('check-bundle-size output missing byte count. Got:\n' + combined);
});

test('Test 4/5 (behavior): exit code matches reported bytes vs 20 MiB cap', () => {
  const size = fs.statSync(ZIP_PATH).size;
  const result = spawnSync('node', [GATE_SCRIPT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (size <= CEILING_BYTES && result.status !== 0) {
    throw new Error('zip is under cap (' + size + ' bytes) but exit was ' + result.status);
  }
  if (size > CEILING_BYTES && result.status !== 1) {
    throw new Error('zip is over cap (' + size + ' bytes) but exit was ' + result.status);
  }
});

test('Test 5 (behavior): per-directory breakdown is printed', () => {
  const result = spawnSync('node', [GATE_SCRIPT], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const combined = (result.stdout || '') + (result.stderr || '');
  // Must contain a breakdown line — we expect directory names like data/, audio/, content/, etc.
  const sawBreakdown = /^\s*[A-Za-z][A-Za-z0-9_\-]*\/[^\S\r\n]+[\d,]+/m.test(combined);
  if (!sawBreakdown) {
    throw new Error('no per-directory byte breakdown in output. Got:\n' + combined);
  }
});

if (failures > 0) {
  console.log('\n' + failures + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll behavior tests passed');
process.exit(0);
