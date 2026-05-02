# Leksihjelp

Ordbok, stavekontroll, uttale og skrivehjelp for norske elever.

**Leksihjelp** er en Chrome/Edge-utvidelse for elever som skriver på
bokmål, nynorsk, engelsk, tysk, spansk eller fransk. Den gir toveis
ordbok med grammatikk, stavekontroll med pedagogiske forklaringer,
naturlig tekst-til-tale og smarte ordforslag mens du skriver.
Utvidelsen er spesielt utviklet for å være nyttig for elever med
dysleksi.

> Hostet versjon med premium-stemmer: [leksihjelp.no](https://leksihjelp.no)

---

## Funksjoner

### Ordbok
- Toveis oppslag mellom alle seks språk (norsk ↔ målspråk og målspråk ↔ norsk)
- Bøyninger, kjønn, kasus, komparativ/superlativ
- Tilpass grammatikkvisning etter ditt nivå (velg hvilke tider, kasus osv. du vil se)
- Sammensatte ord brytes ned og forklares (tysk og norsk)
- Høyreklikk på markert tekst for oppslag
- Fungerer offline — all vokabular er buntet i utvidelsen

### Stavekontroll
- 54+ grammatikkregler med tydelige forklaringer (ikke bare røde streker)
- Egne regler per språk: ordstilling, å/og-forveksling, kjønn, modalverb,
  sammensetning, kasus, dialektblanding
- "Lær mer"-popover med pedagogisk forklaring og eksempler
- Bokmål ↔ nynorsk: oppdager dialektblanding og feil målform

### Uttale (tekst-til-tale)
- Marker tekst på en nettside → flytende avspillingswidget med ordsynk
- Premium: ElevenLabs-stemmer med naturlig uttale (krever abonnement)
- Gratis: nettleserens innebygde stemmer (fungerer alltid, også offline)
- Justerbar hastighet og stemmevelger

### Ordforslag
- Foreslår ord mens du skriver i tekstfelt
- Fuzzy matching som tåler skrivefeil (nyttig for dyslektikere)
- Fonetisk matching — foreslår riktig ord selv når du skriver slik det høres ut
- Kontekstbevisst (riktig verbform etter pronomen, kjønn etter artikkel)
- Fungerer i vanlige tekstfelt, `<textarea>` og `contenteditable`-elementer (inkl. UDIRs prøvesystem)

### Sidepanel
- Fest ordboken som sidepanel i nettleseren — alltid synlig mens du skriver

---

## Språk

| Språk          | Ordbok | Stavekontroll | Uttale   | Ordforslag |
|----------------|--------|---------------|----------|------------|
| Bokmål         | ✓      | ✓             | ✓        | ✓          |
| Nynorsk        | ✓      | ✓             | ✓        | ✓          |
| Engelsk        | ✓      | ✓             | ✓        | ✓          |
| Tysk           | ✓      | ✓             | ✓        | ✓          |
| Spansk         | ✓      | ✓             | ✓        | ✓          |
| Fransk         | ✓      | ✓             | ✓        | ✓          |

---

## Installasjon

Last ned utvidelsen fra [GitHub Releases](../../releases) eller fra [leksihjelp.no](https://leksihjelp.no):

1. Last ned `lexi-extension.zip`
2. Pakk ut zip-filen
3. Åpne `chrome://extensions/` (eller `edge://extensions/`)
4. Slå på "Utviklermodus"
5. Klikk "Last inn upakket utvidelse"
6. Velg den utpakkede mappen

---

## Kjøre koden lokalt (for innsyn / gransking)

```bash
git clone https://github.com/Papertek-forlag-AS/leksihjelp.git
cd leksihjelp

# Last inn utvidelsen i Chrome/Edge:
# chrome://extensions/ → Utviklermodus → Last inn upakket → velg extension/

# Backend trengs kun for premium-uttale og innlogging:
cd backend && npm install && cd ..
node backend/local-server.js  # krever .env — se backend/.env.example
```

---

## Teknologi

- **Utvidelse:** Vanilla JavaScript, Chrome Manifest V3
- **Backend:** Vercel Serverless (Node.js)
- **Autentisering:** Vipps MobilePay (OIDC) + Stripe (kortbetaling)
- **Database:** Firebase Firestore
- **TTS:** ElevenLabs API (premium) / Web Speech API (gratis fallback)
- **Vokabular:** Synkronisert fra Papertek API

Se [CLAUDE.md](CLAUDE.md) for detaljert arkitekturdokumentasjon.

---

## Tilbakemeldinger

Leksihjelp vedlikeholdes av Papertek forlag AS med AI-assistanse, og vi
tar ikke imot pull requests. Har du funnet en feil eller savner noe?
Åpne et [issue på GitHub](../../issues) — vi leser alt. Se
[CONTRIBUTING.md](CONTRIBUTING.md) for detaljer.

---

## Lisens

[PolyForm Noncommercial 1.0.0](LICENSE) — kildekoden er offentlig
tilgjengelig for ikke-kommersiell bruk, gransking og modifikasjon. For
kommersiell bruk eller distribusjon, kontakt post@papertek.no.

Laget av [Papertek forlag AS](https://www.papertek.no) for norske elever.
