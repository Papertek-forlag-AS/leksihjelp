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

console.log('OK — network-silence gate correctly detected and recovered from planted fetch().');
process.exit(0);
