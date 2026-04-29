/**
 * Leksihjelp — Popup (dictionary search + settings)
 *
 * Adapted to use Papertek Vocabulary API bank-based structure
 */

const BACKEND_URL = 'https://leksihjelp.no';
const { t, initI18n, setUiLanguage, getUiLanguage, langName } = self.__lexiI18n;

// Phase 30-01: Single source of truth — view state shared with dictionary-view
// module by reference. The view reads + mutates these properties; the host
// also reads + mutates them via the const-bound aliases below.
const viewState = {
  dictionary: null,
  noDictionary: null,
  allWords: [],
  noWords: [],
  inflectionIndex: null,
  currentLang: 'es',
  searchDirection: 'no-target',
  nounGenusMap: new Map(),
  nbEnrichmentIndex: new Map(),
  nbTranslationIndex: new Map(),
  nbIdToTargetIndex: new Map(),
  noNounGenusMap: new Map(),
  currentIndexes: null,
  compoundNavStack: [],
};

let currentAudio = null; // Legacy — dictionary view also tracks its own playback.
let grammarFeatures = null;
let enabledFeatures = new Set();

// Mounted dictionary view handle — populated in initSearch().
let dictionaryViewHandle = null;

/**
 * Get the appropriate Norwegian translation for an entry,
 * respecting the user's UI language (nb vs nn).
 * Falls back to entry.translation if no linkedTo data.
 */
function getTranslation(entry) {
  if (!entry) return '';
  const ui = getUiLanguage();
  if (ui === 'nn' && entry.linkedTo?.nn?.translation) {
    return entry.linkedTo.nn.translation;
  }
  if (ui === 'nb' && entry.linkedTo?.nb?.translation) {
    return entry.linkedTo.nb.translation;
  }
  if (entry.translation) return entry.translation;
  // Resolve linkedTo primary ID via the loaded Norwegian dictionary
  const link = entry.linkedTo?.[ui] || entry.linkedTo?.nb || entry.linkedTo?.nn;
  if (link?.primary && viewState.noDictionary) {
    for (const bank of Object.keys(BANK_TO_POS)) {
      const resolved = viewState.noDictionary[bank]?.[link.primary];
      if (resolved?.word) return resolved.word;
    }
  }
  // Resolve via nbTranslationIndex (built from NB _generatedFrom)
  if (entry._wordId && viewState.nbTranslationIndex.size > 0) {
    const nbWord = viewState.nbTranslationIndex.get(entry._wordId);
    if (nbWord) return nbWord;
  }
  return '';
}

function generatedFromRefs(entry) {
  const g = entry._generatedFrom;
  if (!g) return [];
  if (Array.isArray(g)) return g;
  return g.split(',').map(s => s.trim());
}

// Bank name to Norwegian part of speech mapping
const BANK_TO_POS = {
  verbbank: 'verb',
  nounbank: 'substantiv',
  adjectivebank: 'adjektiv',
  articlesbank: 'artikkel',
  generalbank: 'ord',
  numbersbank: 'tall',
  phrasesbank: 'frase',
  pronounsbank: 'pronomen',
  languagesbank: 'språk',          // Phase 05.1 Gap B
  nationalitiesbank: 'nasjonalitet' // Phase 05.1 Gap B
};

// Genus to gender mapping (kept for reference; use genusToGender() for display)
const GENUS_TO_GENDER = {
  m: 'maskulin',
  f: 'feminin',
  n: 'nøytrum',
  pl: 'flertall'
};

function bankToPos(bank) {
  const keys = { verbbank: 'pos_verb', nounbank: 'pos_noun', adjectivebank: 'pos_adjective',
    articlesbank: 'pos_article', generalbank: 'pos_general', numbersbank: 'pos_number',
    phrasesbank: 'pos_phrase', pronounsbank: 'pos_pronoun' };
  return t(keys[bank] || 'pos_general');
}

function genusToGender(genus) {
  const keys = { m: 'gender_m', f: 'gender_f', n: 'gender_n', pl: 'gender_pl' };
  return keys[genus] ? t(keys[genus]) : genus;
}

// Norwegian irregular verb forms -> infinitive (without "å" prefix)
const NORWEGIAN_IRREGULAR_VERBS = {
  'er': 'være', 'var': 'være',
  'har': 'ha', 'hadde': 'ha',
  'kan': 'kunne', 'kunne': 'kunne',
  'vil': 'ville', 'ville': 'ville',
  'skal': 'skulle', 'skulle': 'skulle',
  'må': 'måtte',
  'vet': 'vite', 'visste': 'vite',
  'går': 'gå', 'gikk': 'gå',
  'får': 'få', 'fikk': 'få',
  'gjør': 'gjøre', 'gjorde': 'gjøre',
  'ser': 'se', 'så': 'se',
  'sier': 'si', 'sa': 'si',
  'tar': 'ta', 'tok': 'ta',
  'kommer': 'komme', 'kom': 'komme',
  'finner': 'finne', 'fant': 'finne',
  'gir': 'gi', 'gav': 'gi',
  'ligger': 'ligge', 'lå': 'ligge',
  'sitter': 'sitte', 'satt': 'sitte',
  'står': 'stå', 'stod': 'stå',
  'drar': 'dra', 'dro': 'dra',
  'legger': 'legge', 'la': 'legge',
  'setter': 'sette', 'satte': 'sette',
  'skriver': 'skrive', 'skrev': 'skrive',
  'spiser': 'spise', 'spiste': 'spise',
  'liker': 'like', 'likte': 'like',
  'bor': 'bo', 'bodde': 'bo',
  'heter': 'hete', 'het': 'hete',
  'snakker': 'snakke', 'snakket': 'snakke',
  'leser': 'lese', 'leste': 'lese',
  'lærer': 'lære', 'lærte': 'lære',
  'synger': 'synge', 'sang': 'synge',
  'danser': 'danse', 'danset': 'danse',
  'svømmer': 'svømme',
  'lager': 'lage', 'lagde': 'lage',
  'leker': 'leke', 'lekte': 'leke'
};

function norwegianInfinitive(form) {
  const lower = form.toLowerCase();
  if (NORWEGIAN_IRREGULAR_VERBS[lower]) return NORWEGIAN_IRREGULAR_VERBS[lower];
  // Regular verb heuristic: present "-er" -> infinitive "-e"
  if (lower.endsWith('er') && lower.length > 3) return lower.slice(0, -1);
  return null;
}

function applyTranslations() {
  document.documentElement.lang = getUiLanguage();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();

  // Step 1: If no UI language chosen yet, show the UI language picker first
  const storedUiLang = await chromeStorageGet('uiLanguage');
  if (!storedUiLang) {
    await initUiLanguagePicker();
  }

  applyTranslations();

  viewState.currentLang = (await chromeStorageGet('language')) || null;

  // Step 2: Show the learning-language picker on first popup open.
  // Gated on a dedicated flag rather than the presence of `language` —
  // the floating widget silently writes `language` when the user picks
  // a TTS language, which would otherwise swallow the picker entirely.
  const onboardingComplete = await chromeStorageGet('onboardingComplete');
  if (!onboardingComplete) {
    await initFirstRunPicker();
    await chromeStorageSet({ onboardingComplete: true });
  }

  // If still no language after picker (skipped), default to English
  if (!viewState.currentLang) viewState.currentLang = 'en';

  await loadDictionary(viewState.currentLang);
  await loadGrammarFeatures(viewState.currentLang);
  initSearch();
  initSettings();
  initExamMode();
  initUiLanguageSettings();
  initGrammarSettings();
  initNav();
  initPinButton();
  initSkrivButton();
  initPauseButton();
  initDarkMode();
  initAuth();
  initReportForm();
  initVocabUpdateNotice();
  initVocabStatus();
});

