# Deferred items — Phase 23

Items discovered during execution that are out of scope for the current plan
but should be tracked for follow-up.

## Plan 23-01

### Bundle response size approaching Vercel 4.5 MB limit

- **Where:** `papertek-vocabulary/api/vocab/v1/bundle/[language].js`
- **Observation:** Current per-language bundle JSON sizes (pre-freq/bigrams):
  - nb: 3.64 MB
  - nn: 4.21 MB
  - de: 4.67 MB ← already over 4.5 MB binary, just under 4.5 MB decimal
  - es: 3.01 MB
  - fr: 2.81 MB
  - en: 2.87 MB
- **Risk:** Plan 23-03 adds `freq` and `bigrams` to the bundle. For nb/nn
  those are ~150 KB each (already in extension/data); de/es/fr/en bigrams
  are smaller (~3 KB each). Even so, de + (en/de bigrams + freq) may push
  the de bundle past Vercel's 4.5 MiB serverless body limit.
- **Mitigation when it bites:** Switch the bundle endpoint to the same
  streaming pattern v3 export uses (`res.write(...)` per bank), or split
  freq/bigrams into a sibling endpoint and have the cache adapter fetch
  them separately. Both are plan 23-03 territory, not a blocker for 23-01.
