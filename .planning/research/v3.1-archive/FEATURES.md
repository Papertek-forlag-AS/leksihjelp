# Feature Landscape

**Domain:** Compound word decomposition + polish for Norwegian/German language-learning spell-checker
**Researched:** 2026-04-26
**Milestone:** v2.1 Compound Decomposition & Polish

> **Scope note:** This file covers ONLY the v2.1 milestone features. v1.0 (dictionary, TTS, word-prediction, per-token spell-check) and v2.0 (structural grammar governance, 57 plugin rules) are shipped. The question here is: *what features does compound decomposition need, what carry-over polish items complete the surface, and what are the edge cases?*

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dictionary lookup for unknown compounds | Students write thousands of productive compounds (hverdagsmas, fotballsko, skolebrødoppskrift) not in the 2,124-entry NB nounbank (2,123 NN, 1,641 DE). Returning "no results" for valid words breaks trust. | Med | Decomposition engine + popup rendering. Existing `inferGenderFromSuffix` in de-compound-gender.js covers DE gender; extend to full decomposition for NB/NN/DE. |
| Gender inference from last component | "Last component determines gender" is THE fundamental compound rule in Norwegian and German. Without it, gender coverage has a massive hole on productive nouns. Currently only DE has this (de-compound-gender.js). | Low | Greedy longest-suffix algorithm already proven in DE. NB/NN reuse is the same algorithm with different linking elements. |
| Accept decomposable compounds in spell-check | Flagging valid compounds like "fotballsko" as unknown (because they're not in the flat nounbank) is a false positive that teaches students to distrust the checker. | Med | Add decomposition check to validWords path in vocab-seam-core.js. Must run AFTER nounbank lookup (stored Tier 1 entries take precedence over decomposed Tier 2). |
| Linking element awareness (fuge-s, fuge-e, zero) | NB compounds use linking elements: -s- (hverdagsmas, tenåringsbok), -e- (barnehage, juletre), zero (skoledag, brødskive). Without linker awareness, decomposition misses a large fraction of productive compounds. DE already has -s-, -n-, -en-, -er-, -e-, -es- in the existing code. | Med | NB/NN linkers: s, e (common), er (less common). Pattern-based: -s- after suffixes -tion/-sjon/-het/-else/-tet/-skap/-dom; -e- often for animal/person first components; zero otherwise. Some lexical exceptions exist but pattern coverage is sufficient for v2.1. |
| Manual "Run spell-check" button | Dyslexic users (core persona per PROJECT.md "Perfekt for elever med dysleksi") may not register subtle underlines. An explicit "check my text" affordance makes the checked-state legible. | Low | UI trigger + toast result ("3 feil funnet" / "Ser bra ut!"). Internally calls same rule-runner pipeline as auto-detect. No new rule code needed. |
| Demonstrative-mismatch rule (det boka / den huset) | nb-gender currently only checks indefinite articles (en/ei/et for NB, ein/ei/eit for NN). Demonstratives (den/det/denne/dette) follow the SAME gender agreement rules and students mix these constantly. "Det boka" is as wrong as "et bok". | Low | Same pattern as existing nb-gender.js. Add DEMONSTRATIVE_GENUS map. Key difference: the noun following a demonstrative is in definite form (boka, huset), so the rule needs to look up the definite form's gender in nounGenus. |

## Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual compound breakdown in popup | Show "Samansett ord: hverdag + s + mas" with gender badge from last component. Students learn WHY the word has that gender. Pedagogical, not just functional. No competitor does this offline for Norwegian. | Low | Pure rendering. The decomposition engine produces the parts; this is presentation with a "samansett ord" label. |
| Recursive compound decomposition | Handle 3+ component compounds (skolebrødoppskrift = skole + brød + oppskrift). Norwegian allows arbitrary depth. Students at B1+ regularly form 3-component compounds. | Med | Greedy longest-suffix naturally handles this: after finding "oppskrift" as last component, remainder "skolebrød" is recursively decomposed. Cap depth at 4 to prevent pathological input. |
| Expanded sarskriving via decomposition | Current nb-sarskriving only flags "skole sekk" if "skolesekk" is in compoundNouns (2,124 entries). With decomposition, flag "skole dag" even though "skoledag" isn't stored -- because both are nouns and their concatenation decomposes validly. | High | High false-positive risk. Two adjacent nouns are not always sarskriving ("Per dag" = proper name + noun). Needs existing SARSKRIVING_BLOCKLIST AND decomposition-validity check. Ship after basic decomposition proves stable. |
| Triple-letter typo budget | Flag "tykkkjer" (three k's) as likely typo with frequency-weighted fuzzy-distance tiebreak. Also covers the Norwegian compound triple-consonant elision rule: natt+tog = nattog (two t's), natt+time = nattime (not natttime -- one t is dropped). | Med | Two sub-features: (1) generic triple-identical-letter detection, (2) compound-boundary consonant elision awareness. The elision rule: when component boundary produces 3 identical consonants, one is dropped. Decomposition engine must try elision-restored form when decomposing. |
| Compound-aware gender mismatch for NB/NN | Flag "et fotballsko" (sko = m, should be "en fotballsko") via decomposition. Currently only DE has compound-gender checking (de-compound-gender.js). Extending to NB/NN closes the gender-coverage gap on productive compounds. | Med | Combine decomposition engine with nb-gender rule pattern. New rule or extension of nb-gender to handle nouns not in nounGenus but decomposable. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Inherited examples from components | Memory file is explicit: "brød examples are misleading on skolebrød." Examples should only exist when authored for that specific compound. Inheriting creates false pedagogical confidence. | Show compound breakdown + gender badge only. No examples on decomposed compounds. |
| ML-based decompounding | Forces online dependency (violates SC-06 network silence gate) and external API costs. Dictionary-based greedy match achieves >95% accuracy per academic benchmarks (Korfhage & Muller 2017, Algolia). | Greedy longest-suffix with dictionary lookup. The existing DE algorithm proves this works in production. |
| Auto-correct compound splits | Silently joining "skole dag" into "skoledagen" violates the "no auto-correct" principle. PROJECT.md Out-of-Scope: "Auto-correct without user confirmation -- dyslexia research: silent fixes compound errors." | Show suggestion in popover; user clicks to accept. Same pattern as all other spell-check rules. |
| Exhaustive fuge-rule database | Norwegian fuge rules are partially lexical (per-word exceptions) and partially pattern-based. Trying to enumerate all exceptions is unbounded and brittle. | Support the common patterns algorithmically: -s- after -tion/-sjon/-het/-else/-tet/-skap/-dom; -e- for short first components referring to animals/people; zero otherwise. Accept false negatives on rare patterns rather than over-generating false positives. |
| Decomposing non-nouns | Verb compounds (overtale), adjective compounds (langvarig) follow different patterns with different semantics. Adding verb/adjective decomposition is scope creep for v2.1. | v2.1 decomposes noun+noun compounds only. Both components must be in the nounbank. Verb and adjective compounds are future work. |
| Whole-page manual check | A "check entire page" button that scans all text on the page (not just the focused textarea). Would require content-script permissions expansion and performance work. | Manual button checks the focused textarea only -- same scope as auto-detect. |

## Feature Dependencies

```
Decomposition engine (new, core module)
  +---> Dictionary popup for decomposed compounds (needs engine output)
  +---> Spell-check: accept decomposable compounds as valid (needs engine)
  +---> Gender inference from last component for NB/NN (needs engine + nounGenus)
  +---> Expanded sarskriving detection (needs engine + existing nb-sarskriving rule)
  +---> Compound-aware NB/NN gender mismatch (needs engine + nb-gender pattern)
  +---> Triple-consonant elision in decomposition (needs engine internals)

nb-gender rule (existing, shipped v1.0)
  +---> Demonstrative-mismatch rule (extends existing ARTICLE_GENUS pattern)

spell-check.js DOM adapter (existing, shipped v1.0)
  +---> Manual "Run spell-check" button (new UI trigger for existing pipeline)

nb-typo-fuzzy (existing, shipped v1.0)
  +---> Triple-letter typo budget (extends fuzzy distance calculation)

de-compound-gender.js (existing, shipped v2.0)
  +---> Refactor: extract inferGenderFromSuffix into shared engine
  +---> DE rule becomes thin wrapper over shared decomposition engine
```

## Edge Cases Requiring Design Decisions

### Ambiguous Splits

Some words have multiple valid decompositions:
- "blåbærgraut" = blåbær + graut (correct semantic parse) OR blå + bær + graut (valid but wrong)
- "strandstol" = strand + stol (only valid split)

**Recommendation:** Greedy longest-suffix (right-to-left) naturally produces the correct semantic parse in most cases because it finds the longest meaningful tail component first. This matches the existing de-compound-gender.js approach (lines 82-85). For dictionary display, show only the first (longest-suffix) parse. Do not show alternatives -- students need one clear answer, not ambiguity.

### Recursive Depth

Norwegian allows theoretically infinite compound depth:
- Depth 2: "skolesekk" = skole + sekk
- Depth 3: "skolebrødoppskrift" = skole + brød + oppskrift
- Depth 4: "sykehusavdelingssjef" = syke + hus + avdeling + s + sjef
- Depth 5+: rare in student writing, often humorous

**Recommendation:** Cap recursion at 4 components. Beyond that, the word is either a joke compound or better handled as a stored entry. The cap also prevents pathological performance on adversarial input (worst case: O(n^2) per depth level where n = word length).

### Triple-Consonant Elision at Component Boundaries

When compound components meet at the same consonant producing three identical letters, one is dropped:
- natt + time = nattime (not natttime)
- toll + lov = tollov (not tolllov)
- stoff + fabrikk = stoffabrikk (not stofffabrikk)
- But: natt + tog = nattog (correct, only two consonants meet -- no elision)

**Recommendation for decomposition engine:** When decomposing a word, try BOTH the raw split AND the elision-restored form. Example: decomposing "nattime" -- direct suffix lookup fails on "nattime", but try inserting the elided consonant: test "natttime" = "natt" + "time" -- both in nounbank, valid decomposition.

**Recommendation for triple-letter typo rule:** Flag any word containing three consecutive identical letters ("tykkkjer", "natttog") as a likely typo, UNLESS the word is in validWords (some words legitimately have unusual letter patterns). Severity: error (P1). Separate from the compound-elision handling.

### Linking Element Ambiguity

Some positions could be either a linking element or part of the next component:
- "barneskole" = barn + e + skole (linking -e-) -- correct
- "fiskesaus" = fisk + e + saus (linking -e-) -- correct
- But the -e- could theoretically be the start of a component

**Recommendation:** Try without linker first (direct split into two nounbank entries), then with each linker stripped. This is the exact strategy already used in de-compound-gender.js lines 88-100. The nounbank lookup disambiguates: only accept splits where both halves resolve to known nouns.

### Definite-Form Input

Students might search for definite forms in the dictionary: "skolesekken" (the school bag). The decomposition engine should handle definite suffixes.

**Recommendation:** Strip common definite endings (-en, -et, -a, -ene, -ane, -ar, -ane) before attempting decomposition. Attempt decomposition on the stem. Low priority for v2.1 -- the popup already handles definite-form lookup for known words; extend to decomposed compounds if time permits.

### Compound vs Stored Entry Precedence

"Hverdag" is both a stored nounbank entry AND decomposable (hver + dag). Stored entries must always win.

**Recommendation:** The decomposition engine ONLY activates for words NOT found in nounbank. This is the Tier 1 (stored) vs Tier 2 (decomposed) distinction from the memory file. Implementation: check nounbank first; on miss, try decomposition. Never show decomposition UI for a stored entry.

## Interaction with Existing Features

### Existing sarskriving rule (nb-sarskriving.js)
Currently checks `compoundNouns.has(prev.word + t.word)` -- flat lookup against 2,124 NB nounbank entries. The decomposition engine provides a fallback: when the flat lookup misses, call `isDecomposableCompound(concatenation)`. This expands sarskriving coverage from stored compounds to the full productive space.

**Risk:** False positives on adjective+noun pairs. The existing SARSKRIVING_BLOCKLIST (44 entries including "stor", "god", "lang", etc.) must also apply to the decomposition path. Additionally, decomposition should require the LEFT half to also be a known noun (not just any word) to avoid flagging "god dag" where "goddag" happens to decompose.

### Existing de-compound-gender.js
Already implements greedy longest-suffix with LINKERS for DE (lines 78-103). The v2.1 decomposition engine should generalize this into a shared module. Refactor: extract `inferGenderFromSuffix` + LINKERS into a new shared file (e.g., `compound-decompose.js`), parameterize by language-specific linker set. The DE rule becomes a thin wrapper that calls the shared engine.

### Word prediction
Decomposed compounds should NOT appear in word-prediction suggestions. Word prediction works from the stored wordList. Decomposition is for validation (spell-check) and lookup (dictionary popup), not generation. This maintains the current architecture where word-prediction suggests only authored entries.

### Popup dictionary
The popup's `renderResults` function (popup.js:1195) needs a new rendering path for decomposed results. Show: (1) gender badge from last component, (2) compound breakdown visualization ("hverdag + s + mas"), (3) definite/indefinite forms derived from last component, (4) "Samansett ord" label. Do NOT show: conjugation tables (nouns don't conjugate), examples (explicitly excluded per memory), senses (no authored sense data for decomposed compounds).

