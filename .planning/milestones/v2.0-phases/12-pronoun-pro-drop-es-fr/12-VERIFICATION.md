---
phase: 12-pronoun-pro-drop-es-fr
verified: 2026-04-25T12:30:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 12: Pronoun & Pro-Drop ES/FR Verification Report

**Phase Goal:** Pronoun & pro-drop rules for ES and FR
**Verified:** 2026-04-25T12:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ES_GUSTAR_CLASS_VERBS Set is available via grammar-tables.js for Plan 02 | VERIFIED | Defined and exported in grammar-tables.js; accessed via `host.__lexiGrammarTables.ES_GUSTAR_CLASS_VERBS` in es-gustar.js |
| 2 | CSS dot-colour bindings exist for es-pro-drop (hint), es-gustar (warn), fr-clitic-order (warn) | VERIFIED | All three bindings present in content.css with correct P3/P2 colours |
| 3 | Phase 11 + Phase 12 rule files are all wired in manifest.json | VERIFIED | 6 entries found: es-subjuntivo, es-imperfecto-hint, fr-subjonctif (Phase 11) and es-pro-drop, es-gustar, fr-clitic-order (Phase 12) |
| 4 | Release gates TARGETS list includes all three Phase 12 rule files | VERIFIED | check-explain-contract.js and check-rule-css-wiring.js both contain all three paths; both gates exit 0 |
| 5 | Benchmark expectations cover pro-drop and gustar lines | VERIFIED | es.39, es.41 (es-pro-drop), es.32 (es-gustar) in expectations.json; check-benchmark-coverage exits 0 |
| 6 | FR benchmark has a clitic-order error line | VERIFIED | fr.txt line 55: "Je lui le donne chaque matin."; fr.55 entry in expectations.json |
| 7 | ES 'yo voy' is flagged as redundant subject pronoun at hint severity | VERIFIED | es-pro-drop.js scans for yo/tu + matching present verb; fixture pro-drop.jsonl passes P=1.000 R=1.000 |
| 8 | ES 'yo fui' is flagged as redundant subject pronoun (preteritum coverage) | VERIFIED | es-pro-drop.js queries both esPresensToVerb and esPreteritumToVerb |
| 9 | ES 'El no gusta ayudar' is flagged as gustar-class syntax error at warn severity | VERIFIED | es-gustar.js backward-scans for dative clitic; fixture gustar.jsonl passes P=1.000 R=1.000 |
| 10 | ES 'Me gusta la musica' does NOT flag | VERIFIED | DATIVE_CLITICS set includes 'me'; backward scan finds clitic and suppresses flag |
| 11 | FR 'je lui le donne' is flagged as wrong clitic order at warn severity | VERIFIED | fr-clitic-order.js rank table detects rank-3-before-rank-2; fixture clitic-order.jsonl passes P=1.000 R=1.000 |
| 12 | FR 'je le lui donne' does NOT flag (correct order) | VERIFIED | Rank-ascending check passes; acceptance fixtures cover this case |
| 13 | FR single-clitic sentences do NOT flag | VERIFIED | Guard: 2+ clitics required; acceptance fixtures cover single-clitic cases |
| 14 | FR 'le/la/les' as articles before nouns are NOT treated as clitics | VERIFIED | Article disambiguation: le/la/les only collected as clitic when next token is another clitic or the verb |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/grammar-tables.js` | ES_GUSTAR_CLASS_VERBS Set (~15 verbs) | VERIFIED | 2 grep hits (definition + export); 15 verbs defined |
| `extension/styles/content.css` | CSS bindings for three Phase 12 rule IDs | VERIFIED | All 3 bindings present with correct colours |
| `extension/manifest.json` | Content script entries for Phase 11 + 12 rules | VERIFIED | 6 entries confirmed |
| `benchmark-texts/expectations.json` | Benchmark flip expectations for pro-drop and gustar | VERIFIED | 4 entries: es.39, es.41, es.32, fr.55 |
| `extension/content/spell-rules/es-pro-drop.js` | ES pro-drop hint rule | VERIFIED | Exists, substantive (100+ lines), wired in manifest and check-explain-contract TARGETS |
| `extension/content/spell-rules/es-gustar.js` | ES gustar-class syntax flagger | VERIFIED | Exists, substantive, wired |
| `extension/content/spell-rules/fr-clitic-order.js` | FR double-pronoun clitic-order rule | VERIFIED | Exists, substantive, wired |
| `fixtures/es/pro-drop.jsonl` | >=90 fixtures | VERIFIED | 97 lines (>= 30 positive + 60 acceptance); P=1.000 R=1.000 F1=1.000 |
| `fixtures/es/gustar.jsonl` | >=90 fixtures | VERIFIED | 98 lines; P=1.000 R=1.000 F1=1.000 |
| `fixtures/fr/clitic-order.jsonl` | >=90 fixtures | VERIFIED | 99 lines; P=1.000 R=1.000 F1=1.000 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grammar-tables.js` | `es-gustar.js` | ES_GUSTAR_CLASS_VERBS import | WIRED | es-gustar.js accesses `host.__lexiGrammarTables.ES_GUSTAR_CLASS_VERBS` at line 63-64 |
| `check-explain-contract.js` | `es-pro-drop.js` | TARGETS array entry | WIRED | Path present in TARGETS; gate exits 0 (46/46 pass) |
| `es-pro-drop.js` | `vocab-seam-core.js` | ctx.vocab.esPresensToVerb and esPreteritumToVerb | WIRED | Lines 65-66 access both maps; both used in check() |
| `es-gustar.js` | `grammar-tables.js` | ES_GUSTAR_CLASS_VERBS | WIRED | Lazy-init via `host.__lexiGrammarTables` confirmed |
| `fr-clitic-order.js` | `spell-check-core.js` | ctx.getTagged(i).isFinite for verb detection | WIRED | Line 102-103: `ctx.getTagged(vi)` and `tagged.isFinite` confirmed |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PRON-01 | 12-01, 12-02 | ES pro-drop-overuse warn when subject pronoun appears with unambiguous verb agreement | SATISFIED | es-pro-drop.js flags yo/tu + matching verb at hint severity; benchmark es.39, es.41 flip; check-benchmark-coverage PASS |
| PRON-02 | 12-01, 12-02 | ES gustar-class syntax flagged when sujeto + gustar-class-verb + objeto pattern | SATISFIED | es-gustar.js flags missing dative clitic at warn severity with suggestion; benchmark es.32 flips; fixture F1=1.000 |
| PRON-03 | 12-01, 12-03 | FR double-pronoun clitic order flagged when cluster violates rank order | SATISFIED | fr-clitic-order.js flags rank inversions at warn severity; benchmark fr.55 flips; fixture F1=1.000 |

All three requirements from REQUIREMENTS.md lines 62-64 are marked Complete and have implementation evidence.

### Anti-Patterns Found

No blockers or stubs detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No anti-patterns found | — | — |

### Check-Fixtures Exit Code Note

`npm run check-fixtures` exits 1 due to pre-existing non-Phase-12 fixture failures:
- `[fr/grammar]` F1=0.429 — last modified before Phase 12 (commits a2725c9, 5c5bde5)
- `[de/v2]`, `[de/verb-final]`, `[es/subjuntivo]`, `[es/imperfecto-hint]` — F1 < 1.000 from prior phases

All three Phase 12 fixture suites (es/pro-drop, es/gustar, fr/clitic-order) score P=1.000 R=1.000 F1=1.000. The exit-1 is a pre-existing infrastructure issue, not introduced by Phase 12.

### Human Verification Required

None required. All observable behaviors are verifiable via fixture suites and release gate outputs.

## Gaps Summary

No gaps. All 14 must-have truths verified, all artifacts exist and are substantive and wired, all three requirement IDs satisfied, all Phase 12-relevant release gates exit 0, all commits confirmed in git history.

---

_Verified: 2026-04-25T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
