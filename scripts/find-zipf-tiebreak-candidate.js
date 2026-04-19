#!/usr/bin/env node

/**
 * Leksihjelp — Zipf-tiebreaker candidate finder (Phase 3-03 dev aid)
 *
 * One-shot developer script to surface NB/NN typo-candidate triples where
 * the Zipf frequency tiebreaker decides the winner. Used to author the new
 * `nb-typo-zipf-*` fixture cases for SC-01.
 *
 * What it does:
 *   1. Loads validWords + freq Map for NB (and optionally NN) via the same
 *      vocab-seam-core path as scripts/check-fixtures.js.
 *   2. For each W in validWords with length 5-8 (plausible student-typo
 *      surface), mutates one character at positions 2..len-1 (skips position
 *      0 because the fuzzy matcher requires first-char match; skips last
 *      position to dodge inflection-collapse noise).
 *   3. For each mutation M, finds all validWords neighbors N at edit
 *      distance 1, sharing first character with M, neither equal to W
 *      itself.
 *   4. Among neighbor pairs, looks for cases where:
 *        - both neighbors are at edit-distance exactly 1 from M
 *        - neither is an adjacent transposition of M
 *        - both have a Zipf entry, with gap > 1.0
 *        - today's score (without Zipf) ties or favours the LOWER-Zipf
 *          candidate
 *      Those are the strongest SC-01 cases.
 *   5. Prints up to 20 triples sorted by Zipf-gap descending. Exit 0.
 *
 * NOT shipped — dev-only. Not wired into npm scripts. Not part of the
 * Release Workflow gates.
 *
 * Usage:
 *   node scripts/find-zipf-tiebreak-candidate.js          # NB only (default)
 *   node scripts/find-zipf-tiebreak-candidate.js nn       # NN only
 *   node scripts/find-zipf-tiebreak-candidate.js all      # NB + NN
 */

'use strict';

const fs = require('fs');
const path = require('path');

const vocabCore = require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(__dirname, '..', 'extension', 'content', 'spell-check-core.js'));

const DATA_DIR = path.join(__dirname, '..', 'extension', 'data');

// Borrow the exact helpers the production matcher uses, so the "today's
// score" we compute below is byte-equivalent to what the rule would emit.
const {
  editDistance,
  sharedPrefixLen,
  sharedSuffixLen,
  isAdjacentTransposition,
} = spellCore;

// Pre-Zipf scoreCandidate — this is the formula the production rule uses
// today (mirrors spell-check-core.js scoreCandidate verbatim). Used to
// compute "would today's score tie or pick the lower-Zipf candidate".
function scoreCandidateToday(query, cand, d) {
  const pref = sharedPrefixLen(query, cand);
  const suff = sharedSuffixLen(query, cand);
  let s = pref * 15 + suff * 10 - d * 100;
  if (cand.length < query.length) s -= 50;
  if (isAdjacentTransposition(query, cand)) s += 40;
  return s;
}

function loadVocab(lang) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang + '.json'), 'utf8'));
  const freqFile = path.join(DATA_DIR, 'freq-' + lang + '.json');
  let freq = null;
  if (fs.existsSync(freqFile)) {
    freq = JSON.parse(fs.readFileSync(freqFile, 'utf8'));
  }
  return vocabCore.buildIndexes({
    raw,
    freq,
    lang,
    isFeatureEnabled: () => true,
  });
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzæøå'.split('');

