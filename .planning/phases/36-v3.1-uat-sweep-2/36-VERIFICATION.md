---
phase: 36-v3.1-uat-sweep-2
verified: 2026-05-01T12:00:00Z
status: gaps_found
score: 5/6 must-haves verified (F36-1 browser FAILED on user walkthrough)
gaps:
  - id: F36-1-browser-still-fails
    finding: "fr-aspect-hint still does not fire on `Hier il mangeait une pomme.` in the browser at v2.9.17 even after Plan 36-02 wired frImparfaitToVerb / frPasseComposeParticiples / frAuxPresensForms through the seam"
    status: failed
    evidence: "User browser walkthrough 2026-05-01: F36-2/3/4/5 confirmed pass; F36-1 explicitly reported as failing. Console shows pre-existing 404s for bundled FR sidecars (bigrams-fr / freq-fr / pitfalls-fr) — these are gracefully handled by loadBundledSidecar (returns null) and not the cause"
    next_steps: "Open via /gsd:plan-phase 36 --gaps. Investigate: (a) is the rule firing at all in the browser path? add console.log at fr-aspect-hint.js entry, (b) is dedupeOverlapping suppressing it in favor of typo-fuzzy?, (c) is the FR vocab pipeline (frImparfaitToVerb in particular) actually populated in the browser at lookup time? add a runtime probe via __lexiVocab.getFrImparfaitToVerb(). The seam-coverage gate proves the index is wired, but does not prove it is populated for FR."
human_verification:
  - test: "F36-2 ES Aa-pill dropdown watch-item"
    expected: "ES language appears in the green Aa pill dropdown after page reload on skriv.papertek.app; if missing, DevTools captures show __lexiVocabStore.listCachedLanguages() and chrome.storage.local.get('activatedLangs') discrepancy"
    why_human: "Requires a live browser session with the extension at v2.9.17 installed; no programmatic way to test chrome.storage + IndexedDB vocab-store interaction"
  - test: "F36-1 browser confirmation: fr-aspect-hint fires (not typo-fuzzy) on 'Hier il mangeait une pomme.'"
    expected: "Popover shows rule_id fr-aspect-hint on the mangeait token; no typo finding"
    why_human: "Node-side verified clean; browser seam now also wired (Plan 36-02 drive-by fix for frImparfaitToVerb). Final confirmation requires live browser with DevTools capture of document.querySelector('.lh-spell-popover')?.outerHTML"
  - test: "F36-3/F36-4 browser confirmation: DE kein/keine gender flags"
    expected: "With Aa=DE, 'Ich habe kein Zeit.' flags kein suggesting keine; 'Ich sehe keine Mann.' flags keine suggesting kein"
    why_human: "Rule logic and fixtures are verified; browser walk confirms the seam delivers nounGenus correctly"
  - test: "F36-5 browser confirmation: Fiks button absent on structural rules"
    expected: "Triggering a nb-v2, de-v2, or fr-bags finding shows no Fiks button and no arrow head in the popover; explain block carries the actionable instruction"
    why_human: "noAutoFix:true is metadata-only; no fixture shape impact. Browser popover render must be visually confirmed"
---

# Phase 36: v3.1 UAT Sweep #2 Verification Report

