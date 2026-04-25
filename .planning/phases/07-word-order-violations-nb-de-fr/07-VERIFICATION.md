---
phase: 07-word-order-violations-nb-de-fr
verified: 2026-04-24T21:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 7/9
  gaps_closed:
    - "check-fixtures gate exits 0 (43 co-fire failures resolved, nb-v2 false positives eliminated)"
    - "FR acceptance fixture 'une belle femme' exists in fixtures/fr/bags.jsonl and fr-bags is silent on it"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load the extension in browser, type 'Hvorfor du tror at norsk er lett?' in a Norwegian text field"
    expected: "Amber dot appears under 'du' (subject pronoun); popover explains V2 word order in Norwegian"
    why_human: "End-to-end browser rendering of the dot and popover cannot be verified programmatically"
  - test: "Type 'I går gikk jeg på kino.' in a Norwegian text field"
    expected: "No dot appears (correct V2 inversion is accepted)"
    why_human: "Confirm silence on correct forms in the actual extension UI"
  - test: "Type 'Ich denke dass deutsch ist schwieriger.' in a German text field"
    expected: "Amber dot under 'ist'; popover explains verb-final rule in Norwegian"
    why_human: "Modal disambiguation and noun-capitalization heuristics need browser verification with real vocab"
  - test: "Type 'C'est un homme grand et intelligent.' in a French text field"
    expected: "Grey dotted underline under 'grand'; popover explains BAGS placement"
    why_human: "P3 hint tier uses dotted border not background dot — CSS rendering needs visual confirmation"
---

# Phase 7: Word-Order Violations (NB + DE + FR) Verification Report

