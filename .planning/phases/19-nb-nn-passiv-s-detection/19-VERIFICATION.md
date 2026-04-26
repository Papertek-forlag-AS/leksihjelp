---
phase: 19-nb-nn-passiv-s-detection
verified: 2026-04-26T17:10:00Z
status: passed
score: 7/7 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "NN finite s-passive presens forms (lesest, skrivest, byggest) derived algorithmically in buildSPassivIndex and present in sPassivForms index"
    - "NN deponent/reciprocal st-verbs (moetast, finnast, trivast, synast, lykkast, minnast, kjennast, slaast) overridden to isDeponent: true via NN_DEPONENTS set"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify NB overuse hint renders in browser"
    expected: "When a NB text with 4+ s-passives is typed, a dotted underline hint appears on each s-passive token"
    why_human: "Document-drift rules run in a second pass in the browser; render behaviour requires a live extension"
  - test: "Verify NN modal + s-passive acceptance in browser"
    expected: "Typing 'Boka kan lesast' in a NN text field produces no error underlines on 'lesast'"
    why_human: "Full browser tokenizer needed to confirm modal lookup across real token boundaries"
---

# Phase 19: NB/NN Passiv-s Detection Verification Report

**Phase Goal:** Students get passiv-s guidance — NB overuse reminders, NN strict finite/infinitive rules, st-verb recognition, and participle agreement checking
**Verified:** 2026-04-26T17:10:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (Plan 19-03)

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NB: s-passive forms (skrives, leses) accepted as valid words, not flagged as typos | VERIFIED | `nbIdx.validWords.has('skrives') === true`, `nbIdx.validWords.has('leses') === true`. NB verbbank has 648 entries with s_passiv_infinitiv and s_passiv_presens; forms are in validWords so the typo rule skips them. |
| 2 | NB: when text has >3 s-passives, informational hint suggests active voice | VERIFIED | `doc-drift-nb-passiv-overuse.js` counts non-deponent s-passive tokens, triggers at >3. Wired in manifest.json line 90. |
| 3 | NN: finite s-passive "Boka lesest av mange" is flagged as error | VERIFIED | `lesest` is in sPassivForms with `{ baseVerb: "lese", isDeponent: false }`. Derived algorithmically by `buildSPassivIndex`: strips `-ast` suffix from `lesast`, appends `-est`. Fixture nn-passiv-s-004 passes at P=1.000 R=1.000. |
| 4 | NN: s-passive after modal in infinitive "Boka kan lesast" accepted as correct | VERIFIED | Rule checks for preceding modal in NN_PASSIV_MODALS. `lesast` with preceding `kan` produces no finding. Fixture nn-passiv-s-accept-001 passes. |
| 5 | NN: bli/verte + participle forms accepted as valid passive constructions | VERIFIED | `nn_passiv_s` rule only triggers on tokens present in sPassivForms. Participle forms are not s-passive forms and cannot be flagged. |
| 6 | NN: st-verbs (moetast, synast, trivast, finnast) recognised as deponent, not flagged | VERIFIED | All four have `isDeponent: true` in sPassivForms. `NN_DEPONENTS` override set corrects verbbank entries where isDeponent was false (moetast, finnast) and injects entries absent from verbbank (trivast). Fixtures accept-006/007/008 all pass. |
| 7 | All existing release gates pass with no regressions | VERIFIED | All 8 gates pass: check-fixtures 14/14 nn/passiv-s (exit 0), check-explain-contract 58/58 (exit 0), check-rule-css-wiring 58/58 (exit 0), check-network-silence (exit 0), check-spellcheck-features (exit 0), check-bundle-size 12.59 MiB under 20 MiB cap (exit 0), check-benchmark-coverage 40/40 (exit 0), check-governance-data 116 entries (exit 0). |

