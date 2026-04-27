# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15.1 (shipped 2026-04-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Compound Decomposition & Polish** — Phases 16–19 (shipped 2026-04-26) — [archive](milestones/v2.1-ROADMAP.md)
- ✅ **v2.2 Student Language Intelligence** — Phases 21–22 + 21.1/21.2 decimal inserts (shipped 2026-04-27) — [archive](milestones/v2.2-ROADMAP.md)
- 🚧 **v3.0 Data-Source Migration** — Phase 23 (in progress)

## Phases

<details>
<summary>✅ v1.0 Spell-Check & Prediction Quality (Phases 1-5 + decimal inserts) — SHIPPED 2026-04-21</summary>

- [x] Phase 1: Foundation — Vocab Seam + Regression Fixture (3/3 plans) — completed 2026-04-18
- [x] Phase 2: Data Layer — Frequency, Bigrams, Typo Bank (5/5 plans) — completed 2026-04-18
- [x] Phase 02.1: Close SC-4 Bundle-Size Cap (INSERTED) (2/2 plans) — completed 2026-04-19
- [x] Phase 3: Rule Architecture & Ranking Quality (5/5 plans) — completed 2026-04-20
- [x] Phase 03.1: Close SC-01 Browser Wiring (INSERTED) (1/1 plan) — completed 2026-04-20
- [x] Phase 4: False-Positive Reduction on NB/NN (3/3 plans) — completed 2026-04-20
- [x] Phase 5: Student Experience Polish (5/5 plans) — completed 2026-04-20
- [x] Phase 05.1: Close UX-01 Gaps from Phase 5 Smoke Test (INSERTED) (5/5 plans) — completed 2026-04-21

See: `.planning/milestones/v1.0-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.0 Depth of Coverage — Grammar Governance Beyond Tokens (Phases 6-15.1) — SHIPPED 2026-04-25</summary>

- [x] Phase 6: Structural Infrastructure + Register & Stylistic Polish (3/3 plans) — completed 2026-04-24
- [x] Phase 7: Word-Order Violations NB + DE + FR (4/4 plans) — completed 2026-04-24
- [x] Phase 8: DE Case & Agreement Governance (3/3 plans) — completed 2026-04-24
- [x] Phase 9: ES ser/estar, por/para, Personal "a" (3/3 plans) — completed 2026-04-25
- [x] Phase 10: FR Elision, Auxiliary, Participe Passe 10.3a (3/3 plans) — completed 2026-04-25
- [x] Phase 11: Aspect & Mood ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 12: Pronoun & Pro-Drop ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 13: Register Drift Within a Document (3/3 plans) — completed 2026-04-25
- [x] Phase 14: Morphology Beyond Tokens EN + ES/FR (3/3 plans) — completed 2026-04-25
- [x] Phase 14.1: Vocab-Seam Browser Wiring (GAP CLOSURE) (1/1 plan) — completed 2026-04-25
- [x] Phase 15: Collocations at Scale NB + DE + FR + ES (1/1 plan) — completed 2026-04-25
- [x] Phase 15.1: Fixture Gate Triage (GAP CLOSURE) (1/1 plan) — completed 2026-04-25

See: `.planning/milestones/v2.0-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.1 Compound Decomposition & Polish (Phases 16-19) — SHIPPED 2026-04-26</summary>

- [x] Phase 16: Decomposition Engine (2/2 plans) — completed 2026-04-26
- [x] Phase 17: Compound Integration (6/6 plans) — completed 2026-04-26
- [x] Phase 18: Spell-Check Polish (2/2 plans) — completed 2026-04-26
- [x] Phase 19: NB/NN Passiv-s Detection (3/3 plans) — completed 2026-04-26
- [ ] Phase 20: Browser Visual Verification — deferred (VERIF-01)

