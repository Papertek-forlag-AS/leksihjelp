---
phase: 33-v3.1-cleanup
plan: 01
subsystem: popup-views
tags: [refactor, lockdown-integration, dict-state, phase-30-04-followup]
requires:
  - extension/popup/dict-state-builder.js (existed; extended)
  - extension/content/vocab-seam-core.js (buildIndexes — pre-existing dependency)
provides:
  - extension/popup/dict-state-builder.js#buildDictState (new pure-function entry point)
  - extension/popup/dict-state-builder.js#buildInflectionIndex (lifted from popup.js)
affects:
  - extension/popup/popup.js (loadDictionary refactored to delegate)
  - extension/popup/popup.html (dict-state-builder.js loaded before dictionary-view.js)
  - /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js (full populateDictState — STAGED, not committed)
tech-stack:
  added: []
  patterns:
    - "pure dependency-injected state builder (mirrors check-popup-deps contract)"
    - "i18n-aware mappers passed as opts so the same builder serves popup (translated labels) and lockdown (raw codes)"
key-files:
  created:
    - extension/popup/dict-state-builder.test.js (6 unit tests)
  modified:
    - extension/popup/dict-state-builder.js (+~210 lines: buildDictState + buildInflectionIndex)
    - extension/popup/popup.js (-~120 lines net: dead inline copies removed; loadDictionary refactored)
    - extension/popup/popup.html (added dict-state-builder.js script tag)
    - package.json (test:dict-state-builder npm script)
decisions:
  - "Forward optional posMapper/genusMapper through buildDictState into flattenBanks for both raw + sister dicts. Popup wants translated UI labels; lockdown wants raw codes. Both consumers share the same state-build path with zero behaviour divergence."
  - "Module-internal buildInflectionIndex (lifted from popup.js verbatim) — vocabCore can override via buildInflectionIndex if it ever exposes one, but today none ships. Keeps the lockdown sidepanel from depending on vocab-seam-core for inflection."
  - "Defer lockdown commit to Plan 33-03 per plan instructions: cross-repo work coordinates with version bump + sync re-run in 33-02. Sidepanel-host change is staged in /Users/geirforbord/Papertek/lockdown but not committed."
  - "Auto-mode auto-approved Task 4 UAT checkpoint. Manual lockdown sidepanel verification deferred (matches Phase 30-01/30-02/27-03 precedent — 9-step walkthrough listed in plan <how-to-verify>)."
metrics:
  duration: 32 minutes
  tasks_completed: 4
  files_changed: 5
  commits: 2
  completed_date: 2026-04-30
---

# Phase 33 Plan 01: Lift dict-state-builder to full state + lockdown sidepanel parity Summary

Lifted popup.js's inline NB-enrichment / inflection-index / bidirectional `_generatedFrom` walk into a pure shared `buildDictState` function on `extension/popup/dict-state-builder.js`, refactored `popup.js#loadDictionary` to delegate, and updated the lockdown sidepanel host's `populateDictState` to use it — closing Phase 30-04's B-blocker on lockdown prod-merge (search returning empty, hardcoded "ES" direction toggle, missing two-way translations).

## What Shipped

### `buildDictState({ raw, sisterRaw, lang, noLang, vocabCore, posMapper?, genusMapper? })`

Pure function returning `{ allWords, inflectionIndex, nounGenusMap, currentIndexes, noWords, noNounGenusMap, nbEnrichmentIndex, nbTranslationIndex, nbIdToTargetIndex }`.

Replaces these popup.js inline definitions (now removed):
- `flattenBanks(dict)` — popup-side wrapper that called i18n `bankToPos` / `genusToGender`. Builder version accepts those as `posMapper` / `genusMapper` opts.
- `buildInflectionIndex(words)` — full conjugation/plural/case/typo/acceptedForms walker.
- `BANK_TO_POS` constant (10 banks).
- `NORWEGIAN_IRREGULAR_VERBS` map + `norwegianInfinitive(form)`.
- `generatedFromRefs(entry)`.

Kept in popup.js (i18n-aware, popup-only):
- `bankToPos(bank)` and `genusToGender(genus)` — these call `t()` to produce translated UI labels and are passed *into* `buildDictState` as the i18n mappers.
- `getTranslation(entry)` — popup's wrapper that closes over `viewState` + `getUiLanguage()`. The shared builder's `getTranslation(entry, state, uiLang)` already exists; popup chose to keep its own wrapper because the dictionary view passes `(entry, _state, _uiLang) => getTranslation(entry)` through buildVocabAdapter.

### Lockdown sidepanel host (`leksihjelp-sidepanel-host.js`)

`populateDictState` now calls `builder.buildDictState({...})` and `Object.assign(viewState, state)` — replacing the 2.8.2 stub that only filled `allWords`. After this:
- inflectionIndex populated → conjugation lookups work
- nounGenusMap populated → compound decomposition works
- noWords + nbEnrichmentIndex + nbTranslationIndex + nbIdToTargetIndex populated → two-way translation resolves
- `dictHandle.updateLangLabels?.()` already fires after populateDictState (existing IIFE on initial mount + LANGUAGE_CHANGED listener) → direction toggle target-lang-code spans rewrite from hardcoded "ES" to actual current pair

