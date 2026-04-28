---
phase: 29-lockdown-teacher-lock-ux
plan: 02
subsystem: infra
tags: [lockdown, firestore-rules, cloud-functions, exam-mode, leksihjelp, chrome-storage, firebase-deploy]

requires:
  - phase: 29-lockdown-teacher-lock-ux
    plan: 01
    provides: "RESOURCE_PROFILES.LEKSIHJELP_EXAM enum constant + envelope branch (lockdown shared/resource-profile.js)"
  - phase: 27-exam-mode
    provides: "examMode + examModeLocked storage flags consumed by leksihjelp content scripts on init + via onChanged listener"
  - phase: 28-lockdown-exam-mode-sync
    provides: "lockdown chrome-API shim (chrome.storage.local) so writing-environment.js can write the flags from a non-extension context"
provides:
  - "Backend (firestore.rules + Cloud Functions) accepts 'leksihjelp_exam' as a fifth resourceProfile enum value, end-to-end (rule guards, createTest validator, toggleResourceAccess validator)"
  - "writing-environment.js applyExamModeLock helper that writes examModeLocked+examMode on entering LEKSIHJELP_EXAM and clears BOTH on transition away"
  - "staging-lockdown Firebase project deployed with the new enum + writer plumbing"
affects: [29-03-verification, lockdown skriveokt-zero EXAM-09]

tech-stack:
  added: []
  patterns:
    - "Five-value resource-profile enum mirrored consistently across firestore.rules + every Cloud Function validator"
    - "Profile-transition writer: helper guards on chrome.storage.local availability so non-extension surfaces are a no-op; clear-on-exit prevents stale lock state from bricking subsequent non-exam tests for the same student"

key-files:
  created: []
  modified:
    - "/Users/geirforbord/Papertek/lockdown/firestore.rules"
    - "/Users/geirforbord/Papertek/lockdown/functions/teacher/createTest.js"
    - "/Users/geirforbord/Papertek/lockdown/functions/teacher/toggleResourceAccess.js"
    - "/Users/geirforbord/Papertek/lockdown/functions/teacher/createTest-settings.test.js"
    - "/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/writing-environment.js"

key-decisions:
  - "applyExamModeLock module-level helper (not a method on a controller) so it can be called from both the on-change handler AND the initial-paint path with identical semantics"
  - "Initial-paint call passes prevProfile=null intentionally — clear branch is a no-op there, so external writers (leksihjelp popup 'Simuler lærer-lås' dev button) are not clobbered when a student joins a non-LEKSIHJELP_EXAM test"
  - "On-change call sequenced AFTER applyEnvelopeToDOM so the leksihjelp bundle has already been re-booted by step 1 of the handler when its examMode listener fires"
  - "Production deploy DEFERRED per user instruction — staging deploy only this run; prod (lockdown-stb) to be performed manually after browser verification"

patterns-established:
  - "Adding a value to the resourceProfile enum is now a four-touch backend change: firestore.rules guards (×2), createTest.js ALLOWED + error message + JSDoc, toggleResourceAccess.js VALID_PROFILES + module JSDoc + two error messages, plus the test that asserts every enum value round-trips"

requirements-completed: [EXAM-10]

duration: 22 min
completed: 2026-04-28
---

# Phase 29 Plan 02: Backend enum extension + writing-environment teacher-lock writer Summary

**firestore.rules + createTest + toggleResourceAccess accept the new 'leksihjelp_exam' profile end-to-end, and writing-environment.js writes/clears chrome.storage.local.{examModeLocked,examMode} when the resolved profile enters or leaves LEKSIHJELP_EXAM — deployed to staging-lockdown (prod deploy deferred per user instruction).**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-04-28T20:35:00Z
- **Completed:** 2026-04-28T20:57:00Z (approx, post-staging-deploy)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-action partially completed — staging done, prod deferred)
- **Files modified:** 5 (all in lockdown sibling repo)

## Accomplishments

