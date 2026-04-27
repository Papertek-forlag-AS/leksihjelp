# Lockdown Adapter Contract -- v3.0 Vocab Seam

## Why this document exists

Leksihjelp v3.0 removed all bundled per-language vocabulary from `extension/data/` (plan 23-05). The extension now fetches vocabulary on install/update via `vocab-store.js` and caches in IndexedDB. Only `nb-baseline.json` ships in the zip.

The Papertek Lockdown webapp (`stb-lockdown.app` / `papertek.app`) is a downstream consumer that copies `extension/data/*` via `scripts/sync-leksihjelp.js`. With the bundled vocab gone, lockdown needs its own story for feeding the vocabulary seam.

## Seam contract

Lockdown must satisfy these surfaces to keep spell-check, word-prediction, and the floating widget functional.

### `window.__lexiVocab` (indexes object)

Shape is defined authoritatively in `extension/content/vocab-seam-core.js :: buildIndexes()`. The returned object includes:

| Key | Type | Purpose |
|-----|------|---------|
| `wordList` | `Array<{word, type, ...}>` | Word-prediction suggestions (feature-gated) |
| `validWords` | `Set<string>` | Spell-check known-good tokens (full superset) |
| `verbInfinitive` | `Map<string, string>` | Conjugated form -> infinitive reverse lookup |
| `nounGenus` | `Map<string, string>` | Noun form -> genus (m/f/n) |
| `compoundNouns` | `Map<string, object>` | Compound noun split data |
| `typoFix` | `Map<string, string>` | Known typo -> correction |
| `freq` | `Map<string, number>` | Zipf frequency scores |
| `sisterValidWords` | `Set<string>` | NB/NN cross-dialect known words |
| `registerWords` | `Map<string, object>` | Governance: formal/informal markers |
| `collocations` | `Array<object>` | Governance: collocation rules |
| `redundancyPhrases` | `Array<object>` | Governance: redundancy patterns |
| `bigrams` | `Map<string, number>` | Bigram frequency data |
| `pitfalls` | `object` | Language-specific pitfall entries |
| `isFeatureEnabled` | `function(id) -> bool` | Grammar feature gate predicate |

Consumers access these via getter functions on `window.__lexiVocab` (see `vocab-seam.js`).

### `vocab-store.js` exports lockdown can override or stub

| Export | Signature | Purpose |
|--------|-----------|---------|
| `getCachedBundle(lang)` | `async (lang) -> {schema_version, revision, payload} \| null` | Read from cache |
| `putCachedBundle(lang, entry)` | `async (lang, {schema_version, revision, payload}) -> void` | Write to cache |
| `fetchBundle(lang, opts)` | `async (lang, opts) -> {status, body}` | Fetch from API |
| `getCachedRevisions()` | `async () -> {lang: revision}` | All cached revision strings |

Lockdown can stub these to redirect to its own storage/fetch mechanism.

### Hydration event surface

Content scripts and the popup observe these `chrome.runtime` messages:

| Message type | Payload | When |
|-------------|---------|------|
| `lexi:hydration` | `{lang, state: 'fetching'\|'ready'\|'error', revision?, reason?}` | Bootstrap progress |
| `lexi:updates-available` | `{updates: {lang: {local, remote}}}` | Stale data detected |
| `lexi:refresh-done` | `{lang, revision}` | After manual refresh |

Lockdown's chrome shim (`leksihjelp-loader.js`) already handles `runtime.sendMessage` / `onMessage`, so these events propagate if the shim is loaded.

## Three implementation options for lockdown

Lockdown's own roadmap decides which option to implement. These are listed in order of increasing complexity.

### Option 1: Bundled vocab in lockdown's `public/` dir

Lockdown ships its own `public/leksihjelp/data/{lang}.json` files and overrides `getCachedBundle` to load them via the equivalent of `chrome.runtime.getURL`.

**Pros:** Zero new infrastructure. Simple to implement. Works offline immediately.
**Cons:** Lockdown ships the full vocabulary on every release (~40 MB uncompressed across all languages). Vocab updates require a lockdown redeploy.

### Option 2: Lockdown-implemented IndexedDB bootstrap

Lockdown's loader script implements its own `vocab-store.js` shim that fetches from the same Papertek API at boot and caches in IndexedDB on the lockdown origin.

**Pros:** Parity with the extension. Vocab stays fresh without redeployment. Small lockdown bundle.
**Cons:** Requires CORS adjustment -- lockdown's origin (`stb-lockdown.app`, `papertek.app`) must be added to the Papertek API's CORS allowlist (plan 23-01 pattern). First visit requires network.

### Option 3: Hosted lockdown-side proxy

Lockdown deploys a thin proxy that pre-fetches bundles from the Papertek API and serves them with same-origin CORS. Lockdown's vocab-store hits the proxy instead of the Papertek API directly.

**Pros:** No CORS friction. Can layer auth or rate-limiting. Lockdown controls cache invalidation policy.
**Cons:** New infrastructure to operate and monitor.

## What this milestone delivers vs defers

**Delivered (v3.0):**
- Stable seam contract: `vocab-seam-core.buildIndexes()` shape, `vocab-store.js` override surface, hydration event protocol.
- All three options are viable starting points for lockdown's roadmap.

**Deferred:**
- Actual lockdown-side implementation. Lockdown picks an option in its own roadmap.
- CORS configuration for lockdown origins (needed only for Option 2).
- Lockdown-side IndexedDB or proxy infrastructure (needed for Options 2/3).

## Coordination notes

Per `CLAUDE.md` ("Downstream consumer: Papertek Lockdown webapp"):

1. Lockdown ports leksihjelp fixes upstream before merging to its `main` branch.
2. Lockdown's `npm install` triggers `scripts/sync-leksihjelp.js` which re-syncs shared files.
3. If lockdown picks Option 2 and discovers a seam gap (e.g. missing export in `vocab-store.js`), the fix lands here in leksihjelp first, then lockdown re-syncs.
4. Bumping `package.json` version signals a downstream sync is needed.
