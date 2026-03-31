# Prompt: Expand NB/NN Vocabulary with Common Compound Words

## Context

The Papertek API serves vocabulary data for the Leksihjelp browser extension, which provides word prediction (autocomplete) for Norwegian students. The NB (Bokmål) and NN (Nynorsk) vocabularies are the students' **native language**, not a foreign language they're learning. This means:

- Students have a large passive vocabulary and type varied words daily
- The #1 spelling error in Norwegian schools is **særskriving** — incorrectly splitting compound words ("is krem" instead of "iskrem")
- The word prediction needs compound words in the vocabulary to suggest the correct compound form
- Coverage should be much broader than the foreign language vocabularies (DE/ES/FR), which are limited to curriculum

## Current State

The NB vocabulary has **3,649 entries** across 4 banks:
- 663 verbs, 1,596 nouns, 401 adjectives, 989 general (adverbs, pronouns, conjunctions, phrases, etc.)
- Only ~244 of these are detectable as compound words
- Many everyday compounds that students use in school writing are missing

## What to Add

Add **common Norwegian compound words** (sammensatte ord) to the NB and NN vocabularies, focusing on these categories:

### 1. School and Education (skole og utdanning)
Words students write about daily:
- skolegård, skoledag, skolearbeid, skolesekk, skolefag, skoleklasse, skoleår, skoletur
- klasserom, klassekamerat, klasseforstander, klassefest
- leksehjelp, lekseplan, leksetid
- prøveuke, prøvedag, tentamen
- lærebok, læreplan, læringsmål
- gruppearbeid, grupperom
- karakterkort, halvårsvurdering
- ungdomsskole, barneskole, videregående

### 2. Everyday Life (hverdagsliv)
- matpakke, matbutikk, matretter, matoppskrift
- iskrem, isbit, istapp
- fotball, håndball, basketball, volleyball
- soverom, stue, kjøkken, baderom, sovepose
- lekeplass, lekepark, sandkasse
- bursdagsfest, bursdag, bursdagskake, bursdagsgave
- mobiltelefon, nettbrett, datamaskin
- bussholdeplass, togstasjon, flyplass, busstur
- handlevogn, handlepose, handleliste
- sykkelvei, gangvei, motorvei, bilulykke

### 3. Nature and Weather (natur og vær)
- solskinn, solnedgang, soloppgang
- regnvær, regnjakke, regnbue
- snømann, snøball, snøstorm
- nordlys, midnattssol
- fjelltur, fjelltopp, fjellandskap
- sjøvann, ferskvann, drikkevann, badevannstemperatur
- skogtur, skogssti
- blomstereng, sommerdag, vinterdag, vårdag, høstdag

### 4. Family and People (familie og mennesker)
- besteforeldre, bestemor, bestefar
- søskenbarn, tvillingbror, tvillingsøster
- klassekamerat, bestevenn, bestekompis, bestevenninne
- nabohus, nabogutt, nabojente

### 5. Food and Cooking (mat og matlaging)
- fiskepinner, fiskegrateng, fiskebolle
- kjøttkake, kjøttdeig, kjøttpølse
- brødskive, rundstykke, knekkebrød
- smørbrød, leverpostei, brunost
- middag, frokost, kveldsmat
- julebakst, julekake, pepperkake

### 6. Sports and Hobbies (sport og fritid)
- fotballkamp, fotballtrening, fotballbane
- svømmehall, svømmebasseng
- skiskole, skiheis, skihopp, langrenn
- idrettshall, idrettsplass, treningsøkt
- dataspill, brettspill, kortspill

### 7. Society and Current Events (samfunn)
- klimaendring, klimakrise
- nettmobbing, mobbing
- sosiale medier (phrase), skjermtid
- nyheter, nettavis
- stortinget, kommunestyre, fylkeskommune

## Requirements for Each Entry

Each compound word should follow the existing NB/NN data structure:

```json
{
  "word": "skolegård",
  "type": "noun",
  "genus": "m",
  "plural": "skolegårder",
  "forms": {
    "ubestemt": { "entall": "skolegård", "flertall": "skolegårder" },
    "bestemt": { "entall": "skolegården", "flertall": "skolegårdene" }
  },
  "typos": ["skole gård", "skolegårt"],
  "explanation": {
    "_description": "Maskulint substantiv (en skolegård). Flertall: skolegårder."
  },
  "linkedTo": {
    "de": { "primary": "schulhof_noun" },
    "en": { "primary": "schoolyard_noun" },
    "nn": { "primary": "skulegard_noun" }
  }
}
```

### Critical: The `typos` field should include the split form

For every compound word, the `typos` array MUST include the incorrectly split version (særskriving). This is the most important feature — it allows the word prediction to recognize "skole gård" as a misspelling and suggest "skolegård":

```json
"typos": ["skole gård", "skolegårt"]
```

### NN (Nynorsk) equivalents

Every NB compound should have an NN equivalent. Common NN differences:
- skole → skule (skolegård → skulegard)
- leke → leike (lekeplass → leikeplass)
- kjøkken → kjøken
- bestemt form: -en → -en (m), -a (f), -et (n)
- flertall: may differ (e.g., -er → -ar, -ene → -ane)

## Target

Aim for **300-500 new compound words** per language (NB and NN), prioritizing:
1. Words students actually write in school (essays, tests, daily writing)
2. Words that are most commonly split incorrectly (særskriving)
3. High-frequency everyday compounds

## Note on Frequency

If possible, add a `frequency` field (integer, higher = more common) to help the word prediction rank common words higher. This applies to ALL vocabulary entries (existing and new), not just compounds.
