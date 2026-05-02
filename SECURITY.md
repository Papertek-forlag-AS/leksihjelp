# Sikkerhet

## Rapportere sårbarheter

Har du oppdaget en sårbarhet i Leksihjelp? Send en e-post til
**post@papertek.no** med detaljer. Vennligst ikke åpne et offentlig
issue for sikkerhetsproblemer — det gir tid til å fikse problemet før
det blir kjent.

Inkluder gjerne:

- Beskrivelse av sårbarheten og potensiell påvirkning
- Steg for å reprodusere
- Hvilken versjon av utvidelsen / backend du testet på
- Eventuelle forslag til løsning

Vi forsøker å svare innen 5 virkedager.

## Omfang

- **Utvidelsen** (kode under `extension/`): innholdsskript, popup, service-worker
- **Backend** (`backend/api/`): autentisering (Vipps/Stripe), TTS-proxy, webhooks
- **Datalagring**: Firestore-tilgang, sesjons-JWT, abonnementsdata
- **Personvern**: utilsiktet datalekkasje, tracking, tredjepartsdeling

## Utenfor omfang

- Sårbarheter i tredjepartstjenester (ElevenLabs, Vipps, Stripe, Firebase) — rapporter direkte til den aktuelle leverandøren.
- DDoS / volumetriske angrep på `leksihjelp.no` — rate-limiting håndteres på Vercel-nivå.

Tusen takk for at du bidrar til at Leksihjelp er trygt for elevene som bruker det.
