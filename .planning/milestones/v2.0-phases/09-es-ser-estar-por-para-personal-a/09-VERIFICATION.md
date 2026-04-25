---
phase: 09-es-ser-estar-por-para-personal-a
verified: 2026-04-25T00:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 9: ES ser/estar, por/para, personal "a" Verification Report

**Phase Goal:** Ship three ES grammar-governance rules — ser/estar copula-adjective mismatch, por/para preposition confusion, personal "a" missing marker — each with fixtures, explain contracts, CSS wiring, and benchmark expectations.
**Verified:** 2026-04-25
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | grammar-tables.js exports ES_COPULA_ADJ, ES_SER_FORMS, ES_ESTAR_FORMS, ES_POR_PARA_TRIGGERS, ES_HUMAN_NOUNS, ES_COPULA_VERBS on self.__lexiGrammarTables | VERIFIED | Node assertion passes: 63-entry ES_COPULA_ADJ, 28-element ES_HUMAN_NOUNS, 12-entry ES_POR_PARA_TRIGGERS, all as correct types; DE tables preserved |
| 2  | spell-check-core.js SUBJECT_PRONOUNS includes es entry | VERIFIED | `es: new Set(['yo', 'tu', 'el', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'usted', 'ustedes'])` present at lines 68–70 |
| 3  | benchmark-texts/expectations.json has entries for ser-estar, por-para (x2), and personal-a | VERIFIED | es.43 (es-ser-estar), es.27 (es-por-para), es.34 (es-por-para), es.42 (es-personal-a) — all P2 warn; line numbers differ from plan (es.46→es.43 etc.) because es.txt was modified to match the actual file content |
| 4  | es-ser-estar.js fires on "Soy cansado" and not on correct/both-adjective usage | VERIFIED | check-fixtures passes 52/52 for es/ser-estar (32 positive, 20 acceptance, P=1.000 R=1.000) |
| 5  | es-por-para.js fires on "por mi familia" and "por leer un libro"; safe phrases do not flag | VERIFIED | check-fixtures passes 50/50 for es/por-para (34 positive, 16 acceptance, P=1.000 R=1.000) |
| 6  | es-personal-a.js fires on "Veo Juan"; place names and copula verbs do not flag | VERIFIED | check-fixtures passes 50/50 for es/personal-a (31 positive, 19 acceptance, P=1.000 R=1.000) |
| 7  | All three rules have explain contracts (nb, nn, severity) and CSS dot-colour bindings | VERIFIED | check-explain-contract 37/37 pass; check-rule-css-wiring 37/37 pass; CSS lines 891–893 bind .lh-spell-es-ser-estar, .lh-spell-es-por-para, .lh-spell-es-personal-a all to #f59e0b (amber P2) |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content/spell-rules/grammar-tables.js` | ES closed-set trigger tables (ES_COPULA_ADJ and five others) | VERIFIED | Exports all six ES tables alongside DE tables; 63-entry ES_COPULA_ADJ with ser/estar/both values |
| `extension/content/spell-check-core.js` | ES subject pronouns in SUBJECT_PRONOUNS | VERIFIED | `es: new Set([...])` added after fr entry |
| `extension/content/spell-rules/es-ser-estar.js` | ES-01 copula-adjective mismatch rule | VERIFIED | IIFE registers id 'es-ser-estar', lazy-init getTables(), explain contract present, manifest wired |
| `extension/content/spell-rules/es-por-para.js` | ES-02 por/para preposition confusion rule | VERIFIED | IIFE registers id 'es-por-para', consumes ES_POR_PARA_TRIGGERS and ES_HUMAN_NOUNS, explain contract present |
| `extension/content/spell-rules/es-personal-a.js` | ES-03 personal "a" missing-marker rule | VERIFIED | IIFE registers id 'es-personal-a', consumes ES_HUMAN_NOUNS + ES_COPULA_VERBS + isLikelyProperNoun, explain contract present |
| `fixtures/es/ser-estar.jsonl` | Regression fixtures for ES-01, min 45 lines | VERIFIED | 55 lines, 52 data fixtures (32 positive, 20 acceptance) — exceeds minimum |
| `fixtures/es/por-para.jsonl` | Regression fixtures for ES-02, min 45 lines | VERIFIED | 53 lines, 50 data fixtures (34 positive, 16 acceptance) — exceeds minimum |
| `fixtures/es/personal-a.jsonl` | Regression fixtures for ES-03, min 45 lines | VERIFIED | 53 lines, 50 data fixtures (31 positive, 19 acceptance) — exceeds minimum |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `grammar-tables.js` | `self.__lexiGrammarTables` | IIFE global export, pattern ES_COPULA_ADJ | WIRED | host.__lexiGrammarTables = tables assignment present; Node require confirms all ES tables accessible |
| `spell-check-core.js` | `classifyPOS` | SUBJECT_PRONOUNS lookup | WIRED | es entry present in SUBJECT_PRONOUNS const |
| `es-ser-estar.js` | `self.__lexiGrammarTables` | lazy-init getTables() at first check() call | WIRED | getTables() reads host.__lexiGrammarTables, destructures ES_COPULA_ADJ (line 75), ES_SER_FORMS, ES_ESTAR_FORMS |
| `es-ser-estar.js` | `host.__lexiSpellRules` | rule registration push (line 178) | WIRED | host.__lexiSpellRules.push(rule) present |
| `es-por-para.js` | `self.__lexiGrammarTables` | lazy-init getTables() | WIRED | getTables() reads ES_POR_PARA_TRIGGERS and ES_HUMAN_NOUNS (lines 70–71) |
| `es-personal-a.js` | `self.__lexiGrammarTables` | lazy-init getTables() | WIRED | getTables() reads ES_HUMAN_NOUNS, ES_COPULA_VERBS, ES_SER_FORMS, ES_ESTAR_FORMS (lines 62–67) |
| `es-personal-a.js` | `spell-check-core.js` | isLikelyProperNoun function | WIRED | `const { isLikelyProperNoun: coreIsProperNoun } = core` with inline fallback if not available (line 21–24) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ES-01 | 09-02 | ES ser vs estar flagged by predicate-adjective lookup | SATISFIED | es-ser-estar.js fires; check-fixtures 52/52; benchmark es.43 flips; REQUIREMENTS.md marked [x] |
| ES-02 | 09-03 | ES por vs para flagged via trigger-pattern decision tree | SATISFIED | es-por-para.js fires; check-fixtures 50/50; benchmark es.27 + es.34 flip; REQUIREMENTS.md marked [x] |
| ES-03 | 09-03 | ES personal "a" flagged when transitive verb + bare human direct object | SATISFIED | es-personal-a.js fires; check-fixtures 50/50; benchmark es.42 flips; REQUIREMENTS.md marked [x] |

