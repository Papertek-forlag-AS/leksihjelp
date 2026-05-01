#!/usr/bin/env node
/**
 * Self-test for scripts/check-synced-surface-version.js (Phase 37 / HYG-05).
 *
 * The gate compares `git diff --name-only <tag>..HEAD -- <synced-paths>` —
 * which only sees COMMITTED changes — so a faithful self-test must actually
 * commit a synced-surface change to make the gate fire. To keep that safe we:
 *
 *   1. Save current HEAD sha BEFORE any mutation (BEFORE_SHA).
 *   2. Plant a clearly-marked scratch file at extension/i18n/__scratch-hyg05.json
 *      (the `__scratch-` prefix makes any orphan visually obvious in `git status`).
 *   3. `git add` + `git commit --no-verify` it. The commit lives on HEAD only
 *      for the duration of the bad-plant gate run.
 *   4. Run gate → must exit 1, mention the scratch path, and print the
 *      `[lockdown-resync-needed]` copy-paste hint (couples HYG-06 nudge).
 *   5. Cleanup: `git reset --soft BEFORE_SHA` removes the test commit but
 *      preserves index + working tree (so any unrelated dirty files the user
 *      had before running the test are untouched). Then `git restore --staged`
 *      + unlink the scratch file. NEVER `git reset --hard` — that would
 *      clobber the user's pending changes.
 *   6. Run gate → must exit 0 again (well-formed plant = restored state).
 *
 * Cleanup harness signal-safety: process.on('exit'), SIGINT, and
 * uncaughtException are all wired to a guarded cleanup() that performs the
 * non-destructive soft reset. `cleanedUp` flag prevents double-cleanup
 * races. Per RESEARCH Pitfall 2.
 *
 * Mirrors scripts/check-popup-deps.test.js shape line-for-line.
 *
 * Paired gate: scripts/check-synced-surface-version.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-synced-surface-version.js');
const SCRATCH = path.join(ROOT, 'extension/i18n/__scratch-hyg05.json');
const SCRATCH_REL = 'extension/i18n/__scratch-hyg05.json';

function git(args, opts) {
  return execSync('git ' + args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts || {})).trim();
}
function gitSilent(args) {
  try { execSync('git ' + args, { cwd: ROOT, stdio: 'pipe' }); return true; }
  catch (_) { return false; }
}

// Pre-flight: refuse if a scratch file with our exact name is already present
// (would clobber it on cleanup); refuse if the working tree contains an
// already-committed __scratch-hyg05 in synced paths since the tag.
if (fs.existsSync(SCRATCH)) {
  console.error('FAIL: ' + SCRATCH_REL + ' already exists — refuse to clobber. Remove it manually and re-run.');
  process.exit(1);
}

// Save HEAD sha BEFORE any mutation so cleanup is always safe.
let BEFORE_SHA;
try { BEFORE_SHA = git('rev-parse HEAD'); }
catch (e) {
  console.error('FAIL: cannot resolve HEAD sha.');
  console.error('  ' + e.message);
  process.exit(1);
}

let testCommitMade = false;
let scratchFileWritten = false;
let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  // Step A: if we made a test commit, unwind it with a SOFT reset (preserves
  // working tree + index — so the user's pre-test dirty files are untouched).
  if (testCommitMade) {
    const currentSha = (() => { try { return git('rev-parse HEAD'); } catch (_) { return null; } })();
    if (currentSha && currentSha !== BEFORE_SHA) {
      gitSilent('reset --soft ' + BEFORE_SHA);
    }
  }
  // Step B: unstage the scratch file if it ended up in the index.
  gitSilent('restore --staged ' + SCRATCH_REL);
  // Step C: delete the scratch file from the working tree.
  if (scratchFileWritten || fs.existsSync(SCRATCH)) {
    try { fs.unlinkSync(SCRATCH); } catch (_) { /* best-effort */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

function runGate() {
  const res = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
  return { status: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

// Step 1: Baseline — clean (no synced-surface diff since last tag).
const baseline = runGate();
if (baseline.status !== 0) {
  console.error('FAIL: baseline gate run failed (real state appears to have an unbumped synced-surface change).');
  console.error('  exit:', baseline.status);
  console.error('  stderr:', baseline.stderr.slice(0, 800));
  console.error('  stdout:', baseline.stdout.slice(0, 400));
  process.exit(1);
}

// Step 2: Plant bad — write scratch under a synced path AND commit it so the
// gate's `git diff <tag>..HEAD` query sees it. No version bump → gate must
// FAIL with exit 1.
fs.writeFileSync(SCRATCH, '{"_test": "hyg05-self-test"}\n', 'utf8');
scratchFileWritten = true;
try {
  // Force-add in case .gitignore accidentally swallows it; -- delimits paths.
  git('add -f -- ' + SCRATCH_REL);
  // --no-verify bypasses pre-commit hooks (would slow the test or fire on
  // the scratch filename). --no-gpg-sign avoids signing prompts in dev envs
  // that have commit.gpgsign=true.
  git('-c commit.gpgsign=false commit --no-verify -m "test(hyg05): plant scratch synced-surface file [no-ship]"');
  testCommitMade = true;
} catch (e) {
  console.error('FAIL: could not stage/commit scratch plant.');
  console.error('  ' + e.message);
  cleanup();
  process.exit(1);
}

const badRun = runGate();
const badDetected = (badRun.status === 1) &&
  badRun.stderr.includes(SCRATCH_REL) &&
  badRun.stderr.includes('lockdown-resync-needed') &&
  /FAIL/.test(badRun.stderr);
if (!badDetected) {
  console.error('FAIL: gate did not flag the planted synced-surface change.');
  console.error('  exit:', badRun.status);
  console.error('  stderr:', badRun.stderr.slice(0, 800));
  console.error('  Expected: exit 1, stderr contains "' + SCRATCH_REL + '" + "lockdown-resync-needed" + "FAIL".');
  cleanup();
  process.exit(1);
}

// Step 3: Plant good — undo the commit non-destructively, unstage + delete
// the scratch, then re-run gate.
try {
  git('reset --soft ' + BEFORE_SHA);
  testCommitMade = false;
  gitSilent('restore --staged ' + SCRATCH_REL);
  if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH);
  scratchFileWritten = false;
} catch (e) {
  console.error('FAIL: could not unwind plant commit non-destructively.');
  console.error('  ' + e.message);
  cleanup();
  process.exit(1);
}

const goodRun = runGate();
if (goodRun.status !== 0) {
  console.error('FAIL: gate flagged the restored state — gate is too strict, OR the unwind did not fully restore.');
  console.error('  exit:', goodRun.status);
  console.error('  stderr:', goodRun.stderr.slice(0, 800));
  cleanup();
  process.exit(1);
}

// Tidiness check: HEAD must match BEFORE_SHA, scratch must be gone.
const afterSha = (() => { try { return git('rev-parse HEAD'); } catch (_) { return null; } })();
if (afterSha !== BEFORE_SHA) {
  console.error('FAIL: post-test HEAD does not match pre-test HEAD.');
  console.error('  before: ' + BEFORE_SHA);
  console.error('  after:  ' + afterSha);
  cleanup();
  process.exit(1);
}
if (fs.existsSync(SCRATCH)) {
  console.error('FAIL: scratch file ' + SCRATCH_REL + ' still exists after cleanup.');
  cleanup();
  process.exit(1);
}

cleanup();
console.log('PASS: self-test confirms gate fires on planted synced-surface commit without version bump, prints [lockdown-resync-needed] hint, and passes on restored state.');
process.exit(0);
