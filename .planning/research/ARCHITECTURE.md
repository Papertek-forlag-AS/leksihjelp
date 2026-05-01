# Architecture Research — v3.2 UAT & Deploy Prep

**Domain:** Cross-repo integration architecture for a risk-reduction milestone
**Researched:** 2026-05-01
**Confidence:** HIGH (drawn from existing repo state, CLAUDE.md, lockdown-adapter-contract, STATE.md)

## Scope Note

This research is NOT for "what to build" — v3.2 ships zero new features. It is for "how do UAT-driven changes propagate safely across three repositories under a shared sync pipeline." The architecture concern is **integration paths and version-skew risk**, not new components.

---

## System Overview — Three-Repo Topology

```
┌──────────────────────────────────────────────────────────────────────┐
│                    leksihjelp (THIS repo, upstream)                  │
│                     Source of truth for all shared code              │
├──────────────────────────────────────────────────────────────────────┤
│  extension/content/*.js     extension/popup/views/*.js               │
│  extension/exam-registry.js extension/styles/content.css             │
│  extension/data/*           extension/i18n/*                         │
│                                                                      │
│  package.json version  ←——— sync signal to downstreams               │
│  scripts/*.js (14 release gates)                                     │
└─────────────┬──────────────────────────────────┬─────────────────────┘
              │ file:../leksihjelp               │ (future: npm)
              │ postinstall: sync-leksihjelp.js  │
              ▼                                  ▼
┌──────────────────────────────────┐   ┌──────────────────────────────┐
│  lockdown (downstream, shipping) │   │  skriveokt-zero (deferred,   │
│  /Users/.../Papertek/lockdown    │   │   not yet shipping)          │
├──────────────────────────────────┤   ├──────────────────────────────┤
│  public/leksihjelp/*  ← synced   │   │  src/leksihjelp/*  ← synced  │
│  + leksihjelp-loader.js (shim)   │   │  + own chrome shim           │
│  + leksihjelp-sidepanel-host.js  │   │  + skriveokt-zero/scripts/   │
│    (Phase 30 mount adapter)      │   │    sync-leksihjelp.js        │
│                                  │   │                              │
│  public/leksihjelp/data/         │   │  EXAM-09 deferred until      │
│    NOT in sync — lockdown uses   │   │  ships to consumers          │
│    own bundled vocab approach    │   │                              │
│  audio/  EXCLUDED from sync      │   │                              │
│                                  │   │                              │
│  Firebase hosting:               │   │  Tauri desktop binary        │
│   - papertek.app (prod)          │   │  (no web deploy)             │
│   - lockdown-stb (staging)       │   │                              │
│  Firebase Functions + firestore. │   │                              │
│   rules (RESOURCE_PROFILES)      │   │                              │
└──────────────────────────────────┘   └──────────────────────────────┘
```

### Component Responsibilities (v3.2 lens)

| Component | Responsibility | Touchpoint for v3.2 |
|-----------|----------------|---------------------|
| `extension/` source tree | Canonical implementation of every shared surface | Every UAT bug-fix lands here first |
| 14 release gates (`scripts/check-*.js`) | Block ship on regressions | Re-run on every UAT fix; gate passes are pre-condition for `npm run package` |
| `package.json` version | Sync signal to downstream consumers | Bump after every UAT fix that changes a synced surface |
| `npm run package` | Builds zip with minified `data/*.json` | Re-runs minification on every release |
| Lockdown's `scripts/sync-leksihjelp.js` (postinstall) | Pulls synced files from `node_modules/@papertek/leksihjelp` (currently `file:../leksihjelp`) | Manually or auto-triggered after extension version bump |
| `leksihjelp-loader.js` (lockdown chrome shim) | Provides chrome.runtime/storage/getURL surface | Touched only if seam contract changes; v3.2 should not touch it |
| `leksihjelp-sidepanel-host.js` (lockdown Phase 30 mount) | Mounts shared view modules with `audioEnabled: false` deps | UAT walkthrough surface for Phase 30-02 |
| Firebase hosting + Functions + firestore.rules (lockdown) | Production runtime for EXAM-10 + papertek.app sidepanel host | Deploy runbook target — actual deploy deferred |

---

