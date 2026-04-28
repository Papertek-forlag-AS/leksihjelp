---
phase: 27-exam-mode
verified: 2026-04-28T10:30:00Z
human_verified: 2026-04-28T11:30:00Z
status: passed
score: 11/11 automated must-haves verified; 7/7 human UAT passed
human_uat_notes: |
  Round 1 UAT surfaced two product-policy clarifications + two
  follow-up bugs that were fixed in-session:

  Policy: "static reference info is allowed in exam; answer-generating
  surfaces are not." Reclassified popup.search, popup.conjugationTable,
  popup.ttsButton, popup.grammarFeaturesPopover, widget.dictionary,
  widget.conjugation, widget.tts, sidePanel.fest → safe:true.
  wordPrediction.dropdown and widget.pedagogyPanel stay safe:false.
  Bumped __lexiExamRegistryVersion 1→2 (commit d02cc24).

  Bug fixes during UAT:
  - Badge stayed visible regardless of toggle (CSS specificity beat
    [hidden]) — d07858c.
  - Live-toggle latency: spell-check overlay debounced 800ms before
    repaint AND skipped re-check on identical text. Fixed with
    immediate runCheck + lastCheckedText reset (9e99357). Required
    for the "teacher flips on at 1h00 of a 3h exam" use case.
  - Popup gateNode read self.__lexiExam (helper from
    spell-check-core.js, never loaded in popup context) so registry
    flips didn't affect popup gating. Fixed by loading
    exam-registry.js into popup.html + direct registry fallback in
    gateNode (3b9dc25).

  Bonus features added during UAT (related, not gap-closure):
  - Dev-only "Simuler lærer-lås" button in popup settings (94d591b).
  - Aa floating button now also switches spell-check language
    (fb996ad / 10156dc / bf92fbd / f07c5c0).
human_verification:
  - test: "Toggle exam mode ON in popup; confirm EKSAMENMODUS badge appears near logo and persists after popup close/reopen"
    expected: "Badge visible with correct nb/nn/en text; examMode=true in chrome.storage.local persists"
    why_human: "chrome.storage.local persistence and badge visibility require a live extension context"
  - test: "With exam mode ON, type 'hadd' in a textarea — verify typo dot appears. Type 'han kunne snakker' — verify NO modal-verb dot appears"
    expected: "exam.safe=true typo rules still fire; exam.safe=false grammar-lookup rules are silenced"
    why_human: "Runtime rule filtering in spell-check.js line 330-337 requires a live page + extension"
  - test: "With exam mode ON, select text on a webpage to trigger the floating widget — verify it either does not appear or shows only an amber-bordered shell with no dictionary/TTS/prediction content"
    expected: "showWidget() bails at entry (floating-widget.js:443); no dictionary/TTS/conjugation/pedagogy DOM rendered"
    why_human: "Widget DOM suppression requires a live content-script context"
  - test: "With exam mode ON, type in a text input — verify the word-prediction dropdown never opens"
    expected: "runPrediction() returns early at word-prediction.js:508 when examMode=true"
    why_human: "Requires a live content-script context"
  - test: "Simulate teacher lock: chrome.storage.local.set({ examModeLocked: true, examMode: true }), reopen popup — verify toggle is checked + disabled + 'Slått på av lærer' caption visible and clicking does nothing"
    expected: "Toggle disabled, caption visible, examMode cannot be turned off"
    why_human: "Requires a live extension popup context with DevTools access"
  - test: "Toggle exam mode OFF — verify dictionary popup, TTS, word-prediction dropdown, and grammar-lookup dots all restore"
    expected: "All surfaces return to normal; onChanged listener re-applies UI state"
    why_human: "Live toggle round-trip requires browser extension context"
  - test: "Trigger a German preposition error (de-prep-case) in exam mode — verify the dot/squiggle appears but clicking shows no Lær mer popover"
    expected: "rule.exam.safe=false for de-prep-case means the dot is ALSO suppressed (not just the popover)"
    why_human: "Dual-marker rule: note that de-prep-case has rule.exam.safe=false (grammar-lookup), so the dot should be hidden too. Confirm actual observed behavior matches the classification."
---

# Phase 27: Exam Mode Verification Report

