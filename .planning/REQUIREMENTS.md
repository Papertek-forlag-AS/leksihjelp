# Requirements: Leksihjelp v3.2 — UAT & Deploy Prep

**Defined:** 2026-05-01
**Core Value:** Norwegian students write foreign languages better — with correct words, correct form, and confidence in pronunciation — without leaving the page they're working on.
**Milestone Goal:** Walk every v3.1-shipped feature through browser UAT, fix what surfaces, sync to lockdown, validate in lockdown-staging, and leave production deploys (Firebase + papertek.app hosting) primed for confident user-gated execution after the milestone closes. Critical school-year merge-prep — REGR discipline mandatory.

## v1 Requirements

Requirements for v3.2. Each maps to a roadmap phase.

### Hygiene & UAT Templates

- [x] **HYG-01**: UAT walkthrough template exists at `.planning/uat/TEMPLATE-walkthrough.md` with mandatory pre-flight evidence block (extension version string, IDB revision, default-preset profile, browser+version, `chrome://extensions` reload timestamp), defects-observed section, and target-browsers list
- [x] **HYG-02**: Finding template exists at `.planning/uat/TEMPLATE-finding.md` formalizing the F-id pattern (severity, sync-status, regression-fixture-id) — promotes the implicit F1/F2/F36-1 convention from v3.1 Phase 34/35/36 to repo standard
- [x] **HYG-03**: `verification_kind: human-browser-walk` frontmatter convention adopted on UAT phase plans; orchestrator hard-pauses (no auto-advance) on phases declaring this kind. Documented in CLAUDE.md.
- [x] **HYG-04**: `check-version-alignment` release gate added with paired `:test` self-test — asserts manifest.json + package.json + backend/public/index.html versions agree. Inserted into Release Workflow numbered list in CLAUDE.md.
- [x] **HYG-05**: `check-synced-surface-version` release gate added with paired `:test` self-test — fails when synced surfaces (`extension/content/`, `extension/popup/views/`, `extension/exam-registry.js`, `extension/styles/content.css`, `extension/data/`, `extension/i18n/`) changed since last tag without a `package.json` version bump
- [x] **HYG-06**: `[lockdown-resync-needed]` commit-message convention documented in CLAUDE.md downstream-consumers section; applied retroactively to outstanding synced-surface commits during phase work
- [x] **HYG-07**: Papertek API vocabulary deployment verified as pre-flight to UAT. Direct repo access at `/Users/geirforbord/Papertek/papertek-vocabulary`; confirm git status clean + remote up-to-date + Vercel deployment at HEAD revision; verify `papertek-vocabulary.vercel.app/api/vocab/v1/revisions` reflects latest. Reconcile v3.1 side-patched extension data (e.g., `extension/data/es.json` gustar/por-para edits per Phase 32-02 decision) by either (a) confirming the edit landed in papertek-vocabulary and re-syncing via `npm run sync-vocab`, or (b) explicitly carrying the side-patch as deferred with documented reason. Hard pre-condition for UAT-EXT-* and UAT-LOCK-* — testing against stale vocab data is a Pitfall-1 (stale-artifact) failure mode.

### Extension UAT (Browser Walkthroughs)

- [x] **UAT-EXT-01**: F36-1 fr-aspect-hint browser confirmation — passé-composé vs imparfait soft-hint dot fires AND Lær mer panel renders in actual Chrome, verification log instantiates HYG-01 template
- [ ] **UAT-EXT-02**: Phase 26 DE Lær mer browser walks — 4 default-locale walks (de-prep-case + Wechselpräpositionen) + 2 NN/EN locale walks (closes F7 from Phase 35), verification logs instantiate HYG-01 template
- [ ] **UAT-EXT-03**: Phase 27 exam-mode 9-step walkthrough — toggle on/off, EKSAMENMODUS badge, amber widget border, suppression behavior across rules, lockdown teacher-lock dual mode, verification log instantiates HYG-01 template (highest stakes — school deployment trust)
- [ ] **UAT-EXT-04**: Phase 30-01 popup view 9-step walkthrough — load extension, search, lang switch, direction toggle, compound suggestion, Lær mer popover, settings, account section, pause, vocab-updates banner; verification log instantiates HYG-01 template

