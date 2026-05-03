/**
 * Leksihjelp — Settings View Module (Phase 30-01)
 *
 * Mountable settings view: UI language picker, dark mode, prediction toggle,
 * spellcheck-alternates toggle.
 *
 * Account/auth, exam mode, access-code, target-language download list, and
 * grammar features remain owned by the host (popup.js) — they live inside the
 * same `#view-settings` DOM section but their wiring is extension-specific
 * (calls into vocab-store download paths, access-code verify endpoint, exam
 * registry). Lockdown's sidepanel will pass `showSection: { uiLanguage: true,
 * darkmode: true }` and skip the rest.
 *
 * @typedef {Object} SettingsViewDeps
 * @property {Object} storage      - { get(key), set(obj) }
 * @property {Object} runtime      - { sendMessage }
 * @property {Function} t          - i18n resolver
 * @property {Function} getUiLanguage
 * @property {Function} setUiLanguage
 * @property {Function} applyTranslations - re-paint i18n strings on UI lang change
 * @property {Function} [onUiLanguageChange] - host hook to refresh dynamic UI
 * @property {Object}  [showSection] - { uiLanguage, darkmode, prediction,
 *                                       spellcheckAlternates } booleans
 *                                     (default all true).
 *
 * @returns {{ destroy(): void }}
 */
(function () {
  'use strict';

  function mountSettingsView(container, deps) {
    if (!container) throw new Error('mountSettingsView: container required');
    if (!deps) throw new Error('mountSettingsView: deps required');

    const {
      storage, runtime, t,
      getUiLanguage, setUiLanguage, applyTranslations,
      onUiLanguageChange,
    } = deps;
    const showSection = deps.showSection || {
      uiLanguage: true, darkmode: true, prediction: true, spellcheckAlternates: true, widget: true, ttsWidget: true,
    };

    const cleanups = [];
    function bind(el, ev, handler) {
      if (!el) return;
      el.addEventListener(ev, handler);
      cleanups.push(() => el.removeEventListener(ev, handler));
    }

    // ── UI language picker ─────────────────────────────
    if (showSection.uiLanguage !== false) {
      const uiSelector = container.querySelector('#ui-language-selector');
      if (uiSelector) {
        const currentUi = getUiLanguage();
        uiSelector.querySelectorAll('.ui-lang-option').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.uiLang === currentUi);
          const onClick = async () => {
            const lang = btn.dataset.uiLang;
            if (lang === getUiLanguage()) return;
            uiSelector.querySelectorAll('.ui-lang-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setUiLanguage(lang);
            await storage.set({ uiLanguage: lang });
            if (typeof applyTranslations === 'function') applyTranslations();
            if (typeof onUiLanguageChange === 'function') onUiLanguageChange(lang);
            runtime.sendMessage({ type: 'UI_LANGUAGE_CHANGED', uiLanguage: lang });
          };
          btn.addEventListener('click', onClick);
          cleanups.push(() => btn.removeEventListener('click', onClick));
        });
      }
    }

    // ── Dark mode toggle ───────────────────────────────
    if (showSection.darkmode !== false) {
      (async () => {
        const toggle = container.querySelector('#setting-darkmode');
        if (!toggle) return;
        const stored = await storage.get('darkMode');
        const docEl = container.ownerDocument.documentElement;

        if (stored === true) {
          docEl.setAttribute('data-theme', 'dark');
          toggle.checked = true;
        } else if (stored === false) {
          docEl.removeAttribute('data-theme');
          toggle.checked = false;
        } else {
          const win = container.ownerDocument.defaultView;
          if (win && win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches) {
            docEl.setAttribute('data-theme', 'dark');
            toggle.checked = true;
          }
        }

        bind(toggle, 'change', async () => {
          if (toggle.checked) {
            docEl.setAttribute('data-theme', 'dark');
            await storage.set({ darkMode: true });
          } else {
            docEl.removeAttribute('data-theme');
            await storage.set({ darkMode: false });
          }
        });
      })();
    }

    // ── Word-prediction toggle ─────────────────────────
    if (showSection.prediction !== false) {
      (async () => {
        const toggle = container.querySelector('#setting-prediction');
        if (!toggle) return;
        const enabled = await storage.get('predictionEnabled');
        toggle.checked = enabled === true;
        bind(toggle, 'change', async () => {
          await storage.set({ predictionEnabled: toggle.checked });
          runtime.sendMessage({ type: 'PREDICTION_TOGGLED', enabled: toggle.checked });
        });
      })();
    }

    // ── Widget toggle (Hurtigoppslag — double-click lookup card) ──
    if (showSection.widget !== false) {
      (async () => {
        const toggle = container.querySelector('#setting-widget');
        if (!toggle) return;
        const enabled = await storage.get('widgetEnabled');
        // Default to true if never set
        toggle.checked = enabled !== false;
        bind(toggle, 'change', async () => {
          await storage.set({ widgetEnabled: toggle.checked });
          runtime.sendMessage({ type: 'WIDGET_ENABLED_CHANGED', enabled: toggle.checked });
        });
      })();
    }

    // ── TTS-widget toggle (Uttaleknapp on text selection) ──
    // Independent of Hurtigoppslag — pausing the on-page TTS bubble must
    // not also kill the double-click lookup card. Migrates from legacy
    // widgetEnabled if ttsWidgetEnabled has never been written, so users
    // who had the combined toggle off keep both surfaces off.
    if (showSection.ttsWidget !== false) {
      (async () => {
        const toggle = container.querySelector('#setting-tts-widget');
        if (!toggle) return;
        const stored = await storage.get('ttsWidgetEnabled');
        if (stored === undefined || stored === null) {
          const legacy = await storage.get('widgetEnabled');
          toggle.checked = legacy !== false;
        } else {
          toggle.checked = stored !== false;
        }
        bind(toggle, 'change', async () => {
          await storage.set({ ttsWidgetEnabled: toggle.checked });
          runtime.sendMessage({ type: 'TTS_WIDGET_ENABLED_CHANGED', enabled: toggle.checked });
        });
      })();
    }

    // ── Spellcheck-alternates toggle ───────────────────
    if (showSection.spellcheckAlternates !== false) {
      (async () => {
        const toggle = container.querySelector('#setting-spellcheck-alternates');
        if (!toggle) return;
        const stored = await storage.get('spellCheckAlternatesVisible');
        toggle.checked = stored === true;
        bind(toggle, 'change', async () => {
          await storage.set({ spellCheckAlternatesVisible: toggle.checked });
        });
      })();
    }

    // Suppress unused warning for `t` — kept as a dep for future i18n strings
    // the view may render directly (today the labels are static via data-i18n).
    void t;

    return {
      destroy() {
        for (const fn of cleanups) {
          try { fn(); } catch (_) { /* best-effort */ }
        }
        cleanups.length = 0;
      },
    };
  }

  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSettingsView = { mount: mountSettingsView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mount: mountSettingsView, mountSettingsView };
  }
})();
