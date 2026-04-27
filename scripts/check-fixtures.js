#!/usr/bin/env node

/**
 * Leksihjelp — Regression Fixture Runner (INFRA-02)
 *
 * Vocab data path (Phase 23-05):
 *   Primary:  tests/fixtures/vocab/{lang}.json  (copied from extension/data/ before
 *             the bundled data files were deleted in v3.0)
 *   Fallback: extension/data/{lang}.json        (pre-v3.0 layout, no longer shipped)
 *
 * The fixture runner NEVER reads vocab from IndexedDB — it always loads flat
 * JSON files so results are deterministic and independent of browser state.
 *
 * Runs hand-authored JSONL fixtures through `spell-check-core.check()` using
 * vocab indexes built via `vocab-seam-core.buildIndexes()` from the fixture
 * vocab path above. Computes per-rule-class precision / recall /
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

// ── Phase 4 / SC-05: per-rule P/R gates ──
//
// THRESHOLDS[lang][ruleId] = { P: 0.XX, R: 0.YY }
//
// When a rule has an entry AND the current run's observed P or R drops below
// the threshold, the runner exits 1 with a diagnostic naming the rule, the
// language, and the target. Values were locked in Plan 04-03 after fixture
// expansion — see the Task 3 commit body for the observed P/R snapshot.
//
// Only the sarskriving rule (fixture file `saerskriving.jsonl` — ASCII
// filename per fixtures/README.md span convention) is gated today; other
// rules report P/R but are not gated (gating them would block Phase 5 UX
// work on ranking noise unrelated to false-positive reduction).
//
// The key `saerskriving` matches the fixture filename basename — that is
// the ruleId the runner loop uses to bucket results. The finding-side
// rule_id emitted by spell-check-core.check() is `sarskriving` (no 'ae')
// per fixtures/README.md; the two names are DELIBERATELY different (file
// ASCII-safe, finding rule_id ASCII-safe but without æ-digraph expansion).
//
// Pitfall 4 (04-RESEARCH.md): picked at `observed - 0.05` per Plan 04-03
// checkpoint decision (option-a). Observed at lock time (Plan 04-03 Task 1
// expanded corpus — >=30 positive + >=15 acceptance cases per language):
//   nb/saerskriving: P=0.974 R=1.000  →  locked P>=0.92, R>=0.95
//   nn/saerskriving: P=0.968 R=1.000  →  locked P>=0.92, R>=0.95
// NN observed P (0.968) is the binding number — both languages rounded to
// the same 0.92 floor for simplicity. Paper floor from RESEARCH was
// P>=0.90, R>=0.60 — both languages clear it comfortably, so the lock
// margin protects against regression without accepting lower quality
// than the spec asks for.
const THRESHOLDS = {
  nb: { saerskriving: { P: 0.92, R: 0.95 } },
  nn: { saerskriving: { P: 0.92, R: 0.95 } },
};

// INFRA-03 rule registry: load rule files AFTER spell-check-core.js so that
// self.__lexiSpellRules and self.__lexiSpellCore are initialized before any
// rule IIFE runs. Deterministic alphabetical order — matches manifest ordering.
const SPELL_RULES_DIR = path.join(__dirname, '..', 'extension', 'content', 'spell-rules');
if (fs.existsSync(SPELL_RULES_DIR)) {
  const ruleFiles = fs.readdirSync(SPELL_RULES_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
  for (const f of ruleFiles) {
    require(path.join(SPELL_RULES_DIR, f));
  }
  const registry = (typeof self !== 'undefined' ? self : globalThis).__lexiSpellRules || [];
  if (registry.length === 0) {
    throw new Error('[check-fixtures] INFRA-03 rule registry is empty — check rule file dual-load guards.');
  }
}

// Phase 23-05: vocab data lives in tests/fixtures/vocab/ (fixture-only copies
// independent of the shipped extension). Falls back to extension/data/ for
// pre-v3.0 compatibility (the files no longer exist after plan 23-05 Task 1b).
const FIXTURE_VOCAB_DIR = path.join(__dirname, '..', 'tests', 'fixtures', 'vocab');
const LEGACY_DATA_DIR   = path.join(__dirname, '..', 'extension', 'data');
const FIXTURE_DIR       = path.join(__dirname, '..', 'fixtures');

// ── Argv parsing (no commander/yargs) ──

function parseArgs(argv) {
  const out = { lang: null, rule: null, verbose: false, json: false, pending: false };
  for (const arg of argv) {
    if (arg.startsWith('--rule=')) out.rule = arg.slice('--rule='.length);
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--pending') out.pending = true;
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

/**
 * Resolve a vocab data file: prefer tests/fixtures/vocab/, fall back to
 * extension/data/ (pre-v3.0 layout). Returns null if neither exists.
 */
