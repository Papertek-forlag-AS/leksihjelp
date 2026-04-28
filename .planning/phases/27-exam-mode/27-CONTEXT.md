# Phase 27: Exam Mode - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Make Leksihjelp installable on Norwegian school exam machines. Add per-feature `exam` markers, a student/teacher exam-mode toggle, suppression of non-exam-safe surfaces, lockdown teacher-lock, and a `check-exam-marker` CI gate. Cross-app: lockdown sibling project consumes markers via existing sync pipeline.

Out of scope: any new Leksihjelp feature (this phase only adds the gating infrastructure around existing features). Audit-trail telemetry is out of scope (would violate `check-network-silence`).

</domain>

<decisions>
## Implementation Decisions

### Marker shape
- Rich object: `exam: { safe: boolean, reason: string, category?: string }` at every feature definition site.
- `reason` is required and human-readable — used by the suppression UI for teacher/audit explanations.
- `category` is optional; enables grouping in suppression UI (e.g. "Disabled in exam mode: 9 grammar-lookup rules, 4 dictionary surfaces, TTS, predictions"). Categories suggested: `spellcheck`, `grammar-lookup`, `dictionary`, `tts`, `prediction`, `pedagogy`.

### Partial safety (per-surface markers)
- Single rule may surface multiple things (the dot/correction AND a `rule.explain` popover for Lær mer).
- Each surface declares its own `exam` marker independently.
- A rule can have `exam.safe = true` (the dot/correction) while `rule.explain.exam.safe = false` (the pedagogy popover). Matches reality: spellcheck dot is exam-grade, pedagogy is not.

### Default classifications (locked)
- **Exam-safe:** spellcheck dots/squiggles (typo, fuzzy typo, capitalisation, triple-letter, dialect-mix, quotation-suppression, register, basic agreement-shaped corrections that are at-or-below browser native parity).
- **NOT exam-safe:** Lær mer pedagogy popovers, dictionary popup, conjugation tables, TTS, word prediction, Fest/side-panel, grammar-features popover descriptions.

### Default classifications (TBD pending browser-baseline research)
- **Lookup-shaped grammar rules:** `nb-v2`, `nb-modal-verb`, `de-modal-verb`, `es-fr-modal-verb`, `de-verb-final`, `de-prep-case`, `fr-bags`, `fr-adj-gender`, `fr-pp-agreement`, `es-fr-gender`, `universal-agreement`, `nb-gender`, `nb-compound-gender`, `nb-demonstrative-gender`, `de-gender`, `de-compound-gender`.
- Default tentatively: `exam.safe = false` (conservative).
- Researcher must investigate what Chrome and Edge native spellcheck currently catch in NB/DE/ES/FR. Any rule that operates at-or-below browser parity may be promoted to `safe = true`.
- Architecture supports easy future flips: each rule's marker is one line; reclassification has no ripple effects.

### Suppression behaviour
- Non-exam-safe surfaces are **hidden entirely** when exam mode is on. No tooltip, no greyed-out placeholder, no toast. Acts as if the feature does not exist.
- This applies in both standalone and lockdown contexts.

### Toggle UX (standalone)
- Exam-mode toggle lives in the **popup only** (settings section). The floating widget reads the flag but does not expose the toggle.
- Persists across sessions via `chrome.storage.local` (matches grammar-feature toggles).

### Visual signal (exam mode ON)
- **Popup:** persistent "EKSAMENMODUS" badge near the logo.
- **Floating widget:** colored border tint (amber). Visible without opening menus.
- Both visible at-a-glance for teacher walkthrough.

### Lockdown teacher lock
- **Channel:** lockdown's `leksihjelp-loader.js` shim writes `examModeLocked: true` into `chrome.storage.local` on init. Leksihjelp reads it like any other setting. No new transport.
- **Tamper resistance:** reasonable obstacle. Storage key checked on every feature gate. Lockdown already restricts DevTools, so no HMAC/signed-token needed.
- **Toggle visibility when locked:** toggle is shown in ON position, **disabled/greyed**, with caption "Slått på av lærer". Student sees state and reason — reduces confusion.
- **Version skew:** lockdown's `package.json` pins `leksihjelp` to a minimum version. Sync fails fast at install if downstream is too old. Documented in cross-app sync notes.

### Gate (`check-exam-marker`)
- **Scope:** every `extension/content/spell-rules/*.js` file PLUS an explicit registry of UI surfaces (`extension/exam-registry.js`) covering popup features, floating-widget actions, word-prediction, TTS, pedagogy panel, side-panel.
- **Default rule:** **hard fail** if a feature has no `exam` marker. Mirrors `check-explain-contract` pattern. Silent permissive defaults are unacceptable for an exam-compliance feature.
- **Self-test pair:** `check-exam-marker.test.js` plants a rule with missing/malformed marker (gate must fire) and one with a valid marker (gate must pass). Mirrors `check-explain-contract:test` pattern.
- **Runtime canary:** none. Gate is the source of truth. No console warns, no telemetry. Stays clean for production and aligns with `check-network-silence`.

