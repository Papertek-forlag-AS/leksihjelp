---
phase: 35-v3.1-uat-followups
verified: 2026-05-01T07:15:00Z
status: human_needed
score: 6/7 must-haves verified (1 deferred to manual UAT — F7 NN/EN locale walkthrough)
re_verification:
  previous_status: complete (executor self-verification)
  previous_score: 7/7 (executor claim)
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "F7 — NN locale walkthrough in vanilla extension"
    expected: "Switch popup UI to Nynorsk; trigger de-prep-case (`in den Schule` or `auf der Tisch`); open popover → Lær mer; verify case-label badge, summary, explanation, Rett/Galt example labels, colloquial_note all render in NN with no NB fallback. Press Tab to next marker — panel stays expanded (F6 fix verification piggyback)."
    why_human: "No UI-language toggle in lockdown sidepanel by design; only the vanilla extension popup exposes the NN setting. UI string locale rendering is a visual property requiring browser eyeballs."
  - test: "F7 — EN locale walkthrough in vanilla extension"
    expected: "Same recipe with EN selected; verify all pedagogy panel strings render in English with no NB fallback."
    why_human: "Same as above — locale-toggle-driven render."
  - test: "F6 — Tab-preserves-Lær-mer-panel browser confirmation"
    expected: "Type a NB sentence with multiple typos; click Aa; click first marker; click Lær mer to expand; press Tab — panel remains expanded on next marker. Esc still collapses; click-outside still dismisses popover entirely."
    why_human: "Focus-timer/state-preservation behaviour is visually observable but the underlying flag-mechanic is fixture-invisible. Plan called for manual UAT confirmation; executor auto-approved per workflow.auto_advance."
---

# Phase 35: v3.1 UAT Follow-ups Verification Report

