# Phase 8: DE Case & Agreement Governance - Research

**Researched:** 2026-04-25
**Domain:** German grammar governance rules (preposition case, separable verbs, perfekt auxiliary, compound-noun gender) + shared grammar-tables primitive
**Confidence:** HIGH

## Summary

Phase 8 delivers four German structural rules and a shared `grammar-tables.js` file consumed by later phases. The existing codebase provides strong infrastructure: Phase 7's tagged-token view (`ctx.getTagged(i)` with `isFinite`, `isSubordinator`, `isSubject`), Phase 6's sentence segmenter (`ctx.sentences`), and the spell-rules plugin registry (`self.__lexiSpellRules`). All four rules are data-driven — the bundled `de.json` already contains the critical fields (`auxiliary` on 679 verbs, `separable: true` + `separablePrefix` on 19 verbs, `genus` on 1641 nouns, `cases` with nominativ/akkusativ/dativ/genitiv forms on 331 nouns).

The main data gap is preposition-case governance: the 22 German prepositions in `de.json` (`generalbank`, `type: "prep"`) carry no `governedCase` field. This data must be hardcoded in `grammar-tables.js` as a closed-set table (prepositions × required case), which is the correct approach per the project philosophy: preposition-case governance is a closed linguistic set (~30 entries), not an open vocabulary list, so it belongs in rule-side constants rather than the Papertek API.

**Primary recommendation:** Ship `grammar-tables.js` first as a shared data primitive (Plan 1), then the four DE rules in 2-3 subsequent plans. Keep the preposition-case table, auxiliary-choice sets, and separable-prefix list as inline constants in `grammar-tables.js`; the compound-gender rule reads `nounGenus` from the existing seam.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DE-01 | DE preposition-case governance — flag article-form mismatch after case-governing prep | Preposition-case table must be hardcoded (22 preps, closed set); `cases` data on 331 nouns provides article-form lookup for nominativ/akkusativ/dativ/genitiv; adjacent-article-only scope limits FP risk |
| DE-02 | DE separable-verb split — flag unsplit separable verb in main clause | 19 separable verbs with `separable: true` + `separablePrefix` fields; Phase 7's `de-v2.js` already has `SEPARABLE_PREFIXES` list and `isFiniteOrUnseparated()` helper to reuse; main-clause detection via `isMainClause()` in core |
| DE-03 | DE perfekt auxiliary choice — flag haben with sein-verb (or vice versa) | 42 sein-verbs, 631 haben-verbs, 6 both-verbs in `conjugations.perfektum.auxiliary`; need to build a lookup index; perfektum participle forms already in `knownPresens`/`knownPreteritum` pipeline |
| DE-04 | DE compound-noun gender — infer gender from final component via longest-suffix split | 1641 nouns with `genus` in `nounGenus` Map; `compoundNouns` Set already populated; greedy longest-suffix split against nounbank is algorithmic, no new data needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (IIFE) | ES2020 | Rule files + grammar-tables | Project convention: no npm deps for extension rules; SC-06 offline-only |
| `Intl.Segmenter` | Built-in | Sentence boundaries | Already wired in `spell-check-core.js` since Phase 6 |
| Existing tagged-token view | Phase 7 | POS classification, finite-verb detection | `ctx.getTagged(i)` provides `isFinite`, `pos`, `isSubordinator` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `check-fixtures` runner | Phase 1+ | Regression testing | Every plan commit; validates new DE fixture files |
| `check-explain-contract` | Phase 5 | Explain contract validation | New rules must have `explain: (finding) => ({nb, nn})` callable |
| `check-rule-css-wiring` | Phase 05.1 | CSS dot-colour binding | New rule IDs need `.lh-spell-{id}` in `content.css` |
| `check-benchmark-coverage` | Phase 6 | Benchmark flip-rate | New `expectations.json` entries for DE benchmark lines |
| `check-network-silence` | Phase 3 | Offline guarantee | All new `.js` files scanned automatically |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded prep-case table | Papertek API `governedCase` field | Preposition case is a closed linguistic set (~30 entries); adding API fields for this creates cross-app schema change for minimal benefit; hardcoded table is correct here |
| Building participle→infinitive index from scratch | Extending existing `verbInfinitive` Map | Current `verbInfinitive` maps conjugated forms to infinitive; need a separate `participleToVerb` index for perfektum auxiliary checking |

