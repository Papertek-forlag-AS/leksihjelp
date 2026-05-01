# Lockdown Re-Sync Pending

**Created:** 2026-05-01
**Last scan:** 2026-05-01

Doc-based ledger for synced-surface commits that landed without the
`[lockdown-resync-needed]` marker before the convention was adopted in
Phase 37 (HYG-06). This is a maintenance record, not a git history rewrite.
Future synced-surface commits should carry the marker per the CLAUDE.md
downstream-consumers convention; this file remains the source of truth for
tracking any backfill needed.

## Convention (going forward)

**Marker:** `[lockdown-resync-needed]` in the commit message (title, body, or
trailer all acceptable).

**Trigger:** any modification (addition, edit, deletion) to one of the
following synced-surface paths:

- `extension/content/`
- `extension/popup/views/`
- `extension/exam-registry.js`
- `extension/styles/content.css`
- `extension/data/`
- `extension/i18n/`

**Purpose:** Downstream consumers (lockdown webapp's
`node scripts/sync-leksihjelp.js`, skriveokt-zero's analogue) scope their
re-sync windows by scanning git log for the marker since their last consumed
version.

**Enforcement:** `npm run check-synced-surface-version` (HYG-05 release gate,
Plan 02 in this phase) prints the `[lockdown-resync-needed]` marker as a
copy-paste hint when it fires on an un-bumped synced-surface diff. The gate
enforces the version bump, not the marker itself, but it surfaces the marker
recommendation at the exact moment someone is about to forget it.

This block deliberately duplicates the CLAUDE.md downstream-consumers
section so that this file is self-contained for future maintainers who land
here without context. CLAUDE.md is the canonical doc; this is the ledger.

## Retroactive catch-up (v3.1 → HEAD)

**Scan command:**

```bash
git log v3.1..HEAD --oneline -- \
  extension/content/ \
  extension/popup/views/ \
  extension/exam-registry.js \
  extension/styles/content.css \
  extension/data/ \
  extension/i18n/
```

**Result on 2026-05-01: EMPTY** — no synced-surface commits since v3.1; only
docs churn (planning, requirements, roadmap). Convention starts clean for
v3.2.

If a future scan finds entries, tabulate them here:

| Commit | Date | Synced files | Re-sync status |
| ------ | ---- | ------------ | -------------- |
| _none_ | —    | —            | —              |

"Re-sync status" defaults to `needs documentation` (the catch-up state) and
flips to `synced` once the downstream consumer has consumed the change.

## v3.0 → v3.1 retroactive scope

Per Phase 37 RESEARCH Open Question 4, retroactive scope is intentionally
limited to `v3.1..HEAD`. Earlier eras (v3.0..v3.1, Phases 24-36) are
out-of-scope: CONTEXT scopes the retroactive scan as "v3.1 synced-surface
commits that landed without the marker" — i.e., v3.1..HEAD only. If
downstream consumers report drift originating before v3.1, a one-off scan
can extend the table at that point; until then, the convention starts at
v3.1.

## Future commits

Future commits use the `[lockdown-resync-needed]` marker per the CLAUDE.md
downstream-consumers convention whenever a synced-surface path is touched.
This file remains the source of truth for tracking any backfill needed.
