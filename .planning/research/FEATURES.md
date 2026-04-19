# Feature Research

**Domain:** Heuristic Norwegian (NB/NN) spell-check + multilingual word-prediction for language learners and students with dyslexia (browser extension)
**Researched:** 2026-04-17
**Confidence:** MEDIUM-HIGH

## Scope & Framing

This research informs a **subsequent milestone** on an existing product. Validated capabilities in `.planning/PROJECT.md` (dictionary, TTS, word-prediction v1, spell-check v1 with 4 error classes + Damerau-Levenshtein fuzzy matching + proper-noun guard, Norwegian adjective agreement) are **not re-researched**. The question is: what's the ceiling for a heuristic, free, offline, Norwegian-first tool before ML becomes mandatory, and where does Leksihjelp compete against Lingdys/IntoWords (the de-facto Norwegian dyslexia tools) and LanguageTool (the heuristic open-source benchmark)?

Findings are categorized along two axes simultaneously because the product has two surfaces:
- **[SC]** = Norwegian spell-check (NB/NN)
- **[WP]** = Word-prediction (all 6 languages)
- **[UX]** = Cross-surface user experience / dyslexia support

## Feature Landscape

### Table Stakes (Users Expect These)

Norwegian students using Lingdys/IntoWords/LanguageTool assume these exist. Missing them = the product feels broken or they reach for a second tool.

| Feature | Surface | Why Expected | Complexity | Notes |
|---------|---------|--------------|------------|-------|
| **Misspelling detection with tolerant fuzzy matching** | SC | Core of any spell-checker; Lingdys markets "help even with wrong first letter or multiple errors per word" | — (shipped v1) | Already in Damerau-Levenshtein layer; quality tuning in milestone |
| **Contextual word-prediction (ordprediksjon)** | WP | Lingdys/IntoWords brand promise; "context-based suggestions while you type" | — (shipped v1) | Ranking/coverage push in milestone |
| **Compound-word error detection (særskriving)** | SC | Most-cited Norwegian learner/native error; Korrekturavdelingen.no lists it as the #1 recurring language-advice topic | — (shipped v1) | Production-quality detection is the milestone's hardest technical ask |
| **Homophone / confused-word detection (hjerne vs. gjerne, og vs. å)** | SC | Lingdys explicitly advertises "sentence-level checking for words used incorrectly in context (e.g. hjerne/gjerne, fot/fort)"; IntoWords ships an og/å toggle | HIGH | Requires sentence-context analysis; heuristic list + POS signal is achievable without ML |
| **Proper-noun / already-correct-word false-positive guard** | SC | Frustration multiplier for dyslexic users per research; Word 2003 missed 48% of learner errors partly because it over-flagged valid tokens | — (shipped v1, with guard) | Keep expanding the allowlist / capitalization heuristic |
| **Gender-article agreement (en/ei/et) and adjective agreement** | SC, WP | Norwegian grammar 101; LanguageTool COMPOUNDING/GRAMMAR rule categories cover this for many languages | — (shipped v1) | Extension for NN (kjønn, bestemt form) |
| **Verb form after modal / infinitive marker å** | SC | "å ikke" is a textbook learner mistake per Norwegian language pedagogy sources | — (shipped v1) | |
| **Click-to-accept suggestion (single-tap correction)** | UX | Every tool (Word, Grammarly, Lingdys, LanguageTool) works this way | — (shipped v1) | Keep; minimize clicks |
| **Ignore / "this is not an error" action** | UX | Expected; without it, users learn to distrust flags (retrains them to ignore) | LOW | Should be per-word scope, session-lived; avoid persisting globally (privacy + simpler) |
| **Works in any text input on any website** | UX | Differentiator of extensions over desktop tools — loss of ubiquity destroys value | — (shipped v1) | |
| **Works offline** | UX, SC, WP | Landing page commits; classrooms often have flaky WiFi; dyslexic students cited as benefiting from no-dependency tools | — (shipped) | Bundle-size constraint (~20 MiB internal ceiling) flows from this |
| **Support for NB and NN distinctly (not merged)** | SC | Students are explicitly tested on one or the other; mixing produces real-word errors (ikke/ikkje, jeg/eg) | MEDIUM | Detect target variant from page or setting; current v1 handles both |
| **Word-prediction learns from frequency** | WP | Every competitor uses frequency; expected baseline of "useful ranking" | — (shipped v1, via bigrams) | Frequency tables + bigrams already bundled |
| **Spell-check suggestions ranked by likelihood, not alphabet** | SC | Lingdys specifically brands "fewer, more precise suggestions" as a dyslexia adaptation — spraying 20 options at a dyslexic user is harmful | MEDIUM | Phonetic + edit-distance + frequency scoring; limit to top 3–5 |
| **Don't flag words the user is still typing (debounce at word boundary)** | SC, UX | Word, Grammarly, LanguageTool all wait for space/punctuation; flagging mid-word is rage-inducing | LOW | Debounce logic; likely shipped but verify in milestone |
| **Visual marking that's unambiguous but not alarming** | UX | Red squiggles = "mistake" per 30 years of OS convention; dyslexic UX research warns against aggressive visuals | LOW (shipped as dots) | Current dots are good; keep but verify contrast/position |

