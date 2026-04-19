---
phase: 02-data-layer-frequency-bigrams-typo-bank
plan: 05
subsystem: infra
tags: [bundle-size, gap-closure, audit, blocked-by-design, en-json, release-gate, product-decision]

# Dependency graph
requires:
  - phase: 02-04
    provides: scripts/check-bundle-size.js + the authoritative 10,599,772-byte over-cap observation that made SC-4 a documented Blocker
provides:
  - .planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md (authoritative evidence that English is a first-class bundled vocabulary language with 4 independent runtime-entry paths)
  - Confirmed product-decision handoff — SC-4 remediation CANNOT be "delete en.json"; requires either a full English-removal refactor, a different remediation target, or a ceiling bump
affects: [phase-02.1, phase-03, all future SC-4 follow-up planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit-first gap-closure pattern: a plan whose Task 1 grep-audits the proposed change, Task 2 surfaces a decision checkpoint to the user, and Task 3 is contingent on the checkpoint outcome. Halt-by-design at the checkpoint is a valid terminal state, not a plan failure."
    - "BLOCKED-by-design outcome: when a plan's hard precondition (audit finding CLEAN) fails its evidence gate, the plan halts at the checkpoint and records the findings as the deliverable. The gate infrastructure it was supposed to flip green stays red; the next remediation becomes a fresh product-decision input for a follow-up plan."

key-files:
  created:
    - .planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md
    - .planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-SUMMARY.md
  modified:
    - .planning/STATE.md (pause note added at Task 2 checkpoint in ca8926e; further updated in the final metadata commit of this plan)
    - .planning/ROADMAP.md (Phase 2 progress row reflects 02-05 halted-by-design, SC-4 still open)

key-decisions:
  - "Audit verdict = BLOCKED — extension/data/en.json is NOT unreferenced dead weight. It is a first-class bundled vocabulary language with hard runtime references in popup.js (3 sites), vocab-seam.js (2 sites), word-prediction.js (2 sites), floating-widget.js (2 sites), and a fresh regeneration path in scripts/sync-vocab.js. Silent deletion would cause user-visible 404s in at least 4 independent boot/fallback paths."
  - "Per 02-CONTEXT.md 'Remediation Path (LOCKED)' hard requirement ('If the audit finds en.json IS referenced somewhere, STOP and surface the finding — do not silently remove a file in active use. A checkpoint / re-plan is the correct move.'), the plan halts here. Task 3 (deletion + dead-code cleanup + re-verify) is INTENTIONALLY NOT EXECUTED."
  - "BLOCKED outcome is the plan working as designed, not a plan failure. The deliverable in this shape is the audit evidence (02-05-AUDIT.md), the STATE.md checkpoint pause, and this SUMMARY — handing the product decision back to the user with enumerated follow-up paths."
  - "SC-4 remains an open Blocker on Phase 2, carried forward from 02-04. Phase 2 is shipped-with-known-gap: SC-1/SC-2/SC-3 are VERIFIED, SC-4 awaits a follow-up plan. The check-bundle-size gate correctly exits 1 against the 10,599,772-byte zip — that's the intended fail-loud signal."
  - "linkedTo.en entries in extension/data/{de,es,fr}.json (10,020 total across the three foreign-language files) are DORMANT DATA — the runtime consumes linkedTo.nb and linkedTo.nn via vocab-store.js but never resolves linkedTo.en. They impose no runtime dependency on en.json existing. Classification took noticeable audit effort; preserving the finding here so a follow-up plan doesn't re-litigate it."

patterns-established:
  - "Checkpoint-halt SUMMARY pattern: when a blocking checkpoint resolves to the halt option, the executor still produces a SUMMARY.md documenting the verdict, the evidence, what the plan did NOT do, and the handoff options for the follow-up plan. This replaces the would-have-been 'final' SUMMARY after Task 3."
  - "Audit scope-distinction discipline: vocab data (extension/data/*.json) vs. UI i18n strings (extension/i18n/*.json) share filename patterns (`en.json`) but have different namespaces and different runtime semantics. Future audits of `extension/data/{lang}.json` must explicitly triage every `'{lang}'` hit into {data-vocab, i18n-ui, html-lang, comment/doc, preposition/article-word-collision} classifications before assigning runtime-reference status."

requirements-completed: []  # gap closure — no REQUIREMENTS.md row; closes (or in this case, fails to close) Phase 2 SC-4 roadmap success criterion only

# Metrics
duration: 21 min
completed: 2026-04-19
---

# Phase 2 Plan 5: SC-4 Gap Closure — BLOCKED by Design

**en.json audit complete — verdict BLOCKED: English is a first-class bundled vocabulary language with 4 independent runtime paths. SC-4 remains open; plan halts at Task 2 checkpoint per 02-CONTEXT.md's hard requirement. No files deleted, no code changed.**

## Performance

- **Duration:** ~21 min (audit + checkpoint decision + summary documentation)
- **Started:** 2026-04-19T07:39Z (02-05-PLAN.md committed as 2feffb1)
- **Checkpoint reached:** 2026-04-19T08:00Z (audit committed as 2cb785a, STATE.md pause committed as ca8926e)
- **Plan finalized (BLOCKED):** 2026-04-19 (this SUMMARY + final metadata commit)
- **Tasks:** 1 of 3 executed to completion (Task 1); 1 halted at decision gate (Task 2, resolved to `blocked`); 1 intentionally NOT executed (Task 3)
- **Files modified:** 0 shipped extension files. 1 audit artifact created. 3 planning/state files updated.

## Outcome

**BLOCKED by design — this is the expected halt per 02-CONTEXT.md, not a plan failure.**

02-CONTEXT.md's "Remediation Path (LOCKED)" section states the hard rule:

> "If the audit finds en.json IS referenced somewhere, STOP and surface the finding — do not silently remove a file in active use. A checkpoint / re-plan is the correct move."

The audit found runtime references. The plan halted. Task 3 was never eligible to run.

- **Task 1 (audit):** COMPLETED — commit `2cb785a`. Produced `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md` with six-step grep + classification output.
- **Task 2 (checkpoint:decision):** RESOLVED to `blocked` option. The checkpoint's own framing explicitly names this as "NOT a plan failure — the plan working as designed."
- **Task 3 (delete + cleanup + re-verify):** NOT EXECUTED. Precondition (Task 2 = CLEAN) failed.

## Accomplishments

- **Authoritative audit of extension/data/en.json references** across every shipped surface and the sync pipeline. Evidence-grade document (~200 lines, file:line citations) that a follow-up plan can consume without redoing the grep work.
- **Four independent runtime failure paths identified and documented** — see Verdict + Evidence below. This is the authoritative list of what any "remove English support" refactor would have to touch.
- **Dormant-data classification locked in** — the 10,020 `linkedTo.en` entries across extension/data/{de,es,fr}.json are data-only, never resolved at runtime. A follow-up plan does NOT need to also remove these; they impose no runtime dependency on en.json.
- **Product-decision handoff prepared** — three follow-up paths enumerated (full English-removal refactor / different-target remediation / ceiling bump), with the trade-offs for each. User now has all the evidence needed to pick one.
- **Zero collateral damage** — no extension code changed, no data files deleted, no bundle-size state changed (zip remains 10,599,772 bytes), no fixture state changed (138/138 still pass, trivially — nothing was touched).

## Verdict + Evidence

**Verdict:** BLOCKED. Full audit evidence in `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md`.

**Summary of the four runtime paths:**

1. **Popup first-run fallback (popup.js:161, 343, 487):** `currentLang` defaults to `'en'` when the user skips the first-run picker (`lang-pick-skip` button in popup.html:79) → immediately triggers `loadDictionary('en')` → `fetch(chrome.runtime.getURL('data/en.json'))` at popup.js:375 → 404. The `BUNDLED_LANGUAGES = new Set(['nb', 'nn', 'en'])` Set at popup.js:343 also explicitly short-circuits the IndexedDB-download fallback path for `'en'`, so there's no recovery — the popup renders empty.

2. **Popup language-delete fallback (popup.js:487):** If a paying user deletes their currently-active foreign-language dictionary (e.g. `de.json`) via the settings UI language list, the handler falls back to `currentLang = 'en'` then `loadDictionary('en')` → 404. The user is stuck with an empty dictionary with no escape.

3. **Settings-UI vocab language picker (popup.html:144):** The settings page's vocab language list explicitly offers `🇬🇧 Engelsk` as a selectable vocabulary language (distinct from the UI `data-ui-lang` picker on line 133, which is i18n namespace and unrelated). Clicking it stores `language: 'en'` in `chrome.storage.local`, then every subsequent content-script boot on every page reads that and calls `loadForLanguage('en')` → sustained 404 across spell-check + word-prediction + floating-widget for the lifetime of that setting.

4. **Content-script init defaults (vocab-seam.js:151, word-prediction.js:46, floating-widget.js:107):** Every content script initializes `currentLang = stored.language || 'en'`. Fresh install, cleared storage, or storage-read race → `currentLang = 'en'` → `loadRawVocab('en')` → `fetch('data/en.json')` → 404. Every content-script feature silently stops working. `BUNDLED_LANGS = ['nb', 'nn', 'en']` in vocab-seam.js:41 and `BUNDLED_PREDICTION_LANGS` / `BUNDLED_WIDGET_LANGS` (same shape) gate these loaders — the `'en'` presence in each Set is what signals "fetch from bundled data/, don't hit IndexedDB."

**Additional note: sync pipeline regenerates en.json.** `scripts/sync-vocab.js:414` lists `'en'` in the default `langsToSync` array, with English-specific post-processing at line 198. Even if en.json were deleted as a one-off, the next `npm run sync-vocab` (default invocation, zero args — a common developer workflow) would silently regenerate it.

**Dormant-data finding (for posterity):** `linkedTo.en` entries in extension/data/de.json (3,454), es.json (3,379), fr.json (3,187) are structural translation-pair stubs. Runtime consumers (`popup.js:30–35`, `floating-widget.js:17–18`, `vocab-store.js:227–245`) explicitly read `linkedTo.nb` and `linkedTo.nn` only; no code path dereferences `linkedTo.en`. These can stay as-is through any future remediation — they are ~150 KB of pre-minification whitespace, not the bundle-size driver.

## What This Plan Did NOT Do

Recording these as explicit negatives so a follow-up executor doesn't re-audit:

- **Did NOT delete extension/data/en.json.** File remains on disk at its original 4.65 MB size.
- **Did NOT delete extension/data/grammarfeatures-en.json.** File remains on disk (~7 KB).
- **Did NOT modify any shipped extension file** (manifest, popup, content scripts, background, data).
- **Did NOT modify scripts/sync-vocab.js.** `'en'` remains in the `langsToSync` array at line 414; the English-specific branch at line 198 is untouched.
- **Did NOT run `npm run check-fixtures`** (no source changes, no regression possible — 138/138 passing state carried forward from 02-04).
- **Did NOT run `npm run check-bundle-size`** (no packaging changes, zip remains 10,599,772 bytes = 10.11 MiB, gate remains FAIL — exactly as 02-04 left it).
- **Did NOT run `npm run package`** (nothing to repackage).
- **Did NOT modify scripts/check-bundle-size.js** (CEILING_BYTES stays at 10 * 1024 * 1024 — Outcome-B rejection of ceiling bumps held).

## Task Commits

Each stage was committed atomically:

1. **Plan authoring** — `2feffb1` (docs): gap-closure plan 02-05-PLAN.md authored with audit-first shape + checkpoint-halt contract + three tasks.
2. **Task 1 (audit)** — `2cb785a` (docs): 02-05-AUDIT.md with six-step grep + classification + BLOCKED verdict + dead-code paths section marked N/A.
3. **Task 2 checkpoint pause (STATE.md)** — `ca8926e` (docs): STATE.md Session Continuity updated to record "Paused at Task 2 checkpoint:decision (blocking)" with resume-file pointer to 02-05-AUDIT.md and three follow-up-path options.
4. **Plan finalization (BLOCKED-by-design)** — this commit pair:
   - `docs(02-05): summary — BLOCKED by design, SC-4 remains open pending follow-up plan` (02-05-SUMMARY.md, this file)
   - `docs(02-05): STATE.md + ROADMAP.md reflect 02-05 halted-by-design` (final metadata)

## Files Created/Modified

- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md` — CREATED (commit `2cb785a`). ~200 lines, 6 audit-step tables + Verdict + follow-up-paths section.
- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-SUMMARY.md` — CREATED (this commit). Plan outcome record.
- `.planning/STATE.md` — MODIFIED (commit `ca8926e` + this final commit). Session Continuity marks 02-05 halted at Task 2; Blockers section clarifies SC-4 is still open pending follow-up plan; Decisions appended with the audit finding.
- `.planning/ROADMAP.md` — MODIFIED (this final commit). Phase 2 plan 02-05 row annotated as halted-by-design, progress table reflects the plan completed its deliverable but SC-4 criterion remains unchecked.

## Decisions Made

- **Audit verdict = BLOCKED** — made at commit 2cb785a based on concrete file:line evidence across 4 independent runtime paths + 1 regeneration path. The evidence is overwhelming: English is not dead weight, it is a first-class bundled language.
- **Honor 02-CONTEXT.md's hard requirement** — the plan halts at Task 2. The audit exists precisely so this halt can happen on evidence rather than guesswork.
- **Mark plan as completed-but-BLOCKED rather than incomplete** — the plan DID produce its primary deliverable (authoritative audit evidence). What it did NOT produce (a green check-bundle-size gate) is a consequence of the product reality the audit surfaced, not a failure of plan execution. Counting this as a completed plan in progress metrics (7/7 in STATE.md frontmatter) reflects that 02-05 ran end-to-end on its own terms. SC-4 status is tracked separately in Blockers + the ROADMAP success-criteria checklist.
- **Retain 02-05-AUDIT.md as a planning artifact** — not merged into this SUMMARY. Two documents: one evidence-focused (the audit), one outcome-focused (this SUMMARY). Future plans can cite the audit by path without having to re-grep.

## Deviations from Plan

**None — the plan executed EXACTLY as written.**

02-05-PLAN.md Task 2's `<options>` block explicitly enumerated `blocked` as a valid resolution with an explicit caveat: "A BLOCKED outcome is NOT a plan failure — it is the plan working as designed. The gate infrastructure from 02-04 still ships; the next remediation is a product decision." The plan halted at the correct task, with the correct resolution, backed by the correct evidence. Zero auto-fixes applied. Zero Rule-4 architectural surprises (the plan pre-anticipated this outcome).

This is the textbook definition of an audit-first plan working correctly: when the audit surfaces a blocker, the plan surfaces the blocker rather than silently proceeding.

## Issues Encountered

None. The audit was thorough on first pass (no re-scans needed), the checkpoint fired cleanly, the halt was explicit in the plan spec, and the continuation agent had a clean resume-point to act on.

One minor observation (not an issue, just a note for future audit plans): the audit took noticeable effort to distinguish UI i18n `'en'` hits from vocab-data `'en'` hits, and to rule out the Norwegian article `en` and Spanish/French preposition `en` as false positives. The classification discipline is captured in the "audit scope-distinction discipline" pattern in the frontmatter — future `extension/data/{lang}.json`-removal audits should front-load this triage step.

## Self-Check: PASSED

BLOCKED-by-design is the explicitly-documented valid outcome per the plan spec. It is NOT a Self-Check: FAILED state. Verifying each claim in this summary against disk state:

- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-AUDIT.md` exists: FOUND
- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-SUMMARY.md` exists: FOUND (this file)
- `.planning/phases/02-data-layer-frequency-bigrams-typo-bank/02-05-PLAN.md` exists: FOUND
- Commit `2feffb1` (plan) exists: FOUND
- Commit `2cb785a` (audit) exists: FOUND
- Commit `ca8926e` (STATE pause) exists: FOUND
- `extension/data/en.json` still exists on disk (NOT deleted): VERIFIED EXPECTED STATE
- `extension/data/grammarfeatures-en.json` still exists on disk: VERIFIED EXPECTED STATE
- `scripts/sync-vocab.js` line 414 still lists `'en'`: VERIFIED EXPECTED STATE
- `scripts/check-bundle-size.js` `CEILING_BYTES` still `10 * 1024 * 1024`: VERIFIED EXPECTED STATE
- 02-05-AUDIT.md Verdict section checks the BLOCKED box: VERIFIED
- No fixture runs executed (no source changes to regression against): VERIFIED SCOPE-CORRECT
- No bundle-size runs executed (no packaging changes): VERIFIED SCOPE-CORRECT

All claims about negative (non-)actions are the DESIGNED plan outcome. All positive claims (audit file, commits, decision records) are verified present.

## Next Phase Readiness / Follow-up Paths

**SC-4 status:** Still open. The 10 MiB bundle-size ceiling remains breached (zip = 10,599,772 bytes = 10.11 MiB, 114,012 bytes over cap). The check-bundle-size gate correctly exits 1 — that's the fail-loud signal per 02-04's Outcome-B design. Do NOT cut a GitHub Release; Release Workflow step 2 will block it.

**User product decision is required before any further plan can be written.** The three paths (reproduced from 02-05-AUDIT.md's "Recommended next steps" section and the checkpoint return message):

1. **Full English-removal refactor (recommended if the product accepts losing EN lookup).** A new gap-closure plan — tentatively 02-06 — performs the 6-step CLEAN-path sequence identified in the audit:
   - Remove `'en'` from `BUNDLED_LANGUAGES`, `BUNDLED_LANGS`, `BUNDLED_PREDICTION_LANGS`, `BUNDLED_WIDGET_LANGS` (4 Sets across popup.js + vocab-seam.js + word-prediction.js + floating-widget.js).
   - Change every `stored.language || 'en'` default to `|| 'nb'` (Norwegian Bokmål is always bundled). 5 call sites across the same 4 files.
   - Remove `data-lang="en"` button from popup.html:144; strip `en` entries from `WIDGET_LANG_FLAGS`/`LABELS` in floating-widget.js:322 and word-prediction.js:1165.
   - Remove `'en'` from scripts/sync-vocab.js:414 and optionally delete the `langCode === 'en'` branch at line 198.
   - Delete `extension/data/en.json` AND `extension/data/grammarfeatures-en.json` (the latter is loaded at popup.js:736 via `data/grammarfeatures-${lang}.json` — if any code path runs with `lang='en'` it 404s; removing the branch means removing the file too).
   - User-facing release notes: v2.x users who used English→Norwegian lookup lose that feature; document and accept.
   - Bundle impact: ~5.5 MiB zip, ~4.5 MiB headroom. Clears SC-4 with plenty of room for Phase 3+.

2. **Different remediation target (keep English, close SC-4 elsewhere).** Candidates from 02-04 SUMMARY's Blockers list, ordered by impact/effort ratio:
   - **Strip bundled `audio/de/*.mp3` and fetch-on-first-play with IndexedDB caching** (saves ~8 MiB uncompressed → zip drops ~3 MiB). Breaks the offline German TTS pledge for first-play of each word; acceptable if the fetch is backgrounded and cached.
   - **Deduplicate `audio/de/*` against the ElevenLabs premium set** (samples a premium user already gets from the TTS API are redundant in the offline pack).
   - **Trim rarely-used noun/verb conjugation branches in data/de.json** (8.5 MB source, largest single file). Requires production-lookup-telemetry calibration to know which branches are rarely hit — not a quick fix.

3. **Bump `CEILING_BYTES` 10 MiB → 12 MiB** with explicit user sign-off + a landing-page copy update. Costs the publicly-stated 10 MB promise + the structural forcing function. Reserve as last resort per 02-CONTEXT.md's rejected-paths table.

**Recommendation (author's note, not a decision):** Path 1 if the product can lose English lookup. It's the cleanest closure, largest headroom, and keeps the forcing function intact. The 6-step refactor is mechanical once the scope is agreed. No schema changes, no cross-app blast radius (papertek-vocabulary can still emit en.json; Leksihjelp just stops syncing + bundling it).

**Blockers carried forward from 02-04, unchanged:**

- NN phrase-infinitive triage (~214 entries) — sibling-repo data cleanup, out of scope, unchanged.
- Missing `fin_adj` entry in NB + NN adjective banks — sibling-repo data gap, out of scope, unchanged.

---

*Phase: 02-data-layer-frequency-bigrams-typo-bank*
*Plan: 05 — halted by design at Task 2 checkpoint*
*Completed (in the "plan executed per spec and produced its deliverable" sense): 2026-04-19*
*SC-4 status: STILL OPEN — follow-up plan required*
