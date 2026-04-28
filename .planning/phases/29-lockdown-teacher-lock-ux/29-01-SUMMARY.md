---
phase: 29-lockdown-teacher-lock-ux
plan: 01
subsystem: ui
tags: [lockdown, resource-profile, exam-mode, teacher-ux, i18n, leksihjelp]

requires:
  - phase: 27-exam-mode
    provides: "examModeLocked + examMode runtime suppression in leksihjelp content scripts"
  - phase: 28-lockdown-exam-mode-sync
    provides: "shared exam-registry surface; lockdown chrome-API shim; Re-Scope decision (Option B = new resource profile)"
provides:
  - "RESOURCE_PROFILES.LEKSIHJELP_EXAM enum value + envelope (leksihjelp: true, lexinIframe: false, spellEngineOptions: ['off'])"
  - "PROFILE_LABELS_NB / _NN / _EN exports (Nynorsk and English added; previously NB-only)"
  - "Teacher question-builder picker option between EXAM and LEXIN"
  - "i18n strings for the new profile in nb.js and en.js (label + info heading/description)"
affects: [29-02-firestore-writer, 29-03-verification, lockdown skriveokt-zero EXAM-09]

tech-stack:
  added: []
  patterns:
    - "Five-value resource-profile enum (extends Phase 63 four-value contract additively)"
    - "Locked UX shape decided in PLAN Task 1 before any code lands; downstream plans inherit the contract"

key-files:
  created: []
  modified:
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/shared/resource-profile.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/shared/resource-profile.test.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/shared/classroom-illustrations.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/locales/nb.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/locales/en.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/teacher/question-builder.js"

key-decisions:
  - "Locked LEKSIHJELP_EXAM UX shape (Task 1 default-recommended): label 'Eksamen med Leksihjelp' / 'Exam with Leksihjelp', envelope { leksihjelp: true, lexinIframe: false, ttsAlwaysOn: true, spellEngineOptions: ['off'] }"
  - "No 'dual-engine' option (browser + Leksihjelp simultaneously) — avoids double-flagging the same token in v1"
  - "Added PROFILE_LABELS_NN and PROFILE_LABELS_EN exports as part of this plan (the existing module shipped only PROFILE_LABELS_NB) so a future nn.js locale drop-in has a label map to consume"
  - "Picker order: FULL → EXAM → LEKSIHJELP_EXAM → LEXIN → NONE (groups exam-related profiles together)"

patterns-established:
  - "Adding a new resource profile is an additive five-touch change: enum constant, label maps, envelope branch, locale strings, picker option, info-modal section"

requirements-completed: [EXAM-10]

duration: 12 min
completed: 2026-04-28
---

# Phase 29 Plan 1: LEKSIHJELP_EXAM resource-profile UX surface Summary

**Adds a fifth selectable resource profile to lockdown's teacher question-builder ('Eksamen med Leksihjelp') with frozen NB/NN/EN label maps, locale strings, an envelope branch wiring Leksihjelp on with browser spellcheck off, and an explainer-modal entry — all additive to Phase 63's four-value contract.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-28T20:21:00Z
- **Completed:** 2026-04-28T20:33:49Z
- **Tasks:** 2 (1 checkpoint:decision auto-resolved + 1 auto)
- **Files modified:** 6 (all in lockdown sibling repo)

## Accomplishments

- Locked the LEKSIHJELP_EXAM contract (label, envelope, no dual-engine variant) up-front so Plan 02 (firestore enum + writer) and Plan 03 (verification) inherit a stable shape
- Extended `shared/resource-profile.js` enum, validators, and envelope branch with the new profile while preserving every existing test (29/29 pass)
- Promoted `PROFILE_LABELS_NN` and `PROFILE_LABELS_EN` to first-class exports (the module previously only exported `_NB`), so consumers in any locale can pick labels off the shared module without re-implementing the map
- Wired the option into the teacher picker, the four-profile explainer modal, and the i18n string banks (nb + en)

## Task Commits

1. **Task 1: Lock LEKSIHJELP_EXAM UX shape** — auto-resolved (`checkpoint:decision`, default-recommended option chosen per auto-mode policy; no commit)
2. **Task 2: Apply the locked shape across resource-profile + locales + classroom-illustrations + question-builder** — `612bcf1` (feat) in `/Users/geirforbord/Papertek/lockdown`

**Plan metadata:** committed in this leksihjelp repo separately (next step).

## Files Created/Modified

All paths are in the **lockdown sibling repo** (`/Users/geirforbord/Papertek/lockdown`), not the leksihjelp tree.

- `public/js/writing-test/shared/resource-profile.js` — new enum value, two new label-map exports, envelope branch, JSDoc updates
- `public/js/writing-test/shared/resource-profile.test.js` — 29 tests pass; added five-value assertions, NN/EN label assertions, envelope assertion, resolve-through assertion, and updated isValidProfile/isValidProfileOverride coverage
- `public/js/writing-test/shared/classroom-illustrations.js` — fifth section in the resource-profile explainer modal
- `public/js/writing-test/locales/nb.js` — `leksihjelp_exam` under `resourceProfile.label` and `resourceProfileInfo.leksihjelp_exam` heading + description
- `public/js/writing-test/locales/en.js` — same shape, English strings
- `public/js/writing-test/teacher/question-builder.js` — fifth `<option>` between EXAM and LEXIN

