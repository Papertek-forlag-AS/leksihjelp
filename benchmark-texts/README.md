# Leksihjelp Benchmark Texts

Short, deliberately error-packed student texts — one per supported language.
Each file is a paragraph a Norwegian teenager might plausibly write when
learning the target language. The errors are hand-curated to cover both
**currently caught** and **aspirational** rule categories.

## Purpose

- **Living scoreboard.** Paste any file into leksihjelp (popup search or
  floating widget on a webpage) and visually count how many errors get
  flagged. More underlines = more coverage.
- **Regression tripwire.** If a release suddenly flags noticeably fewer
  issues on the same text, something regressed.
- **Roadmap provocation.** The "FUTURE / UNPLANNED" comment at the top of
  each file names rule categories that are **not** on the current roadmap
  — things leksihjelp doesn't try to catch today and hasn't scheduled.
  They're idea-seeds, not commitments.

## How to use

1. Open the leksihjelp extension and switch UI to the matching language
   (nb/nn for Norwegian texts; target lang set to `en`/`de`/`es`/`fr` for
   the foreign-language texts if testing the dictionary side).
2. Paste the text into any editable field (Gmail compose, Google Docs,
   a textarea on a test page) — the spell-check widget runs on input.
3. Compare flagged vs the "expected categories" block at the top of each
   file. Note which categories are under-flagged vs currently expected.

## Files

| File | Audience | Primary target |
|------|----------|----------------|
| `en.txt` | NB student writing English | `en-grammar`, `homophone`, `sv`, `typo`, future: false-friends render |
| `nb.txt` | NB student proofreading own writing | `sarskriving`, `gender`, `modal_form`, `typo`, `dialect-mix` |
| `nn.txt` | NN student proofreading own writing | same NN-variant + NB-leakage |
| `de.txt` | NB student writing German | `de-grammar`, `de-capitalization`, `agreement` |
| `es.txt` | NB student writing Spanish | `es-grammar`, `es-accent`, `es-coordination` |
| `fr.txt` | NB student writing French | `fr-grammar`, `fr-contraction`, `fr-preposition` |

## Format

Each file starts with a `# EXPECTED CATEGORIES` comment block:

```
# ─── BENCHMARK: <lang> ──────────────────────────────
# CURRENTLY COVERED:
#   - <rule-id>: <example from this text>
# FUTURE / ASPIRATIONAL:
#   - <category>: <example>
# ────────────────────────────────────────────────────
```

Followed by the plain text passage. Hash-prefixed lines are ignored when
you paste the whole file; only the prose is spell-checked.

## Not a fixture

These are **not** regression fixtures. The fixture suite
(`fixtures/<lang>/*.jsonl`) uses exact span-and-suggestion assertions and
gates the release. Benchmarks are prose — loose, pedagogically useful,
and deliberately over-rich with errors that span far beyond what any one
rule handles. Don't wire them into `check-fixtures`.