No orphaned requirements found — all three phase-9 IDs appear in plan frontmatter and are implemented.

---

### Release Gate Results

| Gate | Result |
|------|--------|
| `check-fixtures` | PASS — all es/ser-estar, es/por-para, es/personal-a fixtures at P=1.000 R=1.000; no regressions in any other language |
| `check-explain-contract` | PASS — 37/37 rules including all three new ES rules |
| `check-rule-css-wiring` | PASS — 37/37 rules; es-ser-estar, es-por-para, es-personal-a all wired to amber #f59e0b |
| `check-network-silence` | PASS — no fetch/XHR in any rule file |
| `check-benchmark-coverage` | PASS — 16/16 expectations met, P2: 14/14 (100%), P3: 2/2 (100%) |
| `check-spellcheck-features` | PASS — ES lookup indexes are feature-independent |
| `check-governance-data` | PASS — no governance banks (pre-data-sync state) |

---

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments in the three new rule files. No empty return stubs. All check() implementations are substantive (lazy-init pattern, token iteration, finding generation).

---

### Human Verification Required

None required for automated gate coverage. The following items would benefit from browser spot-checks if desired (deferred per project pattern):

1. **Popover UX for ser/estar** — open extension on a page containing "Soy cansado", verify amber dot appears over "Soy" and popover shows Norwegian explanation with correct copula suggestion.
2. **Popover UX for por/para** — verify "por mi familia" flags "por" with suggestion "para" in context.
3. **Popover UX for personal "a"** — verify "Veo Juan" flags "Juan" with suggestion "a Juan".
4. **Non-flagging of safe phrases** — "por favor", "por ejemplo" on a real page must remain silent.

---

### Benchmark Line Number Discrepancy (Informational)

The plans (09-01-PLAN.md) specified target lines es.46, es.30, es.37, es.45. The actual expectations.json uses es.43, es.27, es.34, es.42. This is not a gap — the SUMMARY author verified the actual content of es.txt and set correct line numbers. Line 27 of es.txt contains "por mi familia", line 34 contains "por leer un libro", line 42 contains "Veo Juan", and line 43 contains "Soy cansado". The check-benchmark-coverage gate confirms all four lines flip as expected.

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier)_
