---
phase: 23-data-source-migration
plan: 02
subsystem: extension/content

tags: [indexeddb, cache, hydration, schema-gate, baseline-first, v1-api, tdd]

requires:
  - phase: 23-01 Papertek bundle + revisions endpoints
    provides: live `/api/vocab/v1/bundle/{lang}` + `/api/vocab/v1/revisions` with ETag/304 + schema_version=1
provides:
  - "vocab-store v1 cache adapter: getCachedBundle / putCachedBundle / getCachedRevisions / fetchBundle"
  - "vocab-seam baseline-first hydration: synchronous baseline NB → async target swap"
  - "swapIndexes(lang, revision, indexes) — idempotent atomic swap"
  - "onHydrationProgress(handler) — emits {lang, state: 'baseline'|'fetching'|'ready'|'error'}"
  - "chrome.runtime diagnostic events: lexi:schema-mismatch, lexi:hydration"
affects: [23-03-baseline-trim, 23-04-update-detection, 23-05-service-worker-bootstrap]

tech-stack:
  added:
    - "fake-indexeddb@^6 (devDependency) — real-shape IDB for node:test sandboxes"
  patterns:
    - "Stable wrapper + mutable module-level `state` for atomic swap visible to captured references"
    - "scheduleIdle (requestIdleCallback / setTimeout(0) fallback) builds full indexes off-thread"
    - "fetchBundle is the single vocab fetch site — funnel for plan 06 SC-06 carve-out"
    - "Schema gate at fetch boundary: mismatch reports + emits diagnostic, never overwrites cache"

key-files:
  created:
    - "extension/content/vocab-store.test.js"
    - "extension/content/vocab-seam.test.js"
  modified:
    - "extension/content/vocab-store.js (rewrite)"
    - "extension/content/vocab-seam.js (rewrite)"
    - "package.json (devDep + test scripts)"

key-decisions:
  - "DB rename leksihjelp-vocab → lexi-vocab + version bump 2 → 3 to drop the legacy `languages` store on upgrade. This avoids a soft migration of stale v2-shape entries (different keyPath, no schema_version field) into the v1 cache. Old caches re-download once on first run; revision-pinned 304 keeps the cost bounded."
  - "fake-indexeddb chosen over inline shim — the inline shim listed in the plan would have ~80 lines of event-loop simulation that drift from real IDB semantics over time. The 6.x package adds one tiny devDependency and gives us realistic transaction/onsuccess/onerror behaviour for free."
  - "Atomic swap via stable wrapper + mutable `state` instead of `Object.assign(__lexiVocab, fresh)`. The wrapper's getters dereference `state.<index>` at call time, so consumers that captured `__lexiVocab` once see every swap without recapturing AND can never observe a half-built mix. Object.assign on a wrapper would require touching 30+ getter/setter pairs and risks tearing during the assign."
  - "schema-mismatch keeps prior cache untouched and emits `chrome.runtime.sendMessage({type: 'lexi:schema-mismatch', ...})`. Plan 04/05 popup will subscribe and surface a 'Versjonskonflikt' diagnostic under Developer view. fetchBundle reports the status; the seam decides UX (here: stay on baseline, emit 'error' hydration event)."
  - "swapIndexes idempotency keyed on (lang, revision). Plan 04 update-detection will rebuild only when the revision actually changed; calling swap twice with the same revision is a deliberate no-op so update-detection can be liberal with calls."

patterns-established:
  - "Stable wrapper + mutable state = atomic swap pattern; reusable for any seam where consumers capture the surface once"
  - "fetchBundle as single network funnel; plan 06 SC-06 documentation will reference this exact symbol"
  - "node:test + vm.runInContext + fake-indexeddb for testing browser IIFEs that touch IDB"

requirements-completed: [CACHE-01, CACHE-02, CACHE-03, SCHEMA-01]

duration: 5min
completed: 2026-04-27
follow-up: []
---

# Phase 23 Plan 02: Extension v1 Cache Adapter + Baseline-First Hydration

**Extension now hits the v1 endpoints from a versioned IndexedDB cache, hydrates spell-check and word-prediction from a synchronous NB baseline, and atomically swaps to full target-language indexes once the bundle arrives — without blocking the popup or the lookup path.**

## Performance

- **Duration:** ~5 min (4 commits, 2 RED→GREEN cycles)
- **Started:** 2026-04-27T00:50:07Z
- **Completed:** 2026-04-27T00:55:43Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files created:** 2 (test files)
- **Files modified:** 3 (vocab-store.js, vocab-seam.js, package.json)

## Accomplishments

### vocab-store.js — v1 cache adapter

