# Architecture Patterns

**Domain:** Compound word decomposition + polish items for Leksihjelp v2.1
**Researched:** 2026-04-26
**Confidence:** HIGH (all recommendations grounded in direct code read of existing architecture)

---

## 1. Baseline Architecture (Post-v2.0)

The existing system has three key integration surfaces relevant to v2.1:

### 1.1 Vocab Seam (shared indexes)

```
vocab-seam-core.js (1,224 LOC)        vocab-seam.js (325 LOC)
  Pure, side-effect-free                Browser IIFE glue
  buildIndexes() → state object         Exposes self.__lexiVocab
  Dual-export: Node + browser           Getter surface for all consumers
```

`buildIndexes` already produces: `nounGenus` (Map, ~4k entries), `compoundNouns` (Set, noun headwords), `validWords` (Set). These are the three indexes compound decomposition needs.

### 1.2 Spell-Check Pipeline

```
spell-check.js: runCheck()
  → builds vocab bag from VOCAB.getXxx()
  → CORE.check(text, vocab, opts)
    → tokenize → build ctx → iterate rules → dedup
```

Rules receive `ctx = {tokens, vocab, cursorPos, lang, suppressed, sentences, ...}`. The `vocab` bag is assembled in `runCheck()` (lines 225-259) and passed verbatim to every rule's `check(ctx)`.

### 1.3 Dictionary Popup

```
popup.js: performSearch(query)
  → Phase 1: direct matches on allWords[]
  → Phase 2: inflection matches via inflectionIndex
  → Phase 3: phonetic matches
  → renderResults([{entry, inflectionHint}])
```

popup.js operates on its own `dictionary` object loaded from `extension/data/{lang}.json`. It does NOT currently load `vocab-seam-core.js` or use `__lexiVocab`.

---

## 2. Compound Decomposition Engine

### 2.1 Where It Lives: `vocab-seam-core.js`

**Decision:** Add `decomposeCompound(word, nounGenus, lang)` as a new pure function in `vocab-seam-core.js`, exported alongside `buildIndexes`, `phoneticNormalize`, and `phoneticMatchScore`.

**Rationale:**
1. **Already houses compound-adjacent data.** `buildLookupIndexes` builds `compoundNouns` and `nounGenus` -- the exact indexes decomposition needs.
2. **Dual-export pattern.** Runs identically in browser (content scripts) and Node (fixture harness). Free testability.
3. **No new manifest entry.** No new content script file = no load-order coordination.
4. **Three consumers need it.** Spell rules (nb-sarskriving, de-compound-gender), dictionary popup, and potentially future NB/NN gender inference. Putting it in a rule file would lock out the popup.

**Why NOT a separate module:** Adding a new `compound-decompose.js` would require a manifest.json content_scripts entry and load-order guarantees relative to vocab-seam-core.js. The function is ~80 LOC and operates on data already produced by `buildIndexes`. It belongs with its data.

**Why NOT inside a spell rule:** Rules have no established import mechanism between each other. The popup doesn't load spell rules at all. A rule-housed engine would be unreachable from the dictionary.

### 2.2 Function Signature and Return Shape

```javascript
/**
 * @param {string} word       - lowercase token to decompose
 * @param {Map<string,string>} nounGenus - word -> genus ('m','f','n')
 * @param {string} lang       - 'nb'|'nn'|'de'
 * @returns {null | {
 *   parts: Array<{word: string, genus: string|null, linker: string}>,
 *   gender: string,        // genus of last component (operative gender)
 *   confidence: 'high'|'medium'
 * }}
 */
function decomposeCompound(word, nounGenus, lang) { ... }
```

**Shape rationale:**
- `parts` array (not a pair) supports 3+ component compounds: `brannstasjonsjef` = brann + stasjon + sjef (NB), `Donaudampfschifffahrt` (DE).
- Each part carries `genus` for educational display (popup can show per-component gender).
- `linker` records the joining element (empty string, 's', 'e', 'n', 'en', 'er', 'es') for pedagogical transparency.
- `confidence: 'high'` = both head and tail are known nouns. `'medium'` = only the tail is a known noun. Consumers can gate on this: spell-check acceptance requires `'high'`, popup display accepts both.

