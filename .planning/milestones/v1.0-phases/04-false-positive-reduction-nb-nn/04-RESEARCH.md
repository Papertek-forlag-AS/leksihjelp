# Phase 4: False-Positive Reduction on NB/NN — Research

**Researched:** 2026-04-20
**Domain:** Heuristic spell-check false-positive suppression inside an MV3 content-script rule registry (proper-noun guard, cross-dialect tolerance, code-switching density heuristic, særskriving precision/recall calibration)
**Confidence:** HIGH

## User Constraints

**No CONTEXT.md exists yet** for Phase 4 (`.planning/phases/04-false-positive-reduction-nb-nn/` contains only `.gitkeep`). The planner should run `/gsd:discuss-phase 04` before planning if any of the Open Questions below need locking. In the meantime, this RESEARCH.md is constrained by what's already locked at the milestone level.

### Locked Decisions (from ROADMAP.md Phase 4 + PROJECT.md + REQUIREMENTS.md)

- **Phase requirement IDs:** SC-02 (proper-noun + loan-word guard), SC-03 (NB↔NN dialect tolerance), SC-04 (code-switching density heuristic), SC-05 (særskriving production-quality P/R thresholds).
- **Zero new runtime npm dependencies.** Enforced by `scripts/check-network-silence.js` (SC-06 gate) on every release. All work is vanilla JS / JSON sidecars / inline heuristics.
- **Offline only.** No fetch of loan-word lists, language-ID models, or anything else. Anything needed at runtime ships in `extension/data/` or lives inline in a rule file.
- **Heuristic only.** No ML, no language-ID libraries. STACK.md forbids Hunspell, spellchecker-wasm, cld3, franc, etc.
- **Spell-check stays NB/NN only in v1.** SC-06 preserved — no Phase-4 rule may fire on non-NB/NN content language.
- **Rule-plugin architecture (INFRA-03) is load-bearing.** Phase 4's new rules go into `extension/content/spell-rules/` as self-registering IIFE files. Zero edits to `spell-check-core.js` or `spell-check.js` for rule additions. ROADMAP.md parallelization note: "Phase 4's SC-02, SC-03, SC-04 are independent rule files under the Phase 3 plugin architecture and can execute as parallel plans."
- **Bundle-size 20 MiB engineering ceiling.** Phase 02.1 raised from 10 MiB; current zip 10.12 MiB / 9.88 MiB headroom. Phase 4 sidecar additions (loan-word list, optional proper-noun list) expected to be ≤50 KB each gzipped — well under headroom.
- **Fixture is ground truth, not snapshot** (fixtures/README.md Pitfall 6). New fixture cases assert what a well-calibrated tool *should* return, not what today's tool returns.
- **Data-quality fixes happen at `papertek-vocabulary` source**, not client-side (CLAUDE.md policy). If Phase 4 surfaces dialect-collision or noun-gender data bugs, file them to the sibling repo; don't patch in-extension.
- **The `state.freq` Map is populated end-to-end now** (Phase 03.1 closed the browser-wiring gap). Phase 4 rules may assume `vocab.freq.get(word)` returns a Zipf number for NB/NN and `undefined` for everything else.
- **SC-05 threshold values are to be set during Phase 4.** Phase 1 CONTEXT explicitly deferred numeric threshold *values* to Phase 4; the threshold *mechanism* (per-rule P/R/F1 computation) already ships in `scripts/check-fixtures.js`.

### Claude's Discretion (planner may choose, should confirm via discuss if uncertain)