// ── Plan 23-03: hydration status pills ─────────────────────────────
// Renders one pill per language based on chrome.runtime 'lexi:hydration'
// events emitted by:
//   • extension/background/vocab-bootstrap.js (install/update auto-download)
//   • extension/content/vocab-seam.js (target-language hydration)
// On popup open, queries the service worker via 'lexi:status' so a popup
// opened mid-download shows the latest cache state instead of a blank pill.
function initVocabStatus() {
  const container = document.getElementById('lexi-vocab-status');
  if (!container) return;

  const READY_AUTO_HIDE_MS = 3000;
  const pills = new Map();   // lang → {el, state, hideTimer}

  function langLabel(lang) {
    if (typeof langName === 'function') {
      try { return langName(lang); } catch (_) { /* fall through */ }
    }
    return lang;
  }

  function textForState(lang, state, reason) {
    const name = langLabel(lang);
    if (state === 'fetching') return `Laster ned ${name}…`;
    if (state === 'ready')    return `${name} klar`;
    if (state === 'error') {
      if (reason === 'schema-mismatch') {
        return t('hydration_error_schema_mismatch');
      }
      if (reason === 'timeout-or-network' && !navigator.onLine) {
        return t('hydration_error_offline');
      }
      return t('hydration_error_generic');
    }
    if (state === 'baseline') return `${name} (basis)`;
    return `${name} ${state}`;
  }

  function ensurePill(lang) {
    let entry = pills.get(lang);
    if (!entry) {
      const el = document.createElement('span');
      el.className = 'lexi-vocab-pill';
      el.dataset.lang = lang;
      container.appendChild(el);
      entry = { el, state: null, hideTimer: null };
      pills.set(lang, entry);
    }
    return entry;
  }

  function setPill(lang, state, reason) {
    if (state === 'baseline') return; // NB baseline is implicit; no pill.
    const entry = ensurePill(lang);
    if (entry.hideTimer) { clearTimeout(entry.hideTimer); entry.hideTimer = null; }
    entry.state = state;
    entry.el.classList.remove('is-fetching', 'is-ready', 'is-error');
    entry.el.classList.add(`is-${state}`);
    entry.el.textContent = textForState(lang, state, reason);
    container.hidden = false;

    if (state === 'ready') {
      entry.hideTimer = setTimeout(() => {
        entry.el.remove();
        pills.delete(lang);
        if (pills.size === 0) container.hidden = true;
      }, READY_AUTO_HIDE_MS);
    }
    // 'error' is sticky until the next state change for that lang.
  }

  // Snapshot of cached languages on popup open so a popup opened mid-download
  // doesn't start with an empty pill row. Cached langs are 'ready' (and will
  // auto-hide on the standard timer).
  try {
    chrome.runtime.sendMessage({ type: 'lexi:status' }, (response) => {
      if (chrome.runtime.lastError) return;
      const revisions = (response && response.revisions) || {};
      for (const lang of Object.keys(revisions)) {
        if (lang === 'nb') continue; // NB baseline is implicit
        setPill(lang, 'ready');
      }
    });
  } catch (_) { /* service worker unavailable — no-op */ }

  // Live updates from bootstrap + content seam.
  chrome.runtime.onMessage.addListener((m) => {
    if (!m || !m.lang) return;
    if (m.type === 'lexi:hydration' && m.state) {
      if (m.lang === 'nb' && m.state === 'baseline') return; // implicit
      setPill(m.lang, m.state, m.reason);
      return;
    }
    // DEBT-04: vocab-store emits this when cached schema differs from
    // server schema. Surface as an error pill with the Versjonskonflikt
    // diagnostic regardless of whether bootstrap has emitted yet.
    if (m.type === 'lexi:schema-mismatch') {
      setPill(m.lang, 'error', 'schema-mismatch');
    }
  });
}

// ── Plan 23-04: vocab update notice ───────────────────────────────
// Polls the service worker on popup open ('lexi:check-updates-now') and
// subscribes to push events ('lexi:updates-available' from startup check,
// 'lexi:refresh-done' / 'lexi:hydration' state='error' from the refresh
// flow). Click handler triggers refreshAll via 'lexi:refresh-now'.
function initVocabUpdateNotice() {
  const notice = document.getElementById('lexi-updates-notice');
  const btn = document.getElementById('lexi-refresh-btn');
  const msg = notice ? notice.querySelector('.lexi-updates-msg') : null;
  if (!notice || !btn || !msg) return;

  let staleLangs = [];      // langs we are currently inviting the user to refresh
  let pendingLangs = null;  // langs awaiting refresh-done after click

  const DEFAULT_TEXT = 'Nye ordlister tilgjengelig';
  const REFRESHING_TEXT = 'Oppdaterer…';
  const ERROR_TEXT = 'Oppdatering feilet — prøv igjen senere';
  const REFRESH_LABEL = 'Oppdater ordlister nå';

  function showNotice(langs, text) {
    staleLangs = Array.isArray(langs) ? langs.slice() : [];
    const suffix = staleLangs.length > 0 ? ` (${staleLangs.join(', ')})` : '';
    msg.textContent = (text || DEFAULT_TEXT) + suffix;
    btn.textContent = REFRESH_LABEL;
    btn.disabled = false;
    notice.hidden = false;
  }

  function hideNotice() {
    notice.hidden = true;
    staleLangs = [];
    pendingLangs = null;
  }

  function showError() {
    msg.textContent = ERROR_TEXT;
    btn.textContent = REFRESH_LABEL;
    btn.disabled = false;
    notice.hidden = false;
  }

  // Poll once on popup open. The service worker may have run its startup
  // check earlier (and emitted updates-available before the popup was
  // listening), so we ask explicitly for the current state.
  try {
    chrome.runtime.sendMessage({ type: 'lexi:check-updates-now' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (!response || !response.ok || !response.result) return;
      const stale = Object.keys(response.result).filter(k => response.result[k] === 'stale');
      if (stale.length > 0) showNotice(stale);
    });
  } catch (_) { /* service worker unavailable — no-op */ }

  // Push events from the service worker / vocab-updater.
  chrome.runtime.onMessage.addListener((m) => {
    if (!m || !m.type) return;
    if (m.type === 'lexi:updates-available' && Array.isArray(m.langs) && m.langs.length > 0) {
      showNotice(m.langs);
      return;
    }
    if (m.type === 'lexi:refresh-done' && pendingLangs) {
      const idx = pendingLangs.indexOf(m.lang);
      if (idx >= 0) pendingLangs.splice(idx, 1);
      if (pendingLangs.length === 0) {
        hideNotice();
      } else {
        msg.textContent = REFRESHING_TEXT + ` (${pendingLangs.join(', ')})`;
      }
      return;
    }
    if (m.type === 'lexi:hydration' && m.state === 'error' && pendingLangs && pendingLangs.includes(m.lang)) {
      // One of the in-flight langs failed — show error, leave notice up.
      pendingLangs = null;
      showError();
      return;
    }
  });

  btn.addEventListener('click', () => {
    if (staleLangs.length === 0) return;
    pendingLangs = staleLangs.slice();
    btn.disabled = true;
    btn.textContent = REFRESHING_TEXT;
    msg.textContent = REFRESHING_TEXT + ` (${pendingLangs.join(', ')})`;
    try {
      chrome.runtime.sendMessage({ type: 'lexi:refresh-now', langs: pendingLangs }, (response) => {
        if (chrome.runtime.lastError) {
          pendingLangs = null;
          showError();
          return;
        }
        if (response && response.ok === false) {
          pendingLangs = null;
          showError();
        }
        // Otherwise wait for per-lang refresh-done events.
      });
    } catch (_) {
      pendingLangs = null;
      showError();
    }
  });
}

/**
 * Show language picker for first-run users.
 * Waits for student to pick a foreign language or skip.
 */
async function initFirstRunPicker() {
  const picker = document.getElementById('language-picker');
  if (!picker) return;

  return new Promise((resolve) => {
    picker.classList.remove('hidden');

    // Language buttons
    picker.querySelectorAll('.lang-pick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = btn.dataset.lang;

        // Disable all buttons and show progress
        picker.querySelectorAll('.lang-pick-btn').forEach(b => b.disabled = true);
        document.getElementById('lang-pick-skip').classList.add('hidden');
        const progress = document.getElementById('lang-pick-progress');
        const status = document.getElementById('lang-pick-status');
        progress.classList.remove('hidden');

        try {
          // Download the selected language
          if (window.__lexiVocabStore) {
            await window.__lexiVocabStore.downloadLanguage(lang, (p) => {
              status.textContent = p.detail;
            }, { uiLanguage: getUiLanguage() });
          }

          // Save selection
          viewState.currentLang = lang;
          await chromeStorageSet({ language: lang });
          chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: lang });

          picker.classList.add('hidden');
          resolve();
        } catch (err) {
          console.error('Language download failed:', err);
          status.textContent = !navigator.onLine ? t('picker_failed_offline') : t('picker_failed');
          picker.querySelectorAll('.lang-pick-btn').forEach(b => b.disabled = false);
          document.getElementById('lang-pick-skip').classList.remove('hidden');
          progress.classList.add('hidden');
        }
      });
    });

    // Skip button
    document.getElementById('lang-pick-skip')?.addEventListener('click', () => {
      picker.classList.add('hidden');
      resolve();
    });
  });
}

/**
 * Show UI language picker for first-run users (before learning language picker).
 * This is a polyglot screen — labels are static in all three languages.
 */
async function initUiLanguagePicker() {
  const picker = document.getElementById('ui-language-picker');
  if (!picker) return;

  return new Promise((resolve) => {
    picker.classList.remove('hidden');

    picker.querySelectorAll('.ui-lang-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = btn.dataset.uiLang;
        setUiLanguage(lang);
        await chromeStorageSet({ uiLanguage: lang });
        picker.classList.add('hidden');
        applyTranslations();
        resolve();
      });
    });
  });
}

/**
 * Wire up the UI language selector in settings.
 * Changing the display language re-renders all UI text.
 */
