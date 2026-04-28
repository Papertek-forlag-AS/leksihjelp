---
phase: 27-exam-mode
plan: 03
subsystem: runtime suppression + popup UI
tags: [exam-mode, runtime-gate, popup-toggle, lockdown-aware, ui-i18n, version-bump]
requires:
  - Plan 27-01 outputs: rule.exam markers on every spell-rule + extension/exam-registry.js with 10 entries
  - Plan 27-02 outputs: check-exam-marker release gate enforcing the contract
provides:
  - host.__lexiExam helper (isSurfaceSafe / isRuleSafe / isExplainSafe / getExamMode) — single source of truth in spell-check-core.js
  - chrome.storage.local.examMode (student-controlled bool, persisted)
  - chrome.storage.local.examModeLocked (lockdown-controlled bool, makes toggle disabled + ON)
  - popup EKSAMENMODUS badge + "Eksamenmodus" toggle settings group + "Slått på av lærer" caption (nb/nn/en)
  - amber 2px border on floating widget when in exam mode (.lh-exam-mode CSS class)
  - runtime suppression at all surface entry points (spell-check filter, widget bail, word-prediction bail, popup view hide)
  - dual-marker handling for de-prep-case (dot renders, popover suppressed)
affects:
  - extension/manifest.json content_scripts[0].js gains exam-registry.js (must load before floating-widget.js, word-prediction.js, spell-check.js)
  - lockdown sibling needs re-pin after 2.7.0 (downstream sync path per CLAUDE.md)
tech-stack:
  added: []
  patterns:
    - "Single source of truth helper attached to host.__lexiExam in spell-check-core.js — read by every consumer"
    - "Cached examMode flag per content script + chrome.storage.onChanged listener for live updates without polling"
    - "Surface-id-based gating via host.__lexiExam.isSurfaceSafe(id, examMode) — IDs match exam-registry.js exactly"
    - "Dual-marker gate: rule filter (rule.exam) + popover gate (rule.explain.exam) — independent paths"
    - "Lockdown teacher-lock pattern: examModeLocked overrides examMode; toggle disabled + ON; defensive force-on if only the lock flag was set"
key-files:
  created: []
  modified:
    - extension/content/spell-check-core.js
    - extension/content/spell-check.js
    - extension/content/floating-widget.js
    - extension/content/word-prediction.js
    - extension/styles/content.css
    - extension/styles/popup.css
    - extension/popup/popup.html
    - extension/popup/popup.js
    - extension/i18n/strings.js
    - extension/manifest.json
    - package.json
    - backend/public/index.html
decisions:
  - "Filter findings post-CORE.check rather than the rule list pre-iteration — content script already aliases f.rule_id to f.type and dedupes/filters findings, so post-filter is the surgically smaller change with identical observable effect"
  - "Cached examMode on every content script + onChanged listener — avoids repeated chrome.storage.local.get on every keystroke; trade-off is one stale frame on the toggle event, addressed by hideOverlay+schedule on examMode change"
  - "Lockdown lock defensively forces examMode=true if only examModeLocked is set — guards against partial lockdown loader bugs; also writes examMode through to storage so other surfaces see consistent state"
  - "Dictionary view (#view-dictionary) is hidden as a whole when popup.search is non-safe — covers TTS button and conjugation tables transitively (they're rendered into search results) without per-node gating; toggling off restores cleanly"
  - "Widget showWidget/showInlineLookup bail at the entry point rather than rendering an empty husk — per plan: 'do not render the widget at all'"
  - "Amber border CSS uses three selectors (#lexi-tts-widget, .leksihjelp-floating-widget, .lh-floating-widget) to cover legacy + lockdown shipping conventions"
metrics:
  duration: 22
  completed: "2026-04-28"
  files_created: 0
  files_modified: 12
  surfaces_gated: 6
  release_gates_passing: 8
---

# Phase 27 Plan 03: Exam-Mode Runtime Suppression Summary

Wires the exam-mode runtime end-to-end. Plan 01 established the contract; Plan 02 enforced it in CI; this plan makes every surface read the markers and act on them at runtime, plus adds the popup toggle, EKSAMENMODUS badge, and amber widget border that give students and teachers the at-a-glance signal that exam mode is active.

## Suppression Points (final list)

