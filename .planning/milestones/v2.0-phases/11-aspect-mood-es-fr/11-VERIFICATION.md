---
phase: 11-aspect-mood-es-fr
verified: 2026-04-25T09:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 11: Aspect/Mood ES+FR Verification Report

**Phase Goal:** Flag indicative-where-subjunctive-required after closed trigger sets in ES and FR; warn on ES pretérito/imperfecto aspectual hints at hint severity
**Verified:** 2026-04-25
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | TENSE_FEATURES and TENSE_GROUP include subjuntivo, imperfecto, and subjonctif keys | VERIFIED | vocab-seam-core.js lines 60-62 (TENSE_GROUP) and 77-79 (TENSE_FEATURES) |
| 2  | Reverse-lookup indexes (esPresensToVerb, esSubjuntivoForms, esImperfectoForms, esPreteritumToVerb, frPresensToVerb, frSubjonctifForms, frSubjonctifDiffers) are built from unfiltered data and returned | VERIFIED | buildMoodIndexes() at line 832 called from buildIndexes() at line 1022, spread into return at line 1062 |
| 3  | Trigger tables ES_SUBJUNTIVO_TRIGGERS, ES_PRETERITO_ADVERBS, ES_IMPERFECTO_ADVERBS, FR_SUBJONCTIF_TRIGGERS (and phrase arrays) are exported from grammar-tables.js | VERIFIED | grammar-tables.js lines 346, 362, 368, 378, exported in tables object at lines 406-417 |
| 4  | CSS dot-colour bindings exist for es-subjuntivo, es-imperfecto-hint, fr-subjonctif | VERIFIED | content.css lines 897-899 — amber warning for es-subjuntivo + fr-subjonctif, dotted hint for es-imperfecto-hint |
| 5  | Release gates (check-explain-contract, check-rule-css-wiring) TARGETS lists include three new rule IDs | VERIFIED | check-explain-contract.js lines 91-93; check-rule-css-wiring.js lines 94-96 |
| 6  | check-spellcheck-features extended with mood index population assertions for ES and FR | VERIFIED | Lines 332-351 assert esPresensToVerb, esSubjuntivoForms, esImperfectoForms, frPresensToVerb, frSubjonctifForms are populated Maps |
| 7  | Indicative verb after ES subjuntivo trigger is flagged with subjunctive suggestion | VERIFIED | es-subjuntivo.js — P=1.000 R=1.000 F1=1.000 on 47 fixtures (31 positive + 16 acceptance) |
| 8  | Relative clauses with que (not after trigger verb) do NOT flag | VERIFIED | 16 acceptance fixtures in es/subjuntivo.jsonl include relative clause cases; all pass |
| 9  | ES preterito/imperfecto mismatch fires at hint severity only | VERIFIED | es-imperfecto-hint.js severity: 'hint' at line 85 and all findings at line 213/235; P=1.000 R=1.000 on 47 fixtures |
| 10 | Both ES rules consume trigger data from grammar-tables.js, not local re-implementations | VERIFIED | es-subjuntivo.js line 65: `gt.ES_SUBJUNTIVO_TRIGGERS`; es-imperfecto-hint.js line 54: `gt.ES_PRETERITO_ADVERBS` |
| 11 | Indicative verb after FR subjonctif trigger is flagged ONLY when subjunctive form differs from indicative (homophony guard) | VERIFIED | fr-subjonctif.js lines 94-97 read frSubjonctifDiffers; P=1.000 R=1.000 on 56 fixtures (35 positive + 21 acceptance) |
| 12 | Regular -er verbs with je/tu/il/ils do NOT flag (homophonous forms) | VERIFIED | 21 acceptance fixtures in fr/subjonctif.jsonl include homophonous cases; all pass |
| 13 | Benchmark es.38 flips for es-subjuntivo | VERIFIED | benchmark-texts/expectations.json line 25; check-benchmark-coverage: 22/22 expectations met (P1: 4/4, P2: 16/16, P3: 2/2) |

