# Phase 13: Register Drift Within a Document - Research

**Researched:** 2026-04-25
**Domain:** Document-level stateful rule runner + register-consistency detection (DE, FR, NB, NN)
**Confidence:** HIGH

## Summary

Phase 13 introduces the first document-level rules to the spell-check system. The current runner in `spell-check-core.js` processes rules per-token/per-sentence in a single pass. This phase adds a post-pass for `kind: 'document'` rules that receive both the full `ctx` and the accumulated pass-1 `findings` array. Four register-drift rules detect inconsistent address forms (DE du/Sie, FR tu/vous), within-standard register mixing (NB bokmal/riksmal), and infinitive-class mixing (NN a-/e-infinitiv).

The critical architectural insight is that the "fresh recompute" design (no cached state between calls) eliminates the entire class of stale-cache ghost-flag bugs. The text IS the state. The release gate (`check-stateful-rule-invalidation`) validates this property via scripted edit sequences in Node.

**Primary recommendation:** Add a 15-line post-pass loop to `check()` in spell-check-core.js that filters rules by `kind: 'document'`, runs them after pass-1, and merges their findings before deduplication. Keep each rule's marker map and majority-vote logic in its own file, with a tiny shared helper for the common tally/minority-flag pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Post-pass on aggregated findings: run all existing single-pass rules first, then run document-rules (`kind: 'document'`) on the accumulated ctx + findings array
- Document-rules run every check cycle (same debounce as token-level rules) -- drift markers appear/disappear in real time
- Priority band 200+ -- well above all existing rules, clean separation
- Document-rules receive both the full ctx object and the findings array from pass 1, enabling them to avoid re-flagging tokens already caught by token-level rules
- Minority flagging: identify the dominant register from the majority of markers, flag the minority tokens as drift
- Minimum 3 register-signalling markers in the text before drift detection kicks in -- avoids false positives on very short texts
- Fix suggestions name the dominant register (e.g. "Du bruker mest uformell form (du). Her bruker du formell form (Sie) -- mente du 'hast'?")
- NB bokmal/riksmal uses a new `BOKMAL_RIKSMAL_MAP` -- separate from the existing `CROSS_DIALECT_MAP` which covers NB<->NN
- Complement, not supersede: de-grammar du/Sie adjacent-window checks and nb-dialect-mix NB<->NN flags stay as-is
- Different concerns: token-level rules catch specific grammar errors (du + sind -> bist); document-drift catches whole-text register inconsistency
- dedupeOverlapping handles token-level overlap naturally -- since doc-drift is priority 200+, token-level rules (10-70) win on span overlap
- Shared document-drift helper (majority-vote / marker-counting logic) + 4 independent rule files, each defining its own marker map and register names
- Fresh recompute from full text each check() call -- no cached state between calls. The text IS the state. Zero ghost flags by design
- Content-hash keying is implicit: same text -> same findings, changed text -> recomputed findings
- Never use module-level mutable state for register tallies
- Node-based edit-sequence gate testing all 4 rules
- Self-test follows existing plant-broken-rule pattern

