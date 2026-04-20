# Leksihjelp Regression Fixtures

Ground-truth JSONL cases that `scripts/check-fixtures.js` evaluates against
`spell-check-core.check()` on every release. Hard mismatches block the build
(non-zero exit code).

Fixtures are **ground truth, not snapshots**. Every case asserts what the
tool *should* return for real-world Norwegian text. A case that fails today
because the fuzzy matcher picks the wrong neighbor is a real bug to track —
never "fix" it by editing the `expected` to match today's output.

---

## Case schema

Each line in `fixtures/{lang}/{rule}.jsonl` is a single JSON object:

```json
{
  "id": "nb-gender-hus-001",
  "text": "en hus",
  "expected": [
    { "rule_id": "gender", "start": 0, "end": 2, "suggestion": "et" }
  ],
  "must_not_flag": []
}
```

| Field           | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `id`            | Stable identifier for this case. Convention: `{lang}-{rule}-{slug}-NNN`. |
| `text`          | The input passed to `check(text, vocab, {lang})` verbatim. Case-preserving. |
| `expected`      | Array of findings the tool MUST emit. `[]` means "no findings expected". |
| `must_not_flag` | Reserved for future use (negative assertions beyond the `expected` list). |

Each `expected` entry has:

| Field        | Meaning                                                        |
| ------------ | -------------------------------------------------------------- |
| `rule_id`    | Which rule class must fire. See canonical list below.         |
| `start`      | Start offset of the flagged span (inclusive, 0-based).         |
| `end`        | End offset of the flagged span (**EXCLUSIVE**, Python-style).  |
| `suggestion` | The correct replacement — compared against the Finding `fix` field. |

---

## Span convention — critical

**`end` is EXCLUSIVE.** `end = start + word.length`.

For `"Jeg har en hus"`, the word "en" starts at index 8 and ends at index 10
(`10 - 8 = 2`, which is `"en".length`). A mis-set `end` turns every matching
case red for what looks like mysterious reasons.

Quick REPL helper for computing offsets:

```bash
node -e "const t='Jeg har en hus'; const i=t.indexOf('en'); console.log({start:i,end:i+'en'.length});"
```

Lowercasing is the core's responsibility — author `text` case-preserving.

---

## Canonical `rule_id` values

These are the strings emitted by `spell-check-core.check()`. Match exactly:

| `rule_id`      | What it catches                                                        |
| -------------- | ---------------------------------------------------------------------- |
| `gender`       | Article / noun gender mismatch (`en hus` → `et hus`).                  |
| `modal_form`   | Non-infinitive verb after a modal (`kan spiser` → `kan spise`).        |
| `sarskriving`  | Over-spaced compound (`skole sekk` → `skolesekk`). **ASCII key — no æ.** |
| `typo`         | Unknown word with a fuzzy or curated correction (`komer` → `kommer`).  |

Fixture filenames are ASCII too: `saerskriving.jsonl`, never `særskriving.jsonl`.

---

## How to run

```bash
# All languages, all rules
npm run check-fixtures
node scripts/check-fixtures.js
node scripts/check-fixtures.js all

# One language
npm run check-fixtures:nb
npm run check-fixtures:nn
node scripts/check-fixtures.js nb

# One rule across a language
node scripts/check-fixtures.js nb --rule=gender

# Show every failing case with diagnostic output
node scripts/check-fixtures.js nb --verbose

# Machine-readable report
node scripts/check-fixtures.js --json
```

Exit code:

- `0` — every case matched its expected findings exactly.
- `1` — at least one case had a missing-expected or unexpected finding.

`P`, `R`, `F1` are printed for information only in Phase 1. They do not gate
the exit code — any hard mismatch fails the run regardless of the aggregate
F1. Threshold gating is deferred to Phase 4.

---

## Adding a case — workflow

1. Write the new line into `fixtures/{lang}/{rule}.jsonl`.
2. Run `node scripts/check-fixtures.js {lang} --rule={rule} --verbose`.
3. Read the output:
   - If the case passes, you are done.
   - If it fails, decide: is the tool wrong or is the `expected` field wrong?
     - Tool wrong → fix the rule (in `spell-check-core.js`), re-run.
     - Expected wrong → correct the JSONL line, re-run.
4. Commit the fixture and any rule change together.

Comment support: lines starting with `//` or `#` are ignored by the loader.
Use them as section headers inside fixture files.

---

## Honest-ground-truth policy

**Never paste the current tool output as `expected`.** If you do, the fixture
locks in today's behaviour — including its bugs — and subsequent regressions
are invisible to the suite. Instead, decide what a well-calibrated spell
checker *should* return for this input; if the tool disagrees, that is the
signal the fixture is designed to produce.

If a ground-truth case fails today and the fix belongs to a later phase, do
not add the case to the fixture yet — track it in the phase's SUMMARY.md
under "Deferred Issues" and add it once the relevant phase lands. The
fixture suite's exit code needs to mean "nothing new is broken," which is
only true when the baseline is clean.

---

## Clean corpus

`fixtures/{lang}/clean.jsonl` contains grammatically correct Norwegian that
must produce **zero** findings. Any flag from any rule is a hard failure. The
clean corpus is the backstop against over-triggering: a new rule or a
widened fuzzy threshold that starts flagging correct text will fail here
before it ships.

---

## Code-switching corpus

`fixtures/{lang}/codeswitch.jsonl` (NEW in Phase 4) contains cases where a
contiguous span of >=3 non-Norwegian tokens appears inside Norwegian text.
The `nb-codeswitch.js` rule (priority 1) populates `ctx.suppressed` for
every token index inside a dense unknown-to-NB-AND-NN window; typo rules
opt in by early-exiting on `suppressed.has(i)`.

Expected findings in this corpus are typically `[]` (full suppression) or
a single finding on a Norwegian typo *outside* the codeswitched span
(per SC-04 acceptance criterion: "at most 1 flag per paragraph, not per
word"). A case where the runner emits a finding inside the codeswitched
span is a bug — either in the `nb-codeswitch.js` density heuristic (window
size, threshold, min-tokens) or in a typo rule that didn't opt into
suppression.

The runner auto-discovers new JSONL files in `fixtures/{lang}/` — adding
`codeswitch.jsonl` requires no edit to `scripts/check-fixtures.js`.

---

## P/R threshold gate (Phase 4 / SC-05)

Since Phase 4, `scripts/check-fixtures.js` hosts a `THRESHOLDS` table
gating per-rule precision and recall. When an entry exists AND the run's
observed P or R drops below, the runner exits 1 with a diagnostic like:

    [nb/saerskriving] THRESHOLD FAIL: R=0.521 < 0.95

Scope: `saerskriving` for both NB and NN is gated in Phase 4 (SC-05).
Other rules report P/R but are not gated — gating them would block Phase 5
UX work for unrelated ranking noise.

The `THRESHOLDS` key is the **fixture filename basename** (e.g.,
`saerskriving`, matching `saerskriving.jsonl`), not the finding-side
`rule_id` emitted by `spell-check-core.check()` (which is `sarskriving`,
no 'ae'). The runner buckets results by filename stem, so the gate table
must mirror that spelling. A mismatch silently no-ops the gate.

Locking a new threshold:

1. Run the suite; observe the per-rule P/R output.
2. Decide: does the observed value match the product bar? If yes,
   pick `threshold = observed - 0.05` (safety margin ~1 sigma on a
   ~90-case corpus; see 04-RESEARCH.md Pitfall 4).
3. Edit the `THRESHOLDS` table and commit together with the reason
   in the commit body — record both the observed value and the locked
   threshold so future regressions have an audit trail.
