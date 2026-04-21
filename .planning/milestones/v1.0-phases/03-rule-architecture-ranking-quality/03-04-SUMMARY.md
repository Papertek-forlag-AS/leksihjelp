---
phase: 03-rule-architecture-ranking-quality
plan: 04
subsystem: word-prediction
tags: [frequency, zipf, ranking, tiebreakers, signal-table, pitfall-7, language-switch]

# Dependency graph
requires:
  - phase: 02-data-layer-frequency-bigrams-typo-bank
    provides: extension/data/freq-{nb,nn}.json Zipf sidecars (DATA-01); raw `entry.frequency` integer already shipping in extension/data/{de,es,fr,en}.json per source DATA-01 sync
  - phase: 03-rule-architecture-ranking-quality
    provides: VOCAB.getFrequency(word) wired through the seam (03-01); plugin registry keeping spell-rules surface separable from word-prediction (03-02)
provides:
  - entry.zipf field on every wordList row (seam-normalized log10(frequency + 1), Pitfall 7 guard)
  - freqSignal (WP-01) contributing score ~0..140 per candidate, scale-comparable to the +120 bigram cap
  - Deterministic sort tiebreaker chain (WP-03): score → effective-freq → length-match → suffix-match → alpha
  - lowFreqDemotion (WP-04): -80 penalty when 0 < zipf < 1.5 (learner-core vocab unaffected)
  - Language-switch-handler repair (inline flag switcher now broadcasts LANGUAGE_CHANGED cleanly instead of throwing mid-handler)
