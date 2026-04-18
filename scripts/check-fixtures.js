#!/usr/bin/env node

/**
 * Leksihjelp — Regression Fixture Runner (INFRA-02)
 *
 * Runs hand-authored JSONL fixtures through `spell-check-core.check()` using
 * vocab indexes built via `vocab-seam-core.buildIndexes()` directly from
 * `extension/data/{lang}.json`. Computes per-rule-class precision / recall /
 * F1 and exits non-zero on any hard mismatch (missing expected finding OR
 * unexpected flag).
 *
 * Usage:
 *   node scripts/check-fixtures.js                # All languages, all rules
 *   node scripts/check-fixtures.js all            # Same as above
 *   node scripts/check-fixtures.js nb             # NB only
 *   node scripts/check-fixtures.js nn             # NN only
 *   node scripts/check-fixtures.js nb --rule=gender
 *   node scripts/check-fixtures.js nb --verbose   # Print failing cases
 *   node scripts/check-fixtures.js --json         # Emit a JSON report instead
 *
 * Exit code:
 *   0 — every case matched expected findings exactly (clean corpus had no flags)
 *   1 — at least one case produced missing-expected or extra (unexpected) finding
 *
 * P/R/F1 are printed for information only — no thresholds gate the exit code
 * in Phase 1 (threshold gating is locked as a Phase-4 decision).
 *
 * Design notes:
 *   - Zero npm dependencies. Node 18+. CommonJS.
 *   - Path-relative IO via path.join(__dirname, ...) — `cd scripts && node check-fixtures.js`
 *     must still work (pitfall #7).
 *   - Always explicit UTF-8 (pitfall #8).
 *   - Finding fields checked: rule_id, start, end, fix. Fixture `suggestion`
 *     maps to Finding `fix` — see matchesExpected().
 */

'use strict';

const fs = require('fs');
const path = require('path');

const vocabCore = require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(__dirname, '..', 'extension', 'content', 'spell-check-core.js'));

const DATA_DIR    = path.join(__dirname, '..', 'extension', 'data');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

// ── Argv parsing (no commander/yargs) ──

function parseArgs(argv) {
  const out = { lang: null, rule: null, verbose: false, json: false };
  for (const arg of argv) {
    if (arg.startsWith('--rule=')) out.rule = arg.slice('--rule='.length);
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--json') out.json = true;
    else if (!arg.startsWith('--') && !out.lang) out.lang = arg;
  }
  return out;
}

// ── JSONL loader ──
//
// Tolerates blank lines and `//` or `#` comment lines. Carries filename +
// line number into parse errors so a malformed fixture reports the right
// offender.

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line, idx) => ({ line: line.trim(), num: idx + 1 }))
    .filter(x => x.line && !x.line.startsWith('//') && !x.line.startsWith('#'))
    .map(x => {
      try { return JSON.parse(x.line); }
      catch (e) { throw new Error(path.basename(file) + ':' + x.num + ': ' + e.message); }
    });
}

// ── Vocab loader ──
//
// `isFeatureEnabled: () => true` emits the full canonical superset. Fixture
// runs are about rule correctness, not UI visibility — the runner always
// sees every word the seam can emit.

function loadVocab(lang) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang + '.json'), 'utf8'));
  let bigrams = null;
  const bigramFile = path.join(DATA_DIR, 'bigrams-' + lang + '.json');
  if (fs.existsSync(bigramFile)) {
    bigrams = JSON.parse(fs.readFileSync(bigramFile, 'utf8'));
  }
  return vocabCore.buildIndexes({ raw, bigrams, lang, isFeatureEnabled: () => true });
}

// ── Matcher ──
//
// A finding matches an expected entry when rule_id, start, end, and fix are
// all equal. Fixture JSONL uses `suggestion` for readability; we compare it
// to Finding.fix (the core emits `fix`, not `suggestion`).

function matchesExpected(finding, expected) {
  return finding.rule_id === expected.rule_id &&
         finding.start   === expected.start   &&
         finding.end     === expected.end     &&
         finding.fix     === expected.suggestion;
}

function runCase(kase, vocab, lang) {
  const found = spellCore.check(kase.text, vocab, { lang });
  const matchedIdx = new Set();
  const missing = [];
  for (const exp of (kase.expected || [])) {
    const hit = found.findIndex((f, i) => !matchedIdx.has(i) && matchesExpected(f, exp));
    if (hit === -1) missing.push(exp);
    else matchedIdx.add(hit);
  }
  const extra = found.filter((_, i) => !matchedIdx.has(i));
  return {
    id: kase.id,
    tp: matchedIdx.size,
    fn: missing.length,
    fp: extra.length,
    ok: missing.length === 0 && extra.length === 0,
    missing,
    extra,
    text: kase.text,
  };
}

// ── P/R/F1 ──

function summarize(tp, fp, fn) {
  const P  = (tp + fp) ? tp / (tp + fp) : 1;
  const R  = (tp + fn) ? tp / (tp + fn) : 1;
  const F1 = (P + R)   ? 2 * P * R / (P + R) : 0;
  return { P, R, F1, tp, fp, fn };
}

// ── Main loop ──

function main() {
  const { lang, rule, verbose, json } = parseArgs(process.argv.slice(2));
  const langs = (!lang || lang === 'all') ? ['nb', 'nn'] : [lang];
  let hardFail = false;
  const report = {};

  for (const l of langs) {
    const ruleDir = path.join(FIXTURE_DIR, l);
    if (!fs.existsSync(ruleDir)) continue;
    const vocab = loadVocab(l);
    const files = rule
      ? [rule + '.jsonl']
      : fs.readdirSync(ruleDir).filter(f => f.endsWith('.jsonl')).sort();
    report[l] = {};
    for (const file of files) {
      const ruleId = path.basename(file, '.jsonl');
      const filePath = path.join(ruleDir, file);
      if (!fs.existsSync(filePath)) continue;
      const cases = loadJsonl(filePath);
      const results = cases.map(c => runCase(c, vocab, l));
      const tp = results.reduce((s, r) => s + r.tp, 0);
      const fp = results.reduce((s, r) => s + r.fp, 0);
      const fn = results.reduce((s, r) => s + r.fn, 0);
      const stats = summarize(tp, fp, fn);
      const passed = results.filter(r => r.ok).length;
      const failed = results.length - passed;

      report[l][ruleId] = Object.assign({}, stats, {
        cases: results.length,
        passed,
        failed,
        results: verbose ? results : undefined,
      });

      if (failed > 0) hardFail = true;

      if (!json) {
        console.log(
          '[' + l + '/' + ruleId + '] ' +
          'P=' + stats.P.toFixed(3) +
          ' R=' + stats.R.toFixed(3) +
          ' F1=' + stats.F1.toFixed(3) +
          '  ' + passed + '/' + results.length + ' pass'
        );
        if (verbose) {
          for (const r of results.filter(x => !x.ok)) {
            console.log('  FAIL ' + r.id + ' — text: ' + JSON.stringify(r.text));
            if (r.missing.length) console.log('    missing: ' + JSON.stringify(r.missing));
            if (r.extra.length)   console.log('    extra:   ' + JSON.stringify(r.extra));
          }
        }
      }
    }
  }

  if (json) console.log(JSON.stringify(report, null, 2));
  process.exit(hardFail ? 1 : 0);
}

main();
