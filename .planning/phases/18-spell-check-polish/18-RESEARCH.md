# Phase 18: Spell-Check Polish - Research

**Researched:** 2026-04-26
**Domain:** Norwegian spell-check UI + new grammar/typo rules
**Confidence:** HIGH

## Summary

Phase 18 adds three independent features to the existing spell-check system: (1) a manual "run spell-check" button with toast feedback, (2) a demonstrative-gender mismatch rule for den/det/denne/dette, and (3) a triple-letter typo detection rule. All three build on the well-established spell-check architecture (rule registry in `spell-check-core.js`, DOM adapter in `spell-check.js`, rule files in `spell-rules/`).

The codebase is mature with 60+ rule files, 9 release gates, and a fixture-driven regression suite. The manual button is a UI-only addition to `spell-check.js` (no new rule code). The two new rules follow the exact IIFE pattern of all existing rules and register onto `self.__lexiSpellRules`.

**Primary recommendation:** Implement the three features as independent tasks: button+toast in `spell-check.js` + CSS, demonstrative rule as `nb-demonstrative-gender.js` at priority ~12, triple-letter rule as `nb-triple-letter.js` at priority ~45.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SPELL-01 | Manual spell-check button with toast feedback | Button lives in spell-check.js DOM adapter; reuses existing `runCheck()` pipeline; toast is a new transient DOM element with CSS animation; "no flash" requires comparing text hash before/after |
| SPELL-02 | Demonstrative-gender mismatch (den/det/denne/dette + definite noun) | New rule file `nb-demonstrative-gender.js`; `nounGenus` already contains definite forms like "boka" (genus 'f') via vocab-seam-core.js line 792; must require definite noun following (not indefinite -- that's nb-gender's job) |
| SPELL-03 | Triple-letter typo detection | New rule file `nb-triple-letter.js`; regex `/(.)\1\1+/` detects runs of 3+; must be compound-boundary-aware (compound consonant elision can create valid triples at boundaries); separate from nb-typo-fuzzy per STATE.md pitfall warning |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS IIFE | n/a | Rule files + DOM adapter | Project convention; no build step |
| `self.__lexiSpellRules` registry | n/a | Rule registration pattern | All 60+ rules use this; `spell-check-core.js` iterates it |
| Fixture JSONL format | n/a | Regression testing | `fixtures/{lang}/*.jsonl` checked by `npm run check-fixtures` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chrome storage API | MV3 | Persist manual-check last-text hash | Only for "no flash" optimization |
| CSS @keyframes | n/a | Toast fade-in/fade-out animation | Toast appears on manual check |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Toast in spell-check.js | Toast via floating-widget.js | Spell-check is the owner; floating-widget is TTS-scoped. Keep spell-check self-contained. |
| Priority 12 for demonstrative | Priority 15 (same as DE-gender) | 12 is fine -- demonstratives are a specific article-like pattern. Must run AFTER nb-gender (10) to avoid double-flagging. Actually run at ~12 so it's close to gender but distinct. |

## Architecture Patterns

### New Rule File Pattern
Every rule file follows this exact pattern (verified from 60+ existing files):

```javascript
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml, getString } = host.__lexiSpellCore || {};

  const rule = {
    id: 'rule-id-here',
    languages: ['nb', 'nn'],
    priority: 45,
    severity: 'error',
    explain: (finding) => ({
      nb: `...`,
      nn: `...`,
    }),
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed, lang } = ctx;
      const out = [];
      // ... rule logic ...
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
```

### Registration Checklist for Each New Rule
1. Create rule file in `extension/content/spell-rules/`
2. Add to `manifest.json` content_scripts js array (before `spell-check.js`)
3. Add CSS dot colour in `extension/styles/content.css` (`.lh-spell-{id} { background: ... }`)
4. Add to `TARGETS` array in `scripts/check-explain-contract.js`
5. Add fixture cases in `fixtures/nb/` (positive + negative cases)
6. Release gates: `check-fixtures`, `check-explain-contract`, `check-rule-css-wiring`, `check-network-silence`

### Manual Check Button Placement
The button should live in the spell-check overlay system (`spell-check.js`), not in `floating-widget.js`. The TTS widget is selection-scoped; the spell-check button is textarea-scoped. Two placement options:

**Option A (recommended):** Small floating button anchored near the active textarea (bottom-right corner), appearing when spell-check is enabled and a textarea is focused. CSS class `lh-spell-check-btn`. This mirrors how the spell-check overlay already positions dots relative to the active element.