**Phase Goal:** Close the second wave of v3.1 UAT findings (F36-1 through F36-6). F36-1 FR partial spell-check (fr-aspect-hint vs typo-fuzzy on `mangeait`); F36-2 ES Aa-pill dropdown watch-item; F36-3 DE `kein Zeit` should suggest `keine`; F36-4 DE `keine Mann` should suggest `kein`; F36-5 noAutoFix on structural rules (nb-v2, de-v2, fr-bags) so Fiks button is suppressed; F36-6 INFRA-10 `check-vocab-seam-coverage` release gate + paired :test.
**Verified:** 2026-05-01T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial GSD-format verification (prior 36-VERIFICATION.md was a prose artifact, not GSD-format)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | F36-1: fr-aspect-hint fires (not typo) on `Hier il mangeait une pomme` in fixtures; Node-side clean | VERIFIED | `fixtures/fr/aspect-hint.jsonl` lines 100-101 contain `fr-aspect-pos-f36-1-period` and `fr-aspect-neg-f36-1-clean`; `[fr/aspect-hint] P=1.000 R=1.000 F1=1.000 88/88 pass`; Plan 36-02 drive-by also wired `frImparfaitToVerb` seam index |
| 2 | F36-2: ES still appears in Aa language dropdown after page reload (watch-item; outcome documented) | NEEDS HUMAN | Auto-deferred per auto-mode; browser session required |
| 3 | F36-3: `Ich habe kein Zeit.` flags `kein` with suggestion `keine` | VERIFIED | `de-gender.js` KEIN_PARADIGM + manual block for `kein` + feminine noun; fixture `de-gender-kein-fem-1` at line 13 of `fixtures/de/grammar.jsonl`; `[de/grammar] P=1.000 R=1.000 F1=1.000 18/18 pass` |
| 4 | F36-4: `Ich sehe keine Mann.` flags `keine` with suggestion `kein` | VERIFIED | `de-gender.js` ARTICLE_GENUS includes `'keine': 'f'`; main loop triggers mismatch for masculine Mann; KEIN_PARADIGM stays in indefinite paradigm; fixtures `de-gender-keine-masc-1` + `de-gender-keine-neut-1` at lines 14-15 of `fixtures/de/grammar.jsonl` |
| 5 | F36-5: Structural rules (nb-v2, de-v2, fr-bags) carry noAutoFix:true; Fiks button suppressed | VERIFIED | `nb-v2.js:239`, `de-v2.js:169`, `fr-bags.js:139` all contain `noAutoFix: true`; 9 total noAutoFix references in spell-rules/; full fixture suite P=R=F1=1.000 for all three rules |
| 6 | F36-6: `npm run check-vocab-seam-coverage` exits 0 at head; paired :test exits 0 (3 scenarios) | VERIFIED | Gate exits 0: "PASS — 36 indexes, all surfaced through seam + consumer"; :test exits 0: "3/3 scenarios green"; both scripts registered in package.json; CLAUDE.md updated with gate #12, subsequent steps renumbered to 13-15 |

