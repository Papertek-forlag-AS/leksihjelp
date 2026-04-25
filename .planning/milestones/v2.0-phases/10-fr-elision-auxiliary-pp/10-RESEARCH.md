# Phase 10: FR Elision, Auxiliary, Participe Passe - Research

**Researched:** 2026-04-25
**Domain:** French grammar rules (elision, etre/avoir auxiliary, PP agreement)
**Confidence:** HIGH

## Summary

Phase 10 ships three French structural grammar rules: elision before vowels/silent-h (FR-01), etre vs avoir auxiliary choice in passe compose (FR-02), and adjacent-window participe passe agreement behind an opt-in toggle (FR-03). All three rules follow established patterns from Phases 8-9 (DE perfekt-aux, ES ser/estar) with well-understood infrastructure.

The existing `fr-contraction.js` (priority 15) already handles `le/la` + vowel -> `l'`. FR-01 expands elision to the full closed set of clitics (`je/que/si/ne/me/te/se/de`). The key architectural decision is whether to expand the existing rule or create a new `fr-elision.js` file. Recommendation: **new file** (`fr-elision.js`) to keep the contraction rule's `de le -> du` / `a le -> au` logic separate from the broader elision rule, avoiding priority/suppression conflicts.

FR-02 (etre/avoir) closely mirrors `de-perfekt-aux.js` but reads from `passe_compose` rather than `perfektum` in the verb data. The vocab seam's `buildParticipleToAux` currently only reads `conjugations.perfektum` -- it must be extended to also read `conjugations.passe_compose` for FR. The bundled `fr.json` has 13 etre verbs; 4 DR MRS VANDERTRAMP verbs are missing from data (devenir, naitre, rentrer, retourner) and must be covered by a hardcoded fallback set in `grammar-tables.js`.

**Primary recommendation:** Three new rule files (`fr-elision.js`, `fr-etre-avoir.js`, `fr-pp-agreement.js`) plus grammar-tables.js expansion and a one-line seam fix in `buildParticipleToAux`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FR-01 | FR elision flagged when closed-set clitic + vowel/silent-h onset without apostrophe | New `fr-elision.js` rule file; closed CLITIC_SET with per-clitic elided forms; h-aspire exception list; benchmark lines 37, 49, 50, 52 |
| FR-02 | FR etre vs avoir auxiliary flagged using DR MRS VANDERTRAMP set + pronominal verbs | New `fr-etre-avoir.js` rule file; extend `buildParticipleToAux` to read `passe_compose`; supplement missing data verbs via hardcoded ETRE_VERBS in grammar-tables.js; add benchmark line for `j'ai alle` |
| FR-03 | FR participe passe agreement (10.3a adjacent-window) behind `grammar_fr_pp_agreement` toggle | New `fr-pp-agreement.js` rule file; adjacent-window `[DO-pronoun][avoir-form][mis-agreed-PP]` detection; feature toggle in grammarfeatures-fr.json; 10.3b deferred |
</phase_requirements>

## Standard Stack

### Core

No new dependencies. All three rules use:

| Component | Location | Purpose |
|-----------|----------|---------|
| Spell-rule IIFE pattern | `extension/content/spell-rules/*.js` | Self-registering rule files |
| grammar-tables.js | `extension/content/spell-rules/grammar-tables.js` | Shared lookup tables on `self.__lexiGrammarTables` |
| vocab-seam-core.js | `extension/content/vocab-seam-core.js` | `buildParticipleToAux` for participle -> auxiliary mapping |
| spell-check-core.js | `extension/content/spell-check-core.js` | Rule runner, tokenizer, tagged-token view |

### Supporting

| Component | Purpose |
|-----------|---------|
| `check-explain-contract.js` TARGETS | Must add 3 new rule files |
| `check-rule-css-wiring.js` TARGETS | Must add 3 new CSS bindings |
| `expectations.json` | Must add benchmark expectations for FR elision + auxiliary lines |
| `fixtures/fr/` | Must add fixture files for each rule |

## Architecture Patterns

### Pattern 1: Elision Rule (FR-01, new file `fr-elision.js`)

**What:** Flags `clitic + vowel/h-muet-onset` without apostrophe.
**Priority:** 14 (just below fr-contraction at 15, so elision fires first and fr-contraction deduplicates via overlap suppression)
**Severity:** error (P1 -- elision is a hard structural requirement in French, not stylistic)

