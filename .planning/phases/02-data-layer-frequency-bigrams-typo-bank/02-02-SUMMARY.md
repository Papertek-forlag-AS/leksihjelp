---
phase: 02-data-layer-frequency-bigrams-typo-bank
plan: 02
subsystem: data
tags: [bigrams, nb-ngram-2021, stream-parse, max-merge, collocation]

requires:
  - phase: 01-foundation-vocab-seam-regression-fixture
    provides: vocab-seam-core buildIndexes() + validWords Set for intersection, check-fixtures harness for regression gate
provides:
  - scripts/build-bigrams.js — Node CommonJS stream parser for NB N-gram 2021 digibok-bigram corpus (CC-0, 7.15 GB gzipped)
  - extension/data/bigrams-nb.json regrown 57 → 2019 head-words (35.4×) at 32 KB gzipped
  - extension/data/bigrams-nn.json regrown 55 → 2022 head-words (36.8×) at 31 KB gzipped
  - build-bigrams npm script (was committed alongside build-frequencies in Plan 02-01 when both plans ran in wave-1 parallel)
  - Hand-authored idiom preservation invariant (Pattern 7 max-merge) — 314 (prev, next) pairs preserved with zero downgrades
affects: [03-word-prediction-ranking, 04-particles-spell-check, any future bigram-consuming feature]

tech-stack:
  added: [Node HTTP Range resume, NB N-gram 2021 digibok-bigram corpus reference]
  patterns: [max-merge bigram tables (hand-authored wins on tie), concentration-ratio weight bucketing (ratio=pairFreq/firstTotal → {1,2,3}), external-verify-over-snapshot full sweep for Pitfall-7]