## Recommended `.planning/` Structure for v3.2

```
.planning/
├── PROJECT.md                          # already maintained
├── STATE.md                            # already maintained
├── lockdown-adapter-contract.md        # durable doc — leave in place
├── research/                           # this milestone's research
│   ├── SUMMARY.md
│   ├── STACK.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md  ← this file
│   └── PITFALLS.md
├── milestones/                         # archived milestones (v3.1, v3.0, …)
└── runbooks/                           # NEW — durable, top-of-planning
    ├── README.md                       # index + when to use each
    ├── extension-uat-fix-loop.md       # canonical fix → sync → re-test
    ├── lockdown-staging-deploy.md      # firestore.rules + Functions to lockdown-stb
    ├── lockdown-prod-deploy.md         # papertek.app prod (user-gated)
    └── papertek-app-sidepanel-deploy.md # Phase 30 hosting deploy
```

### Structure Rationale — runbooks live at `.planning/runbooks/` not in milestone

**Decision:** Runbooks are durable operational artifacts, not milestone-scoped deliverables. They MUST survive the v3.2 archive.

- **`.planning/runbooks/`** (durable): Each runbook is referenced by name from any future milestone that re-deploys. The next person who needs to push firestore.rules in v3.5 should find the runbook at a stable path, not buried inside `milestones/v3.2-*`.
- **`.planning/milestones/v3.2/`** (when archived): May contain a *pointer* (`See ../../runbooks/lockdown-prod-deploy.md`) plus the milestone-specific UAT findings log.
- **Top-level (e.g., repo root)** (rejected): Runbooks aren't user-facing docs. Mixing them with `README.md` / `CLAUDE.md` dilutes both.

**Integration point for the next reader:** `.planning/runbooks/README.md` is the index. CLAUDE.md gets a one-line pointer in the "Release Workflow" section: *"For deploy steps that touch lockdown (firestore.rules, Functions, hosting), see `.planning/runbooks/`."*

---

## Architectural Patterns

### Pattern 1: Canonical Fix → Sync → Re-test Loop

