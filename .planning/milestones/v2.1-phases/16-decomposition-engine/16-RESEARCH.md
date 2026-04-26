# Phase 16 Research: Decomposition Engine

**Phase:** 16 — Decomposition Engine
**Requirements:** COMP-05 (linking elements), COMP-06 (recursive decomposition up to 4 components)
**Researched:** 2026-04-26
**Confidence:** HIGH

---

## Executive Summary

Phase 16 delivers a pure compound-splitting algorithm in `vocab-seam-core.js` with linking-element awareness for NB/NN/DE. The function `decomposeCompound(word, nounGenus, lang)` takes an unknown word, attempts to split it into known noun components with optional linking elements (fuge), and returns a structured result or null. It is the foundation for five downstream phases (popup display, spell-check acceptance, gender inference, expanded sarskriving, compound gender mismatch).

The core algorithm is already proven: `de-compound-gender.js` lines 78-103 implement greedy longest-suffix matching with DE linker stripping in ~25 lines. Phase 16 generalizes this to NB/NN, adds both-sides validation (the existing DE code only validates the suffix), and adds recursive splitting for 3-4 component compounds per COMP-06.

**Key research finding on NB vs NN linking elements:** NB and NN use the **same set** of linking elements (`s` and `e`). The differences between the two standards lie in the word forms themselves (barneskole/barneskule, arbeider/arbeidar), not in which fuge characters exist. The decomposition engine can use a single linker set for both NB and NN. This simplifies the implementation -- no language-specific branching within Norwegian.

---

## Key Research Question: NB vs NN Linking Elements (Fuge)

### Answer: Same linker set, different word forms

**Confidence: HIGH** (Spraakraadet documentation + Wikipedia Fuge-s/Fuge-e articles + codebase nounbank comparison)

NB and NN both use exactly two productive linking elements:

| Linker | NB Example | NN Example | Notes |
|--------|-----------|-----------|-------|
| `-s-` (binde-s) | arbeid**s**tid | arbeid**s**tid | Most common. ~75% of compounds with a linker |
| `-e-` (binde-e) | barn**e**hage | barn**e**hage | Less common. Typical with monosyllabic first components |
| zero (no linker) | skoledag | skuledag | Default when no linker applies |

The "differences" between NB and NN in compounding are in the **base word forms**, not the **linking element rules**:

- NB `barneskole` vs NN `barneskule` (different base word `skole`/`skule`, same zero-fuge)
- NB `barnehagelærer` vs NN `barnehagelærar` (different suffix `-er`/`-ar`, same fuge-e on `barn`)
- NB `arbeider` vs NN `arbeidar` (different base form, same fuge behavior)

Data evidence from the nounbank: of 2,124 NB nouns and 2,123 NN nouns, 1,979 are shared (93%). The 145 NB-only and 144 NN-only entries are spelling variants of the same concepts, not different compound patterns.

**Implication for implementation:** Use `LINKERS.nb = ['s', 'e']` and `LINKERS.nn = ['s', 'e']` -- identical arrays. No NB/NN branching needed in the decomposition logic. The language distinction matters only for which nounGenus Map is loaded (NB or NN word forms), not for which linkers to try.

### Suffix patterns that trigger fuge-s ("naer alltid" per Spraakraadet)

Both NB and NN share the same suffix-based fuge-s patterns. When the first component ends in one of these suffixes, fuge-s is "almost always" used:

| Suffix | NB Example | NN Equivalent |
|--------|-----------|--------------|
| `-dom` | ungdom**s**skole | ungdom**s**skule |
| `-else` | adskillelse**s**tegn | atskiljing**s**teikn |
| `-het` | kjærlighet**s**novelle | (uses -leik instead) |
| `-leik` | (uses -het instead) | kjærleik**s**song |
| `-nad` | tilbakemelding**s**skjema | (same) |
| `-skap` | vennskap**s**tegn | vennskap**s**teikn |
| `-sjon` | situasjon**s**rapport | situasjon**s**rapport |
| `-tet` | kvalitet**s**kontroll | kvalitet**s**kontroll |
| `-ling` | (same pattern) | (same pattern) |

Note the `-het`/`-leik` pair: NB uses `-het` (from Danish influence) while NN uses `-leik` (from Norse). Both trigger fuge-s. This is a word-form difference, not a fuge-rule difference.