- **Rule file naming + priority numbers** (recommend `nb-propernoun-guard.js` priority 5, `nb-dialect-tolerance.js` priority 3, `nb-codeswitch.js` priority 1 — see Architecture Patterns).
- **Exact loan-word list size** — recommend 150–400 curated NB/NN loans, shipped as inline `const LOAN_WORDS = new Set([...])` inside the proper-noun-guard rule file OR as a JSON sidecar. Inline has zero-load-step overhead; sidecar is easier to regenerate. Recommend inline for Phase 4 (well under 10 KB even at 400 entries); promote to sidecar if it grows past ~1000.
- **Proper-noun name list** — we do NOT ship a curated Norwegian-names list (would be bulky and culturally biased). The guard stays heuristic-only: capitalization + two-consecutive-caps + per-user `chrome.storage.local` ignore list (optional v1-polish ask, can defer to Phase 5).
- **Density heuristic thresholds** for SC-04 (e.g., ≥3 contiguous unknowns within 5 tokens → suppress whole span). Recommend starting 3-unknown-window-of-5 based on research; tune against fixture cases authored in Phase 4.
- **Whether SC-04 is a rule (sits alongside the others and vetoes), a core-runner feature (applied to every rule's output), or a pre-pass suppression that strips tokens before the typo rule runs.** Recommend pre-pass suppression as a new rule file `nb-codeswitch.js` with priority 1 (runs before any other rule), that annotates `ctx.suppressed: Set<tokenIndex>` on the ctx — the other rules opt in by checking `ctx.suppressed.has(i)` and skipping. This keeps INFRA-03 clean (still a rule, still self-contained) and the other rules get the benefit without core edits.
- **SC-05 threshold values** — must be calibrated to fixture expansion. Recommend: P ≥ 0.90 (few false flags on correct pairs), R ≥ 0.60 (catch majority of real særskriving — some require semantic/sentence context we don't have). Lock the exact values during planning after expanding the særskriving fixture.
- **Whether to enforce the thresholds by making `check-fixtures.js` exit 1 when per-rule P/R drops below the bar** — recommend YES for `sarskriving` only in Phase 4 (SC-05's explicit ask); don't threshold the other rules yet (would gate releases on noise if other rules drift slightly during Phase 5 UX work).
- **Whether to add an `ignored_words` allowlist read from `chrome.storage.local`** — recommend deferring to Phase 5 (a "never flag this word again" popover button is UX-01/UX-02 territory).

### Deferred Ideas (OUT OF SCOPE for Phase 4)

- **å/og detector / homophone pairs beyond the v1 set** — SC-07, SC-08 (v2 requirements per REQUIREMENTS.md:53-54; memory note `project_aa_og_grammar_check.md` explicitly bans the naive approach).
- **Phonetic-hash scoring** — SC-07 (v2). Dyslexia-specific multi-letter errors (`skjåle → skåle`) out of scope.
- **DE/ES/FR/EN spell-check** — SC-10 (v2); NB/NN-only is a milestone constraint.
- **UX work on suggestions popover** (copy, top-3 cap, "vis flere") — Phase 5 (UX-01, UX-02).
- **Explicit curated per-user allowlist UI** — UX-05 (v2).
- **Paragraph / cross-sentence grammar analysis** — explicitly Out of Scope in REQUIREMENTS.md:82.
- **Per-entry dialect tagging in `papertek-vocabulary`** — PITFALLS.md Pitfall 3 suggests this as an idealized fix; cross-app schema change is out of scope for a single leksihjelp phase. Phase 4 solves SC-03 with a client-side symmetric cross-dialect lookup instead (cheaper, reversible, no schema coupling).
- **Live Chrome unit / e2e harness (Puppeteer / Playwright)** — not introduced by this phase; fixture + manual Chrome smoke test continues to own browser coverage.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SC-02 | Expanded proper-noun and loan-word guard reduces false positives — capitalized words outside sentence-start, known loan-word list, common proper-noun patterns do not get flagged | Pattern 1 (Proper-noun + loan-word guard as a new rule file `nb-propernoun-guard.js` with priority 5, runs before the typo rules and marks tokens as `ctx.suppressed`). Existing `isLikelyProperNoun` in `spell-check-core.js:97` is the starting point — Phase 4 extends with: (a) consecutive-capitalized name spans, (b) curated NB/NN loan-word Set, (c) all-caps tokens (>2 chars), (d) hyphenated compound with ≥1 capitalized component. Empirical probe in this research: `Jeg bor i Kristiansand` already passes (cap mid-sentence — isLikelyProperNoun works), but `Hun heter anne` fires `anne → annen` (lowercased name at clause boundary not handled). Fixture adds a 500-word NB news article clean case. |
| SC-03 | NB↔NN dialect tolerance — a word valid in the other variant is not flagged as a typo; tolerant matching uses cross-variant lookup | Pattern 2 (Cross-dialect validWords lookup at seam-build time). Empirical probe in this research: NB vocab data today already contains `ikkje`, `berre`, `jeg` by accident — they live as cross-links or duplicate entries. But `eg` (NN pronoun) is ABSENT from NB.validWords, `tull`, `anne` leak to fuzzy matcher. Clean solution: during `buildIndexes` for NB, also load the NN wordList lowercased into a new index `sisterValidWords` and vice versa. The fuzzy rule early-exits when `vocab.sisterValidWords.has(t.word)` — "this isn't NB, but it IS valid NN, so stay silent." Additive seam change; no schema break. |
| SC-04 | Code-switching tolerance — when a contiguous span of tokens matches a non-Norwegian language pattern, the span is excluded from flagging via density heuristic | Pattern 3 (Density pre-pass `nb-codeswitch.js` priority 1). Two-sweep heuristic: (1) mark tokens unknown-to-both-dialects (not in NB validWords AND not in NN sisterValidWords AND not a likely proper noun); (2) whenever a sliding window of 5 tokens contains ≥3 such unknowns, suppress EVERY token in that window — including the ones that WOULD have been flagged by typo rules. Populates `ctx.suppressed: Set<tokenIdx>`. Typo rules (curated + fuzzy) skip-if-suppressed. Rules that flag correct-Norwegian grammar (gender, modal, sarskriving) run regardless — if `Ich will sein ein` lands between two perfectly-correct NB sentences, we still don't want to apply modal-form to English `will sein`. Easier: all rules opt into ctx.suppressed. Empirical probe: `Han sa Ich will sein ein` flagged `will→vill, sein→stein` today; after suppression should flag neither. |
| SC-05 | Production-quality særskriving detection — the `sarskriving` rule passes fixture's target P/R thresholds | Pattern 4 (Fixture expansion + threshold gate). Current fixture: 11 positive + 5 acceptance NB cases, 11 + 5 NN. Phase 4 expands to ≥30 positive + ≥15 acceptance each lang, authored from real learner corpora (Korrekturavdelingen.no "Særskriving" page enumerates dozens) + deliberate sarskriving near-misses (`stor by`, `god venn` must NOT flag even though they're noun+noun adjacent). Threshold decision locks in planning after authoring. Gate mechanism: `scripts/check-fixtures.js` already computes P/R/F1 per rule-id per lang; add an opt-in threshold table (`THRESHOLDS[lang][rule_id] = { P: 0.90, R: 0.60 }`) that, when set, fails exit code if per-rule metrics dip below. Apply to `sarskriving` only in Phase 4; don't blanket other rules yet. |
</phase_requirements>

## Summary

Phase 4 is the "keep the tool quiet" phase. All four requirements (SC-02/03/04/05) are about reducing false positives, not about adding new detection. The foundation is already in place: INFRA-03 rule registry (Phase 3 Plan 02) makes each new concern a single file drop-in; the fuzzy rule's `isLikelyProperNoun` (Phase 1) is already running and catches mid-sentence capitalized tokens; Zipf data is wired through the browser adapter (Phase 03.1); `check-fixtures.js` already computes per-rule P/R/F1. The Phase 4 work is adding **three new rule files** (proper-noun/loan-word guard, cross-dialect tolerance, code-switching density), **one seam enhancement** (load the other variant's wordList into a `sisterValidWords` index during NB/NN buildIndexes), **fixture expansion** (≥30 positive + ≥15 acceptance særskriving cases per language, plus ≥500-word NB news clean case, plus dialect-tolerance cases in both directions, plus a code-switching multi-token span case), and **threshold gating** on the særskriving rule's P/R in the fixture runner.

Empirical probe (run during this research — see Code Examples section 1) confirms the current defect classes precisely:

- **SC-02:** Mid-sentence capitalized names (`Kristiansand`, `Anne Grethe`) already pass; lowercase proper nouns (`anne`, English names written lowercase) still leak; loan words whose target vocab neighbors within edit-distance 1 (e.g., `brown→broen`, `sein→stein`, `will→vill`) get flagged.
- **SC-03:** NB data contains partial NN coverage accidentally (`ikkje`, `berre`, `jeg` are all present in `validWords` today) but it's not systematic — `eg` isn't, and neither is most of the NN inflection space. A cross-dialect guard at the seam is additive and robust.
- **SC-04:** `Han sa Ich will sein ein` produces `will→vill, sein→stein` today — exactly the code-switching flag-forest PITFALLS.md warns about.
- **SC-05:** `stor by` and `god venn` must NEVER flag; `fot ball` must ALWAYS flag. Phase 1's particle blocklist handles the common false-positive class (articles/prepositions). The tricky cases are noun+noun near-misses (`matte bok` flags as `mattebok`; `god venn` stays silent). Fixture expansion will surface whether precision on adjective+noun stays clean as the dictionary grows.

**Primary recommendation:** Four parallel-ready plans. (1) Author new rule file `nb-codeswitch.js` priority 1, populates `ctx.suppressed` via density heuristic; existing rules opt in by checking the suppression set. (2) Author new rule file `nb-propernoun-guard.js` priority 5, expands proper-noun detection with consecutive-caps / all-caps / hyphenated patterns and a curated loan-word Set. (3) Seam edit: add `sisterValidWords` to `buildIndexes` output for nb/nn (pulls the other variant's wordList at build time), expose via `VOCAB.getSisterValidWords()`, wire into runCheck adapter — pattern mirrors Phase 03.1. (4) Fixture authoring + SC-05 threshold gate — one plan that owns all new fixture files (proper-noun news article clean case, loan-word clean cases, dialect-tolerance cases both directions, code-switching span cases, expanded særskriving positives + acceptances) and adds the thresholds table to `check-fixtures.js`. Plans 1–3 modify rule/seam code; Plan 4 is fixture + gate only. All four can land in one wave once Plan 3 (seam) is merged, since Plans 1 + 2 depend on `sisterValidWords` being present.

## Standard Stack

Phase 4 adds **zero** npm packages. All work is vanilla JS / Node built-ins.

### Core (unchanged, already in place)

| Technology | Version | Purpose | Why Standard |
|---|---|---|---|
| Vanilla JS (ES2022+) | — | Rule IIFE files, core edits, seam edits | Project standard; no build step |
| Bounded Damerau-Levenshtein | local | Edit-distance with early abort | Already shipping in `spell-check-core.js:116` + shadow copy in `nb-typo-fuzzy.js` |
| JSON sidecars | `freq-{lang}.json`, `bigrams-{lang}.json` | Ranking / frequency signals | Shipping in `extension/data/`; loaded by the seam |
| Dual-export IIFE pattern | `self.__lexi*` + `module.exports` | Browser + Node reuse | Already applied to `vocab-seam-core.js`, `spell-check-core.js`, all rule files |
| Chrome MV3 content_scripts | manifest load order | Rule-file registration mechanism | Registry pattern locked in Phase 3 Plan 02 |
| Node 18+ | — | `scripts/check-fixtures.js` + build scripts | Already in use; Phase 3.1 adapter-contract guard uses it |

### Additions (this phase)

| Component | Purpose | Integration |
|---|---|---|
| `extension/content/spell-rules/nb-codeswitch.js` | Pre-pass density heuristic, populates `ctx.suppressed` | New IIFE file, priority 1, mutates ctx; other rules read the set |
| `extension/content/spell-rules/nb-propernoun-guard.js` | Extended proper-noun + loan-word guard, populates `ctx.suppressed` with name/loan spans | New IIFE file, priority 5 (after codeswitch, before any typo-class rule) |
| `VOCAB.getSisterValidWords()` + `state.sisterValidWords` Set | Cross-dialect tolerance — NB→NN validWords (or vice versa) exposed to rules via `vocab.sisterValidWords` | Seam edit: load the other variant's bundled JSON during NB/NN buildIndexes; Set contains lowercased words. Size ~15k × 2 — no overhead worth mentioning. |
| `scripts/check-fixtures.js` threshold gate | SC-05 — fail if `sarskriving` P < 0.90 or R < 0.60 | Add a `THRESHOLDS` table; when the current run's per-rule P/R dips below, exit 1 with a clear diagnostic |
| Fixture expansion | New cases for SC-02/03/04 + ≥30 positive + ≥15 acceptance cases per lang for SC-05 | Hand-authored JSONL additions to existing `fixtures/{nb,nn}/*.jsonl` + optional new file `fixtures/{nb,nn}/codeswitch.jsonl` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Curated loan-word Set inline in `nb-propernoun-guard.js` | JSON sidecar `extension/data/loans-{nb,nn}.json` | Set is 150-400 entries (~5-10 KB). Inline keeps load-step simple and co-locates data with the logic that owns it. Promote to sidecar if the list grows past 1000 entries OR if both `nb-propernoun-guard.js` and some other consumer need it. |
| Cross-dialect `sisterValidWords` built at seam | Load both NB + NN vocab always, intersect at rule eval time | Seam-time is O(1) in rule evaluation and reuses the existing loader. Rule-time would re-walk NB vocab on every check — wasted work. |
| Density heuristic as a rule file that produces `suppressed` | Density heuristic lives in `spell-check-core.js:check` runner | Runner-level mutation would violate INFRA-03's "adding a concern = new file" contract. The rule-file pattern keeps the core generic and adds one more node to the priority chain. |
| cld3 / franc / other language-ID library | Loan-word/sister-validwords membership lookups | Any third-party language-ID library adds bundle bytes + a fetch-on-first-use pattern; violates SC-06. Density heuristic on "token is unknown to BOTH NB and NN" is good enough for the >3-contiguous-unknowns case the criterion asks for. |
| Character-feature language detector (umlauts + non-Norwegian sequences) | Vocab-membership lookup | Character heuristic is weaker than membership lookup: `Ich` has no umlauts but is obviously not NB. Vocab membership generalizes. |
| Threshold gate as a separate `scripts/check-thresholds.js` gate | Add to existing `scripts/check-fixtures.js` | Thresholds are metadata about fixture results — they belong next to the fixture runner, not in a second tool. Pattern precedent: `check-fixtures.js` Pitfall 2 guard and adapter-contract assertion both live inline (03.1 pattern). |
| One big plan | 4 parallel plans | ROADMAP.md explicitly calls out "Phase 4's SC-02, SC-03, SC-04 are independent rule files" — authorial parallelism. Plans 1-2 depend on Plan 3's `sisterValidWords` seam addition for correctness; Plan 4 (fixtures + gate) reviews Plans 1-3 and closes. |

**Installation:** none required. Verify via `npm run check-fixtures && npm run check-network-silence && npm run check-bundle-size`.

## Architecture Patterns

### Recommended Project Structure (post-Phase 4)

```
extension/
├── content/
│   ├── vocab-seam-core.js          # EDIT — adds sisterValidWords to buildIndexes return
│   ├── vocab-seam.js               # EDIT — loads sister-variant vocab during NB/NN; adds getSisterValidWords()
│   ├── spell-rules/                # Phase 3 plugin registry
│   │   ├── nb-codeswitch.js        # NEW — priority 1, populates ctx.suppressed (density heuristic)
│   │   ├── nb-propernoun-guard.js  # NEW — priority 5, expands proper-noun + loans, populates ctx.suppressed
│   │   ├── nb-gender.js            # UNCHANGED (does NOT read ctx.suppressed — gender is grammar, not typo)
│   │   ├── nb-modal-verb.js        # UNCHANGED (does NOT read ctx.suppressed — same rationale)
│   │   ├── nb-sarskriving.js       # EDIT — reads ctx.suppressed to skip inside code-switched spans
│   │   ├── nb-typo-curated.js      # EDIT — reads ctx.suppressed
│   │   └── nb-typo-fuzzy.js        # EDIT — reads ctx.suppressed
│   └── spell-check.js              # EDIT — adds `sisterValidWords: VOCAB.getSisterValidWords()` to runCheck vocab literal
├── data/
│   ├── freq-{nb,nn}.json           # unchanged
│   ├── bigrams-{nb,nn}.json        # unchanged
│   └── (no new data files — loan words inline in nb-propernoun-guard.js)
└── manifest.json                   # EDIT — insert new spell-rules/*.js BEFORE existing ones (priority order)

fixtures/
├── nb/
│   ├── clean.jsonl                 # EDIT — append ≥1 ≥500-word real news article case; loan-word clean cases; proper-noun clean cases
│   ├── saerskriving.jsonl          # EDIT — expand to ≥30 positive + ≥15 acceptance
│   ├── typo.jsonl                  # EDIT — add "must not flag" cases for dialect tolerance (eg, berre, ikkje…)
│   └── codeswitch.jsonl            # NEW — ≥10 cases covering ≥3 contiguous non-Norwegian tokens
├── nn/ (mirror)
└── README.md                        # EDIT — document ctx.suppressed convention + codeswitch.jsonl

scripts/
└── check-fixtures.js               # EDIT — add THRESHOLDS table; fail exit on sarskriving P<0.90 or R<0.60
```

### Pattern 1: Pre-pass Suppression via `ctx.suppressed` Set (SC-02, SC-04)

**What:** The rule-registry runner in `spell-check-core.js` already builds one `ctx` object and passes it to every rule. Phase 4 adds a *convention* that the ctx has a mutable `suppressed: Set<tokenIndex>` property. Low-priority rules (codeswitch=1, propernoun-guard=5) inspect tokens and add their indices to the set. Subsequent rules (any typo-class rule: curated=40, fuzzy=50; also sarskriving=30) opt into the suppression by checking `ctx.suppressed.has(i)` inside their per-token loop.

Gender and modal-form rules **do not opt in** — they fire on real-Norwegian grammar patterns. If a user genuinely types `en Kristiansand` (wrong-gender article + proper noun), the gender rule should still flag the article; the proper-noun guard keeps the NOUN from being fuzzy-flagged as a typo but doesn't mask the gender mismatch. Similarly, if the code-switched span happens to look like a modal+finite-verb pattern in Norwegian, the modal rule can still fire — though in practice the density heuristic + proper-noun guard between them catch most of this.

**When to use:** Any cross-cutting false-positive suppression that multiple typo-class rules should share. The pattern keeps INFRA-03 clean (every concern is a file; no core edits) and keeps the chain of responsibility explicit (runner passes ctx; rules mutate it or read it).

**Example — runner-side: no change needed** (already passes `ctx` through):

```javascript
// extension/content/spell-check-core.js — line 68 is already this:
const ctx = { text, tokens, vocab: vocabRef, cursorPos, lang };
// Phase 4 adds `suppressed: new Set()` inline:
const ctx = { text, tokens, vocab: vocabRef, cursorPos, lang, suppressed: new Set() };
```

Or (cleaner — keeps the convention inside `ctx` without core knowing the set's intent):

```javascript
// Phase 4 — convention lives in the first-running rule file:
// extension/content/spell-rules/nb-codeswitch.js (priority 1) initializes:
check(ctx) {
  ctx.suppressed = ctx.suppressed || new Set();
  // … density heuristic populates ctx.suppressed.add(i) …
  return []; // no findings from this rule; it only mutates ctx
},
```

(Both are OK. Recommend the first — core initializes — so the convention is documentable in `spell-rules/README.md` and typo rules can always trust `ctx.suppressed instanceof Set`.)

**Consumer side** — typo rule edits:

```javascript
// extension/content/spell-rules/nb-typo-fuzzy.js (EDIT around line 109)
for (let i = 0; i < tokens.length; i++) {
  const t = tokens[i];
  if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
  if (ctx.suppressed && ctx.suppressed.has(i)) continue;   // NEW — Phase 4
  // ... existing fuzzy logic unchanged
}
```

Same one-line addition to `nb-typo-curated.js` and `nb-sarskriving.js`. Zero edits to gender / modal rules (intentional).

### Pattern 2: Cross-dialect Sister Validwords via Seam Index (SC-03)

**What:** During `buildIndexes({ raw, lang, ... })` for NB, also load + process the NN wordList to derive an auxiliary `sisterValidWords` Set. Do the mirror for NN. Expose via a new seam getter `getSisterValidWords()`. The NB-typo-fuzzy rule (and curated) check `vocab.sisterValidWords.has(t.word)` and skip on hit — "this word isn't NB, but it IS NN, so we stay silent instead of fuzzy-matching."

**Why this works cleanly:** Phase 1's seam already has raw vocab loading. Phase 4 adds one parallel fetch at NB/NN build time: if currentLang is NB, fetch `nn.json`; if NN, fetch `nb.json`. Build just the validWords portion for the sister (skip all the other indexes — they'd cost memory without anyone reading them). Add to the seam return object as `sisterValidWords: Set<string>`. When currentLang is anything else (DE/ES/FR/EN), return empty Set.

**Memory cost:** One extra Set of ~15k strings, shared across the session (rebuilt only on LANGUAGE_CHANGED). ~1 MB of live memory in the content script — rounding error compared to Chrome's ~100 MB-per-tab baseline.

**Bundle cost:** Zero. The NN (or NB) JSON is already bundled at `extension/data/{nn,nb}.json` for consumers who switch language.

**When to use:** Any cross-language tolerance where a word valid in one bundle should mute another bundle's error-flag. The pattern is reusable — e.g., if we ever extend to tolerate EN loan-forms inside NB, we could load `en.json.validWords` as `enValidWords`; but for Phase 4 we solve loan-tolerance with the explicit curated list (Pattern 1) instead, because the EN wordList is too permissive to use as a guard.

**Example — seam edit:**

```javascript
// extension/content/vocab-seam.js — new loader alongside loadRawBigrams / loadRawFrequency
async function loadRawSister(lang) {
  const sister = lang === 'nb' ? 'nn' : lang === 'nn' ? 'nb' : null;
  if (!sister) return null;
  try {
    const url = chrome.runtime.getURL(`data/${sister}.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
}

// inside loadForLanguage(lang):
const [bigrams, freq, sisterRaw] = await Promise.all([
  loadRawBigrams(lang),
  loadRawFrequency(lang),
  loadRawSister(lang),   // NEW
]);
state = core.buildIndexes({ raw, bigrams, freq, sisterRaw, lang, isFeatureEnabled });

// In public surface — new getter:
getSisterValidWords: () =>
  (state && state.sisterValidWords instanceof Set) ? state.sisterValidWords : new Set(),
```

**Core edit (`vocab-seam-core.js:buildIndexes`):**

```javascript
function buildIndexes({ raw, bigrams, freq, sisterRaw, lang, isFeatureEnabled } = {}) {
  // ... existing code ...
  let sisterValidWords = new Set();
  if (sisterRaw && (lang === 'nb' || lang === 'nn')) {
    // Re-use buildWordList but only keep the .word field (minimal memory).
    const sisterLang = lang === 'nb' ? 'nn' : 'nb';
    const sisterList = buildWordList(sisterRaw, sisterLang, () => true);
    for (const entry of sisterList) {
      if (entry.type === 'typo') continue;  // DON'T inherit typo entries from sister
      if (entry.word) sisterValidWords.add(entry.word.toLowerCase());
    }
  }
  return {
    // ... existing fields ...
    sisterValidWords,
  };
}
```

**Consumer (typo rule — early exit):**

```javascript
// nb-typo-fuzzy.js / nb-typo-curated.js inside the per-token loop:
if (vocab.sisterValidWords && vocab.sisterValidWords.has(t.word)) continue;
```

**Adapter-contract addition to `spell-check.js:runCheck` vocab literal:**

```javascript
const vocab = {
  // ... existing ...
  sisterValidWords: VOCAB.getSisterValidWords(),  // Phase 4 / SC-03
};
```

**And the adapter-contract regression guard in `scripts/check-fixtures.js` gets one more line:**

```javascript
if (!/sisterValidWords:\s*VOCAB\.getSisterValidWords\(\)/.test(adapterSrc)) {
  throw new Error('[check-fixtures] spell-check.js:runCheck vocab object missing `sisterValidWords: VOCAB.getSisterValidWords()` — SC-03 browser-wiring regression.');
}
```

Mirror of the Phase 03.1 guard, applied to the new field.

### Pattern 3: Density-Window Code-Switching Heuristic (SC-04)

**What:** A sliding-window scan over tokens that identifies contiguous regions dense with "unknown to both NB and NN" tokens, then suppresses typo-class flags for every token in such regions (by populating `ctx.suppressed`).

**Window parameters (tuneable, lock during planning after fixture authoring):**
- Window size: **5 tokens**
- Threshold: **≥3 unknowns within the window**
- "Unknown" = NOT in `vocab.validWords` AND NOT in `vocab.sisterValidWords` AND NOT a likely proper noun.

**Why this works:** A single unknown in NB text is almost always a typo worth surfacing. Two unknowns in a row is suspicious but could be two separate typos. Three unknowns in a 5-token window means the user has pasted/quoted non-Norwegian content — the right move is silence. This matches the "at most 1 flag per paragraph, not per word" criterion (acceptance criterion #3).

**Source precedent:** FEATURES.md + PITFALLS.md Pitfall 4 both argue for density-based detection. Research flag in STATE.md Blockers ("Phase 3 code-switching detection needs empirical calibration for Norwegian vs close Germanic neighbors") — calibration happens here in Phase 4 via fixture authoring.

**Example:**

```javascript
// extension/content/spell-rules/nb-codeswitch.js
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const core = host.__lexiSpellCore || {};
  const { isLikelyProperNoun } = core;

  const WINDOW_SIZE = 5;
  const UNKNOWN_THRESHOLD = 3;

  function isUnknown(t, idx, tokens, text, vocab) {
    // Tokens that count for code-switching density (everything else is noise).
    if (t.word.length < 2) return false;                        // skip punctuation fragments
    if (vocab.validWords.has(t.word)) return false;             // known NB (or current lang)
    if (vocab.sisterValidWords && vocab.sisterValidWords.has(t.word)) return false; // cross-dialect
    if (vocab.typoFix && vocab.typoFix.has(t.word)) return false; // recognized typo
    if (isLikelyProperNoun(t, idx, tokens, text)) return false; // proper noun — handled separately
    return true;
  }

  host.__lexiSpellRules.push({
    id: 'codeswitch',
    languages: ['nb', 'nn'],
    priority: 1,
    explain: 'Tett klynge av ord som ikke er norske — sannsynligvis sitat eller fremmedspråk.',
    check(ctx) {
      const { tokens, text, vocab } = ctx;
      ctx.suppressed = ctx.suppressed || new Set();
      // Pre-compute unknown flags per token (O(n))
      const unknown = tokens.map((t, i) => isUnknown(t, i, tokens, text, vocab));
      // Sliding-window scan for dense regions; suppress every token in any
      // window above the threshold.
      for (let i = 0; i <= tokens.length - WINDOW_SIZE; i++) {
        let count = 0;
        for (let j = i; j < i + WINDOW_SIZE; j++) if (unknown[j]) count++;
        if (count >= UNKNOWN_THRESHOLD) {
          for (let j = i; j < i + WINDOW_SIZE; j++) ctx.suppressed.add(j);
        }
      }
      return [];   // suppression-only rule emits no findings
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = host.__lexiSpellRules[host.__lexiSpellRules.length - 1];
})();
```

### Pattern 4: Fixture-Driven Threshold Gate (SC-05)

**What:** `check-fixtures.js` already reports per-rule P/R/F1. Phase 4 adds a `THRESHOLDS` lookup table keyed by `lang.rule_id` and checks per-rule P/R after the run. If any (enforced) rule's P or R dips below its threshold, the runner exits 1 with a clear diagnostic naming the rule and the target number.

**Scope:** SC-05 explicitly asks for the særskriving rule to meet P/R thresholds; other rules are reported but not gated. This keeps future Phase 5 UX work (copy edits, signal tuning) from being blocked by slight regressions on non-SC-05 rules that don't have calibrated thresholds yet.

**Threshold-value locking:** Per ROADMAP and STATE.md, "Phase 4 særskriving precision/recall thresholds depend on fixture sentences authored in Phase 1" and "do not set thresholds until the fixture is in place." Phase 4 authors ≥30 positive + ≥15 acceptance cases per language first, then runs `check-fixtures.js` to see the actual P/R numbers, THEN picks thresholds with a small safety margin (e.g., 0.05 below the observed value). Lock the numbers in the plan's verification block.

**Example:**

```javascript
// scripts/check-fixtures.js — after per-rule stats are computed:
const THRESHOLDS = {
  nb: { sarskriving: { P: 0.90, R: 0.60 } },
  nn: { sarskriving: { P: 0.90, R: 0.60 } },
};
// ... inside the per-rule loop that computes `stats`:
const req = THRESHOLDS[l] && THRESHOLDS[l][ruleId];
if (req) {
  if (stats.P < req.P) {
    console.log(`[${l}/${ruleId}] FAIL: P=${stats.P.toFixed(3)} < threshold ${req.P}`);
    hardFail = true;
  }
  if (stats.R < req.R) {
    console.log(`[${l}/${ruleId}] FAIL: R=${stats.R.toFixed(3)} < threshold ${req.R}`);
    hardFail = true;
  }
}
```

The existing `hardFail` flag already gates exit — no new exit-code semantics needed. This is additive to the existing mismatch check.

### Pattern 5: Proper-noun + Loan-word Guard (SC-02)

**What:** Extended proper-noun detection + curated loan-word list, delivered as a self-contained rule file that populates `ctx.suppressed`.

**Layers (ordered by signal strength):**

1. **Existing `isLikelyProperNoun` helper** (spell-check-core.js:97) — capitalized + not sentence-start. Already present; re-use via the exported core helper.
2. **Consecutive-capitalized name span.** If tokens `i-1`, `i`, `i+1` are all capitalized mid-sentence, suppress the whole span. Catches `Anne Grethe`, `Oslo Universitetssykehus`.
3. **All-caps tokens** (3+ chars, all uppercase). Catches acronyms like `NATO`, `UIO`, `NRK`.
4. **Hyphenated compound with ≥1 capitalized part** (`K-pop`, `SMS-melding`).
5. **Curated loan-word Set** (~150-400 entries, inline). Includes common English-from-Norwegian-business / schoolyard / tech / social loans: `smoothie`, `deadline`, `weekend`, `email`, `gamer`, `streaming`, `outfit`, `brunch`, `podcast`, `stream`, `vibe`, `feed`, `post`, `laptop`, etc. Authored against the Språkrådet loan-word advisory pages + common-sense audit of modern NB/NN loan-exposure. Tracks with the typo-bank growth model (data-ish but small enough to ship inline).

Each layer adds to `ctx.suppressed`. The fuzzy rule and curated-typo rule both skip on suppressed.

**Non-goal:** shipping a curated Norwegian-names list is explicitly out of scope — too bulky, culturally biased, and the empirical probe in this research shows `Kristiansand` / `Oslo` / `Anne Grethe` already pass via layers 1-2. The remaining failure mode — lowercase names (`anne` in `Hun heter anne`) — is UX-solvable in Phase 5 with "never flag this word" ignore button, not worth a names dictionary.

**Example (sketch):**

```javascript
// extension/content/spell-rules/nb-propernoun-guard.js
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { isLikelyProperNoun } = host.__lexiSpellCore || {};

  // Curated loan-word set. ~250 entries covering business / tech / schoolyard.
  // Authored from Språkrådet loan-word advisory pages + common-sense audit.
  const LOAN_WORDS = new Set([
    'smoothie', 'deadline', 'weekend', 'email', 'newsletter', 'podcast',
    'streaming', 'stream', 'outfit', 'brunch', 'feedback', 'laptop',
    // ... ~200 more ...
  ]);

  function isAllCaps(word) {
    if (word.length < 3) return false;
    return word === word.toUpperCase() && word !== word.toLowerCase();
  }

  function isConsecutiveCapSpan(tok, idx, tokens, text) {
    // Is this token part of a 2+ capitalized-tokens-in-a-row span (mid-sentence)?
    const cap = (t) => t && t.display && t.display[0] === t.display[0].toUpperCase() && t.display[0] !== t.display[0].toLowerCase();
    if (!cap(tok)) return false;
    if (cap(tokens[idx - 1]) && isLikelyProperNoun(tokens[idx - 1], idx - 1, tokens, text)) return true;
    if (cap(tokens[idx + 1]) && isLikelyProperNoun(tokens[idx + 1], idx + 1, tokens, text)) return true;
    return false;
  }

  host.__lexiSpellRules.push({
    id: 'propernoun-guard',
    languages: ['nb', 'nn'],
    priority: 5,
    explain: 'Egennavn / lånord — stoppes fra å utløse skrivefeil.',
    check(ctx) {
      const { tokens, text } = ctx;
      ctx.suppressed = ctx.suppressed || new Set();
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (LOAN_WORDS.has(t.word)) { ctx.suppressed.add(i); continue; }
        if (isAllCaps(t.display)) { ctx.suppressed.add(i); continue; }
        if (isConsecutiveCapSpan(t, i, tokens, text)) { ctx.suppressed.add(i); continue; }
        // Note: isLikelyProperNoun is already used by the existing fuzzy rule.
        // We don't need to redo that check here — the fuzzy rule's built-in
        // guard continues to handle the single-capitalized-mid-sentence case.
      }
      return [];
    },
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = host.__lexiSpellRules[host.__lexiSpellRules.length - 1];
})();
```

### Anti-Patterns to Avoid

- **Adding a single big "false-positive suppression" file.** Splits SC-02/03/04 into three separate concerns; merging them loses per-concern fixturability and kills parallelization. Keep one file per requirement.
- **Gating the core runner on `ctx.suppressed` via a post-filter.** Would force the gender / modal rules to also be silent in code-switched spans (wrong — they should still fire on real Norwegian grammar), and it changes core semantics. Per-rule opt-in via `if (ctx.suppressed.has(i)) continue` is the right contract.
- **Sharing the loan-word Set with typo-bank data in `papertek-vocabulary`.** Loan words are a *suppression* concept, not a data concept. Keep them inline in the rule file so the extension owns the decision.
- **Loading all 6 language wordlists for code-switching "is this token non-Norwegian?" checks.** Overkill — DE/ES/FR aren't bundled (only nb/nn/en are). Density heuristic + `sisterValidWords` is the correct scope.
- **Setting SC-05 thresholds before expanding the særskriving fixture.** Locks in today's noise as acceptable. Expand fixture first, measure, THEN lock threshold with margin (-0.05 below observed).
- **Threshold gating all four rules' P/R in Phase 4.** Out of scope — SC-05 explicitly names særskriving. Gating gender/modal/typo would block Phase 5 UX work on ranking churn unrelated to false-positive work.
- **Adding a "dismiss permanently" popover button in Phase 4.** UX-05 is explicitly v2 per REQUIREMENTS.md:62.
- **Hand-authoring the proper-noun news article fixture from tool output.** Fixture honest-ground-truth policy — pick a real Aftenposten / NRK.no article, assert `expected: []`, and if the tool flags anything, it's a real bug to fix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Language detection (per-token or per-span) | cld3 / franc / any ML or statistical LID | Density heuristic over `validWords ∪ sisterValidWords ∪ isLikelyProperNoun ∪ typoFix` | SC-06 forbids new deps; density heuristic is two nested loops over the existing indexes and directly serves the `≥3 contiguous non-Norwegian` criterion. |
| Per-token proper-noun detection | Complex grammatical-NER or POS tagger | Layered heuristic (existing `isLikelyProperNoun` + 2-cap span + all-caps + hyphen-cap + loan-word Set) | NER libraries are 5-50 MB; violate bundle constraint. Heuristic layers give 95%+ coverage on the cases the fixture will audit. |
| Norwegian names list | Shipping a curated Fornavn corpus | Skip — rely on `isLikelyProperNoun` + 2-cap + Phase 5 "ignore this word" UI | Names lists are bulky, biased, and stale. Capitalization + cross-dialect tolerance + per-user ignore covers most legitimate complaints. |
| Cross-dialect overlap | Ship `per-entry dialects: ['nb','nn']` tags in `papertek-vocabulary` | Build `sisterValidWords` Set in seam from the existing NB/NN bundles | Cross-app schema change is out of scope; `sisterValidWords` is a client-side pure derivation that sidesteps the schema debate entirely. |
| Density-window tuning | ML-tuned window parameters | Hand-author fixture cases with known code-switched spans; tune window/threshold against them | Three numbers (window size, threshold, unknown predicate) are the full parameter space. Manual grid search over fixture takes 10 minutes. |
| SC-05 threshold calculation | Statistical bootstrapping / confidence intervals | Eyeball the observed P/R on the expanded fixture; lock threshold at `observed - 0.05` | The fixture is small (~90 positive + ~30 acceptance cases end-of-Phase-4). Standard error on a ~90-case P estimate is already ±0.03; formalism isn't justified. |
| Loan-word list authoring | Scraped from Språkrådet auto | Hand-author with review | Loan inclusion is a product judgment (do we want to tolerate `weekend` in NB school essays?) — humans know the register better than a scrape. |
| Release-gate test for threshold drift | Separate `scripts/check-sc05-thresholds.js` | Inline in `check-fixtures.js` | Pattern precedent: Phase 03.1 added adapter-contract check inline; Phase 2 `check-bundle-size` paired with `.test.js` for gate regression. Inline keeps the one concern (fixture-based gating) in one file. |

**Key insight:** The foundation (INFRA-03 registry, ctx object, fixture runner, per-rule P/R) was built in Phase 1-3 specifically to support exactly this kind of additive false-positive suppression. Phase 4 is three new file drops + one seam getter + fixture authoring + one threshold addition. Do not reach for any heavier mechanism.

## Common Pitfalls

### Pitfall 1: `sisterValidWords` accidentally inherits the sister dialect's typo entries

**What goes wrong:** `papertek-vocabulary` typos are `type: 'typo'` entries. If the sister-vocab load blindly adds every `entry.word` to `sisterValidWords`, we'd be saying "`berre` is a valid NB word because NN has a typo entry for `berre`" — which is backwards and could silently suppress real NB errors.

**Why it happens:** `buildWordList` emits all entries including typos; `buildLookupIndexes` filters to `entry.type !== 'typo'`. Easy to forget the filter when deriving sister words.

**How to avoid:**
- Replicate the same `entry.type !== 'typo'` filter when building `sisterValidWords`. See Pattern 2 example — `if (entry.type === 'typo') continue` is the load-bearing line.
- Add a fixture case that would fail on this: a word that's a TYPO in NN but NOT a valid word in NN → assert it stays flagged in NB as typo (the NN typo entry shouldn't save it).

**Warning signs:** A known typo in one dialect suddenly stops flagging in the other after seam edit lands.

### Pitfall 2: Density heuristic suppresses single-typo sentences that happen to land near a proper noun

**What goes wrong:** `Vi bor i Kristiansand og laegger mye` — `Kristiansand` is correctly a proper noun (not unknown); `laegger` is a typo for `legger`. Window size 5, threshold 3: around `laegger` we have `bor=known, i=known, Kristiansand=propernoun→skipped, og=known, laegger=unknown`. Only 1 unknown in the window — no suppression. Correct behavior.

But if the same paragraph contains three unknown-looking proper nouns in a row (`Vi møtte Siri Hallgrim Pettersen`), the density might trigger. The `isLikelyProperNoun` guard inside `isUnknown()` handles this — those three tokens are all proper nouns mid-sentence → `isUnknown` returns false → they don't count toward density.

**Why it happens:** Without the proper-noun guard inside `isUnknown`, consecutive-capitalized-mid-sentence names would falsely inflate density and suppress legitimate typos nearby.

**How to avoid:** `isUnknown()` explicitly invokes `isLikelyProperNoun` (see Pattern 3). Add a fixture case: proper-noun-rich NB sentence with one real typo nearby — assert the typo still flags.

**Warning signs:** Typos inside/near Norwegian personal-name paragraphs stop flagging after codeswitch rule lands.

### Pitfall 3: Loan-word inclusion tanks recall on native typos

**What goes wrong:** Adding `weekend` to the loan list is fine. But adding `fin` (to accept the English adjective) would also suppress `fin` as an NB input, and `fin` IS a valid NB word. Worse: adding `set` (English verb) as a loan would suppress Norwegian `set` (past participle of `sette`). Conflation.

**Why it happens:** Loan-word authoring requires checking whether the candidate loan coincides with a legitimate NB/NN word.

**How to avoid:**
- Enforce an authoring rule in `spell-rules/nb-propernoun-guard.js`'s file header: "each loan entry must NOT also exist in `validWords` for either variant." Validate this at Phase 4 commit time via a one-shot script (see Pattern 1's authoring pattern).
- If a true conflict exists (the loan is commonly used in NB but also a native word), skip — that's an `isLikelyProperNoun` layer case, not a loan layer.

**Warning signs:** Native-word typos stop being detected after loan list addition (fixture recall drops for `typo` rule). Author audit: for each new loan, run `vocab.validWords.has(word)` — should be false.

### Pitfall 4: SC-05 thresholds locked to today's output instead of honest ground truth

**What goes wrong:** Someone runs `check-fixtures.js`, sees current sarskriving P=0.95/R=0.73, sets thresholds to P≥0.95/R≥0.70. Now a legitimate fixture expansion that surfaces real bugs (e.g., `hjemmebane` as a compound-noun fixture case that the rule misses) would lower recall to 0.65 and fail the gate — so the bug gets deferred instead of fixed.

**Why it happens:** Threshold-from-snapshot is the same anti-pattern as fixture-from-snapshot. Both encode "current behavior" as "correct behavior."

**How to avoid:**
- Author the expanded fixture FIRST (≥30 positive + ≥15 acceptance). Run the runner once to see observed P/R on the new corpus. Decide: is the observed value "good enough for release"? If yes, threshold `= observed - 0.05` so small future regressions trip the gate but honest fixture growth doesn't. If no, either fix the rule or document as deferred and pick a lower threshold.
- Put the threshold choice and its rationale in the plan's verification block. "We lock P≥0.90 (observed 0.94) and R≥0.60 (observed 0.68) because a 5-point safety margin on 90 cases is ~1 sigma of noise."

**Warning signs:** Phase 5 work (UX-01, UX-02) starts getting rejected for "fixture regression" on an unrelated rule. Threshold was set aggressively; relax.

### Pitfall 5: Cross-dialect tolerance lets an NN user's NB typo slip through

**What goes wrong:** User is writing NN (active language). They type `komer` which is a known NB typo for `kommer`. Sister-tolerance at the rule layer says "`komer` is valid NB → don't flag." User never learns it's wrong.

**Why it happens:** Cross-dialect tolerance should suppress "wrong dialect, not wrong spelling" cases (`ikkje` in NB is not an error), not "wrong spelling, legal in other dialect's typo bank" cases.

**How to avoid:**
- Only add `entry.type !== 'typo'` entries into `sisterValidWords` (see Pitfall 1). This is the load-bearing filter — it handles this case automatically.
- Add a fixture case: NN user types a word that's a known NB typo → assert it's still flagged in NN. Validates the filter survived.

**Warning signs:** NN clean corpus flags new cases AFTER sister-tolerance lands that weren't flagging before; the rule suppressed correct NN typos that the NB dictionary happens to know.

### Pitfall 6: Adapter-contract guard miss on new `sisterValidWords` field

**What goes wrong:** Phase 03.1's guard checks that `spell-check.js:runCheck` vocab object contains `freq: VOCAB.getFreq()`. Phase 4 adds `sisterValidWords: VOCAB.getSisterValidWords()` to the same object. If someone later "cleans up" the vocab object and drops `sisterValidWords`, NB/NN dialect tolerance silently reverts — fixture still green (fixture path bypasses the adapter), production silently worse.

**Why it happens:** Same failure mode as Phase 03.1. The fixture runner passes full `buildIndexes()` output directly; the browser adapter assembles its vocab object by hand.

**How to avoid:**
- Add a second adapter-contract assertion to `scripts/check-fixtures.js` mirroring the Phase 03.1 `freq: VOCAB.getFreq()` check. See Pattern 2 Code Example. Keep both assertions at the top of `main()` so any adapter regression fails loud before any fixture runs.

**Warning signs:** None at runtime — this pitfall is silent unless the guard is in place. Guard failure message is the signal.

### Pitfall 7: Rule file priority collision with a future INFRA-03 rule

**What goes wrong:** Phase 4 assigns `codeswitch=1`, `propernoun-guard=5`, existing `gender=10`, `modal=20`, `sarskriving=30`, `typo-curated=40`, `typo-fuzzy=50`. Phase 5 (or v2) adds a new rule and picks priority 15 — between existing rules. If the new rule also mutates `ctx.suppressed`, which rule's suppression wins depends on run order.

**Why it happens:** `ctx.suppressed` is a cumulative Set (additions only). Conflicts manifest as one rule suppressing more than expected rather than "which wins." But a rule that later *clears* items from `ctx.suppressed` (new pattern) would conflict with priority.

**How to avoid:**
- Document in `spell-rules/README.md`: "Rules that mutate `ctx.suppressed` are strictly additive (only `.add()`, never `.delete()`). If you need per-rule exemption, check the token against your rule's own predicate at decision time rather than modifying the shared suppression set."
- Reserve the low-priority range (1-9) for pre-pass concerns that mutate ctx; rules that only produce findings get 10+. Codify in the README.

**Warning signs:** A new rule "fixes" a false-positive by removing tokens from `ctx.suppressed`; subtly breaks another suppression. Code review should reject this pattern.

### Pitfall 8: Code-switching rule runs too aggressively on short NB inputs

**What goes wrong:** User types `Hello verden` (greeting a Norwegian speaker in English — 2 tokens). Window size 5 but input has only 2 tokens → window never activates → no suppression. Now user types `Wow so cool Siri og Ola` (English greeting + Norwegian continuation) — 7 tokens. `Wow, so, cool` = 3 unknowns in a 5-token window → `Wow`, `so`, `cool`, `Siri`, `og` all suppressed. `Siri` was a proper noun already; `og` is legitimate Norwegian. Over-suppression.

**Why it happens:** The window is a rough heuristic; short inputs with mixed content can over-trigger.

**How to avoid:**
- Minimum token count to activate the window: require `tokens.length >= 8` before scanning (tune via fixture). For shorter inputs, behavior is unchanged from Phase 3.
- Alternative: cap suppression to consecutive-unknown sub-spans within the window, not the full window. More conservative but more code.
- Lock the threshold + window + min-tokens during planning via fixture cases covering short + long inputs both with and without code-switching.

**Warning signs:** Legitimate NB text near a 2-3-word English greeting stops producing spell-check findings.

### Pitfall 9: Chrome content-script ordering regression on new rule files

**What goes wrong:** Adding `nb-codeswitch.js` and `nb-propernoun-guard.js` to `extension/manifest.json` content_scripts.js array BUT forgetting to order them BEFORE the existing rules (and before `spell-check.js` adapter). Priority-based filtering inside core would still sort them correctly at check time, but during IIFE registration order matters if any rule depends on `self.__lexiSpellCore` helpers.

**Why it happens:** Manifest content_scripts load in array order. Each rule IIFE pushes itself onto `self.__lexiSpellRules`. The helpers (`isLikelyProperNoun`, `matchCase`) are exported on `self.__lexiSpellCore` by `spell-check-core.js` — if a rule file loads before core, the `host.__lexiSpellCore || {}` fallback returns `{}` and destructured helpers are `undefined`.

**How to avoid:**
- Existing manifest order: core BEFORE all rule files. Preserve this — add new rules AFTER `content/spell-check-core.js` and keep the dual-load-guard preamble per Phase 3 `spell-rules/README.md`.
- Core's footer ALSO does `host.__lexiSpellRules = host.__lexiSpellRules || []` as belt-and-braces (Phase 3 Plan 02 decision). New rules inherit this safety.
- Add to `scripts/check-fixtures.js` auto-discovery — the runner already `readdirSync`s the spell-rules dir; no edits needed there.

**Warning signs:** `[lexi-spell] rule codeswitch threw TypeError: Cannot read properties of undefined (reading 'isLikelyProperNoun')` in DevTools console on extension load.

### Pitfall 10: Fixture authoring captures dev's Norwegian, not real student writing

**What goes wrong:** PITFALLS.md Pitfall 14 warns: "Devs test on their own well-formed Norwegian; regression fixture accumulates dev-written sentences. Real students write differently — more errors per sentence, more run-ons, more code-switching, mobile-typing artefacts."

**Why it happens:** Natural bias — devs author from memory; students type with different register, frequency of errors, dialect mixing.

**How to avoid:**
- For SC-02 news article: use a real Aftenposten / NRK / VG article (copy-paste, credit the source in the fixture comment).
- For SC-03 dialect cases: include real NN register (e.g., `ikkje`, `eg`, `me`, `nokon`, `berre`) AND less common forms (`ho`, `dei`, `du`, `vore`, verb-ending `-ar`/`-ast`).
- For SC-04 code-switching cases: include German (`Ich will sein`), English (`The quick brown fox`), French (`Bonjour mes amis`) — all three are target languages the extension serves.
- For SC-05 særskriving expansion: cross-reference Korrekturavdelingen.no "Særskriving" guide; also include noun+noun non-compound acceptance cases that are grammatically adjective-like (`stor by`, `god venn`, `tung bok`, `lang tur`).

**Warning signs:** Fixture passes in dev but real classroom piloting surfaces a flood of unrepresented patterns; Phase 6+ has to retrofit the fixture from real complaints.

## Code Examples

### Example 1 (empirical probe — reproduce in planning)

Run this during planning to re-establish current false-positive baseline before authoring fixtures. Reveals exact defect surface.

```bash
node -e '
globalThis.self = globalThis;
const fs = require("fs");
const path = require("path");
const vocabCore = require("./extension/content/vocab-seam-core.js");
require("./extension/content/spell-check-core.js");
for (const f of fs.readdirSync("./extension/content/spell-rules").filter(f=>f.endsWith(".js")).sort()) {
  require(path.join(process.cwd(), "./extension/content/spell-rules", f));
}
const core = self.__lexiSpellCore;
function loadVocab(lang){
  const raw = JSON.parse(fs.readFileSync(`./extension/data/${lang}.json`,"utf8"));
  const bigrams = JSON.parse(fs.readFileSync(`./extension/data/bigrams-${lang}.json`,"utf8"));
  const freq = JSON.parse(fs.readFileSync(`./extension/data/freq-${lang}.json`,"utf8"));
  return vocabCore.buildIndexes({raw,bigrams,freq,lang,isFeatureEnabled:()=>true});
}
const nb = loadVocab("nb");
const nn = loadVocab("nn");
function probe(label, text, vocab, lang){
  const result = core.check(text, vocab, {lang});
  console.log(`[${lang}] ${label} "${text}": ${result.length} findings`);
  for (const f of result) console.log("  -", f.rule_id, f.original, "->", f.fix);
}
probe("dialect-nn-in-nb-ikkje", "Jeg har ikkje tid", nb, "nb");        // already OK (in validWords)
probe("dialect-nn-in-nb-eg", "Om dagen eg gir deg mer", nb, "nb");     // flags today — SC-03 target
probe("loan-smoothie", "Jeg liker en smoothie", nb, "nb");             // already OK
probe("loan-brown-bonus", "Jeg har en brown label", nb, "nb");         // flags today — SC-02 target
probe("proper-oslo", "Jeg bor i Oslo", nb, "nb");                      // already OK
probe("proper-lower-anne", "Hun heter anne", nb, "nb");                // flags today — SC-02 target
probe("codeswitch-german", "Han sa Ich will sein ein", nb, "nb");      // flags multiple — SC-04 target
probe("sarskriving-acceptance", "Han har en god venn", nb, "nb");      // must stay silent — SC-05 acceptance
probe("sarskriving-positive", "Jeg har en skole sekk", nb, "nb");      // must flag — SC-05 positive
'
```

Verified output on this research run (2026-04-20 / Node 25.2.1):
- `[nb] dialect-nn-in-nb-ikkje`: 0 findings (already OK — `ikkje` accidentally in NB validWords)
- `[nb] dialect-nn-in-nb-eg`: 1 finding `eg → egg` (SC-03 target — length-2 word somehow reaches fuzzy matcher because of the cross-link data shape)
- `[nb] loan-brown-bonus`: 1 finding `brown → broen` (SC-02 target — loan word with close NB neighbor)
- `[nb] proper-lower-anne`: 1 finding `anne → annen` (SC-02 target — lowercase proper noun)
- `[nb] codeswitch-german`: 2 findings `will → vill`, `sein → stein` (SC-04 target — German quote in NB)

### Example 2 (ctx.suppressed convention, runner init)

```javascript
// extension/content/spell-check-core.js — EDIT line 68 area
// The runner initializes the suppression set so all rules can trust it.
function check(text, vocab, opts = {}) {
  const { cursorPos = null, lang = 'nb' } = opts;
  if (!text || text.length < 3) return [];
  if (lang !== 'nb' && lang !== 'nn') return [];

  const tokens = tokenize(text);
  if (tokens.length < 2) return [];

  const vocabRef = vocab || {};
  // Phase 4: ctx.suppressed is the shared "do not flag this token" surface.
  // Rules with priority < 10 populate it (codeswitch, propernoun-guard).
  // Rules with priority >= 10 check it inside their per-token loop:
  //   if (ctx.suppressed.has(i)) continue;
  // gender/modal DO NOT opt in — they fire on grammar, not on token-unknown.
  const ctx = { text, tokens, vocab: vocabRef, cursorPos, lang, suppressed: new Set() };
  // ... rest of function unchanged
}
```

### Example 3 (typo rule opts into suppression)

```javascript
// extension/content/spell-rules/nb-typo-fuzzy.js — EDIT line 105-131 area
check(ctx) {
  const { text, tokens, vocab, cursorPos, suppressed } = ctx;
  const validWords = vocab.validWords || new Set();
  const sisterValidWords = vocab.sisterValidWords || new Set();  // Phase 4 / SC-03
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
    if (suppressed && suppressed.has(i)) continue;             // Phase 4 / SC-02 + SC-04
    if (sisterValidWords.has(t.word)) continue;                // Phase 4 / SC-03 (direct check — belt & braces)
    if (
      t.word.length >= 4 &&
      !validWords.has(t.word) &&
      !isLikelyProperNoun(t, i, tokens, text)
    ) {
      const fuzzy = findFuzzyNeighbor(t.word, vocab);
      if (fuzzy) {
        out.push({ /* existing finding shape */ });
      }
    }
  }
  return out;
}
```

### Example 4 (new fixture case — NB 500-word news article)

```jsonl
# fixtures/nb/clean.jsonl — APPEND near bottom, clearly labeled