function initUiLanguageSettings() {
  const container = document.getElementById('ui-language-selector');
  if (!container) return;

  // Highlight the active UI language
  const currentUi = getUiLanguage();
  container.querySelectorAll('.ui-lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.uiLang === currentUi);

    btn.addEventListener('click', async () => {
      const lang = btn.dataset.uiLang;
      if (lang === getUiLanguage()) return;

      // Update active state
      container.querySelectorAll('.ui-lang-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Apply new UI language
      setUiLanguage(lang);
      await chromeStorageSet({ uiLanguage: lang });
      applyTranslations();

      // Re-render dynamic sections
      updateLangLabels();
      buildLangSwitcher();
      updateLanguageListStatus();
      initGrammarSettings();
      updateAuthUI();

      // Re-run search if there's a query
      const input = document.getElementById('search-input');
      if (input?.value.trim()) performSearch(input.value.trim());

      // Broadcast to content scripts and service worker
      chrome.runtime.sendMessage({ type: 'UI_LANGUAGE_CHANGED', uiLanguage: lang });
    });
  });
}

// ── Storage helpers ────────────────────────────────────────
function chromeStorageGet(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, r => resolve(r[key]));
  });
}
function chromeStorageSet(obj) {
  return new Promise(resolve => {
    chrome.storage.local.set(obj, resolve);
  });
}

// ── Dictionary loading ─────────────────────────────────────
async function loadDictionary(lang) {
  try {
    // Try vocab store (IndexedDB) first, fall back to bundled file
    viewState.dictionary = await loadLanguageData(lang);
    if (!viewState.dictionary) throw new Error('No dictionary data');

    viewState.allWords = flattenBanks(viewState.dictionary);
    viewState.inflectionIndex = buildInflectionIndex(viewState.allWords);

    // Phase 17 COMP-01: build nounGenus for compound decomposition
    const vocabCore = self.__lexiVocabCore;
    if (vocabCore && vocabCore.buildIndexes) {
      const indexes = vocabCore.buildIndexes({ raw: viewState.dictionary, lang: viewState.currentLang });
      viewState.nounGenusMap = indexes.nounGenus || new Map();
      viewState.currentIndexes = indexes; // Phase 24: capture for predictCompound
    }

    updateLangLabels();

    // Load Norwegian dictionary for two-way lookups (match UI language: nn or nb)
    const noLang = getUiLanguage() === 'nn' ? 'nn' : 'nb';
    if (lang !== noLang) {
      try {
        viewState.noDictionary = await loadLanguageData(noLang);
        viewState.noWords = viewState.noDictionary ? flattenBanks(viewState.noDictionary) : [];
        // Build reverse indexes from NB dictionary
        viewState.nbEnrichmentIndex = new Map();
        viewState.nbTranslationIndex = new Map();
        const langPrefix = `${currentLang}-nb/`;
        const nbIdToWord = new Map();
        if (viewState.noDictionary) {
          for (const bank of Object.keys(viewState.noDictionary)) {
            const bankData = viewState.noDictionary[bank];
            if (!bankData || typeof bankData !== 'object') continue;
            for (const [id, entry] of Object.entries(bankData)) {
              if (id.startsWith('_')) continue;
              if (entry.word) nbIdToWord.set(id, entry.word);
              // Enrichment index (falseFriends/senses via linkedTo)
              if ((entry.falseFriends || entry.senses) && entry.linkedTo?.[viewState.currentLang]?.primary) {
                const linkId = entry.linkedTo[viewState.currentLang].primary;
                const existing = viewState.nbEnrichmentIndex.get(linkId);
                viewState.nbEnrichmentIndex.set(linkId, {
                  falseFriends: [...(existing?.falseFriends || []), ...(entry.falseFriends || [])],
                  senses: [...(existing?.senses || []), ...(entry.senses || [])]
                });
              }
              // Direction 1: NB→target (e.g. NB _generatedFrom "de-nb/bank:chef_noun")
              if (entry._generatedFrom && entry.word) {
                for (const trimmed of generatedFromRefs(entry)) {
                  if (trimmed.startsWith(langPrefix)) {
                    const colonIdx = trimmed.indexOf(':');
                    if (colonIdx !== -1) {
                      const targetId = trimmed.substring(colonIdx + 1);
                      if (!viewState.nbTranslationIndex.has(targetId)) {
                        viewState.nbTranslationIndex.set(targetId, entry.word);
                      }
                    }
                  }
                }
              }
            }
          }
        }
        // Direction 2: target→NB (e.g. FR _generatedFrom "nb-fr/bank:skole_noun")
        const revPrefix = `nb-${currentLang}/`;
        viewState.nbIdToTargetIndex = new Map();
        if (viewState.dictionary) {
          for (const bank of Object.keys(viewState.dictionary)) {
            const bankData = viewState.dictionary[bank];
            if (!bankData || typeof bankData !== 'object') continue;
            for (const [id, entry] of Object.entries(bankData)) {
              if (id.startsWith('_') || !entry._generatedFrom) continue;
              for (const trimmed of generatedFromRefs(entry)) {
                if (trimmed.startsWith(revPrefix)) {
                  const colonIdx = trimmed.indexOf(':');
                  if (colonIdx !== -1) {
                    const nbId = trimmed.substring(colonIdx + 1);
                    const nbWord = nbIdToWord.get(nbId);
                    if (nbWord) {
                      if (!viewState.nbTranslationIndex.has(id)) viewState.nbTranslationIndex.set(id, nbWord);
                      if (!viewState.nbIdToTargetIndex.has(nbId)) viewState.nbIdToTargetIndex.set(nbId, id);
                    }
                  }
                }
              }
            }
          }
        }
        if (viewState.noDictionary && vocabCore && vocabCore.buildIndexes) {
          const noIndexes = vocabCore.buildIndexes({ raw: viewState.noDictionary, lang: noLang });
          viewState.noNounGenusMap = noIndexes.nounGenus || new Map();
        }
      } catch {
        viewState.noDictionary = null;
        viewState.noWords = [];
        viewState.noNounGenusMap = new Map();
        viewState.nbEnrichmentIndex = new Map();
        viewState.nbTranslationIndex = new Map();
        viewState.nbIdToTargetIndex = new Map();
      }
    } else {
      viewState.noDictionary = null;
      viewState.noWords = [];
      viewState.noNounGenusMap = new Map();
      viewState.nbEnrichmentIndex = new Map();
      viewState.nbTranslationIndex = new Map();
      viewState.nbIdToTargetIndex = new Map();
    }
  } catch (e) {
    console.error('Failed to load dictionary:', e);
  }
}

// Languages bundled in the extension ZIP (always available offline)
const BUNDLED_LANGUAGES = new Set(['nb', 'nn', 'en']);

/**
 * Load language data from IndexedDB (vocab store) or fall back to bundled file.
 * Foreign languages (de, es, fr) are downloaded on demand.
 * NB, NN, EN are bundled but also cached in IndexedDB if downloaded from API.
 */
