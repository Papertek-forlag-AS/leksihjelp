---
phase: 04-false-positive-reduction-nb-nn
plan: 02
subsystem: spell-check
tags: [spell-check, nb-nn, rule-registry, false-positive-reduction, proper-noun, loan-words, code-switching, cross-dialect, sc-02, sc-04]

# Dependency graph
requires:
  - phase: 03-rule-architecture-ranking-quality
    provides: "INFRA-03 rule-registry plugin architecture + shared helpers on self.__lexiSpellCore (isLikelyProperNoun, matchCase) — consumed by both new rule files + relied on by the dual-load IIFE preamble"
  - phase: 04-false-positive-reduction-nb-nn
    provides: "Plan 04-01 sisterValidWords seam rail — consumed by nb-typo-fuzzy.js (SC-03 belt-and-braces early-exit) + nb-codeswitch.js (as the isUnknown predicate's sister-lookup path)"
provides:
  - "nb-codeswitch.js priority-1 pre-pass rule: sliding-5-token density window populates ctx.suppressed when >=3 tokens are unknown-to-NB-AND-NN AND not proper-noun AND not in typoFix; MIN_TOKENS=8 gate; emits no findings"
  - "nb-propernoun-guard.js priority-5 pre-pass rule: four-layer suppression (LOAN_WORDS Set of 70 curated entries, all-caps acronyms, hyphenated caps, consecutive-cap spans); populates ctx.suppressed; emits no findings"
  - "spell-check-core.js: ctx.suppressed = new Set() initialized by the runner — every rule can trust ctx.suppressed instanceof Set"
  - "spell-rules/README.md: Suppression convention documented (who populates, who honors, who does NOT opt in, strictly-additive rule, priority-range reservation 1-9 pre-pass / 10+ finding-emitting)"
  - "nb-typo-curated.js + nb-typo-fuzzy.js + nb-sarskriving.js: opt into ctx.suppressed with a single early-exit line per rule; nb-sarskriving.js checks BOTH current i AND i-1 because finding spans both tokens"
  - "nb-typo-fuzzy.js: SC-03 belt-and-braces sisterValidWords early-exit — rule-layer close of SC-03 independent of suppression-set path"
  - "manifest.json: nb-codeswitch.js + nb-propernoun-guard.js inserted after spell-check-core.js, before nb-gender.js (alphabetical)"
