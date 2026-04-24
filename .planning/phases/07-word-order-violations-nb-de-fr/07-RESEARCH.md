# Phase 7: Word-Order Violations (NB + DE + FR) - Research

**Researched:** 2026-04-24
**Domain:** POS-tagged token view, V2 main-clause word order (NB/DE), subordinate-clause verb-final (DE), BAGS adjective placement (FR), document-state seam forward-documentation
**Confidence:** HIGH

## Summary

Phase 7 ships the first structural (multi-token, clause-aware) rules. The central technical challenge is building a lightweight POS-tagged token view (`ctx.getTagged(i)`) on top of the existing vocab-seam indexes, so that word-order rules can ask "is this token a finite verb?" and "is this token a subordinating conjunction?" without each rule reimplementing the classification walk. The vocab data already contains exactly the indexes needed: `knownPresens` (610 NB / 1,583 non-separated DE forms), `knownPreteritum` (862 NB / 2,495 DE forms), `verbInfinitive` (2,993 NB / 8,614 DE Map entries), `isAdjective` Sets, and the `Intl.Segmenter`-backed `ctx.sentences` array from Phase 6.

All four word-order rules (WO-01 through WO-04) are pattern-match heuristics over the tagged-token stream. NB V2 and DE V2 share nearly identical detection logic (fronted-adverbial + subject + finite-verb = violation; correct V2 has finite-verb in position 2). DE verb-final is a separate subordinator-detection + clause-end check. FR BAGS is a closed-set adjective placement check against ~40 adjectives marked in the data.

**Primary recommendation:** Ship the tagged-token view and helpers (`findFiniteVerb`, `findSubordinator`, `isMainClause`) as shared infrastructure in `spell-check-core.js`. Each WO rule is a thin file under `spell-rules/` that reads `ctx.getTagged(i)` and emits findings. FR BAGS uses a hardcoded closed set (data lacks a `bags: true` flag — 0 adjectives carry it today). Document the Phase 13 document-state seam shape in `spell-rules/README.md` with no code change.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-06 | Tagged-token view (POS-aware token stream with finite-verb / subject / adverbial / subordinator slots) available to all word-order and governance rules | Vocab-seam already exposes `knownPresens`, `knownPreteritum`, `verbInfinitive`, `isAdjective`, `validWords` — sufficient to build a token tagger. `ctx.getTagged(i)` returns `{ pos, isFinite, isSubordinator, isSubject }` lazily computed on first access. Helpers `findFiniteVerb(tokens, start, end)`, `findSubordinator(tokens, start, end)`, `isMainClause(sentence, tokens)` land in core and are consumed by all Phase 7 rules. |
| WO-01 | NB V2 violation flagged when `<fronted-adv> <subject> <finite-verb>` in main clauses | NB benchmark line 42 "Hvorfor du tror at norsk er lett?" — wh-fronted subject-before-verb. NB verb forms are single-word tokens in `knownPresens` (610) and `knownPreteritum` (862). Subject pronouns already defined in `nb-modal-verb.js` SUBJECT_PRONOUNS set. Detection: in main clause, if position-1 is NOT a finite verb and a finite verb exists later → flag the subject-verb span. Acceptance: subordinate clauses (fordi, at, som, når + S-V order = correct) must NOT flag. |
| WO-02 | DE main-clause V2 violation flagged | DE benchmark lines: "Letzte montag ich bin gegangen" (line 32), "Dann ich aufstehe" (line 39). DE presens has 1,583 single-word forms + 972 separated forms ("stehe auf"). For V2 detection, only single-word finite forms matter (the stem without particle). Shares detection pattern with WO-01 (fronted-element + subject + finite-verb = violation). DE subject pronouns: ich/du/er/sie/es/wir/ihr/Sie/man. |
| WO-03 | DE subordinate verb-final violation flagged when subordinator + finite verb not at clause end | DE benchmark lines: "dass er ist nett" (line 39 area), "dass deutsch ist schwieriger" (line 44), "dass ich bin besser" (line 45). Subordinators (`dass/weil/wenn/ob/obwohl/als/bevor/nachdem/damit/sodass`) are all present in DE generalbank. Detection: find subordinator, scan to clause end (next comma/period/end-of-sentence), check if finite verb is NOT in final position → flag. |
| WO-04 | FR BAGS adjective placement flagged when BAGS adjective appears post-nominally | FR benchmark currently lacks a positive BAGS-violation example (only acceptance fixture "une belle femme" is mentioned). The ~40 BAGS adjectives are NOT flagged in data (`bags: true` count = 0). A hardcoded closed set is appropriate (beauty: beau/joli, age: jeune/vieux/nouveau/ancien, goodness: bon/mauvais/gentil/vilain/brave, size: grand/petit/gros/long/haut/court/large/énorme). Detection: if a BAGS adjective appears after a noun (noun identified via nounGenus or nounForms), flag with suggestion to move before noun. Acceptance: "une belle femme" must NOT flag (already pre-nominal). |
</phase_requirements>

