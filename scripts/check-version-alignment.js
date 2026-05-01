#!/usr/bin/env node
/**
 * Leksihjelp — Three-Source Version Alignment Gate (Phase 37 / HYG-04)
 *
 * Asserts the three release-version artifacts agree:
 *   - extension/manifest.json   (`version` JSON field — Chrome extension version)
 *   - package.json              (`version` JSON field — npm package version)
 *   - backend/public/index.html (`<p class="version">… Versjon X.Y.Z</p>` — landing-page display)
 *
 * Drift between any two sources cannot ship — see CLAUDE.md Release Workflow,
 * step "Update the version in all three places". This gate enforces what that
 * prose asks; the prose still instructs.
 *
 * Exits 0 with a single-line PASS message when all three agree.
 * Exits 1 with a per-file diagnostic + fix suggestion on drift.
 *
 * Usage:
 *   node scripts/check-version-alignment.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-popup-deps.js style.
 *
 * Paired self-test: scripts/check-version-alignment.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SOURCES = [
  {
    file: 'extension/manifest.json',
    extract: (raw) => {
      const v = JSON.parse(raw).version;
      if (!v || typeof v !== 'string') {
        throw new Error('extension/manifest.json: missing or non-string `version` field');
      }
      return v;
    },
  },
  {
    file: 'package.json',
    extract: (raw) => {
      const v = JSON.parse(raw).version;
      if (!v || typeof v !== 'string') {
        throw new Error('package.json: missing or non-string `version` field');
      }
      return v;
    },
  },
  {
    file: 'backend/public/index.html',
    extract: (raw) => {
      // Pitfall 5-class guard: HTML restructure breaking parser silently.
      // We expect a <p class="version">… Versjon X.Y.Z</p> shape; any other
      // shape (e.g. someone reorganises the landing page) must fail loudly.
      const m = raw.match(/Versjon\s+(\d+\.\d+\.\d+)/);
      if (!m) {
        throw new Error(
          'backend/public/index.html: no `Versjon X.Y.Z` line found. ' +
          'Expected shape: `<p class="version">… Versjon X.Y.Z</p>`. ' +
          'If the landing-page HTML was restructured, update the regex in scripts/check-version-alignment.js.'
        );
      }
      return m[1];
    },
  },
];

function main() {
  const observed = [];
  for (const s of SOURCES) {
    const abs = path.join(ROOT, s.file);
    let raw;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      process.stderr.write('[check-version-alignment] FAIL: cannot read ' + s.file + '\n');
      process.stderr.write('  ' + e.message + '\n');
      process.exit(1);
    }
    let version;
    try {
      version = s.extract(raw);
    } catch (e) {
      process.stderr.write('[check-version-alignment] FAIL: cannot parse version from ' + s.file + '\n');
      process.stderr.write('  ' + e.message + '\n');
      process.exit(1);
    }
    observed.push({ file: s.file, version });
  }

  const versions = new Set(observed.map((o) => o.version));
  if (versions.size === 1) {
    console.log('[check-version-alignment] PASS: all three sources at ' + [...versions][0]);
    process.exit(0);
  }

  process.stderr.write('[check-version-alignment] FAIL: version drift across release artifacts.\n');
  for (const o of observed) {
    process.stderr.write('  ' + o.file + ': ' + o.version + '\n');
  }
  process.stderr.write(
    '  fix: run `npm version <new>` to bump package.json + extension/manifest.json,\n' +
    '       then update the `Versjon X.Y.Z` line in backend/public/index.html to match.\n' +
    '  All three values MUST agree before shipping (see CLAUDE.md Release Workflow).\n'
  );
  process.exit(1);
}

main();
