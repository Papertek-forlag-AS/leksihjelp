# Phase 15: Collocations at Scale (NB + DE + FR + ES) - Research

**Researched:** 2026-04-25
**Domain:** Preposition-collocation error detection across NB, DE, FR, ES
**Confidence:** HIGH

## Summary

Phase 15 scales the Phase 6 EN collocation-seed pattern to four additional languages: NB, DE, FR, ES. The existing infrastructure is fully in place: `collocation.js` rule file (114 LOC, EN-only), `vocab-seam-core.js` collocationbank parser, `vocab-seam.js` `getCollocations()` getter, `check-governance-data` gate validating `{trigger, fix}` shape, and the `spell-check.js` `ctx.vocab.collocations` wiring. No new seam code is needed.

The work is almost entirely data authoring. The collocationbank does not exist in any `extension/data/{lang}.json` file yet. The Papertek Vocabulary API does not serve governance banks (registerbank/collocationbank/phrasebank) -- the sync-vocab script's BANKS array omits them. Until the API lands governance banks, collocation data must live as inline seed data in the rule file, mirroring the pattern used by `redundancy.js` (multi-language seed map, 139 LOC) and `register.js` (multi-language seed map).

**Primary recommendation:** Extend the existing `collocation.js` to support all five languages (en + nb + de + fr + es) with inline `SEED_COLLOCATIONS` per language. Do NOT create separate per-language rule files. The existing EN check logic (substring match over sentences with structural suppression) works identically for all languages. Add benchmark lines and expectations for each new language.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COLL-01 | NB preposition collocations flagged (`flink i -> til`, `glad pa -> i`, `bra i -> med`) | Benchmark nb.txt line 37 already contains "flink i"; extend collocation.js with NB seed data (~15-25 entries); substring-match logic reusable |
| COLL-02 | DE preposition collocations flagged (parallel to COLL-01, data-driven) | New benchmark line(s) needed in de.txt; DE seed data (~15-25 entries: Angst haben vor, warten auf, stolz auf, etc.); same check logic |
| COLL-03 | FR preposition collocations flagged (parallel to COLL-01) | New benchmark line(s) needed in fr.txt; FR seed data (~15-25 entries: penser a, jouer a/de, faire attention a, etc.); same check logic |
| COLL-04 | ES preposition collocations flagged (parallel to COLL-01) | New benchmark line(s) needed in es.txt; ES seed data (~15-25 entries: sonar con, pensar en, depender de, etc.); same check logic |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (IIFE) | N/A | Rule file pattern | All spell-rules use this pattern |
| collocation.js | Existing | Single rule file for all languages | Matches redundancy.js multi-lang pattern |
| vocab-seam-core.js | Existing | collocationbank parser already built | `{trigger, fix}` shape, triggerWords split |
| vocab-seam.js | Existing | `getCollocations()` getter wired | Already in spell-check.js ctx.vocab |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| check-governance-data.js | Existing gate | Validates collocationbank shape | Runs on every release; already validates `{trigger, fix}` |
| check-explain-contract.js | Existing gate | Validates explain contract | collocation.js already in TARGETS |
| check-rule-css-wiring.js | Existing gate | Validates CSS dot colour | collocation.js already has amber CSS wiring |
| check-benchmark-coverage.js | Existing gate | Validates benchmark flip-rate | New expectations needed for nb/de/fr/es lines |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single multi-lang rule file | Per-language rule files (nb-collocation.js, de-collocation.js, etc.) | Per-language files create 4 new TARGETS entries, 4 new CSS bindings, 4 new manifest entries; the check logic is identical -- unnecessary duplication |
| Inline seed data | Papertek API collocationbank | API doesn't serve governance banks yet; sync-vocab doesn't pull them; inline seeds are the established pattern (register.js, redundancy.js) |

## Architecture Patterns