### Claude's Discretion
- Exact structure of the shared helper (grammar-tables.js extension vs new file)
- Specific marker words for BOKMAL_RIKSMAL_MAP and NN a-/e-infinitiv map (research determines)
- DE du/Sie and FR tu/vous pronoun/verb marker identification strategy
- Performance optimization if needed (the "recompute everything" approach should be fine for typical student text lengths)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-07 | Document-state two-pass runner (`kind: 'document'` rule type) with explicit invalidation protocol | Architecture Patterns: Two-Pass Runner Integration -- 15-line post-pass loop in check(), fresh-recompute eliminates invalidation concern |
| INFRA-10 | New release gate `check-stateful-rule-invalidation` -- paired self-test for Phase 13 document-state | Release Gate section -- edit-sequence testing pattern, plant-broken-rule self-test |
| DOC-01 | DE du/Sie drift warn when a single document mixes du-address and Sie-address forms | DE Marker Strategy section -- pronoun + verb form identification from vocab data |
| DOC-02 | FR tu/vous drift warn (mirror of DOC-01) | FR Marker Strategy section -- pronoun + verb form identification from vocab data |
| DOC-03 | NB bokmal/riksmal mixing warn using BOKMAL_RIKSMAL_MAP | NB Marker Strategy section -- curated riksmal<->bokmal form pairs |
| DOC-04 | NN a-infinitiv / e-infinitiv mixing warn | NN Marker Strategy section -- vocab data already stores dual infinitive arrays |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| spell-check-core.js | current | Rule runner with new post-pass loop | Existing runner; only needs ~15 lines added |
| grammar-tables.js | current | Shared data tables for all grammar rules | Natural home for BOKMAL_RIKSMAL_MAP |
| Intl.Segmenter | browser-native | Sentence segmentation (already in use) | No deps needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vocab-seam-core.js | current | Provides verbInfinitive, knownPresens, validWords indexes | NN infinitive form detection |
| extension/data/nn.json | current | NN verb bank with dual a-/e-infinitiv arrays | DOC-04 marker extraction |
| extension/data/nb.json | current | NB noun bank with both boka/boken forms | DOC-03 marker validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared helper in grammar-tables.js | New doc-drift-helper.js file | Separate file adds a manifest entry; grammar-tables.js is already loaded and the helper is <30 lines -- recommend grammar-tables.js |
| Per-rule marker extraction from vocab | Inline hardcoded marker maps | Vocab-derived markers scale better but add init cost; for DE/FR pronouns the closed sets are small enough to inline |

## Architecture Patterns

### Two-Pass Runner Integration

**What:** Add a post-pass loop to `spell-check-core.js:check()` after the existing rule iteration, filtering rules by `kind: 'document'` and calling `rule.checkDocument(ctx, findings)`.

**Where in check() (after line 223, before dedupeOverlapping):**
```javascript
// ── Phase 13: Document-level post-pass (INFRA-07) ──
// Document rules (kind: 'document', priority 200+) receive the full ctx
// AND the pass-1 findings array. They run AFTER all token-level rules.
const docRules = rules.filter(r => r.kind === 'document');
for (const rule of docRules) {
  try {
    const out = rule.checkDocument(ctx, findings);
    if (Array.isArray(out) && out.length) {
      for (const f of out) {
        if (!f.severity && rule.severity) f.severity = rule.severity;
      }
      findings.push(...out);
    }
  } catch (e) {
    if (!rule._warned) {
      console.warn('[lexi-spell] doc-rule', rule.id, 'threw', e);
      rule._warned = true;
    }
  }
}
```

**Key design details:**
- Document rules are ALSO in the `rules` array (registered via `__lexiSpellRules`), but their `check(ctx)` should return `[]` -- they only produce findings via `checkDocument(ctx, findings)`
- The existing single-pass loop calls `rule.check(ctx)` on them (harmless no-op returning `[]`)
- The post-pass loop then calls `rule.checkDocument(ctx, findings)` where the real logic lives
- `dedupeOverlapping` runs AFTER both passes, so token-level rules (priority 10-70) automatically win on span overlap against doc-rules (priority 200+)

### Shared Drift Helper Pattern

**What:** A `detectDrift(markers, minCount)` function that takes an array of `{register, tokenIndex, start, end, display}` objects and returns `{dominant, minority}` where minority is the array of tokens to flag.

**Recommended location:** Export from `grammar-tables.js` as `host.__lexiGrammarTables.detectDrift`.

```javascript
/**
 * Majority-vote drift detector. Returns null if fewer than minCount
 * markers found (too little evidence). Otherwise returns the minority
 * register's markers for flagging.
 */
function detectDrift(markers, minCount = 3) {
  if (markers.length < minCount) return null;
  const tally = {};
  for (const m of markers) {
    tally[m.register] = (tally[m.register] || 0) + 1;
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return null; // all same register = no drift
  const dominant = sorted[0][0];
  const minority = markers.filter(m => m.register !== dominant);
  return { dominant, minority };
}
```

### Rule File Pattern (4 independent rules)

