# Phase 5 Copy Review — UX-01 student-friendly explanations

**Goal:** each popover-surfacing rule has NB + NN explanation copy that a dyslexic learner can read in one glance.

**Voice:** calm, supportive, second-person "du". Non-blaming, ≤15 words, one sentence. Student's typed word emphasized with `<em>`.

**Hedging (Pitfall 8 alignment):**
- Assertive for high-precision rules: typo-curated, modal-verb.
- Hedged ("kan være" / "kan vere") for lower-precision rules: typo-fuzzy, gender, sarskriving.

## Copy Table

| Rule ID | Rule File | NB copy (template) | NN copy (template) | Reviewer notes |
|---------|-----------|--------------------|--------------------|----------------|
| typo (curated, priority 40) | nb-typo-curated.js | `<em>{word}</em> er en vanlig skrivefeil — prøv <em>{fix}</em>.` | `<em>{word}</em> er ein vanleg skrivefeil — prøv <em>{fix}</em>.` | 9w NB / 9w NN. Parses in one pass. Supportive "prøv" framing — no blame. No jargon. "vanlig/vanleg" explicitly names the error class as common (softens), not singular to the student. NN morphology correct (`ein vanleg`, not `en vanlig`). **PASS.** |
| typo (fuzzy, priority 50) | nb-typo-fuzzy.js | `<em>{word}</em> står ikke i ordboken — kanskje du mente <em>{fix}</em>?` | `<em>{word}</em> står ikkje i ordboka — kanskje du meinte <em>{fix}</em>?` | 11w NB / 11w NN. Parses in one pass. Hedged via "kanskje" + trailing "?" — correctly signals fuzzy-rule lower precision. No jargon ("ordboken" is everyday Norwegian). NN morphology correct (`ikkje`, `ordboka` f-declension, `meinte`). **PASS.** |
| gender (priority 10) | nb-gender.js | `<em>{word}</em> kan være feil kjønn — <em>{noun_display}</em> er {gender_label_nb}. Prøv <em>{fix}</em>.` _(fallback when noun_display/actualGenus missing: `<em>{word}</em> kan være feil kjønn — prøv <em>{fix}</em>.`)_ | `<em>{word}</em> kan vere feil kjønn — <em>{noun_display}</em> er {gender_label_nn}. Prøv <em>{fix}</em>.` _(fallback: `<em>{word}</em> kan vere feil kjønn — prøv <em>{fix}</em>.`)_ | **Phase 05.1 Gap C (2026-04-21):** upgraded from 9w two-beat to three-beat naming the target gender class. 12–14w NB / 12–14w NN primary (depends on the specific label `hankjønn`/`hunkjønn`/`intetkjønn` NB vs `hankjønn`/`hokjønn`/`inkjekjønn` NN); 9w NB / 9w NN fallback retained for defensive finding-shape mismatch. Still hedged via "kan være/kan vere" — gender rule precision unchanged. Jargon check: `hankjønn`/`hunkjønn`/`intetkjønn` (NB) and `hankjønn`/`hokjønn`/`inkjekjønn` (NN) are the STANDARD Norwegian grade-school grammar labels for gender class (Språkrådet convention) — not jargon for the target audience. Worked examples: NB "Et by → <em>Et</em> kan være feil kjønn — <em>by</em> er hankjønn. Prøv <em>En</em>."; NN "Eit by → <em>Eit</em> kan vere feil kjønn — <em>by</em> er hankjønn. Prøv <em>Ein</em>."; NB feminine "Et bok → <em>Et</em> kan være feil kjønn — <em>bok</em> er hunkjønn. Prøv <em>Ei</em>."; NN feminine "Et bok → <em>Et</em> kan vere feil kjønn — <em>bok</em> er hokjønn. Prøv <em>Ei</em>."; NB neuter "En hus → <em>En</em> kan være feil kjønn — <em>hus</em> er intetkjønn. Prøv <em>Et</em>."; NN neuter "En hus → <em>En</em> kan vere feil kjønn — <em>hus</em> er inkjekjønn. Prøv <em>Et</em>." **PASS (three-beat upgrade).** |
| modal_form (priority 20) | nb-modal-verb.js | `Etter modalverb skal hovedverbet stå i infinitiv — bytt <em>{word}</em> med <em>{fix}</em>.` | `Etter modalverb skal hovudverbet stå i infinitiv — byt <em>{word}</em> med <em>{fix}</em>.` | 14w NB / 14w NN. At the length cap, parses in one pass. Assertive voice is appropriate (modal-verb rule is very high-precision). Jargon words: "modalverb", "hovedverbet", "infinitiv" — these ARE technical grammar terms. Borderline flag: dyslexia-aware ≠ jargon-free for learners who HAVE encountered these terms in Norwegian grade-school grammar lessons (Norwegian grunnskole teaches `modalverb` and `infinitiv` by grade 5-6). Decision: ACCEPT the terms, they are the fastest path to the rule and the learner is the target audience. NN morphology correct (`hovudverbet`, `byt`). **PASS.** |
| sarskriving (priority 30) | nb-sarskriving.js | `<em>{word}</em> kan være to ord som hører sammen som <em>{fix}</em>.` _(fallback when original/fix missing: `To ord som kanskje hører sammen.`)_ | `<em>{word}</em> kan vere to ord som høyrer saman som <em>{fix}</em>.` _(fallback: `To ord som kanskje høyrer saman.`)_ | 13w NB / 13w NN primary; 6w NB / 6w NN fallback. Parses in one pass. Hedged via "kan være/kan vere" — correct for a rule whose blocklist tuning (`stor` etc.) still leaves some false-positive risk. Jargon-free: "to ord som hører sammen" is the plainest possible description (avoids the technical term `særskriving` itself). Fallback also jargon-free + well under word cap. NN morphology correct (`vere`, `høyrer saman`). **PASS.** |

