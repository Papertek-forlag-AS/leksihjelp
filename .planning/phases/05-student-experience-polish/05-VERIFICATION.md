---
phase: 05-student-experience-polish
verified: 2026-04-20T20:44:12Z
revised: 2026-04-21T00:00:00Z
status: resolved
resolved_by: Phase 05.1 (2026-04-21)
score: 4/4 code-side must-haves verified; human Chrome smoke test PASS for UX-02 + XSS + NN; UX-01 surfaced 4 gaps (A/B/C/D) all closed by Phase 05.1 and re-verified by 11-scenario Chrome smoke test
human_verification:
  - test: "Trigger spell-check on all four NB error classes (kjønn / modalverb / særskriving / vanlig skrivefeil). For each: type a known-bad word in a textarea, wait for the red underline, click it, read the popover explanation."
    expected: "Popover shows a one-sentence student-friendly NB explanation — not the bare class label 'Skrivefeil' or 'Kjønn'. For gender: 'kan være feil kjønn'; for modal-verb: 'Etter modalverb skal hovedverbet stå i infinitiv'; for særskriving: 'kan være to ord som hører sammen'; for curated typo: 'er en vanlig skrivefeil'. Each wraps the student's typed word in <em>-highlighted text."
    why_human: "renderExplain produces HTML injected into a live DOM; fixture harness tests the rule-level explain callable, not the rendered popover. Popover CSS + insertion path cannot be exercised without a real Chrome content-script context."
  - test: "Repeat the popover test with Norwegian Nynorsk (NN) register active. Type NN-flaggable words (e.g., incorrect gender in NN, a NN modal-verb form) and read the explanation."
    expected: "Popover shows NN copy: 'kan vere feil kjønn', 'hovudverbet stå i infinitiv', 'høyrer saman', 'ein vanleg skrivefeil'. NN morphology correct throughout — 'vere', 'ikkje', 'ordboka', 'meinte', 'hovudverbet', 'byt'."
    why_human: "NN locale routing in renderExplain depends on the active-language detection path in spell-check.js, which requires the full content-script + storage init flow in a real browser tab."
  - test: "Word-prediction top-3 cap: open a supported input field, type a word prefix that produces more than 3 predictions, observe the dropdown."
    expected: "Exactly 3 suggestions visible by default. 'Vis flere' link (with downward chevron) appears at the bottom. Click 'Vis flere' — up to 8 rows expand; link flips to 'Vis færre'. Click again — collapses to 3 rows."
    why_human: "renderDropdownBody assembles live DOM on each keystroke; the Vis-flere click handler uses mousedown + stopPropagation; the ArrowDown auto-reveal path advances selectedIndex — all require a real browser event loop."
  - test: "Multi-suggest popover (UX-02 spell-check surface): In popup Settings tab, enable 'Vis alternative skriveforslag'. Then trigger a typo error. Observe the popover."
    expected: "Popover shows top-3 suggestion rows as clickable buttons (not the single-suggestion fix-arrow layout). 'Vis flere' link appears if more than 3 suggestions available. Clicking a row applies that suggestion. Toggle the setting back OFF — popover reverts to single-suggestion layout live without re-opening."
    why_human: "Two-branch showPopover + chrome.storage.onChanged live re-render require a real Chrome extension context; the multi-suggest branch (alternatesVisible=true) is never exercised by the fixture harness (which is toggle-off by default)."
  - test: "XSS smoke test: in a textarea, paste a string containing HTML angle brackets in a likely-to-be-flagged word (e.g., '<scrip' or a word like 'hagde<script>'). Observe that (a) the extension does not crash, (b) no popup appears with raw HTML in the popover, (c) DevTools Network tab shows zero outbound requests."
    expected: "No crash. Popover (if triggered) shows only escaped text — no script tags rendered. Network tab silent."
    why_human: "The nb-typo-xss-001 fixture verifies the rule surface does not crash on angle-bracket input; the rendering layer's escapeHtml + escapeAttr defence requires visual confirmation in a real browser popover."
