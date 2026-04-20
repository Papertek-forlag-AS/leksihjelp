# Phase 5 Copy Review — UX-01 student-friendly explanations

**Goal:** each popover-surfacing rule has NB + NN explanation copy that a dyslexic learner can read in one glance.

**Voice:** calm, supportive, second-person "du". Non-blaming, ≤15 words, one sentence. Student's typed word emphasized with `<em>`.

**Hedging (Pitfall 8 alignment):**
- Assertive for high-precision rules: typo-curated, modal-verb.
- Hedged ("kan være" / "kan vere") for lower-precision rules: typo-fuzzy, gender, sarskriving.

## Copy Table

| Rule ID | Rule File | NB copy (template) | NN copy (template) | Reviewer notes |
|---------|-----------|--------------------|--------------------|----------------|
| typo (curated, priority 40) | nb-typo-curated.js | `<em>{word}</em> er en vanlig skrivefeil — prøv <em>{fix}</em>.` | `<em>{word}</em> er ein vanleg skrivefeil — prøv <em>{fix}</em>.` | |
| typo (fuzzy, priority 50) | nb-typo-fuzzy.js | `<em>{word}</em> står ikke i ordboken — kanskje du mente <em>{fix}</em>?` | `<em>{word}</em> står ikkje i ordboka — kanskje du meinte <em>{fix}</em>?` | |
| gender (priority 10) | nb-gender.js | `<em>{word}</em> kan være feil kjønn — prøv <em>{fix}</em>.` | `<em>{word}</em> kan vere feil kjønn — prøv <em>{fix}</em>.` | |
| modal_form (priority 20) | nb-modal-verb.js | `Etter modalverb skal hovedverbet stå i infinitiv — bytt <em>{word}</em> med <em>{fix}</em>.` | `Etter modalverb skal hovudverbet stå i infinitiv — byt <em>{word}</em> med <em>{fix}</em>.` | |
| sarskriving (priority 30) | nb-sarskriving.js | `<em>{word}</em> kan være to ord som hører sammen som <em>{fix}</em>.` _(fallback when original/fix missing: `To ord som kanskje hører sammen.`)_ | `<em>{word}</em> kan vere to ord som høyrer saman som <em>{fix}</em>.` _(fallback: `To ord som kanskje høyrer saman.`)_ | |

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

## Probe log

Defence-in-depth evidence from Plan 05-02 Task 3 — confirms priority + suggestions fields flow end-to-end through the core runner and that the Zipf tiebreaker (shipped in Plan 03-03) is still load-bearing post top-K refactor.

| Date | Probe | Result |
|------|-------|--------|
| 2026-04-20 | priority + suggestions flow through core.check() dedupe | **PASS** — 1 finding emitted on `berde resultat xxyyzz` (NB vocab): `rule_id=typo, priority=50, fix=bedre, suggestions=[bedre, burde]` (fuzzy-path). Every finding has numeric `priority`; the fuzzy finding has `Array.isArray(suggestions)` with ≥1 entries. `xxyyzz` correctly drops (no fuzzy neighbor within k=1 for a 6-letter word). |
| 2026-04-20 | Zipf mutation (ZIPF_MULT=0) → nb-typo-zipf-001/002 fail; restored byte-identical → 280/280 pass | **PASS** — Mutation step: npm run check-fixtures dropped nb/typo to P=0.900 R=0.900 (24/26) with exit=1. Probe: `hagde` flipped from `hadde` → `hagle`, `hatde` flipped from `hadde` → `hate` (the Zipf bonus for `hadde` ≈ 6.98 × 0 = 0, so length/prefix penalties win). Restore step: `cp /tmp/nb-typo-fuzzy.backup.js …` restored ZIPF_MULT=10; `git diff` on the rule file empty (byte-identical); npm run check-fixtures returned to 280/280 green. |

---

*Filled in Plan 02 (rule-file upgrade). Reviewed in Plan 03 (phase close).*
