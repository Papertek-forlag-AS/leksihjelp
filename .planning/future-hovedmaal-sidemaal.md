# Hovedmål / Sidemål Support

## Overview
Norwegian students write in either bokmål (NB) or nynorsk (NN) as their "hovedmål" (primary written form). The other becomes their "sidemål" (secondary). Leksihjelp needs to support both as source languages.

## What to implement

### 1. Interface language (nynorsk option)
- All UI text in the extension should be available in both NB and NN
- Add a setting: "Grensesnittspråk: Bokmål / Nynorsk"
- This affects: button labels, placeholders, settings text, error messages, badge text
- Could use a simple i18n JSON file with NB/NN string pairs

### 2. Hovedmål / sidemål selector
- New setting in the settings view: "Mitt hovedmål" (NB or NN)
- The student's hovedmål becomes the source language for all dictionary lookups
- The sidemål appears as a target language option in the switcher

### 3. Dictionary behavior changes
- If hovedmål = NN: source language is NN, target options include NB
- If hovedmål = NB: source language is NB (current behavior), target options include NN
- The two-way lookup (Phase 1b in performSearch) should use the student's hovedmål entries for reverse lookups, not always NB

### 4. Word prediction changes
- Word prediction should suggest words in the student's hovedmål
- If hovedmål = NN: predict nynorsk forms, not bokmål

### 5. Grammar features
- Grammar feature names should match the interface language
- NB features use "flertall", NN features use "fleirtal" etc.

## Dependencies
- Requires NN translations for all UI strings
- The vocabulary data already supports both NB and NN entries
- Grammar features for NB and NN are already in the extension

## Priority
Medium — most students use bokmål, but nynorsk students would benefit significantly from a native interface.