### Bug-Fix Loop & Regression Capture

- [ ] **FIX-01**: Canonical Fix → Sync → Re-test loop executed for every UAT-surfaced bug — extension fix (never lockdown direct), all release gates green, version bump in 3 places, `npm run package` rebuild
- [ ] **FIX-02**: Per-fix regression discipline mandatory — every bug fix adds either a `check-fixtures` regression fixture OR a `benchmark-texts/expectations.json` entry exercising the bug path BEFORE the phase commits. No exceptions (school-year stakes).
- [ ] **FIX-03**: INFRA-10 canary extension — any new index added to `buildIndexes` during a v3.2 fix gets a population canary in `check-vocab-seam-coverage`, defending the silent-empty-index class (Phase 26-01/32-01/32-03/F36-1 root cause)
- [ ] **FIX-04**: Outstanding Phase 27 release-asset upload — bump 2.6.0 → 2.7.0 already done; rebuild zip via `npm run package` and upload as GitHub Release asset, completing Release Workflow steps 13-15

### Lockdown UAT (Cross-Repo Sync + Staging)

- [ ] **UAT-LOCK-01**: Lockdown re-pinned to tagged leksihjelp v3.2 head — `cd lockdown && npm install` against tagged release, sync mirrors only tagged-version contents (defends Phase 30-02 orphan-mirror class)
- [ ] **UAT-LOCK-02**: Phase 30-02 lockdown sidepanel 8-step staging UAT — leksihjelp-enabled test, join as student, verify dictionary view renders without audio buttons, verify EKSAMENMODUS badge under LEKSIHJELP_EXAM profile, verify settings shows only grammar+darkmode, verify dark mode scoped to sidepanel; verification log instantiates HYG-01 template
- [ ] **UAT-LOCK-03**: Lockdown sync drift-detection enhancement — coordinate cross-repo PR to `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js` to refuse overwriting divergent files without `--force` flag, print resolved leksihjelp version + HEAD commit on every sync
- [ ] **UAT-LOCK-04**: Skriveokt-zero dry-run sync verification — run `scripts/sync-leksihjelp.js --dry-run` against `/Users/geirforbord/Papertek/lockdown/skriveokt-zero/`, capture output, confirm path still works (deferred consumer; defends silent bit-rot). Read-only, no commit there.

### Deploy Runbook Authoring

- [ ] **DEPLOY-01**: `.planning/runbooks/lockdown-prod-deploy.md` authored — EXAM-10 deploy via `firebase deploy --only firestore:rules,functions --project lockdown-stb`, 6-section structure (pre-flight, deploy command, expected output, smoke test, observability, rollback). Includes EXAM-10 enum-removal-after-data-write irreversibility warning.
- [ ] **DEPLOY-02**: `.planning/runbooks/papertek-app-sidepanel-deploy.md` authored — Phase 30 sidepanel hosting deploy via `firebase deploy --only hosting --project lockdown-stb`, 6-section structure, includes cache-busting strategy audit + sidepanel-host smoke-test
- [ ] **DEPLOY-03**: `.planning/runbooks/extension-uat-fix-loop.md` authored — codifies the canonical 9-step Fix → Sync → Re-test pattern as durable runbook (lives at `.planning/runbooks/`, survives milestone archive, referenced from CLAUDE.md)
- [ ] **DEPLOY-04**: `.planning/runbooks/lockdown-staging-deploy.md` authored — transcript-form runbook captured live during UAT-LOCK-02, used as draft input for DEPLOY-01/02
- [ ] **DEPLOY-05**: User sign-off captured for both production runbooks — each dry-run-walked end-to-end against staging-lockdown with explicit "I would feel safe running this against production" confirmation. Sign-off recorded in milestone audit; without it, prod deploys explicitly carry to v3.3.

### Milestone Archive Hygiene

- [ ] **ARCH-01**: `/gsd:add-tests` run once at milestone end (per user convention `project_test_suite_at_milestone_end.md`)
- [ ] **ARCH-02**: `v3.2-MILESTONE-AUDIT.md` produced with explicit deferral classification (hard / time / backlog) for every carry-over item; runbook sign-off status verified
- [ ] **ARCH-03**: Final version-string alignment verified via HYG-04 gate; PROJECT.md Validated section updated; REQUIREMENTS.md status flips reflected