**Closed clitic set with elided forms:**

```javascript
const ELISION_CLITICS = {
  je:  { elided: "j'",  beforeAll: true },  // je + vowel -> j'
  me:  { elided: "m'",  beforeAll: true },
  te:  { elided: "t'",  beforeAll: true },
  se:  { elided: "s'",  beforeAll: true },
  le:  { elided: "l'",  beforeAll: true },  // overlaps fr-contraction -- handle dedup
  la:  { elided: "l'",  beforeAll: true },  // overlaps fr-contraction
  de:  { elided: "d'",  beforeAll: true },
  ne:  { elided: "n'",  beforeAll: true },
  que: { elided: "qu'", beforeAll: true },
  si:  { elided: "s'",  beforeOnly: new Set(['il', 'ils']) }, // si ONLY elides before il/ils
};
```

**h-aspire exception list** (no elision before these words):

```javascript
const H_ASPIRE = new Set([
  'hache', 'haie', 'haine', 'hall', 'halte', 'hamac', 'hameau',
  'hamster', 'hanche', 'handicap', 'hangar', 'hanter', 'harangue',
  'harceler', 'hardi', 'hareng', 'haricot', 'harpe', 'hasard',
  'haste', 'hausse', 'haut', 'heros', 'hetre', 'hibou', 'hisser',
  'hocher', 'hockey', 'hollande', 'homard', 'honte', 'hoquet',
  'horde', 'hors', 'housse', 'hublot', 'huee', 'hurler', 'hussard',
  'hutte', 'hameau', 'hauteur', 'hennir',
]);
```

**Overlap with existing fr-contraction.js:** Both rules flag `le/la + vowel`. Two options:
1. **Remove le/la from fr-contraction** and let fr-elision own all elision, leaving fr-contraction for only `de le -> du` / `a le -> au` / `de les -> des` contractions.
2. **Let both fire** and rely on dedupeOverlapping (lower priority wins on same span).

Recommendation: **Option 1** -- cleaner separation. Review fr-contraction.js to check if removing le/la vowel-onset handling leaves only the preposition contractions.

**Tokenization concern:** The `WORD_RE` regex in spell-check-core.js (`/[\p{L}]+(?:'[\p{L}]+)*/gu`) treats apostrophe+word as a single token (`j'ai` = one token). This means correctly-written elisions like `j'ai` are already one token. The rule needs to flag cases where two SEPARATE tokens appear: `[je] [ai]` -- this naturally works because `je` and `ai` are separate tokens when the apostrophe is missing.

**Acceptance fixtures needed:**
- `j'ai` -- already elided, must NOT flag (single token, natural)
- `s'il` -- already elided, must NOT flag
- `l'homme` -- already elided, must NOT flag

### Pattern 2: Etre/Avoir Auxiliary Rule (FR-02, new file `fr-etre-avoir.js`)

**What:** Flags avoir-form + participle when verb requires etre (and vice versa).
**Priority:** 70 (same tier as de-perfekt-aux)
**Severity:** warning (P2 -- amber dot, same as DE-03)

**Direct analog of `de-perfekt-aux.js`:**
1. Build AVOIR_FORMS and ETRE_FORMS conjugation maps (parallel to HABEN_FORMS/SEIN_FORMS)
2. On each token, check if it matches an auxiliary form
3. Scan forward up to 5 tokens for a known participle
4. Check if participle's required auxiliary matches the used one

**FR avoir conjugations:**
```
Present: ai, as, a, avons, avez, ont
Imparfait: avais, avais, avait, avions, aviez, avaient
```

**FR etre conjugations:**
```
Present: suis, es, est, sommes, etes, sont
Imparfait: etais, etais, etait, etions, etiez, etaient
```

**Ambiguity:** `es` is both etre 2nd person AND Spanish word; `a` is avoir 3rd person AND preposition. Language filter (`ctx.lang !== 'fr'`) handles the ES collision. The `a` preposition collision is manageable because the rule requires `a` + participle-within-5-tokens, which is unlikely for the preposition.

**Ambiguity `est`:** `est` is etre 3rd person. `"il est alle"` = correct (aller takes etre). `"il est mange"` = false positive risk (manger takes avoir, but "il est mange par le loup" = passive voice, which is valid). Recommendation: skip passive-voice detection in 10.3a scope; the avoir->etre direction (flagging avoir where etre required) is the high-value student error. Flag etre->avoir direction only with high confidence.