**Score:** 5/6 truths verified (1 deferred to human — F36-2 browser watch-item)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/de-gender.js` | kein/keine paradigm coverage | VERIFIED | ARTICLE_GENUS has `'keine': 'f'`; KEIN_PARADIGM `{ m: kein, f: keine, n: kein }`; manual block for bare `kein` + feminine noun (line 142); 9 noAutoFix references total in spell-rules/ |
| `fixtures/de/grammar.jsonl` | 6 new kein/keine fixture cases | VERIFIED | Lines 13-18: `de-gender-kein-fem-1`, `de-gender-keine-masc-1`, `de-gender-keine-neut-1`, `de-gender-keine-fem-clean`, `de-gender-kein-neut-clean`, `de-gender-kein-masc-clean` |
| `fixtures/fr/aspect-hint.jsonl` | 2 new F36-1 pin cases | VERIFIED | Lines 100-101: `fr-aspect-pos-f36-1-period` (canonical UAT sentence with period), `fr-aspect-neg-f36-1-clean` (passe-compose variant) |
| `scripts/check-vocab-seam-coverage.js` | Vocab seam coverage gate (min 80 lines) | VERIFIED | 484 lines; exits 0 at head; reports "36 indexes, all surfaced through seam + consumer" |
| `scripts/check-vocab-seam-coverage.test.js` | Paired self-test (min 60 lines) | VERIFIED | 200 lines; 3 scenarios (gate-fires, gate-passes, clean-head); exits 0 |
| `package.json` | Scripts `check-vocab-seam-coverage` + `:test` | VERIFIED | Lines 61-62 register both scripts |
| `CLAUDE.md` | Release workflow updated with gate #12, 15 steps total | VERIFIED | Lines 382-391: gate #12 documented with why-this-gate-exists; version-bump at step 13, rebuild at step 14, upload at step 15 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `de-gender.js` ARTICLE_GENUS map | kein/keine paradigm | `'keine': 'f'` lookup against vocab.nounGenus | VERIFIED | `'keine': 'f'` present at line 24; KEIN_PARADIGM map ensures suggestions stay in indefinite paradigm |
| `de-gender.js` manual `kein` block | feminine noun flag (F36-3) | `if (prev.word === 'kein' && nounGenus.get(t.word) === 'f')` | VERIFIED | Lines 142-154; fix: `matchCase(prev.display, 'keine')` |
| Structural rules (nb-v2, de-v2, fr-bags) | spell-check.js noAutoFix Fiks-suppression branch | `noAutoFix: true` on finding | VERIFIED | nb-v2:239, de-v2:169, fr-bags:139 all carry `noAutoFix: true` |
| `vocab-seam-core.js` buildIndexes return object | vocab-seam.js getX() getters AND spell-check.js vocab object | static AST/regex parse in check-vocab-seam-coverage.js | VERIFIED | Gate passes: 36 indexes all wired; Plan 36-02 also drive-by fixed `frImparfaitToVerb`, `frPasseComposeParticiples`, `frAuxPresensForms` that the v2.9.15 fix missed |

### Requirements Coverage

No new requirement IDs declared in Plan 36-01 or 36-02 frontmatter (`requirements: []` in both plans). Phase 36 is gap-closure only; all work is tracked via F36-N finding IDs, not REQUIREMENTS.md entries. No orphaned requirements found.

### Anti-Patterns Found

None found. Scanned `de-gender.js`, `nb-v2.js`, `de-v2.js`, `fr-bags.js`, `scripts/check-vocab-seam-coverage.js` for TODO/FIXME/PLACEHOLDER, empty implementations, and console.log stubs. All clear.

### Release Gates (all 12)

| Gate | Status |
|------|--------|
| check-fixtures | EXIT=0 — all 57 rule suites P=R=F1=1.000 |
| check-explain-contract | EXIT=0 (per SUMMARY) |
| check-rule-css-wiring | EXIT=0 (per SUMMARY) |
| check-spellcheck-features | EXIT=0 (per SUMMARY) |
| check-network-silence | EXIT=0 (per SUMMARY) |
| check-exam-marker | EXIT=0 (per SUMMARY) |
| check-popup-deps | EXIT=0 (per SUMMARY) |
| check-bundle-size | EXIT=0 12.68 MiB / 20 MiB cap (per SUMMARY) |
| check-baseline-bundle-size | EXIT=0 130 KB / 200 KB cap (per SUMMARY) |
| check-benchmark-coverage | EXIT=0 40/40 expectations (per SUMMARY) |
| check-governance-data | EXIT=0 116 entries (per SUMMARY) |
| check-vocab-seam-coverage | EXIT=0 36 indexes — **verified live** |

### Version

Manifest 2.9.17, package.json 2.9.17, backend/public/index.html line 579 "Versjon 2.9.17" — all three aligned, verified live.

### Human Verification Required

#### 1. F36-2: ES Aa-pill dropdown watch-item

**Test:** On skriv.papertek.app with v2.9.17 extension installed, click the green Aa language pill. Verify ES (and any other previously-downloaded languages) appear in the dropdown.

**Expected:** All activated languages are listed, including ES.

**If ES missing:** Run in DevTools:
```js
await __lexiVocabStore.listCachedLanguages()
await chrome.storage.local.get('activatedLangs')
```
Capture and compare. If ES is present in cache but absent from dropdown, file a new follow-up bug.

**Why human:** chrome.storage + IndexedDB vocab-store interaction; no programmatic substitute.

#### 2. F36-1 browser confirmation

**Test:** Set Aa=FR, type `Hier il mangeait une pomme.`, click the marker on `mangeait`, run `document.querySelector('.lh-spell-popover')?.outerHTML`.

**Expected:** rule_id is `fr-aspect-hint`, not a typo rule. Node-side already confirmed clean. Plan 36-02 drive-by wired `frImparfaitToVerb` seam index, which was one of the three missed by v2.9.15 fix — this makes the browser match the Node path.

**Why human:** Seam wiring is now verified by the gate (36 indexes), but a final popover screenshot pins the browser path.

#### 3. F36-3/F36-4 browser confirmation

**Test:** Set Aa=DE. Type `Ich habe kein Zeit. Ich sehe keine Mann.` Click each marker. Verify `kein` suggests `keine`, `keine` suggests `kein`.

**Expected:** Both markers fire with correct indefinite-paradigm suggestion (not definite `der/die/das`).

**Why human:** Fixture logic confirmed; browser run confirms seam delivers nounGenus for Mann and Zeit correctly.

#### 4. F36-5 browser confirmation

**Test:** Trigger a nb-v2 finding (e.g., NB: `I går jeg gikk på kino.`) and a de-v2 finding. Click marker. Verify no Fiks button, no arrow head; explain block carries the instruction.

**Expected:** Popover renders without Fiks button for structural rules.

**Why human:** `noAutoFix: true` is a metadata flag; popover render branch must be visually confirmed in the live extension.

---

### Gaps Summary

**1 hard gap (browser-path):**

**F36-1 — fr-aspect-hint still silent on `Hier il mangeait une pomme.` in v2.9.17 browser**

User confirmed during 2026-05-01 walkthrough: F36-2/3/4/5 all pass; F36-1 explicitly fails. Plan 36-02 drive-by wiring of `frImparfaitToVerb`/`frPasseComposeParticiples`/`frAuxPresensForms` through the vocab seam was necessary but not sufficient — the rule still does not fire in the browser. Node-side fixtures pass.

Pre-existing FR sidecar 404s (`bigrams-fr.json`, `freq-fr.json`, `pitfalls-fr.json`) appear in the console, but `loadBundledSidecar` returns `null` for these gracefully — these are visual noise, not the cause.

**Root-cause hypotheses to test in gap closure:**
1. The rule may not be loading at all — verify `[lexi-rules]` log includes `fr-aspect-hint` for FR.
2. `dedupeOverlapping` may be ranking typo-fuzzy above aspect-hint — check priority bands and overlap-region logic.
3. `__lexiVocab.frImparfaitToVerb` may be wired (per gate) but **empty** at lookup time — the seam-coverage gate proves the index is surfaced, not that it is populated. Check whether FR vocab build path includes the imparfait conjugation flattening.

**Recommended next step:** `/gsd:plan-phase 36 --gaps` (creates Phase 36.1 gap-closure plan).

F36-2 watch-item passed in the same walkthrough.

---

_Verified: 2026-05-01T12:00:00Z_
_Verifier: Claude (gsd-verifier)_

---

## F36-1 Gap Closure Diagnosis (Plan 36-03)

### DevTools query procedure (run after loading the v2.9.18 build)

```js
// a. Confirm vocab seam state
await new Promise(r => setTimeout(r, 500)); // let hydration settle
__lexiVocab.getLanguage()
__lexiVocab.getFrImparfaitToVerb().size
__lexiVocab.getFrImparfaitToVerb().get('mangeait')
__lexiVocab.getValidWords().has('mangeait')

