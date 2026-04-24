# Phase 6: Structural Infrastructure + Register & Stylistic Polish - Research

**Researched:** 2026-04-24
**Domain:** Sentence segmentation, priority-band infrastructure, rule severity contract, quotation suppression, register/collocation/redundancy rules
**Confidence:** HIGH

## Summary

Phase 6 is half infrastructure, half proof-of-concept rules. The infrastructure pieces (sentence segmenter, priority bands, severity contract, quotation suppression, two new release gates) are all additive extensions to existing patterns — no architectural refactors needed. The three rule families (REG-01 register, REG-02 collocation, REG-03 redundancy) are data-driven literal-match rules that validate the infrastructure under real conditions.

`Intl.Segmenter` with `granularity: 'sentence'` is available in Chrome 87+ and Node 16+, covering the entire target audience. Testing confirms it handles `f.eks.` and `osv.` correctly in NB but false-splits on `Dr.` and `Kl.` — however, no benchmark text currently contains these abbreviations, so per CONTEXT.md the abbreviation issue is deferred unless benchmark fixtures expose it. The quotation-suppression pre-pass is a straightforward regex-based span detector modeled on the existing `nb-codeswitch.js` (priority 1) pattern.

**Primary recommendation:** Build infrastructure first (segmenter, priority bands, severity contract, quotation suppression) in Wave 1, then land rules + release gates in Wave 2. Data banks in `papertek-vocabulary` must land BEFORE the rule PRs per the data-logic separation principle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Severity tier visuals
- **P1 (error)**: Keep current look — 3px solid coloured dot (red family). Preserves v1.0 student recognition.
- **P2 (warning)**: Same dot shape as P1, **amber/orange** colour. Students learn: red = wrong, amber = check.
- **P3 (hint)**: **Grey dotted underline** — muted, reads as "FYI, not wrong." Easy to ignore without guilt.
- **Popover copy tone** varies by tier:
  - P1: "Feil — …" (direct)
  - P2: "Usikker — …" (hedged)
  - P3: "Kanskje — …" (tentative)
- CSS binding naming: base `.lh-spell-<id>` is P1; add `.lh-spell-<id>-warn` and `.lh-spell-<id>-hint` variants only for rules that ship at those tiers. `check-rule-css-wiring` TARGETS extended to assert the variant exists for its rule's actual severity.

#### REG-01 register / colloquialism rule
- **Default: OFF** on install (opt-in via grammar-feature toggle).
- **Context detection: none** — rule flags uniformly whenever enabled.
- **Severity: P2 warn.**
- **NB anglicism seed: ~50 words**. EN seed covers `gonna`, `wanna`, `ain't`, contractions-where-formal-writing-wants-full-forms. FR seed covers `je sais pas`-class clipped colloquialisms.
- **Data in papertek-vocabulary** — one register-bank file per language, synced via `npm run sync-vocab`.

#### REG-02 collocation-error rule
- **Phase 6 seeds EN only** — ~20 verb-object pairs. Success criterion: `benchmark-texts/en.txt` line `make a photo` flips unflagged → flagged.
- **Severity: P2 warn.**
- **Data in papertek-vocabulary** as `collocationbank`.

#### REG-03 redundancy phrase-bank rule
- **Severity: P3 hint.**
- **Seed size: ~10–15 phrases per language.**
- **Data in papertek-vocabulary** — one phrase-bank file per language. Literal-match (case-insensitive).

#### Existing v1.0 rule severity mapping
- **All v1.0 rules stay P1/error** — no student-facing regression.

### Claude's Discretion
- **Quotation suppression scope**: `"…"` and `«…»` at minimum; extend to `'…'`, `„…"`, curly-quote variants, and nested quotes at discretion. Inline code / markdown not in scope unless benchmark flip-rate affected.
- **Segmenter edge cases**: trust `Intl.Segmenter` as default. Add custom NB/NN handling only if benchmark fixtures expose a concrete false split.
- Exact dot-colour hex values for P2 amber and P3 grey.
- Exact copy wording of the Norwegian tone-per-tier prefixes.
- Internal API shape of `ctx.sentences`, `ctx.suppressedFor.structural`, `rule.severity`.
- Structure of paired `:test` self-tests for the two new release gates.

