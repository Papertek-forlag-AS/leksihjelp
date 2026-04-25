# Phase 12: Pronoun & Pro-Drop (ES + FR) - Research

**Researched:** 2026-04-25
**Domain:** ES pronoun governance (pro-drop, gustar-class), FR clitic ordering
**Confidence:** HIGH

## Summary

Phase 12 ships three rules: (1) ES pro-drop-overuse hint flagging redundant subject pronouns before unambiguous verb forms, (2) ES gustar-class syntax flagger catching the Norwegian transfer error of treating gustar as a subject-verb-object construction, and (3) FR double-pronoun clitic-order rule enforcing the fixed cluster order. All three rules are hint or warn severity -- never error.

The infrastructure is already in place. `esPresensToVerb` (from Phase 11 vocab-seam) maps conjugated present forms back to `{ inf, person }` where `person` is one of `yo`, `tu`, `el/ella`, `nosotros`, `vosotros`, `ellos/ellas`. The `SUBJECT_PRONOUNS.es` set in `spell-check-core.js` already lists all ES subject pronouns. The tagged-token view (`ctx.getTagged(i).isSubject`) identifies subject-pronoun tokens. FR clitics are a grammar-level closed class that can live inline in the rule file.

**Primary recommendation:** Three independent rule files, one grammar-tables addition (ES_GUSTAR_CLASS_VERBS), no new vocab-seam indexes, no Papertek API changes. Plan as three sequential plans: (1) grammar-tables + CSS + release-gate wiring, (2) ES pro-drop + gustar rules, (3) FR clitic-order rule.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRON-01 | ES pro-drop-overuse warn when subject pronoun appears with unambiguous verb agreement | `esPresensToVerb` already maps conjugated forms to person (`yo`, `tu`, etc.); `SUBJECT_PRONOUNS.es` set already exists; rule compares pronoun token with verb person tag |
| PRON-02 | ES gustar-class syntax flagged when subject+gustar pattern used instead of dative | `gustar` is in verbbank with normal conjugation; ~15 gustar-class verbs go in `grammar-tables.js` as `ES_GUSTAR_CLASS_VERBS` Set; detection is sentence-local |
| PRON-03 | FR clitic-order rule flagging wrong cluster ordering | FR object clitics are a closed set of ~12 forms; rank table is stable grammar-level data; inline in rule file per data-logic-separation philosophy |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (IIFE) | ES2020 | Rule files | Project convention -- no npm deps in extension |
| `grammar-tables.js` | Phase 8+ | Shared closed-set data | Consumed by all structural rules; `ES_GUSTAR_CLASS_VERBS` added here |
| `vocab-seam-core.js` | Phase 11 | `esPresensToVerb` index | Maps conjugated present/preteritum to `{ inf, person }` |
| `spell-check-core.js` | Phase 7 | `SUBJECT_PRONOUNS.es`, `tokensInSentence`, `getTagged` | Tagged-token view with `isSubject` field |

### No New Dependencies
Phase 12 requires zero new npm packages, zero new vocab-seam indexes, and zero Papertek API changes. All data is either already indexed or belongs in a grammar-tables closed set.

## Architecture Patterns

### New Rule Files
```
extension/content/spell-rules/
  es-pro-drop.js          # PRON-01: pro-drop-overuse hint
  es-gustar.js            # PRON-02: gustar-class syntax flagger
  fr-clitic-order.js      # PRON-03: double-pronoun clitic ordering
```

### Grammar Tables Addition
```javascript
// In grammar-tables.js — ~15 verbs that behave like gustar
// (dative experiencer + nominative theme, NOT subject-verb-object)
const ES_GUSTAR_CLASS_VERBS = new Set([
  'gustar', 'encantar', 'interesar', 'importar', 'molestar',
  'fascinar', 'aburrir', 'doler', 'faltar', 'sobrar',
  'parecer', 'quedar', 'apetecer', 'costar', 'bastar',
]);
```