key-files:
  created:
    - scripts/build-bigrams.js
  modified:
    - extension/data/bigrams-nb.json
    - extension/data/bigrams-nn.json
    - package.json (build-bigrams npm script — actually landed in Plan 02-01's commit because both plans ran in the same wave)

key-decisions:
  - "Keep build-bigrams independent of build-frequencies — no shared helper module for the corpus downloader; both scripts re-implement the ensureCorpus + streamCsv shape. Research Open Question 4 was settled in favour of independence: the downloader bodies have different error-retry surfaces and the planner flagged a shared helper as premature abstraction."
  - "Weight buckets use ratio = pairFreq / firstTotal (concentration of this continuation within all observed continuations of `first`), not the true Pointwise Mutual Information expected-under-independence formula. Thresholds 0.05 / 0.015 / else → {3, 2, 1}. Simpler to reason about, cheap to compute, and Phase 3 WP-02 is free to retune without a schema change."
  - "Pre-Phase-2 bigram files get snapshotted to /tmp/02-02-snapshot BEFORE the script runs, and the plan's verify block iterates EVERY (prev, next) triple independently. Defence-in-depth: the script's internal assertPreserved() is the first gate, the external full-sweep script is the second. 314 pairs × zero downgrades confirmed."
  - "Top-K-per-predecessor + top-N-predecessors budget enforcement — deriveBigrams takes top 2000 predecessors by corpus freq and top 8 continuations each; enforceBudget backs off (topContinuations 8→7→…→4, then topPredecessors 2000→1800→…→500) if the 50 KB gzipped cap is exceeded. For both NB and NN the initial settings came in well under budget (65% / 61%) with no backoff needed."

patterns-established:
  - "Resume-on-drop HTTP download: HEAD fetches Content-Length; GET with Range: bytes=N- resumes from disk offset; server-returned 206 triggers append mode, server-returned 200 triggers truncate + fresh start; no-progress streak counter (10 consecutive non-progressing retries) bounds the retry loop."
  - "CSV cell unquoting for NB N-gram schema: word cells are double-quoted ('Råholt' in source is literal \"Råholt\" on disk with embedded doubled-quotes for literal \"); symbol cells are bare (!, $, -, '). Parser locates first 4 commas, unquotes word positions, leaves remainder (json column) untouched."
  - "Idempotency-friendly writes: JSON.stringify with sorted top-level + alphabetical inner keys and no whitespace; second run produces byte-identical output."

requirements-completed: [DATA-03]

duration: 34 min
completed: 2026-04-18
---

# Phase 2 Plan 2: Bigrams (NB N-gram 2021) Summary

**Stream-parsed the 7.15 GB digibok-bigram.csv.gz corpus, derived top-K collocation tables per language, max-merged against hand-authored bigrams (314 curated pairs preserved with zero downgrades), and regrown both NB and NN files from ~55 head-words to ~2020 head-words while staying at ~65% of the 50 KB gzipped per-file budget.**

## Performance

- **Duration:** 34 min (wall-clock; 7.15 GB download was the dominant cost at ~20–25 min of that across 5 retry attempts)
- **Started:** 2026-04-18T17:57:07Z
- **Completed:** 2026-04-18T18:32:03Z
- **Tasks:** 1 (single-task plan with 8 behavioural assertions)
- **Files modified:** 3 (scripts/build-bigrams.js created, bigrams-nb.json + bigrams-nn.json regrown; package.json npm script landed in Plan 02-01's parallel commit)

## Accomplishments

- `scripts/build-bigrams.js` — 580-line Node CommonJS script with zero npm dependencies; handles HTTP Range resume across connection drops, comma-delimited CSV with quoted word cells, stream-parse over 50 GB decompressed data, per-predecessor concentration-ratio weight bucketing, max-merge that guarantees hand-authored idioms survive, gzipped-budget enforcement with backoff, idempotent sorted JSON output, and post-write sanity assertions.
- NB bigrams: 57 → 2019 head-words (35.4× growth), 786 → 32,442 gz bytes (0.79 KB → 32 KB, used 64.9% of 50 KB budget).
- NN bigrams: 55 → 2022 head-words (36.8× growth), 773 → 30,607 gz bytes (0.77 KB → 31 KB, used 61.2% of 50 KB budget).
- 314 hand-authored (prev, next) pairs independently verified preserved across both languages (zero downgrades) via the external full-sweep check that iterates every triple from the `/tmp/02-02-snapshot/` baseline.
- 5/5 canonical multi-word Norwegian collocations preserved at weight 3: `først og → fremst`, `i løpet → av`, `på grunn → av`, `i stedet → for`, `i tillegg → til`.
- 5,451 weight=3 pairs in NB total, meaning Phase 3's word-prediction ranking (WP-02) has real collocation density to work with.
- Regression fixture stable: 132/132 cases pass, `npm run check-fixtures` exits 0 — the bigram growth is additive data and touches no rule logic.
- Idempotency verified: second run produces byte-identical files.

## Task Commits

1. **Task 1: build-bigrams.js + regrown bigrams-nb/nn (DATA-03)** — `2babbf8` (feat)

## Files Created/Modified

- `scripts/build-bigrams.js` — new file (~580 lines). Zero-dep Node CommonJS pipeline: HEAD → ensureCorpus (Range-resume) → streamBigrams → deriveBigrams → mergeBigrams → enforceBudget → writeBigrams → assertPreserved (growth floor + Pitfall-7 triple-sweep).
- `extension/data/bigrams-nb.json` — regrown. 1 line of compact JSON, sorted top-level + alphabetical inner keys. 2019 head-words, 32442 gz bytes.
- `extension/data/bigrams-nn.json` — regrown. Same shape as NB. 2022 head-words, 30607 gz bytes.
- `package.json` — `build-bigrams` npm script ended up landing in Plan 02-01's `feat(02-01): build-frequencies.js + …` commit because both plans in wave 1 edited `package.json` in parallel and 02-01 committed slightly later while my edit was still unstaged.

## Decisions Made

- **Independent downloaders for frequencies vs. bigrams** — did not factor a shared `ensureCorpus` helper across Plan 02-01 and Plan 02-02 scripts. Closes Research Open Question 4 in favour of cheap duplication over premature abstraction; the error-retry surfaces differ enough that sharing would force both scripts into a lowest-common-denominator interface.
- **Concentration-ratio bucketing over true PMI** — `ratio = pairFreq / firstTotal` with thresholds 0.05 / 0.015 / else → {3, 2, 1}. Simpler than PMI-under-independence, reproducible across runs, cheap to compute in one streaming pass. Phase 3 ranking is free to retune weights without touching the schema.
- **External full-sweep Pitfall-7 gate** — `/tmp/02-02-snapshot/` pre-run baseline lets the verify block iterate every (prev, next) triple and assert preservation, independent of the script's internal `assertPreserved()` check. Defence in depth caught the issue during development that my `unquote()` helper was initially wrong (output had single-char "words" slipping through).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial download ended silently at 14%**
- **Found during:** Task 1, first `ensureCorpus()` invocation
- **Issue:** The NB file server drops the connection mid-stream for 7 GB files (first drop hit at ~1 GB mark). My first implementation `resolve`d on the WriteStream `finish` event which fires on any natural stream end — including a truncated upstream. Script exited with code 0 and the gunzip step would have later failed on corrupt data.
- **Fix:** Added `fetchExpectedSize()` HEAD request to learn the advertised total byte length, then made `downloadRange()` reject if `disk bytes < expectedSize`. Added a retry loop with `Range: bytes=N-` requests to resume from the last-written byte, a no-progress streak counter (10 consecutive retries that don't advance the disk byte count → abort), and exponential backoff between attempts.
- **Files modified:** scripts/build-bigrams.js (ensureCorpus rewritten)
- **Verification:** Full 7.15 GB download completed across 5 resume attempts with zero manual intervention; `gzip -t` accepts the file; streamed parse reads 243M lines without truncation.
- **Committed in:** 2babbf8 (Task 1 commit)

**2. [Rule 1 - Bug] CSV is comma-delimited with quoted word cells, not tab-delimited**
- **Found during:** Task 1, first parse-phase invocation showing "20,000,000 lines scanned, 0 kept" — the naive `line.split('\t')` was returning a 1-element array so the `parts.length < 4` guard rejected every line.
- **Issue:** The plan's context block claimed columns were tab-separated (`first \t second \t lang \t freq \t year_json`), matching the schema convention used elsewhere in the NB N-gram corpus family. The actual digibok-bigram.csv is comma-separated with quoted word cells: `"first","second",lang,freq,"{json...}"`. Plan 02-01 hit the same issue (their deviation note documents it) — the schema description in both plans' context blocks was wrong.
- **Fix:** Rewrote the CSV row parser to locate the first four commas by hand (`indexOf`) and unquote the word positions via a narrow `unquote()` helper that strips a single leading+trailing `"` and collapses embedded `""` → `"`. The fifth (json) column is never read so its embedded commas are harmless.
- **Files modified:** scripts/build-bigrams.js (streamBigrams + unquote helper)
- **Verification:** Parsed 14,785,635 NB rows in 139.6s and 2,304,205 NN rows in 145.6s; `Object.keys(bigramCounts).size` reports 599,361 distinct NB predecessors and 138,798 distinct NN predecessors, with canonical Norwegian content words ("dag", "morgen", "løpet", etc.) all represented.
- **Committed in:** 2babbf8 (Task 1 commit)

**3. [Rule 2 - Missing Critical] WORD_RE was accepting single-char punctuation**
- **Found during:** Task 1, manual CSV-parse sanity test run — the first kept row was `{first: "'", second: "'", freq: 1133859}`, which would land as a top-ranked "predecessor" in the output.
- **Issue:** The original `WORD_RE = /^[a-zæøåöü'-]+$/` admits any single character from the class, including bare `'` and `-`. The apostrophe and hyphen are legitimate inside words ("it's", "co-op") but worthless as standalone predecessors — they're OCR artifacts.
- **Fix:** Added a positive lookahead requiring at least one letter: `/^(?=.*[a-zæøåöü])[a-zæøåöü'-]+$/`.
- **Files modified:** scripts/build-bigrams.js
- **Verification:** Top-20 weight=3 pairs now all start with valid Norwegian words ("Tusen", "aar", "absolutt", "akkurat", etc.); no bare punctuation in the output.
- **Committed in:** 2babbf8 (Task 1 commit)

**4. [Rule 1 - Bug] Idempotency broken by over-strict growth floor**
- **Found during:** Task 1, second (idempotency test) invocation of `npm run build-bigrams` — script threw "coverage growth below target — pre=2019, post=2019, expected ≥ 20190" because assertPreserved's 10× floor compared against the ALREADY-enriched existing file.
- **Issue:** `assertPreserved()` requires `postHeads >= preHeads * 10` to guard against "builder ran but filters were wrong and nothing came out". On a fresh run this is the right check (57 → 2019 is 35.4× → passes). On a re-run, pre is already 2019, demanding 20190 — which is impossible under a 50 KB gz budget.
- **Fix:** Only apply the 10× floor when `preHeads <= 100` (i.e., the pre file is still at hand-authored scale). Re-runs of already-enriched files skip the floor; the Pitfall-7 triple-by-triple sweep still runs regardless and is the real correctness check.
- **Files modified:** scripts/build-bigrams.js (assertPreserved)
- **Verification:** Re-ran `npm run build-bigrams`; second run completed with "1.0× growth" (as expected for idempotency) and the written files are byte-identical to the first run (`diff -q` returns nothing).
- **Committed in:** 2babbf8 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs in download/parse, 1 missing regex tightening, 1 idempotency bug)
**Impact on plan:** All four fixes were necessary for correctness — the script literally could not complete a fresh-download run without fix #1, could not parse a row without fix #2, would produce garbage-topped output without fix #3, and could not be re-run without fix #4. No scope creep; the plan's behavioural assertions (schema preservation, hand-authored preservation, coverage growth, budget, word-list intersection, collocation sanity, idempotency, fixture pass-through) all pass unchanged.

## Issues Encountered

- Plan 02-01 ran in parallel in wave 1, and its commit landed our shared `package.json` edits (both `build-frequencies` and `build-bigrams`). Nothing to fix — the commit message and file contents are both correct — just an unusual coordination artifact to document.
- The plan's `<interfaces>` block asserted tab-delimited CSV for the NB N-gram 2021 corpus; in reality this version of the corpus is comma-delimited with quoted word cells. Plan 02-01 hit the same schema surprise. Updating the Research note or the plan's interfaces block is a Phase-3 housekeeping item but doesn't affect the shipped DATA-01 / DATA-03 artifacts.

## User Setup Required

None — no external service configuration required. The script depends only on public CC-0 data from `nb.no` and the Phase-1 vocab-seam-core module.

## Next Phase Readiness

- DATA-03 complete. Phase 2 continues with 02-03 (DATA-02: typo-bank deduplication + NN infinitive normalisation, cross-repo) and 02-04 (DATA-04: bundle-size gate + JSON minification).
- Phase 3's WP-02 (word-prediction ranking) now has ~5,451 weight-3 collocation pairs in NB and comparable density in NN. The ranker can use `bigrams[prev][next]` as a context-aware boost without further data work.
- The `build-bigrams` + `build-frequencies` scripts share the `corpus/` cache directory by convention but have independent ensureCorpus implementations. If future phases consolidate them into a shared helper, both scripts should be updated together to preserve their per-script error-retry semantics.
- No blockers for DATA-02 (Plan 02-03) — it operates on `papertek-vocabulary` source data, independent of the bigram work.

## Self-Check: PASSED

- scripts/build-bigrams.js: FOUND (580 lines)
- extension/data/bigrams-nb.json: FOUND (2019 head-words, 32442 gz bytes)
- extension/data/bigrams-nn.json: FOUND (2022 head-words, 30607 gz bytes)
- git log --oneline | grep 2babbf8: FOUND
- /tmp/02-02-snapshot/bigrams-{nb,nn}.pre.json: FOUND (snapshots retained)
- Fixture regression: exits 0 (132/132 pass)
- Full-sweep Pitfall-7 check: 314 pairs verified preserved (zero downgrades)

---
*Phase: 02-data-layer-frequency-bigrams-typo-bank*
*Completed: 2026-04-18*
