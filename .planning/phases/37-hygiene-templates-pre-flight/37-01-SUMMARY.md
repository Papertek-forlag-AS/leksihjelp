---
phase: 37-hygiene-templates-pre-flight
plan: 01
subsystem: planning-tooling
tags: [uat, templates, gsd, auto-mode, hyg-01, hyg-02, hyg-03]
requires:
  - .planning/phases/37-hygiene-templates-pre-flight/37-CONTEXT.md
  - .planning/phases/37-hygiene-templates-pre-flight/37-RESEARCH.md
  - .planning/phases/36-v3.1-uat-sweep-2/36-VERIFICATION.md
provides:
  - .planning/uat/TEMPLATE-walkthrough.md
  - .planning/uat/TEMPLATE-finding.md
  - "CLAUDE.md: Auto-mode pause convention subsection"
affects:
  - "Phase 38 walkthroughs (will instantiate these templates)"
  - "/gsd:auto, /gsd:execute-phase, /gsd:plan-phase auto-loops (must honour verification_kind hard-pause)"
tech-stack:
  added: []
  patterns:
    - "YAML frontmatter as machine-queryable phase metadata via gsd-tools.cjs frontmatter get"
    - "verification_kind: human-browser-walk as auto-mode pause sentinel"
key-files:
  created:
    - .planning/uat/TEMPLATE-walkthrough.md
    - .planning/uat/TEMPLATE-finding.md
  modified:
    - CLAUDE.md
decisions:
  - "Frontmatter-first templates: HTML comment placed AFTER frontmatter block so gsd-tools.cjs frontmatter parser (which requires file to start with '---') can query verification_kind"
  - "Literal 'TBD' placeholders in frontmatter values (vs angle-bracket sentinels) so parsed values stay clean strings; field-level guidance moved into the trailing HTML comment"
  - "verification_kind documented as a top-level CLAUDE.md ## section (placed before ## graphify) — cross-cutting GSD convention, not a downstream-consumers concern"
metrics:
  duration_minutes: 3
  tasks_completed: 3
  files_created: 2
  files_modified: 1
  commits: 4
  completed_date: "2026-05-01"
---

# Phase 37 Plan 01: Hygiene templates + auto-mode pause convention

UAT walkthrough + finding templates landed at `.planning/uat/`, and CLAUDE.md now documents the `verification_kind: human-browser-walk` convention so /gsd:auto stops on browser-walk phases instead of steamrolling past them.

## What shipped

- **`.planning/uat/TEMPLATE-walkthrough.md`** — Walkthrough scaffold with 11 locked frontmatter fields (walkthrough_id, phase, verification_kind, ext_version, idb_revision, preset_profile, browser_version, reload_ts, target_browsers, walker, date) and four mandatory body sections (Pre-flight evidence → Steps → Defects observed → Outcome). Pre-flight section explicitly references `node scripts/check-vocab-deployment.js` per HYG-07 pairing. (HYG-01)
- **`.planning/uat/TEMPLATE-finding.md`** — Finding scaffold formalising the F36-1 convention as repo standard. Locked frontmatter (f_id, severity, sync_status, regression_fixture_id, walkthrough_id, discovered, status). Body: Reproduction → Root cause hypothesis → Fix tracking. (HYG-02)
- **`CLAUDE.md` ## Auto-mode pause convention** — Documents the `verification_kind: human-browser-walk` sentinel: how agents detect it (`gsd-tools.cjs frontmatter get`), required halt behaviour for /gsd:auto / /gsd:execute-phase / /gsd:plan-phase auto-loops, why (v3.1 Pitfall 2 root cause), and a Phase 38 example. ~19 lines. (HYG-03)

## Verification evidence

```
$ node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get .planning/uat/TEMPLATE-walkthrough.md --field verification_kind
{ "verification_kind": "human-browser-walk" }

$ node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get .planning/uat/TEMPLATE-finding.md --field f_id
{ "f_id": "F38-1" }
```

All three task automated checks (per-task `<verify><automated>` blocks) passed. Plan success criteria all green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Frontmatter parser couldn't read templates with leading HTML comment**

- **Found during:** Final overall verification step (after Task 3 commit), running the plan's success-criteria check `node ~/.claude/get-shit-done/bin/gsd-tools.cjs frontmatter get .planning/uat/TEMPLATE-walkthrough.md --field verification_kind`.
- **Issue:** First template draft placed the explanatory HTML comment ABOVE the YAML frontmatter block (a pattern common in some Markdown ecosystems). The gsd-tools.cjs frontmatter parser (`lib/frontmatter.cjs`) uses regex `/^---\n([\s\S]+?)\n---/` which requires the file to START with `---`. With a leading HTML comment, parser returned `Field not found` — which would have silently broken the very HYG-03 hook the plan was designed to enable.
- **Fix:** Moved the HTML usage comment AFTER the frontmatter block in both templates; relocated the per-field inline guidance into the trailing comment; replaced angle-bracket sentinels in frontmatter VALUES with literal `TBD` placeholders so parsed values stay clean strings (angle-bracket sentinels would also pass the regex but produced ugly query output).
- **Files modified:** `.planning/uat/TEMPLATE-walkthrough.md`, `.planning/uat/TEMPLATE-finding.md`
- **Commit:** `4cded03`
- **Why this counts as Rule 3 (blocking, not Rule 4 architectural):** The fix is purely a comment-placement / placeholder-format adjustment. The plan's locked frontmatter keys, body sections, and grep-level verification checks all still pass. No architectural change.

## Commit log

| Task | Hash      | Message                                                                          |
| ---- | --------- | -------------------------------------------------------------------------------- |
| 1    | `0f249c5` | feat(37-01): add UAT walkthrough template with locked pre-flight frontmatter     |
| 2    | `02aa370` | feat(37-01): add UAT finding template formalising F36-1 convention               |
| 3    | `54b3560` | docs(37-01): document verification_kind auto-mode pause convention (HYG-03)      |
| Fix  | `4cded03` | fix(37-01): move HTML comment after frontmatter for parser compatibility         |

## Requirements satisfied

- HYG-01 — UAT walkthrough template with locked pre-flight frontmatter
- HYG-02 — UAT finding template formalising F36-1 convention as repo standard
- HYG-03 — Auto-mode hard-pause convention for `verification_kind: human-browser-walk`

## Downstream impact

- **Phase 38** can now instantiate `.planning/uat/TEMPLATE-walkthrough.md` for each of UAT-EXT-01..04 with confidence the pre-flight discipline is uniform.
- **Auto-mode agents** running on Phase 38 plans MUST honour the `verification_kind: human-browser-walk` hard-pause — the convention is now a CLAUDE.md instruction, which is canonical for this repo.
- **No downstream-consumer impact:** Templates and CLAUDE.md changes are planning-tooling-only; nothing in `extension/`, `backend/`, or synced surfaces touched. No version bump needed.

## Self-Check: PASSED

- FOUND: `.planning/uat/TEMPLATE-walkthrough.md`
- FOUND: `.planning/uat/TEMPLATE-finding.md`
- FOUND: `CLAUDE.md` modification (verification_kind subsection)
- FOUND commit: `0f249c5`
- FOUND commit: `02aa370`
- FOUND commit: `54b3560`
- FOUND commit: `4cded03`
- Frontmatter query returns `human-browser-walk` ✅
