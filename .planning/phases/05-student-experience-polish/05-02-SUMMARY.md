---
phase: 05-student-experience-polish
plan: 02
subsystem: spell-check
tags: [spell-rules, ux-01, ux-02, explain-contract, xss, top-k-suggestions, priority-disambiguation, zipf-tiebreaker]

# Dependency graph
requires:
  - phase: 05-student-experience-polish
    provides: "Plan 05-01 — escapeHtml exported on __lexiSpellCore, check-explain-contract gate + self-test, COPY-REVIEW.md scaffold, spell-rules/README.md contract docs"
  - phase: 03-rule-architecture-ranking-quality
    provides: "Plan 03-02 INFRA-03 — self-registering IIFE rule files with matchCase/escapeHtml helpers on __lexiSpellCore"
  - phase: 03-rule-architecture-ranking-quality
    provides: "Plan 03-03 — local scoreCandidate + Zipf tiebreaker in nb-typo-fuzzy.js (preserved byte-for-byte)"
provides:
  - "5 popover-surfacing rules upgraded to explain: (finding) => ({nb, nn}) callable contract with XSS-safe <em>-wrapped student-word templates (UX-01)"
  - "Every finding now carries priority: <rule.priority> — Pitfall-1 renderer disambiguation for shared rule_id='typo' between curated (priority 40) + fuzzy (priority 50)"
  - "nb-typo-fuzzy.js findFuzzyNeighbor → findFuzzyNeighbors (plural) — returns top-K (cap 8) scored-sorted list; rule emits finding.suggestions: string[] with fix === suggestions[0] back-compat invariant (UX-02 data source)"
  - "nb-sarskriving.js explain has defensive fallback path for missing finding.original or finding.fix — returns plain nb/nn strings without interpolation"
  - "check-explain-contract gate flips exit 1 → exit 0 (5/5 popover-surfacing rules satisfy callable {nb, nn} contract)"
  - "COPY-REVIEW.md cells populated with shipped NB + NN templates for all 5 popover-surfacing rules (ready for Plan 05-03 phase-close dyslexia-persona proxy review)"
  - "COPY-REVIEW.md Probe log — evidence that priority/suggestions flow through core runner dedupe AND that Zipf tiebreaker stays load-bearing post top-K refactor"