async function loadLanguageData(lang) {
  // Try IndexedDB first (works for all languages)
  if (window.__lexiVocabStore) {
    const cached = await window.__lexiVocabStore.getCachedLanguage(lang);
    if (cached) return cached;

    // Not cached in IndexedDB — download from API if it's a foreign language
    if (!BUNDLED_LANGUAGES.has(lang)) {
      try {
        showDownloadStatus(lang, t('settings_downloading'));
        const data = await window.__lexiVocabStore.downloadLanguage(lang, (progress) => {
          showDownloadStatus(lang, progress.detail);
        }, { uiLanguage: getUiLanguage() });
        hideDownloadStatus();
        return data;
      } catch (err) {
        console.warn(`Download failed for ${lang}:`, err.message);
        hideDownloadStatus();
        return null;
      }
    }
  }

  // Fall back to bundled file (nb, nn, en)
  try {
    const url = chrome.runtime.getURL(`data/${lang}.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error('not bundled');
    return res.json();
  } catch {
    // Bundled file missing (v2→v3 migration) — download from API as last resort
    if (window.__lexiVocabStore) {
      try {
        return await window.__lexiVocabStore.downloadLanguage(lang, () => {});
      } catch { return null; }
    }
    return null;
  }
}

/**
 * Download audio pack for a bundled language if not already cached.
 * Runs in background — does not block dictionary loading.
 */
async function ensureAudioPack(lang) {
  try {
    const hasAudio = await window.__lexiVocabStore.hasAudioCached(lang);
    if (hasAudio) return;

    const manifest = await fetch(`${window.__lexiVocabStore.API_BASE}/v3/manifest`).then(r => r.json());
    const audioEndpoint = manifest?.languages?.[lang]?.audioEndpoint;
    if (!audioEndpoint) return;

    console.log(`Leksihjelp: Downloading audio pack for ${lang}...`);
    await window.__lexiVocabStore.downloadAudioPack(lang, audioEndpoint);
    console.log(`Leksihjelp: Audio pack for ${lang} downloaded`);
    updateLanguageListStatus();
  } catch (err) {
    console.warn(`Leksihjelp: Audio download for ${lang} failed:`, err.message);
  }
}

async function updateLanguageListStatus() {
  const buttons = document.querySelectorAll('.lang-option');
  for (const btn of buttons) {
    const lang = btn.dataset.lang;
    const statusEl = btn.querySelector('.lang-option-status');
    const isBundled = BUNDLED_LANGUAGES.has(lang);
    const isActive = lang === viewState.currentLang;

    btn.classList.toggle('active', isActive);

    // Delete button (only for downloaded non-bundled languages)
    const deleteBtn = document.querySelector(`.lang-delete-btn[data-lang="${lang}"]`);

    if (isBundled) {
      if (deleteBtn) deleteBtn.classList.add('hidden');
      // Check if audio is cached for bundled languages
      if (window.__lexiVocabStore) {
        const hasAudio = await window.__lexiVocabStore.hasAudioCached(lang);
        if (hasAudio) {
          statusEl.textContent = '🔊';
          statusEl.className = 'lang-option-status';
        } else {
          statusEl.textContent = t('settings_download_audio') || '🔊↓';
          statusEl.className = 'lang-option-status download-audio';
          statusEl.title = t('settings_download_audio_title') || 'Last ned uttale';
          statusEl.style.cursor = 'pointer';
          // Clone to remove old listeners
          const newStatus = statusEl.cloneNode(true);
          statusEl.replaceWith(newStatus);
          newStatus.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (newStatus.classList.contains('downloading')) return;
            const confirmed = confirm(t('settings_download_audio_confirm', { lang: langName(lang) }) || `Last ned uttale for ${langName(lang)}? (~45 MB)`);
            if (!confirmed) return;
            newStatus.classList.add('downloading');
            newStatus.textContent = t('settings_downloading') || '...';
            try {
              await ensureAudioPack(lang);
              newStatus.textContent = '🔊';
              newStatus.className = 'lang-option-status';
              newStatus.style.cursor = '';
            } catch {
              newStatus.textContent = t('settings_download_audio') || '🔊↓';
              newStatus.classList.remove('downloading');
            }
          });
        }
      } else {
        statusEl.textContent = '';
        statusEl.className = 'lang-option-status';
      }
    } else if (window.__lexiVocabStore) {
      const version = await window.__lexiVocabStore.getCachedVersion(lang);
      if (version) {
        const hasAudio = await window.__lexiVocabStore.hasAudioCached(lang);
        statusEl.textContent = hasAudio ? '🔊' : '';
        statusEl.className = 'lang-option-status';
        if (deleteBtn) deleteBtn.classList.remove('hidden');
      } else {
        statusEl.textContent = t('settings_needs_download');
        statusEl.className = 'lang-option-status needs-download';
        if (deleteBtn) deleteBtn.classList.add('hidden');
      }
    }
  }

  // Wire up delete handlers
  document.querySelectorAll('.lang-delete-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const lang = newBtn.dataset.lang;

      if (!confirm(t('settings_delete_confirm', { lang: langName(lang) }))) return;

      await window.__lexiVocabStore?.deleteLanguage(lang);

      // If this was the active language, switch to English
      if (viewState.currentLang === lang) {
        viewState.currentLang = 'en';
        await chromeStorageSet({ language: viewState.currentLang });
        await loadDictionary(viewState.currentLang);
        await loadGrammarFeatures(viewState.currentLang);
        initGrammarSettings();
        chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: viewState.currentLang });
      }

      await updateLanguageListStatus();
      buildLangSwitcher();
    });
  });
}

function showDownloadStatus(lang, message) {
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = `
    <div class="results-placeholder">
      <p style="font-weight:600;">${langName(lang)}</p>
      <p>${message}</p>
    </div>`;
}

function hideDownloadStatus() {
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = `<div class="results-placeholder"><p>${t('search_placeholder_text')}</p></div>`;
}

/**
 * Flatten bank-based dictionary into a searchable array
 */
function flattenBanks(dict) {
  const words = [];
  const banks = Object.keys(BANK_TO_POS);

  for (const bank of banks) {
    const bankData = dict[bank];
    if (!bankData || typeof bankData !== 'object') continue;

    for (const [wordId, entry] of Object.entries(bankData)) {
      if (wordId.startsWith('_')) continue; // Skip metadata

      words.push({
        ...entry,
        _wordId: wordId,
        _bank: bank,
        // Normalize fields for display
        partOfSpeech: bankToPos(bank),
        gender: entry.genus ? genusToGender(entry.genus) : null,
        grammar: entry.explanation?._description || null
      });
    }
  }

  return words;
}

function buildInflectionIndex(words) {
  const index = new Map();

  function addToIndex(key, entry, matchType, matchDetail) {
    if (!key || key === (entry.word || '').toLowerCase()) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ entry, matchType, matchDetail });
  }

  for (const entry of words) {
    // Verb conjugations
    if (entry.conjugations) {
      for (const [tenseName, tenseData] of Object.entries(entry.conjugations)) {
        if (!tenseData?.former) continue;
        const former = tenseData.former;
        if (Array.isArray(former)) {
          for (const form of former) {
            if (form) addToIndex(form.toLowerCase(), entry, 'conjugation', tenseName);
          }
        } else if (typeof former === 'object') {
          for (const [pronoun, form] of Object.entries(former)) {
            if (!form) continue;
            if (Array.isArray(form)) {
              for (const f of form) { if (f) addToIndex(f.toLowerCase(), entry, 'conjugation', `${pronoun} (${tenseName})`); }
            } else {
              addToIndex(form.toLowerCase(), entry, 'conjugation', `${pronoun} (${tenseName})`);
            }
          }
        }
      }
    }

    // Noun plurals
    if (entry._bank === 'nounbank') {
      if (entry.plural) {
        const plurals = Array.isArray(entry.plural) ? entry.plural : [entry.plural];
        for (let p of plurals) {
          if (!p || typeof p !== 'string') continue;
          if (p.startsWith('die ')) p = p.slice(4);
          addToIndex(p.toLowerCase(), entry, 'plural', null);
        }
      }
      if (entry.declension?.flertall) {
        for (const variant of [entry.declension.flertall.ubestemt, entry.declension.flertall.bestemt]) {
          if (!variant?.form) continue;
          let f = variant.form;
          if (f.startsWith('die ')) f = f.slice(4);
          addToIndex(f.toLowerCase(), entry, 'plural', null);
        }
      }
    }

    // Noun case forms (v2.0: cases.{case}.forms.{number}.{article})
    if (entry._bank === 'nounbank' && entry.cases) {
      for (const [caseName, caseData] of Object.entries(entry.cases)) {
        if (!caseData?.forms) continue;
        for (const [number, numberForms] of Object.entries(caseData.forms)) {
          if (!numberForms) continue; // plurale tantum: singular is null
          for (const [article, form] of Object.entries(numberForms)) {
            if (!form) continue;
            // Index full form e.g. "den hund" for exact match
            const fullForm = form.toLowerCase();
            addToIndex(fullForm, entry, 'case', `${caseName} ${number} ${article}`);
            // Also index bare noun without article prefix for bare search
            const parts = form.split(' ');
            if (parts.length > 1) {
              addToIndex(parts[parts.length - 1].toLowerCase(), entry, 'case', `${caseName} ${number} ${article}`);
            }
          }
        }
      }
    }

    // Typos — index common misspellings (særskriving splits, missing diacritics, etc.)
    if (entry.typos && Array.isArray(entry.typos)) {
      for (const typo of entry.typos) {
        addToIndex(typo.toLowerCase(), entry, 'typo', null);
      }
    }

    // Accepted forms — alternative valid spellings
    if (entry.acceptedForms && Array.isArray(entry.acceptedForms)) {
      for (const form of entry.acceptedForms) {
        addToIndex(form.toLowerCase(), entry, 'typo', null);
      }
    }
  }

  return index;
}

// Phase 30-01: legacy updateLangLabels removed — dictionary-view owns it now;
// the delegator after initSearch routes calls into the mounted view.

// ── Grammar Features ────────────────────────────────────────
function getPresetFeatures(preset) {
  if (!preset || !Array.isArray(preset.features)) return new Set();
  return new Set(preset.features);
}

function detectActivePreset() {
  if (!grammarFeatures || !grammarFeatures.presets) return null;
  for (const preset of grammarFeatures.presets) {
    const presetSet = new Set(preset.features);
    if (presetSet.size !== enabledFeatures.size) continue;
    let match = true;
    for (const id of presetSet) {
      if (!enabledFeatures.has(id)) { match = false; break; }
    }
    if (match) return preset.id;
  }
  return null;
}

function updatePresetHighlight() {
  const activeId = detectActivePreset();
  document.querySelectorAll('.grammar-preset-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.presetId === activeId);
  });
}

async function applyPreset(presetId) {
  const preset = grammarFeatures.presets.find(p => p.id === presetId);
  if (!preset) return;
  enabledFeatures = getPresetFeatures(preset);

  // Update checkboxes if visible
  document.querySelectorAll('#grammar-features-container input[type="checkbox"]').forEach(cb => {
    cb.checked = enabledFeatures.has(cb.dataset.featureId);
  });

  updatePresetHighlight();
  await saveAndNotifyGrammarChange();
}

async function saveAndNotifyGrammarChange() {
  const stored = (await chromeStorageGet('enabledGrammarFeatures')) || {};
  stored[viewState.currentLang] = Array.from(enabledFeatures);
  await chromeStorageSet({ enabledGrammarFeatures: stored });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'GRAMMAR_FEATURES_CHANGED',
        features: Array.from(enabledFeatures)
      }).catch(() => {});
    }
  });

  const input = document.getElementById('search-input');
  if (input.value.trim()) {
    performSearch(input.value.trim());
  }
}

async function loadGrammarFeatures(lang) {
  try {
    // Try vocab store first (grammar features are embedded in language pack)
    if (window.__lexiVocabStore) {
      let cached = await window.__lexiVocabStore.getCachedGrammarFeatures(lang);
      // Tolerate old-shape (flat array) cached payloads from pre-fix bundles —
      // wrap so downstream `grammarFeatures.features` access works.
      if (Array.isArray(cached)) cached = { features: cached, categories: [], presets: [] };
      if (cached && Array.isArray(cached.features)) {
        grammarFeatures = cached;
        // Load enabled features from storage, default to all enabled
        const stored = await chromeStorageGet('enabledGrammarFeatures');
        if (stored && stored[lang]) {
          enabledFeatures = new Set(stored[lang]);
        } else {
          const basicPreset = grammarFeatures.presets?.find(p => p.id === 'basic');
          enabledFeatures = basicPreset ? getPresetFeatures(basicPreset) : new Set(grammarFeatures.features.map(f => f.id));
        }
        return;
      }
    }

    // Fall back to bundled file
    let gfData = null;
    try {
      const url = chrome.runtime.getURL(`data/grammarfeatures-${lang}.json`);
      const res = await fetch(url);
      if (res.ok) gfData = await res.json();
    } catch { /* bundled file missing */ }
    if (!gfData) return;
    grammarFeatures = gfData;

    // Load enabled features from storage, default to basic preset
    const stored = await chromeStorageGet('enabledGrammarFeatures');
    if (stored && stored[lang]) {
      enabledFeatures = new Set(stored[lang]);
    } else {
      const basicPreset = grammarFeatures.presets?.find(p => p.id === 'basic');
      enabledFeatures = basicPreset ? getPresetFeatures(basicPreset) : new Set(grammarFeatures.features.map(f => f.id));
    }
  } catch (e) {
    console.error('Failed to load grammar features:', e);
    grammarFeatures = null;
  }
}

async function initGrammarSettings() {
  const container = document.getElementById('grammar-features-container');
  const presetSelector = document.getElementById('grammar-preset-selector');
  const customizeToggle = document.getElementById('grammar-customize-toggle');
  if (!container || !grammarFeatures) return;

  // Build preset pills
  if (presetSelector && grammarFeatures.presets) {
    let presetHtml = '';
    for (const preset of grammarFeatures.presets) {
      presetHtml += `<button type="button" class="grammar-preset-pill" data-preset-id="${preset.id}">${escapeHtml(preset.name)}</button>`;
    }
    presetSelector.innerHTML = presetHtml;

    presetSelector.querySelectorAll('.grammar-preset-pill').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(btn.dataset.presetId));
    });

    updatePresetHighlight();
  }

  // Customize toggle (expand/collapse checkboxes)
  // Replace handler to avoid duplicates when called on language change
  if (customizeToggle) {
    const newToggle = customizeToggle.cloneNode(true);
    customizeToggle.replaceWith(newToggle);
    newToggle.addEventListener('click', () => {
      const isExpanded = container.classList.contains('grammar-features-expanded');
      if (isExpanded) {
        container.classList.add('grammar-features-collapsed');
        container.classList.remove('grammar-features-expanded');
      } else {
        container.classList.remove('grammar-features-collapsed');
        container.classList.add('grammar-features-expanded');
      }
      newToggle.classList.toggle('expanded', !isExpanded);
    });
  }

  // Group features by category
  const byCategory = {};
  for (const feature of grammarFeatures.features) {
    if (!byCategory[feature.category]) {
      byCategory[feature.category] = [];
    }
    byCategory[feature.category].push(feature);
  }

  // Build UI grouped by category
  let html = '';
  for (const cat of grammarFeatures.categories) {
    const features = byCategory[cat.id] || [];
    if (features.length === 0) continue;

    html += `<div class="grammar-category">
      <h4 class="grammar-category-title">${escapeHtml(cat.name)}</h4>
      <div class="grammar-features-list">`;

    for (const feature of features) {
      const checked = enabledFeatures.has(feature.id) ? 'checked' : '';
      html += `
        <label class="grammar-feature-item">
          <input type="checkbox" data-feature-id="${feature.id}" ${checked}>
          <span class="grammar-feature-name">${escapeHtml(feature.name)}</span>
        </label>`;
    }

    html += '</div></div>';
  }

  container.innerHTML = html;

  // Attach change listeners
  container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const featureId = checkbox.dataset.featureId;
      if (checkbox.checked) {
        enabledFeatures.add(featureId);
      } else {
        enabledFeatures.delete(featureId);
      }

      updatePresetHighlight();
      await saveAndNotifyGrammarChange();
    });
  });
}

/**
 * Check if a grammar feature is enabled
 */
function isFeatureEnabled(featureId) {
  if (enabledFeatures.has(featureId)) return true;
  // Also check language-specific variants (e.g., grammar_articles → grammar_nb_genus)
  const langPrefix = `grammar_${currentLang}_`;
  // Map generic feature IDs to language-specific equivalents
  const genericToLangMap = {
    'grammar_articles': [`${langPrefix}genus`],
    'grammar_plural': [`${langPrefix}flertall`, `${langPrefix}fleirtal`, `${langPrefix}plural`],
    'grammar_present': [`${langPrefix}presens`, `${langPrefix}presente`, `${langPrefix}present`],
    'grammar_preteritum': [`${langPrefix}preteritum`, `${langPrefix}preterito`],
    'grammar_perfektum': [`${langPrefix}perfektum`, `${langPrefix}perfecto`, `${langPrefix}passe_compose`],
    'grammar_comparative': [`${langPrefix}komparativ`, `${langPrefix}comparative`],
    'grammar_superlative': [`${langPrefix}superlativ`, `${langPrefix}superlative`],
    'grammar_noun_declension': [`${langPrefix}noun_forms`, `${langPrefix}bestemt_form`],
    'grammar_adjective_declension': [`${langPrefix}adj_declension`],
  };
  const langIds = genericToLangMap[featureId];
  if (langIds) {
    return langIds.some(id => enabledFeatures.has(id));
  }
  return false;
}

/**
 * Get the allowed pronouns based on enabled pronoun features
 */
function getAllowedPronouns() {
  // Language-specific pronoun features (ordered most → least permissive)
  const langPronouns = {
    de: [
      { id: 'grammar_pronouns_all', pronouns: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] },
      { id: 'grammar_pronouns_singular_wir', pronouns: ['ich', 'du', 'er/sie/es', 'wir'] },
      { id: 'grammar_pronouns_ich_du', pronouns: ['ich', 'du'] }
    ],
    es: [
      { id: 'grammar_es_pronouns_all', pronouns: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'] },
      { id: 'grammar_es_pronouns_singular_nosotros', pronouns: ['yo', 'tú', 'él/ella/usted', 'nosotros'] },
      { id: 'grammar_es_pronouns_yo_tu', pronouns: ['yo', 'tú'] }
    ],
    fr: [
      { id: 'grammar_fr_pronouns_all', pronouns: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] },
      { id: 'grammar_fr_pronouns_singular_nous', pronouns: ['je', 'tu', 'il/elle/on', 'nous'] },
      { id: 'grammar_fr_pronouns_je_tu', pronouns: ['je', 'tu'] }
    ]
  };

  const features = langPronouns[viewState.currentLang];
  if (features) {
    for (const pf of features) {
      if (enabledFeatures.has(pf.id)) {
        return new Set(pf.pronouns);
      }
    }
    // Default: all pronouns for this language
    return new Set(features[0].pronouns);
  }

  // Non-pronoun languages (NB, NN, EN) — return empty set (no filtering)
  return null;
}

// ── Search / Dictionary view (Phase 30-01: extracted to dictionary-view.js) ──
// initSearch mounts the dictionary view module against #view-dictionary and
// stores the handle so legacy call-sites (buildLangSwitcher, updateLangLabels,
// performSearch) can delegate. The view owns its own search input wiring,
// rendering pipeline, audio playback, and compound-card UI; popup.js owns
// state mutations and re-mounting on language switch.

const LANG_FLAGS = { de: '\ud83c\udde9\ud83c\uddea', es: '\ud83c\uddea\ud83c\uddf8', fr: '\ud83c\uddeb\ud83c\uddf7', en: '\ud83c\uddec\ud83c\udde7', nn: '\ud83c\uddf3\ud83c\uddf4', nb: '\ud83c\uddf3\ud83c\uddf4' };

// HTML-escape helper — kept in popup.js because initGrammarSettings still uses
// it for the preset/feature labels. Dictionary view has its own copy.
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : str;
  return d.innerHTML;
}

// Vocab adapter mirrors lockdown's host.__lexiVocab shape so the dictionary
// view module is portable. The adapter delegates to popup.js's own bundled
// vocab-store + helpers.
function buildVocabAdapter() {
  return {
    BUNDLED_LANGUAGES,
    LANG_FLAGS,
    listCachedLanguages: () => window.__lexiVocabStore
      ? window.__lexiVocabStore.listCachedLanguages()
      : Promise.resolve([]),
    getCachedLanguage: (lang) => window.__lexiVocabStore
      ? window.__lexiVocabStore.getCachedLanguage(lang)
      : Promise.resolve(null),
    hasAudioCached: (lang) => window.__lexiVocabStore
      ? window.__lexiVocabStore.hasAudioCached(lang)
      : Promise.resolve(false),
    getAudioFile: (lang, filename) => window.__lexiVocabStore
      ? window.__lexiVocabStore.getAudioFile(lang, filename)
      : Promise.resolve(null),
    decomposeCompound: (q, genusMap, lang) => self.__lexiVocabCore && self.__lexiVocabCore.decomposeCompound
      ? self.__lexiVocabCore.decomposeCompound(q, genusMap, lang)
      : null,
    norwegianInfinitive,
    generatedFromRefs,
    // getTranslation defers to popup's getTranslation, which already honors
    // viewState.noDictionary / nbTranslationIndex.
    getTranslation: (entry, _state, _uiLang) => getTranslation(entry),
  };
}

const chromeStorageAdapter = {
  get: chromeStorageGet,
  set: chromeStorageSet,
};

function initSearch() {
  const container = document.getElementById('view-dictionary');
  if (!container) return;

  // Tear down any prior mount (e.g. on hot-reload / settings change re-mount)
  if (dictionaryViewHandle && typeof dictionaryViewHandle.destroy === 'function') {
    dictionaryViewHandle.destroy();
    dictionaryViewHandle = null;
  }

  const view = self.__lexiDictionaryView;
  if (!view || typeof view.mount !== 'function') {
    console.error('Leksihjelp: dictionary-view.js failed to load');
    return;
  }

  dictionaryViewHandle = view.mount(container, {
    state: viewState,
    vocab: buildVocabAdapter(),
    storage: chromeStorageAdapter,
    runtime: chrome.runtime,
    t,
    getUiLanguage,
    langName,
    isFeatureEnabled,
    getAllowedPronouns,
    loadDictionary,
    loadGrammarFeatures,
    initGrammarSettings,
    audioEnabled: true,
    BACKEND_URL,
    onLanguageChanged: () => {
      // Lang switcher mutated viewState.currentLang — keep settings list in
      // sync (active highlight + audio-cache pill).
      updateLanguageListStatus();
    },
  });

  // Initial label paint (in case dictionary already loaded before mount).
  if (dictionaryViewHandle && typeof dictionaryViewHandle.updateLangLabels === 'function') {
    dictionaryViewHandle.updateLangLabels();
  }
}

// Legacy delegators — still called from initVocabUpdateNotice, initSettings,
// updateLanguageListStatus, etc. They now route through the mounted view.
async function buildLangSwitcher() {
  if (dictionaryViewHandle && typeof dictionaryViewHandle.rebuildLangSwitcher === 'function') {
    await dictionaryViewHandle.rebuildLangSwitcher();
  }
}

function updateLangLabels() {
  if (dictionaryViewHandle && typeof dictionaryViewHandle.updateLangLabels === 'function') {
    dictionaryViewHandle.updateLangLabels();
  }
}

function performSearch(query) {
  if (dictionaryViewHandle && typeof dictionaryViewHandle.refresh === 'function') {
    dictionaryViewHandle.refresh(query);
  }
}


// ── Settings ───────────────────────────────────────────────
// ── Phase 27: Exam mode (toggle, badge, lockdown lock awareness) ───────────
//
// Storage keys:
//   examMode (bool)        — student-controlled toggle, persisted across popup re-opens.
//   examModeLocked (bool)  — set by lockdown loader when teacher mandates exam mode.
//                           When true, the toggle renders ON + disabled, and the
//                           "Slått på av lærer" caption is shown. We also force
//                           examMode = true defensively in case lockdown set only
//                           the lock flag.
//
// Surfaces hidden in popup when examMode = true (per exam-registry.js):
//   popup.search           → #search-results (and the search input row)
//   popup.conjugationTable → conjugation tables in rendered results
//   popup.ttsButton        → in-result audio buttons
//   popup.grammarFeaturesPopover → grammar customisation block
//
// Implementation choice: we don't tear down the search rendering pipeline; we
// just hide the dictionary view's main containers via the [hidden] attribute
// so toggling off restores cleanly without re-running the hydrate path.
async function initExamMode() {
  const toggle = document.getElementById('exam-mode-toggle');
  const badge = document.getElementById('exam-mode-badge');
  const lockedCaption = document.querySelector('#exam-mode-group .exam-mode-locked-caption');
  if (!toggle || !badge) return;

  const stored = await new Promise(resolve =>
    chrome.storage.local.get(['examMode', 'examModeLocked'], resolve)
  );
  let examMode = !!stored.examMode;
  let locked = !!stored.examModeLocked;

  // If locked, force examMode on (defensive) and persist.
  if (locked && !examMode) {
    examMode = true;
    await chromeStorageSet({ examMode: true });
  }

  applyExamModeUi();

  // Dev-only: simulate Skriveøkt / lockdown teacher-lock toggle.
  const devBtn = document.getElementById('exam-mode-dev-simulate');
  if (devBtn) {
    const renderDevBtn = () => {
      devBtn.textContent = locked
        ? 'Fjern lærer-lås (dev)'
        : 'Simuler lærer-lås (dev)';
    };
    renderDevBtn();
    devBtn.addEventListener('click', async () => {
      const next = !locked;
      const patch = { examModeLocked: next };
      if (!next) patch.examMode = false;
      await chromeStorageSet(patch);
      // onChanged listener will update local state + UI.
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && 'examModeLocked' in changes) renderDevBtn();
    });
  }

  toggle.addEventListener('change', async (e) => {
    if (locked) {
      e.preventDefault();
      e.target.checked = true;
      return;
    }
    examMode = !!e.target.checked;
    await chromeStorageSet({ examMode });
    applyExamModeUi();
  });

  // Stay in sync across multiple popup instances (e.g. side-panel + popup).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if ('examMode' in changes) {
      examMode = !!changes.examMode.newValue;
      applyExamModeUi();
    }
    if ('examModeLocked' in changes) {
      locked = !!changes.examModeLocked.newValue;
      if (locked) examMode = true;
      applyExamModeUi();
    }
  });

  function applyExamModeUi() {
    toggle.checked = examMode;
    toggle.disabled = locked;
    if (lockedCaption) lockedCaption.hidden = !locked;
    badge.hidden = !examMode;

    // Hide non-exam-safe popup surfaces when exam mode is on.
    // Surface IDs map to DOM nodes here. We use [hidden] (display:none) so
    // toggling restores cleanly without re-running expensive init paths.
    //
    // The popup document does NOT load spell-check-core.js (that pulls the
    // whole rule engine), so self.__lexiExam may be undefined here. We fall
    // through to a direct registry lookup using __lexiExamRegistry, which
    // popup.html loads as exam-registry.js. Without the registry the gate
    // would default to "hide everything in exam mode" — too aggressive now
    // that policy says static reference surfaces (popup.search,
    // grammarFeaturesPopover, …) are explicitly exam-safe.
    const helper = (self.__lexiExam) || null;
    function isSafeBySurface(surfaceId) {
      if (!examMode) return true;
      if (helper && typeof helper.isSurfaceSafe === 'function') {
        return helper.isSurfaceSafe(surfaceId, examMode);
      }
      const reg = self.__lexiExamRegistry;
      if (Array.isArray(reg)) {
        const e = reg.find(x => x && x.id === surfaceId);
        return e ? !!(e.exam && e.exam.safe === true) : false;
      }
      // Last-resort fail-safe: hide when exam is on and we can't decide.
      return false;
    }
    function gateNode(node, surfaceId) {
      if (!node) return;
      node.hidden = !isSafeBySurface(surfaceId);
    }
    // popup.search → entire dictionary view (search input + results)
    gateNode(document.getElementById('view-dictionary'), 'popup.search');
    // popup.grammarFeaturesPopover → grammar settings block (within settings view)
    const grammarBlock = document.querySelector('#grammar-features-container')?.closest('.settings-group');
    gateNode(grammarBlock, 'popup.grammarFeaturesPopover');
    // popup.ttsButton & popup.conjugationTable are rendered as part of search
    // results, which are already hidden via #view-dictionary above. No-op here
    // — kept as named gates for future granular control.
  }
}

async function initSettings() {
  const codeInput = document.getElementById('setting-access-code');
  const verifyBtn = document.getElementById('verify-code-btn');
  const codeStatus = document.getElementById('code-status');
  const predictionToggle = document.getElementById('setting-prediction');
  const alternatesToggle = document.getElementById('setting-spellcheck-alternates');
  const savedCode = await chromeStorageGet('accessCode');
  if (savedCode) codeInput.value = savedCode;
  const predEnabled = await chromeStorageGet('predictionEnabled');
  predictionToggle.checked = predEnabled === true;
  const altStored = await chromeStorageGet('spellCheckAlternatesVisible');
  alternatesToggle.checked = altStored === true;  // default false when unset

  // Initialize language list with download status
  await updateLanguageListStatus();

  // Language list buttons
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (btn.classList.contains('downloading')) return;

      // Check if download is needed
      const isBundled = BUNDLED_LANGUAGES.has(lang);
      let needsDownload = false;
      if (!isBundled && window.__lexiVocabStore) {
        const cached = await window.__lexiVocabStore.getCachedVersion(lang);
        needsDownload = !cached;
      }

      // Confirm download if needed
      if (needsDownload) {
        const confirmed = confirm(
          t('settings_download_confirm', { lang: langName(lang) })
        );
        if (!confirmed) return;
      }

      // Update active state
      document.querySelectorAll('.lang-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (needsDownload) {
        btn.classList.add('downloading');
        const statusEl = btn.querySelector('.lang-option-status');
        statusEl.textContent = t('settings_downloading');
        statusEl.className = 'lang-option-status downloading';
      }

      // Switch language
      viewState.currentLang = lang;
      await chromeStorageSet({ language: viewState.currentLang });
      try {
        await loadDictionary(viewState.currentLang);
        await loadGrammarFeatures(viewState.currentLang);
        initGrammarSettings();
        chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: viewState.currentLang });
      } catch (e) {
        console.error('Language switch failed:', e);
      }

      // Update status and rebuild lang switcher so dictionary view is ready
      btn.classList.remove('downloading');
      await updateLanguageListStatus();
      await buildLangSwitcher();
    });
  });

  // Access code verification
  verifyBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code) return;

    verifyBtn.disabled = true;
    verifyBtn.textContent = '...';

    try {
      const res = await fetch(`${BACKEND_URL}/api/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lexi-Client': 'lexi-extension'
        },
        body: JSON.stringify({ code })
      });

      if (res.status === 429) {
        codeStatus.textContent = t('settings_code_rate_limited');
        codeStatus.className = 'code-status error';
      } else {
        const data = await res.json();
        if (data.valid) {
          await chromeStorageSet({ accessCode: code, isAuthenticated: true });
          codeStatus.textContent = t('settings_code_valid');
          codeStatus.className = 'code-status success';
        } else {
          await chromeStorageSet({ isAuthenticated: false });
          codeStatus.textContent = t('settings_code_invalid');
          codeStatus.className = 'code-status error';
        }
      }
    } catch {
      // Server unreachable — no offline fallback. Browser TTS still works.
      codeStatus.innerHTML = `${t('settings_code_offline')}<br><span style="font-size:11px;color:var(--text-muted);">${t('settings_code_offline_hint')}</span>`;
      codeStatus.className = 'code-status error';
    }

    verifyBtn.disabled = false;
    verifyBtn.textContent = t('settings_code_verify');
  });

  // Prediction toggle
  predictionToggle.addEventListener('change', async () => {
    await chromeStorageSet({ predictionEnabled: predictionToggle.checked });
    chrome.runtime.sendMessage({
      type: 'PREDICTION_TOGGLED',
      enabled: predictionToggle.checked
    });
  });

  // Spell-check multi-suggest alternates toggle — Plan 05 consumer reads
  // via chrome.storage.onChanged in spell-check.js. No runtime message needed.
  alternatesToggle.addEventListener('change', async () => {
    await chromeStorageSet({ spellCheckAlternatesVisible: alternatesToggle.checked });
  });
}

