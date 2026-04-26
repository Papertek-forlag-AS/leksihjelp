---
phase: 21-dictionary-intelligence
verified: 2026-04-26T19:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 21: Dictionary Intelligence Verification Report

**Phase Goal:** Dictionary intelligence — false-friend warnings and sense-grouped translations in popup and floating-widget inline lookup.
**Verified:** 2026-04-26T19:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                  | Status     | Evidence                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Popup dictionary shows false-friend warning banner above translations for entries with falseFriends data               | VERIFIED   | `renderFalseFriends(entry)` at line 1309, before `renderSenses`/translation at line 1310 in popup.js       |
| 2   | Popup dictionary shows sense-grouped translations for entries with senses data instead of flat translation             | VERIFIED   | `renderSenses(entry)` at line 1310 with `||` fallback to flat translation; replaces when senses present     |
| 3   | Bundled vocabulary data contains falseFriends and senses fields from Papertek API                                      | VERIFIED   | nb.json: 56 entries with `falseFriends`, 1 entry (`på`) with `senses`; schema matches expected shape        |
| 4   | Floating-widget inline lookup shows false-friend warning banner for entries with falseFriends data                     | VERIFIED   | `falseFriendHtml` built at lines 1111-1127 in floating-widget.js; rendered at line 1157 above `translationHtml` |
| 5   | Floating-widget inline lookup shows sense-grouped translations for entries with senses data                            | VERIFIED   | `sensesForLang` filter at lines 1131-1148; replaces flat translation; rendered at line 1158                  |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                         | Expected                                                            | Status   | Details                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `extension/data/nb.json`                         | NB vocabulary with falseFriends and senses fields                   | VERIFIED | 56 falseFriends entries, 1 senses entry; schema `{lang, form, meaning, warning}` confirmed |
| `extension/popup/popup.js`                       | renderFalseFriends and renderSenses functions                        | VERIFIED | Both functions at lines 1388 and 1412; wired into renderResults at lines 1309-1310        |
| `extension/content/floating-widget.js`           | False-friend and sense rendering in inline lookup card               | VERIFIED | Inline rendering logic at lines 1111-1148; `sanitizeWarning` helper at line 1224          |
| `extension/styles/content.css`                   | CSS for false-friend and sense display in content script context    | VERIFIED | `.lh-ff-banner` and `.lh-sense-group` rules at lines 1249-1264                            |

### Key Link Verification

| From                                   | To                            | Via                                                                 | Status   | Details                                                                                                    |
| -------------------------------------- | ----------------------------- | ------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `extension/popup/popup.js`             | `extension/data/nb.json`      | `flattenBanks` `...entry` spread at line 551; `renderFalseFriends`/`renderSenses` called in renderResults | WIRED    | Spread confirmed at line 551; functions called at lines 1309-1310; entry fields flow through                |
| `extension/content/floating-widget.js` | `extension/data/*.json`       | `searchDictBanks` `...entry` spread at line 1051; `falseFriends`/`senses` used in showInlineLookup        | WIRED    | Spread at line 1051; rendering logic at lines 1111-1148 consumes `match.falseFriends` and `match.senses`   |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                          | Status    | Evidence                                                                                  |
| ----------- | ----------- | ---------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| FF-01       | 21-01       | User sees a warning banner on dictionary popup when looking up a word with a false friend            | SATISFIED | `renderFalseFriends` in popup.js renders amber banner with heading, form, meaning, warning |
| FF-02       | 21-01       | False-friend data lives in Papertek API as `falseFriends` field on NB entries (~50 pairs)           | SATISFIED | nb.json contains 56 entries with `falseFriends`; field has correct `{lang, form, meaning, warning}` schema |
| FF-03       | 21-01       | Warning renders prominently above translations                                                        | SATISFIED | `renderFalseFriends(entry)` at line 1309, one line before translation at line 1310         |
| FF-04       | 21-02       | Floating-widget inline lookup also shows false-friend warnings                                       | SATISFIED | `falseFriendHtml` at lines 1111-1127; injected at line 1157 above `translationHtml`       |
| POLY-01     | 21-01       | User sees sense-grouped translations for polysemous words in dictionary popup                        | SATISFIED | `renderSenses` returns `<div class="senses-block">` with per-sense trigger/forms/example  |
| POLY-02     | 21-01       | Sense data lives in Papertek API as structured `senses` field with trigger context and examples      | SATISFIED | nb.json `på` entry has `senses` array with `trigger`, `translations.<lang>.forms`, `example` |
| POLY-03     | 21-01       | Popup renders sense headers — student can't grab the first translation                               | SATISFIED | `renderSenses(entry) || flat-fallback` at line 1310; senses replace flat list entirely    |
| POLY-04     | 21-02       | Floating-widget inline lookup shows sense grouping for polysemous words                              | SATISFIED | `sensesForLang` filter at lines 1131-1145; sense groups replace flat translation at line 1147 |