See: `.planning/milestones/v2.1-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.2 Student Language Intelligence (Phases 21-22 + decimal inserts) — SHIPPED 2026-04-27</summary>

- [x] Phase 21: Dictionary Intelligence — False Friends + Preposition Polysemy (2/2 plans) — completed 2026-04-26
- [x] Phase 21.1: Fix Dictionary Intelligence Data Pipeline (GAP CLOSURE) (1/1 plan) — completed 2026-04-26
- [x] Phase 21.2: Dictionary Intelligence Data Fixes (GAP CLOSURE) (1/1 plan) — completed 2026-04-26
- [x] Phase 22: å/og Confusion Detection (1/1 plan) — completed 2026-04-26

See: `.planning/milestones/v2.2-ROADMAP.md` for full phase detail and success criteria.

</details>

### 🚧 v3.0 Data-Source Migration (Phase 23) — IN PROGRESS

- [x] **Phase 23: Data-Source Migration** — Strip bundled vocab from extension; fetch from Papertek API once + cache in IndexedDB; bootstrap, update detection, schema versioning, migration, gate adjustments — all in one consolidated phase (completed 2026-04-27)

## Phase Details

### Phase 23: Data-Source Migration
**Goal**: Migrate the extension's vocabulary from bundled JSON files to a Papertek-API-fetched IndexedDB cache, preserving offline-first behavior via a tiny NB baseline and atomic update mechanics — while existing v2.x users transition silently and the network-silence gate documents the sanctioned bootstrap exception.
**Depends on**: Nothing (consolidates all v3.0 work)
**Requirements**: API-01, API-02, API-03, CACHE-01, CACHE-02, CACHE-03, SCHEMA-01, BOOT-01, BOOT-02, BOOT-03, GATES-01, GATES-02, UPDATE-01, UPDATE-02, UPDATE-03, MIGRATE-01
**Success Criteria** (what must be TRUE):
  1. **API endpoints live in papertek-vocabulary** — `GET /api/vocab/v1/bundle/{language}` returns the full per-language payload (all banks + freq + bigrams + grammar features + falseFriends + senses) plus `{schema_version, revision}` metadata in one response; `GET /api/vocab/v1/revisions` returns a small `{language: revision}` map; both endpoints CORS-allowed for `chrome-extension://...` and `https://leksihjelp.no`
  2. **IndexedDB is the runtime data source** — Each cached language entry persists with `{schema_version, revision, fetched_at}`; `__lexiVocab` / `buildIndexes` reads from IndexedDB first, falls back to bundled NB baseline; spell-check + word-prediction operate on baseline indexes during async hydration and swap to full indexes once ready (no force-reload); schema_version mismatch preserves prior cache and surfaces "Versjonskonflikt" diagnostic
  3. **First lookup works offline immediately on install** — Bundled NB baseline ≤ 200 KB (top-2k Zipf, common typos, pronouns/articles); on first install, service worker auto-downloads selected target language(s) into IndexedDB without blocking the popup; popup surfaces per-language progress, success state, and "Ordlister utilgjengelig — prøv igjen senere" on failure (baseline NB still functional)
  4. **Update detection + manual refresh** — On extension startup, service worker calls updates-check endpoint and compares per-language revision against cache; when an update is available, popup shows a non-blocking "Nye ordlister tilgjengelig" notice with an "Oppdater ordlister nå" button; user-triggered update downloads new bundle, replaces the cache entry atomically, new indexes activate on the next page load
  5. **Existing users migrate silently and bundled data is removed** — A user upgrading from v2.x sees no functional regression on first run; the shipped extension zip no longer contains `extension/data/{de,es,fr,en,nb,nn}.json` full vocabularies (only the NB baseline remains); a documented adapter contract describes how lockdown can plug its own bootstrap into the vocab-seam
  6. **Release gates updated** — `check-network-silence` continues to exit 0 against spell-check + word-prediction hot paths; `background/vocab-bootstrap.js` is the only sanctioned `fetch` site and is documented as such; new `check-baseline-bundle-size` gate enforces the NB baseline ≤ 200 KB with paired self-test (oversized baseline → gate fires; well-formed baseline → gate passes)
