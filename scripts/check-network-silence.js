#!/usr/bin/env node
/**
 * Leksihjelp — Network Silence Release Gate (SC-06, Phase 3-05)
 *
 * Greps the spell-check + spell-rules + word-prediction code surface for
 * outbound network patterns. SC-06 requires these code paths stay offline:
 *   - No fetch() calls
 *   - No XMLHttpRequest
 *   - No navigator.sendBeacon
 *   - No hard-coded http:// or https:// URLs (even as string literals —
 *     lint sees the intent)
 *
 * Whitelisted patterns (local-resource access is fine):
 *   - chrome.runtime.getURL (bundled assets)
 *   - chrome-extension:// URLs
 *   - Comments and docstrings (lines starting with //, plus markdown inside
 *     JSDoc * blocks)
 *
 * SC-06 sanctioned bootstrap path (Phase 23, do NOT add to scan set):
 *   - extension/background/vocab-bootstrap.js
 *   - extension/background/vocab-updater.js
 *   - extension/content/vocab-store.js
 * These files are the only places allowed to issue fetch() against the
 * Papertek vocabulary API. They are deliberately OUT OF the scan set
 * (SCAN_TARGETS / SCAN_DIRS below). Spell-check + word-prediction must remain
 * network-silent — that contract is unchanged. The carve-out is enforced
 * by omission: the scanner walks only the offline-surface files, so adding
 * fetch() in vocab-bootstrap.js etc. is allowed by design. The companion
 * self-test (check-network-silence.test.js) plants a fetch in vocab-bootstrap.js
 * and asserts the gate stays green to prove the carve-out is real and not an
 * accidental scan-set drift.
 *
 * Exits 0 on clean scan, 1 if any hit.
 *
 * Usage:
 *   node scripts/check-network-silence.js
 *   node scripts/check-network-silence.js --verbose    # emit per-file scan log
 *
 * Zero npm deps. Node 18+. CommonJS. Matches style of check-bundle-size.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_TARGETS = [
  'extension/content/spell-check-core.js',
  'extension/content/spell-check.js',
  'extension/content/word-prediction.js',
];
const SCAN_DIRS = [
  'extension/content/spell-rules',
];

// Regexes for forbidden patterns. Each hit is reported.
const FORBIDDEN = [
  { re: /\bfetch\s*\(/g,         label: 'fetch(' },
  { re: /\bXMLHttpRequest\b/g,   label: 'XMLHttpRequest' },
  { re: /\bsendBeacon\b/g,       label: 'sendBeacon' },
  { re: /\bhttps?:\/\/\S+/g,     label: 'http(s):// URL' },
];

// Whitelist: lines containing any of these patterns are exempt from the
// forbidden regex scan. Preserves legitimate local-resource references and
// doc-comments describing SC-06 itself.
const WHITELIST = [
  /chrome\.runtime\.getURL/,
  /chrome-extension:\/\//,
  /^\s*\*/,            // JSDoc comment body line
  /^\s*\/\//,          // // comment line
];

function collectFiles() {
  const out = [];
  for (const t of SCAN_TARGETS) out.push(path.join(ROOT, t));
  for (const d of SCAN_DIRS) {
    const full = path.join(ROOT, d);
    if (!fs.existsSync(full)) continue;
    for (const f of fs.readdirSync(full).sort()) {
      if (f.endsWith('.js')) out.push(path.join(full, f));
    }
  }
  return out;
}

function scanFile(file) {
  const hits = [];
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (WHITELIST.some(w => w.test(line))) return;
    for (const { re, label } of FORBIDDEN) {
      re.lastIndex = 0;
      if (re.test(line)) {
        hits.push({ file: path.relative(ROOT, file), line: idx + 1, label, text: line.trim() });
      }
    }
  });
  return hits;
}

function main() {
  const verbose = process.argv.includes('--verbose');
  const files = collectFiles();
  if (verbose) console.log('[check-network-silence] scanning', files.length, 'files');
  let allHits = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const hits = scanFile(f);
    if (verbose) console.log('[check-network-silence]', path.relative(ROOT, f), hits.length === 0 ? 'clean' : hits.length + ' hit(s)');
    allHits = allHits.concat(hits);
  }
  if (allHits.length === 0) {
    console.log('PASS — spell-check + spell-rules + word-prediction surface is network-silent (SC-06).');
    process.exit(0);
  }
  console.log('FAIL — forbidden network pattern(s) detected in the offline surface (SC-06):');
  for (const h of allHits) {
    console.log('  ' + h.file + ':' + h.line + '  [' + h.label + ']  ' + h.text.slice(0, 120));
  }
  console.log('\nFix: remove the fetch/URL from offline code paths. If the access is local-only (bundled asset), use chrome.runtime.getURL + chrome-extension:// which are whitelisted.');
  process.exit(1);
}

main();
