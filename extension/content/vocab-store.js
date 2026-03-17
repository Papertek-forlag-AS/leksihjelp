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
  const SITE_BASE = 'https://papertek-vocabulary.vercel.app';
  const DB_NAME = 'leksihjelp-vocab';
  const DB_VERSION = 2;
  const STORE_LANGUAGES = 'languages';
  const STORE_AUDIO = 'audio'; // key: "{lang}/{filename}", value: Blob

  // ── IndexedDB helpers ──

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_LANGUAGES)) {
          db.createObjectStore(STORE_LANGUAGES, { keyPath: 'language' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbGet(db, key, store = STORE_LANGUAGES) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function dbPut(db, record, store = STORE_LANGUAGES) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function dbPutKV(db, key, value, store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function dbGetAll(db, store = STORE_LANGUAGES) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function dbDelete(db, key, store = STORE_LANGUAGES) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
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
    } catch (e) {
      console.warn('Leksihjelp: getCachedLanguage failed', e);
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
    } catch (e) {
      console.warn('Leksihjelp: getCachedGrammarFeatures failed', e);
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
    } catch (e) {
      console.warn('Leksihjelp: getCachedVersion failed', e);
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
    } catch (e) {
      console.warn('Leksihjelp: listCachedLanguages failed', e);
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

    // Store vocab in IndexedDB
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

    // Also download audio pack if available
    try {
      const manifest = await fetch(`${API_BASE}/v3/manifest`).then(r => r.json());
      const audioEndpoint = manifest?.languages?.[lang]?.audioEndpoint;
      if (audioEndpoint) {
        onProgress?.({ status: 'downloading_audio', detail: 'Laster ned uttale...' });
        await downloadAudioPack(lang, audioEndpoint, onProgress);
      }
    } catch (err) {
      // Audio download failed — vocab still works, just no offline pronunciation
      console.warn(`Audio download failed for ${lang}:`, err.message);
    }

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
    } catch (e) {
      console.warn('Leksihjelp: checkForUpdate failed (offline?)', e);
      return { needsUpdate: false };
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
   * Delete a cached language pack and its audio files.
   */
  async function deleteLanguage(lang) {
    try {
      const db = await openDB();
      // Delete vocab record
      await dbDelete(db, lang);
      // Delete all audio files for this language
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const cursorReq = store.openCursor();
      await new Promise((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) { resolve(); return; }
          if (cursor.key.startsWith(`${lang}/`)) {
            cursor.delete();
          }
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      db.close();
    } catch (e) {
      console.warn('Leksihjelp: deleteLanguage failed', e);
    }
  }

  // ── Audio Pack Management ──

  /**
   * Check if audio is cached for a language.
   */
  async function hasAudioCached(lang) {
    try {
      const db = await openDB();
      const record = await dbGet(db, lang);
      db.close();
      return !!record?.audioVersion;
    } catch (e) {
      console.warn('Leksihjelp: hasAudioCached failed', e);
      return false;
    }
  }

  /**
   * Get a single audio file blob from cache.
   */
  async function getAudioFile(lang, filename) {
    try {
      const db = await openDB();
      const key = `${lang}/${filename}`;
      const blob = await dbGet(db, key, STORE_AUDIO);
      db.close();
      return blob || null;
    } catch (e) {
      console.warn('Leksihjelp: getAudioFile failed', e);
      return null;
    }
  }

  /**
   * Download audio pack ZIP, extract, and store each MP3 in IndexedDB.
   *
   * @param {string} lang - Language code
   * @param {string} zipUrl - URL of the ZIP file (from manifest audioEndpoint)
   * @param {function} [onProgress] - Progress callback ({ status, detail, percent })
   * @returns {number} Number of audio files stored
   */
  async function downloadAudioPack(lang, zipUrl, onProgress) {
    onProgress?.({ status: 'downloading', detail: 'Laster ned lyd...', percent: 0 });

    // Download ZIP
    const res = await fetch(`${SITE_BASE}${zipUrl}`);
    if (!res.ok) throw new Error(`Audio download failed: ${res.status}`);

    const arrayBuffer = await res.arrayBuffer();
    onProgress?.({ status: 'extracting', detail: 'Pakker ut lydfiler...', percent: 30 });

    // Parse ZIP and decompress all files
    const files = parseZip(new Uint8Array(arrayBuffer));
    if (files._decompressPromises?.length) {
      await Promise.all(files._decompressPromises);
    }
    // Filter out failed decompressions
    const validFiles = files.filter(f => f.data);
    const totalFiles = validFiles.length;

    onProgress?.({ status: 'saving', detail: `Lagrer ${totalFiles} lydfiler...`, percent: 50 });

    // Store each MP3 in IndexedDB
    const db = await openDB();
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);

    let saved = 0;
    for (const file of validFiles) {
      if (!file.name.endsWith('.mp3')) continue;
      const key = `${lang}/${file.name}`;
      const blob = new Blob([file.data], { type: 'audio/mpeg' });
      store.put(blob, key);
      saved++;

      if (saved % 100 === 0) {
        const pct = 50 + Math.round((saved / totalFiles) * 50);
        onProgress?.({ status: 'saving', detail: `Lagrer lydfiler (${saved}/${totalFiles})...`, percent: pct });
      }
    }

    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    // Update the language record with audio version
    const manifest = await fetch(`${API_BASE}/v3/manifest`).then(r => r.json()).catch(() => null);
    const audioVersion = manifest?.languages?.[lang]?.audioVersion || 'unknown';

    const langRecord = await dbGet(db, lang);
    if (langRecord) {
      langRecord.audioVersion = audioVersion;
      langRecord.audioFileCount = saved;
      await dbPut(db, langRecord);
    }

    db.close();

    onProgress?.({ status: 'done', detail: `${saved} lydfiler lagret!`, percent: 100 });
    return saved;
  }

  /**
   * Minimal ZIP parser — extracts file names and uncompressed data.
   * Handles STORE (no compression) and DEFLATE (most common).
   */
  function parseZip(data) {
    const files = [];
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    while (offset < data.length - 4) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break; // Not a local file header

      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);

      const nameBytes = data.slice(offset + 30, offset + 30 + nameLen);
      const name = new TextDecoder().decode(nameBytes);

      const dataStart = offset + 30 + nameLen + extraLen;
      const compressedData = data.slice(dataStart, dataStart + compressedSize);

      let fileData;
      if (compressionMethod === 0) {
        // STORE — no compression
        fileData = compressedData;
      } else if (compressionMethod === 8) {
        // DEFLATE — use DecompressionStream
        fileData = null; // Will decompress async below
        files.push({ name, compressedData, uncompressedSize, needsDeflate: true });
        offset = dataStart + compressedSize;
        continue;
      } else {
        // Unsupported compression — skip
        offset = dataStart + compressedSize;
        continue;
      }

      files.push({ name, data: fileData });
      offset = dataStart + compressedSize;
    }

    // Decompress DEFLATE files using DecompressionStream
    const decompressPromises = files
      .filter(f => f.needsDeflate)
      .map(async (f) => {
        try {
          const ds = new DecompressionStream('raw');
          const writer = ds.writable.getWriter();
          writer.write(f.compressedData);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
          const result = new Uint8Array(totalLen);
          let pos = 0;
          for (const chunk of chunks) {
            result.set(chunk, pos);
            pos += chunk.length;
          }
          f.data = result;
          delete f.needsDeflate;
          delete f.compressedData;
        } catch (e) {
          console.warn('Leksihjelp: zip decompression failed for', f.name, e);
          f.data = null;
        }
      });

    // Return a promise that resolves when all decompression is done
    // But since parseZip is called synchronously, we need to handle this differently
    // Actually, let's make downloadAudioPack await this
    files._decompressPromises = decompressPromises;
    return files;
  }

  // ── Expose API ──
  window.__lexiVocabStore = {
    getCachedLanguage,
    getCachedGrammarFeatures,
    getCachedVersion,
    listCachedLanguages,
    downloadLanguage,
    checkForUpdate,
    getLanguage,
    deleteLanguage,
    hasAudioCached,
    getAudioFile,
    downloadAudioPack,
    API_BASE,
    SITE_BASE
  };
})();
