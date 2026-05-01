---
walkthrough_id: UAT-EXT-02
phase: 38-extension-uat-batch
verification_kind: human-browser-walk
ext_version: 2.9.19
idb_revision: none
preset_profile: default
browser_version: Chrome 147.0.7727.117 arm64
reload_ts: 2026-05-01T20:50:00+02:00
target_browsers: [chrome, edge, brave]
walker: Geir
date: 2026-05-01
---

<!--
Instantiated from .planning/uat/TEMPLATE-walkthrough.md for Phase 38-04 final walkthrough.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.

Sequence position (per STATE v3.2 entry decision): warm-up (UAT-EXT-01, complete) → canonical (UAT-EXT-04, complete)
→ highest-stakes (UAT-EXT-03, complete) → final (this — Phase 26 / UAT-EXT-02).

Target surface: Phase 26 DE pedagogy — de-prep-case rule + Wechselpräpositionen, Lær mer popover with
examples + illustrations. Lær mer is rendered by `extension/content/spell-check.js` (content-script
popover surface), NOT the popup view (per UAT-EXT-04 Step 6 plan-scope clarification).

This walk closes Phase 35 F7 carry-over — the deferred NN/EN locale Lær mer cross-locale walks (Steps 5+6).

CRITICAL classification guidance for any ❌:
- **Logic defect** (popover doesn't render, panel doesn't expand, layout broken)
  → fix in extension code, sync_status=extension-only.
