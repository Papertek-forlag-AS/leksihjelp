---
phase: 04-false-positive-reduction-nb-nn
verified: 2026-04-20T14:30:00Z
status: human_needed
score: 3/4 must-haves auto-verified; 1/4 requires live Chrome inspection
human_verification:
  - test: "Load extension unpacked in Chrome. Open a page with a <textarea>. Paste the 558-word NB article from fixtures/nb/clean.jsonl (id: nb-clean-news-500w-001) and confirm zero red underlines appear on proper nouns, loan words, and capitalized names."
    expected: "No spell-check findings — the fixture asserts expected:[] and the runner confirms it, but the fixture runner exercises the Node path (vocab-seam-core directly). The Chrome runtime paths the vocab through vocab-seam.js → vocab-seam-core.js via loadRawSister, so this smoke test confirms the browser adapter wiring is live."
    why_human: "ROADMAP success criterion #1 explicitly requires 'manual inspection' of a 500-word paste in a <textarea>. The fixture runner proves the Node path is clean, but cannot substitute for a live Chrome content-script smoke test that exercises the manifest content-script load order, the chrome.runtime.getURL fetch path, and the actual DOM overlay rendering."
---

# Phase 04: False-Positive Reduction on NB/NN Verification Report

**Phase Goal:** Proper-noun guard, dialect tolerance, code-switching detection, and particularly særskriving all pass the regression fixture's precision/recall thresholds — so the tool stays quiet on correct Norwegian text, tolerates mixed-language documents, and only fires særskriving when it's genuinely wrong.
**Verified:** 2026-04-20T14:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A sample NB news article (>=500 words) produces no false positives on proper nouns, loan words, or capitalized names | ? UNCERTAIN | Fixture nb-clean-news-500w-001 (558 words, expected:[]) passes the runner 19/19 NB clean cases. ROADMAP says "verified by manual inspection" in a `<textarea>` — see Human Verification Required |
| 2 | Typing `ikkje` in NB does not flag; typing `ikke` in NN does not flag — verified via fixture cases in both directions | ✓ VERIFIED | nb-typo-dialect-ikkje-001 (expected:[]) + nn-typo-dialect-ikke-001 (expected:[]) pass in check-fixtures 280/280 run. nb-typo-fuzzy.js `sisterValidWords.has(t.word)` early-exit confirmed; nb-typo-curated.js sister guard confirmed. Both via live grep. |
| 3 | A paragraph of English or German quoted in NB produces at most 1 flag per paragraph (not per word) | ✓ VERIFIED | fixtures/nb/codeswitch.jsonl 13 cases including 8 EN-span cases (3+ contiguous non-NB tokens) + 2 FR cases all pass with expected:[] or 1 finding on a Norwegian typo outside the span. 13/13 pass in check-fixtures. ROADMAP wording is "English or German" (disjunction) — English coverage satisfies the criterion. Note: pure-German cases with capitalized nouns (Ich, Guten) are below density threshold due to isLikelyProperNoun exclusion — documented as intentional in the codeswitch fixture header comment, deferred to Plan 04-02's acknowledged tuning window. |
| 4 | The særskriving rule's precision and recall meet thresholds set during Phase 1 — verified by fixture script output | ✓ VERIFIED | check-fixtures exits 0. nb/saerskriving P=1.000 R=1.000 (55/55), nn/saerskriving P=1.000 R=1.000 (46/46). THRESHOLDS gate at P>=0.92 R>=0.95 both languages passes with 0.08 P-margin and 0.05 R-margin. Defence-in-depth probe documented in commit 21201c7 — gate fires when mutated to 0.99/0.99. |