### Pattern: PRON-01 Pro-Drop Detection Algorithm

The detection is straightforward because `esPresensToVerb` already encodes person:

1. Iterate sentence tokens. When a subject pronoun is found (via `SUBJECT_PRONOUNS.es`), check if the next non-filler token is a known conjugated verb form.
2. Look up the verb in `esPresensToVerb` (or `esPreteritumToVerb` for past forms). The returned `person` field uses labels like `yo`, `tu`, `el/ella`, `nosotros`, `vosotros`, `ellos/ellas`.
3. Build a mapping from subject pronoun to person label: `yo -> yo`, `tu/tu -> tu`, `el/ella/usted -> el/ella`, `nosotros/nosotras -> nosotros`, `vosotros/vosotras -> vosotros`, `ellos/ellas/ustedes -> ellos/ellas`.
4. If the pronoun's person matches the verb's person label, the pronoun is redundant -- flag at hint severity with suggestion to drop it.
5. Guard: Only flag 1st person singular (`yo`) and 2nd person singular (`tu`) initially -- these are the most common Norwegian transfer errors. 3rd person pronouns are more often contrastive/emphatic and have higher FP risk.

**Key data relationship verified:** `esPresensToVerb.get('voy')` returns `{ inf: 'ir', person: 'yo' }`. The person key matches the pronoun token directly for `yo`, making the comparison trivial.

**Preteritum coverage:** `esPreteritumToVerb` has the same shape. The rule should also check preteritum forms to catch "yo fui" (benchmark line 27/34).

**FP guard -- sentence-initial position:** "Yo pienso que..." at sentence start is STILL flagged per the requirements. The rule does not exempt sentence-initial position -- the pedagogical goal is to teach that pro-drop is the default. However, contrastive uses (e.g., "Yo voy, ella no") should ideally be exempt. A safe heuristic: if the sentence contains a second subject pronoun (contrastive context), skip the finding. This is discretionary -- start with the simple "always flag yo/tu + matching verb" approach, which the benchmark lines require.

### Pattern: PRON-02 Gustar-Class Detection Algorithm

Norwegian students write "Yo gusto la pizza" (I like the pizza) using SVO order, when Spanish requires "Me gusta la pizza" (the pizza pleases me). The detection pattern:

1. For each sentence, scan for conjugated forms of gustar-class verbs (check `esPresensToVerb` or raw token matching against a forms table).
2. If a subject pronoun immediately precedes or is within 2 tokens of a gustar-class verb form, and no dative clitic (`me/te/le/nos/os/les`) appears before the verb, flag the construction.
3. Specific detection for "El no gusta ayudar" pattern: subject pronoun + optional `no` + gustar-class verb + infinitive/noun.
4. Suggestion copy should propose the dative restructuring: "A el no le gusta ayudar".

**Simpler approach:** Since the error pattern is specifically "subject + [no] + gustar-verb", and the correct pattern always has a dative clitic before the verb:
- If a gustar-class verb form is found AND no dative clitic (`me/te/le/nos/os/les`) appears in the 1-3 tokens before the verb, flag it.
- The absence of the dative clitic is the signal, not the presence of the subject pronoun.

**Conjugation detection:** Gustar-class verbs in student text almost always appear in 3sg (`gusta`) or 3pl (`gustan`). The rule can build a forms set from `esPresensToVerb` by filtering entries whose `inf` is in `ES_GUSTAR_CLASS_VERBS`.

### Pattern: PRON-03 FR Clitic-Order Detection Algorithm

French object pronoun clitics have a fixed order before the verb:

```
me/te/se/nous/vous (rank 1) < le/la/les (rank 2) < lui/leur (rank 3) < y (rank 4) < en (rank 5)
```

Students (especially Norwegian ones) often write "je lui le donne" instead of "je le lui donne".

