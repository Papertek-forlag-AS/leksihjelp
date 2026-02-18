# Bidra til Leksihjelp

Takk for at du vil bidra! Leksihjelp er laget for norske elever, og alle bidrag som gjor verktooyet bedre er velkomne.

## Komme i gang

### Forutsetninger

- [Node.js](https://nodejs.org/) (v18 eller nyere)
- Chrome eller Edge nettleser
- En teksteditor (VS Code anbefales)

### 1. Klon repoet

```bash
git clone https://github.com/Papertek-forlag-AS/leksihjelp.git
cd leksihjelp
```

### 2. Installer avhengigheter

```bash
cd backend && npm install && cd ..
```

### 3. Last inn utvidelsen

1. Apne `chrome://extensions/` (eller `edge://extensions/`)
2. Sla pa **Utviklermodus** (oppe til hoyre)
3. Klikk **Last inn upakket utvidelse**
4. Velg `extension/`-mappen i prosjektet

Utvidelsen vises na i nettleseren. Ordboken og ordforslag fungerer umiddelbart uten backend.

### 4. Start lokal backend (valgfritt)

Backend trengs kun for TTS (tekst-til-tale) og autentisering:

```bash
# Kopier eksempel-miljoovariabler
cp backend/.env.example backend/.env

# Rediger .env med dine nookler (se nedenfor)

# Start serveren
node backend/local-server.js
```

Serveren starter pa `http://localhost:3000`.

### Miljovariabler

Se `backend/.env.example` for alle variabler. For lokal utvikling trenger du minimum:

| Variabel | Noddvendig for | Hvordan fa den |
|----------|---------------|----------------|
| `ELEVENLABS_API_KEY` | TTS (premium stemmer) | [elevenlabs.io](https://elevenlabs.io) — gratis plan tilgjengelig |
| `ACCESS_CODE` | TTS (legacy tilgang) | Valgfritt — sett en vilkarlig verdi for testing |
| `SESSION_JWT_SECRET` | Autentisering | Generer med `openssl rand -hex 32` |

Firebase- og Vipps-variabler er kun nodvendige hvis du jobber med autentisering eller abonnementsfunksjoner.

**Tips:** Uten backend fungerer ordboken og ordforslag helt fint. TTS faller tilbake til gratis nettleserstemmer.

---

## Hva du kan bidra med

### Vokabular (laveste terskel)

Ordbookene ligger i `extension/data/`:
- `de.json` — Tysk
- `es.json` — Spansk
- `fr.json` — Fransk

Du kan legge til ord, rette oversettelser, eller forbedre eksisterende oppforinger. Se [CLAUDE.md](CLAUDE.md) for datastruktur.

**Eksempel — legge til et substantiv i tysk:**

I `de.json` under `nounbank`:
```json
"hund_noun": {
  "word": "Hund",
  "translation": "hund",
  "genus": "m",
  "article": "der Hund",
  "plural": "die Hunde",
  "partOfSpeech": "substantiv"
}
```

### Grammatikkfunksjoner

Grammatikkinnstillinger defineres i `extension/data/grammarfeatures-{lang}.json`. Du kan legge til nye grammatikkategorier eller forbedre eksisterende.

### Feilretting og forbedringer

- Se [Issues](../../issues) for kjente problemer
- Issues merket `good first issue` er gode startpunkter
- Issues merket `help wanted` trenger ekstra hender

### Tilgjengelighet / dysleksi

Vi onsker spesielt bidrag som gjor Leksihjelp bedre for elever med dysleksi:
- Fonter og skrifttyper tilpasset dysleksi
- Forbedret kontrast og visuelt design
- Lesestotte-funksjoner
- Bedre fonetisk matching i ordforslag

### Norsk bokmaal / nynorsk

Et stort onsket prosjekt er rettskrivingshjelp for norsk. Dette krever:
- Ordlister for BM og NN
- Grammatikkregler
- Tilpasning av ordforslag til norsk

---

## Kode-konvensjoner

- **Vanilla JavaScript** — ingen rammeverk (React, Vue osv.)
- **Ingen byggesteg** — utvidelsen kjorer direkte fra kildekoden
- **Norske kommentarer er OK** — kodebasen blander norsk og engelsk
- **Foljg eksisterende stil** — se pa lignende kode i prosjektet

## Prosjektstruktur

```
extension/          # Chrome/Edge-utvidelsen
  popup/            # Popup-vinduet (ordbok, innstillinger)
  content/          # Content scripts (TTS-widget, ordforslag)
  background/       # Service worker
  data/             # Ordlister og grammatikkdata (JSON)
  styles/           # CSS
  assets/           # Ikoner

backend/            # Vercel serverless functions
  api/              # API-endepunkter
  public/           # Landingsside
  local-server.js   # Lokal utviklingsserver

scripts/            # Hjelpeskript
  sync-vocab.js     # Synkroniserer vokabular fra Papertek API
```

## Pull requests

1. **Fork** repoet og lag en ny branch: `git checkout -b min-endring`
2. **Gjor endringene** dine
3. **Test** at utvidelsen fungerer (last inn pa nytt i `chrome://extensions/`)
4. **Commit** med en beskrivende melding
5. **Push** og opprett en Pull Request

### PR-sjekkliste

- [ ] Utvidelsen laster uten feil i konsollen
- [ ] Eksisterende funksjoner fungerer fortsatt
- [ ] Eventuelle nye ord/oversettelser er korrekte
- [ ] JSON-filer er gyldig JSON

---

## Synkronisere vokabular

Vokabularet kommer fra Papertek API. For aa synkronisere:

```bash
npm run sync-vocab        # Alle sprak
npm run sync-vocab:de     # Kun tysk
npm run sync-vocab:es     # Kun spansk
npm run sync-vocab:fr     # Kun fransk
```

**Merk:** Synkronisering krever tilgang til Papertek API. De fleste bidragsytere kan jobbe direkte med JSON-filene i `extension/data/`.

## Bygge utvidelsen for distribusjon

```bash
npm run package
```

Dette lager `backend/public/lexi-extension.zip` som kan distribueres.

---

## Spoorsmaal?

Opprett en [Issue](../../issues) eller en [Discussion](../../discussions) pa GitHub.
