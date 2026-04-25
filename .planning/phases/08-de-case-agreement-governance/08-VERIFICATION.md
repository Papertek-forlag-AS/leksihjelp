---
phase: 08-de-case-agreement-governance
verified: 2026-04-25T10:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 8: DE Case Agreement Governance Verification Report

**Phase Goal:** Ship DE's four highest-impact structural rules (preposition case, separable-verb split, perfekt auxiliary, compound-noun gender), and deliver the shared `grammar-tables.js` primitive that Phases 9/10/11 will consume.
**Verified:** 2026-04-25
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `grammar-tables.js` exports PREP_CASE, DEF_ARTICLE_CASE, INDEF_ARTICLE_CASE, SEPARABLE_PREFIXES, SEIN_VERBS, BOTH_AUX_VERBS on `self.__lexiGrammarTables` | VERIFIED | Node require() confirms all 6 tables; PREP_CASE has 25 prepositions, SEPARABLE_PREFIXES Set(23), SEIN_VERBS Set(42), BOTH_AUX_VERBS Set(6) |
| 2 | `vocab-seam-core` builds `participleToAux` Map from de.json verbbank perfektum data | VERIFIED | `buildIndexes()` returns `participleToAux` with 652 entries; `gegangen → sein`, `gemacht → haben`, `gefahren → both` all verified |
| 3 | Benchmark `de.txt` contains lines for all four Phase 8 patterns | VERIFIED | Lines 44-47: "mit den Schule" (DE-01), "habe gegangen" (DE-03), "Das Handtasche" (DE-04), "zurückkomme" (DE-02); Schultasche correctly replaced with Handtasche since schultasche is in nounbank |
| 4 | `de-prep-case` flags article-case mismatch after prepositions | VERIFIED | Rule file exists, consumes `__lexiGrammarTables` lazily, 32 positive + 20 acceptance fixtures at 1.000 F1 |
| 5 | `de-separable-verb` flags unsplit separable verbs in main clauses; subordinate clauses pass | VERIFIED | Rule file exists, consumes SEPARABLE_PREFIXES lazily, 32 positive + 20 acceptance fixtures (acceptance fixtures include both `[]` clean cases and cases where only other rules fire, not de-separable-verb) |
| 6 | `de-perfekt-aux` flags wrong haben/sein auxiliary; both-aux verbs never flag | VERIFIED | Rule file exists, reads `participleToAux` from `ctx.vocab`, 34 positive + 15 acceptance fixtures at 1.000 F1 |
| 7 | `de-compound-gender` infers gender from longest suffix; only fires on unknown compounds | VERIFIED | Rule file exists, uses greedy suffix split with linking-element support, 32 positive + 15 acceptance fixtures at 1.000 F1 |
| 8 | All four rules are wired into all release gates (explain-contract, CSS, manifest, benchmark) | VERIFIED | check-explain-contract 34/34 PASS, check-rule-css-wiring 34/34 PASS, all four rules in manifest after grammar-tables.js |
| 9 | `grammar-tables.js` documents Phase 9/10 consumer shapes as required by Phase 9/10 readiness criterion | VERIFIED | Lines 150-155 of grammar-tables.js contain Phase 9 (ES) and Phase 10 (FR) consumer stub documentation |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/grammar-tables.js` | Shared closed-set linguistic tables (PREP_CASE, DEF_ARTICLE_CASE, INDEF_ARTICLE_CASE, SEPARABLE_PREFIXES, SEIN_VERBS, BOTH_AUX_VERBS) | VERIFIED | IIFE exports onto `self.__lexiGrammarTables`; module.exports dual-export footer present |
| `extension/content/vocab-seam-core.js` | `participleToAux` index in `buildLookupIndexes` return | VERIFIED | 652-entry Map; returned from `buildIndexes()` |
| `extension/content/vocab-seam.js` | `getParticipleToAux()` getter | VERIFIED | Added per plan; follows same pattern as `getNounGenus()` |
| `extension/content/spell-rules/de-prep-case.js` | DE-01 preposition-case governance rule | VERIFIED | `id: 'de-prep-case'`, priority 68, lazy grammar-tables init |
| `extension/content/spell-rules/de-separable-verb.js` | DE-02 separable-verb split rule | VERIFIED | `id: 'de-separable-verb'`, priority 69, lazy grammar-tables init |
| `extension/content/spell-rules/de-perfekt-aux.js` | DE-03 perfekt auxiliary choice rule | VERIFIED | `id: 'de-perfekt-aux'`, priority 70, reads `participleToAux` from ctx.vocab |
| `extension/content/spell-rules/de-compound-gender.js` | DE-04 compound-noun gender inference rule | VERIFIED | `id: 'de-compound-gender'`, priority 71, lazy grammar-tables init |
| `fixtures/de/prep-case.jsonl` | ≥30 positive + ≥15 acceptance fixtures | VERIFIED | 32 positive + 20 acceptance = 52 total, 1.000 F1 |
| `fixtures/de/separable-verb.jsonl` | ≥30 positive + ≥15 acceptance fixtures | VERIFIED | 32 positive + 20 acceptance (8 clean + 12 where only other rules fire) = 52 total, 1.000 F1 |
| `fixtures/de/perfekt-aux.jsonl` | ≥30 positive + ≥15 acceptance fixtures | VERIFIED | 34 positive + 15 acceptance = 49 total, 1.000 F1 |
| `fixtures/de/compound-gender.jsonl` | ≥30 positive + ≥15 acceptance fixtures | VERIFIED | 32 positive + 15 acceptance = 47 total, 1.000 F1 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grammar-tables.js` | `self.__lexiGrammarTables` | IIFE global export | WIRED | Line 147: `host.__lexiGrammarTables = tables;` confirmed |
| `vocab-seam-core.js` | `participleToAux` | `buildLookupIndexes` return | WIRED | Map returned from `buildIndexes()`; size 652 from de.json verbbank |
| `de-prep-case.js` | `self.__lexiGrammarTables` | lazy `host.__lexiGrammarTables \|\| {}` at check() time | WIRED | Line 51 of rule file confirmed; avoids Node alphabetical load-order issue |
| `de-separable-verb.js` | `self.__lexiGrammarTables` | lazy `host.__lexiGrammarTables \|\| {}` at check() time | WIRED | Line 31 of rule file confirmed |
| `de-compound-gender.js` | `self.__lexiGrammarTables` | lazy `ensureTables()` called at first check() | WIRED | Line 44 of rule file confirmed |
| `de-perfekt-aux.js` | `vocab.participleToAux` | `ctx.vocab.participleToAux` at check() time | WIRED | Lines 102-109 of rule file confirmed |
| `de-compound-gender.js` | `vocab.nounGenus` | greedy longest-suffix split against `nounGenus` Map | WIRED | `inferGenderFromSuffix(word, nounGenus)` confirmed at line 78 |
| `de-v2.js` | `self.__lexiGrammarTables.SEPARABLE_PREFIXES` | reads from grammar-tables with local fallback | WIRED | Lines 37-38: `grammarTables.SEPARABLE_PREFIXES \|\| new Set([...])` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DE-01 | 08-01, 08-02 | DE preposition-case governance — article-case mismatch after prepositions | SATISFIED | `de-prep-case.js` exists, wired, 52 fixtures at 1.000 F1, benchmark de.44 covered |
| DE-02 | 08-01, 08-02 | DE separable-verb split — unsplit separable verbs flagged in main clauses | SATISFIED | `de-separable-verb.js` exists, wired, 52 fixtures at 1.000 F1, benchmark de.47 covered |
| DE-03 | 08-01, 08-03 | DE perfekt auxiliary choice — haben/sein errors flagged | SATISFIED | `de-perfekt-aux.js` exists, wired, 49 fixtures at 1.000 F1, benchmark de.45 covered |
| DE-04 | 08-01, 08-03 | DE compound-noun gender inference — wrong article flagged on unknown compounds | SATISFIED | `de-compound-gender.js` exists, wired, 47 fixtures at 1.000 F1, benchmark de.46 covered (Handtasche, not Schultasche — Schultasche is in nounbank) |