**Option B:** Inside the floating TTS widget header. Rejected because: (a) the widget only appears on text selection, not on textarea focus; (b) coupling spell-check UI to the TTS widget violates separation of concerns; (c) success criterion says "near the TTS widget" but the button must be independently visible.

### Toast Pattern
A transient element appended to the spell-check overlay (or body), positioned above the button, auto-dismissed after 2-3 seconds:

```javascript
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'lh-spell-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  // Position near the button
  setTimeout(() => toast.remove(), 3000);
}
```

### "No Flash" Optimization
Success criteria says "no visual flash when text is unchanged since last auto-check." Implementation: store a hash (or the raw text string) of the last checked text. On manual trigger, compare; if unchanged AND findings already rendered, skip re-check and just show toast with cached finding count.

```javascript
let lastCheckedText = '';
let lastFindingsCount = 0;

function manualCheck() {
  const { text } = readInput(activeEl);
  if (text === lastCheckedText) {
    // No re-render needed, just show toast
    showToast(lastFindingsCount > 0
      ? `${lastFindingsCount} feil funnet`
      : 'Ser bra ut!');
    return;
  }
  runCheck();  // re-renders markers
  showToast(lastFindings.length > 0
    ? `${lastFindings.length} feil funnet`
    : 'Ser bra ut!');
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gender lookup for definite nouns | Custom definite-form parser | `vocab.nounGenus` Map (already contains "boka" -> "f") | vocab-seam-core.js line 792 adds nounform entries with genus to nounGenus |
| Detecting definite vs indefinite nouns | Suffix heuristic (-en, -a, -et) | `nounForms` Map from vocab-seam (tracks definite/indefinite per base word) | Already built by buildLookupIndexes at line 736-747 |
| Triple-letter regex | Custom iteration | `/(.)\1\1+/g` regex | Standard approach; simple and correct |
| Finding deduplication | Manual overlap check | `dedupeOverlapping()` in spell-check-core.js | Already handles overlapping findings from different rules |

## Common Pitfalls

### Pitfall 1: Demonstrative vs Indefinite Article Collision (from STATE.md)
**What goes wrong:** "Det bok" could be flagged by BOTH nb-gender (as indefinite article mismatch) and the new demonstrative rule. Double-flagging confuses students.
**Why it happens:** "det" is both a demonstrative ("det bordet" = that table) and semantically used as an indefinite-like article ("det er et barn"). The nb-gender rule already catches "et bok" → "en bok" style errors.
**How to avoid:** The demonstrative rule MUST require the following noun to be in DEFINITE form. "Det boka" = demonstrative + definite noun = demonstrative rule territory. "Det bok" = article + indefinite noun = existing nb-gender rule territory. Check if the noun's form is in the `bestemt.entall` set via nounForms Map, or use suffix heuristics (-en, -a, -et, -ene).
**Warning signs:** Fixture case "Det bok" triggers both rules.

### Pitfall 2: Triple-Letter at Compound Boundaries
**What goes wrong:** "stilllas" (stillas, scaffold) or compound words with legitimate triple letters at morpheme boundaries get false-flagged.
**Why it happens:** Norwegian compound words can create triple consonant sequences at morpheme boundaries (e.g., "natt+tog" = "natttog" although this is typically written "nattog" with elision).
**How to avoid:** The decomposition engine (Phase 16) already handles triple-consonant elision. The triple-letter rule should check: (1) is the word in validWords? If yes, skip. (2) does decomposition produce a high-confidence split at the triple-letter boundary? If yes, this is a compound spelling issue, not a typo. The success criterion says "compound-boundary consonant-elision awareness."
**Warning signs:** "stillleben" flagged as typo when it's a valid German-origin compound.

### Pitfall 3: Triple-Letter Rule Must Be Separate from Typo-Fuzzy
**What goes wrong:** Modifying nb-typo-fuzzy to catch triple letters breaks its carefully tuned scoring heuristic.
**Why it happens:** STATE.md explicitly records this as a pitfall: "Triple-letter must be separate rule file, not typo-fuzzy modification (Pitfall 8)."
**How to avoid:** Create `nb-triple-letter.js` as its own rule file at priority ~45 (between typo-curated at 40 and typo-fuzzy at 50). The rule is simple: regex detect, collapse to double, check if collapsed form is valid.

### Pitfall 4: Den/Det Ambiguity Beyond Demonstratives
**What goes wrong:** "Den" and "det" in Norwegian serve as: (a) demonstratives ("den boka"), (b) personal pronouns ("den er fin"), (c) expletive subjects ("det regner"). Only (a) should trigger the rule.
**Why it happens:** Without context, "det boka" looks like demonstrative+noun, but "det" at sentence start followed by "er" is usually expletive.
**How to avoid:** Only fire when the NEXT token (or 2-ahead, with adjective gap) is a known definite-form noun in nounGenus. The pronoun/expletive uses are followed by verbs or adjectives, not definite nouns.

### Pitfall 5: Lockdown Consumer Compatibility
**What goes wrong:** New UI elements (button, toast) might reference `chrome.storage` or extension-only APIs that the lockdown shim doesn't provide.
**Why it happens:** CLAUDE.md documents that `spell-check.js` runs in lockdown via a Chrome-API shim.
**How to avoid:** The button and toast are pure DOM operations. The "last checked text" cache can be a simple JS variable (no storage needed). Only existing `chrome.storage.local` calls (already shimmed) are used for enable/disable state.

### Pitfall 6: Release Gate Updates Required
**What goes wrong:** New rule files that surface to the popover need entries in `check-explain-contract.js` TARGETS array and `check-rule-css-wiring`. Missing entries cause silent gate bypass.
**How to avoid:** Checklist per rule: (1) add to manifest.json, (2) add CSS `.lh-spell-{id}` binding, (3) add to TARGETS in check-explain-contract.js, (4) add fixtures, (5) verify all 9 gates pass.

## Code Examples

### SPELL-02: Demonstrative-Gender Rule Logic
```javascript
// Demonstratives and their expected gender
const DEMONSTRATIVE_GENDER = {
  nb: { 'den': ['m', 'f'], 'det': ['n'], 'denne': ['m', 'f'], 'dette': ['n'] },
  nn: { 'den': ['m', 'f'], 'det': ['n'], 'denne': ['m', 'f'], 'dette': ['n'] },
};
const DEMONSTRATIVE_FIX = {
  nb: { m: 'den', f: 'den', n: 'det' },  // simple form
  nn: { m: 'den', f: 'den', n: 'det' },
};

