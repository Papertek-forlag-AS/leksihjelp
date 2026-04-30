---
phase: 32-fr-es-pedagogy
plan: 02
subsystem: spell-rules
tags: [pedagogy, lexicon, es, por-para, prep-pedagogy, cross-repo, papertek-vocabulary]

requires:
  - phase: 26-laer-mer-pedagogy-ui
    provides: spell-check-popover renderPedagogyPanel + ctx.vocab.prepPedagogy builder (language-agnostic)
provides:
  - "ES por_prep + para_prep pedagogy blocks (summary/explanation/examples/common_error/subtypes) in papertek-vocabulary lexicon"
  - "Synced pedagogy data on extension/data/es.json (mirrors lexicon edit pre-deploy)"
  - "Refactored es-por-para.js: zero inline pedagogy strings; reads from ctx.vocab.prepPedagogy"
  - "Pattern for ES lexical-entry pedagogy (vs DE-only prior art)"
affects: [32-03, 32-laer-mer, future-fr-pedagogy]

tech-stack:
  added: []
  patterns:
    - "ES pedagogy on lexical entry (por_prep / para_prep) — first non-DE consumer of ctx.vocab.prepPedagogy"
    - "Subtype-keyed nb/nn templates with {fix}/{wrong} substitution at finding-emit time"
    - "Pedagogy block on finding (Phase 26 contract); explain() returns pre-templated {nb,nn}"

key-files:
  created:
    - .planning/phases/32-fr-es-pedagogy/32-02-SUMMARY.md
    - .planning/phases/32-fr-es-pedagogy/deferred-items.md
  modified:
    - extension/content/spell-rules/es-por-para.js
    - extension/data/es.json
    - extension/manifest.json
    - package.json
    - backend/public/index.html
    # cross-repo (papertek-vocabulary):
    - papertek-vocabulary/vocabulary/core/es/generalbank.json
    - papertek-vocabulary/vocabulary/lexicon/es/generalbank.json

key-decisions:
  - "Followed Phase 26 finding.pedagogy contract over plan's <interfaces> proposal of explain()-returns-pedagogy. Reasons: spell-check.js renderPedagogyPanel reads finding.pedagogy directly (not explain().pedagogy); de-prep-case.js is the canonical Phase 26 reference; avoids breaking check-explain-contract without an additive branch."
  - "ES pedagogy uses semantic_category: 'preposition' (no DE-style 'case' field). check-pedagogy-shape's case-validator doesn't reject because its synthetic ctx ('durch die Schule') doesn't trigger es-por-para patterns — gate exits informational-PASS."
  - "Subtype keys (purpose / beneficiary / deadline / duration) mirror the rule's existing patternType discriminators verbatim — no rename, lookup is `pedagogy.subtypes[finding.patternType]` (single predictable line)."
  - "Pedagogy lives on the *target* preposition (the suggested fix), not the wrong one — pedagogy explains the correct form. para_prep carries purpose/beneficiary/deadline; por_prep carries duration."
  - "Side-patched extension/data/es.json directly (in lockstep with the papertek-vocabulary lexicon edit) because the deployed Vercel API hasn't picked up the change yet. A future sync-vocab post-deploy is a no-op for this surface."

patterns-established:
  - "ES lexical-entry pedagogy: shape mirrors DE preps (summary/explanation/examples/common_error/context_hint) plus an additional `subtypes` map keyed by the rule's patternType discriminators with {fix}/{wrong} placeholder substitution"
  - "Cross-repo data-edit + side-patch: when papertek-vocabulary deploy is out-of-band, edit lexicon AND mirror into extension/data/{lang}.json in the same plan; document so the next sync is a recognised no-op"

requirements-completed: [PHASE-32-B]

duration: 12min
completed: 2026-04-30
---

# Phase 32 Plan 02: ES por/para pedagogy migration Summary

