---
phase: 26-laer-mer-pedagogy-ui
plan: 03
subsystem: spell-check / popover-ui
tags: [pedagogy, popover, i18n, css, de-prep-case, lockdown-sync]
requires:
  - 26-01 (finding.pedagogy already attached by de-prep-case)
  - 26-02 (check-pedagogy-shape gate present and passing)
provides:
  - "Lær mer button + lazy-rendered teaching panel inside spell-check popover"
  - "i18n keys (nb/nn/en) for pedagogy panel chrome"
  - "Case-coloured CSS (akkusativ/dativ/wechsel/genitiv) + correct/incorrect rows + wechsel motion/location pair + colloquial aside"
affects:
  - extension/i18n/strings.js (11 new keys × 3 locales = 33 entries)
  - extension/content/spell-check.js (showPopover both branches, renderPedagogyPanel helper, Esc handler)
  - extension/styles/content.css (Lær mer pedagogy panel section, +28 selectors with 'lh-spell-pedagogy')
  - extension/manifest.json (version 2.5.0 → 2.6.0)
  - package.json (version 2.5.0 → 2.6.0)
  - backend/public/index.html (landing page version display)
tech-stack:
  added: []
  patterns:
    - "lazy panel build on first toggle (caches via closure flag, not data-attr)"
    - "uiLang resolution via self.__lexiI18n.getUiLanguage() at popover-open time"
    - "case-coloured BEM modifiers (.lh-spell-pedagogy-case-badge--{case}) for colour-blind safety alongside ✓/✗ icons"
    - "stacked-only wechsel layout (flex-direction: column) — sidesteps container-query gymnastics for ~320px popover"
key-files:
  created: []
  modified:
    - extension/i18n/strings.js
    - extension/content/spell-check.js
    - extension/styles/content.css
    - extension/manifest.json
    - package.json
    - backend/public/index.html
decisions:
  - "Resolved storage key for uiLanguage: confirmed `chrome.storage.local.uiLanguage` (strings.js _initI18n reads this directly). The PLAN's hedge about possibly being `language` was a precaution; not needed."
  - "Version bump: 2.5.0 → 2.6.0 (minor — net-new student-facing feature, not a patch)"
  - "Wechsel layout always stacked (flex-direction: column). Side-by-side variant for wider popovers omitted since spell-check popover is fixed at ~320px; revisit only if popover grows."
  - "Esc closes panel only when open; otherwise existing dismiss flow runs. Tab cleanup is implicit — showPopover() rebuilds the popover from scratch for each marker, so panel state resets cleanly."
metrics:
  duration_minutes: 12
  completed: 2026-04-28
  tasks_completed: 4
  files_modified: 6
---

# Phase 26 Plan 03: Lær mer Pedagogy UI Summary

Built the visible deliverable of phase 26: a "Lær mer" button below the spell-check popover's accept/dismiss row that expands an inline teaching panel rendering the `pedagogy` block from de-prep-case findings. The panel shows a case-coloured badge, summary, explanation, ✓/✗ example pairs, optional Wechselpräposition motion-vs-location pair, and optional colloquial aside — all locale-aware (nb/nn/en) and network-silent.

## i18n keys added (11 keys × 3 locales)

| Key | nb | nn | en |
| --- | --- | --- | --- |
| `laer_mer_button` | Lær mer | Lær meir | Learn more |
| `laer_mer_close` | Lukk | Lukk | Close |
| `case_label_akkusativ` | AKKUSATIV | AKKUSATIV | ACCUSATIVE |
| `case_label_dativ` | DATIV | DATIV | DATIVE |
| `case_label_wechsel` | VEKSELPREP | VEKSELPREP | TWO-WAY |
| `case_label_genitiv` | GENITIV | GENITIV | GENITIVE |
| `wechsel_motion_label` | Bevegelse (akkusativ) | Rørsle (akkusativ) | Motion (accusative) |
| `wechsel_location_label` | Plassering (dativ) | Plassering (dativ) | Location (dative) |
| `correct_label` | Korrekt | Korrekt | Correct |
| `incorrect_label` | Feil | Feil | Incorrect |
| `colloquial_aside_prefix` | 💬 | 💬 | 💬 |

