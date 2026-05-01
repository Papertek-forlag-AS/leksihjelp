#!/usr/bin/env node
/**
 * Self-test for scripts/check-vocab-seam-coverage.js (INFRA-10 gate).
 *
 * Three scenarios, each guarded by try/finally with backup-then-restore so
 * a crashed self-test never corrupts the source tree:
 *
 *   A. Plant a scratch index in vocab-seam-core.js's buildIndexes return
 *      literal WITHOUT matching seam getter / consumer entry. Gate MUST
 *      exit 1 and mention the scratch key + both file paths.
 *
 *   B. Plant the same scratch index AND wire the matching getter in
 *      vocab-seam.js AND the matching entry in spell-check.js. Gate MUST
 *      exit 0.
 *
 *   C. No mutation. Gate MUST exit 0 (HEAD must be clean).
 *
 * On all-pass: prints success line and exits 0. On any failure: prints
 * the failing scenario name + observed status/output and exits 1.
 *
 * Mirrors check-explain-contract.test.js's belt-and-braces shape: planted
 * positive → gate fires; planted then closed → gate passes; clean head →
 * gate passes. Belt-and-braces against a regex-drift / shape-check bypass
 * making the gate silently permissive.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-vocab-seam-coverage.js');
const CORE_PATH       = path.join(ROOT, 'extension/content/vocab-seam-core.js');
const SEAM_PATH       = path.join(ROOT, 'extension/content/vocab-seam.js');
const SPELLCHECK_PATH = path.join(ROOT, 'extension/content/spell-check.js');

const SCRATCH_KEY = '__scratchSeamCoverageProbe';
const SCRATCH_GETTER = 'get__scratchSeamCoverageProbe';
// Default toGetter in the gate produces `get` + key[0].toUpperCase() + key.slice(1).
// For key `__scratchSeamCoverageProbe`, key[0] is `_` (toUpperCase no-op) →
// `get__scratchSeamCoverageProbe`. Mirror exactly.

function readFile(p) { return fs.readFileSync(p, 'utf8'); }
function writeFile(p, s) { fs.writeFileSync(p, s, 'utf8'); }

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

// Inject `__scratchSeamCoverageProbe: new Map(),` immediately before the
// closing `};` of the LAST `return {` block in vocab-seam-core.js. The
// gate's parser will pick it up as a buildIndexes return key.
function injectScratchIntoCore(coreSrc) {
  // Locate `predictCompound: (partial) => ...` (the last entry today) and
  // insert just before its trailing `};`. We find the final `};` after
  // `predictCompound`.
  const anchor = coreSrc.lastIndexOf('predictCompound:');
  if (anchor < 0) {
    throw new Error('self-test: anchor `predictCompound:` not found in vocab-seam-core.js');
  }
  // Find the next `};` at depth-0 after the anchor — it terminates the return.
  // Naive: search for `\n    };` (4-space indent + closing). The buildIndexes
  // return uses 6-space indent for body lines but the closing `};` is at
  // 4-space (the function-body level).
  const closeIdx = coreSrc.indexOf('\n    };', anchor);
  if (closeIdx < 0) {
    throw new Error('self-test: could not find return-literal closing `};` after predictCompound');
  }
  const inject = '      ' + SCRATCH_KEY + ': new Map(),\n';
  return coreSrc.substring(0, closeIdx + 1) + inject + coreSrc.substring(closeIdx + 1);
}

// Inject the matching seam getter just before the closing `};` of the
// `self.__lexiVocab = { ... };` literal.
function injectScratchIntoSeam(seamSrc) {
  // Locate `isFeatureEnabled:` (the last entry on __lexiVocab today). Insert
  // before the closing `};` after it.
  const anchor = seamSrc.lastIndexOf('isFeatureEnabled:');
  if (anchor < 0) {
    throw new Error('self-test: anchor `isFeatureEnabled:` not found in vocab-seam.js');
  }
  // Closing `};` indented by 2 (matches the IIFE pattern) — search for `\n  };`.
  const closeIdx = seamSrc.indexOf('\n  };', anchor);
  if (closeIdx < 0) {
    throw new Error('self-test: could not find __lexiVocab closing `};` after isFeatureEnabled');
  }
  const inject = '    ' + SCRATCH_GETTER + ': () => new Map(),\n';
  return seamSrc.substring(0, closeIdx + 1) + inject + seamSrc.substring(closeIdx + 1);
}

// Inject the matching consumer entry just before the closing `};` of the
// `const vocab = { ... };` literal in spell-check.js's runCheck().
function injectScratchIntoConsumer(consumerSrc) {
  // Locate `frAspectPedagogy:` (last entry on the vocab literal) and insert
  // before the closing `};`.
  const anchor = consumerSrc.indexOf('frAuxPresensForms:');
  // Fall back to frAspectPedagogy if frAuxPresensForms not present (i.e.
  // the gate ran before Plan 36-02 wired the FR mood-aspect indexes).
  const safeAnchor = anchor >= 0 ? anchor : consumerSrc.indexOf('frAspectPedagogy:');
  if (safeAnchor < 0) {
    throw new Error('self-test: anchor `frAuxPresensForms:` / `frAspectPedagogy:` not found in spell-check.js');
  }
  const closeIdx = consumerSrc.indexOf('\n    };', safeAnchor);
  if (closeIdx < 0) {
    throw new Error('self-test: could not find runCheck() vocab closing `};`');
  }
  const inject = '      ' + SCRATCH_KEY + ': VOCAB.' + SCRATCH_GETTER + '(),\n';
  return consumerSrc.substring(0, closeIdx + 1) + inject + consumerSrc.substring(closeIdx + 1);
}

function scenarioA() {
  const coreBackup = readFile(CORE_PATH);
  try {
    const mutated = injectScratchIntoCore(coreBackup);
    if (mutated === coreBackup) throw new Error('Scenario A: core injection no-op');
    writeFile(CORE_PATH, mutated);

    const result = runGate();
    const fired = (result.status === 1) &&
      result.stderr.includes(SCRATCH_KEY) &&
      result.stderr.includes('vocab-seam.js') &&
      result.stderr.includes('spell-check.js');
    if (!fired) {
      console.error('FAIL Scenario A: gate did not fire on planted core-only gap.');
      console.error('  exit status:', result.status);
      console.error('  stderr:', result.stderr.slice(0, 800));
      console.error('  stdout:', result.stdout.slice(0, 400));
      return false;
    }
    return true;
  } finally {
    writeFile(CORE_PATH, coreBackup);
  }
}

function scenarioB() {
  const coreBackup = readFile(CORE_PATH);
  const seamBackup = readFile(SEAM_PATH);
  const consumerBackup = readFile(SPELLCHECK_PATH);
  try {
    const coreMutated = injectScratchIntoCore(coreBackup);
    const seamMutated = injectScratchIntoSeam(seamBackup);
    const consumerMutated = injectScratchIntoConsumer(consumerBackup);
    if (coreMutated === coreBackup) throw new Error('Scenario B: core injection no-op');
    if (seamMutated === seamBackup) throw new Error('Scenario B: seam injection no-op');
    if (consumerMutated === consumerBackup) throw new Error('Scenario B: consumer injection no-op');

    writeFile(CORE_PATH, coreMutated);
    writeFile(SEAM_PATH, seamMutated);
    writeFile(SPELLCHECK_PATH, consumerMutated);

    const result = runGate();
    if (result.status !== 0) {
      console.error('FAIL Scenario B: gate did not pass after gap closed.');
      console.error('  exit status:', result.status);
      console.error('  stderr:', result.stderr.slice(0, 800));
      console.error('  stdout:', result.stdout.slice(0, 400));
      return false;
    }
    return true;
  } finally {
    writeFile(CORE_PATH, coreBackup);
    writeFile(SEAM_PATH, seamBackup);
    writeFile(SPELLCHECK_PATH, consumerBackup);
  }
}

function scenarioC() {
  // Pure pass-through: HEAD must be clean.
  const result = runGate();
  if (result.status !== 0) {
    console.error('FAIL Scenario C: clean HEAD does not pass the gate.');
    console.error('  exit status:', result.status);
    console.error('  stderr:', result.stderr.slice(0, 800));
    console.error('  stdout:', result.stdout.slice(0, 400));
    return false;
  }
  return true;
}

function main() {
  const okA = scenarioA();
  const okB = scenarioB();
  const okC = scenarioC();
  if (okA && okB && okC) {
    console.log('check-vocab-seam-coverage:test: PASS — 3/3 scenarios green');
    process.exit(0);
  }
  process.exit(1);
}

// Always restore source tree on uncaught throw — defence in depth on top of
// each scenario's own try/finally.
process.on('uncaughtException', (e) => {
  console.error('uncaughtException in self-test:', e && e.stack || e);
  process.exit(1);
});

main();
