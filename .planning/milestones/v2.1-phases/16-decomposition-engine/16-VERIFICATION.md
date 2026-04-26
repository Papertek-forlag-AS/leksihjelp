---
phase: 16-decomposition-engine
verified: 2026-04-26T10:00:00Z
status: passed
score: 12/12 must-haves verified
gaps: []
human_verification: []
---

# Phase 16: Decomposition Engine Verification Report

**Phase Goal:** Ship a pure-algorithmic decomposeCompound engine that splits NB/NN/DE compounds into known constituent nouns with ≤2 % false-positive rate on the bundled nounbank.
**Verified:** 2026-04-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | decomposeCompound returns structured parts for NB zero-fuge compounds (skoledag -> skole + dag) | VERIFIED | Test [PASS] NB zero-fuge: skoledag -> skole + dag |
| 2  | decomposeCompound returns structured parts for NB fuge-s compounds (hverdagsmas -> hverdag + s + mas) | VERIFIED | Test [PASS] NB fuge-s: hverdagsmas -> hverdag + s + mas |
| 3  | decomposeCompound returns structured parts for NB fuge-e compounds (gutteklasse -> gutt + e + klasse) | VERIFIED | Test [PASS] NB fuge-e: gutteklasse -> gutt + e + klasse |
| 4  | decomposeCompound handles DE linking elements (s, n, en, er, e, es) | VERIFIED | Tests [PASS] for DE fuge-s, fuge-n, fuge-en, fuge-er |
| 5  | decomposeCompound handles recursive compounds up to 4 components | VERIFIED | Test [PASS] NB 4-part recursive, 5-part returns null |
| 6  | decomposeCompound returns null for words already in nounGenus (stored entry precedence) | VERIFIED | Test [PASS] Stored entry returns null: hverdag is in nounGenus |
| 7  | decomposeCompound returns null when either side is not a known noun (both-sides validation) | VERIFIED | Test [PASS] Left side unknown returns null |
| 8  | decomposeCompound handles triple-consonant elision (nattime -> natt + time) | VERIFIED | Test [PASS] Triple-consonant elision: nattime -> natt + time |
| 9  | vocab-seam.js exposes getDecomposeCompound getter on __lexiVocab surface | VERIFIED | vocab-seam.js line 316: `getDecomposeCompound: () => (state && state.decomposeCompound) ? state.decomposeCompound : null` |
| 10 | spell-check.js includes decomposeCompound in the vocab bag passed to runCheck | VERIFIED | spell-check.js line 260: `decomposeCompound: VOCAB.getDecomposeCompound()` |
| 11 | Decomposition against full NB nounbank produces < 2% false positive rate on non-compound single nouns | VERIFIED | [FP-CHECK] NB: tested 154 nouns, 0 false positives (0.00%) |
| 12 | Decomposition against full DE nounbank produces < 2% false positive rate on non-compound single nouns | VERIFIED | [FP-CHECK] DE: tested 812 nouns, 0 false positives (0.00%) |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | decomposeCompound function and LINKERS_BY_LANG config | VERIFIED | LINKERS_BY_LANG at line 52; function at line 1076 (~100 LOC) |
| `extension/content/vocab-seam-core.js` | decomposeCompound on module.exports API | VERIFIED | Line 1345: `const api = { buildIndexes, phoneticNormalize, phoneticMatchScore, decomposeCompound }` |
| `extension/content/vocab-seam-core.js` | Bound closure in buildIndexes return object | VERIFIED | Line 1338: `decomposeCompound: (word) => decomposeCompound(word, nounGenus, lang)` |
| `test/phase-16-unit.test.js` | Unit tests for all decomposition cases, min 80 lines | VERIFIED | 250 lines, 18 tests (16 unit + 2 FP validation), all pass |
| `extension/content/vocab-seam.js` | getDecomposeCompound getter | VERIFIED | Line 316 |
| `extension/content/spell-check.js` | decomposeCompound in vocab bag | VERIFIED | Line 260 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vocab-seam-core.js` | `vocab-seam-core.js` | buildIndexes returns bound decomposeCompound closure | WIRED | `decomposeCompound: (word) => decomposeCompound(word, nounGenus, lang)` at line 1338 |
| `vocab-seam.js` | `vocab-seam-core.js` | state.decomposeCompound from buildIndexes return | WIRED | `state.decomposeCompound` accessed at line 316 |
| `spell-check.js` | `vocab-seam.js` | VOCAB.getDecomposeCompound() | WIRED | `VOCAB.getDecomposeCompound()` at line 260 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| COMP-05 | 16-01, 16-02 | Decomposition engine handles linking elements (NB/NN: s, e; DE: s, n, en, er, e, es) and zero-fuge | SATISFIED | LINKERS_BY_LANG constant defined, all 7 linker tests pass |
| COMP-06 | 16-01, 16-02 | Decomposition handles recursive compounds up to 4 components | SATISFIED | Depth guard at `depth > 2`, 4-part test passes, 5-part returns null |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension/content/spell-check.js` | 799, 802 | `https://` URL literal and `fetch()` call | Info | Pre-existing from commit `fe682aa` (bug-reporting feature, prior phase). Documented in `deferred-items.md`. Not introduced by Phase 16. Does not block phase goal. |

### Human Verification Required

None. All must-haves are verifiable programmatically. The false-positive rate is validated by running the algorithm against the actual bundled nounbank data.

### Gaps Summary

No gaps. All 12 truths are verified, all artifacts exist and are substantive and wired, both requirements COMP-05 and COMP-06 are satisfied.

The pre-existing check-network-silence failure (spell-check.js fetch to report endpoint) was present before Phase 16 began (introduced in commit `fe682aa`, dated 2026-04-25, tagged as unrelated bug-reporting feature). It is logged in the phase's `deferred-items.md` and does not block the phase goal.

Release gate summary for Phase 16:

- `node test/phase-16-unit.test.js` — exit 0 (18/18 pass, 0% FP rate on NB/DE)
- `npm run check-fixtures` — exit 0 (no regression)
- `npm run check-explain-contract` — exit 0 (53/53 rules)
- `npm run check-rule-css-wiring` — exit 0 (53/53 rules)
- `npm run check-spellcheck-features` — exit 0
- `npm run check-benchmark-coverage` — exit 0 (40/40 expectations)
- `npm run check-governance-data` — exit 0 (5 banks, 116 entries)
- `npm run check-bundle-size` — exit 0 (12.48 MiB, under 20 MiB cap)
- `npm run check-network-silence` — exit 1 (pre-existing, not Phase 16)

---

_Verified: 2026-04-26_
_Verifier: Claude (gsd-verifier)_
