---
phase: 28-lockdown-exam-mode-sync
plan: 01
status: complete (plumbing-only — Task 4 split off to Phase 29)
completed: 2026-04-28
requirements_completed: ["EXAM-08-plumbing"]
files_modified:
  - /Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js
  - /Users/geirforbord/Papertek/lockdown/public/js/leksihjelp-loader.js
  - /Users/geirforbord/Papertek/lockdown/public/leksihjelp/exam-registry.js (sync output)
  - /Users/geirforbord/Papertek/lockdown/public/leksihjelp/* (sync refresh — 80+ files)
  - /Users/geirforbord/Papertek/leksihjelp/CLAUDE.md
commits:
  - lockdown b7a92b4 (staging branch — pushed to origin)
  - leksihjelp c6aff0f
deferred_to_phase_29:
  - Task 4: Teacher-lock writer in lockdown's writing-environment.js
---

# Phase 28-01: Lockdown Exam-Mode Sync — Plumbing-Only Closure

**Status:** Plumbing tasks (1, 2, 3, 5) shipped to lockdown's `staging` branch. Teacher-lock writer (Task 4) split off to Phase 29 because Option B requires non-trivial product/Firebase work (new resource profile + firestore.rules deploy + UI dropdown + locales) that needs explicit product scoping.

## What shipped

### Task 1 — `lockdown/scripts/sync-leksihjelp.js`

Added an explicit `fs.copyFileSync` for `extension/exam-registry.js` → `public/leksihjelp/exam-registry.js` after the i18n block. The registry lives outside `extension/content/` so the existing recursive walk skipped it.

### Task 2 — `lockdown/public/js/leksihjelp-loader.js`

Prepended `'leksihjelp/exam-registry.js'` to `LEKSI_BUNDLE` (line 372) so `__lexiExamRegistry` is registered before `spell-check-core.js` initialises. Without this, the fail-safe path in spell-check-core would hide every surface even when `examMode` is off.

### Task 3 — sync re-run

`LEKSIHJELP_LOCAL=...leksihjelp node scripts/sync-leksihjelp.js` from lockdown root. Verified:

- `public/leksihjelp/exam-registry.js` exists ✓
- `floating-widget.js`, `word-prediction.js`, `spell-check.js` all contain `examMode` references ✓ (Phase 27 commits propagated)

The sync also pulled in unrelated drift the upstream tree had accumulated: 8 newer rule files (nb-aa-og, nb-compound-gender, nb-demonstrative-gender, nb-nn-passiv-s, nb-triple-letter, doc-drift-nb-passiv-overuse + others), `nb-baseline.json`, vocab-seam tests. All sync output, no hand edits — net +108k/−6k lines.

### Task 5 — leksihjelp `CLAUDE.md`

Updated the "Downstream consumer" section to:

- Document `extension/exam-registry.js` as a synced surface (with load-order note)
- List BOTH consumers (lockdown webapp + skriveokt-zero) — corrects the prior singular framing that blind-spotted skriveokt-zero in the v3.1 audit
- Add an "Implications" bullet that adding new entries to the exam-registry requires re-running each consumer's sync

## Why Task 4 was split off

Task 4 originally read: "wire teacher-lock writer in lockdown's writing-environment.js — write `chrome.storage.local.set({ examModeLocked: true, examMode: true })` when teacher selects exam profile."

Discovery surfaced that lockdown's existing `RESOURCE_PROFILES.EXAM` envelope (Phase 63) explicitly returns `{ leksihjelp: false }` — the existing "Eksamen-modus" means **browser-only spellcheck, no leksihjelp at all**. There's an explicit BSPC-01 path at `writing-environment.js:953` depending on `EXAM + browser` being expected.

The plan offered two reconciliation options:

**Option A** — flip `EXAM` envelope to `leksihjelp: true` and write storage flags on profile===EXAM. Rejected: silently changes Phase 63's contract — teachers picking "Eksamen-modus" today get browser-only; with Option A they'd suddenly get leksihjelp-in-exam-mode.

**Option B** — introduce a new resource profile (e.g. `LEKSIHJELP_EXAM`). User picked B. But B's actual cost is bigger than just JS wiring:

1. New enum value in `RESOURCE_PROFILES` + `PROFILE_LABELS_NB`
2. New `<option>` in `question-builder.js` teacher dashboard
3. Locale strings in `nb.js` / `en.js` (and `nn.js`)
4. **`firestore.rules`** — hardcoded enum at lines 25 and 30 (`v in ['full', 'exam', 'lexin', 'none']`) rejects unknown values
5. **Cloud Functions** (`createTest.js`, `toggleResourceAccess.js`) likely have same hardcoded enum
6. **Manual Firebase deploy** to staging-lockdown (per `DEPLOY_NOTES.md`: "Firebase rules must be deployed manually")

That's product UX + Firebase deploy — a different risk profile than "wire one function". Split to Phase 29 so it can be scoped properly with explicit product input on naming, label, envelope shape, and the firestore-rules deploy plan.

## Staging verification path

The leksihjelp popup carries a **"Simuler lærer-lås" dev button** (added in Phase 27-03 UAT, commit `94d591b`). On stb-lockdown.app once Vercel finishes the staging-lockdown deploy:

1. Open the leksihjelp popup (Fest button or popup target).
2. Click "Simuler lærer-lås" — writes `examModeLocked + examMode = true` to `chrome.storage.local`.
3. Confirm:
   - Toggle ON+disabled with "Slått på av lærer" caption
   - EKSAMENMODUS badge visible
   - Floating widget amber border in lockdown's web context
   - Word-prediction dropdown does not open
   - Grammar-lookup dots suppressed; typo dots + dictionary lookups remain
   - DevTools console clean — no `__lexiExamRegistry undefined` errors

This exercises every Phase 28 wire (registry loaded → consumers read it → suppression fires across the chrome shim) without needing the (deferred) teacher dashboard control. Failure modes documented in the original plan's `<how-to-verify>` block.

## Outstanding follow-ups

- **Phase 29** (new) — teacher-controlled exam-mode lock for the lockdown webapp. Scope: pick a UX (new resource profile vs per-test toggle), update `firestore.rules` + functions, deploy Firebase rules to both staging-lockdown and lockdown-stb projects, wire the writer, add UI label + locale strings.
- **Phase 28.1** (deferred — skriveokt-zero) — same plumbing for the Tauri sibling once it ships to consumers. Tracked by EXAM-09.
- **EXAM-08 split** in REQUIREMENTS.md: original requirement reframed as plumbing-only (now satisfied); new EXAM-10 for teacher control (assigned to Phase 29).

## Commits

- **lockdown** `b7a92b4` (staging branch) — pushed to origin/staging at `87f41e1..b7a92b4`. Vercel will auto-deploy to staging-lockdown → stb-lockdown.app.
- **leksihjelp** `c6aff0f` — `CLAUDE.md` updated to document both downstream consumers + load-order rule.