### 2.3 Language-Specific Linking Elements

```javascript
const LINKERS_BY_LANG = {
  de: ['s', 'n', 'en', 'er', 'e', 'es'],  // existing set from de-compound-gender.js
  nb: ['s', 'e'],                           // binde-s (arbeidstid), binde-e (barnehage)
  nn: ['s', 'e'],                           // same as NB
};
```

DE linkers are already proven correct in `de-compound-gender.js` (line 31). NB/NN linkers are simpler -- Norwegian productive compounding uses `binde-s` (most common: arbeidstid, brannstasjon) and occasionally `binde-e` (barnehage, gudskelov).

### 2.4 Algorithm: Greedy Longest-Head, Recursive

```
1. For split positions 3..len-3:
   a. Direct: head is known noun, tail is known noun → high confidence
   b. With linker: head + linker + tail, both known → high confidence
2. If no high-confidence split found:
   a. Tail-only: try shortest tail that's a known noun → medium confidence
   b. With linker variant
3. Recursive: if head is known, try decomposing the tail → 3+ part compounds
```

This matches the approach already working in `de-compound-gender.js` `inferGenderFromSuffix` (lines 78-103) but generalizes it to NB/NN and returns structured data instead of just genus.

### 2.5 Wiring Into buildIndexes

`buildIndexes` returns a bound closure so consumers don't need to manage the `nounGenus` dependency:

```javascript
// In buildIndexes return object, add:
decomposeCompound: (word) => decomposeCompound(word, nounGenus, lang),
```

This follows the pattern of `phoneticNormalize` and `phoneticMatchScore` on the existing API export.

---

## 3. Integration Point 1: vocab-seam.js (Browser Glue)

Add one getter to `self.__lexiVocab`:

```javascript
getDecomposeCompound: () => (state && state.decomposeCompound)
  ? state.decomposeCompound
  : null,
```

Returns the bound closure from `buildIndexes`, or `null` if state isn't loaded yet. Consumers null-check before calling.

---

## 4. Integration Point 2: Spell-Check Pipeline

### 4.1 vocab Bag Wiring

In `spell-check.js` `runCheck()`, add one line to the `vocab` object (after line 258):

```javascript
decomposeCompound: VOCAB.getDecomposeCompound(),
```

Rules access it as `vocab.decomposeCompound(word)`. If `null` (vocab not loaded), rules skip decomposition gracefully.

### 4.2 nb-sarskriving Upgrade

**Current behavior (line 80):** `compoundNouns.has(prev.word + t.word)` -- dictionary lookup only.

**Upgraded behavior:** Falls back to decomposition when concatenation is NOT in compoundNouns:

```javascript
const concat = prev.word + t.word;
const isKnownCompound = compoundNouns.has(concat);
const isDecomposable = !isKnownCompound
  && vocab.decomposeCompound
  && vocab.decomposeCompound(concat)?.confidence === 'high';

if (isKnownCompound || isDecomposable) {
  out.push({ ... });
}
```

**Only `confidence === 'high'` triggers the flag.** This prevents false positives where the head is a verb stem or adjective rather than a noun. The existing `SARSKRIVING_BLOCKLIST` (lines 30-45) continues to guard against function-word collisions.

### 4.3 de-compound-gender Refactoring

Replace the local `inferGenderFromSuffix` (lines 78-103) with a delegation to shared decomposition:

```javascript
// Current:
const inference = inferGenderFromSuffix(t.word, nounGenus);

// Becomes:
const decomp = vocab.decomposeCompound ? vocab.decomposeCompound(t.word) : null;
if (!decomp) continue;
const inference = { genus: decomp.gender, suffix: decomp.parts[decomp.parts.length - 1].word };
```

**Keep `inferGenderFromSuffix` as dead code for one release cycle** as a rollback path. Remove once fixtures pass cleanly with the shared engine.

### 4.4 NB/NN Gender Inference for Decomposed Compounds