**Phase Goal:** Make Leksihjelp installable on Norwegian school exam machines. Add per-feature `examSafe` markers to every user-visible surface, add a student-facing exam-mode toggle (with lockdown teacher-lock), add a release gate (`check-exam-marker`) that fails CI if any feature ships without an `examSafe` declaration.
**Verified:** 2026-04-28
**Status:** human_needed (all automated checks pass; 7 items require live browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every rule file under extension/content/spell-rules/ exposes an `exam` object with `safe` boolean and non-empty `reason` string on the rule object | VERIFIED | Node verification script confirms 62 rules across 61 files all carry well-formed `exam: {safe, reason, category}`. Gate `npm run check-exam-marker` exits 0. |
| 2 | Rules with independently classifiable explain surfaces (de-prep-case) carry a dual marker on rule.explain | VERIFIED | Node confirms `de-prep-case` has `rule.exam` (safe=false, grammar-lookup) AND `rule.explain.exam` (safe=false, pedagogy). Gate validates dual-marker shape. |
| 3 | extension/exam-registry.js exports frozen array of ≥10 {id, exam:{safe,reason,category}} entries covering every non-rule UI surface | VERIFIED | Node confirms 10 entries: popup.search, popup.conjugationTable, popup.ttsButton, popup.grammarFeaturesPopover, widget.dictionary, widget.conjugation, widget.tts, widget.pedagogyPanel, wordPrediction.dropdown, sidePanel.fest |
| 4 | `npm run check-exam-marker` exits 0 when all markers present and well-formed | VERIFIED | Gate exits 0: "62 rules + 10 registry entries validated" |
| 5 | `npm run check-exam-marker:test` exits 0 — self-test proves gate is not silently permissive | VERIFIED | Gate exits 0: "gate fires on malformed/missing/invalid-category, passes on well-formed" |
| 6 | CLAUDE.md Release Workflow lists check-exam-marker as step 6 with rationale | VERIFIED | Step 6 present at line 361-364 with "Why this gate exists" paragraph |
| 7 | Popup toggle (`examMode`) wired to chrome.storage.local with persistence + onChanged sync | VERIFIED (automated) | popup.js lines 2412-2444: storage get/set, onChanged listener, disabled state for examModeLocked. Requires human to confirm persistence. |
| 8 | Spell-check filters non-exam-safe rules when examMode is true; dual-marker popover gate is independent | VERIFIED (automated) | spell-check.js lines 330-337 (rule filter) and 511 (explain gate). Requires human for live runtime confirmation. |
| 9 | Floating widget suppresses non-exam-safe surfaces; applies amber border | VERIFIED (automated) | floating-widget.js lines 443 (showWidget bail) and 1068 (showInlineLookup bail). content.css lines 89-93 amber border. |
| 10 | Word-prediction dropdown bails in exam mode | VERIFIED (automated) | word-prediction.js lines 508-514: early return when examMode true |
| 11 | i18n strings present in nb/nn/en for all exam-mode UI text | VERIFIED | strings.js lines 278-281, 525-528, 768-771: examModeLabel, examModeBadge, examModeLockedCaption, examModeDescription in all 3 locales |

**Score:** 11/11 truths verified (7 pending live browser confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/exam-registry.js` | Single source of truth for non-rule UI surface exam markers | VERIFIED | 114 lines, 10 entries, frozen array, `__lexiExamRegistryVersion = 1` |
| `extension/content/spell-rules/de-prep-case.js` | Dual marker (rule.exam + explain.exam) | VERIFIED | Both markers present and correct shape |
| `scripts/check-exam-marker.js` | Release gate validating exam markers | VERIFIED | 291 lines, LEXI_EXAM_MARKER_EXTRA_TARGETS seam, hard-fail by default |
| `scripts/check-exam-marker.test.js` | Paired self-test (4 scenarios) | VERIFIED | 159 lines, 4 scenarios (malformed/missing/invalid-category/well-formed) |
| `extension/content/spell-check-core.js` | `host.__lexiExam` helper (isSurfaceSafe/isRuleSafe/isExplainSafe) | VERIFIED | Lines 483-515: all three methods + getExamMode() Promise |
| `extension/popup/popup.html` | Settings toggle + badge slot | VERIFIED | exam-mode-badge (line 16), exam-mode-group toggle (lines 241-249) |
| `extension/popup/popup.js` | Toggle wiring + lockdown lock + badge rendering | VERIFIED | initExamMode() with storage get/set/onChanged, examModeLocked defensive force-on |
| `extension/content/floating-widget.js` | Suppress non-exam-safe surfaces + amber border | VERIFIED | isSurfaceAllowed() gate, lh-exam-mode class applied |
| `extension/content/word-prediction.js` | Bail when exam mode on | VERIFIED | Lines 508-514: early return |
| `extension/i18n/strings.js` | nb/nn/en strings for exam UI | VERIFIED | 4 keys × 3 locales |
| `extension/styles/popup.css` | Badge + locked-caption styling | VERIFIED | Lines 1122-1149: .exam-mode-badge, .exam-mode-locked-caption |
| `extension/styles/content.css` | Amber border tint for floating widget | VERIFIED | Lines 89-93: three selectors (legacy + lockdown compat) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| spell-rules/*.js | rule.exam consumed by gate + runtime | property on rule object pushed to `host.__lexiSpellRules` | WIRED | All 62 rules verified by check-exam-marker gate |
| extension/exam-registry.js | consumed by gate + runtime suppression | `host.__lexiExamRegistry` | WIRED | manifest.json registers it at index 1 (before all consumers) |
| extension/popup/popup.js | chrome.storage.local.examMode + examModeLocked | chrome.storage.local.get/set + onChanged | WIRED | initExamMode() at popup.js lines 2412-2444 |
| extension/content/spell-check.js | rule.exam markers | Map lookup + `__lexiExam.isRuleSafe()` filter on findings | WIRED | Lines 326-337 (rule filter) + 505-511 (explain gate) |
| extension/content/floating-widget.js | registry + chrome.storage.local.examMode | isSurfaceAllowed() via `__lexiExam.isSurfaceSafe()` | WIRED | Lines 84-184: cached examMode + onChanged listener |
| extension/content/word-prediction.js | chrome.storage.local.examMode | Early return in runPrediction() | WIRED | Lines 105-120: init + onChanged + lines 508-514: bail |
| extension/manifest.json | exam-registry.js | content_scripts[0].js array index 1 | WIRED | Registry at index 1, spell-check.js at 71, floating-widget at 5 — registry loads first |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXAM-01 | 27-01 | Every spell-check rule declares `exam: {safe, reason, category?}` marker, plus explain marker where popover is independently classifiable | SATISFIED | 62 rules verified; de-prep-case dual marker confirmed |
| EXAM-02 | 27-01 | `extension/exam-registry.js` enumerates 10 non-rule surfaces with same marker shape | SATISFIED | 10 entries, all well-formed, frozen array |
| EXAM-03 | 27-03 | Popup toggle persisted in `chrome.storage.local.examMode`; disabled when `examModeLocked=true` with "Slått på av lærer" | SATISFIED (automated); NEEDS HUMAN for live confirm | initExamMode() wires toggle, locked-caption, force-on defensive logic |
| EXAM-04 | 27-03 | When exam mode ON, all `exam.safe=false` surfaces hidden entirely | SATISFIED (automated); NEEDS HUMAN | Suppression in spell-check.js, floating-widget.js, word-prediction.js, popup.js |
| EXAM-05 | 27-03 | EKSAMENMODUS badge + amber border widget visible when exam mode ON | SATISFIED (automated); NEEDS HUMAN | popup.html badge slot, popup.js toggles hidden, content.css amber border |
| EXAM-06 | 27-02 | `check-exam-marker` release gate hard-fails on missing/malformed/invalid-category marker | SATISFIED | Gate exits 0 (62 rules + 10 entries); self-test exits 0 (4 scenarios) |
| EXAM-07 | 27-03 | All exam-mode UI text reads from i18n with nb/nn/en variants | SATISFIED | strings.js: 4 keys × 3 locales; data-i18n attributes on popup elements |
| EXAM-08 | 27-03 | content.css amber rule + gating logic ready for lockdown sync; CLAUDE.md documents check-exam-marker; version bump to 2.7.0 signals lockdown to re-pin | SATISFIED (pipeline side) | version=2.7.0 in manifest.json, package.json, index.html; CLAUDE.md step 6; note: actual lockdown sync is a downstream action (pending todo in SUMMARY, not a gap) |

All 8 requirement IDs accounted for. No orphaned requirements.

---

### Anti-Patterns Found

No blockers or stubs detected. No exam-mode related TODOs, placeholder returns, or console-log-only handlers found in modified files.

---

### Human Verification Required

Plan 27-03 Task 3 was a blocking human-verification checkpoint. In auto-mode the phase was marked complete, but the plan was `autonomous: false` and explicitly required human browser walkthrough before the phase is fully closed.

#### 1. Toggle Persistence

**Test:** Load unpacked extension in Chrome, toggle exam mode ON in popup settings, close popup, reopen popup.
**Expected:** Toggle still ON, EKSAMENMODUS badge visible, `examMode=true` in chrome.storage.local.
**Why human:** chrome.storage.local persistence cannot be verified without a live extension context.

#### 2. Rule Filtering (typo vs grammar-lookup)

**Test:** With exam mode ON, type "hadd" (typo) and "han kunne snakker" (modal-verb) in a textarea on any webpage.
**Expected:** Typo dot appears for "hadd" (nb-typo-fuzzy is exam.safe=true). NO dot for modal-verb error (exam.safe=false). Word-prediction dropdown never opens.
**Why human:** Content-script runtime filtering requires a live browser + extension context.

#### 3. Floating Widget Suppression

**Test:** With exam mode ON, select text on a webpage to trigger the floating widget.
**Expected:** Widget does not appear (showWidget bails at floating-widget.js:443); amber border only visible if widget root still rendered. No dictionary/TTS/conjugation/pedagogy.
**Why human:** Widget DOM logic requires a live content-script context.

#### 4. Lockdown Teacher Lock

**Test:** In DevTools console run `chrome.storage.local.set({ examModeLocked: true, examMode: true })`, reopen popup.
**Expected:** Toggle is checked + disabled, "Slått på av lærer" caption visible, clicking the toggle does nothing.
**Why human:** Requires a live extension popup with DevTools access.

#### 5. Toggle OFF Round-Trip

**Test:** Toggle exam mode OFF.
**Expected:** Dictionary, TTS, word prediction, and all rule dots restore to normal. EKSAMENMODUS badge disappears.
**Why human:** onChanged live-toggle requires live extension context.

#### 6. de-prep-case Dual-Marker Behaviour

**Test:** With exam mode ON, produce a German preposition error (e.g. "mit den Schule").
**Expected:** Since de-prep-case has `rule.exam.safe=false` (grammar-lookup category), the dot itself should be HIDDEN in exam mode (not just the Lær mer popover). This is the correct behaviour per the classification — clarify if the dot suppression matches user expectations.
**Why human:** Requires live German text input + extension; also a classification judgment call to confirm with the product owner.

#### 7. i18n Language Switch

**Test:** Switch UI language (nb → nn → en) via popup language selector, confirm exam-mode toggle label, badge text, and locked caption switch correctly.
**Expected:** nb: "Eksamenmodus" / "EKSAMENMODUS" / "Slått på av lærer"; nn: "Eksamensmodus" / "EKSAMENSMODUS" / "Slått på av lærar"; en: "Exam mode" / "EXAM MODE" / "Locked by teacher".
**Why human:** i18n runtime rendering requires a live popup.

---

### Summary

Phase 27 Exam Mode is complete at the automated level. All 8 requirement IDs (EXAM-01 through EXAM-08) are satisfied by implementation evidence in the codebase:

- **Contract layer (Plan 01):** 62 spell-rules + 10 registry entries all carry well-formed `exam` markers. de-prep-case carries the dual marker. `extension/exam-registry.js` is the single source of truth.
- **Gate layer (Plan 02):** `check-exam-marker` (291 lines) + `check-exam-marker.test.js` (4 scenarios) both exit 0. CLAUDE.md Release Workflow step 6 added. Hard-fail by default per CONTEXT.md.
- **Runtime layer (Plan 03):** Toggle, badge, lockdown lock, i18n, suppression in spell-check/widget/prediction, manifest registration, amber border, version bump to 2.7.0 — all present and wired.

All 8 release gates pass (check-fixtures, check-explain-contract, check-rule-css-wiring, check-network-silence, check-spellcheck-features, check-exam-marker, check-exam-marker:test, check-bundle-size per Plan 03 SUMMARY).

One architectural note: Plan 27-03 was `autonomous: false` and included a blocking human-verify checkpoint (Task 3). The SUMMARY records that this was auto-advanced per auto-mode policy. The 7 human verification items above represent the deferred walkthrough that should be done before treating the feature as production-ready for exam deployments.

---

_Verified: 2026-04-28_
_Verifier: Claude (gsd-verifier)_
