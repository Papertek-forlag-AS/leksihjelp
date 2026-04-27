---
phase: 23-data-source-migration
plan: 01
subsystem: api

tags: [vercel, serverless, cors, etag, caching, papertek-vocabulary, esm]

requires:
  - phase: papertek-vocabulary v3 export endpoint
    provides: per-language lexicon/banks/core directory layout reused by buildBundle
provides:
  - "GET /api/vocab/v1/bundle/{language} — full per-language payload + {schema_version, revision}"
  - "GET /api/vocab/v1/revisions — small {language: revision} map for cheap polling"
  - "Shared CORS helper (lib/_cors.js) echoing chrome-extension://* + leksihjelp.no + localhost:3000"
  - "Shared bundle/revision module (lib/_bundle.js) so the two endpoints cannot drift"
affects: [23-02-cache-adapter, 23-03-freq-bigrams, 23-04-false-friends-senses, 23-05-extension-integration, lockdown-bootstrap]

tech-stack:
  added: []
  patterns:
    - "Function-level setHeader overrides repo-wide vercel.json '*' Allow-Origin"
    - "Revision = SHA-256(concat sorted bank files), 8 hex chars, YYYY-MM-DD prefix"
    - "Forward-compat empty defaults (freq/bigrams/falseFriends/senses/typobank) to avoid schema bumps when plans 23-03/04 land"

key-files:
  created:
    - "../papertek-vocabulary/lib/_cors.js"
    - "../papertek-vocabulary/lib/_bundle.js"
    - "../papertek-vocabulary/api/vocab/v1/bundle/[language].js"
    - "../papertek-vocabulary/api/vocab/v1/revisions.js"
    - ".planning/phases/23-data-source-migration/deferred-items.md"
  modified: []

key-decisions:
  - "Revision derivation: SHA-256(concat of sorted *bank.json files), truncated to 8 hex, prefixed with UTC date for human readability — same function used by both endpoints so they cannot drift"
  - "Emit forward-compat empty stubs for freq/bigrams/falseFriends/senses/typobank now so plan 23-02 can integrate against the final shape without a schema bump when 23-03/04 populate them"
  - "Function-level CORS overrides the repo-wide wildcard from vercel.json — explicit Origin echo is friendlier to stricter Web Store reviews than '*'"
  - "Lang directory resolution order: lexicon/ → banks/ → core/ (matches v1 core endpoint convention)"

patterns-established:
  - "Shared lib/ module backing two endpoints prevents revision drift between bundle and revisions"
  - "Empty-default schema fields used as forward-compat seams for incremental data plans"

requirements-completed: [API-01, API-02, API-03]

duration: 12min
completed: 2026-04-27
follow-up:
  - "Task 4 (pre-gzip + HEAD fix) added 2026-04-27 — sibling commits db576df8 + 99d19a98. Drops de wire size from 4.49 MiB to ~795 KB and clears the Vercel 4.5 MB cap concern entirely."
---

# Phase 23 Plan 01: Papertek Bundle + Revisions API Summary

**Two new Papertek serverless endpoints (bundle + revisions) live at `papertek-vocabulary.vercel.app/api/vocab/v1/...` with ETag/304, OPTIONS preflight, and an explicit chrome-extension/leksihjelp.no CORS allow-list — unblocking plans 23-02 through 23-05.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-26T23:49:49Z
- **Completed:** 2026-04-26T23:55:00Z (approx; deploy + verification window)
- **Tasks:** 3 (2 code, 1 deploy-verify checkpoint)
- **Files created:** 4 (sibling repo) + 1 (this repo)

## Accomplishments

