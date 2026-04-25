# Phase 11: Aspect & Mood (ES + FR) - Research

**Researched:** 2026-04-25
**Domain:** Subjunctive-trigger rules (ES/FR), aspectual-hint rule (ES), vocab-seam conjugation index extensions
**Confidence:** HIGH

## Summary

Phase 11 ships three rules that consume the trigger-table primitive proven in Phases 9/10. The ES subjuntivo rule (MOOD-01) and FR subjonctif rule (MOOD-03) detect indicative verb forms after closed-set trigger phrases and suggest the subjunctive form instead. The ES preterito/imperfecto rule (MOOD-02) warns on aspectual-adverb mismatches at hint severity only.

The primary infrastructure work is extending `vocab-seam-core.js` to register three new conjugation keys (`subjuntivo`, `imperfecto`, `subjonctif`) in `TENSE_FEATURES` and `TENSE_GROUP`, then building reverse-lookup indexes (conjugated form to infinitive+person) so rules can detect whether a given token is indicative-present when subjunctive is required. The vocab data is already synced -- 109 ES verbs with subjuntivo, 624 with imperfecto, 97 FR verbs with subjonctif.

**Primary recommendation:** Three plans -- (1) seam+tables infrastructure, (2) MOOD-01 ES subjuntivo + MOOD-02 ES imperfecto rules, (3) MOOD-03 FR subjonctif rule. All rules consume trigger sets from `grammar-tables.js` and conjugation indexes from vocab-seam.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MOOD-01 | ES subjuntivo trigger rule flags indicative-when-subjunctive-required after closed trigger set | ES data has 109 verbs with subjuntivo conjugations; ALL subjuntivo forms differ from presens (zero homophony); trigger set is a closed list in grammar-tables.js; reverse-lookup index maps indicative form -> infinitive -> subjunctive form |
| MOOD-02 | ES preterito vs imperfecto warn-only on aspectual hints | 624 verbs have imperfecto data; hint-severity CSS tier already exists from Phase 6; aspectual adverb sets (ayer/siempre/mientras/cada dia) are small closed lists |
| MOOD-03 | FR subjonctif trigger rule flags indicative-when-subjunctive-required after il faut que / avant que / bien que / pour que | 97 FR verbs with subjonctif; regular -er verbs have je/tu/il/ils homophony with presens -- rule must only flag when forms demonstrably differ (nous/vous for regular verbs, all persons for irregular verbs like faire/avoir/etre/aller) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| grammar-tables.js | existing | Trigger-set tables for subjunctive triggers + aspectual adverbs | Proven in Phases 8/9/10; all structural rules consume from here |
| vocab-seam-core.js | existing | buildIndexes() + buildLookupIndexes() for conjugation form lookups | Central seam; needs TENSE_FEATURES/TENSE_GROUP extension |
| spell-check-core.js | existing | tokensInSentence, getTagged, matchCase, escapeHtml | Rule infrastructure from Phase 6/7 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| check-spellcheck-features | existing gate | Validate new indexes survive minimal-preset feature gating | Must extend for knownSubjuntivo/knownImperfecto/knownSubjonctif |
| check-benchmark-coverage | existing gate | Validate benchmark line flips | Must add es.38 and fr.49-50 expectations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reverse-lookup index in vocab-seam | Inline scanning in rule | Index is O(1) at check time; inline scanning would walk entire verbbank per token -- unacceptable |
| Closed trigger set | NLP-based detection | Closed set is deterministic, offline, zero FP on known triggers; NLP breaks SC-06 |

## Architecture Patterns

### Recommended Project Structure
```
extension/content/
  spell-rules/
    grammar-tables.js        # ADD: ES_SUBJUNTIVO_TRIGGERS, ES_ASPECT_ADVERBS, FR_SUBJONCTIF_TRIGGERS
    es-subjuntivo.js         # NEW: MOOD-01 rule
    es-imperfecto-hint.js    # NEW: MOOD-02 rule
    fr-subjonctif.js         # NEW: MOOD-03 rule
  vocab-seam-core.js         # EXTEND: TENSE_FEATURES, TENSE_GROUP, new indexes
```

