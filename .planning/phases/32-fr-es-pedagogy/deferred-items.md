# Phase 32 — Deferred / Out-of-Scope Items

## Discovered during 32-02 execution (2026-04-30)

### Pre-existing in-flight failures from sibling 32-x plans

When running `npm run check-fixtures` and `npm run check-benchmark-coverage`
during the 32-02 release-gate sweep, the following failures surfaced. These
are **NOT** caused by 32-02's changes — they originate from in-flight (partly
committed, partly uncommitted) work in 32-01 and 32-03 that landed on `main`
before 32-02 began executing:

- `[es/gustar] P=1.000 R=0.086 F1=0.158 (62/94 pass)` — caused by the
  uncommitted 32-03 refactor of `extension/content/spell-rules/es-gustar.js`
  reading from `ctx.vocab.gustarClassVerbs` / `ctx.vocab.gustarPedagogy`
  while the matching fixture data hasn't fully landed.

- `[es/personal-a] P=1.000 R=0.970 F1=0.985 (49/50)` — single-case regression
  also tied to in-flight `vocab-seam-core.js` / `es.json` changes from 32-01
  / 32-03.

- `check-benchmark-coverage` fails on one es-gustar expectation
  (`hermano estaba ya allí viendo televisión. Él no gusta ayudar en la`).
  Same root cause as the gustar fixture regression above.

**Verification that these are out-of-scope for 32-02:** with all working-tree
changes stashed (including 32-01 / 32-03 in-flight files), then re-applying
**only** the 32-02 commits (04e0573 + 279059f), the full fixture suite and
benchmark-coverage gate both pass cleanly. So 32-02's contract — "the
50-case por/para fixture stays at P=R=F1=1.000 and no regression caused by
this plan's edits" — holds.

**Resolution:** these failures will resolve when 32-01 and 32-03 finish
landing their full surface (vocab-seam-core wiring + grammarbank pedagogy
sync + downstream rule refactors). Track via the 32-01 and 32-03 SUMMARY
files when those plans complete.
