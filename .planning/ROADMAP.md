# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15.1 (shipped 2026-04-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Compound Decomposition & Polish** — Phases 16–19 (shipped 2026-04-26) — [archive](milestones/v2.1-ROADMAP.md)
- ✅ **v2.2 Student Language Intelligence** — Phases 21–22 + 21.1/21.2 decimal inserts (shipped 2026-04-27) — [archive](milestones/v2.2-ROADMAP.md)
- 🚧 **v3.0 Data-Source Migration** — Phases 23–27 (in progress)

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

### 🚧 v3.0 Data-Source Migration (Phases 23-27) — IN PROGRESS

- [ ] **Phase 23: Papertek API Vocabulary Endpoints** — Sibling-repo work; expose versioned per-language bundle + updates-check endpoints with CORS
- [ ] **Phase 24: IndexedDB Cache Adapter + Schema Versioning** — Storage adapter, async hydration, schema_version compatibility check
- [ ] **Phase 25: Bootstrap Path + NB Baseline + Network-Silence Gate** — ~100 KB NB baseline, service-worker bootstrap downloader, popup status UI, SC-06 carve-out + baseline-size gate
- [ ] **Phase 26: Update Detection + Manual Refresh** — Startup revision check, "Nye ordlister tilgjengelig" notice, "Oppdater ordlister nå" button
- [ ] **Phase 27: Migration + Bundled-Data Removal** — Silent v2.x→v3.0 transition; strip bundled JSON from package; lockdown adapter contract documented

## Phase Details

### Phase 23: Papertek API Vocabulary Endpoints
**Goal**: Sibling-repo Papertek API exposes the endpoints the extension will fetch from, with revision metadata and CORS for the extension origin.
**Depends on**: Nothing (sibling-repo prerequisite for everything else in v3.0)
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. A request to the per-language bundle endpoint (e.g. `GET /api/vocab/v1/bundle/de`) returns the full payload (all banks + freq + bigrams + grammar features + falseFriends + senses) plus `{schema_version, revision}` metadata in a single response
  2. A request to the updates-check endpoint (e.g. `GET /api/vocab/v1/revisions`) returns a small `{language: revision}` map suitable for frequent polling
  3. Both endpoints respond with appropriate `Access-Control-Allow-Origin` for `chrome-extension://...` and `https://leksihjelp.no` such that a browser fetch from those origins succeeds
  4. Endpoint contracts are documented in the sibling repo so the extension's bootstrap and update paths can target a stable shape
**Plans**:
- [ ] PLAN.md (TBD: bundle endpoint)
- [ ] PLAN.md (TBD: updates-check endpoint)
- [ ] PLAN.md (TBD: CORS + contract docs)

### Phase 24: IndexedDB Cache Adapter + Schema Versioning
**Goal**: A reusable IndexedDB cache adapter inside the extension that vocab-seam reads from, with schema_version compatibility checking before any persistence.
**Depends on**: Phase 23 (cache populated from API responses; schema_version comes from API metadata)
**Requirements**: CACHE-01, CACHE-02, CACHE-03, SCHEMA-01
**Success Criteria** (what must be TRUE):
  1. Each cached language entry persists in IndexedDB with `{schema_version, revision, fetched_at}` diagnostics alongside the payload
  2. `__lexiVocab` / `buildIndexes` consults IndexedDB first and falls back to the bundled NB baseline when the requested language is absent from cache
  3. Spell-check and word-prediction continue to function from the baseline indexes during async hydration; once full data is ready the indexes swap in without forcing a page reload
  4. When an incoming payload's `schema_version` does not match the version the extension can read, the prior cache entry is preserved unchanged and a "Versjonskonflikt" diagnostic is visible in the popup developer view
**Plans**:
- [ ] PLAN.md (TBD: IndexedDB adapter + entry shape)
- [ ] PLAN.md (TBD: vocab-seam hydration + index swap)
- [ ] PLAN.md (TBD: schema_version compatibility check + diagnostic)