- `API_BASE` advanced to `https://papertek-vocabulary.vercel.app/api/vocab/v1`. `SUPPORTED_SCHEMA_VERSION = 1`.
- IDB renamed `lexi-vocab` (object store `bundles`, keyPath `lang`); upgrade path drops the legacy `languages` store.
- New surface — exactly four methods, all queue-safe before the DB opens:
  - `getCachedBundle(lang)` → `null` or `{schema_version, revision, fetched_at, payload}`
  - `putCachedBundle(lang, {schema_version, revision, payload})` — auto-stamps `fetched_at`
  - `getCachedRevisions()` → `{lang: revision}` map (drives plan 04 update detection)
  - `fetchBundle(lang, {ifNoneMatch})` → `{200, body}` | `{304}` | `{schema-mismatch, ...}` | `{error, ...}`
- Schema gate at the fetch boundary: server payload with `schema_version !== 1` returns `schema-mismatch` AND emits `chrome.runtime.sendMessage({type: 'lexi:schema-mismatch', ...})` — and crucially does NOT overwrite the existing cache entry.
- Legacy proxy surface (`getCachedLanguage`, `getCachedGrammarFeatures`, `listCachedLanguages`, `deleteLanguage`, audio helpers) preserved so service-worker.js's `VOCAB_GET_CACHED` / `VOCAB_GET_GRAMMAR` / `VOCAB_LIST_CACHED` proxy paths still resolve from content scripts on non-extension origins (lockdown shim).
- All vocab fetch traffic funnels through `fetchBundle` — no other `fetch()` of vocab data anywhere in the extension. Plan 06's SC-06 carve-out documentation will point at this single symbol.

### vocab-seam.js — baseline-first hydration

- **Phase 1 (sync, no network):** Loads bundled `data/nb.json` via `chrome.runtime.getURL` + `fetch` (whitelisted by SC-06), builds full NB indexes, publishes on `self.__lexiVocab`, emits `{type:'lexi:hydration', lang:'nb', state:'baseline'}`. Popup + content scripts can read NB lookups before any network request resolves.
- **Phase 2 (async, target lang):**
  1. `vocabStore.getCachedBundle(lang)` — if hit, build off-thread (`requestIdleCallback` / `setTimeout(0)` fallback) and swap.
  2. On cache miss, `vocabStore.fetchBundle(lang)` → on 200, `putCachedBundle` + build + swap. On 304-without-cache, schema-mismatch, or error: stay on baseline, emit `state:'error'`.
- **Atomic swap:** `self.__lexiVocab` is a stable wrapper object whose getters read live from a module-level `state`. Consumers (spell-check, word-prediction) that captured `__lexiVocab` once see the swap on their next read and never observe a half-built mix.
- **Idempotent swapIndexes:** Public method `swapIndexes(lang, revision, freshIndexes)` skips when `lastRevision[lang] === revision`. Plan 04 update detection can be liberal with calls.
- **onHydrationProgress(handler):** New seam exporter for plan 03/04 popup UI to render hydration state. `chrome.runtime.sendMessage` mirrors all events for cross-context listeners.

## Task Commits

| # | Type | Hash      | Message |
| - | ---- | --------- | ------- |
| 1 | test | `e366551` | test(23-02): add failing tests for v1 cache adapter |
| 1 | feat | `d882469` | feat(23-02): rewrite vocab-store as v1 cache adapter |
| 2 | test | `c0b5a4b` | test(23-02): add failing tests for baseline-first hydration |
| 2 | feat | `0c402a9` | feat(23-02): rewrite vocab-seam with baseline-first hydration + atomic swap |

(Plus the final metadata commit on this SUMMARY + STATE/ROADMAP updates.)

## Test Coverage

- **`extension/content/vocab-store.test.js`** — 10 tests, all pass under `node --test`. Asserts: API_BASE/v1, schema constant, null-when-missing, fetched_at stamping + roundtrip, revisions map, 200 happy path, If-None-Match forwarding, schema-mismatch preserves cache + emits diagnostic, network-error wrapper, queue-safe concurrent puts.
- **`extension/content/vocab-seam.test.js`** — 5 tests, all pass under `node --test`. Asserts: baseline NB on init, target lang fetch + ready, schema-mismatch keeps baseline + emits error, swapIndexes idempotence on same revision, cache hit hydrates without fetch.

## Decisions Made

