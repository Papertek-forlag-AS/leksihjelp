---
phase: quick-1-v3-1-hygiene-cleanup
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/phases/31-fr-rule-suite/31-CONTEXT.md
  - .planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md
autonomous: true
requirements: [HYGIENE-EXAM-STATUS, HYGIENE-PHASE-31-ORPHAN, HYGIENE-PHASE-25-VERIF]

must_haves:
  truths:
    - "REQUIREMENTS.md traceability table shows EXAM-01..EXAM-07 as 'Complete' (not 'Planned')"
    - "Orphan directory .planning/phases/31-fr-rule-suite/ no longer exists"
    - ".planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md exists with valid frontmatter and documents the out-of-band closure of POPUP/SPELL/DEBT requirements"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "EXAM-01..EXAM-07 status flipped Planned -> Complete"
      contains: "EXAM-01 | Phase 27 | Complete"
    - path: ".planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md"
      provides: "Retroactive verification doc for Phase 25"
      contains: "status: passed"
  key_links:
    - from: ".planning/REQUIREMENTS.md"
      to: ".planning/v3.1-MILESTONE-AUDIT.md"
      via: "Status alignment — audit recorded EXAM-01..07 satisfied; REQUIREMENTS.md table now matches"
      pattern: "EXAM-01.*Complete"
---

<objective>
v3.1 milestone hygiene cleanup. Three small documentation/file housekeeping tasks
identified in `.planning/v3.1-MILESTONE-AUDIT.md` (Tech Debt → Hygiene section)
that block clean milestone archive but require zero code changes.

Purpose: Make `.planning/REQUIREMENTS.md` traceability match the audit verdict;
delete the orphaned Phase 31 stub directory that never produced any plan/summary;
backfill the missing Phase 25 VERIFICATION.md so the archive is consistent across
all v3.1 phases.

Output:
- Edited REQUIREMENTS.md (7 status cells flipped + coverage footer updated)
- Deleted directory `.planning/phases/31-fr-rule-suite/`
- New file `.planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md`
</objective>

<execution_context>
@/Users/geirforbord/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/v3.1-MILESTONE-AUDIT.md
@.planning/REQUIREMENTS.md
@.planning/phases/24-compound-word-intelligence/24-VERIFICATION.md
@.planning/phases/25-ux-polish-tech-debt/25-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Flip EXAM-01..EXAM-07 status Planned -> Complete in REQUIREMENTS.md</name>
  <files>.planning/REQUIREMENTS.md</files>
  <action>
    Edit `.planning/REQUIREMENTS.md` traceability table (lines 120-126).
    Change the Status column for rows EXAM-01 through EXAM-07 from `Planned`
    to `Complete`. Each row currently reads:

      | EXAM-01 | Phase 27 | Planned |
      | EXAM-02 | Phase 27 | Planned |
      ... through EXAM-07 ...

    Replace with:

      | EXAM-01 | Phase 27 | Complete |
      | EXAM-02 | Phase 27 | Complete |
      ... through EXAM-07 ...

    Do NOT touch EXAM-08, EXAM-09, or EXAM-10 rows — they already have correct
    nuanced statuses ("Complete (plumbing)", "Deferred", "Code Complete").

    Also update the footer note (last lines, the italic "Requirements updated"
    timestamp): append a brief 2026-05-01 line documenting the v3.1 audit
    flip. Example append (preserve existing line):

      *Hygiene 2026-05-01 — v3.1 milestone audit flipped EXAM-01..EXAM-07
      Planned -> Complete (verification passed via Phase 27-03; audit reference
      .planning/v3.1-MILESTONE-AUDIT.md).*

    Do NOT change the `[x]` checkboxes in the EXAM section — they're already `[x]`.
    Do NOT change "Pending (active): 0" or other counters — those were already
    correct.
  </action>
  <verify>
    <automated>grep -E "^\| EXAM-0[1-7] \| Phase 27 \| Complete \|$" .planning/REQUIREMENTS.md | wc -l | grep -q "^7$" && echo OK</automated>
  </verify>
  <done>
    All seven EXAM-01..EXAM-07 rows in the traceability table show "Complete";
    no row in that range still says "Planned"; footer hygiene note appended.
  </done>
</task>

