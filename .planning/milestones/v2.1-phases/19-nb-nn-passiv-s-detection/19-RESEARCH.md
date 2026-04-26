# Phase 19: NB/NN Passiv-s Detection - Research

**Researched:** 2026-04-26
**Domain:** Norwegian s-passive grammar rules, Papertek vocabulary data enrichment, spell-check rule architecture
**Confidence:** HIGH

## Summary

Phase 19 adds s-passive detection for NB and NN. The work splits into three layers: (1) data enrichment in Papertek vocabulary to add -s/-st/-ast verb forms so they enter validWords, (2) NN strict s-passive rule that flags finite s-passives as errors while accepting infinitive s-passives after modals, (3) NB document-level overuse hint when >3 s-passives appear in a text. Additionally, st-verbs (deponent/reciprocal like synast, finnast, trivast) need lexical marking to avoid false flags.

The existing codebase has zero passive-related code. No s-passive forms exist in the bundled NB/NN vocabulary data except for a handful of inherent -s/-st verbs (finnes, synes, lykkes in NB; synast, lykkast, finst in NN). The productive s-passive system (skrives, leses, brukes in NB; skrivast, lesast, brukast in NN) is entirely missing from both Papertek lexicon and bundled extension data. This means any student writing "skrives" or "lesast" currently gets flagged as an unknown word.

**Primary recommendation:** Start with Papertek vocabulary enrichment (adding s-passive forms to NB/NN verbbanks + marking st-verbs as deponent), sync to leksihjelp, then build two rule files: `nb-nn-passiv-s.js` (token-level NN finite s-passive detection) and `doc-drift-nb-passiv-overuse.js` (document-level NB overuse hint).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-04 | papertek-vocabulary data gaps (markeres s-passiv, setningen NB bestemt form) | Papertek verbbank needs -s/-st forms added for ~675 NB verbs and ~620 NN verbs; st-verbs need `isDeponent: true` marking; vocab sync propagates to extension |
</phase_requirements>

