---
phase: 23-data-source-migration
plan: 03
status: complete
completed: 2026-04-27
duration: ~45 min (includes live regression patching + browser verification)
tasks_completed: 3
files_modified: 8
requirements_satisfied: [BOOT-01, BOOT-02, BOOT-03]
---

# Plan 23-03 Summary: NB Baseline + Bootstrap + Popup Status UI

## What was built

1. **NB baseline trim script** (`scripts/build-nb-baseline.js`) — filters `nb.json` to top-2k Zipf words + all pronouns/articles + all typos + trimmed freq/bigrams. Output: `extension/data/nb-baseline.json` at ~130 KB (well under 200 KB cap).

2. **Service-worker bootstrap orchestrator** (`extension/background/vocab-bootstrap.js`) — on `chrome.runtime.onInstalled`, reads the user's target language(s) from storage and downloads each into IndexedDB via `fetchBundle`/`putCachedBundle`. Sequential downloads with 30s timeout. Emits `lexi:hydration` messages for popup consumption.

3. **Popup download status UI** — per-language pills in popup: "Laster ned tysk…" → "tysk klar" (auto-hides after 3s) → "Ordlister utilgjengelig" on failure. Two-channel sync (poll on open + push subscription) so events aren't lost.

## Browser verification results

- Fresh install: popup pill shows "Laster ned tysk…" → "tysk klar" ✓
- IndexedDB: `lexi-vocab` → `bundles` contains `de` entry (verified in page DevTools → Application tab) ✓
- NB baseline-first: lookups work immediately on fresh install ✓
- Offline test: deferred to after plan 23-05

## Live regressions patched during verification

Four contract gaps found by browser testing (not caught by automated gates):

| Commit | Issue | Fix |
|--------|-------|-----|
| `29989ce` | `downloadLanguage` + `getCachedVersion` dropped in v1 rewrite | Restored as legacy proxies in vocab-store.js |
| `9e53f4d2` (sibling) | `grammarFeatures` returned as flat array, not full object | Returns `{features, presets, categories}` in papertek-vocabulary |
| `a56444e` | `dictionary._metadata.{language,languageName}` missing | Synthesized from top-level fields in vocab-store |
| `912c716` | Font controls layout in floating widget | Moved to header, A-/A+ hidden in auto mode |

## Verification step corrections

- Step 2 ("SW console shows `lexi:hydration`") was incorrectly specified — `lexi:hydration` is a `chrome.runtime.sendMessage` event, not a `console.log`. The SW console will always be empty for this. Step 4 (popup pill) is the correct user-visible verification.
- IndexedDB is visible in page DevTools (content script context), not in the SW DevTools Application tab.

## Decisions

- Synthesize `_metadata` in vocab-store rather than migrate dozens of popup.js call sites — smaller surface area
- Live-patch regressions in-session rather than spawning a new executor — preserved debugging momentum; each fix has its own commit

## Key lesson

Plan should have included "exhaustively grep popup.js + content scripts for `__lexiVocabStore.*` call sites and verify each is preserved or migrated." The contract gap was found by browser testing, not by the plan checker. Flagged for plan 23-05 which has the same risk class.