**Migrated 5 inline `{nb, nn}` pedagogy strings from `es-por-para.js` into structured `por_prep.pedagogy` / `para_prep.pedagogy` blocks on papertek-vocabulary's ES lexicon, refactored the rule to read pedagogy from `ctx.vocab.prepPedagogy`, and held the 50-case fixture at P=R=F1=1.000 through the migration.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-30T18:55:58Z
- **Completed:** 2026-04-30T19:08:00Z (approx)
- **Tasks:** 2/2
- **Files modified:** 5 (leksihjelp) + 2 (papertek-vocabulary)

## Accomplishments

- ES is now the second language to ship lexical-entry pedagogy (DE was first via Phase 26). Unblocks the dictionary popover and the Phase 26 Lær mer surface from also showing por/para teaching content.
- Detection logic byte-for-byte equivalent — the regression-lock fixture (50 cases) holds at P=R=F1=1.000.
- Inline `nb:` count in `es-por-para.js` dropped from 5 to 0 (only the structured lookup + a defensive fallback line remain).
- Pedagogy block design is mirror-of-DE: `summary`/`explanation`/`examples` (with `correct`/`incorrect`/`translation`/`note`)/`common_error`/`context_hint`/`semantic_category`/`subtypes`/`related_phenomena`.

## Task Commits

1. **Task 1: Audit + author pedagogy data + sync** - papertek-vocabulary `84111f5c` (feat) + leksihjelp `04e0573` (feat)
2. **Task 2: Refactor rule + version bump + package** - leksihjelp `279059f` (feat)

**Plan metadata:** to be added by final commit (this SUMMARY + STATE + ROADMAP).

## Files Created/Modified

- `extension/content/spell-rules/es-por-para.js` — Refactored: zero inline pedagogy strings, reads from `ctx.vocab.prepPedagogy`, attaches `pedagogy` block to findings, pre-templates `explainNb`/`explainNn` from `pedagogy.subtypes[patternType]` with `{fix}`/`{wrong}` substitution. **Line count: 249 → 287** (additive — added comments + `attachExplain` helper + `templateFromSubtype` helper; the inline strings savings are offset by the templating infrastructure, but the file is now data-driven rather than string-encoded).
- `extension/data/es.json` — Added `pedagogy` blocks on `por_prep` and `para_prep` under `generalbank` (side-patched from the lexicon edit).
- `papertek-vocabulary/vocabulary/lexicon/es/generalbank.json` — The canonical API-served source: same pedagogy blocks added.
- `papertek-vocabulary/vocabulary/core/es/generalbank.json` — The pre-enrichment authoring source: same pedagogy blocks added.
- `extension/manifest.json` — version 2.9.9 → 2.9.10.
- `package.json` — version 2.9.9 → 2.9.10.
- `backend/public/index.html` — landing-page version display 2.9.9 → 2.9.10.
- `.planning/phases/32-fr-es-pedagogy/deferred-items.md` — created to log out-of-scope failures from in-flight 32-01 / 32-03 work.

## Decisions Made

1. **Pedagogy on finding, not on explain() return** — followed established Phase 26 contract instead of the plan's `<interfaces>` block proposal. The popover renderer reads `finding.pedagogy`, and de-prep-case (the canonical reference) attaches via the finding. This keeps `check-explain-contract` happy without needing the additive validator branch the plan optimistically referenced.

2. **Skipped DE-style `case` field** — `por`/`para` aren't case-bearing prepositions in Spanish. Used `semantic_category: "preposition"` instead. The `check-pedagogy-shape` gate's strict case validator doesn't reject ES findings because its synthetic ctx (`'durch die Schule'`) doesn't trigger es-por-para's patterns; gate exits informational-PASS.

3. **Subtypes mirror patternType verbatim** — `purpose`/`beneficiary`/`deadline`/`duration` keys match the rule's existing `finding.patternType` strings exactly. Lookup is a single line. No rename pressure on the rule's discriminator scheme.

