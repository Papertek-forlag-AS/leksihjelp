# Requirements: Leksihjelp v3.0

**Defined:** 2026-04-27
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.

## v3.0 Requirements

Requirements for v3.0 Data-Source Migration. Each maps to a roadmap phase.

### API (Papertek vocabulary endpoints — sibling repo)

- [x] **API-01**: Papertek API exposes a versioned per-language vocabulary bundle endpoint that returns the full payload (verbbank, nounbank, adjectivebank, articlesbank, generalbank, numbersbank, phrasesbank, pronounsbank, typobank, freq, bigrams, grammar features, falseFriends, senses) plus `{schema_version, revision}` metadata
- [x] **API-02**: Papertek API exposes a lightweight updates-check endpoint returning `{language: revision}` map (small response, suitable for frequent polling)
- [x] **API-03**: Both endpoints are CORS-allowed for the extension origin (`chrome-extension://...`) and the leksihjelp.no web origin

### BOOT (first-run bootstrap)

- [ ] **BOOT-01**: Extension ships with a minimal NB baseline (~100 KB cap) — enough essentials (top-2k Zipf, common typos, pronouns/articles) so the first lookup works offline immediately on install
- [ ] **BOOT-02**: On first install, service worker auto-downloads full vocabulary for the user's selected target language(s) into IndexedDB; baseline NB stays available throughout
- [ ] **BOOT-03**: Popup surfaces download status — progress per language while downloading, success when complete, "Ordlister utilgjengelig — prøv igjen senere" if download fails (baseline NB still functional)

### CACHE (storage adapter)

- [ ] **CACHE-01**: All language data persists in IndexedDB; each cache entry carries `{schema_version, revision, fetched_at}` for diagnostics
- [ ] **CACHE-02**: Vocab-seam (`__lexiVocab` / `buildIndexes`) reads from IndexedDB cache; falls back to bundled NB baseline if cache empty for the requested language
- [ ] **CACHE-03**: Cache hydration is async; spell-check + word-prediction operate on baseline indexes during hydration, swap to full indexes once ready (no force-reload)

### UPDATE (update detection)

- [ ] **UPDATE-01**: On extension startup, service worker calls the updates-check endpoint and compares revision against cached `revision` per language
- [ ] **UPDATE-02**: When an update is available, popup shows a non-blocking "Nye ordlister tilgjengelig" notice with an "Oppdater ordlister nå" button
- [ ] **UPDATE-03**: User-triggered update downloads new bundle, replaces the cache entry atomically, and the new indexes activate on the next page load

### SCHEMA (compatibility)

- [ ] **SCHEMA-01**: Before persisting downloaded data, extension verifies `schema_version` against the version it knows how to read; on mismatch, preserves the prior cache entry and surfaces a "Versjonskonflikt" diagnostic in popup developer view

### MIGRATE (existing-user transition)

- [ ] **MIGRATE-01**: First run after upgrading from v2.x silently fetches fresh data into IndexedDB; bundled JSON files are removed from the extension package once migration ships, leaving only the NB baseline

### GATES (release gates)

- [x] **GATES-01**: SC-06 (network silence) gate explicitly excludes the service-worker bootstrap path (`background/service-worker.js` and a new `background/vocab-bootstrap.js`); documented as the sanctioned network exception. Spell-check + word-prediction hot paths remain network-silent.
- [x] **GATES-02**: New release gate `check-baseline-bundle-size` enforces the NB baseline stays under 200 KB (alarm if accidentally bundled too much); paired self-test plants an oversized baseline and asserts the gate fires

## Future Requirements

Deferred to a future release. Tracked but not in v3.0.

### Lexi-Core Extraction

- **CORE-01**: Extract `lexi-core` shared module (vocab-seam, rules, i18n) consumed by both extension and skriv.papertek.app — deferred until skriv-integration is actively planned
- **CORE-02**: Storage adapter abstraction so lexi-core can plug into IndexedDB (extension) or fetch-on-demand (web app)

### Carry-Over

- **VERIF-01**: Browser visual verification (deferred from v2.0/v2.1/v2.2) — 12 accumulated tests
- **VERSION-01**: Align package.json / manifest.json / index.html version numbers
- **DEBT-01**: NN phrase-infinitive triage (~214 papertek-vocabulary verbbank entries)
- **DEBT-04**: Vocab-seam parity gate (`check-vocab-seam-parity`)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Lexi-core extraction (shared module for extension + skriv) | User memory says "elaborate later"; bundling now violates the signal and risks scope blowup with no shipped value |
| Skriv.papertek.app embedding | Depends on lexi-core extraction; deferred together |
| Per-keystroke API fetches | Violates SC-06 network silence on the spell-check / word-prediction hot path; bootstrap is a one-time exception |
| ML-based vocabulary expansion | Out of scope for the milestone — data still authored in papertek-vocabulary |
| User-uploaded custom wordlists | Different feature scope; not part of the migration |
| Lockdown-side bootstrap implementation | Lockdown's own concern; this milestone delivers a documented adapter contract that lockdown can implement post-v3.0 |
| Multi-region API caching / CDN routing | The papertek API already serves global traffic; caching tier is a separate operations concern |

## Traceability

Which phases cover which requirements.

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | Phase 23 (Plan 01) | Complete |
| API-02 | Phase 23 (Plan 01) | Complete |
| API-03 | Phase 23 (Plan 01) | Complete |
| CACHE-01 | Phase 23 (Plan 02) | Pending |
| CACHE-02 | Phase 23 (Plan 02) | Pending |
| CACHE-03 | Phase 23 (Plan 02) | Pending |
| SCHEMA-01 | Phase 23 (Plan 02) | Pending |
| BOOT-01 | Phase 23 (Plan 03) | Pending |
| BOOT-02 | Phase 23 (Plan 03) | Pending |
| BOOT-03 | Phase 23 (Plan 03) | Pending |
| UPDATE-01 | Phase 23 (Plan 04) | Pending |
| UPDATE-02 | Phase 23 (Plan 04) | Pending |
| UPDATE-03 | Phase 23 (Plan 04) | Pending |
| MIGRATE-01 | Phase 23 (Plan 05) | Pending |
| GATES-01 | Phase 23 (Plan 06) | Complete |
| GATES-02 | Phase 23 (Plan 06) | Complete |

**Coverage:**
- v3.0 requirements: 16 total
- Mapped to phases: 16 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after v3.0 roadmap consolidated (1 phase, 6 plans, 100% coverage)*
