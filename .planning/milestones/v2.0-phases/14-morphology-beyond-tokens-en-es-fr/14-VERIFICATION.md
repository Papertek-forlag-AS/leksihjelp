---
phase: 14-morphology-beyond-tokens-en-es-fr
verified: 2026-04-25T14:30:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 14: Morphology Beyond Tokens (EN/ES/FR) Verification Report

**Phase Goal:** Detect morphological errors that go beyond single-token misspelling — wrong irregular form, wrong word-family member, wrong adjective agreement — and surface a corrective suggestion.
**Verified:** 2026-04-25T14:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `buildIrregularForms` generates a Map keyed by wrong regular forms (childs, eated, goed) pointing to correct irregular forms | VERIFIED | `vocab-seam-core.js` line 978–1059; `buildIndexes({ raw: en, lang: 'en', ... })` returns `irregularForms.size = 171`; childs→children, eated→ate, goed→went confirmed at runtime |
| 2 | New rule files are listed in manifest.json content_scripts and load in the browser | VERIFIED | `manifest.json` lines 79–81: `en-morphology.js`, `en-word-family.js`, `fr-adj-gender.js` all present |
| 3 | CSS dot-colour bindings exist for en-morphology, en-word-family, and fr-adj-gender rule IDs | VERIFIED | `content.css` lines 907–909: all three `.lh-spell-{id}` bindings with `#e67e22` warning-tier colour |
| 4 | check-explain-contract TARGETS list includes the three new rule files | VERIFIED | `scripts/check-explain-contract.js` lines 97–99: all three paths in TARGETS |
| 5 | check-spellcheck-features asserts irregularForms contains expected tokens under minimal preset | VERIFIED | `scripts/check-spellcheck-features.js` lines 327–343: assertions for childs and eated; gate PASSES |
| 6 | Benchmark expectations.json has entries for EN morphology lines and FR gender lines | VERIFIED | `benchmark-texts/expectations.json` entries: en.27, en.34, en.38 (en-morphology), en.39 (en-word-family), fr.57 (fr-adj-gender); all 5 Phase 14 expectations flip successfully |
| 7 | EN text containing 'childs' is flagged with suggestion 'children' | VERIFIED | `fixtures/en/morphology.jsonl` 32 positive fixtures including childs→children; P=1.000 R=1.000 F1=1.000 49/49 pass |
| 8 | EN text containing 'eated' is flagged with suggestion 'ate' | VERIFIED | morphology fixture suite confirms; irregularForms Map has eated→{correct:'ate', type:'past'} |
| 9 | EN text 'i have improve' is flagged with suggestion 'improved' | VERIFIED | `fixtures/en/word-family.jsonl` 32 positive fixtures; P=1.000 R=1.000 F1=1.000 49/49 pass |
| 10 | FR text 'un bon humeur' flags with suggestion 'bonne' for the adjective | VERIFIED | `fixtures/fr/adj-gender.jsonl` fixture fr-adj-gender-1 confirms; P=1.000 R=1.000 F1=1.000 55/55 pass |
| 11 | Correct irregular/regular forms and correct gender agreement do NOT flag | VERIFIED | All three fixture suites have >= 15 acceptance cases; all pass at F1=1.000 |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | buildIrregularForms index builder | VERIFIED | Function at line 978–1059; exposed on buildIndexes return (line 1200); 171 entries for EN |
| `extension/content/spell-rules/en-morphology.js` | MORPH-01 EN irregular overgeneration rule | VERIFIED | 94 lines; reads `vocab.irregularForms` + inline `DOUBLE_PLURALS`; explain contract at line 41 |
| `extension/content/spell-rules/en-word-family.js` | MORPH-03 EN word-family POS-slot confusion rule | VERIFIED | 154 lines; inline `VERB_TO_PP` (50 families); lookback up to 4 tokens for have/has/had |
| `extension/content/spell-rules/fr-adj-gender.js` | MORPH-02 FR adjective-noun gender agreement rule | VERIFIED | 206 lines; `feminize`/`masculinize` functions; `FR_ADJ_FEM_IRREGULARS` (17 entries); reads `vocab.nounGenus` |
| `fixtures/en/morphology.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 49 fixtures: 32 positive + 17 acceptance |
| `fixtures/en/word-family.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 49 fixtures: 32 positive + 17 acceptance |
| `fixtures/fr/adj-gender.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 55 fixtures: 35 positive (fr-adj-gender findings) + 20 acceptance |
| `extension/manifest.json` | Content script registration for 3 new rule files | VERIFIED | Lines 79–81 in content_scripts js array |
| `extension/styles/content.css` | CSS dot-colour bindings for 3 new rule IDs | VERIFIED | Lines 907–909 with #e67e22 warning-tier colour |
| `benchmark-texts/expectations.json` | Phase 14 benchmark flip expectations | VERIFIED | en.27, en.34, en.38, en.39, fr.57 all present and pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `extension/content/spell-rules/en-morphology.js` | `extension/content/vocab-seam-core.js` | `ctx.vocab.irregularForms` Map lookup | WIRED | Line 59: `const irregularForms = vocab.irregularForms;` Line 69: `irregularForms.get(lower)` |
| `extension/content/spell-rules/en-word-family.js` | spell-check-core.js | `ctx.getTagged` for POS-slot detection | PARTIAL | `VERB_TO_PP` closed-set approach used instead; summary notes `getTagged` not needed due to closed-set precision. Functionally equivalent — no impact on correctness. |
| `extension/content/spell-rules/fr-adj-gender.js` | `extension/content/vocab-seam-core.js` | `ctx.vocab.nounGenus` Map for noun gender lookup | WIRED | Line 146: `const nounGenus = vocab.nounGenus || new Map();` Line 161: `nounGenus.get(nounWord)` |

Note on PARTIAL link: `en-word-family.js` uses a 50-entry `VERB_TO_PP` closed set instead of `ctx.getTagged`. This is a deliberate high-precision design decision documented in the summary — the rule does not rely on POS tagging from spell-check-core. The underlying goal (flag have+base-verb patterns) is achieved. Not a gap.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MORPH-01 | 14-01, 14-02 | EN morphological overgeneration flagged for irregular verbs/nouns | SATISFIED | `en-morphology.js` + `fixtures/en/morphology.jsonl` (49 fixtures, F1=1.000); benchmark en.27/en.34/en.38 all flip |
| MORPH-02 | 14-01, 14-03 | FR opaque-noun gender + adjective agreement flagged | SATISFIED | `fr-adj-gender.js` + `fixtures/fr/adj-gender.jsonl` (55 fixtures, F1=1.000); benchmark fr.57 flips; fr.51 correctly handled by pre-existing gender rule |
| MORPH-03 | 14-01, 14-02 | EN word-family POS-slot confusion flagged | SATISFIED | `en-word-family.js` + `fixtures/en/word-family.jsonl` (49 fixtures, F1=1.000); benchmark en.39 flips |

All three requirement IDs are checked in `REQUIREMENTS.md` (lines 75–77) and marked `[x]` complete. No orphaned requirements for Phase 14.

---

### Release Gate Results

| Gate | Result | Notes |
|------|--------|-------|
| `check-fixtures` | PASS — all new rules F1=1.000 | en/morphology 49/49, en/word-family 49/49, fr/adj-gender 55/55 |
| `check-explain-contract` | FAILS (pre-existing) | Fails only on `doc-drift-de-address.js` which is deleted in working tree (unstaged deletion from Phase 13 work). The 3 Phase 14 rules have valid explain contracts. |
| `check-rule-css-wiring` | FAILS (pre-existing) | Same root cause: `doc-drift-de-address.js` missing from disk. Phase 14 rules all have CSS bindings. |
| `check-spellcheck-features` | PASS | irregularForms assertions for childs and eated pass; feature-gate independence confirmed |
| `check-benchmark-coverage` | FAILS (pre-existing) | Only failing expectation: de.48 (doc-drift-de-address rule). All 5 Phase 14 expectations (en.27, en.34, en.38, en.39, fr.57) pass. 35/36 overall. |
| `check-network-silence` | PASS | No fetch/XHR in new rule files |

**Pre-existing issue:** `extension/content/spell-rules/doc-drift-de-address.js` was created in Phase 13 (commit `a14f064`) but is deleted in the working tree (unstaged deletion — file tracked in git HEAD, absent on disk). This causes 3 gates to fail but is not a Phase 14 regression. Confirmed by Plan 14-03 SUMMARY noting this as "Pre-existing release gate failures". The file must be restored before the next release.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | — |

All three new rule files scanned for TODO/FIXME/placeholder/return null — no anti-patterns detected.

---

### Human Verification Required

None — all observable behaviors verifiable through fixture suites (F1=1.000 across all three rule fixture sets), release gates, and benchmark coverage checks.

---

## Gaps Summary

No gaps. All 11 truths verified, all artifacts substantive and wired, all three requirements satisfied.

**One pre-existing issue to track (not a Phase 14 gap):** `extension/content/spell-rules/doc-drift-de-address.js` deleted in working tree. This causes `check-explain-contract`, `check-rule-css-wiring`, and `check-benchmark-coverage` to fail. This file must be restored (or the deletion committed with corresponding gate updates) before the next release. It is a carry-over from Phase 13 and is not introduced by Phase 14.

---

_Verified: 2026-04-25T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
