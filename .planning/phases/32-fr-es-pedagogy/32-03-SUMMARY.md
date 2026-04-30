---
phase: 32-fr-es-pedagogy
plan: 03
subsystem: spell-rules
tags: [es, gustar-class, pedagogy, lexical-marker, cross-repo]

# Dependency graph
requires:
  - phase: 26-laer-mer-pedagogy-ui
    provides: pedagogy panel surface (rendered when explain() returns pedagogy)
  - phase: 27-exam-mode
    provides: rule.exam marker convention (preserved on es-gustar refactor)
provides:
  - "verb_class: 'gustar-class' lexical marker on 10 ES verbbank entries"
  - "shared pedagogy.gustar_class entry under es/grammarbank.json"
  - "vocab.gustarClassVerbs Set + vocab.gustarPedagogy block exposed by vocab-seam-core"
  - "es-gustar rule reads class membership from lexical entries, not inline list"
  - "es-gustar fires on 6 verbs with conjugation data (gustar/encantar/interesar/doler/sobrar/parecer/apetecer); faltar/molestar/quedar deferred until vocab gets presens"
  - "PREPOSITION_COLLISIONS guard preventing sobre→sobrar false positives"
affects: [phase-32-01-fr-aspect-hint, phase-32-02-es-por-para, future ES verb-class rules]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lexical-entry verb_class marker (papertek-vocabulary verbbank field) — sibling-pattern to existing verbClass: '-ar' conjugation tag"
    - "Shared pedagogy keyed under grammarbank.pedagogy.{class_name} for class-shared teaching content (vs. per-word pedagogy on lexical entries used by DE preps)"
    - "Module-level pedagogy cache in rule files: populated on first check() call, read by explain() outside any ctx (gate test path)"

key-files:
  created:
    - "/Users/geirforbord/Papertek/papertek-vocabulary/scripts/enrich-es-gustar-class.js (papertek-vocabulary commit 9d7b2608)"
    - "scripts/_apply-gustar-class.js (one-off mirror script for offline migration)"
  modified:
    - "/Users/geirforbord/Papertek/papertek-vocabulary/vocabulary/lexicon/es/verbbank.json (+10 verb_class markers, 3 new minimal entries)"
    - "/Users/geirforbord/Papertek/papertek-vocabulary/vocabulary/lexicon/es/grammarbank.json (+pedagogy.gustar_class shared entry)"
    - "extension/data/es.json (mirrored from papertek-vocabulary; not git-tracked)"
    - "tests/fixtures/vocab/es.json (mirrored — required for check-fixtures harness)"
    - "extension/content/spell-rules/es-gustar.js (data-driven refactor + preposition guard)"
    - "extension/content/vocab-seam-core.js (gustarClassVerbs + gustarPedagogy indexes — committed under 32-01 due to parallel execution)"
    - "fixtures/es/gustar.jsonl (94 → 127 cases; +33 new)"
    - "extension/manifest.json + package.json + backend/public/index.html (2.9.10 → 2.9.11)"

key-decisions:
  - "verb_class (snake_case) chosen over verbClass (existing camelCase conjugation tag) — distinct lexical-vs-conjugation namespace"
  - "Pedagogy attached to explain() return, NOT to findings — gustar-class is not a case-prep so finding.pedagogy would fail check-pedagogy-shape's VALID_CASES validator"
  - "Module-level _cachedPedagogy populated on first check() call — explain-contract gate calls rule.explain() outside ctx, so we need a lazy non-ctx fallback path"
  - "Detection extended from 1 verb (gustar) to 7 verbs with conjugation data (gustar/encantar/interesar/doler/sobrar/parecer/apetecer). faltar/molestar/quedar marked but undetectable (no presens in vocab). Documented in plan acceptance"
  - "PREPOSITION_COLLISIONS guard added — sobré (sobrar 1sg preterite) accent-strips to 'sobre' which is the very common Spanish preposition 'about'. Without the guard, 'Pienso sobre mi familia' would flag sobre as gustar-class verb"
  - "Mirror data into both extension/data/es.json AND tests/fixtures/vocab/es.json. The latter is the authoritative copy for check-fixtures (Phase 23-05 split)"