## Architecture Patterns

### Recommended File Structure
```
extension/content/
├── spell-rules/
│   ├── grammar-tables.js          # NEW: shared data primitive (Plan 1)
│   ├── de-prep-case.js            # NEW: DE-01 preposition-case rule
│   ├── de-separable-verb.js       # NEW: DE-02 separable-verb-split rule
│   ├── de-perfekt-aux.js          # NEW: DE-03 perfekt auxiliary rule
│   ├── de-compound-gender.js      # NEW: DE-04 compound-noun gender rule
│   ├── de-v2.js                   # Existing (Phase 7)
│   ├── de-verb-final.js           # Existing (Phase 7)
│   ├── de-gender.js               # Existing (Phase 5)
│   └── ...
├── spell-check-core.js            # Existing runner (may need minor extension)
└── vocab-seam-core.js             # Existing seam (may need new indexes)
```

### Pattern 1: grammar-tables.js as Shared Data Primitive
**What:** A single IIFE file that exports closed-set linguistic tables onto `self.__lexiGrammarTables`. Each table is a plain JS object/Map/Set with a documented shape. Rules import tables by reading `host.__lexiGrammarTables.{tableName}`.
**When to use:** Any rule that needs a closed-set linguistic table (preposition-case, trigger phrases, BAGS adjective list, DR MRS VANDERTRAMP set, etc.)
**Example:**
```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  
  // Preposition → required case(s)
  // 'acc' = accusative only, 'dat' = dative only, 'acc/dat' = two-way (warn only)
  const PREP_CASE = {
    'durch': 'acc', 'für': 'acc', 'gegen': 'acc', 'ohne': 'acc', 'um': 'acc',
    'aus': 'dat', 'bei': 'dat', 'mit': 'dat', 'nach': 'dat', 'seit': 'dat', 'von': 'dat', 'zu': 'dat',
    'an': 'acc/dat', 'auf': 'acc/dat', 'hinter': 'acc/dat', 'in': 'acc/dat',
    'neben': 'acc/dat', 'über': 'acc/dat', 'unter': 'acc/dat', 'vor': 'acc/dat', 'zwischen': 'acc/dat',
    'wegen': 'gen',  // standard; colloquial dat tolerated → warn-only
  };
  
  // Article form → case mapping (for mismatch detection)
  const ARTICLE_CASE = { /* ... */ };
  
  host.__lexiGrammarTables = { PREP_CASE, ARTICLE_CASE, /* ... */ };
  if (typeof module !== 'undefined') module.exports = host.__lexiGrammarTables;
})();
```

### Pattern 2: Adjacent-Article Scope for Preposition-Case Rule (DE-01)
**What:** Scan window is `prep [adj]? article noun` — max 3 tokens after preposition. Only flag when the article form is unambiguously wrong for the required case.
**When to use:** DE-01 rule.
**Why adjacent-only:** The success criteria explicitly says "adjacent-article scope only" and precision ≥0.90. Wider scopes (looking past multiple adjectives, relative clauses) dramatically increase FP risk. NB students make the simplest mistakes: wrong article form directly after a preposition.

### Pattern 3: Greedy Longest-Suffix Split for Compound-Gender (DE-04)
**What:** For a token not in `nounGenus`, try progressively shorter suffixes against `nounGenus` to find the final component. The final component's gender is the compound's gender.
**When to use:** DE-04 rule — "das Schultasche" where Tasche is feminine.
**Example:**
```javascript
function inferCompoundGender(word, nounGenus) {
  // Try from longest possible suffix down to 3-char minimum
  for (let i = 1; i < word.length - 2; i++) {
    const suffix = word.slice(i).toLowerCase();
    if (nounGenus.has(suffix)) return nounGenus.get(suffix);
  }
  return null;
}
```

