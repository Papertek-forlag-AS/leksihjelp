---
walkthrough_id: UAT-EXT-01
phase: 38-extension-uat-batch
verification_kind: human-browser-walk
ext_version: TBD
idb_revision: TBD
preset_profile: default
browser_version: TBD
reload_ts: TBD
target_browsers: [chrome, edge, brave]
walker: Geir
date: 2026-05-01
---

<!--
Instantiated from .planning/uat/TEMPLATE-walkthrough.md for Phase 38-01 warm-up walkthrough.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.

Sequence position (per STATE v3.2 entry decision): warm-up (this) → canonical (Phase 30-01 / UAT-EXT-04)
→ highest-stakes (Phase 27 / UAT-EXT-03) → final (Phase 26 / UAT-EXT-02).

Frontmatter field guidance:
- ext_version: fill from extension/manifest.json — guards stale-zip walks
- idb_revision: fill from chrome.storage / DevTools IndexedDB — guards stale-data walks
- preset_profile: default | basic | full — guards Phase 05.1 feature-gating regression class
- browser_version: e.g. "Chrome 138.0.6962.42"
- reload_ts: ISO-8601 — chrome://extensions reload timestamp
-->


# Walkthrough: F36-1 fr-aspect-hint browser confirmation (warm-up)

Re-confirms that the v2.9.15+ vocab-seam fix landed correctly in real-browser conditions for the fr-aspect-hint rule (passé-composé vs imparfait soft-hint). First in the locked Phase 38 walk sequence.

## Pre-flight evidence (paste before walking)

Run and record each item before touching the browser. Stale artifacts are the #1 v3.1 walkthrough failure mode (Pitfall 1).

- [ ] `node scripts/check-vocab-deployment.js` exit code: `<0 = ok>` — paste relevant tail output below.
- [ ] `extension/manifest.json` `version` matches frontmatter `ext_version`: `<value>`
- [ ] IDB revision captured from `chrome.storage` (or DevTools → Application → IndexedDB): `<value>` — matches frontmatter `idb_revision`
- [ ] Reload timestamp recorded from chrome://extensions reload click: `<ISO-8601>` — matches frontmatter `reload_ts`
- [ ] Browser + version recorded: `<value>` — matches frontmatter `browser_version`
- [ ] Preset profile in popup matches frontmatter `preset_profile`: `<value>`

```
<paste check-vocab-deployment.js output here>
```

## Steps

Numbered, one observable per step. Shape: `<step> → expected: … → observed: … → ✅/❌`.

1. **Open a page with a French text input. Type a sentence with passé-composé in narrative-imperfect context (e.g. "Pendant que je marchais, j'ai vu un chien.")** → expected: soft-hint dot appears under `j'ai vu` OR `marchais` OR both per fr-aspect-hint rule logic → observed: TBD → ✅/❌
2. **Hover the dot** → expected: tooltip text matches the rule's `explain.nb` message (passé-composé vs imparfait pedagogy phrasing — narrative imparfait vs punctual passé-composé contrast) → observed: TBD → ✅/❌
3. **Click the dot to open the popover** → expected: popover renders with a visible "Lær mer" link → observed: TBD → ✅/❌
4. **Click "Lær mer"** → expected: pedagogy panel expands with examples + illustration if present (the v2.9.15 vocab-seam fix is what made this content render — empty panel = seam regression) → observed: TBD → ✅/❌
5. **Switch to NN locale (popup settings → språk → nynorsk) and reload the page** → expected: popover/Lær mer text renders in NN register (verbs/pronouns shifted to nynorsk forms) → observed: TBD → ✅/❌
6. **Switch back to NB and confirm rule still fires under default preset** (defends Phase 05.1 feature-gating regression class — `check-spellcheck-features` covers the static case, this confirms the live preset-toggle path) → expected: dot still appears on the same trigger sentence → observed: TBD → ✅/❌

(Every step must record both expected AND observed — empty observed is a walk-not-completed signal per HYG-01.)

## Defects observed

Use one bullet per defect; file a finding for every ❌:

- F38-<seq>: <one-line summary> → see `.planning/uat/findings/F38-<seq>.md`

(If no defects: replace this line with `none` in the Outcome section.)

## Outcome

- [ ] All steps pass (no ❌ above)
- [ ] Findings filed: `<comma-separated f_id list, or "none">`
- [ ] Walker signs off: `<name + ISO-8601>`