// ── Navigation ─────────────────────────────────────────────
function initNav() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsBackBtn = document.getElementById('settings-back-btn');

  function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    navBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });
  }

  navBtns.forEach(btn => {
    if (btn.dataset.view) {
      btn.addEventListener('click', () => showView(btn.dataset.view));
    }
  });

  settingsBtn.addEventListener('click', () => showView('settings'));
  settingsBackBtn.addEventListener('click', async () => {
    showView('dictionary');
    await buildLangSwitcher();
  });
}

// ── Pin (Fest) Button ──────────────────────────────────────
async function initPinButton() {
  const pinBtn = document.getElementById('pin-btn');
  if (!pinBtn) return;

  const params = new URLSearchParams(location.search);
  if (params.get('pinned') === '1') {
    pinBtn.classList.add('hidden');
    return;
  }

  // Hide Fest in side panel context (already persistent)
  if (window.location.pathname.includes('popup.html') && window !== window.top) {
    pinBtn.classList.add('hidden');
    return;
  }

  pinBtn.addEventListener('click', async () => {
    // Prefer Side Panel API (persistent, stays alongside page)
    if (chrome.sidePanel) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
        return;
      } catch (err) {
        console.warn('Side panel open failed, falling back to popup:', err);
      }
    }
    // Fallback: detached popup window
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup/popup.html?pinned=1'),
        type: 'popup',
        width: 420,
        height: 680,
      });
    } catch (err) {
      console.error('Failed to open pinned window:', err);
      return;
    }
    window.close();
  });
}