All four requirements are mapped to Phase 8 in REQUIREMENTS.md and marked Complete. No orphaned requirements found.

### Anti-Patterns Found

None found. Scan of all four new rule files produced:
- No TODO/FIXME/placeholder comments
- No empty `return null` / `return {}` / `return []` implementations
- No console.log-only handlers
- No fetch/XHR (confirmed by check-network-silence PASS)
- Lazy-init pattern in all four rules is intentional and documented in SUMMARYs (handles Node fixture harness alphabetical load order vs browser manifest order)

### Human Verification Required

None. All automation checks pass.

The following items were deferred to milestone end per project memory (not Phase 8 specific):

1. **Browser verification of dot-colour rendering** — Visual confirmation that amber (#f59e0b) dots appear on flagged tokens in a real Chrome tab for each of the four new rules. Expected: coloured underline dots appear on "mit den Schule", "zurückkomme", "habe gegangen", "Das Handtasche" patterns. Why human: CSS rendering and content-script injection can only be verified in the browser.

2. **Typo-dedup interaction for separable-verb** — The typo-fuzzy rule (priority 50) claims most short-prefix unsplit forms before de-separable-verb (priority 69) can fire. Only long-prefix forms (zurück/weiter/vorbei/heraus) reliably surface de-separable-verb findings in the UI. The fixture suite documents this honestly but a human should confirm the end-user experience is acceptable.

## Release Gate Summary

| Gate | Status |
|------|--------|
| `check-fixtures` | PASS — all DE rules 1.000 F1; de/v2 at 0.991 and de/verb-final at 0.980 (pre-existing, not Phase 8) |
| `check-explain-contract` | PASS — 34/34 popover-surfacing rules |
| `check-rule-css-wiring` | PASS — 34/34 rules including all four Phase 8 rules |
| `check-network-silence` | PASS — no fetch/XHR in new rule files |
| `check-spellcheck-features` | PASS — participleToAux: 3 assertions verified (gegangen/sein, gemacht/haben, gefahren/both) |
| `check-benchmark-coverage` | PASS — 12/12 (P2: 10/10, P3: 2/2) |

### Notable Implementation Decisions

1. **Lazy grammar-tables init in rule files** — All four new rules read `host.__lexiGrammarTables` at `check()` time (not at IIFE registration). This handles the Node fixture harness loading rule files alphabetically (e.g., `de-compound-gender.js` before `grammar-tables.js`) while the browser manifest loads them in the declared order. Pattern is established and documented.

2. **Benchmark substitution: Handtasche not Schultasche** — Plan 01 specified `Das Schultasche` as the DE-04 benchmark target, but `schultasche` is already in nounbank and handled by `de-gender` (not `de-compound-gender`). Changed to `Das Handtasche` which is not in nounbank, correctly testing compound inference. Verified correct.

3. **Separable-verb fixture acceptance strategy** — 20 acceptance fixtures for `de-separable-verb`, 12 of which have other rules firing (typo, capitalization). All 20 correctly assert that `de-separable-verb` does not fire, which is the acceptance contract being tested. Meets the ≥15 acceptance requirement.

4. **SEPARABLE_PREFIXES canonical source** — Moved from local const in `de-v2.js` to `grammar-tables.js`. `de-v2.js` retains a local fallback Set for backward compatibility if grammar-tables loads after de-v2.js in edge cases.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
