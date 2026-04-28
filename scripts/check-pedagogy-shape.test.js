#!/usr/bin/env node
/**
 * Self-test for scripts/check-pedagogy-shape.js (PED-06 gate).
 *
 * Plants scratch rule files inside extension/content/spell-rules/ that emit
 * findings carrying pedagogy blocks of varying shapes, and asserts the gate
 * fires on broken shapes and passes on well-formed ones. Mirrors
 * check-explain-contract.test.js plant/run/restore lifecycle.
 *
 * Test-plant strategy: instead of mutating the gate's TARGETS source we use
 * the LEXI_PEDAGOGY_GATE_EXTRA_TARGETS env hook the gate exposes. This keeps
 * the gate file byte-identical between baseline and planted runs, and avoids
 * the regex-replace fragility of the explain-contract self-test.
 *
 * Steps:
 *   1. Plant BROKEN scratch (case === 'wechselpräposition', a typo). Run gate
 *      with EXTRA_TARGETS=that-file. Assert exit code 1, stderr mentions
 *      PEDAGOGY_BAD_CASE.
 *   2. Plant another BROKEN scratch (missing summary.nn). Run, assert exit 1
 *      and PEDAGOGY_BAD_SUMMARY.
 *   3. Plant WELL-FORMED scratch (full akkusativ block + examples). Run,
 *      assert exit code 0.
 *   4. Cleanup all scratch files in finally.
 *
 * Usage:
 *   node scripts/check-pedagogy-shape.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-pedagogy-shape.js');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const SCRATCH = path.join(SPELL_RULES_DIR, '_test-scratch-pedagogy.js');
const SCRATCH_REL = path.relative(ROOT, SCRATCH);

// Scratch rule body builder — emits a single finding carrying `pedagogy`.
function scratchBody(pedagogyLiteral) {
  return `'use strict';
// Test scratch for check-pedagogy-shape.test.js — DO NOT SHIP.
const rule = {
  id: 'scratch-pedagogy',
  languages: ['de'],
  priority: 99,
  severity: 'error',
  explain: (f) => ({ nb: 'x', nn: 'x' }),
  check(ctx) {
    return [{
      rule_id: 'scratch-pedagogy',
      priority: 99,
      original: 'durch',
      fix: 'durch',
      start: 0,
      end: 5,
      message: 'test',
      pedagogy: ${pedagogyLiteral},
    }];
  },
};
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
host.__lexiSpellRules.push(rule);
if (typeof module !== 'undefined' && module.exports) module.exports = rule;
`;
}

// Pedagogy literals (as JS source, not JSON — the scratch evaluates them).
const PED_BAD_CASE = `{
  case: 'wechselpräposition',
  summary:     { nb: 'A', nn: 'A', en: 'A' },
  explanation: { nb: 'B', nn: 'B', en: 'B' },
}`;

const PED_BAD_SUMMARY = `{
  case: 'akkusativ',
  summary:     { nb: 'A', nn: '', en: 'A' },
  explanation: { nb: 'B', nn: 'B', en: 'B' },
}`;

const PED_WELL_FORMED = `{
  case: 'akkusativ',
  summary:     { nb: 'Akkusativ', nn: 'Akkusativ', en: 'Accusative' },
  explanation: { nb: 'durch tar akkusativ.', nn: 'durch tek akkusativ.', en: 'durch takes accusative.' },
  examples: [
    {
      correct: 'durch die Schule',
      incorrect: 'durch der Schule',
      translation: { nb: 'gjennom skolen', nn: 'gjennom skulen', en: 'through the school' },
    },
  ],
}`;

const PED_WECHSEL_MISSING_PAIR = `{
  case: 'wechsel',
  summary:     { nb: 'Wechsel', nn: 'Wechsel', en: 'Two-way' },
  explanation: { nb: 'X', nn: 'X', en: 'X' },
}`;

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (fs.existsSync(SCRATCH)) {
    try { fs.unlinkSync(SCRATCH); } catch (_) { /* best-effort */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

function runGate() {
  const res = spawnSync(process.execPath, [GATE], {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, {
      LEXI_PEDAGOGY_GATE_EXTRA_TARGETS: SCRATCH_REL,
    }),
  });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

function plantAndRun(label, body, expectExit, expectStderrSubstring) {
  if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
  fs.writeFileSync(SCRATCH, body, 'utf8');
  cleanedUp = false;
  const run = runGate();
  if (run.status !== expectExit) {
    console.error('FAIL [' + label + ']: gate exit was ' + run.status + ', expected ' + expectExit);
    console.error('  stderr:', run.stderr.slice(0, 500));
    console.error('  stdout:', run.stdout.slice(0, 500));
    cleanup();
    process.exit(1);
  }
  if (expectStderrSubstring && !run.stderr.includes(expectStderrSubstring)) {
    console.error('FAIL [' + label + ']: gate stderr did not include ' + JSON.stringify(expectStderrSubstring));
    console.error('  stderr:', run.stderr.slice(0, 500));
    cleanup();
    process.exit(1);
  }
}

if (!fs.existsSync(SPELL_RULES_DIR)) {
  console.error('FAIL: extension/content/spell-rules/ does not exist — cannot plant scratch');
  process.exit(1);
}

// Lingering scratch from a previous aborted run.
if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);

// Step 1: bad case enum → exit 1, PEDAGOGY_BAD_CASE.
plantAndRun(
  'bad-case',
  scratchBody(PED_BAD_CASE),
  1,
  'PEDAGOGY_BAD_CASE'
);

// Step 2: missing summary.nn → exit 1, PEDAGOGY_BAD_SUMMARY.
plantAndRun(
  'bad-summary',
  scratchBody(PED_BAD_SUMMARY),
  1,
  'PEDAGOGY_BAD_SUMMARY'
);

// Step 3: case=wechsel without wechsel_pair → exit 1, PEDAGOGY_MISSING_WECHSEL_PAIR.
plantAndRun(
  'wechsel-missing-pair',
  scratchBody(PED_WECHSEL_MISSING_PAIR),
  1,
  'PEDAGOGY_MISSING_WECHSEL_PAIR'
);

// Step 4: well-formed pedagogy → exit 0.
plantAndRun(
  'well-formed',
  scratchBody(PED_WELL_FORMED),
  0,
  null
);

cleanup();

if (fs.existsSync(SCRATCH)) {
  console.error('FAIL: scratch file still on disk after cleanup');
  process.exit(1);
}

console.log('[check-pedagogy-shape:test] PASS: gate correctly distinguishes broken-case, broken-summary, missing-wechsel-pair (exit 1) and well-formed (exit 0) pedagogy blocks.');
process.exit(0);
