# Grammar Presets Specification for Papertek Vocabulary API

This document defines the progressive disclosure presets for all languages in Leksihjelp. Each language has 4 levels (Lite → Middels → Mye → Alt) that progressively reveal more grammar complexity.

Feature IDs marked with `*` are **future** — not yet in the data but should be added to `grammarfeatures-{lang}.json` so presets are ready when vocabulary data includes them.

## How presets work in Leksihjelp

The `grammarfeatures-{lang}.json` file contains:
- `features[]` — all grammar toggle definitions
- `categories[]` — grouping for the "Tilpass selv" UI
- `presets[]` — named bundles of feature IDs for progressive disclosure

When a student picks "Middels", the extension enables exactly the features listed in that preset. "Tilpass selv" lets them override individual toggles.

---

## German (de)

**Pedagogical mapping:** VG1 start → VG1-VG2 → VG2-VG3 → full reference

### Features

| ID | Name | Category | Status |
|----|------|----------|--------|
| `grammar_de_presens` | Presens | verbs | Exists |
| `grammar_de_preteritum` | Preteritum | verbs | Exists |
| `grammar_de_perfektum` | Perfektum | verbs | Exists |
| `grammar_de_futurum` | Futurum* | verbs | Future |
| `grammar_de_imperativ` | Imperativ* | verbs | Future |
| `grammar_de_konjunktiv` | Konjunktiv II* | verbs | Future |
| `grammar_de_passiv` | Passiv* | verbs | Future |
| `grammar_de_verb_class` | Verbklasse | verbs | Exists |
| `grammar_de_genus` | Artikler/kjønn | nouns | Exists |
| `grammar_de_plural` | Flertall | nouns | Exists |
| `grammar_de_cases` | Kasustabell (full) | nouns | Exists |
| `grammar_de_akkusativ` | Akkusativ | nouns | Exists |
| `grammar_de_dativ` | Dativ | nouns | Exists |
| `grammar_de_genitiv` | Genitiv | nouns | Exists |
| `grammar_de_komparativ` | Komparativ | adjectives | Exists |
| `grammar_de_superlativ` | Superlativ | adjectives | Exists |
| `grammar_de_adj_declension` | Adjektivbøyning | adjectives | Exists |
| `grammar_de_pronoun_cases` | Pronomen i kasus* | pronouns | Future |

### Presets

```json
{
  "presets": [
    {
      "id": "basic",
      "name": "Lite",
      "nameEn": "Basic",
      "description": "Grunnleggende — presens, artikler, flertall",
      "features": [
        "grammar_de_presens",
        "grammar_de_genus",
        "grammar_de_plural"
      ]
    },
    {
      "id": "intermediate",
      "name": "Middels",
      "nameEn": "Intermediate",
      "description": "Flere tider, akkusativ, gradbøyning",
      "features": [
        "grammar_de_presens",
        "grammar_de_preteritum",
        "grammar_de_verb_class",
        "grammar_de_genus",
        "grammar_de_plural",
        "grammar_de_akkusativ",
        "grammar_de_komparativ",
        "grammar_de_superlativ"
      ]
    },
    {
      "id": "advanced",
      "name": "Mye",
      "nameEn": "Advanced",
      "description": "Perfektum, dativ, adjektivbøyning, imperativ",
      "features": [
        "grammar_de_presens",
        "grammar_de_preteritum",
        "grammar_de_perfektum",
        "grammar_de_imperativ",
        "grammar_de_verb_class",
        "grammar_de_genus",
        "grammar_de_plural",
        "grammar_de_akkusativ",
        "grammar_de_dativ",
        "grammar_de_komparativ",
        "grammar_de_superlativ",
        "grammar_de_adj_declension"
      ]
    },
    {
      "id": "all",
      "name": "Alt",
      "nameEn": "All",
      "description": "All grammatikk — genitiv, konjunktiv, passiv, pronomen",
      "features": [
        "grammar_de_presens",
        "grammar_de_preteritum",
        "grammar_de_perfektum",
        "grammar_de_futurum",
        "grammar_de_imperativ",
        "grammar_de_konjunktiv",
        "grammar_de_passiv",
        "grammar_de_verb_class",
        "grammar_de_genus",
        "grammar_de_plural",
        "grammar_de_cases",
        "grammar_de_akkusativ",
        "grammar_de_dativ",
        "grammar_de_genitiv",
        "grammar_de_komparativ",
        "grammar_de_superlativ",
        "grammar_de_adj_declension",
        "grammar_de_pronoun_cases"
      ]
    }
  ]
}
```