---

# Phase 5: Student Experience Polish — Verification Report

**Phase Goal:** The spell-check popover explains errors in student-friendly Norwegian instead of bare class labels, and both spell-check popovers and word-prediction dropdowns cap visible suggestions at top-3 with a "vis flere" reveal — reducing cognitive load for dyslexic learners.
**Verified:** 2026-04-20T20:44:12Z
**Status:** human_needed — all automated checks pass; live Chrome smoke test deferred per project convention (same pattern as Phase 4 UAT deferral)
**Re-verification:** No — initial verification


## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking any of the four NB/NN spell-check error classes (gender, modal-verb, sarskriving, typo) shows student-friendly explanation in popover — not bare class label | ? HUMAN NEEDED | `renderExplain()` callable verified at code level; popover HTML branches confirmed; requires live Chrome UAT for visual confirmation |
| 2 | When >3 spell-check suggestions or word-prediction candidates, UI shows top-3 with "vis flere" reveal; clicking reveals the rest | ✓ VERIFIED | `VISIBLE_DEFAULT=3`, `VISIBLE_EXPANDED=8` in word-prediction.js; spell-check.js multi-suggest branch shows 3 rows + Vis-flere button; both CSS classes wired |
| 3 | Dyslexia-persona proxy reviewer confirms copy avoids jargon, explains rule in one short sentence, does not read as accusatory | ✓ VERIFIED (proxy only) | COPY-REVIEW.md populated with all 5 rules NB + NN; tone-check checklist fully actioned; review-log row shows PASS from Plan 05-05 executor acting as proxy; live Chrome visual confirmation is deferred human item |
| 4 | Explanation copy present for both NB and NN for each of the four error classes — verified by one-screen copy review document | ✓ VERIFIED | COPY-REVIEW.md contains all 5 rows (4 error classes + fuzzy-typo variant) with NB + NN copy; NN morphology verified per tone-check checklist |