### Differentiators (Competitive Advantage)

Features that earn Leksihjelp a preferred-tool position for Norwegian language learners and dyslexic students, above the "yet another spell-checker" baseline.

| Feature | Surface | Value Proposition | Complexity | Notes |
|---------|---------|-------------------|------------|-------|
| **"Why was this flagged?" student-friendly explanation** | SC, UX | Supports Noticing Hypothesis (L2 acquisition research) — learners retain corrections better when they understand the rule, not just the fix. No mainstream Norwegian heuristic tool ships this in a learner-targeted voice (LanguageTool's explanations are terse and English-centric) | MEDIUM | Already in Active requirements; copy-writing is the bottleneck, not code. Tie to each of the 4 error classes |
| **Pronunciation-confirmation path from spell-check → TTS** | SC, UX | Uniquely achievable because Leksihjelp bundles TTS; a dyslexic student can hear candidate corrections before committing. Lingdys has this; Grammarly/LanguageTool don't (they're text-only) | LOW | Wire existing TTS widget into spell-check popover; free TTS fallback means no paywall |
| **Explicit dyslexia persona on landing page — brand positioning** | UX | Already shipped — named section "Perfekt for elever med dysleksi". Keep treating this as a first-class concern (not an afterthought) in feature decisions | — (shipped) | Drives prioritization: features that help dyslexics > features that add general polish |
| **Cross-language word-prediction in one tool (6 languages)** | WP | Lingdys/IntoWords cover NB/NN/EN/DE/ES/FR but as separate products or paid add-ons; Leksihjelp bundles all 6 free | — (shipped) | Quality gap across languages is the milestone work |
| **Regression test fixture for spell-check** | Infra | Internal differentiator: lets iteration stay tight without breaking existing catches. Most heuristic tools degrade on regressions silently | MEDIUM | Already in Active; growing text file with expected I/O, runnable as script |
| **Damerau-Levenshtein + phonetic scoring for severe misspellings** | SC | Research shows 39% of dyslexic errors differ by >1 letter; pure edit-distance misses these, phonetic pass catches "skole" → "skåle". Ghotit brands phonetic-plus-context as its core differentiator | MEDIUM | Edit-distance layer exists; adding a Norwegian-tuned phonetic hash (simple rules for ⟨kj/skj/sj⟩, double consonants, å/o confusion) is the differentiator lift |
| **Context-aware prediction that rides POS + gender + case + tense** | WP | Already shipped; Lingdys and IntoWords claim "context" but rarely expose grammatical dimensions this richly. Exploit: show users the grammatical reason a prediction was ranked first | — (shipped v1); explanation layer is new | |
| **Inline correction without leaving the page** | UX | Grammarly/Lingdys often require copying into their window; Leksihjelp works in the textarea the student is already writing in | — (shipped) | Core extension advantage; keep |
| **Typo bank / accepted-alternatives expansion from Papertek-vocabulary** | SC | Landing page publicly commits to this ("Veien videre" section); data-driven, avoids code changes, scales with corpus | HIGH (coordination) | Must land in papertek-vocabulary repo first, then sync; cross-app blast radius |
| **Configurable grammar-feature visibility per student** | SC, WP | Already shipped; rare outside assistive-tech tools; reduces cognitive load for dyslexic users ("don't show me passive voice, I don't know what that is yet") | — (shipped) | Extend pattern to spell-check: let student hide classes they don't want flagged |
| **"Slow reveal" / progressive suggestion disclosure for dyslexic readers** | UX | Dyslexia literature: a wall of 10 suggestions is worse than 3 good ones; reveal more on explicit request | LOW | UX-only; top-3 suggestions, "show more" link |
| **Optional OpenDyslexic / dyslexia-friendly font on popover** | UX | Common in dyslexia assistive tools; trivial CSS | LOW | Opt-in toggle in settings; font only needs to apply inside Leksihjelp popover (not the whole page) |
| **Accepts the free-forever covenant visibly inside the UI** | UX | Reinforces landing-page promise; builds trust with education-sector users who've been burned by freemium bait-and-switch | LOW | Micro-copy in popover footer: "Gratis. Åpen kildekode." |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but break the product's constraints (free/open/offline/heuristic/Norwegian-first/brand-promise).

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **ML-based grammar rewrites / full Grammarly parity** | Grammarly is the prestige brand; feels aspirational | Forces external API costs → contradicts free-forever promise; needs online connectivity → contradicts offline constraint; training data / liability issues. PROJECT.md explicitly excludes this | Keep heuristic; advertise the honest scope ("catches common Norwegian learner errors") |
| **Premium gating of spell-check** | Monetization hypothesis | Landing page publicly commits: "Alle funksjoner i selve utvidelsen er og forblir gratis." Breaking this destroys trust with existing Vipps subscribers and open-source community. Already excluded in PROJECT.md out-of-scope | External-API features (TTS) stay the paywall; extension-side features stay free |
| **Spell-check for DE/ES/FR/EN (non-Norwegian)** | Symmetry with prediction coverage | Different grammar, different error classes, different data needs; diverts engineering from Norwegian production-quality push. Excluded in PROJECT.md | Separate milestone; maintain clear "Norwegian spell-check" framing in UI |
| **Style suggestions (passive voice, wordiness, tone)** | Grammarly's "clarity score" is iconic | English-market feature; Norwegian learner texts are primarily judged on correctness, not style; style scoring is highly ML-dependent; risks flagging texts that are stylistically fine just different | Stick to grammar + spelling; if demand surfaces, consider teacher-facing only (not learner) |
| **Plagiarism detection** | Grammarly Premium feature | Requires server-side corpus, huge storage/bandwidth, external API costs. Also philosophically mismatched with assistive-tech/dyslexia positioning (punitive, not supportive) | Do not build |
| **Generative AI "rewrite this sentence"** | ChatGPT era expectation | External-API cost, contradicts heuristic-only rule, pedagogical downside: rewriting denies the learner the noticing-hypothesis benefit | Do not build; if requested, point to existing LLM tools |
| **Real-time server-side checking** | Potential quality boost | Offline constraint violated; latency for students on poor classroom WiFi; privacy concerns (student texts sent to server) | Extension-side only; accept heuristic ceiling |
| **Auto-correct (fix without confirmation)** | Mobile keyboard expectation | Research on dyslexic users: auto-correct without confirmation compounds errors silently because the "fix" is often wrong, and user can't learn from it. Also an accessibility anti-pattern | Always require explicit click-to-fix; never silent replacement |
| **Flagging native Norwegian dialect variants as errors** | Fits "standard language" intuition | NB + NN coexist officially; flagging NN-in-NB-context or vice versa trains a punitive tool that teachers don't want. Dialect words (ikkje, eg) are NOT errors | Detect target variant; only flag within-variant violations |
| **Cross-sentence / paragraph-level grammar analysis** | Grammarly's discourse checks | Heuristic feasibility ceiling; bundle-size impact; most learner errors are word- or clause-scoped anyway | Keep scope to word + immediate neighbors (bigram / short window) |
| **Expansive "style" library (formality, politeness, tone)** | LanguageTool markets a STYLE category | Language-specific subjectivity; risk of teaching register mismatches for learners; English-centric norms | Do not build for Norwegian until demand is validated by actual teachers |
| **Personal-dictionary sync across devices** | Grammarly/Word have this | Requires account + backend; data-retention complexity; contradicts offline | Per-device `chrome.storage.local` ignore list; no sync |
| **Telemetry on student writing content** | Could drive quality improvements | Student data = minors + sensitive writing; GDPR/Schrems-II complications; breaks trust the landing page is built on | The "Veien videre" anonymous data-contributions clause is explicitly *opt-in* and *anonymous*; treat as future feature with legal review, not a default |

