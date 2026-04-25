# Phase 14: Morphology Beyond Tokens (EN + ES/FR) - Research

**Researched:** 2026-04-25
**Domain:** Morphological error detection (EN irregular forms, FR/ES opaque gender, EN word-family POS)
**Confidence:** HIGH

## Summary

Phase 14 ships three new spell-check rules that catch errors the existing token-local v1.0/v2.0 rules cannot: EN morphological overgeneration of regular patterns onto irregular words, ES/FR article-noun gender mismatch on opaque-gender nouns, and EN word-family POS-slot confusion.

The codebase already has the infrastructure this phase needs: the IIFE rule registry pattern, the `vocab-seam-core.js` index builder, the `grammar-tables.js` shared data store, the tagged-token POS view (INFRA-06), and the check-fixtures/check-benchmark-coverage/check-spellcheck-features/check-governance-data release gates. The EN vocab data already carries `verbClass: "irregular"` (200 verbs) with explicit past/participle forms, and `forms.plural` on nouns (1627 nouns, including irregular plurals like child/children, mouse/mice). The FR vocab has `genus` on all 1483 nouns. No new npm dependencies are needed.

The main work is: (1) building two new vocab-seam indexes (`irregularForms` for MORPH-01, `wordFamilies` for MORPH-03) from existing data, (2) creating three new rule files, (3) wiring manifest/CSS/explain/benchmark expectations, and (4) extending the release gates.

**Primary recommendation:** Build `irregularForms` as a Map keyed by the wrong regular-pattern form (e.g. `"childs" -> { correct: "children", type: "plural", base: "child" }`) generated at index-build time from existing `verbClass: "irregular"` and irregular noun plural data. Build `wordFamilies` as a curated inline Map in the rule file (closed ~30-family seed set). The FR/ES opaque-gender rule is MORPH-02 but the existing `es-fr-gender.js` rule already handles article-noun gender mismatch -- the gap is that it checks `nounGenus` which requires the tokenized noun to match a dictionary key. The "un bon humeur" case requires detecting that "bon" (masculine adjective form) disagrees with a following feminine noun. This is an adjective-noun gender agreement check, not just article-noun.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MORPH-01 | EN morphological overgeneration flagged when regular-pattern derivation applied to irregular verb/noun (`goed`, `runned`, `childs`, `mouses`, `womans`) | EN vocab has `verbClass: "irregular"` on 200 verbs with explicit past/participle forms; nouns have `forms.plural` with irregular plurals (child/children, mouse/mice). Build `irregularForms` Map at index time from these. |
| MORPH-02 | ES/FR opaque-noun gender flagged when article-noun form mismatches `genus` field | FR nounbank has `genus` on all 1483 nouns. Existing `es-fr-gender.js` handles article-noun mismatch. Gap: "un bon humeur" needs adjective-form gender check (bon = masc, humeur = fem). FR adjective data lacks feminine forms -- must use rule-based morphology (bon->bonne, etc.) or a small curated map. |
| MORPH-03 | EN word-family POS-slot confusion flagged via closed word-family list + POS-of-slot detection | Tagged-token POS view (INFRA-06) provides `ctx.getTagged(i).pos` classification. Need a closed word-family Map (e.g. improve/improvement/improved) and slot-expectation detection (after "have" expects verb, not noun). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS IIFE | N/A | Rule file pattern | Every rule in `spell-rules/` uses this pattern |
| vocab-seam-core.js | N/A | Index builder | Centralizes all vocab-to-index transforms |
| grammar-tables.js | N/A | Shared data tables | Cross-rule data deduplication |
| spell-check-core.js | N/A | Rule runner + tagged-token POS | Provides `ctx.getTagged(i)` for POS-slot detection |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.Segmenter | Browser built-in | Sentence boundaries | Already wired in spell-check-core.js |
| check-fixtures | N/A | Fixture regression gate | Validates all rules at release |
| check-benchmark-coverage | N/A | Benchmark flip-rate gate | Validates benchmark expectations |

### Alternatives Considered
None. The project mandates no new runtime npm deps (Out of Scope in REQUIREMENTS.md).

## Architecture Patterns

