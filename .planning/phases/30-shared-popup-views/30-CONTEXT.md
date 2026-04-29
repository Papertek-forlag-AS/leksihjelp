# Phase 30: Shared Popup View Modules — Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Source:** Conversational discussion during Phase 29 UAT

<domain>
## Phase Boundary

Phase 30 delivers a single source of truth for the leksihjelp popup's user-facing views (dictionary, settings, pause, report) so that the lockdown sidepanel — currently a stub `<input>+<div>` — renders the same rich UI as the extension popup, minus auth/payment/audio. The extension popup remains the canonical source; lockdown becomes a thin host that mounts the shared view modules with limited deps.

**In scope:**
- Refactor `extension/popup/popup.js` (currently monolithic) into mountable view modules with explicit dependency injection.
- Extract dictionary search + result rendering, settings (language picker, grammar features, dark mode), pause/paused state, and bug-report form into separate modules.
- Sync those modules into `lockdown/public/leksihjelp/popup/views/` via the existing sync script.
- Build a lockdown-side sidepanel host that mounts the synced modules with deps appropriate for the lockdown context.
- Replace lockdown's stub leksihjelp panel.
- Roll up Phase 29-03 verification (deferred from Phase 29).

**Out of scope:**
- Vocab audio playback in lockdown (`extension/audio/` is already not synced; just suppress audio buttons in lockdown via deps flag).
- Vipps login + logout in lockdown.
- Subscribe / yearly / top-up payment buttons in lockdown.
- Quota usage bar in lockdown.
- Access-code field in lockdown.
- "Skriv" button (opens skriveokt) in lockdown.
- "Pin" button (open in own window) in lockdown.
- Vocab refresh / update notice in lockdown.
- Spellcheck-engine on/off toggle in popup (stays in editor toolbar dropdown — already done in Phase 29 UX).
- Word-prediction toggle in popup (stays in editor toolbar dropdown).
- Exam-mode toggle in lockdown sidepanel (teacher controls this via profile).
- "Simuler lærer-lås" dev button in lockdown.
- UI-language picker in lockdown (lockdown has its own i18n system).
- Production deploy of Phase 29 + Phase 30 to `lockdown-stb` (deferred per user; will run after Phase 30 staging UAT passes).

</domain>

<decisions>
## Implementation Decisions (locked)

### Architecture

- **Single source of truth = extension repo.** All view logic lives in `extension/popup/views/`. Lockdown imports them via the existing `lockdown/scripts/sync-leksihjelp.js` postinstall pipeline.
- **Pattern: mount functions with dep injection.** Each view exports `mount{Name}View(container, deps)` where `deps` is an object with explicit dependencies (no implicit `chrome.storage`, `chrome.runtime`, `window.__lexiVocab`, or audio playback globals). Extension popup provides full deps; lockdown sidepanel host provides limited deps.
- **Lockdown-side files:** ONLY the sidepanel host file (`leksihjelp-sidepanel-host.js`) is hand-written in lockdown. Everything under `public/leksihjelp/popup/` is synced and never hand-edited downstream.
- **CSS:** popup CSS extracted to a syncable file alongside views; lockdown imports it.
- **No drift safeguard:** CLAUDE.md (this repo) gets a "Downstream consumer" note about the new synced surface. Future popup.js changes that break a view's dep contract will surface as runtime errors in lockdown's sidepanel — accepted cost.

### View modules to extract

1. **dictionary-view** — search input, language switcher, direction toggle (NO→target / target→NO), result rendering with conjugations/declensions/genus/plural, "Lær mer" pedagogy popovers, recent searches.
2. **settings-view** — language picker (which target languages to enable), grammar-feature presets + per-feature toggles, dark mode.
3. **pause-view** — pause/paused state.
4. **report-view** — bug-report form.

Account/auth, payments, exam-toggle, vocab refresh, "Simuler lærer-lås", "Skriv", "Pin" stay in extension's `popup.js` and are mounted only there.

### Audio

`extension/audio/` is already excluded from the sync script (verified 2026-04-29). The dictionary view must:
- Render audio-play buttons only when `deps.audioEnabled === true`.
- Extension passes `audioEnabled: true`.
- Lockdown sidepanel host passes `audioEnabled: false`.
- Result: no MB-level downloads land in lockdown; students rely on the existing TTS system in the lockdown toolbar.

### Behavior preservation in extension popup

The extension popup must behave **identically** after the refactor — every existing feature (auth, payments, dictionary, settings, exam-toggle, etc.) continues to work. This is non-negotiable; popup.js is in production.

### Verification scope (rolls up Phase 29-03)

End-to-end on `staging-lockdown.web.app`:
1. Teacher creates `LEKSIHJELP_EXAM` test → student opens.
2. EKSAMENMODUS badge visible; leksihjelp toggle ON + disabled + "Slått på av lærer" caption.
3. Floating widget shows amber border.
4. Word-prediction dropdown does not open (toolbar already hides toggle for non-FULL profiles).
5. Grammar-lookup dots suppressed; typo dots remain; dictionary lookups remain.
6. **Phase 30 NEW:** Dictionary panel renders conjugations, declensions, language switcher works, direction toggle works, NO audio buttons rendered.
7. Profile transition LEKSIHJELP_EXAM → FULL clears flags; surfaces re-enable; FULL profile shows audio buttons.
8. Phase 28's dev-only "Simuler lærer-lås" button still works (regression).
9. Production deploy + papertek.app verification still deferred — explicitly out of scope this phase.