## Standard Stack

### Core

No new libraries. All infrastructure uses existing vocab-seam indexes + `Intl.Segmenter` from Phase 6.

| Component | Source | Purpose | Why Standard |
|-----------|--------|---------|--------------|
| `knownPresens` Set | vocab-seam-core.js buildLookupIndexes | Finite present-tense detection | Already populated: 610 NB, 1,583 DE single-word forms |
| `knownPreteritum` Set | vocab-seam-core.js buildLookupIndexes | Finite past-tense detection | Already populated: 862 NB, 2,495 DE forms |
| `verbInfinitive` Map | vocab-seam-core.js buildLookupIndexes | Conjugated-form → infinitive lookup | Already populated: 2,993 NB, 8,614 DE entries |
| `isAdjective` Set | vocab-seam-core.js buildLookupIndexes | Adjective POS tag (FR BAGS) | Already populated for all languages |
| `ctx.sentences` | spell-check-core.js (Phase 6) | Clause boundary detection | Intl.Segmenter already wired |
| `nounGenus` Map | vocab-seam-core.js buildLookupIndexes | Noun identification for FR BAGS | Already populated for all languages |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vocab-based POS tagger | Full NLP POS tagger (e.g., compromise.js) | Breaks SC-06 (offline, no new deps), adds 200KB+ to bundle. Vocab-based tagger is sufficient for V2/verb-final/BAGS patterns. |
| Hardcoded BAGS set | `bags: true` flag in papertek-vocabulary | Data currently lacks the flag (0/15+ BAGS adjectives flagged). Hardcoding ~40 words is cheaper than a cross-repo data-enrichment cycle; can migrate to data-driven later. |
| Subordinator closed set | Data-driven from generalbank | Subordinators are a closed grammatical class (~10-12 words); hardcoding is simpler and more reliable than parsing generalbank types. |

## Architecture Patterns

### Tagged-Token View (INFRA-06)

The tagged-token view is a lazily-computed overlay on `ctx.tokens`. It does NOT replace or duplicate the token array — it adds POS metadata accessible via `ctx.getTagged(i)`.

**Shape:**
```javascript
ctx.getTagged(i) => {
  ...ctx.tokens[i],           // word, display, start, end
  pos: 'verb' | 'noun' | 'adj' | 'pron' | 'sub' | 'adv' | 'other',
  isFinite: boolean,          // true if knownPresens or knownPreteritum
  isSubordinator: boolean,    // true if in SUBORDINATORS[lang] set
  isSubject: boolean,         // true if in SUBJECT_PRONOUNS[lang] set
}
```

**Implementation strategy:** Lazy Map (compute on first access per index, cache result). The tagger reads from `vocab.knownPresens`, `vocab.knownPreteritum`, `vocab.verbInfinitive`, `vocab.isAdjective`, `vocab.nounGenus`, plus hardcoded pronoun and subordinator sets. No new vocab-seam changes needed — all indexes already exist and are passed to rules via `ctx.vocab`.

**Location:** Helpers land in `spell-check-core.js` alongside existing shared helpers (isLikelyProperNoun, editDistance, etc.). Exposed on `self.__lexiSpellCore` for rule files to call.

### Helper Functions