### Recommended Project Structure
```
extension/content/spell-rules/
  en-morphology.js         # MORPH-01: EN irregular overgeneration rule
  en-word-family.js        # MORPH-03: EN word-family POS confusion rule
  # MORPH-02: Extend existing es-fr-gender.js (or create fr-opaque-gender.js)

extension/content/vocab-seam-core.js
  buildIrregularForms()    # New index builder for MORPH-01
  # wordFamilies inline in rule file per data-logic-separation philosophy

fixtures/en/
  en-morphology.jsonl      # MORPH-01 fixtures
  en-word-family.jsonl     # MORPH-03 fixtures
fixtures/fr/
  fr-opaque-gender.jsonl   # MORPH-02 FR fixtures (or extend gender.jsonl)
```

### Pattern 1: Irregular-Forms Index (MORPH-01)
**What:** Build a Map at index time from existing vocab data that maps wrong regular-derivation forms to their correct irregular counterparts.
**When to use:** When the error is applying a regular pattern (add -s, add -ed) to an irregular base.
**How it works:**

For **verbs** with `verbClass: "irregular"`:
- The past tense is stored in `conjugations.past.former.simple` (e.g. `eat` -> `ate`)
- The participle is in `conjugations.perfect.former.participle` or `conjugations.perfect.participle` (e.g. `eat` -> `eaten`)
- Generate the wrong regular forms: `eat + ed` = `eated`, `eat + s` = (not a past form error)
- Map: `"eated" -> { correct: "ate", type: "past", base: "eat" }`
- Also handle past participle: `"eated" -> { correct: "eaten", type: "participle", base: "eat" }` -- prefer past-simple suggestion since student context is ambiguous

For **nouns** with irregular plurals:
- Compare `forms.singular` and `forms.plural`
- If plural is NOT `singular + s` or `singular + es` (the two regular patterns), generate the wrong regular form
- Map: `"childs" -> { correct: "children", type: "plural", base: "child" }`
- Also: `"mouses" -> { correct: "mice" }`, `"womans" -> { correct: "women" }`
- Edge case: multi-word entries like "birthday child" -> skip (word contains space)

**Key data observations from EN vocab:**
- 200 verbs with `verbClass: "irregular"`, but only ~20 have actual distinct past/participle forms in the data (many are "be X" variants sharing was/were/been)
- True irregular verbs with unique past forms: eat/ate, go/went, run/ran, do/did, have/had, make/made, come/came, write/wrote, take/took, give/gave, etc.
- 1627 nouns have plurals; filtering for true irregulars (not matching `+s`, `+es`, `y->ies`, `f->ves`) yields ~376, but most of these are compound-word false positives (e.g. "ability; skill" -> "abilities" is regular -y->-ies). True irregulars are a small subset: child/children, mouse/mice, man/men, woman/women, person/people, tooth/teeth, foot/feet, goose/geese, ox/oxen, etc.

**Implementation approach:** Build `irregularForms` in `vocab-seam-core.js:buildLookupIndexes()` as a new Map. The rule checks if a token matches a key in `irregularForms` and suggests the correct form. This catches `childs`, `eated`, `goed`, `runned`, `mouses`, `womans`, `mans`, etc.

### Pattern 2: Opaque-Noun Gender Agreement (MORPH-02)
**What:** Extend the existing `es-fr-gender.js` article-noun gender check to also catch adjective-noun gender disagreement on opaque-gender nouns.
**When to use:** When the student uses a masculine adjective form before a feminine noun (or vice versa).

**Current gap analysis:**
- `es-fr-gender.js` checks: `article + [optional adj] + noun` pattern, matching `articles[articleTok.word]` against `nounGenus.get(noun)`
- It already handles "La problème" (article `la` is fem, but `problème` is masc in nounGenus) -- **this should already work with the existing rule**
- The benchmark line 51 has "La problème est que j'oublie les règles" -- need to verify if existing rule catches it

**Verification needed:** Does the tokenizer lowercase `La` -> `la`, and does `nounGenus` have `probleme` (accent-stripped)?

Let me trace: tokenize("La problème") -> [{word:"la",...}, {word:"problème",...}]. In nounGenus, the key would be the lowercase word from the wordList. The noun entry has key `probleme_noun` with `word: "problème"` and `acceptedForms: ["probleme"]`. The `buildLookupIndexes` sets `nounGenus` with `w = entry.word` which is the lowercase of the word field. So `nounGenus.get("problème")` should return `"m"`. The article `la` maps to `f` in ARTICLE_GENUS. So `f !== m` -> should flag.

