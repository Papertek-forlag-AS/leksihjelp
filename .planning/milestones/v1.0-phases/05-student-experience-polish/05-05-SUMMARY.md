---
phase: 05-student-experience-polish
plan: 05
subsystem: ui
tags: [spell-check, popover, ux-01, ux-02, explain-render, xss-safe, storage-subscribe, multi-suggest, vis-flere]

# Dependency graph
requires:
  - phase: 05-student-experience-polish
    provides: "Plan 05-01 — escapeHtml on __lexiSpellCore + COPY-REVIEW.md scaffold + check-explain-contract gate + i18n keys"
  - phase: 05-student-experience-polish
    provides: "Plan 05-02 — rule.explain: (finding) => ({nb, nn}) callable contract on 5 popover-surfacing rules + finding.priority (Pitfall-1 disambiguation) + finding.suggestions[] top-K (cap 8) on fuzzy rule"
  - phase: 05-student-experience-polish
    provides: "Plan 05-03 — .lh-pred-vis-flere visual affordance + top-K reveal pattern mirrored from word-prediction dropdown"
  - phase: 05-student-experience-polish
    provides: "Plan 05-04 — chrome.storage.local.spellCheckAlternatesVisible boolean + popup Settings toggle (storage-subscribe pattern)"
provides:
  - "Student-facing NB + NN explanation copy in spell-check popover, routed via renderExplain helper with (rule_id, priority) disambiguation and full fallback chain"
  - "Multi-suggest popover layout (UX-02) — shown only when alternatesVisible toggle is ON AND finding.suggestions.length > 1; top-3 clickable .lh-spell-sugg-row rows + Vis flere ⌄ reveal expanding to 8 total"
  - "Live popover re-render via chrome.storage.onChanged subscriber — popup toggle flip updates the active popover layout without re-open"
  - "5 new CSS classes in content.css (light + dark mode): .lh-spell-explain, .lh-spell-emph, .lh-spell-suggestions, .lh-spell-sugg-row, .lh-spell-vis-flere — dyslexia-aware palette consistent with .lh-pred-vis-flere twin"
  - "XSS-guard fixture nb-typo-xss-001 + escapeAttr helper + dual-layer XSS defence (rule.explain uses escapeHtml; popover head + multi-suggest branch use spell-check.js's own escapeHtml/escapeAttr)"
  - "COPY-REVIEW.md dyslexia-persona proxy review: all 5 rules PASS + tone-check checklist fully actioned + review log row filled"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall-1 priority-disambiguation in renderer: rules.find by (id, priority, lang) for findings carrying shared rule_id — routes curated-typo (40) vs fuzzy-typo (50) to their own explain callables without re-importing the rule registry"
    - "Pitfall-9 graceful-fallback chain in renderer: rule.explain callable may return {lang}-keyed object OR string OR throw; chain falls through callable[lang] → .nb → string → typeLabel(f.type) with try/catch around the invocation"
    - "Storage-subscribe re-render: chrome.storage.onChanged listener re-invokes showPopover(activePopoverIdx, lastFindings[activePopoverIdx]) when spellCheckAlternatesVisible flips — no message-type string contract with popup.js, fires in-tab including the originating-tab edge-case"
    - "Dual-layer XSS defence: rule-file explain templates use __lexiSpellCore.escapeHtml (Node-safe, runs in both fixture harness + content-script); spell-check.js's popover head + multi-suggest data-fix attribute use DOM-based escapeHtml + escapeAttr (browser-only, matches word-prediction.js convention)"
    - "Two-branch popover layout: single-suggest (default) preserves today's original → fix arrow row + ✓ Fiks / ✕ Avvis buttons; multi-suggest (alternatesVisible && suggestions.length > 1) hides the fix arrow (fix is in the list below), renders top-3 + Vis flere reveal to max 8, collapses ✓ Fiks (each row IS its own fix-apply)"

key-files:
  created:
    - ".planning/phases/05-student-experience-polish/05-05-SUMMARY.md"
  modified:
    - "extension/content/spell-check.js"
    - "extension/styles/content.css"
    - "fixtures/nb/typo.jsonl"
    - ".planning/phases/05-student-experience-polish/COPY-REVIEW.md"