// ── Skriv button (pencil) ──────────────────────────────────
// Opens the Papertek writing tool in a new tab. Always visible in the
// header so students can reach it regardless of dictionary state.
function initSkrivButton() {
  const btn = document.getElementById('skriv-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    chrome.tabs
      ? chrome.tabs.create({ url: 'https://skriv.papertek.app' })
      : window.open('https://skriv.papertek.app', '_blank');
  });
}

// ── Pause Button ───────────────────────────────────────────
async function initPauseButton() {
  const pauseBtn = document.getElementById('pause-btn');
  const pauseLabel = pauseBtn.querySelector('.pause-label');

  // Load saved pause state
  const paused = await chromeStorageGet('lexiPaused');
  if (paused) {
    pauseBtn.classList.add('paused');
    pauseLabel.textContent = t('nav_start');
  }

  pauseBtn.addEventListener('click', async () => {
    const isPaused = pauseBtn.classList.toggle('paused');
    pauseLabel.textContent = isPaused ? t('nav_start') : t('nav_pause');

    await chromeStorageSet({ lexiPaused: isPaused });

    // Broadcast to all content scripts
    chrome.runtime.sendMessage({
      type: 'LEXI_PAUSED',
      paused: isPaused
    });
  });
}

// ── Dark Mode ──────────────────────────────────────────────
async function initDarkMode() {
  const toggle = document.getElementById('setting-darkmode');
  const stored = await chromeStorageGet('darkMode');

  // Determine initial state: manual override or system preference
  if (stored === true) {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.checked = true;
  } else if (stored === false) {
    document.documentElement.removeAttribute('data-theme');
    toggle.checked = false;
  } else {
    // No manual setting — follow system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
      toggle.checked = true;
    }
  }

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      await chromeStorageSet({ darkMode: true });
    } else {
      document.documentElement.removeAttribute('data-theme');
      await chromeStorageSet({ darkMode: false });
    }
  });
}