### Manual spell-check button placement
The existing spell-check.js DOM adapter attaches to focused textareas. The manual button should be a persistent element in the floating widget area (near the TTS button in floating-widget.js). Clicking it: (1) triggers a full re-check of the focused textarea, (2) shows a transient toast with result count, (3) dismisses after 3 seconds or on click. If no textarea is focused, the button should be grayed out or hidden.

## MVP Recommendation

Prioritize (in dependency order):
1. **Decomposition engine** -- core dependency for 5 downstream features. Place in a shared module consumed by spell-check, dictionary, and gender rules.
2. **Dictionary popup for decomposed compounds** -- highest user-visible impact. Stops "no results" for valid compounds.
3. **Spell-check: accept decomposable compounds** -- stops false positives on valid compounds.
4. **Gender inference for NB/NN** -- extends proven DE pattern. Refactor de-compound-gender.js to use shared engine.
5. **Manual spell-check button** -- independent of decomposition, low complexity, high dyslexia-persona value.
6. **Demonstrative-mismatch rule** -- independent, low complexity, proven nb-gender pattern.
7. **Triple-letter typo budget** -- independent, moderate complexity.

Defer within v2.1 (ship in a later phase if time permits):
- **Expanded sarskriving via decomposition**: Ship after basic decomposition proves stable with fixtures. High false-positive risk needs careful fixture authoring (30+ positive, 15+ acceptance cases per the release workflow).
- **Compound-aware NB/NN gender mismatch**: Depends on decomposition engine being stable. Ship after dictionary/spell-check integration proves the engine's accuracy.

