# en.json Audit — 2026-04-19

**Scope:** Does `extension/data/en.json` (4.65 MB) have any runtime references in the shipped extension code or scripts? If zero, it's safe to delete to close Phase 2 SC-4 (10 MiB bundle-size cap). If any, surface findings — the plan halts per 02-CONTEXT.md's hard requirement.

**Definition of "runtime reference":** code inside `extension/` or `scripts/sync-vocab.js` that, if executed with en.json absent, would 404, crash, or silently break a user-visible feature. Data entries in other vocab files (e.g., `de.json` → `"linkedTo": { "en": {...} }`) are data, not code, and count as runtime references only if the runtime actually fetches en.json to resolve them.

---

## Step A — Hard references (file-name grep for `en.json`)

Command: `rg -n "en\.json" extension/ scripts/ backend/ 2>/dev/null`

| File | Line | Context | Classification |
|------|------|---------|----------------|
| (none) | — | `rg` returned zero hits across `extension/`, `scripts/`, `backend/` | N/A — no direct file-name references |

Note: `en.json` is never named literally in code. Loaders construct the path dynamically via `chrome.runtime.getURL(\`data/${lang}.json\`)`. That interpolation is where the runtime wiring actually lives — see Step B.

---

## Step B — Soft references (`'en'` / `"en"` as a vocab-language code)

Command: `rg -n "['\"]en['\"]" extension/manifest.json extension/popup/ extension/content/ extension/background/ scripts/sync-vocab.js`

### extension/manifest.json
- No hits. (`web_accessible_resources` uses the glob `data/*.json`, so `en.json` is matched structurally — see Step D risk note.)

### extension/popup/popup.html
| Line | Context | Classification |
|------|---------|----------------|
| 52   | `<button class="lang-pick-btn ui-lang-btn" data-ui-lang="en">` | **i18n UI language** — harmless, different namespace (`strings.js` messages), does NOT drive vocab load |
| 133  | `<button class="ui-lang-option" data-ui-lang="en">` | **i18n UI language** — same as above, harmless |
| 144  | `<button class="lang-option" data-lang="en">...lang_en">Engelsk</button>` in the **vocab `language-list`** settings UI | **HARD RUNTIME REFERENCE** — clicking this button sets `currentLang='en'` and triggers `loadDictionary('en')` which fetches `data/en.json`. Classified: `data-vocab` |

### extension/popup/popup.js
| Line | Context | Classification |
|------|---------|----------------|
| 161  | `if (!currentLang) currentLang = 'en';` — default-language fallback after first-run picker | **HARD RUNTIME REFERENCE** — immediately followed by `loadDictionary(currentLang)` on line 163, which fetches `data/en.json` via `chrome.runtime.getURL('data/' + lang + '.json')` on line 375 |
| 343  | `const BUNDLED_LANGUAGES = new Set(['nb', 'nn', 'en']);` | **HARD RUNTIME REFERENCE** — declares English as a bundled-vocab language; `loadLanguageData()` relies on this Set to decide "skip IndexedDB download, fetch from bundled data/*.json" |
| 487  | `currentLang = 'en';` in the delete-language handler — if user deletes their currently-active foreign language, the popup falls back to English | **HARD RUNTIME REFERENCE** — followed by `loadDictionary('en')` on line 489 |
| 1339 | `const VOICE_LANGS = { de: 'de', es: 'es', fr: 'fr', en: 'en', nb: 'nb', nn: 'nb', no: 'nb' };` — browser SpeechSynthesis voice map | **Harmless** — this is a `BCP-47 → BCP-47` voice-name mapping for `window.speechSynthesis`, nothing to do with the vocab file |

### extension/content/vocab-seam.js
| Line | Context | Classification |
|------|---------|----------------|
| 31   | `let currentLang = 'en';` — module-scoped default | **HARD RUNTIME REFERENCE** — initial state before `init()` reads storage |
| 41   | `const BUNDLED_LANGS = ['nb', 'nn', 'en'];` | **HARD RUNTIME REFERENCE** — gates `loadRawVocab()` on line 90: if `lang` not in this list, skip the bundled-file fetch. With `'en'` removed from the list, the popup's `currentLang='en'` default would silently fail to load vocab (return null), breaking spell-check + word-prediction + floating widget |
| 151  | `currentLang = stored.language || 'en';` — storage-default fallback in `init()` | **HARD RUNTIME REFERENCE** — then calls `loadForLanguage(currentLang)` on line 156 → `loadRawVocab('en')` on line 125 → fetches `chrome.runtime.getURL('data/en.json')` on line 92 |

