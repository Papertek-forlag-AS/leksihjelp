/**
 * Leksihjelp — Vocabulary Store
 *
 * Manages language pack downloads and caching via IndexedDB.
 * Languages are downloaded on demand from the Papertek Vocabulary API
 * and cached locally for offline use.
 *
 * Shared across popup, content scripts, and service worker via
 * chrome.runtime.sendMessage (content scripts can't access IndexedDB
 * on the extension's origin, so the service worker proxies for them).
 */

(function () {
  'use strict';

  const API_BASE = 'https://papertek-vocabulary.vercel.app/api/vocab';
  const DB_NAME = 'leksihjelp-vocab';
  const DB_VERSION = 1;
  const STORE_NAME = 'languages';

  // ── IndexedDB helpers ──

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'language' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbGet(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function dbPut(db, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function dbGetAll(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function dbDelete(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── Public API ──

  /**
   * Get a cached language pack from IndexedDB.
   * Returns the full data object or null if not cached.
   */
  async function getCachedLanguage(lang) {
    try {
      const db = await openDB();
      const record = await dbGet(db, lang);
      db.close();
      return record?.data || null;
    } catch {
      return null;
    }
  }

  /**
   * Get cached grammar features for a language.
   */
  async function getCachedGrammarFeatures(lang) {
    try {
      const db = await openDB();
      const record = await dbGet(db, lang);
      db.close();
      return record?.grammarFeatures || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the cached version hash for a language.
   */
  async function getCachedVersion(lang) {
    try {
      const db = await openDB();
      const record = await dbGet(db, lang);
      db.close();
      return record?.version || null;
    } catch {
      return null;
    }
  }

  /**
   * List all cached languages with their versions.
   */
  async function listCachedLanguages() {
    try {
      const db = await openDB();
      const records = await dbGetAll(db);
      db.close();
      return records.map(r => ({
        language: r.language,
        version: r.version,
        totalWords: r.data?._metadata?.totalWords || 0,
        cachedAt: r.cachedAt
      }));
    } catch {
      return [];
    }
  }

  /**
   * Download a language pack from the API and store in IndexedDB.
   * Resolves translations from linkedTo.nb into a top-level translation field.
   *
   * @param {string} lang - Language code
   * @param {function} [onProgress] - Progress callback ({ status, detail })
   * @returns {object} The language data
   */
  async function downloadLanguage(lang, onProgress) {
    onProgress?.({ status: 'downloading', detail: `Laster ned ${lang}...` });

    const res = await fetch(`${API_BASE}/v3/export/${lang}`);
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`);
    }

    const data = await res.json();

    onProgress?.({ status: 'processing', detail: 'Behandler data...' });

    // Extract grammar features
    const grammarFeatures = data._grammarFeatures || null;
    delete data._grammarFeatures;

    // Resolve translations from linkedTo.nb into top-level translation field
    const banks = Object.keys(data).filter(k => k.endsWith('bank'));
    for (const bank of banks) {
      for (const entry of Object.values(data[bank])) {
        if (!entry.translation) {
          const nbLink = entry.linkedTo?.nb || entry.linkedTo?.nn;
          if (nbLink?.translation) {
            entry.translation = nbLink.translation;
          }
        }
        // Also normalize examples from linkedTo if entry has none
        if ((!entry.examples || entry.examples.length === 0) && entry.linkedTo) {
          const link = entry.linkedTo.nb || entry.linkedTo.nn;
          if (link?.examples) {
            entry.examples = link.examples;
          }
        }
        // Normalize explanation
        if (!entry.explanation && entry.linkedTo) {
          const link = entry.linkedTo.nb || entry.linkedTo.nn;
          if (link?.explanation) {
            entry.explanation = { _description: link.explanation };
          }
        }
      }
    }

    onProgress?.({ status: 'saving', detail: 'Lagrer...' });

    // Store in IndexedDB
    const version = data._metadata?.version || null;
    const db = await openDB();
    await dbPut(db, {
      language: lang,
      version,
      data,
      grammarFeatures,
      cachedAt: new Date().toISOString()
    });
    db.close();

    onProgress?.({ status: 'done', detail: 'Ferdig!' });

    return data;
  }

  /**
   * Check if a language pack needs updating by comparing cached version
   * with the API manifest version.
   */
  async function checkForUpdate(lang) {
    try {
      const cachedVersion = await getCachedVersion(lang);
      if (!cachedVersion) return { needsUpdate: true, reason: 'not_cached' };

      // Conditional fetch - returns 304 if unchanged
      const res = await fetch(`${API_BASE}/v3/export/${lang}`, {
        method: 'HEAD',
        headers: { 'If-None-Match': `"${cachedVersion}"` }
      });

      if (res.status === 304) {
        return { needsUpdate: false };
      }

      const newEtag = res.headers.get('etag')?.replace(/"/g, '');
      return {
        needsUpdate: newEtag !== cachedVersion,
        reason: 'new_version',
        newVersion: newEtag
      };
    } catch {
      return { needsUpdate: false }; // Offline — use cache
    }
  }

  /**
   * Get language data — from cache if available, otherwise download.
   */
  async function getLanguage(lang, onProgress) {
    const cached = await getCachedLanguage(lang);
    if (cached) return cached;
    return downloadLanguage(lang, onProgress);
  }

  /**
   * Delete a cached language pack.
   */
  async function deleteLanguage(lang) {
    try {
      const db = await openDB();
      await dbDelete(db, lang);
      db.close();
    } catch {
      // Ignore
    }
  }

  // ── Expose API ──
  // In content scripts, this runs in the page context but IndexedDB
  // accesses the extension's origin when loaded as a content script.
  window.__lexiVocabStore = {
    getCachedLanguage,
    getCachedGrammarFeatures,
    getCachedVersion,
    listCachedLanguages,
    downloadLanguage,
    checkForUpdate,
    getLanguage,
    deleteLanguage,
    API_BASE
  };
})();
