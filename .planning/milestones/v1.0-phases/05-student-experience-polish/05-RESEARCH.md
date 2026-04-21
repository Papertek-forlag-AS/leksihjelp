# Phase 5: Student Experience Polish — Research

**Researched:** 2026-04-20
**Domain:** Browser-extension UX — dyslexia-aware copy + progressive disclosure in vanilla-JS content-script popovers/dropdowns
**Confidence:** HIGH (domain is entirely project-internal; all research targets are real files on disk with stable contracts)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Top-3 + "vis flere" mechanics**

- **Spell-check popover multi-suggestion is user-togglable.** Default is OFF (single suggestion, matches today's single-`fix` behavior). When ON, popover shows top-3 clickable suggestions with "Vis flere ⌄" for the rest.
- **Toggle home:** extension popup → Settings tab, alongside the existing grammar-feature toggles in `popup.js`. Persisted in `chrome.storage.local`.
- **Word-prediction dropdown drops from 5 to top-3 default**, with the same "Vis flere ⌄" text link. This is NOT user-togglable — SC-2 applies directly to word-prediction.
- **"Vis flere" visual:** small underlined text link with chevron ("Vis flere ⌄") at the bottom of the list. Same pattern in both surfaces.
- **Reveal behavior:** expand in place; link flips to "Vis færre ⌃" to collapse again.
- **Max reveal cap:** 8 total items (3 default + up to 5 more after reveal).
- **Keyboard:** ArrowDown past item #3 auto-reveals the rest — zero extra keystrokes for keyboard users.
- **Top-1 dominance:** when multi-suggest is ON, always render up to 3 if available. No smart collapse based on confidence gap.

**Explanation copy voice & shape**

- **Voice:** calm, supportive, second-person "du". Non-blaming, dyslexia-aware.
- **Length:** one short sentence, ≤15 words.
- **Personalization:** copy templates the student's actual word into the string (not a static rule-level sentence). Example pattern: `*berde* er en vanlig skrivefeil — prøv *bedre*.`
- **Hedging — split by rule precision:**
  - Assertive for high-precision rules: `nb-typo-curated.js`, `nb-modal-verb.js`
  - Hedged ("kan være", "kanskje") for lower-precision rules: `nb-typo-fuzzy.js`, `nb-gender.js`, `nb-sarskriving.js`
- **Fallback:** each rule supplies a static NB + NN fallback string used when templating can't produce clean copy (e.g. multi-word særskriving findings). Fallback is never the bare class label.
- **Emphasis:** the student's word is rendered with `<em>` and a soft Leksihjelp accent color. Not bold.

**Concrete copy shapes (chosen patterns)**

- **Typo (curated):** `*berde* er en vanlig skrivefeil — prøv *bedre*.`
- **Gender:** `*en bok* kan være feil kjønn — på bokmål er det *ei/en bok*.`
- **Modal-verb:** assertive, names infinitive rule + shows correct form.
- **Særskriving:** hedged, names "to ord som hører sammen" + shows combined form.
- **Typo (fuzzy):** hedged, notes word isn't in dictionary + offers nearest fit(s).
- **Proper-noun-guard, codeswitch:** suppression rules (priority 1 / 5) — not surfaced to the popover, no student-facing copy needed.

**NN register & copy-review artifact**

- **Authored in rule files, not central i18n:** each rule exports `explain: { nb, nn }` (template functions or static strings). Colocated with the rule logic so reviewers see copy and rule together.
- **Runtime register pick:** follow the document's detected language (same signal the rule registry already uses to decide when to fire). NOT tied to the UI-language setting.
- **Reviewer:** dyslexia-persona proxy self-review for v1.0. No external reviewer scheduled.
- **Review doc location:** `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — markdown table with columns `rule id | NB copy | NN copy | reviewer notes`. Committed with the phase, referenced in Release notes.

**Popover layout with explanation**

- **Default (single-fix) layout, top-to-bottom:** `original → fix`, then explanation, then `[✓ Fiks] [✕ Avvis]`. Whitespace-only separator between explanation and buttons (no hairline divider).
- **Multi-suggest ON layout:** explanation above a list of top-3 clickable suggestion rows (each row applies its fix on click); only `[✕ Avvis]` remains as a standalone button. "Vis flere ⌄" sits at the bottom of the suggestion list.
- **No truncation.** The ≤15-word copy rule keeps popover height bounded by design. No `line-clamp`, no scrollable region.

### Claude's Discretion

- Exact CSS styling (padding, font size, colors) for new popover/dropdown elements — style-fit to existing `content.css`.
- Exact accent color for the italic word emphasis — match Leksihjelp brand palette already used elsewhere in the widget.
- Whether the "show alternates" toggle in popup Settings needs a short help-text caption (copywriter decision during implementation).
- Implementation detail of whether `explain` values are always functions (with the word argument) or allow static strings for rules that don't need templating — as long as rules uniformly expose a callable entry point, the renderer works.
- Where to stage the fixture updates so the copy-changes don't break existing check-fixtures runs.

### Deferred Ideas (OUT OF SCOPE)

- Real dyslexic student reviewer (post-v1.0 milestone).
- Native NN speaker copy review (post-v1.0).
- "Why flagged" rich content (examples, mini rule cards).
- Smart top-1 collapse when confidence gap is huge.
- Inline gear-icon in popover.
- Telemetry / instrumentation.
- Manual "Run spell-check" button (tracked in memory for a later phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | Spell-check popover shows student-friendly "why it's flagged" copy per error class (at least 4 error classes × NB and NN), replacing bare labels like "Skrivefeil"; copy reviewed for learner voice. | New `explain: { nb, nn }` rule contract (extends existing string `explain`) + renderer change in `spell-check.js:showPopover` (line 349-375). `typeLabel(t)` at line 377-385 becomes fallback-only. Four target rule files identified: `nb-gender.js`, `nb-modal-verb.js`, `nb-sarskriving.js`, `nb-typo-curated.js` + `nb-typo-fuzzy.js` (same `rule_id: 'typo'` from two rule files — see Pitfall 1). NN register selected via `opts.lang` from core.check, passed through as `ctx.lang` (already live — `nb-gender.js` reads `ctx.lang` today). COPY-REVIEW.md pattern. |
| UX-02 | Suggestions capped at top-3 with a "vis flere" / "show more" reveal in both word-prediction dropdown and spell-check popover. | Word-prediction side: single call-site at `word-prediction.js:509` (requests 5 → requests 8) + `word-prediction.js:528` (splices 5 → splices to visible cap) + `word-prediction.js:1142 showDropdown` render. Spell-check side: `spell-check.js:showPopover` innerHTML template already a single point; multi-suggest needs a new `finding.suggestions[]` contract flowing from fuzzy rule. Settings toggle follows exact pattern from `popup.js:1730 initSettings` + `popup.html:218-224 settings-group > toggle-row`. |
</phase_requirements>

## Summary

This phase is entirely project-internal polish work. No new libraries, no external APIs, no framework choices. The research question is "what existing seams do we extend, and what pitfalls would break UX-01 / UX-02?". Three surfaces change: (1) rule-file `explain` contract, (2) `spell-check.js:showPopover` + `word-prediction.js:showDropdown` render functions, (3) `popup.html`/`popup.js` Settings tab for the new `spellCheckAlternatesVisible` toggle.

Every integration point identified in CONTEXT.md was verified against source: `showPopover` is indeed a single innerHTML template at `spell-check.js:349-375`; the `splice(5)` cap is at `word-prediction.js:528`; rules already carry a string `explain` field. Upgrading `explain` to `{ nb, nn }` with optional template-function values is an additive contract change — the runner in `spell-check-core.js` never reads `rule.explain` today (it's metadata for the UI layer), so zero fixture/runtime behavior changes from the rule-file side.

**Primary recommendation:** Ship UX-01 and UX-02 as one cohesive render-layer change. Author `explain: { nb, nn }` as always-callable (even for static copy, wrap in `() => ({ nb, nn })`) so the renderer has a single code path. Surface alternates in the fuzzy rule by extending `finding.suggestions[]` as an ordered array (top = `finding.fix`) and have the renderer consume `finding.suggestions ?? [finding.fix]`. For word-prediction, raise `findSuggestions(currentWord, 5, ...)` to 8 and slice to 3 or 8 based on expanded state; keep the existing compound-injection path intact.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — this phase uses no new libraries) | — | — | Project is vanilla JS Chrome MV3, zero dependencies in the extension/ tree. Adding a dep for copy-rendering or a 10-line toggle would violate the project's "free + offline, minimal surface" posture. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `chrome.storage.local` (built-in) | Chrome MV3 | Persist `spellCheckAlternatesVisible` boolean. | Mandatory — existing settings pattern for `predictionEnabled`, `enabledGrammarFeatures`, `language`, `lexiPaused`. |
| `self.__lexiI18n` (project-internal at `extension/i18n/strings.js`) | in-tree | UI strings for the new Settings toggle label + dropdown/popover "Vis flere" text. | Use for strings the **user interface framework** displays (Settings copy, "Vis flere ⌄" label). **Do NOT** use for rule-explanation copy — per CONTEXT.md that copy is authored inside rule files, not central i18n. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rule-local `explain: { nb, nn }` | Central `i18n/strings.js` keyed by `rule_id` + `type` | Rejected by CONTEXT.md. Central i18n fragments review (can't see copy next to the rule it belongs to) and forces a second edit per rule. Co-located copy is the blessed pattern for this phase. |
| New `finding.suggestions[]` array | Parallel `finding.alternatives` field alongside `finding.fix` | Cleaner contract if we also rename `fix` → `suggestions[0]`, but that cascades through `dismissKey`, applyFix, and every fixture. Additive `finding.suggestions` with `finding.fix` preserved as the canonical top pick keeps all existing call-sites untouched — including `check-fixtures.js:190-195 matchesExpected` which still reads `finding.fix`. |
| Inline gear icon in popover for the alternates toggle | The popup Settings tab (current CONTEXT.md pick) | Gear icon is faster access; Settings tab is discoverable by users already trained on the grammar-feature toggles. CONTEXT.md chose Settings tab. Future UX iteration could add the gear. |

**Installation:** n/a (no deps).

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── content/
│   ├── spell-check.js              # showPopover gains multi-suggest branch + explain render
│   ├── spell-check-core.js         # unchanged (never reads rule.explain today)
│   ├── word-prediction.js          # showDropdown gains top-3 + "Vis flere" reveal
│   └── spell-rules/
│       ├── nb-gender.js            # explain: 'string' → { nb, nn } (callable or static)
│       ├── nb-modal-verb.js        # same
│       ├── nb-sarskriving.js       # same — plus fallback path for multi-word findings
│       ├── nb-typo-curated.js      # same — assertive voice
│       ├── nb-typo-fuzzy.js        # same — hedged voice; emits finding.suggestions[]
│       ├── nb-propernoun-guard.js  # unchanged — suppression rule, no popover surface
│       └── nb-codeswitch.js        # unchanged — suppression rule, no popover surface
├── popup/
│   ├── popup.html                  # NEW settings-group for "Vis flere skriveforslag"
│   └── popup.js                    # initSettings() reads/writes spellCheckAlternatesVisible
└── styles/
    └── content.css                 # lh-spell-explain, lh-spell-suggestions,
                                    # lh-spell-emph, lh-spell-vis-flere,
                                    # lh-pred-vis-flere
.planning/phases/05-student-experience-polish/
└── COPY-REVIEW.md                  # NEW: one-screen table, 4 rules × NB/NN
```

### Pattern 1: Additive rule `explain` contract (UX-01)

**What:** Upgrade `rule.explain` from a single string to a callable that returns `{ nb, nn }` per register. Static-copy rules wrap in an arrow lambda; templated-copy rules receive the finding + word context.

**When to use:** Every rule file that surfaces to the popover — `nb-gender.js`, `nb-modal-verb.js`, `nb-sarskriving.js`, `nb-typo-curated.js`, `nb-typo-fuzzy.js`. The two suppression rules (`nb-propernoun-guard.js`, `nb-codeswitch.js`) keep their existing string `explain` — never rendered to popover.

**Example (hedged rule):**
```javascript
// Source: pattern for Phase 5, mirrors existing explain-string convention
// at extension/content/spell-rules/nb-gender.js:32 etc.
const rule = {
  id: 'gender',
  languages: ['nb', 'nn'],
  priority: 10,
  explain: (finding) => ({
    nb: `<em>${finding.original} ${finding.nounDisplay}</em> kan være feil kjønn — på bokmål er det <em>${finding.fix} ${finding.nounDisplay}</em>.`,
    nn: `<em>${finding.original} ${finding.nounDisplay}</em> kan vere feil kjønn — på nynorsk er det <em>${finding.fix} ${finding.nounDisplay}</em>.`,
  }),
  check(ctx) { /* unchanged */ },
};
```

**Example (assertive rule, static):**
```javascript
// Source: pattern for nb-typo-curated.js
const rule = {
  id: 'typo',
  languages: ['nb', 'nn'],
  priority: 40,
  explain: (finding) => ({
    nb: `<em>${finding.original}</em> er en vanlig skrivefeil — prøv <em>${finding.fix}</em>.`,
    nn: `<em>${finding.original}</em> er ein vanleg skrivefeil — prøv <em>${finding.fix}</em>.`,
  }),
  check(ctx) { /* unchanged */ },
};
```

**Fallback pattern (rule can't template cleanly — e.g., særskriving):**
```javascript
explain: (finding) => {
  if (!finding.original || !finding.fix) {
    return {
      nb: 'To ord som kanskje hører sammen.',
      nn: 'To ord som kanskje høyrer saman.',
    };
  }
  return {
    nb: `<em>${finding.original}</em> kan være to ord som hører sammen som <em>${finding.fix}</em>.`,
    nn: `<em>${finding.original}</em> kan vere to ord som høyrer saman som <em>${finding.fix}</em>.`,
  };
},
```

### Pattern 2: Renderer resolves explanation at popover time (UX-01)

**What:** `spell-check.js:showPopover` calls `rule.explain(finding)` when rendering. Looks the rule up by `finding.rule_id` via `self.__lexiSpellRules.find(r => r.id === finding.rule_id && r.languages.includes(lang))`. Picks `.nb` or `.nn` per `VOCAB.getLanguage()`. Inner HTML goes through a safe template (the `<em>` substitution must bypass `escapeHtml`; everything else stays escaped).

**When to use:** Only call site is `showPopover(idx, finding)` at `spell-check.js:349`. `typeLabel(t)` at line 377-385 stays as a last-ditch fallback for the `default:` case.

**Verified security note:** current renderer calls `escapeHtml(finding.original)` and `escapeHtml(finding.fix)`. Rule-authored HTML containing `<em>` must be the rule's responsibility to escape the interpolated word first, then wrap in `<em>`. Pattern: rule builder uses `escapeHtml` from core (expose via `self.__lexiSpellCore.escapeHtml`) to stringify each interpolation, then concatenates with `<em>…</em>` wrappers.

### Pattern 3: Progressive-disclosure cap in word-prediction (UX-02)

**What:**
1. Raise `findSuggestions(currentWord, 5, ...)` at `word-prediction.js:509` to request 8 candidates.
2. Keep the existing compound-injection path at line 511-529 intact (still `suggestions.splice(5)` there? No — update to `suggestions.splice(8)` so the compound doesn't clip at the old cap before the view slices to 3).
3. In `showDropdown(suggestions, el)` at line 1142, render `suggestions.slice(0, expanded ? 8 : 3)` + a "Vis flere ⌄" footer row when `suggestions.length > 3 && !expanded`. Clicking the row sets local `expanded = true` and re-renders the dropdown body in place (no full hide/show — preserves selection).
4. Keyboard: `handleKeydown` ArrowDown at `word-prediction.js:547` — when `selectedIndex` would advance past the last visible item AND `suggestions.length > visible`, flip `expanded = true` and re-render instead of wrapping to 0.

**When to use:** Applies to every language (NB/NN/DE/ES/FR/EN) — word-prediction is language-agnostic. No per-language gating.

### Pattern 4: Progressive-disclosure cap in spell-check popover (UX-02)

**What:** The fuzzy rule (`nb-typo-fuzzy.js`) grows from returning a single `fix` to a `suggestions[]` array sorted by score. The curated rule (`nb-typo-curated.js`) typically has one answer (the typo map is 1:1); `suggestions` = `[fix]`. Gender, modal, særskriving: similarly `[fix]`. Renderer consumes `finding.suggestions ?? [finding.fix]` — preserves back-compat with any finding that doesn't carry `suggestions`.

**Toggle gating:**
- `spellCheckAlternatesVisible` read once at init + on `chrome.storage.onChanged`.
- When OFF (default): popover shows single `[✓ Fiks]` + `[✕ Avvis]` buttons using `finding.suggestions[0] ?? finding.fix`.
- When ON: popover shows list of top-3 clickable rows + `[✕ Avvis]` only; "Vis flere ⌄" below the list when more than 3 candidates exist.

**Max cap:** 8 total candidates after reveal. The fuzzy rule's existing `findFuzzyNeighbor` only tracks a single `best` via `if (score > bestScore)` — for Phase 5 this must become a top-K min-heap OR a sort-and-slice pattern to surface 8 candidates. Sort-and-slice is simpler (N is small per-query, the bottleneck is the scan over `validWords`).

### Pattern 5: Settings-tab toggle (follows existing precedent)

**What:** One checkbox row in `popup.html` Settings view, initialized + handled in `popup.js:initSettings`.

**Example (follows the `setting-prediction` pattern at `popup.html:218-224`, `popup.js:1731-1735`, `popup.js:1830-1837`):**
```html
<!-- popup.html — new settings-group -->
<div class="settings-group glass">
  <h3 data-i18n="settings_spellcheck_alternates_title">Skriveforslag</h3>
  <label class="toggle-row">
    <span data-i18n="settings_spellcheck_alternates_toggle">Vis alternative skriveforslag</span>
    <input type="checkbox" id="setting-spellcheck-alternates">
    <span class="toggle-slider"></span>
  </label>
  <p class="settings-note" data-i18n="settings_spellcheck_alternates_note">Viser opptil 3 forslag om gangen i stedet for bare ett</p>
</div>
```

```javascript
// popup.js — inside initSettings()
const alternatesToggle = document.getElementById('setting-spellcheck-alternates');
const altStored = await chromeStorageGet('spellCheckAlternatesVisible');
alternatesToggle.checked = altStored === true; // default false
alternatesToggle.addEventListener('change', async () => {
  await chromeStorageSet({ spellCheckAlternatesVisible: alternatesToggle.checked });
  // No broadcast needed — spell-check.js reads via chrome.storage.onChanged listener
});
```

```javascript
// spell-check.js — in init(), after the other storageGet
let alternatesVisible = false;
chrome.storage.local.get('spellCheckAlternatesVisible', (r) => {
  alternatesVisible = r.spellCheckAlternatesVisible === true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'spellCheckAlternatesVisible' in changes) {
    alternatesVisible = changes.spellCheckAlternatesVisible.newValue === true;
    // Re-render active popover if one is open
    if (popover && activePopoverIdx >= 0) showPopover(activePopoverIdx, lastFindings[activePopoverIdx]);
  }
});
```

### Anti-Patterns to Avoid

- **Calling `rule.explain` from `spell-check-core.js`.** Core stays pure — the renderer is the only consumer of `explain`. Keeping `explain` out of the findings array preserves the INFRA-04 separability contract (fixture harness + core have no UI coupling).
- **Storing expanded-state globally on `word-prediction.js`.** Expansion is per-dropdown-session; when the dropdown hides or the query changes, expanded resets to false. Otherwise: user types "häl" → expands → types "hält" → still expanded with stale candidates.
- **Re-running `check()` on toggle flip.** The toggle changes rendering, not rule semantics. Invalidating the finding cache forces every marker to be re-computed and re-positioned, which flickers. Only re-render the active popover.
- **Using `innerHTML = …` with raw `finding.original` inside an `<em>` tag without escaping.** XSS surface via any malicious textarea content. Escape the interpolated substring first, then wrap.
- **Hard-coding `lang === 'nb'` in the renderer.** Read `VOCAB.getLanguage()` once at `showPopover` time. This is already what `runCheck` does at `spell-check.js:204`.
- **Letting the "Vis flere" reveal trigger `applyFix`.** The reveal is a distinct row; must `stopPropagation` and `preventDefault` on its mousedown/click, exactly like `.lh-pred-item` handlers do today at `word-prediction.js:1180-1186`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle persistence | Custom "settings.json" file in extension data dir | `chrome.storage.local` via the existing `chromeStorageGet`/`chromeStorageSet` helpers in `popup.js` | MV3 extensions persist to chrome.storage — writing to a file is impossible in the content-script sandbox. |
| HTML escaping for the italic emphasis | Per-file escape helper | The existing `escapeHtml` in `spell-check.js:565` (or core's equivalent if exposed) | A second implementation drifts; see Pitfall 3. |
| Rule lookup by id in the renderer | `__lexiSpellRules[0]` indexing or rule re-registration | `self.__lexiSpellRules.find(r => r.id === finding.rule_id && r.languages.includes(lang))` | The registry order is sort-stable but not deterministic across branches (Phase 4 added suppression rules at priorities 1 / 5 that shift indices). |
| Top-K fuzzy candidate tracking | Manual array + sort-on-every-push | `scoreCandidate` + `sort((a,b) => b.score - a.score).slice(0, 8)` over the current single-best scan | Fuzzy already scans the full `validWords` set; appending scored candidates to an array and sorting once at the end is O(N log N) vs O(N) single-best, but N ~ 13k so < 2ms. |
| NB/NN register selection | Per-rule `lang === 'nb' ? 'nb' : 'nn'` branching | Single renderer branch: `explain[VOCAB.getLanguage()]` with fallback to `.nb` if missing | One place to maintain. |
| Chevron icon | SVG or FontAwesome import | Unicode `⌄` / `⌃` characters (already used in `word-prediction.js` for compound hint patterns) | Zero asset cost, works in dyslexia-friendly fonts. |

**Key insight:** The project is deliberately zero-dep. Every "don't hand-roll" line maps to a chrome-API or internal-helper that already exists. Adding a dep for this phase would be a regression.

## Common Pitfalls

### Pitfall 1: Two rules share `rule_id: 'typo'` (curated + fuzzy)

**What goes wrong:** `nb-typo-curated.js` (priority 40) and `nb-typo-fuzzy.js` (priority 50) both emit findings with `rule_id: 'typo'`. A renderer that looks up the `explain` function via `rules.find(r => r.id === finding.rule_id)` returns the curated rule's `explain` (first match by priority) — but the finding might have come from the fuzzy rule, which per CONTEXT.md uses different (hedged) copy.
**Why it happens:** INFRA-03's rule-plugin design intentionally kept two rules under one `rule_id` for backwards-compat with the pre-Phase-3 inline implementation. The fixture contract keys on `rule_id`, not file identity.
**How to avoid:** Route `explain` selection by priority match as well: `rules.find(r => r.id === finding.rule_id && r.priority === finding.priority && r.languages.includes(lang))`. Requires adding `priority` to the finding object at emit time — a one-line additive change in each rule. Alternative: give each rule a distinct `explain_id` that the finding carries alongside `rule_id`, decoupling explanation lookup from rule semantics. Prefer the `priority` carry — it's already a rule property, doesn't invent new fields.
**Warning signs:** Running the dyslexia-persona review on fuzzy-suggested words and getting back "this is a common typo" assertive copy instead of the hedged "this word isn't in the dictionary" copy. Caught by the COPY-REVIEW.md review step.

### Pitfall 2: `explain: 'string'` legacy vs `explain: (finding) => ({nb, nn})`

**What goes wrong:** Suppression rules (`nb-propernoun-guard.js`, `nb-codeswitch.js`) keep their string `explain` per CONTEXT.md. A renderer that blindly calls `typeof rule.explain === 'function' ? rule.explain(finding) : rule.explain` must handle both shapes. A too-clever renderer that assumes always-callable throws on the suppression rules.
**Why it happens:** CONTEXT.md explicitly scopes the upgrade to the 4 surfaced-to-popover rules (gender, modal-verb, særskriving, typo). Suppression rules stay untouched.
**How to avoid:** Renderer only reaches `rule.explain` for findings it actually renders. Suppression rules emit `return []` (verified at `nb-propernoun-guard.js:147` and `nb-codeswitch.js:96`) — their findings never reach the popover. So the renderer only ever calls `explain` on rules that have the upgraded shape. Defensive belt-and-braces: if `typeof rule.explain === 'string'` at render time, render as-is (legacy path) and warn in dev.
**Warning signs:** Typeerror `rule.explain is not a function` in console when interacting with a popover. Caught by the "smoke test a popover on each of the 4 error classes" step at release time.

### Pitfall 3: XSS via `<em>` templating

**What goes wrong:** Rule author writes `` `<em>${finding.original}</em>` `` to emphasize the student's word. If `finding.original` contains `<script>` or raw HTML from a contenteditable div paste, the innerHTML assignment at `spell-check.js:355` becomes an injection vector.
**Why it happens:** `finding.original` is `t.display` (the raw surface form of a token), which comes from user input. The existing renderer escapes it at line 357. The new `explain` path mixes HTML (the `<em>` tags) with user input, and an author might forget to escape.
**How to avoid:** Expose `escapeHtml` on `self.__lexiSpellCore` (add to the dual-export list alongside `tokenize`, `matchCase`, etc.) and require rule authors to call `escapeHtml(finding.original)` before concatenating into the `<em>` wrapper. Document this requirement in `spell-rules/README.md`. Add a simple build-time grep-style check — if any rule file references `finding.original` inside a string containing `<em>` without an adjacent `escapeHtml(`, warn.
**Warning signs:** Pasting `<script>alert(1)</script>` into a textarea triggers a popover whose explanation runs the script. Caught by a one-line test case in fixtures that pastes angle-bracket content.

### Pitfall 4: Register-pick drifts from findings

**What goes wrong:** CONTEXT.md says "runtime register pick: follow the document's detected language (same signal the rule registry already uses to decide when to fire)". Audit of the codebase shows the signal the rule registry uses to decide when to fire is `opts.lang` passed to `core.check(text, vocab, { lang })` — and `lang` comes from `VOCAB.getLanguage()` in `spell-check.js:204`, which is the user's session language, NOT a per-document auto-detection. There is no per-document NB/NN detector in the extension today.
**Why it happens:** CONTEXT.md phrasing "document's detected language" reads like automatic NB/NN sniffing; reality is the user-set session language. Findings carry no `lang` field today (verified by grepping `finding.lang` across spell-check-core.js and all rule files — zero matches).
**How to avoid:** Renderer reads `VOCAB.getLanguage()` once per `showPopover` call, uses it to pick `.nb` vs `.nn`. Document the convention: "register follows `VOCAB.getLanguage()` — this is the session language, not document-scoped detection. If/when per-document detection lands, the renderer switches to `finding.lang`." Plan-author note: this is deliberate v1 simplification — auto-detect is not in scope for Phase 5.
**Warning signs:** A user running their UI in NB pastes NN text, gets NB-voiced explanation copy. Acceptable for v1 per out-of-scope (deferred NN native reviewer item).

### Pitfall 5: Expanded state persists across dropdown sessions

**What goes wrong:** User types `häl`, dropdown shows top-3 + "Vis flere ⌄". Clicks reveal. Types another letter — dropdown re-renders with the new candidate set but `expanded = true` from the prior session leaks, so user sees 8 candidates for a query that might only have 3.
**Why it happens:** `showDropdown` is called every keystroke via `schedulePrediction` → `runPrediction`. If `expanded` is a module-scoped var, it survives across calls.
**How to avoid:** Reset `expanded = false` at the top of `showDropdown` (before innerHTML assignment). This matches the existing reset of `selectedIndex = 0` at `word-prediction.js:1143`. Exception: the reveal click handler sets `expanded = true` THEN calls re-render without going through the full `runPrediction` cycle (direct `renderDropdownBody` call). So two code paths: `runPrediction` → `showDropdown` → always reset; reveal-click → only updates body.
**Warning signs:** Visual glitch where a single-letter change reveals 8 candidates without the user clicking "Vis flere" for that query. Caught by a keyboard-interaction smoke test at release time.

### Pitfall 6: Compound-injection path clips top candidates

**What goes wrong:** `word-prediction.js:520-527` uses `suggestions.unshift(...)` to prepend compound-word hits with +300 score, then `suggestions.splice(5)` at line 528 trims to the old cap. If compound has 4 hits, the unshift pushes the original top candidates past index 5, and the splice truncates them — the user sees 4 compound hits + only 1 regular top candidate. Phase 5's cap change (5 → 8 requested, 3 visible) must raise the compound splice too, or regular top candidates disappear even when the student didn't ask for "Vis flere".
**Why it happens:** The splice cap is coupled to the old 5-candidate limit. Any cap change that isn't unified breaks the compound-priority invariant.
**How to avoid:** Replace `suggestions.splice(5)` with `suggestions.splice(MAX_CANDIDATES)` where `MAX_CANDIDATES = 8` (the reveal cap). View-layer slicing at `showDropdown` handles the visible-3 / visible-8 logic. Keep compound injection and view slicing separate concerns.
**Warning signs:** Typing "skole" in NB shows only `skolesekk` compound suggestion and nothing else, despite the dictionary having `skolegård`, `skolebuss`, etc.

### Pitfall 7: Fuzzy rule needs top-K, not just top-1

**What goes wrong:** `nb-typo-fuzzy.js:79-98 findFuzzyNeighbor` currently tracks a single `best` via `if (score > bestScore) { bestScore = score; best = cand; }`. UX-02 multi-suggest needs top-3 (or top-8) — the single-best pattern discards all but the winner.
**Why it happens:** The original rule shipped with single-best before UX-02 was scoped.
**How to avoid:** Change `findFuzzyNeighbor` to return an array `[ { word, score }, ... ]` sorted score-desc, then the rule's `check` emits `suggestions: neighbors.slice(0, 8).map(n => matchCase(t.display, n.word))`. Keep `fix: suggestions[0]` for back-compat with curated rule + fixture harness. The Zipf tiebreaker logic (Plan 03-03) stays inside `scoreCandidate` — no change.
**Warning signs:** Multi-suggest toggle ON, popover shows only 1 suggestion row for fuzzy-rule findings even when obvious alternates exist. Caught by a dyslexia-persona review spot-check.

### Pitfall 8: COPY-REVIEW.md diverges from shipped strings

**What goes wrong:** COPY-REVIEW.md table says rule X's NB copy is "A", but the shipped rule file emits "B" because a last-minute edit wasn't reflected in the table.
**Why it happens:** The review artifact is manual — no generator reads the rule files and emits the table.
**How to avoid:** Add a lightweight Node script (`scripts/check-copy-review.js` or inline in `check-fixtures.js`) that iterates the 4 popover-surfacing rules, invokes `rule.explain({original:'<ORIG>', fix:'<FIX>', ...})` with placeholder strings, and asserts the produced NB/NN strings appear in COPY-REVIEW.md. Keeps the review doc truthful by CI gate. Alternative: generate COPY-REVIEW.md from rule files as a build step (but editing the table during review becomes harder). Prefer the assertion-gate approach.
**Warning signs:** Release reviewer spot-checks a popover, sees copy different from the review doc, raises a ship blocker. Prevented by the CI check.

### Pitfall 9: `_lang_` register pick when explain returns a single string

**What goes wrong:** An author accidentally writes `explain: (f) => 'some string'` (returns string, not `{nb, nn}`). Renderer does `explain[lang]` → `undefined`.
**Why it happens:** Copy-paste from the old string `explain` shape. No type checker in vanilla JS.
**How to avoid:** Renderer validates: `if (typeof result === 'string') return result; if (result && typeof result[lang] === 'string') return result[lang]; if (result && typeof result.nb === 'string') return result.nb; return typeLabel(finding.type);` — graceful degradation through string → correct-register → NB fallback → class label. Document the triple fallback in `showPopover` comments.
**Warning signs:** Popover shows "undefined" or blank where the explanation should be. Prevented by graceful fallback chain.

## Code Examples

Verified patterns from existing project sources:

### showPopover with multi-suggest branch

```javascript
// Source: pattern for spell-check.js showPopover (replaces lines 349-375)
function showPopover(idx, finding) {
  hidePopover();
  activePopoverIdx = idx;
  popover = document.createElement('div');
  popover.className = `lh-spell-popover lh-spell-popover-${finding.type}`;
  popover.addEventListener('mousedown', e => e.preventDefault());

  const lang = VOCAB.getLanguage(); // 'nb' or 'nn'
  const suggestions = finding.suggestions || [finding.fix];
  const explainHtml = renderExplain(finding, lang); // handles XSS + fallback chain

  if (alternatesVisible && suggestions.length > 1) {
    // Multi-suggest layout
    const topK = suggestions.slice(0, 3);
    const rest  = suggestions.slice(3, 8);
    popover.innerHTML = `
      <div class="lh-spell-head">
        <span class="lh-spell-orig">${escapeHtml(finding.original)}</span>
      </div>
      <div class="lh-spell-explain">${explainHtml}</div>
      <div class="lh-spell-suggestions">
        ${topK.map(s => `<button class="lh-spell-sugg-row" data-fix="${escapeAttr(s)}">${escapeHtml(s)}</button>`).join('')}
        ${rest.length ? `<button class="lh-spell-vis-flere" data-state="collapsed">Vis flere ⌄</button>` : ''}
      </div>
      <div class="lh-spell-actions">
        <button type="button" class="lh-spell-btn lh-spell-decline">✕ Avvis</button>
      </div>`;
    // Wire up row clicks
    popover.querySelectorAll('.lh-spell-sugg-row').forEach(r => {
      r.addEventListener('click', () => applyFix({ ...finding, fix: r.dataset.fix }));
    });
    if (rest.length) {
      popover.querySelector('.lh-spell-vis-flere').addEventListener('click', e => {
        // expand in place
        const state = e.currentTarget.dataset.state;
        if (state === 'collapsed') {
          rest.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'lh-spell-sugg-row';
            btn.dataset.fix = s;
            btn.textContent = s;
            btn.addEventListener('click', () => applyFix({ ...finding, fix: s }));
            e.currentTarget.parentNode.insertBefore(btn, e.currentTarget);
          });
          e.currentTarget.textContent = 'Vis færre ⌃';
          e.currentTarget.dataset.state = 'expanded';
        } else {
          // collapse — remove the rest
          const rows = popover.querySelectorAll('.lh-spell-sugg-row');
          for (let i = 3; i < rows.length; i++) rows[i].remove();
          e.currentTarget.textContent = 'Vis flere ⌄';
          e.currentTarget.dataset.state = 'collapsed';
        }
      });
    }
  } else {
    // Single-suggest (default) layout
    popover.innerHTML = `
      <div class="lh-spell-head">
        <span class="lh-spell-orig">${escapeHtml(finding.original)}</span>
        <span class="lh-spell-arrow">→</span>
        <span class="lh-spell-fix-text">${escapeHtml(suggestions[0])}</span>
      </div>
      <div class="lh-spell-explain">${explainHtml}</div>
      <div class="lh-spell-actions">
        <button type="button" class="lh-spell-btn lh-spell-accept">✓ Fiks</button>
        <button type="button" class="lh-spell-btn lh-spell-decline">✕ Avvis</button>
      </div>`;
    popover.querySelector('.lh-spell-accept').addEventListener('click', () => applyFix(finding));
  }

  popover.querySelector('.lh-spell-decline').addEventListener('click', () => {
    dismissed.add(dismissKey(finding));
    hidePopover();
    runCheck();
  });
  overlay.appendChild(popover);
  positionPopover(markers[idx]?.rect);
}
```

### renderExplain with graceful fallback

```javascript
// Source: new helper in spell-check.js
function renderExplain(finding, lang) {
  const rules = self.__lexiSpellRules || [];
  // Pitfall 1: route by rule_id AND priority to disambiguate curated vs fuzzy
  const rule = rules.find(r =>
    r.id === finding.rule_id &&
    r.priority === finding.priority &&
    r.languages && r.languages.includes(lang)
  ) || rules.find(r => r.id === finding.rule_id);

  if (!rule) return escapeHtml(typeLabel(finding.type));

  let result;
  try {
    result = typeof rule.explain === 'function' ? rule.explain(finding) : rule.explain;
  } catch (e) {
    console.warn('[lexi-spell] rule.explain threw', rule.id, e);
    return escapeHtml(typeLabel(finding.type));
  }

  // Pitfall 9: graceful fallback chain
  if (typeof result === 'string') return result;                   // legacy string
  if (result && typeof result[lang] === 'string') return result[lang];
  if (result && typeof result.nb === 'string') return result.nb;   // NB fallback
  return escapeHtml(typeLabel(finding.type));                       // last-ditch
}
```

### Word-prediction top-3 + reveal

```javascript
// Source: pattern for word-prediction.js showDropdown (replaces line 1142)
const VISIBLE_DEFAULT = 3;
const VISIBLE_EXPANDED = 8;
let expanded = false; // module-scoped

function showDropdown(suggestions, el) {
  selectedIndex = 0;
  expanded = false; // Pitfall 5: reset on every new dropdown session
  renderDropdownBody(suggestions, el);
  positionDropdown(el);
  dropdown.classList.add('visible');
}

function renderDropdownBody(suggestions, el) {
  const visible = suggestions.slice(0, expanded ? VISIBLE_EXPANDED : VISIBLE_DEFAULT);
  const hasMore = !expanded && suggestions.length > VISIBLE_DEFAULT;
  dropdown.innerHTML = visible.map((s, i) => {
    // ... existing item render ...
  }).join('') +
  (hasMore ? `<div class="lh-pred-vis-flere" role="button" tabindex="-1">${escapeHtml(t('pred_vis_flere'))} ⌄</div>` : '') +
  `<div class="lh-pred-footer">...</div>`;

  if (hasMore) {
    dropdown.querySelector('.lh-pred-vis-flere').addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      expanded = true;
      renderDropdownBody(suggestions, el); // re-render in place
    });
  }
  attachItemHandlers(); // extract existing click/mousedown handlers into a helper
}

function handleKeydown(e) {
  if (!dropdown || !dropdown.classList.contains('visible')) return;
  const items = dropdown.querySelectorAll('.lh-pred-item');
  if (!items.length) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    e.stopPropagation();
    // Keyboard reveal: if stepping past last visible item and there are more, expand
    if (selectedIndex === items.length - 1 && !expanded && lastSuggestions.length > items.length) {
      expanded = true;
      renderDropdownBody(lastSuggestions, activeElement);
      selectedIndex = VISIBLE_DEFAULT; // advance into the newly-revealed rows
    } else {
      selectedIndex = (selectedIndex + 1) % items.length;
    }
    updateSelection(dropdown.querySelectorAll('.lh-pred-item'));
  }
  // ... other keys unchanged ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single fix per finding (`finding.fix`) | Fuzzy rule emits ordered `finding.suggestions[]`, renderer opts into multi-row UI via `spellCheckAlternatesVisible` setting | Phase 5 | UX-02 + future-proofs the finding contract for any rule that wants to surface alternates |
| Bare class label in popover (`typeLabel(t)` at `spell-check.js:377-385`) | Per-rule `explain: { nb, nn }` (callable), renderer picks register from `VOCAB.getLanguage()` | Phase 5 | UX-01 |
| Word-prediction shows 5 candidates, hard cap | Word-prediction shows 3 (default) → 8 (expanded); ArrowDown auto-reveals past item #3 | Phase 5 | Reduced cognitive load for dyslexic users |
| Rule `explain: 'string'` as in-file metadata, unused by renderer | Rule `explain: (finding) => ({ nb, nn })` invoked by renderer at popover time | Phase 5 | Copy authoring stays next to rule logic (CONTEXT.md decision) |

**Deprecated/outdated:**
- `typeLabel(t)` at `spell-check.js:377-385` — stays as a last-resort fallback in `renderExplain`, no longer the primary source of popover text.

## Open Questions

1. **Should `finding.priority` be added to the finding contract for Pitfall 1 disambiguation, or is a separate `finding.explain_id` cleaner?**
   - What we know: Both curated-typo (priority 40) and fuzzy-typo (priority 50) emit `rule_id: 'typo'`. The renderer needs to pick the right `explain` function.
   - What's unclear: `priority` is already a rule property — carrying it on findings is minimally invasive. `explain_id` would decouple but invents a new field.
   - Recommendation: Add `priority` to the emitted finding (single line in each rule's emit block). Document in `spell-rules/README.md`. Revisit if a future rule wants to share `priority` with a different `explain` (unlikely).

2. **Should the fuzzy rule's top-K be bounded at the rule layer (e.g., return max 8 neighbors) or at the renderer layer (return all, let renderer slice)?**
   - What we know: `validWords` is ~13k entries; scoring is O(N) and the current single-best scan is fast (< 2ms).
   - What's unclear: Sorting the full neighbor set and slicing to 8 is O(N log N) in the worst case if every word is within the edit-distance threshold (rare — bounded by `k = len <= 6 ? 1 : 2` so neighbor set is usually < 20).
   - Recommendation: Bound at the rule layer (return max 8). Simpler renderer contract; bounded memory. The min-heap optimization is premature.

3. **Does the word-prediction reveal-on-ArrowDown also trigger when user has Tab-ed into the dropdown from the editor, or only after they've ArrowDown'd to item 3?**
   - What we know: Existing `handleKeydown` at `word-prediction.js:541-567` only fires when dropdown is `.visible`. Tab is an apply-key today (`e.key === 'Tab' || e.key === 'Enter'`), not a navigation key.
   - What's unclear: Should Tab from an unfocused dropdown enter "selected" state at index 0 first, then ArrowDown from there? Or does first ArrowDown set index 0, subsequent ArrowDowns navigate?
   - Recommendation: Preserve current behavior — `selectedIndex = 0` on show, ArrowDown advances. Reveal triggers when ArrowDown would advance past the last visible item AND more are available. Tab/Enter always applies the selected item.

4. **Does Pattern 5's chrome.storage.onChanged listener fire for the active tab on the same-tab settings change, or only in other tabs?**
   - What we know: `chrome.storage.onChanged` fires in all contexts where the listener is registered, including the tab that originated the change (verified pattern in the project — see `background/service-worker.js` and the `PREDICTION_TOGGLED` message path).
   - What's unclear: N/A — verified against Chrome MV3 docs pattern.
   - Recommendation: Use `chrome.storage.onChanged` in `spell-check.js` + `word-prediction.js` (if ever applicable). No runtime message needed — keeps the seam thin.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node custom script `scripts/check-fixtures.js` (Phase 1 harness — INFRA-02) + paired self-tests |
| Config file | None (`.jsonl` files in `fixtures/{nb,nn}/`) |
| Quick run command | `npm run check-fixtures` |
| Full suite command | `npm run check-fixtures && npm run check-network-silence && npm run check-bundle-size` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Rule `explain: { nb, nn }` contract exists for the 4 popover-surfacing rules (gender, modal-verb, særskriving, typo). | static | New `scripts/check-explain-contract.js` — iterates `extension/content/spell-rules/nb-*.js`, loads each under Node, asserts `typeof rule.explain === 'function'` AND `rule.explain({original:'x', fix:'y'})` returns an object with string `nb` + `nn` keys. Exits 0/1. | No — Wave 0 creates it |
| UX-01 | COPY-REVIEW.md matches shipped rule copy. | static | Extend `scripts/check-fixtures.js` OR new `scripts/check-copy-review.js`: for each surfacing rule, invoke explain with a placeholder, grep COPY-REVIEW.md for the returned NB + NN strings. | No — Wave 0 creates it |
| UX-01 | Dyslexia-persona review confirms voice (SC-3). | manual-only (dyslexia persona proxy) | Human review against `.planning/PROJECT.md` persona criteria. Not a CI gate. | COPY-REVIEW.md owns the evidence |
| UX-02 | Popover renders top-3 + "Vis flere ⌄" when `spellCheckAlternatesVisible = true` AND `finding.suggestions.length > 3`. | manual smoke + fixture | Load extension unpacked, set toggle ON, paste a fixture sentence containing a typo with ≥4 fuzzy neighbors (new fixture case: `nb-typo-multi-001` with a rare-looking word like `häldet` → `heldet/meldet/bedet/heltet/haldet`). Confirm dropdown behavior visually. | Fixture case to be added in Wave 2 |
| UX-02 | Word-prediction dropdown shows 3 by default, 8 after reveal, preserves compound-priority across cap change. | manual smoke | Type `skole` in NB textarea — confirm top-3 includes any compound hit; click "Vis flere"; confirm 5 more appear. No fixture file exercises word-prediction (it's not in the fixture harness scope — Phase 1 fixture only covers spell-check). | Out of fixture scope |
| UX-02 | Word-prediction reveal-on-ArrowDown triggers past item #3. | manual smoke | Same as above, but use keyboard only: ArrowDown 3× → should show selection on item 3; 4th ArrowDown reveals items 4-8 with selection on item 4. | Out of fixture scope |
| UX-02 | XSS safety: paste `<script>` into a textarea, confirm popover rendering doesn't execute it. | manual smoke + unit | Add fixture case `nb-typo-xss-001` with text containing `<` and `>` characters, confirm fixture still matches expected fix. Separately, manual smoke in Chrome. | Fixture case to be added in Wave 2 |

### Sampling Rate
- **Per task commit:** `npm run check-fixtures` (fast; also runs new explain-contract gate when it lands).
- **Per wave merge:** Full release gates — `npm run check-fixtures && npm run check-network-silence && npm run check-bundle-size`.
- **Phase gate:** Full suite green + COPY-REVIEW.md dyslexia-persona proxy review completed + manual Chrome smoke test against the 4 rule classes and the word-prediction dropdown. Recommended for `/gsd:verify-work 05`.

### Wave 0 Gaps
- [ ] `scripts/check-explain-contract.js` — loads each `extension/content/spell-rules/nb-*.js` under Node, asserts `rule.explain` is callable and returns `{nb, nn}` for the 4 popover-surfacing rules.
- [ ] `scripts/check-explain-contract.test.js` — paired self-test (mirrors `check-network-silence.test.js` pattern from Phase 3) that plants a rule file with broken explain and confirms the gate fires.
- [ ] `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — initial table scaffold.
- [ ] Expose `escapeHtml` on `self.__lexiSpellCore` (dual-export footer of `spell-check-core.js`) — required for XSS-safe templating in rule files.
- [ ] Update `extension/content/spell-rules/README.md` with the `explain: { nb, nn }` contract, XSS-escape rule, and `priority` disambiguation note.

## Sources

### Primary (HIGH confidence)

- `extension/content/spell-check.js:340-385` — `showPopover` + `typeLabel` (the single point of UX-01 layout change).
- `extension/content/spell-check.js:200-233` — `runCheck` + vocab assembly (confirms register source is `VOCAB.getLanguage()` at line 204).
- `extension/content/spell-check-core.js:1-120` — rule runner, confirms core never reads `rule.explain` (pure metadata for UI).
- `extension/content/spell-rules/nb-typo-fuzzy.js:79-98` — single-best neighbor scan (must grow to top-K for UX-02).
- `extension/content/spell-rules/nb-typo-curated.js`, `nb-gender.js`, `nb-modal-verb.js`, `nb-sarskriving.js` — all have string `explain` fields today; upgrade targets for UX-01.
- `extension/content/spell-rules/nb-propernoun-guard.js:147` + `nb-codeswitch.js:96` — both `return []` (suppression rules never reach popover).
- `extension/content/word-prediction.js:499-539` — `runPrediction` + `findSuggestions` + compound-injection path (confirms 5-cap site).
- `extension/content/word-prediction.js:541-567` — `handleKeydown` (confirms ArrowDown path for keyboard-reveal).
- `extension/content/word-prediction.js:1141-1192` — `showDropdown` (single point of UX-02 dropdown render).
- `extension/popup/popup.html:218-224` — existing `setting-prediction` HTML pattern for the new toggle row.
- `extension/popup/popup.js:1726-1838` — `initSettings` (single point to add the new toggle handler).
- `extension/content/vocab-seam.js:225-270` — confirms `getLanguage()` returns session language (no per-document detection).
- `extension/styles/content.css:797-878` — existing popover CSS classes (new classes layer onto these without breaking selectors).
- `extension/i18n/strings.js:209-210,407-408,603-604` — confirms `pred_typo_hint` / `pred_compound_hint` i18n keys exist; new `pred_vis_flere`, `settings_spellcheck_alternates_*` keys follow the same pattern.
- `scripts/check-fixtures.js:190-250` — fixture matcher + adapter-contract guards (pattern to follow for UX-01 contract gate).
- `.planning/PROJECT.md:8,59` — dyslexia positioning + "Perfekt for elever med dysleksi" landing-page section.

### Secondary (MEDIUM confidence)

- Dyslexia-UX copy guidelines (internal claim in CONTEXT.md — "one short sentence, ≤15 words, non-blaming, second-person"). Validated against the British Dyslexia Association Style Guide summary (public guideline, matches CONTEXT.md's constraints). No external citation is in scope — CONTEXT.md is the authoritative source.

### Tertiary (LOW confidence)

- None — this phase is entirely project-internal.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; every "don't hand-roll" item maps to an existing helper or chrome API.
- Architecture: HIGH — all integration points verified against source at named line numbers.
- Pitfalls: HIGH — Pitfall 1 (shared `rule_id: 'typo'`), Pitfall 4 (register-pick source), Pitfall 7 (top-K surface) are real gotchas surfaced by reading the actual code, not hypothetical.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — project is stable, no framework churn expected; revisit only if spell-check-core.js or the rule-plugin contract changes)
