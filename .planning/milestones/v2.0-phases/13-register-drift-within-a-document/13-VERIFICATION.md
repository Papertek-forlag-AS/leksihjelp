---
phase: 13-register-drift-within-a-document
verified: 2026-04-25T15:10:00Z
status: passed
score: 6/6 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/6 (2 partial, 1 failed)
  gaps_closed:
    - "DE du/Sie drift rule (DOC-01) restored — doc-drift-de-address.js on disk, P=1.000 R=1.000 F1=1.000 on 51 fixtures"
    - "check-explain-contract exits 0 (50/50 rules)"
    - "check-rule-css-wiring exits 0 (50/50 rules, doc-drift-de-address wired)"
    - "check-benchmark-coverage exits 0 (30/30 expectations met)"
    - "Two-pass runner truth fully verified (all four doc-drift rules on disk and participating in post-pass)"
  gaps_remaining: []
  regressions: []
---

# Phase 13: Register Drift Within a Document — Verification Report

**Phase Goal:** Land the document-state two-pass runner, ship four register-drift rules, enforce stateful-rule-invalidation release gate.
**Verified:** 2026-04-25T15:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (doc-drift-de-address.js restored via git restore)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Two-pass runner (kind: 'document', checkDocument) ships in spell-check-core.js with priority band 200+ | VERIFIED | Post-pass loop at lines 224-245 of spell-check-core.js; all four doc-drift rules use priority 201-204 |
| 2 | check-stateful-rule-invalidation exits 0; paired self-test exits 0; scripted edit sequences produce no ghost flags | VERIFIED | Gate: 4/4 doc-drift rules validated (drift->clean->drift cycle). Self-test: broken-rule detection fires (exit 1), well-formed passes (exit 0). |
| 3 | DE du/Sie drift flagged (DOC-01); consistent-register counter-examples do NOT flag | VERIFIED | doc-drift-de-address.js restored (6125 bytes). check-fixtures: P=1.000 R=1.000 F1=1.000 on 51 fixtures (31 positive + 20 acceptance). |
| 4 | FR tu/vous drift flagged (DOC-02); consistent-register counter-examples do NOT flag | VERIFIED | doc-drift-fr-address.js: P=1.000 R=1.000 F1=1.000 on 49 fixtures (31 positive + 18 acceptance). |
| 5 | NB bokmål/riksmål mixing flagged (DOC-03) using BOKMAL_RIKSMAL_MAP | VERIFIED | doc-drift-nb-register.js: P=1.000 R=1.000 F1=1.000 on 51 fixtures. detectDrift and BOKMAL_RIKSMAL_MAP confirmed in grammar-tables.js. |
| 6 | NN a-/e-infinitiv mixing flagged (DOC-04); consistent NN fixtures do NOT flag | VERIFIED | doc-drift-nn-infinitive.js: P=1.000 R=1.000 F1=1.000 on 49 fixtures. Uses vocab-derived nnInfinitiveClasses. |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-check-core.js` | Two-pass runner with document-rule post-pass loop | VERIFIED | Post-pass loop filters `r.kind === 'document'`, calls `checkDocument(ctx, findings)` |
| `extension/content/spell-rules/grammar-tables.js` | detectDrift helper + BOKMAL_RIKSMAL_MAP | VERIFIED | detectDrift at line 414, BOKMAL_RIKSMAL_MAP at line 440, both exported on tables object |
| `extension/content/spell-rules/doc-drift-de-address.js` | DOC-01 DE du/Sie address drift rule (priority 201) | VERIFIED | File restored: 6125 bytes, kind:'document', INFORMAL_WORDS + FORMAL_DISPLAY sets, checkDocument present, explain returns {nb, nn} |
| `extension/content/spell-rules/doc-drift-fr-address.js` | DOC-02 FR tu/vous address drift rule (priority 202) | VERIFIED | Exists, kind:'document', checkDocument present, explain returns {nb, nn, severity:'warning'} |
| `extension/content/spell-rules/doc-drift-nb-register.js` | DOC-03 NB bokmal/riksmal mixing rule (priority 203) | VERIFIED | Exists, kind:'document', uses BOKMAL_RIKSMAL_MAP lazily, 51 fixtures pass |
| `extension/content/spell-rules/doc-drift-nn-infinitive.js` | DOC-04 NN a-/e-infinitiv mixing rule (priority 204) | VERIFIED | Exists, kind:'document', uses vocab.nnInfinitiveClasses, 49 fixtures pass |
| `scripts/check-stateful-rule-invalidation.js` | INFRA-10 release gate | VERIFIED | Exits 0 — 4/4 doc-drift rules validated |
| `scripts/check-stateful-rule-invalidation.test.js` | Paired self-test | VERIFIED | Exits 0 — broken-rule detection and well-formed-rule pass both confirmed |
| `fixtures/de/doc-drift-de-address.jsonl` | 30+ positive + 15+ acceptance DE fixtures | VERIFIED | 51 fixtures (31 positive + 20 acceptance) — all pass P=1.000 R=1.000 |
| `fixtures/fr/doc-drift-fr-address.jsonl` | 30+ positive + 15+ acceptance FR fixtures | VERIFIED | 49 fixtures (31 positive + 18 acceptance) — all pass |
| `fixtures/nb/doc-drift-nb-register.jsonl` | 30+ positive + 15+ acceptance NB fixtures | VERIFIED | 51 fixtures (32 positive + 19 acceptance) — all pass |
| `fixtures/nn/doc-drift-nn-infinitive.jsonl` | 30+ positive + 15+ acceptance NN fixtures | VERIFIED | 49 fixtures (32 positive + 17 acceptance) — all pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| doc-drift-de-address.js | spell-check-core.js post-pass | manifest.json line 79 | WIRED | `"content/spell-rules/doc-drift-de-address.js"` present in manifest content_scripts |
| doc-drift-de-address.js | CSS dot colour | content.css line 903 | WIRED | `.lh-spell-doc-drift-de-address { background: #f59e0b; }` — amber P2 warning |
| doc-drift-fr-address.js | spell-check-core.js post-pass | manifest.json + check-rule-css-wiring | WIRED | Confirmed by check-rule-css-wiring 50/50 pass |
| doc-drift-nb-register.js | spell-check-core.js post-pass | manifest.json + check-rule-css-wiring | WIRED | Confirmed by check-rule-css-wiring 50/50 pass |
| doc-drift-nn-infinitive.js | spell-check-core.js post-pass | manifest.json + check-rule-css-wiring | WIRED | Confirmed by check-rule-css-wiring 50/50 pass |
| detectDrift (grammar-tables.js) | All four doc-drift rules | lazy host.__lexiGrammarTables.detectDrift | WIRED | Each rule uses getDetectDrift() accessor pattern; deferred load safe |

---

### Release Gate Results (Actual Runs)

| Gate | Exit Code | Result |
|------|-----------|--------|
| check-stateful-rule-invalidation | 0 | PASS — 4/4 doc-drift rules validated (drift->clean->drift cycle) |
| check-stateful-rule-invalidation:test | 0 | PASS — broken-rule detection fires, well-formed rule passes |
| check-explain-contract | 0 | PASS — 50/50 popover-surfacing rules have valid explain contract |
| check-rule-css-wiring | 0 | PASS — 50/50 rules have CSS dot-colour binding (45 unique ids including all four doc-drift ids) |
| check-network-silence | 0 | PASS — spell-check surface is network-silent (SC-06) |
| check-spellcheck-features | 0 | PASS — lookup indexes are feature-independent |
| check-benchmark-coverage | 0 | PASS — 30/30 expectations met (P1: 4/4, P2: 22/22, P3: 4/4) |
| check-governance-data | 0 | PASS — no governance banks yet (pre-data-sync baseline) |
| check-fixtures (Phase 13 rules only) | 0 per-rule | PASS — all four doc-drift rules: P=1.000 R=1.000 F1=1.000 |
| check-fixtures (global exit) | 1 (pre-existing) | NOTE — exit 1 caused exclusively by pre-existing failures from Phases 11-12: de/v2 (1 case), de/verb-final (2), es/imperfecto-hint (6), es/personal-a (1), es/subjuntivo (11), fr/grammar (4). These failures were present before any Phase 13 commit and are not regressions introduced by this phase. Zero Phase 13 fixtures fail. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| INFRA-07 | 13-01-PLAN.md | Two-pass document-rule runner in spell-check-core.js | SATISFIED — post-pass loop at lines 224-245 |
| INFRA-10 | 13-01-PLAN.md | Stateful-rule-invalidation release gate + paired self-test | SATISFIED — gate exits 0, self-test exits 0 |
| DOC-01 | 13-02-PLAN.md | DE du/Sie address register drift rule | SATISFIED — rule restored, P=1.000 R=1.000 on 51 fixtures |
| DOC-02 | 13-02-PLAN.md | FR tu/vous address register drift rule | SATISFIED — P=1.000 R=1.000 on 49 fixtures |
| DOC-03 | 13-03-PLAN.md | NB bokmål/riksmål register mixing rule | SATISFIED — P=1.000 R=1.000 on 51 fixtures |
| DOC-04 | 13-03-PLAN.md | NN a-/e-infinitiv mixing rule | SATISFIED — P=1.000 R=1.000 on 49 fixtures |

---

### Anti-Patterns Found

None in Phase 13 files. The restored doc-drift-de-address.js is substantive (6125 bytes) with real INFORMAL_WORDS/FORMAL_DISPLAY sets, bidirectional suggestion maps, detectDrift integration, and a full checkDocument implementation. No TODO/FIXME/placeholder comments found in any Phase 13 rule file.

---

### Human Verification Required

None. All automated checks pass. No items require human testing.

---

### Re-Verification Summary

The single root cause from the initial verification — `doc-drift-de-address.js` deleted from the working tree by a parallel agent — was resolved via `git restore`. After restoration:

- All four Phase 13 doc-drift fixture suites pass with perfect scores (P=1.000 R=1.000 F1=1.000)
- check-explain-contract, check-rule-css-wiring, check-benchmark-coverage all exit 0
- check-stateful-rule-invalidation exits 0 (4/4 rules validated)
- DOC-01 rule is wired in manifest.json (line 79) and content.css (line 903)

The global check-fixtures exit 1 is a pre-existing condition from Phases 11-12. No Phase 13 fixture fails. The phase goal is fully achieved.

---

_Verified: 2026-04-25T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
