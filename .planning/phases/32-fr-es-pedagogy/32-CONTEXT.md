---
phase: 32
title: FR/ES pedagogy — Lær mer for foreign-language rules (data-led)
status: not-started
created: 2026-04-30
ordering_constraint: AFTER Phase 31 (FR rule suite establishes the data-consumption
  pattern). Independent enough to ship in parallel if Phase 31 stalls.
cross_repo: papertek-vocabulary (data) + leksihjelp (function)
---

# Phase 32 — FR/ES pedagogy (Lær mer)

## Why this phase exists

German prepositions ship a `pedagogy` block that powers "Lær mer" — the
expandable popover explaining the rule (am = an + dem, dativ; standard
contraction; motion vs. location for two-way prepositions; etc.). Students
don't just see a correction, they read the underlying lesson.

French and Spanish don't have this yet:

- **French (10 rules)**: every detect rule (`fr-preposition`, `fr-subjonctif`,
  `fr-etre-avoir`, `fr-pp-agreement`, `fr-clitic-order`, `fr-adj-gender`,
  `fr-grammar`, `fr-bags`, `fr-contraction`, `fr-elision`) returns a one-line
  correction. **Zero pedagogy blocks.**
- **Spanish (11 rules)**: three of them — `es-por-para`, `es-imperfecto-hint`,
  `es-gustar` — already carry rich multi-pattern explanations, but **the
  strings live inline in the rule files**, not as data. They aren't reusable,
  not multilingual on the data side, not enrichable with examples or
  illustrations later.

Result: a Norwegian student who writes "Yo voy" and gets a pro-drop hint, or
"j'ai allé" and gets the être/avoir nudge, never reads the *rule*. They get a
fix, not a lesson. Worse, the existing rich strings in `es-por-para` /
`es-gustar` can't be reused by the dictionary popover or the upcoming
laer-mer-pedagogy-ui surface (Phase 26).

## Architectural principle (user-stated, 2026-04-30)

> Data exists in papertek-vocabulary, functions in leksihjelp.

This phase is the first cross-repo enrichment that follows that split for
non-DE languages. Every pedagogy string moves to papertek-vocabulary. Rule
files stay in leksihjelp, read structured pedagogy from the synced JSON, and
return a richer `explain()` payload that the existing `pedagogyPanel` widget
(registered in `extension/exam-registry.js`) can render.

## Scope (3 entries, both languages)

Picked for highest ratio of student-learning value to implementation effort.
Both languages, three entries, all reusing detection logic that already
exists or can be cloned from a proven sibling rule.

### A. FR — Passé composé vs imparfait (`fr-aspect-hint`)

**New rule + new data.**

- **Data (papertek-vocabulary)**:
  - New temporal-adverb banks under `fr/generalbank.json`:
    - `aspect_passe_compose_adverbs`: `hier`, `soudain`, `tout à coup`,
      `pendant deux ans`, `il y a trois jours`, …
    - `aspect_imparfait_adverbs`: `souvent`, `tous les jours`, `pendant que`,
      `quand j'étais`, `chaque été`, …
  - New `pedagogy.aspect_choice` entry with the JSON shape under §4.

- **Function (leksihjelp)**:
  - `extension/content/spell-rules/fr-aspect-hint.js` — clone the structure of
    `es-imperfecto-hint.js`. Pattern: temporal-adverb + finite verb in
    "wrong" tense → soft hint (P3). The detection function already exists in
    spirit; only the trigger lists change.

- **Fixture**: `tests/fixtures/fr/aspect-hint/` with ≥40 positive examples
  (hint fires) and ≥40 negative (hint silent on correct usage).

### B. ES — `por`/`para` pedagogy migration

**Pure data move — no detection logic changes. Lowest risk on this list.**

- **Data (papertek-vocabulary)**:
  - Add `pedagogy` block on `por_prep` and `para_prep` in `es/generalbank.json`.
    Lift the five existing pattern variants from `es-por-para.js` into structured
    `examples` + `common_error` entries.

- **Function (leksihjelp)**:
  - Refactor `es-por-para.js`: replace hardcoded strings with reads from the
    loaded `por_prep.pedagogy` / `para_prep.pedagogy` entries. Detection logic
    untouched (proven via existing fixtures, all P=R=F1=1.000).

- **Fixture verification**: existing `tests/fixtures/es/por-para/` (50 cases)
  must stay at P=R=F1=1.000 — *the whole point of doing this as a data move
  first is that the regression suite locks in behaviour while we change shape.*

### C. ES — `gustar`-class pedagogy migration + extension

**Data move + light data growth.**

- **Data (papertek-vocabulary)**:
  - Add `pedagogy.gustar_class` shared entry in `es/grammarbank.json`
    explaining the dative-experiencer pattern (subject is the *thing*, person
    is the indirect object).
  - Mark gustar-class verbs in `es/verbbank.json` with `verb_class:
    "gustar-class"`. Start set: `gustar`, `encantar`, `interesar`, `doler`,
    `faltar`, `sobrar`, `parecer`, `quedar`, `apetecer`, `molestar`. Today
    only `gustar` is flagged (inline in `ES_GUSTAR_CLASS_VERBS`).

- **Function (leksihjelp)**:
  - Refactor `es-gustar.js`: read class-membership from `verb_class:
    "gustar-class"` instead of a hardcoded inline list. Same explanation
    text, but pulled from the shared `pedagogy.gustar_class` entry.
  - Side-effect: rule now fires on the extended verb set above, not just
    `gustar`. This is intentional — same pedagogical category, same
    correction needed, no reason to limit detection to one verb.

