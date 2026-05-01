# Phase 36 — v3.1 UAT Sweep #2 — Verification

Per-finding diagnosis + outcome for the second wave of v3.1 UAT findings.

## F36-1: FR `mangeait` typo-vs-aspect-hint dispute

**Status:** FIXED (defensive — Node-side already correct; pinned via fixture)

### Node repro (canonical sentence)

```
$ node -e "... core.check('Hier il mangeait une pomme.', vocab, { lang: 'fr' })"
[
  {
    "rule_id": "fr-aspect-hint",
    "start": 8,
    "end": 16,
    "original": "mangeait",
    "fix": "mangeait",
    "adverb": "Hier",
    "expectedAspect": "passe_compose",
    ...
  }
]
```

**Verdict:** Only `fr-aspect-hint` fires Node-side; `nb-typo-fuzzy` correctly skips because `mangeait` is in `vocab.validWords` (verified: `verbInfinitive.get('mangeait') === 'manger'`, `imparfait` conjugation present in `extension/data/fr.json` `manger_verbe`).

### Feature-gating sanity

Simulated FR `basic` preset (no `grammar_fr_imparfait`):

```
mangeait in validWords? true
verbInfinitive mangeait -> manger
mangeais in validWords? true
```

Lookup indexes are built from the unfiltered superset (per `check-spellcheck-features` gate contract); imparfait forms remain searchable even when feature gated off the active preset. Therefore `nb-typo-fuzzy`'s `!validWords.has(t.word)` guard correctly suppresses on `mangeait`.

### Browser repro

(captured during Task 4 human-verify checkpoint — see Task-4 section below)

### Fix path chosen

Plan listed Case A (priority swap), Case B (data fix). Diagnosis showed neither was needed — Node-side already green. Chosen path: **defensive pinning only.** Added two fixture cases:

- `fr-aspect-pos-f36-1-period` — canonical UAT sentence with trailing period
- `fr-aspect-neg-f36-1-clean` — passé-composé variant clean

These pin the canonical regression so a future change to `nb-typo-fuzzy`/`fr-aspect-hint` cannot silently regress.

### Evidence

```
$ npm run check-fixtures 2>&1 | grep "fr/aspect-hint"
[fr/aspect-hint] P=1.000 R=1.000 F1=1.000  88/88 pass
```

## F36-2: ES Aa-pill dropdown watch-item

(Resolved during Task 4 human-verify — see below)

## F36-3 / F36-4: DE `kein`/`keine` paradigm

(See Task 2 section below)

## F36-5: Structural-rule Fiks-button suppression

(See Task 3 section below)

