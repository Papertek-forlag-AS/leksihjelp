# Phase 17: Compound Integration - Research

**Researched:** 2026-04-26
**Domain:** Dictionary popup rendering, spell-check compound acceptance, NB/NN compound gender inference, sarskriving expansion
**Confidence:** HIGH

## Summary

Phase 17 wires the decomposition engine (built in Phase 16) into four consumer surfaces: (1) dictionary popup compound cards, (2) spell-check compound acceptance, (3) NB/NN compound gender inference, and (4) sarskriving detection expansion. The engine is already available as a bound closure via `VOCAB.getDecomposeCompound()` in content scripts and as a raw export from vocab-seam-core.js for Node tests. The popup.js context does NOT currently load vocab-seam-core.js -- it will need to be added to popup.html's script list.

The existing sarskriving rule checks `compoundNouns.has(prev.word + t.word)` -- a stored-data lookup. Phase 17 adds a decomposition-backed fallback: when concatenation is NOT in compoundNouns, try `decomposeCompound(prev.word + t.word)` and flag if confidence is high. The existing de-compound-gender rule has its own inline `inferGenderFromSuffix` function with duplicated linking-element logic -- Phase 17 replaces this with delegation to the shared engine.

**Primary recommendation:** Three plans: (1) Dictionary popup compound card rendering with clickable components, (2) Spell-check compound acceptance + DE engine consolidation, (3) NB/NN compound gender inference + sarskriving expansion with fixture suite.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMP-01 | Dictionary entry for unknown compound nouns with gender badge and declension | Popup.js performSearch + renderResults need compound card path; vocab-seam-core.js loaded in popup.html for decomposeCompound access |
| COMP-02 | Compound breakdown visualization ("hverdag + s + mas") labeled "Samansett ord" | New renderCompoundCard function in popup.js; i18n key `compound_label` needed; component click triggers performSearch |
| COMP-03 | Decomposable compounds accepted as valid by spell-check | nb-typo-fuzzy.js check() must test decomposeCompound before flagging unknown words; priority: typo d=1 > decomposition > unknown |
| COMP-04 | Gender inference from last component for NB/NN compound nouns | New nb-compound-gender.js rule file, mirrors nb-gender.js pattern but uses decomposeCompound for unknown nouns |
| COMP-07 | Expanded sarskriving via decomposition | nb-sarskriving.js gets decomposition fallback when compoundNouns.has() fails |
| COMP-08 | Compound-aware NB/NN gender mismatch flags | Same nb-compound-gender.js rule: article + unknown noun -> decompose -> infer gender -> compare article |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vocab-seam-core.js | current | decomposeCompound engine | Phase 16 built it; 0% FP rate validated |
| vocab-seam.js | current | getDecomposeCompound getter | Phase 16-02 wired it |
| spell-check-core.js | current | Rule runner with priority-based dedup | Existing INFRA-03 architecture |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| check-fixtures.js | current | Regression fixture validation | Sarskriving P >= 0.92 gate |
| check-explain-contract.js | current | Explain contract validation | New rule files need explain() |
| check-rule-css-wiring.js | current | CSS colour binding validation | New rule IDs need CSS dot |

### No New Dependencies
Phase 17 adds zero new libraries. All work is wiring existing engine into existing surfaces.

## Architecture Patterns

### Pattern 1: Popup Compound Card (COMP-01, COMP-02)

**What:** When performSearch finds no results for a query, attempt decomposeCompound on the query. If decomposition succeeds, render a "Samansett ord" card instead of "no results."

**Where the code goes:**
- `extension/popup/popup.html` -- add `<script src="../content/vocab-seam-core.js"></script>` before popup.js
- `extension/popup/popup.js` -- add compound lookup in performSearch's no-results path, add renderCompoundCard function

