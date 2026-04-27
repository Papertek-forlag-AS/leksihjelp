#!/usr/bin/env node
/**
 * Leksihjelp — Baseline NB trimmer (Phase 23-03)
 *
 * Reads the full bundled NB vocab (extension/data/nb.json) plus the freq +
 * bigram sidecars and produces a compact `extension/data/nb-baseline.json`
 * that fits under the 200 KB cap enforced by
 * `scripts/check-baseline-bundle-size.js`.
 *
 * The baseline is the ONLY data file shipped in the extension zip going
 * forward (plan 23-05 removes bundled de/es/fr/en/nn). Its job is to keep
 * NB lookups, spell-check, and word-prediction functional from cold-start
 * while the service worker bootstraps the user's selected target language(s)
 * into IndexedDB in the background.
 *
 * What's kept:
 *   • Banks (verbbank, nounbank, adjectivebank, generalbank, languagesbank,
 *     nationalitiesbank, collocationbank, grammarbank): only entries whose
 *     lemma has Zipf ≥ ZIPF_MIN. Structural banks listed in `KEEP_ALL_BANKS`
 *     (currently just `grammarbank`) are kept whole regardless of frequency.
 *   • Per-entry: only fields buildIndexes consumes. Display-only fields
 *     (examples, explanation, audio, cefr, _examples_source, linkedTo) are
 *     dropped — the popup would never reach them on the baseline path
 *     because the cache hydrates the full bundle within seconds.
 *   • freq: only entries for lemmas we kept.
 *   • bigrams: empty by default (Zipf ≥ ZIPF_MIN entries are common enough
 *     that the wordList ranking carries the spell-check experience without
 *     bigram boost on the baseline). If you want bigrams, set
 *     BIGRAM_PAIR_CAP > 0 — but watch the size budget.
 *
 * Output format: minified JSON (no pretty-print). The plan asked for
 * pretty-print for repo readability, but at Zipf=5.0 that exceeds 200 KB
 * (~217 KB pretty vs ~127 KB minified). Since the data file's job is to
 * be small and the project's `check-bundle-size` gate already minifies
 * all `data/*.json` into the zip anyway, shipping minified at source loses
 * no contributor readability — the file is opaque vocabulary data either
 * way. If readability becomes important later, the safer trim is to raise
 * ZIPF_MIN further rather than pretty-print at the cap.
 *
 * Note: pronounsbank/articlesbank/typobank don't exist in this nb.json
 * shape — the plan's "keep all pronouns + articles + typos unconditionally"
 * lists are inapplicable here. Pronouns and articles are folded into
 * generalbank by the Papertek API; their high frequency means Zipf ≥ 5
 * keeps them anyway. Per-entry `typos` arrays still ride along on every
 * kept entry, satisfying the typo-recovery intent of the plan.
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NB_PATH = path.join(ROOT, 'extension/data/nb.json');
const FREQ_PATH = path.join(ROOT, 'extension/data/freq-nb.json');
const BIGRAMS_PATH = path.join(ROOT, 'extension/data/bigrams-nb.json');
const OUT_PATH = path.join(ROOT, 'extension/data/nb-baseline.json');
const CEILING_BYTES = 200 * 1024;

// ── Tunables ──
const ZIPF_MIN = 5.0;
const BIGRAM_PAIR_CAP = 0; // raise to keep top-N pairs; 0 = drop bigrams entirely
const KEEP_ALL_BANKS = new Set(['grammarbank']);
const ESSENTIAL_FIELDS = new Set([
  'word', 'type',
  'genus', 'plural', 'forms',                 // nouns
  'conjugations', 'verbClass', 'auxiliary',   // verbs
  'comparison', 'declension',                 // adjectives
  'typos', 'frequency', 'grammarFeatures',    // shared
]);
const KNOWN_BANKS = [
  'verbbank', 'nounbank', 'adjectivebank',
  'generalbank', 'languagesbank', 'nationalitiesbank',
  'collocationbank', 'grammarbank',
];

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function trimEntry(ent) {
  const out = {};
  for (const k of Object.keys(ent)) {
    if (ESSENTIAL_FIELDS.has(k)) out[k] = ent[k];
  }
  return out;
}

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function main() {
  const nb = loadJson(NB_PATH);
  const freq = loadJson(FREQ_PATH);
  const bigrams = loadJson(BIGRAMS_PATH);

  const baseline = {
    _metadata: nb._metadata || {},
    schema_version: 1,
    revision: 'baseline',
  };

  const perBankCounts = {};
  const keptLemmas = new Set();

  for (const bank of KNOWN_BANKS) {
    const src = nb[bank];
    if (!src) continue;
    const out = {};
    let kept = 0;
    let dropped = 0;
    for (const [id, ent] of Object.entries(src)) {
      const w = (ent.word || '').toLowerCase();
      const zipf = freq[w];
      const keep = KEEP_ALL_BANKS.has(bank)
        || (typeof zipf === 'number' && zipf >= ZIPF_MIN);
      if (keep) {
        out[id] = trimEntry(ent);
        if (w) keptLemmas.add(w);
        kept++;
      } else {
        dropped++;
      }
    }
    baseline[bank] = out;
    perBankCounts[bank] = { kept, dropped };
  }

  // Trimmed freq — only entries for kept lemmas.
  const trimmedFreq = {};
  for (const w of keptLemmas) {
    if (typeof freq[w] === 'number') trimmedFreq[w] = freq[w];
  }
  baseline.freq = trimmedFreq;

  // Bigrams — top-N joint pairs whose head is a kept lemma. Default 0.
  const trimmedBigrams = {};
  if (BIGRAM_PAIR_CAP > 0) {
    const pairs = [];
    for (const [head, tails] of Object.entries(bigrams)) {
      if (head.startsWith('_')) continue; // skip _metadata
      if (!keptLemmas.has(head.toLowerCase())) continue;
      for (const [tail, count] of Object.entries(tails)) {
        pairs.push([head, tail, count]);
      }
    }
    pairs.sort((a, b) => b[2] - a[2]);
    for (const [h, t, c] of pairs.slice(0, BIGRAM_PAIR_CAP)) {
      if (!trimmedBigrams[h]) trimmedBigrams[h] = {};
      trimmedBigrams[h][t] = c;
    }
  }
  baseline.bigrams = trimmedBigrams;

  // Minified output — see header for rationale. The 200 KB cap doesn't
  // leave headroom for pretty-printing at Zipf=5.0.
  const json = JSON.stringify(baseline);
  fs.writeFileSync(OUT_PATH, json);
  const size = fs.statSync(OUT_PATH).size;

  // ── Report ──
  console.log('Wrote ' + path.relative(ROOT, OUT_PATH));
  console.log('  Size: ' + fmtKB(size) + ' / ' + fmtKB(CEILING_BYTES) + ' cap');
  console.log('  Zipf threshold: ' + ZIPF_MIN);
  console.log('  Bigram pair cap: ' + BIGRAM_PAIR_CAP);
  console.log('  Lemmas kept: ' + keptLemmas.size);
  console.log('  freq entries: ' + Object.keys(trimmedFreq).length);
  console.log('  bigram heads: ' + Object.keys(trimmedBigrams).length);
  console.log('  Per-bank counts:');
  for (const [bank, counts] of Object.entries(perBankCounts)) {
    console.log('    ' + bank + ': kept=' + counts.kept + ', dropped=' + counts.dropped);
  }

  if (size > CEILING_BYTES) {
    console.error('FAIL — baseline exceeds 200 KB cap.');
    console.error('Raise ZIPF_MIN or drop bigrams to bring under.');
    process.exit(1);
  }
  console.log('OK — within cap.');
}

main();