### Pattern 1: Trigger-Phrase Detection (reuse from Phase 9/10)

**What:** Scan sentence tokens for a multi-word trigger phrase, then check the verb form in the clause following `que`.

**When to use:** MOOD-01 and MOOD-03 -- detect `[trigger] que [subject?] [verb-in-indicative]`.

**Algorithm:**
```javascript
// 1. Walk tokens looking for trigger start word ("quiero", "espero", "dudo", "il", "es")
// 2. Check if next 1-3 tokens form a known trigger phrase (e.g. "quiero que", "il faut que")
// 3. After "que", scan forward for the next verb token (skip subject pronouns/articles)
// 4. Check if that verb is in indicative-present form (via knownPresens or presensToInfinitive)
// 5. Look up the infinitive -> get subjuntivo form for the same person
// 6. If subjuntivo form differs from what was written: flag, suggest subjuntivo
```

**Example (ES):**
```javascript
// Source: project pattern from es-ser-estar.js, adapted for subjuntivo
// "Quiero que mi hermano viene conmigo"
//  - trigger: "quiero que" (matched from ES_SUBJUNTIVO_TRIGGERS)
//  - verb: "viene" at index i
//  - presensToInf.get("viene") -> "venir"
//  - subjuntivoForms.get("venir") -> { "él/ella": "venga", ... }
//  - detect person from context (hermano = 3s) -> "venga"
//  - flag: "viene" -> "venga"
```

### Pattern 2: Aspectual-Adverb Hint (MOOD-02)

**What:** Detect a temporal-adverb token that strongly implies preterito or imperfecto, then check if the adjacent verb is in the "wrong" aspect. Fire at hint severity only.

**When to use:** MOOD-02 only.

**Algorithm:**
```javascript
// Closed adverb sets:
// PRETERITO_ADVERBS: "ayer", "anoche", "la semana pasada", "el lunes pasado"
// IMPERFECTO_ADVERBS: "siempre", "mientras", "cada dia", "normalmente", "a menudo"
//
// 1. Detect adverb token
// 2. Scan surrounding tokens (within sentence) for a verb form
// 3. Check if verb is imperfecto when preterito is expected (or vice versa)
// 4. Flag at hint severity with educational explain
```

### Pattern 3: FR Subjonctif with Homophony Guard

**What:** Same as Pattern 1 but with an extra guard: only flag when the written form demonstrably differs between indicative and subjunctive.

**When to use:** MOOD-03.

**Critical insight from data analysis:**
- For regular -er verbs: je/tu/il/ils subjunctive = indicative present (homophonous). Only nous/vous differ (parlions vs parlons, parliez vs parlez).
- For irregular verbs (faire, avoir, etre, aller, venir, pouvoir, savoir, etc.): ALL forms differ.
- Strategy: build a `subjonctifDiffers` lookup from the data itself. For each verb, for each person, record whether subjonctif != presens. Only flag when the specific person's forms differ.

```javascript
// For "Il faut que je parle mieux" -- parle is both indicative AND subjunctive for parler
//   -> Do NOT flag (correct as-is, and we can't tell which form the student intended)
// For "Il faut que je fais mes devoirs" -- fais is indicative, fasse is subjunctive
//   -> Flag: "fais" -> "fasse"
```