**Key design decisions:**
1. Popup.js does NOT have nounGenus Map. Must build one from the loaded dictionary's nounbank. The nounbank contains `{ word, genus }` entries -- iterate once at dictionary load time to build `Map<lowercase_word, genus_code>`.
2. decomposeCompound is called as `vocabCore.decomposeCompound(query, nounGenusMap, currentLang)` using the raw export, NOT the bound closure (popup doesn't use vocab-seam.js).
3. Compound card renders: word, "Samansett ord" label, component breakdown with linkers, gender badge from last component, clickable components.
4. No inherited examples (explicit Out of Scope decision).
5. Stored nounbank entries always take precedence -- if the word is found in normal search, never show compound card.

**Rendering pattern:**
```javascript
// In performSearch, after all search phases produce combined=[] and fallback=[]:
if (combined.length === 0 && fallbackResults.length === 0) {
  const decomp = tryDecomposeQuery(q);
  if (decomp) {
    renderCompoundCard(q, decomp);
    return;
  }
}

function renderCompoundCard(query, decomposition) {
  // decomposition = { parts: [{word, genus, linker}], gender, confidence }
  // Render: word, "Samansett ord" badge, breakdown visualization, gender badge
  // Each component word is a clickable link that calls performSearch(component)
}
```

### Pattern 2: Spell-Check Compound Acceptance (COMP-03)

**What:** Modify nb-typo-fuzzy.js to check decomposeCompound before flagging as unknown.

**Precedence chain (critical):**
1. Word in validWords -> accepted (existing)
2. Word in sisterValidWords -> accepted (existing, Phase 4)
3. Typo-fuzzy d=1 match -> flag as typo (existing, priority 50)
4. **NEW: decomposeCompound returns non-null with confidence=high -> accepted (skip flagging)**
5. No match -> no flag (existing behavior -- typo-fuzzy only flags when it has a suggestion)

**Where:** In nb-typo-fuzzy.js check(), after the `!validWords.has(t.word)` guard and before `findFuzzyNeighbors`:

```javascript
// After: if (!validWords.has(t.word) && ...) {
// Before: const neighbors = findFuzzyNeighbors(...)

// Phase 17 COMP-03: decomposable compound -> accept silently
const decompose = vocab.decomposeCompound;
if (decompose && decompose(t.word)) continue;

// Then: proceed to fuzzy neighbor search
const neighbors = findFuzzyNeighbors(t.word, vocab, prevWord, ctx.lang || 'nb');
```

**Critical pitfall from STATE.md:** "Typo-fuzzy d=1 correction wins over decomposition acceptance." But this is ALREADY naturally handled because: if a word has a d=1 typo match AND is decomposable, the typo-fuzzy check runs FIRST (the word is not in validWords), finds the neighbor, and flags it. Decomposition acceptance is the fallback when NO fuzzy neighbor exists.

Wait -- re-reading the logic: typo-fuzzy only flags when `neighbors.length > 0`. So for a misspelled compound like "skoledegen" (close to "skoledeg"?), the fuzzy finds a neighbor and flags. For a valid compound like "hverdagsmas" (not in validWords), fuzzy finds no d=1 neighbor, so it doesn't flag. Phase 17 adds: before fuzzy runs, check decomposition. If decomposable, skip entirely (don't even try fuzzy). This means:
- "hverdagsmas" (valid compound, no fuzzy neighbor): decomposition catches it -> ACCEPT
- "skoledegen" (misspelled, has fuzzy neighbor "skoledeg"?): decomposition might also succeed if "skoledeg" happens to decompose... 

**Revised precedence:** The correct approach per STATE.md pitfall is: run fuzzy FIRST. If fuzzy finds a d=1 match, flag as typo regardless. Only if fuzzy finds nothing AND decomposition succeeds, accept silently. This means the decomposition check goes AFTER the fuzzy search, not before:

```javascript
const neighbors = findFuzzyNeighbors(t.word, vocab, prevWord, ctx.lang || 'nb');
if (neighbors.length > 0) {
  // Flag as typo (existing behavior -- wins over decomposition)
  out.push({ ... });
} else {
  // Phase 17 COMP-03: no fuzzy match -> try decomposition acceptance
  const decompose = vocab.decomposeCompound;
  if (decompose && decompose(t.word)) {
    continue; // Accept silently -- valid compound
  }
  // else: no flag (existing behavior for unknown words without suggestions)
}
```

