# Phase 5: Student Experience Polish — Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace bare class labels (e.g. "Skrivefeil", "Kjønn") in the NB/NN spell-check popover with student-friendly "why flagged?" explanation copy, and cap visible suggestions at top-3 with a "vis flere" reveal in both the spell-check popover and the word-prediction dropdown — reducing cognitive load for dyslexic learners.

Scope is copy + UI affordances only. Phase 5 does not add new error classes, does not re-rank suggestions (Phase 3 owns that), does not touch false-positive rules (Phase 4 owns that), and does not introduce premium gating. Spell-check stays free, offline, extension-side.

</domain>

<decisions>
## Implementation Decisions

### Top-3 + "vis flere" mechanics

- **Spell-check popover multi-suggestion is user-togglable.** Default is OFF (single suggestion, matches today's single-`fix` behavior). When ON, popover shows top-3 clickable suggestions with "Vis flere ⌄" for the rest.
- **Toggle home:** extension popup → Settings tab, alongside the existing grammar-feature toggles in `popup.js`. Persisted in `chrome.storage.local`.
- **Word-prediction dropdown drops from 5 to top-3 default**, with the same "Vis flere ⌄" text link. This is NOT user-togglable — SC-2 applies directly to word-prediction.
- **"Vis flere" visual:** small underlined text link with chevron ("Vis flere ⌄") at the bottom of the list. Same pattern in both surfaces.
- **Reveal behavior:** expand in place; link flips to "Vis færre ⌃" to collapse again.
- **Max reveal cap:** 8 total items (3 default + up to 5 more after reveal).
- **Keyboard:** ArrowDown past item #3 auto-reveals the rest — zero extra keystrokes for keyboard users.
- **Top-1 dominance:** when multi-suggest is ON, always render up to 3 if available. No smart collapse based on confidence gap.

### Explanation copy voice & shape

- **Voice:** calm, supportive, second-person "du". Non-blaming, dyslexia-aware.
- **Length:** one short sentence, ≤15 words.
- **Personalization:** copy templates the student's actual word into the string (not a static rule-level sentence). Example pattern: `*berde* er en vanlig skrivefeil — prøv *bedre*.`
- **Hedging — split by rule precision:**
  - Assertive for high-precision rules: `nb-typo-curated.js`, `nb-modal-verb.js`
  - Hedged ("kan være", "kanskje") for lower-precision rules: `nb-typo-fuzzy.js`, `nb-gender.js`, `nb-sarskriving.js`
- **Fallback:** each rule supplies a static NB + NN fallback string used when templating can't produce clean copy (e.g. multi-word særskriving findings). Fallback is never the bare class label.
- **Emphasis:** the student's word is rendered with `<em>` and a soft Leksihjelp accent color. Not bold.

### Concrete copy shapes (authored during planning; these are the chosen patterns)

- **Typo (curated):** `*berde* er en vanlig skrivefeil — prøv *bedre*.`
- **Gender:** `*en bok* kan være feil kjønn — på bokmål er det *ei/en bok*.`
- **Modal-verb:** assertive, names infinitive rule + shows correct form.
- **Særskriving:** hedged, names "to ord som hører sammen" + shows combined form.
- **Typo (fuzzy):** hedged, notes word isn't in dictionary + offers nearest fit(s).
- **Proper-noun-guard, codeswitch:** these are *suppression* rules (priority 1 / 5), not surfaced to the popover — no student-facing copy needed.

### NN register & copy-review artifact

- **Authored in rule files, not central i18n:** each rule exports `explain: { nb, nn }` (template functions or static strings). Colocated with the rule logic so reviewers see copy and rule together.
- **Runtime register pick:** follow the document's detected language (same signal the rule registry already uses to decide when to fire). NOT tied to the UI-language setting.
- **Reviewer:** dyslexia-persona proxy self-review for v1.0. No external reviewer scheduled.
- **Review doc location:** `.planning/phases/05-student-experience-polish/COPY-REVIEW.md` — markdown table with columns `rule id | NB copy | NN copy | reviewer notes`. Committed with the phase, referenced in Release notes.

### Popover layout with explanation

- **Default (single-fix) layout, top-to-bottom:** `original → fix`, then explanation, then `[✓ Fiks] [✕ Avvis]`. Whitespace-only separator between explanation and buttons (no hairline divider).
- **Multi-suggest ON layout:** explanation above a list of top-3 clickable suggestion rows (each row applies its fix on click); only `[✕ Avvis]` remains as a standalone button. "Vis flere ⌄" sits at the bottom of the suggestion list.
- **No truncation.** The ≤15-word copy rule keeps popover height bounded by design. No `line-clamp`, no scrollable region.

### Claude's Discretion

- Exact CSS styling (padding, font size, colors) for new popover/dropdown elements — style-fit to existing `content.css`.
- Exact accent color for the italic word emphasis — match Leksihjelp brand palette already used elsewhere in the widget.
- Whether the "show alternates" toggle in popup Settings needs a short help-text caption (copywriter decision during implementation).
- Implementation detail of whether `explain` values are always functions (with the word argument) or allow static strings for rules that don't need templating — as long as rules uniformly expose a callable entry point, the renderer works.
- Where to stage the fixture updates so the copy-changes don't break existing check-fixtures runs.

</decisions>

<specifics>
## Specific Ideas

- Copy-review document should be "one screen" — scannable top-to-bottom without scrolling. Table format (8 rows: 4 rules × 2 registers) plus a short tone-check checklist is the target shape.
- Multi-suggestion toggle defaulting OFF is deliberate: preserves today's low-noise popover behavior, lets confident users opt into alternates without surprising first-time users.
- Keyboard reveal-on-ArrowDown is the higher-signal interaction for power users; the "Vis flere" link still exists for mouse/tap users and discoverability.
- Tone split by rule precision is a deliberate acknowledgement of Phase 3 and Phase 4's FP-reduction work: curated typo + modal-verb are precise enough to sound confident; fuzzy-typo, gender, and særskriving still carry FP risk and their copy should reflect that humility.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`extension/content/spell-rules/nb-*.js`** — Every active rule already defines an `explain` string. Phase 5 replaces these with NB+NN variants (static or templated). Spread across 7 rule files (`nb-codeswitch`, `nb-gender`, `nb-modal-verb`, `nb-propernoun-guard`, `nb-sarskriving`, `nb-typo-curated`, `nb-typo-fuzzy`) — but only 4 classes need student-facing copy (gender, modal-verb, særskriving, typo). Codeswitch + proper-noun-guard are suppression rules, not popover-surfaced.
- **`extension/content/spell-check.js:352-375`** — `showPopover(idx, finding)` builds the popover innerHTML. Single point of layout change. Currently renders `finding.fix` singular; needs to learn `finding.suggestions[]` when the toggle is on.
- **`extension/content/spell-check.js:377-385`** — `typeLabel(t)` is the function returning the bare class labels ("Skrivefeil", "Kjønn", etc.) that UX-01 replaces. The label function stays (may be used as a last-ditch fallback); popover stops calling it as the primary source of text.
- **`extension/content/word-prediction.js:528, 1142`** — `suggestions.splice(5)` caps at 5 today; `showDropdown` renders the list. The cap drops to 3, and showDropdown gains the "Vis flere" affordance.
- **`extension/content/word-prediction.js:509`** — `findSuggestions(currentWord, 5, ...)` requests 5 candidates from the engine. Engine already returns ranked order post-Phase 3; we request more (e.g. 8) and slice to 3-or-8 based on expanded state.
- **`extension/popup/popup.js`** — Grammar-feature toggle UI lives here; the new "show alternates" setting reuses the same pattern (`chrome.storage.local` key, checkbox row in Settings tab).
- **`extension/styles/content.css`** — Popover + marker CSS classes (`lh-spell-popover`, `lh-spell-head`, `lh-spell-note`, etc.) already exist. New: `lh-spell-explain`, `lh-spell-suggestions`, `lh-spell-vis-flere`, `lh-pred-vis-flere`. Italic emphasis class for the templated word (e.g. `lh-spell-emph`).
- **`extension/content/vocab-seam.js`** / **`vocab-seam-core.js`** — Already expose document language detection; register-pick reads from this same signal.
- **`scripts/check-fixtures.js`** — Regression harness from Phase 1. Copy changes shouldn't affect match/no-match decisions, but if any fixture assertions grep the popover text (unlikely but worth scouting), they need updating.

### Established Patterns

- **Rule-plugin registry (Phase 3):** rules live in `extension/content/spell-rules/` and push `{ id, languages, priority, check, explain }` onto a registry. Phase 5's shape change (`explain: { nb, nn }` with optional templating) is a natural extension — no registry refactor needed.
- **Suppression rules (Phase 4):** `ctx.suppressed` filters findings before surfacing. Codeswitch and proper-noun-guard stay invisible to the popover path — confirms we don't need student-facing copy for them.
- **`chrome.storage.local` for user preferences:** `enabledGrammarFeatures` (grammar toggles) establishes the pattern. New key name candidate: `spellCheckAlternatesVisible` (default `false`).
- **Keyboard handling in word-prediction:** existing `keydown` listener on input elements already handles ArrowDown / Enter for candidates — extend, don't rewrite.
- **NB vs NN register signal:** rule adapter already flags language per finding; renderer can read the same field.

### Integration Points

- **Popover render:** `spell-check.js:showPopover()` — single point for UX-01 + UX-02 layout work.
- **Dropdown render:** `word-prediction.js:showDropdown()` — single point for UX-02 word-prediction work.
- **Settings surface:** `popup/popup.html` + `popup/popup.js` Settings tab — single point for the alternates toggle.
- **Rule authoring:** `extension/content/spell-rules/nb-{gender,modal-verb,sarskriving,typo-curated,typo-fuzzy}.js` — each rule file gets its `explain` shape upgraded.
- **Release-notes flow:** `COPY-REVIEW.md` → excerpted into GitHub Release body when version ships.

</code_context>

<deferred>
## Deferred Ideas

- **Real dyslexic student reviewer.** Dropped from v1.0 — self-review against PROJECT.md persona ships Phase 5. Follow-up milestone idea: after v1.0, run real-user reviews against the shipped copy and iterate.
- **Native NN speaker copy review.** Dropped from v1.0 — self-review handles both registers. If NN register feels off in shipped product, future milestone can add an NN native pass.
- **"Why flagged" rich content (examples, mini rule cards).** Out of scope — Phase 5 copy is one-sentence-only.
- **Smart top-1 collapse when confidence gap is huge.** Explicitly declined in favor of the simpler "always render up to 3" rule. Future ranking milestone could revisit.
- **Inline gear-icon in popover.** Declined in favor of popup-Settings toggle. Could be revisited if users ask for faster access.
- **Telemetry / instrumentation** (e.g. "how often do users expand vis flere?"). Not part of UX-01/02. Telemetry is a separate cross-cutting concern; staying free+offline means we don't ship any.
- **Manual "Run spell-check" button (carried from memory).** Mentioned in user memory as a Phase 5 idea but out of scope for Phase 5 as currently defined — would be a new capability, not copy/UI polish. Tracking it for a later phase.

</deferred>

---

*Phase: 05-student-experience-polish*
*Context gathered: 2026-04-20*