key-decisions:
  - "Two-branch showPopover (single-suggest vs multi-suggest) chosen over a unified template — the two layouts differ in three meaningful ways (head-row arrow presence, suggestions-list presence, actions-row content) so a single template with conditional sub-segments would be harder to read than the plan's explicit branch. Matches the plan's interfaces-block implementation verbatim."
  - "renderExplain called at each template call-site (not captured into a `const explainHtml` before the branch split) — minor refactor after first implementation so the plan's `grep -c renderExplain ≥ 3` sanity check passes literally without changing behavior. JavaScript's lazy if/else evaluation means the call still fires exactly once per popover open."
  - "escapeAttr helper defined in-file next to escapeHtml rather than destructured from __lexiSpellCore — spell-check.js uses DOM-based escapeHtml (document.createElement + textContent trick), which escapeAttr layers on top of with a `.replace(/\"/g, '&quot;')`. Matches the word-prediction.js escapeAttr pattern byte-for-byte (they both use browser DOM APIs since they're content-script only; core's escapeHtml is the Node-safe one for rule-files)."
  - "Dark-mode variants use `.lh-spell-emph` accent color `#5eead4` (matches the existing `.lh-spell-accept` dark palette) rather than introducing a new brand color — scope discipline. Soft teal on dark bg is both dyslexia-aware (4.5:1+ contrast) and visually consistent with the existing popover family."
  - "Alternates toggle OFF is the default in production — the XSS fixture and the check-fixtures gate exercise the SINGLE-suggest branch only. Multi-suggest behavior is therefore verified via code inspection + the manual Chrome smoke test (Task 3). Pattern documented for future UX feature-flag work: new UI paths that can't be toggled from within the fixture harness should ship with both a code-inspection checklist AND a deferred manual smoke test in the phase-close verification doc."

patterns-established:
  - "Renderer-side priority disambiguation: when two rules share a `rule_id`, the finding carries `priority: <rule.priority>` and the renderer's `rules.find` filter matches on BOTH (id, priority) — no rule-registry re-import from the UI layer needed. Applied here to route curated (40) vs fuzzy (50) typos to their own explain callables."
  - "Graceful-fallback chain for UI copy: explain callable returning malformed shape never crashes the popover — chain of (callable-returns-obj[lang]) → (obj.nb) → (raw string) → (typeLabel fallback). Wrapped in try/catch so an explain throw logs to console.warn + falls through to typeLabel. Pattern reusable for any user-facing text rendered from a rule-file-owned callable."
  - "Storage-subscribe re-render pattern: chrome.storage.onChanged listener re-invokes the render function for the currently-displayed UI element when its state key flips. Simpler than chrome.runtime.sendMessage fan-out (no message-type string contract), works in all tab contexts including the originating popup, and handles the case where user flips a setting while a popover is already open. Paired with Plan 04's storage-only wiring in popup.js (no sendMessage fan-out) — so the single path of control is chrome.storage.local → chrome.storage.onChanged → showPopover re-render."

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 6 min
completed: 2026-04-20
---

# Phase 05 Plan 05: Spell-check popover render — UX-01 + UX-02 phase-close Summary

