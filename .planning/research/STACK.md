# Stack Research — v2.0 Structural Grammar Governance

**Domain:** Offline, client-side structural grammar rules for a Chrome MV3 extension (Leksihjelp)
**Researched:** 2026-04-24
**Confidence:** HIGH (constraints are already binding; decisions follow from them)

## Summary up front

v2.0 **does not require new runtime dependencies**. Every structural capability
called for by Phases 6–16 (sentence segmentation, light POS inference,
clitic-order detection, register heuristics, V2/verb-final detection, aux
choice, personal-a, BAGS adjective placement, participe passé agreement)
can be achieved with:

1. **One new browser-native API** — `Intl.Segmenter` (Chromium Baseline since
   April 2024, zero bundle cost) for sentence- and word-granularity tokenizing
   that respects locale punctuation.
2. **Data-schema additions in `papertek-vocabulary`** — additive fields on
   existing bank entries (`separable`, `aux`, `copula`, `human`,
   `placement: 'BAGS'`, `prepGovernance`, `register`, `collocations`) plus a
   handful of new small lookup files (subjunctive triggers, clitic order
   tables, idiomatic-redundancy list, register markers).
3. **Roll-own micro-helpers** (estimated ~40–200 LOC each) for light
   syntactic reasoning — finite-verb detection, subordinator-set check,
   clitic-cluster permutation, prefix-stranding detection. Each lives next to
   the rule that uses it; no shared parser.

This preserves every hard constraint (offline, MIT, no build step, no ML,
<20 MiB zip) and stays inside the plugin rule architecture (one file per
rule under `extension/content/spell-rules/*.js`, consuming the
`__lexiVocab` seam).

## Recommended Stack

### Core Technologies (additions on top of v1.0 stack)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `Intl.Segmenter` | Browser-native (Chromium 87+, Baseline 2024-04) | Locale-aware sentence + word segmentation. Drives Phase 7 (word order — needs main vs subordinate clause boundaries), Phase 13 (register-drift across sentences within a text), Phase 16 (tense harmony across sentences). | Zero bundle cost, zero license risk, ICU-backed, handles German/French/Spanish/Norwegian punctuation correctly (including `«»`, `¿?`, `;`). Alternative would be a rolled-own regex segmenter (fragile on abbreviations, decimals, and French/Spanish punctuation). |
| Data schema additions in `papertek-vocabulary` | N/A — additive JSON fields | Authoritative source of governance info (case, aux, copula, separable flag, BAGS, clitic-order, human, collocations). | Cross-app single source of truth (shared with `papertek-webapps`, `papertek-nativeapps`). v1.0 already proved the additive pattern via `languagesbank` + `nationalitiesbank` + `CROSS_DIALECT_MAP`. Keeps extension as **logic-only** per `project_data_source_architecture.md`. |
| Rolled-own rule-local helpers | vanilla JS, ~40–200 LOC each | Light syntactic reasoning: V2 detection, subordinator lookup, aux selection, personal-a trigger, participe-passé preceding-DO detection, clitic-cluster order check. | Every candidate library (below in "What NOT to Use") is either too heavy, not MIT, or multi-megabyte trained. The grammar phenomena are closed-set — rule-local heuristics hit ≥80% benchmark coverage without a shallow parser. |

### Supporting Libraries

None. Recommending **zero new npm dependencies** in the extension runtime.
All capability gains come from `Intl.Segmenter` + vocab data + roll-own helpers.

### New dev / gate scripts (extend v1.0 release gates)

| Script | Purpose | Notes |
|--------|---------|-------|
| `scripts/check-benchmark-coverage.js` (new, ~80 LOC) | Run each `benchmark-texts/<lang>.txt` through the rule pipeline and report % of "FUTURE" lines now flagged per phase. | Phase-close criterion is benchmark-anchored (≥80%); a script makes this measurable/repeatable instead of manual counting. |
| `scripts/check-governance-data.js` (new, ~60 LOC) | Assert every verbbank entry that matches DR-MRS-VANDERTRAMP or motion-verb heuristic has `aux` set; every separable-prefix candidate has `separable` flag; every human noun used as DO example has `human: true`. | Guards against a governance rule going silent because vocab sync dropped a field. Mirrors v1.0's `check-spellcheck-features` philosophy. |
| `scripts/check-explain-contract.js` (existing) | Already in TARGETS list; extend for every v2.0 popover-surfacing rule. | No code change — just add each new rule id to the TARGETS array. |
| `scripts/check-rule-css-wiring.js` (existing) | Same as above — one CSS color binding per new rule. | Phase 05.1 lesson: missing CSS binding paints transparent → user sees native squiggle. |