## Sources

- [Algolia: Multilingual search decompounding](https://www.algolia.com/blog/engineering/increase-decompounding-accuracy-by-generating-a-language-specific-lexicon) -- decompounding accuracy with language-specific lexicons
- [Bitext: Decompounding German, Korean and More](https://www.bitext.com/blog/decompounding-german-korean-and-more/) -- cross-language decompounding patterns
- [Life in Norway: Compound Words Explained](https://www.lifeinnorway.net/compound-words-in-norwegian/) -- Norwegian linking elements (-s-, -e-, zero)
- [Nuenki: Cracking Norwegian Compound Words](https://nuenki.app/info/norwegian_compound_words) -- compound formation rules
- [Korfhage & Muller: Simple Compound Splitting for German (ACL 2017)](https://aclanthology.org/W17-1722.pdf) -- greedy longest match beats complex implementations
- [Microsoft Patent: Compound word breaker and spell checker](https://patents.google.com/patent/US20050091030A1/en) -- compound analysis + spell-checking integration
- [NLS Norwegian: Importance of Compound Words in Norskproven](https://nlsnorwegian.no/the-importance-of-compound-words-in-norskproven/) -- pedagogical importance
- [Mastering Demonstratives in Norwegian](https://nlsnorwegian.no/mastering-the-use-of-demonstratives-in-norwegian/) -- den/det/denne/dette agreement rules
- [Helperbird: Accessibility & Dyslexia Support Extension](https://www.helperbird.com/) -- competitor UX patterns for dyslexia tools
- Existing codebase: `de-compound-gender.js` (lines 78-103), `nb-sarskriving.js`, `nb-gender.js`, `vocab-seam-core.js` (lines 700-807)
- Memory files: `project_compound_word_decomposition.md`, `project_phase5_manual_spellcheck_button.md`
