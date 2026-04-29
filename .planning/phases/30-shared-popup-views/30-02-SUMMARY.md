---
phase: 30-shared-popup-views
plan: 02
subsystem: ui
tags: [popup, view-modules, lockdown-sidepanel, cross-repo, sync, version-bump]

# Dependency graph
requires:
  - phase: 30-shared-popup-views
    plan: 01
    provides: synced view modules (extension/popup/views/) with explicit dep contracts; check-popup-deps gate
provides:
  - Lockdown webapp now mounts the same dictionary + settings views the extension popup uses, via leksihjelp-sidepanel-host.js
  - Sync script extended to copy popup/views/ + popup-views.css (latter graceful no-op until upstream ships it)
  - audioEnabled:false hardcoded in lockdown context — no audio buttons, no playback path, no MB-level downloads
  - showSection contract: lockdown sidepanel surfaces only grammar + darkmode; auth/exam/payments/skriv/pin/vocab-refresh stay extension-only
  - Cross-repo commit pair: leksihjelp 98f4a9a (CLAUDE.md + version bump) + lockdown 1193e56 (sync extension + sidepanel host + writing-environment replacement)
  - check-popup-deps as numbered Release Workflow step 7 in CLAUDE.md (between exam-marker and bundle-size; subsequent steps renumbered 7-13 -> 8-14)
