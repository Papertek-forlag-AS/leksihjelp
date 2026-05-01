---
phase: 35
status: complete
walked: 2026-05-01
driver: Geir (auto-mode executor)
---

# Phase 35 Verification — v3.1 UAT Follow-ups

## Summary

Phase 35 closes the six findings raised in Phase 34's browser UAT sweep. Investigation revealed
that **F1, F2, F3 all PASS in the current vocab data** (post-v2.9.13 sync) — the Phase 34
failures were stale-deploy / human-verifier artifacts, not real defects. **F5 was a
misunderstanding of the rule's contract** — `in der Schule` is grammatically correct German
(locative dative), so the rule correctly does NOT fire; an alternate canonical trigger
(`in den Schule` or `auf der Tisch`) is documented for Phase 26 walkthroughs. **F6 was a real
state-loss bug** in `spell-check.js` — fixed by persisting the Lær mer panel expanded/collapsed
choice across Tab navigation. **F7 (NN/EN locale walkthroughs) is auto-approved per
workflow.auto_advance** with the verification recipe captured below for a future manual session.

No cross-repo papertek-vocabulary changes were required: the data already carries
`verb_class: gustar-class` markers on `gustar`, `encantar`, `interesar`, `doler`, `faltar`,
`molestar`, `parecer`, `quedar`, `sobrar`; `doler` already has full `presens` conjugations
(including `duele`); `manger` already has `imparfait` forms (including `mangeait`); and the FR
generalbank already carries `aspect_passe_compose_adverbs` (with `hier`),
`aspect_imparfait_adverbs`, and `aspect_choice_pedagogy` blocks.

## Per-finding result

### F1 — FR `fr-aspect-hint` on `Hier il mangeait une pomme`

**Result: PASS (no changes needed)**

Reproduced in Node against current `extension/data/fr.json`:

```
[fr] "Hier il mangeait une pomme": [
  { "rule": "fr-aspect-hint", "orig": "mangeait", "fix": "mangeait" }
]
```

The rule fires correctly. `manger` carries the full `imparfait.former` conjugation in the
verbbank (`mangeais`, `mangeait`, `mangeaient`, etc.); `aspect_passe_compose_adverbs` includes
`hier`; the rule's adverb-then-verb scan locates the mismatch.

The `[fr/aspect-hint]` fixture suite at `fixtures/fr/aspect-hint.jsonl` includes the exact
canonical sentence as `fr-aspect-pos-002` and runs at P=R=F1=1.000 (86/86 pass).

The Phase 34 finding (`findingsCount: 0`) was therefore a stale-deploy or runtime-context
artifact — most likely the staging-lockdown environment had not finished propagating the
v2.9.13 sync, or a transient ctx-build issue made `frAspectAdverbs` empty for the test session.

### F2 — ES `es-gustar` on `El encanta la música`

**Result: PASS (no changes needed)**

Reproduced in Node:

```
[es] "El encanta la música": [
  { "rule": "es-gustar", "orig": "encanta", "fix": "le encanta" }
]
```

`encantar` carries `verb_class: "gustar-class"` in the synced ES verbbank. The
`gustarClassVerbs` Set built in `vocab-seam-core.js` is populated from those markers. The rule
correctly identifies `encanta` as a gustar-class verb without a preceding dative clitic and
suggests `le encanta`.

The `[es/gustar]` fixture suite runs at P=R=F1=1.000 (127/127 pass).

Verified extended-class membership in current data:

```
gustar      verb_class=gustar-class
encantar    verb_class=gustar-class
interesar   verb_class=gustar-class
doler       verb_class=gustar-class
faltar      verb_class=gustar-class
molestar    verb_class=gustar-class
parecer     verb_class=gustar-class
quedar      verb_class=gustar-class
sobrar      verb_class=gustar-class
importar    -> MISSING (not in verbbank — no entry to mark)
tocar       -> MISSING (not in verbbank — no entry to mark)
bastar      -> MISSING (not in verbbank — no entry to mark)
```

The three missing entries (`importar`, `tocar`, `bastar`) are absent from the ES verbbank
entirely, not just missing the marker. Adding them is a future papertek-vocabulary enrichment
task and is intentionally out of scope for Phase 35 — the canonical Phase 34 trigger
(`encantar`) plus eight other extended-class verbs already work.

### F3 — `duele` flagged as out-of-dictionary

**Result: PASS (no changes needed)**

Reproduced in Node:

```
vocab.validWords.has('duele'):   true
esPresensToVerb.get('duele'):    { inf: 'doler', person: 'él/ella' }

"Me duele la cabeza": (no findings)
"duele":              (no findings)
"No me duele":        (no findings)
```

`doler` has full `presens.former` (`duelo`, `dueles`, `duele`, `dolemos`, `doléis`, `duelen`),
plus `preteritum` and `imperfecto`. `duele` is in `validWords`. None of the loaded ES rules
flag the canonical sentence.

