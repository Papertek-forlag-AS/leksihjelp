# Phase 9: ES ser/estar, por/para, Personal "a" - Research

**Researched:** 2026-04-25
**Domain:** Spanish structural grammar rules (copula choice, preposition semantics, personal "a" marker) + grammar-tables.js extension
**Confidence:** HIGH

## Summary

Phase 9 delivers three Spanish structural rules and extends `grammar-tables.js` with ES-specific trigger tables. The existing codebase provides strong infrastructure from Phases 6-8: sentence segmenter (`ctx.sentences`), tagged-token view (`ctx.getTagged(i)`), the spell-rules plugin registry, and `grammar-tables.js` as a shared data primitive. However, none of the three rules can be purely data-driven from the current vocabulary data -- each requires new hardcoded closed-set tables in `grammar-tables.js` because the Papertek API does not annotate adjectives with `copula: "ser"|"estar"|"both"`, nouns/pronouns with `human: true`, or prepositions with semantic trigger patterns.

The critical architectural insight is that all three rules share a common pattern: **closed-set lookup table + token-window scan**. ES-01 needs a copula-form-to-verb map + adjective-copula table (~30 adjectives). ES-02 needs a por/para trigger-pattern decision tree (~15 patterns). ES-03 needs a human-noun/pronoun set + transitive-verb recognition. All three tables belong in `grammar-tables.js` so Phase 11's subjuntivo rule can consume the same trigger-table shape without re-invention (success criterion 4).

**Primary recommendation:** Ship ES tables in `grammar-tables.js` first (Plan 1), then ES-01 ser/estar (Plan 2), then ES-02 por/para + ES-03 personal "a" together (Plan 3). Keep all trigger data as inline constants in `grammar-tables.js` -- these are closed linguistic sets, not open vocabulary lists.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ES-01 | ES ser vs estar flagged by predicate-adjective lookup (`copula: "ser"\|"estar"\|"both"`); benchmark `es.txt` "Soy cansado" | No `copula` field exists on any of the 373 ES adjectives in `adjectivebank`. Must hardcode a closed-set table of ~30 adjectives that require estar (cansado, enfermo, contento, muerto, etc.) in `grammar-tables.js`. Ser/estar conjugated forms (soy/estoy/es/está etc.) available in verbbank for form→verb reverse lookup. |
| ES-02 | ES por vs para flagged via ~15 trigger-pattern decision tree (duration, deadline, cause, purpose); warn severity; benchmark `es.txt` "para comprar comida por mi familia" | `por` and `para` exist in generalbank (por_prep, para_prep, por_adv). No semantic annotation. Must hardcode ~15 trigger patterns as a decision tree in `grammar-tables.js`. Warn-only severity matches Phase 8's two-way preposition precedent. |
| ES-03 | ES personal "a" flagged when transitive verb + bare human direct object (`human: true`); benchmark `es.txt` "Veo Juan" | Zero nouns have `human: true` flag (0/1545). Zero pronouns have it (0/46). No `transitive` flag on any verb (0/624). Must hardcode: (1) proper-noun heuristic (capitalized non-sentence-start = human), (2) closed human-noun set (~20 entries: madre, padre, hermano, profesor, amigo, etc.), (3) transitive-verb conjugation form→verb reverse lookup from existing conjugation data. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (IIFE) | ES2020 | Rule files + grammar-tables extension | Project convention: no npm deps for extension rules; SC-06 offline-only |
| `Intl.Segmenter` | Built-in | Sentence boundaries | Already wired in `spell-check-core.js` since Phase 6 |
| Existing tagged-token view | Phase 7 | POS classification, finite-verb detection | `ctx.getTagged(i)` provides `isFinite`, `pos`, `isSubordinator` |
| `grammar-tables.js` | Phase 8 | Shared data primitive | Already exports onto `self.__lexiGrammarTables`; Phase 9 adds ES tables alongside DE tables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `check-fixtures` runner | Phase 1+ | Regression testing | Every plan commit; validates new ES fixture files |
| `check-explain-contract` | Phase 5 | Explain contract validation | New rules must have `explain: (finding) => ({nb, nn})` callable |
| `check-rule-css-wiring` | Phase 05.1 | CSS dot-colour binding | New rule IDs need `.lh-spell-{id}` in `content.css` |
| `check-benchmark-coverage` | Phase 6 | Benchmark flip-rate | New `expectations.json` entries for ES benchmark lines |
| `check-network-silence` | Phase 3 | Offline guarantee | All new `.js` files scanned automatically |
| `check-governance-data` | Phase 6 | Governance bank shape | No changes needed -- ES tables live in `grammar-tables.js`, not governance banks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded copula table in grammar-tables.js | Papertek API `copula` field on adjectives | API change affects all consumers; ~30-entry closed set is cheaper to maintain inline; can backfill API later without changing rule logic |
| Hardcoded human-noun set | Papertek API `human: true` flag on nouns | Same reasoning -- ~20 core human nouns at A1-B1; backfill API later |
| Proper-noun heuristic for human detection | Full named-entity recognition | NER is overkill; mid-sentence capitalization in Spanish strongly signals proper noun (unlike German); `isLikelyProperNoun` already exists in spell-check-core.js |