affects: [30-03 skriveokt-zero parity (deferred), future popup-views CSS extraction (Plan 30-01 sub-step E), future Plan 30-03 UAT for staging-lockdown smoke test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-repo commit pair (leksihjelp + lockdown) with version bump on the leksihjelp side as the consumer-pin signal"
    - "Sidepanel host file as the lockdown-only inclusion contract: declares what to mount with what deps; bug fixes go upstream and re-sync"
    - "Idempotent mount via dataset.lhMounted flag + module-level _activeHandle singleton; teardown clears both so profile-change re-entry remounts cleanly"
    - "Sync script existence-checks (fs.existsSync) for new surfaces — graceful no-op when upstream hasn't shipped them yet (popup-views.css today)"

key-files:
  created:
    - /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js
  modified:
    - /Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js
    - /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/writing-environment.js
    - /Users/geirforbord/Papertek/lockdown/public/elev.html
    - CLAUDE.md
    - extension/manifest.json
    - package.json
    - backend/public/index.html

key-decisions:
  - "audioEnabled:false hardcoded in the host (not configurable). Defence-in-depth: dictionary view's renderResults() short-circuits audio button HTML when audioEnabled=false, the host never passes a real playAudio, AND extension/audio/ stays out of the sync script. Three independent safeguards because this is the school-deployment-no-MB-downloads property the user explicitly named."
  - "Static <script src> includes for view modules in elev.html (not via LEKSI_BUNDLE in leksihjelp-loader.js). Rationale: views have no chrome.* / __lexi* implicit deps (enforced by check-popup-deps gate), so they're safe to load before bootLeksihjelp. Avoids coupling view loading to bundle-loading lifecycle."
  - "Stub search implementation in writing-environment.js (~150 lines: bank-flatten search, leksiRenderCard, leksiTranslation, LEKSI_BANKS/GENUS/LANG_FLAGS) deleted entirely. The synced dictionary view is now the single source of truth for that logic."
  - "Settings showSection: { uiLanguage:false, language:false, grammar:true, darkmode:true, prediction:false, spellcheckAlternates:false }. Deviation from plan's text (plan said language:false but didn't restate uiLanguage; uiLanguage:false because lockdown owns its own i18n + the engine-language is teacher-controlled). The true source-of-truth is the host file."
  - "Settings DOM scaffold rendered minimally (only grammar + darkmode blocks) — settings view's showSection skips missing blocks gracefully, so omitting the rest is safe and saves DOM."
  - "Idempotent mount with dataset.lhMounted flag + module-level _activeHandle singleton in the host. Both boot path (initial profile=full) and profile-change branch (envelope.leksihjelp flips on) call the same mountLeksihjelpSidepanelIfReady helper; the singleton ensures double-call is a no-op."
  - "Teardown helper teardownLeksihjelpSidepanel called when envelope.leksihjelp flips OFF (profile change). Clears _activeHandle and dataset flag so re-entering a leksihjelp-enabled profile remounts cleanly."
  - "popup-views.css line in sync script is graceful no-op (fs.existsSync). Plan 30-01 deferred CSS extraction; the line lands now so when 30-03 (or a future polish plan) ships popup-views.css, the sync script already covers it."
  - "Cross-repo commit pair: leksihjelp 98f4a9a (CLAUDE.md + manifest.json + package.json + backend/public/index.html — version 2.7.0 -> 2.8.0) precedes lockdown 1193e56 in narrative ordering. Lockdown synced from /Users/geirforbord/Papertek/leksihjelp via the file: symlink in node_modules/@papertek/leksihjelp, so the synced popup/views/*.js files in lockdown are byte-identical to upstream extension/popup/views/."
  - "Production deploy to lockdown-stb (papertek.app) explicitly NOT done. Pushed staging branch only; user takes the production deploy decision separately."

requirements-completed:
  - PHASE-30-G3  # sync script copies extension/popup/views/ to lockdown/public/leksihjelp/popup/views/
  - PHASE-30-G4  # lockdown sidepanel mounts views with limited deps (audioEnabled:false, showSection trimmed)
  - PHASE-30-G5  # no audio in lockdown (extension/audio/ NOT in sync; audioEnabled:false in host)
  - PHASE-30-G7  # CLAUDE.md downstream-consumer note for new synced surface

# Metrics
duration: 10min
completed: 2026-04-29
---

# Phase 30 Plan 02: Lockdown Sidepanel Mount Summary

**Wired the synced popup view modules from Plan 30-01 into the lockdown webapp's student writing environment, replacing a ~150-line stub <input>+<div> dictionary panel with a real sidepanel host that mounts the same dictionary + settings modules the extension popup uses — limited to audioEnabled:false + showSection that surfaces only grammar + darkmode (no Vipps login, no exam-toggle, no skriv/pin/vocab-refresh).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-29T06:47:22Z
- **Completed:** 2026-04-29T06:57:53Z
- **Tasks completed:** 4 of 4
- **Files created:** 1 (leksihjelp-sidepanel-host.js in lockdown)
- **Files modified:** 7 (sync-leksihjelp.js, writing-environment.js, elev.html in lockdown; CLAUDE.md, manifest.json, package.json, backend/public/index.html in leksihjelp)
- **Lines deleted from writing-environment.js:** ~150 (LEKSI_BANKS, leksiRenderCard, leksiTranslation, leksiPerformSearch, search input listener)

## Accomplishments

### Task 1: Sync script extension

Added popup-views copy block to `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js`:

```js
const popupViewsSrc = path.join(pkgDir, 'extension', 'popup', 'views');
if (fs.existsSync(popupViewsSrc)) {
    copyDir(popupViewsSrc, path.join(destDir, 'popup', 'views'));
}

const popupViewsCss = path.join(pkgDir, 'extension', 'styles', 'popup-views.css');
if (fs.existsSync(popupViewsCss)) {
    fs.copyFileSync(popupViewsCss, path.join(destDir, 'styles', 'popup-views.css'));
}
```

Placed after the existing styles per-file loop (which renames content.css → leksihjelp.css) and before i18n. The popup-views.css block is a graceful no-op today because Plan 30-01 deferred CSS extraction.

Verified post-sync state:
- `public/leksihjelp/popup/views/dictionary-view.js` — present (synced from `extension/popup/views/dictionary-view.js` via the `file:../leksihjelp` symlink in `node_modules/@papertek/leksihjelp`)
- `public/leksihjelp/popup/views/settings-view.js` — present
- `public/leksihjelp/popup/views/{pause,report}-view.js` — present (skeletons from Plan 30-01)
- `public/leksihjelp/popup/views/{dictionary,settings}-view.test.js` — present
- `public/leksihjelp/styles/popup-views.css` — absent (deferred per 30-01)
- `public/leksihjelp/audio/` — absent (negative assertion: audio is NOT synced)

### Task 2: Sidepanel host + writing-environment.js

**Created `leksihjelp-sidepanel-host.js`** (lockdown-only, lives in lockdown's repo, NOT in synced output):

- IIFE module exposes `window.__leksihjelpSidepanelHost = { mount, destroyMounted, isMounted }`
- `mount({ rootEl })` renders a vertical-stack DOM (badge row → dictionary scaffold → collapsible settings scaffold) inside rootEl
- Dictionary view mounted only when `host.__lexiVocab` and `host.__lexiDictionaryView` are both ready (gates show "Leksihjelp er ikke klar" placeholder otherwise)
- Settings view mounted independently with `showSection: { uiLanguage:false, language:false, grammar:true, darkmode:true, prediction:false, spellcheckAlternates:false }` — surfaces only grammar + darkmode
- Both views receive a single shared `viewState` object (current language, dictionary, indexes) and i18n adapters wrapping `host.__lexiI18n`
- EKSAMENMODUS badge subscribes to `chrome.storage.onChanged` for live exam-mode lock toggle reaction (writing-environment.js Phase 29-02 sets the storage flag)
- Idempotent: module-level `_activeHandle` singleton + caller-side `dataset.lhMounted` flag both guard against double-mount
- Teardown removes the storage listener, calls each view's destroy(), clears innerHTML, and clears the dataset flag

**Edited `writing-environment.js`:**

1. Replaced stub `<input id="leksihjelp-search">` + `<div id="leksihjelp-results">` with `<div id="leksihjelp-sidepanel-root">` (the mount target).
2. Deleted ~150 lines of inline LEKSI_BANKS / leksiRenderCard / leksiTranslation / leksiPerformSearch / search input event listener — that logic now lives upstream in the synced dictionary view.
3. Added `mountLeksihjelpSidepanelIfReady()` and `teardownLeksihjelpSidepanel()` helpers as module-local closures.
4. Wired the mount helper into both `bootLeksihjelp().then(...)` paths: the initial-boot path (when `initialEnvelope.leksihjelp === true`) and the profile-change path (when `envelope.leksihjelp && !wasLeksi`).
5. Wired the teardown helper into the profile-change branch's `!envelope.leksihjelp && wasLeksi` path so re-entering a leksihjelp-enabled profile remounts cleanly.
6. Bumped writing-environment.js version marker `v4.9.3` → `v4.10.0`.
7. Resource-tab click handler updated to focus the synced view's `#search-input` instead of the deleted `#leksihjelp-search`.

**Edited `elev.html`:** loads `dictionary-view.js`, `settings-view.js`, and `leksihjelp-sidepanel-host.js` via static `<script src>` after `js/leksihjelp-loader.js`. View modules have no chrome.* / __lexi* implicit deps (enforced by `check-popup-deps`), so loading them ahead of `bootLeksihjelp` is safe.

### Task 3: CLAUDE.md updates + version bump

**`CLAUDE.md` Downstream consumers section:**

- File-list table for the lockdown webapp gained two rows: `extension/popup/views/*.js` and `extension/styles/popup-views.css` synced surfaces (the second flagged as not-yet-present, deferred per 30-01).
- "Implications for changes here" gained two bullets: one on dep-contract additivity + check-popup-deps gate, one on audioEnabled:false suppression mechanism + extension/audio/ being NOT in sync.
- skriveokt-zero subsection gained "When EXAM-09 lands" sub-list naming `extension/popup/views/` as future synced surface.

**`CLAUDE.md` Release Workflow:**

Inserted check-popup-deps as new step 7 (between check-exam-marker step 6 and check-bundle-size which moved 7→8). Renumbered subsequent steps: 7→8 (bundle-size), 8→9 (baseline-bundle-size), 9→10 (benchmark-coverage), 10→11 (governance-data), 11→12 (version bump), 12→13 (rebuild zip), 13→14 (upload). Cross-reference "(step 6)" inside step 9's "before the packaged-zip gate" updated to "(step 8)".

**Version bump 2.7.0 → 2.8.0** across:
- `extension/manifest.json`
- `package.json`
- `backend/public/index.html` (the displayed "Versjon 2.7.0" string)

### Task 4: Release gates + cross-repo commits

All leksihjelp release gates passed (15 of 15):

- `check-fixtures` — clean across all priority bands
- `check-popup-deps` + `:test` — 4 view modules clean of implicit globals; self-test fires on bad scratch / passes on good scratch
- `check-explain-contract` + `:test` — popover rules valid
- `check-rule-css-wiring` + `:test` — 59/59 rules CSS-wired
- `check-spellcheck-features` — feature-gated lookup indexes intact
- `check-network-silence` + `:test` — extension surface offline
- `check-exam-marker` + `:test` — every rule + registry entry validated
- `check-baseline-bundle-size` + `:test` — informational pass (baseline absent today)
- `check-benchmark-coverage` + `:test` — expectations clean
- `check-governance-data` + `:test` — data shape checks pass
- `check-bundle-size` — 12.60 MiB / 20.00 MiB cap (7.40 MiB headroom)
- `test:popup-views` — 8/8 unit tests pass

**Commits landed:**

1. **leksihjelp `98f4a9a`** — `docs(30-02): document popup/views/ as synced surface; bump version 2.7.0 -> 2.8.0` (CLAUDE.md, extension/manifest.json, package.json, backend/public/index.html)
2. **lockdown `1193e56`** — `feat(leksihjelp-sidepanel): mount synced popup views with audioEnabled:false` (10 files: scripts/sync-leksihjelp.js, public/js/writing-test/student/leksihjelp-sidepanel-host.js [new], public/js/writing-test/student/writing-environment.js, public/elev.html, public/leksihjelp/popup/views/{dictionary,settings,pause,report}-view.js + the two .test.js files [synced])

**Push:** lockdown `staging` branch pushed to `origin/staging` (4e18e78..1193e56). Production branch (`main`) NOT pushed — papertek.app deploy explicitly deferred per user's auto-mode-but-no-prod-deploy rule.

## Files Created/Modified

| File | Status | Purpose |
| ---- | ------ | ------- |
| `lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js` | created | IIFE host: mount/destroyMounted/isMounted singleton, dep adapters (storage/runtime/i18n), DOM scaffolds, audioEnabled:false, showSection contract |
| `lockdown/scripts/sync-leksihjelp.js` | modified | +13 lines: copy extension/popup/views/ + extension/styles/popup-views.css to public/leksihjelp/ |
| `lockdown/public/js/writing-test/student/writing-environment.js` | modified | -150 lines stub search; +20 lines mount/teardown helpers wired into both boot paths; version v4.10.0 |
| `lockdown/public/elev.html` | modified | loads dictionary-view.js + settings-view.js + leksihjelp-sidepanel-host.js after leksihjelp-loader.js |
| `lockdown/public/leksihjelp/popup/views/*.js` | created (synced) | byte-identical mirror of upstream extension/popup/views/ via the file: symlink |
| `leksihjelp/CLAUDE.md` | modified | downstream-consumers section gained popup/views/ + popup-views.css surfaces, audioEnabled note, check-popup-deps gate documented; numbered Release Workflow step 7 inserted, subsequent steps renumbered 7-13 → 8-14 |
| `leksihjelp/extension/manifest.json` | modified | version 2.7.0 → 2.8.0 |
| `leksihjelp/package.json` | modified | version 2.7.0 → 2.8.0 |
| `leksihjelp/backend/public/index.html` | modified | landing-page version display 2.7.0 → 2.8.0 |

## Decisions Made

(See key-decisions in frontmatter — full architectural rationale.)

## Deviations from Plan

### [Rule 1 — Auto-fixed Bug] Stub search code in writing-environment.js (lines 323-451) blocked verification

- **Found during:** Task 2 verification (the automated verify command's regex `/leksihjelp-search|leksihjelp-results/` flagged residual references after the visible `<div id="leksihjelp-search">` was deleted).
- **Issue:** writing-environment.js had ~150 lines of inline dictionary search implementation (LEKSI_BANKS table, leksiRenderCard, leksiTranslation, leksiLangBadge, leksihjelpPerformSearch, plus the `leksihjelpSearch?.addEventListener('input', ...)` handler) that referenced the deleted DOM IDs. The plan's <files> for Task 2 listed only writing-environment.js:204-208 and the bootLeksihjelp call site, but that turned out to be incomplete — the inline stub was bigger than the visible HTML.
- **Fix:** Deleted the entire stub block (LEKSI_BANKS, leksiRenderCard, leksiTranslation, leksiLangBadge, leksihjelpPerformSearch, search input listener). Updated the resource-tab click handler to focus `#search-input` (the synced dictionary view's input) instead of the deleted `#leksihjelp-search`. Net -150 lines from writing-environment.js. Architecturally correct: that logic now lives upstream in dictionary-view.js and is sync'd in.
- **Files modified:** lockdown/public/js/writing-test/student/writing-environment.js
- **Verification:** automated verify regex now passes; node --check passes; all release gates still pass.

### [Rule 3 — Auto-fixed Blocking] showSection contract added uiLanguage:false explicitly

- **Found during:** Task 2 host file authoring
- **Issue:** Plan text said `showSection: { language: false, grammar: true, darkmode: true, prediction: false, spellcheckAlternates: false }` but did NOT specify `uiLanguage`. The settings view defaults missing keys to `true` (via `showSection || { uiLanguage: true, darkmode: true, ... }`), so an unspecified `uiLanguage` would have rendered the UI language picker block — which the plan's spirit explicitly forbids ("no UI-language picker" in the objective).
- **Fix:** Added `uiLanguage: false` explicitly to the host's showSection. Confirmed by the settings-view.js code path at line `if (showSection.uiLanguage !== false)`.
- **Files modified:** leksihjelp-sidepanel-host.js (host-only file in lockdown)
- **Verification:** automated verify regex confirms audioEnabled:false + showSection contract present; settings view will skip the UI language block at mount time.

### [Architectural — Documented] popup-views.css surface added to sync script as no-op

- **Found during:** Task 1 sync script extension
- **Issue:** Plan 30-01 deferred CSS extraction (sub-step E), so `extension/styles/popup-views.css` doesn't exist today. The plan's text added a `fs.copyFileSync` line for it.
- **Fix:** Wrapped the line in `fs.existsSync()` so it's a graceful no-op until upstream ships the file. The line lands now so when 30-03 (or a future polish plan) ships popup-views.css, the sync script already covers it without another edit.
- **Verification:** sync script runs cleanly; popup-views.css confirmed absent in lockdown after sync (correct).

### [Architectural — Documented] Static <script src> for view modules in elev.html (not LEKSI_BUNDLE)

- **Found during:** Task 2 elev.html edit
- **Issue:** Plan said "place AFTER `<script src="/js/leksihjelp-loader.js">`". An alternative would have been to add the views to `LEKSI_BUNDLE` inside leksihjelp-loader.js so they load with the rest of the bundle.
- **Fix:** Followed the plan literally — static `<script>` includes in elev.html. Rationale (key-decision): views have no chrome.* / __lexi* implicit deps (enforced by check-popup-deps), so they're safe to load eagerly and decouples view loading from bootLeksihjelp lifecycle.
- **Trade-off:** ~+30KB of always-loaded JS even when leksihjelp profile isn't active. Acceptable given the views are small and render-time-only (no init-time work without a host calling mount).

### [Architectural — Documented] Lockdown branch was already `staging`; pushed without branch creation

- **Found during:** Task 4 push step
- **Issue:** Plan said `git push origin staging      # or whatever the staging branch is named`. Confirmed the active branch in lockdown was already `staging` (not `main`), so the push was straightforward.
- **Fix:** Pushed origin/staging directly. Confirmed `gh auth status` was authenticated. No GitHub Actions workflow exists in `.github/workflows/`, so deploy mechanism is the project's Firebase Hosting flow (manual or via a separate runner). Recorded that staging branch is updated; production deploy decision rests with the user.

---

**Total deviations:** 5 (1 auto-fixed bug, 1 auto-fixed blocking, 3 architectural-and-documented)
**Impact on plan:** Plan 30-02's success criteria are SATISFIED:
- PHASE-30-G3: sync script copies popup/views/ — yes (verified post-sync)
- PHASE-30-G4: lockdown sidepanel mounts views with limited deps — yes (audioEnabled:false + showSection contract)
- PHASE-30-G5: no audio in lockdown — yes (extension/audio/ NOT synced; audioEnabled:false hardcoded)
- PHASE-30-G7: CLAUDE.md updated for new synced surface — yes (downstream-consumers section + Release Workflow step 7)

## Issues Encountered

- **Initial verification failure** (Rule 1 deviation above): the automated verify regex caught residual stub references at lines 324-325 + 410-451. Forced reading deeper into writing-environment.js, which surfaced the ~150-line stub search implementation. Net positive: the synced dictionary view replaces it cleanly.
- **No GitHub Actions workflow in lockdown:** `gh run list` returned empty because `.github/workflows/` doesn't exist. The lockdown deploy mechanism is Firebase Hosting (firebase.json present), triggered out-of-band. Recorded the staging push success; staging deploy itself is a separate user step.

## User Setup Required

- **Manual UAT recommended (Plan 30-03 / future):** Visit the staging-lockdown URL after the next Firebase Hosting deploy. Walk through:
  1. Create a leksihjelp-enabled test (resource profile = `full` or `LEKSIHJELP_EXAM`).
  2. Join as a student → enter writing environment.
  3. Click the "Ressurser" (resource panel) button → switch to the "Leksihjelp" tab.
  4. Verify the synced dictionary view renders (search box, language switcher, direction toggle, results placeholder).
  5. Verify NO audio buttons render on result cards (`audioEnabled:false` enforcement).
  6. Verify the EKSAMENMODUS badge appears when the test profile is LEKSIHJELP_EXAM (set by writing-environment.js applyExamModeLock from Phase 29-02).
  7. Open the "Innstillinger" `<details>` block → verify only grammar + darkmode sections render (no Vipps login, no exam-toggle, no skriv link, no UI lang picker, no prediction toggle, no spellcheck-alternates toggle).
  8. Toggle dark mode → verify it applies to the sidepanel (and only the sidepanel; the main editor has its own theme).

- **Production deploy (papertek.app)** explicitly deferred per user's auto-mode-but-no-prod-deploy rule. Run `firebase deploy --only hosting --project lockdown-stb` from `/Users/geirforbord/Papertek/lockdown` after the staging UAT passes, in a session where the user is present.

## Next Phase Readiness

- **Plan 30-02 SATISFIED.** Plan 30-03 (skriveokt-zero parity, deferred Phase 28.1) can proceed once the user un-defers it. The dep-injection contract is stable enough that 30-03 should be a sync-script-extension change in skriveokt-zero, not a logic change.
- **Recommended next action:** Manual UAT on staging-lockdown after the next deploy. Capture screenshots for the deferred verification checklist.
- **Deferred items for future plans:**
  - popup-views.css extraction (Plan 30-01 sub-step E) — sync script already handles it via fs.existsSync
  - skriveokt-zero parity (Plan 30-03 / Phase 28.1) — un-defer when zero starts shipping to schools
  - Production deploy of lockdown-stb (papertek.app) — separate user-driven step

## Self-Check: PASSED

Verified files exist on disk:
- `/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js` — FOUND (created)
- `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js` — FOUND (modified, has popup/views block)
- `/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/writing-environment.js` — FOUND (modified, v4.10.0, no stub IDs)
- `/Users/geirforbord/Papertek/lockdown/public/elev.html` — FOUND (modified, loads view modules + host)
- `/Users/geirforbord/Papertek/lockdown/public/leksihjelp/popup/views/dictionary-view.js` — FOUND (synced byte-identical to upstream)
- `/Users/geirforbord/Papertek/lockdown/public/leksihjelp/popup/views/settings-view.js` — FOUND (synced)
- `/Users/geirforbord/Papertek/lockdown/public/leksihjelp/audio/` — ABSENT (correct negative assertion)
- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` — FOUND (downstream-consumers section + Release Workflow updated)
- `/Users/geirforbord/Papertek/leksihjelp/extension/manifest.json` — FOUND (version 2.8.0)
- `/Users/geirforbord/Papertek/leksihjelp/package.json` — FOUND (version 2.8.0)
- `/Users/geirforbord/Papertek/leksihjelp/backend/public/index.html` — FOUND (Versjon 2.8.0)

Verified commits exist:
- `98f4a9a` (leksihjelp) — FOUND (`git log --oneline -1` shows it as HEAD)
- `1193e56` (lockdown) — FOUND on staging branch (pushed to origin)

Verified gates pass (full leksihjelp release-gate run):
- `npm run check-fixtures` — pass
- `npm run check-popup-deps` + `:test` — pass
- `npm run check-explain-contract` + `:test` — pass
- `npm run check-rule-css-wiring` + `:test` — pass
- `npm run check-spellcheck-features` — pass
- `npm run check-network-silence` + `:test` — pass
- `npm run check-exam-marker` + `:test` — pass
- `npm run check-baseline-bundle-size` + `:test` — pass
- `npm run check-benchmark-coverage` + `:test` — pass
- `npm run check-governance-data` + `:test` — pass
- `npm run check-bundle-size` — pass (12.60 MiB / 20.00 MiB)
- `npm run test:popup-views` — 8/8 pass

Verified automated verify commands from plan:
- Task 1 verify: `node scripts/sync-leksihjelp.js && test -f popup/views/{dictionary,settings}-view.js && ! test -d audio` → SYNC_OK
- Task 2 verify: regex check for audioEnabled:false + __lexiDictionaryView/__lexiSettingsView + __leksihjelpSidepanelHost + v4.10.0 + no stub IDs → SIDEPANEL_HOST_OK
- Task 3 verify: CLAUDE.md contains popup/views + audioEnabled + check-popup-deps + check-popup-deps:test; manifest.json/package.json versions match; index.html contains version → VERSION_BUMP_OK
- Task 4 verify: all release gates pass; lockdown commit visible in git log

---
*Phase: 30-shared-popup-views*
*Plan: 02 (lockdown sidepanel mount)*
*Completed: 2026-04-29*
*Cross-repo commits: leksihjelp 98f4a9a + lockdown 1193e56 (pushed to origin/staging)*
*Production deploy: NOT done (deferred per user policy)*