---

## Spanish (es)

**Pedagogical mapping:** VG1 start → VG1-VG2 → VG2-VG3 → full reference

### Features

| ID | Name | Category | Status |
|----|------|----------|--------|
| `grammar_es_presente` | Presente | verbs | Exists |
| `grammar_es_preterito` | Pretérito indefinido | verbs | Exists |
| `grammar_es_perfecto` | Pretérito perfecto | verbs | Exists |
| `grammar_es_imperfecto` | Imperfecto* | verbs | Future |
| `grammar_es_futuro` | Futuro simple* | verbs | Future |
| `grammar_es_imperativo` | Imperativo* | verbs | Future |
| `grammar_es_subjuntivo` | Subjuntivo presente* | verbs | Future |
| `grammar_es_gerundio` | Gerundio* | verbs | Future |
| `grammar_es_condicional` | Condicional* | verbs | Future |
| `grammar_es_verb_class` | Verbklasse (-ar/-er/-ir)* | verbs | Future |
| `grammar_es_pronouns_all` | Alle pronomen | verbs | Exists |
| `grammar_es_pronouns_singular_nosotros` | Pronomen ent. + nosotros | verbs | Exists |
| `grammar_es_pronouns_yo_tu` | Bare yo/tú | verbs | Exists |
| `grammar_es_genus` | Artikler/kjønn | nouns | Exists |
| `grammar_es_plural` | Flertall | nouns | Exists |
| `grammar_es_komparativ` | Komparativ | adjectives | Exists |
| `grammar_es_superlativ` | Superlativ | adjectives | Exists |
| `grammar_es_adj_placement` | Adjektivplassering* | adjectives | Future |
| `grammar_es_adj_agreement` | Adjektivsamsvar (m/f)* | adjectives | Future |

### Presets

```json
{
  "presets": [
    {
      "id": "basic",
      "name": "Lite",
      "nameEn": "Basic",
      "description": "Grunnleggende — presente, artikler, flertall",
      "features": [
        "grammar_es_presente",
        "grammar_es_pronouns_yo_tu",
        "grammar_es_genus",
        "grammar_es_plural"
      ]
    },
    {
      "id": "intermediate",
      "name": "Middels",
      "nameEn": "Intermediate",
      "description": "Pretérito, flere pronomen, gradbøyning",
      "features": [
        "grammar_es_presente",
        "grammar_es_preterito",
        "grammar_es_pronouns_singular_nosotros",
        "grammar_es_genus",
        "grammar_es_plural",
        "grammar_es_komparativ",
        "grammar_es_superlativ"
      ]
    },
    {
      "id": "advanced",
      "name": "Mye",
      "nameEn": "Advanced",
      "description": "Perfecto, imperfecto, imperativo, alle pronomen",
      "features": [
        "grammar_es_presente",
        "grammar_es_preterito",
        "grammar_es_perfecto",
        "grammar_es_imperfecto",
        "grammar_es_imperativo",
        "grammar_es_gerundio",
        "grammar_es_pronouns_all",
        "grammar_es_genus",
        "grammar_es_plural",
        "grammar_es_komparativ",
        "grammar_es_superlativ",
        "grammar_es_adj_agreement"
      ]
    },
    {
      "id": "all",
      "name": "Alt",
      "nameEn": "All",
      "description": "All grammatikk — subjuntivo, condicional, futuro",
      "features": [
        "grammar_es_presente",
        "grammar_es_preterito",
        "grammar_es_perfecto",
        "grammar_es_imperfecto",
        "grammar_es_futuro",
        "grammar_es_imperativo",
        "grammar_es_subjuntivo",
        "grammar_es_gerundio",
        "grammar_es_condicional",
        "grammar_es_verb_class",
        "grammar_es_pronouns_all",
        "grammar_es_genus",
        "grammar_es_plural",
        "grammar_es_komparativ",
        "grammar_es_superlativ",
        "grammar_es_adj_placement",
        "grammar_es_adj_agreement"
      ]
    }
  ]
}
```

