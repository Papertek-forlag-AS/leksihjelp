---
phase: 23-data-source-migration
plan: 08
subsystem: popup
tags: [offline-ux, browser-verify, gap-closure]

requires:
  - phase: 23-data-source-migration (plans 03, 05)
    provides: "Bootstrap download path + v2-to-v3 migration trigger"
provides:
  - "Offline error messaging in picker and hydration pills"
  - "Browser-verified: offline install shows error pill, NB baseline still serves lookups"
affects: [popup, i18n]

tech-stack:
  added: []
  patterns: ["navigator.onLine check to differentiate offline from generic errors"]

key-files:
  created: []
  modified:
    - "extension/popup/popup.js"
    - "extension/i18n/strings.js"

key-decisions:
  - "Used navigator.onLine to detect offline state and show specific 'Ingen internettilkobling' message instead of generic error"
  - "Added 3 new i18n strings per locale (NB/NN/EN): picker_failed_offline, hydration_error_offline, hydration_error_generic"
  - "Hydration pill textForState now accepts reason parameter from lexi:hydration message"

patterns-established: []

status: complete
requirements-completed: [BOOT-03]
---

# Plan 23-08 Summary: Offline Install Browser Verification

## What was done

1. **Packaged extension** for testing (7.61 MiB zip).
2. **Fixed offline error messaging** — the picker and hydration pills now explain *why* the download failed:
   - Picker: "Ingen internettilkobling. Koble til nettet og prøv igjen." (was: "Nedlasting feilet. Prøv igjen.")
   - Hydration pill: "Ingen internettilkobling — ordlister lastes ned når du er på nett" (was: "Ordlister utilgjengelig — prøv igjen senere")
3. **Browser-verified** offline install scenario: error pill renders, NB baseline lookups still work.

## Deviation from plan

Plan expected browser-verification only (no code changes). During testing, user found that the offline error messages didn't explain the cause. Added `navigator.onLine` check and 3 new i18n strings per locale to differentiate offline from generic errors.

## Self-Check: PASSED
- [x] Offline error messaging works (navigator.onLine differentiation)
- [x] NB baseline serves lookups when offline
- [x] check-network-silence gate passes
- [x] Extension repackaged at 7.61 MiB