The existing `nb-gender` rule (or a new sibling) can use decomposition to infer gender for unknown compounds:

```
"en skolesekk" → decomposeCompound('skolesekk') → gender 'm' → matches 'en' → OK
"et skolesekk" → gender 'm' → mismatch with 'et' (n) → flag
```

This extends the existing nounGenus-based gender checking to productive compounds not in the dictionary.

---

## 5. Integration Point 3: Dictionary Popup

### 5.1 The Problem

popup.js operates on its own data pipeline (`dictionary`, `allWords`, `inflectionIndex`). It does NOT load `vocab-seam-core.js`. When a student searches for an unknown compound like "skolesekk" or "fotballtrening", `performSearch` returns zero results.

### 5.2 Solution: Load vocab-seam-core.js in popup.html

Add a `<script>` tag in `popup.html` before `popup.js`:

```html
<script src="../content/vocab-seam-core.js"></script>
<script src="popup.js"></script>
```

This gives popup.js access to `self.__lexiVocabCore.decomposeCompound`. The IIFE self-registers on `self.__lexiVocabCore` (line 1222 of vocab-seam-core.js) which works in both content-script and popup contexts.

### 5.3 Build a nounGenus Map in popup.js

popup.js already has `dictionary` with full `nounbank`. Build the map once when dictionary loads:

```javascript
// In loadDictionary(), after flattenBanks(dictionary):
let popupNounGenus = new Map();
if (dictionary.nounbank) {
  for (const entry of Object.values(dictionary.nounbank)) {
    if (entry.word && entry.genus) {
      popupNounGenus.set(entry.word.toLowerCase(), entry.genus);
    }
  }
}
```

### 5.4 Decomposition Fallback in performSearch

At the end of `performSearch`, after all existing search phases find zero results:

```javascript
if (directResults.length === 0 && inflectionResults.length === 0) {
  const core = self.__lexiVocabCore;
  if (core && popupNounGenus.size > 0) {
    const decomp = core.decomposeCompound(q, popupNounGenus, currentLang);
    if (decomp) {
      renderDecompositionResult(decomp, q);
      return;
    }
  }
}
```

### 5.5 renderDecompositionResult

A dedicated renderer (NOT piped through `renderResults`) because decomposition results have a fundamentally different shape:

```javascript
function renderDecompositionResult(decomp, query) {
  const container = document.getElementById('search-results');
  const partsHtml = decomp.parts.map(p => {
    const genusLabel = p.genus ? genusToGender(p.genus) : '';
    return `<span class="decomp-part">${escapeHtml(p.word)}${
      genusLabel ? ` <span class="decomp-genus">(${escapeHtml(genusLabel)})</span>` : ''
    }${p.linker ? `<span class="decomp-linker">${escapeHtml(p.linker)}</span>` : ''}</span>`;
  }).join(' + ');

  const genderLabel = decomp.gender ? genusToGender(decomp.gender) : '';
  container.innerHTML = `
    <div class="result-card glass decomp-card">
      <div class="decomp-header">${escapeHtml(query)}</div>
      <div class="decomp-breakdown">${partsHtml}</div>
      <div class="decomp-gender">${t('compound_gender')}: ${escapeHtml(genderLabel)}</div>
      <div class="decomp-confidence">${
        decomp.confidence === 'high' ? t('compound_conf_high') : t('compound_conf_medium')
      }</div>
    </div>`;
}
```

Each component word is clickable -- clicking triggers a new `performSearch` for that component, showing the full dictionary entry. This gives the student the "drill down" experience.

---

## 6. Integration Point 4: Manual Spell-Check Button

### 6.1 The Problem

Currently, spell-check runs on input/keyup events with an 800ms debounce. Uncertain or dyslexic students want an explicit "check now" action.

### 6.2 Event Mechanism: CustomEvent (Not chrome.runtime.sendMessage)

`floating-widget.js` and `spell-check.js` execute in the same content-script context. Using `chrome.runtime.sendMessage` would route through the background script unnecessarily. A DOM CustomEvent stays within the page:

```javascript
// floating-widget.js (button click handler):
document.dispatchEvent(new CustomEvent('lexi-spell-check-run'));

// spell-check.js (listener, added in attachListeners):
document.addEventListener('lexi-spell-check-run', () => {
  if (!enabled || paused) return;
  const el = resolveEditable(document.activeElement);
  if (el) {
    activeEl = el;
    runCheck();  // bypass debounce, run immediately
  }
});
```

### 6.3 Button Placement

Add a small checkmark/pencil icon button to the floating widget (alongside the existing TTS play button). The button is always visible when the widget is shown, not gated on subscription status (spell-check is free).

### 6.4 Pipeline Reuse

The manual button calls the exact same `runCheck()` function. No separate code path. The only difference is it bypasses the 800ms debounce timer.

---

## 7. Integration Point 5: Demonstrative-Mismatch Rule

### 7.1 Architecture

New file: `extension/content/spell-rules/nb-demonstrative-mismatch.js`

Standard plugin rule shape. Uses existing `nounGenus` Map (no new data needed). Checks `det/den/dette/denne/disse` + following token against nounGenus:

```
"Det boka" → nounGenus('boka') = 'f' → 'det' expects 'n' → mismatch → flag
"Den huset" → nounGenus('huset') = 'n' → 'den' expects 'm/f' → mismatch → flag
```

### 7.2 Demonstrative-Gender Mapping

```javascript
const DEMONSTRATIVE_GENDER = {
  'den': new Set(['m', 'f']),   // maskulin/feminin
  'det': new Set(['n']),         // noytrum
  'denne': new Set(['m', 'f']),
  'dette': new Set(['n']),
  'disse': null,                 // plural, no gender check
};
```

### 7.3 Decomposition Integration

When the noun following a demonstrative is NOT in `nounGenus`, try decomposition:

```javascript
let genus = nounGenus.get(nextToken.word);
if (!genus && vocab.decomposeCompound) {
  const decomp = vocab.decomposeCompound(nextToken.word);
  if (decomp && decomp.confidence === 'high') genus = decomp.gender;
}
```

This makes the demonstrative rule work on productive compounds -- a natural benefit of the shared decomposition engine.

---

## 8. Anti-Patterns to Avoid

### Anti-Pattern 1: Decomposition as a Spell Rule