### Anti-Patterns to Avoid
- **Flagging homophonous forms (FR):** Never flag a FR verb after a subjonctif trigger if the indicative and subjunctive forms are identical for that person. This would be a guaranteed false positive.
- **Hardcoding verb forms in rule files:** ALL verb form data comes from vocab-seam indexes built from es.json/fr.json. The rule files only contain trigger phrases and detection logic.
- **Firing MOOD-02 at error severity:** The preterito/imperfecto distinction is often nuanced and context-dependent. Hint severity only. The success criteria explicitly require this.
- **Re-implementing closed-set matching:** Success criterion 4 says all three rules MUST consume from grammar-tables.js. No local re-implementation of trigger-phrase lists.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conjugation form lookup | Walk verbbank in rule | vocab-seam indexes (verbInfinitive, new subjuntivo/imperfecto indexes) | O(1) vs O(n) per token |
| Trigger phrase matching | Custom regex per rule | Shared closed-set table in grammar-tables.js + standard lookahead in rule | SC-4 mandates trigger-table reuse |
| Hint severity rendering | Custom CSS | Existing Phase 6 `.lh-spell-hint` / `.lh-spell-<id>-hint` tier | Already proven infrastructure |
| Person detection from context | Custom pronoun detection | Existing subject-pronoun detection pattern from es-ser-estar.js | Reuse proven pattern |

**Key insight:** The entire trigger-table primitive was designed in Phase 8, proven in Phase 9 (ES), and extended in Phase 10 (FR). Phase 11 rules are consumers, not inventors.

## Common Pitfalls

### Pitfall 1: FR Homophony False Positives
**What goes wrong:** Flagging "que je parle" as wrong when "parle" is both indicative and subjunctive for parler.
**Why it happens:** Regular -er verbs have identical je/tu/il/ils forms in both moods.
**How to avoid:** Build a per-verb per-person "forms differ" boolean map from the data. Only flag when `subjonctifForm !== presensForm` for the detected person.
**Warning signs:** FR fixtures showing flags on regular -er verbs with je/tu/il/ils subjects.

### Pitfall 2: TENSE_FEATURES/TENSE_GROUP Not Extended
**What goes wrong:** New conjugation keys (`subjuntivo`, `imperfecto`, `subjonctif`) in the data are silently ignored by buildWordList because they have no entry in TENSE_FEATURES.
**Why it happens:** The feature-gating in buildWordList at line 382 checks `TENSE_FEATURES[tense]` and skips if no match.
**How to avoid:** Add all three keys to TENSE_FEATURES and TENSE_GROUP before building indexes.
**Warning signs:** `check-spellcheck-features` won't catch this unless it tests for the new forms specifically.

### Pitfall 3: Building Subjunctive Indexes from Feature-Gated wordList
**What goes wrong:** If the reverse-lookup indexes for subjunctive detection are built from the feature-gated wordList, they will be empty under the "basic" preset (which does not include `grammar_es_subjuntivo` or `grammar_fr_subjonctif`).
**Why it happens:** Same bug that hit Phase 05.1 -- buildLookupIndexes uses the unfiltered superset, but new indexes might accidentally use the filtered wordList.
**How to avoid:** Build subjunctive/imperfecto indexes from the unfiltered `unfilteredWordList` (line 846 in vocab-seam-core.js), or build them directly from raw data like `buildParticipleToAux` does.
**Warning signs:** Rules work in fixtures (which use `isFeatureEnabled: () => true`) but fail in browser under basic preset.

### Pitfall 4: Accent Stripping for ES Subjunctive Forms
**What goes wrong:** Student writes "venga" but data has "venga" -- match works. But student writes "vengais" (missing accent on "vengáis") and the lookup fails.
**Why it happens:** Students often omit tildes. ES forms in the data include accents (habléis, vengáis).
**How to avoid:** The reverse-lookup index must include both accented and accent-stripped variants, following the pattern established in fr-etre-avoir.js (lines 28-45).
**Warning signs:** Rules fail on student text with missing accents despite correct verb choice.

### Pitfall 5: "que" Is Also a Relative Pronoun
**What goes wrong:** "El libro que viene de la biblioteca" flagged because "viene" follows "que".
**Why it happens:** "que" after a noun is a relative pronoun, not a subjunctive trigger.
**How to avoid:** The trigger match must be a COMPLETE multi-word phrase ("quiero que", "espero que", not just any "que"). The trigger-start word must be a verb/expression of desire/doubt/emotion/impersonal expression, not a noun.
**Warning signs:** False positives on relative clauses with "que".