**Data gap:** `buildParticipleToAux` in `vocab-seam-core.js` (line 807-819) reads `entry.conjugations.perfektum` (DE key). FR uses `entry.conjugations.passe_compose`. Fix: extend the function to check both keys.

**Missing DR MRS VANDERTRAMP verbs:** The bundled `fr.json` has 13 etre verbs but is missing 4: devenir, naitre, rentrer, retourner. Add a hardcoded `FR_ETRE_VERBS` set in `grammar-tables.js` as a fallback/supplement. The rule should check both the data-driven `participleToAux` Map AND the hardcoded set.

**Known participle patterns for hardcoded fallback:**
```
devenir -> devenu, naitre -> ne, rentrer -> rentre, retourner -> retourne
```

### Pattern 3: PP Agreement Rule (FR-03, new file `fr-pp-agreement.js`)

**What:** Flags gender/number mismatch on past participle when preceding direct-object pronoun is adjacent.
**Priority:** 72 (just above etre/avoir at 70)
**Severity:** hint (P3 -- this is a notoriously difficult area; behind opt-in toggle)
**Feature toggle:** `grammar_fr_pp_agreement` -- defaults OFF in grammarfeatures-fr.json

**10.3a adjacent-window scope only:**
- Pattern: `[DO-pronoun] [avoir-form] [past-participle]` where DO-pronoun is `la`, `les`, `l'`, or `que`
- When `la` precedes avoir + PP, the PP must agree feminine singular: `la [avoir] [PP-e]`
- When `les` precedes avoir + PP, the PP must agree plural: `les [avoir] [PP-s/-es]`
- Example: `la pomme, je l'ai mange` -> `la pomme, je l'ai mangee` (agree with la pomme = fem)

**10.3b deferred cases (documented but NOT implemented):**
- Distance > adjacent window (relative clause: `la pomme que j'ai mangee`)
- Pronominal verbs with reflexive DO
- Elided DO (`l'` requiring gender inference from antecedent)

**Implementation constraint:** Because `l'` elision hides gender, the rule can only fire with certainty on `la` (feminine) and `les` (plural). `l'` would require antecedent resolution -- defer to 10.3b. `que` as DO pronoun also requires distance resolution -- defer.

**Simplified 10.3a detection:**
1. If `la` + avoir-form + PP without `-e` ending -> flag
2. If `les` + avoir-form + PP without `-s` ending -> flag
3. `l'`/`que` cases -> skip (10.3b)

This is narrow but high-precision, matching the success criteria's `precision >= 0.95` requirement.

### Anti-Patterns to Avoid

- **Over-elision on h-aspire:** The current `fr-contraction.js` treats ALL h-initial words as requiring contraction (`// Most words starting with 'h' in French are silent (h muet)`). This is a known FP source. FR-01 MUST include the h-aspire exception set to avoid this regression.
- **Passive voice false positives on FR-02:** `"il est mange par le loup"` is grammatically correct passive voice. Do not flag etre + avoir-verb participle as wrong auxiliary without checking for passive context. Simplest guard: only flag `avoir-form + etre-verb-participle` direction (the high-confidence student error); skip the reverse.
- **Feature-toggle leakage on FR-03:** The PP agreement rule must gate on `ctx.vocab.isFeatureEnabled('grammar_fr_pp_agreement')`. Other rules (FR-01, FR-02) should NOT be behind toggles -- they are always-on structural rules.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Participle->auxiliary mapping | Custom FR-only map | Extend `buildParticipleToAux` in vocab-seam-core.js | Reuses Phase 8 infra; single source of truth for DE+FR |
| Shared auxiliary tables | Inline conjugation sets | `grammar-tables.js` exports | Phase 8/9 established pattern; all structural rules share tables |
| Sentence boundaries | Custom regex split | `ctx.sentences` from Intl.Segmenter | Phase 6 infra, already wired |
| Tagged-token POS | Custom tagger | `ctx.getTagged(i)` | Phase 7 INFRA-06, already available |

## Common Pitfalls

### Pitfall 1: Tokenizer treats apostrophe-words as single tokens