**Score:** 3/4 truths auto-verified; 1/4 requires human Chrome smoke test.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | buildIndexes accepts sisterRaw, derives sisterValidWords Set | ✓ VERIFIED | sisterValidWords derivation at line ~527; typo-filter `entry.type === 'typo'` confirmed present; returned in object at line ~549 |
| `extension/content/vocab-seam.js` | loadRawSister + getSisterValidWords | ✓ VERIFIED | loadRawSister function at line ~130; getSisterValidWords getter at line ~272; Promise.all at line ~164 includes sisterRaw |
| `extension/content/spell-check.js` | sisterValidWords: VOCAB.getSisterValidWords() in runCheck vocab literal | ✓ VERIFIED | Confirmed at line 214: `sisterValidWords: VOCAB.getSisterValidWords(),  // Phase 4 / SC-03` |
| `scripts/check-fixtures.js` | SC-03 adapter-contract guard + sisterRaw loading + THRESHOLDS table | ✓ VERIFIED | SC-03 regex guard at ~line 262; data-contract sisterValidWords size check at ~line 176; THRESHOLDS table at top of file with locked P:0.92, R:0.95; per-rule gate at ~line 308 |
| `extension/content/spell-check-core.js` | ctx.suppressed = new Set() in check() runner | ✓ VERIFIED | Line 75: `const ctx = { text, tokens, vocab: vocabRef, cursorPos, lang, suppressed: new Set() };` |
| `extension/content/spell-rules/nb-codeswitch.js` | Priority 1 pre-pass density-window rule, 102 lines | ✓ VERIFIED | 102 lines confirmed; priority=1; WINDOW_SIZE=5, UNKNOWN_THRESHOLD=3, MIN_TOKENS=8; populates ctx.suppressed; returns [] |
| `extension/content/spell-rules/nb-propernoun-guard.js` | Priority 5 pre-pass four-layer rule, 153 lines, LOAN_WORDS Set | ✓ VERIFIED | 153 lines confirmed; priority=5; LOAN_WORDS Set with 70 curated entries; isAllCaps, isHyphenCap, isConsecutiveCapSpan helpers present; returns [] |
| `extension/content/spell-rules/README.md` | Documents ctx.suppressed convention | ✓ VERIFIED | "Suppression convention — ctx.suppressed (Phase 4)" section confirmed; lists who populates, honors, and explicitly does NOT honor; additive-only rule documented |
| `extension/manifest.json` | nb-codeswitch.js + nb-propernoun-guard.js inserted after spell-check-core.js, before nb-gender.js | ✓ VERIFIED | Lines 29-30 in content_scripts[0].js array; alphabetical position confirmed |
| `extension/content/spell-rules/nb-typo-curated.js` | suppressed opt-in + sisterValidWords early-exit | ✓ VERIFIED | `if (suppressed && suppressed.has(i)) continue` at line 35; `if (sisterValidWords.has(t.word)) continue` at line 45 |
| `extension/content/spell-rules/nb-typo-fuzzy.js` | suppressed opt-in + sisterValidWords early-exit | ✓ VERIFIED | `if (suppressed && suppressed.has(i)) continue` at line 113; `if (sisterValidWords.has(t.word)) continue` at line 121 |
| `extension/content/spell-rules/nb-sarskriving.js` | suppressed two-token opt-in + `stor` in SARSKRIVING_BLOCKLIST | ✓ VERIFIED | Two-token guard: `if (suppressed && (suppressed.has(i) || (i > 0 && suppressed.has(i - 1)))) continue` at line 56; `'stor'` in SARSKRIVING_BLOCKLIST confirmed |
| `fixtures/nb/codeswitch.jsonl` | NEW, >=10 SC-04 cases | ✓ VERIFIED | 13 JSON cases; EN/FR spans; typo-outside-span mix; short-input guard; proper-noun density guard |
| `fixtures/nn/codeswitch.jsonl` | NEW, >=10 SC-04 cases in NN register | ✓ VERIFIED | 13 JSON cases; EN/FR; NN-register surrounding text (eg, ikkje, berre) |
| `fixtures/nb/saerskriving.jsonl` | >=30 positive + >=15 acceptance (was 16 total) | ✓ VERIFIED | 55 total cases; 38 positive (expected:[{...}]) + 17 acceptance (expected:[]); well over spec minimums |
| `fixtures/nn/saerskriving.jsonl` | >=30 positive + >=15 acceptance | ✓ VERIFIED | 46 total cases; 30 positive + 16 acceptance |
| `fixtures/nb/clean.jsonl` | >=1 real NB article (>=500 words), >=3 loan-word, >=3 proper-noun cases | ✓ VERIFIED | nb-clean-news-500w-001 (558 words, expected:[]); nb-clean-loan-001 through 005 (5 cases); nb-clean-propnoun-001 through 005 (5 cases); Anne Grethe + NATO confirmed present |
| `fixtures/nn/clean.jsonl` | >=1 NN article (>=500 words), >=3 loan, >=3 proper-noun | ✓ VERIFIED | nn-clean-news-500w-001 (604 words, expected:[]); nn-clean-loan-001 through 005; nn-clean-propnoun-001 through 005 |
| `fixtures/nb/typo.jsonl` | >=5 dialect-tolerance NN-in-NB cases | ✓ VERIFIED | 6 dialect cases: ikkje, eg, berre, nokon, heim, ho; plus Pitfall-5 anti-leakage: komer still flags |
| `fixtures/nn/typo.jsonl` | >=5 dialect-tolerance NB-in-NN cases | ✓ VERIFIED | 5 dialect cases: jeg, ikke, bare, noen, hjem |
| `fixtures/README.md` | Code-switching corpus + P/R threshold gate sections | ✓ VERIFIED | "Code-switching corpus" section at line 156; "P/R threshold gate" section at line 179; key-vs-rule_id distinction documented |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| vocab-seam.js:loadForLanguage | vocab-seam-core.js:buildIndexes | Promise.all [bigrams, freq, sisterRaw] → core.buildIndexes({sisterRaw}) | ✓ WIRED | loadRawSister confirmed in Promise.all at line 164; sisterRaw passed to buildIndexes at line ~170 |
| spell-check.js:runCheck | vocab-seam.js:VOCAB.getSisterValidWords | vocab literal field `sisterValidWords: VOCAB.getSisterValidWords()` | ✓ WIRED | Line 214 confirmed |
| scripts/check-fixtures.js:main | spell-check.js (static source-regex) | SC-03 guard: `/sisterValidWords:\s*VOCAB\.getSisterValidWords\(\)/` | ✓ WIRED | Guard at ~line 262; throws with "SC-03 browser-wiring regression" message; probe documented in commit c2e7165 |
| spell-check-core.js:check | ctx.suppressed | `suppressed: new Set()` in ctx initializer | ✓ WIRED | Line 75 confirmed |
| nb-codeswitch.js | ctx.suppressed | `ctx.suppressed.add(j)` inside sliding window | ✓ WIRED | Pattern confirmed at line 92 |
| nb-propernoun-guard.js | ctx.suppressed + LOAN_WORDS | `ctx.suppressed.add(i)` for each of four layers | ✓ WIRED | Lines 133-140 confirmed; all four layers present |
| nb-typo-curated.js + nb-typo-fuzzy.js + nb-sarskriving.js | ctx.suppressed | `if (suppressed && suppressed.has(i)) continue` | ✓ WIRED | All three rules confirmed; sarskriving uses two-token variant |
| nb-typo-fuzzy.js | vocab.sisterValidWords | `if (sisterValidWords.has(t.word)) continue` (SC-03 rule-layer) | ✓ WIRED | Line 121 confirmed |
| nb-typo-curated.js | vocab.sisterValidWords | `if (sisterValidWords.has(t.word)) continue` (SC-03 rule-layer, fix commit 383552c) | ✓ WIRED | Line 45 confirmed |
| scripts/check-fixtures.js:THRESHOLDS | saerskriving P/R gate | `const req = THRESHOLDS[l] && THRESHOLDS[l][ruleId]` with hardFail on dip | ✓ WIRED | THRESHOLDS = {nb: {saerskriving:{P:0.92,R:0.95}}, nn: {saerskriving:{P:0.92,R:0.95}}}; gate at ~line 308; defence-in-depth probe in commit 21201c7 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SC-02 | 04-02, 04-03 | Expanded proper-noun and loan-word guard | ✓ SATISFIED | nb-propernoun-guard.js ships (153 lines, 70 LOAN_WORDS, 4 layers); fixture coverage: nb-clean-loan-001..005, nb-clean-propnoun-001..005, Anne Grethe + NATO pass; check-fixtures 19/19 NB clean |
| SC-03 | 04-01, 04-02, 04-03 | NB↔NN dialect tolerance | ✓ SATISFIED | Seam rail: loadRawSister + getSisterValidWords + sisterValidWords in buildIndexes; Rule layer: nb-typo-fuzzy sisterValidWords early-exit + nb-typo-curated sisterValidWords early-exit; Fixture proof: ikkje/eg/berre/nokon/heim/ho in NB + jeg/ikke/bare/noen/hjem in NN all pass expected:[]; Pitfall-5 anti-leakage: komer still flags; check-fixtures 280/280 |
| SC-04 | 04-02, 04-03 | Code-switching tolerance via density heuristic | ✓ SATISFIED | nb-codeswitch.js ships (102 lines, WINDOW_SIZE=5, UNKNOWN_THRESHOLD=3, MIN_TOKENS=8); codeswitch.jsonl × 2 langs, 13 cases each, all pass; at-most-1-flag-per-paragraph criterion met; NOTE: German capitalized-noun cases are below density threshold (isLikelyProperNoun exclusion) — documented in fixture header, ROADMAP SC criterion satisfied by English coverage ("English or German" disjunction) |
| SC-05 | 04-03 | Særskriving P/R thresholds locked and gated | ✓ SATISFIED | THRESHOLDS = {P:0.92, R:0.95} both languages in check-fixtures.js; observed at lock time P=0.974/0.968 → locked at observed-0.05; check-fixtures exits 0 with P=1.000 R=1.000 on expanded 55 NB / 46 NN saerskriving corpus |