Putting the engine in `spell-rules/nb-compound-decompose.js` would lock it away from popup.js (which doesn't load spell rules) and from de-compound-gender.js (no import path between rules).

### Anti-Pattern 2: Pre-Computing All Compounds at Build Time

The compound space is O(n^2) on nounGenus entries (~4k^2 = ~16M). Most are nonsense. On-demand decomposition costs ~0.1ms per call. No index needed.

### Anti-Pattern 3: Piping Decomposition Through renderResults

Decomposition results have a different shape (parts array, no conjugations, no examples). Force-fitting into the existing card template produces empty sections. Use a dedicated renderer.

### Anti-Pattern 4: Injecting Inferred Genders Into nounGenus

Mutating the shared index at query time creates race conditions and test non-determinism. Keep decomposition results ephemeral.

---

## 9. Build Order (Dependency-Driven)

| Phase | What | Depends On | Files Changed |
|-------|------|-----------|--------------|
| **1** | Decomposition engine | -- | `vocab-seam-core.js` (+80 LOC), `vocab-seam.js` (+3 LOC) |
| **2** | Spell-check wiring + rule upgrades | Phase 1 | `spell-check.js` (+2), `nb-sarskriving.js` (+15), `de-compound-gender.js` (+5/-25) |
| **3** | NB/NN gender inference for compounds | Phase 1 | Existing `nb-gender` rule or new sibling (+20 LOC) |
| **4** | Dictionary popup integration | Phase 1 | `popup.html` (+1), `popup.js` (+70), `content.css` (+10), `strings.js` (+8) |
| **5** | Demonstrative-mismatch rule | Phase 1 (optional, uses decomp) | **New:** `nb-demonstrative-mismatch.js` (~60), `content.css` (+2), `strings.js` (+4) |
| **6** | Manual spell-check button | -- (independent) | `floating-widget.js` (+15), `spell-check.js` (+10), `content.css` (+8), `strings.js` (+2) |
| **7** | Triple-letter typo budget | -- (independent) | `nb-typo-fuzzy.js` (+10) |
| **8** | Browser visual verification | -- (independent) | Manual testing, fix any regressions |

**Phases 5, 6, 7 are independent and can run in parallel.** Phase 8 is pure verification with no code dependency.

---

## 10. Files Modified vs New

### Modified Files (11)

| File | Change | LOC Delta |
|------|--------|-----------|
| `extension/content/vocab-seam-core.js` | Add `decomposeCompound` function + export on API object | +80 |
| `extension/content/vocab-seam.js` | Add `getDecomposeCompound` getter on `__lexiVocab` | +3 |
| `extension/content/spell-check.js` | Wire `decomposeCompound` into vocab bag + CustomEvent listener for manual trigger | +12 |
| `extension/content/spell-rules/nb-sarskriving.js` | Decomposition fallback for unknown compounds (confidence=high gate) | +15 |
| `extension/content/spell-rules/de-compound-gender.js` | Delegate splitting to shared `decomposeCompound` | +5, -25 |
| `extension/content/spell-rules/nb-typo-fuzzy.js` | Triple-letter budget frequency-weighted tiebreak | +10 |
| `extension/content/floating-widget.js` | Manual spell-check button (CustomEvent dispatch) | +15 |
| `extension/styles/content.css` | Button CSS + new rule dot colour for demonstrative-mismatch | +20 |
| `extension/popup/popup.js` | Decomposition search fallback + `renderDecompositionResult` | +70 |
| `extension/popup/popup.html` | Script tag for vocab-seam-core.js | +1 |
| `extension/i18n/strings.js` | i18n keys for compound breakdown + button tooltip + demonstrative explain | +14 |

### New Files (1)

| File | Purpose | LOC |
|------|---------|-----|
| `extension/content/spell-rules/nb-demonstrative-mismatch.js` | Demonstrative + noun gender mismatch (`Det boka`, `Den huset`) | ~60 |

### No New Manifest Entries Required

`nb-demonstrative-mismatch.js` goes in `spell-rules/` which is already covered by the wildcard content_scripts entry in manifest.json. popup.html gets an additional `<script>` tag for vocab-seam-core.js (already a content script, now also loads in popup context).

---

## 11. Scalability Considerations

| Concern | Current (v2.0) | v2.1 Impact | Notes |
|---------|----------------|-------------|-------|
| Startup time | ~120ms buildIndexes | +0ms (decompose is lazy, on-demand) | No build-time cost |
| Per-token cost in spell-check | ~0.05ms validWords.has() | +0.1ms decomposeCompound() only for unknown tokens | Cache-miss only; most tokens are known |
| Memory | nounGenus ~4k entries | +0 (reuses existing Map) | No new data structures at build time |
| Bundle size | 12.47 MiB | +~4 KB (decompose fn + button CSS + new rule) | Well within 20 MiB cap |
| Popup memory | dictionary + allWords | +popupNounGenus Map (~4k entries, ~200KB) | One-time cost; popup already holds full dictionary |

---

## Sources

- Direct code analysis of `vocab-seam-core.js` (1,224 LOC), `vocab-seam.js` (325 LOC), `spell-check.js` (~560 LOC), `nb-sarskriving.js` (99 LOC), `de-compound-gender.js` (183 LOC), `popup.js` (~1,800 LOC)
- Norwegian compound formation: binde-s (arbeidstid) and binde-e (barnehage) are the two productive linking morphemes in NB/NN
- German compound linkers: verified in existing `de-compound-gender.js` (line 31): `['s', 'n', 'en', 'er', 'e', 'es']`
- `.planning/PROJECT.md` -- v2.1 milestone definition, existing architecture description
- Confidence: HIGH -- all recommendations based on direct source reading of existing architecture, no external sources needed