## Feature Dependencies

```
[Regression fixture]
    └──enables──> [Safe iteration on spell-check rules]
                       └──enables──> [Production-quality særskriving detection]
                       └──enables──> [Homophone/confused-word pairs (og/å, hjerne/gjerne)]
                       └──enables──> [Phonetic-hash scoring layer]

[Typo bank expansion in papertek-vocabulary]
    └──requires──> [Schema review with papertek-webapps + papertek-nativeapps]
    └──enables──> [Higher recall on dyslexic-pattern errors]
    └──enables──> [Accepted-alternatives for near-correct answers]

[Frequency tables + bigrams (shipped)]
    └──enables──> [Word-prediction ranking quality improvements]
    └──enables──> [Homophone disambiguation in spell-check]
    └──shared data──> Both WP and SC benefit → data work pays twice

[4 error classes (shipped v1)]
    └──blocked by──> [Missing student-friendly labels / explanations]
                         └──requires──> [Per-class explanation copy]
                         └──enhances──> [Trust, noticing-hypothesis learning value]

[TTS infrastructure (shipped)]
    └──enables──> [Pronunciation-confirmation from spell-check popover]
                         └──requires──> [Free TTS fallback for non-subscribers (already shipped)]

[Module separability via __lexiPrediction interface]
    └──enables──> [Future extraction to skriv.papertek.app]
    └──constrains──> [No premium/policy coupling inside spell-check]

[Offline constraint]
    └──forbids──> [Any server-side correction, ML-API calls, cloud-sync]
    └──constrains──> [Bundle size budget → data growth must be justified]
```

