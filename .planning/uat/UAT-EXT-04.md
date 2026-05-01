---
walkthrough_id: UAT-EXT-04
phase: 38-extension-uat-batch
verification_kind: human-browser-walk
ext_version: 2.9.19
idb_revision: TBD
preset_profile: default
browser_version: TBD
reload_ts: TBD
target_browsers: [chrome, edge, brave]
walker: Geir
date: 2026-05-01
---

<!--
Instantiated from .planning/uat/TEMPLATE-walkthrough.md for Phase 38-02 canonical walkthrough.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.

Sequence position (per STATE v3.2 entry decision): warm-up (UAT-EXT-01, complete) → canonical (this)
→ highest-stakes (Phase 27 / UAT-EXT-03) → final (Phase 26 / UAT-EXT-02).

Target surface: Phase 30-01 popup view modules (extension/popup/views/*.js) — the dep-injected
view contract that is also a synced surface for the lockdown sidepanel host. Defects surfacing here
likely have sync_status=needs-resync (CLAUDE.md downstream-consumers list).
-->


# Walkthrough: Phase 30-01 popup view 9-step (canonical)

Re-confirms the Phase 30 view-module dep-injection refactor works end-to-end against real Chrome popup surfaces. Second in the locked Phase 38 walk sequence.

## Pre-flight evidence (paste before walking)

Run and record each item before touching the browser. Stale artifacts are the #1 v3.1 walkthrough failure mode (Pitfall 1).

- [x] `node scripts/check-vocab-deployment.js` exit code: `0` (run by Claude 2026-05-01T17:56Z) — output below.
- [x] `extension/manifest.json` `version` matches frontmatter `ext_version`: `2.9.19`
- [ ] IDB revision captured from `chrome.storage` (or DevTools → Application → IndexedDB): `TBD` — fill from Application → IndexedDB after popup reload; matches frontmatter `idb_revision`
- [ ] Reload timestamp recorded from chrome://extensions reload click: `TBD` — matches frontmatter `reload_ts`
- [ ] Browser + version recorded: `TBD` — fill from chrome://settings/help; matches frontmatter `browser_version`
- [x] Preset profile in popup matches frontmatter `preset_profile`: `default` (frontmatter default; walker confirms or updates if testing variant)

```
[check-vocab-deployment] PASS: all 6 language(s) at HEAD cc523ae1.
  nb: 437e906f
  nn: 2a9654a5
  de: ad7f2697
  es: 2f8b277a
  fr: 5b0b49a7
  en: 65e6068b

  Side-patch reconciliation (recommended next steps):
    1. `npm run sync-vocab` — refresh extension/data/*.json from upstream.
    2. `git diff extension/data/` — empty means side-patches reconciled into upstream.
       Non-empty means an upstream gap; investigate per CLAUDE.md data-logic separation philosophy.
```

## Steps

Numbered, one observable per step. Shape: `<step> → expected: … → observed: … → ✅/❌`.

1. **Load extension** (chrome://extensions → install/reload v2.9.19 → click toolbar icon to open popup) → expected: popup opens cleanly; default view renders; no console errors in the popup DevTools console; no "Error: chrome.X is undefined" or view-module import errors → observed: TBD → ✅/❌

2. **Search** (type a known word in the search box, e.g. NB "hus" or DE "Schule") → expected: matching dictionary entries render via the `mountDictionaryView` module; results are scoped to the container (no leakage); typing more characters refines results → observed: TBD → ✅/❌

3. **Lang switch** (popup language selector → switch to DE → ES → FR → EN → NB → NN in turn, performing a quick search after each switch) → expected: vocab swaps for each language; search results re-render in the new language; no stale results from the prior language remain visible; no console errors on switch → observed: TBD → ✅/❌

4. **Direction toggle** (toggle source/target language direction — e.g. NB→DE vs DE→NB) → expected: dictionary direction inverts; results match new direction (searching "hus" in NB→DE returns "Haus"-shaped entries; searching "Haus" in DE→NB returns "hus"); toggle persists across the current popup session → observed: TBD → ✅/❌

5. **Compound suggestion** (search a known compound, e.g. NB "språkundervisning" or DE "Hausaufgabe") → expected: when an exact entry is missing, the popup surfaces a decomposition suggestion (e.g. språk + undervisning); suggestion is clickable and routes to the constituent entries → observed: TBD → ✅/❌

6. **Lær mer popover** (click "Lær mer" link on a pedagogy-enriched entry — e.g. DE preposition "auf", "in", "an", or any DE entry that has a pedagogy panel) → expected: pedagogy panel expands inline; examples render (German + Norwegian); illustration renders if present in the entry; no layout collapse, no "undefined" placeholders → observed: TBD → ✅/❌

7. **Settings** (popup settings view → toggle preset / grammar features / dark mode (if exposed) → close popup → reopen popup) → expected: settings persist across popup close+reopen via `chrome.storage.local`; toggled grammar features remain toggled; dark mode (if toggled) remains active → observed: TBD → ✅/❌

8. **Account section** (popup account view) → expected: Vipps login state renders correctly — if logged in, shows email + quota balance; if logged out, shows "Logg inn med Vipps" button; clicking the login button opens the OIDC flow without console errors (do NOT need to complete login for this step — just confirm the button reaches Vipps) → observed: TBD → ✅/❌

9. **Pause + vocab-updates banner** (toggle the pause control in the popup; trigger or observe the vocab-updates banner if vocab-revision drift is detected) → expected: pause toggle persists across popup close+reopen; if vocab-revision drift exists, the vocab-updates banner renders with refresh affordance; if no drift, the banner is absent (the absence is the correct observable when pre-flight is exit-0) → observed: TBD → ✅/❌

(Every step must record both expected AND observed — empty observed is a walk-not-completed signal per HYG-01.)

## Defects observed

Use one bullet per defect; file a finding for every ❌:

- F38-N: `<one-line summary>` → see `.planning/uat/findings/F38-N.md`

(If all steps ✅, replace this list with `none`.)

## Outcome

- [ ] All steps pass (no ❌ above)
- [ ] Findings filed: `<comma-separated f_id list, or "none">`
- [ ] Walker signs off: `<name + ISO-8601>`
