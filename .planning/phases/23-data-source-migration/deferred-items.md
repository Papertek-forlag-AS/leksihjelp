# Deferred items — Phase 23

Items discovered during execution that are out of scope for the current plan
but should be tracked for follow-up.

## Plan 23-01

_None open. The original "Bundle response size approaching Vercel 4.5 MB
limit" item was resolved by Task 4 of plan 23-01 (pre-gzip + HEAD fix,
sibling commits `db576df8` + `99d19a98`, 2026-04-27) — de wire size
dropped from 4.49 MiB to ~795 KB, leaving ~3.7 MB of headroom for plans
23-03/04. See `23-01-SUMMARY.md` "Follow-up: Task 4" section for the
full close-out._

## Plan 23-03

- **`npm run check-fixtures` exits 1 pre-existing.** Verified by stashing
  plan-23-03 changes and re-running on `main` HEAD (commit 53e0b81): exit
  code is 1 with my changes stashed too. Failing rule appears to be
  `nn/clean` (P=0.000 = false positives) — unrelated to bootstrap /
  baseline trim work. Out of scope for plan 23-03 per the deviation-rules
  scope boundary. Logged here so a later plan can pick up the NN clean
  fixture triage.