// ── SC-02 real-NB-article case ──
// Copy-pasted from https://www.nrk.no/... (or similar) — 500+ words, preserves
// original capitalization. Expected: zero findings. If the fixture runner
// reports any, that is a real false-positive bug to track back to a specific
// rule. Sentences split with . for readability but stored as one long string.
{"id":"nb-clean-news-500w-001","text":"Statsministeren åpnet...","expected":[],"must_not_flag":[]}
```

### Example 5 (new fixture file — code-switching)

```jsonl
# fixtures/nb/codeswitch.jsonl — NEW
// SC-04 fixture. Each case has ≥3 contiguous non-Norwegian tokens inside
// NB text. Expected: AT MOST 1 flag per paragraph (acceptance criterion #3).
// Authoring: real passages from student essays quoting foreign sources
// OR hand-authored sentences that emulate the pattern.

{"id":"nb-codeswitch-de-001","text":"Han siterte Ich will nach Hause gehen og gikk hjem.","expected":[],"must_not_flag":[]}
{"id":"nb-codeswitch-en-001","text":"Han skrev The quick brown fox jumps over the lazy dog som tittel.","expected":[],"must_not_flag":[]}
{"id":"nb-codeswitch-fr-001","text":"Hun leste Bonjour mes amis comment allez vous i læreboken.","expected":[],"must_not_flag":[]}
// With an accompanying Norwegian typo — density-window gated correctly:
{"id":"nb-codeswitch-typo-001","text":"Han sa Ich will sein ein og jeg komer nå","expected":[{"rule_id":"typo","start":30,"end":35,"suggestion":"kommer"}],"must_not_flag":[]}
```

### Example 6 (threshold gate)

```javascript
// scripts/check-fixtures.js — ADD near the existing per-rule computation
// Phase 4 / SC-05: hard thresholds for sarskriving per language.
// Values locked during planning after fixture expansion — see 04-*-PLAN.md.
const THRESHOLDS = {
  nb: { sarskriving: { P: 0.90, R: 0.60 } },
  nn: { sarskriving: { P: 0.90, R: 0.60 } },
};