**Phase Goal:** Ship four word-order / sentence-structure rules (NB V2, DE V2, DE verb-final, FR BAGS) behind the tagged-token POS view, with >= 2x acceptance-to-positive fixture ratio per rule and all release gates green.
**Verified:** 2026-04-24T21:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (07-04 plan executed)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Tagged-token POS helpers land in spell-check-core.js; all four rules consume them | VERIFIED | getTagged, buildFiniteStems, classifyPOS, SUBORDINATORS, SUBJECT_PRONOUNS exported at lines 443-446; all four rule files reference `host.__lexiSpellCore` |
| 2 | NB benchmark lines flip from unflagged to flagged | VERIFIED | benchmark-texts/nb.txt lines 42-43; expectations nb.42/nb.43 for nb-v2; check-benchmark-coverage 8/8 P2+P3 100% |
| 3 | DE benchmark lines flip from unflagged to flagged | VERIFIED | expectations de.32, de.39 (de-v2) and de.44 (de-verb-final); benchmark coverage P2 100% |
| 4 | FR "une belle femme" does NOT flag fr-bags; post-nominal counter-example flips to flagged | VERIFIED | fr-bags-acc-une-belle-femme in fixtures/fr/bags.jsonl; expected array contains only typo finding (fr-bags silent); fr.53 flagged in benchmark |
| 5 | Phase 13 seam documented; >= 2x acceptance ratio enforced by fixture runner | VERIFIED | check-fixtures ACCEPTANCE_RATIO_RULES covers all four rules; ratios: nb-v2 64/32=2.0x, de-v2 90/45=2.0x, de-verb-final 95/46=2.06x, fr-bags 142/65=2.18x |
| 6 | check-fixtures exits 0 (no regression from Phase 7 additions) | VERIFIED | All 26 fixture files pass P=R=F1=1.000; nb/v2 96/96, de/v2 135/135, de/verb-final 141/141, fr/bags 207/207 |
| 7 | check-explain-contract exits 0 | VERIFIED | 30/30 popover-surfacing rules pass; exit 0 |
| 8 | check-rule-css-wiring exits 0 | VERIFIED | 30/30 rules have CSS wiring; nb-v2/de-v2/de-verb-final amber, fr-bags dotted hint; exit 0 |
| 9 | check-network-silence exits 0 | VERIFIED | No fetch/XHR/sendBeacon in any Phase 7 rule file; exit 0 |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-check-core.js` | Tagged-token POS view, finite-stem builder, exported helpers | VERIFIED | getTagged, buildFiniteStems, classifyPOS exported; consumed by all four rules |
| `extension/content/spell-rules/nb-v2.js` | NB V2 word-order rule with coordinate/question/complement guards | VERIFIED | Four false-positive guards added in 07-04; recall 1.000 maintained |
| `extension/content/spell-rules/de-v2.js` | DE main-clause V2 rule | VERIFIED | Separable-prefix stripping; benchmark de.32/de.39 pass |
| `extension/content/spell-rules/de-verb-final.js` | DE subordinate verb-final rule | VERIFIED | Modal disambiguation; noun/verb capitalization heuristic; benchmark de.44 passes |
| `extension/content/spell-rules/fr-bags.js` | FR BAGS adjective placement rule | VERIFIED | BAGS_SET ~40 forms; nounGenus-based detection; benchmark fr.53 passes |
| `fixtures/nb/v2.jsonl` | >= 30 positive + >= 2x acceptance | VERIFIED | 32 positive + 64 acceptance (2.0x); all 96 cases pass |
| `fixtures/de/v2.jsonl` | >= 30 positive + >= 2x acceptance | VERIFIED | 45 positive + 90 acceptance (2.0x); all 135 cases pass |
| `fixtures/de/verb-final.jsonl` | >= 30 positive + >= 2x acceptance | VERIFIED | 46 positive + 95 acceptance (2.06x); all 141 cases pass |
| `fixtures/fr/bags.jsonl` | >= 30 positive + >= 2x acceptance + une belle femme | VERIFIED | 65 positive + 142 acceptance (2.18x); une belle femme acceptance case present; all 207 cases pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| spell-check-core.js | vocab.knownPresens / knownPreteritum | buildFiniteStems reads both sets | VERIFIED | Lines 72-76; classifyPOS at 85-86; getTagged at 186-187 |
| spell-check-core.js | self.__lexiSpellCore | findFiniteVerb / findSubordinator / isMainClause / tokensInSentence exported | VERIFIED | Lines 443-446 |
| nb-v2.js | spell-check-core.js | core.tokensInSentence; four false-positive guards wired to vocab | VERIFIED | tokensInSentence used; coordinate/question/complement/ein guards all wired |
| de-v2.js | spell-check-core.js | core.tokensInSentence; separable-prefix stem check | VERIFIED | Lines 79, 84; direct vocab lookup at 115-116 |
| de-verb-final.js | spell-check-core.js | findFiniteVerb and tokensInSentence destructured from core | VERIFIED | `const { findFiniteVerb, tokensInSentence, ... } = core` |
| fr-bags.js | spell-check-core.js | nounGenus accessed via ctx.vocab; fr-bags silent on pre-nominal BAGS | VERIFIED | nounGenus at lines 66/80; une belle femme acceptance confirms pre-nominal silence |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| INFRA-06 | 07-01, 07-04 | Tagged-token POS view available to all word-order rules | SATISFIED | getTagged, SUBORDINATORS, SUBJECT_PRONOUNS, buildFiniteStems, four helpers in spell-check-core.js; all four rules consume via __lexiSpellCore |
| WO-01 | 07-02, 07-04 | NB V2 violation flagged (fronted-adv + subject + finite-verb) | SATISFIED | nb-v2.js; benchmark nb.42/nb.43 pass; check-fixtures 96/96; four false-positive guards prevent over-flagging |
| WO-02 | 07-02, 07-04 | DE main-clause V2 violation flagged | SATISFIED | de-v2.js; benchmark de.32/de.39 pass; check-fixtures 135/135 |
| WO-03 | 07-03, 07-04 | DE subordinate verb-final violation flagged | SATISFIED | de-verb-final.js; benchmark de.44 passes; check-fixtures 141/141 |
| WO-04 | 07-03, 07-04 | FR BAGS adjective placement flagged post-nominally | SATISFIED | fr-bags.js; benchmark fr.53 passes; une belle femme acceptance case verified; check-fixtures 207/207 |

All five requirement IDs (INFRA-06, WO-01, WO-02, WO-03, WO-04) are accounted for across plans 07-01 through 07-04. No orphaned requirements.

### Anti-Patterns Found

None blocking. The 43 co-fire failures from initial verification are resolved: nb-v2 false positives were eliminated via four guards (coordinate conjunctions, question-initial, complement clause "det er", NN article "ein" disambiguation), and remaining co-fired sibling-rule findings were declared in fixture expected arrays.

### Human Verification Required

#### 1. NB V2 dot rendering in browser

**Test:** Load the extension; open a Norwegian-language input field; type "Hvorfor du tror at norsk er lett?"
**Expected:** Amber dot appears under "du" (the subject pronoun); clicking the dot shows the V2 explanation in both Bokmal and Nynorsk
**Why human:** CSS dot rendering, popover position, and explain-text display cannot be verified from source alone

#### 2. NB V2 correct-order silence

**Test:** Type "I går gikk jeg på kino." in the same field
**Expected:** No dot appears; correct V2 inversion is accepted
**Why human:** Confirm no false positive in the actual browser environment with real nb.json data

#### 3. DE verb-final dot and popover

**Test:** In a German text field, type "Ich denke dass deutsch ist schwieriger."
**Expected:** Amber dot under "ist"; popover explains verb-final rule ("I tyske bisetninger skal det bøyde verbet stå til slutt")
**Why human:** Modal disambiguation and noun-capitalization heuristics need browser verification with real vocab

#### 4. FR BAGS hint rendering

**Test:** In a French text field, type "C'est un homme grand et intelligent."
**Expected:** Grey dotted underline under "grand"; popover explains BAGS placement (P3 hint tier)
**Why human:** P3 hint tier uses `border-bottom: 2px dotted` distinct from error/warning dots — needs visual confirmation

### Gaps Summary

No automated gaps remain. Both gaps from the initial verification are closed:

Gap 1 (check-fixtures exits 1): Resolved. The nb-v2 rule received four false-positive guards (coordinate conjunction, question-initial, complement clause "det er", NN article "ein" disambiguation). Remaining legitimate co-fires from sibling rules were declared in fixture expected arrays. All 26 fixture files now exit with P=R=F1=1.000.

Gap 2 (missing "une belle femme" fixture): Resolved. The fixture exists in fixtures/fr/bags.jsonl with expected containing only a typo co-fire; fr-bags is silent on it. The case is semantically correct: "belle" precedes the noun (pre-nominal BAGS position = correct placement = acceptance).

All five release gates exit 0. Phase 7 goal is achieved subject to four browser rendering verification items.

---

_Verified: 2026-04-24T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