**Score:** 3/4 truths verified (automated + proxy); truth 1 requires human Chrome confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/nb-gender.js` | `explain: (finding) => ({nb, nn})` callable | ✓ VERIFIED | Line 32 — hedged callable with `escapeHtml`; `priority: rule.priority` on emit |
| `extension/content/spell-rules/nb-modal-verb.js` | `explain: (finding) => ({nb, nn})` callable | ✓ VERIFIED | Line 28 — assertive callable; `escapeHtml` destructured; `priority: rule.priority` on emit |
| `extension/content/spell-rules/nb-typo-curated.js` | `explain: (finding) => ({nb, nn})` callable | ✓ VERIFIED | Line 25 — assertive callable; `escapeHtml` on every interpolation; `priority: rule.priority` on emit |
| `extension/content/spell-rules/nb-typo-fuzzy.js` | `explain: (finding) => ({nb, nn})` callable + `suggestions: string[]` top-K | ✓ VERIFIED | Line 106 — hedged callable; `findFuzzyNeighbors` returns sorted top-8; `fix === suggestions[0]` back-compat invariant; `priority: rule.priority` on emit |
| `extension/content/spell-rules/nb-sarskriving.js` | `explain: (finding) => ({nb, nn})` callable with defensive fallback | ✓ VERIFIED | Line 46 — callable with missing-fields fallback path; `escapeHtml` on interpolations; `priority: rule.priority` on emit |
| `extension/content/spell-check.js` | `renderExplain(finding, lang)` — not bare `typeLabel` string | ✓ VERIFIED | Lines 397, 438 (two call sites in both branches); function at line 473 with (rule_id, priority, lang) lookup + graceful fallback chain |
| `extension/content/spell-check.js` | `alternatesVisible` state + `chrome.storage.onChanged` subscriber | ✓ VERIFIED | Lines 80–86: hydration on init + onChanged listener; line 382: `useMulti` branch gated on `alternatesVisible && suggestions.length > 1` |
| `extension/content/word-prediction.js` | `VISIBLE_DEFAULT=3`, `VISIBLE_EXPANDED=8`, `renderDropdownBody`, `.lh-pred-vis-flere` | ✓ VERIFIED | Lines 44–45 constants; renderDropdownBody declared line 1200, called at 9+ sites; Vis-flere element at line 1224; expanded state reset at line 1189 |
| `extension/popup/popup.html` | `#setting-spellcheck-alternates` checkbox in Settings tab | ✓ VERIFIED | Line 230 — checkbox with correct `id`; 3 `data-i18n` keys present (title/toggle/note) |
| `extension/popup/popup.js` | `alternatesToggle` wired to `spellCheckAlternatesVisible` in storage | ✓ VERIFIED | Lines 1732–1845: declaration, hydration with `=== true` default-false guard, change-handler writing to `chrome.storage.local` — NO `sendMessage` (storage-subscribe pattern) |
| `extension/styles/content.css` | 5 spell-check popover CSS classes (light + dark mode) | ✓ VERIFIED | `.lh-spell-explain`, `.lh-spell-emph`, `.lh-spell-suggestions`, `.lh-spell-sugg-row`, `.lh-spell-vis-flere` all present with dark-mode variants |
| `extension/styles/content.css` | `.lh-pred-vis-flere` CSS rule (word-prediction reveal link) | ✓ VERIFIED | Lines 474, 485, 712, 717 — light + dark mode, 4 selectors |
| `scripts/check-explain-contract.js` | Release gate asserting callable `{nb, nn}` shape on 5 rules | ✓ VERIFIED | Exists; exits 0 (5/5 PASS); self-test exits 0 |
| `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` | Populated NB + NN copy for all 4 error classes (5 rows); dyslexia-persona proxy sign-off | ✓ VERIFIED | All 5 rows populated with NB + NN templates; tone-check checklist 8 items actioned (1 relaxation documented); review-log row with PASS outcome dated 2026-04-20 |
| `extension/i18n/strings.js` | `pred_vis_flere`/`pred_vis_faerre` + `settings_spellcheck_alternates_*` keys (NB + NN) | ✓ VERIFIED | Lines 143–145, 220–221 (NB); Lines 351–353, 423–424 (NN) — all 10 keys present in both locales |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nb-*.js` (5 rules) | `escapeHtml` helper | destructured from `host.__lexiSpellCore` | ✓ WIRED | All 5 rule files import escapeHtml in IIFE preamble and call it on every `{original}`/`{fix}` interpolation |
| `rule.explain(finding)` callable | `renderExplain` in spell-check.js | `(rule_id, priority, lang)` three-way lookup | ✓ WIRED | `renderExplain` at lines 397 + 438 in both popover branches; lookup logic verified at lines 473–504 |
| `chrome.storage.local.spellCheckAlternatesVisible` | `alternatesVisible` in spell-check.js | `chrome.storage.onChanged.addListener` | ✓ WIRED | Listener at lines 82–87 in spell-check.js; popup.js writes key at line 1845 via `chromeStorageSet` — no sendMessage in the alternates handler |
| `VISIBLE_DEFAULT=3` | dropdown render | `visibleCap = expanded ? VISIBLE_EXPANDED : VISIBLE_DEFAULT` in `renderDropdownBody` | ✓ WIRED | Line 1201; expanded reset at line 1189; Vis-flere click handler re-calls `renderDropdownBody` (NOT `showDropdown`) — state-leak Pitfall 5 guarded |
| `suggestions: string[]` (fuzzy rule) | multi-suggest popover branch | `useMulti = alternatesVisible && suggestions.length > 1` | ✓ WIRED | Line 382; `suggestions` array sliced to top-3 at render, Vis-flere reveals to cap 8; each row click clones finding with new `fix` and calls `applyFix` |
| `.lh-pred-vis-flere` CSS class | word-prediction dropdown DOM | `renderDropdownBody` inserts `<div class="lh-pred-vis-flere">` | ✓ WIRED | Line 1224; CSS present at lines 474 + 712 in content.css |
| `.lh-spell-explain` class | popover explain row | `<div class="lh-spell-explain">${renderExplain(...)}</div>` | ✓ WIRED | Lines 397 + 438 in spell-check.js; CSS at lines 786, 947 in content.css |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| UX-01 | Spell-check popover shows student-friendly "why it's flagged" copy per error class (≥4 classes × NB + NN), reviewed for learner voice | ? HUMAN NEEDED | Code fully wired: `renderExplain` callable on 5 rules, COPY-REVIEW.md proxy-reviewed PASS. REQUIREMENTS.md status correctly shows "Pending" — the live Chrome smoke test is the final gate before marking complete. Matches Phase 4 deferral pattern. |
| UX-02 | Suggestions capped at top-3 with "vis flere" reveal on both word-prediction and spell-check surfaces | ✓ SATISFIED | REQUIREMENTS.md already marked `[x] Complete`. word-prediction: `VISIBLE_DEFAULT=3`, `VISIBLE_EXPANDED=8`, Vis-flere DOM + click handler all verified. spell-check: multi-suggest branch shows top-3 + Vis-flere reveal; toggle wired via settings. |

**Orphaned requirements:** None. Both UX-01 and UX-02 are claimed by phase 5 plans and verified above.

**UX-01 deferral note:** Per STATE.md pattern established in Phase 4 ("Phase 4 plan execution closed end-to-end; `/gsd:verify-work` owns requirement marking at phase close"), the live Chrome smoke test is the final validation gate for UX-01 before the requirement can be marked complete in REQUIREMENTS.md. All code-side evidence is present and verified. Marking is a human action post smoke test.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No stubs, no TODO/FIXME/placeholder, no empty handlers found in Phase 5 files |

Suppression rules (`nb-codeswitch.js`, `nb-propernoun-guard.js`) intentionally retain legacy `string` explain — they never surface to the popover. This is by design, documented in `spell-rules/README.md`.

### Human Verification Required

#### 1. NB popover explain copy in Chrome

**Test:** Load the extension in Chrome (Developer mode, unpacked). Open a textarea on any page. Type each of these known-bad NB words: `den boka` (gender), `kan gikk` (modal-verb), `fotball` (sarskriving), `hagde` (typo). Wait for red underline; click the underlined word.
**Expected:** Each popover shows a one-sentence student-friendly explanation embedding the typed word in italic, not a bare class label like "Skrivefeil". Specifically: gender → "kan være feil kjønn"; modal-verb → "Etter modalverb skal hovedverbet stå i infinitiv"; sarskriving → "kan være to ord som hører sammen"; typo → "er en vanlig skrivefeil".
**Why human:** `renderExplain` injects HTML into a live DOM; the CSS + insertion path is content-script-only and cannot be exercised by the Node fixture harness.

#### 2. NN popover explain copy in Chrome

**Test:** Switch the extension to Nynorsk register. Repeat equivalent NN error triggers.
**Expected:** NN copy renders correctly: "kan vere feil kjønn", "hovudverbet stå i infinitiv", "høyrer saman", "ein vanleg skrivefeil". No NB morphology contamination ("være/ikke/bare/hører" should not appear in NN popover output).
**Why human:** NN locale routing in `renderExplain` depends on the active-language detection path which requires a full content-script + storage init flow.

#### 3. Word-prediction top-3 cap with Vis-flere reveal

**Test:** Type a word prefix that yields >3 predictions (e.g., "sk" in a textarea on a Norwegian page). Observe dropdown; click "Vis flere"; observe expansion; click "Vis færre"; observe collapse.
**Expected:** Default 3 rows shown; Vis-flere link with "⌄" chevron at bottom; clicking expands to up to 8 rows and flips link to "Vis færre ⌃"; second click collapses. ArrowDown past row 3 should auto-expand without needing a click.
**Why human:** Dropdown DOM lifecycle, mousedown-preventDefault guards, and ArrowDown key-event path all require a real browser event loop.

#### 4. Multi-suggest spell-check popover (alternates toggle ON)

**Test:** In the popup Settings tab, enable "Vis alternative skriveforslag". Trigger a typo error in a textarea. Observe the popover. Click one of the suggestion rows. Toggle the setting back OFF while the popover is visible.
**Expected:** (a) Popover shows top-3 clickable suggestion rows instead of the single fix-arrow layout; "Vis flere" appears if >3 suggestions. (b) Clicking a row applies that spelling. (c) Toggling OFF live re-renders the popover to single-suggest layout without the user needing to re-click the underlined word.
**Why human:** `chrome.storage.onChanged` live re-render and two-branch `showPopover` require a real Chrome extension context; the fixture harness operates at rule-check level only.

#### 5. XSS smoke test

**Test:** Paste `hagde<script>alert(1)</script>` into a textarea and wait for spell-check. Open DevTools Network tab before testing.
**Expected:** No JavaScript alert fires. Popover (if shown) displays only escaped text. Network tab shows zero outbound requests (SC-06 preserved).
**Why human:** The `nb-typo-xss-001` fixture confirms the rule surface does not crash; the rendered popover's `escapeHtml` + `escapeAttr` defence requires visual browser confirmation.

### Gaps Summary

**Code-side: complete.** All Phase 5 deliverables are fully implemented and wired:

- All 5 popover-surfacing rules have `explain: (finding) => ({nb, nn})` callables with XSS-safe `<em>`-wrapped templates.
- `renderExplain` in `spell-check.js` uses a (rule_id, priority, lang) three-way lookup with a graceful fallback chain — never renders bare class labels when a rule is found.
- Word-prediction caps at VISIBLE_DEFAULT=3 with Vis-flere reveal to VISIBLE_EXPANDED=8 and ArrowDown auto-reveal.
- Spell-check multi-suggest branch (UX-02) is present and wired to the settings toggle via `chrome.storage.onChanged`.
- COPY-REVIEW.md has all 5 rows populated with NB + NN copy; tone-check checklist actioned; dyslexia-persona proxy review PASS log entry dated 2026-04-20.
- All 4 release gates exit 0: `check-fixtures` 281/281, `check-network-silence` PASS, `check-bundle-size` 10.13 MiB / 20 MiB cap, `check-explain-contract` 5/5.
- All 11 Phase 5 commits verified in git log. No SUMMARY contains "Self-Check: FAILED".

### Human Smoke Test Results (2026-04-21)

User performed the 5 human-verification tests above on the Phase 5 release. Results:

| Test | Result | Notes |
|------|--------|-------|
| 1. NB popover explain copy | ✓ PASS (general) | Modal-verb ("Etter modalverb skal hovedverbet stå i infinitiv — bytt går med gå"), gender ("Et kan være feil kjønn — prøv En"), curated-typo ("står ikke i ordboken — kanskje du mente …"), særskriving rendering all correct. Copy is student-friendly as designed. |
| 2. NN popover explain copy | ✓ PASS | NN morphology renders correctly ("står ikkje i ordboka — kanskje du meinte…"). |
| 3. Word-prediction Vis-flere | ✓ PASS | Top-3 cap, Vis-flere reveal, multi-suggest UI confirmed. |
| 4. Multi-suggest popover + live toggle | ✓ PASS | Toggle activates multi-suggest without page reload; `chrome.storage.onChanged` subscription working as designed. |
| 5. XSS smoke test | ✓ PASS | `<img src=x onerror=alert(1)>` pasted into textarea, no alert fired, DevTools Network tab silent. |

### Gaps Found (2026-04-21) — route to Phase 05.1

Human testing of UX-01 surfaced 4 gaps the new explain copy now EXPOSES. These are pre-existing data/rule/policy issues that predate Phase 5 — Phase 5's render-layer is correct, but it now faithfully renders correct-but-misleading explanations because the underlying data/policy is wrong. Same structural category as the already-tracked `fin_adj` + NN phrase-infinitive blockers in STATE.md.

**Gap A — NB wordList missing `blått` (neuter declension of `blå`).** `blå_adj` in `papertek-vocabulary` lacks the neuter form. When student writes `En blått bil`, fuzzy-typo truthfully reports "`blått` står ikke i ordboken" (it isn't — but it SHOULD be). The real error is adjective-noun gender agreement, but the data gap lets fuzzy suggest `blitt` (past participle of `bli`) as the fix. Fix site: `papertek-vocabulary` adjective declensions. Audit pass needed: inventory of other missing neuter declensions across the NB adjective bank.

**Gap B — NB + NN wordLists missing `nynorsk` and `bokmål`.** The two official written standards of Norwegian are not first-class entries. User wrote "skrive på nynorsk" in an NN document and got flagged with "nynorsk står ikkje i ordboka — kanskje du meinte norsk?". Fix site: `papertek-vocabulary` nounbank, both NB and NN. Also audit: other obvious language/nationality nouns (norsk, svensk, dansk, engelsk, tysk, spansk, fransk).

**Gap C — Gender-rule explain copy is generic.** Current copy: "`Et` kan være feil kjønn — prøv `En`." User request: name the target gender explicitly, e.g., "`Et` kan være feil kjønn — `by` er hankjønn. Prøv `En`." Uses the existing `nounGenus` data the rule already consumes to emit the article correction. Educational value uplift — student learns the gender classification, not just the article swap. Fix site: `extension/content/spell-rules/nb-gender.js` + `COPY-REVIEW.md`.

**Gap D — Cross-dialect tokens should FLAG, not silently accept.** Current Phase 4 `sisterValidWords` seam acts as an early-exit in `nb-typo-fuzzy.js` / `nb-typo-curated.js`: if a word exists in the sister dialect's validWords, skip flagging. Per user domain-insight captured 2026-04-21: NB and NN are two distinct official written standards and may not be mixed in a single document. Analogy user offered: "it is like you shouldn't accept German words when writing bokmål or nynorsk." The sister-dialect relationship does NOT imply cross-standard tolerance — writing `ikkje` in an NB document (or `jeg` in an NN document) is a student error. Reverses Phase 4 SC-03's dialect-tolerance policy. Fix site: `nb-typo-fuzzy.js` + `nb-typo-curated.js` (remove or re-purpose the sister-validWords early-exit) + dedicated `nb-dialect-mix.js` / `nn-dialect-mix.js` rule with a "this is Nynorsk — try `ikke` in Bokmål" explanation. Fixture corpus: Phase 4 dialect-tolerance cases (e.g. `nb-typo-dialect-ikkje-001`) need inversion or re-classification. Threshold-gate work from Plan 04-03 SC-05 is unaffected (særskriving is orthogonal).

### Phase 05.1 scope (recommended)

| Gap | Work | Site | Cross-repo? |
|-----|------|------|-------------|
| A | Add `blått` + audit missing NB adjective neuter declensions | `papertek-vocabulary` adjectivebank | Yes (sibling repo PR) |
| B | Add `nynorsk` + `bokmål` + audit language/nationality nouns | `papertek-vocabulary` nounbank | Yes (sibling repo PR) |
| C | Emit target-gender phrase in gender explain copy | `extension/content/spell-rules/nb-gender.js`, `COPY-REVIEW.md` | No |
| D | Reverse sisterValidWords tolerance; introduce dialect-mix rule with explain copy | `extension/content/spell-rules/*.js`, fixtures, `nb-VERIFICATION.md` | No (but Phase 4 policy reversal) |

UX-01 should be marked complete in REQUIREMENTS.md ONCE Phase 05.1 lands — the render-layer is correct but the end-to-end experience is not yet "student-friendly" in the qualitative sense the requirement demands.
UX-02 already marked complete by Plan 05-04 and re-verified by the Chrome smoke test — no revision needed.

### Gaps Resolved (2026-04-21) — closed by Phase 05.1

All four gaps identified above are now resolved. Phase 05.1 landed 5 plans across 2 waves, 10 leksihjelp commits + 5 cross-repo `papertek-vocabulary` commits, and surfaced (and fixed) 4 additional smoke-test bugs during the human-verify checkpoint.

| Gap | Resolution | Commits |
|-----|------------|---------|
| A — NB/NN adjective neuter defects | 6 mono-vowel defects fixed (blå/bra/fri/grå/ny/rå), `fin_adj` added, generator branches added to `enrich-nb-lexicon.js` and `generate-nn-lexicon.js`, new `validate:adj-declensions` lint pass | `4307937c`, `c734f97e`, `dbdb8b12` (papertek-vocabulary) |
| B — Language + nationality banks | 20 language entries + 20 nationality entries × NB/NN, `languagesbank` + `nationalitiesbank` wired through 4 extension-side registries + vocab API lookup route | `bf1bd07b`, `ad210a53` (papertek-vocabulary); `6877ec8` (leksihjelp — 4-registry wiring) |
| C — Gender rule three-beat copy | `Et kan være feil kjønn — by er hankjønn. Prøv En.` now names the target gender; `gender_label_m/f/n` i18n keys + `getString` helper added | `9da46d2`, `6162a97`, `50da3c7` |
| D — Dialect-mix rule | New `nb-dialect-mix.js` at priority 35 with `CROSS_DIALECT_MAP` as authoritative fire-gate; Phase 4 dialect-tolerance fixtures inverted; NB→NN and NN→NB both flag | `4a9b4de`, `9327a6c`, `ade5c40`, `a90fcc0`, `5718b39` |

### Smoke-test bugs surfaced and fixed during Phase 05.1 checkpoint

The human-verify loop surfaced 5 additional bugs beyond the original 4 gaps — all diagnosed and fixed inline:

1. **Modal-verb silent on `kan gikk`** — `buildIndexes` fed feature-gated wordList to `buildLookupIndexes`; browser's basic preset skipped preteritum. Fix: unfiltered superset for lookup indexes. New release gate `check-spellcheck-features` prevents regression. Commit `ce343d9`.
2. **Modal-verb false-pos on bare infinitive `skrive`** — NN phrasal-verb siblings (`skrive_av/opp/ut`) shared `perfektum_partisipp: "skrive"`, last-writer won map key. Fix: `validWords.has('å ' + word)` short-circuit. Commit `5aab727`.
3. **Dialect-mix invisible in browser** — rule fired correctly but `.lh-spell-dialect-mix` CSS missing. Fix: added sky-500 underline color. New release gate `check-rule-css-wiring` prevents regression. Commits `5718b39`, `c592127`, `54c9137`.
4. **Register badge UX gap** — popover didn't indicate which standard was applied. Fix: `register_label_nb/nn` i18n + small pill in popover header. Commit `a2d34e4`.
5. **Dialect-mix over-suppressed by validWords guard** — translation-entry seeding polluted validWords; guard silenced target tokens. Fix: dropped guards, CROSS_DIALECT_MAP is sole fire-gate. Commit `a90fcc0`.

### Human Smoke Test Results (2026-04-21 — Phase 05.1 re-verify)

All 11 scenarios PASS. See `.planning/phases/05.1-close-ux-01-gaps-from-phase-5-smoke-test/05.1-05-SUMMARY.md` for the full matrix.

### Deferred items (tracked in STATE.md Pending Todos)

- `markeres` / s-passiv form missing from papertek-vocabulary (data gap, not Phase 05.1 scope)
- `setningen` NB bestemt form missing alongside `setninga` (papertek-vocabulary data gap)
- Demonstrative-mismatch (`Det boka`, `Den huset`) — Phase 06 candidate; extends `nb-gender` beyond en/ei/et scope
- Triple-letter typo budget (`tykkkjer`) — Phase 06 candidate; requires frequency-weighted fuzzy-distance tiebreak

---

_Verified: 2026-04-20T20:44:12Z_
_Revised: 2026-04-21 — human smoke test results + gap findings_
_Resolved: 2026-04-21 — Phase 05.1 closed all 4 gaps + 5 surfaced bugs, 11-scenario smoke test PASS_
_Verifier: Claude (gsd-verifier)_