## Architecture Patterns

### Recommended File Structure
```
extension/content/
├── spell-rules/
│   ├── grammar-tables.js          # EXTEND: add ES_COPULA_ADJ, ES_POR_PARA_TRIGGERS, ES_HUMAN_NOUNS
│   ├── es-ser-estar.js            # NEW: ES-01 ser/estar copula rule
│   ├── es-por-para.js             # NEW: ES-02 por/para preposition rule
│   ├── es-personal-a.js           # NEW: ES-03 personal "a" rule
fixtures/
├── es/
│   ├── ser-estar.jsonl            # NEW: ES-01 fixtures
│   ├── por-para.jsonl             # NEW: ES-02 fixtures
│   ├── personal-a.jsonl           # NEW: ES-03 fixtures
```

### Pattern 1: Copula-Form Reverse Lookup (ES-01)
**What:** Map conjugated ser/estar forms back to their infinitive to determine which copula the student used, then check the following adjective against the copula table.
**When to use:** Whenever a conjugated ser/estar form is followed by a predicate adjective within 1-2 tokens.
**Example:**
```javascript
// Lazy-init from grammar-tables.js at first check() call
const SER_FORMS = new Set(['soy', 'eres', 'es', 'somos', 'sois', 'son',
                           'era', 'eras', 'éramos', 'erais', 'eran',
                           'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron']);
const ESTAR_FORMS = new Set(['estoy', 'estás', 'está', 'estamos', 'estáis', 'están',
                              'estaba', 'estabas', 'estábamos', 'estabais', 'estaban',
                              'estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron']);

// Adjective → required copula
const COPULA_ADJ = {
  cansado: 'estar',    // tired (temporary state)
  enfermo: 'estar',    // sick
  contento: 'estar',   // happy (emotional state)
  muerto: 'estar',     // dead (resultant state)
  sentado: 'estar',    // seated
  nervioso: 'estar',   // nervous
  // ...~25 more
  alto: 'ser',         // tall (inherent quality)
  inteligente: 'ser',  // intelligent
  // ...
  aburrido: 'both',    // boring (ser) vs bored (estar)
  listo: 'both',       // clever (ser) vs ready (estar)
  // ...
};
```