```javascript
// Find the first finite verb in a token range [start, end)
function findFiniteVerb(ctx, start, end) {
  for (let i = start; i < end; i++) {
    if (ctx.getTagged(i).isFinite) return i;
  }
  return -1;
}

// Find the first subordinator in a token range [start, end)
function findSubordinator(ctx, start, end) {
  for (let i = start; i < end; i++) {
    if (ctx.getTagged(i).isSubordinator) return i;
  }
  return -1;
}

// Determine if a sentence region is a main clause (no subordinator before the verb)
function isMainClause(ctx, start, end) {
  const sub = findSubordinator(ctx, start, end);
  return sub === -1;  // No subordinator found → main clause
}
```

### Sentence-to-Token Mapping

Rules need to iterate tokens within a sentence. The mapping uses `ctx.sentences` (Phase 6) and `ctx.tokens`:

```javascript
// Find token indices that fall within a sentence's character span
function tokensInSentence(ctx, sentence) {
  const first = ctx.tokens.findIndex(t => t.start >= sentence.start);
  if (first === -1) return { start: 0, end: 0 };
  let last = first;
  while (last < ctx.tokens.length && ctx.tokens[last].end <= sentence.end) last++;
  return { start: first, end: last };
}
```

### NB V2 Detection Pattern (WO-01)

Norwegian V2 rule: in main declarative clauses, the finite verb MUST be in second position (after exactly one constituent). Student errors place the subject before the verb after a fronted adverbial:

- Error: "I går **jeg gikk** på kino" (adv + subj + verb)
- Correct: "I går **gikk jeg** på kino" (adv + verb + subj)

Also catches wh-question inversion errors:
- Error: "Hvorfor **du tror** at norsk er lett?" (wh + subj + verb)
- Correct: "Hvorfor **tror du** at norsk er lett?" (wh + verb + subj)

**Detection algorithm:**
1. For each sentence, find tokens in that sentence.
2. Skip if sentence has a subordinator before any finite verb (= subordinate clause, S-V order is correct).
3. Find the first finite verb in the sentence.
4. If finite verb is in position >= 3 (0-indexed) AND position 0 is not a conjunction/subordinator AND there's a subject pronoun between position 0 and the verb → flag the subject-verb region.
5. Special case: wh-word at position 0 + subject at position 1 + verb at position 2+ → flag.

**Acceptance cases that must NOT flag:**
- Normal V2: "I går gikk jeg på kino" (verb in position 2 ✓)
- Subject-first: "Jeg gikk på kino i går" (subject in position 1, verb in position 2 ✓)
- Subordinate: "fordi jeg gikk på kino" (subordinator → S-V order correct)
- Yes/no question: "Gikk du på kino?" (verb-first = correct)

### DE V2 Detection Pattern (WO-02)

Identical logic to NB V2 but with DE-specific pronoun and subordinator sets. Additional complexity: DE separable verbs store presens as "stehe auf" (multi-word) in `knownPresens`. The tagger must check single-word forms too.

**DE finite-verb detection:**
```javascript
// Check single-word form against knownPresens/knownPreteritum
isFinite = vocab.knownPresens.has(token.word) || vocab.knownPreteritum.has(token.word);
// Also check: is this word part of a separated verb form?
// e.g., "stehe" is finite even though knownPresens has "stehe auf"
if (!isFinite) {
  // Check if any multi-word presens form starts with this token
  for (const form of vocab.knownPresens) {
    if (form.startsWith(token.word + ' ')) { isFinite = true; break; }
  }
}
```

**Performance note:** Iterating 2,555 presens forms per token is expensive. Better approach: at tagger init, build a `finiteVerbStems` Set from the first word of each multi-word form. Cost: one-time O(n) pass, then O(1) lookups.

### DE Verb-Final Detection Pattern (WO-03)

German subordinate clauses require the finite verb at the end:
- Error: "dass er **ist** nett" (verb in middle)
- Correct: "dass er nett **ist**" (verb at end)

**Detection algorithm:**
1. For each sentence, find subordinator tokens.
2. For each subordinator, define the subordinate clause as tokens from subordinator to next comma/period/end-of-sentence.
3. Find the finite verb in that clause.
4. If the finite verb is NOT the last token before the clause boundary → flag.