**Wait -- re-reading the success criteria:** The benchmark says `"La problème"` and `"un bon humeur"` should flip. The first case ("La problème") may already be caught by the existing `es-fr-gender.js` -- if so, MORPH-02's contribution is the second case ("un bon humeur") which involves adjective-noun gender agreement.

For "un bon humeur":
- Tokens: `un` (article, m), `bon` (adjective, masculine form), `humeur` (noun, f)
- Current `es-fr-gender.js` looks at article + noun: `un` + `humeur` where `un` -> m and `humeur` -> f. This SHOULD already flag.
- But there is a window: the rule checks `prev` (one token back) and `prevPrev` (two tokens back) for the article. So for `un bon humeur`, the article `un` is `prevPrev` relative to `humeur` -> it checks `prevPrev.word === "un"` -> `articles["un"] === "m"` -> `nounGenus.get("humeur") === "f"` -> mismatch -> flags.

**So the existing rule may already handle both cases.** If so, MORPH-02's novel contribution would be the **adjective agreement** aspect: not just the article, but also checking that `bon` should be `bonne` before a feminine noun. This is a more specific error students make: they get the article right (maybe) but use the wrong adjective gender form.

**Revised MORPH-02 scope:** The rule should flag both:
1. Article-noun gender mismatch (may already work via existing rule -- verify)
2. Adjective-noun gender agreement -- "bon humeur" should be "bonne humeur"

For adjective gender agreement, FR adjectives generally follow patterns:
- Add -e for feminine (grand/grande, petit/petite)
- bon -> bonne (doubled consonant + e)
- beau -> belle (irregular)
- Already-ending-in-e stays same (facile/facile)

The FR adjective data in `adjectivebank` does NOT have feminine forms. So the rule must either:
(a) Use rule-based morphology for common patterns (add -e, double consonant + e for ~10 common exceptions)
(b) Use a small curated map of masc -> fem for the most common adjectives
(c) Enrich the data at Papertek API (preferred per data-logic-separation philosophy, but takes a separate effort)

**Recommendation:** Use approach (a) with a small inline exception map for irregulars, since FR adjective feminization is highly regular (add -e) with a closed set of exceptions. This keeps data-logic separation clean -- the morphological rule IS the logic, not data.

### Pattern 3: Word-Family POS Confusion (MORPH-03)
**What:** Flag when a student uses a word from the wrong part-of-speech family.
**When to use:** After auxiliary verbs like "have" that require a verb form, but student writes a noun/adjective instead.

**Benchmark target:** "i have improve alot" -- `improve` is the infinitive (correct!) but it should be `improved` (past participle after `have`). Wait -- "improve" IS a verb. The success criteria says this is "noun-in-verb-slot". Let me re-read:

> EN word-family rule flags "i have improve" (noun-in-verb-slot) via closed word-family list and tagged-token POS-slot detection

Actually "improve" here is not a POS confusion -- it's a missing past participle inflection after "have". The student wrote the base form instead of the participle. This is closer to the existing en-grammar modal-verb rule pattern (which checks modal + inflected -> suggest base). Here it's `have` + base-form -> suggest participle.

**Re-analysis:** The MORPH-03 requirement describes word-family confusion (creative/creativity/creation; succeed/success/successful). The benchmark example "i have improve" is about `have + base_form -> should be have + past_participle`. The word-family list provides derivational alternatives (improve/improvement/improving/improved), and the POS-slot detection identifies that after "have" a past-participle is expected.

**Implementation approach:**
1. A closed word-family Map: `"improve" -> { noun: "improvement", verb: "improve", adj: "improved", adv: "improvedly" }` (curated, ~30 families)
2. Slot expectation: after `have/has/had` -> expect past participle (verb-ed form or irregular participle)
3. If the next token is in a word-family and is NOT the verb/participle form, flag it
4. Also handle: "the improve of" (noun slot, should be "improvement"), "very improve" (adj slot, should be "improved")

**The tagged-token POS view** (`ctx.getTagged(i)`) classifies tokens as verb/noun/adj/other based on which bank they appear in. For "improve", if it's in both verbbank and nounbank, the POS is ambiguous. The rule must use syntactic context (what precedes the token) to infer the expected POS.

**Data-logic-separation decision:** The word-family list is a curated closed set of ~30 common derivational families. This is linguistic logic (derivational morphology rules), not data. Per the project's data-logic-separation philosophy (memory `project_data_logic_separation_philosophy.md`), inline constants that fail the "friction test" (would it hurt if they lived in the rule file?) belong in the rule file, not in Papertek API. A 30-item word-family table is low-friction inline.