### Claude's Discretion
- Exact shape of `extension/exam-registry.js` (one function per surface vs. an array of `{ id, exam }` entries — planner decides).
- Exact CSS for the amber border tint and popup badge (consistent with existing UI tokens).
- Where in `popup.js` settings the toggle UI sits (logical grouping with other toggles).
- Specific i18n keys for "EKSAMENMODUS" / "Slått på av lærer" / suppressed-feature text.
- Internal helper function name (`isExamSafe(feature, examMode)` or similar).

</decisions>

<specifics>
## Specific Ideas

- Visual cue should match lockdown's existing visual language for "controlled-by-teacher" states (border/badge consistency).
- The CI gate should mirror the proven self-test pattern from `check-explain-contract:test` and `check-rule-css-wiring:test` — belt-and-braces against the gate going silently permissive via regex/shape drift.
- Cross-app fact: `extension/styles/content.css` and `extension/content/*.js` ship to lockdown via `scripts/sync-leksihjelp.js`. All exam-mode CSS/JS lives in `extension/` here and is sync'd downstream — design accordingly.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `chrome.storage.local` settings infrastructure in `popup/popup.js` — used today for grammar-feature toggles and quota tracking. Add `examMode` and `examModeLocked` keys here.
- 9 existing release gates in `scripts/check-*.js` — `check-explain-contract` is the closest pattern match (validates a contract on every rule, paired self-test). Copy structure for `check-exam-marker`.
- `extension/content/spell-rules/*.js` (60+ files) — established rule shape with `id`, `test`, `explain`. Adding `exam` field is additive, no signature change.
- Lockdown shim `lockdown/public/js/leksihjelp-loader.js` already proxies `chrome.storage.local.get/set` — `examModeLocked` flows through existing channel with no new infrastructure.
- `package-extension.js` minifies on the way into the zip — no concerns about marker objects bloating bundle size.

### Established Patterns
- **Release gate convention:** `scripts/check-X.js` + `scripts/check-X.test.js` self-test, both in `package.json` scripts, both blocking. Documented in `CLAUDE.md` Release Workflow.
- **Per-rule contracts:** `check-explain-contract` validates that every popover-surfacing rule defines `rule.explain` with `{nb, nn}` — same enforcement pattern fits `exam`.
- **Feature gating in UI:** `isFeatureEnabled(featureId)` pattern from grammar features — `isExamSafe(feature)` should mirror it.
- **Cross-app sync:** any change to `extension/content/`, `extension/styles/content.css`, or `extension/data/` ships to lockdown on `npm install`. Bumping `package.json` version signals lockdown to re-pin.

### Integration Points
- `extension/popup/popup.js` — toggle UI + persistence read/write.
- `extension/popup/popup.html` — settings section markup + EKSAMENMODUS badge.
- `extension/styles/popup.css` and `extension/styles/content.css` — badge styling + widget border tint (content.css ships to lockdown).
- `extension/content/spell-check-core.js` and `spell-check.js` — runtime gate point: filter rules by `exam.safe` when exam mode is on.
- `extension/content/floating-widget.js` — gate the dictionary/conjugation/TTS surfaces; apply border tint when exam mode is on.
- `extension/content/word-prediction.js` — disable entirely when exam mode is on.
- `extension/exam-registry.js` (new file) — single source of truth for non-rule UI surface markers.
- `scripts/check-exam-marker.js` + `scripts/check-exam-marker.test.js` (new files) — release gate.
- `package.json` — register new npm scripts; bump version after phase ships.
- `CLAUDE.md` Release Workflow section — add step for `check-exam-marker`.
- Lockdown sibling: `lockdown/public/js/leksihjelp-loader.js` (shim writes `examModeLocked`); lockdown's teacher-config UI (out-of-tree, but documented in cross-app notes).

</code_context>

<deferred>
## Deferred Ideas

- **Auto-detect exam pages** (e.g., suggest exam mode when URL matches `udir.no/eksamen`) — convenience layer, future phase.
- **Auto-off after N hours of inactivity** — adds complexity for marginal benefit; revisit if students report leaving exam mode on accidentally.
- **Per-feature "always show dot, never show suggestion" hybrid mode** for lookup-shaped grammar rules — interesting middle path. Punted because the simpler binary safe/non-safe model is cheaper to ship and reclassifying a rule to safe later is one-line.
- **Telemetry / audit log** of feature suppression — would violate `check-network-silence`. Not pursuing.
- **Signed-token lockdown lock** — reserved for if/when lockdown's environment hardening proves insufficient.

</deferred>

---

*Phase: 27-exam-mode*
*Context gathered: 2026-04-28*