Detection:
1. Build a rank table mapping each clitic to its rank number.
2. For each sentence, scan for consecutive clitic tokens before a verb.
3. If two or more clitics appear and their ranks are not in ascending order, flag the cluster.
4. The suggestion reorders the clitics to the correct rank order.

**Rank table (inline in rule file):**
```javascript
const FR_CLITIC_RANKS = {
  me: 1, te: 1, se: 1, nous: 1, vous: 1,
  le: 2, la: 2, les: 2,
  lui: 3, leur: 3,
  y: 4,
  en: 5,
};
```

**Guard: nous/vous ambiguity.** `nous` and `vous` can be either rank-1 (reflexive/indirect) or rank-1 (they always come first regardless). This is not an issue for ordering since rank 1 is always first. But `nous`/`vous` can also be subject pronouns -- the rule must only consider `nous`/`vous` as clitics when they appear between a subject pronoun and a verb (or between another clitic and a verb).

**Guard: `le/la/les` as articles.** These tokens are also definite articles. Only treat them as clitics when they appear in a pre-verbal clitic cluster (i.e., between a subject/other-clitic and a finite verb, with no noun following before the verb).

**Practical approach:** Identify a verb token (via `ctx.getTagged(i).isFinite`), then walk backwards collecting tokens that are in `FR_CLITIC_RANKS`. If 2+ clitics are found in descending-rank order, flag. Stop walking back when hitting a subject pronoun, a non-clitic, or sentence start.

### Anti-Patterns to Avoid
- **Over-engineering person matching for pro-drop:** The person labels in `esPresensToVerb` already use `yo`, `tu`, etc. -- directly comparable to the pronoun token. Do NOT build a separate person-normalization layer.
- **Gustar with full conjugation table:** Do NOT build a separate conjugation index for gustar-class verbs. Reuse `esPresensToVerb` filtered by infinitive.
- **FR clitic rule trying to handle imperative affirmative:** In imperatives, clitic order reverses ("donne-le-moi" not "donne-moi-le"). This is a different construction entirely. The Phase 12 rule should only check pre-verbal clitics in indicative/subjunctive clauses. Skip tokens after hyphens in verb-clitic compounds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ES verb person detection | Custom conjugation parser | `esPresensToVerb` + `esPreteritumToVerb` from vocab-seam | Already built, tested, accent-stripped |
| ES subject pronoun identification | Custom pronoun list | `SUBJECT_PRONOUNS.es` in spell-check-core.js | Already in tagged-token view |
| Sentence boundary detection | Custom splitter | `ctx.sentences` + `tokensInSentence` | Phase 6 infrastructure |
| Verb detection for FR clitics | Custom verb finder | `ctx.getTagged(i).isFinite` | Phase 7 tagged-token view |

## Common Pitfalls

### Pitfall 1: Pro-Drop False Positives on Contrastive/Emphatic Use
**What goes wrong:** Flagging "Yo creo que si, pero ella no" where `yo` is contrastive.
**Why it happens:** Pro-drop is optional when the pronoun adds emphasis or contrast.
**How to avoid:** Start by flagging only `yo` + unambiguous 1sg verb. Accept that some contrastive uses will be flagged -- at hint severity, this is acceptable. The pedagogical value (Norwegian students overuse `yo` by default) outweighs occasional false hints. If needed later, add a contrastive guard (second subject pronoun in same sentence).
**Warning signs:** FP rate on acceptance fixtures exceeds 15%.

### Pitfall 2: Gustar "gusta" Matched as Regular Verb
**What goes wrong:** `esPresensToVerb` maps `gusta` to `{ inf: 'gustar', person: 'el/ella' }`. If the rule checks for "subject pronoun + verb", a legitimate "A Maria le gusta leer" has no subject pronoun, so it would NOT false-fire. But "El gusta la pizza" (wrong) has `el` as a subject pronoun, and `gusta` as a gustar-class verb -- correct detection.
**How to avoid:** The absence-of-dative-clitic check is the key signal. "Le gusta" has a clitic; "gusta" bare or after a subject pronoun does not.