### Pattern 1: Multi-Language Seed Collocation Map
**What:** A single `SEED_COLLOCATIONS` object keyed by language code, with arrays of `{trigger, fix}` entries per language. The `check()` function resolves collocations from vocab-seam first, falls back to the seed for the current `ctx.lang`.
**When to use:** When data shape is identical across languages and check logic doesn't vary.
**Example:**
```javascript
// Existing pattern from redundancy.js (production code)
const SEED_COLLOCATIONS = {
  en: [
    { trigger: 'make a photo', fix: 'take a photo' },
    // ...existing EN entries...
  ],
  nb: [
    { trigger: 'flink i', fix: 'flink til' },
    { trigger: 'glad på', fix: 'glad i' },
    // ...
  ],
  de: [
    { trigger: 'Angst von', fix: 'Angst vor' },
    // ...
  ],
  fr: [
    { trigger: 'penser de', fix: 'penser à' },
    // ...
  ],
  es: [
    { trigger: 'soñar de', fix: 'soñar con' },
    // ...
  ],
};
```

### Pattern 2: Fallback Resolution
**What:** `ctx.vocab.collocations` (from vocab-seam collocationbank) takes priority; if empty, use `SEED_COLLOCATIONS[ctx.lang]`.
**When to use:** Always -- this is the established governance-bank pattern.
**Example:**
```javascript
check(ctx) {
  let collocations = ctx.vocab.collocations;
  if (!collocations || collocations.length === 0) {
    collocations = SEED_COLLOCATIONS[ctx.lang] || [];
  }
  // ... existing substring-match logic unchanged
}
```

### Pattern 3: Benchmark Line Addition
**What:** Add one content line per language containing a collocation error. Register in `expectations.json`.
**When to use:** Each COLL-XX requirement needs at least one benchmark line.

### Anti-Patterns to Avoid
- **Per-language rule files:** Creates unnecessary duplication when check logic is identical. The redundancy.js pattern proves one file handles all languages.
- **Case-sensitive trigger matching:** The existing rule already lowercases both trigger and sentence text. DE nouns are capitalized but triggers should be authored lowercase (the match is case-insensitive).
- **Triggers that are common substrings:** A trigger like "i" alone would match everywhere. Triggers must be multi-word phrases or adjective+preposition bigrams with enough context.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collocation matching | Custom tokenizer or regex | Existing substring indexOf loop | Already handles multi-word triggers, structural suppression, sentence boundaries |
| Governance data validation | Manual shape checks | `check-governance-data.js` gate | Already validates `{trigger, fix}` shape for collocationbank |
| Explain contract | Custom explain function | Existing `explain(finding)` pattern | Already returns `{nb, nn}` with escapeHtml |
| CSS dot colour | New CSS class | Existing `.lh-spell-collocation` amber binding | Rule ID stays `collocation`; one CSS binding covers all languages |

**Key insight:** Because the rule ID stays `collocation` for all languages, zero manifest/CSS/gate changes are needed. The only changes are: (1) extend `languages` array from `['en']` to `['en', 'nb', 'de', 'es', 'fr']`, (2) add per-language seed data, (3) update fallback logic to be language-aware, (4) add benchmark lines + expectations.

## Common Pitfalls

### Pitfall 1: Trigger Substring False Positives
**What goes wrong:** Short triggers like "i" or "a" match everywhere in running text.
**Why it happens:** Norwegian/French use single-letter prepositions frequently.
**How to avoid:** Triggers must always be multi-word: "flink i" not just "i". The trigger must include the adjective/verb/noun that governs the wrong preposition.
**Warning signs:** Fixture tests show matches in clean sentences.

### Pitfall 2: Case Sensitivity for German
**What goes wrong:** German nouns are capitalized ("Angst vor") but the match loop lowercases everything.
**Why it happens:** The existing check already does `sentLower = sentence.text.toLowerCase()` and `triggerLower = entry.trigger.toLowerCase()`.
**How to avoid:** Author DE triggers in any case -- matching is case-insensitive. But `fix` field should preserve correct German capitalization for the suggestion display.