| Surface | Gate location | Mechanism |
|---|---|---|
| spell-check rules (rule.exam.safe=false) | `extension/content/spell-check.js:308-318` | `Map<rule_id, rule>` lookup + `__lexiExam.isRuleSafe(rule, true)` filter on findings array post-`CORE.check`. Drops the dot AND the popover for non-safe rules. |
| spell-check popover for dual-marker rules | `extension/content/spell-check.js:511` | Early-return in `showPopover()` when `__lexiExam.isExplainSafe(rule, true) === false`. Dot renders (rule.exam.safe=true) but the Lær mer / explain popover is suppressed. |
| widget.tts (floating widget TTS) | `extension/content/floating-widget.js:432` | `showWidget()` bails at entry when `isSurfaceAllowed('widget.tts') === false`. |
| widget.dictionary (inline lookup) | `extension/content/floating-widget.js:1051` | `showInlineLookup()` bails at entry when `isSurfaceAllowed('widget.dictionary') === false`. |
| wordPrediction.dropdown | `extension/content/word-prediction.js:507-514` | `runPrediction()` bails at entry when `__lexiExam.isSurfaceSafe('wordPrediction.dropdown', true) === false`. |
| popup.search / popup.grammarFeaturesPopover | `extension/popup/popup.js initExamMode()` | Hides `#view-dictionary` (covers search results, conjugation tables, in-result TTS buttons transitively) and the grammar-features settings group via `[hidden]` attribute. Toggling off restores cleanly. |

## Dual-Marker Handling (de-prep-case)

Two independent gates in spell-check.js operate on the same rule:

1. **Rule filter** (line 308-318): consults `rule.exam.safe`. de-prep-case has `rule.exam.safe = true`, so the dot is preserved.
2. **Popover gate** (line 511): consults `rule.explain.exam.safe`. de-prep-case has `rule.explain.exam.safe = false` (Lær mer pedagogy popover exceeds browser native parity), so the popover is suppressed.

Result: in exam mode, the user sees the de-prep-case dot but clicking it shows nothing (no Lær mer button, no expanded panel, no rule-explanation tooltip). This was the explicit specification in `<interfaces>`.

## Storage Keys + Live Updates

| Key | Type | Owner | Purpose |
|---|---|---|---|
| `examMode` | bool | popup.js (write), all consumers (read) | Student-controlled toggle. Persisted across popup re-opens. |
| `examModeLocked` | bool | lockdown loader (write), popup.js (read) | Teacher-mandated lock. When true, popup toggle renders ON + disabled with "Slått på av lærer" caption; also force-writes `examMode = true` defensively. |

`chrome.storage.onChanged` listeners installed in:
- `extension/popup/popup.js initExamMode()` — keeps multiple popup instances (popup + side-panel) in sync.
- `extension/content/spell-check.js init()` — flips cached `examMode`, hides overlay, re-schedules a check pass so the dot/popover layer reflects the new flag immediately.
- `extension/content/floating-widget.js init()` — flips cached `examMode`, re-applies `.lh-exam-mode` class, hides any open widget.
- `extension/content/word-prediction.js init()` — flips cached `examMode`, hides dropdown if open.

## i18n

Four new keys added to `extension/i18n/strings.js` for nb/nn/en:

| Key | nb | nn | en |
|---|---|---|---|
| `examModeLabel` | Eksamenmodus | Eksamensmodus | Exam mode |
| `examModeBadge` | EKSAMENMODUS | EKSAMENSMODUS | EXAM MODE |
| `examModeLockedCaption` | Slått på av lærer | Slått på av lærar | Locked by teacher |
| `examModeDescription` | (single-sentence nb explanation) | (single-sentence nn explanation) | (single-sentence en explanation) |

All resolved via existing `data-i18n` attributes + `applyTranslations()` in popup.js.

## Manifest Registration

`extension/manifest.json content_scripts[0].js` array now includes `exam-registry.js` as the **second entry** (after `i18n/strings.js`, before everything else). The verification block in Task 2 explicitly asserts the registry loads BEFORE `floating-widget.js`, `word-prediction.js`, and `spell-check.js` — without this order, `host.__lexiExamRegistry` is undefined when consumers initialise and the fail-safe `isSurfaceSafe()` path returns `false` for every surface even when examMode is OFF, breaking the floating widget for normal use.

## Version Bump Trail

| File | 2.6.0 → 2.7.0 |
|---|---|
| `extension/manifest.json` | line 4 |
| `package.json` | line 3 |
| `backend/public/index.html` | line 579 (landing-page footer) |