### Pitfall 3: FR `le/la/les` Article vs Clitic Ambiguity
**What goes wrong:** "Je le livre donne" -- `le` here is an article before `livre`, not a clitic.
**Why it happens:** `le/la/les` serve double duty as articles and clitics.
**How to avoid:** Only identify tokens as clitics when they appear in a pre-verbal window with no intervening noun. Walk backwards from the finite verb; if a token matches `FR_CLITIC_RANKS` AND is immediately followed by another clitic or the verb, treat as clitic. If followed by a noun, it's an article.

### Pitfall 4: FR `nous`/`vous` Subject vs Clitic
**What goes wrong:** "nous vous donnons" -- `nous` is the subject, `vous` is the indirect-object clitic. The rule might try to reorder them.
**Why it happens:** `nous`/`vous` appear in both `SUBJECT_PRONOUNS.fr` and `FR_CLITIC_RANKS`.
**How to avoid:** When walking backwards from a verb to collect clitics, stop at the first token that is a subject pronoun. The subject pronoun is excluded from the clitic cluster. If `nous`/`vous` is in subject position (tagged `isSubject` or sentence-initial before verb), exclude it.

### Pitfall 5: Benchmark Line "yo fui" Requires Preteritum Coverage
**What goes wrong:** Pro-drop rule only checks `esPresensToVerb` and misses `fui`.
**Why it happens:** `fui` is preteritum, not present tense.
**How to avoid:** The rule MUST also consult `esPreteritumToVerb`. Benchmark lines 27 and 34 both contain "yo fui" which must flip.

### Pitfall 6: Gustar Benchmark Line Has "no" Between Subject and Verb
**What goes wrong:** "El no gusta ayudar" -- `no` sits between subject `el` and verb `gusta`.
**Why it happens:** Negation particle between subject and verb is common.
**How to avoid:** When scanning for subject+verb patterns, allow intervening `no`/`nunca`/`tampoco` between the subject pronoun and the verb.

## Code Examples

### PRON-01: Pro-Drop Core Detection
```javascript
// Mapping subject pronouns to the person label used by esPresensToVerb
const PRONOUN_TO_PERSON = {
  yo: 'yo',
  tu: 'tú', tú: 'tú',
  el: 'él/ella', él: 'él/ella', ella: 'él/ella', usted: 'él/ella',
  nosotros: 'nosotros', nosotras: 'nosotros',
  vosotros: 'vosotros', vosotras: 'vosotros',
  ellos: 'ellos/ellas', ellas: 'ellos/ellas', ustedes: 'ellos/ellas',
};

// In check(ctx):
// For each token that is a subject pronoun, scan forward for verbs.
// If verb person matches pronoun person, flag as redundant.
const personLabel = PRONOUN_TO_PERSON[pronoun.toLowerCase()];
const verbInfo = esPresensToVerb.get(verbToken) || esPreteritumToVerb.get(verbToken);
if (verbInfo && verbInfo.person === personLabel) {
  // Redundant subject pronoun -- flag at hint
}
```

### PRON-02: Gustar Dative-Clitic Check
```javascript
const ES_DATIVE_CLITICS = new Set(['me', 'te', 'le', 'nos', 'os', 'les']);

// Walk 1-3 tokens before the gustar-class verb form.
// If no dative clitic found, this is likely a SVO-transfer error.
let hasDative = false;
for (let k = verbIdx - 1; k >= Math.max(range.start, verbIdx - 3); k--) {
  if (ES_DATIVE_CLITICS.has(ctx.tokens[k].word)) { hasDative = true; break; }
}
if (!hasDative) {
  // Flag: subject-verb pattern without dative clitic
}
```

