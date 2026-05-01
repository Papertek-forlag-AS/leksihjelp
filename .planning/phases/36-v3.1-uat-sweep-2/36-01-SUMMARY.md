---
phase: 36-v3.1-uat-sweep-2
plan: 01
subsystem: spell-rules
tags: [uat, de-gender, fr-aspect-hint, noAutoFix, v2, bags]
dependency_graph:
  requires:
    - extension/content/spell-rules/de-gender.js (existing ARTICLE_GENUS + ein-patch)
    - extension/content/spell-check.js (noAutoFix popover branch)
    - tests/fixtures + fixtures/{de,fr}/ (regression suite)
  provides:
    - extension/content/spell-rules/de-gender.js (kein/keine paradigm)
    - extension/content/spell-rules/{nb-v2,de-v2,fr-bags}.js (noAutoFix:true)
    - fixtures/de/grammar.jsonl (6 new kein/keine cases)
    - fixtures/fr/aspect-hint.jsonl (2 new F36-1 pin cases)
    - .planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md
  affects:
    - lockdown public/leksihjelp/ (synced surface — re-pin to 2.9.17 needed)
    - skriveokt-zero src/leksihjelp/ (synced when EXAM-09 lands)
tech_stack:
  added: []
  patterns:
    - "F36-5 pattern: structural rules (multi-token reorder, instructional fix) carry noAutoFix:true; consumers de-verb-final, de-separable-verb (pre-existing) + nb-v2, de-v2, fr-bags (new)."
    - "F36-3/F36-4 pattern: KEIN_PARADIGM map keeps suggestions inside the negative-indefinite paradigm rather than crossing to definite (der/die/das)."
key_files:
  created:
    - .planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md
  modified:
    - extension/content/spell-rules/de-gender.js
    - extension/content/spell-rules/nb-v2.js
    - extension/content/spell-rules/de-v2.js
    - extension/content/spell-rules/fr-bags.js
    - fixtures/de/grammar.jsonl
    - fixtures/fr/aspect-hint.jsonl
    - extension/manifest.json
    - package.json
    - backend/public/index.html
key_decisions:
  - "F36-1 fix-path: defensive pinning only — Node-side already correct. Plan listed Case A (priority swap) and Case B (data fix); diagnosis showed neither needed. Added 2 fixture cases pinning the canonical UAT sentence (with terminating period) so the regression cannot silently come back."
  - "F36-3/F36-4 paradigm: introduced KEIN_PARADIGM map ({m:kein, f:keine, n:kein}) so 'keine Mann' suggests 'kein' (paradigm-correct) instead of GENUS_ARTICLE['m']='der' (paradigm-cross). Mirrors how the existing 'ein' patch suggests 'eine' rather than 'die'."
  - "F36-5 audit: noAutoFix needed for nb-v2, de-v2 (multi-token swap, marker on subject token only) + fr-bags (instructional fix string). KEEP for fr-pp-agreement (atomic suffix change), fr-clitic-order (atomic span replacement), de-perfekt-aux (atomic single-token swap), es-pro-drop (technically atomic deletion)."
  - "Task 4 human-verify auto-approved per workflow.auto_advance=true; manual UAT recipe captured in 36-VERIFICATION.md F36-2 + Task 4 sections; batched with deferred Phase 26+27+30+35 walkthroughs."
  - "All 12 release gates exit 0 — including check-vocab-seam-coverage from Plan 36-02 (INFRA-10) which apparently shipped before this plan in wave order."
metrics:
  duration_minutes: 10
  tasks: 5
  files_modified: 9
  completed_date: "2026-05-01"
---

# Phase 36 Plan 01: v3.1 UAT Sweep #2 Summary

Closed the second wave of v3.1 UAT findings — F36-1 (FR `mangeait` aspect-hint dispute, defensive fixture pin), F36-3/F36-4 (DE `kein`/`keine` indefinite-negative paradigm), F36-5 (`noAutoFix` opt-in on three structural rules) — and bumped 2.9.16 → 2.9.17.

## What changed

**`extension/content/spell-rules/de-gender.js` (F36-3 / F36-4)**
- `ARTICLE_GENUS` extended with `'keine': 'f'`.
- New `KEIN_PARADIGM = { m:'kein', f:'keine', n:'kein' }` used when the offending article is `kein` or `keine` — keeps the suggestion inside the negative-indefinite paradigm.
- New manual block for bare `kein` before a feminine noun (mirrors the existing `ein` patch). The reverse direction is handled by the main loop via `ARTICLE_GENUS['keine']` + `KEIN_PARADIGM`.