### Pattern 2: Trigger-Pattern Decision Tree (ES-02)
**What:** Match por/para usage against ~15 trigger patterns based on the surrounding context (infinitive following, time expression, cause/purpose markers).
**When to use:** When `por` or `para` token is found, scan adjacent tokens for contextual clues.
**Key patterns:**
```javascript
const POR_PARA_TRIGGERS = [
  // Pattern: "para + infinitive + por + noun" → likely wrong, should be "para ... para"
  { pattern: 'para_inf_por_noun', wrongPrep: 'por', fix: 'para', context: 'purpose_beneficiary' },
  // Pattern: "por + infinitive" when purpose → should be "para"
  { pattern: 'por_inf_purpose', wrongPrep: 'por', fix: 'para', context: 'purpose' },
  // Pattern: "por + time_duration" → correct (durante)
  { pattern: 'por_duration', correct: 'por', context: 'duration' },
  // Pattern: "para + deadline" → correct (by/for)
  { pattern: 'para_deadline', correct: 'para', context: 'deadline' },
  // ...
];
```

### Pattern 3: Human-Object Detection (ES-03)
**What:** Detect transitive verb + bare human direct object (missing personal "a").
**When to use:** When a conjugated verb is followed directly by a capitalized word (proper noun heuristic) or a known human noun.
**Example:**
```javascript
// Scan: verb-token at position i, check i+1
// "Veo Juan" → flag, suggest "Veo a Juan"
// "Veo la casa" → no flag (casa is not human)
// "Veo a Juan" → no flag (already has "a")
```

### Anti-Patterns to Avoid
- **Over-flagging ser/estar on "both" adjectives:** Adjectives like `aburrido` (boring/bored), `listo` (clever/ready), `rico` (rich/tasty) change meaning with ser vs estar. These MUST be tagged `both` and skipped entirely to avoid false positives. The closed-set table is the only reliable approach.
- **Flagging por/para at hard-error severity:** Norwegian students' por/para errors are often subtle and context-dependent. Use warn severity (P2 amber dot) -- matches Phase 8's two-way preposition precedent.
- **Treating all capitalized words as human for personal "a":** City names, country names, and organization names are also capitalized. The personal "a" rule should only flag when the capitalized word is followed by a common human-context continuation OR is in the known human-noun set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ser/estar conjugated form recognition | Custom regex per tense | Exhaustive form sets from `es.json` verbbank (`ser_verb.conjugations`, `estar_verb.conjugations`) | The verbbank already has all forms; extract them at build time into the grammar table |
| Sentence boundaries | Custom period-splitting | `ctx.sentences` from `Intl.Segmenter` | Already wired since Phase 6; handles abbreviations, decimals |
| Proper noun detection | Capitalization regex | `isLikelyProperNoun()` from `spell-check-core.js` | Already handles sentence-start vs mid-sentence capitalization |
| Token POS classification | Custom part-of-speech tagging | `ctx.getTagged(i).pos` from Phase 7 | Already classifies verb/noun/adj/pron from vocab indexes |

**Key insight:** The infrastructure from Phases 6-8 (sentence segmenter, tagged tokens, grammar-tables primitive, isLikelyProperNoun) covers all structural needs. The only new work is the linguistic knowledge (which adjective needs which copula, which patterns distinguish por/para, which nouns are human).

## Common Pitfalls

### Pitfall 1: Ser/Estar "Both" Adjectives Causing False Positives
**What goes wrong:** Flagging `"Soy listo"` as wrong (should be estar) when it means "I am clever" (ser) -- a valid use.
**Why it happens:** ~15 Spanish adjectives change meaning with ser vs estar. Without the `both` tag, the rule picks one copula and flags the other.
**How to avoid:** The `COPULA_ADJ` table must have a `both` category. Any adjective tagged `both` is skipped entirely. Start with only clear-cut estar-only and ser-only adjectives.
**Warning signs:** Fixture acceptance tests for legitimate ser/estar usage failing.

### Pitfall 2: Personal "a" Flagging Non-Human Proper Nouns
**What goes wrong:** Flagging `"Visité Madrid"` (visited Madrid) as needing personal "a" when cities don't take it.
**Why it happens:** Both `Juan` and `Madrid` are capitalized mid-sentence proper nouns.
**How to avoid:** Two-layer filter: (1) the word must be in the known human-noun set OR be a capitalized word that is NOT in a known place-name blocklist, AND (2) the preceding word must be a conjugated transitive verb (not a preposition or article). Keep the human detection conservative -- false negatives are better than false positives for students.
**Warning signs:** Benchmark text contains place names that get incorrectly flagged.