### Dependency Notes

- **Data work pays twice**: Improvements in `papertek-vocabulary` (typo bank, frequency, bigrams, accepted alternatives) benefit both spell-check and word-prediction. This argues for prioritizing data milestones early in the roadmap.
- **Regression fixture is a prerequisite, not a nice-to-have**: Tuning heuristic rules without a fixture causes silent regressions (rule A fixes case X but re-breaks case Y). Ship the fixture before tuning rules, not after.
- **Explanation copy is the unlock for the "Why flagged?" differentiator**, not new code. It's bounded work (4 classes × NB/NN × learner-register copy), but requires editorial pass, not engineering.
- **Phonetic scoring depends on Norwegian-specific rules** (⟨kj/skj/sj⟩ collapse, å/o/aa variants, silent -t in neuter article, consonant doubling) — not a generic Soundex. Requires domain-knowledge review, not just code.
- **Cross-app schema coordination blocks typo-bank expansion**: If spell-check recall improvements require new fields in `papertek-vocabulary` (e.g., `typos: []`, `acceptedAs: []`), coordinate with papertek-webapps + papertek-nativeapps before landing the schema change.

## MVP Definition

Because this is a **subsequent milestone** (not v1), "MVP" here means the minimum the milestone must ship to count as a release, not the minimum product.

### Must Ship This Milestone (Release Bar)

Core quality bar that turns spell-check v1 into a tool students reach for *first*.

- [ ] **Regression test fixture** — blocks safe iteration; without it, rule tuning is Russian roulette. `PROJECT.md:Active` already lists this
- [ ] **"Why flagged?" explanations per error class** — the brand differentiator; currently blocks the popover from being more than a bare label
- [ ] **Reduced false-positive rate on NB + NN** — specific metric target from fixture; false positives are the primary reason students stop using a spell-checker
- [ ] **Word-prediction ranking improvement across all 6 languages** — measurable via top-k accuracy on a held-out set; current v1 is validated-but-rough
- [ ] **Expanded typo bank in papertek-vocabulary + sync** — data-driven recall lift; publicly committed on landing page
- [ ] **Preserve `__lexiPrediction` narrow interface** — guards future extraction option; explicit in PROJECT.md:Active

### Add After This Milestone Validates (v1.x range)

Features that earn their place once the production-quality bar is met.

- [ ] **Phonetic-hash scoring layer (Norwegian-tuned)** — catches dyslexic multi-letter errors that edit-distance misses; implement after the fixture can measure the lift
- [ ] **Pronunciation-confirmation path (popover → TTS)** — UX win; depends on verifying current TTS widget can be invoked from spell-check popover cleanly
- [ ] **Optional OpenDyslexic font inside Leksihjelp popover** — low-cost dyslexia-brand reinforcement
- [ ] **Session-scoped "ignore this word" with smarter scope** — expands current ignore beyond immediate flag
- [ ] **More confused-word pairs beyond og/å** — hjerne/gjerne, fot/fort, da/når, som/som-relativ — data-driven expansion via typo bank
- [ ] **Per-student spell-check class toggles** (parallel to grammar-feature toggles) — lets dyslexic users silence classes they're not ready to learn

