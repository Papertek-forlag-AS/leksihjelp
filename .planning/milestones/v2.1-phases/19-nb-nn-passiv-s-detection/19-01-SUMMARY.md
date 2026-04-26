---
phase: 19-nb-nn-passiv-s-detection
plan: 01
status: complete
started: 2026-04-26
completed: 2026-04-26
---

## What Was Built

Enriched NB and NN verbbank data with s-passive conjugation forms and deponent/st-verb marking, then merged into leksihjelp extension bundled data files.

### Key Results

- **NB:** 648 verbs received `s_passiv_infinitiv` + `s_passiv_presens` forms (e.g., "skrive" → "skrives")
- **NN:** 435 verbs received `s_passiv_infinitiv` forms (e.g., "skriva" → "skrivast")
- **NB deponents:** 6 marked with `isDeponent: true` (finnes, synes, lykkes, trives, ferdes, minnes)
- **NN deponents:** 2 marked with `isDeponent: true` (synast, finnast)

### Deviations

- **Deponent counts lower than plan estimate** (6/2 vs 97/279): The teaching verbbank only contains ~6 deponent entries vs. the full ordbank. This is correct — school vocabulary is a subset.
- **NN s-passive count (435) below plan's 500+**: ~173 NN entries are phrasal verbs that correctly don't receive s-passive forms.
- **Vercel deploy failed** due to pre-existing 250MB serverless function size limit. Worked around by merging enrichment data directly from local papertek-vocabulary files into extension data. A re-sync will confirm the same data once the deploy issue is resolved.

### Key Files

**Created:**
- `/Users/geirforbord/Papertek/papertek-vocabulary/scripts/enrich-nb-nn-s-passive.js` — enrichment script

**Modified:**
- `extension/data/nb.json` — NB bundled vocab with s-passive forms + deponent flags
- `extension/data/nn.json` — NN bundled vocab with s-passive forms + deponent flags

### Commits

| Hash | Message |
|------|---------|
| c3024020 | feat: add NB/NN s-passive enrichment (papertek-vocabulary repo) |
| c722da8 | feat(19): enrich NB/NN bundled data with s-passive forms and deponent marking |
