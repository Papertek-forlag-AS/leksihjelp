# Phase 6: Structural Infrastructure + Register & Stylistic Polish - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the cross-cutting infrastructure every later v2.0 phase depends on:
- Sentence segmenter (`Intl.Segmenter`-backed, exposed via `ctx.sentences`)
- Priority bands P1/P2/P3 with visual tiers in `content.css`
- `rule.severity` field in explain contract (`error` / `warning` / `hint`)
- Quotation-span suppression tier (`ctx.suppressedFor.structural`)
- New release gates: `check-benchmark-coverage`, `check-governance-data`; extend `check-rule-css-wiring` + `check-explain-contract` + `check-spellcheck-features` for tier coverage

Plus the lowest-risk rule family to validate the infrastructure under real rules:
- REG-01 register/colloquialism rule (opt-in, P2 warn)
- REG-02 collocation-error rule (EN seed in Phase 6, data-only)
- REG-03 redundancy rule (P3 hint, data-only)

Structural rules (word-order, case, aspect) are NOT in Phase 6 — they're Phases 7+.

</domain>

<decisions>
## Implementation Decisions

### Severity tier visuals

- **P1 (error)**: Keep current look — 3px solid coloured dot (red family). Preserves v1.0 student recognition.
- **P2 (warning)**: Same dot shape as P1, **amber/orange** colour. Students learn: red = wrong, amber = check.
- **P3 (hint)**: **Grey dotted underline** — muted, reads as "FYI, not wrong." Easy to ignore without guilt.
- **Popover copy tone** varies by tier:
  - P1: "Feil — …" (direct)
  - P2: "Usikker — …" (hedged)
  - P3: "Kanskje — …" (tentative)
- CSS binding naming: base `.lh-spell-<id>` is P1; add `.lh-spell-<id>-warn` and `.lh-spell-<id>-hint` variants only for rules that ship at those tiers. `check-rule-css-wiring` TARGETS extended to assert the variant exists for its rule's actual severity.

### REG-01 register / colloquialism rule

- **Default: OFF** on install (opt-in via grammar-feature toggle, as roadmap specifies).
- **Context detection: none** — rule flags uniformly whenever enabled. No essay-vs-chat heuristic (brittle, and skriv.papertek is essay-first anyway).
- **Severity: P2 warn.** "gonna" in essay prose is probably wrong but legitimately fine in direct speech / dialogue.
- **NB anglicism seed: ~50 words** (broader than roadmap examples). Target high-frequency student drift: `downloade`, `booket`, `chille`, `gamingen`, `sharet`, `maile`, `linke`, `joine`, `streame`, `skrolle`, `hype-et`, `cringe`, `random`, `whatever`, etc. EN seed covers `gonna`, `wanna`, `ain't`, contractions-where-formal-writing-wants-full-forms. FR seed covers `je sais pas`-class clipped colloquialisms per roadmap.
- **Data in papertek-vocabulary** — one register-bank file per language, synced via `npm run sync-vocab`.

### REG-02 collocation-error rule

- **Phase 6 seeds EN only** — ~20 verb-object pairs (`make a photo → take`, `big rain → heavy`, `strong knowledge → deep`, `do a mistake → make`, etc.). Success criterion in roadmap explicitly calls out EN (`benchmark-texts/en.txt` line `make a photo`); NB/DE/FR/ES deferred to Phase 15 as planned.
- **Severity: P2 warn** (follows REG-01 tier — "probably wrong but some dialects accept").
- **Data in papertek-vocabulary** as `collocationbank` — the shape Phase 15 will scale to other languages unchanged.

### REG-03 redundancy phrase-bank rule

