---
phase: 28-lockdown-exam-mode-sync
verified: 2026-04-28T00:00:00Z
status: passed (plumbing-only — Task 4 deliberately split to Phase 29)
score: 4/4 plumbing must-haves verified; Task 4 reclassified as new requirement EXAM-10
re_verification: false
human_verification:
  - test: "On stb-lockdown.app (after Vercel staging deploy), open leksihjelp popup, click 'Simuler lærer-lås' dev button"
    expected: "EKSAMENMODUS badge appears; toggle disabled+ON with 'Slått på av lærer' caption; floating widget gains amber border; word-prediction dropdown does not open; grammar-lookup dots suppressed; typo dots + dictionary lookups remain; no __lexiExamRegistry undefined errors in console"
    why_human: "End-to-end runtime verification of cross-app plumbing requires a live browser session against deployed staging"
---

# Phase 28: Lockdown Exam-Mode Sync — Verification Report

**Phase Goal:** Close the lockdown webapp half of EXAM-08 — extend sync to copy `extension/exam-registry.js`, ensure load-order in `LEKSI_BUNDLE`, refresh stale Phase 27 content scripts, and wire teacher-lock storage flags.

**Status:** Plumbing closed (Tasks 1, 2, 3, 5). Task 4 (teacher-lock writer) deliberately split to a new Phase 29 — see § Re-Scope.

## Goal Achievement

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `lockdown/scripts/sync-leksihjelp.js` copies `extension/exam-registry.js` → `public/leksihjelp/exam-registry.js` | VERIFIED | Sync run produced `public/leksihjelp/exam-registry.js` (commit `b7a92b4`) |
| 2 | `LEKSI_BUNDLE` injects `'leksihjelp/exam-registry.js'` strictly before `'leksihjelp/spell-check-core.js'` | VERIFIED | `lockdown/public/js/leksihjelp-loader.js:372-378` — registry first, spell-check-core second |
| 3 | After sync, `floating-widget.js` / `word-prediction.js` / `spell-check.js` contain `examMode` references (Phase 27 commits propagated) | VERIFIED | grep across all three files returns matches in commit `b7a92b4` |
| 4 | leksihjelp `CLAUDE.md` "Downstream consumer" section documents the new sync surface and lists both consumers | VERIFIED | `c6aff0f` — section retitled "Downstream consumers", both consumers + load-order rule documented |

**Score:** 4/4 plumbing must-haves verified.

## Re-Scope

Task 4 originally framed: *"wire teacher-lock writer in lockdown's writing-environment.js"*. During execution the discovery step found:

- Lockdown's existing `RESOURCE_PROFILES.EXAM` envelope (Phase 63) returns `{ leksihjelp: false }` — i.e. "Eksamen-modus" today means browser-only spellcheck, no leksihjelp.
- BSPC-01 wiring at `writing-environment.js:953` explicitly depends on `EXAM + browser` being the expected combination.

Both reconciliation options carry non-trivial cost:

- **Option A** (flip EXAM envelope to `leksihjelp: true`): silently changes Phase 63 contract for existing teachers — rejected.
- **Option B** (new resource profile, e.g. `LEKSIHJELP_EXAM`): chosen by user, but full cost is product UX + `firestore.rules` enum update + Cloud Functions update + manual Firebase deploy to both staging-lockdown and lockdown-stb projects. That's a separate phase.

Task 4 split to **Phase 29** with explicit scope. New requirement **EXAM-10** added to track the teacher-control half. EXAM-08 reframed as plumbing-only.

This is captured in 28-01-SUMMARY.md and reflected in REQUIREMENTS.md + ROADMAP.md updates.

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `lockdown/scripts/sync-leksihjelp.js` (Task 1 edit) | VERIFIED | `+11` lines for registry copy block |
| `lockdown/public/js/leksihjelp-loader.js` (Task 2 edit) | VERIFIED | `+5` lines (registry entry + ordering comment) |
| `lockdown/public/leksihjelp/exam-registry.js` | VERIFIED | created by sync (Task 3) |
| `lockdown/public/leksihjelp/{floating-widget,word-prediction,spell-check}.js` | VERIFIED | refreshed by sync — examMode references present |
| `leksihjelp/CLAUDE.md` (Task 5) | VERIFIED | "Downstream consumers" section retitled + load-order documented |

## Anti-Patterns

None. The sync re-run pulled in significant unrelated drift (8 newer rule files, nb-baseline.json, vocab-seam tests) — but that's all sync output, no hand edits, and corrects long-standing staleness in lockdown's checked-in tree.

## Cross-Phase Integration

- **Phase 27 → Phase 28:** Phase 27 content scripts (`floating-widget`, `word-prediction`, `spell-check`) now reach lockdown with their `examMode` runtime gating intact.
- **Phase 28 → Phase 29 (new):** registry + load-order is in place so when Phase 29 wires the teacher-lock storage write, the runtime suppression has everything it needs to fire.

## Human Verification Required

End-to-end browser verification on stb-lockdown.app (staging-lockdown Firebase project) once Vercel finishes auto-deploy from the pushed `staging` branch. The "Simuler lærer-lås" dev button in the leksihjelp popup (added in Phase 27-03 UAT commit 94d591b) drives the lock state without needing Phase 29 wiring — an honest end-to-end test of every Phase 28 wire.

See 28-01-SUMMARY.md "Staging verification path" section for the exact steps.

## Gaps Summary

No gaps within the (re-scoped) Phase 28 plumbing scope. The teacher-lock writer that was Task 4 is now tracked as **EXAM-10 → Phase 29** and is documented in REQUIREMENTS.md, ROADMAP.md, and the v3.1 milestone audit.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd execution + scope-reconciliation)_