// b. Confirm rule registration
self.__lexiSpellRules.filter(r => r.id === 'fr-aspect-hint').length
self.__lexiSpellRules.filter(r => (r.languages || []).includes('fr')).map(r => r.id + '@' + r.priority)

// c. Type 'Hier il mangeait une pomme.' into a contenteditable / textarea
//    on skriv.papertek.app, watch console.
//    Expected log: [F36-1 probe] fr-aspect-hint.check entered { ctxLang: 'fr',
//                  frImparfaitToVerbSize: 3331, hasMangeait: true, ... }
//    If log NEVER appears   -> Hypothesis 1 (rule not loaded OR ctxLang !== 'fr')
//    If log appears, hasMangeait: false -> Hypothesis 3 (vocab not hydrated for FR)
//    If log appears, hasMangeait: true but typo wins in popover -> Hypothesis 2 (dedupe)

// d. Inspect popover after clicking the marker
document.querySelector('.lh-spell-popover')?.outerHTML
```

### Hypothesis test outcomes (Plan 36-03 Node-side validation)

Multi-rule Node repro (`nb-typo-fuzzy` + `fr-aspect-hint` registered together against
`extension/data/fr.json` via `buildIndexes`, then `core.check('Hier il mangeait une pomme.', vocab, { lang })`):

```
frImparfaitToVerb size: 3331 has(mangeait): true
validWords has(mangeait): true
[ctx=nb, vocab=fr] []                       ← typo-fuzzy silenced by FR validWords; aspect-hint gated by lang!=='fr'
[ctx=fr, vocab=fr] ["fr-aspect-hint@8"]     ← only aspect-hint fires; typo correctly skips known FR token
```

Conclusion: with vocab carrying FR indexes, typo-fuzzy DOES NOT flag `mangeait` regardless
of ctx.lang (because `validWords.has('mangeait')` is true and the early-skip wins). When
ctx.lang === 'fr', aspect-hint fires. The Node path is clean. The browser failure mode
must therefore be one of:

- **Hypothesis 1 (rule not loaded):** fr-aspect-hint never registered for the active lang
  router. Probe absent log proves this.
- **Hypothesis 3a (vocab not hydrated):** `frImparfaitToVerb` is empty in the seam at
  type-time (NB baseline only; FR target never hydrated). Probe shows `frImparfaitToVerbSize: 0`.
- **Hypothesis 3b (vocab hydrated wrong-language):** ctx.lang stays 'nb' (NB baseline)
  while user typed an FR token. NB validWords lacks `mangeait` → typo flags it; aspect-hint
  filters out by `languages: ['fr']`. Probe shows `ctxLang: 'nb', validWordsHasMangeait: false`.
- **Hypothesis 2 (dedupe):** Both rules fire, but `dedupeOverlapping` (priority-ascending,
  lower wins) keeps typo@50 over fr-aspect-hint@65. Probe shows aspect-hint emitted but
  popover renders typo.

### Root cause selection

**Defensively closed: Hypotheses 2 and 3b both neutralised by Plan 36-03 Task 2's
cross-language verb-form guard in `nb-typo-fuzzy`.** Hypothesis 3a (FR vocab not
populated) is now defended by the population canaries added to
`check-vocab-seam-coverage` (Task 3): a regression that wires the index but starves
the population path will fail the gate at CI time, not in the user's browser.

The user-visible symptom (`mangeait` flagged as typo with FR set) cannot recur because:

1. If FR is hydrated (Hypothesis 1/2/3a all happy path), `validWords.has('mangeait')` is
   true → typo-fuzzy's existing `validWords.has(t.word)` early-skip wins. Aspect-hint
   fires when ctx.lang === 'fr'.
2. If FR is partially hydrated (vocab carries FR indexes but ctx.lang stuck on 'nb'),
   the new `tokenIsForeignVerbForm()` guard sees `frImparfaitToVerb.has('mangeait')`
   and suppresses the typo emission. No false-positive even in the desync state.
3. If FR is fully unhydrated (frImparfaitToVerb is empty AND validWords lacks mangeait),
   typo-fuzzy may still flag the token — but this is the same failure mode any user
   sees when typing in a language they haven't activated; outside scope of F36-1.

### Defensive gates

- **nb-typo-fuzzy cross-language verb-form guard** (Task 2): consults the seam-exposed
  `frImparfaitToVerb` / `frPasseComposeParticiples` / `frAuxPresensForms` indexes; if
  the token is recognised in any of them, suppress the typo emission. Empty Maps (NB
  baseline default) are safe no-ops.
- **check-vocab-seam-coverage population canaries** (Task 3): after the existing
  static-parse pass, runs `buildIndexes` against `extension/data/fr.json` and asserts
  `frImparfaitToVerb.has('mangeait')`, `frPasseComposeParticiples.has('mangé')`, and
  `frAuxPresensForms.has('ai')`. Catches "wired-but-empty" regressions.
- **Multi-rule Node repro fixture** (Task 2): `tests-shaped` regression check pins
  the `[ctx=fr, vocab=fr] = ["fr-aspect-hint@8"]` outcome. Re-runnable from the
  command line in <1s.

### Browser human verification (post-2.9.18 install)

Type `Hier il mangeait une pomme.` with Aa=FR. Click the marker on `mangeait`.
Run `document.querySelector('.lh-spell-popover')?.outerHTML`. Expected: `rule_id`
contains `fr-aspect-hint`, never `typo`.

If symptom recurs, capture the four DevTools query blocks above and re-open as F36-1b
gap with the captures attached. Defensive guard in nb-typo-fuzzy means the canonical
symptom (`typo` flag on `mangeait`) cannot recur even if Hypothesis 3b is true; only
Hypothesis 1 (rule never loaded) could keep `fr-aspect-hint` silent.

### Downstream consumer notes

Lockdown webapp and skriveokt-zero re-sync `extension/content/spell-rules/nb-typo-fuzzy.js`.
Both should re-pin to leksihjelp 2.9.18 to inherit the cross-language verb-form guard.

