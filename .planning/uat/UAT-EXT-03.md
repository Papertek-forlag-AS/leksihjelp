---
walkthrough_id: UAT-EXT-03
phase: 38-extension-uat-batch
verification_kind: human-browser-walk
ext_version: 2.9.19
idb_revision: none
preset_profile: default
browser_version: Chrome 147.0.7727.117 arm64
reload_ts: 2026-05-01T20:30:00+02:00
target_browsers: [chrome, edge, brave]
walker: Geir
date: 2026-05-01
---

<!--
Instantiated from .planning/uat/TEMPLATE-walkthrough.md for Phase 38-03 highest-stakes walkthrough.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.

Sequence position (per STATE v3.2 entry decision): warm-up (UAT-EXT-01, complete) → canonical (UAT-EXT-04, complete)
→ highest-stakes (this — Phase 27 / UAT-EXT-03) → final (Phase 26 / UAT-EXT-02).

Target surface: Phase 27 exam-mode — toggle, EKSAMENMODUS badge, amber widget border, rule
suppression behavior, exam-registry coverage, lockdown teacher-lock dual mode, persistence.

CRITICAL: Exam-mode trust is school-deployment-critical. Default severity for any defect is
`major`; use `blocker` if the toggle itself or the suppression boundary is broken. Defects
touching `extension/exam-registry.js` (a synced surface) require `sync_status: needs-resync`
plus the [lockdown-resync-needed] commit-message marker on any fix commit (HYG-06).

Frontmatter field guidance:
- ext_version: fill from extension/manifest.json — guards stale-zip walks
- idb_revision: fill from chrome.storage / DevTools IndexedDB — guards stale-data walks (TBD — fill at walk time)
- preset_profile: default | basic | full — guards Phase 05.1 feature-gating regression class
- browser_version: e.g. "Chrome 138.0.6962.42"
- reload_ts: ISO-8601 — chrome://extensions reload timestamp (TBD — fill at walk time)
-->


# Walkthrough: Phase 27 exam-mode 9-step (highest-stakes)

Re-confirms the Phase 27 exam-mode contract works end-to-end against real Chrome. Third in the
locked Phase 38 walk sequence — school-deployment trust depends on this walk landing clean.

## Pre-flight evidence (paste before walking)

Run and record each item before touching the browser. Stale artifacts are the #1 v3.1 walkthrough failure mode (Pitfall 1).

- [x] `node scripts/check-vocab-deployment.js` exit code: `0` (run by Claude 2026-05-01, HEAD `cc523ae1`) — output below.
- [x] `extension/manifest.json` `version` matches frontmatter `ext_version`: `2.9.19`
- [x] IDB revision captured from `chrome.storage` (or DevTools → Application → IndexedDB): `none` (no IndexedDB present) — matches frontmatter `idb_revision`
- [x] Reload timestamp recorded from chrome://extensions reload click: `2026-05-01T20:30:00+02:00` — matches frontmatter `reload_ts`
- [x] Browser + version recorded: `Chrome 147.0.7727.117 arm64` — matches frontmatter `browser_version`
- [x] Preset profile in popup matches frontmatter `preset_profile`: `default` (frontmatter default; walker confirms or updates if testing variant)

```
[check-vocab-deployment] PASS: all 6 language(s) at HEAD cc523ae1.
  nb: 437e906f
  nn: 2a9654a5
  de: ad7f2697
  es: 2f8b277a
  fr: 5b0b49a7
  en: 65e6068b
```

## Steps

Numbered, one observable per step. Shape: `<step> → expected: … → observed: … → ✅/❌`.

1. **Toggle exam-mode ON** (popup → settings → exam-mode toggle → ON). → expected: setting persists to `chrome.storage.local`; popup re-renders showing exam-mode active state (toggle reflects ON; any exam-mode-related UI cues appear). No console errors. → observed: pass → ✅

2. **EKSAMENMODUS badge visible** (with exam-mode ON, observe popup header AND open the floating widget on a page — e.g. select text on any web page to summon the widget). → expected: EKSAMENMODUS badge renders in the popup header; same badge renders on the floating widget when exam-mode is active. Badge styling matches Phase 27 spec (visible, clearly labelled). → observed: pass → ✅