### Anti-Patterns to Avoid
- **Building irregularForms in the rule file at check time:** Would be O(N) per check invocation. Build once at index time in `vocab-seam-core.js`.
- **Hard-coding irregular verbs/nouns in the rule file:** The data already exists in the vocab. Extract it programmatically.
- **Trying to generate ALL possible wrong forms:** Focus on the most common regular-pattern overgeneralizations that students actually produce: `+ed` for irregular past, `+s/+es` for irregular plurals.
- **Applying FR adjective feminization to all adjectives:** Only check when the adjective precedes a noun whose gender we know from `nounGenus`. Don't check post-nominal adjectives (those are structurally different).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Irregular form detection | Manual list of wrong forms | Generate from existing `verbClass: "irregular"` + `forms.plural` data | Data already in vocab; auto-generation catches all entries |
| FR adjective feminization | Full morphological analyzer | Pattern-based + curated exception map (~15 entries) | FR feminization is highly regular with small closed exception set |
| POS-slot detection | Custom parser | `ctx.getTagged(i)` from INFRA-06 + syntactic context checks | Infrastructure already built in Phase 7 |
| Sentence segmentation | Custom sentence splitter | `Intl.Segmenter` via `ctx.sentences` | Already wired in spell-check-core.js |

## Common Pitfalls

### Pitfall 1: False Positives on Regular Verbs Ending in -ed
**What goes wrong:** A verb like "played" is regular, but if the rule generates `play + ed = played` and also maps it as an "overgeneration", it would false-positive on correct usage.
**Why it happens:** Confusion between generating wrong forms (what to flag) vs correct forms (what to accept).
**How to avoid:** Only generate wrong regular forms for verbs with `verbClass: "irregular"`. Never put correct forms in the irregularForms map.
**Warning signs:** Fixture acceptance tests on regular verbs flag incorrectly.

### Pitfall 2: Multi-Word Verb Entries
**What goes wrong:** EN verbbank has entries like "be afraid", "go away", "be able to, can". Generating `"be afraided"` or `"go awayed"` is nonsensical.
**Why it happens:** The `word` field contains multi-word phrases.
**How to avoid:** Skip entries where `word` contains a space or semicolon.
**Warning signs:** Index contains absurd entries.

### Pitfall 3: Feature-Gate Starvation on New Indexes
**What goes wrong:** New indexes (`irregularForms`, `wordFamilies`) might not survive feature-gating.
**Why it happens:** If built from `wordList` (feature-gated) instead of `unfilteredWordList` or raw data.
**How to avoid:** Build `irregularForms` from raw verbbank/nounbank data directly (like `buildParticipleToAux` does), not from the wordList. Register in `check-spellcheck-features` assertions.
**Warning signs:** `check-spellcheck-features` fails.

### Pitfall 4: Accent-Stripping in FR nounGenus Lookup
**What goes wrong:** Student writes "probleme" (no accent) but nounGenus has key "problème" (with accent).
**Why it happens:** Tokenizer lowercases but does not strip accents. The nounGenus key comes from `entry.word.toLowerCase()`.
**How to avoid:** The existing es-fr-gender.js rule already handles this because `buildLookupIndexes` indexes both the canonical word AND `acceptedForms`. Check that "probleme" (no accent) is in `nounGenus` via `acceptedForms`.
**Warning signs:** FR benchmark "La problème" not flagged despite correct rule logic.

### Pitfall 5: "un bon humeur" -- Article-Only vs Article+Adjective
**What goes wrong:** Existing `es-fr-gender.js` may catch the article mismatch (un/humeur) but not suggest fixing the adjective (bon -> bonne).
**Why it happens:** The rule's fix targets the article, not the adjective.
**How to avoid:** For MORPH-02, the rule should also check adjective agreement between the article and the next noun. When both article AND adjective disagree with the noun's gender, suggest fixing both.
**Warning signs:** Benchmark line flagged but with incomplete suggestion.

### Pitfall 6: "i have improve" -- Overlap with Existing en-grammar Rules
**What goes wrong:** The existing en-grammar rule might already partially handle this (modal verb form check), or the two rules might conflict.
**Why it happens:** "have" is both an auxiliary (triggering participle expectation) and a regular verb.
**How to avoid:** MORPH-03 should check specifically for `have/has/had` + base-form-verb patterns. If the existing en-grammar modal rule already covers this, extend it instead of creating a new rule. Check for dedup priority ordering.
**Warning signs:** Duplicate findings on the same token span.