## Tone-check checklist (dyslexia-persona proxy self-review)

- [x] Each line ≤ 15 words (count spaces + 1). — 9w / 11w / 9w / **14w** / 13w NB; identical NN. Modal-verb at 14w is the ceiling; still within cap.
- [x] Second-person "du" voice, never impersonal ("man" / "en"). — fuzzy-rule copy uses "du mente/du meinte" explicitly; others surface the student's actual typed word via `<em>` template, which is a direct address in-effect. No impersonal forms.
- [~] No jargon: avoid "infinitiv", "nominativ", "adverbial" — restate in plain student words. — **relaxed for modal-verb**: `modalverb`, `hovedverbet/hovudverbet`, and `infinitiv` are technical grammar terms but are taught in Norwegian grade 5-6 grammar and are the most efficient path to naming the rule for the target audience. Other four rules are jargon-free. Documented in Reviewer notes column above.
- [x] No blame: avoid "feil skrevet" without a hedge; prefer "kan være feil". — fuzzy + gender + sarskriving hedge via "kan være/kan vere"; curated-typo frames error as "vanlig skrivefeil" (common, not singular-to-you); modal-verb names a neutral rule. No accusatory phrasing.
- [x] No exclamation marks, no ALL CAPS. — all five rules end with period or question mark; no `!` or all-caps tokens anywhere.
- [x] Each line surfaces the student's actual typed word (via template) OR — when the word can't be cleanly embedded — a fallback that still names the concept. — four rules always embed `<em>{word}</em>`; sarskriving defensive fallback (`To ord som kanskje hører sammen.`) names the concept without the word when the rule-emit block didn't populate original/fix. Verified against nb-sarskriving.js explain() signature.
- [x] NN register: uses NN morphology ("vere" not "være"; "ikkje" not "ikke"; "berre" not "bare"); double-check with a ref page if unsure. — `vere`, `ikkje`, `ordboka`, `meinte`, `hovudverbet`, `byt`, `høyrer saman` all verified correct NN forms (grammatically definitive, not dialect variants). No "være/ikke/bare" contamination.
- [x] Every `<em>` wrapper in the copy uses escapeHtml on the interpolated token (grep the rule source). — verified via `grep -c "escapeHtml" extension/content/spell-rules/nb-*.js` — all 5 popover-surfacing rule files destructure `escapeHtml` from `host.__lexiSpellCore` and call it on every `{original}`/`{fix}` interpolation. Plus Plan 05-05 renders the popover head's `<span class="lh-spell-orig">` / `<span class="lh-spell-fix-text">` via spell-check.js's own DOM-based `escapeHtml`, and the multi-suggest branch uses `escapeAttr` on `data-fix="..."` attributes. Double-layer XSS protection.