- Five-value resource-profile enum is now consistent across all backend surfaces — `isValidResourceProfile`, `isValidResourceProfileOverride` (firestore.rules), `validateAndResolveResourceProfile` ALLOWED (createTest.js), `VALID_PROFILES` + `isValidProfile` + `isValidOverride` (toggleResourceAccess.js)
- 17/17 function tests pass on `createTest-settings + createTest-oppgavesett`, including the new "all five valid profiles are accepted" assertion
- writing-environment.js: new `applyExamModeLock(newProfile, prevProfile)` module-level helper, called twice — once on initial paint right after `applyEnvelopeToDOM(initialEnvelope)` and once inside the `shared.onProfileChange` handler as a sibling branch beside the BSPC-01 EXAM `editor.spellcheck = true` wiring
- Clear-on-transition path explicitly writes `{ examModeLocked: false, examMode: false }` when leaving LEKSIHJELP_EXAM, preventing the bricked-toggle scenario flagged in Phase 29 ROADMAP success criterion #5
- Staging Firebase project (staging-lockdown) deployed: `firestore.rules` + 60+ Cloud Functions including the updated `createTest` and `toggleResourceAccess` — all "Successful update operation"

## Task Commits

All commits land in `/Users/geirforbord/Papertek/lockdown` (sibling repo), branch `staging`.

1. **Task 1: Extend backend enum (firestore.rules + createTest + toggleResourceAccess + tests)** — `d7825eb` (feat)
2. **Task 2: Wire applyExamModeLock + clear-on-transition in writing-environment.js** — `b35b409` (feat)
3. **Task 3: Manual Firebase deploy** — staging deployed (no commit; deploy is operational not source). Prod deploy DEFERRED.

**Plan metadata:** committed in this leksihjelp repo separately.

## Files Created/Modified

All paths are in the **lockdown sibling repo** (`/Users/geirforbord/Papertek/lockdown`), not the leksihjelp tree.

- `firestore.rules` — `isValidResourceProfile` and `isValidResourceProfileOverride` allowlists extended; comment block updated to "five named values"; refreshed stale `null or 'full'` comment near the participant `resourceProfileOverride` update guard
- `functions/teacher/createTest.js` — `ALLOWED` array, JSDoc (`@param`, `@returns`, allowed-values list), `HttpsError` message, and the "five-value enum profile" comment near the test-document write
- `functions/teacher/toggleResourceAccess.js` — `VALID_PROFILES` + module JSDoc + both error messages (`profile must be one of:` and `override must be:`)
- `functions/teacher/createTest-settings.test.js` — "all four" → "all five" assertion now iterates over `['full', 'exam', 'lexin', 'none', 'leksihjelp_exam']`
- `public/js/writing-test/student/writing-environment.js` — module-level `applyExamModeLock` helper (after the import block) + initial-paint call after `applyEnvelopeToDOM(initialEnvelope)` + on-change call inside `shared.onProfileChange` handler as a sibling branch beside BSPC-01

## Decisions Made

