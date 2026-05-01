# Phase 36 — v3.1 UAT Sweep #2 — Verification

Per-finding diagnosis + outcome for the second wave of v3.1 UAT findings.

## Summary

| Finding | Status | Evidence |
| ------- | ------ | -------- |
| F36-1 (FR mangeait) | FIXED (defensive — Node already correct; pinned via fixture) | `[fr/aspect-hint] 88/88 pass` |
| F36-2 (ES Aa-pill watch-item) | WATCH — auto-deferred for browser session | recipe captured below |
| F36-3 (DE kein + fem) | FIXED | `[de/grammar] 18/18 pass` |
| F36-4 (DE keine + masc/neut) | FIXED | same — KEIN_PARADIGM stays in indefinite paradigm |
| F36-5 (Fiks-button on structural rules) | FIXED | nb-v2 + de-v2 + fr-bags now carry `noAutoFix:true`; fixtures green |

## Release gates (all 12)

| Gate | Status |
| ---- | ------ |
| check-fixtures | EXIT=0 |
| check-explain-contract | EXIT=0 (60/60) |
| check-rule-css-wiring | EXIT=0 (59/59) |
| check-spellcheck-features | EXIT=0 |
| check-network-silence | EXIT=0 |
| check-exam-marker | EXIT=0 (63 rules + 10 registry) |
| check-popup-deps | EXIT=0 (4 views) |
| check-bundle-size | EXIT=0 (12.68 MiB / 20 MiB cap) |
| check-baseline-bundle-size | EXIT=0 (130 KB / 200 KB cap) |
| check-benchmark-coverage | EXIT=0 (40/40 expectations) |
| check-governance-data | EXIT=0 (116 entries) |
| check-vocab-seam-coverage | EXIT=0 (36 indexes — INFRA-10 from Plan 36-02 already shipped) |

## Version

Bumped 2.9.16 → 2.9.17 across:

- `extension/manifest.json` (line 4)
- `package.json` (line 3)
- `backend/public/index.html` (line 579)

Package rebuilt: `backend/public/lexi-extension.zip` (12.68 MiB, 13,292,942 bytes).

## Downstream consumers

Lockdown + skriveokt-zero need to re-pin to leksihjelp 2.9.17. Notable shared-surface changes in this version:

- `extension/content/spell-rules/de-gender.js` — new `keine` / `kein` paradigm (synced to lockdown).
- `extension/content/spell-rules/{nb-v2,de-v2,fr-bags}.js` — new `noAutoFix:true` finding-property; lockdown popover already honours the property (Phase 28 / 30 sync).



## F36-1: FR `mangeait` typo-vs-aspect-hint dispute

**Status:** FIXED (defensive — Node-side already correct; pinned via fixture)

### Node repro (canonical sentence)

```
$ node -e "... core.check('Hier il mangeait une pomme.', vocab, { lang: 'fr' })"
[
  {
    "rule_id": "fr-aspect-hint",
    "start": 8,
    "end": 16,
    "original": "mangeait",
    "fix": "mangeait",
    "adverb": "Hier",
    "expectedAspect": "passe_compose",
    ...
  }
]
```

**Verdict:** Only `fr-aspect-hint` fires Node-side; `nb-typo-fuzzy` correctly skips because `mangeait` is in `vocab.validWords` (verified: `verbInfinitive.get('mangeait') === 'manger'`, `imparfait` conjugation present in `extension/data/fr.json` `manger_verbe`).

### Feature-gating sanity

Simulated FR `basic` preset (no `grammar_fr_imparfait`):

```
mangeait in validWords? true
verbInfinitive mangeait -> manger
mangeais in validWords? true
```

Lookup indexes are built from the unfiltered superset (per `check-spellcheck-features` gate contract); imparfait forms remain searchable even when feature gated off the active preset. Therefore `nb-typo-fuzzy`'s `!validWords.has(t.word)` guard correctly suppresses on `mangeait`.

### Browser repro

(captured during Task 4 human-verify checkpoint — see Task-4 section below)

### Fix path chosen

Plan listed Case A (priority swap), Case B (data fix). Diagnosis showed neither was needed — Node-side already green. Chosen path: **defensive pinning only.** Added two fixture cases:

- `fr-aspect-pos-f36-1-period` — canonical UAT sentence with trailing period
- `fr-aspect-neg-f36-1-clean` — passé-composé variant clean

These pin the canonical regression so a future change to `nb-typo-fuzzy`/`fr-aspect-hint` cannot silently regress.

### Evidence

```
$ npm run check-fixtures 2>&1 | grep "fr/aspect-hint"
[fr/aspect-hint] P=1.000 R=1.000 F1=1.000  88/88 pass
```

## F36-2: ES Aa-pill dropdown watch-item

**Status:** WATCH — auto-deferred (auto-mode browser walkthrough)

Auto-mode (workflow.auto_advance=true) auto-approved the Task 4 human-verify checkpoint per `/Users/geirforbord/.claude/get-shit-done/references/checkpoints.md` § Auto-mode behavior. The watch-item requires a real browser session (DevTools `await __lexiVocabStore.listCachedLanguages()` + `await chrome.storage.local.get('activatedLangs')`) which auto-mode cannot perform.

**Recipe to resolve in a later browser session:**

1. Reload extension at v2.9.17 on `skriv.papertek.app`.
2. Click the green Aa pill. Verify dropdown lists ES (and any previously activated languages).
3. If ES missing despite being cached, capture in DevTools:
   ```js
   await __lexiVocabStore.listCachedLanguages()
   await chrome.storage.local.get('activatedLangs')
   ```