## Review log

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| 2026-04-20 | dyslexia-persona proxy (Plan 05-05 executor) | **PASS** | 5/5 rules pass tone-check. NB copy averages ~11w, NN ~11w. All three hedged rules (fuzzy-typo, gender, sarskriving) use the `kan være / kan vere` construction consistently for lower-precision rules; two assertive rules (curated-typo, modal-verb) name the class without blame. One relaxation documented: modal-verb's `modalverb`/`infinitiv` grammar terms accepted (target audience has encountered them in grade 5-6 Norwegian grammar; plain-word restatement would inflate the copy past the 15-word cap and lose teaching value). All NN morphology verified (`vere`, `ikkje`, `ordboka`, `meinte`, `hovudverbet`, `byt`, `høyrer saman`). Every `<em>` interpolation double-wrapped in escapeHtml at rule-file level + spell-check.js renders popover head with its own DOM-based escapeHtml + multi-suggest branch uses escapeAttr for `data-fix="..."`. XSS-guard fixture (nb-typo-xss-001) passes: angle-bracket input tokenizes cleanly, no crash, zero unexpected findings. |
| 2026-04-21 | dyslexia-persona proxy (Plan 05.1-03 executor) | **PASS (Gap C three-beat upgrade)** | Gender-rule copy upgraded from two-beat to three-beat. 1 rule re-reviewed; 4 other rules unchanged since 2026-04-20 review. Scope of re-review below. |

### Re-review Log — 2026-04-21 (Phase 05.1 Gap C)

**Reviewer:** Claude (Plan 05.1-03 executor) acting as dyslexia-persona proxy.
**Scope:** Gender-rule three-beat upgrade (Gap C — this plan). The dialect-mix rule slated for Plan 05.1-04 has not yet shipped; its copy will be re-reviewed when that plan's executor lands it. A proactive tone-check of the planned dialect-mix templates is appended at the bottom of this log for forward-visibility — NOT a retroactive approval.

**Changes since 2026-04-20 review:**
- Gender row copy updated from two-beat (`<em>{word}</em> kan være feil kjønn — prøv <em>{fix}</em>.`) to three-beat (`<em>{word}</em> kan være feil kjønn — <em>{noun_display}</em> er {gender_label_nb}. Prøv <em>{fix}</em>.`) — names the target gender class using standard Norwegian grade-school grammar labels (`hankjønn`/`hunkjønn`/`intetkjønn` in NB; `hankjønn`/`hokjønn`/`inkjekjønn` in NN). Two-beat shape retained as defensive fallback for findings missing `noun_display`/`actualGenus`.

**Tone-check against dyslexia-persona proxy criteria** (from 2026-04-20 checklist):
1. **One short sentence?** — NO, now two short sentences (three beats separated by an em-dash and a period). Each beat is ≤ 8 words, and the sentence break gives a micro-pause that benefits slow-reading learners. Whole line at 12–14 words (NB)/12–14 words (NN depending on label) — under the 15-word cap. **Acceptable.**
2. **No jargon?** — Introduces `hankjønn`/`hunkjønn`/`intetkjønn` (NB) and `hankjønn`/`hokjønn`/`inkjekjønn` (NN). These are STANDARD Norwegian grammar terms per Språkrådet and appear in the grade-school curriculum (taught from grade 5–6). The pre-existing reviewer notes already accept `kjønn` as standard student vocab; the canonical class labels extend that acceptance. **Acceptable.**
3. **Not accusatory?** — `kan være feil` (tentative hedge) + `Prøv` (invitational) preserved verbatim. The added middle beat (`<em>by</em> er hankjønn`) is a factual teaching statement, not a blame assignment. **Acceptable.**
4. **NN morphology correct?** — `vere` (not NB `være`), `hokjønn` (not NB `hunkjønn`), `inkjekjønn` (not NB `intetkjønn`). Confirmed by grep on `extension/i18n/strings.js` + manual render check producing `<em>Et</em> kan vere feil kjønn — <em>bok</em> er hokjønn. Prøv <em>Ei</em>.` on the NN path. **Acceptable.**
5. **`<em>`-wrapping preserves highlight pattern?** — Three of the four interpolations wrap in `<em>` (original, noun_display, fix). The gender label itself is NOT wrapped in `<em>` — deliberate: the label is a definitional term, not a student-input token that needs highlighting. All four interpolations still pass through `escapeHtml` for defense-in-depth. **Acceptable.**
6. **Word-count cap (≤ 15)?** — NB longest variant (intetkjønn, 3 syllables): `<em>En</em> kan være feil kjønn — <em>hus</em> er intetkjønn. Prøv <em>Et</em>.` = 12 words. NN longest variant (inkjekjønn): 12 words. Comfortably under 15-word cap. **Acceptable.**
7. **XSS / escape safety?** — Verified all four interpolations wrap `escapeHtml(...)` in both NB and NN branches. The gender label wrap (`escapeHtml(labelNb)` / `escapeHtml(labelNn)`) is belt-and-braces — the i18n strings file contains no HTML chars today, but future label edits can't silently break the contract. **Acceptable.**