function resolveDataFile(filename) {
  const fixture = path.join(FIXTURE_VOCAB_DIR, filename);
  if (fs.existsSync(fixture)) return fixture;
  const legacy = path.join(LEGACY_DATA_DIR, filename);
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

function loadVocab(lang) {
  const rawPath = resolveDataFile(lang + '.json');
  if (!rawPath) throw new Error('[check-fixtures] No vocab file found for ' + lang + ' in tests/fixtures/vocab/ or extension/data/');
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

  let bigrams = null;
  const bigramPath = resolveDataFile('bigrams-' + lang + '.json');
  if (bigramPath) {
    bigrams = JSON.parse(fs.readFileSync(bigramPath, 'utf8'));
  }
  let freq = null;
  const freqPath = resolveDataFile('freq-' + lang + '.json');
  if (freqPath) {
    freq = JSON.parse(fs.readFileSync(freqPath, 'utf8'));
  }

  // Phase 4 / SC-03: load sister-dialect raw vocab for NB↔NN cross-dialect
  // tolerance. Without this, sisterValidWords is empty Set in the fixture
  // path — the SC-03 rule-layer short-circuits in nb-typo-fuzzy.js and
  // nb-typo-curated.js would never fire, and the SC-04 codeswitch rule's
  // `isUnknown` predicate would wrongly count valid sister-dialect tokens
  // as unknown. Mirrors what vocab-seam.js does in the browser runtime
  // via loadRawSister(lang) + Promise.all.
  let sisterRaw = null;
  if (lang === 'nb' || lang === 'nn') {
    const sisterLang = lang === 'nb' ? 'nn' : 'nb';
    const sisterPath = resolveDataFile(sisterLang + '.json');
    if (sisterPath) sisterRaw = JSON.parse(fs.readFileSync(sisterPath, 'utf8'));
  }

  let pitfalls = {};
  const pitfallPath = resolveDataFile('pitfalls-' + lang + '.json');
  if (pitfallPath) {
    pitfalls = JSON.parse(fs.readFileSync(pitfallPath, 'utf8'));
  }

  const vocab = vocabCore.buildIndexes({ raw, sisterRaw, bigrams, freq, lang, isFeatureEnabled: () => true });
  vocab.pitfalls = pitfalls;
  // Phase 10 / FR-03: feature-gated rules (register, fr-pp-agreement) check
  // ctx.vocab.isFeatureEnabled in their check() method. The browser runtime
  // wires this from VOCAB.isFeatureEnabled (spell-check.js:243). The fixture
  // runner must provide the same predicate so feature-gated rules fire during
  // testing. Always-true matches the runner's existing "full superset" policy.
  vocab.isFeatureEnabled = () => true;

  // Pitfall 2 (RESEARCH.md): fail loud if a language we expect to have Zipf
  // data somehow lost it. NB/NN shipped freq sidecars in Phase 2; if they
  // vanish, fuzzy-ranking regressions would be silent.
  if ((lang === 'nb' || lang === 'nn') && (!(vocab.freq instanceof Map) || vocab.freq.size === 0)) {
    throw new Error(`[check-fixtures] Expected populated freq Map for ${lang}, got empty. Check tests/fixtures/vocab/freq-${lang}.json.`);
  }

  // Phase 4 / SC-03 data-contract guard: if NB/NN sisterValidWords Set is
  // empty, the runner silently bypasses the entire cross-dialect tolerance
  // path and SC-03 fixture cases would pass via other means (or fail
  // loudly with fuzzy false-positives on valid sister-dialect words).
  // Mirrors the freq Map guard above.
  if ((lang === 'nb' || lang === 'nn') &&
      (!(vocab.sisterValidWords instanceof Set) || vocab.sisterValidWords.size === 0)) {
    throw new Error(`[check-fixtures] Expected populated sisterValidWords Set for ${lang}, got empty. Check sister-dialect data loading (Plan 04-01 seam, Plan 04-03 runner wiring).`);
  }

  return vocab;
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
  const { lang, rule, verbose, json, pending: pendingOnly } = parseArgs(process.argv.slice(2));

  // ── Phase 03.1 / SC-01 adapter-contract guard ──
  //
  // The fixture runner bypasses extension/content/spell-check.js entirely —
  // vocab comes straight from vocabCore.buildIndexes() with freq Map attached.
  // Browser runtime flows instead through spell-check.js:runCheck, which
  // hand-assembles a vocab object from __lexiVocab getters. If that literal
  // ever drops `freq: VOCAB.getFreq()` again, the Zipf tiebreaker silently
  // reverts to pre-Phase-3 ranking and the fixture suite cannot detect it
  // (Pitfall 2 in 03.1-RESEARCH.md). Fail loud here.
  const adapterSrc = fs.readFileSync(
    path.join(__dirname, '..', 'extension', 'content', 'spell-check.js'),
    'utf8'
  );
  if (!/freq:\s*VOCAB\.getFreq\(\)/.test(adapterSrc)) {
    throw new Error(
      '[check-fixtures] spell-check.js:runCheck vocab object missing `freq: VOCAB.getFreq()` — SC-01 browser-wiring regression. See .planning/phases/03.1-close-sc-01-browser-wiring/.'
    );
  }

  // ── Phase 04 / SC-03 adapter-contract guard ──
  //
  // Mirror of the SC-01 guard above: Plans 04-02 / 04-03 consume
  // `vocab.sisterValidWords` for cross-dialect tolerance in NB/NN rules.
  // The fixture runner passes a full buildIndexes output (sisterValidWords
  // populated from the sister's raw vocab), so a regression that drops the
  // adapter's `sisterValidWords: VOCAB.getSisterValidWords()` field would
  // revert NB↔NN tolerance in the browser while the fixture suite stays
  // green. Fail loud here on adapter re-regression. Pitfall 6 in
  // 04-RESEARCH.md.
  if (!/sisterValidWords:\s*VOCAB\.getSisterValidWords\(\)/.test(adapterSrc)) {
    throw new Error(
      '[check-fixtures] spell-check.js:runCheck vocab object missing `sisterValidWords: VOCAB.getSisterValidWords()` — SC-03 browser-wiring regression. See .planning/phases/04-false-positive-reduction-nb-nn/.'
    );
  }

  // ── Phase 06 / REG adapter-contract guards ──
  //
  // Plans 06-03 wired registerWords, collocations, redundancyPhrases from
  // VOCAB getters into the spell-check.js:runCheck vocab object. A regression
  // that drops any of these fields silently disables the governance rules
  // in the browser while the fixture suite stays green (fixtures bypass
  // spell-check.js entirely).
  if (!/registerWords/.test(adapterSrc)) {
    throw new Error(
      '[check-fixtures] spell-check.js:runCheck vocab object missing registerWords — Phase 6 browser-wiring regression.'
    );
  }
  if (!/collocations/.test(adapterSrc)) {
    throw new Error(
      '[check-fixtures] spell-check.js:runCheck vocab object missing collocations — Phase 6 browser-wiring regression.'
    );
  }
  if (!/redundancyPhrases/.test(adapterSrc)) {
    throw new Error(
      '[check-fixtures] spell-check.js:runCheck vocab object missing redundancyPhrases — Phase 6 browser-wiring regression.'
    );
  }

  const langs = (!lang || lang === 'all') ? ['nb', 'nn', 'en', 'de', 'es', 'fr'] : [lang];
  let hardFail = false;
  const report = {};

  for (const l of langs) {
    const ruleDir = path.join(FIXTURE_DIR, l);
    if (!fs.existsSync(ruleDir)) continue;
    const vocab = loadVocab(l);
    const files = rule
      ? [rule + '.jsonl']
      : fs.readdirSync(ruleDir).filter(f => f.endsWith('.jsonl')).sort()
          // Exclude queue files consumed by scripts/add-fixture.js — these
          // have no `expected` field and would otherwise be treated as
          // "expect clean" fixtures and hard-fail the runner.
          .filter(f => f !== 'ai-requests.jsonl');
    report[l] = {};
    for (const file of files) {
      const ruleId = path.basename(file, '.jsonl');
      const filePath = path.join(ruleDir, file);
      if (!fs.existsSync(filePath)) continue;
      const cases = loadJsonl(filePath);
      // Partition out pending fixtures — cases tagged `pending: true` are
      // "known-failing pending upstream fix" (typically a data gap at the
      // Papertek vocabulary layer). They're evaluated for reporting but
      // don't contribute to P/R or the hard-fail exit. When the upstream
      // fix lands the case will start matching its expected, at which
      // point the `pending` flag should be removed so it joins the regular
      // regression suite.
      const pending = cases.filter(c => c.pending === true);
      const active = cases.filter(c => c.pending !== true);
      const results = active.map(c => runCase(c, vocab, l));
      const pendingResults = pending.map(c => runCase(c, vocab, l));
      const pendingNowPassing = pendingResults.filter(r => r.ok).length;
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

      // ── Phase 4 / SC-05 threshold gate ──
      //
      // When THRESHOLDS has an entry for this (lang, rule), verify observed
      // P and R stay at or above the locked floor. Any dip flips hardFail
      // and prints a named diagnostic. Locked values live in the THRESHOLDS
      // table at the top of this file; see Plan 04-03 SUMMARY for rationale.
      const req = THRESHOLDS[l] && THRESHOLDS[l][ruleId];
      if (req) {
        if (stats.P < req.P) {
          console.log('[' + l + '/' + ruleId + '] THRESHOLD FAIL: P=' + stats.P.toFixed(3) + ' < ' + req.P);
          hardFail = true;
        }
        if (stats.R < req.R) {
          console.log('[' + l + '/' + ruleId + '] THRESHOLD FAIL: R=' + stats.R.toFixed(3) + ' < ' + req.R);
          hardFail = true;
        }
      }

      if (pendingOnly && !json) {
        for (const r of pendingResults) {
          const tag = r.ok ? 'NOW-PASSING — remove `pending` flag' : 'still failing';
          console.log('[' + l + '/' + ruleId + '] ' + r.id + ' (' + tag + ') — ' + JSON.stringify(r.text));
          if (!r.ok) {
            if (r.missing.length) console.log('    missing: ' + JSON.stringify(r.missing));
            if (r.extra.length)   console.log('    extra:   ' + JSON.stringify(r.extra));
          }
        }
      }

      if (!json && !pendingOnly) {
        const pendingNote = pending.length
          ? '  (' + pending.length + ' pending, skipped' +
              (pendingNowPassing ? '; ' + pendingNowPassing + ' now passing — remove `pending` flag' : '') + ')'
          : '';
        console.log(
          '[' + l + '/' + ruleId + '] ' +
          'P=' + stats.P.toFixed(3) +
          ' R=' + stats.R.toFixed(3) +
          ' F1=' + stats.F1.toFixed(3) +
          '  ' + passed + '/' + results.length + ' pass' +
          pendingNote
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

  // ── Phase 7 / INFRA-06: acceptance ratio enforcement for word-order rules ──
  //
  // Word-order rules (V2, verb-final, BAGS) carry a higher false-positive risk
  // than token-level rules because they depend on POS-tagging accuracy. To
  // guard against shipping under-tested rules, we enforce that each rule's
  // fixture file contains at least 2x as many acceptance (clean) cases as
  // positive (flagging) cases. This ensures every rule is tested against a
  // broad set of correct sentences that must NOT be flagged.
  //
  // Counted per rule-specific fixture file (e.g. fixtures/nb/v2.jsonl):
  //   positive  = cases where `expected` has at least one entry
  //   acceptance = cases where `expected` is empty (clean sentence)
  //
  // Skipped if no fixture file exists yet (rule hasn't landed).
  const ACCEPTANCE_RATIO_RULES = new Set(['nb-v2', 'de-v2', 'de-verb-final', 'fr-bags']);

  // Map rule IDs to language + fixture filename
  for (const ruleId of ACCEPTANCE_RATIO_RULES) {
    const parts = ruleId.split('-');
    const ruleLang = parts[0];
    const fixtureBase = parts.slice(1).join('-');
    const fixturePath = path.join(FIXTURE_DIR, ruleLang, fixtureBase + '.jsonl');
    if (!fs.existsSync(fixturePath)) continue;
    const cases = loadJsonl(fixturePath).filter(c => c.pending !== true);
    if (cases.length === 0) continue;
    const positive = cases.filter(c => Array.isArray(c.expected) && c.expected.length > 0).length;
    const acceptance = cases.filter(c => !Array.isArray(c.expected) || c.expected.length === 0).length;
    if (positive > 0 && acceptance < 2 * positive) {
      console.log(
        '[check-fixtures] FAIL: Rule ' + ruleId + ' has ' + positive +
        ' positive and ' + acceptance + ' acceptance fixtures — need >=2x acceptance (minimum ' + (2 * positive) + ')'
      );
      hardFail = true;
    }
  }

  if (json) console.log(JSON.stringify(report, null, 2));
  process.exit(hardFail ? 1 : 0);
}

main();