### Pitfall 3: Overlapping Triggers
**What goes wrong:** If "glad på deg" and "glad på" are both triggers, the shorter one matches inside the longer one's domain.
**Why it happens:** indexOf finds all occurrences sequentially.
**How to avoid:** Use the longest/most-specific trigger. If "glad på" should fire except in "glad på deg", either omit the short trigger or accept the overlap (warn-only severity mitigates).

### Pitfall 4: NB Benchmark Line 37 Already Has Multiple Rules Firing
**What goes wrong:** Line 37 has "Den store huset" (gender) and "flink i" (collocation). Both should fire.
**Why it happens:** Multiple errors on one benchmark line is normal and expected.
**How to avoid:** No issue -- benchmark expectations are per-rule, not per-line. Add a new expectation `nb.37` for collocation alongside the existing findings.

### Pitfall 5: Languages Array Must Include All Target Languages
**What goes wrong:** Rule only fires for `['en']` and silently skips NB/DE/FR/ES.
**Why it happens:** Forgetting to update the `languages` array on the rule object.
**How to avoid:** Change `languages: ['en']` to `languages: ['en', 'nb', 'nn', 'de', 'es', 'fr']`. Include `nn` for Norwegian nynorsk (same collocations as NB, possibly different spelling).

## Code Examples

### Current collocation.js Check Logic (Production, Verified)
```javascript
// Source: extension/content/spell-rules/collocation.js lines 53-109
check(ctx) {
  let collocations = ctx.vocab.collocations;
  if (!collocations || collocations.length === 0) {
    collocations = SEED_COLLOCATIONS;  // Currently flat array, needs per-lang map
  }
  if (!collocations || collocations.length === 0) return [];
  if (!ctx.sentences) return [];
  // ... substring match with structural suppression
}
```

### Required Change: Language-Aware Fallback
```javascript
// Transform from flat SEED_COLLOCATIONS array to per-lang map
check(ctx) {
  let collocations = ctx.vocab.collocations;
  if (!collocations || collocations.length === 0) {
    collocations = SEED_COLLOCATIONS[ctx.lang] || [];
  }
  // ... rest unchanged
}
```

### vocab-seam-core.js Collocationbank Parser (Production, Verified)
```javascript
// Source: extension/content/vocab-seam-core.js lines 1126-1136
const collocations = [];
if (raw && raw.collocationbank) {
  for (const [id, entry] of Object.entries(raw.collocationbank)) {
    if (entry.trigger && entry.fix) {
      collocations.push({
        ...entry,
        triggerWords: entry.trigger.toLowerCase().split(/\s+/),
      });
    }
  }
}
```

### check-governance-data.js Shape Requirement (Production, Verified)
```javascript
// Source: scripts/check-governance-data.js lines 41-44
collocationbank: {
  required: ['trigger', 'fix'],
  description: 'collocationbank entries require "trigger" and "fix" fields',
},
```

## NB Preposition Collocations (Seed Data Research)

Common Norwegian adjective/verb + preposition errors Norwegian students make:

| Wrong | Correct | English Meaning |
|-------|---------|-----------------|
| flink i | flink til | good at |
| glad på | glad i | fond of / love |
| bra i | bra med / bra til | good at/with |
| redd av | redd for | afraid of |
| interessert av | interessert i | interested in |
| stolt av | stolt over | proud of (NB students may use "av" from English "of") |
| lei for | lei av | tired of |
| sint over | sint på | angry at |
| fornøyd av | fornøyd med | satisfied with |
| opptatt av | opptatt med | busy with (note: "opptatt av" = "concerned about" is valid, so this needs care) |
| vant med | vant til | used to |
| ferdig av | ferdig med | finished with |
| gift i | gift med | married to |
| enig over | enig i | agree with (a statement) |
| skuffet av | skuffet over | disappointed in |

**Confidence:** HIGH for the top 5 (flink, glad, redd, interessert, stolt) -- these are well-documented learner errors. MEDIUM for the rest -- some may have valid alternative uses.

