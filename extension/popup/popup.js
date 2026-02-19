/**
 * Leksihjelp — Popup (dictionary search + settings)
 *
 * Adapted to use Papertek Vocabulary API bank-based structure
 */

const BACKEND_URL = 'https://leksihjelp.vercel.app';

let dictionary = null;
let currentAudio = null; // Currently playing audio
let allWords = []; // Flattened array of all words from all banks
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
  currentLang = (await chromeStorageGet('language')) || 'es';
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
    const url = chrome.runtime.getURL(`data/${lang}.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Dictionary load failed: ${res.status}`);
    dictionary = await res.json();
    allWords = flattenBanks(dictionary);
    inflectionIndex = buildInflectionIndex(allWords);
    updateLangLabels();
  } catch (e) {
    console.error('Failed to load dictionary:', e);
  }
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
  }

  return index;
}

function updateLangLabels() {
  if (!dictionary || !dictionary._metadata) return;
  const code = dictionary._metadata.language.toUpperCase();
  document.querySelectorAll('.target-lang-code').forEach(el => {
    el.textContent = code;
  });
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
    const url = chrome.runtime.getURL(`data/grammarfeatures-${lang}.json`);
    const res = await fetch(url);
    grammarFeatures = await res.json();

    // Load enabled features from storage, default to basic preset
    const stored = await chromeStorageGet('enabledGrammarFeatures');
    if (stored && stored[lang]) {
      enabledFeatures = new Set(stored[lang]);
    } else {
      const basicPreset = grammarFeatures.presets.find(p => p.id === 'basic');
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
  return enabledFeatures.has(featureId);
}

/**
 * Get the allowed pronouns based on enabled pronoun features
 */
function getAllowedPronouns() {
  // Find the most permissive enabled pronoun feature
  const pronounFeatures = [
    { id: 'grammar_pronouns_all', pronouns: ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] },
    { id: 'grammar_pronouns_singular_wir', pronouns: ['ich', 'du', 'er/sie/es', 'wir'] },
    { id: 'grammar_pronouns_ich_du', pronouns: ['ich', 'du'] }
  ];

  for (const pf of pronounFeatures) {
    if (enabledFeatures.has(pf.id)) {
      return new Set(pf.pronouns);
    }
  }

  // Default: all pronouns if no specific feature is enabled
  return new Set(['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie']);
}