### Pitfall 3: Por/Para Trigger Pattern Explosion
**What goes wrong:** Trying to cover all 20+ por/para distinctions leads to an unmaintainable and FP-prone rule.
**Why it happens:** The por/para distinction is one of the hardest areas of Spanish grammar; many uses are idiomatic.
**How to avoid:** Limit to ~15 high-confidence trigger patterns. The benchmark line "para comprar comida por mi familia" is a clear purpose-beneficiary confusion (por→para before family member). Focus on patterns with unambiguous contextual signals: (1) por + infinitive when purpose → para, (2) por + human beneficiary → para, (3) para + duration → por.
**Warning signs:** More than 2-3 false positives per page of student text.

### Pitfall 4: Accent-Stripped Form Matching
**What goes wrong:** Student writes `"esta cansado"` (missing accent on está) and the rule fails to recognize it as a copula form.
**Why it happens:** ES accent-guard rule fires at priority 15; copula rule fires at higher priority. Student text frequently lacks accents.
**How to avoid:** The copula form lookup sets should include accent-stripped variants: `esta` → estar, `estan` → estar, etc. OR the rule should normalize accents before lookup.
**Warning signs:** Benchmark lines with missing accents not being caught.

### Pitfall 5: grammar-tables.js Load-Order Race
**What goes wrong:** ES rule files read `host.__lexiGrammarTables` at IIFE time but grammar-tables.js hasn't loaded yet.
**Why it happens:** Node fixture runner loads files alphabetically; `es-*` comes after `grammar-tables.js` alphabetically, so it works. But if the file were renamed or a new entry point added, the race surfaces.
**How to avoid:** Use the lazy-init pattern from `de-prep-case.js`: read tables at first `check()` call, not at IIFE time. Phase 8 already established this pattern.
**Warning signs:** `getTables()` returns empty objects; rules silently produce zero findings.

### Pitfall 6: Subject Pronouns Not in SUBJECT_PRONOUNS Map
**What goes wrong:** `ctx.getTagged(i).isSubject` returns false for `yo`, `tú`, `él`, etc. because `spell-check-core.js` has no ES entry in `SUBJECT_PRONOUNS`.
**Why it happens:** SUBJECT_PRONOUNS currently has entries for nb, nn, de, fr but NOT es.
**How to avoid:** Add ES subject pronouns to `SUBJECT_PRONOUNS` in `spell-check-core.js` as part of Plan 1: `es: new Set(['yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'usted', 'ustedes'])`.
**Warning signs:** POS classification falls through to 'other' for Spanish subject pronouns.

## Code Examples

### Example 1: ES-01 Ser/Estar Check Loop
```javascript
check(ctx) {
  if (ctx.lang !== 'es') return [];
  if (!ctx.sentences || !tokensInSentence) return [];
  const { SER_FORMS, ESTAR_FORMS, COPULA_ADJ } = getTables();
  const findings = [];

  for (const sentence of ctx.sentences) {
    const range = tokensInSentence(ctx, sentence);
    for (let i = range.start; i < range.end; i++) {
      const w = ctx.tokens[i].word;
      const usedCopula = SER_FORMS.has(w) ? 'ser' : ESTAR_FORMS.has(w) ? 'estar' : null;
      if (!usedCopula) continue;

      // Scan next 1-2 tokens for a predicate adjective
      for (let j = i + 1; j < Math.min(i + 3, range.end); j++) {
        const adjWord = ctx.tokens[j].word;
        const requiredCopula = COPULA_ADJ[adjWord];
        if (!requiredCopula) continue;
        if (requiredCopula === 'both') break; // ambiguous — skip
        if (requiredCopula === usedCopula) break; // correct — skip

        // Wrong copula! Suggest the correct conjugated form.
        // ... (map person/tense from used form to correct copula's form)
        findings.push({ /* ... */ });
        break;
      }
    }
  }
  return findings;
}
```