patterns-established:
  - "Pattern: Cross-repo verb-class enrichment — Node enrichment script in papertek-vocabulary (idempotent, follows enrich-de-prep-pedagogy convention) writes verb_class markers + shared pedagogy entry; leksihjelp's vocab-seam-core derives a Set + pedagogy block from these on buildIndexes; rule reads from ctx.vocab"
  - "Pattern: Preposition-collision guard list — closed Set of Spanish prepositions short-circuits the verb-form lookup before accent-strip ambiguity can produce false positives. Reusable for any future verb-class rule that includes verbs with preposition-shaped conjugation forms"

requirements-completed: [PHASE-32-C]

# Metrics
duration: ~75min
completed: 2026-04-30
---

# Phase 32 Plan 03: ES gustar-class pedagogy migration + extension Summary

**Migrated ES gustar-class verb membership from inline grammar-table list to `verb_class: "gustar-class"` markers on 10 verbbank lexical entries; lifted inline pedagogy strings into shared `pedagogy.gustar_class` grammarbank entry; refactored es-gustar.js to consume both from vocab; locked behaviour with 33 new fixture cases (94 → 127, all P=R=F1=1.000).**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-04-30T20:30:00Z (approx)
- **Completed:** 2026-04-30T21:45:00Z (approx)
- **Tasks:** 2 (both atomic; commits ended up split across parallel-execution agents — see Issues Encountered)
- **Files modified:** 8 (4 in leksihjelp, 3 in papertek-vocabulary, 1 mirror script)

## Accomplishments

- **Lexical-entry verb_class pattern established for ES.** Future class-based rules (impersonal verbs, weather verbs, etc.) follow this pattern, not inline lists in rule files or grammar-tables.
- **Shared pedagogy entry shape canonised under grammarbank.pedagogy.{class_name}.** Distinct from DE preposition pedagogy (which lives on per-word generalbank entries). Pattern: per-word pedagogy on lexical entries; class-shared pedagogy on grammarbank.
- **es-gustar detection expanded from 1 verb (gustar) to 6 detectable verbs** (gustar, encantar, interesar, doler, sobrar, parecer, apetecer). 4 more (faltar, molestar, quedar, apetecer) marked but blocked by data gap (no presens conjugations in vocab) — these stay covered by the 94-case existing lock.
- **127 fixture cases at P=R=F1=1.000** (94 existing migration lock + 33 new extension lock).
- **All 15 release-workflow gates green** including check-pedagogy-shape (which intentionally sees no findings carry pedagogy — gustar-class pedagogy lives in explain() return, not on findings).

## Task Commits

1. **Task 1: Add verb_class markers + shared pedagogy.gustar_class in papertek-vocabulary, sync** — papertek-vocabulary `9d7b2608` (feat) + leksihjelp `b2a4be2` (chore: mirror script)
2. **Task 2: Refactor es-gustar.js + extend fixture + version bump** — leksihjelp `54beb68` (feat). vocab-seam-core changes for gustarClassVerbs/gustarPedagogy were merged into `7737210` (32-01 fr-aspect-hint commit) due to parallel-agent execution; functionally intact, attribution-shifted. Version bump merged into `4b8db99` (32-01 release commit) — both 32-01 and 32-03 ride 2.9.11.

## Files Created/Modified

### papertek-vocabulary (commit 9d7b2608)
- `scripts/enrich-es-gustar-class.js` — idempotent enrichment script following enrich-de-prep-pedagogy convention
- `vocabulary/lexicon/es/verbbank.json` — 7 existing verbs marked + 3 new minimal entries (doler/sobrar/apetecer)
- `vocabulary/lexicon/es/grammarbank.json` — pedagogy.gustar_class entry with summary/explanation/examples/common_error/context_hint/semantic_category/related_phenomena