- **Fixture**: existing `tests/fixtures/es/gustar/` (94 cases) must stay
  green; **add ≥30 new cases** covering `encantar`, `interesar`, `doler`,
  `faltar` to lock in the extension.

## JSON shape (mirror of DE prepositions)

Every pedagogy entry — whether on a single word (`por_prep`) or as a shared
grammar entry (`pedagogy.gustar_class`) — uses the same shape:

```json
{
  "pedagogy": {
    "summary":     { "nb": "...", "nn": "...", "en": "..." },
    "explanation": { "nb": "...", "nn": "...", "en": "..." },
    "examples": [
      {
        "sentence": "...",
        "translation": { "nb": "...", "en": "..." },
        "note":        { "nb": "...", "en": "..." }
      }
    ],
    "common_error": {
      "wrong":   "Yo voy a la tienda",
      "correct": "Voy a la tienda",
      "explanation": { "nb": "...", "en": "..." }
    },
    "context_hint":      { "nb": "...", "en": "..." },
    "semantic_category": "preposition | aspect-marker | verb-class | mood-trigger | …",
    "related_phenomena": ["es-pro-drop", "es-personal-a"]
  }
}
```

`{ nb, nn, en }`-keyed string maps everywhere (already the convention for
DE preps and the `explain` contract enforced by `npm run check-explain-contract`).

## Function side — `explain()` contract change (additive)

Today every popover-surfacing rule returns `{ nb: string, nn: string }` from
its `explain()` callback. This phase **extends** the contract additively:

```js
explain(finding) {
  return {
    nb: "Bruk imparfait når handlingen var pågående eller vanlig.",
    nn: "Bruk imparfait når handlinga var pågåande eller vanleg.",
    pedagogy: { /* the shape above, optional */ }
  };
}
```

`pedagogy` stays optional — gates already enforce that `nb`/`nn` are non-empty
strings. Rules that don't load pedagogy data continue to work unchanged. The
"Lær mer" panel (Phase 26 surface) checks for `pedagogy` and renders the
expandable panel only when present.

`extension/scripts/check-explain-contract.js` gets one new branch: if
`pedagogy` is present, recurse into the JSON shape and validate it carries
non-empty `summary` for at least `nb` and `en`.

## Ordering vs. other phases

- **After Phase 31 (FR rule suite)**: Phase 31 establishes the pattern of
  rules consuming new data files (`pitfalls-fr`, `verb-prepositions-fr`, etc).
  Phase 32 builds on that pattern with structured pedagogy.
- **Independent of Phase 26 (laer-mer-pedagogy-ui)**: Phase 26 already shipped
  the popover surface for DE prepositions. Phase 32 reuses that surface with
  zero changes — same widget, more languages.
- **Before Phase 28.1 (skriveokt-zero parity)**: same rationale as Phase 31
  — the pedagogy data flows downstream via the existing `sync-leksihjelp.js`
  scripts in lockdown and skriveokt-zero. No contract change needed for
  consumers.

## Cross-repo workflow (rule per file)

Each rule (A, B, C) is one cross-repo unit:

1. PR in **papertek-vocabulary**: add the `pedagogy` block + any data growth.
2. Run `npm run sync-vocab` in **leksihjelp** (already exists; pulls the new
   data into `extension/data/`).
3. PR in **leksihjelp**: new/refactored rule file, fixtures, gate updates.
4. Bump **leksihjelp** `package.json` version (signals downstream sync).

Plans 32-01 (FR aspect-hint), 32-02 (ES por/para migration), 32-03 (ES gustar
migration + extension) — three plans, three cross-repo PRs, three bump
points. Each lands independently; no inter-plan dependencies.

## Acceptance criteria

- [ ] FR `aspect-hint` rule fires on ≥80% of fixture positives, ≤2% false
  positives on negatives. Renders pedagogy panel via Phase 26 surface.
- [ ] ES `por/para` rule still passes existing 50-case fixture at P=R=F1=1.000;
  pedagogy panel renders the migrated explanation strings.
- [ ] ES `gustar` rule passes existing 94-case fixture at P=R=F1=1.000 and
  extends to ≥30 new fixture cases on the gustar-class verbs (≥80% recall);
  pedagogy panel renders.
- [ ] `npm run check-fixtures` exit 0.
- [ ] `npm run check-explain-contract` exit 0 (extended to validate `pedagogy`
  shape when present).
- [ ] `npm run check-explain-contract:test` extended with one positive and one
  negative pedagogy-shape scratch rule.
- [ ] No regression in any other rule's fixtures.
- [ ] Lockdown sync surface unchanged (same files, more data flowing through).

## Out of scope (deferred)

- **FR preposition government** (à / de / en / chez choice). Hard, requires
  per-verb prep-frame dictionary. Separate phase.
- **ES adjectival-relative subjunctive** (`busco un libro que sea/es interesante`).
  Hard, requires clause-boundary detection. Separate phase.
- **Leísmo / laísmo**. Skipped permanently — regional dialect, risky to flag.
- **SVG illustrations** — DE prepositions don't ship them yet either; tracked
  in `project_pedagogy_followups.md` as deferred.
- **EN strings on existing DE preposition pedagogy** — same tracker.
- **NN-specific pedagogy variants** — current convention is single-string per
  language with NN copy alongside NB; no per-dialect pedagogy variants needed.