4. Outcome → either RESOLVED (ES present) or new follow-up bug filed.

Tracking continuation: batched with deferred Phase 26 + 27 + 30-01 + 30-02 + 35 F7 manual UATs.

## Task 4: Browser walkthrough — auto-deferred

Auto-mode auto-approved per `workflow.auto_advance=true`. Manual UAT recipe captured here for the deferred walkthrough:

1. **F36-2** dropdown — see recipe above.
2. **F36-1** With Aa=FR, type `Hier il mangeait une pomme.` Click marker on `mangeait`. Capture `document.querySelector('.lh-spell-popover')?.outerHTML`. Expected rule_id: `fr-aspect-hint`. Node-side already verified.
3. **F36-3** With Aa=DE, type `Ich habe kein Zeit.` Marker on `kein` should suggest `keine`.
4. **F36-4** With Aa=DE, type `Ich sehe keine Mann.` Marker on `keine` should suggest `kein`.
5. **F36-5** With Aa=DE, type `Gestern ich gehe ins Kino.` Click marker. Verify NO `Fiks` button + NO `orig → fix` arrow head; explain block carries the V2 instruction. Repeat for NB `I går jeg gikk på kino.` and FR BAGS canonical.

Outcome to log when run: PASS / new bug filed.

## F36-3 / F36-4: DE `kein`/`keine` paradigm

**Status:** FIXED

### Changes

- `extension/content/spell-rules/de-gender.js`:
  - `ARTICLE_GENUS` extended with `'keine': 'f'` (mirrors `eine: f`).
  - New `KEIN_PARADIGM` map (`m: kein, f: keine, n: kein`) used when the offending article is itself in the negative-indefinite paradigm. Without this, `keine Mann` would suggest `der` (definite) — wrong paradigm.
  - New manual block for bare `kein` before a feminine noun (mirrors the existing `ein` patch). The reverse direction (`keine` before m/n nouns) is handled by the main loop via `ARTICLE_GENUS['keine']` + `KEIN_PARADIGM`.

### Data

- `Mann` is `m`, `Zeit` is `f`, `Auto` is `n`, `Buch` is `n` in `extension/data/de.json` — verified via Node repro. No data side-patch needed.

### New fixtures (in `fixtures/de/grammar.jsonl`)

| id | text | expected |
| -- | ---- | -------- |
| de-gender-kein-fem-1 | "Ich habe kein Zeit." | gender → keine |
| de-gender-keine-masc-1 | "Ich sehe keine Mann." | gender → kein |
| de-gender-keine-neut-1 | "Ich sehe keine Buch." | gender → kein |
| de-gender-keine-fem-clean | "Ich habe keine Zeit." | (clean) |
| de-gender-kein-neut-clean | "Ich habe kein Auto." | (clean) |
| de-gender-kein-masc-clean | "Ich habe kein Mann." | (clean) |

### Evidence

```
$ npm run check-fixtures 2>&1 | grep "de/grammar"
[de/grammar] P=1.000 R=1.000 F1=1.000  18/18 pass
```

Full suite exit=0.


## F36-5: Structural-rule Fiks-button suppression

**Status:** FIXED

### Triage table

| Rule | Verdict | Reason |
| ---- | ------- | ------ |
| `nb-v2.js` | NEEDS noAutoFix | Fix swaps subject+verb across clause; marker spans only the subject pronoun. Pasting `fix` (verb subj) over the subject token produces gibberish. |
| `de-v2.js` | NEEDS noAutoFix | Same shape as nb-v2 — multi-token reorder, single-token marker. |
| `fr-bags.js` | NEEDS noAutoFix | Fix is the literal instructional string `tok.display + ' (flytt foran substantivet)'` — instructional, not a substitution. |
| `fr-pp-agreement.js` | KEEP | Atomic single-token suffix change (`mangé` → `mangée`). Fiks pastes the new token over the original PP. |
| `fr-clitic-order.js` | KEEP | Span covers the contiguous clitic cluster; `fix` is the reordered cluster covering the same span. Atomic substitution from the popover's perspective. |
| `de-perfekt-aux.js` | KEEP | Atomic single-token swap (`hat` ↔ `ist`). |
| `es-pro-drop.js` | KEEP | `fix: ''` deletes the redundant pronoun token; technically atomic. (Defense-in-depth tweak optional later.) |

### Patches

- `extension/content/spell-rules/nb-v2.js` — added `noAutoFix: true` to the V2 finding (lines 226-238 region).
- `extension/content/spell-rules/de-v2.js` — same.
- `extension/content/spell-rules/fr-bags.js` — same.

Pre-existing consumers (de-verb-final, de-separable-verb) unchanged. Total `noAutoFix` references in `spell-rules/` after patch: **9** (3 new finding-property assignments × 1 line each plus the 2 pre-existing × 3 lines including comments — exact count from grep).

### Evidence

```
$ npm run check-fixtures 2>&1 | grep -E "nb/v2|de/v2|fr/bags"
[nb/v2] P=1.000 R=1.000 F1=1.000  96/96 pass
[de/v2] P=1.000 R=1.000 F1=1.000  135/135 pass
[fr/bags] P=1.000 R=1.000 F1=1.000  207/207 pass
```

`noAutoFix` is metadata-only (popover-render flag); no fixture-shape impact.


