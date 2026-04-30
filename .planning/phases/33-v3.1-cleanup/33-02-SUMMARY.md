---
phase: 33-v3.1-cleanup
plan: 02
subsystem: infra
tags: [lockdown, sync, downstream, cross-repo]

requires:
  - phase: 33-v3.1-cleanup
    provides: dict-state-builder.js extension (33-01)
  - phase: 32-fr-es-pedagogy
    provides: fr-aspect-hint rule + es-gustar/es-por-para refactors
  - phase: 30-popup-views
    provides: popup/views/ + dict-state-builder.js synced surfaces
  - phase: 27-exam-mode
    provides: exam-registry.js + exam markers
  - phase: 26-laer-mer-pedagogy-ui
    provides: pedagogy popover surfaces
provides:
  - "Refreshed lockdown public/leksihjelp/ tree mirroring current extension/ working tree"
  - "fr-aspect-hint rule available downstream (NEW file synced)"
  - "Phase 33-01 dict-state-builder buildDictState/buildInflectionIndex extension flowing to lockdown sidepanel host"
  - "Documentation of orphan upstream changes that rode along (i18n strings, spell-check.js, floating-widget.js, popup.css) for separate triage"
affects: [33-03, future-phases-touching-shared-tree]

tech-stack:
  added: []
  patterns:
    - "Cross-repo sync via lockdown's scripts/sync-leksihjelp.js (run from lockdown root, resolves leksihjelp via node_modules/@papertek/leksihjelp symlink → ../leksihjelp)"
    - "Sync mirrors upstream as-is (including uncommitted working-tree edits) — orphan changes triaged separately, not blocked by sync"

key-files:
  created:
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/spell-rules/fr-aspect-hint.js"
    - ".planning/phases/33-v3.1-cleanup/33-02-SUMMARY.md"
  modified:
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/popup/dict-state-builder.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/popup/views/dictionary-view.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/spell-check.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/spell-rules/es-gustar.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/spell-rules/es-por-para.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/styles/leksihjelp.css"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/styles/popup.css"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/i18n/strings.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/floating-widget.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/vocab-seam-core.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/vocab-seam.js"
    - "/Users/geirforbord/Papertek/lockdown/public/leksihjelp/data/de.json (+ en/es/fr/nb/nn)"

key-decisions:
  - "Sync script + LEKSI_BUNDLE order verified correct as-is — no script edits needed (dict-state-builder + grammar-features-section already covered by sync; popup helpers loaded statically in elev.html before view modules per Phase 30-02 design, not via LEKSI_BUNDLE)"
  - "Mirrored upstream working tree as-is including 4 orphan-modified files (i18n/strings.js, spell-check.js, floating-widget.js, popup.css predate Phase 33) — sync's job is faithful upstream-as-is, orphans triaged separately"
  - "Lockdown commit landed without bundling sidepanel-host.js fix — that change had already been committed upstream (1c76271) before this plan ran; nothing left staged in lockdown working tree"

patterns-established:
  - "Cross-repo plan: leksihjelp sources unchanged, lockdown tree refreshed + committed; leksihjelp-side commit is metadata-only (SUMMARY/STATE/ROADMAP)"

requirements-completed: []

duration: 2 min
completed: 2026-04-30
---

# Phase 33 Plan 02: Lockdown Sync Summary

**Mirrored leksihjelp Phase 26/27/30/32/33-01 surfaces into lockdown via re-run of scripts/sync-leksihjelp.js — fr-aspect-hint rule lands downstream, dict-state-builder buildDictState extension flows through, plus orphan upstream UI changes documented for separate triage.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-30T21:44:15Z
- **Completed:** 2026-04-30T21:46:36Z
- **Tasks:** 3
- **Files modified:** 18 in lockdown (1 new + 17 modified) + 1 new in leksihjelp

## Accomplishments

- Verified lockdown sync script already covers all needed surfaces (dict-state-builder.js + grammar-features-section.js + exam-registry.js + popup/views/ + popup-views.css) — no script edits needed
- Verified LEKSI_BUNDLE / elev.html static-script order: dict-state-builder loaded BEFORE dictionary-view (correct, matches Phase 30-02 design)
- Ran `node scripts/sync-leksihjelp.js` cleanly from lockdown — exit 0
- Committed lockdown sync output as `beadf6b` on staging branch
- Documented all 18 file changes by category (Phase-attributed refresh vs orphan upstream changes)

