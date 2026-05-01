# Stack Research — v2.1 Compound Decomposition & Polish

**Domain:** Algorithmic compound word decomposition for NB/NN/DE in an offline Chrome MV3 extension
**Researched:** 2026-04-26
**Confidence:** HIGH (core algorithm is dictionary-lookup-based; existing `de-compound-gender.js` proves the pattern; no new dependencies needed)

---

## Recommended Stack Additions

### No New Dependencies

The v2.1 compound decomposition engine requires **zero npm packages**. Every existing JS/Python compound-splitting library (CharSplit, jwordsplitter, german_compound_splitter, stts-se/decomp) is either Python/Java/Go, GPL-licensed, requires large external dictionaries (50K+ words), or depends on ML. All violate the project's constraints: no runtime dependencies, MIT license, offline-only, vanilla JS, no build step.

The existing `inferGenderFromSuffix()` in `de-compound-gender.js` (lines 78-103) already implements the core algorithm — greedy longest-suffix matching with linking-element stripping — in ~25 lines. The v2.1 engine generalises this to NB/NN and adds multi-split recursion.

### Core Engine: `compound-decomposer.js`

| Component | Implementation | Why |
|-----------|---------------|-----|
| Decomposition engine | New file `extension/content/compound-decomposer.js` | Pure module, dual-export (browser IIFE + Node module.exports), consumable by vocab-seam, spell-check, popup, and fixtures |
| Lookup backing store | `Set` (validWords) + `Map` (nounGenus) from existing `__lexiVocab` seam | Already built; ~4K NB entries, ~1.6K DE entries — `Set.has()` is O(1), no trie needed |
| Linking elements | Language-keyed config object in the engine | ~15 rules total across 3 languages; static, no data sync needed |

### Data Structure Decision: HashSet, Not Trie

**Recommendation: Use the existing `Set`-based `validWords` and `Map`-based `nounGenus` directly. Do NOT build a trie.**

Rationale:

| Criterion | HashSet (Set/Map) | Trie |
|-----------|-------------------|------|
| Lookup speed | O(1) amortised | O(k) where k = key length |
| Memory | ~200 KB for 4K entries (JS Set) | ~2-5 MB for equivalent trie (65x overhead per John Resig's JS trie benchmarks) |
| Prefix search needed? | **No** — decomposition iterates suffix positions, not prefixes | Yes, but we don't need prefix search |
| Implementation complexity | 0 lines (already exists) | ~80 lines for a trie class |
| Build step | None (indexes built by `buildLookupIndexes`) | Would need trie construction at seam-build time |

The decomposition algorithm iterates split positions left-to-right and checks if each suffix exists in the noun set. This is a series of `Set.has(suffix)` calls — exactly what HashSet excels at. A trie would help if we needed "find all words starting with X" (prefix completion), but compound decomposition works the opposite direction: "does this suffix exist as a known word?"

**Performance estimate:** For a 15-character compound, the algorithm checks at most ~12 suffix positions x ~6 linker variants = ~72 `Set.has()` calls. At ~50ns per `Set.has()` in V8, total decomposition time is ~3.6 microseconds. No optimisation needed.

### Linking Element Configuration

Linking elements (Fugenelemente / fugebokstav) are the glue characters inserted between compound components. They are **lexically conditioned, not fully rule-based** — there is no universal algorithm to predict which linker a word takes. However, for *decomposition* (splitting, not generating), we only need to know the *set of possible linkers* to try stripping.

```javascript
const LINKERS = {
  nb: ['s', 'e'],           // hverdags+mas, gutte+klær
  nn: ['s', 'e'],           // same as NB
  de: ['s', 'n', 'en', 'er', 'e', 'es'],  // already in de-compound-gender.js
};
```

**Why this is sufficient for decomposition:** When splitting "hverdagsmas", the algorithm tries:
1. Direct suffix: "verdagsmas", "erdagsmas", ..., "mas" -> is "mas" in nounbank? Yes -> split found
2. With linker strip: at position 7, remainder = "smas", try stripping "s" -> "mas" -> found

The linker list is exhaustive for all three languages. Norwegian linguists confirm there is no universal rule for *which* linker a word takes (it's per-word/lexical), but the set of *possible* linkers is closed and small.

**For generation (dictionary display):** When showing "hverdag + s + mas", the engine knows the linker was "s" because it was the character(s) stripped during decomposition. No per-word fuge metadata needed in papertek-vocabulary for v2.1.

### Decomposition Algorithm

Greedy longest-suffix-first, recursive, with linking-element awareness:

```
decomposeCompound(word, nounSet):
  if word in nounSet: return [word]    // known word, no split needed
  if word.length < 6: return null      // too short to be a compound (min 3+3)

  for splitPos from 1 to word.length - 3:   // left part >= 1 char
    leftCandidate = word[0..splitPos]
    remainder = word[splitPos..]

    // Try direct split
    if leftCandidate in nounSet:
      right = decomposeCompound(remainder, nounSet)
      if right: return [leftCandidate, ...right]

    // Try stripping each linker from the start of remainder
    for linker in LINKERS[lang]:
      if remainder.startsWith(linker):
        strippedRemainder = remainder[linker.length..]
        if strippedRemainder in nounSet:
          right = decomposeCompound(strippedRemainder, nounSet)
          if right: return [leftCandidate, linker, ...right]
```

**Key constraints:**
- Minimum component length: 3 characters (matches existing `MIN_SUFFIX_LEN` in `de-compound-gender.js`)
- Maximum recursion depth: 3 splits (4 components) — Norwegian and German rarely exceed 3-part compounds in student writing
- Only split at noun boundaries — verbs and adjectives don't form the head of compounds (the last component is always a noun for gender inference)
- Left components can be nouns, adjectives, or verbs (adverbs too in principle, but rare)

### Integration Points

| Consumer | How It Uses Decomposition | Integration |
|----------|--------------------------|-------------|
| **Spell-check** (`validWords` check) | Accept decomposable compounds as valid tokens — unknown word that decomposes = not a typo | Add `decomposeCompound` call in `spell-check-core.js` token validation path, after `validWords.has()` fails |
| **Sarskriving rule** | Expand detection: "skole dag" flagged even if "skoledag" isn't stored, because "skole"+"dag" decomposes | Replace `compoundNouns.has(prev.word + t.word)` with `decomposeCompound(prev.word + t.word)` |
| **Gender inference** (NB/NN) | Extend existing DE compound-gender to NB/NN: unknown compound -> gender from last component | New rule `nb-compound-gender.js` mirroring `de-compound-gender.js` |
| **Dictionary popup** | Show decomposition for unknowns: "Samansett ord: hverdag + s + mas" with gender from last part | `popup.js` calls `decomposeCompound` when nounbank lookup returns null |
| **Word prediction** | Decomposed compounds get frequency boost from last component | Score adjustment in `vocab-seam-core.js` wordList builder |

### Vocab Seam Changes

The decomposer needs access to a **noun-only** Set (not `validWords` which includes all POS). Current `compoundNouns` Set in `buildLookupIndexes` is close but only includes nounbank base entries. Need to also include noun forms (plural, definite) for left-component matching.

```javascript
// In buildLookupIndexes, expand:
const nounLemmas = new Set();  // base forms only, for left-component matching
// ... in the nounbank loop:
nounLemmas.add(baseWord);
```

Expose via `__lexiVocab.getNounLemmas()` alongside existing `getValidWords()`, `getNounGenus()`.

### Polish Items — No Stack Changes

| Feature | Stack Impact |
|---------|-------------|
| Manual "Run spell-check" button | Pure UI: button in popup.html, click handler calls existing `CORE.runCheck()`. Zero new libraries. |
| Demonstrative-mismatch rule | New rule file `nb-demonstrative.js`. Uses existing `nounGenus` Map. No stack additions. |
| Triple-letter typo budget | Enhancement to existing `nb-typo-fuzzy.js` Levenshtein path. Add frequency-weighted distance. No stack additions. |
| Browser visual verification | Manual testing protocol. No stack additions. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Compound splitting | Roll own (~120 LOC) | CharSplit, decomp, jwordsplitter | Wrong language (Python/Java/Go), GPL license, external dictionary dependency, ML-based |
| Lookup structure | `Set`/`Map` (existing) | Trie, DAWG, suffix array | Unnecessary complexity; Set.has() is O(1) and sufficient for our ~4K noun vocabulary; trie's prefix-search advantage is irrelevant for suffix-based decomposition |
| Linking element data | Static config in engine | Per-word `fuge` field in papertek-vocabulary | Decomposition only needs the *set of possible linkers* to try; per-word fuge data is needed for *generation* (not our use case in v2.1) |
| Noun set scope | `nounLemmas` (base forms) | `validWords` (all POS) | Using `validWords` would cause false splits on verb/adjective boundaries ("springer" = verb, not a compound component) |

---

## Data Requirements from papertek-vocabulary

### v2.1: No schema changes needed

The decomposition engine works entirely with existing data:
- `nounbank` entries provide the noun lemma set
- `genus` field on noun entries provides gender for inference
- `forms` object provides inflected forms for left-component matching

### Future (post-v2.1): Optional enrichment

If false-positive decompositions become a problem, add a `compoundable: false` flag to entries that should never be compound components (e.g., short nouns that cause spurious splits). This is additive and backward-compatible.

If the dictionary popup needs to show *which linker a word takes when used as a left component* (for student education), add `fuge: "s"` to entries in papertek-vocabulary. This is post-v2.1 scope — the decomposition engine doesn't need it.

---

## Bundle Size Impact

| Addition | Estimated Size | Cumulative |
|----------|---------------|------------|
| `compound-decomposer.js` | ~4 KB (minified) | 12.47 + 0.004 = 12.47 MiB |
| `nb-compound-gender.js` rule | ~2 KB | 12.48 MiB |
| `nb-demonstrative.js` rule | ~2 KB | 12.48 MiB |
| Manual spell-check button UI | ~1 KB | 12.48 MiB |

Well within the 20 MiB ceiling. No bundle-size concerns.

---

## Installation

No new packages. No `npm install` step needed.

The decomposer is a vanilla JS IIFE file added to:
- `extension/manifest.json` content_scripts array (after `vocab-seam-core.js`, before `spell-check-core.js`)
- `extension/content/compound-decomposer.js`

---

## Sources

- [stts-se/decomp](https://github.com/stts-se/decomp) — Swedish/Norwegian Bokmal compound boundary guesser (Go, confirms linker set and algorithm shape)
- [Algolia decompounding](https://www.algolia.com/blog/engineering/increase-decompounding-accuracy-by-generating-a-language-specific-lexicon) — lexicon-based decompounding approach (confirms dictionary-lookup is the standard non-ML method)
- [Norwegian compound word binding](https://kuriousfox.com/norwegian-word-binding-to-form-compound-words/) — NB linking elements: -s- (most common), -e- (rare), zero-fuge (default)
- [German Fugen-s rules](https://blogs.transparent.com/german/compound-words-das-fugen-s-im-deutschen-the-linking-s-in-german-part-1/) — German linking elements: -s-, -n-, -en-, -er-, -e-, -es-
- [John Resig: JS Trie Performance](https://johnresig.com/blog/javascript-trie-performance-analysis/) — Trie vs Hash performance in JavaScript (hash wins for point lookups; trie wins for prefix search)
- [Hash Table vs Trie](https://www.baeldung.com/cs/hash-table-vs-trie-prefix-tree) — Algorithmic complexity comparison
- Existing codebase: `de-compound-gender.js` lines 78-103 (proven suffix-match + linker-strip algorithm)
- Existing codebase: `vocab-seam-core.js` lines 706-807 (`buildLookupIndexes`, `compoundNouns` Set, `nounGenus` Map)
