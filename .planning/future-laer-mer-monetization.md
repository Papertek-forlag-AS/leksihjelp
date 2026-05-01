# Future Idea — "Lær mer" as Toggleable Paid Feature

**Status:** DEFERRED — capture for later milestone, not yet planned
**Captured:** 2026-05-01
**Origin:** Phase 35 walkthrough — surfaced after v2.9.15 made Lær mer
work in the browser for the first time end-to-end.

## The idea

Make every "Lær mer" pedagogy panel surface a per-user toggle (on by
default), and gate it behind a paid tier in a future business-model
phase. Spell-check + correction stays free forever (the original
dyslexia-helper promise); the pedagogy/learning-manual surface
becomes the paid extension.

## The framing

Leksihjelp's original promise was a free dyslexia helper — typo
detection, suggestions, basic spell-check. Lær mer evolved into
something materially more: a structured learning manual rendered
inline (case badges, contraction breakdown, summary, explanation,
worked examples, common pitfalls). That's pedagogical content with
real authoring + maintenance cost (every new rule needs a pedagogy
block in papertek-vocabulary, every block needs NB + NN + EN
strings, every rule needs an explain.exam marker, etc.). It's a
reasonable place to draw a paid/free line without breaking the
original promise.

## What gates this

Several v3.x things have to land first:

- **User-account model in extension** — currently no concept of
  free-vs-paid user. Vipps Recurring + Stripe Yearly already exist
  in the backend (per CLAUDE.md), but the extension client doesn't
  gate any feature on subscription state. Today subscription only
  unlocks ElevenLabs TTS quota.
- **Default-on / opt-in defaults** — paid-tier-gated ≠ off-by-default.
  Free users still see Lær mer in some form (maybe the summary line,
  not the full panel? or N panels per day? to be decided). The
  exact free/paid split needs UX + business design.
- **Exam-mode interaction** — Lær mer is already exam-suppressed
  (rule.explain.exam.safe = false). Paid-feature gating layers on
  top: exam-suppressed for everyone; paid-only for non-exam.
  Order of resolution matters for the popover gate logic.
- **Per-feature toggle in popup settings** — currently no UI for
  toggling Lær mer. Phase 26 shipped the panel as always-on. A
  toggle would land first as a free user-preference, then later
  become paid-gated.

## Where this fits

Probably v3.2 or v4.0 — after v3.1 polish is wrapped and after
Phase 27 exam-mode has soaked in production for a while. Could
piggyback on a broader monetization phase that revisits the
extension's paid surfaces (TTS quota, premium voices,
dictionary depth, etc.).

Not a Phase 36 candidate — Phase 36 is finishing v3.1's UAT debt.

## Cross-repo / downstream notes

If gated, the toggle state needs to sync across surfaces:
- Vanilla extension popup
- Lockdown sidepanel (re-uses synced spell-check.js — needs to
  honour the gate state, possibly fed in via host deps)
- Skriveokt-zero (same)

The simplest implementation: a `pedagogyEnabled` boolean on the
finding-render path (line 596 / 653 in spell-check.js) that AND's
with the existing `finding.pedagogy` truthy check. When false: no
Lær mer button, even if pedagogy attached.

## Original promise — references

- `backend/public/index.html` landing page describes leksihjelp as a
  helper for Norwegian students (no explicit "free forever" but
  understood as the baseline)
- The dyslexia-helper / spell-check baseline (typo + gender + särskriving
  + modal verb + dialect-mix) is what shipped in v1.0 and is what
  the user originally promised to keep free.
