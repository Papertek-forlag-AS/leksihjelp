/**
 * Leksihjelp — Popup (dictionary search + settings)
 *
 * Adapted to use Papertek Vocabulary API bank-based structure
 */

const BACKEND_URL = 'https://leksihjelp.no';
const { t, initI18n, setUiLanguage, getUiLanguage, langName } = self.__lexiI18n;

let dictionary = null;
let noDictionary = null; // Norwegian dictionary for two-way lookups (nb or nn based on UI)
let currentAudio = null; // Currently playing audio
let allWords = []; // Flattened array of all words from all banks
let noWords = []; // Flattened Norwegian words (nb or nn)
let inflectionIndex = null; // Map: lowercased inflected form -> [{ entry, matchType, matchDetail }]
let currentLang = 'es';
let searchDirection = 'no-target'; // 'no-target' or 'target-no'
let grammarFeatures = null; // Grammar features metadata
let enabledFeatures = new Set(); // Set of enabled feature IDs

/**
 * Get the appropriate Norwegian translation for an entry,
 * respecting the user's UI language (nb vs nn).
 * Falls back to entry.translation if no linkedTo data.
 */
function getTranslation(entry) {
  if (!entry) return '';
  const ui = getUiLanguage();
  // If UI is nynorsk, prefer the nn link translation
  if (ui === 'nn' && entry.linkedTo?.nn?.translation) {
    return entry.linkedTo.nn.translation;
  }
  // If UI is bokmål (or default), prefer the nb link translation
  if (ui === 'nb' && entry.linkedTo?.nb?.translation) {
    return entry.linkedTo.nb.translation;
  }
  // Fallback: use the baked-in translation (typically nb)
  return entry.translation || '';
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
  pronounsbank: 'pronomen'
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

  currentLang = (await chromeStorageGet('language')) || null;

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
  if (!currentLang) currentLang = 'en';

  await loadDictionary(currentLang);
  await loadGrammarFeatures(currentLang);
  initSearch();
  initSettings();
  initUiLanguageSettings();
  initGrammarSettings();
  initNav();
  initPinButton();
  initSkrivButton();
  initPauseButton();
  initDarkMode();
  initAuth();
});

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
          currentLang = lang;
          await chromeStorageSet({ language: lang });
          chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: lang });

          picker.classList.add('hidden');
          resolve();
        } catch (err) {
          console.error('Language download failed:', err);
          status.textContent = t('picker_failed');
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
    dictionary = await loadLanguageData(lang);
    if (!dictionary) throw new Error('No dictionary data');

    allWords = flattenBanks(dictionary);
    inflectionIndex = buildInflectionIndex(allWords);
    updateLangLabels();

    // Load Norwegian dictionary for two-way lookups (match UI language: nn or nb)
    const noLang = getUiLanguage() === 'nn' ? 'nn' : 'nb';
    if (lang !== noLang) {
      try {
        noDictionary = await loadLanguageData(noLang);
        noWords = noDictionary ? flattenBanks(noDictionary) : [];
      } catch {
        noDictionary = null;
        noWords = [];
      }
    } else {
      noDictionary = null;
      noWords = [];
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
    if (!res.ok) return null;
    return res.json();
  } catch {
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
    const isActive = lang === currentLang;

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
      if (currentLang === lang) {
        currentLang = 'en';
        await chromeStorageSet({ language: currentLang });
        await loadDictionary(currentLang);
        await loadGrammarFeatures(currentLang);
        initGrammarSettings();
        chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: currentLang });
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
            if (form) addToIndex(form.toLowerCase(), entry, 'conjugation', `${pronoun} (${tenseName})`);
          }
        }
      }
    }

    // Noun plurals
    if (entry._bank === 'nounbank') {
      if (entry.plural) {
        let p = entry.plural;
        if (p.startsWith('die ')) p = p.slice(4);
        addToIndex(p.toLowerCase(), entry, 'plural', null);
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

function updateLangLabels() {
  if (!dictionary || !dictionary._metadata) return;
  const code = dictionary._metadata.language.toUpperCase();
  const uiCode = getUiLanguage().toUpperCase();
  const isMonolingual = getUiLanguage() === currentLang;

  document.querySelectorAll('.target-lang-code').forEach(el => {
    el.textContent = code;
  });

  // Update direction button labels
  const dirNoTarget = document.getElementById('dir-no-target');
  const dirTargetNo = document.getElementById('dir-target-no');
  if (dirNoTarget && dirTargetNo) {
    if (isMonolingual) {
      // Monolingual mode — hide direction toggle
      dirNoTarget.innerHTML = `<span class="target-lang-code">${code}</span> ${t('search_monolingual')}`;
      dirTargetNo.style.display = 'none';
      dirNoTarget.classList.add('active');
    } else {
      dirTargetNo.style.display = '';
      dirNoTarget.innerHTML = `${uiCode} → <span class="target-lang-code">${code}</span>`;
      dirTargetNo.innerHTML = `<span class="target-lang-code">${code}</span> → ${uiCode}`;
    }
  }
}

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
  stored[currentLang] = Array.from(enabledFeatures);
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
      const cached = await window.__lexiVocabStore.getCachedGrammarFeatures(lang);
      if (cached) {
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
    const url = chrome.runtime.getURL(`data/grammarfeatures-${lang}.json`);
    const res = await fetch(url);
    grammarFeatures = await res.json();

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

  const features = langPronouns[currentLang];
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

// ── Search ─────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const dirNoTarget = document.getElementById('dir-no-target');
  const dirTargetNo = document.getElementById('dir-target-no');

  let searchDebounceTimer;
  input.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !input.value);
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => performSearch(input.value.trim()), 150);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    showPlaceholder();
  });

  dirNoTarget.addEventListener('click', () => {
    searchDirection = 'no-target';
    dirNoTarget.classList.add('active');
    dirTargetNo.classList.remove('active');
    if (input.value.trim()) performSearch(input.value.trim());
  });

  dirTargetNo.addEventListener('click', () => {
    searchDirection = 'target-no';
    dirTargetNo.classList.add('active');
    dirNoTarget.classList.remove('active');
    if (input.value.trim()) performSearch(input.value.trim());
  });

  // Focus search on open
  input.focus();

  // Build language switcher
  buildLangSwitcher();
}

