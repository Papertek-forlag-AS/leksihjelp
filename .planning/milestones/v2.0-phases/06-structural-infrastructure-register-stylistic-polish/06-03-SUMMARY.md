---
phase: 06-structural-infrastructure-register-stylistic-polish
plan: 03
subsystem: spell-rules
tags: [register, collocation, redundancy, vocab-seam, governance-banks, severity-tiers, seed-data]

# Dependency graph
requires:
  - phase: 06-01
    provides: "ctx.sentences, ctx.suppressedFor.structural, severity contract, P2/P3 CSS tiers"
  - phase: 06-02
    provides: "check-benchmark-coverage gate, check-governance-data gate, expectations.json manifest"
provides:
  - "REG-01 register rule (P2 warn, priority 60) flags colloquialisms when grammar_register enabled"
  - "REG-02 collocation rule (P2 warn, priority 65) flags EN wrong-verb bigrams"
  - "REG-03 redundancy rule (P3 hint, priority 70) flags literal phrase matches across all languages"
  - "vocab-seam governance bank extraction (registerWords, collocations, redundancyPhrases)"
  - "grammar_register feature toggle (defaults OFF)"
  - "Temporary seed data in rule files for testing before papertek-vocabulary sync"
affects: [Phase 7+, papertek-vocabulary data enrichment]

# Tech tracking
tech-stack:
  added: []
  patterns: [data-driven rule with seed fallback, governance bank extraction separate from word-prediction, feature-gated rule opt-in]

key-files:
  created:
    - extension/content/spell-rules/register.js
    - extension/content/spell-rules/collocation.js
    - extension/content/spell-rules/redundancy.js
  modified:
    - extension/content/vocab-seam-core.js
    - extension/content/vocab-seam.js
    - extension/content/spell-check.js
    - extension/manifest.json
    - extension/styles/content.css
    - extension/i18n/strings.js
    - extension/data/grammarfeatures-nb.json
    - extension/data/grammarfeatures-nn.json
    - benchmark-texts/expectations.json
    - scripts/check-fixtures.js
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - scripts/check-spellcheck-features.js

key-decisions:
  - "Temporary seed data in rule files (marked TEMPORARY) allows testing before papertek-vocabulary banks land"
  - "Governance banks extracted separately from word-prediction BANKS array to avoid polluting autocomplete"
  - "REG-01 register rule defaults OFF via grammar_register toggle -- opt-in to avoid false positives in informal contexts"

patterns-established:
  - "Governance bank extraction: registerbank/collocationbank/phrasebank read in buildIndexes but NOT added to BANKS array"
  - "Seed data fallback: rule files include inline seed data when API bank is empty, clearly marked for removal"
  - "Feature-gated rule: check isFeatureEnabled before running, return [] if disabled"

requirements-completed: [REG-01, REG-02, REG-03]

# Metrics
duration: 35min
completed: 2026-04-24
---

# Phase 6 Plan 03: Register, Collocation, and Redundancy Rules Summary

**Three data-driven governance rules (register/collocation/redundancy) with vocab-seam pipeline, seed data fallback, and full gate coverage across P2 warn and P3 hint severity tiers**

## Performance

- **Duration:** ~35 min (across two sessions with checkpoint)
- **Started:** 2026-04-24T19:07:00Z
- **Completed:** 2026-04-24T19:42:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 18

## Accomplishments
- Landed 3 new spell-check rules proving Phase 6 infrastructure (severity tiers, ctx.sentences, suppressedFor.structural)
- REG-02 collocation rule validates the collocationbank data shape that Phase 15 will scale
- All 10 release gates exit 0 with 100% fixture pass rate across 20 language/category suites
- Benchmark expectations populated: EN "make a photo" (P2 collocation) and EN "free gift" (P3 redundancy) confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Vocab-seam data pipeline + rule files + manifest + CSS + grammar toggle** - `b9e0773` (feat)
2. **Task 2: Benchmark expectations + fixture cases + gate extensions** - `ac0386b` (feat)
3. **Task 3: Chrome smoke test -- verify P1/P2/P3 visual tiers** - checkpoint approved (no files changed)

## Files Created/Modified
- `extension/content/spell-rules/register.js` - REG-01 register/colloquialism rule (P2 warn, priority 60)
- `extension/content/spell-rules/collocation.js` - REG-02 collocation-error rule (P2 warn, priority 65)
- `extension/content/spell-rules/redundancy.js` - REG-03 redundancy rule (P3 hint, priority 70)
- `extension/content/vocab-seam-core.js` - Governance bank extraction (registerWords, collocations, redundancyPhrases)
- `extension/content/vocab-seam.js` - Getters for governance indexes
- `extension/content/spell-check.js` - Wired governance getters + isFeatureEnabled to rule context
- `extension/manifest.json` - Added 3 new rule files to content_scripts
- `extension/styles/content.css` - CSS bindings for register (amber), collocation (amber), redundancy (dotted)
- `extension/i18n/strings.js` - grammar_register feature label
- `extension/data/grammarfeatures-nb.json` - grammar_register toggle definition
- `extension/data/grammarfeatures-nn.json` - grammar_register toggle definition
- `benchmark-texts/expectations.json` - Phase 6 rule flip expectations
- `scripts/check-fixtures.js` - Adapter-contract guard for governance fields
- `scripts/check-explain-contract.js` - Added 3 new rules to TARGETS
- `scripts/check-rule-css-wiring.js` - Added 3 new rules to TARGETS
- `scripts/check-spellcheck-features.js` - Governance index key assertions

## Decisions Made
- Temporary seed data in rule files allows testing before papertek-vocabulary banks are created; each seed block is marked `// TEMPORARY: remove after papertek-vocabulary PR lands`
- Governance banks (registerbank, collocationbank, phrasebank) extracted in buildIndexes separately from the BANKS array so they do not pollute word-prediction autocomplete
- REG-01 defaults OFF (grammar_register toggle) to avoid flagging colloquialisms in students' informal writing by default

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 complete: all 3 plans landed (structural infrastructure, release gates, governance rules)
- Governance rules use temporary seed data; when papertek-vocabulary adds registerbank/collocationbank/phrasebank, `npm run sync-vocab` will replace seeds with real data
- Phase 7+ can build on ctx.sentences, suppressedFor.structural, and severity tiers
- REG-02 collocation data shape proven; Phase 15 can scale EN collocations and add NB/DE/ES/FR

---
*Phase: 06-structural-infrastructure-register-stylistic-polish*
*Completed: 2026-04-24*

## Self-Check: PASSED
- extension/content/spell-rules/register.js: FOUND
- extension/content/spell-rules/collocation.js: FOUND
- extension/content/spell-rules/redundancy.js: FOUND
- Commit b9e0773: FOUND
- Commit ac0386b: FOUND