## Task Commits

This plan does cross-repo work. Commits go to different repos:

1. **Task 1: Inspect sync script + verify dict-state-builder coverage** — no commit (read-only inspection, sync script + LEKSI_BUNDLE already correct)
2. **Task 2: Run sync + commit lockdown output** — `beadf6b` in `/Users/geirforbord/Papertek/lockdown` (`chore(leksihjelp): sync upstream tree...`)
3. **Task 3: Author SUMMARY** — committed via plan-metadata commit in leksihjelp (this commit)

## Files Refreshed (Lockdown public/leksihjelp/)

| File | Category | Change Summary | Source Phase |
| ---- | -------- | -------------- | ------------ |
| `spell-rules/fr-aspect-hint.js` | NEW | First FR pedagogy-bearing P3 hint rule | Phase 32-01 |
| `spell-rules/es-gustar.js` | Expected refresh | Data-driven `verb_class` refactor + PREPOSITION_COLLISIONS guard | Phase 32-03 |
| `spell-rules/es-por-para.js` | Expected refresh | Pedagogy block on para_prep/por_prep + 4 patternType subtype keys | Phase 32-02 |
| `popup/dict-state-builder.js` | Expected refresh | +229 lines: buildDictState + buildInflectionIndex extracted from popup.js | Phase 33-01 |
| `popup/views/dictionary-view.js` | Expected refresh | Pronoun-filter hardening (skip `_`-prefixed metadata keys) | Phase 33-01 follow-through |
| `vocab-seam-core.js` | Expected refresh | +5 FR pedagogy indexes (frAspectAdverbs, frAspectPedagogy, frImparfaitToVerb, frPasseComposeParticiples, frAuxPresensForms) | Phase 32-01 |
| `vocab-seam.js` | Expected refresh | Wire-through for the new vocab-seam-core indexes | Phase 32-01 |
| `styles/leksihjelp.css` | Expected refresh | `.lh-spell-fr-aspect-hint` dotted-underline CSS binding | Phase 32-01 |
| `data/{de,en,es,fr,nb,nn}.json` | Expected refresh | Regenerated language data from upstream sync-vocab (~28k inserts, 22k deletes, mostly pretty-print + pedagogy enrichments) | Multiple phases |
| `i18n/strings.js` | **Orphan upstream change** | New keys (`fest_onboarding_title/body`, expanded `skriv_btn_title`, expanded `nav_pause_title`) for nb + nn | Pre-Phase-33 working tree |
| `spell-check.js` | **Orphan upstream change** | Init logic decouples spell-check enable from prediction-enabled flag (`stored.spellCheckEnabled !== false` standalone) | Pre-Phase-33 working tree |
| `floating-widget.js` | **Orphan upstream change** | +164 lines (lookup-card draggability per pending screenshot/feature request?) | Pre-Phase-33 working tree |
| `styles/popup.css` | **Orphan upstream change** | +79 lines, ostensibly companion to i18n/floating-widget changes | Pre-Phase-33 working tree |

## Orphan Upstream Changes (Captured for Separate Triage)

The leksihjelp working tree has 9 modified files predating Phase 33 (per orchestrator pre-flight). Of those, **four** are upstream sources for synced lockdown files: `i18n/strings.js`, `content/spell-check.js`, `content/floating-widget.js`, `styles/popup.css`. The sync mirrored them as-is.

This is acceptable per CLAUDE.md "Downstream consumers" contract: the sync's job is faithful upstream-as-is. Orphan changes will be triaged separately upstream — recommended owner is whichever future leksihjelp commit cleans up the dirty working tree (likely a Phase 34 / unrelated polish plan, or someone running `git stash` / `git restore`).

**No round-trip needed** for any of these — they're forward orphans, not lockdown-side hand-edits getting stomped. We confirmed: `git status --short public/leksihjelp/` showed only `M` and `??` (no lockdown-only divergences pre-sync).

## Sync Script + LEKSI_BUNDLE Verification

Inspected `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js` end-to-end:

- ✅ `extension/content/` → `public/leksihjelp/` (recursive, includes spell-rules/)
- ✅ `extension/data/` → `public/leksihjelp/data/`
- ✅ `extension/styles/content.css` → `public/leksihjelp/styles/leksihjelp.css` (renamed)
- ✅ `extension/styles/popup-views.css` → `public/leksihjelp/styles/popup-views.css` (existence-gated)
- ✅ `extension/popup/views/` → `public/leksihjelp/popup/views/` (existence-gated)
- ✅ `extension/popup/dict-state-builder.js` → `public/leksihjelp/popup/dict-state-builder.js` (Phase 30-04 Task 4 entry, lines 99-107)
- ✅ `extension/popup/grammar-features-section.js` → `public/leksihjelp/popup/grammar-features-section.js` (Phase 30-04 Task 5 entry, lines 109-116)
- ✅ `extension/i18n/` → `public/leksihjelp/i18n/`
- ✅ `extension/exam-registry.js` → `public/leksihjelp/exam-registry.js` (Phase 28 / EXAM-08, line 130-139)

Inspected `public/js/leksihjelp-loader.js` LEKSI_BUNDLE + `public/elev.html` static `<script>` block:

- ✅ `exam-registry.js` first in LEKSI_BUNDLE (before any consumer reads `__lexiExamRegistry`)
- ✅ Popup helpers (dict-state-builder.js, grammar-features-section.js) loaded statically in elev.html (lines 140-141) BEFORE `popup/views/dictionary-view.js` (line 142) and `popup/views/settings-view.js` (line 143) — correct order per Phase 30-02 design (views read `host.__lexiDictStateBuilder` at mount time)
- ✅ Popup view modules NOT in LEKSI_BUNDLE (intentional — views have no chrome.* / `__lexi*` implicit deps; gate `check-popup-deps` enforces this)

## Decisions Made

- **No sync script edits needed** — every surface this plan needed was already covered. The plan text speculated dict-state-builder.js might be missing from the script ("ADDED IN PLAN 33-01 IF MISSING"); on inspection, Phase 30-04 Task 4 had already added it.
- **No LEKSI_BUNDLE edits needed** — popup helpers + view modules deliberately load via static `<script>` in elev.html, not the dynamic LEKSI_BUNDLE. The order is correct.
- **Mirrored orphan working-tree changes as-is** — sync mirrors upstream faithfully, orphan triage happens separately. The CLAUDE.md "Downstream consumers" section explicitly contemplates this case.
- **No leksihjelp-side source files modified** — this plan is documentation + cross-repo sync only. The leksihjelp-side commit is metadata (SUMMARY + STATE + ROADMAP).

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan-text drift] Sidepanel-host.js was already committed, not staged**

- **Found during:** Task 2 (post-sync diff inspection)
- **Issue:** The orchestrator's `<important_notes>` block stated Plan 33-01 had left `public/js/writing-test/student/leksihjelp-sidepanel-host.js` staged-uncommitted in lockdown, and the lockdown sync commit should bundle that change in. On inspection, `git status` showed no working-tree modification on that path; `git log` revealed the change had already shipped upstream as commit `1c76271` (v4.12.16 staging push).
- **Fix:** Skipped bundling — committed only the sync output (18 files). No work lost; sidepanel-host integration verified by grep (`buildDictState`, `__lexiDictStateBuilder` references present at lines 127, 135, 138, 149).
- **Files modified:** None additional.
- **Verification:** `grep -n "buildDictState" .../leksihjelp-sidepanel-host.js` → 4 hits.
- **Committed in:** N/A (no extra commit needed).

---

**Total deviations:** 1 informational (plan-text vs. actual repo state — already-committed change documented as staged).
**Impact on plan:** None — successful execution, just one less file in the lockdown commit than the plan-text suggested.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 33-03 unblocked.** Plan 33-03 owns the leksihjelp version bump (signals lockdown to re-pin) + the cross-repo coordinated push. Lockdown commit `beadf6b` is on the `staging` branch, not pushed yet — Plan 33-03 should push it (or coordinate the push with the leksihjelp version-bump release commit).
- **Orphan upstream changes still pending triage** — recommend a follow-up plan in Phase 34 (or a polish/cleanup phase) to either commit or revert the 9 unrelated upstream M files. Until then they continue to flow through future syncs.
- **Production deploy to papertek.app** still deferred (per Phase 30-02 SUMMARY — separate user decision).

---
*Phase: 33-v3.1-cleanup*
*Completed: 2026-04-30*

## Self-Check: PASSED

- ✅ `.planning/phases/33-v3.1-cleanup/33-02-SUMMARY.md` exists
- ✅ `/Users/geirforbord/Papertek/lockdown/public/leksihjelp/spell-rules/fr-aspect-hint.js` exists
- ✅ Lockdown commit `beadf6b` present in git log