- **Helper as module-level function (not class method):** keeps both call sites trivially identical and side-effect-free; the helper is pure save for the `chrome.storage.local.set` call which it guards on availability
- **Initial-paint call passes `prevProfile=null` intentionally:** the clear branch only fires when `wasLeksiExam` is true, so a non-LEKSIHJELP_EXAM first paint is a no-op — preserves any flags an external writer (leksihjelp popup's "Simuler lærer-lås" dev button) may have already set
- **On-change call sequenced AFTER `applyEnvelopeToDOM`:** the leksihjelp bundle is booted (or torn down) in step 1 of the same handler; writing the flags BEFORE the bundle is alive would mean the very first `onChanged` event arrives at a non-listener. After-applyEnvelopeToDOM, the listener is up.
- **Comment refresh on the participant `resourceProfileOverride` rule:** the existing comment said "(null or 'full')" which was already stale post-Phase 63 Plan 04; refreshed to "(null, full, exam, lexin, none, leksihjelp_exam)" so future readers don't get misled. The actual check delegates to `isValidResourceProfileOverride`, which is the authoritative source.

## Deviations from Plan

### Deferred per user instruction

**1. [Constraint - User-Imposed] Production deploy (lockdown-stb) DEFERRED**
- **Found during:** Task 3 (Manual Firebase deploy)
- **Issue:** User's execution prompt forbade deploys to the prod Firebase project (`lockdown-stb`) in this run. Plan Task 3 step 4 ("Deploy to lockdown-stb (production)") therefore cannot complete autonomously.
- **Action taken:** Deployed firestore.rules + Cloud Functions to staging-lockdown only (step 2). Prod deploy (step 4) is left for the user to perform manually after browser verification on staging. The code committed in `d7825eb` and `b35b409` is identical to what prod will receive.
- **Files modified:** none (deploy is operational, not source)
- **Verification:** staging deploy completed cleanly; "Project Console: https://console.firebase.google.com/project/staging-lockdown/overview" reported.

### Auto-fixed Issues

None — Tasks 1 and 2 executed exactly as written. The plan's pre-extracted `<interfaces>` block matched the source files line-for-line (no `Phase 29 Plan 01`-style overclaim this time).

---

**Total deviations:** 1 deferred (user-instructed staging-only run; not a deviation in scope or correctness, just a scheduling carve-out)
**Impact on plan:** Tasks 1 + 2 fully complete and deployable. Task 3 partially complete: staging done, prod queued for human action. Plan 29-03 (browser verification) can proceed against staging.

## Issues Encountered

- None during execution. The Cloud Functions test runner emits a few process warnings (`firebase-functions/v2/...` deprecation hints) but the suite exits 0; out of scope per the deviation-rules SCOPE BOUNDARY.

## User Setup Required

**Production deploy outstanding.** When the user is ready to ship to prod:

```bash
cd /Users/geirforbord/Papertek/lockdown
firebase deploy --only firestore:rules,functions --project lockdown-stb
```

Pre-deploy gate: confirm staging browser verification (Plan 29-03) passes first. The code already committed (`d7825eb` + `b35b409`) is exactly what prod will receive — no re-build, no re-test required between staging and prod.

## Next Phase Readiness

- **29-03 (browser verification of the picker round-trip + writer effect on chrome.storage.local + clear-on-transition behaviour) is unblocked.** Verification can run against `https://stb-lockdown.app` (staging) immediately.
- The `chrome.storage.local` writer is gated on `typeof chrome !== 'undefined' && chrome?.storage?.local?.set` — when running on staging-lockdown without the leksihjelp shim loaded, the writer is a silent no-op (acceptable: the picker option appears, the firestore write succeeds, but no leksihjelp lock flag is set because there's no leksihjelp surface to observe it). Once the lockdown loader is wired to ship the leksihjelp bundle alongside the writing-test (already true via `node scripts/sync-leksihjelp.js`), the writer fires end-to-end.

**Pending follow-ups (do not block 29-03):**

- Production deploy to `lockdown-stb` (deferred per user instruction; see "User Setup Required" above)
- skriveokt-zero (Tauri sibling) inherits this profile via deferred Phase 28.1 (EXAM-09); no action required here

## Self-Check: PASSED

- ✅ FOUND lockdown commit `d7825eb` ("feat(29-02): extend resource-profile enum...")
- ✅ FOUND lockdown commit `b35b409` ("feat(29-02): write/clear leksihjelp examModeLocked flag...")
- ✅ `grep -c "leksihjelp_exam" firestore.rules` = 4 (≥ 2 required)
- ✅ `grep -c "leksihjelp_exam" functions/teacher/createTest.js` = 6 (≥ 1 required)
- ✅ `grep -c "leksihjelp_exam" functions/teacher/toggleResourceAccess.js` = 5 (≥ 1 required)
- ✅ `grep -n "applyExamModeLock" writing-environment.js` matches 4 sites (1 helper def + 1 init call + 1 on-change call + 1 doc-comment ref)
- ✅ `grep -n "examModeLocked: false" writing-environment.js` matches the clear-on-transition path
- ✅ `node --check writing-environment.js` exits 0
- ✅ Staging deploy completed (`firebase deploy --project staging-lockdown` reported "Deploy complete!")
- ✅ Prod deploy intentionally NOT run (user constraint honoured)
- ✅ `git -C /Users/geirforbord/Papertek/leksihjelp status --short | grep -v "^?? "` returns empty (leksihjelp tree untouched)
- ✅ leksihjelp `popup.js` `examModeLocked` references preserved (7 hits — Phase 28 dev path intact)
- ✅ functions test suite: 17/17 pass on `createTest-settings + createTest-oppgavesett`

---
*Phase: 29-lockdown-teacher-lock-ux*
*Completed: 2026-04-28*
