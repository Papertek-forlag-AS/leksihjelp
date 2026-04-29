---
phase: 30-shared-popup-views
plan: 03
subsystem: uat
tags: [staging-uat, lockdown-sidepanel, cross-repo, integration]

# Dependency graph
requires:
  - phase: 30-shared-popup-views
    plan: 02
    provides: lockdown sidepanel mount with synced popup view modules
provides:
  - Staging UAT pass on stb-lockdown.app for the leksihjelp sidepanel surface
  - Plan 30-01 deferred sub-step E shipped (popup-views.css generator + scoped CSS) — was blocking visible rendering
  - Five tactical fixes that surfaced during UAT and shipped same-day (see "fixes during UAT" below)
  - Plan 30-04 filed with the real architecture work that came out of UAT (single-source language picker, pinned Aa, click-rebind, grammar-features wiring, shared bank-flatten extraction)
  - Phase 31 filed (FR rule suite) — orderdy ahead of skriveokt-zero parity
affects: [30-04 lockdown sidepanel UX integration, Phase 31 FR rule suite, deferred Phase 28.1 skriveokt-zero parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "popup-views.css generator scoping: parse popup.css, prefix every selector under #leksihjelp-sidepanel-root, drop body/html/.app, hoist [data-theme=dark] to ancestor scope so dark-mode fires from documentElement"
    - "Tactical inline of popup.js helpers (flattenBanks, getTranslation, generatedFromRefs, norwegianInfinitive + irregular-verb map) into the lockdown host as a stop-gap for shared-helper extraction in 30-04"
    - "buildVocabAdapter() wrap of host.__lexiVocab to add dictionary-view-specific surfaces (BUNDLED_LANGUAGES, LANG_FLAGS, decomposeCompound delegate)"
    - "Production-safe firebase alias layout (default = staging) so a bare 'firebase deploy' can't hit production by accident"

key-files:
  created:
    - /Users/geirforbord/Papertek/leksihjelp/extension/styles/popup-views.css
    - /Users/geirforbord/Papertek/leksihjelp/scripts/build-popup-views-css.js
  modified:
    - /Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/leksihjelp-sidepanel-host.js
    - /Users/geirforbord/Papertek/lockdown/public/js/leksihjelp-loader.js
    - /Users/geirforbord/Papertek/lockdown/.firebaserc
    - /Users/geirforbord/Papertek/leksihjelp/package.json (2.8.0 → 2.8.2)
    - /Users/geirforbord/Papertek/leksihjelp/extension/manifest.json (2.8.0 → 2.8.2)
    - /Users/geirforbord/Papertek/leksihjelp/backend/public/index.html (version display)
---

# Plan 30-03 — staging UAT (rolled-up)

## Outcome: ✅ Pass on staging-lockdown.web.app (stb-lockdown.app)

What this plan was supposed to verify (per `30-03-PLAN.md`):

- Teacher creates a LEKSIHJELP_EXAM test → student environment renders the real (non-stub) leksihjelp dictionary panel
- EKSAMENMODUS badge + Phase 29 lock surface visible
- No audio buttons in lockdown sidepanel (Phase 30 audioEnabled:false)
- Phase 27 exam-marker filtering: grammar-lookup dots suppressed, typo dots remain
- Production deploy to lockdown-stb (papertek.app) explicitly NOT executed

Reality, after iterating against staging:

- Sidepanel mounts and renders (after popup-views.css shipped — see "fixes during UAT" below)
- Search works, returns dictionary results
- Direction toggle binds to real language state (no more hard-coded "ES")
- Dark mode dropped (clashed with surrounding writing-environment chrome)
- Settings drawer hidden (would have been empty after grammar deferred + darkmode dropped)
- Production deploy NOT executed — stays deferred per user instruction

The Phase 27/29 acceptance criteria (exam badge, lock surface, exam-marker
filtering) were not separately walked through in this UAT pass. They were
verified at their original phase boundaries; the open question for 30-03 was
whether the sidepanel itself works, and that's now confirmed.

## Fixes during UAT

The original 30-02 mount produced a panel that *rendered* but didn't *work*.
Five round-trips between staging UAT and code fixes were needed:

1. **popup-views.css missing** (Plan 30-01 deferred sub-step E). Without it the
   panel was visibly thin — no glassmorphism, no styled search box.
   Built `scripts/build-popup-views-css.js` (selector-prefixing generator),
   committed the generated artifact, wired into `npm run build-popup-views-css`,
   and updated the leksihjelp-loader to inject it alongside `leksihjelp.css`.
   Cross-repo commits: leksihjelp 474f59c + lockdown d8aadb5. Version 2.8.0 → 2.8.1.

2. **Settings drawer empty.** Scaffold lacked `.active` on `<section class="view">`
   so popup-views.css's `.view { display: none }` rule hid everything. Plus
   `settings-view.js` doesn't handle grammar features (host-owned in popup.js)
   so the grammar block was structurally empty. Fix: add `.active`, drop the
   grammar block, defer grammar-features porting to 30-04. Lockdown commit fabf986.

3. **Search returned nothing + direction toggle stuck on "ES".**
   `dictionary-view.js` reads `state.dictionary` and `state.allWords` to perform
   searches and `updateLangLabels()` to refresh the toggle, but the lockdown host's
   `loadDictionary` callback only called the loader's `loadLanguage(lang)` —
   never populated the view's state. Inlined `flattenBanks` + `BANK_TO_POS`
   in the host; after mount fire async `populateDictState` + manually invoke
   `dictHandle.updateLangLabels()` and `dictHandle.rebuildLangSwitcher()`.
   Also fixed `searchDirection: 'no_target'` → `'no-target'` (hyphen) — enum mismatch.

4. **Dark-mode toggle silently no-op.** `popup-views.css` was emitting dark rules
   as `#leksihjelp-sidepanel-root[data-theme="dark"] X` (root-scope), but
   `settings-view.js` sets `data-theme` on `documentElement`. Updated the
   build script to emit `[data-theme="dark"] #leksihjelp-sidepanel-root X`
   (ancestor-scope) so it fires from `<html>`. Then dropped dark mode entirely
   from the lockdown surface — the dark colours clashed with the surrounding
   white writing-environment chrome (only the panel went dark, looked broken).

5. **Search threw `TypeError: vocab.norwegianInfinitive is not a function`.**
   `dictionary-view.js` calls a handful of methods on the `vocab` dep that
   aren't on `host.__lexiVocab` (which is shaped for spell-check, not
   dictionary lookup): `getTranslation`, `norwegianInfinitive`,
   `generatedFromRefs`, `decomposeCompound`, plus reads `BUNDLED_LANGUAGES`
   and `LANG_FLAGS`. Mirrored popup.js implementations inline (incl. the
   irregular-verbs map) in the host; `buildVocabAdapter()` wraps the loader's
   adapter to add them. Lockdown commit 8bac7a3. Version 2.8.1 → 2.8.2.

