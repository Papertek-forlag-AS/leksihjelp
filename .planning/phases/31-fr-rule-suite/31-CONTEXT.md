---
phase: 31
title: French rule suite (homophones, L1 interference, faux amis, verb-prep, capitalization)
status: not-started
created: 2026-04-29
ordering_constraint: BEFORE skriveokt-zero parity (Phase 28.1 deferred)
---

# Phase 31 — French rule suite

## Why this phase exists

The data files for these checks already exist in the papertek-vocabulary
sibling repo (`pitfalls-fr.json`, `pitfalls-fr-nb.json`, `faux-amis-fr-nb.json`,
`verb-prepositions-fr.json`, `dont-capitalize-fr.json`, plus genderTrap markers
on the existing French noun bank). Today the leksihjelp extension consumes
none of them — Norwegian students writing French get only what generic FR
spellcheckers detect, which misses the most distinctive failure modes: gender
traps, false friends, missing contractions, body-state être, capitalization,
and verb-prep mismatches.

The output of generic French spellcheck is grammatical French — just not what
the student means. This phase wires the data into rule files so the extension
can flag those distinctively-Norwegian-error patterns before a student hands
in a piece of work.

## Ordering

This phase ships **before** the deferred skriveokt-zero parity work (Phase
28.1). Rationale: the FR rule suite consumes synced data files that already
flow into the lockdown webapp via the Phase 30 sync surface, so there's no
contract change required for downstream consumers — they get the rules
automatically when they sync. Moving FR rules behind skriveokt-zero parity
would block real student value behind purely-mechanical sync work.

## Scope (rule-by-rule)

Each item is a new spell-rule file under `extension/content/spell-rules/`,
registered through `self.__lexiSpellRules`, alongside the existing fr-*.js
rules.

### A. `fr-homophone.js` (consumes `pitfalls-fr.json`)

Mirror of how the existing English homophone detection works. For each token
matching a key in `pitfalls-fr`, check:
- If `next` is present and the following token isn't in `next` → flag with
  hint to consider alt forms.
- If `next` is absent and the form is ambiguous → soft hint with note.

Priority: ~30 (between contraction and elision rules).
Severity: hint (P3) for context-only detection; error (P1) only when
grammatically impossible (e.g., `à` followed by past participle = wrong,
should be `a`).

### B. `fr-l1-interference.js` (consumes `pitfalls-fr-nb.json`)

Walks the `patterns` array. For each pattern:
- If `trigger_regex` present, run against the sentence string.
- If `trigger_phrases` present, do exact substring lookup with word-boundary
  check.
- Emit finding with `explanation_nb` / `explanation_nn` based on user's UI
  language (already available in `i18n/`).

Priority: ~75 (high — these are real grammatical errors).
Each pattern has a severity field already; honor it.

### C. `fr-faux-amis.js` (consumes `faux-amis-fr-nb.json`)

Two integration points:
1. **Dictionary popup** — when student looks up a Norwegian word that has a
   faux-ami trap (e.g. looking up `aktuelt` → show pop-up: "⚠ ikke
   `actuel(le)` — det betyr `nåværende`. For `aktuelt`: à la mode /
   d'actualité / pertinent").
2. **Writing-mode** — when the student types a faux-ami in French context,
   soft hint with explanation.

The data file has `trap_source: "norwegian" | "english"` to distinguish
where the false-friend pull comes from.

### D. `fr-verb-prep.js` (consumes `verb-prepositions-fr.json`)

For verbs with `common_mistake` field:
- Token-window check: when the verb is followed by a wrong preposition
  pattern (`pense de`, `joue le piano`), emit error with the right form.
- For verbs with multiple valid preps (`penser à/de`): no warning, but
  the dictionary popup can show both meanings.

Priority: ~50.

### E. `fr-capitalization.js` (consumes `dont-capitalize-fr.json`)

Direct analogue to the existing `de-capitalization.js`. Flag mid-sentence
capitalized words that match `days` / `months` / `languages` /
`nationality_adj_m` / `nationality_adj_f`. Skip first word of sentence and
proper-noun contexts (after period, line start).
Severity: error.

### F. Existing FR gender rule extension (no new file)

The existing `fr-adj-gender.js` and `es-fr-gender.js` already check noun
gender. Add a small block: when a flagged `genderTrap: true` noun is
detected with the wrong article (e.g., `la problème`), elevate severity
from hint to error and surface the `genderTrapNote` text in the
explanation popup. ~5–10 line patch, no new rule file.

## Out of scope

- Parallel suites for ES and DE. Same architecture is achievable with a
  similar data flow, but the data files don't all exist yet upstream.
- Faux-amis bidirectional surfacing (en→fr). The fr-nb and fr-en data
  arrive in separate file pairs; en wiring is its own future ticket.

## Sync-script change

`scripts/sync-vocab.js` will need to fetch `leksihjelp-rules/*.json` from
the API (a new endpoint, e.g. `/api/vocab/v3/leksihjelp-rules/fr`) or add
it to the existing manifest. Trivial; one new endpoint in `api/vocab/v3/`
on the papertek-vocabulary sibling repo.

## Bench-test fixtures

Each new rule gets fixtures under `fixtures/fr/` covering the trigger
cases AND a handful of false-positives the rule must NOT flag. The
existing fixture harness (`scripts/check-fixtures.js`) handles the rest
once the fixtures land.

## Release-gate impact

- `check-fixtures` will hard-fail until each new rule's fixtures pass.
- `check-explain-contract` enforces `{nb, nn}` register strings on every
  popover-surfacing rule — A/B/C/D will all surface, so confirm explain
  contracts at PR time.
- `check-rule-css-wiring` enforces a CSS dot-colour binding per rule.
  Confirm `extension/styles/content.css` has `.lh-spell-fr-homophone`,
  `.lh-spell-fr-l1-interference`, `.lh-spell-fr-faux-amis`,
  `.lh-spell-fr-verb-prep`, `.lh-spell-fr-capitalization` before merge.
- `check-exam-marker` requires every rule to declare `exam: { safe, reason }`.
  Default-conservative: `safe: false` for rules that scaffold student answer
  shape (faux-amis, verb-prep, l1-interference); `safe: true` only after
  exam-mode browser baseline confirms the rule doesn't replicate what a
  human grader would dock.

## Net effect

Norwegian students writing French get instant, contextual feedback on the
most distinctive failure modes — gender traps, false friends, missing
contractions, capitalization, and verb-prep mismatches — none of which
generic French spell checkers catch because the output is grammatical
French, just not what the student means.
