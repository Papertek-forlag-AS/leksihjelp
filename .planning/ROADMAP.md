# Roadmap: Leksihjelp

## Milestones

- ✅ **v1.0 Spell-Check & Prediction Quality** — Phases 1-5 + 02.1/03.1/05.1 decimal inserts (shipped 2026-04-21) — [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Depth of Coverage — Grammar Governance Beyond Tokens** — Phases 6–15.1 (shipped 2026-04-25) — [archive](milestones/v2.0-ROADMAP.md)
- ✅ **v2.1 Compound Decomposition & Polish** — Phases 16–19 (shipped 2026-04-26) — [archive](milestones/v2.1-ROADMAP.md)
- 🚧 **v2.2 Student Language Intelligence** — Phases 21–22 (in progress)

## Phases

<details>
<summary>✅ v1.0 Spell-Check & Prediction Quality (Phases 1-5 + decimal inserts) — SHIPPED 2026-04-21</summary>

- [x] Phase 1: Foundation — Vocab Seam + Regression Fixture (3/3 plans) — completed 2026-04-18
- [x] Phase 2: Data Layer — Frequency, Bigrams, Typo Bank (5/5 plans) — completed 2026-04-18
- [x] Phase 02.1: Close SC-4 Bundle-Size Cap (INSERTED) (2/2 plans) — completed 2026-04-19
- [x] Phase 3: Rule Architecture & Ranking Quality (5/5 plans) — completed 2026-04-20
- [x] Phase 03.1: Close SC-01 Browser Wiring (INSERTED) (1/1 plan) — completed 2026-04-20
- [x] Phase 4: False-Positive Reduction on NB/NN (3/3 plans) — completed 2026-04-20
- [x] Phase 5: Student Experience Polish (5/5 plans) — completed 2026-04-20
- [x] Phase 05.1: Close UX-01 Gaps from Phase 5 Smoke Test (INSERTED) (5/5 plans) — completed 2026-04-21

See: `.planning/milestones/v1.0-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.0 Depth of Coverage — Grammar Governance Beyond Tokens (Phases 6-15.1) — SHIPPED 2026-04-25</summary>

- [x] Phase 6: Structural Infrastructure + Register & Stylistic Polish (3/3 plans) — completed 2026-04-24
- [x] Phase 7: Word-Order Violations NB + DE + FR (4/4 plans) — completed 2026-04-24
- [x] Phase 8: DE Case & Agreement Governance (3/3 plans) — completed 2026-04-24
- [x] Phase 9: ES ser/estar, por/para, Personal "a" (3/3 plans) — completed 2026-04-25
- [x] Phase 10: FR Elision, Auxiliary, Participe Passe 10.3a (3/3 plans) — completed 2026-04-25
- [x] Phase 11: Aspect & Mood ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 12: Pronoun & Pro-Drop ES + FR (3/3 plans) — completed 2026-04-25
- [x] Phase 13: Register Drift Within a Document (3/3 plans) — completed 2026-04-25
- [x] Phase 14: Morphology Beyond Tokens EN + ES/FR (3/3 plans) — completed 2026-04-25
- [x] Phase 14.1: Vocab-Seam Browser Wiring (GAP CLOSURE) (1/1 plan) — completed 2026-04-25
- [x] Phase 15: Collocations at Scale NB + DE + FR + ES (1/1 plan) — completed 2026-04-25
- [x] Phase 15.1: Fixture Gate Triage (GAP CLOSURE) (1/1 plan) — completed 2026-04-25

See: `.planning/milestones/v2.0-ROADMAP.md` for full phase detail and success criteria.

</details>

<details>
<summary>✅ v2.1 Compound Decomposition & Polish (Phases 16-19) — SHIPPED 2026-04-26</summary>

- [x] Phase 16: Decomposition Engine (2/2 plans) — completed 2026-04-26
- [x] Phase 17: Compound Integration (6/6 plans) — completed 2026-04-26
- [x] Phase 18: Spell-Check Polish (2/2 plans) — completed 2026-04-26
- [x] Phase 19: NB/NN Passiv-s Detection (3/3 plans) — completed 2026-04-26
- [ ] Phase 20: Browser Visual Verification — deferred (VERIF-01)

See: `.planning/milestones/v2.1-ROADMAP.md` for full phase detail and success criteria.

</details>

### 🚧 v2.2 Student Language Intelligence (In Progress)

**Milestone Goal:** Help students choose the right word — false-friend warnings, sense-grouped preposition translations, and å/og confusion detection.

- [x] **Phase 21: Dictionary Intelligence — False Friends + Preposition Polysemy** - Data enrichment in Papertek API + popup and floating-widget rendering for cross-language false-friend warnings and sense-grouped translations (completed 2026-04-26)
- [x] **Phase 21.1: Fix Dictionary Intelligence Data Pipeline (GAP CLOSURE)** - Wire falseFriends/senses data from nb.json through to popup.js and floating-widget.js renderers; fix filter direction inversion (completed 2026-04-26)
- [ ] **Phase 22: å/og Confusion Detection** - Sentence-level NB/NN spell-check rule for Norway's most common writing error

## Phase Details

### Phase 21: Dictionary Intelligence — False Friends + Preposition Polysemy
**Goal**: Students see context that prevents wrong-word choices — false-friend warnings before they pick a translation, and sense-grouped preposition translations instead of a flat ambiguous list
**Depends on**: Nothing (first phase of v2.2; uses existing popup/floating-widget rendering infrastructure)
**Requirements**: FF-01, FF-02, FF-03, FF-04, POLY-01, POLY-02, POLY-03, POLY-04
**Success Criteria** (what must be TRUE):
  1. User looking up "aktuell" in the dictionary popup sees a prominent warning that it does not mean "actual" in English, rendered above the translation list
  2. User looking up "på" in the dictionary popup sees translations grouped by sense (location, time, manner) with expandable headers, not a flat list
  3. User selecting a false-friend word on a web page and triggering the floating-widget inline lookup sees the same false-friend warning as in the popup
  4. User selecting a polysemous preposition on a web page sees sense-grouped translations in the floating-widget
  5. False-friend and sense data originates from Papertek API fields (`falseFriends`, `senses`) — no hand-edited JSON in extension/data
**Plans**: 2 plans

Plans:
- [ ] 21-01-PLAN.md — Sync vocabulary data + verify popup rendering (FF-01/02/03, POLY-01/02/03)
- [ ] 21-02-PLAN.md — Floating-widget false-friend + polysemy rendering (FF-04, POLY-04)

### Phase 21.1: Fix Dictionary Intelligence Data Pipeline (GAP CLOSURE)
**Goal**: Wire falseFriends and senses data from nb.json through to popup.js and floating-widget.js renderers so students actually see false-friend warnings and sense-grouped translations
**Depends on**: Phase 21 (rendering functions exist but receive wrong data)
**Requirements**: FF-01, FF-03, FF-04, POLY-01, POLY-03, POLY-04
**Gap Closure**: Closes 6 unsatisfied requirements + 4 integration gaps + 2 broken flows from v2.2 audit
**Success Criteria** (what must be TRUE):
  1. User looking up "aktuell" in the dictionary popup sees a visible false-friend warning banner (not empty string)
  2. User looking up "på" in the dictionary popup sees sense-grouped translations (not flat translation fallback)
  3. User selecting a false-friend word in the floating-widget sees the warning banner
  4. User selecting "på" in the floating-widget sees sense-grouped translations
  5. Filter direction correct: falseFriends entries with `lang: 'de'` render when target language is German
**Plans**: 1 plan

Plans:
- [ ] 21.1-01-PLAN.md — Wire NB enrichment data through search pipeline in popup.js and floating-widget.js

### Phase 22: å/og Confusion Detection
**Goal**: Students writing Norwegian get flagged when they confuse "å" and "og" — the single most common NB/NN writing error
**Depends on**: Nothing (independent spell-check rule; can run in parallel with Phase 21)
**Requirements**: AAOG-01, AAOG-02, AAOG-03, AAOG-04
**Success Criteria** (what must be TRUE):
  1. User typing "hun liker og lese" sees a spell-check flag on "og" with suggestion to use "å"
  2. User typing "kaffe å kake" sees a spell-check flag on "å" with suggestion to use "og"
  3. User typing "sitter og leser" does NOT see a flag (posture verb + og + verb is grammatically correct)
  4. Popover explain text renders in both NB and NN registers, following the explain-contract pattern
**Plans**: TBD

Plans:
- [ ] 22-01: å/og rule implementation with posture-verb exception list + fixtures + explain contract

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-04-18 |
| 2. Data Layer | v1.0 | 5/5 | Complete | 2026-04-18 |
| 02.1 Bundle-Size Cap | v1.0 | 2/2 | Complete | 2026-04-19 |
| 3. Rule Architecture | v1.0 | 5/5 | Complete | 2026-04-20 |
| 03.1 Browser Wiring | v1.0 | 1/1 | Complete | 2026-04-20 |
| 4. False-Positive Reduction | v1.0 | 3/3 | Complete | 2026-04-20 |
| 5. Student Experience Polish | v1.0 | 5/5 | Complete | 2026-04-20 |
| 05.1 UX-01 Gaps | v1.0 | 5/5 | Complete | 2026-04-21 |
| 6. Structural Infrastructure | v2.0 | 3/3 | Complete | 2026-04-24 |
| 7. Word-Order Violations | v2.0 | 4/4 | Complete | 2026-04-24 |
| 8. DE Case & Agreement | v2.0 | 3/3 | Complete | 2026-04-24 |
| 9. ES ser/estar, por/para | v2.0 | 3/3 | Complete | 2026-04-25 |
| 10. FR Elision, Auxiliary, PP | v2.0 | 3/3 | Complete | 2026-04-25 |
| 11. Aspect & Mood | v2.0 | 3/3 | Complete | 2026-04-25 |
| 12. Pronoun & Pro-Drop | v2.0 | 3/3 | Complete | 2026-04-25 |
| 13. Register Drift | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14. Morphology Beyond Tokens | v2.0 | 3/3 | Complete | 2026-04-25 |
| 14.1 Vocab-Seam Wiring | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15. Collocations at Scale | v2.0 | 1/1 | Complete | 2026-04-25 |
| 15.1 Fixture Gate Triage | v2.0 | 1/1 | Complete | 2026-04-25 |
| 16. Decomposition Engine | v2.1 | 2/2 | Complete | 2026-04-26 |
| 17. Compound Integration | v2.1 | 6/6 | Complete | 2026-04-26 |
| 18. Spell-Check Polish | v2.1 | 2/2 | Complete | 2026-04-26 |
| 19. NB/NN Passiv-s Detection | v2.1 | 3/3 | Complete | 2026-04-26 |
| 20. Browser Verification | v2.1 | 0/0 | Deferred | - |
| 21. Dictionary Intelligence | v2.2 | 2/2 | Complete | 2026-04-26 |
| 21.1 Pipeline Fix (GAP) | 1/1 | Complete    | 2026-04-26 | - |
| 22. å/og Confusion | v2.2 | 0/1 | Not started | - |

---
*Roadmap updated: 2026-04-26 — v2.2 milestone roadmap created*