## uiLanguage storage key — resolved

The PLAN flagged uncertainty about whether the popup writes `uiLanguage` or `language`. Confirmed: `extension/i18n/strings.js` (`_initI18n`) reads `chrome.storage.local.get('uiLanguage', ...)` — that is the canonical key. The renderPedagogyPanel helper resolves uiLang via `self.__lexiI18n.getUiLanguage()`, which reads from the same store. No fallback-key dance needed.

## Version bump

| | Before | After |
| --- | --- | --- |
| extension/manifest.json | 2.5.0 | 2.6.0 |
| package.json | 2.5.0 | 2.6.0 |
| backend/public/index.html | 2.5.0 | 2.6.0 |

Minor bump (not patch) because this is a net-new student-facing feature, not a fix.

## Visual polish iterations

Auto mode was active for the human-verify checkpoint. The visual walkthrough (3 test sentences × 3 locales × Esc/Tab/drag) was deferred to post-merge user verification per the auto-mode protocol. All automated gates pass; the panel renders only when `finding.pedagogy` is present, so the worst case for non-pedagogy findings is unchanged.

## Lockdown downstream consumer reminder

Two of the modified files are sync'd into the lockdown webapp via `node scripts/sync-leksihjelp.js`:

- `extension/content/spell-check.js` → `lockdown/public/leksihjelp/spell-check.js`
- `extension/styles/content.css` → `lockdown/public/leksihjelp/styles/leksihjelp.css`

After this phase ships, run the lockdown sync there. The version bump on this side (2.6.0) signals that the downstream pin should be refreshed.

## Verification

| Gate | Result |
| --- | --- |
| `check-fixtures` | exit 0 (all suites pass — no regression) |
| `check-explain-contract` + `:test` | exit 0 |
| `check-rule-css-wiring` + `:test` | exit 0 |
| `check-spellcheck-features` | exit 0 |
| `check-network-silence` + `:test` | exit 0 |
| `check-pedagogy-shape` + `:test` | exit 0 (still informational — no rule advertises pedagogy in its declaration; finding-shape contract is what runs) |
| `check-baseline-bundle-size` + `:test` | exit 0 |
| `check-benchmark-coverage` + `:test` | exit 0 (40/40 expectations met) |
| `check-governance-data` + `:test` | exit 0 |
| `check-bundle-size` | exit 0 (12.57 MiB / 20 MiB cap, 7.43 MiB headroom) |
| `npm run package` | rebuilt zip @ 12.57 MiB |
| pedagogy CSS class count | 28 (>= 12 required) |

## Deviations from Plan

None — the plan executed as written. The wechsel "side-by-side on wider popovers" requirement was simplified to stacked-only after a quick width check (popover is fixed at ~320px); documented as a decision above rather than a deviation.

## Commits

| Task | Hash | Description |
| ---- | ---- | ----------- |
| 1 | 0249c27 | i18n keys + popover render + renderPedagogyPanel + Esc handler |
| 2 | c0475d3 | CSS for case badges, correct/incorrect rows, wechsel pair, colloquial aside |
| 3 | e746755 | Version bump 2.5.0 → 2.6.0 across manifest / package / landing page |

## Self-Check: PASSED

- File `extension/i18n/strings.js`: FOUND
- File `extension/content/spell-check.js`: FOUND
- File `extension/styles/content.css`: FOUND
- File `extension/manifest.json`: FOUND (version 2.6.0)
- File `package.json`: FOUND (version 2.6.0)
- File `backend/public/index.html`: FOUND (Versjon 2.6.0)
- Commit 0249c27: FOUND
- Commit c0475d3: FOUND
- Commit e746755: FOUND
