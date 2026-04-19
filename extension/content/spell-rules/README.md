# Spell-check rule registry (INFRA-03, Phase 3)

Plugin registry of spell-check rules. Each rule is a self-contained IIFE
file that pushes `{ id, languages, priority, check, explain }` onto
`self.__lexiSpellRules`. The runner in `spell-check-core.js` iterates this
array — adding a new rule does NOT require editing core.

## How to add a rule

1. Create `extension/content/spell-rules/nb-{id}.js`. The IIFE pushes the rule
   object onto `self.__lexiSpellRules`.
2. Add the file to `extension/manifest.json` `content_scripts[0].js` AFTER
   `content/spell-check-core.js` and BEFORE `content/spell-check.js`.
3. No edit to `scripts/check-fixtures.js` is needed — it `readdirSync()`s this
   directory in alphabetical order, so the new file is auto-discovered.

## Priority semantics

Lower priority value = runs first. `dedupeOverlapping` keeps the
earliest-listed finding when two rules cover overlapping spans. Current
priorities (preserved from the pre-INFRA-03 inline order):

| Rule           | Priority | Rule ID       |
| -------------- | -------- | ------------- |
| gender         | 10       | `gender`      |
| modal-verb     | 20       | `modal_form`  |
| sarskriving    | 30       | `sarskriving` |
| typo (curated) | 40       | `typo`        |
| typo (fuzzy)   | 50       | `typo`        |

Reordering changes which finding wins on overlapping spans. Do not change
priorities without a full `npm run check-fixtures` pass.

## Dual-load guard (Pitfall 1)

Every rule file's IIFE preamble MUST begin with:

```javascript
const host = typeof self !== 'undefined' ? self : globalThis;
host.__lexiSpellRules = host.__lexiSpellRules || [];
```

This makes the rule register correctly under BOTH the browser content-script
load (where `self` is the global object) AND Node `require()` from
`scripts/check-fixtures.js` (where `global.self` is set by the runner).
Forgetting the guard yields a silent registration failure on the Node side:
the fixture runner reports vacuous "0 fp 0 fn, F1=1.000" results because no
rules are registered. Fatal silent failure mode.

## Shared helpers

Rule files reuse helpers exposed on `self.__lexiSpellCore` — do NOT redeclare
them inside rules:

`tokenize`, `editDistance`, `matchCase`, `dedupeOverlapping`,
`sharedPrefixLen`, `sharedSuffixLen`, `isAdjacentTransposition`,
`isLikelyProperNoun`, `scoreCandidate`, `findFuzzyNeighbor`.

The fuzzy rule (`nb-typo-fuzzy.js`) is the host for Plan 03's Zipf tiebreaker
(SC-01). Phase 4 will add SC-02/03/04 as new rule files here without touching
core.