**What goes wrong:** `j'ai` is tokenized as ONE token by WORD_RE (`[\p{L}]+(?:'[\p{L}]+)*`). The elision rule needs to flag `je ai` (two tokens), NOT `j'ai` (one token -- already correct).
**Why it happens:** The regex includes `(?:'[\p{L}]+)*` which greedily matches apostrophe continuations.
**How to avoid:** The rule naturally works: correctly-elided forms are single tokens and never enter the two-token check. Only missing-elision forms (two separate tokens) are visible to the rule.
**Warning signs:** Acceptance fixtures for `j'ai`, `s'il`, `l'homme` should all pass (no flag). If they flag, the tokenizer contract was misunderstood.

### Pitfall 2: Overlap between fr-elision and fr-contraction on le/la

**What goes wrong:** Both rules flag `le ami` -> different suggestions.
**Why it happens:** fr-contraction already handles `le/la + vowel -> l'` at priority 15. A new fr-elision at priority 14 would fire first on the same span, then fr-contraction would also fire and dedupeOverlapping would keep only the first.
**How to avoid:** Either (a) remove le/la vowel handling from fr-contraction or (b) explicitly accept the dedup behavior. Option (a) is cleaner -- fr-contraction should only own prepositional contractions (`de le -> du`, `a le -> au`, `de les -> des`).
**Warning signs:** Duplicate findings on `le ami` in fixture output.

### Pitfall 3: `si` only elides before `il`/`ils`

**What goes wrong:** Flagging `si elle` as needing elision (wrong -- `si` only contracts before `il`/`ils`).
**Why it happens:** Treating all clitics uniformly.
**How to avoid:** The ELISION_CLITICS table has a `beforeOnly` field for `si` that restricts elision to `il`/`ils`. Must check this field.
**Warning signs:** Fixture `si elle pleut` acceptance case would fail.

### Pitfall 4: buildParticipleToAux reads `perfektum` only

**What goes wrong:** FR participle->auxiliary Map is empty because FR uses `passe_compose` not `perfektum`.
**Why it happens:** Function was written for DE in Phase 8.
**How to avoid:** Extend `buildParticipleToAux` to check `entry.conjugations.passe_compose` as well as `entry.conjugations.perfektum`.
**Warning signs:** `participleToAux.size === 0` for FR in fixture runner -> FR-02 rule returns empty findings.

### Pitfall 5: Missing etre verbs in bundled data

**What goes wrong:** 4 DR MRS VANDERTRAMP verbs (devenir, naitre, rentrer, retourner) are not in `fr.json` data.
**Why it happens:** Data sync from Papertek API may not have full verb coverage.
**How to avoid:** Hardcode FR_ETRE_VERBS + FR_ETRE_PARTICIPLES in grammar-tables.js as fallback. Rule checks data-driven Map first, then hardcoded set.
**Warning signs:** `j'ai devenu` not flagged in fixtures.

### Pitfall 6: Accent stripping on participles

**What goes wrong:** Participle `alle` vs `alle` (accented/unaccented) -- students may omit accents.
**Why it happens:** Tokenizer lowercases but does not strip accents.
**How to avoid:** The `participleToAux` Map should store both accented and unaccented forms. Or the rule should normalize before lookup (like ES rules do with accent-stripped variants).
**Warning signs:** `j'ai alle` (no accent) not matched against `alle` (accented) in participleToAux.

### Pitfall 7: PP agreement rule flagging etre constructions

**What goes wrong:** `elle est allee` (correct etre PP agreement) flagged as wrong PP.
**Why it happens:** Rule fires on ANY auxiliary + participle without checking which auxiliary type.
**How to avoid:** FR-03 MUST only fire on `avoir` constructions (PP agreement with avoir is the learner error). Etre constructions always agree with the subject -- different rule domain entirely.
**Warning signs:** Fixture for `elle est allee` acceptance case fails.

## Code Examples

### FR Elision Rule Skeleton