## Standard Stack

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| Papertek vocabulary lexicon | `/Users/geirforbord/Papertek/papertek-vocabulary/vocabulary/lexicon/{nb,nn}/verbbank.json` | Source of truth for verb conjugation data | All vocab originates here; extension bundles via sync |
| vocab-seam-core.js | `extension/content/vocab-seam-core.js` | Builds lookup indexes (validWords, verbInfinitive, etc.) | Gateway between raw data and spell-check rules |
| spell-check-core.js | `extension/content/spell-check-core.js` | Rule runner with document-level post-pass | Existing infra for both token-level and document-level rules |
| spell-rules/*.js | `extension/content/spell-rules/` | Individual rule files (IIFE pattern) | One file per rule, self-registering via `__lexiSpellRules` |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| NN ordbank cache | `papertek-vocabulary/vocabulary/ordbank/cache/nn-lookup.json` | 235 inherent -ast/-st verbs with full conjugation slots | Reference for st-verb identification and conjugation patterns |
| NB ordbank cache | `papertek-vocabulary/vocabulary/ordbank/cache/nb-lookup.json` | 92 inherent -es/-s verbs | Reference for deponent verb identification |
| sync-vocab.js | `scripts/sync-vocab.js` | Pulls enriched data from Papertek API into extension/data/ | After Papertek enrichment, run `npm run sync-vocab` |

## Architecture Patterns

### New Rule File Structure

Two new rule files following established IIFE pattern:

```
extension/content/spell-rules/
  nb-nn-passiv-s.js       # Token-level: NN finite s-passive error detection
  doc-drift-nb-passiv-overuse.js  # Document-level: NB s-passive overuse hint
```

### Pattern 1: NN Finite S-Passive Detection (token-level rule)
**What:** When lang=nn, flag any s-passive form that is NOT preceded by a modal verb (kan, ma, skal, bor). Accept s-passive infinitive after modal. Flag finite s-passives as errors.
**Priority:** ~25 (above gender/15, below sarskriving/30) -- needs to fire before typo rules catch it as unknown.
**Languages:** `['nn']` only.

**Core logic:**
```javascript
// Token is an s-passive form (ends in -ast for NN, recognized via vocab index)
// Check: is the preceding token a modal? (kan, ma, skal, bor -- NOT vil)
// If modal precedes: ACCEPT (correct NN usage)
// If no modal precedes: FLAG as error, suggest bli/verte-passiv
const NN_PASSIV_MODALS = new Set(['kan', 'kunna', 'ma', 'matte', 'skal', 'skulle', 'bor', 'burde']);
// Note: 'vil' is EXCLUDED per Sprakradet -- it expresses personal will in NN, not future
```

### Pattern 2: NB S-Passive Overuse Detection (document-level rule)
**What:** When lang=nb and text contains >3 s-passive tokens, emit informational hints on the s-passive tokens suggesting active voice for clarity.
**Kind:** `'document'`
**Priority:** ~205 (document-level, alongside other doc-drift rules at 200+).
**Languages:** `['nb']` only.
**Severity:** `'info'` (not error or warning -- s-passive is grammatically correct in NB).

**Follows existing doc-drift pattern** (see `doc-drift-nb-register.js`):
```javascript
const rule = {
  id: 'doc-drift-nb-passiv-overuse',
  kind: 'document',
  languages: ['nb'],
  priority: 205,
  severity: 'info',
  check(ctx) { return []; },  // no-op in pass-1
  checkDocument(ctx, findings) {
    // Count s-passive tokens in text
    // If count > 3, flag each with informational hint
  }
};
```

### Pattern 3: St-Verb Recognition (deponent/reciprocal exclusion)
**What:** St-verbs (synast, finnast, trivast, etc.) are inherent -st verbs, NOT productive s-passives. They must be recognized and excluded from the NN finite s-passive rule.
**Implementation:** Lexical marking in Papertek data (`"isDeponent": true` on verbbank entries) + a Set in the rule file built from vocab data.

### Pattern 4: Vocab Data Enrichment for S-Passive Forms
**What:** Add s-passive conjugation forms to NB/NN verbbank entries in Papertek.
**NB s-passive generation:**
- Infinitive: bare_inf + 's' (skrive -> skrives; se -> ses)
- Presens: same as infinitive s-passive (skrives, leses, brukes)

**NN s-passive generation:**
- Infinitive only: bare_inf ending in -a -> add 'st' (skriva -> skrivast); ending in -e -> replace -e with 'ast' (skrive -> skrivast)
- No presens/preteritum s-passive forms in NN

**Data shape in verbbank entry:**
```json
{
  "word": "skrive",
  "conjugations": {
    "presens": {
      "former": {
        "infinitiv": "a skrive",
        "presens": "skriver",
        "preteritum": "skreiv",
        "perfektum_partisipp": "skrevet",
        "s_passiv_infinitiv": "skrives",
        "s_passiv_presens": "skrives"
      }
    }
  }
}
```

### Pattern 5: Vocab Seam Index for S-Passive Recognition
**What:** New lookup index in vocab-seam-core.js: `sPassivForms` Set or Map.
**Built in:** `buildLookupIndexes()` or a new `buildSPassivIndex(raw, lang)` function (parallels `buildParticipleToAux`, `buildMoodIndexes`).
**Shape:** `Map<string, { baseVerb: string, isDeponent: boolean }>` -- maps s-passive form to its base verb and deponent status.
**Wired through:** vocab-seam.js getter -> spell-check.js vocab object -> rule ctx.

### Anti-Patterns to Avoid
- **Do NOT generate s-passive forms at runtime in the rule file.** The forms must come from vocabulary data (data-logic separation principle). The rule file should only READ from a pre-built index.
- **Do NOT add s-passive forms to validWords via the rule file.** They must enter validWords through the normal vocab-seam pipeline (buildWordList -> buildLookupIndexes). The rule file only checks context.
- **Do NOT hardcode a st-verb list in the rule file.** Mark them in Papertek data with `isDeponent: true`; build a Set from data at index time.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| S-passive form generation | Runtime morphological rules in JS | Papertek vocabulary enrichment script | Data-logic separation; forms are language-specific with exceptions |
| St-verb identification | Hardcoded word list in rule file | `isDeponent` flag in Papertek verbbank | Maintainable; new st-verbs added in one place |
| Document-level counting | Custom text scanning in rule | `kind: 'document'` + `checkDocument(ctx, findings)` pattern | Existing infrastructure handles timing and dedup |
| Modal verb detection | New modal set per rule | Reuse MODAL_VERBS from nb-modal-verb.js pattern (but NN-specific subset) | Consistency; BUT note NN excludes `vil` unlike NB |

## Common Pitfalls

### Pitfall 1: vil Is NOT a Valid NN Passive Modal
**What goes wrong:** Including 'vil'/'ville' in the NN modal set for s-passive acceptance.
**Why it happens:** NB allows "vil skrives" but NN does not -- Sprakradet explicitly excludes `vil` because in NN it expresses personal will, not future tense.
**How to avoid:** Use a dedicated `NN_PASSIV_MODALS` set: `{kan, kunna, ma, matte, skal, skulle, bor, burde}`. Do NOT reuse the general MODAL_VERBS set from nb-modal-verb.js (which includes vil/ville/far/fikk/fekk).
**Source:** [Sprakradet: Aktiv og passiv pa nynorsk](https://sprakradet.no/godt-og-korrekt-sprak/praktisk-sprakbruk/nynorskhjelp/aktiv-og-passiv-pa-nynorsk/), [Nynorsksenteret](https://nynorsksenteret.no/blogg/aktiv-og-passiv-i-nynorsk)
**Confidence:** HIGH

### Pitfall 2: S-Passive Forms Not in validWords = Typo False Positives
**What goes wrong:** If Papertek enrichment is not done first, s-passive forms (skrives, lesast) get flagged as typos by nb-typo-fuzzy.js.
**Why it happens:** validWords is built from verbbank conjugation forms. No s-passive forms exist in current data.
**How to avoid:** Papertek data enrichment MUST be Plan 01. Sync vocab before implementing rules.
**Warning signs:** Fixtures passing in isolation but failing in integration because forms are unknown.

### Pitfall 3: St-Verbs Flagged as Finite S-Passives in NN
**What goes wrong:** "Ho synest at..." flagged as "wrong finite s-passive" because synest ends in -st.
**Why it happens:** Morphological overlap between st-verb conjugated forms and s-passive forms.
**How to avoid:** Build a `deponentVerbs` Set from Papertek data. Check deponent status BEFORE applying the NN finite s-passive rule. St-verbs get a pass.
**Warning signs:** Synast/finnast/trivast appearing in fixture failures.

### Pitfall 4: NB Overuse Threshold Too Aggressive for Short Texts
**What goes wrong:** A 2-sentence text with 4 s-passives triggers the hint, which feels annoying for a paragraph.
**How to avoid:** Consider a ratio-based threshold (e.g., >3 s-passives AND >20% of verbs are s-passive) or a minimum text length requirement.
**Recommendation:** Start with simple count >3, iterate based on feedback.

### Pitfall 5: Participle Agreement Scope Creep
**What goes wrong:** Trying to implement full NN participle agreement checking in this phase.
**Why it happens:** The user mentioned participle agreement (skriven/skrive/skrivne must agree with subject gender/number).
**How to avoid:** NN participle agreement requires subject gender detection (a hard NLP problem). For this phase, limit to: (a) accepting bli/verte + participle as valid, (b) flagging clearly wrong forms if data supports it. Full agreement checking is a stretch goal. The success criteria says "participle agreement in bli/verte-passive is checked" -- implement what the data supports, flag the rest as future work.
**Confidence:** MEDIUM -- this is the hardest part of the phase.

### Pitfall 6: Feature Gate Starvation for S-Passive Forms
**What goes wrong:** S-passive forms gated by grammar features, so they're missing from spell-check lookup indexes under default preset.
**Why it happens:** The same bug that hit Phase 05.1 -- buildLookupIndexes must use unfiltered superset.
**How to avoid:** S-passive forms should NOT be feature-gated (or should use their own feature like `grammar_nb_s_passiv`). Since they're added as conjugation forms in verbbank, they'll flow through the existing unfiltered-superset path in buildIndexes (line 1214 of vocab-seam-core.js). Verify with check-spellcheck-features gate.

### Pitfall 7: NB "ses"/"gås" Edge Cases
**What goes wrong:** Short verbs like "se" -> "ses", "ga" -> "gas" -- these are real words but rare/archaic.
**How to avoid:** Only generate s-passive for verbs where the result is >3 characters. Or accept that the ordbank already lists these inherent -s verbs separately.

## Code Examples

### New Rule File Pattern (NN Finite S-Passive)
```javascript
// Source: established IIFE pattern from nb-modal-verb.js
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  // NN-specific modal verbs that license s-passive infinitive.
  // Excludes 'vil' per Sprakradet: NN 'vil' = personal will, not future.
  const NN_PASSIV_MODALS = new Set([
    'kan', 'kunna',
    'ma', 'matte',
    'skal', 'skulle',
    'bor', 'burde',
  ]);

  const rule = {
    id: 'nn_passiv_s',
    languages: ['nn'],
    priority: 25,
    severity: 'error',
    explain(finding) {
      return {
        nb: `S-passiv kan berre brukast i infinitiv etter modalverb pa nynorsk. Bruk bli/verte-passiv i staden.`,
        nn: `S-passiv kan berre brukast i infinitiv etter modalverb pa nynorsk. Bruk bli/verte-passiv i staden.`,
      };
    },
    check(ctx) {
      const { tokens, vocab, lang } = ctx;
      if (lang !== 'nn') return [];
      const sPassivForms = vocab.sPassivForms || new Map();
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const info = sPassivForms.get(t.word);
        if (!info || info.isDeponent) continue;
        // Check if preceded by a modal (direct or with pronoun inversion)
        const prev = tokens[i - 1];
        const prev2 = tokens[i - 2];
        const hasModal = (prev && NN_PASSIV_MODALS.has(prev.word))
          || (prev2 && NN_PASSIV_MODALS.has(prev2.word));
        if (hasModal) continue; // Valid: modal + s-passive infinitive
        // No modal: flag as error
        out.push({
          rule_id: 'nn_passiv_s',
          priority: rule.priority,
          start: t.start,
          end: t.end,
          original: t.display,
          fix: null, // No auto-fix: suggest bli/verte-passiv in explain
          message: `S-passiv utan modalverb er feil pa nynorsk`,
        });
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### Document-Level NB Overuse Pattern
```javascript
// Source: established pattern from doc-drift-nb-register.js
const rule = {
  id: 'doc-drift-nb-passiv-overuse',
  kind: 'document',
  languages: ['nb'],
  priority: 205,
  severity: 'info',
  check(ctx) { return []; },
  checkDocument(ctx, findings) {
    if (ctx.lang !== 'nb') return [];
    const sPassivForms = ctx.vocab.sPassivForms || new Map();
    const hits = [];
    for (const t of ctx.tokens) {
      const info = sPassivForms.get(t.word);
      if (info && !info.isDeponent) hits.push(t);
    }
    if (hits.length <= 3) return [];
    // Flag each s-passive with informational hint
    return hits.map(t => ({
      rule_id: 'doc-drift-nb-passiv-overuse',
      priority: 205,
      start: t.start,
      end: t.end,
      original: t.display,
      fix: null,
      message: `Teksten har ${hits.length} s-passivformer. Vurder aktiv form for klarere sprak.`,
    }));
  },
};
```

### Vocab Seam Index Builder
```javascript
// Source: parallels buildParticipleToAux pattern (line 828 of vocab-seam-core.js)
function buildSPassivIndex(raw, lang) {
  const sPassivForms = new Map();
  if (!raw || !raw.verbbank) return sPassivForms;
  for (const entry of Object.values(raw.verbbank)) {
    const conj = entry.conjugations?.presens?.former;
    if (!conj) continue;
    const isDeponent = !!entry.isDeponent;
    // Collect all s-passive forms from conjugation data
    for (const key of ['s_passiv_infinitiv', 's_passiv_presens']) {
      const forms = conj[key];
      if (!forms) continue;
      const arr = Array.isArray(forms) ? forms : [forms];
      for (const f of arr) {
        sPassivForms.set(f.toLowerCase(), {
          baseVerb: entry.word,
          isDeponent,
        });
      }
    }
    // For st-verbs (NN): all forms are inherently -st, mark as deponent
    if (isDeponent) {
      for (const [fk, fv] of Object.entries(conj)) {
        const arr = Array.isArray(fv) ? fv : [fv];
        for (const f of arr) {
          if (typeof f === 'string') {
            sPassivForms.set(f.toLowerCase(), { baseVerb: entry.word, isDeponent: true });
          }
        }
      }
    }
  }
  return sPassivForms;
}
```

## Data Enrichment Plan (Papertek Vocabulary)

### NB Verbbank Enrichment
- **Scope:** ~675 verbs in NB verbbank
- **Add fields:** `s_passiv_infinitiv` and `s_passiv_presens` to `conjugations.presens.former`
- **Generation rule:** For verb with infinitive "a X": s_passiv = X + "s" (if X ends in -e, e.g., skrive -> skrives; se -> ses)
- **Exclude:** Inherent -s verbs already in verbbank (finnes, synes, lykkes, etc.) -- these already have their own entries
- **Script location:** New script in `papertek-vocabulary/scripts/enrich-nb-s-passive.js`

### NN Verbbank Enrichment
- **Scope:** ~620 verbs in NN verbbank (excluding existing st-verbs)
- **Add fields:** `s_passiv_infinitiv` only (no presens/preteritum s-passive in NN)
- **Generation rule:** For verb with infinitive "a X": if X ends in -a -> X + "st" (skriva -> skrivast); if X ends in -e -> X[:-1] + "ast" (skrive -> skrivast)
- **Exclude:** Existing st-verbs (synast, lykkast, finnast, etc.) -- these are deponent, not productive passives
- **Script location:** New script or extend `enrich-nn-complete.js`

### St-Verb / Deponent Marking
- **NB deponent verbs:** ~92 inherent -s verbs in ordbank (finnes, synes, lykkes, trives, etc.). Add `"isDeponent": true` to their verbbank entries.
- **NN st-verbs:** ~235 inherent -ast/-st verbs in ordbank (synast, finnast, trivast, etc.). Add `"isDeponent": true`.
- **Source:** ordbank cache has definitive lists.
- **High-priority st-verbs for students:** synast, finnast, trivast, lykkast, minnast, kjennast, moetast, slast (8 core st-verbs to mark first).

### Participle Agreement Data (NN)
- **Strong verbs (obligatory agreement):** Need participle forms in masculine/feminine/neuter/plural. Currently only one form stored (e.g., skrive_verb pp="skrive"). Would need: skriven (m), skriven (f), skrive (n), skrivne (pl).
- **Weak verbs (optional agreement):** a-verbs exempt from agreement (kasta stays kasta). e-verbs: optional.
- **Assessment:** Full participle agreement data is a significant enrichment effort. Recommend deferring to a later phase or implementing only for a curated list of ~20 high-frequency strong verbs.
- **Confidence:** MEDIUM -- this is the most complex data requirement.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No s-passive recognition | S-passive forms flagged as unknown words | Students writing "skrives" or "lesast" get typo flags |
| No deponent marking | St-verbs treated same as regular verbs | No way to distinguish productive passives from inherent st-verbs |
| No NN passive rule | No passive voice guidance for NN | Students mix NB passive patterns into NN text |

## Open Questions

1. **Participle agreement depth**
   - What we know: Strong verb participles must agree in NN (skriven/skrive/skrivne). a-verbs exempt. Weak e-verbs optional.
   - What's unclear: How many strong verbs need full agreement data? Do we have the data in ordbank?
   - Recommendation: Implement basic participle acceptance (any participle form after bli/verte is valid) and defer full agreement checking to a future phase. Mark as partial implementation of success criteria 5.

2. **NB overuse threshold tuning**
   - What we know: >3 s-passives triggers hint.
   - What's unclear: Is this too aggressive for very short texts? Too lenient for long texts?
   - Recommendation: Start with flat count >3, add minimum text-length guard (e.g., >50 words). Tune based on feedback.

3. **Papertek deployment timing**
   - What we know: Data enrichment must happen in papertek-vocabulary first, then sync.
   - What's unclear: Does the Papertek API need redeployment, or does sync-vocab.js read directly from lexicon files?
   - Recommendation: Check if sync reads from API (needs deploy) or from local files (just run sync). Based on sync-vocab.js line 29, it reads from the API at `papertek-vocabulary.vercel.app` -- so Papertek changes must be deployed before sync.

## Sources

### Primary (HIGH confidence)
- [Sprakradet: Aktiv og passiv pa nynorsk](https://sprakradet.no/godt-og-korrekt-sprak/praktisk-sprakbruk/nynorskhjelp/aktiv-og-passiv-pa-nynorsk/) - Official NN passive rules
- [Nynorsksenteret: Aktiv og passiv i nynorsk](https://nynorsksenteret.no/blogg/aktiv-og-passiv-i-nynorsk) - St-verb distinction, vil exclusion, participle agreement
- Codebase: vocab-seam-core.js (buildLookupIndexes, buildParticipleToAux patterns)
- Codebase: doc-drift-nb-register.js (document-level rule pattern)
- Codebase: nb-modal-verb.js (token-level rule pattern)

### Secondary (MEDIUM confidence)
- NN ordbank cache: 235 inherent -ast/-st verbs confirmed
- NB ordbank cache: 92 inherent -es/-s verbs confirmed
- Wikipedia nn: Samsvarsboeying - mandatory for strong verbs post-2012

### Tertiary (LOW confidence)
- NB overuse threshold (>3) - user decision, not linguistically validated
- Participle agreement scope - needs further investigation of ordbank participle slots

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components exist and are well-documented in codebase
- Architecture: HIGH - follows established patterns (IIFE rules, doc-drift, vocab-seam indexes)
- Data enrichment: HIGH - ordbank has source data, generation rules are mechanical
- NN passive rules: HIGH - verified against Sprakradet official documentation
- Participle agreement: MEDIUM - rules clear but data availability uncertain
- NB overuse threshold: MEDIUM - simple implementation, tuning needed

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable domain, no fast-moving dependencies)