- **Severity: P3 hint** — pure style, never ungrammatical. Muted grey dotted underline.
- **Seed size: ~10–15 phrases per language.** Solid pedagogical set, not aggressive scope:
  - EN: `return back`, `free gift`, `future plans`, `past history`, `added bonus`, `close proximity`, `advance planning`, `basic fundamentals`, `end result`, `final outcome`, `each and every`, `new innovation`, `brief moment`, `unexpected surprise`, …
  - NB: `gratis gave`, `fremtidige planer`, `gjenta om igjen`, `nåværende status`, `samme identisk`, `ekstra bonus`, … (final curation during planning)
  - DE / ES / FR: parallel-pattern lists (final curation during planning)
- **Data in papertek-vocabulary** — one phrase-bank file per language. Literal-match (case-insensitive) against sentence text.

### Existing v1.0 rule severity mapping

- **All v1.0 rules stay P1/error:**
  - `nb-gender`, `de-gender`, `es-fr-gender`
  - `nb-modal-verb`, `de-modal-verb`, `es-fr-modal-verb`
  - `nb-sarskriving`
  - `nb-typo-curated`, `nb-typo-fuzzy`, `universal-context-typo`
  - `nb-codeswitch`, `nb-dialect-mix` (consistent with `project_nb_nn_no_mixing` — cross-standard tokens are student errors)
- Preserves v1.0 UX exactly; no student-facing regression from the severity-tier migration. Only *new* Phase 6+ rules occupy P2/P3 tiers.

### Claude's Discretion

- **Quotation suppression scope**: implementation detail — spec covers `"…"` and `«…»` at minimum; researcher/planner may extend to `'…'`, `„…"`, curly-quote variants, and nested quotes. Inline code / markdown code-spans not in scope for Phase 6 unless the researcher finds they materially affect benchmark flip-rate.
- **Segmenter edge cases**: trust `Intl.Segmenter` as default. Add custom NB/NN handling (abbreviations `f.eks.`, `osv.`, `Hr.`; URLs; ellipses) only if benchmark fixtures expose a concrete false split. Researcher to surface this.
- Exact dot-colour hex values for P2 amber and P3 grey — planner picks shades consistent with existing `content.css` palette.
- Exact copy wording of the Norwegian tone-per-tier prefixes — planner drafts in the translation pass.
- Internal API shape of `ctx.sentences`, `ctx.suppressedFor.structural`, `rule.severity` — researcher to propose, planner to lock.
- The structure of the paired `:test` self-tests for the two new release gates — mirror the existing `check-explain-contract:test` / `check-rule-css-wiring:test` / `check-network-silence:test` pattern.

</decisions>

<specifics>
## Specific Ideas

- Severity visuals should **extend** the v1.0 dot-marker language, not replace it. Students have learned "red dot = look here"; amber/grey dots slot into the same mental model without retraining.
- REG-01 default OFF matches the "free + offline forever + non-intrusive" promise in CLAUDE.md. Students who *want* register guidance opt in; the extension doesn't nag by default.
- REG-02 EN-only in Phase 6 is a deliberate slice: proves the `collocationbank` data shape end-to-end (papertek PR → sync → index → rule → fixture → benchmark flip) so Phase 15 is just data scaling, not shape iteration.
- REG-03 data-only rule approach means the *logic* is ~30 LOC (tokenize sentence → literal-match against phrase bank → emit hint). All product decisions live in the curated data — exactly the data-logic separation `project_data_logic_separation_philosophy.md` and CLAUDE.md § "Papertek Vocabulary — Shared Data Source" endorse.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`spell-check-core.js` runner** — already iterates `self.__lexiSpellRules` filtered by language and sorted by priority. Adding priority bands and `ctx.sentences` extends this without refactoring the run loop.
- **`ctx.suppressed: Set<tokenIndex>` (Phase 4)** — the `ctx.suppressedFor.structural` tier is a shape-compatible extension: `ctx.suppressedFor = { structural: Set, ... }`. Quotation-span pre-pass rule (priority 1-9) populates it; structural rules (priority 10+) honour it.
- **`nb-codeswitch.js` (priority 1) and `nb-propernoun-guard.js` (priority 5)** — existing pre-pass rules are the template for the new quotation-suppression pre-pass.
- **`explain()` contract** (`check-explain-contract.js`) — already returns `{nb, nn}` strings per rule; `severity` field is a strict additive extension. The paired `:test` self-test pattern is the template for `check-governance-data:test` and `check-benchmark-coverage:test`.
- **CSS dot-marker system** (`content.css` `.lh-spell-<id>` bindings) — already has per-rule colour bindings. Adding `-warn` / `-hint` variants is additive; `check-rule-css-wiring` already enforces per-rule presence.
- **`scripts/check-fixtures.js`** — auto-discovers rule files via `readdirSync`. Zero change needed to absorb new rule files.