const LANG_FLAGS = { de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', nn: '🇳🇴', nb: '🇳🇴' };

async function buildLangSwitcher() {
  const container = document.getElementById('lang-switcher');
  if (!container) return;

  // Collect available languages: bundled + downloaded
  const available = [];

  // Bundled languages are always available
  for (const lang of BUNDLED_LANGUAGES) {
    available.push(lang);
  }

  // Check IndexedDB for downloaded languages
  if (window.__lexiVocabStore) {
    const cached = await window.__lexiVocabStore.listCachedLanguages();
    for (const c of cached) {
      if (!available.includes(c.language)) {
        available.push(c.language);
      }
    }
  }

  // Sort: current language first, then alphabetically
  available.sort((a, b) => {
    if (a === currentLang) return -1;
    if (b === currentLang) return 1;
    return langName(a).localeCompare(langName(b));
  });

  container.innerHTML = available.map(lang => `
    <button class="lang-switch-btn ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
      <span class="lang-switch-flag">${LANG_FLAGS[lang] || ''}</span>
      ${langName(lang)}
    </button>
  `).join('');

  // Click handlers
  container.querySelectorAll('.lang-switch-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      if (lang === currentLang) return;

      // Update active state
      container.querySelectorAll('.lang-switch-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Switch language
      currentLang = lang;
      await chromeStorageSet({ language: currentLang });
      await loadDictionary(currentLang);
      await loadGrammarFeatures(currentLang);
      initGrammarSettings();
      updateLangLabels();
      chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: currentLang });

      // Re-run search if there's a query
      const input = document.getElementById('search-input');
      if (input?.value.trim()) performSearch(input.value.trim());

      updateLanguageListStatus();
    });
  });
}