// Check: is the next token a DEFINITE-form noun?
// nounGenus already contains definite forms ("boka" -> "f").
// Distinguish from indefinite by checking if the word appears
// as a bestemt.entall form in the raw data, or by suffix heuristic.
function isDefiniteForm(word, vocab) {
  // Option A: check nounForms Map
  const nounForms = vocab.nounForms || new Map();
  for (const [base, forms] of nounForms) {
    if (forms.singular.has(word)) {
      // It's a noun form — but is it definite?
      // nounForms.singular includes both ubestemt and bestemt forms.
      // Need to check definiteness field from the wordList entry.
    }
  }
  // Option B: suffix heuristic (simpler, more robust)
  // Definite singular endings: -en, -et, -a (but -a also used for verbs)
  // Best approach: check if word is in nounGenus AND word !== base lemma
  // (base lemma is indefinite form; inflected form is definite)
  return false;
}
```

**Key insight for definiteness detection:** The `nounGenus` Map contains BOTH base forms ("bok" -> "f") and inflected forms ("boka" -> "f"). The `nounLemmaGenus` Map contains ONLY base forms. So: `nounGenus.has(word) && !nounLemmaGenus.has(word)` identifies inflected forms (which includes definite forms). However, this also includes plural forms. A more precise check: the demonstrative rule should fire when `den/det` precedes a word that is in `nounGenus`, and the gender mismatches. The "definite" vs "indefinite" distinction matters for collision avoidance with nb-gender:

- nb-gender fires on `en/ei/et` + noun (indefinite articles)
- demonstrative rule fires on `den/det/denne/dette` + noun (demonstratives)

These trigger sets are DISJOINT (different trigger words), so collision is avoided naturally. No need to detect definiteness at all -- the trigger words themselves partition the domain.

### SPELL-03: Triple-Letter Detection
```javascript
const TRIPLE_RE = /(.)\1\1+/g;

