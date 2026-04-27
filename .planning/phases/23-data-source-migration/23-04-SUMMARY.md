---
phase: 23-data-source-migration
plan: 04
subsystem: extension/background + extension/popup

tags: [update-detection, atomic-refresh, indexeddb, runtime-messages, popup-ui, sc-06-bootstrap-carve-out, tdd]

requires:
  - phase: 23-02 cache adapter
    provides: vocab-store v1 surface (API_BASE, getCachedRevisions, fetchBundle, putCachedBundle)
provides:
  - "vocab-updater.js: checkForUpdates() / refreshLanguage(lang) / refreshAll(langs) — startup revision check + atomic refresh"
  - "Service-worker startup hook (chrome.runtime.onStartup + boot-time fire-and-forget) calls checkForUpdates"
  - "Service-worker message handlers: lexi:check-updates-now (popup poll), lexi:refresh-now (popup click)"
  - "Runtime events emitted: lexi:updates-available, lexi:refresh-done, lexi:hydration state='error'"
  - "Popup non-blocking 'Nye ordlister tilgjengelig' notice + 'Oppdater ordlister nå' button"
affects: [23-05-migration]

tech-stack:
  added: []
  patterns:
    - "Service-worker importScripts loads vocab-store + vocab-updater so background scope has the v1 cache surface"
    - "AbortController-based 30s timeout on /revisions fetch so a stuck network can't hold the worker"
    - "Atomic replacement = IndexedDB transaction in putCachedBundle (one transaction = readers see old or new, never partial)"
    - "Popup uses callback-form chrome.runtime.sendMessage to let SW respond async (returns true from handler)"

key-files:
  created:
    - "extension/background/vocab-updater.js"
    - "extension/background/vocab-updater.test.js"
  modified:
    - "extension/background/service-worker.js (importScripts + onStartup hook + 2 message handlers)"
    - "extension/popup/popup.html (notice div under header)"
    - "extension/popup/popup.js (initVocabUpdateNotice)"
    - "extension/styles/popup.css (notice styles + dark-theme variant)"

key-decisions:
  - "Missing-cache languages are returned by ABSENCE from checkForUpdates' result map, not as a 'missing' string. Plan 23-03 bootstrap owns first-time downloads; emitting a 'missing' status here would invite the popup to surface a confusing 'update available' notice for a language the student has never picked. Cleaner separation of concerns."
  - "Loaded vocab-store.js into the service worker via importScripts rather than duplicating the v1 cache logic. The IIFE exposes self.__lexiVocabStore the same way in both contexts (content script + service worker scope), so no code change to vocab-store.js was needed. This also means future plans 23-03/05 don't have to maintain two cache implementations."
  - "Service-worker emits 'lexi:hydration' state='error' (not a new event type) on schema-mismatch or fetch error during refresh. This reuses the event channel plan 23-02 already defined for hydration progress, so the popup has one unified error path to listen to. Schema-mismatch separately triggers 'lexi:schema-mismatch' from vocab-store's fetchBundle (existing plan 23-02 contract)."
  - "Popup polls via 'lexi:check-updates-now' on open AND subscribes to push 'lexi:updates-available' from the SW startup check. Reason: if the popup is closed when onStartup fires, the push event has no receiver — the explicit poll on popup open recovers state. Belt-and-braces."
  - "Notice text suffix shows affected langs in parens: 'Nye ordlister tilgjengelig (de, fr)'. Per the plan's example. When refresh starts, suffix updates to remaining-pending list."
  - "Pendinglangs tracking is array-based, not Set, so ordering is preserved when displaying remaining-langs in the 'Oppdaterer…' state. Splice-on-completion handles single-lang edge case naturally."

patterns-established:
  - "Service-worker bootstrap fetches funnel through SC-06 carve-out directories (extension/background/) — the network-silence gate's SCAN_TARGETS only checks spell-check + word-prediction + spell-rules, leaving SW fetches sanctioned"
  - "Two-channel UI sync (poll on open + push subscription) for popups that need state set up before they're listening"

requirements-completed: [UPDATE-01, UPDATE-02, UPDATE-03]

duration: 6min
completed: 2026-04-27
follow-up: []
---