### Pattern 3: DE Engine Consolidation (COMP-07 success criteria 7)

**What:** Replace de-compound-gender.js's inline `inferGenderFromSuffix` with delegation to the shared decomposeCompound engine.

**Current state:** de-compound-gender.js has its own ~25-line `inferGenderFromSuffix` function that does longest-suffix-search with linking elements. The shared engine does the same thing but better (validated, recursive, triple-consonant elision).

**Replacement pattern:**
```javascript
// Old: const inference = inferGenderFromSuffix(t.word, nounGenus);
// New: 
const decompose = vocab.decomposeCompound;
if (!decompose) continue;
const decomposition = decompose(t.word);
if (!decomposition || decomposition.confidence !== 'high') continue;
const inference = { genus: decomposition.gender, suffix: decomposition.parts[decomposition.parts.length - 1].word };
```

**Preserved behavior:** The rule still only fires when (a) noun not in nounGenus, (b) preceded by German article, (c) inferred gender differs from article's gender, (d) capitalized (German noun convention).

### Pattern 4: NB/NN Compound Gender Rule (COMP-04, COMP-08)

**What:** New rule file `nb-compound-gender.js` that flags article + unknown-compound-noun gender mismatches for NB/NN.

**Priority:** 71 (same tier as de-compound-gender.js, after gender rule at 10).

**Logic:** Nearly identical to nb-gender.js but for words NOT in nounGenus. For each `article + unknown_word` pair:
1. Check if previous token is NB/NN article (en/ei/et for NB; ein/ei/eit for NN)
2. Check word NOT in nounGenus (known nouns handled by nb-gender at priority 10)
3. Call decomposeCompound on the word
4. If decomposition succeeds with confidence=high, compare article gender to decomposed gender
5. If mismatch, flag with suggestion

**Key difference from nb-gender.js:** nb-gender checks `nounGenus.has(t.word)` to FIND the gender. nb-compound-gender checks `!nounGenus.has(t.word)` and then INFERS gender via decomposition.

### Pattern 5: Sarskriving Expansion (COMP-07)

**What:** Extend nb-sarskriving.js to use decomposition as fallback when `compoundNouns.has(concat)` fails.

**Current logic (line 80):** `compoundNouns.has(prev.word + t.word)` -> flag
**New logic:** `compoundNouns.has(prev.word + t.word) || (decompose && decompose(prev.word + t.word)?.confidence === 'high')` -> flag

**Guard:** Only high-confidence decompositions trigger sarskriving. Both components must be known nouns.

**Existing SARSKRIVING_BLOCKLIST still active:** Function words and common adjectives are still filtered first. Decomposition fallback only runs on pairs that pass the blocklist.

```javascript
// In the check loop:
const concat = prev.word + t.word;
const isKnownCompound = compoundNouns.has(concat);
const isDecomposable = !isKnownCompound && decompose && 
  (() => { const d = decompose(concat); return d && d.confidence === 'high'; })();

if (isKnownCompound || isDecomposable) {
  out.push({ ... });
}
```