## DE Preposition Collocations (Seed Data Research)

Common German verb/adjective + preposition errors:

| Wrong | Correct | English Meaning |
|-------|---------|-----------------|
| Angst von | Angst vor | fear of |
| warten für | warten auf | wait for |
| stolz von | stolz auf | proud of |
| sich interessieren in | sich interessieren für | be interested in |
| denken über | denken an | think of/about |
| träumen über | träumen von | dream of |
| sich freuen über (future) | sich freuen auf (future) | look forward to |
| abhängen von | abhängen von | depend on (this one is correct! -- verify) |
| bitten um | bitten für | ask for (students use für from English) |
| suchen nach | suchen für | search for |
| sich entschuldigen bei | sich entschuldigen für | apologize for vs to |
| Lust für | Lust auf | feel like (doing) |
| teilnehmen in | teilnehmen an | participate in |
| sich gewöhnen mit | sich gewöhnen an | get used to |
| zufrieden von | zufrieden mit | satisfied with |

**Confidence:** HIGH -- German verb/adjective-preposition collocations are a core L2 teaching topic with extensive documentation.

## FR Preposition Collocations (Seed Data Research)

Common French verb/adjective + preposition errors:

| Wrong | Correct | English Meaning |
|-------|---------|-----------------|
| penser de | penser à | think about |
| jouer le piano | jouer du piano | play the piano (instrument = de) |
| jouer le football | jouer au football | play football (sport = à) |
| rêver sur | rêver de | dream of |
| dépendre sur | dépendre de | depend on |
| s'intéresser dans | s'intéresser à | be interested in |
| chercher pour | chercher (no prep) | look for |
| regarder à | regarder (no prep) | look at |
| écouter à | écouter (no prep) | listen to |
| demander pour | demander (no prep) | ask for |
| attendre pour | attendre (no prep) | wait for |
| habiter dans Paris | habiter à Paris | live in Paris |
| profiter de | profiter de | take advantage of (correct -- verify no error) |
| se souvenir sur | se souvenir de | remember |
| avoir peur de | avoir peur pour | be afraid of (students may confuse) |

**Confidence:** HIGH -- French preposition collocations are extremely well-documented as L2 pitfalls, especially the "no preposition where English uses one" cases.

## ES Preposition Collocations (Seed Data Research)

Common Spanish verb/adjective + preposition errors:

| Wrong | Correct | English Meaning |
|-------|---------|-----------------|
| soñar de | soñar con | dream of |
| pensar sobre | pensar en | think about |
| depender en | depender de | depend on |
| casarse a | casarse con | marry |
| enamorarse de | enamorarse de | fall in love with (correct -- verify) |
| consistir de | consistir en | consist of |
| insistir sobre | insistir en | insist on |
| confiar sobre | confiar en | trust in |
| interesarse en | interesarse por/en | be interested in (both valid) |
| acordarse sobre | acordarse de | remember |
| tratar sobre | tratar de | try to / be about |
| fijarse sobre | fijarse en | notice |
| preocuparse sobre | preocuparse por | worry about |
| contar sobre | contar con | count on |
| disfrutar de | disfrutar de | enjoy (correct -- no error) |

**Confidence:** HIGH -- Spanish verb-preposition collocations are core L2 teaching material, especially the "con/en/de vs English of/about/on" mismatches.

## Benchmark Lines Needed

The benchmark texts need new content lines with collocation errors:

| Language | File | Error to Plant | Expected Rule |
|----------|------|----------------|---------------|
| NB | nb.txt | Already exists: line 37 "flink i" | `collocation` |
| DE | de.txt | New line: e.g. "Ich habe Angst von der Prüfung." | `collocation` |
| FR | fr.txt | New line: e.g. "Je pense de mes vacances." | `collocation` |
| ES | es.txt | New line: e.g. "Yo sueño de ser médico." | `collocation` |

**Note:** Each new line must be a complete sentence appended to the benchmark file, following the existing convention. No lines should be modified.

## NN Consideration