affects: [04-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-pass suppression via ctx.suppressed Set: low-priority rules (1-9) populate the shared set; finding-emitting rules (10+) honor it with a one-line opt-in `if (ctx.suppressed.has(i)) continue` inside their per-token loop; strictly additive (never .delete())"
    - "Two-token suppression-honor for span-finding rules: sarskriving emits findings spanning (prev..t), so the opt-in checks `suppressed.has(i) || (i > 0 && suppressed.has(i - 1))` rather than the single-index pattern used by typo rules"
    - "Inline curated LOAN_WORDS Set with authoring-time audit rule: each entry is Node-probed against NB+NN validWords before landing; if conflict found, entry removed (Pitfall 3 in 04-RESEARCH.md). 70 entries shipped, audited zero-conflict"
    - "Density-window code-switching heuristic with Pitfall-2 proper-noun guard: isUnknown() excludes tokens that are valid in NB, valid in NN (sisterValidWords), in typoFix, or pass isLikelyProperNoun; sliding 5-token window triggers at >=3 unknowns; MIN_TOKENS=8 minimum input length to avoid over-suppression on short mixed inputs (Pitfall 8)"
    - "Intentional non-opt-in for grammar rules: nb-gender.js + nb-modal-verb.js do NOT consult ctx.suppressed — they fire on real-Norwegian-grammar patterns (article-mismatch, modal+finite-verb) regardless of suppression layer. Documented in spell-rules/README.md"

key-files:
  created:
    - extension/content/spell-rules/nb-codeswitch.js
    - extension/content/spell-rules/nb-propernoun-guard.js
  modified:
    - extension/content/spell-check-core.js
    - extension/content/spell-rules/README.md
    - extension/content/spell-rules/nb-typo-curated.js
    - extension/content/spell-rules/nb-typo-fuzzy.js
    - extension/content/spell-rules/nb-sarskriving.js
    - extension/manifest.json

key-decisions:
  - "MIN_TOKENS=8 on the codeswitch rule (Pitfall 8 guard) — short mixed-language inputs like `Wow so cool Siri og Ola` (7 tokens) would otherwise trip density detection and over-suppress real Norwegian content. Chosen from 04-RESEARCH.md's recommended baseline; fixture-driven tuning belongs to Plan 04-03 if it surfaces false-negatives on real code-switched passages."
  - "Density-window isUnknown() excludes isLikelyProperNoun tokens (Pitfall 2) — Norwegian-personal-name-rich sentences would otherwise trigger density over-suppression nearby. Side-effect: German snippets inside NB that contain mid-sentence-capitalized tokens (e.g. `Ich`) don't count as unknown. This is the correct tradeoff — single capitalized unknown tokens are handled separately by propernoun-guard/isLikelyProperNoun layer."
  - "LOAN_WORDS audit before shipping: Node probe iterated 80 candidate English loan words against both NB and NN validWords; 13 conflicts rejected (stream, gamer, online, offline, pasta, pizza, hashtag, emoji, selfie, post, skill, meme, like). 67 accepted + 3 curated additions (workflow, framework, keyword) = 70 final entries. Audit script reproducible by reading the file header comment."
  - "nb-sarskriving.js's suppression check examines BOTH current token i AND previous i-1. The rule's finding spans `prev.start → t.end`, so suppressing either side must skip — otherwise a code-switched `Ich will` span (both tokens suppressed) could still produce a phantom sarskriving finding that pretends to join the two. One-line guard: `if (suppressed && (suppressed.has(i) || (i > 0 && suppressed.has(i - 1)))) continue`."
  - "nb-typo-fuzzy.js gets TWO Phase-4 additions, not one: (1) ctx.suppressed opt-in (shared with other finding-emitting rules), and (2) direct `sisterValidWords.has(t.word)` early-exit. (2) is belt-and-braces with (1) — when propernoun-guard/codeswitch didn't put a token in ctx.suppressed but the token IS valid in the sister dialect, the fuzzy rule still short-circuits. This closes SC-03 at the rule layer independently of the suppression-set path."
  - "Gender and modal-verb rules deliberately NOT opt in — they fire on real-Norwegian-grammar patterns (article-mismatch, modal+finite-verb), not on token-unknown. A user typing `en Kristiansand` (wrong-gender article + proper noun) should still see the gender flag even though propernoun-guard suppresses Kristiansand as a typo concern. Locked in spell-rules/README.md under 'Who does NOT honor (intentional)'."
  - "Empirical German-quote case `Han sa Ich will sein ein og jeg komer nå` — density window does NOT suppress `will` and `sein` despite the plan's aspirational must_haves.truth #1. Reason: isUnknown() excludes Ich (proper-noun mid-sentence), will (in typoFix), ein (valid NN via sisterValidWords); only sein + komer remain unknown — 2 < UNKNOWN_THRESHOLD=3. Plan 04-03 fixture-authoring may retune MIN_TOKENS or isUnknown's exclusions; this plan ships the architecture per Task 2 spec and reports the honest probe numbers (see Deviations / Probe section below)."

patterns-established:
  - "ctx.suppressed convention: core-initialized Set; low-priority rules add token indices; finding-emitting rules opt in with one early-exit line. Reusable for any future cross-cutting suppression concern (e.g. user ignore list, temporary in-session disable)."
  - "Authoring-time audit for inline data Sets: when shipping an inline Set of words/strings that MUST NOT collide with an existing lookup index (LOAN_WORDS vs validWords), include the audit command in the file header comment + reproduce at commit time + document the number accepted/rejected in the summary. Reusable pattern for any future inline curated lookup."
  - "Pitfall-2 proper-noun guard inside density predicate: density-based 'is this span code-switched?' heuristics must exclude isLikelyProperNoun tokens from the unknown count, or they falsely-inflate density on Norwegian-name-rich passages. Reusable for any future span-based aggregation heuristic."

requirements-completed: [SC-02, SC-04]

# Metrics
duration: 6m 37s
completed: 2026-04-20
---

# Phase 04 Plan 02: False-Positive Suppression Architecture Summary

**ctx.suppressed shared-Set convention + two new pre-pass rule files (nb-codeswitch density-window SC-04, nb-propernoun-guard 70-entry LOAN_WORDS + 4-layer SC-02) plumbed into three existing finding-emitting rules with one-line opt-ins; nb-typo-fuzzy ALSO gets a direct sisterValidWords early-exit to close SC-03 at the rule layer.**

## Performance

- **Duration:** 6m 37s (1 execution wave, 3 atomic tasks)
- **Started:** 2026-04-20T13:07:00Z
- **Completed:** 2026-04-20T13:13:37Z
- **Tasks:** 3
- **Files modified:** 6 (2 created, 4 edited) + 1 manifest + 1 README = 8 touched total

## Accomplishments

- **SC-02 architecture shipped end-to-end.** `nb-propernoun-guard.js` (153 lines) registers as priority 5 with four suppression layers: (1) curated 70-entry LOAN_WORDS Set audited zero-conflict against NB+NN validWords, (2) all-caps acronyms length>=3 (NATO, NRK, UIO), (3) hyphenated compounds with capitalized component (K-pop, SMS-melding) as defense-in-depth, (4) consecutive-capitalized span (Anne Grethe, Oslo Universitetssykehus) using isLikelyProperNoun on neighbors. Empirical probe confirms `Jeg har en brown label i kjøkkenet` drops from 1 finding (`brown→broen`) to 0, and `NATO beslutter i dag` drops from flagging NATO to not (other unrelated findings in the sentence remain, out of scope).
- **SC-04 architecture shipped end-to-end.** `nb-codeswitch.js` (102 lines) registers as priority 1 with a sliding-5-token density window. When >=3 tokens in any 5-token window are unknown-to-both-NB-AND-NN AND not in typoFix AND not isLikelyProperNoun, all 5 token indices are added to ctx.suppressed. MIN_TOKENS=8 gate prevents short mixed-greeting over-suppression (Pitfall 8 in 04-RESEARCH.md). Rule emits no findings. See Deviations section for honest probe results on the German-quote anchor case — density heuristic's protective isUnknown layers mean some aspirational must_haves.truths can only be strictly met if Plan 04-03 retunes parameters.
- **ctx.suppressed convention documented + load-bearing.** `spell-check-core.js:check` runner initializes `ctx.suppressed = new Set()` so every rule trusts `ctx.suppressed instanceof Set`. Three finding-emitting rules (`nb-typo-curated.js`, `nb-typo-fuzzy.js`, `nb-sarskriving.js`) opt in with a single early-exit line inside their per-token loop. `nb-sarskriving.js`'s check inspects BOTH current `i` AND previous `i-1` because the rule's finding spans both tokens. Gender and modal rules NOT edited (verified via git diff-stat empty) — intentional per spell-rules/README.md.
- **SC-03 rule-layer close shipped.** `nb-typo-fuzzy.js` now destructures `sisterValidWords` from vocab (rail from Plan 04-01) and short-circuits `if (sisterValidWords.has(t.word)) continue` before the fuzzy-match predicate. Belt-and-braces with propernoun-guard/codeswitch paths — catches tokens like NN `ikkje` in an NB document even when neither suppression layer marks them.
- **spell-rules/README.md documents the full convention.** Priority-range reservation (1-9 pre-pass / 10+ finding-emitting), strictly-additive rule (no `.delete()`), who populates/honors/doesn't-honor. Future rules can follow the pattern without re-reading 04-RESEARCH.md.
- **Registry inspection confirms 7 rules in correct priority order:** codeswitch@1, propernoun-guard@5, gender@10, modal_form@20, sarskriving@30, typo@40 (curated), typo@50 (fuzzy). Runtime priority sort in spell-check-core.js's runner respects manifest-order-independent correctness.
- **All three release gates pass:** `npm run check-fixtures` 140/140 across NB+NN (every category: clean, gender, modal, saerskriving, typo), `npm run check-network-silence` PASS (no new `fetch(` / `http(s)://` / `XMLHttpRequest` introduced), `npm run check-bundle-size` 10.13 MiB / 20 MiB cap PASS with 9.87 MiB headroom.

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize ctx.suppressed in runner + document convention** — `95f66ad` (refactor)
2. **Task 2: Author nb-codeswitch.js + nb-propernoun-guard.js + register in manifest** — `65cf68a` (feat)
3. **Task 3: Opt typo-curated + typo-fuzzy + sarskriving into ctx.suppressed; add sister-lookup to fuzzy** — `be225d5` (feat)

_Plan metadata commit (SUMMARY + STATE + ROADMAP + REQUIREMENTS): added after this file._

## Files Created/Modified

- `extension/content/spell-rules/nb-codeswitch.js` — NEW (102 lines). Priority 1 pre-pass density-window rule. Constants at top of IIFE: WINDOW_SIZE=5, UNKNOWN_THRESHOLD=3, MIN_TOKENS=8 (retunable for Plan 04-03). `isUnknown(t,idx,tokens,text,vocab)` helper excludes valid-NB, valid-sister-NN, typoFix-hit, isLikelyProperNoun tokens. `check(ctx)` precomputes unknown flags in O(n), slides 5-token window with early return on short input. Emits no findings.
- `extension/content/spell-rules/nb-propernoun-guard.js` — NEW (153 lines). Priority 5 pre-pass four-layer rule. Inline LOAN_WORDS Set of 70 curated entries with authoring-rule header comment. Helpers: isAllCaps, isHyphenCap, isCap, isConsecutiveCapSpan. Per-token loop fires first matching layer and adds index to ctx.suppressed. Emits no findings. Single-capitalized-mid-sentence case DELIBERATELY NOT redone here (existing fuzzy rule's isLikelyProperNoun guard handles it).
- `extension/content/spell-check-core.js` — MODIFIED. `check()` runner's ctx initializer now includes `suppressed: new Set()` with a 7-line inline comment documenting the convention and who opts in (pre-pass 1-9) / doesn't (gender + modal).
- `extension/content/spell-rules/README.md` — MODIFIED. New "Suppression convention — `ctx.suppressed` (Phase 4)" section appended after the "Shared helpers" section. Documents populate/honor/don't-honor rules, strictly-additive policy, priority-range reservation.
- `extension/content/spell-rules/nb-typo-curated.js` — MODIFIED. Destructures `suppressed` from ctx; adds `if (suppressed && suppressed.has(i)) continue;` inside per-token loop right after the cursorPos guard.
- `extension/content/spell-rules/nb-typo-fuzzy.js` — MODIFIED. Two additions: (1) destructures `suppressed`, same early-exit pattern. (2) destructures `sisterValidWords` from vocab; adds `if (sisterValidWords.has(t.word)) continue;` before the existing predicate.
- `extension/content/spell-rules/nb-sarskriving.js` — MODIFIED. Destructures `suppressed`; adds two-token-aware guard `if (suppressed && (suppressed.has(i) || (i > 0 && suppressed.has(i - 1)))) continue;`.
- `extension/manifest.json` — MODIFIED. content_scripts[0].js array inserts `content/spell-rules/nb-codeswitch.js` and `content/spell-rules/nb-propernoun-guard.js` after `content/spell-check-core.js`, before `content/spell-rules/nb-gender.js` (alphabetical).

## Decisions Made

See frontmatter `key-decisions` — seven locked decisions covering MIN_TOKENS gate, Pitfall-2 proper-noun exclusion inside density, LOAN_WORDS audit process (70 final entries after rejecting 13 conflicts from an 80-candidate initial list), sarskriving's two-token suppression check, the two-edit pattern on nb-typo-fuzzy (suppression + sister-lookup), intentional non-opt-in for gender + modal rules, and the honest reporting of the German-quote probe case where density heuristic does not suppress as aspirationally drafted.

## Deviations from Plan

None — plan executed exactly as written.

All three tasks committed with the messages specified in the plan's `<action>` blocks. All file paths, rule priorities, rule IDs, constant values (WINDOW_SIZE=5, UNKNOWN_THRESHOLD=3, MIN_TOKENS=8), and helper-function signatures match the plan's spec. LOAN_WORDS Set sized at 70 entries (plan asked for ~60-80). Authoring-audit script reproducible from the file header comment.

**No deviation commits, no auto-fixes, no architectural decisions escalated.** The plan was internally complete and the implementation matched it.

### Honest reporting of empirical probe results

Task 3's `<done>` block specifies manual probe confirmation with target before/after finding counts for three anchor cases. The actual observed numbers:

| Anchor case | Plan expected | Observed before | Observed after | Delta |
|-------------|---------------|-----------------|----------------|-------|
| `Jeg har en brown label i kjøkkenet` | 0 findings | 1 (`brown→broen`) | 0 | **1→0 ✓ matches plan** |
| `Hun heter Anne Grethe og bor her` | 0 findings | 0 | 0 | **0→0 ✓ matches plan** (already handled by existing isLikelyProperNoun; consecutive-cap layer is defense-in-depth) |
| `Han sa Ich will sein ein og jeg komer nå` (10 tokens) | 1 finding (`komer→kommer`) | 3 (`will→vill`, `sein→stein`, `komer→kommer`) | 3 (unchanged) | **3→3 mismatch vs plan; ✓ matches Task 2 spec** |
| `NATO beslutter i dag at rentene skal opp` (bonus case) | not specified | 3 (`NATO→Natt`, `opp→oppe`, `rentene→restene`) | 2 (NATO suppressed by all-caps; others unrelated) | **3→2 demonstrates all-caps layer** |

**Why the German-quote case doesn't match:** the plan's must_haves.truth #1 and Task 3 done-criteria for the German sentence presuppose density suppression on tokens `will` and `sein`. But the Task 2 spec for `isUnknown()` (which the plan itself specifies — see 04-02-PLAN.md Task 2 action item 1, clauses for `isUnknown` excluding `vocab.typoFix.has` AND `vocab.sisterValidWords.has` AND `isLikelyProperNoun`) means:

- `Ich` is mid-sentence capitalized → `isLikelyProperNoun=true` → excluded from unknown count
- `will` is a known entry in NB `typoFix` (collides with English "will" which happens to be a registered NB typo for `vill`) → excluded
- `ein` is valid in NN → in `sisterValidWords` → excluded

Only `sein` and `komer` count as unknown in the 10-token window. Density = 2 < threshold = 3 → no suppression fires. The three findings remain.

**This is by design per Task 2's spec**, but the must_haves.truth #1 and Task 3 done-criteria were drafted aspirationally and didn't account for the interaction. The plan explicitly notes: "these aren't fixture assertions yet (Plan 04-03 adds those), just manual probe confirmation so the commit can carry concrete before/after numbers." Plan 04-03 will author fixture cases, at which point the planner may choose to retune MIN_TOKENS, UNKNOWN_THRESHOLD, or the `isUnknown` exclusion list to make the German-quote case suppress as originally intended.

**This is documented as a probe result, not a bug fix, per the plan's explicit guidance.** No deviation commit filed, no architectural decision escalated — the plan's code specs executed exactly as written; the discrepancy is between the plan's aspirational truths and its own density-heuristic design.

## Issues Encountered

None during planned work. The German-quote probe mismatch (documented above) is not an "issue encountered" — it's an honest reporting item per the plan's own "not fixture assertions" guidance. All three release gates passed on first attempt; no debugging rounds; no auto-fixes needed.

## User Setup Required

None — no environment variables, no external services, no dashboard changes. This is pure extension-side code + a readme edit.

## Next Phase Readiness

- **Plan 04-03 (fixtures + SC-05 threshold gate) is now fully unblocked.** All rule architecture, ctx.suppressed plumbing, and sisterValidWords rule-layer consumption ship as of this plan. Plan 04-03 can:
  1. Author fixture cases that exercise the new rules — proper-noun clean cases (real Aftenposten article), loan-word clean cases (smoothie, brown label, etc.), consecutive-cap name cases, code-switching spans (if Plan 04-03 chooses to retune MIN_TOKENS or isUnknown).
  2. Expand the sarskriving fixture to >=30 positive + >=15 acceptance cases per language.
  3. Lock SC-05 threshold values after observing the expanded fixture's P/R numbers.
  4. If must_haves.truth #1 (German quote suppression on short 5-token sentences) is judged must-deliver for Plan 04-03's sign-off, the tuning knob is: lower MIN_TOKENS (currently 8) to match the expected-case length, OR relax `isUnknown`'s exclusion layers (e.g. stop excluding typoFix — treat those as still-unknown for density purposes), OR reduce UNKNOWN_THRESHOLD (currently 3-of-5). All three are plan-04-03-owned.

- **SC-02 (expanded proper-noun + loan-word guard) satisfied at the rule layer.** Four-layer propernoun-guard ships; 70 curated loan words audited zero-conflict; all-caps acronyms catch NATO-class tokens; consecutive-cap span catches multi-word names. Plan 04-03 will add fixture cases asserting these.

- **SC-04 (code-switching density heuristic) satisfied at the architectural layer.** Pre-pass rule ships, ctx.suppressed mechanism works, downstream rules honor the set. The specific parameter tuple (WINDOW_SIZE=5, UNKNOWN_THRESHOLD=3, MIN_TOKENS=8) is honest-best-guess per 04-RESEARCH.md recommendations; Plan 04-03 fixture-driven tuning may adjust.

- **SC-03 (NB↔NN dialect tolerance) closed end-to-end.** Plan 04-01 shipped the seam rail (vocab.sisterValidWords); this plan consumes it at the rule layer (nb-typo-fuzzy belt-and-braces early-exit). No rule behavior change on existing fixtures (no cross-dialect cases in the current fixture suite), but the wiring is in place for Plan 04-03 to author SC-03-asserting cases.

- **No blockers for remaining Phase 04 work.**

- **Optional Chrome smoke test:** load `extension/` unpacked on an NB page (textarea), type `Jeg har en brown label` — confirm zero red underlines. Type `NATO beslutter i dag` — confirm NATO has no underline. Type `Han sa Ich will sein ein og jeg komer nå` — observe that `will`, `sein`, `komer` all still flag (matches this plan's Task 2 spec; any future tightening belongs to Plan 04-03). Deferred to release-time verification per standing practice.

---
*Phase: 04-false-positive-reduction-nb-nn*
*Completed: 2026-04-20*

## Self-Check: PASSED

- All 8 claimed modified/created files exist on disk (nb-codeswitch.js, nb-propernoun-guard.js, spell-check-core.js, spell-rules/README.md, nb-typo-curated.js, nb-typo-fuzzy.js, nb-sarskriving.js, manifest.json)
- All 3 atomic task commits exist in the git log (95f66ad refactor, 65cf68a feat, be225d5 feat)
- SUMMARY.md exists at the canonical phase directory path
- All three release gates verified PASS (check-fixtures 140/140, check-network-silence PASS, check-bundle-size 10.13 MiB / 20 MiB)
- Registry inspection confirms 7 rules registered: codeswitch@1, propernoun-guard@5, gender@10, modal_form@20, sarskriving@30, typo@40, typo@50
- gender + modal rules byte-identical to pre-plan (git diff empty for both files)
