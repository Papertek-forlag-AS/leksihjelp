---
phase: 05-student-experience-polish
plan: 03
subsystem: ui
tags: [word-prediction, ux-02, progressive-disclosure, dyslexia, keyboard-nav, reveal-link]

# Dependency graph
requires:
  - phase: 05-student-experience-polish
    provides: "Plan 05-01 i18n keys pred_vis_flere + pred_vis_faerre (NB + NN) — render template consumes both"
provides:
  - "Word-prediction dropdown top-3 default cap across all 6 languages (NB/NN/DE/ES/FR/EN)"
  - "'Vis flere ⌄' / 'Vis færre ⌃' progressive-disclosure reveal link expanding to 8 candidates"
  - "ArrowDown auto-reveal keyboard path (zero extra keystrokes for keyboard users)"
  - "renderDropdownBody + attachDropdownHandlers helpers — dropdown render split so reveal-click can re-render without re-running findSuggestions"
  - "VISIBLE_DEFAULT / VISIBLE_EXPANDED constants for any future cap tuning"
  - ".lh-pred-vis-flere CSS rule (light + dark mode) — dyslexia-friendly underlined text-link"
affects: [05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Thin-wrapper + render-helper split: showDropdown owns session state (selectedIndex reset, expanded reset, lastSuggestions capture), renderDropdownBody owns innerHTML assembly, attachDropdownHandlers owns event wiring. Reveal-click re-renders via renderDropdownBody directly — avoids re-entry through showDropdown (which would reset expanded)."
    - "Pitfall-5 session-reset pattern: any per-session flag modified by user interaction (here: expanded) MUST be reset at the top of the session-entry function (showDropdown), BEFORE any render work reads it. Prevents state leak across independent sessions triggered by subsequent keystrokes."
    - "ArrowDown auto-reveal keyboard pattern: detect last-visible-item + more-available, flip expanded, re-render, advance selectedIndex onto the first newly-revealed row via Math.min clamp — zero extra keystrokes, defensively handles renderDropdownBody yielding fewer items than expected."
    - "Cap-raise invariant: splice cap must equal max-reveal cap (not visible-default cap) — splice happens pre-render and knocks out tail candidates irreversibly, whereas view-layer slicing is recoverable."

key-files:
  created: []
  modified:
    - "extension/content/word-prediction.js"
    - "extension/styles/content.css"

key-decisions:
  - "Thin-wrapper + render-helper split (showDropdown → renderDropdownBody + attachDropdownHandlers) chosen over inlining the reveal-click re-render inside showDropdown — reveal click MUST NOT re-enter showDropdown (which would reset expanded). Extracting renderDropdownBody is the cleanest way to share assembly logic between the initial render and the in-place re-render."
  - "splice(5) → splice(8) (not splice(3) or splice(VISIBLE_DEFAULT)) — Pitfall 6. The splice cap must equal the max-reveal cap so 1-4 compound unshifts + 3+ regular candidates both survive. View-layer slicing in renderDropdownBody handles the visible-3 / visible-8 toggle."
  - "findSuggestions request cap raised from 5 → 8 — ranker must surface enough candidates to fill the expanded view. findSuggestions limits to top-K by ranker score, so over-requesting is cheap."
  - "expanded module-scope state (not dropdown.dataset.expanded) — per-session flag lives alongside selectedIndex + dropdown + lexiPaused, all of which are module-scoped. Keeps the reveal machinery in the same mental model as existing dropdown state."
  - "CSS colours hand-coded (no CSS variables) — the file doesn't use CSS variables today, so introducing them in this plan would be a scope expansion. Matched the existing .lh-pred-hint / .lh-pred-footer palette byte-identically (#64748b, rgba(0,0,0,0.04) border, etc.)."
  - "13px font-size for .lh-pred-vis-flere — within dyslexia-friendly range given the dropdown's inherited line-height (1.4+) and proximity-spaced padding. Matches existing .lh-pred-translation size (11px) and .lh-pred-item content size (13px body). Going bigger would make the reveal affordance visually dominate the top-3, inverting the UX intent."

patterns-established:
  - "Session-reset pattern: per-session state flags reset at top of session-entry function, BEFORE any render work reads them. Applied here to expanded."
  - "Thin-wrapper + render-helper split pattern: session function captures state + resets flags + delegates; render helper consumes captured state + assembles output; handler-attach helper called by render helper after every (re-)render. Reusable for any UI where mutations need to re-render without resetting session flags."
  - "Cap-invariant pattern: irreversible operations (splice, truncate) must use the max-reveal cap; reversible operations (slice, filter) can use the visible cap. Applied to suggestions.splice(8) vs lastSuggestions.slice(0, visibleCap)."

requirements-completed: [UX-02]

# Metrics
duration: 6 min
completed: 2026-04-20
---

# Phase 05 Plan 03: Word-prediction top-3 reveal Summary

**UX-02 landed on the word-prediction surface: dropdown shows 3 suggestions by default across all 6 languages with a "Vis flere ⌄" reveal link expanding to 8, plus ArrowDown auto-reveal for keyboard users; Pitfall-5 (expanded-state leak across sessions) and Pitfall-6 (splice-cap clipping compound hits) both guarded.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-20T20:12:15Z
- **Completed:** 2026-04-20T20:18:40Z
- **Tasks:** 2 (1 code task + 1 smoke-test sweep)
- **Files modified:** 2

## Accomplishments

- Word-prediction dropdown now shows top 3 suggestions by default (down from 5) across all 6 languages (NB/NN/DE/ES/FR/EN). Dropdown renders compactly, reducing cognitive load for dyslexic students.
- `Vis flere ⌄` (NB) / `Vis fleire ⌄` (NN) reveal link appears at the bottom when more than 3 candidates are available. Click expands to 8 rows; link flips to `Vis færre ⌃` and collapses back on second click. Plain text-link styling, not a button — dyslexia-friendly visual cue.
- ArrowDown past the last visible row auto-expands the dropdown + lands selection on the first newly-revealed row (index 3). Zero extra keystrokes for keyboard users — one ArrowDown past the visible cap does the work of "click reveal, then ArrowDown."
- Compound-injection priority (Pitfall 6) preserved: `suggestions.splice(5)` raised to `splice(8)` so 1-4 compound-type candidates prepended via `unshift` can't knock out regular top-3 ranker candidates before the view gets a chance to slice. findSuggestions request cap raised from 5 to 8 for the same reason.
- Session-reset invariant (Pitfall 5) guarded: `expanded = false` reset at top of every `showDropdown()` call, BEFORE render. A previously-expanded list can't leak into the next keystroke's dropdown.
- Reveal-click handler mirrors the existing `.lh-pred-item` mousedown guard: `preventDefault()` + `stopPropagation()` prevent editor blur + click bubble to item-select (which would wrongly trigger `applySuggestion`).
- `showDropdown` refactored into a thin wrapper (captures state, resets flags, delegates) + `renderDropdownBody` helper (innerHTML assembly) + `attachDropdownHandlers` helper (event wiring). Reveal click re-renders via `renderDropdownBody` directly — avoids re-entry through `showDropdown` which would reset `expanded`.
- Existing keyboard behaviour preserved byte-identically: ArrowUp cycles upward, Tab/Enter applies selected suggestion, Escape hides dropdown.
- CSS `.lh-pred-vis-flere` rule landed in both light and dark mode variants. Light: 13px, #64748b base, #1e293b hover, underlined, centered, subtle rgba(0,0,0,0.04) border-top. Dark: #94a3b8 base, #e2e8f0 hover, rgba(255,255,255,0.06) border-top. No new CSS variables — file doesn't use any today.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract renderDropdownBody + wire Vis-flere reveal + ArrowDown auto-reveal + CSS** — `181f34b` (feat)
2. **Task 2: Smoke-test state-machine invariants via release gates** — _no code changes (verification-only task)_

Task 2 produced no commit because it's a pure verification sweep over Task 1's code (no new files, no new edits). All four invariant audits (Pitfall 5 reset, Pitfall 6 splice, Vis-flere click guards, ArrowDown selectedIndex advance) passed source-level inspection after Task 1 landed. All four release gates (check-fixtures, check-network-silence, check-bundle-size, check-explain-contract) exit 0.

**Plan metadata:** _to be committed at end of plan_

## Files Created/Modified

- `extension/content/word-prediction.js` — +104 lines, -9 lines (net +95). Added VISIBLE_DEFAULT + VISIBLE_EXPANDED constants + lastSuggestions + expanded module state. Refactored showDropdown into thin wrapper + renderDropdownBody helper (pulls innerHTML assembly out of showDropdown body) + attachDropdownHandlers helper (pulls event wiring out, adds the new Vis-flere mousedown handler). ArrowDown branch in handleKeydown gained an auto-reveal if-branch. findSuggestions(currentWord, 5, …) → (…, 8, …). suggestions.splice(5) → splice(8).
- `extension/styles/content.css` — +33 lines. New `#lexi-prediction-dropdown .lh-pred-vis-flere` rule in both light-mode (after .lh-pred-footer) and dark-mode (inside existing `@media (prefers-color-scheme: dark)` block). Text-link styling: 13px, underlined, centered, subtle gray palette matching existing .lh-pred-hint.

## Decisions Made

All key decisions are captured in the frontmatter `key-decisions` block above. In brief:

- **Render-helper split** over inlining the re-render inside showDropdown. Reveal click MUST NOT re-enter showDropdown (would reset expanded), so extracting renderDropdownBody is the cleanest share point.
- **splice(8) not splice(3)**. Pitfall 6 guard: splice cap must equal max-reveal cap to protect regular top-3 candidates from compound-unshift displacement. View-layer slicing handles the visible toggle.
- **Request cap raised 5→8**. findSuggestions returns top-K by ranker score; over-requesting is cheap and necessary to populate the expanded view.
- **expanded as module-scope state** (not dropdown.dataset). Lives alongside selectedIndex + dropdown + lexiPaused in the IIFE's module scope — consistent mental model with existing dropdown state.
- **Hand-coded CSS colours, no CSS variables**. File doesn't use variables today; introducing them would be scope expansion. Matched existing .lh-pred-hint / .lh-pred-footer palette byte-identically.
- **13px font-size for .lh-pred-vis-flere**. Matches existing .lh-pred-item body text; going bigger would invert the UX-02 intent by making the reveal affordance visually dominate the top-3.

## Deviations from Plan

None - plan executed exactly as written.

One small implementation note (not a deviation): the plan's CSS template used CSS custom properties with fallbacks (`var(--text-muted, #666)`), but audit of `extension/styles/content.css` revealed the file doesn't define any CSS custom properties today. Dropped the `var(...)` layer and used the fallback values directly (matching the existing `.lh-pred-hint` / `.lh-pred-footer` palette conventions). The plan explicitly allowed this: "If the file has a dark-mode section… mirror it. Do not introduce new CSS variables."

During Task 2 self-audit I noticed `check-explain-contract` now exits 0 (it exited 1 at the start of Phase 5 — Plan 05-02's rule-file upgrade apparently landed the callable-explain contract in the working tree while this plan was executing, flipping the gate to 0). This is Plan 05-02's work, not this plan's — documenting for completeness.

## Issues Encountered

- **Initial Edit sequence silently reverted.** First Edit-tool pass at Task 1 reported success on all five edits, but a subsequent Grep + Read confirmed word-prediction.js was at HEAD-state. Suspected cause: `extension/content/word-prediction.js` was on the original Read-tool payload's cached view AND a concurrent parallel Wave-2 plan (05-02 / 05-04) may have briefly raced on the file cache. Re-ran all five edits after re-reading the file contents from disk; all persisted on the second pass. Net effect: zero data loss, ~1 min rework. Noting the pattern for future Wave-2 multi-plan parallel executions — always Grep-verify the first edit landed on disk before continuing to subsequent edits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Phase 5 Wave 2 concurrent-plan status:**
- **This plan (05-03): COMPLETE.** Word-prediction UX-02 landed with all invariants guarded.
- **Plan 05-02 (rule-file UX-01 explain upgrade):** Working-tree changes visible (nb-gender.js, nb-modal-verb.js modified) — check-explain-contract flipped from exit 1 to exit 0, suggesting Plan 05-02's callable-explain contract is substantially landed. Plan 05-02's commit track is separate.
- **Plan 05-04 (popup settings toggle):** Working-tree changes visible (popup.html, popup.js modified). Plan 05-04's commit track is separate.
- **Plan 05-05 (popover render):** Not yet observed. Presumably runs after Plan 05-02 lands its rule upgrades.

**Blockers / concerns:** None. All four release gates exit 0 (check-fixtures 280/280, check-network-silence PASS, check-bundle-size 10.13 MiB / 20 MiB cap, check-explain-contract 5/5). Word-prediction surface is zero-network, zero-new-dependency, minimal CSS additions (< 1 KB pre-gzip). Live Chrome smoke test deferred to Plan 05 phase-close human-verify checkpoint per plan design — informal sanity-check paragraph in the plan's Task 2 step 7 describes the flow if the author wants to eyeball it.

---
*Phase: 05-student-experience-polish*
*Completed: 2026-04-20*

## Self-Check: PASSED

Files verified on disk:
- FOUND: extension/content/word-prediction.js (VISIBLE_DEFAULT=3, VISIBLE_EXPANDED=8, renderDropdownBody declared + called 9 sites, lh-pred-vis-flere render + querySelector)
- FOUND: extension/styles/content.css (.lh-pred-vis-flere rules × 4: light base + light hover + dark base + dark hover)
- FOUND: .planning/phases/05-student-experience-polish/05-03-SUMMARY.md

Commits verified:
- FOUND: 181f34b (Task 1 — feat(05-03): UX-02 top-3 reveal in word-prediction dropdown)

Release gates verified:
- PASS: `npm run check-fixtures` — 280/280 across all 12 fixture files
- PASS: `npm run check-network-silence` — word-prediction.js surface network-silent (SC-06 preserved)
- PASS: `npm run check-bundle-size` — 10.13 MiB / 20 MiB cap (9.87 MiB headroom)
- PASS: `node scripts/check-explain-contract.js` — 5/5 popover-surfacing rules have valid explain contract (unrelated to this plan; Plan 05-02's work reaching exit-0 confirms Wave-2 concurrent landing is safe)

Invariant audits:
- PASS: Pitfall 5 (expanded leak) — `expanded = false` on line 3 of `showDropdown()`, BEFORE `renderDropdownBody(el)`
- PASS: Pitfall 6 (compound clip) — `suggestions.splice(8)` is the sole splice in runPrediction (no splice(5) or splice(3) remnants)
- PASS: Reveal click-guard — Vis-flere mousedown handler has BOTH `preventDefault()` AND `stopPropagation()` (mirrors existing `.lh-pred-item` guard)
- PASS: ArrowDown auto-reveal — branch sets `selectedIndex = Math.min(items.length, newItems.length - 1)` after `renderDropdownBody`, lands on first newly-revealed row (index 3 for VISIBLE_DEFAULT=3)