// ── Vipps Login & Account ─────────────────────────────────
async function initAuth() {
  const loginBtn = document.getElementById('vipps-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const subscribeBtn = document.getElementById('subscribe-btn');
  const subscribeYearlyBtn = document.getElementById('subscribe-yearly-btn');

  if (loginBtn) loginBtn.addEventListener('click', loginWithVipps);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (subscribeBtn) subscribeBtn.addEventListener('click', subscribe);
  if (subscribeYearlyBtn) subscribeYearlyBtn.addEventListener('click', subscribeYearly);

  const topupBtn = document.getElementById('topup-btn');
  if (topupBtn) topupBtn.addEventListener('click', buyTopup);

  // Check existing session
  await checkSession();
}

async function loginWithVipps() {
  const loginBtn = document.getElementById('vipps-login-btn');
  loginBtn.disabled = true;
  loginBtn.textContent = t('auth_opening_vipps');

  try {
    // Delegate to service worker so the flow survives popup closing
    const result = await chrome.runtime.sendMessage({ type: 'START_VIPPS_LOGIN' });

    if (result?.success) {
      await handleLoginSuccess(null, result.user);
    } else {
      throw new Error(result?.error || 'Login failed');
    }
  } catch (err) {
    console.error('Vipps login failed:', err);
    loginBtn.disabled = false;
    loginBtn.textContent = t('auth_login_vipps');

    // Show error briefly
    const loggedOut = document.getElementById('auth-logged-out');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'code-status error';
    errorDiv.textContent = err.message.includes('cancelled') || err.message.includes('closed')
      ? t('auth_login_cancelled')
      : t('auth_login_failed');
    loggedOut.insertBefore(errorDiv, loggedOut.querySelector('.legacy-code-section'));
    setTimeout(() => errorDiv.remove(), 4000);
  }
}

async function handleLoginSuccess(token, user) {
  const updates = {
    userName: user?.name || '',
    userEmail: user?.email || '',
    subscriptionStatus: user?.subscriptionStatus || 'none',
    quotaBalance: user?.quotaBalance ?? 10000,
    quotaMaxBalance: user?.quotaMaxBalance || 20000,
    isAuthenticated: user?.subscriptionStatus === 'active'
  };
  // Only set token if provided (service worker login stores it directly)
  if (token) updates.sessionToken = token;
  await chromeStorageSet(updates);

  chrome.runtime.sendMessage({
    type: 'AUTH_CHANGED',
    isAuthenticated: user?.subscriptionStatus === 'active'
  });

  updateAuthUI();
}

async function checkSession() {
  const token = await chromeStorageGet('sessionToken');
  if (!token) {
    updateAuthUI();
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Lexi-Client': 'lexi-extension'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired or invalid — clear session
        await chromeStorageSet({ sessionToken: null, isAuthenticated: false });
      }
      updateAuthUI();
      return;
    }

    const data = await res.json();
    await chromeStorageSet({
      userName: data.user.name,
      userEmail: data.user.email,
      subscriptionStatus: data.user.subscriptionStatus,
      quotaBalance: data.user.quotaBalance ?? 0,
      quotaMaxBalance: data.user.quotaMaxBalance || 20000,
      isAuthenticated: data.user.subscriptionStatus === 'active'
    });
  } catch {
    // Offline — use cached data
  }

  updateAuthUI();
}

