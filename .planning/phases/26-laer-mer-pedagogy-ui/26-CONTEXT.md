# Phase 26: "Lær mer" Pedagogy UI - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning
**Source:** Conversation with user 2026-04-28

<domain>
## Phase Boundary

The DE preposition pedagogy data exists today in `papertek-vocabulary` (commits 664f2970, 937ef4a2, 7bdf6775) — 34 entries with trilingual (nb/nn/en) `case`, `summary`, `explanation`, `examples`, `wechsel_pair`, `colloquial_note`. No consumer reads it.

This phase makes that data visible to students through the Leksihjelp spell-check popover. When the existing `de-prep-case` rule fires on a token whose lexicon entry has a `pedagogy` block, the popover shows a "Lær mer" button. Clicking it expands a teaching panel inside the popover.

**Strictly limited to:**
- DE prepositions (the only rule with pedagogy data today)
- The existing in-page spell-check popover surface
- nb / nn / en UI language adaptation

**Explicitly excluded from this phase:**
- SVG illustrations (deferred per `project_pedagogy_followups.md`)
- Other rules' pedagogy (å/og, NB gender) — schema generalizes but won't be wired
- Audio playback inside the popover
- The 12-deferred-browser-test backlog
- Any change to the popup-side dictionary view
- Translating data into more languages (the lexicon already has nb/nn/en; that's enough for v3.1)

</domain>

<decisions>
## Implementation Decisions

### Data pipeline (LOCKED — option a, bundle-in)

`scripts/sync-vocab.js` already copies `vocabulary/lexicon/{lang}/generalbank.json` from the Papertek API into `extension/data/{lang}.json`. Extend it (or trust that it already passes through unknown fields — verify) so the `pedagogy` block lands in `extension/data/de.json`.

**Why bundled, not lazy-fetched:**
- Leksihjelp's "free + offline forever" promise is enforced by the SC-06 network-silence gate (`npm run check-network-silence`).
- The 34 enriched entries add ~30-50 KB to `de.json` — under the 20 MiB packaged-zip cap and far under the SC-06 concern threshold.
- Lazy-fetch would add latency on every popover open, fragility on bad networks, and an exception to SC-06.

**What this implies for plans:**
- A plan must verify `sync-vocab.js` does not silently drop the `pedagogy` field (or strip it). If it does, fix the script.
- The bundle-size gate (`npm run check-bundle-size`) must continue to pass — measure before and after.

### `explain()` contract extension (LOCKED — additive, not breaking)

Today: rule's `explain(finding)` returns `{ nb, nn }` (and now `en` for some — see existing `de-capitalization.js`).

Tomorrow:
```js
explain(finding) -> {
  nb: string,                    // required, unchanged
  nn: string,                    // required, unchanged
  en?: string,                   // optional, additive
  pedagogy?: {                   // optional, additive
    case: 'akkusativ'|'dativ'|'wechsel'|'genitiv',
    summary: { nb, nn, en },
    explanation: { nb, nn, en },
    examples?: [...],
    wechsel_pair?: { motion, location },
    colloquial_note?: { nb, nn, en },
  }
}
```

**Why additive:** the existing `check-explain-contract` gate must continue to pass without changes to the 59 popover-surfacing rules that don't yet have pedagogy. New gate `check-pedagogy-shape` enforces the inner shape only when `pedagogy` is present.

### Popover redesign (LOCKED — expand-in-place)

The expanded panel renders **below** the existing suggestion, inside the same popover element. No modal, no page-level overlay. Keeps draggable behavior intact.

**Layout (top-to-bottom inside the popover):**
1. Existing finding header (rule colour dot, message, suggestion)
2. Existing accept-fix button + dismiss
3. New "Lær mer" button (only if `finding.pedagogy` is present) — visually subordinate (smaller, secondary style)
4. Expanded teaching panel (hidden by default; toggled by Lær mer):
   - Case badge (e.g. `AKKUSATIV` styled like a tag — colour-coded per case)
   - Paragraph: `pedagogy.summary[lang]`
   - Paragraph: `pedagogy.explanation[lang]`
   - For each `examples[]`: `correct ✓` row + `incorrect ✗` row + translation + note (note italic, smaller)
   - For Wechselpräpositionen: two-column (or stacked) `motion` (Akk) and `location` (Dat) blocks, each with sentence + translation + note + a small case-badge in the corner
   - Bottom: `colloquial_note[lang]` rendered as a friendly aside with a distinct visual treatment (italic, light background, no warning-icon)
5. Close panel button (X or "Lukk Lær mer") — collapses but keeps popover open
6. Esc key collapses the panel; advancing to next marker (Tab) auto-collapses

**Visual style rules:**
- Case badges colour-coded: Akk = orange-ish, Dat = blue-ish, Wechsel = purple-ish, Gen = teal — use existing Papertek palette (#11B49A green, dark blue, etc.) where possible.
- `correct` rows get a green checkmark; `incorrect` rows get a red ✗ — must be visible to colour-blind users (icon + colour).
- Wechsel motion vs location: small directional icon (arrow for motion, dot for location) reinforces the contrast.
- Colloquial note: warm grey background, italic, prefix with a small "💬" or similar — Papertek-friendly, not alarming.

### Locale wiring (LOCKED — chrome.storage.local with nb fallback)

The popup already has a UI-language selector. Read `chrome.storage.local.uiLanguage` (key may also be `language` — confirm during planning). All popover text — both the existing rule message and the new Lær mer panel — must respect this setting.

Existing `i18n/strings.js` is the home for new strings. Add nb/nn/en keys for: `laer_mer_button`, `laer_mer_close`, `case_label_akkusativ` / `_dativ` / `_wechsel` / `_genitiv`, `wechsel_motion_label` ("Bevegelse" / "Rørsle" / "Motion"), `wechsel_location_label` ("Plassering" / "Plassering" / "Placement"), `correct_label` ("Korrekt" / "Korrekt" / "Correct"), `incorrect_label` ("Feil" / "Feil" / "Incorrect"), `colloquial_aside_prefix` (a leading word or just an empty string).

### Hook into `de-prep-case` rule (LOCKED — minimal change)

The rule currently looks up case info from `vocab.something` and produces a finding. Extend it so:
1. When the flagged token is a known prep (e.g. `durch`, `an`, `am`, `ins`, `wegen`), it looks up the pedagogy block from `vocab.pedagogy[token]` (or however the bundled data is exposed by `vocab-seam-core.buildIndexes`).
2. The pedagogy block, if found, is attached to the finding object so `spell-check.js` can render the panel.
3. The existing `explain(finding)` continues to return `{nb, nn, en}` as it does today; the rule additionally returns `pedagogy` in the finding payload (or via a new `pedagogyFor(finding)` method on the rule — TBD by the planner).

### Out-of-scope items also explicitly deferred

- ⛔ Do NOT add SVG illustrations in this phase
- ⛔ Do NOT generalize to other rules (å/og, NB gender, DE Recht-haben idiom, etc.) — even if it looks tempting
- ⛔ Do NOT add audio playback inside the popover
- ⛔ Do NOT redesign the popover layout in any way other than the additive Lær mer panel
- ⛔ Do NOT touch the side-panel "Fest" surface; this is in-page only

### Claude's Discretion

- Exact CSS-class names for the new elements
- Whether the case badge sits left or right of the summary
- Whether motion/location are side-by-side or stacked at default width (responsive: probably stacked at narrow, side-by-side at wider — orchestrator can pick)
- Whether to wire a CSS gate for the new badge classes (recommended; mirrors `check-rule-css-wiring`)
- Whether the new gate is `check-pedagogy-shape` or a different name
- Test fixtures for pedagogy expansion: which 2-3 prepositions to assert on (suggest one each from Akk, Dat, Wechsel; leave Gen for a follow-up if scope tight)

</decisions>

<specifics>
## Specific Ideas

- The four colloquial-note flavours all use the same template framing — should render with one CSS rule. Examples:
  - "-s contraction" (durchs, fürs, ums, aufs, übers, unters, vors, hinters): "want to sound like a young German speaker?"
  - "spoken-dative-after-genitive-prep" (wegen, statt, trotz, während): "in spoken German, dative is common; in formal writing, use genitive"

- The pedagogy block on contractions (`am_prep`, `ans_prep`, `beim_prep`, `im_prep`, `vom_prep`, `zum_prep`, `zur_prep`, `ins_prep`) has a `contraction: { from, article }` field — the panel can show this as a small "= an + dem" annotation under the summary.

- For Wechselpräpositionen, the `wechsel_pair` is the most teaching-rich element. Render it with **clear visual contrast** (different background tints for the motion vs location columns) so the wo/wohin distinction lands visually.

- The token-to-lexicon-entry mapping is straightforward: lowercase the token, append `_prep`, look up. Handle the `ä` / `ö` / `ü` normalization (lexicon uses `ueber_prep` for `über`, `fuer_prep` for `für`, `waehrend_prep` for `während`). The existing vocab-seam-core may already do this for verbs/nouns — re-use the pattern.

</specifics>

<deferred>
## Deferred Ideas

- SVG illustrations (motion-arrow vs static-box for Wechselpräpositionen) — own phase
- å/og, NB gender, and other rule pedagogy enrichment in papertek-vocabulary, and corresponding wiring in their respective rules — own phases (each rule gets its own PR)
- Audio playback inside Lær mer panel — own phase, depends on a TTS-from-popover decision
- Full Genitive prep coverage including audio files — papertek-vocabulary side
- Pedagogy-aware fixture suite (`tests/fixtures/de-prep-pedagogy.jsonl`) — useful but not blocking; can be added during planning if planner sees value

</deferred>

---

*Phase: 26-laer-mer-pedagogy-ui*
*Context gathered: 2026-04-28 via direct conversation*
