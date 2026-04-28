---
status: diagnosed
phase: 24-compound-word-intelligence
source: [24-01-SUMMARY.md, 24-02-SUMMARY.md]
started: 2026-04-28T12:00:00Z
updated: 2026-04-28T12:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Compound Prediction Suggestions
expected: In the popup, type a partial compound word in German (e.g. "Chef" or "Schul"). When no direct dictionary match exists, clickable suggestion cards should appear showing predicted compound words.
result: pass

### 2. Compound Card on Click
expected: Click one of the compound suggestion cards. A compound card should appear showing the full word decomposed into its parts (e.g. "Chef + s + Stuhl") with the gender/article of the compound.
result: pass

### 3. Pedagogical Gender Note
expected: The compound card should display a pedagogical note explaining that the compound inherits its gender from the last component (head-final rule).
result: pass

### 4. Translation Guess
expected: The compound card should show a "Kvalifisert gjetning" (translation guess) section assembling translations of individual components with a "+" separator.
result: issue
reported: "pass partly. The translation of chefstudenten is chef + studenten."
severity: major

### 5. Back-Navigation
expected: From the compound card, click a component word to see its dictionary entry. A back-link should appear allowing you to navigate back to the compound card. Clicking back restores the compound view.
result: pass

### 6. Exact Compound Recognition
expected: Type a full known compound word (e.g. "Chefsstuhl") directly. The compound card should appear immediately without needing to go through suggestion cards first.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Translation guess assembles Norwegian translations of components with + separator"
  status: fixed
  reason: "User reported: pass partly. The translation of chefstudenten is chef + studenten."
  severity: major
  test: 4
  root_cause: "getComponentTranslation only searched allWords (German dict) via getTranslation, which returns empty for German entries lacking linkedTo.nb. Needed reverse lookup through noWords to find NB entries linking back to the German entry ID."
  artifacts:
    - path: "extension/popup/popup.js"
      issue: "getComponentTranslation missing reverse NB lookup"
  missing:
    - "Reverse lookup via noWords linkedTo[currentLang].primary"

## Additional Fixes (discovered during testing)

### Critical: v2→v3 migration breaks NB/NN/EN loading
- root_cause: "Phase 23 removed bundled data files but bootstrap only downloaded target languages (DE/ES/FR). NB/NN/EN treated as 'bundled' but files gone."
- files fixed:
  - extension/background/service-worker.js — bootstrap now includes nb, nn, en
  - extension/popup/popup.js — loadLanguageData falls back to API download
  - extension/popup/popup.js — loadGrammarFeatures handles missing bundled file gracefully
  - extension/content/vocab-seam.js — loadBundledRaw falls back to vocab-store
  - extension/content/floating-widget.js — inline lookup falls back to vocab-store

## Notes (not Phase 24 gaps)

- "Viste du resultater fra den andre retningen" wording is confusing — pre-existing UX issue
- Clicking word name in results should navigate directly to that word only — feature request for future phase