async function updateAuthUI() {
  const token = await chromeStorageGet('sessionToken');
  const loggedOutDiv = document.getElementById('auth-logged-out');
  const loggedInDiv = document.getElementById('auth-logged-in');

  if (!token) {
    loggedOutDiv?.classList.remove('hidden');
    loggedInDiv?.classList.add('hidden');
    return;
  }

  loggedOutDiv?.classList.add('hidden');
  loggedInDiv?.classList.remove('hidden');

  // Populate user info
  const name = await chromeStorageGet('userName');
  const email = await chromeStorageGet('userEmail');
  const status = await chromeStorageGet('subscriptionStatus') || 'none';
  const quotaBalance = (await chromeStorageGet('quotaBalance')) ?? 0;
  const quotaMaxBalance = (await chromeStorageGet('quotaMaxBalance')) || 20000;

  const nameEl = document.getElementById('user-name');
  const emailEl = document.getElementById('user-email');
  const badge = document.getElementById('subscription-badge');
  const usageSection = document.getElementById('usage-section');
  const subscribeSection = document.getElementById('subscribe-section');

  if (nameEl) nameEl.textContent = name || '';
  if (emailEl) emailEl.textContent = email || '';

  // Subscription badge
  if (badge) {
    if (status === 'active') {
      badge.textContent = t('auth_sub_active');
      badge.className = 'subscription-badge active';
    } else if (status === 'pending') {
      badge.textContent = t('auth_sub_pending');
      badge.className = 'subscription-badge pending';
    } else {
      badge.textContent = t('auth_sub_none');
      badge.className = 'subscription-badge none';
    }
  }

  // Usage bar (only for active subscriptions)
  if (status === 'active') {
    usageSection?.classList.remove('hidden');
    subscribeSection?.classList.add('hidden');

    const usageText = document.getElementById('usage-text');
    const usageFill = document.getElementById('usage-bar-fill');
    // Show remaining balance as percentage of max
    const pct = Math.min(100, (quotaBalance / quotaMaxBalance) * 100);

    if (usageText) usageText.textContent = t('auth_usage_chars', { count: quotaBalance.toLocaleString('nb-NO') });
    if (usageFill) {
      usageFill.style.width = `${pct}%`;
      let colorClass = 'usage-bar-fill';
      if (quotaBalance < 2000) colorClass += ' critical';
      else if (quotaBalance < 10000) colorClass += ' warning';
      usageFill.className = colorClass;
    }

    // Show top-up button when below 10k chars
    const topupBtn = document.getElementById('topup-btn');
    if (topupBtn) {
      if (quotaBalance < 10000) {
        topupBtn.classList.remove('hidden');
      } else {
        topupBtn.classList.add('hidden');
      }
    }
  } else {
    usageSection?.classList.add('hidden');
    subscribeSection?.classList.remove('hidden');
  }
}

async function subscribe() {
  const subscribeBtn = document.getElementById('subscribe-btn');
  subscribeBtn.disabled = true;
  subscribeBtn.setAttribute('aria-busy', 'true');
  subscribeBtn.textContent = t('auth_subscribe_creating');

  try {
    const token = await chromeStorageGet('sessionToken');
    const res = await fetch(`${BACKEND_URL}/api/auth/subscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      }
    });

    if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);

    const data = await res.json();
    if (data.vippsConfirmationUrl) {
      // Open Vipps confirmation in a new tab
      chrome.tabs.create({ url: data.vippsConfirmationUrl });
    }
  } catch (err) {
    console.error('Subscribe failed:', err);
    subscribeBtn.disabled = false;
    subscribeBtn.removeAttribute('aria-busy');
    subscribeBtn.textContent = t('auth_subscribe_monthly');
  }
}

async function subscribeYearly() {
  const btn = document.getElementById('subscribe-yearly-btn');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = t('auth_opening_vipps');

  try {
    const token = await chromeStorageGet('sessionToken');
    const res = await fetch(`${BACKEND_URL}/api/auth/subscribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      },
      body: JSON.stringify({ plan: 'yearly' })
    });

    if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);

    const data = await res.json();
    if (data.vippsConfirmationUrl) {
      chrome.tabs.create({ url: data.vippsConfirmationUrl });
    }
  } catch (err) {
    console.error('Yearly subscribe failed:', err);
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = t('auth_subscribe_yearly');
  }
}

async function buyTopup() {
  const btn = document.getElementById('topup-btn');
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.textContent = t('auth_topup_opening');

  try {
    const token = await chromeStorageGet('sessionToken');
    const res = await fetch(`${BACKEND_URL}/api/auth/topup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Topup failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.vippsConfirmationUrl) {
      chrome.tabs.create({ url: data.vippsConfirmationUrl });
    }
  } catch (err) {
    console.error('Topup failed:', err);
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    btn.textContent = t('auth_topup');
  }
}

async function logout() {
  await chromeStorageSet({
    sessionToken: null,
    userName: null,
    userEmail: null,
    subscriptionStatus: null,
    quotaBalance: null,
    quotaMaxBalance: null,
    isAuthenticated: false
  });

  chrome.runtime.sendMessage({ type: 'AUTH_CHANGED', isAuthenticated: false });
  updateAuthUI();

  // Reset Vipps login button
  const loginBtn = document.getElementById('vipps-login-btn');
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.textContent = t('auth_login_vipps');
  }
}

// ── Bug Report Form ──────────────────────────────────────
function initReportForm() {
  const typeSelect = document.getElementById('report-type');
  const textArea = document.getElementById('report-text');
  const submitBtn = document.getElementById('report-submit');
  const statusEl = document.getElementById('report-status');
  if (!typeSelect || !submitBtn) return;

  function updateBtn() {
    submitBtn.disabled = !typeSelect.value || !textArea.value.trim();
  }
  typeSelect.addEventListener('change', updateBtn);
  textArea.addEventListener('input', updateBtn);

  submitBtn.addEventListener('click', async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sender...';
    statusEl.textContent = '';

    const stored = await new Promise(r => chrome.storage.local.get(['sessionToken', 'siteUrl', 'language'], r));
    const base = stored.siteUrl || 'https://leksihjelp.no';
    const headers = { 'Content-Type': 'application/json', 'X-Lexi-Client': 'lexi-extension' };
    if (stored.sessionToken) headers['Authorization'] = 'Bearer ' + stored.sessionToken;

    try {
      const resp = await fetch(base + '/api/report', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: typeSelect.value,
          description: textArea.value.trim(),
          language: stored.language || null,
        }),
      });
      if (resp.ok) {
        statusEl.textContent = '✓ Takk for rapporten!';
        statusEl.className = 'report-status report-ok';
        typeSelect.value = '';
        textArea.value = '';
        updateBtn();
      } else {
        statusEl.textContent = '✗ Kunne ikke sende. Prøv igjen.';
        statusEl.className = 'report-status report-err';
      }
    } catch (_) {
      statusEl.textContent = '✗ Nettverksfeil. Prøv igjen.';
      statusEl.className = 'report-status report-err';
    }
    submitBtn.textContent = 'Send rapport';
    submitBtn.disabled = false;
    updateBtn();
  });
}