function findTriples(lang) {
  const vocab = loadVocab(lang);
  const { validWords, freq } = vocab;
  if (!freq || freq.size === 0) {
    console.error(`[${lang}] no Zipf data — skipping`);
    return [];
  }

  // Pre-bucket validWords by first-char + length range so we can skip a
  // ton of candidates per mutation. Length range = ±1 from word length.
  const byFirstAndLen = new Map(); // 'b|5' → ['bedre', 'berre', ...]
  for (const w of validWords) {
    if (!w || w.length < 4) continue;
    const key = w[0] + '|' + w.length;
    let arr = byFirstAndLen.get(key);
    if (!arr) { arr = []; byFirstAndLen.set(key, arr); }
    arr.push(w);
  }

  const triples = [];
  let inspected = 0;

  for (const W of validWords) {
    const len = W.length;
    if (len < 5 || len > 8) continue;
    if (!freq.has(W)) continue;
    inspected++;

    // Mutate at positions 2..len-2 (inclusive on both ends — skip 0 + skip last).
    // For each position, try every alphabet letter EXCEPT the original.
    for (let pos = 2; pos < len - 1; pos++) {
      const orig = W[pos];
      for (const ch of ALPHABET) {
        if (ch === orig) continue;
        const M = W.slice(0, pos) + ch + W.slice(pos + 1);

        // M must NOT itself be a valid word — otherwise it's not a typo.
        if (validWords.has(M)) continue;

        // Find all neighbors of M at edit-distance 1, same first char.
        // We bucket-scan by first char + length ±1.
        const first = M[0];
        const candidates = [];
        for (const dl of [-1, 0, 1]) {
          const arr = byFirstAndLen.get(first + '|' + (M.length + dl));
          if (!arr) continue;
          for (const cand of arr) {
            if (cand === M) continue;
            const d = editDistance(M, cand, 1);
            if (d !== 1) continue;
            candidates.push(cand);
          }
        }

        if (candidates.length < 2) continue;

        // Pull out the candidate with the highest Zipf, and the highest non-
        // adjacent-transposition candidate. We want pairs where neither is
        // adjacent-transposition of M (so the existing +40 bonus doesn't
        // muddy the Zipf signal).
        const scored = candidates
          .filter(c => freq.has(c))
          .map(c => ({
            cand: c,
            zipf: freq.get(c),
            todayScore: scoreCandidateToday(M, c, 1),
            isTransp: isAdjacentTransposition(M, c),
          }))
          .sort((a, b) => b.zipf - a.zipf);

        if (scored.length < 2) continue;

        // Find pairs (winner, loser) where winner.zipf > loser.zipf + 1.0,
        // both !isTransp, and today's scores tie OR loser wins.
        for (let i = 0; i < scored.length; i++) {
          for (let j = i + 1; j < scored.length; j++) {
            const a = scored[i]; // higher zipf
            const b = scored[j]; // lower zipf
            if (a.zipf - b.zipf < 1.0) continue;
            if (a.isTransp || b.isTransp) continue;
            if (a.todayScore > b.todayScore) continue; // already winning — Zipf not needed
            // Strong cases: today ties or picks the lower-Zipf candidate.
            triples.push({
              lang,
              source: W,
              typo: M,
              winner: a.cand,
              winnerZipf: a.zipf,
              loser: b.cand,
              loserZipf: b.zipf,
              gap: a.zipf - b.zipf,
              todayWinnerScore: a.todayScore,
              todayLoserScore: b.todayScore,
              todayPicks: a.todayScore > b.todayScore ? a.cand
                        : a.todayScore < b.todayScore ? b.cand
                        : 'TIE',
            });
          }
        }
      }
    }
  }

  triples.sort((p, q) => q.gap - p.gap);
  console.error(`[${lang}] inspected ${inspected} source words; emitted ${triples.length} triples`);
  return triples;
}

function main() {
  const arg = (process.argv[2] || 'nb').toLowerCase();
  const langs = arg === 'all' ? ['nb', 'nn'] : [arg];
  const all = [];
  for (const l of langs) {
    if (l !== 'nb' && l !== 'nn') {
      console.error(`Unknown language '${l}' — skipping`);
      continue;
    }
    all.push(...findTriples(l));
  }
  all.sort((a, b) => b.gap - a.gap);
  const top = all.slice(0, 20);
  for (const t of top) {
    console.log(
      `TRIPLE: lang=${t.lang} source='${t.source}' typo='${t.typo}' winner='${t.winner}' (Zipf ${t.winnerZipf}) ` +
      `loser='${t.loser}' (Zipf ${t.loserZipf}) gap=${t.gap.toFixed(2)} ` +
      `today-scores: winner=${t.todayWinnerScore} loser=${t.todayLoserScore} → today-picks=${t.todayPicks}`
    );
  }
  if (top.length === 0) {
    console.log('No triples surfaced under the strict criteria. Try widening — drop the "today picks loser-or-ties" guard, or lower the Zipf gap.');
  }
  process.exit(0);
}

main();
