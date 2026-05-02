/**
 * Leksihjelp — Vocabulary Store (v1 cache adapter)
 *
 * Cache adapter for the Papertek v1 endpoints
 * (`papertek-vocabulary.vercel.app/api/vocab/v1/*`).
 *
 * Per-language entries persist in IndexedDB as
 * `{schema_version, revision, fetched_at, payload}`. Plan 23-02 establishes
 * the contract; plans 23-03/04/05 build update detection, migration, and
 * service-worker bootstrap on top.
 *
 * The adapter ALSO retains the legacy audio-cache helpers (downloadAudioPack,
 * getAudioFile, hasAudioCached) and the chrome.runtime proxy surface used by
 * service-worker.js (VOCAB_GET_CACHED / VOCAB_GET_GRAMMAR / VOCAB_LIST_CACHED).
 * Those are out of scope for plan 23-02 — left untouched by design.
 *
 * Network: ALL vocab fetch traffic must funnel through `fetchBundle` so
 * plan 06's SC-06 carve-out targets one symbol.
 *
 * Sandbox shape (Node tests vs browser):
 *   - In a test sandbox (vm.runInContext), expose api on `globalThis` (which
 *     === `window` in the sandbox), then `__lexiVocabStore` is reachable.
 *   - In the browser, `window` is the same surface.
 */