---

## French (fr)

**Pedagogical mapping:** VG1 start → VG1-VG2 → VG2-VG3 → full reference

### Features

| ID | Name | Category | Status |
|----|------|----------|--------|
| `grammar_fr_present` | Présent | verbs | Exists |
| `grammar_fr_passe_compose` | Passé composé | verbs | Exists |
| `grammar_fr_imparfait` | Imparfait* | verbs | Future |
| `grammar_fr_futur_simple` | Futur simple* | verbs | Future |
| `grammar_fr_imperatif` | Impératif* | verbs | Future |
| `grammar_fr_subjonctif` | Subjonctif présent* | verbs | Future |
| `grammar_fr_conditionnel` | Conditionnel présent* | verbs | Future |
| `grammar_fr_plus_que_parfait` | Plus-que-parfait* | verbs | Future |
| `grammar_fr_verb_group` | Verbgruppe (1./2./3.)* | verbs | Future |
| `grammar_fr_pronouns_all` | Alle pronomen | verbs | Exists |
| `grammar_fr_pronouns_singular_nous` | Pronomen ent. + nous | verbs | Exists |
| `grammar_fr_pronouns_je_tu` | Bare je/tu | verbs | Exists |
| `grammar_fr_genus` | Artikler/kjønn | nouns | Exists |
| `grammar_fr_plural` | Flertall | nouns | Exists |
| `grammar_fr_partitif` | Partitiv (du/de la/des)* | nouns | Future |
| `grammar_fr_komparativ` | Komparativ | adjectives | Exists |
| `grammar_fr_superlativ` | Superlativ | adjectives | Exists |
| `grammar_fr_adj_placement` | Adjektivplassering* | adjectives | Future |
| `grammar_fr_adj_agreement` | Adjektivsamsvar (m/f, ent/fl)* | adjectives | Future |

### Presets

```json
{
  "presets": [
    {
      "id": "basic",
      "name": "Lite",
      "nameEn": "Basic",
      "description": "Grunnleggende — présent, artikler, flertall",
      "features": [
        "grammar_fr_present",
        "grammar_fr_pronouns_je_tu",
        "grammar_fr_genus",
        "grammar_fr_plural"
      ]
    },
    {
      "id": "intermediate",
      "name": "Middels",
      "nameEn": "Intermediate",
      "description": "Passé composé, flere pronomen, gradbøyning",
      "features": [
        "grammar_fr_present",
        "grammar_fr_passe_compose",
        "grammar_fr_pronouns_singular_nous",
        "grammar_fr_genus",
        "grammar_fr_plural",
        "grammar_fr_komparativ",
        "grammar_fr_superlativ"
      ]
    },
    {
      "id": "advanced",
      "name": "Mye",
      "nameEn": "Advanced",
      "description": "Imparfait, impératif, partitiv, alle pronomen",
      "features": [
        "grammar_fr_present",
        "grammar_fr_passe_compose",
        "grammar_fr_imparfait",
        "grammar_fr_imperatif",
        "grammar_fr_pronouns_all",
        "grammar_fr_genus",
        "grammar_fr_plural",
        "grammar_fr_partitif",
        "grammar_fr_komparativ",
        "grammar_fr_superlativ",
        "grammar_fr_adj_agreement"
      ]
    },
    {
      "id": "all",
      "name": "Alt",
      "nameEn": "All",
      "description": "All grammatikk — subjonctif, conditionnel, futur",
      "features": [
        "grammar_fr_present",
        "grammar_fr_passe_compose",
        "grammar_fr_imparfait",
        "grammar_fr_futur_simple",
        "grammar_fr_imperatif",
        "grammar_fr_subjonctif",
        "grammar_fr_conditionnel",
        "grammar_fr_plus_que_parfait",
        "grammar_fr_verb_group",
        "grammar_fr_pronouns_all",
        "grammar_fr_genus",
        "grammar_fr_plural",
        "grammar_fr_partitif",
        "grammar_fr_komparativ",
        "grammar_fr_superlativ",
        "grammar_fr_adj_placement",
        "grammar_fr_adj_agreement"
      ]
    }
  ]
}
```

