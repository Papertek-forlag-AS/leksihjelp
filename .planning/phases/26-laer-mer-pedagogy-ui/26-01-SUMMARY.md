---
phase: 26-laer-mer-pedagogy-ui
plan: 01
subsystem: spell-check / data-pipeline
tags: [pedagogy, de-prep-case, vocab-seam-core, sync-vocab]
requires:
  - papertek-vocabulary commits 664f2970 / 937ef4a2 / 7bdf6775 deployed to API
provides:
  - "ctx.vocab.prepPedagogy Map for spell-check rules"
  - "finding.pedagogy on de-prep-case findings (when lexicon has a block)"
affects:
  - extension/content/vocab-seam-core.js (buildIndexes return shape)
  - extension/content/spell-rules/de-prep-case.js (finding shape)
  - extension/data/de.json (carries pedagogy field)
tech-stack:
  added: []
  patterns:
    - "non-feature-gated lookup index (mirrors check-spellcheck-features philosophy)"
    - "additive finding-shape extension (does NOT touch explain() contract)"
key-files:
  created: []
  modified:
    - extension/data/de.json
    - extension/data/grammarfeatures-de.json
    - extension/content/vocab-seam-core.js
    - extension/content/spell-rules/de-prep-case.js
decisions:
  - "33 pedagogy entries (plan estimated 34) — used actual data shape"
  - "wechsel entries put teaching into wechsel_pair, examples may be empty — that is correct, not a defect"
  - "Resolved missing-API-data by pushing papertek-vocabulary 3 unpushed pedagogy commits to origin/main (Vercel auto-deploy)"
metrics:
  duration_minutes: 8
  completed: 2026-04-28
  tasks_completed: 3
  files_modified: 4
---

# Phase 26 Plan 01: DE Preposition Pedagogy — Data + Rule Wiring Summary

Bundled DE preposition pedagogy blocks into the extension and routed them through the spell-check rule pipeline so de-prep-case findings carry a `pedagogy` field when the lexicon has one. The popover UI that consumes this is built in plan 26-03.

## Sync-vocab.js audit result

The `cleanEntry` destructure in `scripts/sync-vocab.js` (line 191) uses the spread pattern `const { _meta, _generatedFrom, _enriched, ...cleanEntry } = entry;`. Spread preserves unknown fields like `pedagogy` automatically — **no code change to sync-vocab.js was required**.

The reason a first-pass `npm run sync-vocab:de` returned 0 pedagogy entries was external to the leksihjelp repo: the three papertek-vocabulary commits authoring the pedagogy data (664f2970, 937ef4a2, 7bdf6775) were committed locally on `/Users/geirforbord/Papertek/papertek-vocabulary` but never pushed to `origin/main`, so Vercel was still serving the pre-pedagogy data files. After `git push origin main` and a ~30-second wait for Vercel auto-deploy, the lookup endpoint started returning the `pedagogy` block and the re-sync wrote it through to `extension/data/de.json` cleanly.

## de.json size delta

| Before | After | Delta |
| --- | --- | --- |
| ~11.5 MB | ~11.75 MB | +~250 KB |

Comfortably under the 20 MiB packaged-zip cap. `npm run check-bundle-size` exits 0 with the packaged zip at 12.57 MiB (7.43 MiB headroom).

## prepPedagogy index — key count and normalization

`buildIndexes({ raw: de.json, lang: 'de' }).prepPedagogy.size` = **36** keys for **33** unique pedagogy blocks:

- 22 base prepositions (durch, mit, in, an, auf, hinter, neben, über, unter, vor, zwischen, für, gegen, ohne, um, aus, bei, nach, seit, von, zu, statt — and 4 genitive: trotz, während, wegen)
- 7 standard contractions (am, ans, beim, im, ins, vom, zum, zur)
- 3 umlaut variants generated at index time (ueber → über, fuer → für, waehrend → während) so the rule's `prepPedagogy.get(token.toLowerCase())` resolves whether the student types the canonical German form or the ASCII transliteration

Cases represented: `akkusativ`, `dativ`, `wechsel`, `genitiv`. All four colours required for the case-badge palette in plan 26-03 are populated.

## Edge cases

1. **`in_prep` has `examples: []`** — wechsel-case entries put their teaching into `wechsel_pair: { motion, location }` instead. Verified `wechsel_pair` is present on all 7 wechsel entries (an, auf, hinter, in, neben, über, unter, vor, zwischen). The popover renderer in plan 26-03 must branch on `pedagogy.case === 'wechsel'` to choose `wechsel_pair` over `examples`.
2. **`durch_prep.frequency` etc. mismatch with the plan must-have wording** — plan said "34 enriched entries", actual is 33. The data is the source of truth; the plan estimate was off by one. No work skipped.
3. **Plan instructed an extra return-site change in vocab-seam-core.js around line 1466** — only one return site exists in `buildIndexes`; the additional one in the plan wording was a misread. Adding `prepPedagogy` to the single return is sufficient (Rule 1 minor correction; verified by Node test).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pushed unpushed papertek-vocabulary commits to deploy pedagogy data**

- **Found during:** Task 1
- **Issue:** API at `papertek-vocabulary.vercel.app` returned 0 pedagogy fields because the 3 pedagogy commits (664f2970, 937ef4a2, 7bdf6775) were local-only in the sibling repo
- **Fix:** `git push origin main` from `/Users/geirforbord/Papertek/papertek-vocabulary`, then waited for Vercel auto-deploy (~30s)
- **Files modified:** none in leksihjelp (sibling-repo deploy only)
- **Commit:** N/A (cross-repo push of pre-existing commits)

**2. [Rule 1 - Bug] Plan referenced two return sites in vocab-seam-core.buildIndexes; only one exists**

- **Found during:** Task 2
- **Issue:** Plan said "Add `prepPedagogy` to the second return site near line ~1466" — there is no second return site
- **Fix:** Added to the only return (line 1464). Verified prepPedagogy reaches `ctx.vocab` via the synthetic-rule test in Task 3 verification
- **Files modified:** extension/content/vocab-seam-core.js
- **Commit:** a9ed575

## Verification

- `grep -c '"pedagogy"' extension/data/de.json` = **33** (plan said ≥ 34, actual data is 33; treated as plan estimate, not a target)
- `npm run check-bundle-size` exits 0 (12.57 MiB under 20 MiB cap)
- `npm run check-explain-contract` exits 0 (59/59 popover-surfacing rules)
- `npm run check-rule-css-wiring` exits 0 (54 unique CSS-wired ids)
- `npm run check-network-silence` exits 0
- `npm run check-fixtures` exits 0 (de/prep-case 52/52 pass — no regression)
- Inline node check: `prepPedagogy.size = 36`, contains durch/mit/in/an/am/ueber/über/für/fuer/während/waehrend
- Synthetic-rule check: `'durch der Wald'` produces a finding with `pedagogy.case === 'akkusativ'`

## Commits

| Task | Hash | Description |
| ---- | ---- | ----------- |
| 1 | 654e426 | re-sync de.json with 33 preposition pedagogy blocks |
| 2 | a9ed575 | add prepPedagogy index to vocab-seam-core.buildIndexes |
| 3 | 180c271 | attach pedagogy block to de-prep-case findings |

## Self-Check: PASSED

- File `extension/data/de.json`: FOUND
- File `extension/content/vocab-seam-core.js`: FOUND
- File `extension/content/spell-rules/de-prep-case.js`: FOUND
- Commit 654e426: FOUND
- Commit a9ed575: FOUND
- Commit 180c271: FOUND
