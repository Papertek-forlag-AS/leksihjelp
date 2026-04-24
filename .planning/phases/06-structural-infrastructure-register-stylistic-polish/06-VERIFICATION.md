---
phase: 06-structural-infrastructure-register-stylistic-polish
verified: 2026-04-24T20:00:00Z
status: human_needed
score: 14/14 must-haves verified
re_verification: false
human_verification:
  - test: "Load unpacked extension in Chrome. In any text input, type: I wanna make a photo and get a free gift"
    expected: "make a photo gets an amber dot (P2 warn, collocation rule). free gift gets a grey dotted underline (P3 hint, redundancy rule). wanna is NOT flagged unless grammar_register is toggled ON."
    why_human: "Visual rendering of P2 amber dot vs P3 grey dotted underline cannot be verified programmatically. CSS classes exist but pixel-accurate rendering requires browser."
  - test: "In the same text input, type: He said \"I wanna make a photo\""
    expected: "No spell-check flags appear inside the quoted span. wanna and make a photo are suppressed by quotation-suppression."
    why_human: "ctx.suppressedFor.structural wiring to DOM rendering requires browser to confirm end-to-end suppression."
  - test: "Type hun var en fin skole in a Norwegian text input (NB). Confirm P1 red dot still appears on gender error."
    expected: "Red dot on gender mismatch. No visual regression from infrastructure changes."
    why_human: "P1 / P2 / P3 visual differentiation must be confirmed by eye in Chrome."
  - test: "Enable grammar_register in extension settings. Type gonna in an English input."
    expected: "Amber dot appears on gonna with colloquialism suggestion."
    why_human: "Feature-gated rule with opt-in toggle — requires UI interaction to enable and browser rendering to confirm."
---

# Phase 6: Structural Infrastructure + Register / Stylistic Polish — Verification Report

**Phase Goal:** Land the cross-cutting infrastructure every later phase depends on (sentence segmenter, priority bands, severity contract, quotation suppression, new release gates), and ship the lowest-risk rule family (register / collocation / redundancy) to validate the infrastructure under real rules.
**Verified:** 2026-04-24T20:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ctx.sentences populated on every check() call via Intl.Segmenter | VERIFIED | `spell-check-core.js` lines 69-83: Intl.Segmenter with graceful single-sentence fallback; `ctx.sentences` added to ctx object at line 101 |
| 2 | ctx.suppressedFor.structural populated by quotation-suppression pre-pass | VERIFIED | `quotation-suppression.js` at priority 3 adds token indices to `ctx.suppressedFor.structural`; wired in core at line 101 |
| 3 | Every existing rule has severity: 'error' | VERIFIED | Spot-checked nb-gender, nb-modal-verb, nb-sarskriving, de-capitalization, fr-grammar — all carry `severity: 'error'`; check-explain-contract PASS: 26/26 |
| 4 | P2 warning rules render amber dots and P3 hint rules render grey dotted underline in CSS | VERIFIED (automated) / human_needed (visual) | CSS lines 885-904 exist with correct class names; human confirmation of pixel rendering needed |
| 5 | spell-check.js DOM adapter maps finding.severity to correct CSS suffix (-warn / -hint / base) | VERIFIED | Lines 314-318: severitySuffix computed from finding.severity; lines 399-401: popover suffix |
| 6 | check-explain-contract exits 0 with severity validation on all existing rules | VERIFIED | `npm run check-explain-contract` PASS: 26/26 |
| 7 | check-rule-css-wiring validates severity-tier CSS variants | VERIFIED | `npm run check-rule-css-wiring` PASS: 26/26 |
| 8 | check-benchmark-coverage reads expectations.json and validates expected rule flips | VERIFIED | PASS: 2/2 expectations met (en.40 collocation P2, en.41 redundancy P3) |
| 9 | check-governance-data validates registerbank/collocationbank/phrasebank presence and shape | VERIFIED | PASS: pre-data-sync state accepted; self-test proves gate fires on broken shape |
| 10 | Both new gates have paired self-tests proving fire-on-broken / pass-on-valid | VERIFIED | check-benchmark-coverage:test PASS; check-governance-data:test PASS |
| 11 | Both new gates registered in package.json and CLAUDE.md | VERIFIED | package.json lines 42-45; CLAUDE.md steps 7-8 |
| 12 | REG-01 register rule flags colloquialisms at P2 warn, defaults OFF | VERIFIED | register.js priority 60, severity 'warning'; isFeatureEnabled('grammar_register') gate at line 83-85; grammar_register toggle in grammarfeatures-nb.json |
| 13 | REG-02 collocation rule flags EN wrong-verb bigrams at P2 warn | VERIFIED | collocation.js priority 65, severity 'warning'; seed data includes "make a photo → take a photo"; benchmark en.40 confirmed |
| 14 | REG-03 redundancy rule flags phrase matches at P3 hint, honors suppressedFor | VERIFIED | redundancy.js priority 70, severity 'hint'; suppressedFor.structural check at lines 106-110; benchmark en.41 confirmed |

