#!/usr/bin/env node

/**
 * Leksihjelp — Package helper (Plan 02-04 Task 1)
 *
 * Produces backend/public/lexi-extension.zip from the extension/ tree, but
 * re-emits every extension/data/*.json in minified form along the way. The
 * source tree is NEVER modified — minification happens in a staging copy at
 * .package-staging/ (gitignored) which is removed on both success and failure.
 *
 * Flow:
 *   1. Remove any prior .package-staging/ and any prior zip.
 *   2. fs.cpSync(extension/, .package-staging/, { recursive: true }).
 *   3. Walk .package-staging/data/ and re-emit every *.json via
 *      JSON.stringify(JSON.parse(raw)) — whitespace stripped.
 *   4. Shell out to `zip -r -X` over the staging dir, writing to
 *      backend/public/lexi-extension.zip.
 *   5. Remove .package-staging/ in both success and failure paths.
 *   6. Log: staged, minified N files (saved X bytes), zip size Y bytes.
 *
 * Zero npm deps. Node 18+. CommonJS. Matches the style of check-fixtures.js
 * and build-frequencies.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EXTENSION_DIR = path.join(ROOT, 'extension');
const STAGING_DIR = path.join(ROOT, '.package-staging');
const OUTPUT_ZIP = path.join(ROOT, 'backend', 'public', 'lexi-extension.zip');

function rmrf(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function ensureParentDir(filePath) {
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
}

function minifyDataJson(stagingDataDir) {
  const entries = fs.readdirSync(stagingDataDir);
  let filesMinified = 0;
  let bytesSaved = 0;

  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const filePath = path.join(stagingDataDir, entry);
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error('Failed to parse ' + path.relative(ROOT, filePath) + ': ' + err.message);
    }
    const minified = JSON.stringify(parsed);
    if (minified.length >= raw.length) {
      // Already minified (or tie) — overwrite anyway so downstream byte counts
      // reflect the JSON.stringify canonical form.
      fs.writeFileSync(filePath, minified);
      continue;
    }
    bytesSaved += raw.length - minified.length;
    fs.writeFileSync(filePath, minified);
    filesMinified++;
  }

  return { filesMinified, bytesSaved };
}

function main() {
  const start = Date.now();

  // Preflight
  if (!fs.existsSync(EXTENSION_DIR)) {
    console.error('ERROR: extension/ directory not found at ' + EXTENSION_DIR);
    process.exit(1);
  }

  try {
    // 1. Clean stale staging + output
    rmrf(STAGING_DIR);
    if (fs.existsSync(OUTPUT_ZIP)) fs.unlinkSync(OUTPUT_ZIP);
    ensureParentDir(OUTPUT_ZIP);

    // 2. Stage extension/ → .package-staging/
    fs.cpSync(EXTENSION_DIR, STAGING_DIR, { recursive: true });
    console.log('Staged extension/ to .package-staging/');

    // 3. Minify .package-staging/data/*.json (source tree untouched)
    const stagingDataDir = path.join(STAGING_DIR, 'data');
    let minifyResult = { filesMinified: 0, bytesSaved: 0 };
    if (fs.existsSync(stagingDataDir)) {
      minifyResult = minifyDataJson(stagingDataDir);
    }
    console.log(
      'Minified ' + minifyResult.filesMinified + ' data/*.json files ' +
      '(saved ' + minifyResult.bytesSaved.toLocaleString() + ' bytes pre-zip)'
    );

    // 4. Zip the staging dir → backend/public/lexi-extension.zip
    // Using system zip to match the current behavior. -r: recursive, -X: no
    // extended attributes (smaller zip, cross-platform). Excludes hidden
    // macOS metadata + source maps.
    const zipArgs = [
      '-r',
      '-X',
      '-q',
      OUTPUT_ZIP,
      '.',
      '-x', '*.DS_Store',
      '-x', '*.map',
    ];
    execFileSync('zip', zipArgs, { cwd: STAGING_DIR, stdio: 'inherit' });

    const zipStats = fs.statSync(OUTPUT_ZIP);
    const mib = (zipStats.size / (1024 * 1024)).toFixed(2);
    console.log(
      'Created ' + path.relative(ROOT, OUTPUT_ZIP) +
      ' (' + zipStats.size.toLocaleString() + ' bytes, ' + mib + ' MiB) ' +
      'in ' + ((Date.now() - start) / 1000).toFixed(2) + 's'
    );
  } catch (err) {
    console.error('ERROR during package: ' + err.message);
    // Try to surface the zip exit code / stderr if present
    if (err.stderr) console.error(err.stderr.toString());
    process.exitCode = 1;
  } finally {
    // 5. Always clean up staging
    rmrf(STAGING_DIR);
  }
}

if (require.main === module) {
  main();
}

module.exports = { minifyDataJson };
