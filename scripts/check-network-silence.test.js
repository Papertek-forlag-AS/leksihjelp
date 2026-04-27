#!/usr/bin/env node
/**
 * Self-test for scripts/check-network-silence.js (SC-06 gate).
 *
 * Plants a forbidden pattern in a scratch rule file, asserts the gate fires;
 * removes it, asserts the gate passes. Guards against the gate silently
 * becoming permissive (e.g., regex typo).
 *
 * Plants the scratch file inside extension/content/spell-rules/ if that
 * directory exists; otherwise plants it inside extension/content/ alongside
 * spell-check-core.js (which is in SCAN_TARGETS too — same gate logic
 * applies). This keeps the self-test robust whether the spell-rules/
 * directory has been created yet or not.
 *
 * Phase 23 SC-06 carve-out scenario: also plants a fetch() inside
 * extension/background/vocab-bootstrap.js (the sanctioned bootstrap path,
 * outside the scan set) and asserts the gate STAYS GREEN. This proves the
 * carve-out is real — the gate explicitly does not scan the bootstrap files
 * even when they contain fetch() calls. If a future refactor accidentally
 * adds these files to SCAN_TARGETS / SCAN_DIRS, this scenario fails loud.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-network-silence.js');

// Prefer a scratch file inside spell-rules/ (matches plan intent); if that
// directory does not yet exist, fall back to extension/content/spell-check-rule-scratch.js
// — the gate's collectFiles() walks SCAN_TARGETS as exact files AND SCAN_DIRS
// as wildcards. The scratch file must be picked up either way, so we plant
// it inside one of the SCAN_DIRS subtrees, creating the directory if needed.
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const SCRATCH = path.join(SPELL_RULES_DIR, '_test-scratch.js');

function runGate() {
  try {
    execSync('node ' + JSON.stringify(GATE), { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status || 1;
  }
}

function cleanup() {
  if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
  // Remove spell-rules dir only if WE created it (i.e., it's empty after
  // scratch removal). Don't touch a real spell-rules/ from another plan.
  if (createdDir && fs.existsSync(SPELL_RULES_DIR)) {
    try {
      const remaining = fs.readdirSync(SPELL_RULES_DIR);
      if (remaining.length === 0) fs.rmdirSync(SPELL_RULES_DIR);
    } catch (_) { /* best-effort */ }
  }
}

let createdDir = false;
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// Ensure the scratch file's parent directory exists; remember if we created it
// so cleanup() can remove it without disturbing real future work in spell-rules/.
if (!fs.existsSync(SPELL_RULES_DIR)) {
  fs.mkdirSync(SPELL_RULES_DIR, { recursive: true });
  createdDir = true;
}

// 1. Baseline — gate must pass with no scratch file.
cleanup();
// Re-create dir if cleanup removed it (it would because empty).
if (createdDir && !fs.existsSync(SPELL_RULES_DIR)) {
  fs.mkdirSync(SPELL_RULES_DIR, { recursive: true });
}
const baseline = runGate();
if (baseline !== 0) {
  console.error('FAIL: baseline gate exited', baseline, '— expected 0.');
  cleanup();
  process.exit(1);
}

// 2. Plant a forbidden pattern — gate must fire.
fs.writeFileSync(SCRATCH, "// Test scratch — DO NOT SHIP\nfetch('https://example.com/api');\n", 'utf8');
const withPlant = runGate();
cleanup();
if (withPlant === 0) {
  console.error('FAIL: gate did not detect planted fetch() — gate is broken.');
  process.exit(1);
}

// 3. After cleanup — gate must pass again.
const postCleanup = runGate();
if (postCleanup !== 0) {
  console.error('FAIL: gate still failing after cleanup — something else triggered it.');
  process.exit(1);
}

// 4. Phase 23 SC-06 carve-out — plant a fetch() in the sanctioned bootstrap
// path (extension/background/vocab-bootstrap.js) and assert the gate STAYS
// GREEN. The carve-out is enforced by SCAN_TARGETS/SCAN_DIRS not including
// background/ files. If a future change accidentally pulls them into scan
// scope, this scenario fires loud.
const BOOTSTRAP_DIR = path.join(ROOT, 'extension/background');
const BOOTSTRAP_FILE = path.join(BOOTSTRAP_DIR, 'vocab-bootstrap.js');
let bootstrapDirCreated = false;
let bootstrapFileExisted = false;
let bootstrapOriginal = null;
try {
  if (!fs.existsSync(BOOTSTRAP_DIR)) {
    fs.mkdirSync(BOOTSTRAP_DIR, { recursive: true });
    bootstrapDirCreated = true;
  }
  if (fs.existsSync(BOOTSTRAP_FILE)) {
    bootstrapFileExisted = true;
    bootstrapOriginal = fs.readFileSync(BOOTSTRAP_FILE, 'utf8');
  }
  // Plant a real-looking fetch in the sanctioned path.
  fs.writeFileSync(
    BOOTSTRAP_FILE,
    "// Phase 23 sanctioned bootstrap — fetch() is allowed here by SC-06 carve-out.\n" +
    "fetch('https://www.papertek.no/api/vocab/v1/bundle/nb');\n",
    'utf8'
  );
  const carveoutResult = runGate();
  if (carveoutResult !== 0) {
    console.error('FAIL: gate fired on a fetch() in the sanctioned vocab-bootstrap.js — SC-06 carve-out is broken.');
    console.error('  exit status:', carveoutResult);
    console.error('  Either SCAN_TARGETS / SCAN_DIRS now includes background/ (regression),');
    console.error('  or the whitelist no longer covers vocab-bootstrap. Investigate before shipping.');
    process.exit(1);
  }
} finally {
  // Restore the original bootstrap file (if any) or remove the plant.
  try {
    if (bootstrapFileExisted) {
      fs.writeFileSync(BOOTSTRAP_FILE, bootstrapOriginal, 'utf8');
    } else if (fs.existsSync(BOOTSTRAP_FILE)) {
      fs.unlinkSync(BOOTSTRAP_FILE);
    }
    if (bootstrapDirCreated && fs.existsSync(BOOTSTRAP_DIR)) {
      const remaining = fs.readdirSync(BOOTSTRAP_DIR);
      if (remaining.length === 0) fs.rmdirSync(BOOTSTRAP_DIR);
    }
  } catch (_) { /* best-effort */ }
}

console.log('OK — network-silence gate correctly detected and recovered from planted fetch(),');
console.log('and the SC-06 sanctioned bootstrap carve-out (vocab-bootstrap.js) is enforced.');
process.exit(0);