### Example 2: ES-03 Personal "a" Detection
```javascript
check(ctx) {
  if (ctx.lang !== 'es') return [];
  const { ES_HUMAN_NOUNS } = getTables();
  const isAdj = ctx.vocab.isAdjective || new Set();
  const findings = [];

  for (let i = 0; i < ctx.tokens.length - 1; i++) {
    const t = ctx.tokens[i];
    const next = ctx.tokens[i + 1];

    // Skip if next token is "a" (personal "a" already present)
    if (next.word === 'a') continue;

    // Current token must be a conjugated verb
    const tagged = ctx.getTagged(i);
    if (!tagged.isFinite) continue;

    // Next token must be human: proper noun OR known human noun
    const isHumanNoun = ES_HUMAN_NOUNS.has(next.word);
    const isProperNoun = isLikelyProperNoun(next, i + 1, ctx.tokens, ctx.text);
    if (!isHumanNoun && !isProperNoun) continue;

    // Skip copula verbs (ser/estar/parecer) — they don't take personal "a"
    // Skip if preceded by preposition (not a direct object)
    findings.push({
      rule_id: 'es-personal-a',
      start: next.start,
      end: next.end,
      original: next.display,
      fix: 'a ' + next.display,
      message: 'Personal "a" mangler foran ' + next.display,
    });
  }
  return findings;
}
```

