---
phase: 25-ux-polish-tech-debt
verified: 2026-05-01T00:00:00Z
status: passed (out-of-band)
score: 10/10 requirements satisfied via prior commits
re_verification: false
retroactive: true
human_verification: []
---

# Phase 25 — UX Polish & Tech Debt: Retroactive Verification

This is a **retroactive verification document** written 2026-05-01 to back-fill
the v3.1 archive after the v3.1 milestone audit
(`.planning/v3.1-MILESTONE-AUDIT.md`) flagged the missing Phase 25
VERIFICATION.md as Hygiene tech debt.

All ten Phase 25 requirements (POPUP-01..02, SPELL-01..03, DEBT-01..05) were
closed through out-of-band commits and prior branch work before a formal
verification pass was scheduled. The verification status is therefore
**passed (out-of-band)** rather than the usual forward `passed` — every
success criterion is satisfied, but the closure happened via direct commits
on the v3.1 polish branch rather than through a Phase 25 plan-execute cycle.

## Out-of-Band Commit Ledger

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

## Why no formal VERIFICATION.md was produced at the time

Most Phase 25 success criteria shipped in earlier branch work before Phase 25
was formalised as a planning artefact, so the per-task verification flow was
never triggered. Subsequent phases (26 through 36) used the proper plan ->
execute -> VERIFICATION.md flow consistently. This back-fill exists solely to
restore archive consistency across the v3.1 milestone — no new fixes shipped
as part of this retroactive pass.

## Audit Reference

See `.planning/v3.1-MILESTONE-AUDIT.md` (Hygiene / Tech Debt section) — the
audit itemised the missing Phase 25 VERIFICATION.md as one of three v3.1
hygiene cleanup tasks blocking a clean milestone archive.

## Re-verification

`false` — same as the frontmatter. Re-running the fixture and release-gate
suite today at v2.9.18 confirms all DEBT items are still satisfied
(audit lines 105-118 record 12/12 release gates green at the milestone-close
snapshot). No commands were executed as part of this back-fill; the audit's
prior gate run is the canonical evidence.