// ── Search ─────────────────────────────────────────────────
function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const dirNoTarget = document.getElementById('dir-no-target');
  const dirTargetNo = document.getElementById('dir-target-no');

  input.addEventListener('input', () => {
    clearBtn.classList.toggle('hidden', !input.value);
    performSearch(input.value.trim());
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
}

function performSearch(query) {
  if (!query || !allWords.length) {
    showPlaceholder();
    return;
  }

  const q = query.toLowerCase();

  // Phase 1: Direct matches on base forms (existing behavior)
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
    const fieldA = searchDirection === 'no-target' ? a.entry.translation : a.entry.word;
    const fieldB = searchDirection === 'no-target' ? b.entry.translation : b.entry.word;
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
    const field = (searchDirection === 'no-target' ? r.entry.translation : r.entry.word).toLowerCase();
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
        ${entry.examples && entry.examples.length ? `
          <div class="expanded-section">
            <h4>Eksempler</h4>
            ${entry.examples.map(ex => `
              <div class="example">
                <p class="example-sentence">"${escapeHtml(ex.sentence)}"</p>
                <p class="example-translation">${escapeHtml(ex.translation)}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${entry.grammar ? `
          <div class="expanded-section">
            <h4>Grammatikk</h4>
            <p>${escapeHtml(entry.grammar)}</p>
          </div>
        ` : ''}
        ${renderVerbConjugations(entry)}
        ${renderNounCases(entry)}
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
 * Get audio URL from filename (uses local bundled files)
 */
function getAudioUrl(audioFilename) {
  if (!dictionary || !dictionary._metadata || !audioFilename) return null;
  const lang = dictionary._metadata.language;
  // Use locally bundled audio files
  return chrome.runtime.getURL(`audio/${lang}/${audioFilename}`);
}

/**
 * Play audio for a word
 */
function playAudio(audioFilename, button) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    // Reset all play buttons
    document.querySelectorAll('.audio-btn.playing').forEach(btn => {
      btn.classList.remove('playing');
      btn.innerHTML = getPlayIcon();
    });
  }

  const url = getAudioUrl(audioFilename);
  if (!url) return;

  currentAudio = new Audio(url);

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
function renderVerbConjugations(entry) {
  if (!entry.conjugations) return '';

  const allowedPronouns = getAllowedPronouns();
  const sections = [];

  // Map of conjugation keys to feature IDs and display names (supports multiple languages)
  const tenseConfig = [
    { keys: ['presens', 'presente'], featureIds: ['grammar_present'], name: 'Presens' },
    { keys: ['preteritum', 'preterito'], featureIds: ['grammar_preteritum', 'grammar_preterito'], name: 'Preteritum' },
    { keys: ['perfektum', 'perfecto'], featureIds: ['grammar_perfektum', 'grammar_perfecto'], name: 'Perfektum' }
  ];

  for (const config of tenseConfig) {
    // Check if any of the feature IDs for this tense are enabled
    const isEnabled = config.featureIds.some(id => isFeatureEnabled(id));
    if (!isEnabled) continue;

    // Find the conjugation data using any of the possible keys
    let tenseData = null;
    for (const key of config.keys) {
      if (entry.conjugations[key]) {
        tenseData = entry.conjugations[key];
        break;
      }
    }

    if (!tenseData) continue;

    // Handle different tense structures
    if (tenseData.former) {
      // Standard conjugation table (presens, preteritum)
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
      // Perfektum style (auxiliary + participle)
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
 * Filter conjugation forms by allowed pronouns
 */
function filterPronouns(forms, allowedPronouns) {
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
 * Render noun cases based on enabled features
 */
function renderNounCases(entry) {
  if (!entry.cases) return '';

  const sections = [];

  // Akkusativ
  if (entry.cases.akkusativ) {
    if (isFeatureEnabled('grammar_accusative_indefinite') && entry.cases.akkusativ.ubestemt) {
      sections.push(`
        <div class="expanded-section">
          <h4>Akkusativ (ubestemt)</h4>
          <p>${escapeHtml(entry.cases.akkusativ.ubestemt)}</p>
        </div>
      `);
    }
    if (isFeatureEnabled('grammar_accusative_definite') && entry.cases.akkusativ.bestemt) {
      sections.push(`
        <div class="expanded-section">
          <h4>Akkusativ (bestemt)</h4>
          <p>${escapeHtml(entry.cases.akkusativ.bestemt)}</p>
        </div>
      `);
    }
  }

  // Dativ
  if (isFeatureEnabled('grammar_dative') && entry.cases.dativ) {
    const dativ = entry.cases.dativ;
    const parts = [];
    if (dativ.bestemt) parts.push(`bestemt: ${dativ.bestemt}`);
    if (dativ.ubestemt) parts.push(`ubestemt: ${dativ.ubestemt}`);
    if (parts.length > 0) {
      sections.push(`
        <div class="expanded-section">
          <h4>Dativ</h4>
          <p>${escapeHtml(parts.join(', '))}</p>
        </div>
      `);
    }
  }

  return sections.join('');
}

/**
 * Render adjective comparison forms based on enabled features
 */
function renderAdjectiveComparison(entry) {
  if (!entry.comparison) return '';

  const sections = [];

  // Komparativ (German: komparativ, Spanish: comparativo)
  const komparativ = entry.comparison.komparativ || entry.comparison.comparativo;
  if (isFeatureEnabled('grammar_comparative') && komparativ) {
    sections.push(`
      <div class="expanded-section">
        <h4>Komparativ</h4>
        <p>${escapeHtml(komparativ)}</p>
      </div>
    `);
  }

  // Superlativ (German: superlativ, Spanish: superlativo)
  const superlativ = entry.comparison.superlativ || entry.comparison.superlativo;
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
  const langSelect = document.getElementById('setting-language');
  const codeInput = document.getElementById('setting-access-code');
  const verifyBtn = document.getElementById('verify-code-btn');
  const codeStatus = document.getElementById('code-status');
  const predictionToggle = document.getElementById('setting-prediction');

  // Load saved settings
  langSelect.value = currentLang;
  const savedCode = await chromeStorageGet('accessCode');
  if (savedCode) codeInput.value = savedCode;
  const predEnabled = await chromeStorageGet('predictionEnabled');
  predictionToggle.checked = predEnabled !== false;

  // Language change
  langSelect.addEventListener('change', async () => {
    currentLang = langSelect.value;
    await chromeStorageSet({ language: currentLang });
    await loadDictionary(currentLang);
    await loadGrammarFeatures(currentLang);
    initGrammarSettings(); // Rebuild grammar settings UI
    // Notify content scripts
    chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: currentLang });
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
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  settingsBtn.addEventListener('click', () => showView('settings'));
  settingsBackBtn.addEventListener('click', () => showView('dictionary'));
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

  // Check existing session
  await checkSession();
}

async function loginWithVipps() {
  const loginBtn = document.getElementById('vipps-login-btn');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Åpner Vipps...';

  try {
    // Use chrome.identity to launch an OAuth flow
    const redirectUrl = chrome.identity.getRedirectURL('vipps');
    // Pass the extension's redirect URL so the server knows where to redirect back
    const authUrl = `${BACKEND_URL}/api/auth/vipps-login?source=extension&redirect_uri=${encodeURIComponent(redirectUrl)}`;

    const responseUrl = await Promise.race([
      new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          (callbackUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(callbackUrl);
            }
          }
        );
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Innlogging tok for lang tid. Prøv igjen.')), 120_000)
      )
    ]);

    // Extract the authorization code from the callback URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error') || url.searchParams.get('login_error');

    if (error) {
      throw new Error(`Vipps error: ${error}`);
    }

    if (!code) {
      // Maybe we got a token directly (from the callback redirect)
      const token = url.searchParams.get('token');
      if (token) {
        await handleLoginSuccess(token);
        return;
      }
      throw new Error('No code or token received');
    }

    // Exchange code for session token
    const res = await fetch(`${BACKEND_URL}/api/auth/exchange-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      },
      body: JSON.stringify({ code })
    });

    if (!res.ok) {
      throw new Error(`Exchange failed: ${res.status}`);
    }

    const data = await res.json();
    await handleLoginSuccess(data.token, data.user);
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
  await chromeStorageSet({
    sessionToken: token,
    userName: user?.name || '',
    userEmail: user?.email || '',
    subscriptionStatus: user?.subscriptionStatus || 'none',
    quotaBalance: user?.quotaBalance ?? 10000,
    quotaMaxBalance: user?.quotaMaxBalance || 20000,
    // Keep isAuthenticated for backward compat (true when subscription active)
    isAuthenticated: user?.subscriptionStatus === 'active'
  });

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
      // Green when plenty, orange when low, red when critical
      let colorClass = 'usage-bar-fill';
      if (quotaBalance < 500) colorClass += ' critical';
      else if (quotaBalance < 2000) colorClass += ' warning';
      usageFill.className = colorClass;
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
    subscribeBtn.textContent = 'Abonner — 29 kr/mnd (Vipps)';
  }
}

async function subscribeYearly() {
  const btn = document.getElementById('subscribe-yearly-btn');
  btn.disabled = true;
  btn.textContent = 'Åpner betaling...';

  try {
    const token = await chromeStorageGet('sessionToken');
    const res = await fetch(`${BACKEND_URL}/api/auth/create-checkout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      }
    });

    if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);

    const data = await res.json();
    if (data.checkoutUrl) {
      // Open Stripe Checkout in a new tab
      chrome.tabs.create({ url: data.checkoutUrl });
    }
  } catch (err) {
    console.error('Yearly subscribe failed:', err);
    btn.disabled = false;
    btn.textContent = 'Betal 290 kr/år (kort)';
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