- **Data defect** (wrong example, missing pedagogy entry, NN/EN string missing)
  → root cause in papertek-vocabulary; sync_status=needs-resync.
  Fix at API source per CLAUDE.md "Data-Logic Separation"; then `npm run sync-vocab` in extension.
  Pair with [lockdown-resync-needed] commit marker (HYG-06) on any extension/data/*.json bump.

Sidecar 404s for `bigrams-de.json`, `freq-de.json`, `pitfalls-de.json` are EXPECTED and out-of-scope
here (same architectural gap as F38-1 / candidate plan 38-01.2). Do not file findings on those.

Frontmatter field guidance:
- ext_version: fill from extension/manifest.json — guards stale-zip walks
- idb_revision: fill from chrome.storage / DevTools IndexedDB — guards stale-data walks (TBD — fill at walk time)
- preset_profile: default | basic | full — guards Phase 05.1 feature-gating regression class
- browser_version: e.g. "Chrome 138.0.6962.42"
- reload_ts: ISO-8601 — chrome://extensions reload timestamp (TBD — fill at walk time)
-->


# Walkthrough: Phase 26 DE Lær mer (4 default + 2 NN/EN locale, closes F7)

Re-confirms the Phase 26 DE pedagogy UI works end-to-end against real Chrome — de-prep-case + Wechselpräpositionen rules surface dots, popovers render, Lær mer panel expands with examples + tables. Final walk in the locked Phase 38 sequence. Steps 5+6 close the Phase 35 F7 deferred carry-over (NN/EN locale Lær mer was never walked in real browser).

## Pre-flight evidence (paste before walking)

Run and record each item before touching the browser. Stale artifacts are the #1 v3.1 walkthrough failure mode (Pitfall 1). Pedagogy data lives in papertek-vocabulary, so stale data here = false-defect (Pitfall 2).

- [x] `node scripts/check-vocab-deployment.js` exit code: `0` (run by Claude 2026-05-01, HEAD `cc523ae1`) — output below.
- [x] `extension/manifest.json` `version` matches frontmatter `ext_version`: `2.9.19`
- [x] IDB revision captured from `chrome.storage` (or DevTools → Application → IndexedDB): `none` (no IDB present)
- [x] Reload timestamp recorded from chrome://extensions reload click: `2026-05-01T20:50:00+02:00`
- [x] Browser + version recorded: `Chrome 147.0.7727.117 arm64` — matches frontmatter `browser_version`
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

**Default locale (NB) — 4 DE walks:**

1. **DE de-prep-case (accusative trigger)** — popup foreign-language=Tysk, NB locale. In any DE text input, type a sentence with motion-verb + Wechselpräp + wrong dative case where accusative is needed: e.g. `Ich gehe in der Schule.` (motion → must be `in die Schule`). → expected: spell-check dot fires on `der` (or wherever the de-prep-case rule pinpoints); clicking the dot opens the popover; popover shows the rule's `explain.nb` text and a visible "Lær mer" link; clicking "Lær mer" expands the inline pedagogy panel with the accusative-vs-dative table + at least one canonical example sentence (e.g. `Ich gehe in die Schule` ↔ `Ich bin in der Schule`) + illustration if one is shipped. No console errors. → observed: pass → ✅

2. **DE de-prep-case (dative trigger)** — type a static-verb + Wechselpräp + wrong accusative case where dative is needed: e.g. `Ich bin in den Schule.` (location → must be `in der Schule`). → expected: dot fires on `den`; popover renders; Lær mer panel expands with the dative side of the case explanation (location → dativ); examples confirm the static-verb pattern. → observed: pass → ✅

3. **DE Wechselpräpositionen (movement vs. location)** — type a Wechselpräp sentence with the case-error class explicit, e.g. `Ich lege das Buch auf dem Tisch.` (movement `legen` → must be `auf den Tisch`). → expected: dot fires; popover + Lær mer panel explicitly explains the Wechselpräp framework — that with movement (Wohin?) → akkusativ, with location (Wo?) → dativ — and provides at least 2 contrasting example pairs. → observed: pass → ✅

4. **DE Wechselpräpositionen (full table render)** — open Lær mer on any Wechselpräp finding from Steps 1–3 and visually inspect the prepositions table. → expected: the table renders fully with all 9 standard German Wechselpräpositionen — `an`, `auf`, `hinter`, `in`, `neben`, `über`, `unter`, `vor`, `zwischen` — each row showing the dual case behaviour. No row is collapsed/missing/`undefined`. Table is readable at popover width without horizontal scroll explosion. → observed: pass → ✅

**Cross-locale (closes Phase 35 F7):**

5. **NN locale Lær mer** — popup settings → språk → nynorsk; reload page; re-trigger any Step 1–3 DE pedagogy finding; click "Lær meir" (NN button label). → expected: pedagogy panel renders in NN register — explanation body strings, table headers, and example labels all in NN, not NB-fallback. → observed: pass → ✅
   **Note:** F38-2 (already filed in Plan 38-01) reports partial NN — popover button labels translate but the popover *explanation body* stays in NB. If the same gap recurs here, reference F38-2 in the Defects section rather than file a duplicate; if a *different* NN gap appears (e.g. tables broken, examples missing), file a new F38-N.

6. **EN locale Lær mer** — popup settings → språk → English (memory `project_pedagogy_followups.md` notes EN strings deferred). Re-trigger any Step 1–3 DE pedagogy finding; click "Lær mer" / "Learn more". → expected: EITHER the pedagogy panel renders in EN register (preferred) OR there is graceful fallback to NB without broken layout, missing strings, or `undefined` placeholders. Fallback is acceptable; broken layout / missing data is not. → observed: pass → ✅

(Every step must record both expected AND observed — empty observed is a walk-not-completed signal per HYG-01.)

## Defects observed

Use one bullet per defect; file a finding for every ❌. Classify root-cause direction in the finding (logic vs data) per CLAUDE.md "Data-Logic Separation":

none — clean pass on all 6 walks (4 default-locale DE + 2 cross-locale NN/EN). Phase 26 DE Lær mer pedagogy confirmed end-to-end.

## Outcome

- [x] All steps pass (no ❌ above)
- [x] Findings filed: `none`
- [x] Walker signs off: `Geir 2026-05-01T20:50:00+02:00`

### F7 closure status

- [x] **F7 closure (Steps 5+6 NN/EN locale Lær mer):** both NN and EN locale walks passed. Phase 35 F7 carry-over is **CLOSED**.

> _F7 closure note: NN + EN locale Lær mer panels render correctly on DE pedagogy findings. Closes Phase 35's deferred F7 finding. F38-2 (partial-NN gap from Plan 38-01 walk on French aspect-hint pedagogy) remains open as a separate concern — DE pedagogy NN render is fine, FR pedagogy NN render is the gap._
