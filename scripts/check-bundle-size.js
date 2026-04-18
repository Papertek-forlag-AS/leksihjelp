#!/usr/bin/env node

/**
 * Leksihjelp — Bundle-size release gate (Plan 02-04 Task 1)
 *
 * Runs `npm run package`, measures the resulting zip, prints a per-directory
 * byte breakdown, and exits 0 if the zip is ≤ 10 MiB or 1 if it exceeds it.
 *
 * The 10 MiB ceiling is ROADMAP success criterion #4 and a publicly-stated
 * promise. The script does NOT bypass the cap — a FAIL + breakdown is the
 * correct signal that bundle-size remediation is needed.
 *
 * Usage:
 *   npm run check-bundle-size
 *
 * Exit codes:
 *   0 — zip ≤ 10 MiB (PASS)
 *   1 — zip > 10 MiB OR packaging itself failed (FAIL)
 *
 * Zero npm deps. Node 18+. CommonJS. Matches style of check-fixtures.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ZIP_PATH = path.join(ROOT, 'backend', 'public', 'lexi-extension.zip');
const CEILING_BYTES = 10 * 1024 * 1024; // 10 MiB = 10,485,760

function humanMiB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function commaBytes(bytes) {
  return bytes.toLocaleString('en-US');
}

function runPackage() {
  console.log('Running npm run package...\n');
  const result = spawnSync('npm', ['run', 'package'], {
    cwd: ROOT,
    stdio: 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error('\nERROR: npm run package failed with exit code ' + result.status);
    process.exit(1);
  }
  if (!fs.existsSync(ZIP_PATH)) {
    console.error('\nERROR: npm run package completed but no zip at ' + ZIP_PATH);
    process.exit(1);
  }
}

/**
 * Parses `unzip -l <zip>` output and groups sizes by top-level directory.
 *
 * `unzip -l` output format (tab/space-separated columns):
 *   Length      Date    Time    Name
 *   ---------  ---------- -----   ----
 *       1234   2024-01-01 12:00   data/nb.json
 *      ...
 *      12345                     21 files
 *
 * We key by the first path segment (top-level directory). Files at the root
 * of the zip are grouped under "(root)".
 */
function computeBreakdown(zipPath) {
  // UNcompressed Length is what `unzip -l` reports; for gzipped-scale
  // inspection use `unzip -lv` which has both compressed and uncompressed.
  // Per Plan 02-04 Task 1 we want the zip's INTERNAL sizes to see where the
  // bytes go — uncompressed serves that diagnostic. The total zip size is
  // the filesystem stat, reported separately.
  const listing = execSync('unzip -l "' + zipPath + '"', {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const dirs = new Map(); // topLevel → uncompressedBytes

  const lines = listing.split('\n');
  for (const line of lines) {
    // Match a data row. `unzip -l` prints dates in MM-DD-YYYY on macOS and
    // YYYY-MM-DD on many Linux builds — accept either. Row format:
    //   "   12345  04-18-2026 21:37   path/to/file"
    //   "   12345  2024-01-01 12:00   path/to/file"
    const m = line.match(/^\s*(\d+)\s+\d{2,4}[-/]\d{2}[-/]\d{2,4}\s+\d{2}:\d{2}\s+(.+?)\s*$/);
    if (!m) continue;
    const size = parseInt(m[1], 10);
    const relPath = m[2];
    // Skip directory-only entries (end with /)
    if (relPath.endsWith('/')) continue;

    const firstSeg = relPath.split('/')[0];
    const key = relPath.includes('/') ? firstSeg + '/' : '(root)';
    dirs.set(key, (dirs.get(key) || 0) + size);
  }
  return dirs;
}

function printBreakdown(dirs) {
  const entries = Array.from(dirs.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);

  console.log('\nPer-directory breakdown (uncompressed bytes inside zip):');
  console.log('  ' + 'Directory'.padEnd(18) + 'Bytes'.padStart(16) + '  (MiB)');
  console.log('  ' + '-'.repeat(18) + '-'.repeat(16) + '  ' + '-'.repeat(7));
  for (const [dir, bytes] of entries) {
    const mib = humanMiB(bytes);
    console.log(
      '  ' + dir.padEnd(18) + commaBytes(bytes).padStart(16) + '  (' + mib + ' MiB)'
    );
  }
  console.log('  ' + '-'.repeat(18) + '-'.repeat(16) + '  ' + '-'.repeat(7));
  console.log(
    '  ' + 'TOTAL (uncomp.)'.padEnd(18) + commaBytes(total).padStart(16) + '  (' + humanMiB(total) + ' MiB)'
  );
}

function main() {
  runPackage();

  const zipSize = fs.statSync(ZIP_PATH).size;
  const zipMib = humanMiB(zipSize);
  const capMib = humanMiB(CEILING_BYTES);

  const dirs = computeBreakdown(ZIP_PATH);
  printBreakdown(dirs);

  console.log('\nZip file size (what Chrome Web Store sees):');
  console.log('  ' + commaBytes(zipSize) + ' bytes (' + zipMib + ' MiB)');
  console.log('  cap: ' + commaBytes(CEILING_BYTES) + ' bytes (' + capMib + ' MiB)');

  if (zipSize <= CEILING_BYTES) {
    const margin = CEILING_BYTES - zipSize;
    console.log(
      '\nPASS: ' + zipMib + ' MiB (' + commaBytes(zipSize) + ' bytes) — ' +
      'under cap by ' + commaBytes(margin) + ' bytes (' + humanMiB(margin) + ' MiB headroom)'
    );
    process.exit(0);
  } else {
    const over = zipSize - CEILING_BYTES;
    console.log(
      '\nFAIL: ' + zipMib + ' MiB (' + commaBytes(zipSize) + ' bytes) — ' +
      'OVER cap ' + commaBytes(CEILING_BYTES) + ' by ' + commaBytes(over) + ' bytes (' + humanMiB(over) + ' MiB)'
    );
    console.log(
      '\nThe 10 MiB ceiling is ROADMAP success criterion #4 and a publicly-stated promise.\n' +
      'Do NOT bypass by silently editing CEILING_BYTES. Investigate the breakdown above\n' +
      'and remediate (e.g., strip bundled audio + fetch on first use; trim rarely-used vocab;\n' +
      'split the lexicon; or open a new phase to make the product decision with user sign-off).'
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
