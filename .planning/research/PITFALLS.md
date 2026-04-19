# Pitfalls Research

**Domain:** Heuristic spell-check + word-prediction for Norwegian learners (NB/NN), with dyslexia-first UX
**Researched:** 2026-04-17
**Confidence:** MEDIUM–HIGH (domain pitfalls are well-documented; Norwegian-specific + dyslexia-specific findings triangulate from multiple independent sources; some prescriptions are opinionated calls rather than research consensus — flagged inline)

**Scope anchor.** This milestone ships spell-check + prediction quality work for an audience that explicitly includes dyslexic students. Pitfalls here are evaluated against three non-negotiables from `.planning/PROJECT.md`:

1. Heuristics only — no ML, no network calls for correction (keeps it free + offline).
2. Extension-side features stay free forever — no premium-gating spell-check.
3. NB first, NN second, then DE/ES/FR/EN; but students routinely mix languages inside one document.

Pitfalls are ordered by likelihood × damage in this specific product, not alphabetically.

---

## Critical Pitfalls

### Pitfall 1: Ranking bug that prefers a dialect-variant typo over the obvious correction (the `berde` case)

**What goes wrong:**
A user types a real typo (`berde`). The fuzzy matcher finds both `berre` (valid NN) and `bedre` (valid NB) within edit distance 1 and returns the wrong one because the tie is broken by token-bank order, alphabetical, first-match-wins, or some other artefact of insertion order rather than by "what is this user likely trying to write?". Student sees a suggestion that is technically a real word but isn't what they meant, loses trust, switches off the feature.

**Why it happens:**
Dictionaries for all six supported languages are flattened into one index (`validWords`, `typoFix`) with no per-entry frequency, no UI-language bias, no dialect weighting, and no tie-breaker other than iteration order. `findFuzzyNeighbor` in `spell-check.js` returns the first neighbor at minimum distance. This is the single most surface-visible failure mode of v1.

**Consequences:**
- Worst kind of failure: the product confidently suggests a wrong correction. "False positive" users can tolerate; "false *replacement*" they can't.
- Dyslexic users specifically cannot easily tell whether the suggestion is right — they rely on the tool to be trustworthy. Eroded trust = feature abandoned.
- Teachers see one bad suggestion and stop recommending the extension.

**How to avoid:**
- Add a frequency score per word (from corpus or a "commonness" tier) and use it as the primary tie-breaker among equal-distance candidates.
- Bias toward the user's active target language / UI language. If UI is NB, prefer NB candidates over NN at equal distance; only return NN if no NB candidate within tolerance.
- Penalize typo-bank entries as fuzzy suggestions for *other* words (a curated typo is the canonical form of its target, not a candidate replacement for something else).
- Penalize rare dialect forms unless the user has explicitly selected them.
- Multi-candidate popover: when distance is tied and frequencies are close, show 2–3 options ranked by score rather than a single "the" correction.

**Warning signs:**
- Regression fixture shows `berde → berre` (or analogous) as the top suggestion.
- User reports "it suggested a word I've never seen" or "it keeps giving me a Nynorsk word."
- High dismiss-rate in telemetry on a specific word class (if telemetry ever added — out of scope for now, but qualitative feedback stands in).
- Internal gut-check: can you explain, in one sentence, *why* this suggestion won? If not, ranking is underspecified.

**Phase to address:** Before first release of the milestone (data + ranking layer is the foundation — every later improvement compounds on this). Put frequency/ranking in the first phase of the milestone.

---

### Pitfall 2: Flagging correct words (false positives) erodes trust faster than missing real errors

