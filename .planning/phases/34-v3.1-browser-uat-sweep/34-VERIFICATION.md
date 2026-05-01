---
phase: 34
status: gaps_found
walked: 2026-05-01
driver: Geir
---

# Phase 34 Verification — v3.1 Browser UAT Sweep

## Summary

Manual browser walkthrough of all v3.1 deferred UAT items, executed against `staging-lockdown.web.app` (commit `5830fcc` after re-syncing leksihjelp v2.9.13) and supplemented by extension-side smoke checks where the lockdown sidepanel cannot expose the relevant surface.

Two in-flight fixes shipped during the session:
1. **leksihjelp v2.9.12 → v2.9.13** — `extension/content/spell-check.js`: hide green Aa pill in non-leksihjelp UI surfaces (sidepanel search input, popup, lookup card, floating widget) and on engine-disable. Surfaced by sub-checks unrelated to the script but blocked sidepanel UAT credibility.
2. **lockdown editor-toolbar F4** — top-bar `Stavekontroll: Leksihjelp` pill gains amber border + EKSAMEN suffix in EKSAMENMODUS, mirroring the sidepanel EKSAMENMODUS badge and floating-widget amber border. UI consistency gap raised mid-walk.

Six findings filed as Phase 35 (gap closure from this phase).

## Per-criterion result

### Criterion 1: Lockdown Exam-Mode E2E

| Sub-check | Result | Notes |
|---|---|---|
| 1.1 Teacher saves LEKSIHJELP_EXAM test | PASS | |
| 1.2 EKSAMENMODUS badge shown in sidepanel | PASS | (Settings drawer is intentionally hidden in lockdown — toggle/caption sub-check dropped from spec) |
| 1.3 Floating widget amber border on selected text | PASS | |
| 1.4 Word-prediction dropdown does not open | PASS | |
| 1.5 Grammar-lookup dots suppressed; typo + dictionary remain | PASS | Verified with DE test sentence covering `de-prep-case`, `de-v2`, `de-perfekt-aux`, `de-verb-final` (all suppressed) vs `de-gender`, `typo` curated (both fired). Dictionary lookup remains functional. |
| 1.6 Profile transition off LEKSIHJELP_EXAM clears flags | PASS | |
| 1.7 No JS errors in DevTools | PASS | Console warnings observed are all from non-leksihjelp surfaces (cdn.tailwindcss.com warning, Firestore deprecation, iframe-sandbox warning, snapshot-timer permission error). No leksihjelp errors. snapshot-timer permission error is a separate lockdown concern, not Phase 34. |

**Result: PASS (7/7)**

### Criterion 2: Lockdown Sidepanel Dictionary Parity

| Sub-check | Result |
|---|---|
| 2.1 Ordbok usable inside EKSAMENMODUS | PASS |
| 2.2 DE noun (Schule) declension renders | PASS |
| 2.3 DE verb (sein) conjugation renders | PASS |
| 2.4 Language switcher cycles | PASS |
| 2.5 Direction toggle reflects selected pair | PASS |
| 2.6 No audio play buttons | PASS |

**Result: PASS (6/6)**

### Criterion 3: Phase 26 DE "Lær mer"

| Sub-check | Result |
|---|---|
| 3.1 Dativ case badge colour | PASS — `mit der Hund` triggers `de-prep-case` popover correctly (see screenshot `mit der Hund works, the other dont.png`) |
| 3.2 Wechselpräposition side-by-side (wide) | INCONCLUSIVE — `in der Schule` did not fire `de-prep-case` Wechselpräposition trigger. Filed as F5 (Phase 35). |
| 3.3 Wechselpräposition stacked (narrow) | INCONCLUSIVE — same root cause as 3.2 |
| 3.4 Esc collapses panel | PASS |
| 3.5 NN locale strings | DEFERRED — no UI-language toggle in lockdown sidepanel by design; filed as F7 for vanilla extension UAT |
| 3.6 EN locale strings | DEFERRED — same reason as 3.5 |
| 3.7 Tab navigation resets state | FAIL — Tab moves focus to next marker but Lær mer panel auto-collapses after ~1s. Filed as F6 (Phase 35). |