// ... inside the existing for-lang, for-file loop, AFTER stats is computed:
const req = THRESHOLDS[l] && THRESHOLDS[l][ruleId];
if (req) {
  if (stats.P < req.P) {
    console.log(`[${l}/${ruleId}] FAIL: P=${stats.P.toFixed(3)} below threshold ${req.P}`);
    hardFail = true;
  }
  if (stats.R < req.R) {
    console.log(`[${l}/${ruleId}] FAIL: R=${stats.R.toFixed(3)} below threshold ${req.R}`);
    hardFail = true;
  }
}
```

## State of the Art

| Old Approach (post-Phase-03.1) | Current Approach (post-Phase-4) | When Changed | Impact |
|----------------------------------|-----------------------------------|--------------|--------|
| Fuzzy rule skips proper nouns via `isLikelyProperNoun` only | Dedicated `nb-propernoun-guard.js` expands coverage (2-cap span, all-caps, hyphen-cap, loan-word Set) | Phase 4 | SC-02 closed; news articles produce 0 false positives |
| Cross-dialect validWords overlap is incidental (data-driven only) | Explicit `sisterValidWords` seam index; rules consult it early | Phase 4 | SC-03 closed; `eg` in NB never flags; systematic tolerance |
| Code-switched German/English inside NB paragraph produces forest of flags | Density-window pre-pass `nb-codeswitch.js` suppresses token spans with ≥3 unknown-to-NB/NN tokens in a 5-token window | Phase 4 | SC-04 closed; ≤1 flag per code-switched paragraph |
| Særskriving rule's P/R reported but not gated | Hard thresholds P≥0.90 R≥0.60 in `check-fixtures.js`; fixture expanded to ≥30 pos + ≥15 accept per lang | Phase 4 | SC-05 closed; future regressions in sarskriving detected pre-release |

**Not deprecated:** `isLikelyProperNoun` stays the first-line defence and is still exported from core; `nb-propernoun-guard.js` is additive. `scoreCandidate` in `nb-typo-fuzzy.js` stays as-is (SC-01 Zipf tiebreaker from Phase 3-03 is unaffected).

## Open Questions

1. **Should `ctx.suppressed` live on core (runner init) or be ensured-by-first-rule?**
   - What we know: Either works. Core init is simpler (rules can always trust `ctx.suppressed instanceof Set`). First-rule ensure is fractionally more decoupled but awkward because rules run in priority order and the first one might be something else later.
   - Recommendation: Core initializes. Doc it in `spell-rules/README.md` as "the shared suppression convention is runner-owned."

2. **Should DE/ES/FR/EN-bundled EN wordList feed `sisterValidWords` for NB/NN sessions?**
   - What we know: `en.json` ships bundled. Merging it into `sisterValidWords` for NB/NN would auto-suppress common English loan-words — no curated list needed.
   - What's unclear: EN wordList is broad (~4k entries), includes words that happen to overlap NB spelling (`brown`, `will`, `sein`, etc.). Broad suppression would erode precision on Norwegian typos that look English-ish.
   - Recommendation: DO NOT merge EN into `sisterValidWords`. Keep the curated LOAN_WORDS Set instead — tighter control, fewer surprises. Revisit if the loan list grows past 1000 entries.

3. **Should the proper-noun-guard rule own a per-user `chrome.storage.local` ignore list?**
   - What we know: UX-05 (v2) explicitly carries this. A "never flag this word" button in the popover would be a Phase 5 UI addition.
   - Recommendation: Phase 4 does not introduce the ignore list. Phase 4's `nb-propernoun-guard.js` stays pure-function. If storage consumption ends up in Phase 5 UX work, it can add another layer to the same rule file (or a new sibling rule) without backtracking on Phase 4 architecture.

4. **Code-switching window size + threshold + min-tokens: what initial values?**
   - What we know: Recommendation is window=5 / threshold=3 / min-tokens=8 — heuristic, chosen before fixture authoring.
   - What's unclear: Real-world calibration against a diverse fixture (German/English/French quoted passages + short mixed-language inputs) could justify different numbers.
   - Recommendation: Plan should author the SC-04 fixture file FIRST with ≥10 cases, then run `check-fixtures.js` to see false-positive and false-negative rates across candidate (window, threshold, min) tuples. Lock values that produce no fixture failures. Document the chosen tuple in the plan's verification block.

5. **SC-05 exact threshold numbers for sarskriving?**
   - What we know: Plan should observe P/R after fixture expansion, then set threshold at observed - 0.05. See Pitfall 4.
   - What's unclear: Whether both P and R need gating, or just one.
   - Recommendation: Gate both. P ≥ 0.90 prevents "quiet tool that misses errors" regressing into "noisy tool that over-flags." R ≥ 0.60 prevents the opposite: a refactor that silences the rule to reduce noise. Both numbers fail-loud and carry a clear diagnostic message.

6. **Does the 500-word news-article clean case exercise all rules simultaneously, or is it a single-paragraph scope?**
   - What we know: Current fixture runner calls `spellCore.check(kase.text, vocab, { lang })` with the whole text; rules see the whole token stream. So a 500-word case naturally exercises every rule once.
   - What's unclear: Whether the fixture runner has pathological runtime on a 500-word input.
   - Recommendation: Benchmark once during plan execution; 500 words at ~1ms-per-check amounts to ~5 ms — negligible. If it ever grows to >50 ms on realistic-fixture runs, split the news article into multiple ~100-word cases.

7. **Should `codeswitch.jsonl` live in the existing rule-name convention or a new subfolder?**
   - What we know: Existing fixture convention is `fixtures/{lang}/{rule_id}.jsonl`. Codeswitch as a rule produces NO findings, so there's no `rule_id` directly targeted.
   - Recommendation: Keep convention. File `fixtures/{nb,nn}/codeswitch.jsonl` contains cases where codeswitch's suppression effect is asserted (expected: [] on would-have-flagged inputs). Runner already iterates all JSONL files in the dir via `readdirSync` → auto-discovered.

## Validation Architecture

workflow.nyquist_validation is not enabled in `.planning/config.json` (no such key). Skipping this section per researcher instruction.

## Sources

### Primary (HIGH confidence — in-repo / empirical)

- `extension/content/spell-check-core.js:59-90, 97-106, 116-270` — runner, `isLikelyProperNoun`, `editDistance`, `findFuzzyNeighbor`, `scoreCandidate`, dedupe.
- `extension/content/spell-rules/{nb-codeswitch will be new, nb-propernoun-guard will be new, nb-gender.js, nb-modal-verb.js, nb-sarskriving.js, nb-typo-curated.js, nb-typo-fuzzy.js}` — existing rule files; all pushed onto `self.__lexiSpellRules` via the dual-load-guard preamble.
- `extension/content/vocab-seam.js:113-122, 124-160, 205-247` — `loadRawFrequency` (pattern for `loadRawSister`), `loadForLanguage`, public surface (new getter goes here).
- `extension/content/vocab-seam-core.js:460-535` — `buildWordList` / `buildLookupIndexes` / `buildIndexes` (add `sisterValidWords`).
- `extension/content/spell-check.js:196-232` — `runCheck` vocab object assembly; Phase 03.1 pattern to extend with `sisterValidWords`.
- `scripts/check-fixtures.js:101-122, 170-249` — loadVocab (already has freq-map load), main loop with Phase 03.1 adapter guard pattern.
- `fixtures/README.md` — ground-truth-not-snapshot policy; rule_id canonical list; `end` is exclusive.
- `fixtures/nb/clean.jsonl, saerskriving.jsonl, typo.jsonl` + NN mirrors — existing baselines.
- `extension/data/{nb,nn}.json` — bundled; sizes 5.99 MB / 6.41 MB pretty; minified during `npm run package`. Verified `Oslo` / `Bergen` / `Anne` are NOT in the lexicons (proper nouns need the guard); verified `ikkje`, `berre`, `jeg` already accidentally in cross-variant lookup; `eg`, `tull`, `anne` are NOT.
- `extension/data/freq-{nb,nn}.json` — Zipf sidecars; 203 KB / 173 KB. Phase 03.1-confirmed populated end-to-end in browser.
- `extension/manifest.json:17-40` — content_scripts load order; rule additions go in the existing block.
- `.planning/ROADMAP.md:100-110` — Phase 4 goal, dependencies, requirements, success criteria.
- `.planning/REQUIREMENTS.md:29-33` — SC-02/03/04/05 canonical text.
- `.planning/STATE.md:87-172` — phase context, prior-plan accumulated decisions (Pitfall 3 Sister dialect, Pitfall 7 priority range).
- `.planning/phases/01-foundation-vocab-seam-regression-fixture/01-RESEARCH.md` — seam + fixture patterns.
- `.planning/phases/03-rule-architecture-ranking-quality/03-RESEARCH.md` — rule-registry + signal patterns; Pitfall 4 (Zipf overshoot bounds).
- `.planning/phases/03.1-close-sc-01-browser-wiring/03.1-RESEARCH.md` — adapter-contract guard pattern (mirrored in Pattern 2 here).
- `.planning/research/PITFALLS.md:19-146, 289-324, 437-513, 561-646` — Pitfalls 1-4 (SC-01/02/03/04 framing), Pitfall 10 (dialect rule misapplication), Pitfall 14 (fixture authenticity), Sources list.
- `.planning/research/FEATURES.md:22-40, 60-80, 166-185` — user-expected false-positive guard, dialect tolerance anti-feature framing, prioritization matrix.
- `.planning/research/ARCHITECTURE.md:215-372` — Pattern 2 (rule-pack plugin registry) and Pattern 5 (fixture-driven regression loop).
- Empirical Node probe run during this research (see Code Examples Example 1) — establishes the exact current defect surface on real vocab at Phase 03.1 head.

### Secondary (MEDIUM confidence — external precedent)

- [Korrekturavdelingen.no — Særskriving](https://www.korrekturavdelingen.no/K4saerskriving.htm) — enumerates common NB sarskriving error classes; source for fixture positive cases.
- [Språkrådet — Engelske ord i norsk](https://www.sprakradet.no/sprakhjelp/praktisk-grammatikk/engelske-ord-i-norsk/) — source for curated loan-word list; authoring reference.
- [LanguageTool Forum — Handling proper nouns when spell checking](https://forum.languagetool.org/t/sv-handling-proper-nouns-when-spell-checking/1371) — precedent for proper-noun layered heuristic (PITFALLS.md Sources).
- [translatehouse localization guide — evaluating spellcheckers](http://docs.translatehouse.org/projects/localization-guide/en/latest/guide/evaluating_spellcheckers.html) — P/R methodology for spell-check evaluation (Phase 1 RESEARCH).

### Tertiary (LOW confidence)

- None. All Phase-4-relevant claims either code-verified or precedent-cited from prior-phase research.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new deps maintained through Phase 1-3; Phase 4 matches pattern.
- Architecture: HIGH — the four patterns (ctx.suppressed, sisterValidWords, density-window, threshold gate) all have direct in-repo prior-art or one-file precedent.
- Pitfalls: HIGH — all pitfalls trace either to a concrete Phase 1-3 lesson (e.g., Pitfall 6 mirrors Phase 03.1 adapter-guard) or to empirically verified current defect (Example 1 probe).
- SC-02 loan-word list authoring: MEDIUM — product judgment required; recommend reviewer pass on the full list before shipping.
- SC-04 density parameters: MEDIUM — window / threshold / min-tokens chosen from first principles; final calibration requires fixture-driven tuning in-plan.
- SC-05 exact threshold values: MEDIUM — cannot be fixed before fixture expansion; plan must author fixture, observe P/R, lock with safety margin.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stable domain; no external ecosystem shifts expected).
