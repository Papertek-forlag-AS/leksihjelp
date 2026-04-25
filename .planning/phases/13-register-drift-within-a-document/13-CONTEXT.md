# Phase 13: Register Drift Within a Document - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Land the document-state two-pass runner in spell-check-core.js and ship four register-drift rules: DE du/Sie address mixing, FR tu/vous address mixing, NB bokmål/riksmål form mixing, and NN a-/e-infinitiv mixing. Enforce a stateful-rule-invalidation release gate with paired self-test.

</domain>

<decisions>
## Implementation Decisions

### Two-pass runner integration
- Post-pass on aggregated findings: run all existing single-pass rules first, then run document-rules (`kind: 'document'`) on the accumulated ctx + findings array
- Document-rules run every check cycle (same debounce as token-level rules) — drift markers appear/disappear in real time
- Priority band 200+ — well above all existing rules, clean separation
- Document-rules receive both the full ctx object and the findings array from pass 1, enabling them to avoid re-flagging tokens already caught by token-level rules

### Drift detection threshold
- Minority flagging: identify the dominant register from the majority of markers, flag the minority tokens as drift
- Minimum 3 register-signalling markers in the text before drift detection kicks in — avoids false positives on very short texts
- Fix suggestions name the dominant register (e.g. "Du bruker mest uformell form (du). Her bruker du formell form (Sie) — mente du 'hast'?")
- NB bokmål/riksmål uses a new `BOKMAL_RIKSMAL_MAP` — separate from the existing `CROSS_DIALECT_MAP` which covers NB↔NN

### Relationship to existing rules
- Complement, not supersede: de-grammar du/Sie adjacent-window checks and nb-dialect-mix NB↔NN flags stay as-is
- Different concerns: token-level rules catch specific grammar errors (du + sind → bist); document-drift catches whole-text register inconsistency
- dedupeOverlapping handles token-level overlap naturally — since doc-drift is priority 200+, token-level rules (10–70) win on span overlap
- Shared document-drift helper (majority-vote / marker-counting logic) + 4 independent rule files, each defining its own marker map and register names

### Invalidation & edit resilience
- Fresh recompute from full text each check() call — no cached state between calls. The text IS the state. Zero ghost flags by design since there's nothing to invalidate
- Content-hash keying is implicit: same text → same findings, changed text → recomputed findings
- Never use module-level mutable state for register tallies

### Claude's Discretion
- Exact structure of the shared helper (grammar-tables.js extension vs new file)
- Specific marker words for BOKMAL_RIKSMAL_MAP and NN a-/e-infinitiv map (research determines)
- DE du/Sie and FR tu/vous pronoun/verb marker identification strategy
- Performance optimization if needed (the "recompute everything" approach should be fine for typical student text lengths)

</decisions>

<specifics>
## Specific Ideas

- Fix suggestions should be pedagogical: tell the student which register they're mostly using and offer a concrete fix toward the dominant register
- The BOKMAL_RIKSMAL_MAP is a sibling to CROSS_DIALECT_MAP — same pattern, different concern (within-NB register vs cross-standard NB↔NN)
- The roadmap's success criteria explicitly name: `boken`/`efter`/`sne` as riksmål markers alongside bokmål forms

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spell-check-core.js:check()` — single-pass runner with priority-sorted rule iteration; post-pass hook point needed
- `grammar-tables.js` — shared data tables (verb sets, pronoun lists); natural home for BOKMAL_RIKSMAL_MAP or doc-drift helper
- `nb-dialect-mix.js` — CROSS_DIALECT_MAP pattern to mirror for BOKMAL_RIKSMAL_MAP
- `de-grammar.js` — existing du/Sie detection (lines 96-131) shows marker identification patterns
- `ctx.getTagged(i)` — POS-tagged tokens with isFinite/isSubject; useful for du/Sie/tu/vous identification
- `dedupeOverlapping` — existing span-overlap resolver that keeps lowest-priority finding

### Established Patterns
- Rules register onto `self.__lexiSpellRules` via IIFE, filtered by `languages` array
- Each rule exports: `id`, `languages`, `priority`, `severity`, `check(ctx)`, `explain(finding)`
- Findings use `rule_id`, `start`, `end`, `fix`, `message` fields
- Release gates follow pattern: `scripts/check-*.js` with paired `:test` self-test

### Integration Points
- `spell-check-core.js:check()` — needs post-pass loop for `kind: 'document'` rules after existing rule iteration
- `extension/manifest.json` — content_scripts entries for new rule files
- `scripts/check-explain-contract.js` TARGETS — new rules must be added
- `scripts/check-rule-css-wiring.js` TARGETS — new rules must be added
- `extension/styles/content.css` — CSS dot-colour bindings for new rule IDs
- `benchmark-texts/expectations.json` — benchmark entries for register-drift rules

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-register-drift-within-a-document*
*Context gathered: 2026-04-25*
