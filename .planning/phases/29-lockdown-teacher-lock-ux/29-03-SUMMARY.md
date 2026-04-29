---
plan_id: 29-03
status: deferred
deferred_to: phase-30
created: 2026-04-29
---

# Plan 29-03 — DEFERRED to Phase 30

## Status: DEFERRED (rolled into Phase 30)

This was the end-to-end browser-verification plan for the LEKSIHJELP_EXAM
teacher-lock path. UAT against staging surfaced multiple latent bugs **outside
Phase 29's code scope** that block meaningful verification on the existing
lockdown sidepanel surface:

- The lockdown leksihjelp dictionary panel is a stub (`<input>` + `<div>`) — no
  conjugation rendering, no language switcher, no direction toggle, no grammar
  features. Phase 29 added the lock + engine envelope, but there is no
  user-visible dictionary surface on which to verify "exam-safe lookups still
  work".
- Pre-existing lockdown shim gaps were exposed and fixed in-flight during the
  UAT attempt:
  - `45df438` — `__lexiVocab` shim missing `getSPassivForms` (Phase 19 regression)
  - `5144f24` — editor-toolbar dropdown crashed on profile transitions when a
    new profile included modes not in the initial allowed set
  - `a856f43` — LEKSIHJELP_EXAM envelope corrected to `spellEngineOptions:['leksihjelp']`
    (was `['off']` — would have left engine off in exam-mode, defeating the
    profile's intent) + new `wordPrediction` envelope flag to hide the
    autocomplete toggle outside FULL profile

These fixes were committed to lockdown's `staging` branch and deployed to
`staging-lockdown.web.app`. The remaining UAT scope is more cleanly tested
**after** Phase 30 lands the synced view modules and replaces the stub panel.

## What rolls into Phase 30

The Phase 30 verification plan must cover all of Phase 29-03's checklist plus
the new dictionary-parity tests:

- Teacher creates a LEKSIHJELP_EXAM test → student opens → EKSAMENMODUS badge
  visible, leksihjelp toggle ON + disabled + "Slått på av lærer" caption
- Floating widget amber border when exam-locked
- Word-prediction dropdown does not open (already verified in-flight via
  toolbar visibility fix)
- Grammar-lookup dots suppressed; typo dots remain; dictionary lookups remain
- Profile transition LEKSIHJELP_EXAM → FULL clears flags correctly
- **NEW (Phase 30 scope):** dictionary panel renders conjugations, declensions,
  language switcher works, direction toggle works, no audio buttons in
  lockdown context (audio is extension-only)
- Phase 28's dev-only "Simuler lærer-lås" button still works (regression)
- Production deploy + papertek.app verification (still deferred per user
  instruction; will be picked up after Phase 30 staging UAT passes)

## Code state at deferral

Phase 29-01 + 29-02 commits are deployed on `staging-lockdown`. The four
in-flight fixes above are also deployed. Production (`lockdown-stb`) is
**not** deployed and remains so until after Phase 30 verification.

## Why defer instead of complete-with-gaps

Verification done now against the stub panel would test the lock mechanism
in isolation but would not exercise the dictionary surface students actually
use during an exam — so a "passed" mark would be misleading. Better to
verify the full surface once after Phase 30 ships the proper view modules.