**Plans:** 6/6 plans complete
- [ ] 23-01-PLAN.md (wave 1) — Papertek API vocabulary endpoints (sibling repo): bundle + revisions + CORS [API-01, API-02, API-03]
- [ ] 23-02-PLAN.md (wave 2) — IndexedDB cache adapter + vocab-seam hydration + schema_version check [CACHE-01, CACHE-02, CACHE-03, SCHEMA-01]
- [ ] 23-06-PLAN.md (wave 2) — SC-06 carve-out + new check-baseline-bundle-size gate + paired self-test [GATES-01, GATES-02]
- [ ] 23-03-PLAN.md (wave 3) — NB baseline construction + service-worker bootstrap downloader + popup download status UI [BOOT-01, BOOT-02, BOOT-03]
- [ ] 23-04-PLAN.md (wave 3) — Update detection + popup notice + manual refresh button + atomic cache replacement [UPDATE-01, UPDATE-02, UPDATE-03]
- [ ] 23-05-PLAN.md (wave 4) — v2.x → v3.0 silent migration + bundled-data removal + lockdown adapter contract doc [MIGRATE-01]

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-04-18 |
| 2. Data Layer | v1.0 | 5/5 | Complete | 2026-04-18 |
| 02.1 Bundle-Size Cap | v1.0 | 2/2 | Complete | 2026-04-19 |
| 3. Rule Architecture | v1.0 | 5/5 | Complete | 2026-04-20 |
| 03.1 Browser Wiring | v1.0 | 1/1 | Complete | 2026-04-20 |
| 4. False-Positive Reduction | v1.0 | 3/3 | Complete | 2026-04-20 |
| 5. Student Experience Polish | v1.0 | 5/5 | Complete | 2026-04-20 |
| 05.1 UX-01 Gaps | v1.0 | 5/5 | Complete | 2026-04-21 |
| 6. Structural Infrastructure | v2.0 | 3/3 | Complete | 2026-04-24 |
| 7. Word-Order Violations | v2.0 | 4/4 | Complete | 2026-04-24 |
| 8. DE Case & Agreement | v2.0 | 3/3 | Complete | 2026-04-24 |
| 9. ES ser/estar, por/para | v2.0 | 3/3 | Complete | 2026-04-25 |
| 10. FR Elision, Auxiliary, PP | v2.0 | 3/3 | Complete | 2026-04-25 |
| 11. Aspect & Mood | v2.0 | 3/3 | Complete | 2026-04-25 |
| 12. Pronoun & Pro-Drop | v2.0 | 3/3 | Complete | 2026-04-25 |
| 13. Register Drift | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14. Morphology Beyond Tokens | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14.1 Vocab-Seam Wiring | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15. Collocations at Scale | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15.1 Fixture Gate Triage | v2.0 | 1/1 | Complete | 2026-04-25 |
| 16. Decomposition Engine | v2.1 | 2/2 | Complete | 2026-04-26 |
| 17. Compound Integration | v2.1 | 6/6 | Complete | 2026-04-26 |
| 18. Spell-Check Polish | v2.1 | 2/2 | Complete | 2026-04-26 |
| 19. NB/NN Passiv-s Detection | v2.1 | 3/3 | Complete | 2026-04-26 |
| 20. Browser Verification | v2.1 | 0/0 | Deferred | - |
| 21. Dictionary Intelligence | v2.2 | 2/2 | Complete | 2026-04-26 |
| 21.1 Pipeline Fix (GAP) | v2.2 | 1/1 | Complete | 2026-04-26 |
| 21.2 Data Fixes (GAP) | v2.2 | 1/1 | Complete | 2026-04-26 |
| 22. å/og Confusion | v2.2 | 1/1 | Complete | 2026-04-26 |
| 23. Data-Source Migration | 6/6 | Complete   | 2026-04-27 | - |

---
*Roadmap updated: 2026-04-27 — v3.0 Data-Source Migration consolidated to single phase (6 plans)*