### Pattern 4: Perfektum Context Detection for DE-03
**What:** Detect `haben/sein + ... + past-participle` patterns. German past participles typically start with `ge-` (gegangen, gemacht, gesehen) or have the `ge-` infix for separable verbs (aufgestanden, angefangen). The rule checks: (a) is the auxiliary `haben` or `sein`? (b) is there a past participle nearby? (c) does the verb require the other auxiliary?
**When to use:** DE-03 rule.
**Data:** The `conjugations.perfektum.auxiliary` field on each verb entry tells us which auxiliary is correct. Need a new lookup index: `participleToAux` mapping past-participle form to required auxiliary.

### Anti-Patterns to Avoid
- **Don't scan beyond adjacent window for DE-01:** The benchmark precision gate is ≥0.90. Wider scopes with prepositional phrases spanning subclauses will produce false positives. Stick to `prep [adj]? article [adj]? noun` window.
- **Don't hardcode participle forms:** Build them from the existing `conjugations.perfektum.participle` field in de.json — 679 verbs already have this data.
- **Don't duplicate separable-prefix logic:** Phase 7's `de-v2.js` already has `SEPARABLE_PREFIXES` and `isFiniteOrUnseparated()`. Move the prefix list to `grammar-tables.js` and import from both rules.
- **Don't flag two-way prepositions as errors:** `an/auf/in/...` take accusative OR dative depending on motion vs. location. Flag at warn severity only, or skip entirely for two-way preps in the first version. The success criteria says "two-way preps warn only."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence boundaries | Custom regex splitter | `ctx.sentences` (Phase 6 `Intl.Segmenter`) | Already wired; handles German compound sentences correctly |
| Finite-verb detection | New verb-conjugation parser | `ctx.getTagged(i).isFinite` (Phase 7) | Already builds from `knownPresens` + `knownPreteritum` + `_finiteStems` |
| Main vs subordinate clause | New clause parser | `isMainClause()` in `spell-check-core.js` | Already handles German subordinators |
| Noun gender lookup | New nounbank parser | `vocab.nounGenus` Map (existing seam) | 1641 DE nouns already indexed |
| Article-case form tables | API data field | Hardcoded table in `grammar-tables.js` | Closed linguistic set; 36 forms (3 genders × 4 cases × 3 definiteness) |

**Key insight:** Almost all infrastructure exists from Phases 6-7. Phase 8 is primarily about writing 4 new rule files + 1 shared data file, building 2-3 new lookup indexes in vocab-seam-core, and adding fixtures + benchmark expectations.

## Common Pitfalls

### Pitfall 1: Article Ambiguity in Case Detection
**What goes wrong:** Many German articles are ambiguous across cases. "der" can be masculine nominative OR feminine dative OR genitive plural. "die" can be feminine nominative/accusative OR plural for all genders.
**Why it happens:** German article system has massive overlap across the 4×3 grid.
**How to avoid:** Only flag when the article form is *unambiguously wrong*. For example, after `mit` (dative): `den` is accusative masculine — unambiguously wrong. But `der` could be dative feminine — might be correct. Build an explicit `ARTICLE_TO_POSSIBLE_CASES` table and only flag when the required case has zero overlap with the article's possible cases.
**Warning signs:** False positives on correct dative feminine constructions like "mit der Schule" — the current `de-gender.js` already has a `DATIVE_PREPS` guard for exactly this reason.

### Pitfall 2: Separable-Verb False Positives in Subordinate Clauses
**What goes wrong:** In subordinate clauses, separable verbs STAY unsplit: "dass ich aufstehe" is CORRECT. Only main clauses require splitting: "ich stehe auf."
**Why it happens:** Rule fires on unsplit form without checking clause type.
**How to avoid:** Check `isMainClause(ctx, range.start, range.end)` before flagging. The infrastructure already exists.
**Warning signs:** Fixture acceptance cases like `dass ich aufstehe` flagging.