**What:** Every UAT-surfaced bug follows a strict path. No hot-fixes downstream.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UAT surfaces bug in extension OR lockdown sidepanel      │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Edit canonical source in /Users/…/leksihjelp/extension/  │
│    (NEVER edit /Users/…/lockdown/public/leksihjelp/*)       │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Run all 14 release gates locally                         │
│    npm run check-fixtures && \                              │
│    npm run check-explain-contract && \                      │
│    npm run check-rule-css-wiring && \                       │
│    npm run check-spellcheck-features && \                   │
│    npm run check-network-silence && \                       │
│    npm run check-bundle-size && \                           │
│    npm run check-baseline-bundle-size && \                  │
│    npm run check-benchmark-coverage && \                    │
│    npm run check-governance-data && \                       │
│    npm run check-vocab-seam-coverage && \                   │
│    npm run check-exam-marker && \                           │
│    npm run check-popup-deps && \                            │
│    npm run check-stateful-rule-invalidation && \            │
│    npm run check-pedagogy-shape                             │
│    (paired :test self-tests run in CI; not strictly needed  │
│     locally per fix, but run before milestone close)        │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Bump version in THREE places (mandatory by Release       │
│    Workflow step 13):                                        │
│      - extension/manifest.json                              │
│      - package.json   ← this is the SYNC SIGNAL             │
│      - backend/public/index.html                            │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. npm run package                                          │
│    (regenerates zip with minified data/*.json)              │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Commit in leksihjelp repo                                │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. In /Users/…/lockdown:                                    │
│      cd /Users/…/lockdown                                    │
│      npm install   # triggers postinstall sync-leksihjelp   │
│         OR                                                   │
│      node scripts/sync-leksihjelp.js   # explicit re-sync   │
│    Verify: git status shows public/leksihjelp/* changes      │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Lockdown smoke-test (depends on what changed):           │
│    - Synced view module change → load sidepanel-host UAT    │
│    - exam-registry.js change → re-load exam profile         │
│    - content.css change → visual regression on dialect-mix  │
│      / spell dots / EKSAMENMODUS amber border               │
│    - data/* (NB baseline only) → reload extension to clear  │
│      IDB cache                                              │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Commit in lockdown repo with message referencing          │
│    leksihjelp version: "sync: leksihjelp 2.9.19"            │
└─────────────────────────────────────────────────────────────┘
```

**When to use:** Every single UAT bug-fix in v3.2.
**Trade-off:** Slow (9 steps per fix) vs. safe (catches version skew, gate regressions, sync drift). At a UAT cycle's volume of small fixes, batching helps — see Build Order below.

### Pattern 2: Batched UAT Drain Before Sync

**What:** Don't sync after every micro-fix. Drain a UAT walkthrough's findings into one extension version bump.

**When to use:** When multiple findings emerge in the same UAT walkthrough (e.g., 6 DE Lær mer walks may surface 3 small copy/CSS fixes — bundle them).
**Trade-off:** Reduces lockdown re-sync churn (good) but risks one fix masking another's regression on first lockdown smoke-test (acceptable: gates run against the bundle, not per-fix).

**Heuristic from existing v3.1 pattern:** UAT batches matched roughly 1 phase = 1 walkthrough = 1 bump. Continue this rhythm.

### Pattern 3: Runbook-as-Code Pre-flight

**What:** Each deploy runbook ends with a copy-pasteable command block + a verification step. Treat it like a checked-in Bash transcript with prose between commands.

**Example shape (for `lockdown-prod-deploy.md`):**

```markdown
## Pre-flight

- [ ] Confirm `firebase use papertek-prod` (NOT `lockdown-stb`)
- [ ] Diff staging firestore.rules vs prod: `firebase firestore:rules:list`
- [ ] Confirm `RESOURCE_PROFILES.LEKSIHJELP_EXAM` enum present in prod Functions config

## Deploy

```bash
cd /Users/…/lockdown
firebase deploy --only firestore:rules,functions --project papertek-prod
```

## Verify

- [ ] Open papertek.app, sign in as test teacher
- [ ] Apply LEKSIHJELP_EXAM profile to a test student
- [ ] Confirm student sees EKSAMENMODUS badge + amber border
```

**When to use:** Every deploy artifact in v3.2 (firestore.rules + Functions for EXAM-10; papertek.app hosting for Phase 30 sidepanel).
**Trade-off:** Verbose vs. low-cognitive-load for the next deployer (typically the user themselves under time pressure).

### Pattern 4: Dep-Injection Contract Stability (existing — preserve, don't touch)

**What:** Phase 30 view modules accept `mountXView(container, deps)` with explicit deps. Lockdown sidepanel host passes `audioEnabled: false` + no auth/payment/exam-toggle.

**v3.2 implication:** Any UAT fix in `extension/popup/views/*.js` MUST keep contract additive. Adding required deps breaks the lockdown sidepanel host silently. The `check-popup-deps` gate enforces no implicit globals but does NOT catch "added a new required dep field." Mitigation: code review + lockdown smoke-test step 8 above.

---

## Data Flow — UAT-Specific

### UAT Finding → Production-Ready Path

```
UAT walkthrough (manual, in-browser)
     ↓
Finding logged in milestone phase doc
     ↓
Decision: extension fix? data fix? lockdown-only fix?
     ├── extension fix     → Pattern 1 (canonical loop)
     ├── data fix          → papertek-vocabulary repo, then sync-vocab in extension, then Pattern 1
     └── lockdown-only fix → lockdown repo direct (rare; only for shim/host code)
     ↓
Lockdown re-sync + smoke-test
     ↓
Staging UAT (lockdown-stb on Firebase hosting)
     ↓
Production deploy runbook authored / refined based on staging experience
     ↓
[v3.2 milestone close — actual prod deploy deferred per Decision below]
```

### Version-Skew Detection

There is NO automatic detection today. Skew can occur if:

1. Lockdown's `package.json` lockdown-side pin lags behind the leksihjelp version that introduced a fix.
2. Someone hot-fixes `lockdown/public/leksihjelp/*` directly (forbidden by CLAUDE.md but possible).
3. Lockdown's `npm install` doesn't run between leksihjelp version bumps (e.g., manual file copy).

**Mitigation (existing):** CLAUDE.md documents the rule. **Gap (v3.2 should address):** Add to `lockdown-prod-deploy.md` runbook a pre-flight check that compares the leksihjelp `package.json` version in the lockdown repo's `node_modules` against the latest tag in the leksihjelp repo.

---

## Risk Analysis — UAT-Driven Changes Specifically

### Risk 1: Asymmetric extension-vs-lockdown drift

**Why:** Extension UAT can surface bugs that ONLY manifest in extension context (e.g., chrome.identity.launchWebAuthFlow paths). The fix may not need lockdown re-sync. But the version still bumps. If we get into a habit of "extension bumped but lockdown re-sync deferred," we accumulate drift on shared surfaces that DO need the re-sync.

**Mitigation:** Every extension version bump triggers a "does lockdown need this?" decision — recorded in commit message tag (e.g., `[lockdown-resync-needed]` or `[extension-only]`).

### Risk 2: Partial fixes between UAT walkthroughs

**Why:** UAT walkthrough A surfaces a fix that lands. UAT walkthrough B then runs against the post-fix code. If walkthrough B surfaces a bug, was it pre-existing or caused by A's fix?

**Mitigation:** Run walkthroughs in a defined order; capture each walkthrough's "before-version" and "after-version" in the phase doc.

### Risk 3: Release-gate false negatives during UAT

**Why:** All 14 gates target known regression classes. UAT often surfaces bugs that NO gate catches (otherwise we'd have caught them pre-ship). Adding a new gate for each UAT finding is the right long-term answer (per the Phase 36 INFRA-10 precedent) but slows the milestone.

**Mitigation:** Distinguish "ship-blocking gate addition" (rare; only for regression classes that recurred 2+ times) vs. "fix-only" (most cases). Log gate-candidate ideas in `.planning/research/PITFALLS.md` for future milestones.

### Risk 4: Lockdown staging deploy ≠ production behavior

**Why:** firestore.rules + Functions deploys to lockdown-stb may pass UAT, then fail in prod due to firestore index differences, prod-only auth claims, or env-var divergence.

**Mitigation:** The `lockdown-prod-deploy.md` runbook MUST include a pre-flight diff step (rules + Functions config + env vars) against staging. This is the single most important runbook item.

### Risk 5: Audio re-introduction to lockdown

**Why:** Three independent safeguards exist (`audioEnabled: false` in deps, host never passes real `playAudio`, `extension/audio/` excluded from sync). A naive UAT-driven view-module refactor could break the renderResults gate.

**Mitigation:** No new safeguard needed — `check-popup-deps` + manual review + the host's hard-coded `audioEnabled: false` already cover. v3.2 should NOT touch the audio safeguards.

### Risk 6: Runbook drift after first prod deploy

**Why:** v3.2 ships runbooks; first actual prod deploy happens post-milestone. If the first deploy reveals runbook gaps, will they be patched back?

**Mitigation:** Add to runbook header: *"After first production execution, append a `## Run Log` section with date, executor, and any deviations. Patch the steps if deviations were necessary."*

---

## Modified vs. New Components

**New:** Almost nothing. v3.2 is a risk-reduction milestone.

**Genuinely new artifacts:**
- `.planning/runbooks/README.md` — index file
- 4 runbook files (extension-uat-fix-loop, lockdown-staging-deploy, lockdown-prod-deploy, papertek-app-sidepanel-deploy)
- Optional: a `[lockdown-resync-needed]` / `[extension-only]` commit-message convention (no code, just discipline)

**Modified (highest-risk first):**

| Surface | Risk | Why |
|---------|------|-----|
| `extension/popup/views/*.js` | HIGH | Synced to lockdown sidepanel host; dep-contract changes break silently |
| `extension/exam-registry.js` | HIGH | Synced to lockdown for teacher-lock; entry shape changes break firestore profile mapping |
| `extension/content/spell-rules/*.js` | MEDIUM | Synced to lockdown; rule additions need exam-marker + CSS wiring + explain-contract; gates catch most |
| `extension/styles/content.css` | MEDIUM | Synced whole; selectors for lockdown-only contexts (`.pdf-text-layer`) live here too |
| `extension/data/nb-baseline.json` | LOW-MEDIUM | Bundled in zip; capped at 200KB by gate; lockdown uses own data path so sync impact minimal |
| `extension/i18n/*` | LOW | Synced; copy-only changes; UAT may surface NB/NN/EN string fixes |
| Lockdown `leksihjelp-sidepanel-host.js` | LOW | NOT synced (lockdown-owned); modify only if dep contract demands it |
| Lockdown `firestore.rules` | DEPLOY-RISK | Rule changes for EXAM-10 already in staging; prod deploy is user-gated |
| Lockdown Cloud Functions (RESOURCE_PROFILES) | DEPLOY-RISK | Same — staging deployed; prod runbook is the v3.2 deliverable |

**Genuinely untouched (and should stay so):**
- `backend/api/*` — Vercel serverless paths; v3.2 has no auth/subscription work
- `extension/background/service-worker.js` — bootstrap path; no v3.2 work
- `scripts/sync-vocab.js` — Papertek API sync; no v3.2 vocab work expected
- 14 existing release gates — none should be modified; new gates would be a Phase-class effort

---

## Suggested Build Order

**Recommendation: Sequential by surface, NOT interleaved per fix.**

Rationale: UAT walkthroughs are slow and cognitively expensive. Context-switching between "do an extension UAT walk" and "author a deploy runbook" wastes warm-up. Group like work.

```
Phase A — Extension UAT batch (drain all 6 walkthroughs first)
  A1. F36-1 fr-aspect-hint browser confirm        ← smallest, warm-up
  A2. Phase 27 9-step exam-mode walk              ← user-facing, high-value
  A3. Phase 30-01 9-step extension popup view walk
  A4. Phase 26 6 DE Lær mer browser walks
  A5. Phase 26 NN + EN locale Lær mer walks (F7)
  Output: a list of findings (bugs + version bumps), all extension-side
  Sync trigger: ONE bump per walkthrough that surfaced fixes
                (not 1 bump per micro-fix)

Phase B — Lockdown sync + staging UAT
  B1. cd /Users/…/lockdown && npm install (pulls all Phase A bumps at once)
  B2. Phase 30-02 lockdown sidepanel 8-step staging UAT
  B3. Bug-fix loop for any sidepanel-host-specific findings
       (extension fixes go upstream via Pattern 1 — re-loop A)
  Output: lockdown-stb confirmed at parity with extension HEAD

Phase C — Deploy runbook authoring
  C1. lockdown-staging-deploy.md (we just did it in B; capture the steps)
  C2. lockdown-prod-deploy.md    (firestore.rules + Functions for EXAM-10)
  C3. papertek-app-sidepanel-deploy.md (Phase 30 hosting)
  C4. extension-uat-fix-loop.md  (capture Pattern 1 above as a runbook)
  C5. .planning/runbooks/README.md (index)
  Output: 5 runbooks; CLAUDE.md gets a one-line pointer
```

**Why A → B → C and not interleaved:**

1. **A first** because everything else depends on extension code being UAT-confirmed. Authoring a deploy runbook for unstable code is wasted work.
2. **B after A** because lockdown sync must consume the post-A version. Syncing mid-A means re-syncing later anyway.
3. **C last** because the staging-deploy runbook (C1) is a literal transcript of what you just did in B2. Authoring it cold (without B's recent experience) loses fidelity.

**Carve-out:** If Phase A surfaces a critical bug that blocks Phase B (e.g., view module won't mount in lockdown shim), do a hot-loop B1 immediately to confirm, then resume A. Don't let A finish in isolation if B is showing red on a fundamental.

---

## Anti-Patterns

### Anti-Pattern 1: "Just edit lockdown directly, port back later"

**What:** Hot-fix `lockdown/public/leksihjelp/*` to unblock UAT.
**Why wrong:** Next `npm install` in lockdown silently reverts the fix; CLAUDE.md explicitly forbids it; pattern was the entire reason the canonical-source-of-truth rule exists.
**Do this instead:** Pattern 1 above. If the fix is urgent, the canonical loop is still ~10 minutes, not hours.

### Anti-Pattern 2: Skipping `package.json` bump because "no functional change"

**What:** UAT surfaces a CSS-only or i18n-only fix; skip the version bump because "nothing real changed."
**Why wrong:** `package.json` is the lockdown sync signal. Without a bump, nothing tells the downstream consumer to re-sync.
**Do this instead:** Always bump on synced-surface changes. Patch versions are cheap.

### Anti-Pattern 3: Running gates ad-hoc instead of all-14

**What:** "I only changed CSS, I'll just run check-rule-css-wiring."
**Why wrong:** Gates exist precisely because changes have non-obvious blast radius. Phase 36 INFRA-10 surfaced bugs in three FR files when only DE was being touched.
**Do this instead:** Run all 14 gates before every commit. They're fast (~10s aggregate). Add a Bash alias if needed.

### Anti-Pattern 4: Authoring runbooks before doing the deploy at least once

**What:** Write `lockdown-prod-deploy.md` from memory or by reading firebase docs.
**Why wrong:** Prod-deploy runbooks need real deploy experience to capture the steps that aren't in vendor docs (env-var quirks, project-aliases, two-factor prompts).
**Do this instead:** Phase B's staging deploy IS the runbook draft. Capture it live.

### Anti-Pattern 5: Treating UAT findings as "minor copy fixes"

**What:** Bundle 8 UAT findings into one untracked commit.
**Why wrong:** Loses traceability — "which finding caused which fix?" matters when a UAT walkthrough re-runs and re-surfaces a regression.
**Do this instead:** Each finding gets a fix-commit referencing the UAT walkthrough doc and finding number.

---

## Integration Points

### External Services

| Service | Integration Pattern | v3.2 Touch |
|---------|---------------------|------------|
| Firebase hosting (papertek.app, lockdown-stb) | `firebase deploy --only hosting` from lockdown repo | Runbook only; no actual deploy |
| Firebase Functions | `firebase deploy --only functions --project <id>` | Runbook only; staging already deployed |
| Firebase Firestore (rules) | `firebase deploy --only firestore:rules` | Runbook only; staging already deployed |
| Vercel (leksihjelp.no backend) | `vercel deploy --prod` | NOT touched in v3.2 |
| Papertek API | sync-vocab.js | NOT touched in v3.2 expected |
| ElevenLabs | TTS proxy in backend | NOT touched in v3.2 |
| Vipps + Stripe | OAuth + Recurring/Checkout | NOT touched in v3.2 |
| Chrome Web Store | Manual upload of zip | Post-milestone (not in v3.2 scope) |

### Internal Boundaries

| Boundary | Communication | v3.2 Risk |
|----------|---------------|-----------|
| `extension/` ↔ lockdown `public/leksihjelp/` | File copy via sync script (postinstall) | Version skew if sync skipped |
| `extension/popup/views/*` ↔ `leksihjelp-sidepanel-host.js` | Dep-injection (`mountXView(container, deps)`) | Contract drift if deps added |
| `exam-registry.js` ↔ lockdown firestore RESOURCE_PROFILES | String-keyed registry → enum mapping in Functions | Out-of-sync entries silently de-classified |
| `extension/styles/content.css` ↔ lockdown `leksihjelp.css` (renamed) | File copy; whole-file sync | New selectors must work in BOTH contexts |
| `extension/data/nb-baseline.json` ↔ lockdown vocab path | Lockdown uses own data path; baseline is extension-only | Low |
| Release gates ↔ CI (if any) ↔ local pre-commit | Manual today | Gates don't fire if not run; v3.2 should NOT add CI infra (out of scope) |

---

## Sources

- `/Users/geirforbord/Papertek/leksihjelp/CLAUDE.md` — Release Workflow + Downstream Consumers sections (HIGH confidence — canonical project doc)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/PROJECT.md` — milestone scope, key decisions table (HIGH)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/lockdown-adapter-contract.md` — seam contract surface (HIGH)
- `/Users/geirforbord/Papertek/leksihjelp/.planning/STATE.md` — pending todos describing carry-over UAT scope (HIGH)
- v3.1 archived phase decisions (Phase 30, 33, 36 specifically) — HIGH confidence on existing dep-injection contract and INFRA-10 seam-coverage gate

---
*Architecture research for: leksihjelp v3.2 UAT & Deploy Prep — cross-repo integration architecture*
*Researched: 2026-05-01*