### extension/content/vocab-seam-core.js
- No direct hits on `'en'` or `"en"`. Core is language-agnostic — accepts whatever `lang` the seam passes in.

### extension/content/word-prediction.js
| Line | Context | Classification |
|------|---------|----------------|
| 31   | `let currentLang = 'en';` — module default | **HARD RUNTIME REFERENCE** |
| 46   | `currentLang = stored.language || 'en';` — init fallback | **HARD RUNTIME REFERENCE** |
| 241  | `'en': 'm', 'ei': 'f', 'et': 'n',` — **NORWEGIAN ARTICLE→GENUS map (NB articles `en`/`ei`/`et`)** | **Harmless** — these are the NB indefinite-article words, not the language code. Literally the tokens the user types in Norwegian (`en bok`, `ei hytte`, `et hus`) |
| 265  | `'en': { number: 'entall', definiteness: 'ubestemt' },` — **NORWEGIAN article→grammar-feature map** | **Harmless** — same as line 241, NB article word |
| 323  | `es: new Set(['en', 'de', 'a', ...])` — Spanish preposition list | **Harmless** — Spanish preposition `en` ("in"), not a language code |
| 325  | `fr: new Set(['à', 'de', 'en', ...])` — French preposition list | **Harmless** — French preposition `en` ("in"), not a language code |
| 1166 | `const BUNDLED_PREDICTION_LANGS = ['nb', 'nn', 'en'];` — language picker inside the prediction dropdown | **HARD RUNTIME REFERENCE** — includes English as a picker option; picking it fires `LANGUAGE_CHANGED` → `loadForLanguage('en')` in vocab-seam |

### extension/content/floating-widget.js
| Line | Context | Classification |
|------|---------|----------------|
| 72   | `en: 'en',` inside `BROWSER_VOICE_LANGS` — BCP-47 voice-name map | **Harmless** — browser TTS voice map |
| 82   | `let currentLang = 'en';` — module default | **HARD RUNTIME REFERENCE** |
| 107  | `currentLang = stored.language || 'en';` — init fallback | **HARD RUNTIME REFERENCE** — followed by inline-lookup path on line 1012 which fetches `chrome.runtime.getURL('data/' + currentLang + '.json')` |
| 322  | `WIDGET_LANG_FLAGS` / `WIDGET_LANG_LABELS` have `en: 🇬🇧` / `en: 'EN'` | **HARD RUNTIME REFERENCE** — UI-side, but surfaces English as a choosable widget language |
| 324  | `const BUNDLED_WIDGET_LANGS = ['nb', 'nn', 'en'];` | **HARD RUNTIME REFERENCE** — same kind of "bundled language" gate as vocab-seam's |

### extension/content/spell-check-core.js
| Line | Context | Classification |
|------|---------|----------------|
| 34   | `nb: { 'en': 'm', 'ei': 'f', 'et': 'n' }` — NB article→genus table | **Harmless** — NB article word, not language code |
| 38   | `nb: { 'm': 'en', 'f': 'ei', 'n': 'et' }` — reverse of above | **Harmless** — NB article word |
| 53   | `'som', 'en', 'ei', 'et', ...` in the closed-class-stopwords list | **Harmless** — NB article word |
| 120  | `actual === 'f' && articleTok.word === 'en'` — gender-article agreement check (feminine nouns can take `en` in Bokmål) | **Harmless** — NB article word |
| 125  | Same as 120 | **Harmless** — NB article word |

### extension/background/service-worker.js
- Zero hits on `'en'`, `"en"`, `English`, or `Engelsk`. Service worker is vocab-language-agnostic — it routes messages and manages context menus, nothing English-specific.