**`extension/content/spell-rules/{nb-v2,de-v2,fr-bags}.js` (F36-5)**
- Added `noAutoFix: true` on all emitted findings. nb-v2 + de-v2: V2 fix is multi-token swap, marker spans only the subject pronoun. fr-bags: fix is instructional text `(flytt foran substantivet)` — would corrupt the sentence if pasted via Fiks.

**`fixtures/de/grammar.jsonl` (F36-3 / F36-4)**
- 6 new cases: 3 positive (kein-fem, keine-masc, keine-neut) + 3 clean negatives (keine-fem, kein-neut, kein-masc).

**`fixtures/fr/aspect-hint.jsonl` (F36-1)**
- 2 new pin cases: canonical UAT sentence with trailing period (positive), passé-composé variant (negative).

## Diagnosis: F36-1 (FR `mangeait`)

Node repro on `Hier il mangeait une pomme.`:
- Only `fr-aspect-hint` fires (priority 65). `nb-typo-fuzzy` (priority 50) correctly skips because `mangeait` is in `vocab.validWords` — `verbInfinitive.get('mangeait') === 'manger'`, `imparfait` conjugation present in `extension/data/fr.json`.
- Feature-gating sanity (basic FR preset, no `grammar_fr_imparfait`): `mangeait` is still in `validWords` because lookup indexes are built from the unfiltered superset (`check-spellcheck-features` gate contract).

Verdict: nothing to fix in the rule. Defensive pinning only.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocker] F36-1 fix path**
- **Found during:** Task 1 diagnosis
- **Issue:** Plan listed Case A (priority swap) and Case B (data fix); both intended to address a bug Node-side already handled correctly.
- **Fix:** Reduced Task 1 scope to defensive pinning (2 new fixture cases). Documented in 36-VERIFICATION.md F36-1 section.
- **Files modified:** fixtures/fr/aspect-hint.jsonl
- **Commit:** e19caa6

**2. [Rule 2 - Missing critical functionality] KEIN_PARADIGM map**
- **Found during:** Task 2 verification
- **Issue:** Plan said the main loop already handles `keine Mann → kein` via `GENUS_ARTICLE['m']`. But `GENUS_ARTICLE['m']='der'` is the definite article — Node repro confirmed: `keine Mann` was suggesting `der` (paradigm-cross), not `kein` (paradigm-correct).
- **Fix:** Added `KEIN_PARADIGM` map; selected based on whether the original article was already in the kein-paradigm.
- **Files modified:** extension/content/spell-rules/de-gender.js
- **Commit:** d7acf5f

### Auth gates

None.

## Self-Check: PASSED

- `extension/content/spell-rules/de-gender.js` — FOUND
- `extension/content/spell-rules/nb-v2.js` — FOUND (modified)
- `extension/content/spell-rules/de-v2.js` — FOUND (modified)
- `extension/content/spell-rules/fr-bags.js` — FOUND (modified)
- `fixtures/de/grammar.jsonl` — FOUND (extended)
- `fixtures/fr/aspect-hint.jsonl` — FOUND (extended)
- `.planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md` — FOUND
- Commits: e19caa6, d7acf5f, 8f541df, be50f06 — all in `git log --oneline -6`

## Commits

- e19caa6 — test(36-01): pin F36-1 canonical UAT sentence in fr-aspect-hint fixtures
- d7acf5f — feat(36-01): F36-3/F36-4 add kein/keine paradigm to de-gender
- 8f541df — feat(36-01): F36-5 add noAutoFix to structural rules (nb-v2, de-v2, fr-bags)
- be50f06 — chore(36-01): bump to 2.9.17, run 12 release gates, rebuild package

## Deferred / follow-ups

- Task 4 human-verify auto-approved per `workflow.auto_advance=true`. Manual UAT recipe in 36-VERIFICATION.md → batched with Phase 26 + 27 + 30 + 35 deferred walkthroughs.
- Lockdown + skriveokt-zero downstream consumers should re-pin to leksihjelp 2.9.17.
- F36-2 (ES Aa-pill watch-item) requires real-browser DevTools queries — see recipe.