Each rule file follows this shape:
```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { escapeHtml } = host.__lexiSpellCore || {};
  const { detectDrift } = host.__lexiGrammarTables || {};

  const rule = {
    id: 'doc-drift-de-address',  // unique per rule
    kind: 'document',            // NEW: signals post-pass
    languages: ['de'],
    priority: 201,               // 200+ band
    severity: 'warning',
    explain(finding) { /* ... */ },
    check(ctx) { return []; },   // no-op for single-pass
    checkDocument(ctx, findings) {
      // 1. Scan ctx.tokens for register markers
      // 2. Call detectDrift(markers, 3)
      // 3. Build findings for minority tokens
      // 4. Skip tokens already flagged by pass-1 findings
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### Recommended Project Structure (new files)
```
extension/content/spell-rules/
  grammar-tables.js          # +detectDrift helper, +BOKMAL_RIKSMAL_MAP
  doc-drift-de-address.js    # DOC-01: DE du/Sie
  doc-drift-fr-address.js    # DOC-02: FR tu/vous
  doc-drift-nb-register.js   # DOC-03: NB bokmal/riksmal
  doc-drift-nn-infinitive.js # DOC-04: NN a-/e-infinitiv
scripts/
  check-stateful-rule-invalidation.js       # INFRA-10 gate
  check-stateful-rule-invalidation.test.js  # INFRA-10 self-test