**REQUIREMENTS.md traceability table status note:** SC-03 is still marked "In Progress" and SC-05 is still "Pending" in REQUIREMENTS.md — the 04-03-SUMMARY explicitly notes this was intentional (the plan did not preemptively call `gsd-tools requirements mark-complete`; that is the verifier's job). The implementation evidence above satisfies both. The REQUIREMENTS.md traceability table needs updating to mark SC-03 and SC-05 complete.

---

## Release Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Fixture suite | `npm run check-fixtures` | PASS — 280/280 cases across 12 files (nb × 6 + nn × 6). All per-rule P/R = 1.000. THRESHOLDS gate for saerskriving passes with 0.08 P-margin and 0.05 R-margin. |
| Network silence | `npm run check-network-silence` | PASS — No `fetch(`, `XMLHttpRequest`, `sendBeacon`, or `http(s)://` URL literals in spell-check or word-prediction surface. SC-06 confirmed. |
| Bundle size | `npm run check-bundle-size` | PASS — 10.13 MiB / 20.00 MiB cap; 9.87 MiB headroom. Per-directory breakdown shows data/ (20.85 MiB uncompressed, minified to 10.13 MiB zip). |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None detected | — | — | — |

No TODO/FIXME/placeholder comments or empty implementations found in the modified files. nb-codeswitch.js (102 lines) and nb-propernoun-guard.js (153 lines) are substantive. All three rule opt-ins are single-line guards, not stubs.

---

## Human Verification Required

### 1. Live Chrome Smoke Test: 500-Word NB Article in `<textarea>`

**Test:** Load the unpacked extension in Chrome. Navigate to any page with a `<textarea>` (e.g., a plain HTML file or google.com's search box, or create a local test page). Paste the text from fixture `nb-clean-news-500w-001` (558 words, starts "Familien min bor i Oslo..."). Confirm zero red underlines appear on any word.

**Expected:** No spell-check findings. The article contains proper nouns (Oslo, Anna, Ola, Bjørn, Mia, Spania, Italia, Hellas, Lofoten), common NB vocabulary, and no real typos.

**Why human:** The ROADMAP success criterion #1 explicitly states "verified by manual inspection." More importantly, the fixture runner exercises the Node code path (vocab-seam-core.js called directly with buildIndexes). The browser runtime goes through `vocab-seam.js:loadRawSister` → `chrome.runtime.getURL` → `fetch` → `core.buildIndexes({sisterRaw})` → `VOCAB.getSisterValidWords()`. A load-order bug in the manifest or a silent failure in `loadRawSister` (e.g., the fetch returns non-ok silently) would cause `sisterValidWords` to be an empty Set in the browser runtime while staying populated in the fixture runner. The SC-03 adapter-contract guard in check-fixtures.js only catches a structural regression (the field is dropped from the adapter literal), not a runtime data failure (the field is present but the Set is empty because the fetch silently failed). The smoke test is the only way to confirm the browser wiring is live end-to-end.

**Optionally also test:**
- Type `Jeg har en smoothie til frokost` — expect zero underlines (loan-word guard SC-02).
- Type `NATO beslutter i dag` — expect zero underlines (all-caps layer SC-02).
- Type `Hun heter Anne Grethe` — expect zero underlines (consecutive-cap layer SC-02).
- Type `Jeg har ikkje tid til det` — expect zero underlines (SC-03 NB tolerates NN word).
- Type `Jeg komer nå` — expect underline on `komer` (typo still flags — Pitfall-5 guard).

---

## Overall Assessment

The Phase 04 implementation is complete and structurally sound at every verifiable level:

- All four rule-architecture artifacts (vocab-seam rail, ctx.suppressed convention, two new pre-pass rules, three opt-in edits) exist and are wired.
- All three release gates exit 0: `check-fixtures` 280/280, `check-network-silence` PASS, `check-bundle-size` 10.13 MiB under 20 MiB cap.
- The saerskriving threshold gate (SC-05) is live with a defence-in-depth probe documenting load-bearing behaviour.
- REQUIREMENTS.md still shows SC-03 "In Progress" and SC-05 "Pending" — both are satisfied by implementation evidence; the traceability table should be updated to "Complete" for SC-03 and SC-05 at phase close.

The single unverified item is the ROADMAP's own requirement for "manual inspection" of the 500-word paste in a `<textarea>`. Fixture evidence is strong (558-word case passes 19/19 in the Node runner), but the Chrome smoke test is architecturally non-substitutable because it exercises the `loadRawSister` fetch path that the Node runner bypasses.

**Recommendation:** Route to `human_needed`. Once the Chrome smoke test passes, all four Phase 4 success criteria are closed and SC-02/03/04/05 can be marked Complete in REQUIREMENTS.md.

---

*Verified: 2026-04-20T14:30:00Z*
*Verifier: Claude (gsd-verifier)*