**Result: PARTIAL (2/7 PASS, 2/7 INCONCLUSIVE filed as F5, 2/7 DEFERRED filed as F7, 1/7 FAIL filed as F6)**

### Criterion 4: Phase 32 FR/ES

| Sub-check | Result |
|---|---|
| 4.1 FR `fr-aspect-hint` on `Hier il mangeait une pomme` | FAIL — `findingsCount: 0` for FR even with canonical trigger sentence. Curated typo rule fires on gibberish (so FR engine isn't dead), but aspect-hint is silent. Filed as F1 (Phase 35). |
| 4.2 ES `es-por-para` on `Estudio español por mi trabajo` | PASS — popover shows `por + mi trabajo -> para` from data |
| 4.3 ES `es-gustar` extended verbs on `El encanta la música` | FAIL — encanta not flagged. Additionally `duele` (correct verb form of doler) is flagged as out-of-dictionary, indicating doler conjugations missing from ES vocab. Filed as F2/F3 (Phase 35) — papertek-vocabulary data gap. |

**Result: PARTIAL (1/3 PASS, 2/3 FAIL filed as F1/F2/F3)**

### Criterion 5: Disposition roll-up

All findings have explicit dispositions. Zero `human_needed` deferrals roll forward.

| ID | Finding | Disposition |
|---|---|---|
| F1 | FR `fr-aspect-hint` does not fire on canonical trigger | Phase 35 plan 35-01 |
| F2 | ES `es-gustar` does not fire on extended verbs (encantar) | Phase 35 plan 35-01 (cross-repo papertek-vocabulary) |
| F3 | `duele` flagged as out-of-dictionary (doler conjugations missing) | Phase 35 plan 35-01 (cross-repo papertek-vocabulary) |
| F4 | Top-bar pill needs amber tint + EKSAMEN suffix in EKSAMENMODUS | **In-flight fix landed** in lockdown commit `5830fcc → next` |
| F5 | DE Wechselpräposition `in der Schule` does not fire | Phase 35 plan 35-01 |
| F6 | Tab navigation auto-collapses Lær mer panel after ~1s | Phase 35 plan 35-01 |
| F7 | NN/EN locale (3.5, 3.6) untestable in lockdown | Phase 35 plan 35-01 (extension UAT) |
| (extra) | snapshot-timer Firestore permission error | Out of scope for Phase 34/35; lockdown-side ticket |

### Criterion 6: VERIFICATION.md authored

PASS — this document.

## Verdict

**status: gaps_found**

Criteria 1, 2, 5, 6 pass. Criteria 3 and 4 produce six follow-up findings filed as Phase 35. F4 shipped as in-flight fix and is NOT a Phase 35 deliverable.

Phase 34's primary purpose (close v3.1 walkthrough debt without `human_needed` rollforward) is achieved: every finding has an explicit disposition. v3.1 cannot be archived until Phase 35 lands.

## Screenshots (path: lockdown/local/screenshots/)

- `The green Aa is shown even thoug the profile the student selected is  nettleser.png` — Bug A (fixed in v2.9.13)
- `The green Aa is shown in the search field in the sidepanel. Shouldnt be.png` — Bug B (fixed in v2.9.13)
- `mit der Hund works, the other dont.png` — 3.1 PASS / 3.2-3.3 INCONCLUSIVE evidence
- `French.png` + `Screenshot 2026-05-01 at 08.18.24.png` — F1 evidence (FR aspect-hint silent, findingsCount=0)
- `Screenshot 2026-05-01 at 08.16.03.png` — French curated-typo rule firing on gibberish (proves FR engine not dead)
- `Screenshot 2026-05-01 at 08.17.09.png` — F2 PASS for por-para
- `Screenshot 2026-05-01 at 08.17.50.png` — F3 evidence: `duele` flagged as out-of-dictionary
- `when in exam-mode we should have amber tint edge on "stavekontorll Leksihjelp"...png` — F4 finding (fixed in-flight)