**Edge case:** Multiple verbs in a subordinate clause (e.g., "dass er nett geworden **ist**") — only the FINITE verb (auxiliary) must be final. Participles/infinitives precede it. The tagger correctly handles this because participles are NOT in `knownPresens`/`knownPreteritum`.

### FR BAGS Adjective Placement Pattern (WO-04)

French BAGS adjectives (Beauty, Age, Goodness, Size) normally precede the noun:
- Correct: "une **belle** femme" (BAGS adj before noun)
- Error: "une femme **belle**" (BAGS adj after noun — should be before)

**Detection algorithm:**
1. For each token, check if it's in the BAGS closed set.
2. If yes, check if the preceding token is a noun (via `nounGenus.has(prev.word)` or `nounForms`).
3. If BAGS adjective follows a noun → flag with suggestion to move before noun.
4. If BAGS adjective precedes a noun → no flag (correct placement).

**BAGS closed set (~40 words, including inflected forms):**
```javascript
const BAGS_SET = new Set([
  // Beauty
  'beau', 'bel', 'belle', 'beaux', 'belles',
  'joli', 'jolie', 'jolis', 'jolies',
  // Age
  'jeune', 'jeunes',
  'vieux', 'vieil', 'vieille', 'vieilles',
  'nouveau', 'nouvel', 'nouvelle', 'nouveaux', 'nouvelles',
  'ancien', 'ancienne', 'anciens', 'anciennes',
  // Goodness
  'bon', 'bonne', 'bons', 'bonnes',
  'mauvais', 'mauvaise', 'mauvaises',
  'gentil', 'gentille', 'gentils', 'gentilles',
  'vilain', 'vilaine', 'vilains', 'vilaines',
  'brave', 'braves',
  // Size
  'grand', 'grande', 'grands', 'grandes',
  'petit', 'petite', 'petits', 'petites',
  'gros', 'grosse', 'grosses',
  'long', 'longue', 'longs', 'longues',
  'haut', 'haute', 'hauts', 'hautes',
  'court', 'courte', 'courts', 'courtes',
  'large', 'larges',
]);
```

**Important edge case:** Some BAGS adjectives change meaning depending on position ("ancien professeur" = former professor vs "professeur ancien" = old/elderly professor; "cher ami" = dear friend vs "livre cher" = expensive book). For Phase 7, flag post-nominal BAGS uniformly — meaning-dependent exceptions are a v3.0 refinement.

### Rule File Structure

Each WO rule follows the existing IIFE pattern:

```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { escapeHtml, findFiniteVerb, findSubordinator, tokensInSentence } = host.__lexiSpellCore || {};

  const rule = {
    id: 'nb-v2',
    languages: ['nb', 'nn'],
    priority: 65,        // structural rule, after register (60)
    severity: 'warning', // P2 — word-order is often a learner-stage error, not always wrong
    explain: (finding) => ({
      nb: `I norske hovedsetninger skal verbet stå på plass 2 — flytt <em>${escapeHtml(finding.fix)}</em> foran subjektet.`,
      nn: `I norske hovudsetningar skal verbet stå på plass 2 — flytt <em>${escapeHtml(finding.fix)}</em> framfor subjektet.`,
    }),
    check(ctx) { /* ... */ },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### Priority Allocation for Phase 7 Rules

| Rule | Priority | Severity | Languages |
|------|----------|----------|-----------|
| nb-v2 (WO-01) | 65 | warning | nb, nn |
| de-v2 (WO-02) | 66 | warning | de |
| de-verb-final (WO-03) | 67 | warning | de |
| fr-bags (WO-04) | 68 | hint | fr |

Priority 65-68 places structural rules after register/collocation/redundancy (60-62) and well after token-local grammar rules (10-55). The `suppressedFor.structural` set (Phase 6 quotation-suppression) is honored by all four rules — word-order inside quoted text is not flagged.

### Phase 13 Document-State Seam (Forward Documentation Only)

No code change. The following shape is documented in `spell-rules/README.md`:

```
kind: 'document'
checkDocument(ctx, findings) signature
Priority 200+
Runs after all token-level rules
```

This is the contract that Phase 13 DOC-01 through DOC-04 (register drift rules) will implement. Documenting it now so the planner has a fixed seam shape to design against.

### Acceptance-vs-Positive Fixture Ratio

Success criterion 5 requires >= 2x acceptance-vs-positive fixture ratio for every word-order rule. This means for each rule, if there are N positive fixtures (text that should flag), there must be >= 2N acceptance fixtures (text that should NOT flag). Enforced by the fixture runner.

**Rationale:** Word-order rules are high-false-positive risk. A V2 rule that fires on every sentence with a subject before a verb would have recall=1.0 but precision=0. The 2x acceptance ratio ensures the planner authors enough negative cases to catch over-firing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentence segmentation | Custom regex splitter | `Intl.Segmenter` via `ctx.sentences` (Phase 6) | Already shipped, handles abbreviations, all target browsers support it |
| POS tagging | Full statistical POS tagger | Vocab-index-based tagger using existing `knownPresens`/`knownPreteritum`/`isAdjective`/`nounGenus` | Sufficient for the closed patterns we detect; zero new deps; SC-06 offline compliant |
| Clause boundary detection | Syntactic parser | Comma + sentence-boundary heuristic combined with subordinator detection | Students write simple clauses; comma-based splitting covers the benchmark cases |
| NLP dependency parsing | Tree-structured parser | Linear token scan with position-based V2 check | V2 detection is inherently positional (verb must be second constituent); no tree structure needed |

**Key insight:** The target student population writes simple, A1-B1 level sentences. Complex nested clauses, free word order for emphasis, and literary constructions are rare. A positional heuristic that handles the 5-6 most common error patterns will achieve high coverage without the false-positive load of a general-purpose parser.

## Common Pitfalls

### Pitfall 1: DE Separable Verb Forms in knownPresens

**What goes wrong:** DE `knownPresens` contains multi-word forms like "stehe auf" (972 of 2,555 entries). The tokenizer produces single-word tokens. If the tagger only checks `knownPresens.has(token.word)`, it misses all separable-verb stems.

**Why it happens:** The vocab data stores the full separated form including the particle.

**How to avoid:** At tagger initialization, build a `finiteVerbStems` Set by extracting the first word from every multi-word presens/preteritum form. Then `isFinite = knownPresens.has(word) || knownPreteritum.has(word) || finiteVerbStems.has(word)`. One-time O(n) cost.

**Warning signs:** DE benchmark lines "Dann ich aufstehe" not flagging. "aufstehe" is not in `knownPresens`, but "stehe" (extracted from "stehe auf") should be recognized as finite.

### Pitfall 2: Subordinate Clause False Positives on V2 Rule

**What goes wrong:** NB/DE V2 rule fires inside subordinate clauses where S-V order is CORRECT.

**Why it happens:** The rule checks "subject before verb" but doesn't first verify the clause is a main clause. "fordi jeg gikk" has subject before verb, which is CORRECT in a subordinate clause.

**How to avoid:** `isMainClause(ctx, start, end)` check MUST precede V2 detection. If a subordinator is found before the finite verb, skip the sentence for V2.

**Warning signs:** Acceptance fixture "fordi jeg gikk til butikken" falsely flagging.

### Pitfall 3: Sentence Boundary Mismatch Between Tokens and Sentences

**What goes wrong:** `tokensInSentence()` returns wrong token range because `ctx.sentences` character offsets don't align with `ctx.tokens` character offsets.

**Why it happens:** `Intl.Segmenter` includes trailing whitespace in sentence segments; token `start`/`end` are word-boundary positions.

**How to avoid:** Use `>=` for start comparison and `<=` for end comparison. A token belongs to a sentence if `token.start >= sentence.start && token.end <= sentence.end`.

**Warning signs:** Rules silently producing zero findings because `tokensInSentence` returns empty ranges.

### Pitfall 4: Comma-Split Clause Boundaries for DE Verb-Final

**What goes wrong:** DE verb-final rule assumes the subordinate clause ends at the next comma, but some student sentences have no comma before the subordinate clause.

**Why it happens:** Students learning German often omit commas ("Ich denke dass er nett ist" without comma after "denke").

**How to avoid:** Use BOTH comma and sentence-end as clause boundaries. If no comma found after subordinator, the clause extends to sentence end.

**Warning signs:** "Ich denke dass er ist nett" not flagging because the rule expects a comma after "denke" to mark the subordinate clause start.

### Pitfall 5: FR BAGS False Positives on Meaning-Shift Adjectives

**What goes wrong:** "un homme grand" (a tall man) is correct — `grand` after a person-noun means "tall", not "great". Flagging it as wrong frustrates students.

**Why it happens:** Some BAGS adjectives have different meanings pre-nominally vs. post-nominally.

**How to avoid:** For Phase 7, accept this as a known false-positive category. Use P3 hint severity (not error) so the flag is unobtrusive. Document the meaning-shift exception list for future refinement. Do NOT attempt to distinguish meaning-from-position in this phase.

**Warning signs:** Student writes "un homme grand" and gets a flag they perceive as wrong.

### Pitfall 6: NB Wh-Questions vs. Embedded Wh-Clauses

**What goes wrong:** "Jeg vet ikke hvorfor du tror det" — "hvorfor" here introduces an embedded clause, NOT a direct question. S-V order after "hvorfor" is CORRECT.

**Why it happens:** The rule sees a wh-word followed by subject+verb and flags it, not realizing it's embedded.

**How to avoid:** Only flag wh-V2 violations when the wh-word is at position 0 of the sentence (direct question) OR when no preceding main-clause verb exists. If a finite verb appears BEFORE the wh-word in the same sentence, the wh-clause is embedded.

**Warning signs:** "Jeg vet ikke hvorfor du tror det" falsely flagging.

### Pitfall 7: Benchmark Line Numbers Shift When Text Is Edited

**What goes wrong:** Success criteria reference specific benchmark lines by content ("Hvorfor du tror"), but `expectations.json` keys use `lang.line_number`. If benchmark text is edited, line numbers change and expectations break.

**How to avoid:** Add benchmark lines for word-order violations WITHOUT changing existing lines. Append new lines or insert at the end of the paragraph they belong to.

**Warning signs:** `check-benchmark-coverage` fails after benchmark edits because line numbers shifted.

### Pitfall 8: French Noun Detection via nounGenus is Incomplete

**What goes wrong:** FR BAGS rule checks `nounGenus.has(prevToken.word)` to identify nouns, but `nounGenus` only contains base forms with genus data. Plurals, definite forms, and nouns without genus data are missed.

**How to avoid:** Use BOTH `nounGenus.has(word)` and `nounForms` (which includes plural forms) for noun identification. Also consider: if the previous token is an article (`le/la/les/un/une/des/l'`), the token after it is likely a noun.

