<!--
This is a TEMPLATE. Copy to `.planning/uat/<walkthrough_id>.md` and fill placeholders before walking.
The `verification_kind: human-browser-walk` field triggers /gsd:auto hard-pause per CLAUDE.md GSD references —
agents running auto-mode MUST stop and surface the walkthrough requirement instead of advancing.
-->

---
walkthrough_id: UAT-EXT-XX               # matches REQUIREMENTS.md ID
phase: 38-extension-uat-batch
verification_kind: human-browser-walk    # HYG-03 hook trigger — auto-mode pauses on this value
ext_version: <fill from manifest.json>   # guards stale-zip walks
idb_revision: <fill from chrome.storage> # guards stale-data walks
preset_profile: default                  # default | basic | full — guards Phase 05.1 feature-gating regression class
browser_version: <fill>                  # e.g. "Chrome 138.0.6962.42"
reload_ts: <ISO-8601>                    # chrome://extensions reload timestamp
target_browsers: [chrome, edge, brave]   # list
walker: <name>
date: <ISO-8601>
---

# Walkthrough: <short title>

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

1. **<action>** → expected: `<observable>` → observed: `<what happened>` → ✅/❌
2. **<action>** → expected: `<observable>` → observed: `<what happened>` → ✅/❌
3. **<action>** → expected: `<observable>` → observed: `<what happened>` → ✅/❌

(Add steps as needed. Every step must record both expected AND observed — empty observed is a walk-not-completed signal.)

## Defects observed

Use one bullet per defect; file a finding for every ❌:

- F<phase>-<seq>: <one-line summary> → see `.planning/uat/findings/F<phase>-<seq>.md`

## Outcome

- [ ] All steps pass (no ❌ above)
- [ ] Findings filed: `<comma-separated f_id list, or "none">`
- [ ] Walker signs off: `<name + ISO-8601>`
