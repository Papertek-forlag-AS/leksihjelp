---
status: paused
phase: 11-aspect-mood-es-fr
source: 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md
started: 2026-04-25T10:00:00Z
updated: 2026-04-25T10:00:00Z
---

## Current Test

number: 1
name: ES subjuntivo trigger flags indicative verb
expected: |
  In the extension popup, set language to Spanish. Type "Quiero que mi hermano viene conmigo" in a text field.
  The spell-checker should underline "viene" with an amber warning dot and suggest "venga" (subjunctive form).
awaiting: user response

## Tests

### 1. ES subjuntivo trigger flags indicative verb
expected: Type "Quiero que mi hermano viene conmigo" in Spanish mode. "viene" gets an amber warning dot with suggestion "venga".
result: [pending]

### 2. ES subjuntivo does NOT flag relative clauses
expected: Type "El libro que viene es interesante" in Spanish mode. No warning appears on "viene" — this is a relative clause, not a subjunctive trigger.
result: [pending]

### 3. ES imperfecto hint fires at hint severity
expected: Type "Ayer yo caminaba por el parque" in Spanish mode. "caminaba" gets a dashed/muted hint dot (NOT amber warning) suggesting the pretérito form. The hint is visually softer than the subjuntivo warning.
result: [pending]

### 4. ES imperfecto hint — reverse direction
expected: Type "Siempre yo caminé al parque" in Spanish mode. "caminé" gets a dashed/muted hint suggesting the imperfecto form "caminaba". The hint adverb ("Siempre") is referenced in the explanation.
result: [pending]

### 5. FR subjonctif flags irregular verb after trigger
expected: Set language to French. Type "Je veux que tu fais tes devoirs". "fais" gets an amber warning dot with suggestion "fasses" (subjunctive of faire for tu).
result: [pending]

### 6. FR subjonctif homophony guard — regular -er verb does NOT flag
expected: Type "Je veux que je parle mieux" in French mode. "parle" should NOT be flagged — the indicative and subjunctive forms are identical for regular -er verbs in je form.
result: [pending]

### 7. CSS dot colours render correctly for all three rules
expected: Compare the three rules visually: ES subjuntivo and FR subjonctif should show amber warning dots (solid). ES imperfecto-hint should show a visually distinct muted/dashed hint dot. All three are distinguishable from each other and from error-tier dots.
result: [pending]

### 8. Release gates all pass
expected: Run `npm run check-fixtures && npm run check-explain-contract && npm run check-rule-css-wiring && npm run check-network-silence && npm run check-benchmark-coverage`. All should exit 0.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none yet]