**Score:** 7/7 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/vocab-seam-core.js` | buildSPassivIndex with -ast to -est derivation and NN_DEPONENTS override | VERIFIED | NN_DEPONENTS set at line 855; -est derivation block at lines 879-887; deponent override loop at lines 910-927 |
| `extension/data/nb.json` | NB bundled vocab with s_passiv_infinitiv, s_passiv_presens, isDeponent | VERIFIED | 648 entries with s_passiv_infinitiv and s_passiv_presens; sPassivForms index size 644 |
| `extension/data/nn.json` | NN bundled vocab with s_passiv_infinitiv (presens derived algorithmically) | VERIFIED | 435 entries with s_passiv_infinitiv; finite presens forms derived at index-build time — no data round-trip needed |
| `extension/content/vocab-seam.js` | getSPassivForms getter | VERIFIED | Getter wires state.sPassivForms into the VOCAB surface |
| `extension/content/spell-check.js` | sPassivForms in ctx.vocab | VERIFIED | `sPassivForms: VOCAB.getSPassivForms()` present |
| `extension/content/spell-rules/nb-nn-passiv-s.js` | NN finite s-passive detection (priority 25) | VERIFIED | 93 lines, id: nn_passiv_s, priority 25, severity: error |
| `extension/content/spell-rules/doc-drift-nb-passiv-overuse.js` | NB document-level overuse hint (priority 205) | VERIFIED | 84 lines, id: doc-drift-nb-passiv-overuse, kind: document, priority 205, severity: hint |
| `fixtures/nn/passiv-s.jsonl` | 14-case fixture suite including finite presens and deponent cases | VERIFIED | 14 fixture cases: 6 positive (3 infinitive + 3 derived -est presens), 8 acceptance (modal + deponent). All pass P=1.000 R=1.000 F1=1.000. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| vocab-seam-core.js | extension/data/nn.json | buildSPassivIndex reads s_passiv_infinitiv, derives -est presens | VERIFIED | -est derivation active for lang==='nn' when s_passiv_presens absent from data |
| vocab-seam-core.js | NN_DEPONENTS set | Override loop corrects isDeponent: false entries and injects missing entries | VERIFIED | moetast/finnast overridden from false; trivast injected as absent from verbbank |
| vocab-seam.js | vocab-seam-core.js | getSPassivForms getter reads state.sPassivForms | VERIFIED | Pattern matches existing getters |
| spell-check.js | vocab-seam.js | vocab object wires VOCAB.getSPassivForms() into ctx.vocab.sPassivForms | VERIFIED | Present in vocab object |
| nb-nn-passiv-s.js | vocab.sPassivForms | ctx.vocab.sPassivForms Map lookup | VERIFIED | sPassivForms.get(t.word) used in check() |
| doc-drift-nb-passiv-overuse.js | vocab.sPassivForms | ctx.vocab.sPassivForms Map lookup in checkDocument | VERIFIED | ctx.vocab.sPassivForms used in checkDocument |
| manifest.json | spell-rules/*.js | content_scripts js array includes both new rule files | VERIFIED | nb-nn-passiv-s.js at line 54, doc-drift-nb-passiv-overuse.js at line 90 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DEBT-04 | 19-01, 19-02, 19-03 | papertek-vocabulary data gaps: mark s-passiv forms, NN finite detection | SATISFIED | NB and NN s-passive forms fully indexed. NN finite presens detection implemented algorithmically in Plan 19-03. The "setningen NB bestemt form" component of DEBT-04 addresses NB bestemt form grammar — a separate concern out of scope for Phase 19. All s-passive-related DEBT-04 items resolved. |

### Anti-Patterns Found

None blocking goal achievement.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension/content/spell-rules/doc-drift-nb-passiv-overuse.js` | 38 | `return []` in check() | Info | Intentional — document-level rule, no-op in pass-1 check. checkDocument() has full implementation. |

### Human Verification Required

#### 1. NB overuse hint renders in browser

**Test:** Type a NB sentence with 4 or more s-passive verb forms (e.g., "Saken behandles og skrives av alle og leses og sendes videre") into a text field with the extension active.
**Expected:** Dotted underline appears on each s-passive token; hovering shows a hint about active voice.
**Why human:** Document-drift rules run in a second pass only in the browser; CSS rendering of the dotted hint requires a live extension context.

#### 2. NN modal + s-passive acceptance in browser

**Test:** Type "Boka kan lesast" in a NN text field with extension active.
**Expected:** No error underline on "lesast".
**Why human:** Full browser tokenizer needed to confirm modal lookup across real token boundaries.

### Gap Closure Summary

**Gap 1 — NN finite presens detection: CLOSED**

Plan 19-03 added algorithmic derivation in `buildSPassivIndex`: when `lang === 'nn'` and a verbbank entry has `s_passiv_infinitiv` but no `s_passiv_presens`, the function strips the `-ast` suffix and appends `-est`. This is safe because NN s-passive presens is always `stem + est`. `lesest`, `skrivest`, and `byggest` are now in the index with `isDeponent: false`. The exact ROADMAP SC-3 example "Boka lesest av mange" now triggers `nn_passiv_s`. Confirmed by node spot-check (`lesest: {"baseVerb":"lese","isDeponent":false}`) and fixture nn-passiv-s-004 (P=1.000 R=1.000).

**Gap 2 — NN deponent coverage: CLOSED**

Plan 19-03 added `NN_DEPONENTS` — a hardcoded Set of known NN reciprocal/deponent st-verbs (`møtast, synast, trivast, finnast, lykkast, minnast, kjennast, slåast`). After the main verbbank loop, entries with `isDeponent: false` in the Map (moetast, finnast) are overridden to `true`; entries absent from the verbbank entirely (trivast) are injected directly. Derived `-est` presens forms for deponent verbs are also marked deponent. All four ROADMAP SC-6 examples confirmed by node spot-check and fixtures accept-006 (moetast infinitive), accept-007 (finnast), accept-008 (moetast in sentence context).

---

_Verified: 2026-04-26T17:10:00Z_
_Verifier: Claude (gsd-verifier)_