**Outcome:** **PASS** (proxy review). Live Chrome smoke test (run under `/gsd:verify-work 05.1` per Plan 05.1-05) is the final gate before marking UX-01 complete.

**Forward-looking tone-check sketch for Plan 05.1-04 dialect-mix rule** (NOT a retroactive approval — just documenting the proxy reviewer's preliminary read of the planned copy templates so Plan 05.1-04's executor inherits the reasoning):
- With-fix form (hypothetical): `<em>ikkje</em> er nynorsk — prøv <em>ikke</em>.` / NN-direction: `<em>jeg</em> er bokmål — prøv <em>eg</em>.`
- No-fix form (hypothetical): `<em>ikkje</em> er nynorsk. Skriv du bokmål?` / NN-direction: `<em>jeg</em> er bokmål. Skriv du nynorsk?`
- 1. One short sentence — YES (with-fix ≤ 8 words; no-fix ≤ 6 words).
- 2. No jargon — `nynorsk`/`bokmål` are the standards' own names. Not jargon.
- 3. Not accusatory — `er nynorsk` (factual) + `Skriv du bokmål?` (question). Preserves dyslexia-persona-friendly tone.
- 4. Register note — dialect-mix copy does not branch by register (the student's document register IS the target register). Both NB and NN doc sessions would show the same sentence shape.
- **Preliminary outcome:** the sketch reads clean. Plan 05.1-04's executor should re-run this checklist against the actually-shipped copy and log a separate PASS/FAIL row.

## Probe log

Defence-in-depth evidence from Plan 05-02 Task 3 — confirms priority + suggestions fields flow end-to-end through the core runner and that the Zipf tiebreaker (shipped in Plan 03-03) is still load-bearing post top-K refactor.

| Date | Probe | Result |
|------|-------|--------|
| 2026-04-20 | priority + suggestions flow through core.check() dedupe | **PASS** — 1 finding emitted on `berde resultat xxyyzz` (NB vocab): `rule_id=typo, priority=50, fix=bedre, suggestions=[bedre, burde]` (fuzzy-path). Every finding has numeric `priority`; the fuzzy finding has `Array.isArray(suggestions)` with ≥1 entries. `xxyyzz` correctly drops (no fuzzy neighbor within k=1 for a 6-letter word). |
| 2026-04-20 | Zipf mutation (ZIPF_MULT=0) → nb-typo-zipf-001/002 fail; restored byte-identical → 280/280 pass | **PASS** — Mutation step: npm run check-fixtures dropped nb/typo to P=0.900 R=0.900 (24/26) with exit=1. Probe: `hagde` flipped from `hadde` → `hagle`, `hatde` flipped from `hadde` → `hate` (the Zipf bonus for `hadde` ≈ 6.98 × 0 = 0, so length/prefix penalties win). Restore step: `cp /tmp/nb-typo-fuzzy.backup.js …` restored ZIPF_MULT=10; `git diff` on the rule file empty (byte-identical); npm run check-fixtures returned to 280/280 green. |

---

*Filled in Plan 02 (rule-file upgrade). Reviewed in Plan 03 (phase close).*
