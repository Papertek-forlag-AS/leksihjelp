---
phase: 15-collocations-at-scale-nb-de-fr-es
verified: 2026-04-25T17:30:00Z
status: passed
score: 6/6 must-haves verified
---

# Phase 15: Collocations at Scale Verification Report

**Phase Goal:** Scale the Phase 6 EN collocation rule to flag preposition-collocation errors in NB, DE, FR, and ES — seed data per language, benchmark lines, expectations, fixtures.
**Verified:** 2026-04-25T17:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | NB sentence with 'flink i' triggers collocation warning suggesting 'flink til' | VERIFIED | collocation.js nb seed entry `{ trigger: 'flink i', fix: 'flink til' }` present; nb.37 benchmark line contains "flink i å gå i bånd"; check-benchmark-coverage passes nb.37 |
| 2   | DE sentence with wrong verb-preposition collocation triggers warning | VERIFIED | 22 DE seed entries with conjugated forms (e.g. `angst von → Angst vor`, `warte für → warten auf`); de.49 benchmark line "Ich habe Angst von der Prüfung und ich warte für den Bus" flips; benchmark PASS |
| 3   | FR sentence with wrong verb-preposition collocation triggers warning | VERIFIED | 33 FR seed entries covering penser/pense/penses/pensons/pensez/pensent + jouer/rêver/dépendre etc.; fr.58 benchmark line "Je pense de mes vacances et je cherche pour un hôtel" flips; benchmark PASS |
| 4   | ES sentence with wrong verb-preposition collocation triggers warning | VERIFIED | 29 ES seed entries with conjugated forms (soñar/sueño/sueñas, pensar/pienso/piensas, depender/dependo/dependes etc.); es.45 benchmark line "Yo sueño de ser médico y dependo en mis padres" flips; benchmark PASS |
| 5   | Existing EN collocation detection still works unchanged | VERIFIED | 19 EN seed entries unchanged; en key preserved in SEED_COLLOCATIONS object; check-fixtures [en/collocation] passes with P=1.000 R=1.000 F1=1.000 |
| 6   | Bundle size stays under 20 MiB ceiling | VERIFIED | check-bundle-size: 12.47 MiB zip — under 20 MiB cap by 7.53 MiB |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extension/content/spell-rules/collocation.js` | Multi-language collocation detection with NB, DE, FR, ES seed data; contains SEED_COLLOCATIONS | VERIFIED | 224 lines; SEED_COLLOCATIONS keyed object with en/nb/nn/de/fr/es; `languages: ['en', 'nb', 'nn', 'de', 'es', 'fr']`; fallback logic present |
| `benchmark-texts/expectations.json` | Benchmark expectations for NB/DE/FR/ES collocation lines; contains "collocation" | VERIFIED | Entries for nb.37, de.49, fr.58, es.45 all present with rule_id: collocation, severity: warning, priority_band: P2 |
| `fixtures/nb/collocation.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 48 total: 32 positive + 16 acceptance |
| `fixtures/de/collocation.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 47 total: 32 positive + 15 acceptance |
| `fixtures/fr/collocation.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 50 total: 35 positive + 15 acceptance |
| `fixtures/es/collocation.jsonl` | >= 30 positive + >= 15 acceptance fixtures | VERIFIED | 46 total: 31 positive + 15 acceptance |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `extension/content/spell-rules/collocation.js` | `ctx.lang` | `SEED_COLLOCATIONS[lang]` language-aware fallback | VERIFIED | Line 165: `const lang = ctx.lang === 'nn' ? 'nb' : ctx.lang;` followed by `collocations = SEED_COLLOCATIONS[lang] \|\| [];` — exact pattern required |
| `benchmark-texts/expectations.json` | `extension/content/spell-rules/collocation.js` | rule_id: collocation on nb/de/fr/es lines | VERIFIED | check-benchmark-coverage reports P2: 31/31 (100%) — all 4 new entries flip |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| COLL-01 | 15-01-PLAN.md | NB preposition collocations flagged (flink i → til, glad på → i, etc.); benchmark nb.txt "flink i" | SATISFIED | 13 NB seed entries; nb.37 benchmark expectation passes; 32 positive + 16 acceptance NB fixtures all at F1=1.000 |
| COLL-02 | 15-01-PLAN.md | DE preposition collocations flagged (parallel to COLL-01, data-driven) | SATISFIED | 22 DE seed entries (12 base + 10 conjugated forms); de.49 benchmark expectation passes; 32 positive + 15 acceptance DE fixtures at F1=1.000 |
| COLL-03 | 15-01-PLAN.md | FR preposition collocations flagged (parallel to COLL-01) | SATISFIED | 33 FR seed entries (12 base + 21 conjugated forms); fr.58 benchmark expectation passes; 35 positive + 15 acceptance FR fixtures at F1=1.000 |
| COLL-04 | 15-01-PLAN.md | ES preposition collocations flagged (parallel to COLL-01) | SATISFIED | 29 ES seed entries (12 base + 17 conjugated forms); es.45 benchmark expectation passes; 31 positive + 15 acceptance ES fixtures at F1=1.000 |

No orphaned requirements — all 4 IDs that map to Phase 15 in REQUIREMENTS.md are claimed by 15-01-PLAN.md and have implementation evidence.

### Anti-Patterns Found

No blockers or warnings found:
- No TODO/FIXME/PLACEHOLDER comments in collocation.js
- No empty return stubs — check() returns populated findings array
- No network calls — check-network-silence PASS (SC-06)
- No console.log-only implementations

### Release Gates (All 7 Pass)

| Gate | Result |
| ---- | ------ |
| `check-fixtures` | PASS — [nb/collocation] [de/collocation] [fr/collocation] [es/collocation] each P=1.000 R=1.000 F1=1.000 |
| `check-benchmark-coverage` | PASS — 40/40 expectations met (P1: 5/5, P2: 31/31, P3: 4/4) |
| `check-explain-contract` | PASS — 53/53 popover-surfacing rules valid |
| `check-rule-css-wiring` | PASS — 53/53 rules have CSS wiring (collocation id already bound) |
| `check-network-silence` | PASS — spell-check surface network-silent |
| `check-bundle-size` | PASS — 12.47 MiB zip, 7.53 MiB headroom |
| `check-governance-data` | PASS — no governance banks yet (pre-data-sync state) |

### Human Verification Required

None. All phase deliverables are programmatically verifiable (rule logic, fixture pass rates, benchmark flip rates, bundle size).

### Commits Verified

| Commit | Description |
| ------ | ----------- |
| `933ef1b` | feat(15-01): extend collocation rule to NB, DE, FR, ES |
| `98f4d1f` | feat(15-01): add collocation fixture files for NB, DE, FR, ES |

### Notable Design Decision

The plan specified infinitive verb triggers (e.g. "penser de") but substring matching against student text requires conjugated surface forms (e.g. "Je pense de"). The executor correctly expanded DE by 10 entries, FR by 21, and ES by 17 to cover common conjugations. This is documented in the summary as an auto-fixed bug and is the correct approach — the collocation rule fires on literal text, not lemmatised tokens.

### Gaps Summary

No gaps. All 6 must-haves verified, all 4 requirements satisfied, all 7 release gates pass.

---

_Verified: 2026-04-25T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