**Warning signs:** "une femme belle" not flagging because "femme" happens to not be in nounGenus.

## Code Examples

### Tagged Token Lazy Cache Pattern

```javascript
// Inside spell-check-core.js check() function, after tokenize:
const tagCache = new Map();
const finiteStems = buildFiniteStems(vocab); // one-time per check() call

ctx.getTagged = function(i) {
  if (tagCache.has(i)) return tagCache.get(i);
  const tok = ctx.tokens[i];
  if (!tok) return null;
  const w = tok.word;
  const tag = {
    ...tok,
    pos: classifyPOS(w, vocab, lang),
    isFinite: vocab.knownPresens.has(w) || vocab.knownPreteritum.has(w) || finiteStems.has(w),
    isSubordinator: SUBORDINATORS[lang] ? SUBORDINATORS[lang].has(w) : false,
    isSubject: SUBJECT_PRONOUNS[lang] ? SUBJECT_PRONOUNS[lang].has(w) : false,
  };
  tagCache.set(i, tag);
  return tag;
};
```

### Building Finite-Verb Stems for DE Separable Verbs

```javascript
function buildFiniteStems(vocab) {
  const stems = new Set();
  for (const form of (vocab.knownPresens || new Set())) {
    if (form.includes(' ')) {
      stems.add(form.split(' ')[0]); // "stehe auf" → "stehe"
    }
  }
  for (const form of (vocab.knownPreteritum || new Set())) {
    if (form.includes(' ')) {
      stems.add(form.split(' ')[0]);
    }
  }
  return stems;
}
```

### NB V2 Detection Core Logic

