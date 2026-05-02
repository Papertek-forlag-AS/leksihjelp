# Om bidrag til Leksihjelp

Leksihjelp er **kildekodeåpent, men ikke open source.** Kildekoden er
offentlig tilgjengelig under [PolyForm Noncommercial 1.0.0](LICENSE) slik
at skoler, lærere, foreldre, UDIR og andre kan lese, granske og verifisere
nøyaktig hva utvidelsen gjør på elevenes maskiner. Dette er viktig for
oss og for tilliten til verktøyet.

Prosjektet vedlikeholdes av Papertek forlag AS med AI-assistanse
(Claude). **Vi tar ikke imot pull requests.** Det er et bevisst valg —
en liten, fokusert vedlikeholdsmodell holder kvaliteten og pedagogikken
konsistent, og lar oss bevege oss raskt uten å bryte løfter til skolene
som bruker oss.

## Hvis du har funnet en feil eller har et ønske

Åpne et issue på GitHub:
<https://github.com/Papertek-forlag-AS/leksihjelp/issues>

Spesielt nyttig:

- **Skrivefeil eller pedagogiske feil i ordboken** — skjermbilde + språk + ordet det gjelder.
- **Feil i stavekontroll** — eksempel-setning, hvilket språk, hva regelen burde sagt.
- **Manglende ord** — språk + ord + foreslått oversettelse.
- **Tilgjengelighetsproblemer** — særlig for elever med dysleksi.

## Hvis du vil bygge noe lignende selv

Lisensen tillater ikke-kommersiell bruk, modifikasjon og gransking.
Det betyr at en lærer, forsker, skole eller annen institusjon fritt kan
ta utgangspunkt i koden for ikke-kommersielle formål. Kommersiell
gjenbruk eller distribusjon krever skriftlig avtale med oss
(post@papertek.no).

## Hvis du jobber for UDIR eller en skoleeier

Ta kontakt direkte: <post@papertek.no>. Vi tilbyr egne avtaler for
institusjonell bruk og er glade for tilbakemeldinger på personvern,
sikkerhet og pedagogikk.

## Vil du kjøre koden lokalt for å granske den?

Dette er fullt tillatt og oppmuntret. Forutsetninger:

- [Node.js](https://nodejs.org/) v18 eller nyere
- Chrome eller Edge nettleser

Klon repoet og last inn `extension/`-mappen som en upakket utvidelse:

```bash
git clone https://github.com/Papertek-forlag-AS/leksihjelp.git
cd leksihjelp
# Åpne chrome://extensions/ → Utviklermodus → Last inn upakket → velg extension/
```

Backend trengs kun for premium-uttale og innlogging — alt offline-innhold
fungerer uten.