### Pitfall 6: Person Agreement in Subjunctive Suggestion
**What goes wrong:** Rule flags "viene" but suggests wrong person's subjunctive form (e.g. "vengamos" instead of "venga").
**Why it happens:** Person detection from the subject between trigger and verb is nontrivial.
**How to avoid:** Use the same person as the indicative form being flagged. If "viene" is 3s present, suggest the 3s subjunctive form "venga". Map through verbInfinitive -> subjuntivo conjugation table by matching pronoun index.
**Warning signs:** Fixture mismatches on the suggested fix form.

## Code Examples

### New Trigger Tables for grammar-tables.js
```javascript
// ES: Subjuntivo trigger phrases (closed set, ~15-20 entries)
// These are multi-word expressions that require subjunctive in the following clause.
const ES_SUBJUNTIVO_TRIGGERS = new Set([
  'quiero que', 'quiere que', 'queremos que',
  'espero que', 'espera que', 'esperamos que',
  'dudo que', 'duda que', 'dudamos que',
  'es importante que', 'es necesario que', 'es posible que',
  'es imposible que', 'es mejor que', 'es probable que',
  'me alegra que', 'me sorprende que', 'me molesta que',
  'no creo que', 'no pienso que',
  'ojalá que',  // often without "que" too
  'pido que', 'pide que',
  'prefiero que', 'prefiere que',
  'recomiendo que', 'recomienda que',
  'sugiero que', 'sugiere que',
]);

// ES: Aspectual adverb sets for MOOD-02
const ES_PRETERITO_ADVERBS = new Set([
  'ayer', 'anteayer', 'anoche',
]);
const ES_PRETERITO_PHRASES = [
  // Multi-word: matched by scanning tokens
  'la semana pasada', 'el mes pasado', 'el año pasado',
  'el lunes pasado', 'el martes pasado',
  'una vez', 'de repente',
];
const ES_IMPERFECTO_ADVERBS = new Set([
  'siempre', 'normalmente', 'generalmente', 'frecuentemente',
]);
const ES_IMPERFECTO_PHRASES = [
  'cada dia', 'cada semana', 'cada mes', 'cada año',
  'todos los dias', 'a menudo', 'a veces', 'de vez en cuando',
];

// FR: Subjonctif trigger phrases
const FR_SUBJONCTIF_TRIGGERS = new Set([
  'il faut que', 'il faudrait que',
  'avant que', 'pour que', 'afin que',
  'bien que', 'quoique',
  'sans que', 'a moins que', 'à moins que',
  'je veux que', 'il veut que', 'elle veut que',
  'je souhaite que', 'il souhaite que',
  'je doute que', 'il doute que',
  'il est important que', 'il est necessaire que', 'il est nécessaire que',
  'il est possible que',
]);
```

### New Vocab-Seam Indexes (conceptual)
```javascript
// In buildIndexes(), build these new maps from raw data:

// ES: presens form -> { infinitive, person } for subjuntivo detection
// "viene" -> { inf: "venir", person: "él/ella" }
const esPresensToVerb = new Map();

// ES: infinitive+person -> subjuntivo form
// "venir|él/ella" -> "venga"
const esSubjuntivoForms = new Map();

// ES: infinitive+person -> imperfecto form
// "hablar|yo" -> "hablaba"
const esImperfectoForms = new Map();

// ES: preterito form -> { infinitive, person }
// "habló" -> { inf: "hablar", person: "él/ella" }
const esPreteritumToVerb = new Map();

// FR: presens form -> { infinitive, person }
// "fait" -> { inf: "faire", person: "il/elle" }
const frPresensToVerb = new Map();

// FR: infinitive+person -> subjonctif form
// "faire|je" -> "fasse"
const frSubjonctifForms = new Map();

// FR: per-verb per-person "forms differ" boolean
// "faire|je" -> true (fais != fasse), "parler|je" -> false (parle == parle)
const frSubjonctifDiffers = new Map();
```

