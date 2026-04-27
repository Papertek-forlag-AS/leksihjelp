/**
 * Leksihjelp — Service-Worker Vocab Bootstrap (Phase 23-03)
 *
 * Auto-downloads the user's selected target language(s) into IndexedDB on
 * extension install/update so the cache adapter (vocab-store.js) finds a hit
 * the first time content scripts hydrate. Without this, plan 23-05's removal
 * of bundled de/es/fr/en would break first-run UX.
 *
 * Loaded by service-worker.js via `importScripts('vocab-bootstrap.js')`.
 *
 * Depends on `self.__lexiVocabStore` being present — service-worker.js must
 * importScripts('/content/vocab-store.js') BEFORE this file. The vocab-store
 * IIFE exposes the v1 cache adapter on `self.__lexiVocabStore` regardless of
 * environment (window / self / globalThis fallback in its host detection).
 *
 * Public surface (attached to `self.__lexiVocabBootstrap`):
 *   downloadIfMissing(lang)  — fetch + cache `lang` only if not present
 *   bootstrapAll(langs)      — sequential downloads with per-lang 30s timeout
 *
 * Hydration events are mirrored via chrome.runtime.sendMessage so the popup
 * (running in popup.html, separate context) can render per-language pills.
 * Wraps every send in try/catch — no popup listener is fine.
 *
 * Network-silence (SC-06): vocab-bootstrap.js lives in extension/background/,
 * not in the spell-check/word-prediction hot path. The check-network-silence
 * gate scans content/spell-check*.js, content/spell-rules/**, and
 * content/word-prediction.js; this file is intentionally outside that set.
 * The single network funnel `fetchBundle` (in vocab-store.js) is the
 * sanctioned carve-out plan 23-06 documents.
 */

'use strict';

(function () {
  const PER_LANG_TIMEOUT_MS = 30_000;

  function getStore() {
    return self.__lexiVocabStore || null;
  }

  function emit(lang, state, extra) {
    const msg = Object.assign({ type: 'lexi:hydration', lang, state }, extra || {});
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg, () => {
          // Swallow "Receiving end does not exist" — popup may be closed.
          void chrome.runtime.lastError;
        });
      }
    } catch (_) { /* fine */ }
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms);
      promise.then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }

  /**
   * Download + cache `lang` only if there's no cached bundle yet.
   * Idempotent: if the cache already has `lang`, this is a no-op (no event,
   * no network).
   *
   * Resolves with one of: 'cached' | 'fetched' | 'error' | 'no-store'.
   */
  async function downloadIfMissing(lang) {
    const store = getStore();
    if (!store) {
      console.warn('[lexi-bootstrap] vocab-store not loaded — skipping ' + lang);
      return 'no-store';
    }
    let existing = null;
    try { existing = await store.getCachedBundle(lang); } catch (_) { existing = null; }
    if (existing && existing.payload) {
      // Already in cache — no event, content scripts will read the cached
      // bundle on their next hydration cycle.
      return 'cached';
    }

    emit(lang, 'fetching');
    let result;
    try {
      result = await withTimeout(store.fetchBundle(lang, {}), PER_LANG_TIMEOUT_MS, 'fetchBundle ' + lang);
    } catch (err) {
      console.warn('[lexi-bootstrap] fetch ' + lang + ' failed:', err && err.message);
      emit(lang, 'error', { reason: 'timeout-or-network' });
      return 'error';
    }

    if (result.status === 200 && result.body) {
      const body = result.body;
      try {
        await store.putCachedBundle(lang, {
          schema_version: body.schema_version,
          revision: body.revision,
          payload: body,
        });
      } catch (err) {
        console.warn('[lexi-bootstrap] putCachedBundle ' + lang + ' failed:', err && err.message);
        emit(lang, 'error', { reason: 'cache-write' });
        return 'error';
      }
      emit(lang, 'ready', { revision: body.revision });
      return 'fetched';
    }

    if (result.status === 'schema-mismatch') {
      // vocab-store has already emitted lexi:schema-mismatch. We surface a
      // hydration error so the popup pill goes red; baseline NB stays serving.
      emit(lang, 'error', { reason: 'schema-mismatch' });
      return 'error';
    }

    emit(lang, 'error', { reason: 'fetch-' + result.status });
    return 'error';
  }

  /**
   * Sequential bootstrap of multiple languages. Sequential (not parallel)
   * to avoid hammering the API on a fresh install with 3+ targets.
   */
  async function bootstrapAll(langs) {
    if (!Array.isArray(langs)) return [];
    const results = [];
    for (const lang of langs) {
      if (!lang || typeof lang !== 'string') continue;
      const outcome = await downloadIfMissing(lang);
      results.push({ lang, outcome });
    }
    return results;
  }

  self.__lexiVocabBootstrap = {
    downloadIfMissing,
    bootstrapAll,
  };
})();