**Phase Goal:** Resolve all six Phase 34 UAT findings (F1, F2, F3, F5, F6, F7) so v3.1 can be archived. F4 already shipped in-flight in lockdown commit `5830fcc` and is NOT a Phase 35 deliverable.
**Verified:** 2026-05-01
**Status:** human_needed (six findings closed in code+data; one auto-approved manual UAT (F7) recipe queued — not yet eyeball-confirmed)
**Re-verification:** No (initial verification; supersedes executor's self-authored 35-VERIFICATION.md)

## Goal Achievement

### Observable Truths (mapped to ROADMAP SC1-SC6)

| #   | Truth (Success Criterion) | Status     | Evidence |
| --- | --- | --- | --- |
| SC1 | F1: fr-aspect-hint fires on `Hier il mangeait une pomme`; fixture suite P=R=F1=1.000 | ✓ VERIFIED | `[fr/aspect-hint] P=1.000 R=1.000 F1=1.000  86/86 pass` (gate output). Fixture id `fr-aspect-pos-002` is the exact canonical sentence. `manger_verbe.conjugations.imparfait.former` carries `mangeait` in `extension/data/fr.json`. |
| SC2 | F2/F3: doler conjugations present; es-gustar fires on `El encanta la música` + extended verbs; `duele` not OOD | ✓ VERIFIED | `[es/gustar] P=1.000 R=1.000 F1=1.000  127/127 pass`. ES verbbank verified to carry `verb_class: "gustar-class"` on gustar/encantar/interesar/doler/faltar/molestar/parecer/quedar/sobrar (9/9 expected). `doler.conjugations.presens.former` includes `duele` (verified inline). |
| SC3 | F5: `in der Schule` fires de-prep-case Wechselpräposition pedagogy OR alternate canonical trigger documented | ✓ VERIFIED | OR-clause satisfied: alternate triggers `in den Schule` and `auf der Tisch` documented in 35-VERIFICATION.md trigger table. Both fire de-prep-case AND attach Wechselpräposition pedagogy via `prepPedagogy.get('in')`/`get('auf')`. Decision (no semantic motion detection) consistent with exam-mode philosophy. |
| SC4 | F6: Tab nav no longer auto-collapses Lær mer panel | ✓ VERIFIED (code) / ? UNCERTAIN (browser) | `extension/content/spell-check.js` introduces `pedagogyPanelExpanded` module flag (line 415); `showPopover()` save/restore around `hidePopover()` (lines 535/537); per-marker pre-expand (lines 672, 688, 693); Esc-on-panel resets (line 253); dismissal paths reset (line 968). Commit `4bbab27`. Fixture suite + network-silence pass — no regression. Browser confirmation deferred to F7 walkthrough. |
| SC5 | F7: NN (3.5) + EN (3.6) locale walkthroughs executed in vanilla extension | ? HUMAN NEEDED | Recipe captured in 35-VERIFICATION.md and queued with other deferred UATs (Phase 26/27/30-01/30-02/35-F7) for batch browser session. Auto-approved per `.planning/config.json` `workflow.auto_advance: true`. NOT yet executed. |
| SC6 | All 11 release gates exit 0; version bumped in three places; cross-repo PRs landed (or marked unnecessary) | ✓ VERIFIED | Re-ran 9 gates this session (all PASS): check-fixtures, check-explain-contract, check-rule-css-wiring, check-spellcheck-features, check-network-silence, check-exam-marker, check-popup-deps, check-baseline-bundle-size, check-benchmark-coverage, check-governance-data. check-bundle-size + paired :test gates not re-run (executor reports PASS at 12.68 MiB / 20 MiB cap; gates run package build, expensive). Version `2.9.14` confirmed in `extension/manifest.json:4`, `package.json:3`, `backend/public/index.html:579`. Cross-repo PRs deemed unnecessary after diagnostic Node repros — executor-decision documented and validated by fixture results. |

**Score:** 6/7 truths fully verified; 1 (SC5/F7) human-needed by design — auto-approved per workflow policy but recipe queued for batched browser session.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extension/content/spell-check.js` | F6 fix: `pedagogyPanelExpanded` flag with save/restore + per-marker pre-expand + dismissal-path reset | ✓ VERIFIED | 8 occurrences of `pedagogyPanelExpanded` at lines 253, 415, 535, 537, 672, 688, 693, 968 — implements the documented save/restore + reset pattern. Commit `4bbab27` (32 insertions). |
| `extension/data/es.json` | gustar-class markers on extended verbs + full doler conjugations | ✓ VERIFIED | 9/9 expected verbs carry `verb_class: gustar-class`; `doler.conjugations.presens.former` complete (yo, tú, él/ella, nosotros, vosotros, ellos/ellas). 591 occurrences of `verb_class` in file. |
| `extension/data/fr.json` | manger imparfait conjugations | ✓ VERIFIED | `manger_verbe.conjugations.imparfait.former` includes `mangeais`/`mangeait`/`mangeaient` etc. |
| `extension/data/de.json` | (unmodified — F5 was docs-only) | ✓ VERIFIED | Pre-existing prepPedagogy data sufficient; alternate trigger documentation handles SC3. |
| `extension/manifest.json` | Version 2.9.14 | ✓ VERIFIED | Line 4: `"version": "2.9.14"`. |
| `package.json` | Version 2.9.14 | ✓ VERIFIED | Line 3: `"version": "2.9.14"`. |
| `backend/public/index.html` | Display version 2.9.14 | ✓ VERIFIED | Line 579: "Versjon 2.9.14". |
| `.planning/phases/35-v3.1-uat-followups/35-VERIFICATION.md` | Per-finding pass/fail with evidence | ✓ VERIFIED | This file (overwrites executor's self-authored version with goal-backward verification). Original executor-authored content preserved as evidence within this report's structure. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `es-gustar.js` | `es.json` verbbank verb_class | `gustarClassVerbs` Set built in `vocab-seam-core.js` from verb_class markers | ✓ WIRED | Fixture `[es/gustar] 127/127 pass` proves end-to-end wiring. 9 verbs verified to carry the marker. |
| `spell-check.js` showPopover | spell-check.js hidePopover | `pedagogyPanelExpanded` save/restore around rebuild | ✓ WIRED | Lines 535/537: `const _wasExpanded = pedagogyPanelExpanded; ... ; pedagogyPanelExpanded = _wasExpanded;` brackets the rebuild call. |
| `fr-aspect-hint.js` | `fr.json` verb conjugation index | imparfait detection via verbConjugations seam | ✓ WIRED | Fixture `[fr/aspect-hint] 86/86 pass` including the canonical F1 sentence as `fr-aspect-pos-002`. |

### Requirements Coverage

N/A — gap-closure phase; verified against ROADMAP Phase 35 success criteria SC1-SC6 instead (see Observable Truths table). No `requirements:` IDs declared in plan frontmatter.

### Anti-Patterns Found

None. Spot-scanned `extension/content/spell-check.js` diff (commit `4bbab27`): no TODO/FIXME/XXX comments; new code uses explicit code comments referencing F6; no console.log debug residue; flag is module-scoped (not leaked to globals — passes `check-popup-deps` philosophy though that gate targets popup views specifically).

### Release-Gate Sweep (re-verified this session)

| # | Gate | Result |
| --- | --- | --- |
| 1 | `check-fixtures` | PASS (all language suites P=R=F1=1.000; visible fr/aspect-hint 86/86, es/gustar 127/127) |
| 2 | `check-explain-contract` | PASS (60/60) |
| 3 | `check-rule-css-wiring` | PASS (59/59 rules, 54 unique ids) |
| 4 | `check-spellcheck-features` | PASS (NB/EN/DE/ES/FR preset-resilient) |
| 5 | `check-network-silence` | PASS (offline contract intact) |
| 6 | `check-exam-marker` | PASS (63 rules + 10 registry entries) |
| 7 | `check-popup-deps` | PASS (4 view modules clean) |
| 8 | `check-bundle-size` | NOT RE-RUN (executor reports 12.68 MiB / 20 MiB cap; full package build is expensive — accepting executor evidence) |
| 9 | `check-baseline-bundle-size` | PASS (130 KB / 200 KB cap) |
| 10 | `check-benchmark-coverage` | PASS (P1 5/5, P2 31/31, P3 4/4) |
| 11 | `check-governance-data` | PASS (5 banks, 116 entries) |

Paired `:test` self-test variants not re-run this session — executor reports all green; these don't gate the phase outcome.

### Per-Finding Disposition (from executor's 35-VERIFICATION.md, validated)

| ID | Finding | Disposition | Validation |
| --- | --- | --- | --- |
| F1 | FR `fr-aspect-hint` silent | PASS in current data (stale-deploy artifact) | Fixture `fr-aspect-pos-002` 86/86 pass; manger imparfait verified in fr.json |
| F2 | ES `es-gustar` silent on extended verbs | PASS in current data | Fixture 127/127 pass; 9 extended verbs verified to carry `verb_class: gustar-class` |
| F3 | `duele` flagged out-of-dictionary | PASS in current data (Chrome native squiggle artifact) | doler.presens.former contains `duele`; no rule fires on canonical sentence |
| F4 | (out of scope — shipped lockdown commit `5830fcc`) | N/A | Not a Phase 35 deliverable |
| F5 | DE `in der Schule` Wechselpräposition | DOCS — alternate trigger documented | OR-clause in SC3 explicitly allows this; trigger table present |
| F6 | Tab nav auto-collapses Lær mer panel | FIXED commit `4bbab27` | Code inspection confirms 8-site implementation of `pedagogyPanelExpanded` flag; fixtures unaffected |
| F7 | NN (3.5) + EN (3.6) locale walkthroughs | AUTO-APPROVED — recipe captured | Recipe present; deferred to batched browser UAT — flagged here as `human_needed` |

### Human Verification Required

Three items queued for batched vanilla-extension browser session (alongside Phase 26/27/30-01/30-02 deferred UATs):

#### 1. F7 — NN (Nynorsk) Lær mer Locale Walkthrough

**Test:** Switch popup UI language to NN; trigger `de-prep-case` with `in den Schule` or `auf der Tisch`; open popover → Lær mer panel.
**Expected:** Case-label badge ("Wechselpräposition"), pedagogy summary, explanation paragraph, Rett/Galt example labels, and any colloquial_note all render in Nynorsk with no NB fallback strings.
**Why human:** UI-language toggle exists only in vanilla extension popup (lockdown sidepanel intentionally omits it). Locale string rendering is a visual property.

#### 2. F7 — EN (English) Lær mer Locale Walkthrough

**Test:** Same recipe with EN selected.
**Expected:** All pedagogy panel strings render in English with no NB fallback.
**Why human:** Same as #1.

#### 3. F6 — Tab-Preserves-Panel Browser Confirmation

**Test:** Type a NB sentence with ≥2 typos; click Aa; click first marker; click Lær mer to expand; press Tab to advance.
**Expected:** Panel remains expanded on the next marker. Esc still collapses. Click-outside still dismisses entire popover.
**Why human:** State-preservation behaviour was the originally-reported user-visible defect (F6); plan explicitly required manual UAT confirmation. Executor auto-approved per `workflow.auto_advance` but no eyeball confirmation has been recorded.

### Gaps Summary

No code or data gaps. The phase achieves SC1-SC4 and SC6 in code/data/docs/gates. SC5 (F7 NN/EN locale walkthroughs) and the F6 browser confirmation are auto-approved per project workflow policy but are flagged here as human-needed for the deferred batched UAT session — these are not blockers to v3.1 archive under the project's auto-advance policy, but they should be visibly tracked rather than silently consumed.

The single divergence from the original plan was a triage outcome: F1/F2/F3 were diagnosed as already-passing in current data rather than needing cross-repo papertek-vocabulary PRs. This is validated independently here via fixture results (`[fr/aspect-hint] 86/86`, `[es/gustar] 127/127`) — strongest possible evidence that the rules + data + canonical sentences agree.

---

## ADDENDUM — Browser-walkthrough regression (2026-05-01T10:30Z)

During the F6 browser walkthrough (intended to confirm `pedagogyPanelExpanded` survives Tab navigation), the user reported the **Lær mer button never appeared** on `de-prep-case` popovers. Diagnostic from the page DevTools console:

```
document.querySelector('.lh-spell-popover')?.outerHTML
// → popover renders with explain text + Fiks/Avvis/Rapporter buttons
//   but NO `lh-spell-laer-mer-btn` element

document.querySelector('.lh-spell-popover')?.outerHTML.includes('lh-spell-laer-mer-btn')
// → false
```

### Root cause

`extension/content/spell-check.js` builds the `vocab` object passed into rules by calling `VOCAB.getX()` for each index — but **five indexes built by `vocab-seam-core.buildIndexes` were never surfaced through the seam**:

- `prepPedagogy`        (consumed by de-prep-case, es-por-para)
- `gustarClassVerbs`    (consumed by es-gustar)
- `gustarPedagogy`      (consumed by es-gustar)
- `frAspectAdverbs`     (consumed by fr-aspect-hint)
- `frAspectPedagogy`    (consumed by fr-aspect-hint)

Each rule fell back to its empty default (`new Map()` / `new Set()` / `null`) so:
- `de-prep-case` and `es-por-para` never attached `finding.pedagogy` → no Lær mer button
- `es-gustar` treated NO verbs as gustar-class → silent on extended verbs (encantar, doler, …)
- `fr-aspect-hint` had no adverb data → silent on `Hier`/`autrefois`/aspect triggers

**This means the original `PASS in current data` conclusions for F1/F2/F3 were wrong.** The Node fixture-runner constructs vocab differently than the browser (it passes the raw indexes object directly from `buildIndexes`), so all gates stayed green while the browser surface was broken. The Phase 34 user-reported failures for F1 and F2/F3 were genuine, not stale-deploy artifacts.

Bug introduced incrementally: `prepPedagogy` in Phase 26-01, `frAspectPedagogy` in Phase 32-01, `gustarPedagogy` in Phase 32-03. Each phase added the index to the core build output but never wired the seam getter or the spell-check.js consumer.

### Fix

Commit `7f55b1c` (v2.9.15):
- `extension/content/vocab-seam.js`: added `getPrepPedagogy`, `getGustarClassVerbs`, `getGustarPedagogy`, `getFrAspectAdverbs`, `getFrAspectPedagogy`.
- `extension/content/spell-check.js`: added the five entries to the `vocab` object construction (~line 336).
- Version bumped 2.9.14 → 2.9.15 in three places.
- All 11 release gates re-run green; bundle 12.68 MiB (no change).
- Lockdown + skriveokt-zero need to re-sync to pick up the fix.

### Revised per-finding disposition

| ID | Original disposition | Revised disposition |
|----|---|---|
| F1 | "PASS in current data (stale-deploy artifact)" | **REAL BUG → FIXED** in v2.9.15. Browser re-verification needed. |
| F2 | "PASS in current data" | **REAL BUG → FIXED** in v2.9.15. Browser re-verification needed. |
| F3 | "PASS in current data" | Likely Chrome native squiggle on `dem` (separate from F2 root cause); to be confirmed in browser re-verification. |
| F5 | DOCS — alternate trigger | Unchanged. |
| F6 | FIXED commit `4bbab27` | Unchanged code-wise. Browser confirmation now also gated by re-test (since pedagogy never surfaced before, F6 was untestable in the browser anyway). |
| F7 | AUTO-APPROVED | Browser walkthrough still queued — now meaningful since pedagogy surfaces. |

### Revised status

**Status remains `human_needed`** — but now also depends on a real browser walkthrough confirming pedagogy attaches end-to-end on de-prep-case, es-gustar, fr-aspect-hint after the v2.9.15 reload. Until then, F1/F2/F3 are not legitimately closed.

### Lessons learned (process gap)

The Node fixture-runner does NOT exercise the browser seam — it passes the `buildIndexes` output directly to `core.check()`. Any future index added to `vocab-seam-core.buildIndexes` that consumers read through `ctx.vocab.<index>` MUST also be added to BOTH `vocab-seam.js` (getter) AND `spell-check.js` (composition). A release gate that asserts every key of `buildIndexes`'s return shape is surfaced through the seam would have caught this earlier — candidate for Phase 36 INFRA work.

---

_Verified: 2026-05-01T07:15:00Z (initial); regression-addendum: 2026-05-01T10:30Z_
_Verifier: Claude (gsd-verifier, goal-backward) + browser walkthrough with user_
_Supersedes: executor-authored 35-VERIFICATION.md (preserved in git history, content reconciled into this report)_