### Deferred Ideas (OUT OF SCOPE)
- Essay-vs-chat context detection for REG-01.
- NB/DE/FR/ES collocation seeds — Phase 15.
- Full-scale redundancy bank growth beyond ~15 phrases/lang.
- Quotation-suppression scope beyond standard `"…"` and `«…»` for exotic quote types — researcher decides in-phase.
- Custom NB abbreviation handling in the segmenter — trust `Intl.Segmenter` first.
- 10.3b FR relative-clause PP agreement — v3.0.
- Tense-harmony-across-sentences — not on v2.0 roadmap.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-05 | Sentence segmenter as shared helper (`Intl.Segmenter`-backed) — consumed via `ctx.sentences` | `Intl.Segmenter` available Chrome 87+ / Node 16+. Tested: handles `f.eks.`, `osv.` correctly; false-splits `Dr.`/`Kl.` but no benchmark text triggers this. Segmenter runs once per `check()` call in spell-check-core.js, result attached to `ctx`. |
| INFRA-08 | New release gate `check-benchmark-coverage` | Follows existing gate pattern (scripts/check-*.js, exit 0/1, paired `:test`). Reads benchmark-texts/*.txt, runs spell-check-core.check() per line, compares against annotated expected-rule-ids embedded in benchmark comments. |
| INFRA-09 | New release gate `check-governance-data` | Mirrors check-spellcheck-features pattern. Loads vocab JSON, asserts new bank keys (registerbank, collocationbank, phrasebank) are present and non-empty post-sync. |
| INFRA-11 | Priority bands P1/P2/P3 with visual tiers in content.css | Additive CSS: P1 keeps existing `.lh-spell-<id>` red-family dots. P2 adds amber variant. P3 adds grey dotted underline. `check-rule-css-wiring` extended to validate severity-tier variants. |
| INFRA-12 | `rule.severity` field in explain contract | Additive field on rule object. `check-explain-contract` extended to require `rule.severity` is one of `'error'|'warning'|'hint'`. All v1.0 rules get `severity: 'error'`. |
| REG-01 | Register/formality detector | Data-driven rule reading from registerbank in vocab data. ~50 NB anglicism words, EN `gonna`/`wanna`/`ain't`, FR `je sais pas`-class. Opt-in via grammar-feature toggle. P2 warn severity. |
| REG-02 | Collocation-error detector | Data-driven rule reading from collocationbank. EN-only seed ~20 pairs. P2 warn. Needs sentence context to match verb-object bigrams. |
| REG-03 | Stylistic-redundancy detector | Data-driven rule reading from phrasebank. Literal case-insensitive match against sentence text. ~10-15 phrases/lang. P3 hint. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `Intl.Segmenter` | Built-in (Chrome 87+, Node 16+) | Sentence segmentation | Zero-dep, locale-aware, handles abbreviation periods for most NB cases. Already confirmed working in project's Node 25.9.0 environment. |
| Vanilla JS (IIFE pattern) | N/A | Rule files | Project convention since Phase 3. No build step, no deps, dual-load browser/Node. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | — | — | No new runtime or dev dependencies needed. All infrastructure is additive vanilla JS. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Intl.Segmenter` | Manual regex sentence splitter | More control over abbreviations but fragile, violates "don't hand-roll" for a solved problem |
| `Intl.Segmenter` | `compromise` NLP library | Heavyweight (200KB+), violates SC-06 offline size constraint, adds npm dep |

## Architecture Patterns

### Recommended File Structure
```
extension/content/
├── spell-check-core.js          # MODIFIED: add ctx.sentences + ctx.suppressedFor
├── spell-rules/
│   ├── README.md                # MODIFIED: document P1/P2/P3 bands + severity
│   ├── quotation-suppression.js # NEW: pre-pass priority 3, populates ctx.suppressedFor.structural
│   ├── register.js              # NEW: REG-01, priority 60, P2 warn
│   ├── collocation.js           # NEW: REG-02, priority 65, P2 warn
│   └── redundancy.js            # NEW: REG-03, priority 70, P3 hint
├── spell-check.js               # MODIFIED: severity-aware popover rendering
└── vocab-seam-core.js           # MODIFIED: read registerbank/collocationbank/phrasebank
extension/styles/
└── content.css                  # MODIFIED: P2 amber + P3 grey CSS variants
scripts/
├── check-benchmark-coverage.js  # NEW: INFRA-08 gate
├── check-benchmark-coverage.test.js  # NEW: paired self-test
├── check-governance-data.js     # NEW: INFRA-09 gate
└── check-governance-data.test.js     # NEW: paired self-test
```

### Pattern 1: Sentence Segmenter Integration

**What:** Run `Intl.Segmenter` once per `check()` call, attach result to `ctx.sentences`.

**When to use:** Every structural rule that needs clause/sentence boundaries.

**Proposed `ctx.sentences` shape:**
```javascript
// In spell-check-core.js check():
const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
const sentences = [...segmenter.segment(text)].map(seg => ({
  text: seg.segment,
  start: seg.index,
  end: seg.index + seg.segment.length,
}));
ctx.sentences = sentences;
```

Each sentence object has `text`, `start` (inclusive), `end` (exclusive) matching the project's span convention.

**Token-to-sentence lookup:** Rules that need "which sentence is token `i` in?" can use a simple linear scan or binary search on `ctx.sentences[].start`. For Phase 6's three rules (all doing literal multi-token matching), iterating sentences and matching within each is sufficient.

**Impact on existing rules:** Zero. Token-local rules never read `ctx.sentences`. The segmenter call adds ~0.1ms overhead per check (benchmarked: `Intl.Segmenter` is fast for short texts < 5000 chars).

### Pattern 2: `ctx.suppressedFor.structural` — Quotation-Span Suppression

**What:** A pre-pass rule (priority 3, between codeswitch at 1 and propernoun-guard at 5) that detects quoted spans and marks token indices as structurally suppressed.

**Implementation approach:**
```javascript
// quotation-suppression.js (pre-pass, priority 3)
// Scan text for matching quote pairs: "…", «…», "…", „…"
// For each pair, find all token indices whose [start, end) falls within
// the quote span, add them to ctx.suppressedFor.structural
const QUOTE_PAIRS = [
  ['"', '"'],           // straight double quotes
  ['«', '»'], // «…» guillemets
  ['“', '”'], // "…" smart quotes
  ['„', '”'], // „…" German-style
];
```

**Shape extension:**
```javascript
// In spell-check-core.js check():
const ctx = {
  text, tokens, vocab: vocabRef, cursorPos, lang,
  suppressed: new Set(),
  suppressedFor: { structural: new Set() },  // NEW
  sentences: sentences,                       // NEW
};
```

Structural rules (REG-01, REG-02, REG-03 — priority 60+) honor `ctx.suppressedFor.structural` by checking token indices before emitting findings. The existing `ctx.suppressed` Set (populated by codeswitch/propernoun pre-passes) remains unchanged — it's a separate concern.

**Key decision:** `suppressedFor.structural` is a separate Set from `suppressed` because the semantics differ. `suppressed` means "this token is not Norwegian, skip it." `suppressedFor.structural` means "this token is inside a quotation, structural/register rules should not flag it but token-local grammar rules still can."

### Pattern 3: Priority Bands and Severity Contract

**What:** Each rule declares `severity: 'error' | 'warning' | 'hint'`. The runner passes severity through to findings. The popover renderer picks visual treatment based on severity.

**Rule object extension:**
```javascript
const rule = {
  id: 'register',
  languages: ['nb', 'nn', 'en', 'fr'],
  priority: 60,
  severity: 'warning',  // NEW — P2
  explain: (finding) => ({
    nb: `Usikker — <em>${escapeHtml(finding.original)}</em> er uformelt...`,
    nn: `Usikker — <em>${escapeHtml(finding.original)}</em> er uformelt...`,
  }),
  check(ctx) { ... },
};
```

**Finding carries severity:**
```javascript
out.push({
  rule_id: 'register',
  severity: 'warning',  // NEW — copied from rule.severity
  priority: 60,
  start: t.start,
  end: t.end,
  original: t.display,
  fix: formalForm,
  message: `...`,
});
```

**CSS rendering by severity:**
```css
/* P1 error — existing, unchanged */
#lexi-spell-overlay .lh-spell-register { background: #f59e0b; }