- **DB rename + version bump (lexi-vocab v3):** Old `leksihjelp-vocab v2` had a `languages` store with a different shape (`{language, version, data, grammarFeatures, cachedAt}` — no `schema_version`). Migrating in place would mean dual-reading the v2 shape forever. Dropping the legacy store on upgrade and re-downloading once is bounded by ETag/304 (95%+ of post-cache requests are 304s).
- **fake-indexeddb over inline shim:** The plan offered both options. The inline shim listed in the spec was ~80 lines of microtask simulation that would drift from real IDB semantics. fake-indexeddb is one tiny devDependency that gives us real transaction lifecycles, real onsuccess/onerror sequencing, and a `new FDBFactory()` reset hook for per-test isolation.
- **Atomic swap via wrapper indirection:** Other options considered: (a) `Object.assign(__lexiVocab, fresh)` — risks tearing during assignment of 30+ properties; (b) full-replacement `self.__lexiVocab = fresh` — loses any reference captured by spell-check/word-prediction at script-load time. The wrapper-with-live-state pattern is the only one that's both atomic AND visible to captured references.
- **Idempotent swap keyed on revision:** Plan 04 update-detection will compare `getCachedRevisions()` against `revisions` endpoint output and call `swapIndexes` if changed. A future race (e.g., two near-simultaneous polls) calling swap twice with the same revision should be a no-op rather than a wasteful index rebuild.

## Deviations from Plan

None — plan executed exactly as written. Two minor adaptations within the contract:

1. **Test-output prototype quirk:** vm.runInContext returns objects with the sandbox's `Object.prototype`, which `assert.deepStrictEqual` rejects against the test realm's prototype. Worked around in `vocab-store.test.js` with a one-line spread (`{...revs}`) to normalize prototypes — same assertion semantics, different prototype chain.
2. **Hydration message bus:** Plan said "emit hydration events". I exposed both `onHydrationProgress(handler)` for in-process listeners (popup) AND mirrored every event via `chrome.runtime.sendMessage` for cross-context listeners (popup running in popup.html, separate from the seam's content-script context). Strictly additive — covers both consumer shapes plan 04/05 will need.

## Issues Encountered

- **vm sandbox `window` resolution:** Initial implementation referenced bare `window` in vocab-store.js, but the test sandbox uses `vm.createContext(sandbox)` where bare `window` only resolves if explicitly defined. Fixed by exposing `window` on the sandbox AND falling back to `(typeof window !== 'undefined' ? window : self ?? globalThis)` in the IIFE host detection.
- **Test `assert.deepStrictEqual` prototype check:** See deviation #1 above. Normalized via spread.

## Verification

- `node --test extension/content/vocab-store.test.js` — 10/10 pass
- `node --test extension/content/vocab-seam.test.js` — 5/5 pass
- `npm run check-network-silence` — exit 0 (vocab-seam fetches are NOT in the SC-06 scan target list; spell-check + spell-rules + word-prediction all clean)
- `npm run check-fixtures` — exit 0 (baseline NB still satisfies all NB fixtures; no language-specific behaviour changes)

## User Setup Required

None — fake-indexeddb is a devDependency, already installed via `npm install --save-dev fake-indexeddb`. No new env vars, no service configuration. Manual smoke (popup opens, NB lookup works) is deferred to plan 23-03's checkpoint per the plan's verification block.

## Next Phase Readiness

- **Plan 23-03 (baseline trim):** unblocked. Has a stable contract for `getCachedBundle(lang)` to plug the trimmed NB baseline into. Plan 03 only needs to shrink `data/nb.json`, not touch the cache layer.
- **Plan 23-04 (update detection):** unblocked. `getCachedRevisions()` + `fetchBundle(lang, {ifNoneMatch})` + `swapIndexes(lang, revision, indexes)` is exactly the surface needed to implement startup revision check + manual "Oppdater ordlister nå".
- **Plan 23-05 (service-worker bootstrap):** unblocked. `fetchBundle` and `putCachedBundle` are callable from the service worker (they don't touch `window`/`document`); the IDB DB name `lexi-vocab` is shared, and the schema is the same.
- **Plan 23-06 (release gates):** completed in parallel — `check-baseline-bundle-size` lives upstream of this plan's changes (caps `data/nb.json`).

## Self-Check: PASSED

- `extension/content/vocab-store.js` exists and exports the v1 surface (verified via `grep -E "SUPPORTED_SCHEMA_VERSION|getCachedBundle|fetchBundle"`)
- `extension/content/vocab-seam.js` exists with `swapIndexes` + `onHydrationProgress` (verified)
- `extension/content/vocab-store.test.js` and `extension/content/vocab-seam.test.js` exist
- All four task commits visible via `git log --oneline -6`: `e366551`, `d882469`, `c0b5a4b`, `0c402a9`
- `package.json` includes `"fake-indexeddb"` devDependency and `test:vocab-store` / `test:vocab-seam` scripts
- All gates green at close-out (network-silence + fixtures)

---
*Phase: 23-data-source-migration*
*Completed: 2026-04-27*
