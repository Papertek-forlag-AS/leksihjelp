---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Data-Source Migration
status: in_progress
last_updated: "2026-04-27T00:55:43Z"
last_activity: 2026-04-27 — Plan 23-02 closed; CACHE-01/CACHE-02/CACHE-03/SCHEMA-01 satisfied
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 6
  completed_plans: 3
---

# Session State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.
**Current focus:** v3.0 Data-Source Migration — plan 23-01 complete (Papertek bundle + revisions endpoints live)

## Position

**Milestone:** v3.0 Data-Source Migration
**Phase:** 23 (in progress — Data-Source Migration)
**Plan:** 03 (next — baseline trim); 02/06 complete; 04/05 still pending
**Status:** Plans 23-01 + 23-02 + 23-06 complete; cache adapter + baseline-first hydration live alongside the release gates and v1 endpoints. 23-03 (baseline trim) is unblocked.
**Last activity:** 2026-04-27 — Plan 23-02 closed; CACHE-01/CACHE-02/CACHE-03/SCHEMA-01 satisfied

### Progress
```
Phases: [.] 0/1
Plans:  [###...] 3/6
```

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~6.7 min
- Total execution time: 0.33 hours

| Plan  | Duration | Tasks | Files | Date       |
| ----- | -------- | ----- | ----- | ---------- |
| 23-01 | 12 min   | 3     | 5     | 2026-04-27 |
| 23-06 | 3 min    | 2     | 6     | 2026-04-27 |
| 23-02 | 5 min    | 2     | 5     | 2026-04-27 |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

v3.0-specific commitments (carried from milestone definition, will be promoted into the table on completion):
- Storage: IndexedDB (avoids `unlimitedStorage` permission and stricter Web Store review)
- Bootstrap UX: tiny NB baseline (~100 KB cap) bundled + background download for full data
- Update detection: startup revision check + manual "Oppdater ordlister nå" button
- SC-06: service-worker bootstrap path is the sanctioned exception; spell-check + word-prediction stay network-silent
- Lockdown bootstrap: out of scope; deliver documented adapter contract only

Plan 23-01 decisions:
- Revision format: `YYYY-MM-DD-<sha256-hex8>` over sorted `*bank.json` files; same helper used by both bundle and revisions endpoints so they cannot drift
- Schema 1 with forward-compat empty stubs (freq/bigrams/falseFriends/senses/typobank) — plans 23-03/04 populate without a schema bump
- Function-level `res.setHeader('Access-Control-Allow-Origin', origin)` overrides repo-wide `*` from `vercel.json` — explicit allow-list (chrome-extension://*, leksihjelp.no, localhost:3000) without disturbing other v1/v3 endpoints
- Plan 23-01 Task 4 follow-up (added 2026-04-27): pre-gzip bundle responses with module-cached buffers per `(language, revision)`. Drops de wire size 4.45 MB → 795 KB. Chosen over the originally-deferred "streaming or split-fields" approach because pre-gzip is a smaller, more local fix that doesn't change the bundle contract; plans 23-03/04 inherit a payload with ~3.7 MB of headroom rather than ~30 KB. Function-layer `Accept-Encoding: identity` fallback is a known platform-quirk no-op (Vercel edge re-gzips), documented inline.
- [Phase 23]: Plan 23-06: Skip-when-absent gate semantics for check-baseline-bundle-size — gate exits 0 with SKIP marker when extension/data/nb-baseline.json not yet built (pre-plan-23-03), becomes meaningful once 23-03 lands. Avoids blocking wave 2 plans on an artifact only 23-03 produces.
- [Phase 23]: Plan 23-06: SC-06 sanctioned bootstrap carve-out enforced by both header documentation in check-network-silence.js AND self-test that plants fetch() in extension/background/vocab-bootstrap.js asserting gate stays green. Belt-and-braces guards against silent scan-set drift.

Plan 23-02 decisions:
- IDB rename leksihjelp-vocab → lexi-vocab (v3) with legacy `languages` store dropped on upgrade. Old caches re-download once; ETag/304 keeps the cost bounded. Avoids dual-shape support forever.
- fake-indexeddb (devDependency) chosen over the inline shim option — one tiny package gives realistic transaction lifecycles and per-test reset via `new FDBFactory()`.
- Atomic swap implemented via stable wrapper + mutable module-level `state`; getters dereference live so consumers that captured `__lexiVocab` once see every swap and never observe a half-built state. swapIndexes(lang, revision, indexes) idempotent on revision so plan 04 update detection can be liberal with calls.
- Schema gate at fetch boundary: `schema_version !== 1` returns `schema-mismatch` AND emits `chrome.runtime.sendMessage({type: 'lexi:schema-mismatch', ...})` AND preserves the existing cache. Plan 04/05 popup will surface this as "Versjonskonflikt" under Developer view.
- All vocab fetches funnel through `fetchBundle` — single symbol for plan 06's SC-06 carve-out documentation to reference.

### Pending Todos

None.

### Blockers/Concerns

- ~~Phase 23 (Papertek API endpoints) is sibling-repo work — coordinate with `papertek-vocabulary` deploy before extension can integrate~~ **Resolved by plan 23-01: bundle + revisions endpoints live, verified 2026-04-27**
- ~~De bundle response at 4.49 MiB (production), ~30 KB under Vercel's 4.5 MiB cap~~ **Resolved 2026-04-27 by plan 23-01 Task 4 follow-up: pre-gzip + HEAD fix drops de wire size to ~795 KB. Sibling commits `db576df8` + `99d19a98`. See `23-01-SUMMARY.md` "Follow-up: Task 4".**
- VERIF-01 (browser visual verification) carried across 3 milestones — consider ad-hoc resolution alongside v3.0 work
- Version skew: package.json=2.5.0 vs manifest.json=2.4.1 vs index.html=2.4.1 — align before v3.0 release

## Session Continuity

Last session: 2026-04-27
Stopped at: Completed 23-02-PLAN.md (v1 cache adapter + baseline-first hydration)
Resume file: .planning/phases/23-data-source-migration/23-03-PLAN.md
