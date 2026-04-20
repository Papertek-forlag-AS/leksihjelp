# Phase 5 Copy Review — UX-01 student-friendly explanations

**Goal:** each popover-surfacing rule has NB + NN explanation copy that a dyslexic learner can read in one glance.

**Voice:** calm, supportive, second-person "du". Non-blaming, ≤15 words, one sentence. Student's typed word emphasized with `<em>`.

**Hedging (Pitfall 8 alignment):**
- Assertive for high-precision rules: typo-curated, modal-verb.
- Hedged ("kan være" / "kan vere") for lower-precision rules: typo-fuzzy, gender, sarskriving.

## Copy Table

| Rule ID | Rule File | NB copy (template) | NN copy (template) | Reviewer notes |
|---------|-----------|--------------------|--------------------|----------------|
| typo (curated, priority 40) | nb-typo-curated.js | _(filled in Plan 02)_ | _(filled in Plan 02)_ | |
| typo (fuzzy, priority 50) | nb-typo-fuzzy.js | _(filled in Plan 02)_ | _(filled in Plan 02)_ | |
| gender (priority 10) | nb-gender.js | _(filled in Plan 02)_ | _(filled in Plan 02)_ | |
| modal_form (priority 20) | nb-modal-verb.js | _(filled in Plan 02)_ | _(filled in Plan 02)_ | |
| sarskriving (priority 30) | nb-sarskriving.js | _(filled in Plan 02)_ | _(filled in Plan 02)_ | |

## Tone-check checklist (dyslexia-persona proxy self-review)

- [ ] Each line ≤ 15 words (count spaces + 1).
- [ ] Second-person "du" voice, never impersonal ("man" / "en").
- [ ] No jargon: avoid "infinitiv", "nominativ", "adverbial" — restate in plain student words.
- [ ] No blame: avoid "feil skrevet" without a hedge; prefer "kan være feil".
- [ ] No exclamation marks, no ALL CAPS.
- [ ] Each line surfaces the student's actual typed word (via template) OR — when the word can't be cleanly embedded — a fallback that still names the concept.
- [ ] NN register: uses NN morphology ("vere" not "være"; "ikkje" not "ikke"; "berre" not "bare"); double-check with a ref page if unsure.
- [ ] Every `<em>` wrapper in the copy uses escapeHtml on the interpolated token (grep the rule source).

## Review log

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| _(Plan 03 phase-close)_ | dyslexia-persona proxy | _(Pass / Fix)_ | |

---

*Filled in Plan 02 (rule-file upgrade). Reviewed in Plan 03 (phase close).*