affects: [04-threshold-calibration-release-gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall 7 normalization: raw per-language `frequency` integer normalized once at seam build time to log10+1 Zipf-alike float; ranker reads the normalized field only, never the raw"
    - "Effective-frequency lookup: getEffectiveFreq(entry) prefers VOCAB.getFrequency (Zipf sidecar) and falls back to entry.zipf — single helper makes every signal scale-uniform across all 6 languages"
    - "Deterministic ranker tiebreaker chain: score → effective-freq → length-match → suffix-match → localeCompare; gives dev-readable, reproducible output when earlier signals tie"
    - "Signal-table refactor: applyBoosts uses a workingEntry pattern (instead of mutating `entry`) so the final `scored.push` is unambiguous; per-language signals self-guard via field-presence checks (Pitfall 6)"

key-files:
  created: []
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/word-prediction.js

key-decisions:
  - "Phase 3-04: `entry.zipf = log10(entry.frequency + 1)` normalization attached to every wordList push inside buildWordList (Pitfall 7). All six languages — including the sidecar-backed NB/NN — get `entry.zipf` populated; NB/NN entries still PREFER VOCAB.getFrequency (Zipf sidecar, real corpus values) but entry.zipf is the universal fallback so the ranker has one code path."
  - "Phase 3-04: freqSignal multiplier is 20 — top-Zipf (~7) adds +140, zero-Zipf adds 0. Bigram signal caps at +120; the two top out scale-comparable so neither signal dominates the ranker. No per-language multiplier tuning — Pitfall 7 is handled at normalization time, not at ranking time."
  - "Phase 3-04: lowFreqDemotion floor Zipf 1.5 and demotion -80. Entries with Zipf === 0 are LEFT ALONE — 'no sidecar data' ≠ 'rare word' (proper nouns and niche learner-core entries often lack corpus presence without being rare). The 1.5 floor is generous enough that learner-core vocab never triggers it."
  - "Phase 3-04: sharedSuffixLen helper declared locally in word-prediction.js (not imported from spell-check surface) — INFRA-04 structural separability. Mirrors the spell-check core helper, no shared module."
  - "Phase 3-04: scored.sort tiebreaker chain locked in as score → effective-freq → length-match → suffix-match → alphabetical (localeCompare). Alphabetical last-resort gives dev-readable + reproducible output for debugging (two tied candidates always sort the same way across runs)."
  - "Phase 3-04: switchPredictionLang trimmed to persist + broadcast only. The pre-refactor body called loadGrammarFeatures + loadWordList (both deleted during the Plan 01-02 seam cutover) — a latent ReferenceError on the inline flag-switcher click path flagged by 01-VERIFICATION.md line 121 at the time but never fixed because the popup-driven language switch bypassed this helper. Fix relies on the existing service-worker broadcast pattern: chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED' }) → broadcastToAllTabs re-broadcasts to all tabs (including sender) → existing onMessage handlers in vocab-seam.js + word-prediction.js do the actual reload work."
  - "Phase 3-04: post-switch `schedulePrediction(activeElement)` removed — a 100ms-debounced prediction scheduled against an in-flight seam reload races the new wordList. User's next keystroke drives a fresh prediction naturally once the seam signals ready. Safer-by-removal; no user-visible delay because typing is continuous."

patterns-established:
  - "Pitfall 7 zipf normalization: compute `const zipf = freq > 0 ? Math.log10(freq + 1) : 0` once per source entry inside the seam-core buildWordList, attach to every emitted wordList push; ranker reads the normalized field only. Ranker stays per-language-agnostic without losing the per-entry frequency signal."
  - "Effective-frequency abstraction: getEffectiveFreq(entry) checks VOCAB.getFrequency(entry.word) first (sidecar, authoritative for languages that ship one), falls back to entry.zipf (seam-normalized), returns 0 if neither. Every frequency-sensitive code path in the ranker reads through this helper, never raw entry.frequency — Pitfall 7 guard at the API boundary, not per-call-site."
  - "Signal-table refactor for multi-signal score accumulation: applyBoosts uses a single workingEntry variable that carries the (possibly re-typed) candidate through numbered signal blocks; each block either mutates score with += delta or no-ops via a field-presence check. Replaces the old 'if-chain that mutates entry + pushes at the bottom' pattern. Caller sites don't change — refactor is internal to the function body."
  - "Deterministic ranker tiebreaker chain: when score ties, fall back to effective-frequency, then to length-match-to-query, then to longer-shared-suffix, then to alphabetical. Last rung (localeCompare) guarantees reproducible output across runs — critical for debugging tie-sensitive rankings."
  - "Language-switch via service-worker re-broadcast: content-script-initiated switches just persist + sendMessage; the service worker's broadcastToAllTabs re-broadcasts to all tabs including the sender, re-entering the existing onMessage handlers. No custom sync-reload logic needed in the sender; pattern scales to any future cross-tab state change."

requirements-completed: [WP-01, WP-03, WP-04]

# Metrics
duration: 1h 30m
completed: 2026-04-20
---

# Phase 03 Plan 04: Word-Prediction Frequency Signal + Tiebreakers + Low-Freq Demotion Summary

**Word-prediction ranker now reads a universal frequency signal (Zipf sidecar for NB/NN, seam-normalized log10(freq+1) for DE/ES/FR/EN) with deterministic tiebreakers and a low-frequency demotion floor — top-3 suggestions visibly rank by corpus frequency across all 6 languages.**

## Performance

- **Duration:** 1h 30m (including a human-verify round-trip that surfaced and fixed a latent language-switch ReferenceError from Plan 01-02)
- **Started:** 2026-04-19T11:49:54Z (Task 1 commit)
- **Completed:** 2026-04-20T09:02:22Z (fix commit after human re-verify)
- **Tasks:** 3 planned + 1 unplanned fix (latent Phase 1 bug surfaced by Plan 03-04 verification)
- **Files modified:** 2

## Accomplishments

- Every wordList entry now carries a `zipf` field (Pitfall 7 normalization; verified 33 857/33 857 NB, 36 922/36 922 NN, 35 731/36 116 DE, 24 505/26 056 ES, 21 324/24 155 FR, 12 175/16 119 EN entries with zipf > 0).
- Ranker reads frequency via getEffectiveFreq (Zipf sidecar > entry.zipf > 0); raw `entry.frequency` is never read inside applyBoosts.
- freqSignal contributes up to ~140 score points (zipf × 20); comparable to the +120 bigram cap so neither signal dominates.
- Deterministic sort chain implemented: score → effective-freq → length-match → shared-suffix → alphabetical.
- lowFreqDemotion (-80 when 0 < zipf < 1.5) keeps obscure forms out of the top-3 without penalizing entries that legitimately have no corpus data (zipf === 0 left alone).
- applyBoosts refactored to the workingEntry / numbered-signal pattern; caller sites unchanged.
- Latent language-switch-handler ReferenceError (pre-existing from Plan 01-02 seam cutover) fixed — inline flag switcher now cleanly broadcasts LANGUAGE_CHANGED instead of throwing on deleted loadGrammarFeatures/loadWordList calls.
- User re-verified all 6 languages in Chrome via the inline flag switcher; ranker contract holds on 5/6 languages clearly (NB/NN/DE/ES/FR); EN is a data-shape issue confirmed out-of-scope for this plan (tracked separately).

## Task Commits

Each task was committed atomically:

1. **Task 1: Seam-side entry.zipf normalization for all languages** — `0ae8863` (feat)
2. **Task 2: Signal table + deterministic tiebreakers + low-freq demotion** — `29c07f0` (feat)
3. **Task 3 (human-verify checkpoint):** surfaced a latent Phase 1 bug on first attempt → fixed → re-verified by user → approved.

Unplanned follow-up commits surfaced during Task 3 verification:

4. **Fix: language-switch handler repair** — `3bf83a4` (fix) — removed stale `loadGrammarFeatures(lang)` + `loadWordList(lang)` calls from `switchPredictionLang`; functions were deleted in Plan 01-02's seam cutover, leaving a latent ReferenceError on the inline flag-switcher click path (flagged at the time in `01-VERIFICATION.md` line 121 as "known issue, not blocking"). Minimum-surface repair: persist + broadcast only; the existing service-worker broadcast pattern re-enters the onMessage handlers which do the actual reload work.
5. **Fix: absolute path for service-worker importScripts** — `7150ad0` (fix) — out-of-plan; pre-existing latent bug from commit `b3857af`. MV3 service workers resolve importScripts paths relative to the extension root, not the script's own location; the leading `../` was rejected by Chrome 130+ and was killing the service worker on startup. Surfaced during Plan 03-04 human verification when the orchestrator investigated console output. Committed by the orchestrator; listed here only so the plan-level record is complete — **not claimed under Task 3**.

**Plan metadata:** committed at end of plan (docs).

_Note: Commits 4 and 5 sit outside the plan's task list but are load-bearing to Plan 03-04's acceptance criterion (inline-switcher verification across 3+ languages). Commit 4 is attributable to Plan 03-04 execution; commit 5 is purely orchestrator-side plumbing._

## Files Created/Modified

- `extension/content/vocab-seam-core.js` — Added `zipf` field to every wordList push inside `buildWordList`. Zipf = `frequency > 0 ? Math.log10(frequency + 1) : 0`. Computed once per source bank entry; attached to base + translation + typo + accepted + conjugation + participle + case + nounform + plural + comparative + superlative + adjform push sites so every emitted row is scale-uniform for the ranker. Zero schema changes; raw `frequency` field stays in-place for any consumer that still reads it directly.
- `extension/content/word-prediction.js` — Added four module-scope helpers near the top of the IIFE (`getEffectiveFreq`, `sharedSuffixLen`, `freqSignal`, `lowFreqDemotion`); refactored `applyBoosts` to the workingEntry / numbered-signal pattern with frequency + demotion appended as signals #10 and #11; replaced `scored.sort((a,b) => b.score - a.score)` with the five-rung deterministic tiebreaker chain; trimmed `switchPredictionLang` to persist + broadcast only (removed stale loadGrammarFeatures + loadWordList calls + racy post-switch schedulePrediction).

## Decisions Made

See `key-decisions` in frontmatter. Headline decisions:

- **Normalization at seam build time, not at ranker call time** — every wordList row carries `zipf` as a precomputed field; ranker reads it uniformly across all 6 languages. Pitfall 7 handled at the API boundary.
- **Sidecar-preferred for NB/NN** — VOCAB.getFrequency (real corpus Zipf from freq-{nb,nn}.json, populated by Plan 03-01) is authoritative; entry.zipf is the universal fallback. One getEffectiveFreq helper encapsulates both.
- **Zero-Zipf entries left alone by lowFreqDemotion** — absence of corpus data ≠ rarity. Only entries with 0 < zipf < 1.5 get the -80 penalty.
- **Deterministic tiebreaker chain** — score → effective-freq → length-match → shared-suffix → localeCompare. Alphabetical last-resort gives dev-readable, reproducible output.
- **Signal self-guards via field presence, not via language checks** — Pitfall 6 avoided. NB/NN-specific signals (e.g. `pronounContext === '_nb_pronoun'`) and DE-specific signals (e.g. `workingEntry.caseName`) naturally no-op for other languages because their entries lack the trigger fields.
- **Language-switch fix relies on the existing service-worker broadcast pattern** — no custom sync-reload logic. `switchPredictionLang` just persists + sends LANGUAGE_CHANGED; the broadcast is re-entered by the existing onMessage handlers in both vocab-seam.js and word-prediction.js.

## Deviations from Plan

### Unplanned fixes surfaced during human-verify (Task 3)

**1. [Rule 1 - Bug] Repair language-switch handler so vocab reload actually runs**

- **Found during:** Task 3 (human-verify checkpoint; user reported NB/NN/EN showing DE suggestions)
- **Issue:** `switchPredictionLang` (the inline flag-switcher click handler) called `loadGrammarFeatures(lang)` and `loadWordList(lang)` — both deleted during the Plan 01-02 seam cutover. `loadGrammarFeatures` threw `ReferenceError: loadGrammarFeatures is not defined` on every click, aborting the handler before the `chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED' })` line could fire. Seam therefore never got the reload signal and stayed pointed at whatever language was loaded before the click. Flagged as a known issue at the time of the 01-02 cutover (see `01-VERIFICATION.md` line 121) but never fixed because the inline flag switcher is a narrow code path that bypasses the (working) popup-driven switch.
- **Fix:** Trimmed `switchPredictionLang` to the four things it legitimately owns — set local `currentLang`, persist via `chromeStorageSet`, broadcast LANGUAGE_CHANGED, `hideDropdown`. The service worker's `broadcastToAllTabs` re-broadcasts to all tabs including the sender, which re-enters the existing `onMessage` handlers in vocab-seam.js and word-prediction.js (the latter already awaits loadRecentWords + queues refreshFromVocab via VOCAB.onReady). Removed the trailing `schedulePrediction(activeElement)` call as well because it raced the in-flight seam reload.
- **Files modified:** `extension/content/word-prediction.js` (lines ~1262–1282)
- **Verification:** Node simulation of DE → each of NB/NN/EN/ES/FR confirms VOCAB.getWordList() returns the new language's own wordList and in-language top candidates surface for `ber`/`ber`/`hel`/`com`/`bon` prefixes. User re-verified all 6 languages in Chrome via the inline flag switcher; console clean.
- **Committed in:** `3bf83a4`

**2. [Out-of-plan, orchestrator-side] Absolute path for service-worker importScripts**

- **Found during:** Task 3 human-verify; orchestrator investigating console output noticed the service worker was dying on startup.
- **Issue:** Pre-existing latent bug from commit `b3857af`. MV3 service workers resolve importScripts paths relative to the extension root, not the script's own location; the leading `../` was rejected by Chrome 130+ and killed the service worker. This was masking the Plan 03-04 symptom further because a dead service worker can't broadcast LANGUAGE_CHANGED to tabs.
- **Fix:** Switched to canonical MV3 form `/i18n/strings.js`.
- **Committed in:** `7150ad0` (by orchestrator, not attributed to Plan 03-04 task work; listed in the task-commits section for completeness of the plan-level record)

**3. [Rule 2 - Missing Critical — anticipated in the plan] freqSignal + lowFreqDemotion added as signals #10 and #11 of applyBoosts**

- **Not actually a deviation** — the plan explicitly required these as new signals. Listed here only because applying them required the signal-table refactor pattern, which is structurally more invasive than the plan's step-1 description implies (every per-language signal re-tested against field-presence guards to preserve Pitfall-6 safety).

---

**Total deviations:** 2 auto-fixed (1 Rule 1 - Bug in Plan 03-04's execution scope; 1 out-of-plan orchestrator fix)
**Impact on plan:** Both fixes were load-bearing to Task 3's acceptance criterion (inline-switcher verification). Without the language-switch-handler repair, the ranker contract appeared broken at the UI level even though the ranker code itself was correct in Node simulation (verified before the fix). The orchestrator's service-worker importScripts fix was not attributable to Plan 03-04 execution but unblocked verification. No scope creep — both fixes removed existing blockers rather than adding new features.

## Issues Encountered

- **First human-verify attempt failed** — user reported NB/NN/EN returning DE suggestions. Initial static analysis + Node simulation could not reproduce; the ranker and seam code were correct in Node. I returned a diagnosis-only checkpoint asking the user for runtime DevTools output rather than guessing at a fix. User's runtime trace pinpointed the bug: `ReferenceError: loadGrammarFeatures is not defined` at `word-prediction.js:1265` on every flag-switcher click. Root cause identified, fix applied, user re-verified → approved.
- **English data-shape caveat** — EN prefix `hel` surfaces `heltid`, `helg`, `hel`, `helt` which are Norwegian headwords with English translations in the shared `en.json` data file. The ranker is applying its contract correctly on the `en.json` wordList as-given; the issue is that `en.json` is structured as "Norwegian headwords with English translations" rather than "English headwords with Norwegian translations". User explicitly accepted this as a data-source issue (to be fixed in a future phase via the Papertek API) and saved a memory entry; explicitly out-of-scope for Plan 03-04 per user instruction.
- **Console noise (benign)** — Plan 03-01's `loadRawFrequency` attempts `fetch('data/freq-{lang}.json')` for all 6 languages and gracefully returns null on 404. For DE/ES/FR/EN (no freq sidecar) Chrome logs `ERR_FILE_NOT_FOUND` in the Network tab. Intended behaviour; could be silenced with a HEAD-check before GET, but not blocking. Noted for future cleanup.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 03-05 (WP-02 EN bigrams + SC-06 network-silence gate)** was completed ahead of 03-04 in Wave 1; no dependency on 03-04. Phase 03 now complete 5/5 plans.
- **Phase 04 (threshold calibration + release gates)** unblocked. Plan 03-04 delivered the frequency signal + tiebreaker infrastructure; Phase 04's job is to calibrate precision/recall thresholds on the fixture suite and wire them into the release-gate script (`check-fixtures.js` exits 0/1 against the thresholds). The ranker is now deterministic enough (tiebreaker chain ensures reproducible output) that fixture-based threshold tuning is straightforward.
- **Follow-up (deferred, not blocking):**
  - `en.json` data-shape fix (English-headword wordList instead of Norwegian-headword with English translations) — user tracked as a memory entry; requires sibling-repo work in `papertek-vocabulary`.
  - `loadRawFrequency` HEAD-check to silence `ERR_FILE_NOT_FOUND` console noise for languages without a freq sidecar — cosmetic.

## Self-Check: PASSED

- File exists: extension/content/vocab-seam-core.js
- File exists: extension/content/word-prediction.js
- File exists: .planning/phases/03-rule-architecture-ranking-quality/03-04-SUMMARY.md
- Commit exists: 0ae8863 (Task 1)
- Commit exists: 29c07f0 (Task 2)
- Commit exists: 3bf83a4 (Task 3 fix — language-switch handler repair)
- Commit exists: 7150ad0 (out-of-plan orchestrator fix — service-worker importScripts absolute path)

---
*Phase: 03-rule-architecture-ranking-quality*
*Completed: 2026-04-20*
