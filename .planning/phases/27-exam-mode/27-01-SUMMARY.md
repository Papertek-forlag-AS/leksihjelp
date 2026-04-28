---
phase: 27-exam-mode
plan: 01
subsystem: spell-check + UI registry
tags: [exam-mode, contract, scaffolding, gates-prerequisite]
requires:
  - existing rule shape (id/priority/test/explain) in extension/content/spell-rules/*.js
  - host.__lexiSpellRules global registry pattern from spell-check-core.js
provides:
  - host.__lexiExamRegistry — frozen array of {id, exam:{safe,reason,category}} for non-rule surfaces
  - host.__lexiExamRegistryVersion = 1 (manifest constant)
  - rule.exam markers on every spell-rule (62 rules across 61 files)
  - rule.explain.exam dual marker on de-prep-case (pedagogy popover surface)
affects:
  - sets contract that Plan 27-02 (check-exam-marker gate) enforces
  - sets contract that Plan 27-03 (runtime suppression) reads at gate-time
tech-stack:
  added: []
  patterns:
    - "Object.assign-wrapped explain function for per-surface exam markers"
    - "Frozen registry pattern for non-rule UI surfaces (mirrors __lexiSpellRules)"
key-files:
  created:
    - extension/exam-registry.js
  modified:
    - extension/content/spell-rules/*.js (61 files — every rule registrant)
decisions:
  - "Categorisation closed-set: spellcheck, grammar-lookup, dictionary, tts, prediction, pedagogy, popup, widget"
  - "Default-conservative: lookup-shaped grammar rules tentatively exam.safe=false; flip to true only after browser-baseline research per CONTEXT.md"
  - "collocation.js classified safe=true (lexical, not grammatical) per Plan 27-01 task 2 explicit guidance"
  - "quotation-suppression.js classified safe=true (suppression scaffolding; produces no user-visible finding)"
  - "Dual marker pattern lands on de-prep-case only — sole rule today whose explain() returns pedagogy-rich content. Pattern extensible to any future explain() that surfaces Lær mer content."
  - "Used scratch script (deleted after) for the 61-file injection — every modified file shows additive +5 line diff matching the priority field's indent"
metrics:
  duration: 18
  completed: "2026-04-28"
  files_created: 1
  files_modified: 61
  rules_marked: 62
  registry_entries: 10
---

# Phase 27 Plan 01: Exam-Mode Markers (Contract Scaffolding) Summary

Establishes the per-feature `exam: { safe, reason, category }` contract across every user-visible Leksihjelp surface. Adds the marker on every spell-rule object and creates `extension/exam-registry.js` enumerating the non-rule surfaces (popup, widget, prediction, side-panel) — interface-first work that Plan 02 (CI gate) and Plan 03 (runtime suppression) will consume.

## Classification Table

### exam.safe = true (category: spellcheck)

Token-level / lexical / at-or-below browser native parity:

| Rule file | Reason kind |
|---|---|
| nb-typo-curated | curated typo |
| nb-typo-fuzzy | fuzzy typo |
| nb-triple-letter | triple-letter typo |
| nb-dialect-mix | dialect-mix token |
| nb-codeswitch | codeswitch token |
| nb-propernoun-guard | proper-noun guard |
| nb-homophones | homophone correction |
| de-capitalization | capitalization |
| es-accent-guard | accent-guard |
| universal-context-typo | context typo |
| register | token-level register |
| redundancy | phrase-level redundancy |
| collocation | lexical collocation (per Plan 27-01 task 2 explicit override) |
| quotation-suppression | suppression scaffolding (no user-visible finding) |

### exam.safe = false (category: grammar-lookup)

Lookup-shaped grammar rules; tentative pending browser-baseline research (CONTEXT.md):

de-compound-gender, de-gender, de-grammar, de-modal-verb, de-perfekt-aux, de-prep-case, de-separable-verb, de-v2, de-verb-final, doc-drift-de-address, doc-drift-fr-address, doc-drift-nb-passiv-overuse, doc-drift-nb-register, doc-drift-nn-infinitive, en-grammar, en-homophones, en-morphology, en-word-family, es-coordination, es-fr-gender, es-fr-modal-verb, es-grammar, es-gustar, es-imperfecto-hint, es-personal-a, es-por-para, es-pro-drop, es-ser-estar, es-subjuntivo, fr-adj-gender, fr-bags, fr-clitic-order, fr-contraction, fr-elision, fr-etre-avoir, fr-grammar, fr-pp-agreement, fr-preposition, fr-subjonctif, nb-aa-og, nb-compound-gender, nb-demonstrative-gender, nb-gender, nb-modal-verb, nb-nn-passiv-s, nb-sarskriving, nb-v2, universal-agreement.

### Non-rule surfaces (exam-registry.js, all safe=false)

| Surface id | Category |
|---|---|
| popup.search | dictionary |
| popup.conjugationTable | dictionary |
| popup.ttsButton | tts |
| popup.grammarFeaturesPopover | pedagogy |
| widget.dictionary | dictionary |
| widget.conjugation | dictionary |
| widget.tts | tts |
| widget.pedagogyPanel | pedagogy |
| wordPrediction.dropdown | prediction |
| sidePanel.fest | dictionary |

## Dual-Marker Case

**de-prep-case** is the sole rule today whose `explain()` returns pedagogy-rich content (Phase 26 prepPedagogy). It carries:
- `rule.exam = { safe: false, category: 'grammar-lookup', ... }` — for the dot/correction surface.
- `rule.explain.exam = { safe: false, category: 'pedagogy', reason: 'Lær mer pedagogy popover; exceeds browser native parity' }` — for the popover surface.

Mechanically achieved by wrapping the explain function with `Object.assign(fn, { exam: {...} })`. Behaviour is byte-identical: explain still callable, still returns `{nb, nn}`. Verified in commit d08cf51.

## Ambiguous Classifications & Follow-Up Research

The plan-listed `files_modified` array enumerated 47 files; `extension/content/spell-rules/` actually contains 61 rule files (62 rule registrations — `quotation-suppression.js` registers more than one rule). The 14 unlisted files were classified by extension of CONTEXT.md's "lookup-shaped grammar" default (safe=false): all phase-7 ES/FR/EN sub-rules, `nb-aa-og`, `nb-nn-passiv-s`, `nb-v2`, `fr-bags`, `fr-adj-gender`, `fr-pp-agreement`, etc. None of them surfaces lexical/typo-shaped corrections, so the conservative default is honest.

Two judgement calls flagged for the browser-baseline researcher (Phase 27 follow-up):

1. **collocation.js** — marked `safe=true` per the plan's explicit guidance ("lookup-shaped but lexical not grammatical"). If the researcher finds Chrome native catches collocation errors at all, this stays safe=true; if not, this is the most likely candidate for a re-examination.
2. **nb-aa-og / nb-homophones / en-homophones** — homophone-style rules. NB and EN homophones use lookup tables that may exceed browser parity. NB-homophones marked safe=true (token-level by design); en-homophones marked safe=false (more aggressive lookup). The split mirrors the rules' priorities (NB = error 50, EN = warning ~70).

## Deviations from Plan

### Auto-fixed Issues

None. The plan instructed "every rule file under spell-rules/*.js" — the listed files_modified array (47 entries) was a subset; the actual directory has 61 rule registrants. I treated the directive as the source of truth and processed all 61.

### Scope Notes

- `grammar-tables.js` is shared infrastructure, not a rule (no `__lexiSpellRules.push`). Skipped per the same-named exclusion in the scratch script.
- `quotation-suppression.js` registers 2 rules in one file — both received the marker and pass verification (62 rules across 61 files).

## Verification

- Task 1 verify: `node -e "...exam-registry shape..."` → OK 10 entries.
- Task 2 verify: walked every rule file under `extension/content/spell-rules/`, loaded into a clean global, asserted each rule has `exam.{safe,reason,category}` → OK 62 rules carry exam marker.
- de-prep-case dual marker: `rule.explain.exam` shape correct AND `explain(finding)` still returns canonical `{nb, nn}` → both verified.
- Existing gates: `npm run check-explain-contract` → PASS 59/59. `npm run check-network-silence` → PASS. `npm run check-rule-css-wiring` → PASS 59/59.

## Self-Check: PASSED

- extension/exam-registry.js: FOUND
- 61 spell-rule files modified: FOUND (62 files changed in commit d08cf51, 322 insertions, 2 deletions; the 2 deletions are the de-prep-case explain wrap)
- Commit ccd67b1 (registry): FOUND
- Commit d08cf51 (rule markers): FOUND