No orphaned requirements — all 8 IDs (FF-01 through FF-04, POLY-01 through POLY-04) are claimed by plans 21-01 and 21-02 and appear in REQUIREMENTS.md marked complete.

### Anti-Patterns Found

No anti-patterns detected in the modified files:

- `extension/popup/popup.js` — `renderFalseFriends` and `renderSenses` are substantive implementations, not stubs
- `extension/content/floating-widget.js` — `showInlineLookup` branches are fully implemented with real data consumption
- `extension/styles/content.css` — CSS rules are real (not empty)
- `sanitizeWarning` in floating-widget.js uses the correct `escapeHtml`-then-re-enable pattern matching the plan specification

No `TODO`, `FIXME`, placeholder text, empty return values, or console-log-only handlers found in the affected code paths.

### Human Verification Required

#### 1. False-friend banner visual rendering (popup)

**Test:** Open the extension popup, switch to Norwegian (NB) as source language with English as target, search for "realisere" or another NB word with a falseFriends entry for `lang: "en"`. Scroll to the word result.
**Expected:** An amber-bordered warning banner appears above the translation line, with the heading "Falsk venn", the English false-friend form in bold, its Norwegian meaning, and the warning explanation.
**Why human:** Banner CSS classes (`false-friend-banner`, `false-friend-heading`, etc.) and i18n string rendering require visual browser confirmation; grep cannot test DOM rendering or CSS application.

#### 2. Sense-grouped translation visual rendering (popup)

**Test:** Open popup, switch to NB source with any target language, search for "på". The entry should show polysemy senses instead of a flat translation.
**Expected:** Multiple sense groups appear (e.g., "foran ukedag / dato" with translation "am"/"on"/"el"/"le" depending on target language, plus an example sentence).
**Why human:** The `senses-block` / `sense-item` / `sense-trigger` / `sense-forms` CSS rendering requires visual confirmation in the popup DOM.

#### 3. False-friend banner in floating-widget inline lookup

**Test:** On any web page with the extension installed, double-click a word that resolves to a NB entry with falseFriends for the current target language (e.g., select "realisere" and trigger inline lookup).
**Expected:** The inline lookup card shows the amber false-friend banner above the translation.
**Why human:** Content script context injection and inline-style rendering must be verified visually; unit-level grep confirms code presence but not runtime rendering.

#### 4. Sense-grouped translation in floating-widget inline lookup

**Test:** On a web page, trigger inline lookup on "på" (if it resolves as a NB word).
**Expected:** The card shows sense groups replacing the flat translation.
**Why human:** Same content-script rendering context requirement as above.

### Gaps Summary

No gaps found. All 5 observable truths are verified against the actual codebase, all 4 artifacts are substantive and wired, all 8 requirement IDs are satisfied with implementation evidence, and all 3 commits (288177a, 70bf579, 9974710) are present in git history.

---

_Verified: 2026-04-26T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