### Future Consideration (defer to later milestones)

- [ ] **Spell-check for non-Norwegian languages** — explicit PROJECT.md out-of-scope; separate milestone per target language
- [ ] **Extraction of `spell-check.js` to skriv.papertek.app** — enabled by module separability but not triggered by this milestone
- [ ] **Anonymous opt-in data contribution for improving typo bank** — landing page mentions this; requires legal/privacy review first
- [ ] **Teacher-facing dashboard / reporting** — completely different surface, different user
- [ ] **Pilot / classroom trial** — PROJECT.md:Key Decisions mentions "pilot later"; out-of-scope for this milestone

## Feature Prioritization Matrix

Scoped to **within this milestone**. Items from v1 are excluded.

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Regression fixture (NB + NN sentences with expected I/O) | HIGH (quality gate) | MEDIUM | P1 |
| "Why flagged?" explanations for 4 error classes | HIGH (learner pedagogy, brand) | LOW-MEDIUM (copy-heavy) | P1 |
| False-positive reduction (proper-noun guard expansion, dialect-tolerance for NB↔NN) | HIGH (trust) | MEDIUM | P1 |
| Typo-bank expansion in papertek-vocabulary | HIGH (recall) | HIGH (cross-app) | P1 |
| Word-prediction ranking push (frequency × bigram × POS/case/tense tuning) | HIGH | MEDIUM | P1 |
| Phonetic-scoring layer (Norwegian-tuned hash) | MEDIUM-HIGH (dyslexia-specific lift) | MEDIUM | P2 |
| Pronunciation-confirmation from spell-check popover | MEDIUM (delightful, brand-fit) | LOW | P2 |
| More confused-word pairs beyond og/å | MEDIUM | LOW (data-driven) | P2 |
| Top-3 ranked suggestions with "show more" reveal | MEDIUM (dyslexia UX) | LOW | P2 |
| Per-class silence toggle (extend grammar-feature pattern) | MEDIUM | LOW | P3 |
| OpenDyslexic font toggle inside popover | LOW-MEDIUM | LOW | P3 |
| Debounce-at-word-boundary verification (likely already correct, confirm) | LOW (hygiene) | LOW | P3 |
| "Gratis. Åpen kildekode." micro-copy in popover footer | LOW (trust reinforcement) | LOW | P3 |

**Priority key:**
- P1: Must ship this milestone
- P2: Should ship if time/data allows; release without doesn't block
- P3: Nice-to-have; defer freely without narrative cost

## Competitor Feature Analysis

| Feature | LanguageTool (open-source, rule-based) | Lingdys / IntoWords (Norwegian dyslexia tools, paid) | Grammarly (commercial, ML) | Leksihjelp Approach |
|---------|----------------------------------------|-------------------------------------------------------|----------------------------|---------------------|
| Misspelling detection | Yes; Norwegian dictionary-based | Yes; dyslexia-tuned ("fewer, more precise") | Yes; ML-strong | Match quality via fuzzy + phonetic + typo-bank; stay heuristic |
| Compound-word (særskriving) detection | Yes; COMPOUNDING category | Yes | Partial (English-centric model) | **Shipped v1**; tune to production in this milestone |
| Homophone / real-word errors | Yes (CONFUSED_WORDS) | Yes (advertised for hjerne/gjerne, fot/fort) | Yes (very strong) | **Add og/å + hjerne/gjerne + data-driven expansion** |
| Explanation per error | Terse; English-centric | Minimal | Rich explanations, in English | **Differentiator: Norwegian learner-voice explanations** |
| NB + NN distinct support | Partial; limited NN rule coverage | Yes; separate dictionaries | Not supported for NN | **Keep; improve NN recall this milestone** |
| Offline operation | Self-hostable server (not truly offline) | Desktop app = yes; Cloud extension = no | No | **Yes, extension-side; landing page commits to this** |
| Works in any browser text input | LanguageTool browser extension = yes | IntoWords Cloud browser extension = yes; Lingdys app = limited to specific keyboards | Yes, via browser extension | **Yes — core advantage** |
| Dyslexia-specific features (phonetic, tolerant matching, pronunciation) | No (general-purpose) | Yes, flagship selling point | Partial; not their primary audience | **Match Lingdys feature-for-feature on the free tier** |
| Pronunciation (TTS) integration with spell-check | No | Yes (Lingdys ships TTS in same product) | No | **Unique opportunity: bundle existing TTS into spell-check popover** |
| Word-prediction in text inputs | No | Yes (core feature) | No (uses autocomplete only in its own editor) | **Shipped v1; quality push this milestone** |
| Grammar style / tone analysis | Yes (STYLE, REDUNDANCY) | Limited | Yes, strong | **Do not build (anti-feature)** — wrong audience, English-centric |
| Pricing for students | Free; Premium tier for more rules | Paid (subscription), typically school/district licensed | Paid for Premium | **Free forever for extension-side features; paid TTS only** |
| Heuristic-only (no ML / no API) | Yes (mostly) | Mixed; some cloud features | No (strong ML core) | **Yes, explicit in PROJECT.md constraints** |