**Score:** 14/14 truths verified (4 additionally need human visual confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/quotation-suppression.js` | Pre-pass rule at priority 3, marks tokens inside quotes | VERIFIED | Exists, substantive, loaded in manifest at position 29, populates ctx.suppressedFor.structural |
| `extension/content/spell-check-core.js` | Sentence segmenter + ctx.suppressedFor.structural init | VERIFIED | Intl.Segmenter integration at lines 69-83; ctx extended at line 101; severity stamping at lines 117-121 |
| `extension/styles/content.css` | P2 amber dot and P3 grey dotted underline CSS | VERIFIED | lh-spell-warn at line 885, lh-spell-hint at line 893, per-rule bindings at lines 880-882 |
| `scripts/check-benchmark-coverage.js` | INFRA-08 release gate | VERIFIED | Exists, reads expectations.json, runs spell-check per benchmark line, exits 0 |
| `scripts/check-benchmark-coverage.test.js` | Paired self-test | VERIFIED | Proves fire-on-broken and pass-on-empty; exits 0 |
| `scripts/check-governance-data.js` | INFRA-09 release gate | VERIFIED | Validates bank shape when present, passes pre-data-sync; exits 0 |
| `scripts/check-governance-data.test.js` | Paired self-test | VERIFIED | Three scenarios covered (broken/valid/no-data); exits 0 |
| `benchmark-texts/expectations.json` | Machine-checkable benchmark manifest | VERIFIED | Two entries populated (en.40 collocation, en.41 redundancy) |
| `extension/content/spell-rules/register.js` | REG-01, priority 60, P2 warn | VERIFIED | Exists, substantive (~150 LOC), feature-gated, seed data, suppressedFor-aware |
| `extension/content/spell-rules/collocation.js` | REG-02, priority 65, P2 warn | VERIFIED | Exists, substantive, ctx.sentences iteration, suppressedFor check, seed data |
| `extension/content/spell-rules/redundancy.js` | REG-03, priority 70, P3 hint | VERIFIED | Exists, substantive, ctx.sentences iteration, suppressedFor check, seed data |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `spell-check-core.js` | `Intl.Segmenter` | ctx.sentences population | WIRED | `ctx\.sentences` present at line 101; Intl.Segmenter call at line 75 |
| `spell-check.js` | `content.css` | severity-to-CSS-class mapping | WIRED | `lh-spell.*-warn` at line 315; `lh-spell.*-hint` at line 316 |
| `register.js` | `vocab-seam-core.js` | ctx.vocab.registerWords | WIRED | `ctx.vocab.registerWords` at line 93; spell-check.js passes `registerWords: VOCAB.getRegisterWords()` at line 240 |
| `collocation.js` | `vocab-seam-core.js` | ctx.vocab.collocations | WIRED | `ctx.vocab.collocations` at line 55; spell-check.js at line 241 |
| `redundancy.js` | `vocab-seam-core.js` | ctx.vocab.redundancyPhrases | WIRED | `ctx.vocab.redundancyPhrases` at line 77; spell-check.js at line 242 |
| `vocab-seam-core.js` | `extension/data/*.json` | registerbank/collocationbank/phrasebank extraction | WIRED | Extraction code at lines 861-913; gates pass on empty banks gracefully |
| `check-benchmark-coverage.js` | `benchmark-texts/expectations.json` | JSON manifest read | WIRED | Pattern `expectations\.json` present; 2/2 expectations verified at runtime |
| `check-governance-data.js` | `extension/data/*.json` | Bank key presence check | WIRED | Pattern `registerbank|collocationbank|phrasebank` present; gate passes pre-data-sync |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-05 | 06-01 | Sentence segmenter available as shared helper (Intl.Segmenter-backed) | SATISFIED | ctx.sentences in spell-check-core.js; available to all rules via ctx |
| INFRA-08 | 06-02 | check-benchmark-coverage gate — measures per-phase benchmark flip-rate with P1/P2/P3 weighting | SATISFIED | Gate exists, PASS: 2/2 at runtime; self-test passes |
| INFRA-09 | 06-02 | check-governance-data gate — catches vocab sync dropping governance flags | SATISFIED | Gate exists, validates shape; self-test proves fire-on-broken |
| INFRA-11 | 06-01 | Priority bands P1/P2/P3 with distinct dot-colour tiers in content.css; extend check-rule-css-wiring | SATISFIED | CSS tiers at lines 885-904; wiring gate PASS: 26/26 |
| INFRA-12 | 06-01 | rule.severity field in explain contract; extend check-explain-contract to require it | SATISFIED | severity validation added to check-explain-contract; PASS: 26/26; self-test covers SEVERITY_MISSING |
| REG-01 | 06-03 | Register/formality detector flags colloquialisms; opt-in via grammar feature toggle | SATISFIED | register.js shipped; grammar_register toggle (default OFF) in grammarfeatures-nb/nn.json |
| REG-02 | 06-03 | Collocation-error detector flags wrong-verb bigrams from curated list | SATISFIED | collocation.js shipped; benchmark en.40 confirmed; "make a photo" seed data present |
| REG-03 | 06-03 | Stylistic-redundancy detector flags phrase-bank literal matches | SATISFIED | redundancy.js shipped; benchmark en.41 confirmed; multi-language seed data |

**Orphaned requirements:** None. All 8 requirement IDs declared across the three plans are accounted for.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `extension/content/spell-rules/register.js` | `// TEMPORARY: remove after papertek-vocabulary PR lands` (seed data) | Info | Intentional by design; seed data allows testing before API banks land. Not a blocker. |
| `extension/content/spell-rules/collocation.js` | `// TEMPORARY:` seed data block (~20 entries) | Info | Same rationale. Plan explicitly states seeds are marked for removal. |
| `extension/content/spell-rules/redundancy.js` | `// TEMPORARY:` seed data block (multi-language phrases) | Info | Same rationale. |

No blockers or warnings found. All TODOs are explicitly anticipated temporary markers.

---

### Release Gates — All Passing

| Gate | Result |
|------|--------|
| `npm run check-fixtures` | PASS (20/20 suites, 100% fixture pass rate) |
| `npm run check-explain-contract` | PASS: 26/26 |
| `npm run check-explain-contract:test` | PASS (broken-explain + severity-missing + well-formed) |
| `npm run check-rule-css-wiring` | PASS: 26/26 |
| `npm run check-rule-css-wiring:test` | PASS |
| `npm run check-benchmark-coverage` | PASS: 2/2 expectations met |
| `npm run check-benchmark-coverage:test` | PASS |
| `npm run check-governance-data` | PASS (pre-data-sync) |
| `npm run check-governance-data:test` | PASS (all 3 scenarios) |
| `npm run check-network-silence` | PASS |
| `npm run check-spellcheck-features` | PASS |

---

### Human Verification Required

#### 1. P2 amber dot rendering

**Test:** Load unpacked extension in Chrome (chrome://extensions → Load unpacked → extension/). Open any page with a text input. Type: `I wanna make a photo and get a free gift`
**Expected:** `make a photo` gets a 3px solid amber dot (P2 warn, collocation rule). `free gift` gets a grey dotted underline spanning the full phrase width (P3 hint, redundancy rule). `wanna` shows no flag (grammar_register is OFF by default).
**Why human:** CSS classes `.lh-spell-warn` and `.lh-spell-hint` exist in content.css and DOM adapter is wired, but the visual distinction between P1 red dot / P2 amber dot / P3 grey dotted underline requires browser rendering to confirm.

#### 2. Quotation suppression in browser

**Test:** In the same text input, type: `He said "I wanna make a photo"`
**Expected:** No amber dots or dotted underlines appear inside the quoted text. The quotation-suppression pre-pass should suppress all tokens between the quote pair.
**Why human:** ctx.suppressedFor.structural is populated in Node test environment via check-fixtures, but end-to-end DOM suppression path (quotation-suppression → spell-check.js → overlay skip) requires browser to confirm.

#### 3. P1 rules unaffected (regression check)

**Test:** Type `hun var en fin skole` in a Norwegian-language text input.
**Expected:** Red dot (P1 error) on the gender mismatch. No change in P1 visual behavior from Phase 6 infrastructure changes.
**Why human:** Visual regression of existing P1 rules must be confirmed by eye alongside the new P2/P3 tiers.

#### 4. grammar_register opt-in

**Test:** Enable grammar_register in extension settings popup. Then type `gonna` in an English text input.
**Expected:** Amber dot appears on `gonna` with a suggestion to replace with `going to`.
**Why human:** Feature-gated rule requires UI interaction (toggle ON) and browser rendering to confirm end-to-end flow through isFeatureEnabled.

---

### Summary

All 14 observable truths are verified against the actual codebase. All 8 requirement IDs (INFRA-05, INFRA-08, INFRA-09, INFRA-11, INFRA-12, REG-01, REG-02, REG-03) are fully satisfied with concrete implementation evidence. All 11 release gates exit 0. Three rule files carry intentional `// TEMPORARY` seed-data markers that are expected and documented.

The phase goal is substantively achieved. The only items left for human confirmation are the visual rendering of the P1/P2/P3 dot-colour tiers in Chrome and the quotation-suppression DOM path — automated checks cannot substitute for rendering the overlay in a real browser.

---

_Verified: 2026-04-24T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