- `GET /api/vocab/v1/bundle/{language}` returns the full per-language payload (all banks + grammarFeatures + forward-compat freq/bigrams/falseFriends/senses/typobank) plus `{schema_version, revision}`. Verified live for all six languages (nb, nn, de, es, fr, en).
- `GET /api/vocab/v1/revisions` returns a 6-entry `{language: revision}` map for cheap polling. Sub-2 KB payload.
- Shared CORS helper echoes whitelisted origins (`chrome-extension://*`, `https://leksihjelp.no`, `http://localhost:3000`), sets `Vary: Origin` to keep CDN caches honest, and short-circuits OPTIONS preflight with `204`.
- ETag/304 contract works end-to-end: `If-None-Match: "<revision>"` returns 304 with no body; otherwise 200 with `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.

## Task Commits

All commits are in the sibling repo `/Users/geirforbord/Papertek/papertek-vocabulary` on `main`:

1. **Task 1: Shared CORS helper** — `6b90d778` (feat)
2. **Task 2: Bundle + revisions endpoints + shared module** — `4d072394` (feat)
3. **Task 3: Deploy + human verification** — no code commit; verified live on `papertek-vocabulary.vercel.app`

**Plan metadata (this repo):** see final commit on `.planning/...` after this summary lands.

## Files Created/Modified

In `/Users/geirforbord/Papertek/papertek-vocabulary` (sibling repo):

- `lib/_cors.js` — Shared CORS helper. Whitelist regex + Set; sets Allow-Methods/Allow-Headers/Max-Age/Vary unconditionally; echoes Allow-Origin only for whitelisted origins; returns `true` after `204` preflight so handlers exit early.
- `lib/_bundle.js` — Shared per-language bundle assembly + revision derivation. Resolves language directory in lexicon → banks → core order; emits all required banks (with empty defaults for missing ones); reads `grammarFeatures` from `vocabulary/lexicon/grammar-features.json` (falls back to `vocabulary/grammar-features.json`); exports `SCHEMA_VERSION`, `SUPPORTED_LANGUAGES`, `buildBundle`, `computeRevision`, `computeAllRevisions`.
- `api/vocab/v1/bundle/[language].js` — GET endpoint. Handles preflight via `applyCors`; rejects non-GET with 405; rejects unknown language with 404; computes revision first to short-circuit 304 cheaply; sets `ETag` and `Cache-Control: public, max-age=300, stale-while-revalidate=86400`.
- `api/vocab/v1/revisions.js` — GET endpoint. Same CORS/method handling; returns `{schema_version, revisions}`; uses shorter `Cache-Control: public, max-age=60, stale-while-revalidate=300` because this is the polling hot-path.

In this repo (leksihjelp):

- `.planning/phases/23-data-source-migration/deferred-items.md` — Logs the de-bundle size flag (4.49 MiB on production, near Vercel's 4.5 MiB cap) for plan 23-03 attention.

## Decisions Made

- **Revision derivation:** `YYYY-MM-DD-<hex8>` where hex is SHA-256 over sorted `*bank.json` files. Date prefix is human-readable; hex catches content drift; same helper used by both endpoints so they never disagree.
- **Schema 1 with forward-compat stubs:** Bundles include `freq`, `bigrams`, `falseFriends`, `senses`, `typobank` as empty defaults. Plans 23-03/04 populate them without a schema bump — the cache adapter (plan 23-02) can be written against the final shape today.
- **Function-level CORS overrides repo-wide wildcard:** `vercel.json` sets `Access-Control-Allow-Origin: *` for `/api/vocab/(.*)`. Our endpoints set Allow-Origin explicitly via `res.setHeader`, which takes precedence at the function layer. We deliberately did NOT change `vercel.json` — other v1/v3 endpoints still want the permissive wildcard.
- **Directory resolution order (lexicon → banks → core):** Mirrors the existing v1 core endpoint so we never reach a different language directory than the rest of the API.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated an ESM-vs-CJS verification mismatch (its automated `node -e "require(...)"` doesn't work in this `"type": "module"` repo); I substituted `node --input-type=module` import-and-assert checks with the same intent (verify default export is a function). No code changes from this — purely a verification-tooling adaptation.

## Issues Encountered

- The plan's `<verify>` blocks used CommonJS `require()` syntax, but `papertek-vocabulary/package.json` is `"type": "module"`. Resolved by running equivalent ESM `import()` checks. Not a deviation — the assertions made are identical (default export is a function); the plan author just didn't notice the sibling repo is ESM.
- **De bundle size at 4.49 MiB on production** — verified via curl `Content-Length`. Sits ~30 KB under Vercel's 4.5 MiB serverless body limit. Adding freq/bigrams in plan 23-03 will likely push it over. Mitigation logged in `deferred-items.md`: switch the bundle endpoint to streaming (matching v3 export's `res.write()` pattern), or split heavy fields into a sibling endpoint.

## User Setup Required

None - no environment variables or external service configuration. Both endpoints are public read-only and use existing Vercel infrastructure on `papertek-vocabulary.vercel.app`.

## Next Phase Readiness

- **Plan 23-02 (extension cache adapter)** is unblocked. The endpoints are live, the response shape is final, and ETag/304 works for cheap revalidation.
- **Plan 23-03 (freq/bigrams)** must remember the de bundle size flag — see `deferred-items.md`.
- **Plan 23-04 (falseFriends/senses)** populates fields that already exist in the schema; no contract change needed.
- **Plan 23-05 (extension integration)** depends on plan 23-02 landing first; no direct dependency on this plan beyond the live URLs.

## Self-Check: PASSED

- `lib/_cors.js` exists in sibling repo (commit `6b90d778`).
- `lib/_bundle.js`, `api/vocab/v1/bundle/[language].js`, `api/vocab/v1/revisions.js` exist in sibling repo (commit `4d072394`).
- Both commits visible via `git log --oneline -3` in `/Users/geirforbord/Papertek/papertek-vocabulary`.
- `.planning/phases/23-data-source-migration/deferred-items.md` exists in this repo.
- All four production curl checks passed (CORS echo, revisions payload, bundle key list, OPTIONS preflight).

---

## Follow-up: Task 4 — Pre-gzip bundle responses (added 2026-04-27)

### Why this was added after close-out

The original close-out flagged the de bundle at 4.49 MiB on the wire — only ~30 KB under Vercel's 4.5 MiB serverless body cap — and deferred the mitigation to plan 23-03 (under "switch to streaming or split heavy fields"). On reflection that was the wrong place for it: plan 23-03 adds data (freq, bigrams) that *grows* the bundle, so deferring meant 23-03 would inherit a near-overflowed payload before it could even start. Pre-gzipping at the response layer is a smaller, more local fix that buys ~5× headroom for free, so we re-opened 23-01 with Task 4 + Task 5 rather than letting 23-03 carry the risk.

### What was built

**Sibling repo (`papertek-vocabulary`):**

- `lib/_bundle.js` — added `buildGzippedBundle(language)` (module-cached per `(lang, revision)` so warm Vercel invocations skip recompression) and `clientAcceptsGzip(headerValue)` (RFC-tolerant Accept-Encoding parser handling `q=0`, wildcard, whitespace, `identity`).
- `api/vocab/v1/bundle/[language].js`:
  - 304 short-circuit runs **before** compression (cache hits stay cheap).
  - When client advertises gzip → returns gzipped buffer with `Content-Encoding: gzip`, explicit `Content-Length`, cached ETag.
  - When client doesn't → returns raw JSON (function-layer fallback; see "known quirk" below).
  - **HEAD support** restored (regression from the initial pre-gzip commit) — same headers as GET, no body, per RFC 7231 §4.3.2.

### Compression results (all 6 languages, measured locally)

| Language | Raw     | Gzipped | Ratio  |
| -------- | ------- | ------- | ------ |
| nb       | 3.48 MB | 752 KB  | 21.1%  |
| nn       | 4.02 MB | 892 KB  | 21.7%  |
| **de**   | 4.45 MB | **795 KB**  | **17.4%**  |
| es       | 2.87 MB | 573 KB  | 19.5%  |
| fr       | 2.68 MB | 541 KB  | 19.8%  |
| en       | 2.73 MB | 592 KB  | 21.1%  |

Live on `papertek-vocabulary.vercel.app`: de measured at **808,065 bytes** (matches local within rounding) with transparent decompression yielding identical 4,708,747 bytes to uncompressed. ~3.7 MB of headroom under the 4.5 MB cap — plans 23-03 (freq + bigrams, ~150 KB compressed worst case) and 23-04 (falseFriends + senses) fit easily.

### Task 4 commits (sibling repo)

1. `db576df8` — `feat(23-01): pre-gzip bundle responses to clear Vercel 4.5 MB cap` (initial pre-gzip + module cache + AE parser)
2. `99d19a98` — `fix(23-01): allow HEAD on bundle endpoint (regression from pre-gzip)` (HEAD method support + Vercel-edge-compression note)

### Live verification (post-deploy)

| Check | Expectation | Result |
| ----- | ----------- | ------ |
| Wire size de + gzip | <1 MB | **808,065 bytes** ✓ |
| Transparent decompression | gzip-decoded == uncompressed bytes | **4,708,747 == 4,708,747** ✓ |
| ETag round-trip | `If-None-Match` → 304 | ✓ |
| CORS | `Access-Control-Allow-Origin: https://leksihjelp.no` | ✓ |
| HEAD (after fix commit) | 200 + headers, no body | ✓ |

### Deviations / known quirks

- **Vercel edge auto-gzip overrides our `identity` fallback.** The function-layer logic correctly returns raw JSON when the client sends `Accept-Encoding: identity`, but Vercel's edge layer re-compresses the response before sending it on the wire. We can't suppress this from a serverless handler. Real browsers and the leksihjelp extension always send `Accept-Encoding: gzip` so this is harmless in practice; the function-level fallback exists primarily for mock-request unit tests and HEAD probes that bypass the edge. Documented inline in `bundle/[language].js`.
- **HEAD regression** (introduced and fixed within Task 4 itself, not a deferred issue). The first pre-gzip commit tightened the method check to GET-only, breaking `curl -sSI` probes used by our verification scripts. Caught by user in the live verification round; fixed in commit `99d19a98` before close-out.

### Resolved blockers / deferred items

- **De bundle size at 4.49 MiB** (logged in `.planning/phases/23-data-source-migration/deferred-items.md` and STATE.md "Blockers/Concerns"): **resolved by pre-gzip**. Cleared from both files in the close-out commit for this follow-up.

---
*Phase: 23-data-source-migration*
*Completed: 2026-04-27 (initial), Task 4 follow-up: 2026-04-27*