### Rule File Pattern (es-subjuntivo.js skeleton)
```javascript
// Source: project pattern from es-ser-estar.js + es-por-para.js
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const core = host.__lexiSpellCore || {};
  const { tokensInSentence, matchCase, escapeHtml } = core;

  let _triggers = null;
  function getTriggers() {
    if (_triggers) return _triggers;
    const gt = host.__lexiGrammarTables || {};
    _triggers = gt.ES_SUBJUNTIVO_TRIGGERS || new Set();
    return _triggers;
  }

  const rule = {
    id: 'es-subjuntivo',
    languages: ['es'],
    priority: 60,      // Between ser-estar (50) and modal-verb (110)
    severity: 'warning',
    explain: function (finding) {
      return {
        nb: 'Etter <em>' + escapeHtml(finding.trigger) + '</em> brukes subjuntivo: <em>' +
            escapeHtml(finding.fix) + '</em>, ikkje indikativ <em>' +
            escapeHtml(finding.original) + '</em>.',
        nn: 'Etter <em>' + escapeHtml(finding.trigger) + '</em> vert subjuntivo brukt: <em>' +
            escapeHtml(finding.fix) + '</em>, ikkje indikativ <em>' +
            escapeHtml(finding.original) + '</em>.',
        severity: 'warning',
      };
    },
    check(ctx) {
      if (ctx.lang !== 'es') return [];
      if (!ctx.sentences || !tokensInSentence) return [];
      const triggers = getTriggers();
      if (!triggers.size) return [];
      // ... scan for trigger phrases, then check verb after "que" ...
      return findings;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No subjunctive detection | Closed-trigger-set detection with vocab-data subjunctive forms | Phase 11 (now) | First mood-aware rules in the system |
| No imperfecto in TENSE_FEATURES | Register imperfecto/subjuntivo/subjonctif in seam | Phase 11 (now) | 624+109+97 verb conjugations become available to indexes |
| Manual form lookup | Reverse-lookup indexes (presensToVerb, subjuntivoForms) | Phase 11 (now) | O(1) per-token detection |

## Open Questions

1. **Person detection between trigger and verb**
   - What we know: The subject between "que" and the verb may be explicit ("mi hermano") or implicit (pro-drop).
   - What's unclear: How reliably we can detect person when the subject is a full NP rather than a pronoun.
   - Recommendation: Map person from the indicative form being flagged, not from the subject. If "viene" is 3s indicative present of "venir", suggest 3s subjunctive "venga". This sidesteps the NP-person problem entirely.

2. **FR benchmark line evaluation**
   - What we know: Line 49-50 says "Il faut que je parle mieux." "parle" is BOTH indicative and subjunctive for parler (je).
   - What's unclear: Success criterion 2 says this line should be "correctly evaluated" -- it should NOT flag because the form is correct either way.
   - Recommendation: The rule should recognize this is a valid subjunctive form and NOT flag it. The benchmark expectation should be on a minimal-pair fixture (e.g., "Il faut que je fais mes devoirs" where fais != fasse) rather than on this benchmark line. SC-2 explicitly mentions "a minimal-pair fixture with indicative-after-trigger flips from unflagged -> flagged."

3. **`mientras` dual role in MOOD-02**
   - What we know: "Mientras" can be temporal (ongoing = imperfecto) or contrastive ("mientras que" = however).
   - What's unclear: Whether to handle "mientras que" as an exception.
   - Recommendation: Only match bare "mientras" (not "mientras que") for imperfecto hint, reducing false positives.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js fixture runner (check-fixtures) |
| Config file | scripts/check-fixtures.js |
| Quick run command | `npm run check-fixtures` |
| Full suite command | `npm run check-fixtures && npm run check-explain-contract && npm run check-rule-css-wiring && npm run check-benchmark-coverage && npm run check-spellcheck-features && npm run check-network-silence && npm run check-bundle-size` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOOD-01 | ES subjuntivo trigger flags indicative after closed set | fixture + benchmark | `npm run check-fixtures` + `npm run check-benchmark-coverage` | Wave 0 |
| MOOD-02 | ES pret/imperf hint-only at hint severity | fixture | `npm run check-fixtures` | Wave 0 |
| MOOD-03 | FR subjonctif trigger flags indicative (irregular verbs only) | fixture + benchmark | `npm run check-fixtures` + `npm run check-benchmark-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run check-fixtures && npm run check-explain-contract && npm run check-rule-css-wiring`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extension/content/spell-rules/es-subjuntivo.js` -- MOOD-01 rule file
- [ ] `extension/content/spell-rules/es-imperfecto-hint.js` -- MOOD-02 rule file
- [ ] `extension/content/spell-rules/fr-subjonctif.js` -- MOOD-03 rule file
- [ ] Fixtures for all three rules (>=30 positive + >=15 acceptance each)
- [ ] `TENSE_FEATURES` + `TENSE_GROUP` entries for subjuntivo, imperfecto, subjonctif
- [ ] Reverse-lookup indexes in vocab-seam-core.js
- [ ] Trigger tables in grammar-tables.js
- [ ] Benchmark expectations in expectations.json (es.38 for MOOD-01, FR minimal-pair for MOOD-03)
- [ ] CSS bindings for `.lh-spell-es-subjuntivo`, `.lh-spell-es-imperfecto-hint`, `.lh-spell-fr-subjonctif`
- [ ] `check-spellcheck-features` extended for new conjugation forms

