#!/usr/bin/env node
/**
 * Leksihjelp — Benchmark Coverage Release Gate (INFRA-08, Phase 06-02)
 *
 * Reads benchmark-texts/expectations.json and validates that each expected
 * rule fires on the corresponding benchmark line. Produces per-priority-band
 * flip-rate percentages for phase-close decisions (P1=100%, P2>=80%, P3>=50%).
 *
 * The gate itself fails on ANY missed expectation regardless of band — the
 * percentage reporting is informational.
 *
 * When entries is empty, the gate passes (nothing to check). This allows the
 * gate to ship before Plan 03 populates expectations.
 *
 * Exit 0 on pass, 1 on any failure.
 *
 * Usage:
 *   node scripts/check-benchmark-coverage.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BENCHMARK_DIR = path.join(ROOT, 'benchmark-texts');
const EXPECTATIONS_PATH = path.join(BENCHMARK_DIR, 'expectations.json');
const DATA_DIR = path.join(ROOT, 'extension', 'data');
const SPELL_RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');

// Load spell-check-core (attaches to self/__lexiSpellCore)
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));

// Load all rule files so the rule registry is populated
if (fs.existsSync(SPELL_RULES_DIR)) {
  const ruleFiles = fs.readdirSync(SPELL_RULES_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
  for (const f of ruleFiles) {
    require(path.join(SPELL_RULES_DIR, f));
  }
}

// Cache loaded vocab per language
const vocabCache = {};

function loadVocab(lang) {
  if (vocabCache[lang]) return vocabCache[lang];

  const dataFile = path.join(DATA_DIR, lang + '.json');
  if (!fs.existsSync(dataFile)) return null;

  const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

  let sisterRaw = null;
  if (lang === 'nb' || lang === 'nn') {
    const sisterLang = lang === 'nb' ? 'nn' : 'nb';
    const sisterFile = path.join(DATA_DIR, sisterLang + '.json');
    if (fs.existsSync(sisterFile)) {
      sisterRaw = JSON.parse(fs.readFileSync(sisterFile, 'utf8'));
    }
  }

  let bigrams = null;
  const bigramFile = path.join(DATA_DIR, 'bigrams-' + lang + '.json');
  if (fs.existsSync(bigramFile)) {
    bigrams = JSON.parse(fs.readFileSync(bigramFile, 'utf8'));
  }

  let freq = null;
  const freqFile = path.join(DATA_DIR, 'freq-' + lang + '.json');
  if (fs.existsSync(freqFile)) {
    freq = JSON.parse(fs.readFileSync(freqFile, 'utf8'));
  }

  const vocab = vocabCore.buildIndexes({ raw, sisterRaw, bigrams, freq, lang, isFeatureEnabled: () => true });

  let pitfalls = {};
  const pitfallFile = path.join(DATA_DIR, 'pitfalls-' + lang + '.json');
  if (fs.existsSync(pitfallFile)) {
    pitfalls = JSON.parse(fs.readFileSync(pitfallFile, 'utf8'));
  }
  vocab.pitfalls = pitfalls;

  vocabCache[lang] = vocab;
  return vocab;
}

function loadBenchmarkLines(lang) {
  const txtFile = path.join(BENCHMARK_DIR, lang + '.txt');
  if (!fs.existsSync(txtFile)) return null;
  return fs.readFileSync(txtFile, 'utf8').split(/\r?\n/);
}

function main() {
  if (!fs.existsSync(EXPECTATIONS_PATH)) {
    console.error('[check-benchmark-coverage] FAIL: benchmark-texts/expectations.json not found');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(EXPECTATIONS_PATH, 'utf8'));
  const entries = manifest.entries || {};
  const keys = Object.keys(entries);

  if (keys.length === 0) {
    console.log('[check-benchmark-coverage] PASS: 0 expectations, nothing to check');
    process.exit(0);
  }

  // Group by priority band for reporting
  const bands = { P1: { total: 0, passed: 0 }, P2: { total: 0, passed: 0 }, P3: { total: 0, passed: 0 } };
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const failures = [];

  // Cache benchmark lines per language
  const lineCache = {};

  for (const key of keys) {
    const entry = entries[key];
    const dotIdx = key.indexOf('.');
    if (dotIdx === -1) {
      console.error('[check-benchmark-coverage] FAIL: malformed key "' + key + '" — expected lang.line_number');
      process.exit(1);
    }

    const lang = key.slice(0, dotIdx);
    const lineNum = parseInt(key.slice(dotIdx + 1), 10);

    if (isNaN(lineNum) || lineNum < 1) {
      console.error('[check-benchmark-coverage] FAIL: invalid line number in key "' + key + '"');
      process.exit(1);
    }

    // Load vocab for this language
    const vocab = loadVocab(lang);
    if (!vocab) {
      console.log('  SKIP: ' + key + ' — no vocab data for language "' + lang + '"');
      totalSkipped++;
      continue;
    }

    // Load benchmark lines
    if (!lineCache[lang]) {
      lineCache[lang] = loadBenchmarkLines(lang);
    }
    const lines = lineCache[lang];
    if (!lines) {
      console.log('  SKIP: ' + key + ' — no benchmark text file for language "' + lang + '"');
      totalSkipped++;
      continue;
    }

    // 1-based line number
    if (lineNum > lines.length) {
      failures.push({ key, reason: 'line ' + lineNum + ' exceeds file length (' + lines.length + ' lines)' });
      totalFailed++;
      const band = entry.priority_band || 'P3';
      if (bands[band]) bands[band].total++;
      continue;
    }

    const lineText = lines[lineNum - 1];
    const band = entry.priority_band || 'P3';
    if (bands[band]) bands[band].total++;

    // Run spell-check on this line
    const findings = spellCore.check(lineText, vocab, { lang });
    const expectedRuleId = entry.rule_id;

    // Check if the expected rule_id appears in findings
    const found = findings.some(f => f.rule_id === expectedRuleId);

    if (found) {
      totalPassed++;
      if (bands[band]) bands[band].passed++;
    } else {
      totalFailed++;
      failures.push({
        key,
        reason: 'rule "' + expectedRuleId + '" not found in findings',
        line: lineText,
        foundRules: findings.map(f => f.rule_id),
      });
    }
  }

  // Print per-band flip-rate
  console.log('\n[check-benchmark-coverage] Priority-band flip-rates:');
  for (const [band, stats] of Object.entries(bands)) {
    if (stats.total === 0) {
      console.log('  ' + band + ': no expectations');
    } else {
      const pct = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log('  ' + band + ': ' + stats.passed + '/' + stats.total + ' (' + pct + '%)');
    }
  }

  // Print failures
  if (failures.length > 0) {
    console.log('\n[check-benchmark-coverage] Failures:');
    for (const f of failures) {
      console.log('  ' + f.key + ': ' + f.reason);
      if (f.line) console.log('    line: ' + JSON.stringify(f.line));
      if (f.foundRules && f.foundRules.length) console.log('    found rules: ' + f.foundRules.join(', '));
    }
  }

  // Print summary
  const total = totalPassed + totalFailed;
  console.log('\n[check-benchmark-coverage] ' + (totalFailed > 0 ? 'FAIL' : 'PASS') +
    ': ' + totalPassed + '/' + total + ' expectations met' +
    (totalSkipped > 0 ? ' (' + totalSkipped + ' skipped)' : ''));

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