function performSearch(query) {
  if (!query || !allWords.length) {
    showPlaceholder();
    return;
  }

  const q = query.toLowerCase();

  // Monolingual mode: when UI language matches dictionary language (e.g., NB dict with NB UI)
  const isMonolingual = getUiLanguage() === currentLang;

  // Phase 1: Direct matches on base forms
  const directResults = [];
  for (const entry of allWords) {
    if (isMonolingual) {
      // Monolingual: always search by word
      if (entry.word && entry.word.toLowerCase().includes(q)) {
        directResults.push({ entry, inflectionHint: null });
      }
    } else if (searchDirection === 'no-target') {
      const trans = getTranslation(entry);
      if (trans && trans.toLowerCase().includes(q)) {
        directResults.push({ entry, inflectionHint: null });
      }
    } else {
      if (entry.word && entry.word.toLowerCase().includes(q)) {
        directResults.push({ entry, inflectionHint: null });
      }
    }
  }

  // Phase 1b: Two-way lookup via Norwegian dictionary's linkedTo
  // When searching no→target, also search nb words and follow links to target language
  if (searchDirection === 'no-target' && noWords.length > 0) {
    const directEntryWords = new Set(directResults.map(r => r.entry.word?.toLowerCase()));

    for (const noEntry of noWords) {
      if (!noEntry.word || !noEntry.word.toLowerCase().includes(q)) continue;
      if (!noEntry.linkedTo) continue;

      // Follow link to the target language
      const link = noEntry.linkedTo[currentLang];
      if (!link?.primary) continue;

      // Find the target entry in our dictionary
      const targetWordId = link.primary;
      for (const bank of Object.keys(BANK_TO_POS)) {
        const targetEntry = dictionary[bank]?.[targetWordId];
        if (targetEntry && !directEntryWords.has(targetEntry.word?.toLowerCase())) {
          // Build a result entry with the Norwegian word as context
          const flatEntry = allWords.find(w => w.word === targetEntry.word);
          if (flatEntry) {
            directResults.push({
              entry: flatEntry,
              inflectionHint: `«${noEntry.word}» → ${flatEntry.word}`
            });
            directEntryWords.add(flatEntry.word?.toLowerCase());
          }
        }
      }
    }
  }

  // Phase 2: Inflection matches (deduplicated against direct)
  const inflectionResults = [];
  const directEntrySet = new Set(directResults.map(r => r.entry));

  if (searchDirection === 'target-no') {
    if (inflectionIndex) {
      const matches = inflectionIndex.get(q) || [];
      for (const match of matches) {
        if (directEntrySet.has(match.entry)) continue;
        const hint = match.matchType === 'conjugation'
          ? t('result_inflection_conjugation', { query, word: match.entry.word })
          : match.matchType === 'typo'
            ? t('result_inflection_typo', { query, word: match.entry.word })
            : t('result_inflection_plural', { query, word: match.entry.word });
        inflectionResults.push({ entry: match.entry, inflectionHint: hint });
      }
    }
  } else {
    const infinitive = norwegianInfinitive(q);
    if (infinitive) {
      for (const entry of allWords) {
        if (directEntrySet.has(entry)) continue;
        const entryTrans = getTranslation(entry);
        if (!entryTrans) continue;
        const trans = entryTrans.toLowerCase();
        const stripped = trans.startsWith('å ') ? trans.slice(2) : trans;
        if (stripped === infinitive || stripped.startsWith(infinitive + ' ')
            || stripped.startsWith(infinitive + ',') || stripped.includes(', ' + infinitive)) {
          inflectionResults.push({
            entry,
            inflectionHint: t('result_inflection_conjugation', { query, word: infinitive })
          });
        }
      }
    }
  }

  // Phase 3: Sort direct results, split into starts-with vs contains
  const useWord = isMonolingual || searchDirection === 'target-no';
  directResults.sort((a, b) => {
    const fieldA = useWord ? a.entry.word : getTranslation(a.entry);
    const fieldB = useWord ? b.entry.word : getTranslation(b.entry);
    const la = fieldA.toLowerCase();
    const lb = fieldB.toLowerCase();
    if (la === q && lb !== q) return -1;
    if (lb === q && la !== q) return 1;
    if (la.startsWith(q) && !lb.startsWith(q)) return -1;
    if (lb.startsWith(q) && !la.startsWith(q)) return 1;
    return la.localeCompare(lb);
  });

  const directStartsWith = [];
  const directContains = [];
  for (const r of directResults) {
    const field = (useWord ? r.entry.word : getTranslation(r.entry)).toLowerCase();
    if (field === q || field.startsWith(q)) {
      directStartsWith.push(r);
    } else {
      directContains.push(r);
    }
  }

  inflectionResults.sort((a, b) => a.entry.word.localeCompare(b.entry.word));

  // Final order: exact/starts-with → inflection matches → contains
  const combined = [...directStartsWith, ...inflectionResults, ...directContains];

  // Fallback: if no results and not monolingual, try the opposite direction
  if (combined.length === 0 && !isMonolingual) {
    const fallbackResults = [];
    if (searchDirection === 'no-target') {
      // Was searching Norwegian translations, try matching target-language words instead
      for (const entry of allWords) {
        if (entry.word && entry.word.toLowerCase().includes(q)) {
          fallbackResults.push({ entry, inflectionHint: null });
        }
      }
      // Also try inflection index
      if (inflectionIndex) {
        const fallbackSet = new Set(fallbackResults.map(r => r.entry));
        const matches = inflectionIndex.get(q) || [];
        for (const match of matches) {
          if (fallbackSet.has(match.entry)) continue;
          const hint = match.matchType === 'conjugation'
            ? t('result_inflection_conjugation', { query, word: match.entry.word })
            : t('result_inflection_plural', { query, word: match.entry.word });
          fallbackResults.push({ entry: match.entry, inflectionHint: hint });
        }
      }
    } else {
      // Was searching target-language words, try matching Norwegian translations instead
      for (const entry of allWords) {
        const trans = getTranslation(entry);
        if (trans && trans.toLowerCase().includes(q)) {
          fallbackResults.push({ entry, inflectionHint: null });
        }
      }
    }

    if (fallbackResults.length > 0) {
      const fbUseWord = searchDirection === 'no-target';
      fallbackResults.sort((a, b) => {
        const fieldA = (fbUseWord ? a.entry.word : getTranslation(a.entry)).toLowerCase();
        const fieldB = (fbUseWord ? b.entry.word : getTranslation(b.entry)).toLowerCase();
        if (fieldA.startsWith(q) && !fieldB.startsWith(q)) return -1;
        if (fieldB.startsWith(q) && !fieldA.startsWith(q)) return 1;
        return fieldA.localeCompare(fieldB);
      });
      renderResults(fallbackResults.slice(0, 50), { fallbackHint: true });
      return;
    }
  }

  renderResults(combined.slice(0, 50));
}