### Example 3: Grammar-Tables ES Extension Shape
```javascript
// In grammar-tables.js — the trigger-table shape Phase 11 reuses
const ES_COPULA_ADJ = {
  cansado: 'estar', enfermo: 'estar', contento: 'estar',
  // ...
  alto: 'ser', inteligente: 'ser',
  // ...
  aburrido: 'both', listo: 'both', rico: 'both',
};

// Phase 11 reuses this shape: trigger-word → required-form
// ES_SUBJUNCTIVE_TRIGGERS = { 'quiero': 'subjuntivo', 'espero': 'subjuntivo', ... }
// Same lookup pattern: closed-set map, token-scan, suggest correct form.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No ES structural rules | Token-level only (gender, muy/mucho, accent) | Phase 6-8 | ES-01/02/03 are the first ES structural rules |
| No grammar-tables for ES | DE-only tables in grammar-tables.js | Phase 8 | Must extend grammar-tables.js with ES tables |
| No ES subject pronouns in core | nb/nn/de/fr only | Phase 7 | Must add ES entry to SUBJECT_PRONOUNS |

## Data Gaps

### Gap 1: No `copula` field on ES adjectives
**Current state:** 373 adjectives in `adjectivebank`, none with `copula` annotation.
**Impact:** ES-01 must use a hardcoded table in grammar-tables.js.
**Future fix:** Add `copula: "ser"|"estar"|"both"` field to adjectives in papertek-vocabulary. Not blocking — the closed-set table is linguistically correct and maintainable at ~30-40 entries.

### Gap 2: No `human: true` flag on ES nouns/pronouns
**Current state:** 0/1545 nouns and 0/46 pronouns have the `human` flag.
**Impact:** ES-03 must use a hardcoded human-noun set + proper-noun heuristic.
**Future fix:** Add `human: true` to person-denoting nouns in papertek-vocabulary. The backfill is ~40-60 entries (professions, family members, social roles).

### Gap 3: No `transitive` flag on ES verbs
**Current state:** 0/624 verbs have any transitivity annotation.
**Impact:** ES-03 cannot distinguish transitive from intransitive verbs. Must use a conservative approach: any conjugated verb form that is NOT a copula (ser/estar/parecer) and NOT immediately preceded by a preposition is treated as potentially transitive.
**Mitigation:** False positives are controlled by the human-noun detection side, not the verb side. "Veo Juan" only flags because "Juan" is identified as human, not because "veo" is identified as transitive.

### Gap 4: ES subject pronouns missing from spell-check-core.js
**Current state:** `SUBJECT_PRONOUNS` has entries for nb, nn, de, fr but not es.
**Impact:** `ctx.getTagged(i).isSubject` always returns false for Spanish tokens.
**Fix:** Add `es: new Set(['yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'usted', 'ustedes'])` to SUBJECT_PRONOUNS. This is a one-line fix in Plan 1.

## Open Questions

1. **Ser/estar conjugation form → person/tense reverse mapping**
   - What we know: ser_verb and estar_verb in es.json have full conjugation tables (presens, preteritum, perfektum).
   - What's unclear: Should the rule extract all forms programmatically from the verbbank at table-build time, or hardcode them like DE's `HABEN_FORMS`/`SEIN_FORMS` in `de-perfekt-aux.js`?
   - Recommendation: Hardcode the forms in grammar-tables.js. The conjugation tables in es.json include compound forms ("he sido") and person-keys with slashes ("él/ella") that need manual curation. ~30 simple forms total. This matches Phase 8's precedent.

2. **ES-02 benchmark line scope**
   - What we know: Benchmark line 30 contains "para comprar comida por mi familia" where `por` should be `para` (beneficiary). Also "por leer un libro" on line 37 where `por` should be `para` (purpose).
   - What's unclear: Should both lines get expectations, or just the one mentioned in the success criteria?
   - Recommendation: Add expectations for both benchmark hits. The rule should catch both pattern types (beneficiary + purpose).

3. **Phase 11 trigger-table shape compatibility**
   - What we know: Success criterion 4 requires the trigger-table shape to be reusable by Phase 11's subjuntivo rule.
   - What's unclear: What exactly does "shape-sanity unit test" mean for the Phase 11 stub?
   - Recommendation: The trigger-table shape is `{ token: requiredForm }` map consumed via `getTables()` lazy-init. Phase 11's `ES_SUBJUNCTIVE_TRIGGERS` will follow the same `{ triggerWord: 'subjuntivo' }` pattern. A stub rule that reads `host.__lexiGrammarTables.ES_COPULA_ADJ` and asserts it's a non-empty object with string values satisfies the shape-sanity requirement.

## Sources

### Primary (HIGH confidence)
- `extension/data/es.json` — direct inspection of 624 verbs, 1545 nouns, 373 adjectives, 46 pronouns, 839 generalbank entries. Confirmed zero `copula`, `human`, or `transitive` annotations.
- `extension/content/spell-rules/grammar-tables.js` — direct reading of Phase 8 table structure (PREP_CASE, DEF_ARTICLE_CASE, etc.)
- `extension/content/spell-rules/de-prep-case.js` — reference implementation for table-lookup + token-scan pattern
- `extension/content/spell-rules/de-perfekt-aux.js` — reference implementation for conjugation-form reverse lookup
- `extension/content/spell-check-core.js` — SUBJECT_PRONOUNS map (no ES entry), classifyPOS, isLikelyProperNoun, tokensInSentence
- `benchmark-texts/es.txt` — benchmark lines 30 (por mi familia), 45 (Veo Juan), 46 (Soy cansado) confirmed.

### Secondary (MEDIUM confidence)
- Spanish linguistics: ser/estar adjective distinction is a well-established closed set in L2 pedagogy. The ~30 A1-B1 adjectives requiring estar over ser are consistent across all major Spanish textbooks.
- Por/para: the "15 trigger patterns" count aligns with standard L2 Spanish pedagogical breakdowns (RAE simplification for learners).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all infrastructure exists from Phases 6-8; no new dependencies
- Architecture: HIGH — grammar-tables.js extension pattern proven by Phase 8; token-scan pattern identical to de-prep-case.js
- Pitfalls: HIGH — all pitfalls surfaced from direct code inspection and data-gap analysis
- Data gaps: HIGH — confirmed by exhaustive field-count queries against es.json

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable — no external dependencies changing)