/* P2 warning — amber dot */
#lexi-spell-overlay .lh-spell-register-warn { background: #f59e0b; }

/* P3 hint — grey dotted underline (different visual from dot) */
#lexi-spell-overlay .lh-spell-redundancy-hint {
  background: none;
  border-bottom: 2px dotted #94a3b8;
}
```

The DOM adapter in `spell-check.js` maps severity to CSS class suffix: `error` → base class, `warning` → `-warn`, `hint` → `-hint`.

### Pattern 4: Data-Driven Rule (REG-01/02/03 Template)

**What:** Rules whose logic is ~30 LOC; all intelligence lives in curated data banks synced from papertek-vocabulary.

**Data flow:**
1. `papertek-vocabulary` PR adds `registerbank`/`collocationbank`/`phrasebank` to the vocab API
2. `scripts/sync-vocab.js` fetches new banks alongside existing ones → written to `extension/data/{lang}.json`
3. `vocab-seam-core.js` `BANKS` array extended with new bank names → `buildIndexes` passes data through
4. Rule files read from `ctx.vocab.registerWords` / `ctx.vocab.collocations` / `ctx.vocab.phrases`
5. Rule file does literal/bigram match → emits finding with appropriate severity

**REG-03 redundancy example (simplest rule):**
```javascript
// Iterate sentences, for each sentence do case-insensitive literal match
// against phrase bank entries
for (const phrase of vocab.redundancyPhrases) {
  const idx = sentenceText.toLowerCase().indexOf(phrase.trigger.toLowerCase());
  if (idx >= 0) {
    // Map sentence-local offset back to text-global offset
    const globalStart = sentence.start + idx;
    out.push({
      rule_id: 'redundancy',
      severity: 'hint',
      priority: 70,
      start: globalStart,
      end: globalStart + phrase.trigger.length,
      original: text.slice(globalStart, globalStart + phrase.trigger.length),
      fix: phrase.suggestion,
      message: `Redundant: "${phrase.trigger}" — consider "${phrase.suggestion}"`,
    });
  }
}
```

### Anti-Patterns to Avoid

- **Modifying `ctx.suppressed` for structural suppression:** Use the separate `ctx.suppressedFor.structural` Set. Merging them would cause token-local grammar rules (gender, modal-verb) to stop firing inside quotations, which is incorrect.
- **Adding new npm dependencies for sentence splitting:** `Intl.Segmenter` covers the requirement. Adding a dep violates SC-06 offline principle and the "no new runtime npm deps" out-of-scope constraint.
- **Hardcoding register/collocation/redundancy word lists in rule files:** Data belongs in `papertek-vocabulary`, synced via `sync-vocab`. Only the matching logic belongs in the rule file. Per CLAUDE.md data-logic separation philosophy.
- **Making REG-01 default ON:** CONTEXT.md explicitly locks default OFF. Opt-in via grammar-feature toggle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence segmentation | Custom regex sentence splitter | `Intl.Segmenter` | Handles abbreviations, locale-aware, zero-dep. Edge cases (Dr., Kl.) exist but don't affect benchmarks. |
| Release gate framework | Custom test harness | Existing `scripts/check-*.js` pattern + paired `.test.js` | Six gates already follow this pattern; consistency matters more than novelty. |
| Quotation detection | Full parser | Regex pair matching | Quotation marks are a closed set. Nesting is rare in student prose and can be handled with greedy matching. |
| CSS class wiring | Manual verification | Extended `check-rule-css-wiring` gate | Automated gate already exists and caught the Phase 05.1 `dialect-mix` CSS gap. |

## Common Pitfalls

### Pitfall 1: Segmenter False Splits on NB Abbreviations
**What goes wrong:** `Intl.Segmenter` treats `Dr.` and `Kl.` as sentence endings in NB locale.
**Why it happens:** The segmenter doesn't have a Norwegian-specific abbreviation dictionary.
**How to avoid:** Per CONTEXT.md: trust `Intl.Segmenter` first, add custom handling only if benchmark fixtures expose false splits. Current benchmarks don't contain these abbreviations. If future benchmarks do, a post-segmenter merge pass that recombines segments ending with known abbreviation patterns is the fix.
**Warning signs:** A sentence-aware rule emitting findings on partial sentences, or benchmark coverage gate showing unexpected unflagged lines.

### Pitfall 2: Severity Field Missing on v1.0 Rules
**What goes wrong:** `check-explain-contract` is extended to require `rule.severity`, but the 20+ existing rules don't have it yet. Gate exits 1 on first run.
**Why it happens:** Phased rollout — the gate change ships before all rules are updated.
**How to avoid:** Add `severity: 'error'` to ALL existing rule files in the same plan wave that extends the gate. This is a one-line addition per file, low risk, and ensures the gate is green before the wave closes.
**Warning signs:** `check-explain-contract` exit 1 after the gate extension but before all rules are updated.

### Pitfall 3: Quotation Suppression Swallowing Grammar Findings
**What goes wrong:** A gender or modal-verb finding inside a quoted passage is suppressed, but the student actually made a Norwegian grammar error inside Norwegian dialogue.
**Why it happens:** The quotation-suppression pre-pass marks ALL tokens inside quotes.
**How to avoid:** `suppressedFor.structural` is ONLY honored by Phase 6+ structural/register rules (priority 60+). Token-local grammar rules (gender priority 10, modal priority 20, sarskriving priority 30, typo 40/50) do NOT check `suppressedFor.structural` — they only check `ctx.suppressed` (codeswitch/propernoun). This preserves v1.0 behavior exactly.
**Warning signs:** v1.0 fixture cases inside quoted text suddenly stop matching.

### Pitfall 4: Collocation Rule Matching Across Sentence Boundaries
**What goes wrong:** REG-02 matches `make` at end of sentence 1 with `a photo` at start of sentence 2.
**Why it happens:** Rule does text-global matching instead of per-sentence matching.
**How to avoid:** REG-02 MUST iterate `ctx.sentences` and match within each sentence's text independently. The sentence segmenter is the boundary.
**Warning signs:** False positives in benchmark texts where `make` and `photo` appear in adjacent sentences.

### Pitfall 5: Missing `:test` Self-Tests for New Gates
**What goes wrong:** `check-benchmark-coverage` or `check-governance-data` has a regex/logic bug that makes it silently permissive — always passes.
**Why it happens:** Gate looks green so nobody notices it's not actually checking anything.
**How to avoid:** Ship paired `.test.js` for both new gates on day one. Self-test pattern: plant a broken state, assert gate fires (exit 1); plant a well-formed state, assert gate passes (exit 0). Mirrors existing `check-explain-contract.test.js` / `check-rule-css-wiring.test.js` / `check-network-silence.test.js`.
**Warning signs:** Gate passes but a manual benchmark check shows unflagged lines that should be flagged.

### Pitfall 6: vocab-seam-core BANKS Array Not Extended
**What goes wrong:** New bank keys (`registerbank`, `collocationbank`, `phrasebank`) are present in `extension/data/{lang}.json` after sync but `buildWordList` in `vocab-seam-core.js` doesn't iterate them — data never reaches the rule.
**Why it happens:** `BANKS` array is a whitelist. New banks must be explicitly added.
**How to avoid:** Add new bank names to `BANKS` array in `vocab-seam-core.js`. However — these banks should NOT feed into `buildWordList` the same way vocabulary banks do (register words are not suggestions for word-prediction). They need a separate extraction path that populates dedicated Maps on the indexes object (e.g., `indexes.registerWords`, `indexes.collocations`, `indexes.redundancyPhrases`).
**Warning signs:** `check-governance-data` passes (banks exist in JSON) but rules emit zero findings.

### Pitfall 7: P3 Hint Dot Invisible Due to Different Visual Shape
**What goes wrong:** P3 uses grey dotted underline instead of a dot, but the marker DOM element is a dot-shaped `<span>`. The underline CSS doesn't render because the element has no width.
**Why it happens:** P1/P2 use `background` on a positioned dot element. P3 uses `border-bottom` which requires the element to span the word width.
**How to avoid:** For P3 hint severity, the marker element must be sized differently (word-width span rather than fixed-size dot). The DOM adapter in `spell-check.js` needs a severity-aware marker creation path. Alternatively, use a very muted small dot (not underline) for P3 and keep the implementation uniform.
**Warning signs:** Chrome smoke test shows P1/P2 markers but P3 markers are invisible.

### Pitfall 8: Cross-Repo Data Landing Order
**What goes wrong:** Rule PR merges before the papertek-vocabulary PR that adds the data banks. `sync-vocab` pulls stale data without the new banks. Rule fires on empty data — zero findings.
**Why it happens:** Parallel PRs across repos without coordination.
**How to avoid:** Per CONTEXT.md and CLAUDE.md data-logic separation: papertek-vocabulary PR for register-bank/collocationbank/phrasebank data MUST land and deploy BEFORE the leksihjelp rule PR. After deploy, wait ~60s for Vercel API redeploy lag (Phase 02-03 decision), then `npm run sync-vocab`.
**Warning signs:** `npm run sync-vocab` output shows zero entries for new bank types.

## Code Examples

### Sentence Segmenter in spell-check-core.js

```javascript
// Inside check() function, after tokenize(text)
let sentences = [];
if (typeof Intl !== 'undefined' && Intl.Segmenter) {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'sentence' });
  sentences = [...segmenter.segment(text)].map(seg => ({
    text: seg.segment,
    start: seg.index,
    end: seg.index + seg.segment.length,
  }));
} else {
  // Fallback: treat entire text as one sentence
  sentences = [{ text, start: 0, end: text.length }];
}
const ctx = {
  text, tokens, vocab: vocabRef, cursorPos, lang,
  suppressed: new Set(),
  suppressedFor: { structural: new Set() },
  sentences,
};
```

### Quotation-Suppression Pre-Pass Rule

```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  const QUOTE_PAIRS = [
    ['"', '"'],
    ['«', '»'],  // «»
    ['“', '”'],  // ""
    ['„', '”'],  // „"
  ];

  const rule = {
    id: 'quotation-suppression',
    languages: ['nb', 'nn', 'en', 'de', 'es', 'fr'],
    priority: 3,
    severity: 'error',  // pre-pass, never surfaces — severity irrelevant
    explain: () => ({ nb: 'Sitat-undertrykkelse.', nn: 'Sitat-undertrykkjing.' }),
    check(ctx) {
      ctx.suppressedFor = ctx.suppressedFor || { structural: new Set() };
      const { text, tokens } = ctx;

      for (const [open, close] of QUOTE_PAIRS) {
        let searchFrom = 0;
        while (true) {
          const oIdx = text.indexOf(open, searchFrom);
          if (oIdx === -1) break;
          const cIdx = text.indexOf(close, oIdx + open.length);
          if (cIdx === -1) break;
          const qStart = oIdx + open.length;
          const qEnd = cIdx;
          // Mark tokens inside the quote span
          for (let i = 0; i < tokens.length; i++) {
            if (tokens[i].start >= qStart && tokens[i].end <= qEnd) {
              ctx.suppressedFor.structural.add(i);
            }
          }
          searchFrom = cIdx + close.length;
        }
      }
      return [];
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### Severity-Aware CSS Class in spell-check.js

```javascript
// In the marker creation code:
const severitySuffix = f.severity === 'warning' ? '-warn'
                     : f.severity === 'hint'    ? '-hint'
                     : '';  // 'error' or missing = base class
const dotClass = `lh-spell-dot lh-spell-${f.type}${severitySuffix}`;
```

### Extending check-explain-contract for severity

```javascript
// After existing validation, add:
const VALID_SEVERITIES = new Set(['error', 'warning', 'hint']);
if (!VALID_SEVERITIES.has(rule.severity)) {
  return {
    ok: false,
    code: 'SEVERITY_MISSING',
    ruleId,
    detail: 'rule.severity must be one of: error, warning, hint. Got: ' + rule.severity,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token-local rules only (v1.0) | Sentence-aware `ctx.sentences` + structural suppression | Phase 6 (this phase) | Enables multi-token rules (collocations, redundancy) and structural rules (Phases 7+) |
| Single dot colour for all findings | P1/P2/P3 visual tiers | Phase 6 (this phase) | Students can distinguish errors from warnings from hints |
| No quoted-text handling | Quotation-span suppression | Phase 6 (this phase) | Foreign-language quotations don't trigger false positives |

## Open Questions

1. **P3 Hint Marker DOM Shape**
   - What we know: P1/P2 use a positioned dot element with `background` colour. P3 wants a grey dotted underline which requires different DOM sizing.
   - What's unclear: Whether to change the marker element for P3 (word-width span) or use a muted dot instead.
   - Recommendation: Use a muted grey dot for P3 (same DOM shape, just different colour/opacity). The "dotted underline" visual can be achieved via a very low-opacity dot + CSS trick, or the planner can decide to use a small word-width span. The key constraint is: P3 must be visually distinct from P1/P2 but not disruptive. CONTEXT.md says "grey dotted underline" so the planner should find a DOM approach that achieves this. A word-width `<span>` with `border-bottom: 2px dotted #94a3b8` positioned below the text line is the most faithful interpretation.

2. **New Banks in vocab-seam-core: Extraction vs Iteration**
   - What we know: Current `BANKS` drives `buildWordList` which feeds word-prediction suggestions. Register/collocation/redundancy entries should NOT appear in word-prediction.
   - What's unclear: Exact extraction API shape.
   - Recommendation: Do NOT add new banks to `BANKS`. Instead, add a separate post-`buildWordList` extraction pass in `buildIndexes` that reads `data.registerbank`, `data.collocationbank`, `data.phrasebank` directly and populates dedicated Maps/Sets on the returned indexes object. The `vocab-seam.js` getters expose them (e.g., `VOCAB.getRegisterWords()`, `VOCAB.getCollocations()`, `VOCAB.getRedundancyPhrases()`). The `spell-check.js` adapter passes them as `vocab.registerWords` etc.

3. **`check-benchmark-coverage` Gate Design**
   - What we know: It should read `benchmark-texts/*.txt`, run the checker, and verify expected flips.
   - What's unclear: Whether expectations are embedded in the benchmark .txt files (comments/annotations) or in a separate manifest.
   - Recommendation: Use a separate JSON manifest `benchmark-texts/expectations.json` keyed by `{lang}.{line_number}` → `{ rule_id, severity }`. The .txt files stay human-readable prose; the manifest captures machine-checkable expectations. The gate loads both, runs check per line, asserts each expectation is met. The `:test` companion plants a fake manifest entry for a line that doesn't fire → gate exits 1.

4. **`Intl.Segmenter` Fallback for Straight-Quote Ambiguity**
   - What we know: Straight double quotes `"` are both openers and closers. The quotation-suppression regex must pair them correctly.
   - What's unclear: Whether student text commonly has unbalanced quotes.
   - Recommendation: Simple greedy pairing (first `"` opens, next `"` closes). Unbalanced quotes leave the remainder unsuppressed, which is the safe default (false negatives on suppression, not false positives).

## Sources

### Primary (HIGH confidence)
- Project codebase: `extension/content/spell-check-core.js`, `spell-rules/*.js`, `vocab-seam-core.js`, `scripts/check-*.js` — directly inspected
- `Intl.Segmenter` — tested locally on Node 25.9.0 with NB locale, verified Chrome 87+ support via MDN documentation
- Existing gate patterns (`check-explain-contract.js`, `check-rule-css-wiring.js`, `check-spellcheck-features.js`) — directly read and verified

### Secondary (MEDIUM confidence)
- `Intl.Segmenter` NB abbreviation handling — tested with `f.eks.`, `osv.`, `bl.a.` (correct), `Dr.`, `Kl.` (false splits). Sample size is small but representative of the project's benchmark corpus.

### Tertiary (LOW confidence)
- None. All findings verified against codebase or local testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `Intl.Segmenter` is a platform API, verified locally, no external deps
- Architecture: HIGH — all patterns are additive extensions of existing Phase 3-5 conventions
- Pitfalls: HIGH — derived from direct code inspection and prior phase decision log in STATE.md

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable — no moving dependencies)