### Three sidepanel composition decisions (locked 2026-04-29 by user)

- **UI-language picker:** SKIP in lockdown sidepanel. Lockdown has its own i18n system; the leksihjelp settings view's language section is hidden via `showSection.language: false`.
- **EKSAMENMODUS badge:** KEEP in lockdown sidepanel. Reads `chrome.storage.local.examMode` (set by Phase 29-02's `applyExamModeLock`); subscribes to `onChanged` so it flips live with profile changes. Visible reinforcement that the dictionary is exam-restricted.
- **Settings navigation:** INLINE (no two-view dictionary/settings toggle). Implemented as a `<details>` collapsible right below the dictionary in the same scroll column — counts as inline since it's the same view, the `<details>` is just a vertical-space saver for the narrow sidepanel.

### Claude's Discretion

- Specific module file layout under `extension/popup/views/` (subfolders, naming).
- Choice of test framework for view modules (use existing project conventions — Node `--test` if extension already uses it).
- Dep contract shape (object schema) for each view's `deps` parameter.
- Whether to extract popup.css whole or only the view-relevant subset.
- Sidepanel host's mount sequence and view stacking (vertical scroll vs. tabbed) — user has not specified, assume vertical scroll matching current sidepanel narrowness.
- Whether grammar-features customization is shown in lockdown's settings view by default or hidden behind a "vis avanserte" toggle (lean toward visible — students benefit from preset selection).

</decisions>

<specifics>
## Specific References

### Files (extension repo, leksihjelp)
- `extension/popup/popup.html` — current monolithic shell
- `extension/popup/popup.js` — current monolithic logic (~thousands of lines)
- `extension/styles/` — existing styles location (popup CSS may be inline in popup.html or in a separate file; planner to confirm)
- `extension/manifest.json` — version field (bump on release)

### Files (lockdown sibling repo)
- `/Users/geirforbord/Papertek/lockdown/scripts/sync-leksihjelp.js` — sync entry point; currently copies `extension/content/`, `extension/data/`, `extension/styles/`. Phase 30 extends this to copy `extension/popup/views/` and the popup CSS.
- `/Users/geirforbord/Papertek/lockdown/public/js/writing-test/student/writing-environment.js:204-208` — current stub `<input>+<div>` panel to be replaced.
- `/Users/geirforbord/Papertek/lockdown/public/leksihjelp/` — synced output directory (mirrored on each sync run).
- `/Users/geirforbord/Papertek/lockdown/public/js/leksihjelp-loader.js` — existing chrome shim; provides `__lexiVocab` surface that view deps can build on.

### Existing in-flight Phase 29 fixes (already on `staging-lockdown` branch)
- `45df438` lockdown shim getSPassivForms gap fix
- `5144f24` editor-toolbar all-modes DOM build fix
- `a856f43` LEKSIHJELP_EXAM envelope correction (`spellEngineOptions: ['leksihjelp']` + new `wordPrediction` flag)
- Version markers v4.9.1 → v4.9.3 in `writing-environment.js:216`

### Constraints from leksihjelp CLAUDE.md
- Release Workflow steps 1–13 still apply for any extension package release (fixture suite, network-silence gate, exam-marker gate, bundle-size gate, version-bump in three places, GitHub Release upload).
- Downstream consumers: lockdown webapp + skriveokt-zero (deferred). Phase 30's new synced surface affects the webapp; skriveokt-zero remains deferred (Phase 28.1) — but the sync contract should not preclude future zero adoption.
- The existing `extension/exam-registry.js` synced surface is the model for how a new synced file is introduced (CLAUDE.md note + sync script + downstream loader integration).

### Constraints from auto-mode + user instructions in this conversation
- **No production deploys** to `lockdown-stb` (`papertek.app`) — staging only.
- The text-loss bug observed during UAT is suspected to be a window-lock-before-snapshot race; user wants to attempt reproduction separately. Out of scope for Phase 30.
- The user wants to "test 29 when 30 is in place" — Phase 30 verification covers Phase 29 functionality too, in a single rolled-up UAT.

</specifics>

<deferred>
## Deferred Ideas

- Production deploy to `lockdown-stb` — user runs manually after Phase 30 staging UAT passes.
- Phase 28.1 (skriveokt-zero Tauri sync of new popup-views surface) — not in scope until skriveokt-zero ships to consumers; if Phase 30's sync contract is well-formed, future un-defer is mechanical.
- A future cleaner refactor that fully separates popup.js auth/payments from the rest into their own `account-view` module and lets even the extension popup use the same mount pattern. Phase 30 leaves auth/payments in popup.js as-is (changing them risks user-facing payment regressions that need separate care).
- Recent-searches feature in dictionary view if it isn't already in popup.js — if absent, leave as-is rather than add.
- Bug-report form may be redundant in lockdown if lockdown already has its own feedback channel — planner to inspect and decide whether to mount it.

</deferred>

---

*Phase: 30-shared-popup-views*
*Context gathered: 2026-04-29 from conversation during Phase 29 UAT*