**Score:** 13/13 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | TENSE_FEATURES/GROUP + 7 reverse-lookup indexes | VERIFIED | All 7 Maps built in buildMoodIndexes(), spread into buildIndexes() return |
| `extension/content/spell-rules/grammar-tables.js` | ES_SUBJUNTIVO_TRIGGERS and 5 other trigger/adverb tables | VERIFIED | Lines 346-417; all 6 tables defined and exported |
| `extension/styles/content.css` | CSS bindings for three new rule IDs | VERIFIED | Lines 897-899; es-subjuntivo amber, es-imperfecto-hint dotted hint, fr-subjonctif amber |
| `extension/content/spell-rules/es-subjuntivo.js` | MOOD-01 ES subjuntivo trigger rule (172 lines) | VERIFIED | Reads ES_SUBJUNTIVO_TRIGGERS + esPresensToVerb + esSubjuntivoForms; severity: 'warning' |
| `extension/content/spell-rules/es-imperfecto-hint.js` | MOOD-02 ES aspectual hint rule (266 lines) | VERIFIED | Reads ES_PRETERITO_ADVERBS + esPreteritumToVerb + esImperfectoForms; severity: 'hint' |
| `extension/content/spell-rules/fr-subjonctif.js` | MOOD-03 FR subjonctif rule with homophony guard (192 lines) | VERIFIED | Reads FR_SUBJONCTIF_TRIGGERS + frPresensToVerb + frSubjonctifDiffers + frSubjonctifForms |
| `fixtures/es/subjuntivo.jsonl` | >=30 positive + >=15 acceptance (51 lines) | VERIFIED | 31 positive + 16 acceptance; P=1.000 R=1.000 F1=1.000 |
| `fixtures/es/imperfecto-hint.jsonl` | >=30 positive + >=15 acceptance (56 lines) | VERIFIED | 31 positive + 16 acceptance; P=1.000 R=1.000 F1=1.000 |
| `fixtures/fr/subjonctif.jsonl` | >=30 positive + >=15 acceptance (108 lines) | VERIFIED | 35 positive + 21 acceptance; P=1.000 R=1.000 F1=1.000 |
| `benchmark-texts/expectations.json` | es.38 expectation for es-subjuntivo | VERIFIED | Line 25: `"es.38": { "rule_id": "es-subjuntivo", "severity": "warning", "priority_band": "P2" }` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| vocab-seam-core.js | extension/data/es.json | buildMoodIndexes reads presens/preteritum/subjuntivo/imperfecto keys | WIRED | Maps built with 779 presens, 654 subjuntivo, 3744 imperfecto forms (per SUMMARY) |
| vocab-seam-core.js | extension/data/fr.json | buildMoodIndexes reads presens/subjonctif keys | WIRED | frSubjonctifDiffers homophony guard built from presens vs subjonctif comparison |
| es-subjuntivo.js | grammar-tables.js | `host.__lexiGrammarTables.ES_SUBJUNTIVO_TRIGGERS` at line 65 | WIRED | Pattern confirmed in source |
| es-subjuntivo.js | vocab-seam-core.js | `ctx.vocab.esPresensToVerb` and `ctx.vocab.esSubjuntivoForms` at lines 91-92 | WIRED | Note: field is `ctx.vocab` not `ctx.indexes` (auto-fixed deviation) |
| es-imperfecto-hint.js | grammar-tables.js | `host.__lexiGrammarTables.ES_PRETERITO_ADVERBS` at line 54 | WIRED | Pattern confirmed in source |
| fr-subjonctif.js | grammar-tables.js | `host.__lexiGrammarTables.FR_SUBJONCTIF_TRIGGERS` at line 66 | WIRED | Pattern confirmed in source |
| fr-subjonctif.js | vocab-seam-core.js | `ctx.vocab.frPresensToVerb`, `frSubjonctifForms`, `frSubjonctifDiffers` at lines 92-94 | WIRED | All three indexes consumed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOOD-01 | 11-01-PLAN, 11-02-PLAN | ES subjuntivo trigger rule flags indicative-when-subjunctive-required after closed trigger set | SATISFIED | es-subjuntivo.js exists, wired, P=1.000/R=1.000 on 47 fixtures; es.38 benchmark flips |
| MOOD-02 | 11-01-PLAN, 11-02-PLAN | ES pretérito vs imperfecto aspectual hint at hint-only severity | SATISFIED | es-imperfecto-hint.js exists, severity: 'hint', P=1.000/R=1.000 on 47 fixtures |
| MOOD-03 | 11-01-PLAN, 11-03-PLAN | FR subjonctif trigger rule with homophony guard | SATISFIED | fr-subjonctif.js exists, frSubjonctifDiffers guard confirmed, P=1.000/R=1.000 on 56 fixtures |

All three requirement IDs accounted for. No orphaned requirements.

---

### Anti-Patterns Found

None. All `return []` occurrences in rule files are legitimate early-exit guards (wrong language, empty indexes), not stubs. No TODO/FIXME/placeholder comments in any Phase 11 file.

---

### Release Gate Results

| Gate | Result | Notes |
|------|--------|-------|
| check-explain-contract | PASS: 43/43 | Three new rules included in TARGETS |
| check-rule-css-wiring | PASS: 43/43 | es-subjuntivo, es-imperfecto-hint, fr-subjonctif all wired |
| check-spellcheck-features | PASS | Mood index population assertions pass for ES and FR |
| check-benchmark-coverage | PASS: 22/22 | P1: 4/4, P2: 16/16, P3: 2/2 — es.38 flips |
| check-network-silence | PASS | No fetch/XHR in new rule files |
| check-fixtures (Phase 11 rules) | PASS | es/subjuntivo, es/imperfecto-hint, fr/subjonctif all F1=1.000 |
| check-fixtures (overall exit) | EXIT 1 (pre-existing) | Failures in de/v2, de/verb-final, fr/bags, fr/grammar — documented pre-existing in 11-01-SUMMARY; not caused by Phase 11 |

The check-fixtures exit 1 is a pre-existing condition unrelated to Phase 11. The SUMMARY documented it identically: "check-fixtures exits 1 on baseline (pre-existing fr/grammar F1=0.429 with failed cases) -- not caused by this plan's changes, confirmed identical behavior with stashed changes."

---

### Human Verification Required

None. All observable truths were verified programmatically via gate runs and source inspection. The homophony guard (frSubjonctifDiffers) correctness is validated by the 21 acceptance fixtures passing at F1=1.000.

---

## Gaps Summary

No gaps. All 13 must-have truths verified, all artifacts exist and are substantive and wired, all key links confirmed, all three requirement IDs satisfied.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