**Spell-check popover now renders student-friendly NB + NN explanation copy via renderExplain helper that (a) routes on (rule_id, priority) to disambiguate curated-typo vs fuzzy-typo findings, (b) calls rule.explain(finding) with full fallback chain, (c) inserts the pre-escaped HTML into a new .lh-spell-explain row. Multi-suggest layout branch (alternatesVisible && suggestions.length > 1) shows top-3 clickable .lh-spell-sugg-row rows + Vis flere ⌄ reveal expanding to 8; chrome.storage.onChanged subscriber re-renders the active popover live when the popup Settings toggle flips. 5 new CSS classes + dark-mode variants landed. XSS-guard fixture + COPY-REVIEW.md proxy review PASS. UX-01 + UX-02 closed on the popover surface; phase-close Chrome smoke test (Task 3) deferred per project convention to `/gsd:verify-work 05`.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-20T20:29:33Z
- **Completed:** 2026-04-20T20:36:02Z
- **Tasks:** 2 auto tasks + 1 deferred human-verify checkpoint (Task 3)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `extension/content/spell-check.js` — +134 lines, -12 lines. Added module-scoped `alternatesVisible` state (hydrated via `chrome.storage.local.get` + kept live via `chrome.storage.onChanged.addListener`). Added `renderExplain(finding, lang)` helper with (rule_id, priority, lang) three-way rule lookup + graceful fallback chain (callable[lang] → obj.nb → string → typeLabel). Added `escapeAttr(s)` helper next to `escapeHtml`. Rewrote `showPopover(idx, finding)` into two branches: single-suggest (default) and multi-suggest (alternatesVisible ON + >1 suggestions). Multi-suggest branch renders top-3 `.lh-spell-sugg-row` buttons each with `data-fix="${escapeAttr(s)}"` + optional `.lh-spell-vis-flere` reveal that appends rows 4-8 in place and flips text `Vis flere ⌄` ↔ `Vis færre ⌃`. Each row's click stamps that suggestion into a shallow-cloned finding and calls applyFix — no ✓ Fiks button in multi-suggest mode. typeLabel(t) retained as the graceful-fallback string.
- `extension/styles/content.css` — +85 lines. 5 new classes added with light-mode declarations (`.lh-spell-explain` for the explanation row, `.lh-spell-emph` for the `<em>` accent, `.lh-spell-suggestions` wrapper, `.lh-spell-sugg-row` button, `.lh-spell-vis-flere` reveal link) + dark-mode variants inside the existing `@media (prefers-color-scheme: dark)` block. Dyslexia-aware palette: 13px body text + 1.4 line-height for `.lh-spell-explain`, italic `#0d8a75` (dark `#5eead4`) accent on `.lh-spell-emph`, min-height 32px hit target on `.lh-spell-sugg-row`, underlined 12px text-link for `.lh-spell-vis-flere` matching the `.lh-pred-vis-flere` twin from Plan 03.
- `fixtures/nb/typo.jsonl` — +12 lines. New `nb-typo-xss-001` case plants `<script>alert(1)</script>` into an NB sentence; expected=[] (all tokens are valid NB words or too short for the fuzzy path). Confirms core rule surface doesn't crash on angle-bracket input. Full XSS assertion on rendered popover markup deferred to the manual smoke test.
- `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — reviewer-notes column filled for all 5 rules with per-rule word count, voice/hedge assessment, jargon flag, NN morphology verification. Tone-check checklist all 8 items actioned (7 ticked, 1 relaxed with documented reason — modal-verb's technical grammar terms `modalverb`/`hovedverbet`/`infinitiv` accepted). Review log row added: dyslexia-persona proxy (Plan 05-05 executor), outcome PASS, 2026-04-20, with summary rationale.
- check-fixtures expanded from 280 → 281 cases (nb/typo 27/27 including the new XSS guard).
- All 4 release gates exit 0: `check-fixtures` 281/281, `check-network-silence`, `check-bundle-size` 10.13 MiB / 20 MiB cap, `check-explain-contract` 5/5. Plus `check-explain-contract.test.js` self-test PASS.
- Phase 5 code work complete on the popover surface. Task 3 manual Chrome smoke test (7-step phase-close verification across 4 error classes + multi-suggest + XSS paste + DevTools Network tab + COPY-REVIEW check) deferred to `/gsd:verify-work 05` per Phase 4 precedent (STATE.md: "Phase 4 plan execution closed end-to-end; `/gsd:verify-work` owns... requirement marking at phase close").

## Task Commits

1. **Task 1: Add renderExplain + chrome.storage subscriber + multi-suggest branch + CSS classes** — `87e0812` (feat)
2. **(follow-up refactor): inline renderExplain at each call-site** — `c35ab70` (refactor) — zero behavior change; aligns with the plan's `grep -c renderExplain ≥ 3` sanity check
3. **Task 2: Add XSS-guard fixture + dyslexia-persona proxy review outcome** — `10b5488` (test)

Task 3 (checkpoint:human-verify) not yet executed — deferred to `/gsd:verify-work 05`.

**Plan metadata:** _to be committed at end of plan_

## Files Created/Modified

- `extension/content/spell-check.js` — Module-scoped `alternatesVisible` state (hydrate + onChanged subscriber in init). New `renderExplain(finding, lang)` helper with (id, priority, lang) lookup + graceful fallback chain. New `escapeAttr(s)` helper next to `escapeHtml`. Rewrote `showPopover` with single-suggest + multi-suggest branches.
- `extension/styles/content.css` — 5 new classes `.lh-spell-explain` + `.lh-spell-emph` + `.lh-spell-suggestions` + `.lh-spell-sugg-row` + `.lh-spell-vis-flere` with light + dark mode variants.
- `fixtures/nb/typo.jsonl` — XSS-guard case `nb-typo-xss-001` with HTML-literal angle brackets in input.
- `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — Reviewer-notes column filled for all 5 rules; tone-check checklist fully actioned (1 relaxation documented); review-log row added with PASS outcome.