check(ctx) {
  const { tokens, vocab, suppressed, cursorPos } = ctx;
  const validWords = vocab.validWords || new Set();
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    if (suppressed && suppressed.has(i)) continue;
    const t = tokens[i];
    if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
    if (validWords.has(t.word)) continue;  // known word, skip

    TRIPLE_RE.lastIndex = 0;
    const m = TRIPLE_RE.exec(t.word);
    if (!m) continue;

    // Collapse triple to double
    const fixed = t.word.replace(/(.)\1\1+/g, '$1$1');
    if (!validWords.has(fixed)) continue;  // collapsed form not a known word

    out.push({
      rule_id: 'nb-triple-letter',
      priority: rule.priority,
      start: t.start,
      end: t.end,
      original: t.display,
      fix: matchCase(t.display, fixed),
      message: `Trippel bokstav: "${t.display}" — prøv "${fixed}"`,
    });
  }
  return out;
}
```

### SPELL-01: Manual Check Button + Toast (in spell-check.js)
```javascript
let lastCheckedText = '';
let spellCheckBtn = null;

function ensureButton() {
  if (spellCheckBtn) return;
  spellCheckBtn = document.createElement('button');
  spellCheckBtn.className = 'lh-spell-check-btn';
  spellCheckBtn.title = 'Sjekk rettskriving';
  spellCheckBtn.textContent = 'Aa';  // or an SVG icon
  spellCheckBtn.addEventListener('mousedown', e => e.preventDefault());
  spellCheckBtn.addEventListener('click', manualCheck);
  document.body.appendChild(spellCheckBtn);
}

function manualCheck() {
  if (!activeEl) return;
  const { text } = readInput(activeEl);
  if (text === lastCheckedText && lastFindings.length >= 0) {
    showToast(lastFindings.length > 0
      ? `${lastFindings.length} feil funnet`
      : 'Ser bra ut!');
    return;
  }
  runCheck();
  showToast(lastFindings.length > 0
    ? `${lastFindings.length} feil funnet`
    : 'Ser bra ut!');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline rules in spell-check-core.js | Separate rule files in spell-rules/ (INFRA-03) | Phase 3 | Zero edits to core for new rules |
| No compound awareness | Decomposition engine (Phase 16) + compound-gender (Phase 17) | Phase 16-17 | Triple-letter rule can leverage decomposition |
| Manual button deferred (Phase 5 memory) | Now scheduled for Phase 18 | Phase 18 | Addresses long-standing student UX gap |

## Open Questions

1. **Button icon/label:** The success criterion says "visible spell-check button" but doesn't specify the exact design. Recommend a small "Aa" text label or a checkmark icon. I18n strings needed for button tooltip and toast messages. LOW impact -- any reasonable choice works.

2. **Demonstrative rule priority:** STATE.md says "priority 15" for the demonstrative rule. However, since den/det trigger words are disjoint from en/ei/et (nb-gender triggers), any priority near 10-15 works. Priority 12 avoids collision and keeps it in the grammar-error tier. Need to verify no existing rule uses priority 12 -- confirmed: no rule uses 12.

3. **NB vs NN demonstrative forms:** NB and NN share `den/det/denne/dette` for demonstratives. NN also has `desse` (plural), `deira` etc. For singular gender agreement, the forms are identical across NB/NN. The rule can use `languages: ['nb', 'nn']` with the same logic.

4. **Toast i18n:** Toast messages ("3 feil funnet", "Ser bra ut!") need NB and NN variants. The `__lexiI18n.t()` system is already loaded in the content script context. Add new string keys.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `extension/content/spell-check.js`, `spell-check-core.js`, `vocab-seam-core.js` (current code)
- Codebase inspection: `extension/content/spell-rules/nb-gender.js`, `nb-compound-gender.js` (pattern for gender rules)
- Codebase inspection: `extension/content/spell-rules/nb-typo-fuzzy.js` (pattern for typo detection)
- Codebase inspection: `extension/manifest.json` (content script loading order)
- Codebase inspection: `extension/styles/content.css` (CSS dot-colour convention)
- STATE.md pitfall warnings (Pitfall 7: nb-gender collision, Pitfall 8: separate rule file)

### Secondary (MEDIUM confidence)
- Memory: `project_phase5_manual_spellcheck_button.md` (original feature request context)
- REQUIREMENTS.md: SPELL-01, SPELL-02, SPELL-03 requirement text

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - vanilla JS IIFE pattern used by 60+ existing rules, no new dependencies
- Architecture: HIGH - all three features follow established patterns; button is DOM-only, rules use existing registry
- Pitfalls: HIGH - STATE.md explicitly documents the key pitfalls; codebase investigation confirms nounGenus contains definite forms

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (stable codebase patterns)
