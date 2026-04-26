# Domain Pitfalls — v2.1 Compound Decomposition & Polish

**Domain:** Adding compound word decomposition (NB/NN/DE) + carry-over polish items to existing 57-rule spell-check extension
**Researched:** 2026-04-26
**Confidence:** HIGH -- grounded in existing codebase analysis, Spraakraadet fuge documentation, and v1.0/v2.0 shipped rule interaction patterns

**System state:** 57 spell rules (plugin architecture), 2,124 NB nouns, 1,641 DE nouns, `dedupeOverlapping` priority-based conflict resolution, 9 release gates, 3,326 fixture lines at F1=1.000, 12.47 MiB zip (20 MiB cap).

---

## Critical Pitfalls

### Pitfall 1: Greedy longest-suffix produces phantom compound splits

**What goes wrong:** The existing `de-compound-gender.js` (lines 78-103) uses greedy longest-suffix matching -- scan from position 1 rightward to find the longest tail in `nounGenus`. This works for DE gender inference (where you only validate the suffix) but fails for full decomposition because it never validates the PREFIX side. Result: words that happen to end with a real noun but are not compounds get accepted as valid.

Concrete examples from the NB nounbank:
- "minister" contains suffix "ister" (suet/lard in Norwegian)
- "angrep" contains suffix "rep" (rope)
- "familie" contains suffix "lie" (a lie in English, but also in some dictionaries)
- "karakter" contains "akter" (aft/stern)

With linking-element stripping, the surface expands further. Stripping a fuge-s from "ministers" yields "minister" -> suffix "ister" after dropping the 's' linker. Ghost splits multiply.

**Why it happens:** The `inferGenderFromSuffix` function in `de-compound-gender.js` deliberately only checks the suffix side because its purpose is gender inference, not decomposition validation. Extending this approach to full decomposition without adding prefix validation replicates the one-sided check.

**Consequences:** (a) False acceptance of misspelled words as valid compounds, (b) wrong dictionary popup results, (c) wrong gender inference propagating to article-correction rules, (d) expanded sarskriving false positives.