**What goes wrong:**
Spell-check paints a dot under a correctly spelled word — a proper noun ("Oslo", "Kristiansund", a classmate's name), a well-known loan word ("smoothie", "deadline"), a technical term, or a legitimately hyphenated/compound word that happens to match a særskriving pattern. Student sees dots under words they *know* are correct and concludes the tool is broken.

**Why it happens:**
- Vocabulary is finite. Anything not in it is "unknown", and the fuzzy matcher will latch onto a close neighbor and claim it's a typo.
- Proper-noun heuristic (`isLikelyProperNoun`) is position + capitalization based. Fails on:
  - All-lowercase names in usernames, handles, URLs.
  - Capitalized words at sentence start (currently excluded — correct, but also misses proper nouns at sentence start which should not be flagged as typos of *other* words).
  - Brand names and titles in headings (where all tokens may be capitalized).
- Loan words and code-switched tokens hit the fuzzy matcher.
- Særskriving check fires on adjective + noun pairs that happen to also exist as a compound (already partially mitigated via `bank === 'nounbank'`, but still brittle as dictionary grows).

**Consequences:**
- Research on Grammarly and LanguageTool consistently identifies over-flagging as the #1 usability complaint.
- Dyslexic users are especially harmed: they're already uncertain about their writing; wrong flags tell them they're wrong when they're right, which is worse than staying silent.
- Teachers recommending the tool get pushback from students: "it keeps saying my name is spelled wrong."

**How to avoid:**
- **Proper-noun guard, layered:**
  1. Capitalized + not sentence-start (existing).
  2. Two or more consecutive capitalized tokens (e.g., "Anne Grethe") — treat the whole span as a name.
  3. Optional learned-per-user "ignore list" that persists in `chrome.storage.local` (one click adds a word to the user's personal whitelist).
- **Loan-word allowlist:** ship a curated English-loan list for NB/NN contexts; don't fuzzy-match English words that are commonly written as-is.
- **Confidence threshold for fuzzy:** require not just distance ≤ k but also a minimum frequency ratio (candidate must be "common enough to be what the user meant"). If no candidate clears the bar, *stay silent*.
- **Silence-over-noise defaults:** when uncertain, don't mark. Missing errors is less harmful than wrong accusations — especially for this audience.
- **Unknown-word sensitivity dial:** start conservative (distance 1 only, high frequency threshold) and only loosen based on regression-fixture results.

**Warning signs:**
- Fuzzy-neighbor suggestion rate > true-positive rate in fixture tests.
- User reports "it keeps flagging real words."
- Manual scan of live flagged findings on any Norwegian news article shows >1 false positive per 100 words.
- "Capitalized word that isn't sentence-start" still gets flagged (regression).

**Phase to address:** Before first release. Owns ~half of the user-trust budget; spending this later is too late — the users who churn on false positives don't come back to check if it got better.

---

### Pitfall 3: Curated typo list collides with valid words in *another* Norwegian dialect/form

**What goes wrong:**
A typo entry claims `berre → bedre` (or similar). But `berre` is a perfectly valid Nynorsk word meaning "only, just". An NN user sees `berre` flagged as a typo. Or: an NB user writing standard NB uses a word that collides with an NN variant registered as a typo of something else.

**Why it happens:**
- Typo banks are authored in `papertek-vocabulary` without systematic cross-validation against the NN vocabulary, and vice versa.
- Leksihjelp's `typoFix.set(w, entry.display)` blindly overwrites/inserts with no check against `validWords`.
- The existing code defensively checks `!validWords.has(t.word)` before firing curated-typo rule (line 281 of `spell-check.js`), which helps — but depends entirely on whether `validWords` is loaded with the *right* dialect's word list.
- User memory entry `project_nn_infinitive_fix.md` already hints at dialect-form drift as a known data-quality issue.

**Consequences:**
- High-confidence typo match produces the worst kind of false positive: the popover says "Skrivefeil: berre → bedre" with an accept button, making it look authoritative.
- NN students, a minority audience with more fragile brand loyalty, are disproportionately harmed.
- Root cause lives in shared `papertek-vocabulary` repo — fixing downstream in the extension masks the problem for `papertek-webapps` and `papertek-nativeapps`.

**How to avoid:**
- **Data-side validation (preferred, per CLAUDE.md policy):** in `papertek-vocabulary`, add a CI check that no typo entry's `word` field equals a valid `word` in any other language/dialect's core vocabulary. Fail the build on collision.
- **Client-side safety net:** before firing a curated-typo finding, cross-reference the user's *set* of active languages (target + UI language + auto-detected neighbors). If `t.word` is valid in any active language, suppress.
- **Dialect tagging:** every typo entry should declare which dialect(s) it applies to (`dialects: ["nb"]` vs `["nn"]` vs `["nb", "nn"]`). Only fire when user's active dialect matches.
- **Document the invariant:** "A curated typo's `word` must never be a valid word in the target dialect." Make this a pre-publish check.

**Warning signs:**
- Fixture includes a sentence in NN and NB-typo rules fire on it.
- User reports "flags my Nynorsk as wrong" or "flags standard word as typo."
- In the vocab data, a manual search for any NN dictionary word appearing as the `word` field of any NB typo entry (or vice versa).

**Phase to address:** Data-quality phase (fix at source in `papertek-vocabulary`) + regression-fixture phase (ensure collisions are caught by the fixture before release). Address before enabling fuzzy matching aggressively.

---

### Pitfall 4: Code-switched text (DE/EN inside NB) is treated as all-wrong

**What goes wrong:**
Student is writing a Norwegian book report and quotes a line from the German original, or writes a paragraph in English for their English class, or drops an English loan-phrase. Every token outside the active Norwegian vocabulary gets fuzzy-matched → a forest of dots, possibly "fixing" valid German words to nonsense Norwegian lookalikes. Screenshot evidence: "Ich will Deutsh scrheiben" — even in the *intended* language, the extension should catch the typos *in the intended language*, not try to Norwegian-ify everything.

**Why it happens:**
- Current v1 hard-gates at `lang !== 'nb' && lang !== 'nn'` (line 199), which is the right guard for activation, but once active it treats *every* token in the input as NB/NN.
- There's no per-sentence or per-word language detection. The extension assumes "active language = document language."
- Students learning German/Spanish/French are the product's core audience; they will write target-language content inside Norwegian-localized sites all the time.

**Consequences:**
- Worst on the population the product explicitly serves: language learners who mix languages by definition.
- Either floods the document with meaningless dots, or silently "corrects" German infinitives to Norwegian look-alikes — damaging the student's actual homework output.
- Teachers see this and assume the tool doesn't understand multilingual reality, a reasonable conclusion.

**How to avoid:**
- **Lightweight per-span language detection:** character-level heuristic (umlauts + non-Norwegian letter sequences + stopword probes). When a contiguous run of 3+ tokens looks non-Norwegian, skip the span.
- **Fence marks:** respect quotation marks, code blocks, and italic spans as "maybe a different language" — reduce confidence/threshold inside them.
- **Per-token allowlist for other supported languages:** if a token matches *any* of the bundled six-language vocabularies, don't flag it as a Norwegian typo even if it's not in the NB wordlist.
- **Fail-silent for high-density-unknown paragraphs:** if more than 40% of tokens in a paragraph are unknown, assume it's not Norwegian and disable flagging for that paragraph.
- **User escape hatch:** sentence-level "this is not Norwegian" dismiss that persists until the paragraph changes.

**Warning signs:**
- Fixture includes an English or German sentence inside an NB document and everything gets flagged.
- User reports: "Flagged every word when I pasted a quote" or "It thinks German is misspelled Norwegian."
- Flag density > N per paragraph (a density-based kill-switch doubles as detector).

**Phase to address:** Before first release — this is the dominant complaint class for a *language-learner* product. The audience literally code-switches as part of its daily use.

---

### Pitfall 5: Dyslexia-harmful UI — aggressive red, density, dismiss-loops, "you're wrong" framing

**What goes wrong:**
The spell-check UI uses browser-default red wavy underlines, dense in-line markers on every uncertain word, and popover copy that reads like accusations ("Skrivefeil", "Feil kjønn"). For dyslexic students — the named target audience of the landing page — this reproduces the classroom experience of a teacher marking their essay in red pen, triggers shame, and can cause feature abandonment even if the underlying detections are correct.

**Why it happens:**
- Red wavy underline is the industry default because it works for confident non-dyslexic writers. It is the wrong default for this audience.
- Error-class labels ("Kjønn", "Skrivefeil") are accurate but framed as failures rather than hints.
- Density matters: even one error per sentence is fine; five per sentence is an indictment.
- Academic research: dyslexic students report embarrassment and anxiety with assistive tech that marks them as different (see Sources — Taylor & Francis follow-up study, Springer stigma chapter, UX Collective review).

**Consequences:**
- Users stop typing, freeze on the word, or disable the feature entirely.
- Landing page explicitly says "Perfekt for elever med dysleksi" — shipping a dyslexia-hostile UI contradicts the brand promise.
- Unlike other false-positive pitfalls, this one damages even when the detections are right.

**How to avoid:**
- **Soft visual language:** replace red-wave with a small gray or soft-color dot (already the v1 approach — preserve this). Avoid underlines entirely; they're too close to "corrected in red" PTSD.
- **Copy framing:** rewrite messages as supportive hints, not verdicts. "Prøv: 'bedre'" instead of "Skrivefeil". Phase 4 of the milestone already plans a "Why was this flagged?" feature — use student-friendly rationale, not grammar-terminology labels.
- **Density cap:** show at most N dots per visible viewport (e.g., 5). Above that, show only the top-confidence ones and a summary pill "+3 more". Prevents "forest of red" anxiety.
- **Show suggestions, don't annotate failure:** popover default view should be "here's what I think you meant" not "you wrote this wrong."
- **Dismiss is cheap and permanent:** click-to-dismiss should persist for that session at minimum; ideally add "never flag this word for me" for proper-noun / personal-name cases.
- **Ability to turn off "show flags" while keeping suggestions on hover** — some dyslexic users prefer pull-mode (ask for help) over push-mode (see red all the time). Nice-to-have but strongly aligned with audience needs.

**Warning signs:**
- User says "it felt like being graded."
- User turns the feature off within the first 5 minutes.
- Screenshot shows >5 flags in a single viewport.
- Copy review: any message beginning with "Feil" or "Skrivefeil" as a standalone word.

**Phase to address:** The UX-polish phase tied to the "Why was this flagged?" explanation feature (already on the milestone). Before first release — first impressions determine retention for this audience specifically.

---

### Pitfall 6: Regression fixture locks in bugs ("no new failures" vs. "fewer total errors")

**What goes wrong:**
Team adds a regression fixture (explicitly planned in this milestone). Expected behavior for each sentence is baked in from current v1 output. Over time, "don't break the fixture" becomes the acceptance criterion — so improvements that would legitimately change the output for some sentences get rejected as regressions, while genuine false positives that were present from the start become permanent because they're in the baseline.

**Why it happens:**
- Regression fixtures default to snapshot-style: "current output is correct, future output must match."
- Real metric should be "fewer total errors across all fixture sentences compared to last release" — but that requires human-judged ground truth, not snapshot output.
- Reviewers approve PRs based on "no new failures" because it's a cheap binary, not "did the error rate go down" which takes thought.

**Consequences:**
- Product stops improving after the fixture stabilizes.
- Real user complaints about false positives can't be fixed without fixture breakage, creating a reviewer standoff.
- Team loses confidence in the fixture as a quality signal.

**How to avoid:**
- **Fixture structure: ground-truth, not snapshot.** Every fixture entry has three fields: `input`, `expected_errors` (what a human reviewer confirmed *should* be flagged), `expected_corrections` (what a human confirmed *should* be suggested). Never `actual_output`.
- **Scoring: precision and recall.** Metric per release = (true positives / (true positives + false positives)) × (true positives / (true positives + false negatives)). Accept diffs that improve the F1 score even if they change individual outputs.
- **Review convention:** PR description must include "error delta" vs. previous release, not "fixture passes/fails". Approve on trend.
- **Explicitly label known-wrong behavior:** sentences where v1 was wrong should have `expected_errors` that v1 fails — baked-in "we know this is broken" TODOs that future fixes will unlock.
- **Add sentences specifically from bug reports.** Each real user complaint becomes a fixture entry with the corrected-expected output, so the fix becomes unlockable progress.

**Warning signs:**
- PRs being rejected because "the fixture broke" without anyone checking whether the new output is actually better.
- Fixture hasn't grown in N months (it should grow with every user complaint).
- Team talks about "passing the fixture" not "improving the score."
- A known false positive survives 3+ releases because "fixture expects it."

**Phase to address:** Fixture-design phase (first milestone phase). Get the structure right before it calcifies. Revisit in every subsequent phase to make sure scoring is driving the right behavior.

---

### Pitfall 7: Performance jitter — dot positions drift while typing, input feels laggy

**What goes wrong:**
The overlay re-renders on every keystroke. Dots anchored under words jitter as text reflows, lag behind the caret, or flicker between visible/hidden as the debouncer fires. Feel: "the tool is fighting my typing." Fatal for dyslexic users who already process visual feedback more carefully.

**Why it happens:**
- Naive implementation: on every `input` event, re-tokenize entire field, re-run all rules, re-render all markers. At 100+ words, this becomes visible jank.
- Dot positioning relies on DOM measurements (`getBoundingClientRect` per word) which thrash layout if done synchronously in the input handler.
- Third-party editors (contentEditable quirks, Slate, ProseMirror) have their own re-layout patterns; overlay can de-sync.
- Debouncing too aggressively feels unresponsive; too little feels juddery.

**Consequences:**
- Users disable the feature.
- Screenshot/video evidence is embarrassing and shareable.
- Teachers testing on their own older hardware see worse behavior than devs on new machines.

**How to avoid:**
- **Incremental tokenization:** only re-check tokens that changed. Keep a token list and diff it on input.
- **Off-main-thread where possible:** tokenization and rule-evaluation are pure functions; consider `requestIdleCallback` for large inputs.
- **Single-frame marker updates:** batch all DOM writes into one `requestAnimationFrame` callback; read geometry first, write second, to avoid layout thrash.
- **Debounce window tuned for feel:** 150–250 ms is the sweet spot for most users. Expose as config for dyslexia-optimized preferences if testing shows benefit.
- **Skip marker work while user is actively typing in the current word** (already partially implemented — the cursor-position skip at line 214 of `spell-check.js`). Extend: don't re-layout existing markers until input pauses.
- **Hard budget:** any input handler that takes >16 ms on a 2000-character input is a regression; measure on real-user profile.
- **Contenteditable escape hatch:** in editors where position measurement is unreliable (Google Docs, Notion), degrade gracefully — hide dots, keep popover-on-hover, or disable entirely rather than show misaligned markers.

**Warning signs:**
- User reports "laggy typing" or "dots dancing around."
- Profile shows >16 ms in input event handler.
- Flicker visible in a screen recording.
- Complaints specific to one editor (Google Docs, Notion) → DOM-measurement mismatch.

**Phase to address:** Continuous, but with a dedicated performance-audit pass before release. Include fixture sentences at the 500/1000/2000-character marks to exercise scaling.

---

### Pitfall 8: Privacy regression — sending typed text off-device

**What goes wrong:**
In pursuit of better ranking or "smart" suggestions, someone adds a call to the Papertek backend or ElevenLabs with the raw input text. Suddenly the spell-check feature is a keystroke logger. User never opted in, network panel shows every keystroke leaving the device, and the Chrome Web Store listing becomes a lie.

**Why it happens:**
- Temptation to "just use a bigger dictionary / LLM / remote classifier" is constant.
- Even analytics can leak content (e.g., logging "user fixed word X → Y").
- Browser extensions have shipped spell-check features that leak passwords and form content — documented publicly (Chrome/Edge "spelljacking," 2022).
- Marketing copy on landing page explicitly promises "ingen tekst forlater enheten" or equivalent — a privacy leak here would be a regulatory (GDPR — Norwegian students are minors in many cases) and trust disaster.

**Consequences:**
- GDPR exposure: typed student content is personal data, often from minors. No lawful basis for remote processing under current design.
- Reputational death for the product.
- Loss of the free/offline positioning that differentiates Leksihjelp from Grammarly.

**How to avoid:**
- **Architectural invariant: spell-check + prediction must never make a network call.** Enforce in code review. Add a linter rule if possible (`fetch` / `XMLHttpRequest` / `chrome.runtime.sendMessage` from `spell-check.js` triggers review).
- **Telemetry, if any, must be opt-in and anonymized at source.** No raw text in events, ever — at most, error-class counts and positions.
- **Manifest permissions audit each release:** `host_permissions` should never include the Papertek backend for these scripts.
- **Explicit privacy statement in popover:** "Alt sjekkes på din egen maskin — ingen tekst forlater nettleseren." Reinforces the promise users can verify in Chrome DevTools.
- **Sanity-check in CI:** grep the content-script bundle for `fetch`, `https://`, `leksihjelp.no` etc., and fail the build if spell-check path has outbound references.

**Warning signs:**
- Anyone suggests "let's call the backend to rank suggestions."
- Anyone adds an analytics SDK to the content script.
- Network panel shows traffic during typing with spell-check on.
- PR diff includes network code in `spell-check.js` or `word-prediction.js`.

**Phase to address:** Continuous — every release. Add to release checklist: "spell-check + prediction are network-silent (verified via DevTools Network tab on a 30-second typing test)."

---

## Moderate Pitfalls

### Pitfall 9: Over-correction of style preferences

**What goes wrong:**
Spell-check creeps into "style" territory — flagging comma usage, passive voice, or word choice. These are not errors; they're preferences.

**How to avoid:** Hold the line that Leksihjelp is a **spell-check** and **grammar-structure check** (gender agreement, verb form, særskriving) only. No "this sentence is too long", no "consider a stronger verb", no Oxford-comma politics. Every new rule must answer: "is there a clearly right or wrong answer here, by a Norwegian teacher's standard?" If the answer is "it depends", don't build it.

**Phase:** Requirements / scope phase of the milestone; revisit any time someone proposes a new rule class.

---

### Pitfall 10: Treating NB rules as universal, applying them to NN text

**What goes wrong:**
A student with UI-language NB is writing NN homework. Spell-check applies NB article forms ("en/ei/et") and flags NN articles ("ein/ei/eit") as wrong. Or: NN infinitive rules (e-infinitiv, a-infinitiv — already a known issue per user memory) get resolved using NB templates.

**How to avoid:**
- Rule tables explicitly keyed by `lang` (`ARTICLE_GENUS[lang]`, `GENUS_ARTICLE[lang]`) — this is already done correctly in v1. Preserve and extend the pattern.
- Every new rule must declare its applicable dialects.
- `lang` state should reflect the *document* language when detectable, not just the UI language setting. If the user writes "eg" / "ikkje" / "me" multiple times, probably NN; offer a banner "Skrive du nynorsk? Bytt språk."
- Test fixture must include NB-only, NN-only, and mixed sentences.

**Phase:** Continuous, enforced by fixture coverage.

---

### Pitfall 11: å / og confusion is context-dependent — spell-check can't catch it alone

**What goes wrong:**
"Jeg liker og spise" vs "Jeg liker å spise" — one is wrong, one is right, and the deciding factor is the grammatical role of the following verb. Word-level spell-check cannot resolve this; it needs sentence-level parsing.

Per user memory entry `project_aa_og_grammar_check.md`: this was already identified as out-of-scope for word prediction and belongs in "grammar check" which is a larger future effort.

**How to avoid:**
- **Don't ship a bad å/og detector just because users ask for it.** A detector with 50% precision would be worse than nothing in this category — the confusion is emotionally loaded for many NB writers.
- Keep it out of this milestone explicitly. Document as "known gap — requires sentence parsing, not in v1."
- If/when tackled: require context analysis (bigram+ trigram patterns, verb infinitive detection following the word). Never flag å/og without sentence-level confidence.

**Phase:** Out of scope for this milestone; flag for a future "grammar check" milestone.

---

### Pitfall 12: Accessibility failures — keyboard, screen-reader, contrast

**What goes wrong:**
Inline dots are mouse-clickable only. Screen readers announce the error class at the wrong moment (or constantly, for every flagged word on a page). Dot contrast against dark-theme editors is invisible. Focus trapping in the popover breaks keyboard flow.

**How to avoid:**
- **Keyboard shortcut:** Tab navigates between flagged words; Enter opens popover; arrow keys pick suggestion; Escape dismisses. Test with mouse hidden.
- **ARIA:** popover has `role="dialog"` with proper labeling; markers have `aria-describedby` pointing to an offscreen description that screen readers can request on demand, not announce automatically.
- **Contrast:** dots render at 4.5:1 against both light and dark page backgrounds. Test on an actual dark editor (Notion dark mode, VSCode web).
- **Don't trap focus** — popover dismisses on any outside interaction.
- **Reduced-motion respected:** if the dot slides/fades in, honor `prefers-reduced-motion`.

**Phase:** UX-polish phase, before first release. Accessibility regressions have legal and reputational weight.

---

### Pitfall 13: Dismiss-loops — same flag reappears immediately

**What goes wrong:**
User clicks "ignore" on a flag. Two keystrokes later (or after input refocus), the same flag comes back. User keeps dismissing the same word. Rage-quits.

**How to avoid:**
- Dismissals are keyed by `(word, position-approximate, session)`. As long as the word stays there, don't re-flag it in this session.
- Even better: "ignore always" option for proper nouns, persists per-domain or per-user.
- After 3 dismissals of the same token-form in a session, auto-ignore it for the rest of the session.

**Phase:** UX-polish phase. Cheap to get right once, hard to retrofit if users have already rage-quit.

---

### Pitfall 14: Silent initialization failure leaves the feature "on" but inert

**What goes wrong:**
Vocabulary fails to load (network timeout on IDB sync, corrupt JSON, `__lexiPrediction` not ready). Spell-check sets `enabled = true` but `validWords.size === 0`, so every word is unknown, and the fuzzy matcher produces nonsense or nothing. User sees either a flood of flags or total silence, and can't distinguish "working correctly, no errors" from "broken."

**How to avoid:**
- Hard gate: if `validWords.size < N` (e.g., 500), refuse to run rules and log a structured warning.
- Expose state in the popup: a tiny "spell-check: aktiv" / "spell-check: laster…" / "spell-check: feil ved innlasting" status.
- Surface via `window.__lexiSpell.state()` (already partially present) and document it for support.
- Fail-closed: when uncertain, don't flag; preserve silence as a safe default.

**Phase:** Implementation phase of ranking work, observability pass before release.

---

## Minor Pitfalls

### Pitfall 15: Dot positioning in third-party editors (Google Docs, Notion, contentEditable)

**What goes wrong:** Overlay measures DOM coordinates; third-party editor does its own reflow; dots land in wrong place or outside visible area.

**How to avoid:** Maintain a known-good list (standard `<textarea>`, `<input>`). For contentEditable, test on top 5 target editors (Google Docs, Notion, Gmail compose, Chrome default, generic WYSIWYG). If an editor can't be measured reliably, disable overlay and keep popover-on-selection. Document the tradeoff in the settings panel so users aren't surprised.

**Phase:** Test-coverage phase before release.

---

### Pitfall 16: Feature toggle confusion — spell-check vs. prediction vs. "Lexi" master toggle

**What goes wrong:** Users don't understand why turning off prediction also turns off spell-check, or vice versa. Complaints like "I only wanted to disable autocomplete but the whole thing stopped working."

**How to avoid:** Clear settings UI with per-feature toggles, and copy that explains the dependency: "Stavekontroll bruker data fra ordforutsigelse; begge må være på." Or: decouple the data dependency so they're truly independent. Preferred: decouple where cheap, explain where not.

**Phase:** UX-polish phase + settings-panel pass.

---

### Pitfall 17: Bundle-size creep from frequency tables / bigrams

**What goes wrong:** Adding a frequency dictionary for ranking (see Pitfall 1) pushes bundle past the 20 MiB internal ceiling. PROJECT.md constraint explicitly caps bundle growth.

**How to avoid:**
- Encode frequency as a small integer (1 byte per word) appended to existing vocab entries, not a separate parallel file.
- Quantize — 16 frequency tiers is enough for ranking; doesn't need per-word precision.
- Ship frequency data only for NB + NN (not all six languages) in this milestone.
- Measure bundle delta before merging.

**Phase:** Data-design phase, before committing to a scoring approach.

---

### Pitfall 18: `papertek-vocabulary` schema drift breaks the extension silently

**What goes wrong:** Sibling repo evolves; extension's `sync-vocab.js` keeps running but silently loses fields (`linkedTo` reshape, new bank types, etc.). Extension ships with partial data.

**How to avoid:**
- Sync script has a schema assertion — fail loudly if expected fields are missing. Currently fails only per-word silently.
- Version the vocab schema explicitly; pin in extension's expected version.
- Cross-repo commit: any breaking schema change in `papertek-vocabulary` must be paired with a sync-script update PR in Leksihjelp. Document in `papertek-vocabulary`'s CONTRIBUTING.

**Phase:** Data-pipeline hardening; partially addressed in existing codebase but currently lacks hard gates.

---

### Pitfall 19: Over-aggressive "smart" corrections that damage student writing

**What goes wrong:** Suggestion auto-applies on quick Enter, replacing a word the student intended to keep. "Jeg liker berre" (NN, valid) gets auto-corrected to "Jeg liker bedre" while student is tabbing through.

**How to avoid:**
- Never auto-apply. Always require explicit click/confirm.
- Accept action is Enter; Escape always dismisses. Tab moves to next flag without applying.
- Show a 2-second undo on accept: "Angre (Esc)".

**Phase:** UX-polish phase.

---

### Pitfall 20: Testing on own prose / non-representative fixtures

**What goes wrong:** Devs test on their own well-formed Norwegian; regression fixture accumulates dev-written sentences. Real students write differently — more errors per sentence, more run-ons, more code-switching, mobile-typing artefacts, character-limited chat-style.

**How to avoid:**
- Fixture sentences sourced from actual student writing (anonymized), not authored.
- Include 5th-grade, 8th-grade, and upper-secondary register samples.
- Include mobile-keyboard artefacts (swapped characters, missing spaces, autocorrect-leftovers).
- Include chat-style short utterances and homework-style long paragraphs.

**Phase:** Fixture-design phase; continuous growth.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Flatten all six languages' vocab into one `validWords` set | Simple lookup, one data structure | Ranking bugs across dialects (Pitfall 1, 3); code-switching false positives (Pitfall 4) | Only for bootstrap; must add per-word language tags before fuzzy matching is enabled |
| First-match-wins tie-break in fuzzy neighbor search | Trivial to implement, fast | Wrong suggestions, trust erosion (Pitfall 1) | Never past v1 |
| Snapshot-based regression fixture | Easy to generate | Locks in bugs (Pitfall 6) | Never — build ground-truth from the start |
| Mark every unknown word via fuzzy matcher | High recall | Forest of dots, dyslexia-hostile UI (Pitfall 2, 5) | Never aggressively; require confidence threshold from day one |
| Share rule tables across NB and NN | Saves authoring effort | Wrong rules for wrong dialect (Pitfall 10) | Never — always key by `lang` |
| In-extension hotfix for a `papertek-vocabulary` data bug | Ship faster | Divergent data, eventual rewrite, consumers drift (CLAUDE.md policy) | Only as a temporary measure with a tracked TODO to fix upstream within one release |
| Debounce + full re-check of entire input on every keystroke | Simplest impl | Laggy typing (Pitfall 7) | Acceptable for textareas <500 chars; must be incremental above that |
| Global `window.__lexiSpell` debug state | Easy inspection | Fingerprintable API surface, conflict on weird hosts | Keep for dev builds; strip from prod or namespace uniquely |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `papertek-vocabulary` API | Assume schema is stable, fail silently on changed fields | Pin schema version, fail loudly on unexpected structure, coordinate cross-repo |
| Third-party editors (Google Docs, Notion) | Assume caret / word positions are stable via DOM APIs | Feature-detect; fall back to popover-on-selection or disable overlay gracefully |
| `chrome.storage.local` | Assume changes propagate instantly to content scripts | Subscribe to `chrome.storage.onChanged`; don't cache indefinitely; re-sync on focus |
| `chrome.runtime.onMessage` | Trust any sender | Validate `sender.id === chrome.runtime.id` (per CONCERNS.md existing audit) |
| ElevenLabs TTS language codes | Pass user-facing `nb` / `nn` directly | Map to `no` (frontend already has `VOICE_LANG_MAP`; ensure spell-check / prediction integrations don't recreate the bug on backend) |
| IDB `vocab-store` runtime downloads | Assume IDB is available and reliable | Fall back to bundled data; never block spell-check on IDB — fail-closed to "no flags" not "everything flagged" |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full re-tokenize + re-check on every keystroke | Dots jitter, typing feels sticky | Incremental diff; only re-check changed tokens | ~500 chars / large editors |
| Synchronous DOM measurement for every dot | Layout thrash, paint jank | Batch reads before writes inside `requestAnimationFrame` | 20+ flags on screen |
| Re-running fuzzy matcher against entire vocab on every unknown word | CPU spike at paragraph end | Pre-build prefix trie or n-gram index once, reuse | Dictionary > 50k entries (we're well past) |
| Global per-input listener re-attaching on every focus | Event handler leaks, eventual duplicate dots | Attach once per element, use `WeakSet` to track | Long sessions with many field changes |
| Storing full marker list in memory with no cap | Memory growth over session | Cap markers per document; virtualize off-screen | Very long documents (>5000 words) |
| Re-reading `chrome.storage.local` on every check | Adds ~1 ms per check × many checks | Cache + listen for `onChanged` | Any input longer than a tweet |

---

## Security / Privacy Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Adding a network call from spell-check code path | GDPR, trust loss, "spelljacking" headline (Pitfall 8) | Code review rule: no `fetch` in content scripts under spell-check/prediction; CI grep check |
| Logging typed content to analytics | Same as above, at smaller scale | Zero-content telemetry; only counts and classifications |
| Trusting `chrome.runtime.onMessage` sender | Malicious page could trigger actions (per CONCERNS.md item) | Validate `sender.id` before acting |
| Storing personal words (user's allowlist) without partitioning | One user's names leak to another if multi-profile shares storage | Keep in `chrome.storage.local` (per-profile by design); never sync to cloud without explicit opt-in |
| Popover reads DOM content of other page elements | XSS / data exfil surface | Popover reads only from its own shadow DOM / component state |
| Running on `chrome://` or sensitive origins | Extension may elevate privileges unexpectedly | Exclude sensitive hosts in manifest `exclude_matches` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Red wavy underlines everywhere | Shame trigger for dyslexic users | Soft-color dot, density cap (Pitfall 5) |
| Accusation copy ("Skrivefeil!") | Feels like being graded | Supportive framing ("Prøv: …"), "Why flagged?" explanation |
| Auto-apply suggestion on Enter | Damages student's original intent (Pitfall 19) | Always explicit confirm; Enter opens, Tab applies, Esc dismisses |
| Flooded flags on code-switched text | Tool looks broken on multilingual reality | Per-span language detection (Pitfall 4) |
| Dismiss without persistence | Rage-quit (Pitfall 13) | Session-level suppression; "never for this word" option |
| Proper-noun false positives on user's own name | Personal frustration — worst kind | Layered proper-noun guard + personal allowlist |
| Silent "feature not working" state (inited but no vocab) | User thinks their writing is perfect | Status indicator in popup (Pitfall 14) |
| Identical copy for all error classes | Student can't learn from the feedback | Class-specific, student-friendly explanations keyed to a kid-readable glossary |
| Popover blocks what they're reading | Can't compare original and suggestion | Offset popover; keep original visible |
| No keyboard access | Breaks for power users and screen-reader users | Tab / Enter / Esc navigation (Pitfall 12) |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but usually aren't on first pass. Run before each release.

- [ ] **Fuzzy matcher:** Does it have a frequency-based tiebreaker? Is `berde` → `bedre` before `berre` for NB users? Verify with a fixture case.
- [ ] **Proper-noun guard:** Does it handle "Anne Grethe" (two consecutive capitalized)? URLs? Names at sentence start? Test each.
- [ ] **NN vs NB rules:** Does NB article logic only fire for NB users? Fixture sentences in both dialects must pass.
- [ ] **Code-switching:** Does a paragraph of English or German inside an NB document *not* produce a flag-forest? Explicit fixture sentence required.
- [ ] **Proper-noun personal allowlist:** Can user add a word to "never flag this"? Does it persist across sessions?
- [ ] **"Why flagged?" explanation:** Every error class has a student-readable rationale — not just the class label.
- [ ] **Density cap:** Viewport never shows more than N dots at once, even when the text is full of errors.
- [ ] **Keyboard navigation:** Tab between flags, Enter to open, arrow to select, Escape to close. Test with mouse physically unplugged.
- [ ] **Screen-reader:** Test with VoiceOver or NVDA. Are flags announced once (not on every cursor move)? Is popover navigable?
- [ ] **Contrast:** Dots visible on dark-mode editors (Notion dark, Gmail dark)? Verify 4.5:1 ratio.
- [ ] **Performance:** Type 2000 characters in the fixture — no jank, dots don't jitter, input event <16 ms on a 3-year-old laptop.
- [ ] **Privacy check:** DevTools Network panel shows zero outbound traffic during a 30-second typing session with spell-check on.
- [ ] **Storage check:** `chrome.storage.local` does not accumulate typed content over time. Only preferences and allowlists.
- [ ] **Data collision:** For a random sample of 50 NN typo entries, confirm `word` is not a valid NB word, and vice versa.
- [ ] **Regression fixture metric:** Release-over-release, precision and recall both reported in the release notes. Not "fixture passes/fails."
- [ ] **Failure states:** Spell-check with empty vocab fails closed (no flags) and surfaces a status. Doesn't silently flag everything.
- [ ] **Dismiss persistence:** Dismiss a flag, type 3 more words, verify the flag does not reappear on the same word.
- [ ] **Auto-correct guard:** Suggestion never auto-applies. Enter/Tab never silently rewrites student input.
- [ ] **Cross-editor:** Test in `<textarea>`, Gmail compose, Google Docs, Notion, Slack compose. Document known-broken and degrade gracefully.

---

## Recovery Strategies

When pitfalls occur despite prevention.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong suggestion shipping (P1) | MEDIUM | Hotfix: disable fuzzy for affected word-class via a server-pushed blocklist (if available) or ship patch release; add to regression fixture |
| False-positive flood (P2) | MEDIUM | Raise fuzzy confidence threshold via a config knob in next release; push emergency disable flag for fuzzy while investigating |
| Dialect collision in typo data (P3) | LOW–MEDIUM | Fix at `papertek-vocabulary` source, resync; hotfix in extension to suppress the specific entry until vocab update propagates |
| Code-switching flag-forest (P4) | MEDIUM | Temporary: lower confidence for paragraphs with high unknown-word density; proper fix requires language-detection work |
| Dyslexia-harmful UX complaint (P5) | HIGH | Apologize publicly if it went wide; ship visual + copy overhaul; bring in dyslexic tester for review before next release |
| Regression fixture calcified (P6) | HIGH | Rebuild fixture with ground-truth structure; don't ship new features until metric-based scoring works |
| Performance regression (P7) | MEDIUM | Profile, identify hot path, ship targeted fix; add perf budget to CI if not already |
| Privacy leak (P8) | CRITICAL | Immediate kill-switch release; disclosure; CWS listing update; likely audit | 
| Misapplied dialect rules (P10) | LOW | Fix rule table, add fixture sentences for both dialects |
| Accessibility regression (P12) | MEDIUM | Audit with AT users; ship fix; commit to a11y in future releases |
| Silent init failure (P14) | LOW | Add status indicator; add loud console warning; investigate vocab-store freshness |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls. Phases are expressed in abstract terms (e.g., "ranking phase", "UX polish phase") — actual phase names are for the roadmap author.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| P1 Ranking / wrong suggestion (berde → berre) | Ranking + data-weighting phase (earliest) | Fixture case: `berde` → `bedre` as top candidate |
| P2 False positives erode trust | Ranking + proper-noun layering phase (early) | Fixture: real NB news article shows ≤ 1 FP per 100 words |
| P3 Dialect typo collisions | Data-quality phase at `papertek-vocabulary` source, plus client safety net | CI check in vocab repo; fixture sentences in NB and NN |
| P4 Code-switching | Language-scope + detection phase (early–mid) | Fixture sentences: DE, EN paragraphs inside NB documents produce ≤ 1 flag per paragraph |
| P5 Dyslexia-hostile UI | UX-polish phase with "Why flagged?" explanation (mid) | Dyslexic tester review; density cap verification; copy audit |
| P6 Regression fixture calcification | Fixture-design phase (very early) | Fixture structure includes ground-truth fields, not snapshot |
| P7 Performance jitter | Continuous; performance-audit pass before release | 2000-char typing test; 16 ms budget; screen recording shows no jitter |
| P8 Privacy leak | Continuous, release checklist | DevTools Network tab audit each release; CI grep |
| P9 Over-correction (style) | Requirements / scope phase; reviewed any time new rules proposed | Rule-addition template: "clearly right or wrong?" gate |
| P10 Wrong dialect rules | Continuous; fixture coverage | Both NB and NN fixture sentences; rule tables keyed by `lang` |
| P11 å / og context-dependent | Explicitly out of scope; documented | Not in this milestone |
| P12 Accessibility | UX-polish phase before release | Keyboard-only test; screen-reader test; contrast check |
| P13 Dismiss-loops | UX-polish phase | Session-suppression works; 3-dismiss auto-ignore present |
| P14 Silent init failure | Implementation of ranking work + observability pass | `window.__lexiSpell.state()` shows vocab size; popup status |
| P15 Third-party editor positioning | Test-coverage phase before release | Top 5 editors tested; fallback behavior verified |
| P16 Toggle confusion | Settings-panel pass | User testing with first-time users |
| P17 Bundle-size creep | Data-design phase | Bundle size diff reported in each release |
| P18 Vocab schema drift | Data-pipeline hardening phase | Sync script fails loud on schema mismatch |
| P19 Aggressive auto-correct | UX-polish phase | No auto-apply path exists in code; Enter behavior documented |
| P20 Non-representative fixtures | Fixture-design phase; continuous growth | Sample origin documented; student-sourced sentences included |

---

## Sources

**Dyslexia UX and stigma research (MEDIUM–HIGH confidence; multiple independent sources):**
- [Smart Interface Design Patterns — How To Design For Users With Dyslexia](https://smart-interface-design-patterns.com/articles/dyslexia-design/)
- [UX Movement — 6 Surprising Bad Practices That Hurt Dyslexic Users](https://uxmovement.com/content/6-surprising-bad-practices-that-hurt-dyslexic-users/)
- [UX Collective — Software accessibility for users with Dyslexia (Eva Katharina Wolf)](https://uxdesign.cc/software-accessibility-for-users-with-dyslexia-a506698af4d6)
- [Taylor & Francis — Dyslexic students' experiences in using assistive technology: a five-year follow-up (2022)](https://www.tandfonline.com/doi/full/10.1080/17483107.2022.2161647)
- [SpringerLink — Multidimensional Stigmatisation and Assistive Technology Inclusive Design](https://link.springer.com/chapter/10.1007/978-3-031-28528-8_14)
- [arXiv — Comprehensive review of assistive technologies for children with dyslexia (2024)](https://arxiv.org/html/2412.13241v1)
- [Usability in Civic Life — Dyslexia Style Guide](https://www.usabilityinciviclife.org/bibliography/dyslexia-style-guide/)

**Spell-check over-flagging and UX criticisms (HIGH confidence; consistent across sources):**
- [Pristine Editing — Grammarly Doesn't Always "Grammar" Right, Studies Show (2021 academic study showing ~66% accuracy, over-flagging)](https://pristineediting.medium.com/grammarly-doesnt-always-grammar-right-studies-show-1368162b0fba)
- [The Digital Reader — I'm Breaking Up With Grammarly (false positives, cursor-jumping, intrusive corrections)](https://the-digital-reader.com/im-breaking-grammarly/)
- [ScienceDirect — Exploring the use of grammarly in assessing English academic writing](https://www.sciencedirect.com/science/article/pii/S2405844024109243)
- [LanguageTool Forum — Handling proper nouns when spell checking](https://forum.languagetool.org/t/sv-handling-proper-nouns-when-spell-checking/1371)
- [Microsoft Support — Troubleshoot checking spelling and grammar in multiple languages](https://support.microsoft.com/en-us/office/troubleshoot-checking-spelling-and-grammar-in-multiple-languages-b887ad70-b15a-43f4-89bb-a41d18026e20)
- [Bugzilla@Mozilla — Spellchecker should respect @lang (bilingual text handling)](https://bugzilla.mozilla.org/show_bug.cgi?id=338427)
- [Silktide — Introducing AI-powered spell check (explicit callout of proper nouns + bilingual as problem classes)](https://silktide.com/blog/introducing-ai-powered-spell-check/)

**Browser extension privacy / spell-jacking (HIGH confidence; widely reported 2022 disclosure):**
- [Dark Reading — Spell-Checking in Google Chrome, Microsoft Edge Browsers Leaks Passwords](https://www.darkreading.com/application-security/spellchecking-google-chrome-microsoft-edge-browsers-leaks-passwords)
- [Bleeping Computer — Google, Microsoft can get your passwords via web browser's spellcheck](https://www.bleepingcomputer.com/news/security/google-microsoft-can-get-your-passwords-via-web-browsers-spellcheck/)
- [Invicti — Spelljacking: When your browser is too helpful](https://www.invicti.com/blog/web-security/spelljacking-when-your-browser-is-too-helpful)
- [Digital Trends — Your data may be in danger if you use a spellchecker](https://www.digitaltrends.com/computing/spellchecker-in-google-chrome-and-microsoft-edge-security-fault/)

**Word prediction / dyslexia assistive tech (MEDIUM confidence; product-level sources):**
- [PMC — Are Linguistic Prediction Deficits Characteristic of Adults with Dyslexia?](https://pmc.ncbi.nlm.nih.gov/articles/PMC7825117/)
- [Ghotit — Word-Prediction Technology for Dyslexia](https://www.ghotit.com/dyslexia-word-prediction)
- [ReadSpeaker — 5 Assistive Technology Tools for Students with Dyslexia](https://www.readspeaker.com/blog/assistive-technology-for-dyslexia/)

**Norwegian orthography and standards (MEDIUM confidence; general references, not learner-error research):**
- [Wikipedia — Norwegian orthography](https://en.wikipedia.org/wiki/Norwegian_orthography)
- [Skapago — Bokmål – Nynorsk: Differences](https://www.skapago.eu/en/bokmal-nynorsk/)
- [Norsk stavekontroll (bokmål og nynorsk) — LibreOffice extension](https://extensions.libreoffice.org/en/extensions/show/norsk-stavekontroll-bokmal-og-nynorsk)
- [Norwegian language tools on GitLab (spell-norwegian)](https://gitlab.com/norwegian-language-tools/spell-norwegian)

**Project-internal sources (HIGH confidence; authoritative for this project):**
- `.planning/PROJECT.md` — Core value, Out of Scope, Constraints
- `.planning/codebase/CONCERNS.md` — Existing concerns (NN infinitive drift, schema coupling, message-sender validation, vocab freshness)
- `extension/content/spell-check.js` — v1 implementation (fuzzy matcher, proper-noun guard, rule tables)
- User memory: `project_nn_infinitive_fix.md`, `project_aa_og_grammar_check.md`, `project_spelling_grammar_check.md`

---

## Notes on confidence and gaps

**HIGH-confidence pitfalls** (multiple independent sources, directly visible in current code, or grounded in documented incidents):
- P1 (ranking), P2 (false positives), P5 (dyslexia UX), P6 (fixture calcification), P7 (perf jitter), P8 (privacy / spell-jacking), P10 (dialect rule misapplication).

**MEDIUM-confidence pitfalls** (strong qualitative signal, some judgment calls):
- P3 (dialect typo collisions — inferred from user-memory entries and data flow, not publicly reported), P4 (code-switching — strong UX logic, less academic grounding), P9 (style-creep), P12 (accessibility — general principle, not Leksihjelp-specific audit yet).

**Gaps / open questions for later phases:**
- No published academic research on Norwegian-learner-specific spell-check error distributions; the fixture design needs empirical student-writing samples, which the team may need to gather.
- Dyslexia density thresholds (how many flags per viewport is "too many"?) — product-testing question, not answerable from literature.
- Per-span language detection: lightweight heuristic approaches are known, but the specific accuracy for Norwegian-vs-Germanic-neighbors (Swedish, Danish, German) needs testing before relying on it.
- Whether to build a user-facing "ignore this word" allowlist at all (adds state; storage-privacy review needed).

---

*Pitfalls research for: heuristic spell-check + word-prediction for Norwegian learners, dyslexia-friendly*
*Researched: 2026-04-17*
