#!/usr/bin/env node
/**
 * Leksihjelp — Synced-Surface Version-Bump Gate (Phase 37 / HYG-05)
 *
 * Enforces that any commit which modifies a "synced surface" since the last
 * release tag is paired with a package.json version bump. Synced surfaces are
 * the files copied into downstream consumers (lockdown webapp, skriveokt-zero
 * Tauri) by their respective `scripts/sync-leksihjelp.js`. A version bump is
 * the canonical signal those consumers use to decide when to re-sync — so a
 * synced-surface change without a bump silently strands downstream.
 *
 * Synced paths (single source of truth — matches CLAUDE.md "Downstream
 * consumers" section verbatim; widened by Phase 30 popup/views; see RESEARCH):
 *   - extension/content/
 *   - extension/popup/views/
 *   - extension/exam-registry.js
 *   - extension/styles/content.css
 *   - extension/data/
 *   - extension/i18n/
 *
 * Behaviour:
 *   1. `git describe --tags --abbrev=0` → most-recent annotated tag (baseline).
 *      No tags yet → informational PASS.
 *   2. `git diff --name-only <tag>..HEAD -- <SYNCED_PATHS...>` → changed files.
 *      Empty → PASS ("no synced-surface changes since <tag>").
 *   3. Compare `package.json` version at <tag> vs HEAD. Bumped → PASS.
 *      Same → FAIL with per-file diagnostic AND copy-paste fix lines:
 *        a. `npm version patch` (or minor/major) + bump manifest.json +
 *           backend/public/index.html (paired with check-version-alignment).
 *        b. Include `[lockdown-resync-needed]` in the commit message —
 *           pulls the HYG-06 nudge into this gate's failure surface.
 *
 * `extension/data/*.json` no-exclusion decision: ANY git diff (modification,
 * addition, deletion) inside synced paths counts. Whitespace/comment-only
 * diffs count. The locked CONTEXT decision is "widest net" — we accept the
 * noise on doc-style touch-ups as acceptable cost. Vocab sync should land in
 * the same commit as a version bump (canonical pattern); future maintainers
 * who chafe against this should re-read CLAUDE.md "Downstream consumers" and
 * the v3.2 CONTEXT lock before adjusting.
 *
 * Exits 0 on PASS, 1 on FAIL.
 *
 * Usage:
 *   node scripts/check-synced-surface-version.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-popup-deps.js style.
 *
 * Paired self-test: scripts/check-synced-surface-version.test.js
 */
'use strict';
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

const SYNCED_PATHS = [
  'extension/content/',
  'extension/popup/views/',
  'extension/exam-registry.js',
  'extension/styles/content.css',
  'extension/data/',
  'extension/i18n/',
];

function git(args) {
  return execSync('git ' + args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main() {
  let lastTag;
  try {
    lastTag = git('describe --tags --abbrev=0');
  } catch (_) {
    console.log('[check-synced-surface-version] PASS (informational): no tags exist yet — gate is meaningful from the first release tag onward.');
    process.exit(0);
  }

  let changedRaw;
  try {
    changedRaw = git('diff --name-only ' + lastTag + '..HEAD -- ' + SYNCED_PATHS.join(' '));
  } catch (e) {
    process.stderr.write('[check-synced-surface-version] FAIL: git diff invocation failed.\n');
    process.stderr.write('  ' + e.message + '\n');
    process.exit(1);
  }
  const changed = changedRaw ? changedRaw.split('\n').map((l) => l.trim()).filter(Boolean) : [];

  if (changed.length === 0) {
    console.log('[check-synced-surface-version] PASS: no synced-surface changes since ' + lastTag + '.');
    process.exit(0);
  }

  let versionAtTag;
  try {
    versionAtTag = JSON.parse(git('show ' + lastTag + ':package.json')).version;
  } catch (e) {
    process.stderr.write('[check-synced-surface-version] FAIL: cannot read package.json at ' + lastTag + '.\n');
    process.stderr.write('  ' + e.message + '\n');
    process.exit(1);
  }

  // Read current package.json fresh (avoid require cache if invoked from a
  // long-running test harness).
  let versionNow;
  try {
    versionNow = JSON.parse(require('fs').readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  } catch (e) {
    process.stderr.write('[check-synced-surface-version] FAIL: cannot read current package.json.\n');
    process.stderr.write('  ' + e.message + '\n');
    process.exit(1);
  }

  if (versionAtTag !== versionNow) {
    console.log(
      '[check-synced-surface-version] PASS: ' + changed.length +
      ' synced-surface file(s) changed since ' + lastTag +
      ', package.json bumped (' + versionAtTag + ' → ' + versionNow + ').'
    );
    process.exit(0);
  }

  process.stderr.write(
    '[check-synced-surface-version] FAIL: ' + changed.length +
    ' synced-surface file(s) changed since ' + lastTag +
    ' (still at ' + versionAtTag + ') with no package.json version bump.\n'
  );
  for (const f of changed) {
    process.stderr.write('  ' + f + '\n');
  }
  process.stderr.write(
    '  fix: run `npm version patch` (or minor/major) to bump package.json + extension/manifest.json,\n' +
    '       then update the `Versjon X.Y.Z` line in backend/public/index.html to match\n' +
    '       (paired check-version-alignment gate enforces all three agree).\n' +
    '  fix: include `[lockdown-resync-needed]` in the commit message body so the\n' +
    '       downstream sync trigger is recorded for the lockdown webapp + skriveokt-zero.\n'
  );
  process.exit(1);
}

main();
