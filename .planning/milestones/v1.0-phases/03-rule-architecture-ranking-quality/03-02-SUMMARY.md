---
phase: 03-rule-architecture-ranking-quality
plan: 02
subsystem: infra
tags: [spell-check, plugin-registry, refactor, infra-03, manifest-v3, dual-load]

# Dependency graph
requires:
  - phase: 01-foundation-vocab-seam-regression-fixture
    provides: vocab-seam buildIndexes() (rules read vocab.{nounGenus, verbInfinitive, validWords, typoFix, compoundNouns}); fixture runner harness; rule_id field contract
  - phase: 03-rule-architecture-ranking-quality plan 01
    provides: vocab.freq Map populated for NB/NN (consumed by Plan 03's Zipf tiebreaker that lands inside nb-typo-fuzzy.js next)
provides:
  - Plugin registry under extension/content/spell-rules/
  - Five self-contained rule files (gender, modal-verb, sarskriving, typo-curated, typo-fuzzy) registered via self.__lexiSpellRules
  - Generic runner in spell-check-core.js that filters by language and sorts by priority
  - Shared helpers exposed on self.__lexiSpellCore (tokenize, editDistance, matchCase, dedupeOverlapping, sharedPrefixLen, sharedSuffixLen, isAdjacentTransposition, isLikelyProperNoun, scoreCandidate, findFuzzyNeighbor)
  - Empty-registry guard in scripts/check-fixtures.js (Pitfall 1 defense)
affects:
  - Plan 03-03 (next rule work — adds rules without touching core)
  - Plan 03-04 (WP-01 word-prediction freq signal — different consumer, but pattern reusable)
  - Phase 4 SC-02/SC-03/SC-04 (each becomes a new rule file under spell-rules/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plugin registry via self.__lexiSpellRules array of {id, languages, priority, check, explain}
    - Dual-load guard pattern (const host = typeof self !== 'undefined' ? self : globalThis) for Node-require + MV3 content-script symmetry
    - Empty-registry runtime assertion in fixture runner — fails loud on silent dual-load failures
    - Belt-and-braces registry init (core ALSO sets host.__lexiSpellRules = host.__lexiSpellRules || []) so rule files load before/after core both work

key-files:
  created:
    - extension/content/spell-rules/README.md
    - extension/content/spell-rules/nb-gender.js
    - extension/content/spell-rules/nb-modal-verb.js
    - extension/content/spell-rules/nb-sarskriving.js
    - extension/content/spell-rules/nb-typo-curated.js
    - extension/content/spell-rules/nb-typo-fuzzy.js
  modified:
    - extension/content/spell-check-core.js (slimmed to runner + shared helpers; constants moved out)
    - extension/manifest.json (5 new content_scripts entries between core and DOM adapter)
    - scripts/check-fixtures.js (readdirSync rule loader + empty-registry guard)

key-decisions:
  - Rule.id values 'gender' / 'modal_form' / 'sarskriving' / 'typo' / 'typo' (curated and fuzzy share id='typo' deliberately) preserve the emitted finding rule_id contract — fixture files reference these names; renaming would break Plan 1's locked finding shape
  - Priority values 10/20/30/40/50 chosen with gaps so future rules can slot in without renumbering; preserves current evaluation order so dedupeOverlapping behaviour is byte-identical
  - Shared helpers (isLikelyProperNoun, scoreCandidate, findFuzzyNeighbor, sharedPrefixLen, sharedSuffixLen, isAdjacentTransposition) live in core not in a separate helpers file — single source of truth, exposed via self.__lexiSpellCore for rule-file reuse
  - Belt-and-braces registry init in core (host.__lexiSpellRules = host.__lexiSpellRules || []) chosen over strict load-order requirement — manifest currently loads core first but a future drift would silently break rules; this guard makes order tolerant
  - check-fixtures empty-registry guard throws BEFORE any case runs — guards against the worst silent failure mode (rules don't register → runner reports vacuous F1=1.000)

patterns-established:
  - Pattern: Plugin registry via self-registering IIFE files. Each file pushes {id, languages, priority, check, explain} onto self.__lexiSpellRules. Runner filters by language, sorts by priority, calls rule.check(ctx). Reusable for any future "list of strategies dispatched by context" need (e.g. word-prediction ranking strategies).
  - Pattern: Dual-load guard preamble. Every rule file starts with 'const host = typeof self !== undefined ? self : globalThis; host.__lexiSpellRules = host.__lexiSpellRules || [];'. Required because the same file loads in MV3 content-script context (where self is the global) and in Node fixture harness (where self is undefined). Forgetting silently breaks Node-side tests.
  - Pattern: Empty-registry runtime guard in test harness. After loading rule files via readdirSync, the runner throws if registry is empty. Without this, a regression that breaks rule registration produces vacuous green tests. Mirrors the self-test pattern for release gates (Plan 03-05).
  - Pattern: Optional-target collectFiles auto-discovery (already established in Plan 03-05 for check-network-silence) — applies here too: scripts/check-fixtures.js readdirSync()s spell-rules/ unconditionally. Adding a new rule file under that directory is automatically picked up; no edit to the fixture runner.

requirements-completed: [INFRA-03]

# Metrics
duration: 5m
completed: 2026-04-19
---

# Phase 03 Plan 02: Spell-check rule plugin registry (INFRA-03) Summary

**Refactored five inline spell-check rules into self-registering plugin files under extension/content/spell-rules/, with the runner in spell-check-core.js iterating self.__lexiSpellRules sorted by priority — adding a new rule is now one new file + one manifest line, zero edits to core.**

## Performance

- **Duration:** 4m 53s
- **Started:** 2026-04-19T09:35:05Z
- **Completed:** 2026-04-19T09:39:58Z
- **Tasks:** 2
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- Five rule files extracted from the monolithic check() body into extension/content/spell-rules/ — each self-registering via IIFE
- spell-check-core.js slimmed: ARTICLE_GENUS / GENUS_ARTICLE / MODAL_VERBS / SARSKRIVING_BLOCKLIST removed (now owned by their rule files); generic runner replaces the 130-line inline rule cascade
- Dual-load guard codified in every rule file + the README, with an empty-registry runtime assertion in the fixture runner as defense-in-depth
- Zero semantic regression: 138/138 fixtures still pass, finding rule_id contract preserved (gender / modal_form / sarskriving / typo)
- nb-typo-fuzzy.js prepared as the host file for Plan 03's Zipf tiebreaker (SC-01) — Plan 03 will add scoring there without touching core
- check-bundle-size still passes (10.12 MiB / 9.88 MiB headroom); check-network-silence auto-discovers new rule files via Plan 03-05's optional-target pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract five rule files + README, export shared helpers from core** — `ada37cc` (refactor)
2. **Task 2: Register rule files in manifest + fixture runner, assert zero regression** — `7da1f6e` (feat)

**Plan metadata:** [pending after this SUMMARY commit]

## Files Created/Modified

- `extension/content/spell-rules/README.md` — Plugin registry documentation: priority semantics, dual-load guard rationale, how-to-add-a-rule
- `extension/content/spell-rules/nb-gender.js` — Article-noun gender mismatch rule (priority 10, rule_id='gender')
- `extension/content/spell-rules/nb-modal-verb.js` — Modal verb + non-infinitive rule (priority 20, rule_id='modal_form')
- `extension/content/spell-rules/nb-sarskriving.js` — Compound noun særskriving rule (priority 30, rule_id='sarskriving')
- `extension/content/spell-rules/nb-typo-curated.js` — Curated typoFix lookup rule (priority 40, rule_id='typo')
- `extension/content/spell-rules/nb-typo-fuzzy.js` — Damerau-Levenshtein fuzzy neighbor rule (priority 50, rule_id='typo'); host for Plan 03 Zipf scoring
- `extension/content/spell-check-core.js` — Slimmed: removed all rule-owned constants and inline rule bodies; replaced check() body with generic runner that iterates self.__lexiSpellRules; expanded self.__lexiSpellCore to expose all shared helpers (isLikelyProperNoun, scoreCandidate, findFuzzyNeighbor, sharedPrefixLen, sharedSuffixLen, isAdjacentTransposition) for rule-file reuse; added belt-and-braces self.__lexiSpellRules = [] init in dual-export footer
- `extension/manifest.json` — Inserted 5 spell-rules/*.js entries between content/spell-check-core.js (registry init) and content/spell-check.js (DOM adapter), alphabetical for grep-ability
- `scripts/check-fixtures.js` — Added SPELL_RULES_DIR readdirSync sweep that requires every *.js file in alphabetical order after spell-check-core.js; throws if registry remains empty post-load (Pitfall 1 silent-failure guard)

## Decisions Made

- **Rule registry IDs preserved as 'typo' for both curated and fuzzy** — they're emitted as the finding's rule_id, which fixture files reference. Renaming to typo_curated/typo_fuzzy would break the Plan 1 finding contract. The two id='typo' entries are deliberate and the verify command's expected list reflects this.
- **Priority gaps of 10** between rules — leaves room for future rule insertions without renumbering existing rules. Mirrors database-migration-style versioning.
- **Shared helpers stay in core, not a separate helpers file** — exposed via self.__lexiSpellCore so rule files can reuse without redeclaring. Single source of truth; one less file to maintain. Plan explicitly required moving isLikelyProperNoun / scoreCandidate / findFuzzyNeighbor INTO core (they were already there pre-refactor, just not exposed on the public API).
- **Empty-registry guard in fixture runner over silent skip** — if no rules are registered, the runner throws with a clear message pointing at dual-load guards. Without this, a broken refactor would produce "all green" results because no rules means no findings means missing-expected-only failures, but if fixtures had no expectations the runner would happily report F1=1.000.
- **Belt-and-braces registry init in core's footer** — core's footer ALSO sets host.__lexiSpellRules = host.__lexiSpellRules || []. Combined with each rule file's preamble doing the same, this means correct behavior regardless of load order. Defensive against future manifest drift.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added cursor-position skip to extracted rule files**
- **Found during:** Task 1 (creating the four non-gender rule files)
- **Issue:** The plan's gender rule template included the `if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;` skip, but the action steps for modal/sarskriving/typo-curated/typo-fuzzy said "lifted verbatim" without explicitly preserving the cursor skip. The original inline check() body had a single cursor skip near the top of the per-token loop (line 109) that protected ALL five rules. Without preserving it in each extracted rule, the live editor would start flagging incomplete words mid-typing — a regression the fixture suite couldn't catch (fixtures have no cursorPos).
- **Fix:** Each of the five rule files now performs the same `cursorPos` skip inside its own per-token loop. Functionally equivalent to the pre-refactor single skip.
- **Files modified:** All five spell-rules/*.js files
- **Verification:** Visual inspection confirms each rule has the skip; fixtures still 138/138 (no behavior change with cursorPos=undefined).
- **Committed in:** ada37cc (Task 1 commit)

### Soft criterion not met

**Success criterion "core ≤60% of pre-refactor size" achieved 71% (10,234 / 14,363 bytes)**
- **Why:** The plan also required moving isLikelyProperNoun / scoreCandidate / findFuzzyNeighbor INTO the core IIFE so all rule files can reuse them. Those three helpers (~80 lines) plus the new runner (~35 lines) plus expanded module documentation explaining the new architecture pushed the total above 60%. The hard requirement "all rule-owned constants and rule bodies are out of core" is met (zero hits for MODAL_VERBS / ARTICLE_GENUS / SARSKRIVING_BLOCKLIST).
- **Decision:** Accept 71%. The 60% target was an estimate; the structural refactor goal (constants + rule bodies extracted, generic runner installed) is met. The retained helpers are by design — they're shared infrastructure all rules use.

---

**Total deviations:** 1 auto-fix (Rule 2 - Missing Critical)
**Impact on plan:** Auto-fix prevents a live-editor regression that the fixture suite cannot detect. No scope creep. Soft size target not met but explained.

## Issues Encountered

- None.

## User Setup Required

None - this is a pure structural refactor; no external service configuration touched.

## Next Phase Readiness

- **Plan 03 (next in Wave 2)** can now extend `extension/content/spell-rules/nb-typo-fuzzy.js` with the Zipf frequency tiebreaker (SC-01) — one file edit, zero changes to spell-check-core.js or other rule files. The fuzzy rule already imports `findFuzzyNeighbor` from `host.__lexiSpellCore`; the Zipf scoring can either be added inside `findFuzzyNeighbor` (cleaner, reusable) or alongside it in the rule file.
- **Future SC-02/SC-03/SC-04 work in Phase 4** follows the same one-file-per-rule pattern — copy the IIFE preamble + shape from any existing nb-*.js, register a unique id, set a priority, drop into manifest + done.
- **Plan 04 (WP-01)** is unaffected by this refactor — word-prediction has its own seam and code path; this refactor stays inside the spell-check surface only.

## Self-Check: PASSED

All claimed files exist; both task commits (ada37cc, 7da1f6e) present in git history.

---
*Phase: 03-rule-architecture-ranking-quality*
*Completed: 2026-04-19*