4. **Pedagogy on the suggested-fix preposition** — `para_prep.pedagogy.subtypes` carries the patterns where the rule suggests "para"; `por_prep.pedagogy.subtypes` carries the patterns where it suggests "por". The pedagogy block always explains the correct form.

5. **Side-patched es.json** — the papertek-vocabulary deploy is out-of-band for this plan, but `npm run sync-vocab:es` would re-pull the deployed (pre-pedagogy) data, undoing the migration. Mirrored the lexicon edit directly into `extension/data/es.json`. The next post-deploy sync is a recognised no-op for this surface.

## Deviations from Plan

### Plan-text deviation (architectural call)

**1. [Rule 4-adjacent — minor architectural call] Used finding.pedagogy contract instead of explain()-returns-pedagogy**
- **Found during:** Task 2 (refactor design)
- **Issue:** Plan `<interfaces>` block proposed `explain()` returning `{ nb, nn, pedagogy }`. The codebase's established Phase 26 pattern attaches pedagogy directly to findings; `spell-check.js renderPedagogyPanel` consumes `finding.pedagogy` (not `explain().pedagogy`); `check-explain-contract` strictly validates `explain()` returns `{nb: string, nn: string}`.
- **Fix:** Followed the established codebase pattern. `attachExplain(f, prepPedagogy)` sets `f.pedagogy` (full block) + `f.explainNb`/`f.explainNn` (pre-templated subtype strings). `explain(finding)` returns `{ nb: finding.explainNb || finding.message || fallback, nn: ... }`.
- **Verification:** check-fixtures es/por-para passes 50/50; check-explain-contract passes 59/59; check-pedagogy-shape passes (informational).
- **Committed in:** 279059f

### Auto-fixed issues

None within scope. Pre-existing failures from in-flight 32-01 / 32-03 work (es-gustar fixture R=0.086, es-personal-a R=0.970, benchmark-coverage 39/40) were verified out-of-scope by stash-test and logged to `deferred-items.md`.

---

**Total deviations:** 1 architectural (followed established codebase pattern over plan-text proposal).
**Impact on plan:** Better outcome than the plan's proposed shape. No scope creep.

## Issues Encountered

- **`npm run sync-vocab:es` re-pulls from deployed API**, not the local papertek-vocabulary repo. The deployed Vercel API didn't have the new pedagogy data, so a sync would have undone the migration. Resolved by side-patching `extension/data/es.json` directly in the same plan (with a recognised future-sync-is-no-op note in the commit message). This is the same pattern used by 32-03's `chore: one-off mirror script`.
- **Other ES fixtures regressed in the working tree** during the gate sweep (gustar R=0.086, personal-a R=0.970). Confirmed via stash-test these are uncommitted in-flight 32-01 / 32-03 work, not caused by 32-02. Logged to `deferred-items.md`. The 32-02 contract holds: my changes alone keep the full ES fixture suite green.

## User Setup Required

None — no external service configuration changed. The papertek-vocabulary deploy that propagates the lexicon edit (commit `84111f5c`) is the only out-of-band step, and 32-02's side-patch makes leksihjelp ship-able without it.

## Next Phase Readiness

- 32-03 (gustar-class migration + extension) can land independently. No coupling to 32-02 beyond shared cross-repo workflow.
- The Lær mer panel will surface por/para pedagogy when a student triggers an es-por-para finding (no further wiring needed; the popover already reads `finding.pedagogy`).
- Future ES rules (e.g. 32-future imperfecto-hint pedagogy migration) can follow the same `subtypes` pattern established here.

## Self-Check: PASSED

- FOUND: extension/data/es.json (por_prep.pedagogy + para_prep.pedagogy populated)
- FOUND: extension/content/spell-rules/es-por-para.js
- FOUND: leksihjelp commit 04e0573 (Task 1)
- FOUND: leksihjelp commit 279059f (Task 2)
- FOUND: papertek-vocabulary commit 84111f5c (cross-repo Task 1)

---
*Phase: 32-fr-es-pedagogy*
*Completed: 2026-04-30*
