---
phase: 02-data-layer-frequency-bigrams-typo-bank
gathered: 2026-04-19
status: Ready for gap-closure planning
source: /gsd:plan-phase 2 --gaps (product decision captured inline)
---

# Phase 2: Data Layer — Gap-Closure Context

<domain>
## Phase Boundary

This CONTEXT document covers **gap-closure plans** for Phase 2 only — specifically SC-4
(the 10 MiB bundle-size ceiling). SC-1, SC-2, SC-3 are already VERIFIED in
`02-VERIFICATION.md` and out of scope for these new plans.

The gap: packaged extension zip is **10,599,772 bytes (10.11 MiB)**, **114,012 bytes over**
the 10,485,760-byte cap. `check-bundle-size` correctly exits 1; the infrastructure is
working and ships as-is — only the data payload needs to come down.

</domain>

<decisions>
## Implementation Decisions

### Remediation Path (LOCKED — product decision from /gsd:plan-phase 2 --gaps session 2026-04-19)

**Audit and remove `extension/data/en.json`.**

- `extension/data/en.json` is 4.65 MB and is **not** in CLAUDE.md's supported-language list
  (de, es, fr for foreign-language learning; nb/nn for spell-check).
- If the audit confirms the file is unreferenced by the extension runtime (popup, content
  scripts, service worker, word-prediction, spell-check, TTS), **delete it** and re-run
  `npm run package` + `npm run check-bundle-size`.
- Expected result: zip drops from 10.11 MiB to ~5.5 MiB — clears the cap with ~4.5 MiB
  of headroom, leaving room for Phase 3+ additions.
- If the audit finds en.json IS referenced somewhere, STOP and surface the finding — do
  not silently remove a file in active use. A checkpoint / re-plan is the correct move.

### Rejected Paths (for the record)

| Path | Why rejected |
|------|-------------|
| Strip `audio/de/*.mp3`, fetch-on-first-use | Breaks the offline German TTS pledge until first play is cached; adds runtime fetch complexity |
| Trim vocab conjugation branches in papertek-vocabulary | Cross-app blast radius (webapps + nativeapps consume same API); hard to scope |
| Bump `CEILING_BYTES` to 12 MiB + update landing page | Changes a publicly-stated promise and removes the structural forcing function — reserve as last resort |

### Placement

**New plans live inside Phase 2** (--gaps default), numbered **02-05-PLAN.md** onward.
No Phase 2.1 is created. The roadmap Phase 2 status flips from `gaps_found` → `verified`
once SC-4 is satisfied.

### Verification Gate for the New Plans

- Hard test: `npm run check-bundle-size` exits 0 on the packaged zip.
- Soft test: `npm run check-fixtures` still exits 0 at 138/138 (no regression from a
  stray removal).
- Manual smoke test: load the unpacked extension, confirm German / Spanish / French
  dictionary lookup, TTS, and word-prediction still work (en.json being gone shouldn't
  affect them, but the smoke test is cheap insurance).

### Requirements

No new requirement IDs. DATA-01, DATA-02, DATA-03 are already SATISFIED
(per 02-VERIFICATION.md Requirements Coverage table). These plans close **SC-4 (roadmap
success criterion)**, not a new requirement.

### Release Workflow Integration

CLAUDE.md's Release Workflow step 2 (`npm run check-bundle-size` must exit 0) already
gates the release. Once this plan lands and the gate turns green, the next GitHub Release
can cut.

</decisions>

<specifics>
## Specific Ideas

### en.json Audit Scope

Search these surfaces for any reference to `en.json`, English vocabulary, or `'en'` as a
language code:

- `extension/manifest.json` — `web_accessible_resources`, `content_scripts.matches`
- `extension/popup/popup.js` — language picker, fetch paths
- `extension/content/floating-widget.js` — language detection
- `extension/content/word-prediction.js` — prediction dictionaries
- `extension/content/vocab-seam-core.js` — language map
- `extension/background/service-worker.js` — context menus, language handoff
- `scripts/sync-vocab.js` — language sync list
- `scripts/build-frequencies.js`, `scripts/build-bigrams.js` — corpus language switches
- `extension/i18n/*.json` — UI translation files (these are unrelated to vocab en.json; confirm the distinction)
- `extension/data/` — cross-language link references, e.g. translation pairs pointing at English

If `en.json` is referenced only by historical / defunct code paths, document the
dead-code removal alongside the file deletion.

### Cross-App Check

Before deleting, verify that `papertek-vocabulary` still emits `en.json` in its sync
output. If Leksihjelp simply stops bundling it, the sibling consumers (webapps,
nativeapps) are unaffected — they read the vocabulary API directly, not Leksihjelp's
bundled copies. No cross-app coordination needed.

### Re-verification

After SC-4 passes, re-run `/gsd:verify-work 02` (or equivalent) to flip the phase status
to `verified` in VERIFICATION.md and ROADMAP.md. That's the cleanup step, not part of
this plan.

</specifics>

<deferred>
## Deferred Ideas

- **NN phrase-infinitive triage (~214 entries):** still a sibling-repo data cleanup,
  unrelated to bundle size. Tracked in STATE.md Blockers.
- **Missing `fin_adj` entry:** still a sibling-repo data gap, unrelated to bundle size.
  Tracked in STATE.md Blockers.
- **Future data-size headroom policy:** out of scope for this gap-closure. If Phase 3+
  adds ML-flavoured sidecars that threaten the cap again, address it then; don't
  pre-optimize now.

</deferred>

---

*Phase: 02-data-layer-frequency-bigrams-typo-bank*
*Context gathered: 2026-04-19 via /gsd:plan-phase 2 --gaps product-decision session*