<task type="auto">
  <name>Task 2: Delete orphan Phase 31 directory</name>
  <files>.planning/phases/31-fr-rule-suite/31-CONTEXT.md</files>
  <action>
    Delete the entire directory `.planning/phases/31-fr-rule-suite/`. It contains
    only `31-CONTEXT.md` (no plans, no summaries, no verification, not in
    ROADMAP.md). The FR rule suite work was actually done under Phase 32
    (32-fr-es-pedagogy) per the milestone audit (line 42).

    Use `git rm -r .planning/phases/31-fr-rule-suite/` so the deletion is
    captured cleanly in the working tree (do NOT commit — orchestrator will
    commit at end). If `git rm` complains it isn't tracked, fall back to
    `rm -rf .planning/phases/31-fr-rule-suite/`.

    No other files reference `phases/31-fr-rule-suite` — verified via the
    audit document and ROADMAP. If a reference is found unexpectedly, STOP
    and surface it; do not proceed.

    Sanity-check before deleting:
      grep -rn "31-fr-rule-suite" .planning/ --include="*.md" | grep -v "v3.1-MILESTONE-AUDIT.md"
    Should return zero hits (audit is the only known mention; that line is
    documenting the orphan and is fine to leave as historical record).
  </action>
  <verify>
    <automated>test ! -e .planning/phases/31-fr-rule-suite && echo OK</automated>
  </verify>
  <done>
    Directory `.planning/phases/31-fr-rule-suite/` does not exist; no other
    `.planning/` markdown file (besides the audit, which documents the cleanup)
    references it.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create retroactive Phase 25 VERIFICATION.md</name>
  <files>.planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md</files>
  <action>
    Create `.planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md` documenting
    that all Phase 25 requirements were closed via out-of-band commits before
    the formal verification pass was run. Use the Phase 24 VERIFICATION.md
    frontmatter as a structural template (see context block).

    Frontmatter:

      ---
      phase: 25-ux-polish-tech-debt
      verified: 2026-05-01T00:00:00Z
      status: passed (out-of-band)
      score: 10/10 requirements satisfied via prior commits
      re_verification: false
      retroactive: true
      human_verification: []
      ---

    Body sections:

    1. Header explaining this is a retroactive doc (status: passed (out-of-band)),
       written 2026-05-01 to back-fill the archive after the v3.1 milestone audit
       flagged the missing VERIFICATION.md as Hygiene tech debt.

    2. Out-of-band commit ledger (Markdown table):

       | Commit  | Closes              | Notes |
       |---------|---------------------|-------|
       | 41aa4e6 | DEBT-05             | Trimmed `BUNDLED_LANGS` to ['nb'] in vocab-seam.js |
       | 72c9c29 | DEBT-04             | SCHEMA-01 developer-view: popup surfaces `lexi:schema-mismatch` "Versjonskonflikt" diagnostic |
       | f655552 | DEBT-02             | check-fixtures triage — fixed de-capitalization recht-haben false positives + nb-demonstrative-gender 1-ahead/2-ahead bridging; gate now exits 0 |
       | 2438f49 | SPELL-03            | Word prediction language-aware threshold (4 chars for nb/nn/de, 3 elsewhere) |
       | (prior) | POPUP-01            | NB/EN/NN language buttons wired in popup.js:1318+ before Phase 25 |
       | (prior) | POPUP-02            | Fest -> Side Panel API migration (manifest + popup.js:2556) |
       | (prior) | SPELL-01            | Aa button jumps to first marker; Tab cycles (spell-check.js:207-211) |
       | (prior) | SPELL-02            | Aa button only on inputs ~20+ chars (spell-check.js:742) |
       | (prior) | DEBT-01             | Version alignment across manifest.json + package.json + backend/public/index.html (was 2.5.0; current at v2.9.18) |
       | (prior) | DEBT-03             | Browser visual verification (VERIF-01) — 12 deferred tests user-verified 2026-04-28 |

    3. "Why no formal VERIFICATION.md was produced at the time" section, ~3
       sentences: most success criteria shipped in earlier branch work before
       Phase 25 was formalised; subsequent phases (26-36) used proper
       VERIFICATION.md flow; this back-fill restores archive consistency.

    4. "Audit reference" line linking to `.planning/v3.1-MILESTONE-AUDIT.md`
       (the line in the audit's tech_debt section that requested this).

    5. "Re-verification" section: state `false` — same as the frontmatter — and
       note that re-running fixture / release gates today at v2.9.18 confirms
       all DEBT items are still satisfied (12/12 release gates green per audit
       line 105-118). Do not run any commands; just reference the audit.

    Keep the doc compact — ~50-80 lines is ideal. No need to enumerate
    must-haves or artifacts in the Phase 24-style detail; this is a back-fill
    pointer doc, not a forward verification.
  </action>
  <verify>
    <automated>test -s .planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md && grep -q "status: passed (out-of-band)" .planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md && grep -qE "41aa4e6|72c9c29|f655552" .planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md && echo OK</automated>
  </verify>
  <done>
    File exists, has valid frontmatter with `status: passed (out-of-band)` and
    `retroactive: true`, includes the three named out-of-band commit hashes
    (41aa4e6, 72c9c29, f655552), and references the v3.1 milestone audit.
  </done>
</task>

</tasks>

<verification>
- All three task `<verify>` checks pass.
- `grep -n "Planned" .planning/REQUIREMENTS.md` returns no EXAM-01..EXAM-07 rows.
- `ls .planning/phases/31-fr-rule-suite/ 2>&1 | grep -q "No such"` confirms deletion.
- `cat .planning/phases/25-ux-polish-tech-debt/25-VERIFICATION.md` shows valid
  retroactive doc.
- v3.1 milestone audit's three Hygiene items (audit lines 152-156) are now
  closed.
</verification>

<success_criteria>
- REQUIREMENTS.md: 7 EXAM rows flipped Planned -> Complete; footer hygiene note added.
- Phase 31 orphan directory deleted; no broken cross-references.
- Phase 25 retroactive VERIFICATION.md exists with valid frontmatter referencing
  out-of-band commits 41aa4e6, 72c9c29, f655552.
- v3.1 milestone archive is now hygienically consistent — ready for
  `/gsd:complete-milestone` (or equivalent close-out).
</success_criteria>

<output>
After completion, no SUMMARY.md is required for a quick-mode plan. The orchestrator
will commit the changes with an appropriate "docs(v3.1): hygiene cleanup" message.
</output>
