#!/usr/bin/env node
/**
 * Leksihjelp — Baseline Bundle-Size Release Gate (GATES-02, Phase 23-06)
 *
 * Enforces a 200 KB cap on extension/data/nb-baseline.json — the tiny NB
 * baseline that is bundled with the extension to keep first-run UX functional
 * while the background bootstrap downloads the full vocabulary.
 *
 * Why this gate exists: Phase 23 removes the bundled language data from the
 * extension zip and replaces it with a network-fetched cache (see
 * scripts/check-network-silence.js carve-out). The NB baseline is the ONLY
 * data file that ships in the zip going forward, so a regression that bloats
 * it (forgetting to filter Zipf threshold, accidentally including bigrams,
 * etc.) directly affects install footprint. This gate catches that class of
 * regression before it reaches the browser.
 *
 * Behavior:
 *   - If extension/data/nb-baseline.json does not exist: print a "skipped"
 *     message and exit 0. This keeps the gate runnable before plan 23-03
 *     ships the baseline builder. Once that plan lands, the file will exist
 *     and the gate becomes meaningful.
 *   - Otherwise: stat the file. If size > 200 KB, exit 1 with a fix hint.
 *     Else exit 0.
 *
 * Note: this gate measures the SOURCE file (pretty-printed). The packaged
 * zip is measured separately by check-bundle-size.js.
 *
 * Zero npm deps. Node 18+. CommonJS. Matches the style of check-bundle-size.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'extension/data/nb-baseline.json');
const BASELINE_REL = 'extension/data/nb-baseline.json';
const CEILING_BYTES = 200 * 1024;

function fmt(n) {
  return n.toLocaleString('en-US') + ' bytes';
}

function main() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log('SKIP — ' + BASELINE_REL + ' does not exist yet (informational).');
    console.log('Once plan 23-03 ships the baseline builder, this gate enforces a 200 KB cap.');
    console.log('Run `npm run build-nb-baseline` to generate it.');
    process.exit(0);
  }
  const size = fs.statSync(BASELINE_PATH).size;
  console.log('Baseline size: ' + fmt(size) + ' / ' + fmt(CEILING_BYTES) + ' cap');
  if (size > CEILING_BYTES) {
    console.log('FAIL — ' + BASELINE_REL + ' exceeds 200 KB cap.');
    console.log('Trim with scripts/build-nb-baseline.js (raise the Zipf threshold or drop bigrams).');
    process.exit(1);
  }
  console.log('PASS — ' + BASELINE_REL + ' within 200 KB cap.');
  process.exit(0);
}

main();