(function () {
  'use strict';

  // ── Constants ──
  const API_BASE = 'https://papertek-vocabulary.vercel.app/api/vocab/v1';
  // V3 endpoints (manifest, etc.) live at /api/vocab/, not /api/vocab/v1/.
  // Exposed separately so callers don't hand-roll string surgery to drop /v1.
  const V3_API_BASE = 'https://papertek-vocabulary.vercel.app/api/vocab';
  const SITE_BASE = 'https://papertek-vocabulary.vercel.app';
  const SUPPORTED_SCHEMA_VERSION = 1;

  // Papertek vocab API key (intentionally semi-public).
  //
  // Why this is committed in plaintext:
  //   The leksihjelp extension is a public Chrome Web Store artifact. Anyone
  //   who downloads the .crx can extract every constant inside it within
  //   minutes. Hiding a bundled key would be security theater. The Papertek
  //   operator issued this `lk_` (internal-tier) key with that reality in
  //   mind: rate-limiting at the API tier protects the surface, not key
  //   secrecy. If abuse occurs, the operator rotates the key (marks the old
  //   one inactive, issues a new one); we ship a patch release; users update.
  //
  // See SECURITY.md for the full rotation procedure.
  // Do NOT replace this with `ck_` / other tier keys — those are not for
  // public-extension use.
  const API_KEY = 'lk_fb6208e2568958c8e245293587e3705317e23526ab2ab7b1eeb5b4e2678e074c';

  const DB_NAME = 'lexi-vocab';        // renamed from legacy 'leksihjelp-vocab'
  const DB_VERSION = 3;                // bump invalidates the v2 stores
  const STORE_BUNDLES = 'bundles';     // v1 store; keyPath: 'lang'
  const STORE_AUDIO = 'audio';         // unchanged: key '{lang}/{filename}', value Blob

  // Legacy stores deleted on upgrade (kept here as a list so we delete
  // ALL prior shapes on a fresh upgrade, even from very old installs).
  const LEGACY_STORES = ['languages'];

  // ── IndexedDB queue + open ──
  // Public methods are safe to call before openDB() resolves. We queue work
  // until the DB handle exists, then drain. After that, the cached promise
  // serves all subsequent calls.
  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        // Drop legacy v3-prefixed / v2-shaped stores so a stale install
        // doesn't keep stale entries around. v1 cache writes only to
        // STORE_BUNDLES; STORE_AUDIO is a separate concern.
        for (const name of LEGACY_STORES) {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
          }
        }
        if (!db.objectStoreNames.contains(STORE_BUNDLES)) {
          db.createObjectStore(STORE_BUNDLES, { keyPath: 'lang' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function txDo(storeName, mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try {
        const r = fn(store);
        if (r && typeof r === 'object' && 'onsuccess' in r) {
          r.onsuccess = () => { result = r.result; };
          r.onerror = () => reject(r.error);
        } else {
          result = r;
        }
      } catch (e) {
        reject(e);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  // ── v1 cache adapter (the plan-23-02 surface) ──

  /**
   * Read a cached bundle entry from IndexedDB.
   * @returns {null | {schema_version: number, revision: string, fetched_at: string, payload: object}}
   */
  async function getCachedBundle(lang) {
    try {
      const record = await txDo(STORE_BUNDLES, 'readonly', store => store.get(lang));
      if (!record) return null;
      return {
        schema_version: record.schema_version,
        revision: record.revision,
        fetched_at: record.fetched_at,
        payload: record.payload,
      };
    } catch (e) {
      console.warn('Leksihjelp: getCachedBundle failed', e);
      return null;
    }
  }

  /**
   * Write a bundle entry. `fetched_at` is auto-stamped to now.
   */
  async function putCachedBundle(lang, { schema_version, revision, payload }) {
    const record = {
      lang,
      schema_version,
      revision,
      fetched_at: new Date().toISOString(),
      payload,
    };
    return txDo(STORE_BUNDLES, 'readwrite', store => store.put(record));
  }

  /**
   * Walk the bundles store and return a {lang: revision} map.
   * Used by plan 23-04 update detection to build the If-None-Match request.
   */
  async function getCachedRevisions() {
    try {
      const records = await txDo(STORE_BUNDLES, 'readonly', store => store.getAll());
      const out = {};
      for (const r of records || []) {
        if (r && r.lang && r.revision) out[r.lang] = r.revision;
      }
      return out;
    } catch (e) {
      console.warn('Leksihjelp: getCachedRevisions failed', e);
      return {};
    }
  }

  /**
   * Network fetch for a language bundle. The ONLY vocab fetch site in the
   * extension — SC-06 carve-out targets this symbol.
   *
   * @param {string} lang
   * @param {{ifNoneMatch?: string}} [opts]
   * @returns {Promise<
   *   | {status: 200, body: object}
   *   | {status: 304}
   *   | {status: 'schema-mismatch', cachedSchema: number, serverSchema: number}
   *   | {status: 'error', error: Error}
   * >}
   */
  async function fetchBundle(lang, opts) {
    const url = `${API_BASE}/bundle/${lang}`;
    const headers = { 'X-API-Key': API_KEY };
    if (opts && opts.ifNoneMatch) {
      headers['If-None-Match'] = opts.ifNoneMatch;
    }
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (error) {
      return { status: 'error', error };
    }
    if (res.status === 304) {
      return { status: 304 };
    }
    if (!res.ok) {
      return { status: 'error', error: new Error(`HTTP ${res.status}`) };
    }
    let body;
    try {
      body = await res.json();
    } catch (error) {
      return { status: 'error', error };
    }
    const serverSchema = body && typeof body.schema_version === 'number'
      ? body.schema_version
      : null;
    if (serverSchema !== SUPPORTED_SCHEMA_VERSION) {
      // Surface diagnostic — popup ("Developer view", plan 04/05) listens.
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'lexi:schema-mismatch',
            lang,
            cachedSchema: SUPPORTED_SCHEMA_VERSION,
            serverSchema,
          });
        }
      } catch (_) { /* no receiver — fine */ }
      return {
        status: 'schema-mismatch',
        cachedSchema: SUPPORTED_SCHEMA_VERSION,
        serverSchema,
      };
    }
    return { status: 200, body };
  }

  // ── Legacy proxy surface (kept for service-worker.js compatibility) ──
  // Content scripts call these via chrome.runtime.sendMessage; the service
  // worker handler reads from IndexedDB on the extension origin and replies.
  // Plan 23-05 will replace this with a direct service-worker bootstrap.

  const _isExtensionOrigin = (typeof location !== 'undefined' && location.protocol === 'chrome-extension:');
  const _proxyCache = new Map();

  // Invalidate cached proxy responses when a language finishes hydrating
  // so newly-downloaded bundles surface to long-lived pages (the Aa-button
  // language flyout, lockdown shim consumers, etc.) without a page reload.
  // The vocab-seam emits state='ready' via chrome.runtime.sendMessage when
  // a target bundle is cached and live in __lexiVocab.
  if (!_isExtensionOrigin) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
          if (!msg || msg.type !== 'lexi:hydration') return;
          if (msg.state === 'ready' || msg.state === 'baseline') {
            _proxyCache.delete('list');
            if (msg.lang) {
              _proxyCache.delete(`lang:${msg.lang}`);
              _proxyCache.delete(`grammar:${msg.lang}`);
            }
          }
        });
      }
    } catch (_) { /* no chrome.runtime — non-extension test sandbox */ }
  }

  function _sendMessageAsync(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) { resolve(null); return; }
          resolve(response ?? null);
        });
      } catch (_) { resolve(null); }
    });
  }

  /**
   * Legacy: read the v2-shaped `data` payload (banks at top level).
   * v1 entries store the same shape under `payload`, so this maps onto
   * `getCachedBundle(lang).payload` for in-process reads, and falls back to
   * the service-worker proxy when called from a content script on a non-
   * extension origin (lockdown / web pages running the shim).
   */
  function _ensureMetadata(payload) {
    if (!payload || payload._metadata || !payload.language) return payload;
    payload._metadata = {
      language: payload.language,
      languageName: payload.languageName || payload.language,
    };
    return payload;
  }

  async function getCachedLanguage(lang) {
    if (!_isExtensionOrigin) {
      const cacheKey = `lang:${lang}`;
      if (_proxyCache.has(cacheKey)) return _ensureMetadata(_proxyCache.get(cacheKey));
      const data = await _sendMessageAsync({ type: 'VOCAB_GET_CACHED', language: lang });
      if (data) _proxyCache.set(cacheKey, data);
      return _ensureMetadata(data);
    }
    const entry = await getCachedBundle(lang);
    return _ensureMetadata(entry ? entry.payload : null);
  }

  async function getCachedGrammarFeatures(lang) {
    if (!_isExtensionOrigin) {
      const cacheKey = `grammar:${lang}`;
      if (_proxyCache.has(cacheKey)) return _proxyCache.get(cacheKey);
      const data = await _sendMessageAsync({ type: 'VOCAB_GET_GRAMMAR', language: lang });
      if (data) _proxyCache.set(cacheKey, data);
      return data;
    }
    const entry = await getCachedBundle(lang);
    return entry?.payload?.grammarFeatures || null;
  }

  async function listCachedLanguages() {
    if (!_isExtensionOrigin) {
      const cacheKey = 'list';
      if (_proxyCache.has(cacheKey)) return _proxyCache.get(cacheKey);
      const data = await _sendMessageAsync({ type: 'VOCAB_LIST_CACHED' });
      const result = data || [];
      if (result.length > 0) _proxyCache.set(cacheKey, result);
      return result;
    }
    try {
      const records = await txDo(STORE_BUNDLES, 'readonly', store => store.getAll());
      return (records || []).map(r => ({
        language: r.lang,
        version: r.revision,
        cachedAt: r.fetched_at,
      }));
    } catch (e) {
      console.warn('Leksihjelp: listCachedLanguages failed', e);
      return [];
    }
  }

  async function deleteLanguage(lang) {
    try {
      await txDo(STORE_BUNDLES, 'readwrite', store => store.delete(lang));
      // Also clear audio for that lang.
      const db = await openDB();
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const cursorReq = store.openCursor();
      await new Promise((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) { resolve(); return; }
          if (typeof cursor.key === 'string' && cursor.key.startsWith(`${lang}/`)) {
            cursor.delete();
          }
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    } catch (e) {
      console.warn('Leksihjelp: deleteLanguage failed', e);
    }
  }

  // ── Audio cache helpers (untouched from legacy implementation) ──

  async function hasAudioCached(lang) {
    try {
      const entry = await getCachedBundle(lang);
      return !!(entry && entry.payload && entry.payload._audioVersion);
    } catch (e) {
      return false;
    }
  }

  async function getAudioFile(lang, filename) {
    try {
      const key = `${lang}/${filename}`;
      const blob = await txDo(STORE_AUDIO, 'readonly', store => store.get(key));
      return blob || null;
    } catch (e) {
      console.warn('Leksihjelp: getAudioFile failed', e);
      return null;
    }
  }

  // Audio pack download is currently dormant (plan 23-05 will retire or
  // re-enable it). We keep the function reference so manifest loaders that
  // reference window.__lexiVocabStore.downloadAudioPack don't TypeError.
  async function downloadAudioPack(/* lang, zipUrl, onProgress */) {
    console.warn('Leksihjelp: downloadAudioPack is not wired in v1 cache; deferred to plan 23-05');
    return 0;
  }

  // Legacy proxy: popup.js picker + welcome flow call this to fetch + cache a
  // language bundle synchronously-relative-to-await. In v1 the real download
  // path is fetchBundle → putCachedBundle. onProgress is preserved as a noop
  // surface (v1 fetch is single-shot; no chunked progress yet).
  async function downloadLanguage(lang, onProgress) {
    if (typeof onProgress === 'function') {
      try { onProgress({ phase: 'fetching', lang }); } catch (e) {}
    }
    const result = await fetchBundle(lang);
    if (result.status === 304) {
      const cached = await getCachedBundle(lang);
      if (typeof onProgress === 'function') {
        try { onProgress({ phase: 'ready', lang, fromCache: true }); } catch (e) {}
      }
      return _ensureMetadata(cached ? cached.payload : null);
    }
    if (result.status !== 200) {
      throw result.error || new Error(`downloadLanguage failed for ${lang}`);
    }
    await putCachedBundle(lang, {
      schema_version: result.body.schema_version,
      revision: result.body.revision,
      payload: result.body,
    });
    if (typeof onProgress === 'function') {
      try { onProgress({ phase: 'ready', lang, fromCache: false }); } catch (e) {}
    }
    return _ensureMetadata(result.body);
  }

  // Legacy proxy: popup.js cache-version checks (e.g. "is the audio pack from
  // the same revision as the bundle?"). v1 uses revision strings instead of
  // numeric versions; callers compare for equality so the string is fine.
  async function getCachedVersion(lang) {
    const entry = await getCachedBundle(lang);
    return entry ? entry.revision : null;
  }

  // ── Expose API ──
  const api = {
    // v1 cache adapter (plan 23-02 surface)
    SUPPORTED_SCHEMA_VERSION,
    API_BASE,
    V3_API_BASE,
    SITE_BASE,
    API_KEY,
    getCachedBundle,
    putCachedBundle,
    getCachedRevisions,
    fetchBundle,
    // Legacy / proxy surface (preserved for service-worker.js + content scripts)
    getCachedLanguage,
    getCachedGrammarFeatures,
    listCachedLanguages,
    deleteLanguage,
    hasAudioCached,
    getAudioFile,
    downloadAudioPack,
    downloadLanguage,
    getCachedVersion,
  };

  // Browser: window.__lexiVocabStore. In Node test sandboxes the script is
  // run with `window === globalThis === sandbox.window`, so this assignment
  // is observable to the test harness too.
  const host = (typeof window !== 'undefined' ? window
              : typeof self !== 'undefined' ? self
              : globalThis);
  host.__lexiVocabStore = api;
})();
