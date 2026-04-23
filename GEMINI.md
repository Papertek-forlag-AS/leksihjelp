# Leksihjelp - Gemini Development Guide

## The "Golden Loop" (Workflow)
When working on grammar, spellcheck, or word predictions, follow this cycle:

1.  **Identify:** Find a grammar mistake the app misses or a false positive it shouldn't show.
2.  **Reproduce:** Run the relevant language script (e.g., `test_lexi_en.command`) and type the problematic sentence. Save it as a new fixture in `fixtures/{lang}/`.
3.  **Fix:** Update the rule logic in `extension/content/spell-rules/` or the ranker in `extension/content/word-prediction.js`.
4.  **Verify:** Run `npm run check-fixtures` to ensure the new case passes **and** no old cases regressed.

## Recent Logic Improvements (April 2026)

### English (en-grammar.js)
-   **A/An:** Now handles phonetic abbreviations (an FBI, a URL) and silent/consonant edge cases (an honor, a university).

### German (de-grammar.js, de-gender.js)
-   **Adjectives:** Added Dative weak declension rule (e.g., "mit dem großen").
-   **Gender:** Fixed false positives where "der" is correctly used for feminine Dative (e.g., "aus der Stadt").

### Norwegian (nb-sarskriving.js)
-   **Særskriving:** Significantly expanded the blocklist to include common adjectives (*ny, rød, stor, etc.*) to prevent incorrect "glueing" of adjective-noun phrases.

### Word Prediction (word-prediction.js)
-   **Recency (+150):** Recently used words jump to the top.
-   **Bigrams (60x):** Common word pairs are 50% stronger.
-   **Verb Demotion (-200):** Aggressively hides verbs after determiners (a/the/ein).

### Core (vocab-seam-core.js)
-   **Bug Fix:** Dictionary entries with semicolon-separated words (e.g., "word1; word2") are now correctly split and indexed.