function renderResults(results, options = {}) {
  const container = document.getElementById('search-results');
  if (!results.length) {
    container.innerHTML = `<div class="results-placeholder"><p>${t('search_no_results')}</p></div>`;
    return;
  }

  const hintHtml = options.fallbackHint
    ? `<div class="fallback-hint">${t('search_fallback_hint')}</div>`
    : '';

  container.innerHTML = hintHtml + results.map(({ entry, inflectionHint }) => `
    <div class="result-card glass" data-id="${entry._id || ''}">
      <div class="result-basic">
        <div class="result-word-row">
          <span class="result-word">${escapeHtml(entry.word || '')}</span>
          ${entry.audio ? `<button class="audio-btn" data-audio="${escapeHtml(entry.audio)}" title="${t('widget_play')}">${getPlayIcon()}</button>` : ''}
        </div>
        <div class="result-translation">${escapeHtml(getTranslation(entry))}</div>
        ${inflectionHint ? `<div class="inflection-hint">${escapeHtml(inflectionHint)}</div>` : ''}
        <div class="result-meta">
          <span class="result-pos">${escapeHtml(entry.partOfSpeech || '')}</span>
          ${entry.gender && isFeatureEnabled('grammar_articles') ? `<span class="result-gender">${escapeHtml(entry.gender)}</span>` : ''}
          ${entry.plural && isFeatureEnabled('grammar_plural') ? `<span class="result-plural">${escapeHtml(entry.plural)}</span>` : ''}
          ${entry.cefr ? `<span class="result-cefr">${escapeHtml(entry.cefr)}</span>` : ''}
        </div>
      </div>
      <button class="explore-btn">${t('result_explore')}</button>
      <div class="result-expanded hidden">
        ${renderVerbConjugations(entry)}
        ${renderNounCases(entry)}
        ${renderNounForms(entry)}
        ${renderAdjectiveComparison(entry)}
        ${entry.synonyms && entry.synonyms.length ? `
          <div class="expanded-section">
            <h4>${t('result_synonyms')}</h4>
            <p>${entry.synonyms.map(s => escapeHtml(s)).join(', ')}</p>
          </div>
        ` : ''}
        ${entry.grammar ? `
          <div class="expanded-section">
            <h4>${t('result_grammar')}</h4>
            <p>${escapeHtml(entry.grammar)}</p>
          </div>
        ` : ''}
        ${renderExamples(entry)}
      </div>
    </div>
  `).join('');

  // Attach expand listeners
  container.querySelectorAll('.explore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.nextElementSibling;
      const isHidden = expanded.classList.contains('hidden');
      expanded.classList.toggle('hidden');
      btn.textContent = isHidden ? t('result_collapse') : t('result_explore');
    });
  });

  // Attach audio button listeners
  container.querySelectorAll('.audio-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const audioFile = btn.dataset.audio;
      if (audioFile) {
        playAudio(audioFile, btn);
      }
    });
  });
}