### scripts/sync-vocab.js
| Line | Context | Classification |
|------|---------|----------------|
| 198  | `} else if (langCode === 'en') { ... }` — English-specific post-processing branch that resolves translations from the NB link | **HARD REFERENCE** — this branch generates en.json's translation and example fields. Removing `'en'` from the sync list means this branch never executes, which is fine; the branch itself can stay or go — dead code if `'en'` is gone from the languages array |
| 414  | `langsToSync = ['de', 'es', 'fr', 'en', 'nb', 'nn'].filter(l => availableLangs.includes(l));` — default languages to sync | **HARD REFERENCE** — running `npm run sync-vocab` today regenerates en.json. If en.json is deleted but `'en'` stays in this array, the next sync silently re-creates it and the gap re-appears |

---

## Step C — Cross-language links inside other vocab data

Probe: `rg -n '"en"\s*:' extension/data/de.json extension/data/es.json extension/data/fr.json`

| File | `"en":` entries | Risk assessment |
|------|-----------------|-----------------|
| extension/data/de.json | 3,454 | **Dormant** — every German entry has a `linkedTo.en: { primary: "some_word_verb" }` stub. The runtime consumes `linkedTo.nb` and `linkedTo.nn` (confirmed in popup.js:30–35, floating-widget.js:17–18, vocab-store.js:227–245); `linkedTo.en` is never fetched. Deleting en.json does **not** break these entries |
| extension/data/es.json | 3,379 | Same — dormant |
| extension/data/fr.json | 3,187 | Same — dormant |
| extension/data/nb.json, nn.json | (not probed in this depth — same structural pattern applies; these are Norwegian dictionaries and reference `linkedTo.de/es/fr`, not `.en`) | Dormant |

**Conclusion:** cross-language links in `linkedTo.en` are data payload with no runtime resolver. They can stay as-is. (They do add ~150 KB of whitespace across de/es/fr pre-minification but are not the bundle-size culprit — `data/en.json` itself at 4.65 MB is.)

---

## Step D — sync-vocab.js languages array

- **Lists `'en'`:** YES
- **Line 414:** `langsToSync = ['de', 'es', 'fr', 'en', 'nb', 'nn'].filter(l => availableLangs.includes(l));`
- Additional English-specific branch at line 198 handles translation/example resolution when `langCode === 'en'`.

**Implication:** Even if en.json is deleted from the tree, the next `npm run sync-vocab` (default invocation, no args) regenerates it unless `'en'` is also removed from the array. The dead-code cleanup list **must** include line 414.

---

## Step E — Service-worker English references

Command: `rg "'en'|\"en\"|English|Engelsk" extension/background/service-worker.js`

- **Zero hits.**
- The service worker does NOT name English in context menus, default-language constants, or any fallback path. It's fully vocab-language-agnostic.

---

## Step F — `web_accessible_resources` manifest globbing

`extension/manifest.json` line 51:
```json
"resources": ["data/*.json", "assets/*", "audio/*/*.mp3"]
```

The glob `data/*.json` matches `en.json` structurally. Deleting en.json does **not** break this line (the glob quietly doesn't match anything that isn't there). Leave as-is — no manifest edit needed for the file deletion itself.

---

## Step F.2 — Package-staging sanity check

```
rg -n "en\.json" .package-staging/ 2>/dev/null
```

Directory does not exist (`.package-staging/` is cleaned between runs). Nothing to audit. The current shipped zip (`backend/public/lexi-extension.zip`) DOES contain `data/en.json` at **2,816,238 bytes** compressed and `data/grammarfeatures-en.json` at 5,068 bytes, confirmed via `unzip -l`.

---

## Verdict

- **☐ CLEAN — zero runtime refs, safe to delete en.json**
- **☒ BLOCKED — runtime refs found, DO NOT delete**

### Evidence for BLOCKED

English is a **first-class bundled vocabulary language** with deep runtime integration across every shipped surface. Silently deleting `extension/data/en.json` would cause user-visible failures in at least four independent code paths:

1. **Popup first-run fallback (popup.js:161, 343, 487):** If a user skips the first-run picker (documented UX path at `initFirstRunPicker` with a `lang-pick-skip` button on popup.html:79), `currentLang` defaults to `'en'`, which immediately triggers `loadDictionary('en')` → `fetch('data/en.json')` → **404**. `loadLanguageData()` at popup.js:357 specifically uses `BUNDLED_LANGUAGES.has('en')` to skip the IndexedDB-download path, so there's no fallback — the popup just fails to render vocab.
2. **Popup language-delete fallback (popup.js:487):** If a paying user deletes their currently-active foreign language (e.g. `de.json` via the settings UI at popup.html:141), the handler fallback to `currentLang = 'en'` → `loadDictionary('en')` → **404**. User is left with an empty dictionary and no escape hatch until they re-download.
3. **Settings UI vocab language picker (popup.html:144):** The settings-page vocab language list explicitly offers `🇬🇧 Engelsk` as a vocabulary language (distinct from the UI `data-ui-lang` picker at line 133). Clicking it sets `chrome.storage.local.language = 'en'`, which then drives the vocab-seam's `loadForLanguage('en')` on every content script in all subsequent page loads → **sustained 404**.
4. **Content-script init defaults (vocab-seam.js:151, word-prediction.js:46, floating-widget.js:107):** Every content script initializes `currentLang = stored.language || 'en'`. If the user has never touched storage (fresh install, skipped picker), or has storage cleared, every content script boots with `currentLang = 'en'` and fails to load vocab. Spell-check, word-prediction, and the floating widget all silently stop working.

Additionally, `scripts/sync-vocab.js:414` would regenerate `en.json` on the next default `npm run sync-vocab` invocation, re-inflating the bundle even if the file were deleted once.

### This is NOT the expected outcome per 02-CONTEXT.md

CONTEXT.md section "Remediation Path (LOCKED)" says:

> "If the audit finds en.json IS referenced somewhere, STOP and surface the finding — do not silently remove a file in active use. A checkpoint / re-plan is the correct move."

This is that stop. The audit has surfaced the findings. Task 2's checkpoint hands the decision back to the user.

### What a CLEAN path would have required (for the record)

To safely delete en.json, the project would need to **first** remove English as a bundled vocabulary language end-to-end:

1. Remove `'en'` from `BUNDLED_LANGUAGES`, `BUNDLED_LANGS`, `BUNDLED_PREDICTION_LANGS`, `BUNDLED_WIDGET_LANGS` across popup.js, vocab-seam.js, word-prediction.js, floating-widget.js (5 call sites).
2. Change every `stored.language || 'en'` default to a sensible alternative — most natural is `'nb'` (Norwegian Bokmål is always bundled). Five call sites across the same four files.
3. Remove `data-lang="en"` button from popup.html:144 (settings vocab list) and strip English from `WIDGET_LANG_FLAGS`/`LABELS` at floating-widget.js:322, word-prediction.js:1165.
4. Remove `'en'` from `scripts/sync-vocab.js:414` (and optionally remove the `langCode === 'en'` branch at line 198).
5. Delete `extension/data/en.json` AND `extension/data/grammarfeatures-en.json` (the latter is referenced implicitly via `data/grammarfeatures-${lang}.json` in popup.js:736 — if any code path ever runs with `lang='en'`, it 404s on the grammar feature load).
6. Accept the UX consequence: users who previously used English-to-Norwegian lookup (a real CLAUDE.md-listed-as-unsupported-but-still-shipped capability in v1.2.x) lose that feature. There is no workaround — English is no longer in the extension.

This is a **product decision**, not a mechanical cleanup. Phase 2 plan 05 as currently written (audit-and-delete) is not the right shape for it.

### Recommended next steps (not this plan's responsibility)

The user has three paths:

1. **Accept the product change: remove English support entirely.** Create a new gap-closure plan (02-06 or similar) that does the 6-step CLEAN-path sequence above, plus user-facing release notes. Bundle drops from 10.11 MiB to ~5.5 MiB with headroom. This is the cleanest version of what 02-05 was trying to achieve but requires explicit scope expansion.
2. **Keep English, target a different file.** Pick a different remediation from 02-04 SUMMARY's Blockers list — most viable is stripping `audio/de/*.mp3` (7.67 MiB uncompressed, big overhead on compressed zip) and fetching German TTS samples on first play. That's Phase 2.1 / a new `/gsd:add-phase` conversation; not covered by 02-05.
3. **Bump the ceiling.** 10 MiB → 12 MiB is possible; costs the landing-page promise and the structural forcing function. Last resort per 02-CONTEXT.md.

---

## If CLEAN, dead-code paths to also clean up

Not applicable — verdict is BLOCKED, no cleanup performed.

(For completeness, if the user picks path 1 above and a follow-up plan is written, the dead-code list is enumerated in the "What a CLEAN path would have required" section above.)
