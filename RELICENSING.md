# Relisensiering: MIT → PolyForm Noncommercial 1.0.0

**Dato:** 2026-05-02

## Hva endret seg

Fra og med commit `3f7e627` (på `main`, 2026-05-02) er Leksihjelp lisensiert
under [PolyForm Noncommercial 1.0.0](LICENSE), ikke MIT-lisensen.

Dette ble formelt fullført i en oppfølgingscommit som rettet `package.json`
sitt `license`-felt og la til denne fila.

## Hvor lisensgrensen går

- **Alle commits før `3f7e627`** forblir tilgjengelige under MIT.
  Det er den juridiske realiteten ved relisensiering: kode som allerede er
  publisert under en gitt lisens kan ikke trekkes tilbake fra mottakerne.
  Hvem som helst kan ta utgangspunkt i en pre-`3f7e627`-checkout av repoet
  og bruke den under MIT-vilkår.

- **Alle commits fra og med `3f7e627`** er lisensiert under PolyForm
  Noncommercial 1.0.0. Det inkluderer all videreutvikling, alle nye
  filer, og alle modifikasjoner av eksisterende filer. Bidragsytere som
  sender inn endringer (issues, framtidige PR-er) gjør det under disse
  vilkårene.

## Begrunnelse

PolyForm Noncommercial reflekterer bedre intensjonen med prosjektet:
Leksihjelp er ment som en gratis tjeneste for elever og skoler, ikke som
råstoff for kommersiell videresalg av tredjepart. Kildekoden forblir
offentlig tilgjengelig for innsyn, gransking, modifikasjon og
ikke-kommersiell bruk; institusjoner som UDIR, lærere og forskere kan
fortsatt lese og kjøre koden uten begrensninger. Kommersiell gjenbruk
eller distribusjon krever skriftlig avtale med Papertek forlag AS
(post@papertek.no).

## Kompatibilitet med tidligere bidrag

Repoet har til nå hatt én aktiv bidragsyter (Papertek forlag AS) og
AI-assistanse via Claude. Det finnes ingen ekstern bidragsyter-pool som
må samtykke til relisensieringen. Eksisterende code-of-conduct og
issues-baserte tilbakemeldinger forblir gyldige; se
[CONTRIBUTING.md](CONTRIBUTING.md) for gjeldende prosess.

## Tredjeparts-avhengigheter

Tredjeparts npm-pakker referert i `package-lock.json` er fortsatt
lisensiert under sine respektive lisenser (MIT, ISC, Apache-2.0, etc.).
Relisensieringen gjelder kun Leksihjelp-koden vi selv produserer.