### PRON-03: FR Clitic-Order Walk-Back
```javascript
// Walk backwards from finite verb, collecting clitics
const clitics = []; // { idx, rank, token }
for (let k = verbIdx - 1; k >= range.start; k--) {
  const w = ctx.tokens[k].word.toLowerCase();
  const rank = FR_CLITIC_RANKS[w];
  if (rank !== undefined) {
    // Guard: if next token (k+1) is a noun (not a clitic/verb), this is an article
    if (w === 'le' || w === 'la' || w === 'les') {
      const next = ctx.tokens[k + 1];
      if (next && ctx.getTagged(k + 1).pos === 'noun') break; // article, stop
    }
    clitics.unshift({ idx: k, rank, word: w });
  } else if (SUBJECT_PRONOUNS_FR.has(w)) {
    break; // hit subject pronoun, stop collecting
  } else {
    break; // non-clitic token, stop
  }
}
// Check if ranks are ascending
if (clitics.length >= 2) {
  for (let i = 1; i < clitics.length; i++) {
    if (clitics[i].rank < clitics[i - 1].rank) {
      // Wrong order -- flag and suggest reorder
    }
  }
}
```

## Priority and Severity Assignment

| Rule | ID | Priority | Severity | CSS Class | Dot Style |
|------|----|----------|----------|-----------|-----------|
| ES pro-drop | `es-pro-drop` | 65 | hint | `.lh-spell-es-pro-drop` | P3 grey dotted underline |
| ES gustar-class | `es-gustar` | 60 | warning | `.lh-spell-es-gustar` | P2 amber dot |
| FR clitic-order | `fr-clitic-order` | 60 | warning | `.lh-spell-fr-clitic-order` | P2 amber dot |

