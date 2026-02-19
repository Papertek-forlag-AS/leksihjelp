# Papertek Vocabulary: Missing Data for Leksihjelp Inflection Search

## Background

Leksihjelp is a Chrome extension for Norwegian students learning German, Spanish, and French. It has a dictionary search feature that now supports **inflection search** — students can type a conjugated verb form (e.g., "bin") or a plural noun (e.g., "Familien") and find the base word ("sein", "Familie").

This feature relies on `conjugations` and `plural` data in the Papertek vocabulary database. Spanish and French are 100% complete. German has gaps.

## What Leksihjelp Consumes

Leksihjelp fetches vocabulary from these Papertek API endpoints:

- `GET /api/vocab/v1/core/german` — core vocabulary (word, conjugations, plural, genus, etc.)
- `GET /api/vocab/v1/core/spanish` — same for Spanish
- `GET /api/vocab/v1/core/french` — same for French
- `GET /api/vocab/v1/translations/{pair}` — Norwegian translations (de-nb, es-nb, fr-nb)

The `conjugations` and `plural` fields come from the **core** endpoint.

## Current Coverage

| Language | Verbs with presens conjugations | Nouns with plural data |
|----------|--------------------------------|----------------------|
| German   | All verbs have presens         | ~301 of ~664 (45%)   |
| Spanish  | All verbs have presens         | All nouns (100%)      |
| French   | All verbs have presens         | All nouns (100%)      |

## Gap 1: German Nouns Missing Plural Data

~363 German nouns have no `plural` field. Many are abstract/uncountable nouns where `plural: null` is correct (e.g., "Mathematik", "Biologie", "Deutsch"). But some countable nouns should have plurals filled in.

### Expected data structure for nouns

Noun entries with plural data look like this:

```json
{
  "word": "Familie",
  "genus": "f",
  "plural": "die Familien",
  "_id": "familie_noun",
  ...
}
```

Or with a simple plural (no article):

```json
{
  "word": "Jahr",
  "genus": "n",
  "plural": "Jahre",
  "_id": "jahr_noun",
  ...
}
```

Nouns that are genuinely uncountable should have `"plural": null` explicitly.

### Action needed

For every German noun entry in the `nounbank`:
1. If the noun is countable and missing `plural` — add the correct German plural form
2. If the noun is genuinely uncountable/mass noun — set `"plural": null` explicitly
3. Format: use the bare plural form (e.g., "Familien", "Jahre", "Kinder") — the article "die" prefix is optional but consistent with how some existing entries do it

## Gap 2 (Optional/Future): Past Tense Conjugations

Currently all three languages only have `presens` (present tense) conjugations. Adding past tenses would be a significant enhancement for the inflection search feature.

### German: Preteritum (Imperfekt)

```json
"conjugations": {
  "presens": {
    "former": {
      "ich": "bin", "du": "bist", "er/sie/es": "ist",
      "wir": "sind", "ihr": "seid", "sie/Sie": "sind"
    },
    "feature": "grammar_presens"
  },
  "preteritum": {
    "former": {
      "ich": "war", "du": "warst", "er/sie/es": "war",
      "wir": "waren", "ihr": "wart", "sie/Sie": "waren"
    },
    "feature": "grammar_preteritum"
  }
}
```

### German: Perfektum

```json
"perfektum": {
  "former": {
    "ich": "bin gewesen", "du": "bist gewesen", "er/sie/es": "ist gewesen",
    "wir": "sind gewesen", "ihr": "seid gewesen", "sie/Sie": "sind gewesen"
  },
  "feature": "grammar_perfektum"
}
```

### Spanish: Preterito Indefinido

```json
"preterito": {
  "former": ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"]
}
```

Note: Spanish/French use **arrays** (6 person forms in order: yo/tu/el/nosotros/vosotros/ellos) while German uses **objects** with pronoun keys.

### French: Passe Compose

Would follow the same array pattern as Spanish presens.

## Summary of Priority

1. **High priority:** Fill in missing German noun plurals (~363 nouns to review)
2. **Medium priority:** Add `preteritum` conjugations for German verbs
3. **Low priority:** Add `perfektum` for German, `preterito` for Spanish, past tenses for French

After updating the Papertek database, Leksihjelp pulls the data with:
```bash
npm run sync-vocab      # Sync all languages
npm run sync-vocab:de   # Sync only German
```

The inflection search code in Leksihjelp automatically indexes any new conjugation tenses and plural data — no code changes needed on the Leksihjelp side.