```javascript
// For each sentence in ctx.sentences:
const { start, end } = tokensInSentence(ctx, sentence);
if (end - start < 3) continue; // Need at least 3 tokens for V2 violation

// Skip subordinate clauses
const subIdx = findSubordinator(ctx, start, end);
const verbIdx = findFiniteVerb(ctx, start, end);
if (verbIdx === -1) continue; // No finite verb found
if (subIdx !== -1 && subIdx < verbIdx) continue; // Subordinate clause — S-V correct

// V2 check: verb should be at position start+1 (second constituent)
// If verb is at position start+2 or later AND there's a subject before it, flag
const relPos = verbIdx - start;
if (relPos >= 2) {
  // Check if position between start and verb contains a subject pronoun
  for (let j = start + 1; j < verbIdx; j++) {
    if (ctx.getTagged(j).isSubject) {
      // Flag: subject before verb after fronted constituent
      out.push({ rule_id: 'nb-v2', start: tokens[j].start, end: tokens[verbIdx].end, ... });
      break;
    }
  }
}
```

### Subordinator Sets (Hardcoded Closed Class)

```javascript
const SUBORDINATORS = {
  nb: new Set(['fordi', 'at', 'som', 'når', 'hvis', 'selv', 'om', 'da', 'mens', 'etter', 'før', 'siden', 'dersom', 'enda', 'skjønt', 'ettersom']),
  nn: new Set(['fordi', 'at', 'som', 'når', 'viss', 'sjølv', 'om', 'då', 'mens', 'etter', 'før', 'sidan', 'dersom', 'endå', 'trass']),
  de: new Set(['dass', 'weil', 'wenn', 'ob', 'obwohl', 'als', 'bevor', 'nachdem', 'damit', 'sodass', 'solange', 'sobald', 'seit', 'seitdem', 'während', 'indem', 'falls']),
  fr: new Set(['que', 'quand', 'si', 'parce', 'lorsque', 'puisque', 'comme', 'pendant', 'avant', 'après', 'bien', 'pour', 'afin', 'tandis', 'dès']),
};

const SUBJECT_PRONOUNS = {
  nb: new Set(['jeg', 'du', 'han', 'hun', 'den', 'det', 'vi', 'dere', 'de', 'man', 'en']),
  nn: new Set(['eg', 'du', 'han', 'ho', 'den', 'det', 'vi', 'dykk', 'dei', 'ein']),
  de: new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']),
  fr: new Set(['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles']),
};
```

### WH-Question Words (NB V2 Special Case)