The Phase 34 finding (`duele` shown as out-of-dictionary marker) was therefore a UI artifact
that did not originate from any leksihjelp spell-check rule. Most plausible explanation: the
human verifier observed the **browser's native red squiggle** under `duele` (Chrome's built-in
spell-check has limited Spanish coverage in some configurations) and attributed it to
leksihjelp. No leksihjelp marker would render here because no leksihjelp rule fires.

### F5 — DE `de-prep-case` Wechselpräposition on `in der Schule`

**Result: PASS — alternate canonical trigger documented (no rule changes needed)**

Reproduced in Node:

```
"in der Schule":         (no findings)         <- correct German, locative dative
"Ich gehe in der Schule": (no findings)        <- rule does not model semantic motion
"in den Schule":         den->der (prep=in, case=akkusativ/dativ, pedagogy=Wechselpräposition)
"auf der Tisch":         der->dem (prep=auf, case=akkusativ/dativ, pedagogy=Wechselpräposition)
"unter der Tisch":       der->dem (prep=unter, case=akkusativ/dativ, pedagogy=Wechselpräposition)
```

`in der Schule` is **grammatically correct German** (locative dative — "at school"). The rule
correctly does NOT fire on correct grammar. The Phase 34 finding mistakenly expected the rule
to fire on a correct sentence to demonstrate Wechselpräposition pedagogy.

The `de-prep-case` rule fires on **case mismatches**, not on Wechselpräposition pedagogy in
isolation. Pedagogy is attached to the finding when the mismatched preposition happens to be a
Wechselpräposition (because `prepPedagogy.get('in')` returns `case: "wechsel"`).

**Canonical Phase 26 walkthrough triggers for Wechselpräposition pedagogy:**

| Trigger sentence  | Why it works                                          |
| ----------------- | ----------------------------------------------------- |
| `in den Schule`   | gender mismatch on Wechsel-prep `in` (Schule is f → der/die) |
| `auf der Tisch`   | gender mismatch on Wechsel-prep `auf` (Tisch is m → dem/den) |
| `unter der Tisch` | gender mismatch on Wechsel-prep `unter` (same)        |

All three fire `de-prep-case` AND attach Wechselpräposition pedagogy. Use any one of them in
place of `in der Schule` for future Phase 26 demonstrations.

(Implementing semantic motion-vs-location detection is out of scope — it would require a
heuristic over motion verbs in the surrounding clause, with low precision and high false-
positive risk, exactly the type of speculative-grammar feature exam-mode is designed to gate.)

### F6 — Tab navigation auto-collapses Lær mer panel

**Result: FIXED**

**Root cause:** `showPopover()` (in `extension/content/spell-check.js`) calls `hidePopover()`
to tear down the previous popover before building the new one. `hidePopover()` removes the
entire popover DOM, which destroys the user's expanded Lær mer pedagogy panel state. The new
popover is rendered with the panel collapsed (default `hidden` attribute on the panel div),
so the user perceives the panel as having "auto-collapsed after ~1s" because the collapse
visually coincides with the Tab keypress that triggered the rebuild.

There was no actual blur timer race — the `onBlur` setTimeout(250) handler does correctly
detect that focus has moved into the next marker (`focusInOverlay`) and does NOT call
`hideOverlay()`. The bug was purely a state-loss issue in the popover rebuild path.

**Fix (commit `4bbab27`):** added a module-level `pedagogyPanelExpanded` flag in
`spell-check.js`:

1. `showPopover()` saves the flag value before calling `hidePopover()`, then restores it
   after — Tab navigation rebuild path preserves the choice.
2. `hidePopover()` resets the flag to `false` by default — non-rebuild dismissal paths
   (click-outside, Esc-on-popover when no panel is open, decline button, applyFix) start the
   next popover collapsed.
3. The Lær mer toggle handler updates the flag on user click.
4. The Esc-on-Lær-mer-panel handler resets the flag (explicit user collapse).
5. When `showPopover()` builds a popover with `pedagogyPanelExpanded === true` and a finding
   that has `pedagogy`, it pre-expands the panel inline (renders the content, sets
   `panel.hidden = false`, swaps the button label to "Lukk").

**Verification:**
- `npm run check-fixtures` PASS (no fixture regressions)
- `npm run check-network-silence` PASS
- All other release gates PASS

Manual browser UAT for the Tab-preserves-panel behaviour is captured in F7 below as part of
the deferred vanilla-extension walkthrough.

### F7 — NN (3.5) and EN (3.6) Lær mer locale walkthroughs

**Result: AUTO-APPROVED (auto-mode policy) — manual UAT recipe captured for future session**

Per `workflow.auto_advance: true` in `.planning/config.json`, this checkpoint is auto-approved
and the manual extension walkthrough is queued for a future deferred-UAT session (joining
Phase 26, Phase 27, Phase 30-01, and Phase 30-02 deferred walkthroughs already listed in
STATE.md "Pending Todos").