```

### Anti-Patterns to Avoid
- **Module-level mutable state:** Never store register tallies in a variable outside `checkDocument()`. Each call must start fresh from the text.
- **Caching findings between calls:** The "text IS state" principle means no Map/WeakMap of previous results. Every `checkDocument()` recomputes from scratch.
- **Re-flagging pass-1 tokens:** Document rules must check the `findings` array and skip tokens that already have a finding at the same span. Use a Set of `start:end` keys from pass-1.
- **Superseding token-level rules:** DOC-01 detects *document-wide* du/Sie mixing; `de-grammar` detects *adjacent-pair* du+sind errors. Both can coexist. dedupeOverlapping resolves span conflicts by priority (lower wins).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Majority-vote detection | Custom per-rule tallying | Shared `detectDrift()` helper | Same algorithm 4 times = divergence risk |
| Riksmal form identification | Guessing from suffix patterns | Curated `BOKMAL_RIKSMAL_MAP` | Norwegian orthography is irregular; suffix rules have too many exceptions |
| NN infinitive classification | Regex on word endings | Vocab data dual-infinitive arrays | The data already classifies; regex `/-a$/` catches non-infinitive words |
| Edit-sequence ghost testing | Manual browser testing | Node-based scripted gate | Reproducible, CI-friendly, catches regressions |

## Common Pitfalls

### Pitfall 1: DE du/Sie Ambiguity -- "sie" (they) vs "Sie" (formal you)
**What goes wrong:** Lowercased "sie" is 3rd-person-plural, not formal address. Counting all "sie" tokens as Sie-formal produces wrong majority votes.
**Why it happens:** Tokenizer lowercases everything; capitalization lost.
**How to avoid:** Use `token.display` (original casing) for Sie detection. `Sie` at sentence start is ambiguous -- skip it unless mid-sentence. `du` is always informal. For verb forms, `du`-conjugated verbs (2nd person singular: `-st` suffix) are unambiguous informal markers; `Sie`-conjugated verbs use 3rd-person-plural forms and need the capitalized pronoun nearby.
**Warning signs:** Gate test with "Sie kommen. Sie gehen." (all formal) should NOT flag.

### Pitfall 2: FR tu/vous -- "vous" as Polite Singular vs Plural
**What goes wrong:** "vous" can be plural-informal (speaking to multiple people) or singular-formal.
**Why it happens:** French uses "vous" for both.
**How to avoid:** For student text at A1-B1, treat `tu` as informal and `vous` as formal. This is the standard pedagogical framing. The plural-vs-polite distinction is a v3.0 concern if it matters at all.
**Warning signs:** Test with a letter addressing one person using only "vous" throughout -- should NOT flag.

### Pitfall 3: NB bokmal/riksmal -- Conservative Form Identification
**What goes wrong:** Many forms are valid in both bokmal and riksmal (e.g., "har", "er", "og"). Flagging common words causes storms.
**Why it happens:** Riksmal and bokmal share 95%+ of vocabulary. Only specific morphological forms differ.
**How to avoid:** The BOKMAL_RIKSMAL_MAP must be HIGH-PRECISION pairs only. Key riksmal markers: definite noun forms `-en` where bokmal uses `-a` (fem nouns: `boken` vs `boka`, `gaten` vs `gata`), `efter` (riksmal) vs `etter` (bokmal), `sne` (riksmal) vs `sno` (bokmal), `nu` vs `na`.
**Warning signs:** NB-only text with no riksmal forms should produce zero findings.

### Pitfall 4: NN a-/e-infinitiv -- Data-Driven Not Regex-Driven
**What goes wrong:** Using `/-a$/` regex to classify infinitives catches non-infinitive words ending in `-a` (nouns, adjectives).
**Why it happens:** NN has many word classes ending in `-a`.
**How to avoid:** Only classify tokens that appear in `vocab.verbInfinitive` (known verb forms). For tokens not in the infinitive index, skip classification. The NN vocab data stores dual forms: `["a akseptera", "a akseptere"]` -- build a Map at rule-init time from the vocab data.
**Warning signs:** "ei god bok" should not trigger infinitive drift.

### Pitfall 5: Threshold Too Low on Short Texts
**What goes wrong:** With minimum 3 markers, a 2-sentence text like "Du bist nett. Sie sind freundlich." has exactly 2+2=4 markers and flags the minority pair. But this might be intentional (quoting someone).
**Why it happens:** Minimum-3 is correct for "enough evidence to detect", but very short texts with balanced registers are ambiguous.
**How to avoid:** The minimum-3 threshold on total markers is fine per CONTEXT.md decision. The majority must be >50% (strict majority, not plurality). If exactly tied (2 du + 2 Sie), do NOT flag -- no clear dominant register.

### Pitfall 6: Interaction with Quotation Suppression
**What goes wrong:** A quoted passage in a different register ("Han sa: 'Kan du komme?'") inside a formal Sie-document should not count as drift.
**Why it happens:** The quotation-suppression pre-pass populates `ctx.suppressedFor.structural`.
**How to avoid:** Document-drift rules must check `ctx.suppressedFor.structural` and skip suppressed token indices when collecting markers. This is consistent with how existing structural rules (priority 60+) already work.

## Code Examples

### DE du/Sie Marker Collection (DOC-01)
```javascript
// Source: Verified against de.json verb conjugation structure + de-grammar.js patterns
function collectDEAddressMarkers(ctx) {
  const markers = [];
  const suppStruct = ctx.suppressedFor?.structural;
  for (let i = 0; i < ctx.tokens.length; i++) {
    if (suppStruct && suppStruct.has(i)) continue;
    const tok = ctx.tokens[i];
    const w = tok.word;           // lowercased
    const d = tok.display;        // original case
    // "du" is always informal
    if (w === 'du') {
      markers.push({ register: 'informal', tokenIndex: i, start: tok.start, end: tok.end, display: d });
      continue;
    }
    // "Sie" mid-sentence (capitalized, not sentence-start) = formal
    // Sentence-start "Sie" is ambiguous -- skip
    if (d === 'Sie' && tok.start > 0) {
      // Check if sentence-start
      const isSentenceStart = ctx.sentences.some(s => 
        tok.start === s.start || tok.start === s.start + ctx.text.slice(s.start).search(/\S/)
      );
      if (!isSentenceStart) {
        markers.push({ register: 'formal', tokenIndex: i, start: tok.start, end: tok.end, display: d });
      }
    }
    // du-conjugated verb markers: 2sg forms ending in -st (hast, bist, kommst)
    if (w.endsWith('st') && w.length > 3 && ctx.vocab.knownPresens?.has(w)) {
      markers.push({ register: 'informal', tokenIndex: i, start: tok.start, end: tok.end, display: d });
    }
  }
  return markers;
}
```

### BOKMAL_RIKSMAL_MAP Shape (DOC-03)
```javascript
// Source: Research into Norwegian orthographic standards
// Key: riksmal form, Value: bokmal equivalent
// These are HIGH-CONFIDENCE pairs only -- forms that unambiguously signal riksmal
const BOKMAL_RIKSMAL_MAP = new Map([
  // Temporal/spatial
  ['efter', 'etter'],   // riksmal spelling
  ['nu', 'na'],         // "now"
  ['sne', 'sno'],       // "snow"
  // Definite feminine nouns: riksmal uses -en, bokmal uses -a
  // These are the canonical examples from the roadmap success criteria
  ['boken', 'boka'],    // "the book" (fem)
  ['gaten', 'gata'],    // "the street" (fem)
  ['jenten', 'jenta'],  // "the girl" (fem)
  ['klokken', 'klokka'],// "the clock" (fem)
  ['solen', 'sola'],    // "the sun" (fem)
  ['doren', 'dora'],    // "the door" (fem)
  // Verb forms
  ['fandt', 'fant'],    // "found"
  ['sagde', 'sa'],      // "said"
  // Note: This is a curated starter set. The map can grow
  // incrementally without changing rule logic.
]);