```javascript
const WH_WORDS = {
  nb: new Set(['hvorfor', 'hvordan', 'hva', 'hvem', 'hvilken', 'hvilke', 'hvor', 'når']),
  nn: new Set(['kvifor', 'korleis', 'kva', 'kven', 'kva', 'kvar', 'når']),
  de: new Set(['warum', 'wie', 'was', 'wer', 'welcher', 'welche', 'welches', 'wo', 'wann', 'woher', 'wohin']),
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token-level-only rules (Phase 1-6) | Multi-token structural rules (Phase 7) | Phase 7 | First rules that reason about token ORDER within a clause, not just individual token correctness |
| No POS information on tokens | Tagged-token view with lazy POS cache | Phase 7 | Enables all structural rules in Phases 7-15 |
| Sentence boundaries unused except for quotation-suppression | Sentence boundaries drive clause-level rule logic | Phase 7 | `ctx.sentences` becomes load-bearing for rule correctness, not just suppression |

## Open Questions

1. **Benchmark text additions for FR BAGS positive case**
   - What we know: Success criterion 4 mentions a "post-nominal BAGS counter-example" that should flip from unflagged to flagged. The current FR benchmark has no such line.
   - What's unclear: Should we add a new line like "une femme belle" to the FR benchmark, or is there already an implicit case?
   - Recommendation: Add "C'est une femme belle et intelligente." to fr.txt as a positive case. "belle" post-nominal should flag.

2. **DE "ich bin gegangen" — is "bin" the finite verb for V2 purposes?**
   - What we know: In "Letzte montag ich bin gegangen", the finite verb is "bin" (auxiliary in Perfekt construction). "gegangen" is the participle.
   - What's unclear: Will the tagger correctly identify "bin" as finite and "gegangen" as non-finite?
   - Recommendation: HIGH confidence this works — "bin" is in `knownPresens` (confirmed: `idx.knownPresens.has('bin')` = true), and "gegangen" is a past participle NOT in knownPresens/knownPreteritum. The Perfekt construction is naturally handled.

3. **NB "Hvorfor du tror" — where does the subordinate clause "at norsk er lett" begin?**
   - What we know: The full sentence is "Hvorfor du tror at norsk er lett?" The V2 violation is "Hvorfor du tror" (should be "Hvorfor tror du"). The "at norsk er lett" part is a subordinate clause.
   - What's unclear: Should the rule flag just the main clause part, or should it flag regardless of the trailing subordinate clause?
   - Recommendation: Flag the main clause V2 violation ("Hvorfor du tror" span). The subordinate clause is a separate concern. The V2 check operates on the main clause only — identify the subordinator "at" and stop the V2 analysis there.

4. **Severity tier for word-order rules**
   - What we know: Requirements don't specify severity. Word-order is a structural error, more serious than stylistic redundancy but potentially context-dependent.
   - What's unclear: Should V2 violations be P1 (error), P2 (warning), or P3 (hint)?
   - Recommendation: NB/DE V2 and DE verb-final → P2 (warning). Students may sometimes intentionally deviate; also false-positive risk is higher than token-level rules. FR BAGS → P3 (hint) because meaning-shift adjectives create inherent ambiguity. Can be tightened to P1 in future phases after false-positive data is collected.

5. **Fixture runner enforcement of 2x acceptance ratio**
   - What we know: Success criterion 5 says ">=2x acceptance-vs-positive fixture ratio is enforced for every word-order rule by the fixture runner."
   - What's unclear: Should this be a hard gate in `check-fixtures.js` or a separate gate?
   - Recommendation: Add a ratio check to `check-fixtures.js` keyed on rule IDs that start with `nb-v2`, `de-v2`, `de-verb-final`, `fr-bags`. Hard-fail if acceptance count < 2 * positive count. Lightweight addition to existing runner.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `extension/content/spell-check-core.js` — current tokenizer, runner, helper functions
- Codebase inspection: `extension/content/vocab-seam-core.js` lines 700-801 — buildLookupIndexes, all index Sets/Maps
- Codebase inspection: Node REPL verification of `knownPresens`, `knownPreteritum` sizes and membership for NB/DE
- Codebase inspection: `extension/data/de.json` verbbank — confirmed conjugation structure (ich/du/er forms for DE, separated forms like "stehe auf")
- Codebase inspection: `extension/data/fr.json` adjectivebank — confirmed 15+ BAGS adjectives present, confirmed `bags: true` flag = 0 entries
- Codebase inspection: `benchmark-texts/nb.txt` line 42, `de.txt` lines 32/39/44/45, `fr.txt` (no BAGS positive case)

### Secondary (MEDIUM confidence)
- Norwegian V2 rule linguistics: well-established in Scandinavian grammar pedagogy. Norwegian is SVO in main clauses with obligatory V2 after fronting. Subordinate clauses follow S-V order. HIGH confidence in the rule's linguistic correctness.
- German V2 and verb-final: fundamental German grammar rule taught at A1 level. Subordinating conjunctions trigger verb-final. HIGH confidence.
- French BAGS: standard pedagogical mnemonic for pre-nominal adjective placement. The exact membership of the set varies by source; the ~40-word set used here covers A1-B1 level.

### Tertiary (LOW confidence)
- Meaning-shift adjective exceptions (ancien, cher, grand, propre, seul, pauvre, etc.): documented in French grammar references but handling is complex and context-dependent. Deferred to future phase — LOW confidence on whether Phase 7's uniform flagging will cause unacceptable false-positive rates.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all infrastructure already exists, no new deps
- Architecture: HIGH — tagged-token view is a straightforward overlay on existing indexes; rule patterns are well-defined
- Pitfalls: HIGH — all eight pitfalls are concrete and testable; each has a clear prevention strategy
- FR BAGS false-positive risk: MEDIUM — meaning-shift adjectives may cause some student frustration; mitigated by P3 severity

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (stable domain, no external dependencies changing)