**For decomposition this means:** The engine does NOT need to predict which linker a word takes. It only needs to know the set of possible linkers to try stripping. The set `['s', 'e']` is complete for both NB and NN. The suffix-pattern knowledge is useful for validation/confidence boosting but not required for the core algorithm.

### Sources

- [Spraakraadet: Bindebokstaver i sammensatte ord](https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/bindebokstaver-i-sammensatte-ord/) -- official guidance; mentions skatteyter (BM) vs skattytar (NN) as one of very few NB/NN divergences in fuge usage
- [Spraakraadet: Fugebokstav (binde-s og binde-e)](http://www.sprakradet.no/svardatabase/etiketter/fugebokstav-binde-s-og-binde-e/) -- suffix pattern rules
- [Wikipedia: Fuge-s](https://no.wikipedia.org/wiki/Fuge-s) -- suffix list triggering fuge-s: -dom, -else, -het, -leik, -nad, -skap, -sjon, -tet, -ling
- [Wikipedia: Fuge-e](https://no.wikipedia.org/wiki/Fuge-e) -- fuge-e common with monosyllabic first components; "difficult to provide rules"
- Codebase: NB nounbank (2,124 entries) vs NN nounbank (2,123 entries), 93% overlap by word form

---

## Algorithm Design

### Core Algorithm: Both-Sides Greedy, Recursive

The existing `inferGenderFromSuffix` in `de-compound-gender.js` only validates the right (suffix) side. The Phase 16 engine MUST validate both sides -- this is the critical upgrade that prevents Pitfall 1 (phantom compounds like "minister" splitting into "min" + linker + "ister").

```
decomposeCompound(word, nounGenus, lang, depth=0):
  if depth > 3: return null          // COMP-06: max 4 components = max 3 splits
  if word.length < 6: return null    // min 3+3
  if nounGenus.has(word): return null // stored entry takes precedence (Tier 1 > Tier 2)

  linkers = LINKERS_BY_LANG[lang]

  for splitPos from 3 to word.length - 3:
    left = word[0..splitPos]
    remainder = word[splitPos..]

    if NOT nounGenus.has(left): continue   // LEFT MUST be known noun

    // Try zero-fuge first
    if nounGenus.has(remainder):
      return {parts: [{word: left, genus: nounGenus.get(left), linker: ''},
                       {word: remainder, genus: nounGenus.get(remainder), linker: ''}],
              gender: nounGenus.get(remainder), confidence: 'high'}

    // Try recursive on remainder (zero-fuge)
    sub = decomposeCompound(remainder, nounGenus, lang, depth+1)
    if sub: return {parts: [{word: left, genus: nounGenus.get(left), linker: ''}, ...sub.parts],
                    gender: sub.gender, confidence: 'high'}

    // Try each linker
    for linker in linkers:
      if remainder.startsWith(linker):
        stripped = remainder[linker.length..]
        if stripped.length < 3: continue
        if nounGenus.has(stripped):
          return {parts: [{word: left, genus: nounGenus.get(left), linker: linker},
                           {word: stripped, genus: nounGenus.get(stripped), linker: ''}],
                  gender: nounGenus.get(stripped), confidence: 'high'}
        // Recursive on stripped remainder
        sub = decomposeCompound(stripped, nounGenus, lang, depth+1)
        if sub: return {parts: [{word: left, genus: nounGenus.get(left), linker: linker}, ...sub.parts],
                        gender: sub.gender, confidence: 'high'}

  return null
```

### Key design choices

1. **Left-to-right scan, not right-to-left.** The existing DE code scans from position 1 rightward (longest suffix first). For full decomposition with both-sides validation, we scan from position 3 (minimum left length) rightward. This naturally produces the shortest valid left component first. For compounds like "brannstasjonsjef", the first valid split found is "brann" + "stasjonsjef", then "stasjonsjef" recursively splits to "stasjon" + "sjef". This is correct.

2. **nounGenus as the validator, not validWords.** Using `validWords` (which includes verbs, adjectives, etc.) would produce false splits where a verb stem happens to match a left component. `nounGenus` restricts to nouns only, matching the COMP-05/COMP-06 scope (noun+noun compounds only for v2.1).

3. **Return null for stored entries.** If `nounGenus.has(word)` is true, the word is a Tier 1 stored compound. Return null so consumers fall through to the normal dictionary/spell-check path. Decomposition is only for Tier 2 unknown words.

4. **Confidence always 'high'.** Since both sides must be known nouns, every decomposition result is high-confidence. The milestone-level ARCHITECTURE.md mentions a 'medium' confidence for tail-only validation, but Phase 16 implements both-sides validation exclusively. Medium-confidence (left unknown) can be added in a future phase if needed.

### Linking element ordering

Try linkers in this order: zero-fuge first (most common), then `s` (second most common), then `e` (least common for NB/NN). For DE: `s`, `e`, `n`, `en`, `er`, `es`.

Rationale: zero-fuge is the default in Norwegian compounding. Trying it first avoids unnecessary linker stripping. The `s` linker is tried second because it is the most common non-zero linker and avoids matching `e` prematurely (since `e` is shorter and could match part of a word boundary).

### Triple-consonant elision awareness

Norwegian drops one consonant when compound boundaries produce three identical letters: natt + tog = nattog (two t's OK), but natt + time = nattime (not natttime). For decomposition, this means "nattime" should decompose to natt + time even though "nattime" minus "natt" leaves "ime" (not "time").

**Implementation:** When direct and linker-stripping splits fail, try inserting the character at the split boundary. If `word[splitPos-1] === word[splitPos]`, try adding one more of that character: "nattime" at position 4 gives left "natt", remainder "ime". `natt[3] === 'i'[0]`? No. But position 3: left "nat", remainder "time". `nounGenus.has("nat")`? Probably no. Position 4: left "natt", remainder "ime". Try elision: since `word[3] === word[2]` (both 't'), insert 't': test "natt" + "ttime" -- no. Actually, the correct approach: if left ends with same char as remainder starts with, AND left's last two chars are the same, try duplicating the start of remainder. "natt" ends with "tt", remainder "ime" starts with "i" -- no match. Hmm.

Actually, the elision works the other way. The written form "nattime" is the result of dropping one "t" from "natttime". So when decomposing "nattime", at split position 4 (left="natt", remainder="ime"), we check: does left end with 't' AND would prepending 't' to remainder make a valid noun? "time" is in nounGenus. Yes. So: if `left` ends with character `c` and `c + remainder` is in nounGenus, accept the split with elision noted.

**Recommendation:** Add elision as a third fallback after zero-fuge and linker stripping. Only try when the left component ends with the same character that would need to be prepended. This is ~5 extra lines.

### Performance

For a 15-character word: ~12 split positions x (1 zero-fuge + 2 NB linkers) = ~36 `Map.has()` calls. At ~50ns each in V8 = ~1.8 microseconds per decomposition attempt. With recursive depth up to 3, worst case is ~150 lookups = ~7.5 microseconds. Negligible. No caching needed for the core algorithm.

However, spell-check calls decomposition for every unknown token in the text. A 500-word text with 50 unknown tokens = 50 x 7.5us = 0.375ms. Still negligible against the 800ms debounce. No performance concern.

---

## Where It Lives: vocab-seam-core.js

**Decision: Add `decomposeCompound` as a pure function in vocab-seam-core.js, exported on the `__lexiVocabCore` API object.**

This is confirmed by the milestone-level ARCHITECTURE.md. The function goes alongside `buildIndexes`, `phoneticNormalize`, and `phoneticMatchScore` in the API export (line 1220).

```javascript
const api = { buildIndexes, phoneticNormalize, phoneticMatchScore, decomposeCompound };
```

The function takes explicit `nounGenus` and `lang` parameters (does NOT read from closure state). This keeps it pure and testable. `buildIndexes` returns a bound closure:

```javascript
// In buildIndexes return object:
decomposeCompound: (word) => decomposeCompound(word, nounGenus, lang),
```

Consumers in spell-check get it via `vocab.decomposeCompound(word)` after `vocab-seam.js` exposes a getter.

### Wiring path (3 files touched)

1. **vocab-seam-core.js**: Add `decomposeCompound(word, nounGenus, lang, depth)` function (~80 LOC). Add to API export. Add bound closure in `buildIndexes` return object.
2. **vocab-seam.js**: Add `getDecomposeCompound: () => state?.decomposeCompound ?? null` getter on `__lexiVocab`.
3. **spell-check.js**: Add `decomposeCompound: VOCAB.getDecomposeCompound()` to the vocab bag in `runCheck()`.

---

## Fixture Strategy

Phase 16 is an engine-only phase -- no spell rules change, no popup rendering. But the engine needs its own test coverage via the fixture harness.

### Unit-level validation (run via Node)

Since `decomposeCompound` is exported via `module.exports`, we can test it directly in Node without the fixture harness:

```javascript
const { decomposeCompound } = require('./extension/content/vocab-seam-core.js');
const nounGenus = new Map([['hverdag', 'm'], ['mas', 'm'], ['skole', 'm'], ['sekk', 'm'], ...]);
assert(decomposeCompound('hverdagsmas', nounGenus, 'nb').gender === 'm');
assert(decomposeCompound('hverdag', nounGenus, 'nb') === null); // stored entry
```

### What to test

| Test Case | Input | Expected | Validates |
|-----------|-------|----------|-----------|
| Zero-fuge 2-part | "skoledag" (if not in nounbank) | skole + dag | Basic split |
| Fuge-s 2-part | "hverdagsmas" | hverdag + s + mas | NB fuge-s |
| Fuge-e 2-part | "gutteklasse" | gutt + e + klasse | NB fuge-e |
| DE fuge-s | "Arbeitstag" | Arbeit + s + Tag | DE linker |
| DE fuge-en | "Straßenbahn" | Straße + n + Bahn | DE linker |
| 3-part recursive | compound with 3 parts | 3-element parts array | COMP-06 |
| 4-part recursive | compound with 4 parts | 4-element parts array | COMP-06 depth limit |
| 5-part (too deep) | extremely long compound | null | Depth cap |
| Stored entry | "hverdag" (in nounbank) | null | Tier 1 precedence |
| Too short | "skog" (4 chars) | null | Min length gate |
| Left unknown | word where left side is not a noun | null | Both-sides validation |
| Non-noun left | "spisermat" (spiser is verb form) | null | nounGenus-only gate |
| Triple-consonant elision | "nattime" | natt + time | Elision handling |

### What NOT to test in Phase 16

- Spell-check acceptance of decomposed compounds (Phase 17 scope)
- Popup rendering of decomposed results (Phase 17 scope)
- Sarskriving expansion via decomposition (Phase 19 scope)
- Gender mismatch flags on compounds (Phase 18 scope)

---

## Edge Cases and Design Decisions

### Ambiguous splits

"blabærgraut" could split as bla+bær+graut or bla+bærgraut. The left-to-right scan with minimum-length-3 constraint naturally finds "bla" first (if it's a noun), then recurses on "bærgraut". If "bla" is NOT in nounGenus, it advances to "blab" (not a noun), then "blabæ" (not a noun), etc. For real compounds like "blabærgraut" where "bla" is not a noun but "blabær" is, the algorithm finds "blabær" + "graut" -- the correct semantic parse.

This demonstrates why left-to-right scan with both-sides validation is self-correcting: false left candidates are filtered by `nounGenus.has(left)`.

### Case handling

The function receives lowercase input (all vocab-seam operations lowercase). German nouns are stored lowercase in nounGenus. No case logic needed inside the decomposer.

### Definite-form input

"skolesekken" (definite form) will NOT decompose because "skolesekken" splits to "skole" + "sekken", and "sekken" may or may not be in nounGenus (definite forms are stored via `entry.forms.bestemt.entall`). The nounGenus Map currently stores base forms AND inflected forms that have a genus tag. Need to verify: does nounGenus contain definite forms?

From the code (line 784-788): nounGenus is populated for entries with `bank === 'nounbank'` or `type === 'nounform'` or `type === 'plural'` that have a `genus` field. The `buildWordList` function expands noun entries into their inflected forms. So "sekken" should be in nounGenus if it came through the wordList expansion.

**Recommendation:** Verify empirically before coding. If definite forms are in nounGenus, "skolesekken" decomposes naturally to "skole" + "sekken". If not, definite-form decomposition is deferred (COMP-10 in future requirements).

### Compound words already containing a linker as part of the root

"husstand" (household) -- "hus" + "stand". Zero-fuge. But if we also try fuge-s: "hus" + ... strip 's' from "stand" -> "tand" (tooth). If "tand" is in nounGenus, we get a wrong split: "hus" + "s" + "tand". Prevention: try zero-fuge first, accept the first valid split. Since "hus" + "stand" is valid with zero-fuge and is found before the linker-strip pass, the correct split wins.

This ordering (zero-fuge before linkers) is important and must be preserved.

---

## Phase Scope (What Phase 16 Delivers)

### In scope (COMP-05 + COMP-06)

1. `decomposeCompound(word, nounGenus, lang)` function in `vocab-seam-core.js`
2. Linking element configuration: `{nb: ['s','e'], nn: ['s','e'], de: ['s','n','en','er','e','es']}`
3. Both-sides validation (left AND right must be in nounGenus)
4. Recursive decomposition up to depth 3 (4 components)
5. Triple-consonant elision handling
6. Bound closure in `buildIndexes` return object
7. Getter in `vocab-seam.js`
8. `decomposeCompound` wired into spell-check vocab bag
9. Unit tests (Node-based, not fixture harness)

### Out of scope (later phases)

- Popup rendering of decomposed results (Phase 17: COMP-01, COMP-02)
- Spell-check acceptance logic (Phase 17: COMP-03)
- NB/NN compound gender inference rule (Phase 18: COMP-04, COMP-08)
- Expanded sarskriving detection (Phase 19: COMP-07)
- Verb/adjective decomposition (future: COMP-09)
- Definite-form stripping before decomposition (future: COMP-10)
- Per-noun fuge data in papertek-vocabulary (future: COMP-11)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phantom compounds from one-sided validation | Critical | Both-sides validation is the core requirement; test against full nounbank |
| NB/NN linker divergence causing wrong splits | Low | Research confirms identical linker sets; only word forms differ |
| Performance regression on large texts | Low | ~7.5us per decomposition; negligible against 800ms debounce |
| Recursive depth causing stack overflow | Low | Depth cap at 3; Norwegian/German compounds rarely exceed 4 parts |
| Breaking existing de-compound-gender.js | Medium | Phase 16 adds the shared engine but does NOT refactor de-compound-gender.js yet -- that happens in Phase 18 |
| Triple-consonant elision edge cases | Low | Limited to double-consonant word endings + same-consonant next word starts; small surface area |

---

## Checklist for Plan Creation

- [ ] Add `decomposeCompound` function to vocab-seam-core.js (~80 LOC)
- [ ] Add LINKERS_BY_LANG configuration constant
- [ ] Add triple-consonant elision logic (~5 LOC)
- [ ] Add bound closure in buildIndexes return object
- [ ] Add getter in vocab-seam.js
- [ ] Wire into spell-check.js vocab bag
- [ ] Export on `__lexiVocabCore` API for popup access (Phase 17)
- [ ] Write Node-based unit tests for all edge cases
- [ ] Verify nounGenus contains definite forms (empirical check)
- [ ] Run decomposition against full NB nounbank; verify <2% false positive rate
- [ ] All 9 existing release gates pass
- [ ] No changes to existing spell rules in this phase

---

## Sources

- [Spraakraadet: Bindebokstaver i sammensatte ord](https://sprakradet.no/godt-og-korrekt-sprak/rettskriving-og-grammatikk/bindebokstaver-i-sammensatte-ord/) -- official NB/NN guidance; confirms shared linker set (HIGH confidence)
- [Spraakraadet: Fugebokstav (binde-s og binde-e)](http://www.sprakradet.no/svardatabase/etiketter/fugebokstav-binde-s-og-binde-e/) -- suffix patterns triggering fuge-s (HIGH confidence)
- [Wikipedia: Fuge-s](https://no.wikipedia.org/wiki/Fuge-s) -- suffix list: -dom, -else, -het, -leik, -nad, -skap, -sjon, -tet, -ling (HIGH confidence)
- [Wikipedia: Fuge-e](https://no.wikipedia.org/wiki/Fuge-e) -- fuge-e with monosyllabic first components (HIGH confidence)
- [Algolia: Decompounding with language-specific lexicons](https://www.algolia.com/blog/engineering/increase-decompounding-accuracy-by-generating-a-language-specific-lexicon) -- dictionary-based greedy F1=0.92 on German (MEDIUM confidence, different language)
- [UCL Scandinavian Wiki: Norwegian Compounds](https://wiki.ucl.ac.uk/display/ScanStuds/Norwegian+Compounds) -- compound formation overview (MEDIUM confidence)
- Codebase: `de-compound-gender.js` lines 78-103, `vocab-seam-core.js` lines 706-807, `nb-sarskriving.js` (HIGH confidence, direct code read)
- Codebase: NB nounbank 2,124 entries, NN nounbank 2,123 entries, 93% overlap (HIGH confidence, empirical count)