## Code Examples

### Building irregularForms index in vocab-seam-core.js
```javascript
function buildIrregularForms(raw) {
  const irregularForms = new Map();
  if (!raw) return irregularForms;

  // Verbs: map wrong regular past -> correct irregular past
  if (raw.verbbank) {
    for (const entry of Object.values(raw.verbbank)) {
      if (entry.verbClass !== 'irregular') continue;
      const word = (entry.word || '').toLowerCase().trim();
      if (!word || word.includes(' ') || word.includes(';')) continue;

      const past = entry.conjugations?.past?.former?.simple;
      const participle = entry.conjugations?.perfect?.former?.participle
                      || entry.conjugations?.perfect?.participle;
      if (!past || !participle) continue;

      // Generate wrong regular forms
      const wrongPast = word + 'ed';
      if (past !== wrongPast && !irregularForms.has(wrongPast)) {
        irregularForms.set(wrongPast, { correct: past, type: 'past', base: word });
      }
      // Also: word + 'd' for verbs ending in 'e' (e.g. "come" -> "comed")
      if (word.endsWith('e')) {
        const wrongPastD = word + 'd';
        if (past !== wrongPastD && !irregularForms.has(wrongPastD)) {
          irregularForms.set(wrongPastD, { correct: past, type: 'past', base: word });
        }
      }
    }
  }

  // Nouns: map wrong regular plural -> correct irregular plural
  if (raw.nounbank) {
    for (const entry of Object.values(raw.nounbank)) {
      const word = (entry.word || '').toLowerCase().trim();
      const plural = (entry.plural || '').toLowerCase().trim();
      if (!word || !plural || word.includes(' ') || word.includes(';')) continue;

      // Check if plural is irregular (doesn't follow regular patterns)
      const isRegular = plural === word + 's' || plural === word + 'es'
        || (word.endsWith('y') && plural === word.slice(0, -1) + 'ies');
      if (isRegular) continue;

      // Generate wrong regular forms
      const wrongPlural = word + 's';
      if (plural !== wrongPlural && !irregularForms.has(wrongPlural)) {
        irregularForms.set(wrongPlural, { correct: plural, type: 'plural', base: word });
      }
    }
  }

  return irregularForms;
}
```

### FR adjective gender agreement check pattern
```javascript
// Small curated map for common irregular feminine forms
const FR_ADJ_FEM_IRREGULARS = {
  bon: 'bonne', beau: 'belle', vieux: 'vieille', nouveau: 'nouvelle',
  fou: 'folle', blanc: 'blanche', sec: 'sèche', long: 'longue',
  gros: 'grosse', faux: 'fausse', doux: 'douce', gentil: 'gentille',
  public: 'publique', frais: 'fraiche',
};

function feminize(adj) {
  if (FR_ADJ_FEM_IRREGULARS[adj]) return FR_ADJ_FEM_IRREGULARS[adj];
  if (adj.endsWith('e')) return adj; // already feminine-compatible
  if (adj.endsWith('er')) return adj.slice(0, -2) + 'ère';
  if (adj.endsWith('eux')) return adj.slice(0, -1) + 'se';
  if (adj.endsWith('if')) return adj.slice(0, -1) + 've';
  if (adj.endsWith('el') || adj.endsWith('en') || adj.endsWith('on'))
    return adj + 'ne';
  return adj + 'e'; // default rule
}
```