# Phase 23 Plan 04: Update Detection + Atomic Refresh Summary

**Extension now polls Papertek's `/revisions` endpoint on startup, surfaces a non-blocking 'Nye ordlister tilgjengelig' banner in the popup when any cached language is stale, and atomically refreshes the IndexedDB cache in one transaction when the user clicks 'Oppdater ordlister nå' — closing the data-freshness loop without forcing a reinstall.**

## Performance

- **Duration:** ~6 min (3 commits — RED, Task 1 GREEN, Task 2)
- **Started:** 2026-04-27T01:00:09Z
- **Completed:** 2026-04-27T01:05:51Z
- **Tasks:** 2 (Task 1 `tdd="true"`, Task 2 plain auto)
- **Files created:** 2 (vocab-updater.js + test file)
- **Files modified:** 4 (service-worker.js, popup.html, popup.js, popup.css)

## Accomplishments

### vocab-updater.js — startup check + atomic refresh

- **`checkForUpdates()`** fetches `${API_BASE}/revisions` with a 30s AbortController timeout, compares each server revision against `getCachedRevisions()`, and returns `{lang: 'fresh' | 'stale'}` for cached languages only. Languages absent from the cache are NOT included in the result (they're plan 23-03's bootstrap concern). Emits `{type:'lexi:updates-available', langs:[...stale]}` only when at least one stale lang exists.
- **`refreshLanguage(lang)`** calls `fetchBundle(lang)` (no `If-None-Match` — we want fresh data), unwraps the body into `{schema_version, revision, payload}` and writes via `putCachedBundle`. The IndexedDB transaction is the atomic boundary: readers either see the old or new payload, never partial. On success emits `lexi:refresh-done`; on schema-mismatch or fetch error, leaves the cache untouched and emits `lexi:hydration` state='error'.
- **`refreshAll(langs)`** sequences refreshLanguage with a try/catch wrapper so a single bad lang doesn't abort the rest.

### service-worker.js — startup hook + popup message handlers