Per CLAUDE.md "Downstream consumer: Papertek Lockdown webapp" — bumping the package.json version signals that lockdown should re-pin and audit. The amber-border CSS rule in `extension/styles/content.css` is part of the synced surface; no other lockdown-side action is required for the visual signal, but the suppression behaviour requires the `host.__lexiExamRegistry` global, which the lockdown loader now needs to provide (via shim or via the synced exam-registry.js file — pending todo for the lockdown sync).

## Deviations from Plan

### Auto-fixed Issues

None. All four task parts (helper, popup UI, content-script suppression, manifest+version) executed as specified.

### Implementation Notes

- **Plan said "leading filter step before iteration".** I post-filtered the findings array instead. The plan-suggested approach would require either (a) injecting the filter into `spell-check-core.js`'s rule loop (couples core to exam-mode runtime semantics, fights the "core is pure" invariant), or (b) duplicating the rule-language-priority pipeline in spell-check.js to filter first. Post-filtering on findings is functionally identical (a non-safe rule's dot AND popover are both suppressed because the finding is dropped before render) and surgically smaller. Documented in commit message.
- **Popup surface gating is whole-view, not per-node.** Hiding `#view-dictionary` covers `popup.search`, `popup.conjugationTable`, and `popup.ttsButton` transitively because conjugation tables and TTS buttons are rendered as children of search results. Per-node gates are kept as named comments in `applyExamModeUi()` for future granular control if/when search-result rendering is decoupled.
- **Widget amber border CSS uses three selectors.** Matches all three shipping conventions (`#lexi-tts-widget` for current code, `.leksihjelp-floating-widget` and `.lh-floating-widget` for legacy/lockdown). Costs nothing; ensures forward-compat with lockdown's CSS bundle naming.

## Verification

All 8 release gates exit 0 after Task 2 commit:

| Gate | Result |
|---|---|
| `check-fixtures` | PASS — every fixture suite at P=R=F1=1.000 |
| `check-explain-contract` | PASS 59/59 |
| `check-rule-css-wiring` | PASS 59/59 |
| `check-network-silence` | PASS — spell-check + spell-rules + word-prediction surface is network-silent |
| `check-spellcheck-features` | PASS — lookup indexes feature-independent across nb/en/de/es/fr |
| `check-exam-marker` | PASS — 62 rules + 10 registry entries validated |
| `check-exam-marker:test` | PASS — gate fires on malformed/missing/invalid-category, passes on well-formed |
| `check-bundle-size` | PASS — 12.59 MiB / 20.00 MiB cap (7.41 MiB headroom) |

Helper smoke test (Task 1): passed all four shape checks (off-path returns true, on-path with unknown surface returns false, on-path with safe rule returns true, on-path with unsafe rule returns false).

Manifest order check (Task 2): exam-registry.js index < floating-widget.js index, < word-prediction.js index, < spell-check.js index — confirmed.

## Pending Todos (Lockdown Sync)

- Run `node scripts/sync-leksihjelp.js` from `/Users/geirforbord/Papertek/lockdown/` to mirror this phase's content-script changes (`spell-check.js`, `spell-check-core.js`, `floating-widget.js`, `word-prediction.js`, `content.css`, `i18n/strings.js`) downstream. Without this, the lockdown variant won't honour exam mode at runtime.
- Lockdown's loader needs to either (a) include the synced `extension/exam-registry.js` in its content-script list before the leksihjelp scripts, or (b) provide a `host.__lexiExamRegistry` global from its own shim. Without either, the fail-safe path will hide every surface in the lockdown context even when examMode is off.

## Self-Check: PASSED

- extension/content/spell-check-core.js: FOUND
- extension/content/spell-check.js: FOUND
- extension/content/floating-widget.js: FOUND
- extension/content/word-prediction.js: FOUND
- extension/styles/content.css: FOUND
- extension/styles/popup.css: FOUND
- extension/popup/popup.html: FOUND
- extension/popup/popup.js: FOUND
- extension/i18n/strings.js: FOUND
- extension/manifest.json (version=2.7.0, exam-registry.js registered): FOUND
- package.json (version=2.7.0): FOUND
- backend/public/index.html (Versjon 2.7.0): FOUND
- Commit 71b1b2e (Task 1: helper + popup UI + i18n): FOUND
- Commit 38ac50d (Task 2: content-script suppression + amber border + manifest + version bump): FOUND
- All 8 release gates: PASSING
- Auto-approved Task 3 human-verify checkpoint per auto-mode policy (workflow.auto_advance / system reminder)