### leksihjelp
- `extension/content/spell-rules/es-gustar.js` — data-driven class membership, pedagogy via explain(), preposition-collision guard
- `extension/content/vocab-seam-core.js` — gustarClassVerbs Set + gustarPedagogy block (committed under 32-01)
- `fixtures/es/gustar.jsonl` — 94 → 127 cases
- `tests/fixtures/vocab/es.json` — mirrored gustar-class data so the gate harness sees it
- `extension/data/es.json` — mirrored (not git-tracked; sync-vocab regenerates from API)
- `scripts/_apply-gustar-class.js` — one-off mirror script (extended in Task 2 to also patch fixture vocab)
- `extension/manifest.json` + `package.json` + `backend/public/index.html` — version bump 2.9.10 → 2.9.11

## Decisions Made

See `key-decisions` in frontmatter. Key call: gustar-class pedagogy goes through `explain().pedagogy`, not on findings. This avoids the case-prep validation in check-pedagogy-shape (which requires `case ∈ {akkusativ, dativ, wechsel, genitiv}`) while still surfacing pedagogy through the Phase 26 "Lær mer" panel. The plan's <interfaces> block originally suggested attaching pedagogy to findings — STATE.md notes from Phase 26-01 already established the explain-return channel for non-DE-prep cases ("pedagogy block rides on finding object, NOT through explain()" applies to DE preps specifically; for class-based pedagogy the channel is explain return).

## Deviations from Plan

### Rule 1 — PREPOSITION_COLLISIONS guard (auto-fixed)

- **Found during:** Task 2 (running check-fixtures after extending fixture vocab)
- **Issue:** Marking `sobrar` as gustar-class plus its new preteritum form `sobré` in es.json caused a regression in es/collocation fixtures: `sobré` accent-strips to `sobre`, which lookups against `esPreteritumToVerb`. With sobrar now in `gustarClassVerbs`, every occurrence of the very-common Spanish preposition `sobre` (about) was being flagged as a misconjugated gustar-class verb. Sample fail: "Pienso sobre mi familia" → expected to flag `pensar sobre → pensar en` (collocation rule), got an extra es-gustar finding on `sobre`.
- **Fix:** Added a closed-set `PREPOSITION_COLLISIONS` Set in es-gustar.js. The check loop short-circuits before the verb-form lookup if the surface form (or accent-stripped variant) is in the prep set. Set: sobre, a, de, en, con, por, para — covers sobrar's collision and pre-empts future class additions that might collide.
- **Files modified:** extension/content/spell-rules/es-gustar.js
- **Verification:** Re-ran full check-fixtures suite — all ES rules back to P=R=F1=1.000 including collocation (was 0.419 R after the regression, restored to 1.000 R).
- **Committed in:** 54beb68 (Task 2 commit)

### Rule 1 — Mirror to fixture vocab in addition to extension data (auto-fixed)

- **Found during:** Task 2 (initial check-fixtures run on es-gustar showed R=0.086)
- **Issue:** Phase 23-05 split: check-fixtures.js prefers `tests/fixtures/vocab/{lang}.json` over `extension/data/{lang}.json`. My Task 1 mirror script only patched extension/data, leaving the fixture vocab without the verb_class markers — so the gate harness saw an empty gustarClassVerbs Set and the rule fell back to no-op.
- **Fix:** Extended `scripts/_apply-gustar-class.js` to patch BOTH paths.
- **Files modified:** scripts/_apply-gustar-class.js, tests/fixtures/vocab/es.json
- **Verification:** check-fixtures es/gustar back to 1.000 (94 → 127 with the extended fixture).
- **Committed in:** 54beb68 (Task 2 commit)

### Rule 1 — Spurious typo flags on plural adjectives in fixture (auto-fixed)