function showPlaceholder() {
  document.getElementById('search-results').innerHTML =
    `<div class="results-placeholder"><p>${t('search_placeholder_text')}</p></div>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Audio Playback ─────────────────────────────────────────
let currentAudioBlobUrl = null;

function cleanupAudio() {
  if (currentAudioBlobUrl) {
    URL.revokeObjectURL(currentAudioBlobUrl);
    currentAudioBlobUrl = null;
  }
}

/**
 * Play audio for a word — tries IndexedDB cache first, then bundled files
 */
async function playAudio(audioFilename, button) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    cleanupAudio();
    currentAudio = null;
    document.querySelectorAll('.audio-btn.playing').forEach(btn => {
      btn.classList.remove('playing');
      btn.innerHTML = getPlayIcon();
    });
  }

  if (!audioFilename || !dictionary?._metadata) return;
  const lang = dictionary._metadata.language;
  // NN and NB share pronunciation — try both
  const langsToTry = lang === 'nn' ? ['nn', 'nb'] : lang === 'nb' ? ['nb', 'nn'] : [lang];

  // Try IndexedDB first (check each language variant)
  let audioUrl = null;
  if (window.__lexiVocabStore) {
    for (const tryLang of langsToTry) {
      const blob = await window.__lexiVocabStore.getAudioFile(tryLang, audioFilename);
      if (blob) {
        audioUrl = URL.createObjectURL(blob);
        currentAudioBlobUrl = audioUrl;
        break;
      }
    }
  }

  // Fall back to bundled file — verify it exists before playing
  if (!audioUrl) {
    for (const tryLang of langsToTry) {
      try {
        const url = chrome.runtime.getURL(`audio/${tryLang}/${audioFilename}`);
        const check = await fetch(url, { method: 'HEAD' });
        if (check.ok) {
          audioUrl = url;
          break;
        }
      } catch {
        // Not found, try next
      }
    }
  }

  // No file audio — fall back to browser TTS
  if (!audioUrl) {
    const wordEl = button.closest('.result-word-row')?.querySelector('.result-word');
    const word = wordEl?.textContent?.trim();
    if (word && window.speechSynthesis) {
      const VOICE_LANGS = { de: 'de', es: 'es', fr: 'fr', en: 'en', nb: 'nb', nn: 'nb', no: 'nb' };
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = VOICE_LANGS[lang] || 'nb';
      const voices = synth.getVoices();
      const match = voices.find(v => v.lang.startsWith(utterance.lang));
      if (match) utterance.voice = match;
      button.classList.add('playing');
      button.innerHTML = getPauseIcon();
      utterance.onend = () => { button.classList.remove('playing'); button.innerHTML = getPlayIcon(); };
      utterance.onerror = () => { button.classList.remove('playing'); button.innerHTML = getPlayIcon(); };
      synth.speak(utterance);
    }
    return;
  }

  currentAudio = new Audio(audioUrl);

  button.classList.add('playing');
  button.innerHTML = getPauseIcon();

  currentAudio.play().catch(err => {
    console.warn('Audio playback failed:', err);
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
    cleanupAudio();
    currentAudio = null;
  });

  currentAudio.addEventListener('ended', () => {
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
    cleanupAudio();
    currentAudio = null;
  });

  currentAudio.addEventListener('error', () => {
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
    cleanupAudio();
    currentAudio = null;
  });
}

function getPlayIcon() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}

function getPauseIcon() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
}

/**
 * Render verb conjugations based on enabled features
 */
function renderExamples(entry) {
  // Collect examples from entry directly and from linkedTo
  const examples = [];
  // For Norwegian dictionaries, hide foreign-language translations in examples
  // Hide foreign-language example translations when in monolingual mode
  const uiLang = getUiLanguage();
  const hideExampleTranslations = (uiLang === 'nb' || uiLang === 'nn') && (currentLang === 'nb' || currentLang === 'nn');

  if (entry.examples && entry.examples.length) {
    for (const ex of entry.examples) {
      if (!hideExampleTranslations || !ex.lang || ex.lang === currentLang) {
        examples.push({
          sentence: ex.sentence || ex.source || '',
          translation: (!hideExampleTranslations) ? (ex.translation || ex.target || '') : '',
          lang: ex.lang
        });
      } else if (hideExampleTranslations && ex.lang) {
        // Norwegian mode: show the Norwegian sentence but hide foreign translation
        const sentence = ex.sentence || ex.source || '';
        if (sentence) {
          examples.push({ sentence, translation: '', lang: ex.lang });
        }
      }
    }
  }

  // Also check linkedTo for additional examples (for target language)
  if (entry.linkedTo && !hideExampleTranslations) {
    const link = entry.linkedTo.nb || entry.linkedTo.nn;
    if (link?.examples) {
      for (const ex of link.examples) {
        const sentence = ex.source || ex.sentence || '';
        const translation = ex.target || ex.translation || '';
        // Avoid duplicates
        if (sentence && !examples.some(e => e.sentence === sentence)) {
          examples.push({ sentence, translation });
        }
      }
    }
  }

  if (examples.length === 0) return '';

  return `
    <div class="expanded-section">
      <h4>${t('result_examples')}</h4>
      ${examples.map(ex => `
        <div class="example">
          <p class="example-sentence">"${escapeHtml(ex.sentence)}"</p>
          ${ex.translation ? `<p class="example-translation">${escapeHtml(ex.translation)}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderVerbConjugations(entry) {
  if (!entry.conjugations) return '';

  const allowedPronouns = getAllowedPronouns();
  const sections = [];

  // NB/NN verbs: all forms are under conjugations.presens.former as a flat object
  // (infinitiv, presens, preteritum, perfektum_partisipp, imperativ)
  const presensData = entry.conjugations.presens;
  if (presensData?.former?.infinitiv !== undefined) {
    // This is an NB/NN-style flat verb entry
    const forms = presensData.former;
    const labels = {
      infinitiv: t('tense_infinitive'),
      presens: t('tense_presens'),
      preteritum: t('tense_preteritum'),
      perfektum_partisipp: t('tense_past_participle'),
      imperativ: t('tense_imperative')
    };
    const rows = Object.entries(labels)
      .filter(([key]) => forms[key] !== undefined)
      .map(([key, label]) => `<tr><td>${label}</td><td>${escapeHtml(forms[key])}</td></tr>`)
      .join('');
    if (rows) {
      sections.push(`
        <div class="expanded-section">
          <h4>${t('result_conjugation')}</h4>
          <table class="conjugation-table">${rows}</table>
        </div>
      `);
    }
    return sections.join('');
  }

  // EN verbs: uses present, past, perfect tense keys
  if (entry.conjugations.present || entry.conjugations.past || entry.conjugations.perfect) {
    const enTenses = [
      { key: 'present', featureIds: ['grammar_present', 'grammar_en_present'], nameKey: 'tense_presens' },
      { key: 'past', featureIds: ['grammar_preteritum', 'grammar_en_past'], nameKey: 'tense_preteritum' },
      { key: 'perfect', featureIds: ['grammar_perfektum', 'grammar_en_perfect'], nameKey: 'tense_perfektum' }
    ];

    for (const config of enTenses) {
      const isEnabled = config.featureIds.some(id => isFeatureEnabled(id));
      if (!isEnabled) continue;

      const tenseData = entry.conjugations[config.key];
      if (!tenseData) continue;

      if (tenseData.former) {
        const rows = Object.entries(tenseData.former)
          .map(([pronoun, form]) => `<tr><td>${escapeHtml(pronoun)}</td><td>${escapeHtml(form)}</td></tr>`)
          .join('');
        if (rows) {
          sections.push(`
            <div class="expanded-section">
              <h4>${t(config.nameKey)}</h4>
              <table class="conjugation-table">${rows}</table>
            </div>
          `);
        }
      } else if (tenseData.participle || tenseData.present_participle) {
        const parts = [];
        if (tenseData.participle) parts.push(`${t('tense_past_participle')}: ${escapeHtml(tenseData.participle)}`);
        if (tenseData.present_participle) parts.push(`Present participle: ${escapeHtml(tenseData.present_participle)}`);
        sections.push(`
          <div class="expanded-section">
            <h4>${t(config.nameKey)}</h4>
            <p>${parts.join('<br>')}</p>
          </div>
        `);
      }
    }
    return sections.join('');
  }

  // DE/ES/FR verbs: tense-based with pronoun conjugations
  const tenseConfig = [
    { keys: ['presens', 'presente'], featureIds: ['grammar_present', 'grammar_de_presens', 'grammar_es_presente', 'grammar_fr_present', 'grammar_nb_presens', 'grammar_nn_presens', 'grammar_presens'], nameKey: 'tense_presens' },
    { keys: ['preteritum', 'preterito'], featureIds: ['grammar_preteritum', 'grammar_de_preteritum', 'grammar_es_preterito', 'grammar_preterito', 'grammar_nb_preteritum', 'grammar_nn_preteritum'], nameKey: 'tense_preteritum' },
    { keys: ['perfektum', 'perfecto', 'passe_compose'], featureIds: ['grammar_perfektum', 'grammar_de_perfektum', 'grammar_es_perfecto', 'grammar_fr_passe_compose', 'grammar_perfecto', 'grammar_nb_perfektum', 'grammar_nn_perfektum'], nameKey: 'tense_perfektum' }
  ];

  for (const config of tenseConfig) {
    const isEnabled = config.featureIds.some(id => isFeatureEnabled(id));
    if (!isEnabled) continue;

    let tenseData = null;
    for (const key of config.keys) {
      if (entry.conjugations[key]) {
        tenseData = entry.conjugations[key];
        break;
      }
    }

    if (!tenseData) continue;

    if (tenseData.former) {
      const filtered = filterPronouns(tenseData.former, allowedPronouns);
      if (Object.keys(filtered).length > 0) {
        sections.push(`
          <div class="expanded-section">
            <h4>${t(config.nameKey)}</h4>
            ${renderConjugationTable(filtered)}
          </div>
        `);
      }
    } else if (tenseData.auxiliary || tenseData.participle) {
      sections.push(`
        <div class="expanded-section">
          <h4>${t(config.nameKey)}</h4>
          <p>${escapeHtml(tenseData.auxiliary || '')} + ${escapeHtml(tenseData.participle || '')}</p>
        </div>
      `);
    }
  }

  return sections.join('');
}

/**
 * Filter conjugation forms by allowed pronouns.
 * Handles both object (DE) and array (ES/FR) formats.
 * Returns null-safe: if allowedPronouns is null, returns all forms.
 */
function filterPronouns(forms, allowedPronouns) {
  const pronounLabels = { es: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'], fr: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'] };

  if (Array.isArray(forms)) {
    // ES/FR: convert array to pronoun-keyed object, optionally filtering
    const labels = pronounLabels[currentLang] || [];
    const result = {};
    forms.forEach((form, i) => {
      if (!form) return;
      const pronoun = labels[i] || `${i}`;
      if (!allowedPronouns || allowedPronouns.has(pronoun)) {
        result[pronoun] = form;
      }
    });
    return result;
  }

  // Object (DE/EN): filter by allowed pronouns if set
  if (!allowedPronouns) return forms;
  const filtered = {};
  for (const [pronoun, form] of Object.entries(forms)) {
    if (allowedPronouns.has(pronoun)) {
      filtered[pronoun] = form;
    }
  }
  return filtered;
}

/**
 * Render a conjugation table
 */
function renderConjugationTable(forms) {
  return `<table class="conjugation-table">
    ${Object.entries(forms).map(([pronoun, form]) =>
      `<tr><td>${escapeHtml(pronoun)}</td><td>${escapeHtml(form)}</td></tr>`
    ).join('')}
  </table>`;
}

/**
 * Render noun cases based on enabled features (v2.0 format)
 */
function renderNounCases(entry) {
  if (!entry.cases) return '';

  const caseConfig = [
    { key: 'nominativ', label: 'Nominativ', feature: null },
    { key: 'akkusativ', label: 'Akkusativ', feature: ['grammar_accusative_indefinite', 'grammar_accusative_definite', 'grammar_accusative_nouns'] },
    { key: 'dativ', label: 'Dativ', feature: ['grammar_dative'] },
    { key: 'genitiv', label: 'Genitiv', feature: ['grammar_genitiv'] }
  ];

  // Filter to enabled cases
  const enabledCases = caseConfig.filter(c => {
    if (!c.feature) return true; // nominativ always shown
    return c.feature.some(f => isFeatureEnabled(f));
  });

  if (enabledCases.length <= 1) return ''; // Only nominativ — no table needed

  const rows = enabledCases.map(c => {
    const caseData = entry.cases[c.key];
    const singular = caseData?.forms?.singular || {};
    const plural = caseData?.forms?.plural || {};
    return `<tr>
      <td><strong>${c.label}</strong></td>
      <td>${escapeHtml(singular.definite || '-')}</td>
      <td>${escapeHtml(singular.indefinite || '-')}</td>
      <td>${escapeHtml(plural.definite || '-')}</td>
      <td>${escapeHtml(plural.indefinite || '-')}</td>
    </tr>`;
  }).join('');

  return `
    <div class="expanded-section">
      <h4>${t('result_cases')}</h4>
      <table class="conjugation-table declension-table">
        <thead>
          <tr>
            <th></th>
            <th>${t('decl_def_sg')}</th>
            <th>${t('decl_indef_sg')}</th>
            <th>${t('decl_def_pl')}</th>
            <th>${t('decl_indef_pl')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/**
 * Render NB/NN noun forms (ubestemt/bestemt × entall/flertall) as a 2×2 table
 */
function renderNounForms(entry) {
  if (!entry.forms) return '';
  const ub = entry.forms.ubestemt;
  const be = entry.forms.bestemt;
  if (!ub && !be) return '';

  return `
    <div class="expanded-section">
      <h4>${t('result_conjugation')}</h4>
      <table class="conjugation-table declension-table">
        <thead>
          <tr><th></th><th>${t('decl_singular')}</th><th>${t('decl_plural')}</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>${t('decl_indefinite')}</strong></td><td>${escapeHtml(ub?.entall || '-')}</td><td>${escapeHtml(ub?.flertall || '-')}</td></tr>
          <tr><td><strong>${t('decl_definite')}</strong></td><td>${escapeHtml(be?.entall || '-')}</td><td>${escapeHtml(be?.flertall || '-')}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Render adjective comparison forms based on enabled features
 */
function renderAdjectiveComparison(entry) {
  if (!entry.comparison) return '';

  const sections = [];

  // Komparativ (German: komparativ, Spanish: comparativo, English: comparative)
  const komparativ = entry.comparison.komparativ || entry.comparison.comparativo || entry.comparison.comparative;
  if (isFeatureEnabled('grammar_comparative') && komparativ) {
    sections.push(`
      <div class="expanded-section">
        <h4>${t('tense_comparative')}</h4>
        <p>${escapeHtml(komparativ)}</p>
      </div>
    `);
  }

  // Superlativ (German: superlativ, Spanish: superlativo, English: superlative)
  const superlativ = entry.comparison.superlativ || entry.comparison.superlativo || entry.comparison.superlative;
  if (isFeatureEnabled('grammar_superlative') && superlativ) {
    sections.push(`
      <div class="expanded-section">
        <h4>${t('tense_superlative')}</h4>
        <p>${escapeHtml(superlativ)}</p>
      </div>
    `);
  }

  return sections.join('');
}

// ── Settings ───────────────────────────────────────────────
async function initSettings() {
  const codeInput = document.getElementById('setting-access-code');
  const verifyBtn = document.getElementById('verify-code-btn');
  const codeStatus = document.getElementById('code-status');
  const predictionToggle = document.getElementById('setting-prediction');
  const savedCode = await chromeStorageGet('accessCode');
  if (savedCode) codeInput.value = savedCode;
  const predEnabled = await chromeStorageGet('predictionEnabled');
  predictionToggle.checked = predEnabled !== false;

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
      currentLang = lang;
      await chromeStorageSet({ language: currentLang });
      await loadDictionary(currentLang);
      await loadGrammarFeatures(currentLang);
      initGrammarSettings();
      chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: currentLang });

      // Update status after download completes
      btn.classList.remove('downloading');
      await updateLanguageListStatus();
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
  settingsBackBtn.addEventListener('click', () => {
    showView('dictionary');
    buildLangSwitcher(); // Refresh in case a new language was downloaded
  });
}

// ── Pin (Fest) Button ──────────────────────────────────────
// Chrome extension popups close as soon as focus leaves, so the only way to
// keep Leksihjelp persistently visible is to open it in a detached popup
// window. The ?pinned=1 param lets that window hide its own Fest button.
async function initPinButton() {
  const pinBtn = document.getElementById('pin-btn');
  if (!pinBtn) return;

  const params = new URLSearchParams(location.search);
  if (params.get('pinned') === '1') {
    // Already running in the detached window — hide Fest, it'd just stack.
    pinBtn.classList.add('hidden');
    return;
  }

  pinBtn.addEventListener('click', async () => {
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
    // The toolbar popup closes itself as focus moves to the new window,
    // but call window.close() explicitly so it feels instant.
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