## Decisions Made

- **Default-recommended UX shape (Task 1):** auto-selected per auto-mode. Locked: enum value `'leksihjelp_exam'`, label "Eksamen med Leksihjelp" / "Exam with Leksihjelp", envelope `{ leksihjelp: true, lexinIframe: false, ttsAlwaysOn: true, spellEngineOptions: ['off'] }`. Rationale: minimal surface area; reuses Phase 63 envelope plumbing; avoids the double-flagging footgun a dual-engine variant would introduce.
- **NN/EN labels added to the shared module now**, not deferred. Cost is two frozen objects; benefit is downstream pickers don't need a fallback map.
- **Picker insertion point:** between EXAM and LEXIN, so the two exam-shaped profiles appear next to each other.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No `nn.js` locale file exists in the lockdown repo today**
- **Found during:** Task 2 (locale updates)
- **Issue:** Plan listed `locales/nn.js` as a required edit, but `ls public/js/writing-test/locales/` only contains `en.js` and `nb.js`. Editing a non-existent file would have failed the plan; creating a stub would have introduced a much larger change (the entire i18n string bank) outside this plan's scope.
- **Fix:** Skipped the nn.js file edit; instead added `PROFILE_LABELS_NN` as a first-class export from `shared/resource-profile.js` so a future Nynorsk locale drop-in (or a lockdown-side i18n fallback that reads the shared label map) can consume the labels without a second touchpoint here.
- **Files modified:** `shared/resource-profile.js` (PROFILE_LABELS_NN export added), `shared/resource-profile.test.js` (NN label assertion added)
- **Verification:** `node --test resource-profile.test.js` exits 0 with the new "PROFILE_LABELS_NN has the five Nynorsk labels and is frozen" assertion passing
- **Committed in:** `612bcf1` (Task 2 commit)

**2. [Rule 2 - Missing Critical] `PROFILE_LABELS_EN` was not exported from the shared module**
- **Found during:** Task 2 (locale updates)
- **Issue:** Plan asked for English label + description in `locales/en.js` but the shared module only exposed `PROFILE_LABELS_NB`. The `<interfaces>` block in the plan claimed both `_NN` and `_EN` exports already existed — they did not. Without exporting them, a downstream picker rendered in EN would have to hard-code label strings (drifting from the source of truth).
- **Fix:** Added `PROFILE_LABELS_EN` (frozen, mirrors NB shape) alongside `PROFILE_LABELS_NN`.
- **Files modified:** `shared/resource-profile.js`, `shared/resource-profile.test.js`
- **Verification:** Test "PROFILE_LABELS_EN has the five English labels and is frozen" passes; `isFrozen` true.
- **Committed in:** `612bcf1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes are additive and stay within the plan's "client-surface only" scope. The missing nn.js file is documented as a follow-up; no firestore / Cloud Functions work was pulled in from Plan 02.

## Issues Encountered

- The plan's `<interfaces>` block over-claimed: it described `PROFILE_LABELS_NN/EN` as existing exports, but only `PROFILE_LABELS_NB` shipped. Auto-corrected (deviation #2). Worth tightening the planner's interface-extraction step for cross-repo plans.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 (firestore.rules + Cloud Functions enum extension + the `chrome.storage.local.examModeLocked + examMode` writer that fires when the new profile is active) is unblocked. The contract it inherits is: when a participant resolves to `'leksihjelp_exam'`, the writing-environment must set both `examModeLocked: true` and `examMode: true` on the lockdown-side leksihjelp shim's `chrome.storage.local` so the Phase 27 runtime suppression engages.
- Plan 03 (browser verification of the picker, the explainer modal, and the writer round-trip) is unblocked.

**Pending follow-ups (do not block 29-02 / 29-03):**
- If/when a Nynorsk locale file is added in lockdown, add `leksihjelp_exam` strings under `resourceProfile.label` and `resourceProfileInfo` mirroring nb.js. The `PROFILE_LABELS_NN` export is already in place.
- skriveokt-zero (Tauri sibling) inherits this profile via deferred Phase 28.1 (EXAM-09); no action required here.

## Self-Check: PASSED

- ✅ FOUND: lockdown commit `612bcf1` ("feat(29-01): add LEKSIHJELP_EXAM resource profile (UX surface)")
- ✅ FOUND: 6 files modified per plan (with deviation #1 logged for the missing nn.js)
- ✅ Test suite green: 29/29 pass on `node --test public/js/writing-test/shared/resource-profile.test.js`
- ✅ `grep -rn "leksihjelp_exam" /Users/geirforbord/Papertek/lockdown/public/js | wc -l` returned 25 (≥ 5 required by plan verification)
- ✅ `git -C /Users/geirforbord/Papertek/leksihjelp status --short | grep -v "^?? "` returns empty (leksihjelp tree untouched)

---
*Phase: 29-lockdown-teacher-lock-ux*
*Completed: 2026-04-28*
