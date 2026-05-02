# Pedagogy Expansion Plan (Phase 39)

This document outlines the requirements for centralizing and expanding the "Lær mer" (Learn More) pedagogical lessons. The goal is to shift from simple error correction to deep learning by providing students with explanations, rules, and examples.

## 1. Architectural Strategy: "Logic in Leksihjelp, Data in Vocabulary"

- **Leksihjelp:** Contains the "engine" to detect errors and the "surfaces" (popovers) to display lessons.
- **Papertek-Vocabulary:** The source of truth for pedagogical content.
- **Contract:** Leksihjelp rules look up pedagogy data using their `rule_id` in the synced `grammarbank`. If data exists, it is prioritized; otherwise, a local fallback is used.

## 2. High-Priority Learning Opportunities

The following rules have been identified as high-value candidates for "Lær mer" enrichment in the `papertek-vocabulary` database.

### A. German Word Order (Subordinate Clauses)
- **ID:** `de-verb-final`
- **Concept:** Verb-final placement in clauses starting with *dass, weil, wenn, ob*.
- **Required Data:**
  - `note`: Explanation of the subordinating conjunction effect.
  - `examples`: *dass er krank ist*, *weil ich keine Zeit habe*.
  - `extra`: Warning about modal verbs (e.g., *kann* goes last).

### B. German Word Order (Main Clauses / V2)
- **ID:** `de-v2`
- **Concept:** Verb-second rule (inversion) when a sentence starts with an adverb or other non-subject.
- **Required Data:**
  - `note`: Explanation of the V2 rule in main clauses.
  - `examples`: *Heute geht er...* vs *Heute er geht...*

### C. German Auxiliary Choice (Perfekt)
- **ID:** `de-perfekt-aux`
- **Concept:** Choosing between *haben* and *sein*.
- **Required Data:**
  - `note`: The "Movement/Change of State" rule.
  - `examples`: *ich bin gekommen* (motion) vs *ich habe gegessen* (no motion).

### D. French Auxiliary Choice (Passé Composé)
- **ID:** `fr-etre-avoir`
- **Concept:** Movement verbs vs. general verbs.
- **Required Data:**
  - `note`: Introduction to the "Vandertramp" verbs.
  - `examples`: *je suis allé* vs *j'ai mangé*.

### E. French Adjective Placement (BAGS)
- **ID:** `fr-bags`
- **Concept:** Beauty, Age, Goodness, Size adjectives that go before the noun.
- **Required Data:**
  - `note`: The BAGS mnemonic.
  - `examples`: *un joli chat* (Beauty - before) vs *un chat noir* (Color - after).

### F. French Past Participle Agreement
- **ID:** `fr-pp-agreement`
- **Concept:** Agreement with preceding Direct Objects in *avoir* constructions.
- **Required Data:**
  - `note`: The rule for *avoir* + preceding DO (la/les).
  - `examples`: *les fleurs que j'ai achetées* vs *j'ai acheté les fleurs*.

## 3. Data Schema for `papertek-vocabulary`

Each `grammarbank` entry should follow this structure:

```json
{
  "id": "rule-id-here",
  "pedagogy": {
    "note": {
      "nb": "Forklaring på bokmål...",
      "nn": "Forklaring på nynorsk...",
      "en": "Explanation in English..."
    },
    "examples": [
      {
        "correct": "Correct German/French string",
        "incorrect": "Incorrect German/French string",
        "translation": {
          "nb": "Oversettelse...",
          "en": "Translation..."
        },
        "note": { "nb": "Valgfri note om dette eksempelet" }
      }
    ],
    "extra": {
      "nb": "Valgfrie tips eller huskeregler..."
    }
  }
}
```

## 4. Implementation Status (as of 2026-05-02)

- [x] **Lookup Card Switcher:** Implemented in `floating-widget.js`.
- [x] **Word Order Fallbacks:** Temporary lessons for `de-v2` and `de-verb-final` added to `leksihjelp`.
- [x] **Preposition Pedagogy:** Full Dative/Accusative fallback added to `de-prep-case.js`.
- [x] **Grammar Picker:** Crash fixed, labels added.

## 5. Next Steps for Geir / Papertek
1. Update `papertek-vocabulary` with the `pedagogy` blocks listed in Section 2.
2. Run `npm run sync-vocab` in Leksihjelp to pull the new data.
3. Verify that the "Lær mer" popover in the browser now shows the centralized data.