### Anti-Patterns to Avoid
- **Adding decomposed compounds to validWords or compoundNouns:** Decomposition creates a parallel acceptance path -- NEVER mutate the stored indexes (STATE.md Pitfall 3/6).
- **Running decomposition for every token in spell-check:** Only run on tokens that already failed validWords/sisterValidWords checks.
- **Showing inherited examples for compound words:** Explicitly Out of Scope (REQUIREMENTS.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compound splitting | New splitting logic in any consumer | `decomposeCompound` from vocab-seam-core | Already validated with 0% FP; duplicating would drift |
| Linking element lists | Copy LINKERS per consumer | LINKERS_BY_LANG in vocab-seam-core | Single source of truth |
| nounGenus map in popup | Manual iteration at each search | Build once at dictionary load time | O(N) once vs O(N) per search |
| Gender label i18n | Hardcoded Norwegian strings | Existing `genusToGender()` in popup.js, `getString()` in spell-check-core | Already handles NB/NN |

## Common Pitfalls

### Pitfall 1: Popup nounGenus Map Construction
**What goes wrong:** popup.js has no nounGenus Map. Calling decomposeCompound requires one.
**Why it happens:** popup.js loads raw dictionary JSON and flattens to allWords[], but doesn't build spell-check indexes.
**How to avoid:** Build a lightweight nounGenus Map from dictionary.nounbank at loadDictionary time. Iterate nounbank entries and for each, add `entry.word.toLowerCase() -> entry.genus`. Also add plural/nounform entries if they carry genus. BUT the simplest approach: just call `vocabCore.buildIndexes({raw: dictionary, lang: currentLang})` and extract `.nounGenus` from the result. This reuses existing logic perfectly.
**Warning signs:** decomposeCompound returns null for everything because nounGenus is empty.

### Pitfall 2: Typo-Fuzzy vs Decomposition Precedence
**What goes wrong:** Misspelled compounds get accepted instead of corrected.
**Why it happens:** Decomposition check runs before fuzzy search.
**How to avoid:** Run fuzzy search FIRST. Only use decomposition acceptance when fuzzy finds NO neighbors. See Pattern 2 above.
**Warning signs:** "skoledegen" (typo of "skoledeg"?) accepted silently instead of corrected.

### Pitfall 3: Sarskriving FP Storm from Decomposition
**What goes wrong:** Decomposition-backed sarskriving flags too many adj+noun pairs.
**Why it happens:** The decomposition engine validates that both parts are nouns, but some adjectives ALSO appear in nounGenus (e.g., "god" might be in nounGenus via "god" the noun meaning "good person").
**How to avoid:** SARSKRIVING_BLOCKLIST is the first gate (runs before decomposition). Ensure blocklist includes common adjectives that are also nouns. Also require `confidence === 'high'` from decomposition.
**Warning signs:** P drops below 0.92 on fixture suite. Monitor fixture P/R after expansion.

### Pitfall 4: Floating Widget Compound Lookup
**What goes wrong:** Inline lookup in floating-widget.js shows "not found" for compounds.
**Why it happens:** floating-widget.js has its own showInlineLookup that doesn't use decomposition.
**How to avoid:** Add decomposition fallback to floating-widget.js's showInlineLookup, similar to popup.js. floating-widget.js already has access to vocab-seam-core via content script loading (it's in manifest content_scripts). Can use `self.__lexiVocabCore.decomposeCompound` with nounGenus from `self.__lexiVocab.getNounGenus()`.
**Warning signs:** Context-menu "Look up" shows nothing for compound words.

### Pitfall 5: DE Rule Regression from Engine Swap
**What goes wrong:** Replacing inferGenderFromSuffix with decomposeCompound changes which compounds get matched.
**Why it happens:** decomposeCompound requires BOTH parts to be known nouns (left AND right), while inferGenderFromSuffix only needs the suffix to be known.
**How to avoid:** This is actually BETTER behavior (fewer false positives). But document that some compounds previously caught by suffix-only matching may no longer fire. Run DE fixture suite to verify no regressions.
**Warning signs:** DE compound-gender fixture failures after swap.

### Pitfall 6: New Rule File Release Gates
**What goes wrong:** New nb-compound-gender rule file added but gates fail.
**Why it happens:** check-explain-contract and check-rule-css-wiring validate all popover-surfacing rules.
**How to avoid:** (a) Add `explain()` returning `{nb, nn}` strings, (b) Add `.lh-spell-nb-compound-gender` CSS binding in content.css, (c) Verify both gates pass.
**Warning signs:** `npm run check-explain-contract` or `npm run check-rule-css-wiring` exit 1.

### Pitfall 7: popup.html Script Order
**What goes wrong:** vocab-seam-core.js loaded after popup.js, so `self.__lexiVocabCore` is undefined.
**Why it happens:** Script order in popup.html matters (synchronous loading).
**How to avoid:** Add vocab-seam-core.js BEFORE popup.js in popup.html: `<script src="../content/vocab-seam-core.js"></script>`.