## Installation

No npm installs needed for the extension runtime. The only commands to run:

```bash
# Each time papertek-vocabulary ships a new schema field:
npm run sync-vocab
npm run check-fixtures
npm run check-bundle-size
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `Intl.Segmenter` | `sentencex-js` (Wikimedia, MIT, multilingual segmenter) | If Chrome dropped `Intl.Segmenter` — it hasn't. sentencex adds ~30 KB + its own language rules; duplicates what ICU already gives us for free. Revisit only if sentence-granularity segmentation proves insufficient for NB semicolon-lists. |
| Roll-own POS helpers | `compromise` / `de-compromise` / `pos-js` | If we ever needed general-purpose tagging across arbitrary text. For our closed-set needs (is this token a finite verb? is it a subordinator?) a 20-line switch statement beats a 200 KB tagger and is easier to fixture-test. Revisit if Phase 16 (discourse / tense harmony) requires true POS across unseen vocab. |
| Vocab-driven BAGS list | Hard-coded in rule file | When the BAGS list is 5 items (prototype). Move to `papertek-vocabulary` as soon as it exceeds ~10 items or another consumer (webapps, nativeapps) wants the data. Friction test per `project_data_logic_separation_philosophy.md`. |
| Additive vocab schema | New bank / table per feature | If a feature is genuinely structural (e.g. clitic-order table doesn't belong on any existing word). Keep single-purpose banks small and explicit; avoid shoehorning into `generalbank`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Hunspell / `nspell` / `spellchecker-wasm` | All mature Norwegian Hunspell dictionaries are **GPL-2.0**, incompatible with MIT. WASM builds push 500 KB–2 MB into the zip. Already out-of-scope per `PROJECT.md`. | Existing roll-own spell-check (~180 LOC in `spell-check.js` + rules) — v1.0 proved this hits P=1.000 R=1.000 on the gated rules. |
| `compromise` / `nlp.js` / `natural` | 200 KB–2 MB each; English-biased; pulls in models/trainers we don't need; some subcomponents carry Apache-2.0 which is MIT-compatible but the bundle cost alone disqualifies. | Closed-set lookups in `papertek-vocabulary` + 20–50 LOC rule-local helpers. |
| ML models (transformer taggers, distilled BERT, etc.) | Violates "no-ML" heuristic constraint; cannot ship inside SC-06 (network silence); offline models are multi-MB and blow the 20 MiB cap; fine-tuning/update cycle is outside this project's shipping rhythm. | Rule-based detection with vocab-driven trigger lists. Benchmark texts are the acceptance surface, not F1 on a held-out dev set. |
| Custom build step (Rollup / esbuild / tsc) for extension code | Breaks "no build step — keeps the bar low for contributors" (PROJECT.md:106). Every file in `extension/` is directly loadable by Chrome. | Keep vanilla JS + ES-module imports. Build step allowed **only** for `scripts/` and `backend/` (already the case). |
| Regex-only sentence segmenter | Breaks on Spanish `¿?`, French `«»`, Norwegian decimal `3,5`, and abbreviations (`f.eks.`, `bl.a.`, `Dr.`). Every line in `de.txt`/`es.txt`/`fr.txt` has at least one such construct. | `Intl.Segmenter({granularity: 'sentence'})` is locale-aware and ICU-backed. |
| General dependency-parser port | Any UD-trained parser is ≥10 MB; spaCy / Stanza browser ports don't exist in maintained MIT form; even minimal CoNLL models are 5+ MB per language. | The phenomena we flag (V2 violation, verb-final, clitic order, BAGS, personal-a) all have surface patterns that a parser is overkill for. |
| Runtime network calls for any rule | `check-network-silence` gate rejects this. Breaks landing-page offline promise. | Bundle all data; use background `sync-vocab` at install-time if a rule's data set grows past the point where it fits in the baseline bundle (see `project_data_source_architecture.md`). |

## Stack Patterns by Phase Group

**Phase 6 — Register / collocations / stylistic redundancy (cross-lang, S):**
- Data: new `registerbank` file per language (colloquial tokens → formal
  suggestion) in papertek. New `collocations.json` for EN seed. New
  `redundancyphrases.json` (`return back` → `return`).
- Code: one rule file per sub-phase (`en-register.js`, `en-collocation.js`,
  `en-redundancy.js`, `nb-anglicism.js`, `fr-colloquial.js`). All
  lookup-driven, no syntax reasoning. Zero new primitives — reuses v1.0
  token-scan pattern.

**Phase 7 — Word order (M, NB+DE+FR):**
- Data: add `subordinator: true` flag to conjunction entries in papertek
  (`dass`, `weil`, `wenn`, `ob`, `obwohl` / `at`, `fordi`,
  `hvis`, `om`, `som` / `que`, `parce que`, `quand`, `si`). Add `placement:
  'BAGS'` to FR adjective entries.
- Code: shared helper `detectFiniteVerbPosition(tokens)` (~60 LOC) used by
  `nb-v2.js` and `de-v2.js`. Shared helper `detectMainVsSubordinate(sentence)`
  (~40 LOC) keyed off subordinator flag. `Intl.Segmenter` provides the
  sentence boundary. `fr-bags.js` reads placement from vocab — no parsing
  needed.

**Phase 8 — DE case & agreement governance (M):**
- Data: new `prepbank` with `governance: 'dat'|'acc'|'gen'|'two-way'` per
  preposition. `separable: true` on verbbank for `aufstehen`, `mitkommen`,
  `ankommen`, etc. `aux: 'sein'|'haben'` on every verb. Compound-noun
  recognition via existing nounbank (last-component gender lookup).
- Code: `de-prep-case.js` (lookup), `de-trennbar.js` (detect prefix-verb used
  un-split), `de-aux.js` (scan perfekt participle + auxiliary),
  `de-compound-gender.js` (fallback when noun missing: longest-suffix match
  in nounbank).

**Phase 9 — ES ser/estar, por/para, personal-a (M):**
- Data: predicate-adjective `copula: 'ser'|'estar'|'both'` on adjectivebank.
  `por`/`para` trigger table (`porpara.json`) with ~15 patterns. `human:
  true` on applicable nounbank entries + pronounbank.
- Code: `es-copula.js` (match copula form against predicate type),
  `es-porpara.js` (decision-tree over trigger contexts),
  `es-personal-a.js` (detect transitive-verb + human noun without preceding
  `a`).

**Phase 10 — FR élision, auxiliary, participe passé (M):**
- Data: `aux: 'être'|'avoir'` on verbbank (DR MRS VANDERTRAMP + pronominals).
  Vowel-initial flag already derivable from first letter + known `h-aspiré`
  list (new `hAspire.json`).
- Code: `fr-elision.js` (regex-friendly, closed set of prefixes), `fr-aux.js`
  (mirror of `de-aux.js`), `fr-pp-agreement.js` (the hard one — needs
  preceding-DO detection; ship behind feature toggle).

**Phase 11 — Aspect & mood (L, ES+FR):**
- Data: `subjunctive_triggers.json` (ES + FR) listing fixed expressions
  (`quiero que`, `il faut que`). Already have conjugation tables for mood
  forms.
- Code: `es-subjuntivo.js`, `fr-subjonctif.js` — both scan sentence after
  trigger and verify embedded verb mood using existing conjugation tables.

**Phase 12 — Pronoun / pro-drop (M, ES+FR):**
- Data: `clitic_order.json` for FR (me/te/se < le/la/les < lui/leur < y < en).
  `gustar_class.json` for ES (list of gustar-pattern verbs).
- Code: `es-prodrop.js` (soft warn if sentence-initial subject pronoun +
  unambiguous verb form), `es-gustar.js` (pattern match),
  `fr-clitic-order.js` (cluster detection + permutation check against table).

**Phase 13 — Register consistency across text (L, cross-lang):**
- Architectural seam change: rules currently fire per-sentence; this phase
  needs **document-level state**. Proposal: add an optional
  `rule.aggregate(findings, document)` phase that runs after per-sentence
  scanning and can emit cross-sentence findings. Mentioned in
  roadmap sequencing notes as a planned seam change. ~50 LOC in
  `spell-check.js`.
- Data: `register_markers.json` per language (riksmål tokens, a-infinitiv
  tokens).
- Code: `de-dusie-drift.js`, `fr-tuvous-drift.js`, `nb-riksmaal-drift.js`,
  `nn-infinitiv-drift.js`. All share the aggregate pattern.

**Phase 14 — Morphology & agreement beyond tokens (M, EN+ES+FR):**
- Data: `irregular_plurals.json` (EN) + `irregular_verbs.json` (EN) —
  already partially present, extend. `word_families.json` (EN) for
  creativity/creation/creative confusions.
- Code: `en-morph-overgen.js` (any form that matches regular pattern for a
  word on the irregular list → flag), `en-wordfamily.js`,
  `es-gender-article-mismatch.js`, `fr-gender-article-mismatch.js`.

**Phase 15 — Collocations & idioms at scale (L, cross-lang):**
- Data: scale the Phase 6.2 collocation pattern out: `collocations_nb.json`,
  `collocations_de.json`, etc. Each is a list of
  `{head, goodPreps:[], badPreps:[]}`.
- Code: one rule per language; all lookup.

**Phase 16 — Tense harmony & discourse (L, aspirational):**
- Defer. Either split into v3.0 or attempt a minimal subset (unmotivated
  tense switch detection via verb-form scan across `Intl.Segmenter` sentence
  boundaries). No new dependency proposed.

## Version Compatibility

| Addition | Required baseline | Notes |
|----------|------------------|-------|
| `Intl.Segmenter` (sentence granularity) | Chromium 87+ (2020-11); Baseline 2024-04 (all engines) | Leksihjelp targets Chrome + Edge + Brave only (PROJECT.md:131) — all Chromium, all covered. No polyfill needed. |
| Additive vocab fields | `papertek-vocabulary` can add fields any time; consumers opt in | Backward-compatible by design — rule code `?.aux ?? null`-guards every new field. Cross-app impact minimized per `PROJECT.md:109`. |
| New rules per phase | Plugin rule architecture (INFRA-03) | Adding a rule = one file under `spell-rules/*.js` + one CSS color + one explain contract + one `check-fixtures` entry. v1.0 shipped 5 rules this way. |
| Phase 13 document-level aggregate | New optional method `rule.aggregate?(findings, document)` in rule contract | ~50 LOC change in `spell-check.js`. Existing rules unaffected — aggregate is opt-in. |

## Integration with existing seams

- **`__lexiVocab` seam** — extended, not replaced. New fields (`aux`,
  `separable`, `copula`, `human`, `placement`, `governance`) show up as
  additional indexes built in `buildIndexes()`. Rules read via existing
  accessor patterns.
- **Plugin rule architecture** — unchanged. Every v2.0 rule is a single
  file exporting `{id, priority, check, explain}`. No edits to
  `spell-check.js` except the one Phase 13 aggregate seam.
- **`check-fixtures.js` harness** — unchanged harness; each new rule lands
  with ≥30 positive + ≥15 acceptance cases per language (roadmap line 27).
  P/R/F1 thresholds per rule tuned in `THRESHOLDS` table.
- **Release gates** — all six v1.0 gates still apply. New rule ids auto-
  qualify for `check-explain-contract` and `check-rule-css-wiring` by being
  added to the respective TARGETS arrays.

## Sources

- [Intl.Segmenter — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) — HIGH confidence; verified sentence granularity + locale options.
- [Intl.Segmenter is Baseline — web.dev 2024-04](https://web.dev/blog/intl-segmenter) — HIGH confidence; confirms Chromium/Firefox/Safari coverage as of April 2024.
- [sentencex-js — Wikimedia](https://github.com/wikimedia/sentencex-js) — MEDIUM confidence alternative; not recommended due to redundancy with `Intl.Segmenter`.
- [de-compromise](https://github.com/nlp-compromise/de-compromise), [pos-js](https://github.com/dariusk/pos-js) — MEDIUM confidence; reviewed and rejected for bundle cost + mismatch with closed-set needs.
- `PROJECT.md` constraint block (lines 84–96, 124–132) — HIGH confidence; binding project constraints.
- `.planning/v2.0-benchmark-driven-roadmap.md` (all phases) — HIGH confidence; phase capability requirements.
- `benchmark-texts/de.txt`, `es.txt` — validation surface reviewed; every flagged phenomenon maps to a data-or-roll-own path above.
- User memory `project_data_source_architecture.md` + `project_data_logic_separation_philosophy.md` — HIGH confidence; authoritative on data-vs-logic separation policy.

---
*Stack research for: v2.0 structural grammar governance additions*
*Researched: 2026-04-24*
