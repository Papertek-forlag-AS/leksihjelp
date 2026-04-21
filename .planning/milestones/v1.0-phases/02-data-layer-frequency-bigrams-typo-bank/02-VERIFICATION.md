---
phase: 02-data-layer-frequency-bigrams-typo-bank
verified: 2026-04-18T21:55:00Z
status: gaps_found
score: 3/4 success criteria verified
gaps:
  - truth: "Total packaged extension zip size from npm run package stays within the 10 MB ceiling (SC-4)"
    status: failed
    reason: "Post-minification zip is 10,599,772 bytes (10.11 MiB), 114,012 bytes over the 10,485,760-byte cap. check-bundle-size correctly exits 1. The infrastructure (gate + minification pipeline) is fully delivered and working; the cap itself is unmet."
    artifacts:
      - path: "backend/public/lexi-extension.zip"
        issue: "10,599,772 bytes — 114,012 bytes over the 10 MiB ROADMAP cap"
    missing:
      - "Phase 2.1 product decision: audit extension/data/en.json (4.65 MB, language not in CLAUDE.md supported list), or strip audio/de/ bundled TTS samples, or explicit ceiling bump with user sign-off + landing-page update"
human_verification:
  - test: "Confirm check-bundle-size exits 1 with the expected FAIL output on the current zip"
    expected: "Script prints 10.11 MiB, 114,012 bytes over cap, exits 1"
    why_human: "Automation can read the zip size but a human should confirm the gate is providing the intended signal and not a false positive."
---

# Phase 2: Data Layer (Frequency, Bigrams, Typo Bank) Verification Report

**Phase Goal:** The data foundations that pay twice — frequency tables and expanded bigrams for NB/NN plus additional typo-bank coverage in `papertek-vocabulary` — are bundled and synced, keeping the extension under the 10 MB budget.
**Verified:** 2026-04-18T21:55:00Z
**Status:** gaps_found — SC-1, SC-2, SC-3 fully verified; SC-4 (bundle-size ceiling) not met, documented as Blocker
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `npm run build-frequencies` produces `freq-nb.json` and `freq-nn.json`, each under 200 KB gzipped, from NB N-gram 2021 | VERIFIED | freq-nb.json: 13,132 entries, 61,585 gz bytes (69% headroom); freq-nn.json: 11,013 entries, 51,879 gz bytes (74% headroom). Zipf floor 0.0 per deviation from plan's 3.0 — budget enforcer governs output size. |
| SC-2 | `npm run sync-vocab` pulls a larger typo bank; regression fixture shows higher recall on NB typo cases without new NN false positives | VERIFIED | NB: 11,385 → 15,426 (+35.5%); NN: 7,417 → 15,167 (+104.5%). Fixture [nb/typo] F1=1.000 on 17 cases (was 11 pre-Phase-2); [nn/typo] F1=1.000 on 10 cases (no regression). Vocab-seam type='typo' validWords-pollution bug fixed; 13 typo-in-validWords collisions removed upstream. |
| SC-3 | `bigrams-nb.json` and `bigrams-nn.json` contain materially more high-frequency pairs, same schema | VERIFIED | NB: 57 → 2020 head-words (35.4x); NN: 55 → 2023 head-words (36.8x). 314 hand-authored (prev, next) pairs preserved with zero downgrades. Schema `{prev: {next: weight}}` intact. bigrams-nb.json: 32,442 gz bytes; bigrams-nn.json: 30,607 gz bytes (both well under 50 KB cap). |
| SC-4 | Total packaged extension zip size from `npm run package` stays within the 10 MB ceiling | FAILED | Zip is 10,599,772 bytes (10.11 MiB). Cap is 10,485,760 bytes (10.00 MiB). Overage: 114,012 bytes (0.11 MiB). `check-bundle-size` exits 1 as designed — gate is working correctly; the ceiling itself is unmet. Phase 2.1 queued. |