**Where we can credibly beat Lingdys/IntoWords on the free tier:**
- Ubiquity (any browser, any input) vs. their custom keyboard or dedicated editor.
- Open source / MIT license — teachers can verify, schools can deploy without procurement.
- No login required for spell-check or prediction.
- Integrated TTS pronunciation path that's free-tier usable (browser speechSynthesis).

**Where we cannot credibly beat Lingdys/IntoWords:**
- They have decades of Norwegian dyslexia-specific corpus and error patterns; our typo bank is early.
- They are officially approved as exam aids in Norway; we are not.
- They have dedicated support + training + school contracts; we do not.

**Strategy implication:** Don't position against Lingdys. Position as complementary — the free everyday tool students keep on while doing homework; Lingdys for formal exams/IEP needs.

## Norwegian-Specific Feature Call-Outs

| Norwegian Concept | Status | Notes |
|-------------------|--------|-------|
| **Særskriving** (compound word wrongly split) | Shipped v1 | #1 Norwegian native + learner error per language-advice sources; the flagship Norwegian heuristic to nail |
| **NB vs NN distinction** | Shipped v1 | Non-negotiable; see homophone table |
| **Og vs å** | Active milestone | IntoWords ships an explicit toggle for this; Lingdys handles it via sentence-level check; heuristic possible with POS + bigram |
| **Hjerne vs gjerne, fot vs fort** | Active milestone | Lingdys advertises these specifically; learnable via confused-word pair list |
| **En / ei / et gender agreement** | Shipped v1 | Bokmål has optional feminine article (ei/en for feminine nouns); don't flag either as wrong; avoid over-correcting |
| **Adjective agreement (gender + number + definiteness)** | Shipped v1 | Core grammar; verify NN-specific rules (partially shared, partially diverged) |
| **Modal verb + infinitive (å + verb form)** | Shipped v1 | "wrong-form-after-modal" class |
| **Double consonants (kk/ll/nn) for short vowel** | Not flagged explicitly | Candidate for phonetic-hash scoring layer; high frequency dyslexic error |
| **Silent H in hva, hvor, hvorfor** | Not flagged | Phonetic hash candidate; common dyslexic pattern |
| **Å / aa / Å-circle digraph confusion** | Partial via fuzzy | Keyboard-layout-switch artifact; phonetic equivalence is trivial |
| **NN-specific infinitive -a vs -e** | Relevant but non-milestone | Per user MEMORY.md (`project_nn_infinitive_fix.md`): NN dictionary data mixes -a/-e infinitives — must fix at papertek-vocabulary source. **Directly impacts NN spell-check recall if unfixed.** |
| **Dialect words (ikkje, eg) inside NB context** | Must tolerate | Flagging would be pedagogically wrong and teacher-rejecting |

## Dyslexia-Specific Feature Call-Outs

Features that earn the "Perfekt for elever med dysleksi" landing-page claim. Research-backed (International Dyslexia Association 2025 definition, Ghotit / Lingdys / Spell Better patterns).

