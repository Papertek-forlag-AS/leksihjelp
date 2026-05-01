---
walkthrough_id: UAT-EXT-01
phase: 38-extension-uat-batch
verification_kind: human-browser-walk
ext_version: 2.9.18
idb_revision: none
preset_profile: default
browser_version: Chrome 147.0.7727.117 arm64
reload_ts: 2026-05-01T17:00:00+02:00
target_browsers: [chrome, edge, brave]
walker: Geir
date: 2026-05-01
---

<!--
Instantiated from .planning/uat/TEMPLATE-walkthrough.md for Phase 38-01 warm-up walkthrough.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.

Sequence position (per STATE v3.2 entry decision): warm-up (this) → canonical (Phase 30-01 / UAT-EXT-04)
→ highest-stakes (Phase 27 / UAT-EXT-03) → final (Phase 26 / UAT-EXT-02).

Frontmatter field guidance:
- ext_version: fill from extension/manifest.json — guards stale-zip walks
- idb_revision: fill from chrome.storage / DevTools IndexedDB — guards stale-data walks
- preset_profile: default | basic | full — guards Phase 05.1 feature-gating regression class
- browser_version: e.g. "Chrome 138.0.6962.42"
- reload_ts: ISO-8601 — chrome://extensions reload timestamp
-->


# Walkthrough: F36-1 fr-aspect-hint browser confirmation (warm-up)

Re-confirms that the v2.9.15+ vocab-seam fix landed correctly in real-browser conditions for the fr-aspect-hint rule (passé-composé vs imparfait soft-hint). First in the locked Phase 38 walk sequence.

## Pre-flight evidence (paste before walking)

Run and record each item before touching the browser. Stale artifacts are the #1 v3.1 walkthrough failure mode (Pitfall 1).

- [x] `node scripts/check-vocab-deployment.js` exit code: `0` (run by Claude 2026-05-01) — output below.
- [x] `extension/manifest.json` `version` matches frontmatter `ext_version`: `2.9.18`
- [x] IDB revision captured from `chrome.storage` (or DevTools → Application → IndexedDB): `none` (no IndexedDB detected) — matches frontmatter `idb_revision`
- [x] Reload timestamp recorded from chrome://extensions reload click: `2026-05-01T17:00:00+02:00` — matches frontmatter `reload_ts`
- [x] Browser + version recorded: `Chrome 147.0.7727.117 (Official Build) arm64` — matches frontmatter `browser_version`
- [x] Preset profile in popup matches frontmatter `preset_profile`: `default` (frontmatter default; walker confirms or updates if testing variant)

```
[check-vocab-deployment] PASS: all 6 language(s) at HEAD cc523ae1.
  nb: 437e906f
  nn: 2a9654a5
  de: ad7f2697
  es: 2f8b277a
  fr: 5b0b49a7
  en: 65e6068b
```

## Steps

Numbered, one observable per step. Shape: `<step> → expected: … → observed: … → ✅/❌`.

1. **Open a page with a French text input. Type a sentence with passé-composé in narrative-imperfect context (e.g. "Pendant que je marchais, j'ai vu un chien.")** → expected: soft-hint dot appears under `j'ai vu` OR `marchais` OR both per fr-aspect-hint rule logic → observed: NO marking on `marchais`. NB spell-check fires on `j'ai` ("Jai står ikke i ordboken, kanskje du mente j'aime?"). Console shows `freq-fr.json`, `pitfalls-fr.json`, `bigrams-fr.json` 404s. See F38-1. → ❌
2. **Hover the dot** → expected: tooltip text matches the rule's `explain.nb` message → observed: N/A — no dot to hover (Step 1 ❌, blocked by F38-1) → ❌
3. **Click the dot to open the popover** → expected: popover renders with a visible "Lær mer" link → observed: N/A — no dot to click (blocked by F38-1) → ❌
4. **Click "Lær mer"** → expected: pedagogy panel expands with examples + illustration → observed: N/A — Lær mer not reachable (blocked by F38-1) → ❌
5. **Switch to NN locale (popup settings → språk → nynorsk) and reload the page** → expected: popover/Lær mer text renders in NN register → observed: "Lær mer" → "Lær meir" ✓; explanation body still in NB; some other strings in NB while UI in NN. Walker classifies `minor`, defer to later phase. See F38-2. → ❌ (deferred)
6. **Switch back to NB and confirm rule still fires under default preset** → expected: dot still appears on the same trigger sentence → observed: NB rules fire normally on Norwegian input — `[lexi-spell] check {lang:'nb', vocabSize:1416, findingsCount:2-3}`, markers rendered. Round-trip locale toggle did not break anything. Side-evidence: `pitfalls-nb.json` 404 in console — confirms broader sidecar-pipeline gap noted in F38-1 hypothesis (NB still works since handler returns null gracefully). → ✅

(Every step must record both expected AND observed — empty observed is a walk-not-completed signal per HYG-01.)

## Defects observed

Use one bullet per defect; file a finding for every ❌:

- F38-1 (blocker): fr-aspect-hint silent in real Chrome — French input scored against NB dictionary, FR sidecars 404 → see `.planning/uat/findings/F38-1.md`
- F38-2 (minor, deferred): NN locale partial — button labels translate, popover explanation body stays in NB → see `.planning/uat/findings/F38-2.md`

## Outcome

- [ ] All steps pass (no ❌ above)
- [x] Findings filed: `F38-1, F38-2`
- [x] Walker signs off: `Geir 2026-05-01T17:00:00+02:00`

## Re-walk after F38-1 fix (v2.9.19)

Walker re-walked Steps 1–4 against v2.9.19 (sideloaded from `extension/` directory on Mac, ~17:55 2026-05-01).

1. **Step 1 (dot under `j'ai vu`):** ❌ — no dot anywhere on `Pendant que je marchais, j'ai vu un chien.`
2. **Step 2 (hover tooltip):** ❌ — N/A, blocked by Step 1
3. **Step 3 (popover with Lær mer):** ❌ — N/A, blocked by Step 1
4. **Step 4 (pedagogy panel):** ❌ — N/A, blocked by Step 1

**Critical negative check (NB false-fire):** ✅ — NB spell-check no longer flags `j'ai` ("Jai står ikke i ordboken, kanskje du mente j'aime?" popover is GONE). Branch C fix (`nb-typo-fuzzy` elision strip) verified working in real Chrome.

**Outcome:** Partial closure. `nb-typo-fuzzy` fix is real and stays in v2.9.19. `fr-aspect-hint` silence root cause was misdiagnosed — F38-1 reopened. v2.9.19 GitHub Release stays as Draft (do not promote to Latest until fr-aspect-hint actually fires).

Walker sign-off (re-walk): `Geir 2026-05-01T17:55:00+02:00`