```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const VOWELS = new Set('aeiouyàâäéèêëïîôùûüÿœæ'.split(''));

  const H_ASPIRE = new Set([
    'hache', 'haie', 'haine', 'hall', 'halte', 'hamac', 'hamster',
    'hanche', 'handicap', 'hangar', 'harangue', 'harceler', 'hardi',
    'haricot', 'harpe', 'hasard', 'hausse', 'haut', 'hauteur',
    'heros', 'hibou', 'hockey', 'hollande', 'homard', 'honte',
    'hors', 'housse', 'hublot', 'hurler', 'hutte',
  ]);

  const ELISION_MAP = {
    je: "j'", me: "m'", te: "t'", se: "s'",
    le: "l'", la: "l'", de: "d'", ne: "n'", que: "qu'",
  };
  // si only elides before il/ils
  const SI_TARGETS = new Set(['il', 'ils']);

  const rule = {
    id: 'fr-elision',
    languages: ['fr'],
    priority: 14,
    severity: 'error',
    explain: (finding) => ({
      nb: `I fransk bruker ein <em>${escapeHtml(finding.fix)}</em> framfor vokal eller stum h — ikkje <em>${escapeHtml(finding.original)}</em>.`,
      nn: `I fransk brukar ein <em>${escapeHtml(finding.fix)}</em> framfor vokal eller stum h — ikkje <em>${escapeHtml(finding.original)}</em>.`,
    }),
    check(ctx) {
      if (ctx.lang !== 'fr') return [];
      const { tokens, cursorPos } = ctx;
      const out = [];
      for (let i = 0; i < tokens.length - 1; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        const next = tokens[i + 1];
        const w = t.word; // already lowercase
        const nextW = next.word;
        const firstChar = nextW[0];
        const startsVowel = VOWELS.has(firstChar);
        const startsHmuet = firstChar === 'h' && !H_ASPIRE.has(nextW);
        if (!startsVowel && !startsHmuet) continue;
        // si special case
        if (w === 'si') {
          if (SI_TARGETS.has(nextW)) {
            out.push({ rule_id: rule.id, priority: rule.priority,
              start: t.start, end: next.end,
              original: `${t.display} ${next.display}`,
              fix: `s'${next.display}` });
          }
          continue;
        }
        const elided = ELISION_MAP[w];
        if (!elided) continue;
        out.push({ rule_id: rule.id, priority: rule.priority,
          start: t.start, end: next.end,
          original: `${t.display} ${next.display}`,
          fix: `${elided}${next.display}` });
      }
      return out;
    },
  };
  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### buildParticipleToAux Extension

```javascript
// Current (DE-only):
if (!entry.conjugations || !entry.conjugations.perfektum) continue;
const perf = entry.conjugations.perfektum;

// Extended (DE + FR):
const perf = entry.conjugations.perfektum || entry.conjugations.passe_compose;
if (!perf) continue;
```

### Grammar-Tables FR Additions

```javascript
// ── FR: Avoir conjugated forms ──
const FR_AVOIR_FORMS = {
  ai:      { person: 'je',       tense: 'present' },
  as:      { person: 'tu',       tense: 'present' },
  a:       { person: 'il/elle',  tense: 'present' },
  avons:   { person: 'nous',     tense: 'present' },
  avez:    { person: 'vous',     tense: 'present' },
  ont:     { person: 'ils/elles', tense: 'present' },
  avais:   { person: 'je',       tense: 'imparfait' },
  avait:   { person: 'il/elle',  tense: 'imparfait' },
  avions:  { person: 'nous',     tense: 'imparfait' },
  aviez:   { person: 'vous',     tense: 'imparfait' },
  avaient: { person: 'ils/elles', tense: 'imparfait' },
};

// ── FR: Etre conjugated forms ──
const FR_ETRE_FORMS = {
  suis:    { person: 'je',       tense: 'present' },
  es:      { person: 'tu',       tense: 'present' },
  est:     { person: 'il/elle',  tense: 'present' },
  sommes:  { person: 'nous',     tense: 'present' },
  etes:    { person: 'vous',     tense: 'present' },
  sont:    { person: 'ils/elles', tense: 'present' },
  etais:   { person: 'je',       tense: 'imparfait' },
  etait:   { person: 'il/elle',  tense: 'imparfait' },
  etions:  { person: 'nous',     tense: 'imparfait' },
  etiez:   { person: 'vous',     tense: 'imparfait' },
  etaient: { person: 'ils/elles', tense: 'imparfait' },
};

// ── FR: DR MRS VANDERTRAMP etre verbs (supplement for data gaps) ──
const FR_ETRE_VERBS = new Set([
  'aller', 'arriver', 'descendre', 'devenir', 'entrer', 'monter',
  'mourir', 'naitre', 'naître', 'partir', 'passer', 'rentrer',
  'rester', 'retourner', 'revenir', 'sortir', 'tomber', 'venir',
]);

// Hardcoded participle -> infinitive for data-gap verbs
const FR_ETRE_PARTICIPLES = {
  devenu: 'devenir', ne: 'naitre', rentre: 'rentrer', retourne: 'retourner',
};
```