// Reverse map for NN (not needed -- DOC-03 is NB-only)
```

**Important caveat for BOKMAL_RIKSMAL_MAP:** Some entries like `boken` are ambiguous -- `boken` is a valid riksmal definite form of `bok` (feminine), but `boken` could also appear as a masculine definite form in some conservative NB usage. The data shows NB has `bestemt.entall: ["boka", "boken"]` for `bok`, meaning BOTH are valid NB. The drift rule flags `boken` only when the document predominantly uses `-a` forms and `boken` is the minority. This is the minority-flagging design doing its job correctly.

### NN a-/e-Infinitiv Marker Collection (DOC-04)
```javascript
// Source: Verified against nn.json verbbank structure
// nn.json stores dual infinitives: ["a akseptera", "a akseptere"]
// 341 of 631 NN verbs have both forms in the data
function buildNNInfinitiveMap(vocab) {
  // Map: lowercase form (without "a ") -> 'a' | 'e'
  const infMap = new Map();
  // vocab.verbInfinitive maps conjugated form -> infinitive
  // We need the reverse: which infinitive forms exist and their class
  // Build from raw data at rule init (not per-call)
  return infMap;
}

function collectNNInfinitiveMarkers(ctx, infMap) {
  const markers = [];
  const suppStruct = ctx.suppressedFor?.structural;
  for (let i = 0; i < ctx.tokens.length; i++) {
    if (suppStruct && suppStruct.has(i)) continue;
    const tok = ctx.tokens[i];
    const cls = infMap.get(tok.word); // 'a' or 'e' or undefined
    if (cls) {
      markers.push({
        register: cls === 'a' ? 'a-infinitiv' : 'e-infinitiv',
        tokenIndex: i,
        start: tok.start, end: tok.end, display: tok.display,
      });
    }
  }
  return markers;
}
```

### Pass-1 Overlap Avoidance
```javascript
// Inside checkDocument: build a set of already-flagged spans
function alreadyFlagged(findings, start, end) {
  return findings.some(f => !(end <= f.start || start >= f.end));
}
// When building drift findings, skip if pass-1 already has a finding at that span
for (const m of minority) {
  if (alreadyFlagged(findings, m.start, m.end)) continue;
  // ... emit finding
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-pass token-level only | Two-pass: token + document post-pass | Phase 13 (now) | Enables whole-document consistency checks |
| de-grammar du/Sie as grammar error | de-grammar (adjacent pair) + doc-drift (whole doc) | Phase 13 (now) | Complementary: grammar error vs consistency error |
| CROSS_DIALECT_MAP (NB<->NN) | CROSS_DIALECT_MAP + BOKMAL_RIKSMAL_MAP (within NB) | Phase 13 (now) | Separate concerns: cross-standard vs within-standard |

## Release Gate: check-stateful-rule-invalidation (INFRA-10)

### Gate Design

The gate validates the "no ghost flags" property by simulating edit sequences in Node:

1. **Load** spell-check-core.js + all rule files + vocab data
2. **Run** `check(text1, vocab, {lang})` on a text with register drift -- assert findings exist
3. **Mutate** the text to remove drift (e.g., replace all minority tokens with dominant form)
4. **Run** `check(text2, vocab, {lang})` on the fixed text -- assert zero drift findings
5. **Mutate** again to restore drift -- assert findings return
6. Repeat for all 4 rules (DE, FR, NB, NN)

This proves: same text = same findings; changed text = changed findings; no ghost state.

### Self-Test Pattern

Following the `check-governance-data.test.js` pattern:
1. Run gate on current repo (should pass -- rules don't exist yet, or produce valid results)
2. Plant a broken rule (e.g., one that caches markers in module-level state and returns stale findings)
3. Assert gate fires (exit 1)
4. Plant a well-formed rule
5. Assert gate passes (exit 0)

### npm Script Registration
```json
{
  "check-stateful-rule-invalidation": "node scripts/check-stateful-rule-invalidation.js",
  "check-stateful-rule-invalidation:test": "node scripts/check-stateful-rule-invalidation.test.js"
}
```

## Integration Checklist

All new files require entries in:

| Integration Point | Files to Add |
|-------------------|-------------|
| `extension/manifest.json` content_scripts.js | 4 rule files (after grammar-tables.js, before spell-check.js) |
| `scripts/check-explain-contract.js` TARGETS | 4 rule file paths |
| `scripts/check-rule-css-wiring.js` TARGETS | 4 rule file paths |
| `extension/styles/content.css` | 4 `.lh-spell-<ruleId>` selectors with dot colours |
| `benchmark-texts/expectations.json` | Drift-specific benchmark entries |
| `package.json` scripts | 2 new scripts (gate + self-test) |

### CSS Dot Colours

Document-drift rules are `severity: 'warning'` (P2 amber tier). Use the existing amber palette or a distinct purple for document-level concerns. Recommend amber to match other warning-tier rules.

## Marker Strategy Deep Dive

### DOC-01: DE du/Sie Address Markers (Confidence: HIGH)

**Pronoun markers (unambiguous):**
- `du` (display: any case) -> informal
- `Sie` (display: capital S, NOT sentence-start) -> formal
- `Ihnen` (formal dative) -> formal
- `Ihr`/`Ihre`/`Ihrem`/`Ihren` (formal possessive, capital I mid-sentence) -> formal
- `dein`/`deine`/`deinem`/`deinen`/`deiner` -> informal
- `dir` (informal dative) -> informal
- `dich` (informal accusative) -> informal

**Verb markers (high confidence):**
- 2sg `-st` forms when in `knownPresens`: `hast`, `bist`, `kommst` -> informal
- These are unambiguous -- no other person uses `-st`

**Skip:** `sie` lowercase (3rd person plural/feminine, not formal). `Sie` at sentence start (ambiguous with `sie`).

### DOC-02: FR tu/vous Address Markers (Confidence: HIGH)

**Pronoun markers:**
- `tu` -> informal
- `vous` -> formal (pedagogical simplification for A1-B1)
- `te`/`t'`/`toi` -> informal
- `ton`/`ta`/`tes` -> informal possessive
- `votre`/`vos` -> formal possessive

**Verb markers:**
- FR conjugation data uses `tu` and `vous` keys directly
- 2sg forms (index 1 in conjugation arrays) -> informal
- 2pl/formal forms (index 4 in arrays) -> formal
- Can build a Set of tu-forms and vous-forms from vocab at init time

### DOC-03: NB Bokmal/Riksmal Markers (Confidence: MEDIUM)

**High-confidence riksmal markers** (forms that unambiguously signal riksmal when bokmal `-a` forms exist in the same noun paradigm):

Lexical:
- `efter` (riksmal) vs `etter` (bokmal)
- `sne` (riksmal) vs `sno` (bokmal)  
- `nu` (riksmal) vs `na` (bokmal)

Morphological (definite feminine `-en` where bokmal uses `-a`):
- The NB data shows feminine nouns with `bestemt.entall` as arrays: `["boka", "boken"]`
- Both forms are technically valid in current official NB orthography (Sprakradet allows both)
- The drift rule flags MIXING, not individual forms -- writing all `-en` is fine, writing all `-a` is fine, mixing is the error
- This is the key insight: the rule is about consistency, not correctness

**Data approach:** Scan NB nounbank for feminine nouns where `bestemt.entall` is an array with both `-a` and `-en` forms. Build the BOKMAL_RIKSMAL_MAP from this programmatically, plus the curated lexical pairs above.

### DOC-04: NN a-/e-Infinitiv Markers (Confidence: HIGH)

**Data source:** NN verbbank stores dual infinitives as arrays: `["a akseptera", "a akseptere"]`. 341 of 631 verbs have both forms.

**Marker identification:**
- Strip `"a "` prefix from infinitive forms
- For each verb with dual forms, the `-a` variant signals a-infinitiv, the `-e` variant signals e-infinitiv
- Build a Map: `akseptera -> 'a'`, `akseptere -> 'e'`
- Only tokens found in this map are classified -- avoids false positives on non-verb words

**Important:** Verbs with only one infinitive form (290 of 631) are register-neutral and should not be counted as markers.

## Performance Considerations

- Document rules run every check cycle (same debounce as token-level)
- Typical student text: 50-500 words. Marker collection is O(n) per rule.
- 4 document rules x O(n) scanning = negligible overhead
- The `detectDrift` helper is O(m) where m = markers (typically <<n)
- No optimization needed for this workload. The "fresh recompute" approach is fine.

## Open Questions

1. **BOKMAL_RIKSMAL_MAP completeness**
   - What we know: The roadmap names `boken`, `efter`, `sne` as canonical riksmal markers. NB data has feminine nouns with dual forms.
   - What's unclear: Exact size of the initial curated map. Should it be data-derived (scan nounbank at init) or hand-curated?
   - Recommendation: Hand-curate a starter set of ~15-20 high-confidence pairs (the lexical ones + the most common feminine nouns). This can grow incrementally. Data-derived scanning risks including ambiguous forms.

2. **DE Sie sentence-start disambiguation**
   - What we know: `Sie` at sentence start is ambiguous between formal-you and they.
   - What's unclear: How much accuracy loss from skipping sentence-start `Sie`.
   - Recommendation: Skip sentence-start `Sie` (conservative). The `-st` verb forms and mid-sentence `du`/`Sie` provide enough signal for majority-vote.

## Sources

### Primary (HIGH confidence)
- `extension/content/spell-check-core.js` -- current runner architecture, dedupeOverlapping, ctx shape
- `extension/content/spell-rules/grammar-tables.js` -- shared table pattern, export shape
- `extension/content/spell-rules/nb-dialect-mix.js` -- CROSS_DIALECT_MAP pattern to mirror
- `extension/content/spell-rules/de-grammar.js` -- existing du/Sie adjacent-window detection
- `extension/content/spell-rules/register.js` -- existing register detection pattern (Phase 6)
- `extension/data/nn.json` -- verified dual infinitive arrays (341/631 verbs)
- `extension/data/nb.json` -- verified dual definite forms for feminine nouns
- `extension/data/de.json` -- verified conjugation keys (du, sie/Sie)
- `extension/data/fr.json` -- verified conjugation keys (tu, vous)
- `scripts/check-governance-data.test.js` -- self-test pattern reference
- `extension/manifest.json` -- content_scripts entry order

### Secondary (MEDIUM confidence)
- BOKMAL_RIKSMAL_MAP form pairs -- based on standard Norwegian orthographic knowledge; needs validation against broader NB corpus

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- extending existing architecture with minimal new code
- Architecture (two-pass runner): HIGH -- 15-line addition to well-understood runner, fresh-recompute eliminates invalidation complexity
- DE/FR marker strategy: HIGH -- pronoun identification is closed-set, verb forms derivable from vocab data
- NB riksmal markers: MEDIUM -- curated map needs validation; the dual-form noun data is verified but completeness of the starter set is uncertain
- NN infinitive markers: HIGH -- vocab data already stores both forms explicitly
- Release gate: HIGH -- follows established self-test pattern

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable domain, no external dependencies)