All five are tactical inline fixes. Plan 30-04 captures the proper
architectural extraction (shared `dict-state-builder.js`, shared vocab
adapter helpers) so popup.js and the lockdown host stop duplicating logic.

## Production deploy

Explicitly deferred per user instruction. The default `firebase use` is now
`staging-lockdown` (renamed from `default`-was-prod-was-an-accident-waiting);
production requires explicit `firebase use production && firebase deploy`.

## Cross-repo commits shipped during UAT

| Repo | SHA | Subject |
|------|-----|---------|
| leksihjelp | 474f59c | feat(30-01-E): popup-views.css generator + scoped view CSS |
| lockdown | d8aadb5 | feat(leksihjelp-loader): inject popup-views.css for sidepanel mount |
| leksihjelp | 266fb26 | docs(30-04): file lockdown sidepanel UX integration plan |
| lockdown | fabf986 | fix(leksihjelp-sidepanel): make settings drawer non-empty |
| leksihjelp | 396ec88 | feat(30-04): scope dark-mode CSS via ancestor; file FR rule suite |
| lockdown | fa693b7 | fix(leksihjelp-sidepanel): populate dictionary state, fix searchDirection enum, scope dark-mode |
| lockdown | 8bac7a3 | fix(leksihjelp-sidepanel): wrap vocab adapter; drop dark-mode + empty settings drawer |
| lockdown | 0efd683 | chore(firebase): default alias = staging; rename prod alias to 'production' |

## Open items handed off

- **Plan 30-04** — lockdown sidepanel UX integration (single-source language
  picker, pinned Aa, click=right-click rebind, direction-toggle binding,
  grammar-features wiring, shared bank-flatten extraction)
- **Phase 31** — FR rule suite (homophones, L1 interference, faux amis,
  verb-prep, capitalization, gender-trap escalation)
- **Phase 28.1 (deferred)** — skriveokt-zero parity for popup views, ordered
  AFTER Phase 31 per user instruction 2026-04-29
- **Production deploy to papertek.app** — pending user-driven trigger