---

## English (en)

**Pedagogical mapping:** Beginner → Intermediate → Advanced → Full reference

### Features

| ID | Name | Category | Status |
|----|------|----------|--------|
| `grammar_en_present` | Present simple | verbs | Exists |
| `grammar_en_past` | Past simple | verbs | Exists |
| `grammar_en_perfect` | Present perfect | verbs | Exists |
| `grammar_en_continuous` | Continuous (-ing)* | verbs | Future |
| `grammar_en_future` | Future (will/going to)* | verbs | Future |
| `grammar_en_passive` | Passive voice* | verbs | Future |
| `grammar_en_conditional` | Conditional (would)* | verbs | Future |
| `grammar_en_irregular` | Irregular verb forms* | verbs | Future |
| `grammar_en_plural` | Plural | nouns | Exists |
| `grammar_en_genitive` | Genitive (-'s)* | nouns | Future |
| `grammar_en_countable` | Countable/uncountable* | nouns | Future |
| `grammar_en_comparative` | Comparative | adjectives | Exists |
| `grammar_en_superlative` | Superlative | adjectives | Exists |

### Presets

```json
{
  "presets": [
    {
      "id": "basic",
      "name": "Lite",
      "nameEn": "Basic",
      "description": "Grunnleggende — present, flertall",
      "features": [
        "grammar_en_present",
        "grammar_en_plural"
      ]
    },
    {
      "id": "intermediate",
      "name": "Middels",
      "nameEn": "Intermediate",
      "description": "Past, perfect, gradbøyning",
      "features": [
        "grammar_en_present",
        "grammar_en_past",
        "grammar_en_perfect",
        "grammar_en_plural",
        "grammar_en_comparative",
        "grammar_en_superlative"
      ]
    },
    {
      "id": "advanced",
      "name": "Mye",
      "nameEn": "Advanced",
      "description": "Continuous, future, passiv, genitiv",
      "features": [
        "grammar_en_present",
        "grammar_en_past",
        "grammar_en_perfect",
        "grammar_en_continuous",
        "grammar_en_future",
        "grammar_en_passive",
        "grammar_en_irregular",
        "grammar_en_plural",
        "grammar_en_genitive",
        "grammar_en_comparative",
        "grammar_en_superlative"
      ]
    },
    {
      "id": "all",
      "name": "Alt",
      "nameEn": "All",
      "description": "All grammatikk — conditional, countable/uncountable",
      "features": [
        "grammar_en_present",
        "grammar_en_past",
        "grammar_en_perfect",
        "grammar_en_continuous",
        "grammar_en_future",
        "grammar_en_passive",
        "grammar_en_conditional",
        "grammar_en_irregular",
        "grammar_en_plural",
        "grammar_en_genitive",
        "grammar_en_countable",
        "grammar_en_comparative",
        "grammar_en_superlative"
      ]
    }
  ]
}
```

---

## Norwegian Bokmål (nb) and Nynorsk (nn)

These are the student's native language dictionaries, used for monolingual lookup. Grammar is simpler since students already know the language — the features help them see formal grammar categories.

### Features (same structure for both nb and nn)

| ID (nb) | ID (nn) | Name | Category | Status |
|----------|---------|------|----------|--------|
| `grammar_nb_presens` | `grammar_nn_presens` | Presens | verbs | Exists |
| `grammar_nb_preteritum` | `grammar_nn_preteritum` | Preteritum | verbs | Exists |
| `grammar_nb_perfektum` | `grammar_nn_perfektum` | Perfektum | verbs | Exists |
| `grammar_nb_imperativ` | `grammar_nn_imperativ` | Imperativ* | verbs | Future |
| `grammar_nb_passiv` | `grammar_nn_passiv` | Passiv* | verbs | Future |
| `grammar_nb_genus` | `grammar_nn_genus` | Kjønn (en/ei/et) | nouns | Exists |
| `grammar_nb_flertall` | `grammar_nn_fleirtal` | Flertall | nouns | Exists |
| `grammar_nb_bestemt_form` | `grammar_nn_bestemt_form` | Bestemt form | nouns | Exists |
| `grammar_nb_noun_forms` | `grammar_nn_noun_forms` | Bøyningstabell | nouns | Exists |
| `grammar_nb_komparativ` | `grammar_nn_komparativ` | Komparativ | adjectives | Exists |
| `grammar_nb_superlativ` | `grammar_nn_superlativ` | Superlativ | adjectives | Exists |
| `grammar_nb_adj_declension` | `grammar_nn_adj_declension` | Adjektivbøyning* | adjectives | Future |

### Presets (shown for nb — nn uses `_nn_` prefix and `fleirtal` instead of `flertall`)

```json
{
  "presets": [
    {
      "id": "basic",
      "name": "Lite",
      "nameEn": "Basic",
      "description": "Grunnleggende — presens, kjønn, flertall",
      "features": [
        "grammar_nb_presens",
        "grammar_nb_genus",
        "grammar_nb_flertall"
      ]
    },
    {
      "id": "intermediate",
      "name": "Middels",
      "nameEn": "Intermediate",
      "description": "Preteritum, bestemt form, gradbøyning",
      "features": [
        "grammar_nb_presens",
        "grammar_nb_preteritum",
        "grammar_nb_genus",
        "grammar_nb_flertall",
        "grammar_nb_bestemt_form",
        "grammar_nb_komparativ",
        "grammar_nb_superlativ"
      ]
    },
    {
      "id": "advanced",
      "name": "Mye",
      "nameEn": "Advanced",
      "description": "Perfektum, bøyningstabell, imperativ",
      "features": [
        "grammar_nb_presens",
        "grammar_nb_preteritum",
        "grammar_nb_perfektum",
        "grammar_nb_imperativ",
        "grammar_nb_genus",
        "grammar_nb_flertall",
        "grammar_nb_bestemt_form",
        "grammar_nb_noun_forms",
        "grammar_nb_komparativ",
        "grammar_nb_superlativ"
      ]
    },
    {
      "id": "all",
      "name": "Alt",
      "nameEn": "All",
      "description": "All grammatikk — passiv, adjektivbøyning",
      "features": [
        "grammar_nb_presens",
        "grammar_nb_preteritum",
        "grammar_nb_perfektum",
        "grammar_nb_imperativ",
        "grammar_nb_passiv",
        "grammar_nb_genus",
        "grammar_nb_flertall",
        "grammar_nb_bestemt_form",
        "grammar_nb_noun_forms",
        "grammar_nb_komparativ",
        "grammar_nb_superlativ",
        "grammar_nb_adj_declension"
      ]
    }
  ]
}
```

---

## Implementation notes for Papertek Vocabulary

1. Add the `presets` array to each `grammarfeatures-{lang}.json` file
2. Add feature definitions for all `*` (future) features — they can exist in the features list even if no vocabulary data uses them yet. Leksihjelp will simply toggle them without effect until data is available.
3. The default preset for new users should be `basic` (Leksihjelp already falls back to this in `loadGrammarFeatures()`)
4. After updating, Leksihjelp syncs via `npm run sync-vocab` and the presets will appear as pill buttons in the grammar settings