### Phase 25: Bootstrap Path + NB Baseline + Network-Silence Gate
**Goal**: First-run download path that populates the cache from the API, with a tiny bundled NB baseline ensuring the extension is useful from the moment of install — and the offline-promise gates updated to reflect the sanctioned exception.
**Depends on**: Phase 24 (bootstrap writes through the cache adapter)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, GATES-01, GATES-02
**Success Criteria** (what must be TRUE):
  1. The packaged extension contains a bundled NB baseline file under 200 KB (top-2k Zipf, common typos, pronouns/articles) — first dictionary lookup works offline immediately on install with no network round-trip
  2. On first install, the service worker fetches full vocabulary for the user's selected target language(s) into IndexedDB without blocking popup interaction; baseline NB stays available throughout
  3. The popup surfaces download status — per-language progress while downloading, a success state on completion, and "Ordlister utilgjengelig — prøv igjen senere" on failure (with baseline NB still functional underneath)
  4. `check-network-silence` continues to exit 0 against `extension/content/spell-check*.js`, `extension/content/spell-rules/**`, and `extension/content/word-prediction.js`; the new `background/vocab-bootstrap.js` is the only sanctioned `fetch` site and is documented as such
  5. New release gate `check-baseline-bundle-size` exits 0 with the baseline ≤ 200 KB; paired self-test plants an oversized baseline and asserts the gate fires
**Plans**:
- [ ] PLAN.md (TBD: NB baseline construction + budget)
- [ ] PLAN.md (TBD: service-worker bootstrap downloader)
- [ ] PLAN.md (TBD: popup download status UI)
- [ ] PLAN.md (TBD: SC-06 carve-out + check-baseline-bundle-size gate + self-test)

### Phase 26: Update Detection + Manual Refresh
**Goal**: Cached vocabulary stays fresh — startup revision check surfaces a non-blocking notice, and a manual button lets the student pull updates on demand.
**Depends on**: Phase 25 (bootstrap must have populated the cache before update logic is meaningful)
**Requirements**: UPDATE-01, UPDATE-02, UPDATE-03
**Success Criteria** (what must be TRUE):
  1. On extension startup, the service worker calls the updates-check endpoint and compares the returned revision to the cached revision per language; mismatches are surfaced to the popup
  2. When an update is available, the popup shows a non-blocking "Nye ordlister tilgjengelig" notice with an "Oppdater ordlister nå" button — the student is never forced to wait
  3. Pressing the update button downloads the new bundle, replaces the IndexedDB cache entry atomically (no half-written state), and the new indexes activate on the next page load without manual extension reload
**Plans**:
- [ ] PLAN.md (TBD: startup revision check)
- [ ] PLAN.md (TBD: popup update notice + button)
- [ ] PLAN.md (TBD: atomic cache replacement + index activation)

### Phase 27: Migration + Bundled-Data Removal
**Goal**: Existing v2.x users transition silently to the new data path; the extension package stops shipping full per-language vocab, leaving only the NB baseline; lockdown's adapter contract is documented.
**Depends on**: Phases 24, 25, 26 (cache, bootstrap, and update flow must all be working before bundled data can be removed)
**Requirements**: MIGRATE-01
**Success Criteria** (what must be TRUE):
  1. A user upgrading from v2.x sees no functional regression on first run after upgrade — fresh data fetches into IndexedDB transparently and lookups continue to work (baseline-backed during hydration)
  2. The shipped extension zip no longer contains `extension/data/{de,es,fr,en,nb,nn}.json` full vocabularies — only the NB baseline remains; `check-bundle-size` confirms the resulting reduction
  3. A documented adapter contract describes how downstream consumers (lockdown) can plug their own bootstrap into the same vocab-seam without re-implementing the IndexedDB path
**Plans**:
- [ ] PLAN.md (TBD: v2.x → v3.0 silent migration path)
- [ ] PLAN.md (TBD: bundled-data removal + package verification)
- [ ] PLAN.md (TBD: lockdown adapter contract doc)

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
| 23. Papertek API Vocabulary Endpoints | v3.0 | 0/3 | Not started | - |
| 24. IndexedDB Cache Adapter + Schema | v3.0 | 0/3 | Not started | - |
| 25. Bootstrap + NB Baseline + Gates | v3.0 | 0/4 | Not started | - |
| 26. Update Detection + Manual Refresh | v3.0 | 0/3 | Not started | - |
| 27. Migration + Bundled-Data Removal | v3.0 | 0/3 | Not started | - |

---
*Roadmap updated: 2026-04-27 — v3.0 Data-Source Migration phases drafted*