NB and NN share most preposition collocations ("flink til", "glad i" are the same in both written standards). The `SEED_COLLOCATIONS` map should include an `nn` key that is either identical to `nb` or a reference to it. The `languages` array should include `nn`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EN-only inline seed | Multi-lang inline seed map | Phase 15 (this phase) | 4 new languages covered |
| Flat SEED_COLLOCATIONS array | Per-lang SEED_COLLOCATIONS object | Phase 15 (this phase) | Backwards-compatible: EN entries migrate into `en` key |

**Not yet landed:**
- Papertek API governance banks (registerbank, collocationbank, phrasebank) are not served by the API
- sync-vocab.js does not pull governance banks
- When API lands governance banks, inline seeds become dead code (already marked TEMPORARY in register.js, redundancy.js)

## Open Questions

1. **NN-specific collocations**
   - What we know: Most adjective+preposition collocations are identical in NB and NN
   - What's unclear: Are there any NN-specific preposition collocations that differ from NB?
   - Recommendation: Start with `nn` key pointing to same entries as `nb`. Diverge later if needed.

2. **Curated list size per language**
   - What we know: 15-25 entries per language is a reasonable seed. The EN seed has 19 entries.
   - What's unclear: Exact number of high-confidence entries per language
   - Recommendation: Start with 10-15 highest-confidence entries per language. Quality over quantity -- each entry should represent an error Norwegian students actually make.

3. **"No preposition" collocations in FR/ES**
   - What we know: French "chercher pour" should be "chercher" (no preposition). The fix field needs to indicate "drop the preposition".
   - What's unclear: How the fix renders when the correction is removal rather than substitution
   - Recommendation: Use fix like `chercher` (just the verb) -- the existing explain function shows `trigger -> fix` which is clear.

## Sources

### Primary (HIGH confidence)
- `extension/content/spell-rules/collocation.js` -- existing EN-only rule, 114 LOC, IIFE pattern
- `extension/content/spell-rules/redundancy.js` -- multi-language precedent, 139 LOC, per-lang seed map
- `extension/content/spell-rules/register.js` -- multi-language precedent, per-lang seed map
- `extension/content/vocab-seam-core.js` lines 1126-1136 -- collocationbank parser shape
- `extension/content/vocab-seam.js` line 296 -- getCollocations() getter
- `scripts/check-governance-data.js` -- validates `{trigger, fix}` shape
- `benchmark-texts/nb.txt` line 37 -- existing "flink i" error

### Secondary (MEDIUM confidence)
- [NLS Norwegian Language School - Preposition Errors](https://nlsnorwegian.no/the-most-common-preposition-errors-in-norskproven/) -- NB preposition collocation errors
- [German Verb-Preposition Collocations (KU)](https://opentext.ku.edu/corpora/chapter/vpc1/) -- DE verb-preposition list
- [German Adjective-Preposition Collocations (KU)](https://opentext.ku.edu/corpora/chapter/apc1/) -- DE adjective-preposition list
- [Start French Now - Verb Preposition Mistakes](https://www.startfrenchnow.com/blog/post/les-verbes-francais-et-leurs-prepositions-15) -- FR verb-preposition errors
- [Real Fast Spanish - Verbs and Prepositions](https://www.realfastspanish.com/grammar/verbs-prepositions) -- ES verb-preposition collocations
- [Readle - Verb and Preposition Collocations](https://readle-app.com/en/grammar/spanish/b1/verb-and-preposition-collocations-in-spanish/) -- ES verb-preposition collocations

### Tertiary (LOW confidence)
- Specific NB collocation seed entries beyond top 5 -- need validation by native speaker

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- reuses 100% existing infrastructure, zero new seam code
- Architecture: HIGH -- redundancy.js proves the multi-language single-file pattern
- Pitfalls: HIGH -- substring matching pitfalls well-understood from existing rule
- Seed data: MEDIUM -- top 5 per language are well-documented; tail entries need validation

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable domain, no moving targets)
