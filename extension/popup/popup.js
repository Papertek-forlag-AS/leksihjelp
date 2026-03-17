/**
 * Leksihjelp — Popup (dictionary search + settings)
 *
 * Adapted to use Papertek Vocabulary API bank-based structure
 */

const BACKEND_URL = 'https://leksihjelp.no';

let dictionary = null;
let nbDictionary = null; // Norwegian bokmål dictionary for two-way lookups
let currentAudio = null; // Currently playing audio
let allWords = []; // Flattened array of all words from all banks
let nbWords = []; // Flattened Norwegian words
let inflectionIndex = null; // Map: lowercased inflected form -> [{ entry, matchType, matchDetail }]
let currentLang = 'es';
let searchDirection = 'no-target'; // 'no-target' or 'target-no'
let grammarFeatures = null; // Grammar features metadata
let enabledFeatures = new Set(); // Set of enabled feature IDs

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

// Genus to Norwegian gender mapping
const GENUS_TO_GENDER = {
  m: 'maskulin',
  f: 'feminin',
  n: 'nøytrum',
  pl: 'flertall'
};

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

// ── Bootstrap ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  currentLang = (await chromeStorageGet('language')) || null;

  // Check if first-run (no language selected yet)
  if (!currentLang) {
    await initFirstRunPicker();
  }

  // If still no language after picker (skipped), or if nb was set, default to English
  // NB is the source language, not a valid target
  if (!currentLang || currentLang === 'nb') currentLang = 'en';

  await loadDictionary(currentLang);
  await loadGrammarFeatures(currentLang);
  initSearch();
  initSettings();
  initGrammarSettings();
  initNav();
  initPinButton();
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
            });
          }

          // Save selection
          currentLang = lang;
          await chromeStorageSet({ language: lang });
          chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: lang });

          picker.classList.add('hidden');
          resolve();
        } catch (err) {
          console.error('Language download failed:', err);
          status.textContent = 'Nedlasting feilet. Prøv igjen.';
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

    // Load Norwegian dictionary for two-way lookups
    if (lang !== 'nb') {
      try {
        nbDictionary = await loadLanguageData('nb');
        nbWords = nbDictionary ? flattenBanks(nbDictionary) : [];
      } catch {
        nbDictionary = null;
        nbWords = [];
      }
    } else {
      nbDictionary = null;
      nbWords = [];
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
        showDownloadStatus(lang, 'Laster ned ordbok...');
        const data = await window.__lexiVocabStore.downloadLanguage(lang, (progress) => {
          showDownloadStatus(lang, progress.detail);
        });
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
      statusEl.textContent = '';
      statusEl.className = 'lang-option-status';
      if (deleteBtn) deleteBtn.classList.add('hidden');
    } else if (window.__lexiVocabStore) {
      const version = await window.__lexiVocabStore.getCachedVersion(lang);
      if (version) {
        const hasAudio = await window.__lexiVocabStore.hasAudioCached(lang);
        statusEl.textContent = hasAudio ? '🔊' : '';
        statusEl.className = 'lang-option-status';
        if (deleteBtn) deleteBtn.classList.remove('hidden');
      } else {
        statusEl.textContent = 'last ned';
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
      const langName = LANG_SHORT[lang] || lang;

      if (!confirm(`Vil du slette ${langName}? Ordbok og lydfiler fjernes. Du kan laste ned igjen senere.`)) return;

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
  const langNames = { de: 'Tysk', es: 'Spansk', fr: 'Fransk', en: 'Engelsk', nb: 'Norsk bokmål', nn: 'Nynorsk' };
  container.innerHTML = `
    <div class="results-placeholder">
      <p style="font-weight:600;">${langNames[lang] || lang}</p>
      <p>${message}</p>
    </div>`;
}

function hideDownloadStatus() {
  const container = document.getElementById('search-results');
  if (!container) return;
  container.innerHTML = '<div class="results-placeholder"><p>Skriv et ord for å søke i ordboken</p></div>';
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
        partOfSpeech: BANK_TO_POS[bank] || bank.replace('bank', ''),
        gender: entry.genus ? GENUS_TO_GENDER[entry.genus] || entry.genus : null,
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
  }

  return index;
}

function updateLangLabels() {
  if (!dictionary || !dictionary._metadata) return;
  const code = dictionary._metadata.language.toUpperCase();
  document.querySelectorAll('.target-lang-code').forEach(el => {
    el.textContent = code;
  });

  // Update direction button labels for special languages
  const dirNoTarget = document.getElementById('dir-no-target');
  const dirTargetNo = document.getElementById('dir-target-no');
  if (dirNoTarget && dirTargetNo) {
    if (currentLang === 'nb') {
      // NB-NB monolingual mode — hide direction toggle
      dirNoTarget.innerHTML = `<span class="target-lang-code">NB</span> ordbok`;
      dirTargetNo.style.display = 'none';
      dirNoTarget.classList.add('active');
    } else {
      dirTargetNo.style.display = '';
      if (currentLang === 'nn') {
        dirNoTarget.innerHTML = `NB → <span class="target-lang-code">NN</span>`;
        dirTargetNo.innerHTML = `<span class="target-lang-code">NN</span> → NB`;
      } else {
        dirNoTarget.innerHTML = `NO → <span class="target-lang-code">${code}</span>`;
        dirTargetNo.innerHTML = `<span class="target-lang-code">${code}</span> → NO`;
      }
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
    'grammar_plural': [`${langPrefix}flertall`, `${langPrefix}fleirtal`],
    'grammar_present': [`${langPrefix}presens`],
    'grammar_preteritum': [`${langPrefix}preteritum`],
    'grammar_perfektum': [`${langPrefix}perfektum`],
    'grammar_comparative': [`${langPrefix}komparativ`],
    'grammar_superlative': [`${langPrefix}superlativ`],
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
const LANG_SHORT = { de: 'Tysk', es: 'Spansk', fr: 'Fransk', en: 'Engelsk', nn: 'Nynorsk', nb: 'Bokmål' };

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
    return (LANG_SHORT[a] || a).localeCompare(LANG_SHORT[b] || b);
  });

  container.innerHTML = available.map(lang => `
    <button class="lang-switch-btn ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">
      <span class="lang-switch-flag">${LANG_FLAGS[lang] || ''}</span>
      ${LANG_SHORT[lang] || lang.toUpperCase()}
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

  // Phase 1: Direct matches on base forms
  const directResults = [];
  for (const entry of allWords) {
    if (searchDirection === 'no-target') {
      if (entry.translation && entry.translation.toLowerCase().includes(q)) {
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
  if (searchDirection === 'no-target' && nbWords.length > 0) {
    const directEntryWords = new Set(directResults.map(r => r.entry.word?.toLowerCase()));

    for (const nbEntry of nbWords) {
      if (!nbEntry.word || !nbEntry.word.toLowerCase().includes(q)) continue;
      if (!nbEntry.linkedTo) continue;

      // Follow link to the target language
      const link = nbEntry.linkedTo[currentLang];
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
              inflectionHint: `«${nbEntry.word}» → ${flatEntry.word}`
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
          ? `«${query}» → bøyning av «${match.entry.word}»`
          : `«${query}» → flertall av «${match.entry.word}»`;
        inflectionResults.push({ entry: match.entry, inflectionHint: hint });
      }
    }
  } else {
    const infinitive = norwegianInfinitive(q);
    if (infinitive) {
      for (const entry of allWords) {
        if (directEntrySet.has(entry)) continue;
        if (!entry.translation) continue;
        const trans = entry.translation.toLowerCase();
        const stripped = trans.startsWith('å ') ? trans.slice(2) : trans;
        if (stripped === infinitive || stripped.startsWith(infinitive + ' ')
            || stripped.startsWith(infinitive + ',') || stripped.includes(', ' + infinitive)) {
          inflectionResults.push({
            entry,
            inflectionHint: `«${query}» → bøyning av «${infinitive}»`
          });
        }
      }
    }
  }

  // Phase 3: Sort direct results, split into starts-with vs contains
  directResults.sort((a, b) => {
    const fieldA = searchDirection === 'no-target' ? (a.entry.translation || '') : a.entry.word;
    const fieldB = searchDirection === 'no-target' ? (b.entry.translation || '') : b.entry.word;
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
    const field = (searchDirection === 'no-target' ? (r.entry.translation || '') : r.entry.word).toLowerCase();
    if (field === q || field.startsWith(q)) {
      directStartsWith.push(r);
    } else {
      directContains.push(r);
    }
  }

  inflectionResults.sort((a, b) => a.entry.word.localeCompare(b.entry.word));

  // Final order: exact/starts-with → inflection matches → contains
  const combined = [...directStartsWith, ...inflectionResults, ...directContains];
  renderResults(combined.slice(0, 50));
}

function renderResults(results) {
  const container = document.getElementById('search-results');
  if (!results.length) {
    container.innerHTML = '<div class="results-placeholder"><p>Ingen treff</p></div>';
    return;
  }

  container.innerHTML = results.map(({ entry, inflectionHint }) => `
    <div class="result-card glass" data-id="${entry._id || ''}">
      <div class="result-basic">
        <div class="result-word-row">
          <span class="result-word">${escapeHtml(entry.word || '')}</span>
          ${entry.audio ? `<button class="audio-btn" data-audio="${escapeHtml(entry.audio)}" title="Spill av">${getPlayIcon()}</button>` : ''}
        </div>
        <div class="result-translation">${escapeHtml(entry.translation || '')}</div>
        ${inflectionHint ? `<div class="inflection-hint">${escapeHtml(inflectionHint)}</div>` : ''}
        <div class="result-meta">
          <span class="result-pos">${escapeHtml(entry.partOfSpeech || '')}</span>
          ${entry.gender && isFeatureEnabled('grammar_articles') ? `<span class="result-gender">${escapeHtml(entry.gender)}</span>` : ''}
          ${entry.plural && isFeatureEnabled('grammar_plural') ? `<span class="result-plural">${escapeHtml(entry.plural)}</span>` : ''}
          ${entry.cefr ? `<span class="result-cefr">${escapeHtml(entry.cefr)}</span>` : ''}
        </div>
      </div>
      <button class="explore-btn">Utforsk mer ▾</button>
      <div class="result-expanded hidden">
        ${entry.synonyms && entry.synonyms.length ? `
          <div class="expanded-section">
            <h4>Synonymer</h4>
            <p>${entry.synonyms.map(s => escapeHtml(s)).join(', ')}</p>
          </div>
        ` : ''}
        ${renderExamples(entry)}
        ${entry.grammar ? `
          <div class="expanded-section">
            <h4>Grammatikk</h4>
            <p>${escapeHtml(entry.grammar)}</p>
          </div>
        ` : ''}
        ${renderVerbConjugations(entry)}
        ${renderNounCases(entry)}
        ${renderNounForms(entry)}
        ${renderAdjectiveComparison(entry)}
      </div>
    </div>
  `).join('');

  // Attach expand listeners
  container.querySelectorAll('.explore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.nextElementSibling;
      const isHidden = expanded.classList.contains('hidden');
      expanded.classList.toggle('hidden');
      btn.textContent = isHidden ? 'Skjul ▴' : 'Utforsk mer ▾';
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
    '<div class="results-placeholder"><p>Skriv et ord for å søke i ordboken</p></div>';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Audio Playback ─────────────────────────────────────────
/**
 * Play audio for a word — tries IndexedDB cache first, then bundled files
 */
async function playAudio(audioFilename, button) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    document.querySelectorAll('.audio-btn.playing').forEach(btn => {
      btn.classList.remove('playing');
      btn.innerHTML = getPlayIcon();
    });
  }

  if (!audioFilename || !dictionary?._metadata) return;
  const lang = dictionary._metadata.language;

  // Try IndexedDB first
  let audioUrl = null;
  if (window.__lexiVocabStore) {
    const blob = await window.__lexiVocabStore.getAudioFile(lang, audioFilename);
    if (blob) {
      audioUrl = URL.createObjectURL(blob);
    }
  }

  // Fall back to bundled file
  if (!audioUrl) {
    try {
      audioUrl = chrome.runtime.getURL(`audio/${lang}/${audioFilename}`);
    } catch {
      return;
    }
  }

  currentAudio = new Audio(audioUrl);

  button.classList.add('playing');
  button.innerHTML = getPauseIcon();

  currentAudio.play().catch(err => {
    console.warn('Audio playback failed:', err);
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
    currentAudio = null;
  });

  currentAudio.addEventListener('ended', () => {
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
    currentAudio = null;
  });

  currentAudio.addEventListener('error', () => {
    button.classList.remove('playing');
    button.innerHTML = getPlayIcon();
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

  if (entry.examples && entry.examples.length) {
    for (const ex of entry.examples) {
      // Examples may have source/target (from links) or sentence/translation (legacy)
      examples.push({
        sentence: ex.sentence || ex.source || '',
        translation: ex.translation || ex.target || ''
      });
    }
  }

  // Also check linkedTo for additional examples
  if (entry.linkedTo) {
    const nbLink = entry.linkedTo.nb || entry.linkedTo.nn;
    if (nbLink?.examples) {
      for (const ex of nbLink.examples) {
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
      <h4>Eksempler</h4>
      ${examples.map(ex => `
        <div class="example">
          <p class="example-sentence">"${escapeHtml(ex.sentence)}"</p>
          <p class="example-translation">${escapeHtml(ex.translation)}</p>
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
      infinitiv: 'Infinitiv',
      presens: 'Presens',
      preteritum: 'Preteritum',
      perfektum_partisipp: 'Perfektum partisipp',
      imperativ: 'Imperativ'
    };
    const rows = Object.entries(labels)
      .filter(([key]) => forms[key] !== undefined)
      .map(([key, label]) => `<tr><td>${label}</td><td>${escapeHtml(forms[key])}</td></tr>`)
      .join('');
    if (rows) {
      sections.push(`
        <div class="expanded-section">
          <h4>Bøyning</h4>
          <table class="conjugation-table">${rows}</table>
        </div>
      `);
    }
    return sections.join('');
  }

  // EN verbs: uses present, past, perfect tense keys
  if (entry.conjugations.present || entry.conjugations.past || entry.conjugations.perfect) {
    const enTenses = [
      { key: 'present', featureIds: ['grammar_present', 'grammar_en_present'], name: 'Present' },
      { key: 'past', featureIds: ['grammar_preteritum', 'grammar_en_past'], name: 'Past' },
      { key: 'perfect', featureIds: ['grammar_perfektum', 'grammar_en_perfect'], name: 'Perfect' }
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
              <h4>${config.name}</h4>
              <table class="conjugation-table">${rows}</table>
            </div>
          `);
        }
      } else if (tenseData.participle || tenseData.present_participle) {
        const parts = [];
        if (tenseData.participle) parts.push(`Past participle: ${escapeHtml(tenseData.participle)}`);
        if (tenseData.present_participle) parts.push(`Present participle: ${escapeHtml(tenseData.present_participle)}`);
        sections.push(`
          <div class="expanded-section">
            <h4>${config.name}</h4>
            <p>${parts.join('<br>')}</p>
          </div>
        `);
      }
    }
    return sections.join('');
  }

  // DE/ES/FR verbs: tense-based with pronoun conjugations
  const tenseConfig = [
    { keys: ['presens', 'presente'], featureIds: ['grammar_present', 'grammar_nb_presens', 'grammar_nn_presens', 'grammar_presens'], name: 'Presens' },
    { keys: ['preteritum', 'preterito'], featureIds: ['grammar_preteritum', 'grammar_preterito', 'grammar_nb_preteritum', 'grammar_nn_preteritum'], name: 'Preteritum' },
    { keys: ['perfektum', 'perfecto'], featureIds: ['grammar_perfektum', 'grammar_perfecto', 'grammar_nb_perfektum', 'grammar_nn_perfektum'], name: 'Perfektum' }
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
            <h4>${config.name}</h4>
            ${renderConjugationTable(filtered)}
          </div>
        `);
      }
    } else if (tenseData.auxiliary || tenseData.participle) {
      sections.push(`
        <div class="expanded-section">
          <h4>${config.name}</h4>
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
      <h4>Bøyning (kasus)</h4>
      <table class="conjugation-table declension-table">
        <thead>
          <tr>
            <th></th>
            <th>Bestemt ent.</th>
            <th>Ubestemt ent.</th>
            <th>Bestemt fl.</th>
            <th>Ubestemt fl.</th>
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
      <h4>Bøyning</h4>
      <table class="conjugation-table declension-table">
        <thead>
          <tr><th></th><th>Entall</th><th>Flertall</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Ubestemt</strong></td><td>${escapeHtml(ub?.entall || '-')}</td><td>${escapeHtml(ub?.flertall || '-')}</td></tr>
          <tr><td><strong>Bestemt</strong></td><td>${escapeHtml(be?.entall || '-')}</td><td>${escapeHtml(be?.flertall || '-')}</td></tr>
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
        <h4>Komparativ</h4>
        <p>${escapeHtml(komparativ)}</p>
      </div>
    `);
  }

  // Superlativ (German: superlativ, Spanish: superlativo, English: superlative)
  const superlativ = entry.comparison.superlativ || entry.comparison.superlativo || entry.comparison.superlative;
  if (isFeatureEnabled('grammar_superlative') && superlativ) {
    sections.push(`
      <div class="expanded-section">
        <h4>Superlativ</h4>
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
        const langName = LANG_SHORT[lang] || lang;
        const confirmed = confirm(
          `${langName} er ikke lastet ned ennå.\n\nDette laster ned ordbok og uttale (~30–50 MB).\n\nVil du fortsette?`
        );
        if (!confirmed) return;
      }

      // Update active state
      document.querySelectorAll('.lang-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (needsDownload) {
        btn.classList.add('downloading');
        const statusEl = btn.querySelector('.lang-option-status');
        statusEl.textContent = 'Laster ned...';
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
        codeStatus.textContent = '✗ For mange forsøk. Vent litt og prøv igjen.';
        codeStatus.className = 'code-status error';
      } else {
        const data = await res.json();
        if (data.valid) {
          await chromeStorageSet({ accessCode: code, isAuthenticated: true });
          codeStatus.textContent = '✓ Kode godkjent! ElevenLabs-uttale er aktivert.';
          codeStatus.className = 'code-status success';
        } else {
          await chromeStorageSet({ isAuthenticated: false });
          codeStatus.textContent = '✗ Ugyldig kode.';
          codeStatus.className = 'code-status error';
        }
      }
    } catch {
      // Server unreachable — no offline fallback. Browser TTS still works.
      codeStatus.innerHTML = '✗ Kunne ikke koble til serveren.<br><span style="font-size:11px;color:var(--text-muted);">Brannmur eller proxy kan blokkere tilkoblingen. Kontakt IT for å godkjenne leksihjelp.vercel.app</span>';
      codeStatus.className = 'code-status error';
    }

    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Bekreft';
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
async function initPinButton() {
  const pinBtn = document.getElementById('pin-btn');
  const pinOverlay = document.getElementById('pin-overlay');
  const pinDismissBtn = document.getElementById('pin-dismiss-btn');

  // Check if user already dismissed the pin guide
  const dismissed = await chromeStorageGet('pinDismissed');
  if (dismissed) {
    pinBtn.classList.add('hidden');
    return;
  }

  pinBtn.addEventListener('click', () => {
    pinOverlay.classList.remove('hidden');
  });

  pinDismissBtn.addEventListener('click', async () => {
    pinOverlay.classList.add('hidden');
    pinBtn.classList.add('hidden');
    await chromeStorageSet({ pinDismissed: true });
  });

  // Also close overlay by clicking outside the content
  pinOverlay.addEventListener('click', (e) => {
    if (e.target === pinOverlay) {
      pinOverlay.classList.add('hidden');
    }
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
    pauseLabel.textContent = 'Start';
  }

  pauseBtn.addEventListener('click', async () => {
    const isPaused = pauseBtn.classList.toggle('paused');
    pauseLabel.textContent = isPaused ? 'Start' : 'Pause';

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
  loginBtn.textContent = 'Åpner Vipps...';

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
    loginBtn.textContent = 'Logg inn med Vipps';

    // Show error briefly
    const loggedOut = document.getElementById('auth-logged-out');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'code-status error';
    errorDiv.textContent = err.message.includes('cancelled') || err.message.includes('closed')
      ? 'Innlogging avbrutt'
      : 'Innlogging feilet. Prøv igjen.';
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
      badge.textContent = 'Aktivt abonnement';
      badge.className = 'subscription-badge active';
    } else if (status === 'pending') {
      badge.textContent = 'Abonnement venter';
      badge.className = 'subscription-badge pending';
    } else {
      badge.textContent = 'Ikke abonnert';
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

    if (usageText) usageText.textContent = `${quotaBalance.toLocaleString('nb-NO')} tegn`;
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
  subscribeBtn.textContent = 'Oppretter abonnement...';

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
    subscribeBtn.textContent = 'Abonner — 49 kr/mnd (Vipps)';
  }
}

async function subscribeYearly() {
  const btn = document.getElementById('subscribe-yearly-btn');
  btn.disabled = true;
  btn.textContent = 'Åpner Vipps...';

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
    btn.textContent = 'Betal 490 kr/år (Vipps)';
  }
}

async function buyTopup() {
  const btn = document.getElementById('topup-btn');
  btn.disabled = true;
  btn.textContent = 'Åpner Vipps...';

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
    btn.textContent = 'Kjøp 50 000 tegn — 49 kr (Vipps)';
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
    loginBtn.textContent = 'Logg inn med Vipps';
  }
}
