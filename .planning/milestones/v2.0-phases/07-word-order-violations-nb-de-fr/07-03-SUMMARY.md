---
phase: 07-word-order-violations-nb-de-fr
plan: 03
subsystem: spell-check
tags: [word-order, verb-final, bags, de, fr, fixtures, benchmark]

requires:
  - phase: 07-word-order-violations-nb-de-fr
    provides: ctx.getTagged POS-tagged token view, findFiniteVerb, tokensInSentence helpers
provides:
  - "de-verb-final rule: flags verb not at clause end in DE subordinate clauses"
  - "fr-bags rule: flags BAGS adjectives placed after nouns in FR"
  - ">=32 positive + >=65 acceptance fixtures for each rule"
  - "Benchmark expectations for de.44 and fr.53"
affects: [phase-08, phase-13]

tech-stack:
  added: []
  patterns: [modal-verb-disambiguation, noun-verb-homograph-capitalization-heuristic, verb-noun-article-disambiguation]

key-files:
  created:
    - extension/content/spell-rules/de-verb-final.js
    - extension/content/spell-rules/fr-bags.js
    - fixtures/de/verb-final.jsonl
    - fixtures/fr/bags.jsonl
  modified:
    - extension/manifest.json
    - extension/styles/content.css
    - scripts/check-explain-contract.js
    - scripts/check-rule-css-wiring.js
    - benchmark-texts/expectations.json
    - benchmark-texts/fr.txt

key-decisions:
  - "Modal verbs (kann/muss/soll/will/darf/mag) treated as the true finite verb in modal+infinitive constructions — the modal must be at clause end, not the infinitive"
  - "Capitalized tokens that are in nounGenus are skipped as finite verb candidates in subordinate clause scanning — resolves Regen (noun) vs regen (verb) ambiguity"
  - "FR BAGS: verb/noun homographs (e.g. fait) only treated as nouns when preceded by an article — avoids false positive on Il fait beau"
  - "BAGS forms limited to base forms in validWords for reliable fixture testing — feminine/plural declensions (belle, grande) caught by typo rule first due to deduplication"

patterns-established:
  - "Modal-verb disambiguation in subordinate clauses: check DE_MODALS set to identify which finite verb should be at clause end"
  - "Noun-verb capitalization heuristic: capitalized tokens with nounGenus entries treated as nouns, not verbs (DE-specific)"

requirements-completed: [WO-03, WO-04]

duration: 16min
completed: 2026-04-24
---

# Phase 7 Plan 03: DE Verb-Final + FR BAGS Rules Summary

**DE subordinate-clause verb-final rule (WO-03) and FR BAGS adjective placement rule (WO-04) with full fixture suites, benchmark expectations, and release gate integration**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-24T20:08:34Z
- **Completed:** 2026-04-24T20:24:31Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- de-verb-final rule (priority 67, severity warning) flags verb not at clause end in DE subordinate clauses, with modal+infinitive disambiguation and noun/verb capitalization heuristic
- fr-bags rule (priority 68, severity hint) flags BAGS adjectives placed after nouns in FR, with verb/noun homograph resolution via article detection
- 32 positive + 65 acceptance fixtures per rule (2x ratio requirement met)
- Benchmark expectations registered for de.44 and fr.53; all 4 benchmark expectations pass
- All 6 release gates green (fixtures, explain-contract, CSS wiring, network silence, benchmark coverage, bundle size)

## Task Commits

Each task was committed atomically:

1. **Task 1: DE verb-final + FR BAGS rule files with fixture suites** - `9e8203b` (feat)
2. **Task 2: Manifest, CSS, TARGETS, benchmark expectations** - `c8148c8` (feat)

## Files Created/Modified
- `extension/content/spell-rules/de-verb-final.js` - DE subordinate clause verb-final rule
- `extension/content/spell-rules/fr-bags.js` - FR BAGS adjective placement rule
- `fixtures/de/verb-final.jsonl` - 32 positive + 65 acceptance DE verb-final fixtures
- `fixtures/fr/bags.jsonl` - 32 positive + 65 acceptance FR BAGS fixtures
- `extension/manifest.json` - Added both rule files to content_scripts
- `extension/styles/content.css` - CSS dot bindings (amber for de-verb-final, dotted for fr-bags)
- `scripts/check-explain-contract.js` - Added both rules to TARGETS
- `scripts/check-rule-css-wiring.js` - Added both rules to TARGETS
- `benchmark-texts/expectations.json` - Added de.44 and fr.53 expectations
- `benchmark-texts/fr.txt` - Added line 53 with BAGS violation
- `benchmark-texts/de.txt` - Committed to git (already had verb-final violations)

## Decisions Made
- Modal verbs treated as true finite verb in modal+infinitive constructions — resolves "ob er schwimmen kann" (correct) vs "ob er kann schwimmen" (error)
- Capitalized noun/verb homographs resolved via German capitalization convention — "Regen" (noun) not flagged as misplaced verb
- FR verb/noun homographs like "fait" only treated as noun when preceded by article — "Il fait beau" not falsely flagged
- BAGS fixture positive cases use base forms (grand, bon, petit) that are in validWords, since feminine/plural declensions (belle, grande) are not in the FR vocab data and get caught by the typo rule first

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Modal+infinitive false positive in subordinate clauses**
- **Found during:** Task 1
- **Issue:** "ob er schwimmen kann" flagged schwimmen (both schwimmen and kann are in knownPresens); findFiniteVerb returned the first one
- **Fix:** Collect all finite verbs; if a modal is present, it must be the one at clause end. Check DE_MODALS set.
- **Files modified:** extension/content/spell-rules/de-verb-final.js
- **Committed in:** 9e8203b

**2. [Rule 1 - Bug] Noun/verb homograph false positive (Regen/regen)**
- **Found during:** Task 1
- **Issue:** "sobald der Regen aufhört" flagged Regen as misplaced verb because regen is in knownPresens
- **Fix:** Skip capitalized tokens that are in nounGenus (DE nouns are always capitalized)
- **Files modified:** extension/content/spell-rules/de-verb-final.js
- **Committed in:** 9e8203b

**3. [Rule 1 - Bug] FR verb/noun homograph false positive (Il fait beau)**
- **Found during:** Task 1
- **Issue:** "Il fait beau" flagged beau because fait is both in nounGenus (le fait) and knownPresens
- **Fix:** If preceding token is both noun and verb, only treat as noun when preceded by an article
- **Files modified:** extension/content/spell-rules/fr-bags.js
- **Committed in:** 9e8203b

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
- Many BAGS adjective feminine/plural forms (belle, grande, petite, bonne, jolie) are not in FR validWords, so the typo rule catches them before fr-bags fires. This limits fr-bags to flagging base forms only (grand, bon, petit, etc.) when used post-nominally. Fixture suite designed around this constraint.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both word-order rules ready for production
- Phase 7 complete (Plans 01, 02, 03 all done) pending 07-02 parallel execution
- All release gates passing

---
*Phase: 07-word-order-violations-nb-de-fr*
*Completed: 2026-04-24*

## Self-Check: PASSED