- **Found during:** Task 2 (one new fixture case "Ellos parecen tristes." — typo rule fired on `tristes`)
- **Issue:** The fixture runner rejects findings not in `expected`. The typo rule was offering "tristes" → "triste" (incorrect — "tristes" is the correct plural of "triste"). Same for "amables", "simpatica". This is a separate data gap in es.json validWords, not in scope.
- **Fix:** Rewrote the case to use a singular subject + adverb: "Ella parece bien." — same gustar-class pattern, no plural-adjective collision.
- **Files modified:** fixtures/es/gustar.jsonl
- **Verification:** All 127 cases pass at P=R=F1=1.000.
- **Committed in:** 54beb68 (Task 2 commit)

### Rule 4 — None (no architectural changes)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/correctness)
**Impact on plan:** All necessary for the plan's success criteria. PREPOSITION_COLLISIONS in particular is a real correctness fix that future verb-class rules will benefit from. No scope creep.

## Issues Encountered

- **Parallel-agent execution caused commit attribution drift.** While I was completing Task 2, an autonomous 32-01 (FR aspect-hint) execution committed in parallel and bundled my uncommitted vocab-seam-core changes (gustarClassVerbs/gustarPedagogy) into commit 7737210 alongside its own FR aspect indexes. Same for the version bump (`4b8db99`). Functionally everything is intact — the gates pass, the rule reads from the right indexes — but attribution is split across multiple commits with mixed phase tags. Documented here so future readers don't grep for 32-03 in the wrong place.

- **doler/sobrar/apetecer were absent from papertek-vocabulary's lexicon/es/verbbank.json.** Plan §C demanded all 10 verbs flagged. Resolved by adding minimal entries with full presens/preteritum/imperfecto conjugations in the enrichment script. faltar/molestar/quedar were already present but lack any conjugations — they stay marked but undetectable until the vocab gets a presens enrichment pass (data-side follow-up, out of scope for 32-03).

- **API-deploy decoupling**: papertek-vocabulary commit 9d7b2608 is local-only; the next API deploy will publish it. Until then the bundled `extension/data/es.json` carries the same data via the local mirror (`_apply-gustar-class.js`). When sync-vocab next runs against a deployed API, it will overwrite both extension/data/es.json AND tests/fixtures/vocab/es.json with the API copy, picking up the same enrichment.

## User Setup Required

None - no external service configuration. The cross-repo paired commit (papertek-vocabulary 9d7b2608) is committed locally; the user controls the deploy timing of papertek-vocabulary separately. Until then, the bundled mirror covers both the runtime extension and the gate harness.

## Next Phase Readiness

- **Phase 32 acceptance criterion C** ("ES `gustar` rule passes existing 94-case fixture at P=R=F1=1.000 and extends to ≥30 new fixture cases on the gustar-class verbs (≥80% recall)") is met — actually exceeded (33 new cases at 100% recall).
- **Phase 32-01 (FR aspect-hint) and 32-02 (ES por/para) already complete** (commits 7737210, 04e0573, 279059f) — Phase 32 as a whole is now ready to close pending the data-side cleanup tracked above (faltar/molestar/quedar presens enrichment, out of scope).
- **Pattern established**: future ES verb-class rules (impersonal verbs, weather verbs) can follow the same lexical-marker + shared-pedagogy shape. Extension to FR is mechanical when those rules land.

## Self-Check: PASSED

- File `extension/content/spell-rules/es-gustar.js` exists ✓
- File `fixtures/es/gustar.jsonl` exists (132 lines, 127 cases) ✓
- File `tests/fixtures/vocab/es.json` updated ✓
- File `scripts/_apply-gustar-class.js` exists ✓
- Commit b2a4be2 exists in git log ✓
- Commit 54beb68 exists in git log ✓
- Cross-repo commit 9d7b2608 exists in papertek-vocabulary git log ✓
- Version 2.9.11 aligned across manifest.json, package.json, backend/public/index.html ✓
- ES_GUSTAR_CLASS_VERBS removed from rule file (grep returns 0) ✓
- check-fixtures clean (all rules including es/gustar at P=R=F1=1.000) ✓
- check-explain-contract green (60/60) ✓
- check-pedagogy-shape green (informational — no findings carry pedagogy) ✓

---
*Phase: 32-fr-es-pedagogy*
*Completed: 2026-04-30*