### Word-family POS-slot detection pattern
```javascript
// After have/has/had, expect past participle
const HAVE_FORMS = new Set(['have', 'has', 'had']);

// Closed word-family map (seed: ~30 families)
const WORD_FAMILIES = new Map([
  ['improve',     { verb: 'improve', noun: 'improvement', adj: 'improved', pp: 'improved' }],
  ['improvement', { verb: 'improve', noun: 'improvement', adj: 'improved', pp: 'improved' }],
  ['create',      { verb: 'create', noun: 'creation', adj: 'creative', pp: 'created' }],
  ['creation',    { verb: 'create', noun: 'creation', adj: 'creative', pp: 'created' }],
  ['creative',    { verb: 'create', noun: 'creation', adj: 'creative', pp: 'created' }],
  // ... etc
]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token-local grammar rules only | POS-tagged token stream (INFRA-06) | Phase 7 | Enables slot-expectation detection for MORPH-03 |
| Article-noun gender only | Article + adjective + noun gender chain | Phase 14 | Catches "un bon humeur" pattern (MORPH-02) |
| All words treated as regular | `verbClass: "irregular"` flag in vocab | Papertek vocab sync | Enables MORPH-01 irregular overgeneration detection |

## Key Data Inventory

### EN Irregular Verb Coverage
- 200 verbs with `verbClass: "irregular"` in en.json
- Many are "be X" variants (be afraid, be able to, be bored) sharing was/were/been -- deduplicate
- ~20 truly distinct irregular verbs with unique past/participle forms in data: eat/ate/eaten, go/went/gone, run/ran/run, do/did/done, have/had/had, make/made/made, come/came/come, write/wrote/written, take/took/taken, give/gave/given, etc.
- Students commonly produce: eated, goed, runned, comed, writed, taked, gived, maked, doed, haved

### EN Irregular Noun Coverage
- 1627 nouns with plurals; true irregulars relevant to MORPH-01: child/children, mouse/mice, man/men, woman/women, person/people, tooth/teeth, foot/feet, goose/geese
- Students commonly produce: childs, mouses, mans, womans, tooths, foots, gooses, peoples (on uncountable "people")

### FR Noun Gender Coverage
- All 1483 FR nouns have `genus` field (m or f)
- probleme_noun: word "problème", genus "m", acceptedForms ["probleme"]
- humeur_noun: word "humeur", genus "f"
- FR adjective data: 365 entries, NO feminine forms stored (only positiv/komparativ/superlativ comparison forms)

### ES Noun Gender Coverage
- ES nounbank has `genus` on nouns (verified in earlier phases)
- ES article-noun gender already handled by es-fr-gender.js

## Open Questions

1. **Does the existing `es-fr-gender.js` already flag "La problème"?**
   - What we know: The rule checks `prev` and `prevPrev` tokens for article, then checks `nounGenus`. "La" maps to `f`, "problème" maps to `m` -> should mismatch.
   - What's unclear: Whether accent handling in the tokenizer/nounGenus correctly matches "problème" with its dict key. The entry has `acceptedForms: ["probleme"]` but we need to verify the index builder adds the accent-stripped form to nounGenus too.
   - Recommendation: Test with the fixture harness before writing new code. If it already works, MORPH-02's novel contribution is adjective-gender agreement only.

2. **Should "i have improve" be handled by MORPH-03 (new word-family rule) or extend existing en-grammar rule?**
   - What we know: en-grammar has a modal-verb check (after modal, use base form). "have" is not a modal. The existing rule has no have+participle check.
   - What's unclear: Whether "have + base form" errors are better modeled as word-family POS confusion or as a missing-inflection error.
   - Recommendation: Handle in MORPH-03's word-family rule since the success criteria explicitly ties it to "word-family POS-slot detection". The `have + base_form -> participle` pattern is the slot-detection trigger; the word-family data provides the correction.

3. **How many word families to seed for MORPH-03?**
   - What we know: Success criteria requires "i have improve" (noun-in-verb-slot) and acceptance fixtures "covering all four family slots (noun / verb / adj / adv)".
   - Recommendation: Start with ~30 high-frequency families that Norwegian EN learners commonly confuse. Focus on families where POS confusion is a documented learner error. Can expand the list in future phases.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: extension/data/en.json verb/noun structure (200 irregular verbs, 1627 nouns with plurals, verbClass field)
- Codebase inspection: extension/data/fr.json noun genus (1483 nouns, all with genus)
- Codebase inspection: extension/content/spell-rules/es-fr-gender.js (existing article-noun gender rule)
- Codebase inspection: extension/content/vocab-seam-core.js (buildLookupIndexes, buildParticipleToAux patterns)
- Codebase inspection: extension/content/spell-check-core.js (tagged-token POS view, getTagged)

### Secondary (MEDIUM confidence)
- FR adjective feminization rules: standard French grammar (add -e, known irregulars)
- EN irregular verb/noun patterns: well-established in language teaching literature

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all infrastructure exists
- Architecture: HIGH - Follows established patterns from Phases 6-13
- Pitfalls: HIGH - Identified from codebase inspection and past phase experience

**Research date:** 2026-04-25
**Valid until:** 2026-05-25
