# English Pedagogy Expansion Plan (Phase 40)

This document outlines the requirements for adding deep learning content to English grammar rules. This follows the "Logic in Leksihjelp, Data in Vocabulary" principle.

## 1. Exam Mode vs. Learning Mode Audit
The following rules should be moved from `safe: true` to `safe: false` (not allowed in exams) as they represent advanced grammatical reasoning rather than simple typo correction.

| Rule ID | Current | New | Reason |
|---------|---------|-----|--------|
| `en-grammar#tense-mix` | Safe | **Unsafe** | Tense consistency (past vs. present) is an intellectual writing choice. |
| `en-grammar#much-many` | Safe | **Unsafe** | Countable vs. uncountable logic is advanced grammar. |
| `en-grammar#modal-of` | Safe | **Unsafe** | "should of" vs "should have" is a common native-speaker level pitfall. |

## 2. High-Priority Learning Lessons (papertek-vocabulary)

Add these entries to the `grammarbank` in the vocabulary database to enable "Lær mer" buttons for English.

### A. The "A/An" Phonetic Rule
- **ID:** `en-a-an`
- **Concept:** Articles are chosen by *sound*, not just the first letter.
- **Content:** 
  - `note`: Use "an" before a vowel *sound* (an FBI, an hour). Use "a" before a consonant *sound* (a university, a UFO).
  - `examples`: *an hour* vs *a house*; *a university* vs *an umbrella*.

### B. Subject-Verb Agreement (The 3rd Person -s)
- **ID:** `en-sv-agreement`
- **Concept:** He/she/it needs an "-s" in the present tense.
- **Content:**
  - `note`: In English, we only add "-s" to the verb when the subject is one person/thing (he, she, it, or a single noun).
  - `examples`: *he speaks* vs *they speak*; *the dog barks* vs *dogs bark*.

### C. Tense Consistency
- **ID:** `en-tense-mix`
- **Concept:** Keeping your story in the same time period.
- **Content:**
  - `note`: If you start a sentence in the past tense (*I went...*), keep following verbs in the past too (*...and saw*, not *...and see*).

### D. Countable vs. Uncountable (Much/Many)
- **ID:** `en-much-many`
- **Concept:** Quantity words.
- **Content:**
  - `note`: Use "many" for things you can count (many books). Use "much" for things you can't count individually (much water, much time).

## 3. Visual Pedagogy Support (SVG)
As established in `papertek-vocabulary` commit `80de9398`, Leksihjelp now supports inline SVG illustrations.

### Requirements for Leksihjelp:
- **`de-perfekt-aux`:** Display the "motion-vs-static" SVG comparing *sein* (motion) and *haben* (static).
- **`fr-etre-avoir`:** Display the same motion visual for French *être* vs *avoir*.

### Tech Implementation:
The `sanitizeWarning` function must be extended to allow:
- **Tags:** `svg, g, circle, rect, line, polyline, polygon, text, path`
- **Attributes:** `viewBox, d, points, stroke, fill, cx, cy, r, x, y, width, height, x1, y1, x2, y2, stroke-width`
- **Color:** Support `currentColor` for automatic light/dark mode compatibility.
