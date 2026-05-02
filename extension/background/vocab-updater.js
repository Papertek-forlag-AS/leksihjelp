/**
 * Leksihjelp — Vocabulary Updater (plan 23-04)
 *
 * Detects when the Papertek API has newer revisions than the local
 * IndexedDB cache, surfaces a non-blocking notice via runtime messages,
 * and lets the user trigger an atomic refresh.
 *
 * Surface (exposed on self.__lexiVocabUpdater):
 *   - checkForUpdates() → {lang: 'fresh' | 'stale'}    (langs not in cache → omitted; bootstrap handles them)
 *   - refreshLanguage(lang) → fetches new bundle, atomic putCachedBundle, emits 'lexi:refresh-done'
 *   - refreshAll(langs) → sequential refreshLanguage with per-lang error isolation
 *
 * Runtime messages emitted (chrome.runtime.sendMessage):
 *   - {type:'lexi:updates-available', langs:[...stale]}
 *   - {type:'lexi:refresh-done', lang}
 *   - {type:'lexi:hydration', lang, state:'error'}     (on schema-mismatch / network error)
 *
 * Atomic replacement:
 *   The IndexedDB transaction in `putCachedBundle` is the atomic boundary —
 *   the entry is replaced in one transaction and readers either see the old
 *   or new payload, never partial. Active content scripts that already
 *   captured an in-memory indexes object continue using it until the next
 *   page navigation re-reads the cache (or until plan 23-02's `swapIndexes`
 *   is invoked separately). That's the "activate on next page load"
 *   semantics the plan requires.
 *
 * SC-06 carve-out: this file lives in extension/background/, NOT under the
 * spell-check / word-prediction / spell-rules scan target list, so the
 * `fetch(${API_BASE}/revisions)` call is a sanctioned bootstrap-path fetch.
 * Plan 23-06's check-network-silence script confirms this directory is not
 * scanned.
 */

(function () {
  'use strict';

  const REVISIONS_TIMEOUT_MS = 30_000;

  function getStore() {
    const host = (typeof self !== 'undefined' ? self
                : typeof globalThis !== 'undefined' ? globalThis
                : {});
    return host.__lexiVocabStore || null;
  }

  function emit(msg) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg, () => {
          // Swallow lastError when no receiver is registered (popup closed).
          if (chrome.runtime.lastError) { /* no-op */ }
        });
      }
    } catch (_) { /* no receiver — fine */ }
  }

  async function fetchRevisionsWithTimeout() {
    const store = getStore();
    if (!store) throw new Error('vocab-store not available');
    const url = `${store.API_BASE}/revisions`;
    const headers = store.API_KEY ? { 'X-API-Key': store.API_KEY } : {};

    // AbortController-based timeout so the call cannot hang the service
    // worker indefinitely. fetch ignores the timeout silently if signal is
    // not supported (older Node).
    let timeoutId;
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const fetchOpts = ctrl ? { headers, signal: ctrl.signal } : { headers };
    if (ctrl) {
      timeoutId = setTimeout(() => ctrl.abort(), REVISIONS_TIMEOUT_MS);
    }
    try {
      const res = await fetch(url, fetchOpts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Compare server revisions against local cache.
   *
   * @returns {Promise<{[lang: string]: 'fresh' | 'stale'}>} — only languages
   *   present in the local cache are returned. Languages with no cache entry
   *   are NOT included (status 'missing' is implicit by absence); plan 23-03
   *   bootstrap is responsible for downloading them. We do NOT emit an
   *   updates-available notice for missing langs.
   */
  async function checkForUpdates() {
    const store = getStore();
    if (!store) return {};
    let serverPayload;
    try {
      serverPayload = await fetchRevisionsWithTimeout();
    } catch (e) {
      // Offline / abort — no notice; just return empty. Next startup will retry.
      console.warn('Leksihjelp: checkForUpdates fetch failed', e && e.message);
      return {};
    }
    const serverRevisions = (serverPayload && serverPayload.revisions) || {};

    let cachedRevisions = {};
    try {
      cachedRevisions = await store.getCachedRevisions();
    } catch (e) {
      console.warn('Leksihjelp: getCachedRevisions failed', e && e.message);
    }

    const result = {};
    const stale = [];
    for (const lang of Object.keys(cachedRevisions)) {
      const localRev = cachedRevisions[lang];
      const serverRev = serverRevisions[lang];
      if (!serverRev) continue; // server doesn't know this lang — leave alone
      if (localRev === serverRev) {
        result[lang] = 'fresh';
      } else {
        result[lang] = 'stale';
        stale.push(lang);
      }
    }
    if (stale.length > 0) {
      emit({ type: 'lexi:updates-available', langs: stale });
    }
    return result;
  }

  /**
   * Fetch a fresh bundle for `lang` and atomically write it to the cache.
   * Emits `lexi:refresh-done` on success, or `lexi:hydration` state='error'
   * on schema-mismatch / network error (cache left untouched).
   */
  async function refreshLanguage(lang) {
    const store = getStore();
    if (!store) {
      emit({ type: 'lexi:hydration', lang, state: 'error' });
      return;
    }
    let result;
    try {
      // Deliberately no If-None-Match — we want the new bundle, not 304.
      result = await store.fetchBundle(lang);
    } catch (e) {
      console.warn('Leksihjelp: refreshLanguage fetch failed for', lang, e && e.message);
      emit({ type: 'lexi:hydration', lang, state: 'error' });
      return;
    }

    if (result.status === 200 && result.body) {
      const body = result.body;
      const schema_version = body.schema_version;
      const revision = body.revision;
      // Strip the metadata fields out of the persisted payload mirror —
      // matches plan 23-02's record shape: payload is the bank-tree.
      const payload = body;
      try {
        await store.putCachedBundle(lang, { schema_version, revision, payload });
        emit({ type: 'lexi:refresh-done', lang });
      } catch (e) {
        console.warn('Leksihjelp: putCachedBundle failed for', lang, e && e.message);
        emit({ type: 'lexi:hydration', lang, state: 'error' });
      }
      return;
    }

    if (result.status === 'schema-mismatch') {
      // Cache deliberately left untouched (plan 23-02 contract).
      emit({ type: 'lexi:hydration', lang, state: 'error' });
      return;
    }

    // 304 (no body to apply) or generic error — no cache mutation.
    emit({ type: 'lexi:hydration', lang, state: 'error' });
  }

  /**
   * Sequential refreshLanguage over the supplied langs. Per-lang failure is
   * caught so a single bad bundle doesn't block the rest.
   */
  async function refreshAll(langs) {
    if (!Array.isArray(langs)) return;
    for (const lang of langs) {
      try {
        await refreshLanguage(lang);
      } catch (e) {
        console.warn('Leksihjelp: refreshLanguage threw for', lang, e && e.message);
      }
    }
  }

  // ── Expose API ──
  const api = { checkForUpdates, refreshLanguage, refreshAll };
  const host = (typeof self !== 'undefined' ? self
              : typeof globalThis !== 'undefined' ? globalThis
              : {});
  host.__lexiVocabUpdater = api;
})();