## State of the Art

| Component | Current State | Phase 10 Change |
|-----------|--------------|-----------------|
| fr-contraction.js | Handles le/la + vowel -> l' | Remove le/la vowel handling; keep only prepositional contractions |
| buildParticipleToAux | Reads `perfektum` only (DE) | Extend to read `passe_compose` (FR) |
| grammar-tables.js | DE + ES tables | Add FR_AVOIR_FORMS, FR_ETRE_FORMS, FR_ETRE_VERBS, FR_ETRE_PARTICIPLES |
| grammarfeatures-fr.json | No PP agreement toggle | Add `grammar_fr_pp_agreement` feature (defaults OFF) |
| benchmark expectations.json | No FR elision/aux entries | Add entries for benchmark lines with elision + aux errors |
| fixtures/fr/ | bags.jsonl + grammar.jsonl | Add elision.jsonl, etre-avoir.jsonl, pp-agreement.jsonl |

## Open Questions

1. **fr-contraction.js refactoring scope**
   - What we know: fr-contraction.js currently handles `le/la + vowel -> l'` (elision) alongside preposition contractions. FR-01's fr-elision.js will duplicate the le/la elision logic.
   - What's unclear: Does fr-contraction.js handle any preposition contractions (`de le -> du`, `a le -> au`) that would be lost if we simply remove the vowel-onset check? Need to re-read the full file.
   - Recommendation: Read fr-contraction.js carefully during planning. If it ONLY handles le/la + vowel, it becomes redundant and can be deprecated in favor of fr-elision.js. If it also handles preposition contractions, keep both files with non-overlapping scope.

2. **Benchmark text needs `j'ai alle` line for FR-02**
   - What we know: Success criteria requires `"j'ai alle"` to be flagged. Current benchmark text (fr.txt) has `"je suis alle"` (correct) but no wrong-auxiliary example for etre verbs.
   - Recommendation: Add a new benchmark line containing `"j'ai alle"` to fr.txt. Also add `"je suis ameliore"` (wrong direction -- etre used with avoir-verb) if we want to test both directions.

3. **Accent-stripped participle matching**
   - What we know: Students often write `alle` instead of `alle` (missing accent on e). The tokenizer preserves accents in `.display` but lowercases in `.word`.
   - What's unclear: Does `participleToAux.get('alle')` match when the Map key is `alle` (accented)?
   - Recommendation: Store both accented and accent-stripped forms in the Map, or normalize at lookup time. Follow ES accent-guard pattern.

## Sources

### Primary (HIGH confidence)
- `extension/data/fr.json` - Direct inspection: 13 etre verbs, 556 avoir verbs, `passe_compose` key structure confirmed
- `extension/content/vocab-seam-core.js:807-819` - `buildParticipleToAux` reads only `perfektum`
- `extension/content/spell-rules/de-perfekt-aux.js` - Direct analog for FR-02
- `extension/content/spell-rules/fr-contraction.js` - Existing FR elision handling (le/la only)
- `extension/content/spell-check-core.js:36` - WORD_RE tokenizer treats apostrophe as word-internal
- `extension/content/spell-rules/grammar-tables.js` - Phase 8/9 shared tables pattern
- `benchmark-texts/fr.txt` lines 37, 49, 50, 52 - Elision errors in benchmark

### Secondary (MEDIUM confidence)
- DR MRS VANDERTRAMP verb list - Standard French grammar reference (devenir, revenir, monter, rester, sortir, venir, aller, naitre, descendre, entrer, retourner, tomber, rentrer, arriver, mourir, partir)
- h-aspire word list - Standard French phonology reference; list should be validated against a FR dictionary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses exact same patterns as Phases 8-9 (de-perfekt-aux, es-ser-estar)
- Architecture: HIGH - Three new rule files + grammar-tables extension + one seam fix; all patterns established
- Pitfalls: HIGH - All 7 pitfalls identified from direct codebase inspection
- FR-03 PP agreement: MEDIUM - Adjacent-window scope is well-defined but the precision target (0.95) needs fixture validation

**Research date:** 2026-04-25
**Valid until:** 2026-05-25