### Pitfall 3: Compound-Gender Overfiring on Short Suffixes
**What goes wrong:** The greedy suffix split matches very short words that happen to be in nounbank. "Bundesland" → tries "land" (correct, n) but also matches "and" if that existed.
**Why it happens:** Short suffixes are more likely to collide with unrelated words.
**How to avoid:** Set a minimum suffix length (3-4 chars) and only fire when: (a) the token has an article before it, (b) the inferred gender disagrees with the article, and (c) the token is NOT already in nounGenus (i.e., it's a compound not in the dictionary).
**Warning signs:** Flagging on words that happen to end in common short nouns.

### Pitfall 4: Perfektum Auxiliary with "both" Verbs
**What goes wrong:** 6 verbs (ausziehen, fahren, fliegen, laufen, schwimmen, wegfahren) accept BOTH haben and sein depending on whether the usage is transitive or intransitive.
**Why it happens:** "Ich bin gefahren" (intransitive, correct) and "Ich habe das Auto gefahren" (transitive, also correct).
**How to avoid:** Skip verbs with `auxiliary: "both"` entirely — do not flag either auxiliary for these verbs.
**Warning signs:** "Ich habe geschwommen" flagging as wrong when it's acceptable.

### Pitfall 5: Overlap with Existing de-gender.js Rule
**What goes wrong:** The new `de-prep-case.js` and `de-compound-gender.js` rules flag the same token span as the existing `de-gender.js` rule. `dedupeOverlapping` keeps only the first-registered finding.
**Why it happens:** Both rules look at article-noun pairs. The existing gender rule (priority 15) fires on nominative mismatches; the new prep-case rule (structural, priority ~68) fires on case mismatches after prepositions.
**How to avoid:** The priority system handles this: `de-gender.js` at priority 15 fires first for simple nominative gender mismatches. The new prep-case rule at priority 68 only fires when a preposition context is detected. If both fire on the same span, deduplication keeps the lower-priority (more specific) one. Ensure the prep-case rule checks `ctx.suppressed` and `ctx.suppressedFor.structural`. Also: the existing `de-gender.js` already has a `DATIVE_PREPS` guard that skips dative-feminine cases — this needs to be expanded or coordinated with the new rule.

### Pitfall 6: Benchmark Lines Need Adding to de.txt
**What goes wrong:** The success criteria reference patterns like "mit den Schule", "das Schultasche" but these exact strings may not exist in the current benchmark text.
**Why it happens:** The benchmark text (lines 32-46) has some of these patterns embedded but not all.
**How to avoid:** Check the benchmark text carefully. The actual patterns in de.txt are: "in eine fabrik" (line 36), "Dann ich aufstehe" (line 39), "auf einem insel" (line 41), "Wegen dem wetter" (line 45). "mit den Schule" and "das Schultasche" are NOT in the current text — they need to be added or the success criteria reference the comment section examples. Clarify with the roadmap: the success criteria likely expects adding new benchmark lines.

### Pitfall 7: vocab-seam-core Index Building for Participles
**What goes wrong:** The current `buildLookupIndexes` does not build a participle-to-verb or participle-to-auxiliary mapping. Adding it requires touching `vocab-seam-core.js` AND updating `check-spellcheck-features` if it adds a new accessor.
**Why it happens:** Phase 7 only needed `knownPresens`/`knownPreteritum` for finite-verb detection; perfektum participles were not indexed.
**How to avoid:** Add `participleToAux` (or `participleInfo`) Map to `buildLookupIndexes`, expose via `VOCAB.getParticipleToAux()` getter in `vocab-seam.js`, and add the adapter-contract regression guard in `check-fixtures.js`. Follow the SC-01/SC-03 paired-guard pattern exactly.

## Code Examples

### DE Article-to-Case Mapping Table
```javascript
// Definite articles: form → { gender, case[] }
// Some forms are ambiguous across cases.
const DEF_ARTICLE_CASE = {
  'der': [
    { genus: 'm', case: 'nominativ' },
    { genus: 'f', case: 'dativ' },
    { genus: 'f', case: 'genitiv' },   // rarely used by A1-B1 students
  ],
  'die': [
    { genus: 'f', case: 'nominativ' },
    { genus: 'f', case: 'akkusativ' },
    { genus: 'pl', case: 'nominativ' },
    { genus: 'pl', case: 'akkusativ' },
  ],
  'das': [
    { genus: 'n', case: 'nominativ' },
    { genus: 'n', case: 'akkusativ' },
  ],
  'den': [
    { genus: 'm', case: 'akkusativ' },
    { genus: 'pl', case: 'dativ' },
  ],
  'dem': [
    { genus: 'm', case: 'dativ' },
    { genus: 'n', case: 'dativ' },
  ],
  'des': [
    { genus: 'm', case: 'genitiv' },
    { genus: 'n', case: 'genitiv' },
  ],
};

// Indefinite articles: form → { gender, case[] }
const INDEF_ARTICLE_CASE = {
  'ein': [
    { genus: 'm', case: 'nominativ' },
    { genus: 'n', case: 'nominativ' },
    { genus: 'n', case: 'akkusativ' },
  ],
  'eine': [
    { genus: 'f', case: 'nominativ' },
    { genus: 'f', case: 'akkusativ' },
  ],
  'einen': [
    { genus: 'm', case: 'akkusativ' },
  ],
  'einem': [
    { genus: 'm', case: 'dativ' },
    { genus: 'n', case: 'dativ' },
  ],
  'einer': [
    { genus: 'f', case: 'dativ' },
    { genus: 'f', case: 'genitiv' },
  ],
  'eines': [
    { genus: 'm', case: 'genitiv' },
    { genus: 'n', case: 'genitiv' },
  ],
};
```

### Participle Index Building (vocab-seam-core.js extension)
```javascript
// Inside buildLookupIndexes, after the existing verbInfinitive population:
const participleToAux = new Map();  // 'gegangen' → 'sein', 'gemacht' → 'haben'

// This requires access to the raw de.json verbbank data, not just wordList.
// Option A: Build during buildWordList and attach to wordList entries.
// Option B: Build a separate index from raw data in buildIndexes().
// Option B is cleaner — add a new phase to buildIndexes:
//   for each verbbank entry with conjugations.perfektum:
//     participleToAux.set(participle.toLowerCase(), auxiliary)
```

### Separable-Verb Detection (reusing Phase 7 pattern)
```javascript
// In grammar-tables.js:
const SEPARABLE_PREFIXES = new Set([
  'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'her', 'hin',
  'los', 'mit', 'nach', 'um', 'vor', 'weg', 'zu', 'zurück',
  'zusammen', 'weiter', 'vorbei', 'herum', 'heraus', 'hinaus',
]);

// In de-separable-verb.js check():
// 1. Find token that matches a known separable verb's unsplit form
//    (e.g. "aufstehe" = prefix "auf" + stem "stehe")
// 2. Verify it's in a main clause (not subordinate)
// 3. Verify the prefix doesn't appear separately later in the clause
// 4. Flag with suggestion to split
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A (no DE case rules existed) | Adjacent-article-scope preposition-case checking | Phase 8 (new) | Catches ~80% of student case errors with low FP |
| `de-gender.js` nominative-only | + prep-case + compound-gender | Phase 8 (new) | Extends gender checking from 1 case to 3 contexts |
| No separable-verb rule | Main-clause unsplit detection | Phase 8 (new) | Common NB-student error pattern now flagged |
| No auxiliary checking | Perfektum haben/sein validation | Phase 8 (new) | Another top-5 NB-student German error |

## Open Questions

1. **Benchmark text additions needed?**
   - What we know: Success criteria reference "mit den Schule" and "das Schultasche" but these exact patterns are NOT in current `de.txt`. The text DOES contain "in eine fabrik" (line 36), "auf einem insel" (line 41), "Wegen dem wetter" (line 45), and "Dann ich aufstehe" (line 39).
   - What's unclear: Whether the planner should add new benchmark lines or whether the existing patterns are sufficient.
   - Recommendation: Add 2-3 new benchmark lines containing the missing patterns. The benchmark comment header already describes these as "FUTURE / UNPLANNED" targets. Update `expectations.json` for all DE Phase-8 patterns.

2. **Two-way preposition handling depth**
   - What we know: Two-way preps (an/auf/in/hinter/neben/über/unter/vor/zwischen) take ACC with motion and DAT with location. Detecting motion vs location requires semantic understanding beyond token-level.
   - What's unclear: Whether to flag two-way preps at all in Phase 8.
   - Recommendation: For two-way preps, only flag when the article form is unambiguously wrong for BOTH cases (e.g., genitive article after a two-way prep). Skip ambiguous cases entirely. This keeps precision high and avoids the semantic-detection problem.

3. **Coordination with existing de-gender.js DATIVE_PREPS guard**
   - What we know: The existing `de-gender.js` has a `DATIVE_PREPS` Set that suppresses nominative-gender findings after dative prepositions. The new prep-case rule will handle these same contexts.
   - What's unclear: Whether to remove the `DATIVE_PREPS` guard from `de-gender.js` now that a dedicated rule exists.
   - Recommendation: Keep the `DATIVE_PREPS` guard in `de-gender.js` as-is for now. The two rules operate at different priorities (15 vs ~68) and check different things (nominative gender mismatch vs case governance). They complement rather than conflict. The existing guard prevents FPs on correct dative constructions.

4. **New vocab-seam indexes needed**
   - What we know: DE-03 needs a `participleToAux` Map. DE-02 might need a `separableVerbs` index.
   - What's unclear: Whether to build these in vocab-seam-core or keep them rule-local.
   - Recommendation: Build `participleToAux` in `vocab-seam-core.js:buildLookupIndexes()` since it needs raw verbbank data. Separable-verb detection can stay rule-local using the prefix-stripping approach already proven in `de-v2.js`.

## Sources

### Primary (HIGH confidence)
- `extension/data/de.json` — direct inspection: 679 verbs with `auxiliary` field, 19 with `separable: true`, 1641 nouns with `genus`, 331 with `cases` declension data, 22 prepositions in `generalbank`
- `extension/content/spell-check-core.js` — direct inspection: tagged-token view, `findFiniteVerb`, `isMainClause`, `tokensInSentence`, `classifyPOS`, sentence segmenter, plugin registry runner
- `extension/content/vocab-seam-core.js` — direct inspection: `buildLookupIndexes` builds `nounGenus`, `verbInfinitive`, `validWords`, `isAdjective`, `knownPresens`, `knownPreteritum`, `verbForms`, `nounForms`, `typoFix`, `compoundNouns`
- `extension/content/spell-rules/de-v2.js` — direct inspection: `SEPARABLE_PREFIXES`, `isFiniteOrUnseparated()`, V2 detection pattern
- `extension/content/spell-rules/de-verb-final.js` — direct inspection: subordinate-clause verb-final detection, `DE_SUBORDINATORS`, `DE_MODALS`
- `extension/content/spell-rules/de-gender.js` — direct inspection: nominative article-noun gender mismatch, `DATIVE_PREPS` guard
- `benchmark-texts/de.txt` — direct inspection: 16-line prose paragraph with embedded errors
- `benchmark-texts/expectations.json` — direct inspection: current DE entries for `de-v2` and `de-verb-final` only

### Secondary (MEDIUM confidence)
- German grammar reference (training data): preposition-case governance rules, article declension tables, separable-verb rules, compound-noun gender rules — well-established linguistic facts, not implementation-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all infrastructure exists from Phases 6-7, just adding new rule files
- Architecture: HIGH — follows exactly the same IIFE-plugin-registry pattern proven across 34 existing rule files
- Pitfalls: HIGH — identified from direct code inspection and the existing `de-gender.js` DATIVE_PREPS precedent
- Data availability: HIGH — 679 auxiliary fields, 19 separable verbs, 1641 nouns with genus confirmed by direct JSON inspection

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable — no external dependencies, all data in bundled JSON)