**STATUS: STAGED, NOT COMMITTED.** Per plan, Plan 33-02 will re-run lockdown's `sync-leksihjelp.js` to mirror the new dict-state-builder.js and Plan 33-03 will land the coordinated cross-repo commit + version bump.

### Exam-profile ordbok-hide bug — investigated, NOT FOUND

Plan flagged "exam profile hides ordbok tab" as a B-blocker. **Investigation result: this is no longer present in current code.** `getSpellEngineEnvelope('exam')` in `lockdown/public/js/writing-test/shared/resource-profile.js:213-220` returns `{ leksihjelp: true, lexinIframe: true, ... }`. `applyEnvelopeToDOM` in writing-environment.js only hides the leksihjelp tab when `!envelope.leksihjelp`. So in EXAM profile the ordbok tab IS visible.

This was likely already fixed in Phase 29 when `leksihjelp_exam` was merged into `exam` (per the resource-profile.js comment: "Post-redesign 2026-04-30: exam is now the single exam-locked profile. exam now boots the leksihjelp bundle in exam mode (typos-only spellcheck) but keeps the resource panel and the leksihjelp dictionary in the sidepanel available."). The audit memo flagging this as outstanding for 33-01 was stale.

No code change made; flagged here for the UAT walkthrough to confirm.

## Test Coverage

`extension/popup/dict-state-builder.test.js` — 6 unit tests:

1. `buildDictState({raw, lang, vocabCore})` — flatten + empty NB maps + populated nounGenusMap.
2. sisterRaw with `linkedTo.de.primary` + `falseFriends` → `nbEnrichmentIndex` keyed correctly.
3. sister `_generatedFrom: 'de-nb/nounbank:schule_noun'` → `nbTranslationIndex.get('schule_noun') === 'skole'`.
4. target `_generatedFrom: 'nb-de/nounbank:skole_noun'` → `nbIdToTargetIndex.get('skole_noun') === 'schule_noun'`.
5. vocabCore undefined → falls back to module-internal `buildInflectionIndex`, `nounGenusMap` defaults to empty Map, `currentIndexes` is null.
6. sisterRaw=null (same-lang case) → all NB indexes empty.

All 6 pass. `npm run test:popup-views` (8 tests) and `npm run check-popup-deps` (4 view modules) also remain green.

## Lockdown sync follow-up

**Plan 33-02 must re-run** `cd /Users/geirforbord/Papertek/lockdown && node scripts/sync-leksihjelp.js` to copy the updated `extension/popup/dict-state-builder.js` (now containing buildDictState + buildInflectionIndex) into `lockdown/public/leksihjelp/popup/dict-state-builder.js`. Without the sync, the lockdown sidepanel host's `getBuilder().buildDictState` call will be undefined and search will fail with the same empty-state symptom Plan 30-04 shipped.

The sync-leksihjelp.js script already copies `dict-state-builder.js` (added in Phase 30-04 Task 4 via `npm run sync-leksihjelp`); just re-running the sync picks up the new exports.

## Deviations from Plan

### None substantive — plan executed as written.

Minor:
- The plan suggested adding `buildInflectionIndex` would be "in vocab-seam-core (already exposed via self.__lexiVocabCore); if so, buildDictState just calls vocabCore.buildInflectionIndex(allWords)." Confirmed via grep that vocab-seam-core does NOT expose `buildInflectionIndex`. Lifted the implementation from popup.js into dict-state-builder.js verbatim (the cleanest separation: popup keeps i18n labels, builder owns the data layer).
- Plan suggested `genusToGender` and `bankToPos` could be renamed locally "to avoid clashing with the raw-code BANK_TO_POS now imported." No rename was needed — popup.js no longer references the constant `BANK_TO_POS` directly (the only remaining call site reaches `self.__lexiDictStateBuilder.BANK_TO_POS`). The two `*ToGender`/`*ToPos` helpers stayed under their existing names.

## Self-Check: PASSED

Files verified to exist:
- `extension/popup/dict-state-builder.js` (extended)
- `extension/popup/dict-state-builder.test.js` (created, 6 tests pass)
- `extension/popup/popup.js` (refactored)
- `extension/popup/popup.html` (script tag added)
- `package.json` (test:dict-state-builder script added)
- `/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js` (modified, staged not committed per plan)

Commits verified via `git log`:
- `5d2a125` — feat(33-01): add buildDictState entry point to dict-state-builder
- `20bd890` — refactor(33-01): popup.js loadDictionary delegates to buildDictState

Gates re-run green: `npm run test:dict-state-builder` (6/6), `npm run test:popup-views` (8/8), `npm run check-popup-deps` (PASS).