**Rationale:**
- Pro-drop is a stylistic preference (Spanish allows the pronoun, it's just redundant) -- hint severity is correct.
- Gustar-class is a genuine grammatical error (wrong sentence structure) -- warning severity.
- FR clitic order is a structural grammar error -- warning severity.

## CSS Bindings Needed

```css
/* Phase 12 PRON-01: ES pro-drop hint */
#lexi-spell-overlay .lh-spell-es-pro-drop { background: none; border-bottom: 2px dotted #94a3b8; }

/* Phase 12 PRON-02: ES gustar-class warning */
#lexi-spell-overlay .lh-spell-es-gustar { background: #f59e0b; }

/* Phase 12 PRON-03: FR clitic-order warning */
#lexi-spell-overlay .lh-spell-fr-clitic-order { background: #f59e0b; }
```

## Benchmark Expectations to Add

```json
{
  "es.27": { "rule_id": "es-pro-drop", "severity": "hint", "priority_band": "P3" },
  "es.34": { "rule_id": "es-pro-drop", "severity": "hint", "priority_band": "P3" },
  "es.39": { "rule_id": "es-pro-drop", "severity": "hint", "priority_band": "P3" },
  "es.41": { "rule_id": "es-pro-drop", "severity": "hint", "priority_band": "P3" },
  "es.32": { "rule_id": "es-gustar", "severity": "warning", "priority_band": "P2" }
}
```

**Important:** Lines es.27 and es.34 already have `es-por-para` expectations. Multiple rules can fire on the same line -- the benchmark expectations file supports this. The pro-drop findings and por-para findings will be at different token positions (different start/end), so deduplication won't suppress either.

**FR clitic-order:** No benchmark line exists in `fr.txt` with wrong clitic order. The success criteria specifies using acceptance fixtures ("je le lui donne" NOT flagging, "je lui le donne" flagging). A benchmark line should be added to `fr.txt` if the planner decides to add FR benchmark coverage, but fixtures alone satisfy the stated success criteria.

## Manifest Wiring

Three new rule files must be added to `extension/manifest.json` content_scripts:
```
"content/spell-rules/es-pro-drop.js",
"content/spell-rules/es-gustar.js",
"content/spell-rules/fr-clitic-order.js",
```

**Note:** Phase 11 rules (`es-subjuntivo.js`, `es-imperfecto-hint.js`, `fr-subjonctif.js`) are also not yet in the manifest. The planner should verify whether Phase 11 wiring was completed or needs to be included in Phase 12's first plan.

## Release Gate Updates

### check-explain-contract TARGETS
Add three entries:
```
'extension/content/spell-rules/es-pro-drop.js',
'extension/content/spell-rules/es-gustar.js',
'extension/content/spell-rules/fr-clitic-order.js',
```

### check-rule-css-wiring TARGETS
Same three entries (mirrors check-explain-contract).

### check-benchmark-coverage expectations.json
Add entries for pro-drop on es.27, es.34, es.39, es.41 and gustar on es.32.

### check-spellcheck-features
No new indexes -- `esPresensToVerb` and `esPreteritumToVerb` are already validated. No extension needed.

## Fixture Requirements

Per cross-cutting constraints: >= 30 positive + >= 15 acceptance per language per rule, with >= 2x acceptance-vs-positive ratio.

| Rule | Positive Fixtures | Acceptance Fixtures | Notes |
|------|-------------------|---------------------|-------|
| es-pro-drop | >= 30 | >= 60 | Acceptance: contrastive use, emphatic, 3rd person, no pronoun |
| es-gustar | >= 30 | >= 60 | Acceptance: correct "me gusta", "le gusta", "nos gusta" |
| fr-clitic-order | >= 30 | >= 60 | Acceptance: correct order "je le lui donne", single clitics |

## Open Questions

1. **Should pro-drop flag 3rd person pronouns (`el`, `ella`, `ellos`)?**
   - What we know: 3rd person pronouns are more often contrastive/emphatic in natural Spanish.
   - What's unclear: Whether Norwegian students overuse 3rd person pronouns as much as `yo`.
   - Recommendation: Start with `yo` and `tu` only (highest-confidence redundancy). 3rd person can be added later if FP rate is acceptable. Benchmark line "Yo pienso" and "yo voy" only test 1sg. But benchmark line "yo fui" on line 34 also needs coverage.

2. **FR benchmark line for clitic-order?**
   - What we know: `fr.txt` line 25 comments mention "je le lui donne" vs "je lui le donne" but no benchmark line exists in the text body.
   - Recommendation: Add a benchmark line to `fr.txt` with wrong clitic order (e.g., "Elle lui le montre" or "Je lui le donne"). This enables `check-benchmark-coverage` validation. If not added, only fixture-level validation applies.

## Sources

### Primary (HIGH confidence)
- `extension/content/vocab-seam-core.js` lines 833-936 -- `buildMoodIndexes` function, `esPresensToVerb` returns `{ inf, person }` with person labels `yo/tu/el-ella/nosotros/vosotros/ellos-ellas`
- `extension/content/spell-check-core.js` lines 63-69 -- `SUBJECT_PRONOUNS.es` already contains all subject pronouns
- `extension/data/es.json` verbbank -- verified `gustar` entry with standard conjugation, `ir` person labels confirmed
- `extension/content/spell-rules/grammar-tables.js` -- established pattern for adding closed-set tables
- `extension/content/spell-rules/es-subjuntivo.js` -- template for ES sentence-scanning rule with `tokensInSentence`
- `benchmark-texts/es.txt` -- verified benchmark lines exist at lines 27, 32, 34, 39, 41

### Secondary (MEDIUM confidence)
- FR clitic ordering rules are stable grammar (rank ordering documented in all reference grammars: me/te/se/nous/vous < le/la/les < lui/leur < y < en)
- Gustar-class verb list (~15 verbs) is well-established in Spanish pedagogy (A1-B1 curriculum)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all infrastructure already exists, no new deps
- Architecture: HIGH -- follows established rule-file patterns from Phases 9-11
- Pitfalls: HIGH -- FP risks are well-understood; article-vs-clitic ambiguity is the main FR challenge

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (stable -- no moving dependencies)