**Score:** 3/4 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/build-frequencies.js` | NB N-gram 2021 → Zipf freq sidecar builder | VERIFIED | 347 lines, zero npm deps, `zlib.createGunzip` present |
| `extension/data/freq-nb.json` | NB Zipf frequency table, <200 KB gz | VERIFIED | 13,132 entries, 61,585 gz bytes, top-10: og/i/det/som/en/til/er/av/for/at |
| `extension/data/freq-nn.json` | NN Zipf frequency table, <200 KB gz | VERIFIED | 11,013 entries, 51,879 gz bytes, top-10: og/i/det/til/som/er/-/av/med/for |
| `scripts/build-bigrams.js` | NB N-gram 2021 bigram corpus → regrown bigrams, max-merge | VERIFIED | 628 lines, `mergeBigrams` function present |
| `extension/data/bigrams-nb.json` | Expanded NB bigrams, `{prev: {next: weight}}` schema | VERIFIED | 2020 head-words, 32,442 gz bytes, `"først og"` key present |
| `extension/data/bigrams-nn.json` | Expanded NN bigrams, same schema | VERIFIED | 2023 head-words, 30,607 gz bytes |
| `extension/data/nb.json` (typo bank) | Larger typo bank synced from papertek-vocabulary | VERIFIED | 15,426 typo entries (was 11,385) |
| `extension/data/nn.json` (typo bank) | Larger typo bank synced from papertek-vocabulary | VERIFIED | 15,167 typo entries (was 7,417) |
| `scripts/check-bundle-size.js` | 10 MiB release gate, exits 0/1 | VERIFIED | 161 lines, `CEILING_BYTES = 10 * 1024 * 1024` hardcoded, exits 1 on current zip |
| `scripts/package-extension.js` | Minifying package helper, staging-dir pattern | VERIFIED | 146 lines, staging-dir pattern |
| `scripts/check-bundle-size.test.js` | TDD harness for bundle-size gate | VERIFIED | 150 lines |
| `.gitignore` (corpus/) | corpus/ exclusion, double-safety pattern | VERIFIED | `corpus/*` + `!corpus/.gitignore` entries present |
| `.gitignore` (.package-staging/) | staging dir exclusion | VERIFIED | `.package-staging/` entry present |
| `package.json` (npm scripts) | build-frequencies, build-bigrams, check-bundle-size, package | VERIFIED | All four scripts registered |
| `CLAUDE.md` (Release Workflow) | 5-step workflow with check-bundle-size as step 2 | VERIFIED | 5 steps, step 2 is `npm run check-bundle-size` with must-exit-0 semantics |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/build-frequencies.js` | `vocab-seam-core.js` | `require('../extension/content/vocab-seam-core.js')` for `validWords` intersection | VERIFIED | `vocab-seam-core` referenced in script |
| `scripts/build-frequencies.js` | NB N-gram 2021 corpus | `zlib.createGunzip` + readline stream | VERIFIED | `zlib.createGunzip` present in script |
| `scripts/build-bigrams.js` | `vocab-seam-core.js` | same `buildIndexes()` intersection pattern | VERIFIED | `vocab-seam-core` referenced |
| `scripts/build-bigrams.js` | existing bigrams-{lang}.json | `mergeBigrams(existing, derived)` max-merge | VERIFIED | `mergeBigrams` function present |
| `vocab-seam-core.js` typo guard | spell-check-core.js curated-typo branch | `if (entry.type !== 'typo')` guards validWords.add() | VERIFIED | Lines 438, 443, 453 in vocab-seam-core.js all guard on `type !== 'typo'` |
| `scripts/check-bundle-size.js` | `npm run package` | self-invokes package build, measures resulting zip | VERIFIED | Script self-packages via npm run package; zip measured at 10,599,772 bytes |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-01-PLAN.md | Build-time script emits Zipf freq sidecars for NB+NN, each <200 KB gz | SATISFIED | freq-nb.json (61 KB gz, 13,132 entries) + freq-nn.json (52 KB gz, 11,013 entries) on disk |
| DATA-02 | 02-03-PLAN.md | Typo-bank expansion in papertek-vocabulary, additive schema, synced via sync-vocab | SATISFIED | +35.5% NB / +104.5% NN growth; 13 collision fixes; seam bug fixed; brev genus corrected; 214 NN phrase-infinitives deferred with documented Blocker in STATE.md |
| DATA-03 | 02-02-PLAN.md | Extend bundled bigram data for NB+NN, same schema, under bundle-size budget | SATISFIED | bigrams-nb: 57 → 2020 head-words (32 KB gz); bigrams-nn: 55 → 2023 head-words (31 KB gz); 314 hand-authored pairs preserved |

All three Phase 2 requirements (DATA-01, DATA-02, DATA-03) are satisfied per REQUIREMENTS.md traceability. No orphaned requirements — REQUIREMENTS.md Phase 2 row maps exactly DATA-01, DATA-02, DATA-03 and no others.

Note: 02-04-SUMMARY.md frontmatter lists `requirements-completed: [DATA-01, DATA-02, DATA-03]` — this is a documentation artifact from that plan closing the phase, not a claim that 02-04 implemented those requirements. The actual requirement implementations are in 02-01 (DATA-01), 02-02 (DATA-03), and 02-03 (DATA-02) respectively.

### Anti-Patterns Found

No blockers or warnings. Scanned `scripts/build-frequencies.js`, `scripts/build-bigrams.js`, `scripts/check-bundle-size.js`, `scripts/package-extension.js` — zero TODO/FIXME/PLACEHOLDER/stub patterns found. All scripts are substantive implementations, not scaffolding.

### Fixture Regression

`npm run check-fixtures` exits 0. All 138 fixture cases pass at F1=1.000:

- [nb/clean] 8/8, [nb/gender] 17/17, [nb/modal] 14/14, [nb/saerskriving] 16/16, [nb/typo] 17/17
- [nn/clean] 8/8, [nn/gender] 17/17, [nn/modal] 15/15, [nn/saerskriving] 16/16, [nn/typo] 10/10

Note: The SUMMARY files and STATE.md reference "132/132" — this was the count before Plan 02-03 added 6 NB typo seed cases. The current total of 138 (132 + 6) is the correct count. All 138 pass.

### Deferred Items (Non-Blocking for Phase 2 Goal)

1. **NN phrase-infinitive triage (~214 entries):** NN `verbbank.json` has ~214 entries where `word` contains a space. Deferred because many are legitimate reflexive/phrasal verbs needing human classification. Documented in STATE.md Blockers as a candidate for Phase 2.1 or a standalone sibling-repo PR.

2. **Missing `fin_adj` in NB/NN adjectivebanks:** `fin` ("nice") is absent. Workaround: `nn-clean-003` fixture uses `stort` instead of `fint`. Small sibling-repo fix needed. Documented in STATE.md Blockers.

3. **`getFrequency()` not yet wired at browser runtime:** `state.freq` Map remains empty in the running extension — the freq-{lang}.json sidecars exist on disk but the seam's browser-side loader does not yet fetch them. This is by design: Phase 3 (SC-01) is responsible for the ranking wire-up. Phase 2 deliverable is the data files; Phase 3 is the consumption.

### Human Verification Required

1. **Confirm check-bundle-size exit code and diagnostic output**
   - Test: Run `npm run check-bundle-size` on the current repo
   - Expected: Prints per-directory breakdown, shows 10.11 MiB, exits 1 with FAIL message indicating 114 KB over cap
   - Why human: Confirms the gate is signaling correctly and the Phase 2.1 queue is warranted

### Gaps Summary

Phase 2 delivers all three data requirements (DATA-01, DATA-02, DATA-03) and all three of its first four ROADMAP success criteria (SC-1, SC-2, SC-3). The sole gap is SC-4: the bundled extension zip is 10.11 MiB, 114 KB over the ROADMAP-stated 10 MiB ceiling.

The gap is structural rather than implementation: the release gate (`check-bundle-size.js`) and the minification pipeline (`package-extension.js`) were both fully built and correctly report FAIL. The data additions in Phase 2 (freq sidecars ~113 KB gz, bigrams ~63 KB gz, larger typo arrays in nb/nn.json) pushed the bundle past the cap that existed before Phase 2 started, and minification alone recovered most but not all of the overage. The two largest contributors by uncompressed size inside the zip are `data/` (20.84 MiB) and `audio/` (7.67 MiB) — neither is a Phase 2 artifact, but the aggregate crossed the cap.

The project has decided (STATE.md, ROADMAP.md Phase 2 status row) to close Phase 2 with SC-4 as a documented Blocker and queue Phase 2.1 for the product decision (audit `en.json`, strip `audio/de/`, or bump the ceiling with user sign-off). No GitHub Release can cut until `check-bundle-size` exits 0.

---

_Verified: 2026-04-18T21:55:00Z_
_Verifier: Claude (gsd-verifier)_
