# Publiser v2.0.0 som GitHub Release

Landingssiden (leksihjelp.no) viser **Versjon 2.0.0**, men siste GitHub Release er **v1.5.1**.
Zip-lenken på nettsiden peker til `/releases/latest/download/lexi-extension.zip`, som betyr at besøkende laster ned en utdatert versjon.

## Steg for å fikse

1. **Bygg zip-filen:**
   ```bash
   npm run package
   ```

2. **Opprett en ny GitHub Release:**
   - Tag: `v2.0.0`
   - Tittel: `v2.0.0`
   - Last opp `lexi-extension.zip` som asset

   Eller via CLI:
   ```bash
   gh release create v2.0.0 lexi-extension.zip --title "v2.0.0" --notes "Oppdatert til versjon 2.0.0"
   ```

3. **Verifiser** at lenken fungerer:
   ```
   https://github.com/Papertek-forlag-AS/leksihjelp/releases/latest/download/lexi-extension.zip
   ```

Når dette er gjort vil nedlastingslenken på leksihjelp.no automatisk peke til riktig versjon.
