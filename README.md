# Leksihjelp

Ordbok, uttale og skrivehjelp for norske elever som lerer fremmedsprak.

**Leksihjelp** er en Chrome/Edge-utvidelse laget for norske elever som laerer tysk, spansk eller fransk. Den gir ordbok med grammatikk, tekst-til-tale med naturlig uttale, og ordforslag mens du skriver. Utvidelsen er spesielt utviklet for a vaere nyttig for elever med dysleksi.

> Hosted versjon med premium-stemmer: [leksihjelp.no](https://leksihjelp.no)

---

## Funksjoner

### Ordbok
- Sook norsk &rarr; malsprak og malsprak &rarr; norsk
- Vis grammatikk: booyning, kjonn, kasus, komparativ/superlativ
- Tilpass grammatikkvisning etter ditt niva (velg hvilke tider, kasus osv. du vil se)
- Hoyreklikk pa markert tekst for oppslag
- Fungerer offline — all vokabular er buntet i utvidelsen

### Uttale (tekst-til-tale)
- Marker tekst pa en nettside &rarr; flytende avspillingswidget
- Premium: ElevenLabs-stemmer med naturlig uttale (krever abonnement)
- Gratis: Nettleserens innebygde stemmer (fungerer alltid)
- Justerbar hastighet og stemmevelger

### Ordforslag
- Foreslaar ord mens du skriver i tekstfelt
- Fuzzy matching som taler skrivefeil (nyttig for dyslektikere)
- Fonetisk matching — foreslaar riktig ord selv naar du skriver slik det hoores ut
- Fungerer i vanlige tekstfelt, `<textarea>` og `contenteditable`-elementer (inkl. UDIR proovesystem)

---

## Sprak

| Sprak   | Ordbok | Uttale | Ordforslag |
|---------|--------|--------|------------|
| Tysk    | ~1200 ord | Fungerer | Fungerer |
| Spansk  | ~250 ord  | Fungerer | Fungerer |
| Fransk  | ~250 ord  | Fungerer | Fungerer |

Bidrag med mer vokabular er svart velkomne! Se [CONTRIBUTING.md](CONTRIBUTING.md).

**Planlagt:** Norsk bokmaal og nynorsk (rettskrivingshjelp).

---

## Installasjon

### For brukere

Last ned utvidelsen fra [GitHub Releases](../../releases) eller fra [leksihjelp.no](https://leksihjelp.no):

1. Last ned `lexi-extension.zip`
2. Pakk ut zip-filen
3. Apne `chrome://extensions/` (eller `edge://extensions/`)
4. Sla pa "Utviklermodus"
5. Klikk "Last inn upakket utvidelse"
6. Velg den utpakkede mappen

### For utviklere

Se [CONTRIBUTING.md](CONTRIBUTING.md) for komplett oppsett av utviklingsmiljoo.

Kort versjon:

```bash
# Klon repoet
git clone https://github.com/Papertek-forlag-AS/leksihjelp.git
cd leksihjelp

# Installer backend-avhengigheter
cd backend && npm install && cd ..

# Last inn utvidelsen i Chrome/Edge
# Apne chrome://extensions/ → Utviklermodus → Last inn upakket → velg extension/

# Start lokal backend (krever .env — se backend/.env.example)
node backend/local-server.js
```

---

## Teknologi

- **Utvidelse:** Vanilla JavaScript, Chrome Manifest V3
- **Backend:** Vercel Serverless (Node.js)
- **Autentisering:** Vipps MobilePay (OIDC) + Stripe (kortbetaling)
- **Database:** Firebase Firestore
- **TTS:** ElevenLabs API (premium) / Web Speech API (gratis fallback)
- **Vokabular:** Buntet JSON fra Papertek API

---

## Arkitektur

```
Chrome/Edge-utvidelse          Vercel Backend              Eksterne tjenester
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│  popup.js        │    │  Auth endpoints  │    │  Vipps MobilePay  │
│  floating-widget │◄──►│  TTS proxy       │◄──►│  ElevenLabs       │
│  word-prediction │    │  Webhooks        │    │  Stripe           │
└─────────────────┘    └───────┬──────────┘    └───────────────────┘
                               │
                        ┌──────▼──────┐
                        │  Firestore  │
                        └─────────────┘
```

Se [CLAUDE.md](CLAUDE.md) for detaljert arkitekturdokumentasjon.

---

## Bidra

Vi onsker bidrag! Spesielt:

- **Vokabular** — flere ord, bedre oversettelser, eksempelsetninger
- **Norsk BM/NN** — rettskrivingshjelp pa norsk
- **Tilgjengelighet** — forbedringer for dyslektikere (fonter, kontrast, lesestotte)
- **Nye sprak** — utvidelse til flere sprak i norsk skole
- **Feilretting** — bugs og forbedringer

Se [CONTRIBUTING.md](CONTRIBUTING.md) for hvordan du kommer i gang.

---

## Lisens

MIT — se [LICENSE](LICENSE).

Laget av [Papertek forlag AS](https://www.papertek.no) for norske elever.