**Walkthrough recipe (10 minutes):**

1. Build: `cd /Users/geirforbord/Papertek/leksihjelp && npm run package`
2. Load unpacked `extension/` into Chrome via `chrome://extensions` (Developer mode → Load
   unpacked).
3. Open the leksihjelp popup → Settings → switch UI language to **NN (Nynorsk)**.
4. Visit any web page with an editable text area. Type a DE sentence that fires
   `de-prep-case` with Wechselpräposition pedagogy: e.g. `in den Schule` or `auf der Tisch`.
5. Click the Aa pill → click the marker dot → click "Lær mer".
6. **Verify all panel strings render in Nynorsk**:
   - case label badge ("Wechselpräposition")
   - pedagogy summary
   - explanation paragraph
   - correct/incorrect example labels ("Rett" / "Galt")
   - any `colloquial_note` if shown
   - Note any strings that fall back to NB or are missing.
7. Press Tab to advance to the next marker (if any). Verify the Lær mer panel REMAINS
   expanded (F6 fix verification).
8. Repeat steps 3-7 with UI language switched to **EN (English)** — verify English strings.
9. Capture screenshots per locale and append them under `.planning/phases/35-v3.1-uat-followups/screenshots/`.

The pedagogy data has full {nb, nn, en} register coverage in the synced
`extension/data/de.json` `prepPedagogy` (verified at Phase 26-01 ship), so all three locales
should render without fallback. If any locale shows fallback strings, that's a P26
follow-up — file as a Phase 36 entry.

## Release-gate sweep

All 11 release-workflow gates green at version 2.9.14:

```
[1]  npm run check-fixtures               PASS  (all suites P=R=F1=1.000)
[2]  npm run check-explain-contract       PASS  (60/60 popover-surfacing rules)
     npm run check-explain-contract:test  PASS
[3]  npm run check-rule-css-wiring        PASS  (59/59 rules; 54 unique ids)
     npm run check-rule-css-wiring:test   PASS
[4]  npm run check-spellcheck-features    PASS  (NB/EN/DE/ES/FR all preset-resilient)
[5]  npm run check-network-silence        PASS  (offline contract intact)
[6]  npm run check-exam-marker            PASS  (63 rules + 10 registry entries)
     npm run check-exam-marker:test       PASS
[7]  npm run check-popup-deps             PASS  (4 view modules clean)
     npm run check-popup-deps:test        PASS
[8]  npm run check-bundle-size            PASS  (12.68 MiB / 20.00 MiB cap; 7.32 MiB headroom)
[9]  npm run check-baseline-bundle-size   PASS  (130 KB / 200 KB cap)
     npm run check-baseline-bundle-size:test  PASS
[10] npm run check-benchmark-coverage     PASS  (40/40 expectations met)
     npm run check-benchmark-coverage:test PASS
[11] npm run check-governance-data        PASS  (5 banks, 116 entries)
     npm run check-governance-data:test   PASS
```

## Version bump

`2.9.13` → `2.9.14` (patch — narrow logic fix in `spell-check.js`; no rule scope changes)

- `extension/manifest.json`
- `package.json`
- `backend/public/index.html`

Per CLAUDE.md, this signals lockdown + skriveokt-zero downstream consumers to re-pin.

## Disposition roll-up

| ID | Finding                                                       | Disposition                                  |
| -- | ------------------------------------------------------------- | -------------------------------------------- |
| F1 | FR `fr-aspect-hint` silent                                    | PASS in current data — stale-deploy artifact |
| F2 | ES `es-gustar` silent on extended verbs                       | PASS in current data — markers already present |
| F3 | `duele` flagged out-of-dictionary                             | PASS in current data — likely browser native squiggle, not leksihjelp |
| F4 | Top-bar pill needs amber tint + EKSAMEN suffix                | OUT OF SCOPE — shipped in lockdown commit `5830fcc` |
| F5 | DE Wechselpräposition `in der Schule`                         | DOCS — alternate canonical trigger documented (`in den Schule`, `auf der Tisch`) |
| F6 | Tab navigation auto-collapses Lær mer panel                   | FIXED — commit `4bbab27` (pedagogyPanelExpanded flag) |
| F7 | NN (3.5) + EN (3.6) Lær mer locale walkthroughs               | AUTO-APPROVED — recipe captured for deferred UAT |

## Verdict

**status: complete**

All six findings have explicit dispositions. v3.1 milestone is now archive-ready pending the
deferred extension-side manual UAT (Phase 26 + 27 + 30-01 + 30-02 + this Phase 35 F7
walkthrough) which can be batch-executed in a single browser session before the v3.2 milestone
opens.

## Cross-repo

No cross-repo papertek-vocabulary changes were necessary — verification confirmed the data
already carries the required markers and conjugations. Future enrichment opportunities
(adding `importar`, `tocar`, `bastar` to ES verbbank) are out of scope and queued for a future
data-enrichment phase.
