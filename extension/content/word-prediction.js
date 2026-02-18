/**
 * Leksihjelp — Word Prediction (content script)
 *
 * Provides autocomplete suggestions as user types in any text input.
 * Uses fuzzy matching against a bundled word list.
 * Works with <input>, <textarea>, and contenteditable elements.
 * Includes conjugated verb forms and declined noun forms.
 * Respects grammar feature settings from the extension popup.
 */

(function () {
  'use strict';

  let wordList = [];       // Array of { word, display, translation, type, baseWord, pronoun }
  let dropdown = null;
  let activeElement = null;
  let selectedIndex = -1;
  let enabled = true;
  let currentLang = 'es';
  let enabledFeatures = new Set(); // Grammar features enabled by user
  let grammarFeatures = null; // Grammar features metadata
  let lexiPaused = false; // Global pause state
  let predictionTimer = null; // debounce timer for prediction
  let prefixIndex = new Map(); // 2-3 char prefix → [indices into wordList]
  let recentWords = [];    // Last 20 selected words per language
  let recentWordsSet = new Set(); // For O(1) lookup

  // ── Init ──
  init();

  async function init() {
    const stored = await chromeStorageGet(['language', 'predictionEnabled', 'enabledGrammarFeatures', 'lexiPaused']);
    currentLang = stored.language || 'es';
    enabled = stored.predictionEnabled !== false;
    lexiPaused = stored.lexiPaused || false;

    // Load grammar features settings
    if (stored.enabledGrammarFeatures && stored.enabledGrammarFeatures[currentLang]) {
      enabledFeatures = new Set(stored.enabledGrammarFeatures[currentLang]);
    }

    await loadRecentWords(currentLang);
    await loadGrammarFeatures(currentLang);
    await loadWordList(currentLang);
    createDropdown();
    attachGlobalListeners();

    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'LANGUAGE_CHANGED') {
        currentLang = msg.language;
        loadRecentWords(msg.language);
        loadGrammarFeatures(msg.language);
        loadWordList(msg.language);
      }
      if (msg.type === 'PREDICTION_TOGGLED') {
        enabled = msg.enabled;
        if (!enabled) hideDropdown();
      }
      if (msg.type === 'GRAMMAR_FEATURES_CHANGED') {
        enabledFeatures = new Set(msg.features || []);
        loadWordList(currentLang); // Rebuild word list with new filters
      }
      if (msg.type === 'LEXI_PAUSED') {
        lexiPaused = msg.paused;
        if (lexiPaused) hideDropdown();
      }
    });
  }

  async function loadGrammarFeatures(lang) {
    try {
      const url = chrome.runtime.getURL(`data/grammarfeatures-${lang}.json`);
      const res = await fetch(url);
      grammarFeatures = await res.json();

      // If no stored features, default to all enabled
      if (enabledFeatures.size === 0 && grammarFeatures?.features) {
        enabledFeatures = new Set(grammarFeatures.features.map(f => f.id));
      }
    } catch (e) {
      grammarFeatures = null;
    }
  }

  function isFeatureEnabled(featureId) {
    return enabledFeatures.size === 0 || enabledFeatures.has(featureId);
  }

  function getAllowedPronouns() {
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
    return new Set(['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie']);
  }

  function chromeStorageGet(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  // Bank names for iteration
  const BANKS = [
    'verbbank', 'nounbank', 'adjectivebank', 'articlesbank',
    'generalbank', 'numbersbank', 'phrasesbank', 'pronounsbank'
  ];

  // Short part-of-speech labels for dropdown badges
  const BANK_TO_POS_SHORT = {
    verbbank: 'verb',
    nounbank: 'subst.',
    adjectivebank: 'adj.',
    articlesbank: 'art.',
    generalbank: 'ord',
    numbersbank: 'tall',
    phrasesbank: 'frase',
    pronounsbank: 'pron.'
  };

  // Pronoun labels per language — maps array index to pronoun string
  // Used to label Spanish/French conjugations where former is an array
  const LANGUAGE_PRONOUNS = {
    es: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'],
    fr: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles']
  };

  // Tense keys to feature mapping (supports multiple languages)
  const TENSE_FEATURES = {
    presens: 'grammar_present',
    presente: 'grammar_present',
    preteritum: 'grammar_preteritum',
    preterito: 'grammar_preterito',
    perfektum: 'grammar_perfektum',
    perfecto: 'grammar_perfecto',
    passe_compose: 'grammar_passe_compose'
  };

  // Pronoun context mapping - maps written pronouns to conjugation keys
  const PRONOUN_CONTEXT = {
    // German
    'ich': 'ich',
    'du': 'du',
    'er': 'er/sie/es',
    'sie': 'er/sie/es', // Could be sie/Sie or er/sie/es - we'll boost both
    'es': 'er/sie/es',
    'wir': 'wir',
    'ihr': 'ihr',
    // Spanish
    'yo': 'yo',
    'tú': 'tú',
    'tu': 'tú',
    'él': 'él/ella/usted',
    'ella': 'él/ella/usted',
    'usted': 'él/ella/usted',
    'nosotros': 'nosotros',
    'nosotras': 'nosotros',
    'vosotros': 'vosotros',
    'vosotras': 'vosotros',
    'ellos': 'ellos/ellas/ustedes',
    'ellas': 'ellos/ellas/ustedes',
    'ustedes': 'ellos/ellas/ustedes',
    // French
    'je': 'je',
    'j\'': 'je',
    'il': 'il/elle/on',
    'elle': 'il/elle/on',
    'on': 'il/elle/on',
    'nous': 'nous',
    'vous': 'vous',
    'ils': 'ils/elles',
    'elles': 'ils/elles'
  };

  // Modal verbs - when present, main verb should be infinitive
  const MODAL_VERBS = new Set([
    // German - können
    'kann', 'kannst', 'können', 'könnt',
    // German - müssen
    'muss', 'musst', 'müssen', 'müsst',
    // German - wollen
    'will', 'willst', 'wollen', 'wollt',
    // German - sollen
    'soll', 'sollst', 'sollen', 'sollt',
    // German - dürfen
    'darf', 'darfst', 'dürfen', 'dürft',
    // German - mögen/möchten
    'mag', 'magst', 'mögen', 'mögt',
    'möchte', 'möchtest', 'möchten', 'möchtet',
    // Spanish - poder (can)
    'puedo', 'puedes', 'puede', 'podemos', 'pueden',
    // Spanish - querer (want)
    'quiero', 'quieres', 'quiere', 'queremos', 'quieren',
    // Spanish - deber (must)
    'debo', 'debes', 'debe', 'debemos', 'deben',
    // French - pouvoir (can)
    'peux', 'peut', 'pouvons', 'pouvez', 'peuvent',
    // French - devoir (must)
    'dois', 'doit', 'devons', 'devez', 'doivent',
    // French - vouloir (want)
    'veux', 'veut', 'voulons', 'voulez', 'veulent'
  ]);

  // ── Word list ──
  async function loadWordList(lang) {
    try {
      const url = chrome.runtime.getURL(`data/${lang}.json`);
      const res = await fetch(url);
      const data = await res.json();

      // Flatten bank-based structure into prediction entries
      wordList = [];
      const allowedPronouns = getAllowedPronouns();

      for (const bank of BANKS) {
        const bankData = data[bank];
        if (!bankData || typeof bankData !== 'object') continue;

        for (const entry of Object.values(bankData)) {
          if (!entry.word) continue;

          const translation = entry.translation || entry.translations?.nb || '';

          // Add base word
          wordList.push({
            word: entry.word.toLowerCase(),
            display: entry.word,
            translation: translation,
            type: 'base',
            bank: bank
          });

          // Add Norwegian translation for reverse prediction
          if (translation) {
            wordList.push({
              word: translation.toLowerCase(),
              display: translation,
              translation: entry.word,
              type: 'translation'
            });
          }

          // Add conjugated verb forms
          if (bank === 'verbbank' && entry.conjugations) {
            for (const [tense, tenseData] of Object.entries(entry.conjugations)) {
              const featureId = TENSE_FEATURES[tense];
              if (featureId && !isFeatureEnabled(featureId)) continue;

              if (tenseData.former) {
                if (Array.isArray(tenseData.former)) {
                  // Spanish/French: array of forms, map index to pronoun label
                  const pronounLabels = LANGUAGE_PRONOUNS[lang] || [];
                  tenseData.former.forEach((form, index) => {
                    if (!form) return;
                    const pronoun = pronounLabels[index] || `${index}`;
                    wordList.push({
                      word: form.toLowerCase(),
                      display: form,
                      translation: `${entry.word} (${pronoun})`,
                      type: 'conjugation',
                      pronoun: pronoun,
                      baseWord: entry.word
                    });
                  });
                } else if (typeof tenseData.former === 'object') {
                  // German: object with pronoun keys
                  for (const [pronoun, form] of Object.entries(tenseData.former)) {
                    // Skip pronouns not enabled
                    if (!allowedPronouns.has(pronoun)) continue;

                    wordList.push({
                      word: form.toLowerCase(),
                      display: form,
                      translation: `${entry.word} (${pronoun})`,
                      type: 'conjugation',
                      pronoun: pronoun,
                      baseWord: entry.word
                    });
                  }
                }
              }
            }
          }

          // Add noun case forms
          if (bank === 'nounbank' && entry.cases) {
            for (const [caseName, caseData] of Object.entries(entry.cases)) {
              // Skip akkusativ/dativ if those features are disabled
              if (caseName === 'akkusativ' && !isFeatureEnabled('grammar_accusative_nouns')) continue;
              if (caseName === 'dativ' && !isFeatureEnabled('grammar_dative')) continue;

              // Add definite form
              if (caseData.bestemt) {
                wordList.push({
                  word: caseData.bestemt.toLowerCase(),
                  display: caseData.bestemt,
                  translation: `${entry.word} (${caseName})`,
                  type: 'case',
                  baseWord: entry.word
                });
              }
              // Add indefinite form
              if (caseData.ubestemt) {
                wordList.push({
                  word: caseData.ubestemt.toLowerCase(),
                  display: caseData.ubestemt,
                  translation: `${entry.word} (${caseName})`,
                  type: 'case',
                  baseWord: entry.word
                });
              }
            }
          }

          // Add plural forms
          if (bank === 'nounbank' && entry.plural && isFeatureEnabled('grammar_plural')) {
            wordList.push({
              word: entry.plural.toLowerCase(),
              display: entry.plural,
              translation: `${entry.word} (flertall)`,
              type: 'plural',
              baseWord: entry.word
            });
          }

          // Add adjective comparison forms
          // German: entry.komparativ (string), Spanish/French: entry.comparison.komparativ.form (nested)
          if (bank === 'adjectivebank') {
            const komparativ = entry.komparativ
              || entry.comparison?.komparativ?.form
              || entry.comparison?.comparativo?.form
              || entry.comparison?.comparatif?.form;
            const superlativ = entry.superlativ
              || entry.comparison?.superlativ?.form
              || entry.comparison?.superlativo?.form
              || entry.comparison?.superlatif?.form;

            if (komparativ && isFeatureEnabled('grammar_comparative')) {
              wordList.push({
                word: komparativ.toLowerCase(),
                display: komparativ,
                translation: `${entry.word} (komparativ)`,
                type: 'comparative',
                baseWord: entry.word
              });
            }
            if (superlativ && isFeatureEnabled('grammar_superlative')) {
              wordList.push({
                word: superlativ.toLowerCase(),
                display: superlativ,
                translation: `${entry.word} (superlativ)`,
                type: 'superlative',
                baseWord: entry.word
              });
            }
          }
        }
      }
      buildPrefixIndex();
    } catch (e) {
      console.error('Leksihjelp: Failed to load word list', e);
    }
  }

  // ── Prefix index for fast candidate lookup ──
  function buildPrefixIndex() {
    prefixIndex.clear();
    for (let i = 0; i < wordList.length; i++) {
      const w = wordList[i].word;
      for (let len = 2; len <= Math.min(3, w.length); len++) {
        const prefix = w.slice(0, len);
        if (!prefixIndex.has(prefix)) prefixIndex.set(prefix, []);
        prefixIndex.get(prefix).push(i);
      }
    }
  }

  // ── Recent words tracking ──
  async function loadRecentWords(lang) {
    try {
      const stored = await chromeStorageGet(['recentWords']);
      const all = stored.recentWords || {};
      recentWords = all[lang] || [];
      recentWordsSet = new Set(recentWords);
    } catch (e) {
      recentWords = [];
      recentWordsSet = new Set();
    }
  }

  function trackRecentWord(word) {
    const lw = word.toLowerCase();
    // Move to front if already present, otherwise prepend
    recentWords = [lw, ...recentWords.filter(w => w !== lw)].slice(0, 20);
    recentWordsSet = new Set(recentWords);
    // Persist asynchronously
    chromeStorageGet(['recentWords']).then(stored => {
      const all = stored.recentWords || {};
      all[currentLang] = recentWords;
      chrome.storage.local.set({ recentWords: all });
    });
  }

  // ── Dropdown DOM ──
  function createDropdown() {
    dropdown = document.createElement('div');
    dropdown.id = 'lexi-prediction-dropdown';
    document.documentElement.appendChild(dropdown);
  }

  // ── Input Listeners ──
  function attachGlobalListeners() {
    // Use capture to intercept before page handlers
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keyup', handleKeyup, true); // Fallback for editors (e.g. CKEditor) that suppress input events
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('blur', () => {
      setTimeout(hideDropdown, 150);
    }, true);
  }

  function handleInput(e) {
    if (!enabled || lexiPaused) return;
    const el = e.target;
    if (!isTextInput(el)) return;
    schedulePrediction(el);
  }

  // Fallback for rich-text editors (CKEditor, TinyMCE, etc.) that intercept
  // beforeinput and do their own DOM updates, which can suppress native input events.
  function handleKeyup(e) {
    if (!enabled || lexiPaused) return;
    // Skip non-character keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
         'Shift', 'Control', 'Alt', 'Meta', 'CapsLock',
         'Tab', 'Enter', 'Escape', 'Home', 'End',
         'PageUp', 'PageDown', 'Insert',
         'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
         'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(e.key)) return;
    const el = e.target;
    if (!isTextInput(el)) return;
    schedulePrediction(el);
  }

  // Debounce predictions with 100ms timeout so the editor's DOM
  // updates settle before we read the selection / text content.
  function schedulePrediction(el) {
    if (predictionTimer) clearTimeout(predictionTimer);
    predictionTimer = setTimeout(() => {
      predictionTimer = null;
      runPrediction(el);
    }, 100);
  }

  function runPrediction(el) {
    activeElement = el;
    const { currentWord, previousWord, hasModalVerb } = getTextContext(el);

    if (currentWord && currentWord.length >= 2) {
      // Detect pronoun context for smart verb suggestions
      const pronounContext = PRONOUN_CONTEXT[previousWord] || null;
      const suggestions = findSuggestions(currentWord, 5, pronounContext, hasModalVerb);
      if (suggestions.length > 0) {
        showDropdown(suggestions, el);
      } else {
        hideDropdown();
      }
    } else {
      hideDropdown();
    }
  }

  function handleKeydown(e) {
    if (!dropdown.classList.contains('visible')) return;

    const items = dropdown.querySelectorAll('.lh-pred-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      selectedIndex = (selectedIndex + 1) % items.length;
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        e.stopPropagation();
        applySuggestion(items[selectedIndex].dataset.word);
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  }

  function handleClick(e) {
    if (dropdown.contains(e.target)) return;
    const item = e.target.closest('.lh-pred-item');
    if (item) {
      e.preventDefault();
      applySuggestion(item.dataset.word);
    }
  }

  function updateSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
  }

  // ── Get current word being typed ──
  function getTextContext(el) {
    let text = '';
    let cursorPos = 0;

    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (!sel.rangeCount) return { currentWord: '', previousWord: '', hasModalVerb: false };
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
      let offset = range.startOffset;

      // Editors like CKEditor may place the cursor at an element boundary
      // (e.g. <p>|) instead of inside a text node. Resolve to the nearest text node.
      if (node.nodeType !== Node.TEXT_NODE) {
        let resolved = false;
        if (offset > 0 && offset <= node.childNodes.length) {
          let child = node.childNodes[offset - 1];
          while (child && child.nodeType !== Node.TEXT_NODE && child.lastChild) {
            child = child.lastChild;
          }
          if (child && child.nodeType === Node.TEXT_NODE) {
            node = child;
            offset = child.textContent.length;
            resolved = true;
          }
        }
        if (!resolved) {
          return { currentWord: '', previousWord: '', hasModalVerb: false };
        }
      }

      text = node.textContent;
      cursorPos = offset;
    } else {
      text = el.value || '';
      cursorPos = el.selectionStart || 0;
    }

    const beforeCursor = text.slice(0, cursorPos);

    // Get current word
    const currentMatch = beforeCursor.match(/[\wáàâäãåæéèêëíìîïóòôöõøúùûüñçß]+$/i);
    const currentWord = currentMatch ? currentMatch[0] : '';

    // Get previous word (word before the current one)
    const beforeCurrentWord = currentMatch
      ? beforeCursor.slice(0, beforeCursor.length - currentMatch[0].length).trimEnd()
      : beforeCursor.trimEnd();
    const prevMatch = beforeCurrentWord.match(/[\wáàâäãåæéèêëíìîïóòôöõøúùûüñçß]+$/i);
    const previousWord = prevMatch ? prevMatch[0].toLowerCase() : '';

    // Check if any modal verb exists in the sentence before the current word
    // This helps suggest infinitive forms (e.g., "ich kann Deutsch spr..." → "sprechen")
    const wordsBeforeCursor = beforeCurrentWord.toLowerCase().split(/\s+/);
    const hasModalVerb = wordsBeforeCursor.some(w => MODAL_VERBS.has(w));

    return { currentWord, previousWord, hasModalVerb };
  }

  // ── Phonetic equivalence rules per language ──
  // Maps common spelling confusions for dyslexic learners
  const PHONETIC_RULES = {
    de: [
      // Vowel confusions
      ['ä', 'ae'], ['ö', 'oe'], ['ü', 'ue'],
      ['ß', 'ss'],
      ['ei', 'ai'], ['ei', 'ey'], ['ai', 'ey'],
      // Consonant confusions
      ['sch', 'sh'], ['sch', 'sk'],
      ['ch', 'k'], ['ch', 'ck'],
      ['v', 'f'], ['v', 'w'],
      ['th', 't'],
      ['ph', 'f'],
      ['ie', 'i'], ['ie', 'ih'],
      ['z', 'ts'], ['z', 'tz'],
      ['qu', 'kw'],
      ['chs', 'x'], ['cks', 'x'],
      ['dt', 't'], ['d', 't'],  // Word-final devoicing
      ['b', 'p'], ['g', 'k'],   // Word-final devoicing
    ],
    es: [
      // Common Spanish confusions
      ['b', 'v'],
      ['c', 's'], ['c', 'z'], ['s', 'z'],
      ['ll', 'y'],
      ['j', 'g'],  // before e/i
      ['qu', 'k'], ['qu', 'c'],
      ['h', ''],  // Silent h
      ['rr', 'r'],
      ['ñ', 'ny'], ['ñ', 'ni'],
      ['gü', 'gu'],
    ],
    fr: [
      // Common French confusions
      ['é', 'e'], ['è', 'e'], ['ê', 'e'], ['ë', 'e'],
      ['à', 'a'], ['â', 'a'],
      ['ù', 'u'], ['û', 'u'],
      ['î', 'i'], ['ï', 'i'],
      ['ô', 'o'],
      ['ç', 's'], ['ç', 'c'],
      ['ph', 'f'],
      ['qu', 'k'],
      ['eau', 'o'], ['au', 'o'],
      ['ai', 'e'], ['ei', 'e'],
      ['ou', 'u'],
      ['oi', 'wa'],
      ['ch', 'sh'],
      ['gn', 'ny'],
    ]
  };

  /**
   * Normalize a string using phonetic rules for the current language.
   * Replaces common confusable patterns with a canonical form.
   */
  function phoneticNormalize(str) {
    const rules = PHONETIC_RULES[currentLang] || [];
    let normalized = str.toLowerCase();

    for (const [a, b] of rules) {
      // Normalize both sides to the shorter/canonical form
      const canonical = a.length <= b.length ? a : b;
      const variant = a.length <= b.length ? b : a;

      // Replace the variant with the canonical form
      if (variant && normalized.includes(variant)) {
        normalized = normalized.split(variant).join(canonical);
      }
    }

    // Also strip accents as a final normalization
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return normalized;
  }

  // ── Fuzzy matching ──
  function findSuggestions(input, maxResults, pronounContext = null, hasModalVerb = false) {
    const q = input.toLowerCase();
    const qPhonetic = phoneticNormalize(q);

    // Fast path: use prefix index to narrow candidates
    const scored = [];
    const scoredIndices = new Set();

    if (q.length >= 2) {
      const prefix2 = q.slice(0, 2);
      const candidates = prefixIndex.get(prefix2);
      if (candidates) {
        for (const idx of candidates) {
          scoredIndices.add(idx);
          const entry = wordList[idx];
          let score = matchScore(q, entry.word);
          if (score > 0) {
            applyBoosts(entry, score, scored, pronounContext, hasModalVerb);
          }
        }
        // Also check 3-char prefix for better precision
        if (q.length >= 3) {
          const prefix3 = q.slice(0, 3);
          const candidates3 = prefixIndex.get(prefix3);
          if (candidates3) {
            for (const idx of candidates3) {
              if (scoredIndices.has(idx)) continue;
              scoredIndices.add(idx);
              const entry = wordList[idx];
              let score = matchScore(q, entry.word);
              if (score > 0) {
                applyBoosts(entry, score, scored, pronounContext, hasModalVerb);
              }
            }
          }
        }
      }
    }

    // Phonetic/fuzzy fallback: scan full list only if prefix yielded few results
    if (scored.length < maxResults && q.length >= 3) {
      for (let i = 0; i < wordList.length; i++) {
        if (scoredIndices.has(i)) continue;
        const entry = wordList[i];
        const targetPhonetic = phoneticNormalize(entry.word);
        const score = phoneticMatchScore(qPhonetic, targetPhonetic);
        if (score > 0) {
          applyBoosts(entry, score, scored, pronounContext, hasModalVerb);
        }
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Deduplicate by display word
    const seen = new Set();
    const results = [];
    for (const s of scored) {
      const key = s.display.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(s);
        if (results.length >= maxResults) break;
      }
    }

    return results;
  }

  function applyBoosts(entry, score, scored, pronounContext, hasModalVerb) {
    // Boost recently used words
    if (recentWordsSet.has(entry.word)) {
      score += 50;
    }

    // When a modal verb is in the sentence, boost infinitive (base) verb forms
    if (hasModalVerb && entry.type === 'base' && entry.bank === 'verbbank') {
      score += 250;
    }

    // Boost conjugated forms that match the pronoun context
    if (!hasModalVerb && pronounContext && entry.type === 'conjugation') {
      if (entry.pronoun === pronounContext) {
        score += 200;
      }
    }

    scored.push({ ...entry, score });
  }

  function matchScore(query, target) {
    // Exact start match = highest
    if (target.startsWith(query)) return 100 + (query.length / target.length) * 50;

    // Contains = medium
    if (target.includes(query)) return 50;

    // Fuzzy: Levenshtein-based for short inputs (typo correction)
    if (query.length >= 3) {
      // Check if any word-start substring of target is close
      const maxDist = query.length <= 4 ? 1 : 2;
      const targetPrefix = target.slice(0, query.length + maxDist);
      const dist = levenshtein(query, targetPrefix);
      if (dist <= maxDist) {
        return 30 - dist * 5;
      }
    }

    return 0;
  }

  /**
   * Score a phonetically normalized query against a phonetically normalized target.
   * Used when standard matching fails, to catch spelling confusions.
   */
  function phoneticMatchScore(queryPhonetic, targetPhonetic) {
    // Phonetic starts-with
    if (targetPhonetic.startsWith(queryPhonetic)) {
      return 70 + (queryPhonetic.length / targetPhonetic.length) * 20;
    }

    // Phonetic contains
    if (targetPhonetic.includes(queryPhonetic)) {
      return 35;
    }

    // Phonetic fuzzy (Levenshtein on normalized forms)
    if (queryPhonetic.length >= 3) {
      const maxDist = queryPhonetic.length <= 4 ? 1 : 2;
      const targetPrefix = targetPhonetic.slice(0, queryPhonetic.length + maxDist);
      const dist = levenshtein(queryPhonetic, targetPrefix);
      if (dist <= maxDist) {
        return 20 - dist * 5;
      }
    }

    return 0;
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[m][n];
  }

  // ── Show / hide dropdown ──
  function showDropdown(suggestions, el) {
    selectedIndex = 0;

    dropdown.innerHTML = suggestions.map((s, i) => {
      const posLabel = s.bank ? BANK_TO_POS_SHORT[s.bank] || '' : '';
      return `
      <div class="lh-pred-item ${i === 0 ? 'selected' : ''}" data-word="${escapeAttr(s.display)}">
        <span class="lh-pred-word">${escapeHtml(s.display)}</span>
        ${posLabel ? `<span class="lh-pred-pos">${escapeHtml(posLabel)}</span>` : ''}
        <span class="lh-pred-translation">${escapeHtml(s.translation)}</span>
      </div>`;
    }).join('') + '<div class="lh-pred-hint">Tab for å velge</div>';

    // Attach click handlers — preventDefault keeps focus in the editor,
    // stopPropagation prevents CKEditor from seeing the click and blurring.
    dropdown.querySelectorAll('.lh-pred-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applySuggestion(item.dataset.word);
      });
    });

    // Position near the input
    positionDropdown(el);
    dropdown.classList.add('visible');
  }

  function positionDropdown(el) {
    let rect;
    if (el.isContentEditable) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } else {
        rect = el.getBoundingClientRect();
      }
    } else {
      rect = el.getBoundingClientRect();
    }

    let top = rect.bottom + 4;
    let left = rect.left;

    // Adjust if going off-screen
    dropdown.style.left = Math.max(8, left) + 'px';
    dropdown.style.top = top + 'px';

    // After rendering, check if it overflows
    requestAnimationFrame(() => {
      const dRect = dropdown.getBoundingClientRect();
      if (dRect.bottom > window.innerHeight - 8) {
        dropdown.style.top = (rect.top - dRect.height - 4) + 'px';
      }
      if (dRect.right > window.innerWidth - 8) {
        dropdown.style.left = (window.innerWidth - dRect.width - 8) + 'px';
      }
    });
  }

  function hideDropdown() {
    dropdown.classList.remove('visible');
    selectedIndex = -1;
  }

  // ── Apply suggestion ──
  function applySuggestion(word) {
    if (!activeElement) return;

    if (activeElement.isContentEditable) {
      applyToContentEditable(word);
    } else {
      applyToInput(word);
    }

    trackRecentWord(word);
    hideDropdown();
  }

  function applyToInput(word) {
    const el = activeElement;
    const text = el.value || '';
    const cursorPos = el.selectionStart || 0;

    // Find the current word boundaries
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const match = before.match(/[\wáàâäãåæéèêëíìîïóòôöõøúùûüñçß]+$/i);

    if (match) {
      const wordStart = cursorPos - match[0].length;
      el.value = text.slice(0, wordStart) + word + after;
      const newPos = wordStart + word.length;
      el.selectionStart = newPos;
      el.selectionEnd = newPos;
    } else {
      el.value = text.slice(0, cursorPos) + word + after;
      const newPos = cursorPos + word.length;
      el.selectionStart = newPos;
      el.selectionEnd = newPos;
    }

    // Trigger input event so page JS reacts
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyToContentEditable(word) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    let cursorPos = range.startOffset;

    // Resolve element node to nearest text node (same as getTextContext)
    if (node.nodeType !== Node.TEXT_NODE) {
      if (cursorPos > 0 && cursorPos <= node.childNodes.length) {
        let child = node.childNodes[cursorPos - 1];
        while (child && child.nodeType !== Node.TEXT_NODE && child.lastChild) {
          child = child.lastChild;
        }
        if (child && child.nodeType === Node.TEXT_NODE) {
          node = child;
          cursorPos = child.textContent.length;
        } else {
          return;
        }
      } else {
        return;
      }
    }

    const text = node.textContent;
    const before = text.slice(0, cursorPos);
    const match = before.match(/[\wáàâäãåæéèêëíìîïóòôöõøúùûüñçß]+$/i);

    if (match) {
      const wordStart = cursorPos - match[0].length;

      // Select the partial word so it gets replaced
      const selectRange = document.createRange();
      selectRange.setStart(node, wordStart);
      selectRange.setEnd(node, cursorPos);
      sel.removeAllRanges();
      sel.addRange(selectRange);

      // Ensure the contenteditable has focus (needed after dropdown clicks)
      if (activeElement) activeElement.focus();

      // Use execCommand('insertText') so editors like CKEditor process it
      // through their input pipeline (fires beforeinput/input events).
      // Falls back to direct DOM manipulation for basic contenteditables.
      if (!document.execCommand('insertText', false, word)) {
        node.textContent = text.slice(0, wordStart) + word + text.slice(cursorPos);
        const newRange = document.createRange();
        newRange.setStart(node, wordStart + word.length);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  // ── Helpers ──
  function isTextInput(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'url', 'email'].includes(type);
    }
    return false;
  }

  function escapeHtml(str) {
    const d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