| Feature | Status | Research Source |
|---------|--------|-----------------|
| **Tolerant fuzzy matching (handles wrong first letter)** | Shipped v1 | Lingdys markets this; dyslexia research shows 39% of errors differ by >1 letter |
| **Short suggestion lists (3–5, not 20)** | Partial — verify | Dyslexia UX research: cognitive load of large option lists = abandonment |
| **Phonetic-first scoring** | To build (P2) | Ghotit's flagship; dyslexic users spell phonetically more than visually |
| **Pronunciation path (hear the candidate)** | Available via TTS widget, not wired to popover | Lingdys' combination of spell-check + TTS is a documented dyslexia-UX win |
| **Context-aware disambiguation** | Shipped v1 (prediction); partial (spell-check) | Real-word errors are 20–30% of dyslexic errors and invisible to non-contextual checkers |
| **No silent auto-correct** | Shipped (click-to-fix only) | Research: auto-correct trains the user wrong when it guesses wrong |
| **Optional dyslexia-friendly font** | Not shipped (P3) | OpenDyslexic, Lexia Readable; low cost, high symbolic value |
| **High contrast / unambiguous visual marking (not alarming)** | Shipped as dots | Dyslexia UX: avoid red squiggles for entire words; subtle markers reduce anxiety |
| **Works without login (no barrier for children)** | Shipped | Not directly dyslexia-specific but parents of dyslexic children cite account friction as adoption barrier |
| **Explanation in simple Norwegian (not jargon)** | In this milestone | Dyslexia doesn't imply low intelligence, but tool copy is often overly technical |

## Sources

### High confidence (authoritative / multi-source verified)
- [LanguageTool rule categories (GitHub)](https://github.com/languagetool-org/languagetool/blob/master/languagetool-core/src/main/java/org/languagetool/rules/Categories.java) — full categorization: STYLE, COMPOUNDING, CONFUSED_WORDS, FALSE_FRIENDS, GRAMMAR, TYPOS, PUNCTUATION etc.
- [LanguageTool Norwegian Wiki](http://wiki.languagetool.org/norwegian) — NB + NN supported; spelling support first, then grammar
- [Lingit / Lingdys Pluss product page](https://lingit.no/produkter/lingdys-pluss/) — dyslexia-tuned spell-check, word prediction, TTS, keyboard
- [IntoWords Cloud / Chrome Web Store](https://chromewebstore.google.com/detail/intowords-cloud/nopjifljihndhkfeogabcclpgpceapln) — Norwegian NB/NN + EN/DE/ES/FR context-based word suggestions, og/å grammar toggle
- [Korrekturavdelingen: Særskriving og sammenskriving](https://www.korrekturavdelingen.no/sammenskriving.htm) — særskriving as #1 Norwegian writing-advice topic
- [Ghotit Dyslexia](https://www.ghotit.com/) — phonetic + contextual spell-check for dyslexia; reference for the heuristic ceiling
- [Dysleksi Norge: Skrivehjelpemidler](https://dysleksinorge.no/skrivehjelpemidler/) — canonical Norwegian dyslexia-tool inventory
- [International Dyslexia Association 2025 Definition](https://dyslexiaida.org/2025-dyslexia-definition-project/) — authoritative current definition shaping accessibility UX

### Medium confidence (research / academic)
- [Frontiers: Analysis of spelling errors from dyslexic sight words list (2024)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1160247/full)
- [Springer: An Adaptive Spellchecker and Predictor for People with Dyslexia (PoliSpell)](https://link.springer.com/chapter/10.1007/978-3-642-38844-6_51)
- [Springer: Spelling errors made by people with dyslexia](https://link.springer.com/article/10.1007/s10579-022-09603-6) — 39% of errors differ in >1 letter
- [HowStuffWorks: Why spellcheck is good and grammar check is bad](https://people.howstuffworks.com/why-spellcheck-is-so-good-and-grammar-check-is-so-bad.htm) — Word 2003 missed 48% of learner errors
- [Noticing Hypothesis (Schmidt) in L2 writing feedback research](https://link.springer.com/article/10.1007/s44217-025-00919-3) — pedagogical basis for "Why flagged?" explanations
- [Norwegian homophones & homonyms (NLS)](https://nlsnorwegian.no/norwegian-homonyms-and-homophones-20-examples-explained/)

### Lower confidence (single source / community)
- [Sapling: Norwegian spell checker](https://sapling.ai/lang/norwegian) — commercial comparison
- [GiellaLT Norwegian Bokmål grammar checker](https://giellalt.github.io/lang-nob/tools-grammarcheckers-grammarchecker.cg3.html) — research/FST-based, not directly comparable
- [OpenDyslexic](https://opendyslexic.org/) — font project

---
*Feature research for: Heuristic Norwegian spell-check + multilingual word-prediction, dyslexia-first positioning*
*Researched: 2026-04-17*
