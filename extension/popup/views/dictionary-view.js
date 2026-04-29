/**
 * Leksihjelp — Dictionary View Module (Phase 30-01)
 *
 * Mountable dictionary view: search input, lang switcher, direction toggle,
 * result rendering, "Lær mer" pedagogy popovers.
 *
 * The host (extension popup.js or lockdown sidepanel) passes a `container`
 * element (typically `<section id="view-dictionary">`) and a `deps` object
 * with explicit dependencies. The view does NOT touch chrome.* globals,
 * window.__lexi*, or document.getElementById directly — every external
 * dependency arrives via deps.
 *
 * @typedef {Object} DictionaryViewDeps
 * @property {Object} vocab     - shape mirrors lockdown's host.__lexiVocab:
 *                                { getLanguage, isReady, onReady, getWordList,
 *                                  getDictionary(lang), flattenBanks(dict), ... }
 * @property {Object} storage   - { get(key), set(obj) } — chrome.storage.local equivalent
 * @property {Object} runtime   - { sendMessage } — chrome.runtime equivalent
 * @property {Function} t       - i18n string resolver (key, vars?)
 * @property {Function} getUiLanguage - returns 'nb' | 'nn' | 'en'
 * @property {Function} langName      - (code) => display name
 * @property {Function} isFeatureEnabled - (featureId) => bool
 * @property {Function} getAllowedPronouns - () => string[] | null
 * @property {boolean}  audioEnabled  - when false, audio buttons are NOT rendered
 * @property {Function} [playAudio]   - (filename, btn) — only called when audioEnabled
 * @property {string}   [BACKEND_URL] - used by audio for TTS endpoint
 * @property {Function} [onSearch]    - optional callback so host can log/recent-search
 *
 * @returns {{ destroy(): void, refresh(query?: string): void }}
 */
(function () {
  'use strict';

  function mountDictionaryView(container, deps) {
    if (!container) throw new Error('mountDictionaryView: container required');
    if (!deps) throw new Error('mountDictionaryView: deps required');

    // TODO Plan 30-01 Task 2: move logic from popup.js — currently a no-op.
    return {
      destroy() { /* no-op until Task 2 */ },
      refresh(_query) { /* no-op until Task 2 */ },
    };
  }

  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiDictionaryView = { mount: mountDictionaryView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mount: mountDictionaryView, mountDictionaryView };
  }
})();
