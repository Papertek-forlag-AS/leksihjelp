#!/usr/bin/env node
/**
 * Leksihjelp — Popup View Module Dependency Gate (Phase 30-01)
 *
 * Phase 30 splits extension/popup/popup.js into mountable view modules under
 * extension/popup/views/. Each module receives a `container` element and an
 * explicit `deps` object — it must NOT reach for chrome.*, window.__lexi*,
 * or document.getElementById directly. That contract lets the lockdown
 * sidepanel and skriveokt-zero mount the same modules without an extension
 * runtime.
 *
 * This gate scans every non-test file under extension/popup/views/ and exits
 * 1 if any forbidden token appears outside of strings or comments. Allowed:
 *   - container.querySelector / container.querySelectorAll
 *   - deps.* (anything routed through the deps object)
 *   - self.__lexi{Dictionary,Settings,Pause,Report}View (the module's own export)
 *
 * Forbidden:
 *   - bare chrome.* references
 *   - window.__lexi* references
 *   - self.__lexi<not-this-module's-export>
 *   - document.getElementById( (DOM lookups must scope through container)
 *   - document.querySelector( (same — DOM lookups must scope through container)
 *
 * Usage:
 *   node scripts/check-popup-deps.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-network-silence.js style.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VIEWS_DIR = path.join(ROOT, 'extension/popup/views');

// Whitelisted self-exports (the module's own attach point on `self`).
const ALLOWED_SELF_EXPORTS = new Set([
  '__lexiDictionaryView',
  '__lexiSettingsView',
  '__lexiPauseView',
  '__lexiReportView',
]);

// Strip line comments, block comments, and string literals (single, double,
// backtick) from a source line — anything inside those is opaque to the
// forbidden-token scan. Block comments are handled by collapsing across
// lines before per-line scanning.
function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function stripStringsAndLineComments(line) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    // Line comment — discard rest of line.
    if (ch === '/' && line[i + 1] === '/') break;
    // String literal — skip to closing quote of same kind.
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ' ';
      i++;
      while (i < line.length) {
        if (line[i] === '\\' && i + 1 < line.length) { i += 2; continue; }
        if (line[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function scanFile(absPath) {
  const findings = [];
  const raw = fs.readFileSync(absPath, 'utf8');
  const stripped = stripBlockComments(raw);
  const lines = stripped.split(/\r?\n/);
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = stripStringsAndLineComments(lines[lineNo]);
    if (!line.trim()) continue;

    // chrome.* (any property access)
    if (/\bchrome\./.test(line)) {
      findings.push({
        line: lineNo + 1,
        token: 'chrome.*',
        hint: 'Pass storage / runtime / tabs APIs in via deps (deps.storage, deps.runtime).',
        text: lines[lineNo].trim(),
      });
    }

    // window.__lexi*
    if (/\bwindow\.__lexi/.test(line)) {
      findings.push({
        line: lineNo + 1,
        token: 'window.__lexi*',
        hint: 'Receive the dependency via deps instead of reaching for the host global.',
        text: lines[lineNo].trim(),
      });
    }

    // self.__lexi<NAME> — only allowed if NAME matches this module's export.
    const selfMatches = line.matchAll(/\bself\.(__lexi\w+)/g);
    for (const m of selfMatches) {
      const sym = m[1];
      if (!ALLOWED_SELF_EXPORTS.has(sym)) {
        findings.push({
          line: lineNo + 1,
          token: 'self.' + sym,
          hint: 'View modules must not read other __lexi* globals — pass them in via deps.',
          text: lines[lineNo].trim(),
        });
        continue;
      }
      // Even if it's an allowed export name, only this view's own export is
      // allowed inside the file. Determine the file's own export from the
      // basename → mapping.
      const base = path.basename(absPath, '.js');
      const ownExport = ({
        'dictionary-view': '__lexiDictionaryView',
        'settings-view': '__lexiSettingsView',
        'pause-view': '__lexiPauseView',
        'report-view': '__lexiReportView',
      })[base];
      if (ownExport && sym !== ownExport) {
        findings.push({
          line: lineNo + 1,
          token: 'self.' + sym,
          hint: 'Cross-view global access — pass the other view in via deps if you need it.',
          text: lines[lineNo].trim(),
        });
      }
    }

    // document.getElementById( and document.querySelector( — DOM lookups
    // must be scoped via container.querySelector. document.querySelectorAll
    // is also forbidden by the same rule.
    if (/\bdocument\.getElementById\s*\(/.test(line)) {
      findings.push({
        line: lineNo + 1,
        token: 'document.getElementById(',
        hint: 'Use container.querySelector(\'#id\') so the view stays scoped to its host element.',
        text: lines[lineNo].trim(),
      });
    }
    if (/\bdocument\.querySelector(All)?\s*\(/.test(line)) {
      findings.push({
        line: lineNo + 1,
        token: 'document.querySelector(',
        hint: 'Use container.querySelector / container.querySelectorAll so the view stays scoped.',
        text: lines[lineNo].trim(),
      });
    }
  }
  return findings;
}

function main() {
  if (!fs.existsSync(VIEWS_DIR)) {
    console.error('[check-popup-deps] FAIL: ' + path.relative(ROOT, VIEWS_DIR) + ' does not exist.');
    process.exit(1);
  }

  const files = fs.readdirSync(VIEWS_DIR)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => path.join(VIEWS_DIR, f));

  if (files.length === 0) {
    console.error('[check-popup-deps] FAIL: no view modules found under ' + path.relative(ROOT, VIEWS_DIR));
    process.exit(1);
  }

  let totalFindings = 0;
  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length === 0) continue;
    totalFindings += findings.length;
    for (const f of findings) {
      process.stderr.write(
        '[check-popup-deps] ' + path.relative(ROOT, file) + ':' + f.line +
        ' — forbidden token: ' + f.token + '\n' +
        '  ' + f.text + '\n' +
        '  fix: ' + f.hint + '\n'
      );
    }
  }

  if (totalFindings > 0) {
    process.stderr.write('[check-popup-deps] FAIL: ' + totalFindings + ' forbidden reference(s) across ' + files.length + ' view module(s).\n');
    process.exit(1);
  }

  console.log('[check-popup-deps] PASS: ' + files.length + ' view module(s) clean of implicit globals.');
  process.exit(0);
}

main();