### Established Patterns

- **Dual-load IIFE guard** (host.__lexiSpellRules) — every new rule file in Phase 6 must start with the standard preamble (see spell-rules/README.md). Fatal silent failure mode if forgotten.
- **Per-rule `:test` self-tests paired with release gates** — `check-explain-contract:test`, `check-rule-css-wiring:test`, `check-spellcheck-features:test`, `check-network-silence:test` all plant a broken scratch rule, assert gate fires, plant a well-formed scratch rule, assert gate passes. New gates `check-benchmark-coverage` and `check-governance-data` MUST ship with paired `:test` on day one.
- **papertek-vocabulary data source** — new banks (register-bank, collocationbank, phrase-bank) follow the existing verbbank/nounbank/grammarfeatures pattern. Synced via `npm run sync-vocab`, bundled in `extension/data/<lang>.json`, respects SC-06 offline silence.
- **Feature-gated vs superset index parity** — `check-spellcheck-features` already asserts lookup indexes are built from the unfiltered superset. Any new index introduced in Phase 6 must extend the gate's coverage (and its `:test` companion).

### Integration Points

- **`extension/manifest.json` content_scripts[0].js** — new rule files registered here, AFTER `spell-check-core.js` and BEFORE `spell-check.js`.
- **`extension/styles/content.css`** — severity-tier CSS variants added alongside existing `.lh-spell-<id>` rules.
- **`extension/content/spell-rules/README.md`** — document priority bands (P1/P2/P3), the Phase 13 document-state seam shape (for Phase 7 pre-planning), and severity-tier conventions.
- **`scripts/check-fixtures.js`** + new `scripts/check-benchmark-coverage.js` + new `scripts/check-governance-data.js` + their `:test` companions — all invoked by existing npm-script release workflow (see CLAUDE.md § Release Workflow).
- **`benchmark-texts/{lang}.txt`** — Phase 6 flips EN `make a photo` and register lines; fixture cases for `return back` / `free gift` added to each language's corpus.
- **Cross-repo**: papertek-vocabulary PR for register-bank, collocationbank, phrase-bank data lands BEFORE the rule PR per the v2.0 data-driven-vs-function-driven constraint.

</code_context>

<deferred>
## Deferred Ideas

- Essay-vs-chat context detection for REG-01 — brittle heuristic, skipped in favour of opt-in-when-needed. Revisit post-v2.0 if student feedback demands it.
- NB/DE/FR/ES collocation seeds — Phase 15 per roadmap.
- Full-scale redundancy bank growth beyond ~15 phrases/lang — post-v2.0 data curation, not a phase.
- Quotation-suppression scope beyond standard `"…"` and `«…»` (curly-quote families, inline code, markdown code-spans) — researcher decides in-phase; anything exotic defers.
- Custom NB abbreviation handling in the segmenter — trust `Intl.Segmenter` first; add only if benchmark fixtures expose false splits.
- 10.3b FR relative-clause PP agreement — already roadmap-deferred to v3.0 (Phase 10).
- Tense-harmony-across-sentences (benchmark-texts/en.txt "FUTURE/UNPLANNED" list) — not on v2.0 roadmap.

</deferred>

---

*Phase: 06-structural-infrastructure-register-stylistic-polish*
*Context gathered: 2026-04-24*