## v2 Requirements

Deferred to future release. Tracked but not in v3.2.

### Production Deploys (User-Gated)

- **PROD-01**: `firebase deploy --only firestore:rules,functions --project lockdown-stb` execution (post-milestone, user-gated, deploys EXAM-10 enum + writer)
- **PROD-02**: `firebase deploy --only hosting --project lockdown-stb` execution (post-milestone, user-gated, deploys Phase 30 sidepanel host)

### Skriveokt-Zero Sync (EXAM-09)

- **EXAM-09**: Skriveokt-zero exam-mode sync — un-defer when skriveokt-zero ships to consumers (Phase 28.1 deferred-by-design)

### Carry-over Tech Debt (Future Candidates)

- NN phrase-infinitive triage (~214 papertek-vocabulary verbbank entries)
- Leksi-in-skriv integration (skriv.papertek.app embed)
- SCHEMA-01 popup subscriber for `lexi:schema-mismatch`
- BUNDLED_LANGS cleanup in vocab-seam.js (cosmetic)
- FR sidecar 404 console noise (bigrams-fr / freq-fr / pitfalls-fr)
- papertek-vocabulary data gaps: `markeres` s-passiv; `setningen` NB bestemt form; NN vocab gaps (ven, skin, heile, sykle, sy)
- Tense harmony & discourse (TH-01..03), idiomatic-literalism (IDI-01), FR PP corner cases (FR-04), verb compound decomposition (COMP-09), context-aware sense selection (DICT-01)

## Out of Scope

Explicitly excluded for v3.2.

| Feature | Reason |
|---------|--------|
| Production Firebase + hosting deploys | User-gated; runbook + sign-off is the v3.2 deliverable, not the deploy itself |
| New runtime dependencies (Playwright, Cypress, Puppeteer) | Net-negative at 6-walkthrough scope; can't drive Vipps OIDC or Side Panel; competes with 14-gate trust budget |
| New extension features | Hardening milestone — zero new feature scope |
| Major version bump (3.x → 4.x) | 2.10.x is the right shape for a hardening milestone |
| Telemetry / observability instrumentation | GDPR/Schrems-II complexity; out of scope per PROJECT.md constraint |
| Skriveokt-zero EXAM-09 sync execution | Consumer not yet shipping; defers per Phase 28.1 |
| Direct lockdown hot-fixes | Violates canonical fix → sync → re-test loop (Pitfall 5); upstream-first only |

## Traceability

All 27 v1 requirements mapped to exactly one phase by gsd-roadmapper on 2026-05-01.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HYG-01 | Phase 37 | Complete |
| HYG-02 | Phase 37 | Complete |
| HYG-03 | Phase 37 | Complete |
| HYG-04 | Phase 37 | Complete |
| HYG-05 | Phase 37 | Complete |
| HYG-06 | Phase 37 | Complete |
| HYG-07 | Phase 37 | Complete |
| UAT-EXT-01 | Phase 38 | Complete |
| UAT-EXT-02 | Phase 38 | Pending |
| UAT-EXT-03 | Phase 38 | Pending |
| UAT-EXT-04 | Phase 38 | Pending |
| FIX-01 | Phase 38 | Pending |
| FIX-02 | Phase 38 | Pending |
| FIX-03 | Phase 38 | Pending |
| FIX-04 | Phase 38 | Pending |
| UAT-LOCK-01 | Phase 39 | Pending |
| UAT-LOCK-02 | Phase 39 | Pending |
| UAT-LOCK-03 | Phase 39 | Pending |
| UAT-LOCK-04 | Phase 39 | Pending |
| DEPLOY-01 | Phase 40 | Pending |
| DEPLOY-02 | Phase 40 | Pending |
| DEPLOY-03 | Phase 40 | Pending |
| DEPLOY-04 | Phase 40 | Pending |
| DEPLOY-05 | Phase 40 | Pending |
| ARCH-01 | Phase 41 | Pending |
| ARCH-02 | Phase 41 | Pending |
| ARCH-03 | Phase 41 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---

*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 — roadmap mapped (Phases 37-41), traceability populated by gsd-roadmapper*
