/**
 * Leksihjelp — Settings View Module (Phase 30-01)
 *
 * Mountable settings view: UI language picker, target-language list, grammar
 * preset + features, dark mode, prediction toggle, spellcheck-alternates
 * toggle. Account/auth, exam mode, and access-code remain in popup.js — they
 * live inside the same `#view-settings` DOM section but are owned by the host.
 *
 * @typedef {Object} SettingsViewDeps
 * @property {Object} storage      - { get(key), set(obj) }
 * @property {Object} runtime      - { sendMessage }
 * @property {Function} t          - i18n resolver
 * @property {Function} getUiLanguage
 * @property {Function} setUiLanguage
 * @property {Function} langName
 * @property {Function} loadGrammarFeatures - async (lang) => void
 * @property {Function} saveAndNotifyGrammarChange - () => void
 * @property {Object}  [showSection] - { language, grammar, darkmode, prediction,
 *                                       spellcheckAlternates } booleans
 *                                     (default all true). When false, the view
 *                                     does NOT bind handlers for that section.
 *
 * @returns {{ destroy(): void }}
 */
(function () {
  'use strict';

  function mountSettingsView(container, deps) {
    if (!container) throw new Error('mountSettingsView: container required');
    if (!deps) throw new Error('mountSettingsView: deps required');

    // TODO Plan 30-01 Task 2: move logic from popup.js — currently a no-op.
    return {
      destroy() { /* no-op until Task 2 */ },
    };
  }

  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSettingsView = { mount: mountSettingsView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mount: mountSettingsView, mountSettingsView };
  }
})();