## Sources

### Primary (HIGH confidence)
- `extension/data/es.json` -- 109 verbs with `subjuntivo` key, 624 with `imperfecto` key; verified data shape and form differences
- `extension/data/fr.json` -- 97 verbs with `subjonctif` key; verified homophony for regular -er verbs (je/tu/il/ils identical to presens)
- `extension/content/vocab-seam-core.js` -- TENSE_FEATURES (line 63) and TENSE_GROUP (line 53) confirmed missing entries for new conjugation keys
- `extension/content/spell-rules/grammar-tables.js` -- existing trigger-table pattern (ES_POR_PARA_TRIGGERS, FR_ETRE_FORMS)
- `extension/content/spell-rules/es-ser-estar.js` -- reference pattern for ES rule structure
- `extension/content/spell-rules/fr-etre-avoir.js` -- reference pattern for FR rule with accent stripping
- `extension/data/grammarfeatures-es.json` -- `grammar_es_subjuntivo` and `grammar_es_imperfecto` feature IDs confirmed; subjuntivo only in "all" preset
- `extension/data/grammarfeatures-fr.json` -- `grammar_fr_subjonctif` feature ID confirmed; only in "all" preset

### Secondary (MEDIUM confidence)
- Benchmark texts `es.txt` line 38, `fr.txt` lines 49-50 -- verified target lines for MOOD-01 and MOOD-03
- `benchmark-texts/expectations.json` -- confirmed no existing es.38 or fr.49 entries (Phase 11 will add)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all infrastructure already exists; this is additive only
- Architecture: HIGH - follows exact patterns from Phase 9/10 rules, verified against codebase
- Pitfalls: HIGH - FR homophony confirmed via data analysis (92/97 verbs have some different forms, but je/tu/il/ils for regular -er are identical); accent stripping pattern proven in existing rules
- Data availability: HIGH - all conjugation data already synced and verified

**Key data findings:**
- ES: 109/109 subjuntivo verbs have ALL forms different from presens (zero homophony)
- ES: 624 verbs have imperfecto data
- FR: 97 verbs have subjonctif data; for regular -er verbs je/tu/il/ils are identical to presens (only nous/vous differ); for irregular verbs all 6 forms differ
- FR: 92 out of 97 verbs have at least one form that differs from presens (the guard is per-person, not per-verb)

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable -- data is already synced, infrastructure patterns proven)