affects: [05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Callable explain contract: (finding) => ({nb, nn}) — per-register NB/NN templates with escapeHtml on every interpolated token (UX-01)"
    - "Defensive fallback inside explain callable: if finding.original or finding.fix missing, return bare-concept strings without <em> wrappers (sarskriving)"
    - "Top-K suggestion emit: rule emits finding.suggestions: string[] cap 8, fix === suggestions[0] preserves fixture-harness + curated-rule contract (UX-02)"
    - "priority field on emitted findings: out.push({..., priority: rule.priority}) — mirror of the rule's declared priority, lets renderer disambiguate shared rule_id='typo' between curated + fuzzy (Pitfall 1)"
    - "Mutate-and-restore probe pattern extended: ZIPF_MULT=0 mutation confirms Zipf tiebreaker is load-bearing for the top-K refactor (mirrors Plan 03-03's load-bearing-test pattern)"

key-files:
  created:
    - ".planning/phases/05-student-experience-polish/05-02-SUMMARY.md"
  modified:
    - "extension/content/spell-rules/nb-gender.js"
    - "extension/content/spell-rules/nb-modal-verb.js"
    - "extension/content/spell-rules/nb-typo-curated.js"
    - "extension/content/spell-rules/nb-typo-fuzzy.js"
    - "extension/content/spell-rules/nb-sarskriving.js"
    - ".planning/phases/05-student-experience-polish/COPY-REVIEW.md"

key-decisions:
  - "Exact copy templates chosen from the plan's interfaces block verbatim — no deviations to wording. Voice split: 2 assertive (typo-curated 'er en vanlig skrivefeil'; modal-verb 'Etter modalverb skal hovedverbet stå i infinitiv') + 3 hedged ('kan være feil kjønn', 'står ikke i ordboken — kanskje du mente…?', 'kan være to ord som hører sammen…'). Matches CONTEXT.md voice/shape guidance + Pitfall 8 hedging alignment."
  - "priority: rule.priority on every emit block — Plan 03's renderer needs this for Pitfall-1 curated-vs-fuzzy disambiguation since both carry rule_id='typo'. Closure captures the const rule object; no hoisting or self-reference issues."
  - "Top-K cap of 8 matches the UX-02 'Vis flere alternativer' reveal max. Scored-sort-slice pattern guarantees suggestions[0] equals the old single-best return of findFuzzyNeighbor — every current fixture's winner stays at index 0 (280/280 preserved). Pitfall 7 defence-in-depth verified via ZIPF_MULT mutation probe."
  - "Defensive fallback inside sarskriving.explain triggered ONLY when finding.original or finding.fix is missing — returns bare 'To ord som kanskje hører sammen.' (nb) / '…høyrer saman.' (nn) strings without <em>. Production findings will always have both fields per the rule's emit block; the fallback is belt-and-braces against future test/probe calls that construct partial findings."
  - "Plan's Task-2 `suggestions,?\\s*$` regex verify didn't match our actual source line (trailing comment after `suggestions,`). Loosened the check to '^\\s*suggestions,' — semantically equivalent assertion (confirms suggestions is emitted as an object-shorthand key). Source is correct; regex was the bug."

patterns-established:
  - "Callable-explain-with-fallback pattern: rules whose finding fields are conditionally populated (sarskriving-style) ship an explain callable that tests for the required fields and returns a bare-concept fallback copy when they're missing — keeps the contract exit 0 under probe-driven partial finding construction without losing copy quality for real emits."
  - "Top-K scored-sort-slice refactor-with-invariant: when expanding a single-best helper to multi-suggest, the invariant 'old winner === new[0]' is auto-guaranteed by sort-desc + slice(0, K). Only add/change bookkeeping; never change filter/score functions. Mutate-and-restore probe the downstream dependency (here: Zipf tiebreaker) to confirm the refactor didn't silently bypass the tiebreaker code path."
  - "Priority-on-emit-block disambiguation: when two rules share rule_id, mirror rule.priority onto every emitted finding so downstream consumers can route by (rule_id, priority) without re-importing the rule registry. Cheap field add on already-populated object; no schema contortion."

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 6m 23s
completed: 2026-04-20
---

# Phase 05 Plan 02: Rule-side UX-01 + UX-02 data source Summary

**5 popover-surfacing rules (nb-gender, nb-modal-verb, nb-typo-curated, nb-typo-fuzzy, nb-sarskriving) upgraded to `explain: (finding) => ({nb, nn})` callable with XSS-safe `<em>`-wrapped NB/NN templates; fuzzy rule expanded from single-best to top-K (cap 8) `finding.suggestions` with `fix === suggestions[0]` back-compat invariant; every finding now carries `priority: <rule.priority>` for Pitfall-1 renderer disambiguation; check-explain-contract gate flips exit 1 → 0; COPY-REVIEW.md populated with shipped copy + defence-in-depth probe log.**

## Performance

- **Duration:** 6m 23s
- **Started:** 2026-04-20T20:11:58Z
- **Completed:** 2026-04-20T20:18:21Z
- **Tasks:** 3
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- All 5 popover-surfacing rules export `explain: (finding) => ({nb, nn})` with XSS-escaped `<em>` templates wrapping the student's typed word:
  - **nb-typo-curated.js** (priority 40, assertive): `<em>{original}</em> er en vanlig skrivefeil — prøv <em>{fix}</em>.` / NN: `…er ein vanleg skrivefeil…`
  - **nb-typo-fuzzy.js** (priority 50, hedged): `<em>{original}</em> står ikke i ordboken — kanskje du mente <em>{fix}</em>?` / NN: `…står ikkje i ordboka — kanskje du meinte…?`
  - **nb-gender.js** (priority 10, hedged): `<em>{original}</em> kan være feil kjønn — prøv <em>{fix}</em>.` / NN: `…kan vere feil kjønn…`
  - **nb-modal-verb.js** (priority 20, assertive): `Etter modalverb skal hovedverbet stå i infinitiv — bytt <em>{original}</em> med <em>{fix}</em>.` / NN: `Etter modalverb skal hovudverbet stå i infinitiv — byt…`
  - **nb-sarskriving.js** (priority 30, hedged + fallback): `<em>{original}</em> kan være to ord som hører sammen som <em>{fix}</em>.` / NN: `…kan vere to ord som høyrer saman som…` / fallback when fields missing: `To ord som kanskje hører sammen.` / `To ord som kanskje høyrer saman.`
- Every emitted finding across all 5 rules now carries `priority: rule.priority` — Plan 03's popover renderer can now route shared `rule_id: 'typo'` findings to the correct explain callable by matching priority (40 = curated, 50 = fuzzy).
- `nb-typo-fuzzy.js` expanded from single-best (`findFuzzyNeighbor`) to top-K (`findFuzzyNeighbors`): collects all filter-passing candidates with scoreCandidate, sorts desc, slice(0, 8). Rule emits `finding.suggestions: string[]` (case-matched via matchCase) with `finding.fix === suggestions[0]` preserving fixture-harness contract AND curated-rule wraparound semantics.
- `check-explain-contract` release gate flips exit 1 → exit 0 for the first time — 5/5 popover-surfacing rules satisfy the callable `{nb, nn}` contract. The gate's raison d'être (Phase 5 Plan 05-01 foundation) lands its acceptance signal.
- `COPY-REVIEW.md` Copy Table populated with all 5 rows (NB + NN templates as `{word}`/`{fix}` placeholders matching the actual escapeHtml-interpolated runtime output). Ready for Plan 05-03 phase-close dyslexia-persona proxy review.
- `COPY-REVIEW.md` Probe log section appended with defence-in-depth evidence: (a) priority + suggestions fields confirmed flowing through core runner (1 fuzzy finding on `berde resultat xxyyzz` with suggestions=[bedre, burde]); (b) Zipf-tiebreaker mutation probe fires on nb/typo cases `hagde→hagle` and `hatde→hate` with ZIPF_MULT=0, restores to 280/280 green with ZIPF_MULT=10 byte-identical.
- Suppression rules (nb-codeswitch.js, nb-propernoun-guard.js) untouched per plan scope — their string `explain` stays as-is since they never surface to the popover. `git diff --stat` on both files empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade 3 static-template rules (gender, modal-verb, typo-curated) + add priority** — `62e51a8` (feat)
2. **Task 2: Upgrade fuzzy rule to top-K suggestions + sarskriving with fallback + add priority** — `df3a002` (feat)
3. **Task 3: Defence-in-depth probe — priority + suggestions + Zipf tiebreaker** — `f2eef3a` (feat)

## Files Created/Modified

- `extension/content/spell-rules/nb-gender.js` — Extended IIFE preamble destructure to include `escapeHtml`. Replaced string `explain` with hedged callable (NB `kan være` / NN `kan vere`). Added `priority: rule.priority` to the single `out.push` block.
- `extension/content/spell-rules/nb-modal-verb.js` — Same preamble extension. Replaced string `explain` with assertive callable naming the infinitive rule (NB `hovedverbet` / NN `hovudverbet`). Added `priority: rule.priority` to emit block.
- `extension/content/spell-rules/nb-typo-curated.js` — Same preamble extension. Replaced string `explain` with assertive callable (NB `er en vanlig skrivefeil` / NN `er ein vanleg skrivefeil`). Added `priority: rule.priority` to emit block.
- `extension/content/spell-rules/nb-typo-fuzzy.js` — Extended existing multi-helper destructure to include `escapeHtml`. Renamed `findFuzzyNeighbor` → `findFuzzyNeighbors` (plural), changed inner single-best tracking to scored-array sort-and-slice(0, 8). Replaced string `explain` with hedged callable (NB `står ikke i ordboken — kanskje du mente…?` / NN `står ikkje i ordboka — kanskje du meinte…?`). Rewrote check() emit block to produce `suggestions: string[]` case-matched via matchCase, `fix: suggestions[0]`, `priority: rule.priority`.
- `extension/content/spell-rules/nb-sarskriving.js` — Added `escapeHtml` destructure from `host.__lexiSpellCore` (file previously didn't destructure core at all — added after the `host.__lexiSpellRules = […] || []` initialization). Replaced string `explain` with hedged callable + defensive fallback (when finding.original or finding.fix missing, returns plain-concept `To ord som kanskje hører sammen.` / `…høyrer saman.`). Added `priority: rule.priority` to emit block.
- `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — Copy Table: all 5 rows populated with NB + NN templates (`{word}`/`{fix}` placeholders). New "Probe log" section appended with Task 3 defence-in-depth evidence (priority+suggestions flow test + Zipf mutation-and-restore cycle).

## Decisions Made

- **Verbatim adoption of the plan's interface-block copy templates.** The plan explicitly allowed local judgement at authoring time to adjust wording within voice/length constraints. On review, every template fit the ≤15-word + second-person `du` + no-jargon + hedging-tier criteria as-written — no rewording needed. Reviewer-notes columns in COPY-REVIEW.md left blank (Plan 05-03's dyslexia-persona proxy review will populate them).
- **priority: rule.priority as an object key at each emit site rather than a renderer-side lookup.** The Plan 03 renderer needs to route shared-rule_id findings to the correct explain callable without re-importing the rule registry. Cheapest solution: mirror priority onto every emitted finding. Closure captures the `const rule = { … }` literal correctly (rule files already use this shape). Alternative (Plan-03-side `Object.fromEntries(host.__lexiSpellRules.map(r => [r.id + ':' + r.priority, r.explain]))` lookup) rejected as higher-friction + brittle if a renderer in-flight gets a finding emitted before the rule registry finishes loading.
- **Top-K cap of 8 locks UX-02's reveal max.** Plan 05-04's "Vis flere alternativer" settings toggle reveals up to 8 alternates. Shipping 8 from the rule matches that ceiling exactly; no padding, no waste. Ranker ordering (prefix × 15 + suffix × 10 − distance × 100 − short-penalty 50 + transposition 40 + Zipf × 10) governs which 8.
- **Defensive fallback inside sarskriving.explain is belt-and-braces, not a real production path.** The rule's emit block always populates both `original` (= `${prev.display} ${t.display}`) and `fix` (= `prev.display + t.display.toLowerCase()`) per the existing check() body. The fallback exists so probe-driven partial-finding construction (test harnesses, renderer unit tests) doesn't crash or emit raw `<em>undefined</em>`. Mirrors the pattern in React-style rendering where a nullish-safe fallback is always cheaper than a hard throw.
- **Source-file verify regex in Task 2's automated check was too strict.** The plan's regex `/suggestions,?\s*$/m` wants `suggestions` followed by only whitespace/comma to end of line — but our emit block has `suggestions,               // top-K for UX-02 multi-suggest layout` with a trailing comment. Loosened to `^\s*suggestions,` (line starts with optional whitespace + `suggestions,`) — semantically equivalent to 'suggestions emitted as object-shorthand key'. Not a scope deviation — just a regex refinement during verify.

## Deviations from Plan

None - plan executed exactly as written.

All 3 tasks landed verbatim per the plan's interfaces block, including exact copy templates, the explicit top-K sort/slice refactor, the priority-field emit policy, the sarskriving defensive fallback, and the Task-3 Zipf-mutation probe. COPY-REVIEW.md populated using the `{word}`/`{fix}` display placeholders the plan prescribed. The one adjustment inside Task 2 (loosening the automated-verify regex for the `suggestions` field) was a verify-tooling refinement that left the actual rule source exactly as specified — recorded under Decisions Made above.

No Rule-1/2/3 auto-fixes fired during execution. No Rule-4 architectural decisions surfaced. Zero authentication gates.

## Issues Encountered

- **Task 2 file-revert mid-execution.** During Task 2 editing, a linter or concurrent watcher reverted both `nb-typo-fuzzy.js` and `nb-sarskriving.js` back to their pre-Task-2 (string explain) state after I had applied the first round of Edit calls. Surfaced via system-reminder. Resolution: re-applied all Task 2 edits byte-identical to the first round (Edit tool's idempotent `old_string`/`new_string` contract makes this safe). Post-re-apply verification passed (check-explain-contract exit 0, fuzzy + sarskriving explain callables returning correct `{nb, nn}` shapes). No net code change from the revert event — just the detour time to re-apply.
- **Task 2 source-level verify regex miss.** The plan's suggested `grep`-via-regex verify for `suggestions,?\s*$` didn't match our actual emitted source (trailing line comment). Not a rule-source problem — the `suggestions` field is correctly emitted as an object shorthand. Loosened to `^\s*suggestions,` inline during Task 2 verify; semantically equivalent assertion. Documented under Decisions.
- **Pre-existing concurrent-wave modifications in working tree.** Plans 05-03 and 05-04 ran in parallel and modified `extension/content/word-prediction.js`, `extension/styles/content.css`, `extension/popup/popup.html`, `extension/popup/popup.js`, and later `STATE.md`. I staged only my plan's files (spell-rules + COPY-REVIEW.md) and left the concurrent-wave files untouched per the plan's context_note about file ownership. No conflict; no interference.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 05-03 (popover render) is fully unblocked.** Every input Plan 05-03 needs from this plan is live:

- **explain callable contract satisfied** — Plan 05-03's `renderExplain(finding, lang)` can call `finding.rule.explain(finding)[lang]` and get back a guaranteed `<em>`-wrapped XSS-safe NB or NN string for all 5 popover-surfacing rules. Suppression rules (nb-codeswitch, nb-propernoun-guard) never emit surfaced findings so their legacy string `explain` is irrelevant here.
- **priority-based disambiguation live** — shared `rule_id: 'typo'` findings now carry `priority: 40` (curated, assertive copy) or `priority: 50` (fuzzy, hedged copy) for clean renderer routing without a registry lookup.
- **UX-02 multi-suggest data source live** — fuzzy findings carry `suggestions: string[]` up to 8 items sorted by scoreCandidate desc. Plan 05-03's multi-suggest layout can render up to 8 clickable alternate buttons, deduping against `finding.fix` (= `suggestions[0]`) if needed.
- **check-explain-contract exit 0 is the acceptance signal** — if Plan 05-03 or any future plan silently breaks the shape, the gate fires at commit time.

**Plan 05-04 (settings toggle) and 05-05 (popover render phase-close) also depend on this plan** but their dependency is at the UI/settings layer, not the rule layer — they'll consume the seam Plan 05-03 exposes.

**Release gates post-plan:**
- `npm run check-fixtures` — PASS 280/280 (winner-at-index-0 invariant held through the top-K refactor — confirmed via Zipf mutation-and-restore probe)
- `npm run check-network-silence` — PASS (no network surface added)
- `npm run check-bundle-size` — PASS 10.13 MiB (9.87 MiB headroom under 20 MiB cap)
- `node scripts/check-explain-contract.js` — **PASS 5/5** (flipped from exit 1 → exit 0 this plan — acceptance signal for the Phase 5 foundation Plan 05-01)

No blockers or concerns carrying forward. The pre-existing deferred items (NN phrase-infinitive triage, missing fin_adj entry, Plan 04 live Chrome smoke test, ikkje-in-NB live runtime bug investigation, en.json data-shape for EN headwords) are all unrelated to this plan's scope.

---
*Phase: 05-student-experience-polish*
*Completed: 2026-04-20*

## Self-Check: PASSED

Files verified on disk:
- FOUND: extension/content/spell-rules/nb-gender.js (upgraded — `explain: (finding) => ({nb, nn})` callable + `priority: rule.priority` emit + `escapeHtml` destructured)
- FOUND: extension/content/spell-rules/nb-modal-verb.js (upgraded — assertive callable naming infinitive rule + priority + escapeHtml)
- FOUND: extension/content/spell-rules/nb-typo-curated.js (upgraded — assertive callable + priority + escapeHtml)
- FOUND: extension/content/spell-rules/nb-typo-fuzzy.js (upgraded — `findFuzzyNeighbors` top-K sort/slice + hedged callable + priority + `suggestions: string[]` emit)
- FOUND: extension/content/spell-rules/nb-sarskriving.js (upgraded — hedged callable with defensive fallback + priority + escapeHtml)
- FOUND: .planning/phases/05-student-experience-polish/COPY-REVIEW.md (all 5 rows populated + Probe log section)
- FOUND: .planning/phases/05-student-experience-polish/05-02-SUMMARY.md (this file)

Commits verified:
- FOUND: 62e51a8 (Task 1 — feat: upgrade 3 static-template rules)
- FOUND: df3a002 (Task 2 — feat: upgrade fuzzy rule to top-K + sarskriving fallback)
- FOUND: f2eef3a (Task 3 — feat: defence-in-depth probe)

Release gates verified:
- PASS: `npm run check-fixtures` — 280/280 all 12 fixture files green (winner-at-index-0 invariant held through top-K refactor)
- PASS: `node scripts/check-explain-contract.js` — **5/5 popover-surfacing rules satisfy the callable `{nb, nn}` contract** (flipped from exit 1 → exit 0)
- PASS: `npm run check-network-silence` — no network surface added by this plan
- PASS: `npm run check-bundle-size` — 10.13 MiB / 20.00 MiB cap (9.87 MiB headroom unchanged)

Suppression-rules untouched check:
- VERIFIED: `git diff --stat extension/content/spell-rules/nb-codeswitch.js extension/content/spell-rules/nb-propernoun-guard.js` → empty (both files zero lines changed)

Verification-block grep counts:
- `grep -c "priority: rule.priority" extension/content/spell-rules/nb-*.js` — 5 files match (one per popover-surfacing rule)
- `grep -rl "explain: (finding)" extension/content/spell-rules/` — 5 rule files + 1 README doc = 6 (README contains the contract doc from Plan 05-01)
- `grep -c "suggestions" extension/content/spell-rules/nb-typo-fuzzy.js` — 5 (comment + local `const suggestions` + emit key + doc line + message template)
- `grep -c "er en vanlig skrivefeil" COPY-REVIEW.md` — 1 (NB typo-curated)
- `grep -c "høyrer saman" COPY-REVIEW.md` — 1 (NN sarskriving primary — the fallback variant also mentions it elsewhere but in a different cell)