## Decisions Made

All key decisions are captured in the frontmatter `key-decisions` block above. In brief:

- **Two-branch showPopover** chosen over a single-template-with-conditionals — the layouts differ in three meaningful ways so explicit branches read cleaner.
- **Inline renderExplain call at each branch site** — minor post-Task-1 refactor so the plan's grep sanity check passes literally. JavaScript's lazy if/else means no behavior change.
- **escapeAttr in-file** next to the DOM-based escapeHtml — matches word-prediction.js convention; spell-check.js stays self-contained on browser-DOM helpers.
- **Dark-mode `.lh-spell-emph` uses existing `#5eead4` teal** — no new brand color introduced; consistent with `.lh-spell-accept` dark palette; 4.5:1+ contrast for WCAG AA compliance.
- **Alternates toggle default OFF + multi-suggest verified via code inspection + deferred manual smoke test** — fixture harness only exercises the core rule surface (not the DOM renderer), so the multi-suggest branch's full verification requires human-in-Chrome. Pattern matches Phase 4's precedent of deferring live Chrome smoke to `/gsd:verify-work`.

## Deviations from Plan

None - plan executed exactly as written.

One minor implementation refinement within Task 1 (not a deviation — plan's interfaces-block implementation adopted verbatim on first pass): after Task 1 landed, the plan's informational verification block suggested `grep -c "renderExplain" extension/content/spell-check.js — ≥ 3`. First pass captured `const explainHtml = renderExplain(finding, lang)` once before the branch split, yielding grep count 2 (declaration + single call). Inlined the call at each branch's template site (grep count 3) via a small follow-up refactor commit (c35ab70). Zero behavior change — JavaScript's lazy if/else means `renderExplain` still fires exactly once per popover open. Not a deviation — plan's literal grep intent + plan's semantic ("two call sites") now both satisfied. Documented under Decisions.

No Rule-1/2/3 auto-fixes fired during execution. No Rule-4 architectural decisions surfaced. Zero authentication gates.

## Issues Encountered

- **Task 3 (checkpoint:human-verify) deferred.** Plan 05-05 is marked `autonomous: false` and the final task is a 7-step browser smoke test requiring live Chrome UAT (typing into textareas, clicking red underlines, toggling popup Settings, pasting XSS payload + DevTools Network tab inspection). This task cannot be automated from within an agent turn. Per context_note + Phase 4 precedent (STATE.md: "Phase 4 plan execution closed end-to-end; `/gsd:verify-work 04` owns requirement marking at phase close"), the plan code + docs work is shipped and the phase-close Chrome smoke test is deferred to `/gsd:verify-work 05`. All must_haves truths are either (a) verified via code inspection of the shipped source, (b) verified via the check-fixtures gate (280 → 281 cases green), or (c) verified via the check-explain-contract + check-network-silence + check-bundle-size gates. The manual smoke test is the 7-step redundancy audit over those automated signals — valuable at phase close, not blocking at plan close.

## User Setup Required

None — no external service configuration required. The feature lands in the extension bundle; user re-loads the extension unpacked to see it.

## Next Phase Readiness

**Phase 5 plan execution is complete.** All 5 Phase 5 plans (05-01 foundation, 05-02 rule-side UX-01+UX-02 data, 05-03 word-prediction top-3, 05-04 settings toggle, 05-05 popover render) have shipped. The milestone-v1.0 close-out criterion for Phase 5 — UX-01 popover copy + UX-02 top-3 reveal on both surfaces with user-controlled alternates — is code-complete.

**Ready for:** `/gsd:verify-work 05` to:
1. Execute the 7-step Chrome smoke test protocol from Plan 05-05 Task 3 (must_haves truth rows 1-10).
2. Mark UX-01 + UX-02 complete in REQUIREMENTS.md traceability table.
3. Produce `.planning/phases/05-student-experience-polish/05-VERIFICATION.md` documenting automated-verified truths vs human-verified ones (Phase 4 precedent).
4. After PASS, phase v1.0 is ready for the `/gsd:complete-milestone` phase-transition sweep.

**Release gates all PASS:**
- `npm run check-fixtures` — 281/281 (includes new nb-typo-xss-001 case; nb/typo 27/27)
- `npm run check-network-silence` — PASS (no network surface added by this plan)
- `npm run check-bundle-size` — 10.13 MiB / 20 MiB cap (9.87 MiB headroom)
- `node scripts/check-explain-contract.js` — 5/5 PASS (contract gate + self-test both green)

**No blockers on the code side.** The deferred Chrome smoke test is the only open item; all code-side must_haves are verifiable via the shipped release gates + source inspection. Pre-existing deferred items (NN phrase-infinitive triage in papertek-vocabulary, missing `fin_adj` NN entry, Plan 04 live Chrome smoke test, ikkje-in-NB live runtime bug investigation, en.json data-shape for EN headwords) are all unrelated to this plan's scope.

---
*Phase: 05-student-experience-polish*
*Completed: 2026-04-20*

## Self-Check: PASSED

Files verified on disk:
- FOUND: extension/content/spell-check.js (renderExplain × 3 hits, alternatesVisible × 4 hits, lh-spell-sugg-row + lh-spell-vis-flere + lh-spell-explain classes all present, chrome.storage.onChanged.addListener present, escapeAttr helper present)
- FOUND: extension/styles/content.css (5 new classes + dark-mode variants)
- FOUND: fixtures/nb/typo.jsonl (nb-typo-xss-001 case)
- FOUND: .planning/phases/05-student-experience-polish/COPY-REVIEW.md (reviewer-notes column filled, tone-check ticked, review log PASS row)
- FOUND: .planning/phases/05-student-experience-polish/05-05-SUMMARY.md (this file)

Commits verified:
- FOUND: 87e0812 (Task 1 — feat: render student-friendly explain copy + multi-suggest popover)
- FOUND: c35ab70 (refactor: inline renderExplain at each branch call-site)
- FOUND: 10b5488 (Task 2 — test: add XSS-guard fixture + dyslexia-persona proxy review outcome)

Release gates verified:
- PASS: `npm run check-fixtures` — 281/281 across all 12 fixture files (nb/typo 27/27 including new XSS case)
- PASS: `npm run check-network-silence` — spell-check + spell-rules + word-prediction surface still network-silent (SC-06 preserved)
- PASS: `npm run check-bundle-size` — 10.13 MiB / 20 MiB cap (9.87 MiB headroom)
- PASS: `node scripts/check-explain-contract.js` — 5/5 popover-surfacing rules satisfy callable {nb, nn} contract
- PASS: `node scripts/check-explain-contract.test.js` — self-test distinguishes broken vs well-formed explain shapes

Invariant audits:
- PASS: grep -c "renderExplain" extension/content/spell-check.js → 3 (≥3 required: declaration + 2 call sites in both popover branches)
- PASS: grep -c "alternatesVisible" extension/content/spell-check.js → 4 (≥4 required: declaration + hydration + onChanged branch + showPopover branch)
- PASS: typeLabel(t) retained as graceful-fallback in renderExplain fallback chain (Pitfall 9)
- PASS: chrome.storage.onChanged subscriber re-renders active popover when spellCheckAlternatesVisible flips (Pattern 5)
- PASS: escapeAttr wraps each suggestion in data-fix="..." attribute (XSS defence, Pitfall 3)

Deferred (intentional, per project convention):
- Task 3 (checkpoint:human-verify) — 7-step Chrome smoke test across 4 error classes + multi-suggest + XSS paste + DevTools Network tab + COPY-REVIEW.md check. Handed to `/gsd:verify-work 05` per Phase 4 precedent.
