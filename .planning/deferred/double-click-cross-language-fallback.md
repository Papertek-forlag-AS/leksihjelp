---
type: feature-idea
discovered: 2026-05-02
discovered_in: Phase 38 chrome-web-store-prep session
status: deferred
priority: medium
target_milestone: v3.3 or later
---

# Double-click cross-language fallback (parity with popup search)

## The idea

When a user **double-clicks a word in the page**, the floating widget /
context menu shows a dictionary lookup. Currently this lookup is scoped
strictly to the user's selected foreign language — if the popup is set
to German but the user double-clicks a Norwegian word, the widget says:

> "Ord ikke funnet"

This is a poor UX: the user clearly meant *something*, and the system
has the data to help.

The popup search (`extension/popup/popup.js`) already handles this case
gracefully — when a search term is not found in the selected foreign
language, the popup falls back to the user's source language (NB/NN)
and shows: "Fant ingen treff på {target_lang}, her er treff på norsk"
(or similar phrasing — exact copy lives in i18n).

**Idea:** apply the same fallback logic to double-click lookup in the
floating widget so behavior is consistent across the two surfaces.

## Why it matters

- Students working bilingually (e.g. reading a German text with NB notes
  in the margin) will frequently double-click words from the wrong
  language.
- The current "not found" dead-end forces them to manually switch the
  popup language, which breaks flow.
- The popup already has the right behavior; this is a parity gap, not
  net-new logic.

## Implementation sketch

The floating widget lives in `extension/content/floating-widget.js`. It
currently calls a single dictionary lookup against the active language.

Approach:
1. Refactor the widget's lookup to mirror `popup.js`'s search-fallback
   ladder: target-lang → source-lang (NB/NN) → "not found".
2. Show the same "Fant ingen treff på {target_lang}, her er treff på
   {source_lang}" banner the popup uses.
3. Re-use the i18n string for the banner (don't duplicate copy).
4. If the source-lang lookup also returns nothing, fall back to the
   current "Ord ikke funnet" — preserves existing UX as the worst-case.

## Where the popup's logic lives

Search `extension/popup/popup.js` for the "fant ingen treff" string or
the search fallback ladder — the relevant function will show the
already-implemented pattern.

## Risks / considerations

- The widget is rendered on every page; changing its lookup logic
  shouldn't add network calls (vocab is bundled).
- Double-click selection can include punctuation; popup search handles
  this with token normalisation. Make sure widget uses the same
  normalisation path.
- Floating widget is a synced surface (per CLAUDE.md downstream-consumers
  list), so any change here needs a `[lockdown-resync-needed]` commit
  marker and a version bump.

## Discovery context

Surfaced during the post-Phase-38 Chrome Web Store prep conversation
2026-05-02 while Geir was reviewing the v2.9.27 changelog. Not blocking
v2.9.27 ship — defer to a future phase (v3.3 backlog or later).