## Code Examples

### Building nounGenus in popup.js

```javascript
// At dictionary load time, build nounGenus for compound decomposition
let nounGenusMap = new Map(); // Module-level variable

async function loadDictionary(lang) {
  dictionary = await loadLanguageData(lang);
  if (!dictionary) throw new Error('No dictionary data');
  allWords = flattenBanks(dictionary);
  inflectionIndex = buildInflectionIndex(allWords);
  
  // Phase 17: build nounGenus for compound decomposition
  nounGenusMap = new Map();
  const nounbank = dictionary.nounbank;
  if (nounbank) {
    for (const entry of Object.values(nounbank)) {
      if (entry.word && entry.genus) {
        nounGenusMap.set(entry.word.toLowerCase(), entry.genus);
      }
    }
  }
  // ... rest of existing code
}
```

**Note:** This is a simplified approach. The full buildLookupIndexes in vocab-seam-core also adds plural forms and nounform entries to nounGenus. For compound decomposition to work well, the popup should reuse the full buildIndexes path. Alternative: call `self.__lexiVocabCore.buildIndexes({raw: dictionary, lang: currentLang})` and cache the `.nounGenus` result.

### Compound Card Rendering

```javascript
function renderCompoundCard(query, decomposition) {
  const container = document.getElementById('search-results');
  const parts = decomposition.parts;
  const gender = decomposition.gender;
  
  // Build breakdown string: "hverdag + s + mas"
  const breakdownParts = [];
  for (const part of parts) {
    breakdownParts.push(part.word);
    if (part.linker) breakdownParts.push(part.linker);
  }
  const breakdownStr = breakdownParts.join(' + ');
  
  container.innerHTML = `
    <div class="result-card glass compound-card">
      <div class="result-basic">
        <div class="result-word-row">
          <span class="result-word">${escapeHtml(query)}</span>
          <span class="compound-badge">${t('compound_label')}</span>
        </div>
        <div class="compound-breakdown">${breakdownStr}</div>
        <div class="compound-components">
          ${parts.map(p => `
            <button class="compound-component-btn" data-word="${escapeHtml(p.word)}">
              ${escapeHtml(p.word)}
              ${p.genus ? `<span class="component-gender">${genusToGender(p.genus)}</span>` : ''}
            </button>
          `).join('')}
        </div>
        <div class="result-meta">
          <span class="result-pos">${t('pos_noun')}</span>
          ${gender ? `<span class="result-gender">${genusToGender(gender)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
  
  // Click handler for component buttons -> search for that component
  container.querySelectorAll('.compound-component-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      document.getElementById('search-input').value = word;
      performSearch(word);
    });
  });
}
```

### Sarskriving Expansion

```javascript
// Modified nb-sarskriving.js check() - key section
check(ctx) {
  const { tokens, vocab, cursorPos, suppressed } = ctx;
  const compoundNouns = vocab.compoundNouns || new Set();
  const decompose = vocab.decomposeCompound; // Phase 17
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = tokens[i - 1];
    if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
    if (suppressed && (suppressed.has(i) || (i > 0 && suppressed.has(i - 1)))) continue;
    if (
      prev &&
      prev.word.length >= 2 && t.word.length >= 2 &&
      !SARSKRIVING_BLOCKLIST.has(prev.word) &&
      !SARSKRIVING_BLOCKLIST.has(t.word)
    ) {
      const concat = prev.word + t.word;
      const isCompound = compoundNouns.has(concat) ||
        (decompose && (() => { const d = decompose(concat); return d && d.confidence === 'high'; })());
      if (isCompound) {
        out.push({
          rule_id: 'sarskriving',
          priority: rule.priority,
          start: prev.start,
          end: t.end,
          original: `${prev.display} ${t.display}`,
          fix: prev.display + t.display.toLowerCase(),
          message: `Saerskriving: "${prev.display} ${t.display}" skrives som ett ord`,
        });
      }
    }
  }
  return out;
},
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DE suffix-only gender inference | Shared decomposeCompound (both-sides validation) | Phase 16 | Fewer FPs on DE compound gender |
| Sarskriving: stored compoundNouns only | Sarskriving: stored + decomposition fallback | Phase 17 | Catches productive compounds not in data |
| No NB/NN compound gender | Decomposition-backed gender inference | Phase 17 | "et fotballsko" flagged for first time |
| Popup shows "no results" for compounds | Popup shows compound card with breakdown | Phase 17 | Student learns compound structure |

## Open Questions

1. **Should floating-widget.js also show compound cards?**
   - What we know: floating-widget showInlineLookup currently shows "not found" for unknown words
   - What's unclear: Success criteria only mention "popup" -- is widget in scope?
   - Recommendation: YES, add a simplified compound display in floating-widget too. It has access to vocab-seam via content scripts. Low effort, high student value. But could be deferred to Phase 19 browser verification if it adds scope.

2. **How to handle definite-form compounds (e.g., "hverdagsmaten")?**
   - What we know: COMP-10 (definite-form stripping) is explicitly deferred to future release
   - What's unclear: n/a -- this is clearly out of scope
   - Recommendation: Do NOT attempt. Documented as future COMP-10.

3. **nounGenus construction in popup.js -- lightweight or full?**
   - What we know: Calling `vocabCore.buildIndexes` builds ALL indexes (heavy). Manual nounbank iteration is lightweight but misses plural/nounform genus entries.
   - What's unclear: Does decomposition need plural/nounform genus entries to work well?
   - Recommendation: Call `buildIndexes` once and cache the `nounGenus` Map. The performance cost is negligible (runs once at dictionary load) and ensures decomposition has the same nounGenus coverage as spell-check. The popup already does O(N) work in flattenBanks and buildInflectionIndex.

## Fixture Strategy

### Existing Sarskriving Fixtures
- **NB:** 81 lines (38 positive, 17 acceptance/negative, comments)
- **NN:** 68 lines (similar split)
- **P/R gate:** P >= 0.92, R >= 0.95

### New Fixtures Needed (15+ acceptance, 15+ rejection per success criteria 11)
**New positive cases** (compounds NOT in stored compoundNouns but decomposable):
- Productive compounds: "hverdagsmas", "fotballsko", "skolebuss", "middagsmat", etc.
- Must verify these are NOT already in compoundNouns (otherwise they test the old path, not the new one)
- Each fixture must have the concatenation as the expected fix

**New acceptance cases** (pairs that must NOT flag):
- Adj+noun pairs where concatenation happens to decompose: test blocklist effectiveness
- Function-word pairs: ensure blocklist still blocks
- Pairs where one word is very short (< 2 chars): existing length guards

### Running Fixtures
```bash
npm run check-fixtures nb --rule=saerskriving --verbose
```

## Sources

### Primary (HIGH confidence)
- Direct code reading: popup.js (lines 1016-1266), spell-check.js (lines 220-280), vocab-seam-core.js (lines 1076-1182)
- Direct code reading: nb-sarskriving.js (full file, 99 lines)
- Direct code reading: de-compound-gender.js (full file, 183 lines)
- Direct code reading: nb-gender.js (full file, 106 lines)
- Direct code reading: nb-typo-fuzzy.js (full file, 187 lines)
- Direct code reading: vocab-seam.js (getDecomposeCompound getter, line 316)
- Phase 16 summaries: 16-01-SUMMARY.md, 16-02-SUMMARY.md

### Secondary (MEDIUM confidence)
- STATE.md pitfall warnings (verified against code)
- REQUIREMENTS.md COMP-01 through COMP-08 definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all existing code, no new libraries
- Architecture: HIGH - patterns directly derived from code reading
- Pitfalls: HIGH - derived from STATE.md decisions + code analysis
- Fixture strategy: HIGH - existing fixture infrastructure well understood

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable -- all internal code, no external dependencies)