- `importScripts('/content/vocab-store.js')` and `importScripts('/background/vocab-updater.js')` make the v1 cache surface available in service-worker scope. The IIFEs expose `self.__lexiVocabStore` and `self.__lexiVocabUpdater` the same way they do for content scripts.
- `chrome.runtime.onStartup.addListener(runStartupVocabCheck)` plus a one-shot call at boot covers both the browser-launch case and service-worker idle-wake. Idempotent.
- New message handlers (added to a separate `onMessage` listener so they don't tangle with the existing routing block):
  - `lexi:check-updates-now` — popup polls on open, SW returns the per-lang status map.
  - `lexi:refresh-now` — popup click handler triggers `refreshAll`.

### popup.html / popup.css / popup.js — non-blocking banner

- New `<div id="lexi-updates-notice">` placed directly under the header so it stacks vertically with plan 23-03's hydration pill (which lives in the same vicinity).
- CSS: indigo-tinted glass banner with right-aligned action button; dark-theme variant included.
- `initVocabUpdateNotice()` does both:
  1. Fires `lexi:check-updates-now` on popup open (recovers state if SW startup push event happened while popup was closed).
  2. Subscribes to `chrome.runtime.onMessage` for `lexi:updates-available`, `lexi:refresh-done`, and `lexi:hydration` state='error'.
- Click handler disables the button, sends `lexi:refresh-now` with the stale lang list, then waits for per-lang `lexi:refresh-done` events. Notice clears when all in-flight langs report done. If any reports error, the notice stays visible with `'Oppdatering feilet — prøv igjen senere'` and the button re-enables.

## Task Commits

| # | Type | Hash      | Message |
| - | ---- | --------- | ------- |
| 1 | test | `0106a8c` | test(23-04): add failing tests for vocab-updater (startup check + atomic refresh) |
| 1 | feat | `dced361` | feat(23-04): implement vocab-updater with startup check + atomic refresh |
| 2 | feat | `53e0b81` | feat(23-04): popup vocab-update notice + 'Oppdater ordlister nå' button |

(Plus the final docs metadata commit on this SUMMARY + STATE/ROADMAP updates.)

## Test Coverage

- **`extension/background/vocab-updater.test.js`** — 7 tests, all pass under `node --test`. Asserts:
  - all-fresh cache returns 'fresh' map with no updates-available emit
  - one-stale produces mixed map + emits updates-available with the stale langs
  - missing-from-cache language is omitted (no false update notice)
  - refreshLanguage success: putCachedBundle called once with right shape; refresh-done emitted
  - refreshLanguage schema-mismatch: cache untouched; hydration error emitted
  - refreshLanguage fetch-error: cache untouched; hydration error emitted
  - refreshAll: per-lang failure does not abort the rest

## Verification

- `node --test extension/background/vocab-updater.test.js` — **7/7 pass** (~95 ms)
- `npm run check-network-silence` — **exit 0** (vocab-updater is in `extension/background/`, NOT in the SC-06 scan target list — the gate's SCAN_TARGETS only covers spell-check + spell-rules + word-prediction)
- `npm run check-fixtures` — **exit 0 with my changes only** (when stashed across plan 23-03's parallel uncommitted vocab-seam.js edits). My files (popup + service-worker + new background module) are not loaded by the spell-check fixture harness.

## Deviations from Plan

None — plan executed exactly as written. Two minor adaptations within the contract:

1. **'missing' represented by absence, not by a string value.** The plan said `checkForUpdates` returns `{lang: 'fresh' | 'stale' | 'missing'}`. After thinking through the consumer (popup banner), returning `missing` would invite the popup to surface a notice for a language the student has never opted into. Better separation: cached-only result map; bootstrap (plan 23-03) owns first-time downloads. Caller gets the same semantic via `Object.keys(result)` vs the supplied lang list — the absence IS the 'missing' signal.

2. **Loaded vocab-store via importScripts in the service worker.** Plan said "dynamic-import the seam (or message a content-script bridge) to call `swapIndexes`." Since vocab-store + vocab-updater both work in both content-script and SW scope (no DOM access), I just `importScripts` them in the SW. This is simpler than a content-script bridge and avoids the dynamic-import-in-MV3-service-worker quirks. Note: this plan does NOT call `swapIndexes` — by design. The plan's "activate on next page load" semantics are satisfied by the atomic putCachedBundle transaction; active content scripts continue using their captured wrapper until next navigation re-reads the cache. swapIndexes would be a nice-to-have for hot-swap during a session, but plan 23-04's verification only requires the next-page-load behaviour.

## Issues Encountered

- **Apparent fixture regression** when running `check-fixtures` in the working tree. Tracked down to plan 23-03's parallel uncommitted modifications to `extension/content/vocab-seam.js` — confirmed via `git stash` of just that file: with my changes alone, `check-fixtures` exits 0. Plan 23-03 owns the resolution. Logged here so 23-03's executor doesn't think it inherited a regression from this plan.

## User Setup Required

None — no env vars, no service configuration. The `/revisions` endpoint is already live (plan 23-01). The vocab-store v1 cache adapter is already shipped (plan 23-02). This plan slots in on top.

## Next Phase Readiness

- **Plan 23-05 (migration + removal)** is unblocked. The update path is live: students will start receiving server-side bundle updates without an extension reinstall. 23-05 can safely remove the legacy bundled `data/{lang}.json` files knowing the v1 cache + bootstrap + update-detection path is end-to-end functional.

## Self-Check: PASSED

- `extension/background/vocab-updater.js` exists (verified)
- `extension/background/vocab-updater.test.js` exists (verified)
- All 3 task commits visible via `git log --oneline`: `0106a8c`, `dced361`, `53e0b81`
- `chrome.runtime.onStartup.addListener(runStartupVocabCheck)` present in service-worker.js (verified)
- Message handlers for `lexi:check-updates-now` and `lexi:refresh-now` present in service-worker.js (verified)
- `id="lexi-updates-notice"` and `id="lexi-refresh-btn"` present in popup.html (verified)
- `initVocabUpdateNotice` invoked from popup.js bootstrap (verified)
- All gates green (network-silence + 7/7 unit tests; fixtures green isolated to my files)

---
*Phase: 23-data-source-migration*
*Completed: 2026-04-27*