3. **Amber widget border** (with exam-mode ON, summon the floating widget on a page by selecting text). → expected: the spell-check widget has a visible amber/exam-styled border distinct from the normal-mode border. Border colour is unmistakable to a teacher glancing at the screen. → observed: pass → ✅

4. **Suppression behavior — typos still surface** (with exam-mode ON, type a clearly misspelled NB word in any text input — e.g. `kanjse` or `kommutar`). → expected: nb-typo-curated and/or nb-typo-fuzzy still fire (exam-safe — typos are spell-check, allowed). Dot renders; popover opens normally. → observed: pass → ✅

5. **Suppression behavior — non-exam-safe rules suppressed** (with exam-mode ON, trigger a rule with `exam.safe: false` — easiest target: type into any text input long enough for word-prediction dropdown to attempt to fire; per registry `wordPrediction.dropdown` is `safe: false`. Alternative: trigger a pedagogy panel — `widget.pedagogyPanel` is `safe: false`). → expected: word-prediction dropdown does NOT render; Lær mer pedagogy panel does NOT expand even on enriched entries. → observed: pass → ✅

6. **Toggle exam-mode OFF** (popup → settings → exam-mode toggle → OFF, then retest the Step 5 inputs). → expected: previously-suppressed surfaces now fire on the same input — word-prediction dropdown reappears; Lær mer panel expands; EKSAMENMODUS badge disappears from popup header AND from widget; widget amber border returns to normal. → observed: pass → ✅

7. **Exam-registry coverage** (sample 2-3 entries from `extension/exam-registry.js` and verify each behaves per its `safe: true|false` declaration; suggest sampling: `popup.search` (safe: true — search must work in exam mode), `widget.pedagogyPanel` (safe: false — Lær mer must be hidden), `popup.ttsButton` (safe: true — TTS must work)). → expected: each sampled entry's runtime behaviour matches its registry declaration. → observed: pass → ✅

8. **Lockdown teacher-controlled exam-mode** — walker confirmed (2026-05-01) that teacher-lock is already implemented and working in lockdown staging. Architectural clarification per walker: **in lockdown context the student does NOT have an exam-mode toggle** — exam-mode is purely teacher-controlled via lockdown's teacher-lock setting. The "dual mode" framing was a vanilla-extension projection; lockdown simplifies to teacher-only. → expected: lockdown teacher sets exam-mode → leksihjelp sidepanel enforces exam-safe surfaces only; student has no UI to override. Vanilla extension keeps the student toggle (tested in Step 1) — this is a vanilla-only feature, not a lockdown one. → observed: walker confirms teacher-lock works in lockdown staging based on prior testing. → ✅
   - **Follow-up (deferred to Phase 39 UAT-LOCK-02):** assert that the student-side exam-mode toggle is hidden/absent in the lockdown sidepanel host UI. This is a lockdown-side concern (lives in `/Users/geirforbord/Papertek/lockdown` sidepanel host code, not in the synced leksihjelp surface). Lockdown's own UAT proper will exercise this.

9. **Persistence across reload** (toggle exam-mode ON; reload the extension at chrome://extensions; reopen popup; then close+reopen Chrome entirely; reopen popup again). → expected: exam-mode state persists across `chrome://extensions` reload AND across full browser restart (state read from `chrome.storage.local`). Badge + suppression behaviour persist accordingly. → observed: pass → ✅

(Every step must record both expected AND observed — empty observed is a walk-not-completed signal per HYG-01.)

## Defects observed

Use one bullet per defect; file a finding for every ❌. **Default severity is `major`** for exam-mode defects (school-trust); promote to `blocker` if the toggle itself or the suppression boundary is broken. Defects touching `extension/exam-registry.js` (synced surface): `sync_status: needs-resync` and `[lockdown-resync-needed]` on the fix commit.

none — clean pass on all 9 exam-mode steps. School-deployment trust confirmed.

## Outcome

- [x] All steps pass (no ❌ above)
- [x] Findings filed: `none`
- [x] Walker signs off: `Geir 2026-05-01T20:30:00+02:00`