**Prevention:**
1. Require BOTH sides of every split to be valid entries. Prefix must be in `nounGenus` (or `validWords` for non-noun first components). Suffix must be in `nounGenus`.
2. Minimum component length >= 3 for BOTH prefix AND suffix (not just suffix as in the current `MIN_SUFFIX_LEN = 3`).
3. Build a validation corpus: run decomposition against all 2,124 existing NB nouns. Any noun that decomposes into parts where either part lacks independent meaning is a false positive. Target: <2% false-positive rate on existing nounbank.
4. Maintain a small blocklist of known false splits (words that look decomposable but etymologically aren't). Seed from the validation corpus; grow from user reports.

**Detection:** Automated test: for every noun already in nounbank, run decomposition. If the noun has a stored compound structure, verify decomposition recovers it. If the noun is NOT a compound, verify decomposition returns null. This test catches regressions when the noun bank grows.

---

### Pitfall 2: Linking element ambiguity creates wrong splits and missed splits

**What goes wrong:** The same characters can be a linking element OR part of a word. "Arbeidsliv" = arbeid + s + liv (fuge-s). But in "arbeidslos" the 's' is part of the word stem, not a linker. For DE, "-en-" could be the linker or part of "Frauen" (which ends in -en). Trying all linking elements at every split point creates combinatorial splits where multiple decompositions are valid.

NB/NN fuge rules are partially lexical, partially suffix-pattern-based. Spraakraadet documents that fuge-s is "almost always" used after word-endings -dom, -else, -het, -skap, -sjon, -tet, -ling. But outside these patterns, "Det kan vaere vanskelig aa vite" (it can be difficult to know). DE linguistics literature confirms: "there are no fixed rules" for Fugenelemente selection.

**Consequences:** Wrong linking element choice -> wrong split boundaries -> wrong gender inference from wrong suffix. Or: valid compound missed because the algorithm tries the wrong linker first and finds no valid split.

**Prevention:**
1. For NB/NN: implement Spraakraadet's suffix-based heuristics as a first-pass fuge predictor. If the first component ends in -dom, -else, -het, -skap, -sjon, -tet, -ling, -nad: expect fuge-s. This covers the documented "naer alltid" (almost always) cases.
2. For both NB and DE: try splits in this order: (a) zero-fuge first, (b) fuge-s (most common), (c) remaining linkers. Accept the FIRST valid split (both sides valid). Do not enumerate all possible splits -- greedy is acceptable here because ambiguous splits are rare enough not to justify exhaustive search.
3. For DE: reuse the existing `LINKERS = ['s', 'n', 'en', 'er', 'e', 'es']` from `de-compound-gender.js` with the same priority ordering.
4. Consider adding a `fuge` property to high-frequency first components in papertek-vocabulary nounbank (e.g., hverdag -> "s", skole -> "", barn -> "e"). Research question for phase planning: how many nouns commonly appear as first components? Estimate: <200 for NB. This is a data enrichment, not logic.

**Detection:** Benchmark test: for known compounds containing linking elements (hverdagsmas, gutteklasse, barnehage), verify decomposition recovers the correct split point and correct linker. Manual review of the first 50 decompositions on benchmark texts.

---

### Pitfall 3: Decomposition silences typo-fuzzy on misspelled long words

**What goes wrong:** The typo-fuzzy rule (priority 50) fires on unknown words not in `validWords`. If decomposition adds successfully-decomposed compounds to the "accepted" set (or runs at a priority that preempts typo-fuzzy), a misspelled compound that accidentally decomposes into real parts is silently accepted.

Example: student writes "skoledegen" (typo for "skoledagen", the school day). Decomposition: "skole" + "degen" -- "degen" IS a word (the rapier/sword). Decomposition says "valid compound", student never sees the typo correction.

This is the mirror image of v1.0 Pitfall 1 (typo entries shadowed into validWords, silencing the curated-typo branch -- fixed in `vocab-seam-core.js` line 777). Same class of error: an acceptance path that's too broad silences a correction path.

**Why it happens:** Decomposition validates syntactic validity (both parts are real words) but has no way to check semantic plausibility. In Norwegian and German, ANY two nouns can be productively compounded, so "skoledegen" (school rapier) is syntactically valid even though semantically nonsensical.

**Consequences:** The system's primary value -- catching misspellings -- degrades for compound-length words, which are exactly the words students misspell most often.

**Prevention:**
1. Decomposition MUST NOT add compounds to `validWords`. It should be a separate acceptance path.
2. Priority ordering: if typo-fuzzy finds a d=1 neighbor for the FULL compound word, the typo correction wins over decomposition acceptance. Implement: decomposition acceptance runs at priority > 50 (after typo-fuzzy); if typo-fuzzy already emitted a finding for this token, decomposition defers.
3. Alternatively: decomposition only accepts compounds where the FIRST component is >= 4 characters AND the SECOND component is >= 4 characters, reducing the chance of accidental two-short-word matches.
4. Fixture cases: include misspelled compounds where a typo-fuzzy correction exists. Verify the typo finding fires, not decomposition acceptance.

**Detection:** Write ~10 fixture cases of misspelled compounds that accidentally decompose (e.g., "skoledegen", "huskattten"). Verify typo-fuzzy fires on each.

---

### Pitfall 4: Sarskriving expansion without blocklist update causes false-positive storm

**What goes wrong:** The current `nb-sarskriving.js` checks if `prev.word + t.word` exists in `compoundNouns` (a Set of nounbank base entries). With decomposition, you could flag "skole dag" even if "skoledag" isn't stored -- because decomposition verifies it's a valid compound. But this massively expands the firing surface. Every adjacent noun pair where the concatenation decomposes validly becomes a candidate.

The existing `SARSKRIVING_BLOCKLIST` (lines 30-45 in `nb-sarskriving.js`) was tuned for the 2,124-entry `compoundNouns` set. It blocks function words and common adjectives. But it does NOT block noun-noun adjacency where both words are independently valid nouns. "glass bord" could be a list ("a glass and a table") or a compound ("glassbord", a glass table). The current system never had to decide because "glassbord" was either in `compoundNouns` or it wasn't.

**Consequences:** Sarskriving precision (currently P=1.000 on 55 NB + 46 NN cases) drops below the 0.92 threshold in `check-fixtures.js`. Students see false positives on legitimate noun phrases and lose trust in the rule.

**Prevention:**
1. DO NOT expand sarskriving to use decomposition in the first implementation phase. Ship decomposition for dictionary lookup and spell-check acceptance first. Sarskriving expansion is a separate, later step requiring its own fixture tuning round.
2. When eventually expanding: require a linking element (fuge-s, fuge-e) in the concatenated form as a stronger signal. "skolesekk" (zero-fuge) is already in compoundNouns; "hverdagsmas" (fuge-s) is a strong signal because the 's' disambiguates from a two-word reading. Zero-fuge decomposition-based sarskriving has lower precision.
3. Add minimum combined length >= 8 for decomposition-based sarskriving expansions.
4. Run the expanded sarskriving against all benchmark texts; manual-review every new finding. If >10% are false positives, the expansion isn't ready.

**Detection:** Before shipping sarskriving expansion: measure P/R delta on existing fixtures + benchmark corpus. Ship only if P stays >= 0.92.

---

## Moderate Pitfalls

### Pitfall 5: Performance regression from decomposition on every unknown word

**What goes wrong:** The typo-fuzzy rule already iterates `validWords` (a Set of every known form, likely 10,000+ entries for NB) for every unknown token. Adding decomposition means trying to split every unknown token at every position (average word length ~8), checking both halves against `nounGenus`. With ~2,124 NB nouns in `nounGenus`, each split-check is O(1) for the Map lookup, but there are O(word_length * linker_count) = ~48 split attempts per word. This runs on every keystroke during auto-detect.

**Why it happens:** Decomposition is inherently more expensive than a `Set.has()` lookup. The cost multiplies by the number of unknown tokens in the text.

**Prevention:**
1. Gate decomposition behind minimum word length >= 6. Words shorter than 6 characters are almost never productive compounds in NB or DE.
2. Cache decomposition results in a `Map<string, DecompResult|null>` cleared on language change. The same unknown word appears on every keystroke re-check; caching avoids redundant work.
3. Run decomposition ONLY on tokens that fail `validWords.has()` AND `sisterValidWords.has()` -- same precondition as typo-fuzzy.
4. Measure before optimizing: profile the spell-check pass on a 500-word benchmark text with and without decomposition. If delta < 50ms, no optimization needed. Current budget is probably ~20ms for the full pass.

**Detection:** Performance test: time `check()` on a 500-word NB text with 20% unknown words, with and without decomposition. Alert threshold: 50ms delta.

### Pitfall 6: `compoundNouns` Set semantics silently change

**What goes wrong:** The `compoundNouns` Set in `vocab-seam-core.js` (line 712, 793) currently contains only nounbank base entries. It's consumed exclusively by `nb-sarskriving.js`. If decomposition-verified compounds are added to this Set, the semantics change from "stored compounds" to "stored + inferred compounds." Any code that checks `compoundNouns.has(word)` gets a different answer than before.

**Why it happens:** Reusing an existing data structure for a new purpose without auditing all consumers.

**Prevention:**
1. DO NOT modify the `compoundNouns` Set. Keep it as the stored-compound set for sarskriving.
2. Create a NEW function `decomposeCompound(word, vocab)` in `vocab-seam-core.js` that returns a decomposition result `{prefix, linker, suffix, genus}` or `null`. Export via `__lexiVocabCore` API.
3. Rules that need decomposition call the function directly. The function is stateless and side-effect-free.
4. grep-audit: `compoundNouns` currently appears only in `nb-sarskriving.js` (consumer) and `vocab-seam-core.js` (builder). Keep it that way.

**Detection:** grep for `compoundNouns` across all files after implementation. Only `nb-sarskriving.js` and `vocab-seam-core.js` should reference it.

### Pitfall 7: Demonstrative-mismatch rule collides with nb-gender on overlapping spans

**What goes wrong:** New demonstrative-mismatch rule ("Det boka" -> "Den boka") flags det/den when the gender doesn't match the following noun. But `nb-gender` (priority 10) already flags article-noun gender mismatches for en/ei/et. If a student writes "Det bok" (wrong determiner + missing definiteness), both rules could fire on overlapping spans. `dedupeOverlapping` keeps the first (lowest priority number wins).

Problem 1: If demonstrative-mismatch gets priority < 10, it suppresses nb-gender on cases where the student used "det" as a vague article (common student error pattern: "det bok" meaning "en bok"). The more common error gets no feedback.

Problem 2: If demonstrative-mismatch gets priority > 10, nb-gender fires on "det boka" and suggests "en boka" or "ei boka" -- wrong fix. The article "det" is being used as a demonstrative (this), not an indefinite article.

**Prevention:**
1. Demonstrative-mismatch MUST distinguish demonstrative from article usage. Key signal: definiteness of the following noun. Demonstrative + definite noun ("det boka") is the demonstrative pattern. "Det" + indefinite noun ("det bok") is the article-usage pattern (nb-gender territory).
2. Demonstrative-mismatch should ONLY fire when followed by a definite noun form (ending in -en, -a, -et, -ene, etc. for NB; -en, -a, -et, -ane, -ene for NN).
3. Priority: 15 (after nb-gender at 10). On the rare overlap where both could fire, nb-gender wins, which is pedagogically correct -- article-gender is the higher-frequency student error.
4. Skip tokens in the en/ei/et/ein/eit article set -- let nb-gender handle those exclusively.

**Detection:** Fixture cases: (a) "Det boka" -> "Den boka" fires demonstrative-mismatch, (b) "Et bok" -> "En bok" fires nb-gender only, (c) "Det bok" -> nb-gender fires (article error), demonstrative-mismatch does NOT fire (indefinite noun = not demonstrative pattern).

### Pitfall 8: Triple-letter typo interacts badly with typo-fuzzy scoring

**What goes wrong:** The triple-letter feature ("tykkkjer" -> "tykkjer") is a d=1 deletion in edit-distance terms. But the existing typo-fuzzy scoring (line 50-56 in `nb-typo-fuzzy.js`) penalizes shorter candidates by 50 points: `if (cand.length < query.length) s -= 50`. The correct fix "tykkjer" (shorter by 1 char) gets penalized, potentially losing to a wrong same-length substitute.

Additionally, the first-character filter (`if (cand[0] !== first) continue` at line 103) means triple-letter at the start of a word (e.g., "ssskriv") would need the candidate "skriv" with a different first letter -- the filter blocks it.

**Why it happens:** Typo-fuzzy was designed for common typo patterns (transposition, substitution, adjacent-key). Triple-letter repetition is a specific dyslexia-related pattern that the general scoring was never tuned for.

**Prevention:**
1. Implement triple-letter as a SEPARATE rule file (`nb-typo-triple-letter.js`) with its own priority, not as a modification to typo-fuzzy. This keeps the 188+ existing typo fixture cases stable.
2. Priority: ~45 (before typo-fuzzy at 50, after curated typo at 40). If the word contains 3+ consecutive identical letters and removing one produces a word in `validWords`, emit a finding.
3. Simple pattern: `/(.)\1{2,}/` regex to detect triple-letter sequences. For each triple, try removing one instance and check `validWords.has()`. No edit-distance computation needed.
4. Frequency-weighted tiebreak: if multiple single-letter removals each produce a valid word, prefer the higher-frequency one (using `vocab.freq`).
5. The rule should fire on ALL languages (dyslexia-related key repetition isn't language-specific), not just NB/NN.

**Detection:** Fixture cases: "tykkkjer", "kommmmer", "skkole", "skkkole". Verify the triple-letter rule fires (not typo-fuzzy) and produces correct suggestions.

### Pitfall 9: Manual spell-check button re-running full check causes visual flash

**What goes wrong:** The auto-detect spell-check runs on a debounced keystroke timer and applies findings as DOM underlines. A manual "Run spell-check" button that calls the same `check()` pipeline clears and re-applies all underlines, causing a visible flash. If text hasn't changed since last auto-check, this is wasteful and visually jarring.

**Prevention:**
1. Track a `lastCheckedText` hash (or the text itself, for short documents). Manual button compares current text against hash. If identical, skip re-check and show toast with existing findings count.
2. The toast/acknowledgement is the primary UX value (per memory file: "so the button click feels acknowledged even when there's nothing to flag"). The re-check is secondary.
3. Toast format: "X feil funnet" (X errors found) or "Alt ser bra ut!" (everything looks good).
4. When text HAS changed: run full check, apply findings, then show toast. No different from auto-detect except user-initiated.

**Detection:** Manual browser test: type text, wait for auto-detect, click button. Verify no flash. Then type new text, click button before debounce. Verify check runs.

### Pitfall 10: Dictionary popup for decomposed compounds shows wrong declension

**What goes wrong:** Gender is correctly inferred from the last component ("Schulranzen" -> Ranzen = m -> der Schulranzen). But plural forms of compounds often differ from the last component's standalone plural. "Spielplatz" plural is "Spielplatze" (not "Platze" in isolation). NB "barnehage" plural is "barnehager" but compound-specific plural forms may have irregularities not captured by the last component's entry.

**Prevention:**
1. Show ONLY gender (inferred from last component) and the component breakdown in the decomposed popup. Do NOT show inferred plural or declension forms.
2. The memory file explicitly states: "Do NOT inherit examples from components -- 'brod' examples are misleading on 'skolebrod'."
3. Mark decomposed results clearly: "Samansett ord: hverdag + s + mas" with gender from "mas" (m -> en hverdagsmas).
4. If the compound IS in the nounbank (Tier 1: stored compound), the stored entry takes precedence -- decomposition popup never overrides a stored entry.

**Detection:** Verify: for every stored compound in nounbank, decomposition either returns null (word found directly) or matches the stored entry's gender. Any mismatch is a data quality issue.

---

## Minor Pitfalls

### Pitfall 11: NB/NN fuge rules differ but share the same nounbank

**What goes wrong:** NB and NN have slightly different fuge conventions. NB "gutteklasse" vs NN "guteklasse". The vocab seam builds one `nounGenus` from raw data for both NB and NN (via `buildLookupIndexes`). If decomposition uses language-specific fuge rules but language-neutral noun data, the NB decomposer might accept a split the NN decomposer should reject.

**Prevention:** Start with language-neutral fuge rules. The differences are minor -- a word that decomposes in NB almost always decomposes in NN too, with possibly a different linking element. The gender inference (from last component) is identical. If a specific NB/NN divergence causes a false positive in fixtures, add a per-language override at that point. Don't pre-engineer language splits.

### Pitfall 12: Bundle size growth from per-noun fuge data in papertek-vocabulary

**What goes wrong:** If fuge properties are added to every nounbank entry, JSON files grow. With 2,124 NB nouns + 1,641 DE nouns, adding `"fuge": "s"` is ~30KB total -- negligible against the current 12.47 MiB zip and 20 MiB cap (~38% headroom). Not a real risk for v2.1 but worth monitoring.

**Prevention:** Monitor via `check-bundle-size` (already enforced). No action needed unless nounbank grows dramatically.

### Pitfall 13: Browser visual verification backlog masks compound-rule rendering bugs

**What goes wrong:** Phases 6/7 deferred browser visual verification (P1/P2/P3 dot colours, quotation suppression, word-order dots). Adding compound decomposition findings without verifying the existing visual layer means compound findings might render with wrong dot colour, wrong popover layout, or broken explain text -- and the deferred verification gap means nobody catches it.

**Prevention:** Sequence the deferred browser verification BEFORE shipping compound decomposition to users. The v2.1 milestone already includes this as a carry-over item. Do it first.

### Pitfall 14: Recursive decomposition (3+ component compounds) without depth limit

**What goes wrong:** Norwegian and German allow chains: "bankregistreringsnummer" = bank + registrering + s + nummer. If decomposition is recursive (decompose prefix further if it's also unknown), without a depth limit you get: (a) performance regression on long words, (b) increasingly unlikely splits at depth 3+, (c) complex explain text in the popup.

**Prevention:** Limit decomposition to 2 components in v2.1. Two-component splits cover the vast majority of student-relevant compounds. Three-component splits can be added in a future phase if needed. The longest NB nouns in the nounbank ("bankregistreringsnummer" at 23 chars) are stored entries -- decomposition doesn't need to handle them.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Decomposition engine | #1 (phantom compounds), #2 (linking ambiguity), #14 (recursive depth) | Validate both sides; Spraakraadet suffix heuristics for NB fuge; limit to 2 components |
| Spell-check integration | #3 (silencing typo-fuzzy), #6 (compoundNouns semantics) | New `decomposeCompound()` function; don't add to validWords/compoundNouns; priority > 50; typo-fuzzy d=1 wins |
| Dictionary popup | #10 (wrong declension), stored-entry precedence | Show gender only, not declension; mark as "Samansett ord"; Tier 1 stored entries take precedence |
| Sarskriving expansion | #4 (false-positive storm) | Defer to separate step; require linking element for new flags; min combined length 8 |
| Gender inference (NB/NN) | #11 (NB/NN fuge divergence) | Start language-neutral; override only when evidence demands |
| Demonstrative-mismatch | #7 (collision with nb-gender) | Require definite noun; priority 15; skip article tokens |
| Triple-letter typo | #8 (fuzzy scoring interaction) | Separate rule file; priority 45; regex pattern match, no edit distance |
| Manual spell-check button | #9 (UI flash) | Hash-compare before re-check; toast is primary value |
| Performance | #5 (keystroke latency) | Min length 6; cache results; measure before optimizing |
| Browser verification | #13 (visual bugs masked) | Sequence before compound decomposition ships |

---

## "Looks Done But Isn't" Checklist (v2.1-specific)

- [ ] Decomposition engine: false-positive rate < 2% measured against existing nounbank?
- [ ] Decomposition engine: handles zero-fuge, fuge-s, fuge-e correctly for NB/NN?
- [ ] Decomposition engine: handles DE Fugenelemente (s, n, en, er, e, es)?
- [ ] Decomposition engine: limited to 2 components (no recursive chains)?
- [ ] Spell-check integration: typo-fuzzy d=1 correction STILL wins over decomposition acceptance?
- [ ] Sarskriving: NOT expanded to use decomposition (deferred)?
- [ ] Gender inference: fires only when article precedes AND gender mismatches?
- [ ] Dictionary popup: shows gender + breakdown only, no inherited declension/examples?
- [ ] Demonstrative-mismatch: only fires with definite noun following?
- [ ] Demonstrative-mismatch: does NOT overlap with nb-gender findings?
- [ ] Triple-letter: separate rule file, not a typo-fuzzy modification?
- [ ] Triple-letter: fixture cases green, no regression on existing typo fixtures?
- [ ] Manual button: no visual flash on unchanged text?
- [ ] Browser verification: deferred Phase 6/7 visual checks completed?
- [ ] Performance: decomposition adds < 50ms to spell-check pass on 500-word text?
- [ ] Bundle size: still under 20 MiB cap after any nounbank fuge-data additions?
- [ ] All 9 existing release gates still pass?

---

## Sources

- [Spraakraadet: Fugebokstav (binde-s og binde-e)](http://www.sprakradet.no/svardatabase/etiketter/fugebokstav-binde-s-og-binde-e/) -- official NB/NN fuge guidance. Suffix patterns requiring fuge-s: -dom, -else, -het, -skap, -sjon, -tet, -ling, -nad.
- [Fuge-s -- Wikipedia (Norwegian)](https://no.wikipedia.org/wiki/Fuge-s) -- NB fuge rules and suffix patterns with "naer alltid" documentation.
- [Spraakraadet: Binde-s med -fag- og -spraak-](https://sprakradet.no/spraksporsmal-og-svar/binde-s-i-sammensetninger-med-fag-og-sprak/) -- specific fuge-s cases.
- [Nuebling & Szczepaniak 2013: Linking elements in German](https://www.germanistik.uni-mainz.de/files/2015/03/Nuebling_Szczepaniak_2013_linking_elements_grammaticalization.pdf) -- DE Fugenelement linguistics; confirms "no fixed rules."
- [German compound formation](https://www.giuliostarace.com/posts/compound-words-german/) -- DE compound rules overview.
- Existing codebase: `de-compound-gender.js` lines 78-103 (`inferGenderFromSuffix`, `LINKERS`, `MIN_SUFFIX_LEN`). HIGH confidence.
- Existing codebase: `nb-sarskriving.js` lines 30-45 (`SARSKRIVING_BLOCKLIST`), line 80 (`compoundNouns.has()`). HIGH confidence.
- Existing codebase: `nb-typo-fuzzy.js` lines 59-83 (scoring formula, shorter-candidate penalty). HIGH confidence.
- Existing codebase: `nb-gender.js` lines 19-21 (`ARTICLE_GENUS`, priority 10). HIGH confidence.
- Existing codebase: `spell-check-core.js` lines 391-398 (`dedupeOverlapping`), lines 129-248 (rule runner, priority sorting). HIGH confidence.
- Existing codebase: `vocab-seam-core.js` lines 706-807 (`buildLookupIndexes`, `compoundNouns` Set, `validWords` Set). HIGH confidence.
- User memory: `project_compound_word_decomposition.md` (v2.1 scope, two-tier compound model, existing code to build on). HIGH confidence.
- User memory: `project_phase5_manual_spellcheck_button.md` (manual button UX requirements). HIGH confidence.

---
*Pitfalls research for: v2.1 Compound Decomposition & Polish*
*Researched: 2026-04-26*
