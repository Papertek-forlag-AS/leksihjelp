/**
 * Leksihjelp — Word Prediction (content script)
 *
 * Provides autocomplete suggestions as user types in any text input.
 * Uses fuzzy matching against the shared vocab seam.
 * Works with <input>, <textarea>, and contenteditable elements.
 * Includes conjugated verb forms and declined noun forms.
 *
 * Vocabulary is loaded by vocab-seam.js and consumed here via __lexiVocab.
 * Grammar-feature gating is seam-owned: the seam emits the filtered wordList
 * and this file consumes it as-is (no local isFeatureEnabled duplicate).
 */

(function () {
  'use strict';

  const { t, initI18n, setUiLanguage, getUiLanguage } = self.__lexiI18n;

  // Vocab seam binding. Must load before this script (see manifest.json
  // content_scripts order).
  const VOCAB = self.__lexiVocab;
  if (!VOCAB) {
    console.error('[lexi-prediction] __lexiVocab not loaded — check manifest content_scripts order');
    return;
  }

  let dropdown = null;
  let activeElement = null;
  let selectedIndex = -1;
  let enabled = true;
  let currentLang = 'en';
  let lexiPaused = false; // Global pause state
  let predictionTimer = null; // debounce timer for prediction
  let prefixIndex = new Map(); // 2-3 char prefix → [indices into VOCAB.getWordList()]
  let recentWords = [];    // Last 20 selected words per language
  let recentWordsSet = new Set(); // For O(1) lookup
  let knownPresens = new Set();    // Known present-tense verb forms for tense detection (rebuilt from VOCAB)
  let knownPreteritum = new Set(); // Known past-tense verb forms for tense detection (rebuilt from VOCAB)

  // ── UX-02: top-3 default with "Vis flere" reveal to 8 (Phase 5 Plan 03) ──
  // VISIBLE_DEFAULT: rows shown on first render (dyslexia-friendly cognitive
  // load). VISIBLE_EXPANDED: rows shown after user clicks "Vis flere" or
  // ArrowDowns past the last visible row.
  const VISIBLE_DEFAULT = 3;
  const VISIBLE_EXPANDED = 8;
  // lastSuggestions: captured from runPrediction so the reveal-click handler
  // can re-render in place without re-running findSuggestions.
  let lastSuggestions = [];
  // expanded: per-session reveal state. RESET to false at the top of every
  // showDropdown() call (Pitfall 5 from 05-RESEARCH.md) so a previously-
  // expanded list doesn't leak into the next keystroke's dropdown.
  let expanded = false;

  // ── Frequency helpers (Phase 3-04: WP-01 + WP-03 + WP-04) ──
  //
  // getEffectiveFreq: Zipf sidecar (NB/NN via VOCAB.getFrequency, populated
  // from freq-{lang}.json) takes priority; seam-normalized entry.zipf
  // (computed in vocab-seam-core.js buildWordList) is the fallback + sole
  // source for DE/ES/FR/EN. Returns 0 when neither is available — guards
  // Pitfall 7 (no raw entry.frequency reads anywhere in the ranker).
  function getEffectiveFreq(entry) {
    const z = VOCAB.getFrequency(entry.word);
    if (typeof z === 'number') return z;
    if (typeof entry.zipf === 'number') return entry.zipf;
    return 0;
  }

  // sharedSuffixLen: tiebreaker helper. Counts trailing characters that match
  // between query and candidate. Mirrors the spell-check core helper but is
  // declared locally — word-prediction is disallowed from importing the
  // spell-check surface (INFRA-04 structural separability).
  function sharedSuffixLen(a, b) {
    if (!a || !b) return 0;
    const la = a.length, lb = b.length;
    const n = Math.min(la, lb);
    let i = 0;
    while (i < n && a[la - 1 - i] === b[lb - 1 - i]) i++;
    return i;
  }

  // freqSignal (WP-01): linear in Zipf; multiplier 20 means top-Zipf (~7) adds
  // ~140, bottom-Zipf (0) adds 0. Bigram signal caps at +120; the two top out
  // comparable so neither dominates the ranker.
  function freqSignal(entry) {
    const z = getEffectiveFreq(entry);
    return z * 20;
  }

  // lowFreqDemotion (WP-04): demote rare/obscure forms so the top-3 isn't
  // dominated by random high-score-but-low-frequency artefacts. Floor Zipf
  // 1.5 (≈ occurs ~30/million) is generous so learner-core vocab never
  // triggers it. Entries with no frequency data at all (Zipf 0) are LEFT
  // ALONE — demoting them would punish words that simply don't appear in
  // the sidecar (very common for proper nouns, niche learner-core entries).
  function lowFreqDemotion(entry) {
    const z = getEffectiveFreq(entry);
    if (z > 0 && z < 1.5) return -80;
    return 0;
  }

  // ── Init ──
  init();

  async function init() {
    await initI18n();
    const stored = await chromeStorageGet(['language', 'predictionEnabled', 'lexiPaused']);
    currentLang = stored.language || 'en';
    enabled = stored.predictionEnabled !== false;
    lexiPaused = stored.lexiPaused || false;

    await loadRecentWords(currentLang);
    createDropdown();
    attachGlobalListeners();
    if (lexiPaused) updatePauseBadge();

    // Rebuild local derived state (prefix index + tense sets) once the seam
    // has vocab loaded. Seam's onReady queue handles late subscribers.
    VOCAB.onReady(refreshFromVocab);

    chrome.runtime.onMessage.addListener(async (msg) => {
      if (msg.type === 'LANGUAGE_CHANGED') {
        // Vocab-seam (registered earlier in manifest order) kicks off its own
        // reload on this message. We update currentLang + recent words, then
        // queue a refresh for when the seam signals ready again. Seam sets
        // ready=false synchronously before awaiting the reload, so our
        // onReady call queues deterministically.
        currentLang = msg.language;
        await loadRecentWords(msg.language);
        VOCAB.onReady(refreshFromVocab);
      }
      if (msg.type === 'PREDICTION_TOGGLED') {
        enabled = msg.enabled;
        if (!enabled) hideDropdown();
      }
      if (msg.type === 'GRAMMAR_FEATURES_CHANGED') {
        // Vocab-seam rebuilds its indexes on this message (grammar toggles
        // change which forms make it into the wordList). We refresh our
        // prefix index + tense sets when the seam signals ready.
        VOCAB.onReady(refreshFromVocab);
      }
      if (msg.type === 'LEXI_PAUSED') {
        lexiPaused = msg.paused;
        if (lexiPaused) hideDropdown();
        updatePauseBadge();
      }
      if (msg.type === 'UI_LANGUAGE_CHANGED') {
        setUiLanguage(msg.uiLanguage);
      }
    });
  }

  // Rebuild prefixIndex + knownPresens/knownPreteritum from the seam's current
  // wordList. Cheap — linear in wordList size. Called on init-ready and after
  // LANGUAGE_CHANGED / GRAMMAR_FEATURES_CHANGED.
  function refreshFromVocab() {
    buildPrefixIndex();
    buildTenseSets();
  }

  function chromeStorageGet(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  // Language labels for dropdown footer
  const LANG_LABELS = {
    de: 'DE', es: 'ES', fr: 'FR', en: 'EN', nb: 'NB', nn: 'NN'
  };

  // Short part-of-speech labels for dropdown badges (i18n)
  function bankToPosShort(bank) {
    const keys = { verbbank: 'pos_verb_short', nounbank: 'pos_noun_short', adjectivebank: 'pos_adjective_short',
      articlesbank: 'pos_article_short', generalbank: 'pos_general_short', numbersbank: 'pos_number_short',
      phrasesbank: 'pos_phrase_short', pronounsbank: 'pos_pronoun_short' };
    return t(keys[bank] || 'pos_general_short');
  }

  // Pronoun context mapping — per-language to avoid key conflicts (e.g. 'du' in DE vs NB)
  const PRONOUN_CONTEXT_BY_LANG = {
    de: {
      'ich': 'ich', 'du': 'du', 'er': 'er/sie/es',
      'sie': 'er/sie/es', 'es': 'er/sie/es',
      'wir': 'wir', 'ihr': 'ihr'
    },
    es: {
      'yo': 'yo', 'tú': 'tú', 'tu': 'tú',
      'él': 'él/ella/usted', 'ella': 'él/ella/usted', 'usted': 'él/ella/usted',
      'nosotros': 'nosotros', 'nosotras': 'nosotros',
      'vosotros': 'vosotros', 'vosotras': 'vosotros',
      'ellos': 'ellos/ellas/ustedes', 'ellas': 'ellos/ellas/ustedes', 'ustedes': 'ellos/ellas/ustedes'
    },
    fr: {
      'je': 'je', "j'": 'je',
      'il': 'il/elle/on', 'elle': 'il/elle/on', 'on': 'il/elle/on',
      'tu': 'tu', 'nous': 'nous', 'vous': 'vous',
      'ils': 'ils/elles', 'elles': 'ils/elles'
    },
    nb: {
      'jeg': '_nb_pronoun', 'du': '_nb_pronoun', 'han': '_nb_pronoun',
      'hun': '_nb_pronoun', 'vi': '_nb_pronoun', 'dere': '_nb_pronoun',
      'de': '_nb_pronoun', 'det': '_nb_pronoun', 'den': '_nb_pronoun', 'man': '_nb_pronoun'
    },
    nn: {
      'eg': '_nb_pronoun', 'du': '_nb_pronoun', 'han': '_nb_pronoun',
      'ho': '_nb_pronoun', 'vi': '_nb_pronoun', 'dykk': '_nb_pronoun',
      'dei': '_nb_pronoun', 'det': '_nb_pronoun', 'den': '_nb_pronoun', 'ein': '_nb_pronoun'
    }
  };

  function getPronounContext(word) {
    const langMap = PRONOUN_CONTEXT_BY_LANG[currentLang];
    return (langMap && langMap[word]) || null;
  }

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
    'veux', 'veut', 'voulons', 'voulez', 'veulent',
    // Norwegian - kunne (can)
    'kan', 'kunne', 'kunna',
    // Norwegian - måtte (must)
    'må', 'måtte',
    // Norwegian - ville (want)
    'vil', 'ville',
    // Norwegian - skulle (shall)
    'skal', 'skulle',
    // Norwegian - burde (should)
    'bør', 'burde',
    // Norwegian - få (get to)
    'får', 'fikk', 'fekk'
  ]);

  // Infinitive markers — only trigger when IMMEDIATELY preceding the current word
  // (unlike modal verbs which are scanned across the whole sentence)
  const INFINITIVE_MARKERS = new Set(['å', 'zu']);

  // ── POS expectation: determiners and prepositions ──
  // After a determiner → expect noun/adjective (strong signal with gender hint)
  // After a preposition → expect noun/adjective (moderate signal, no gender)
  const DETERMINERS_BY_LANG = {
    de: {
      'der': 'm', 'die': 'f', 'das': 'n',
      'ein': null, 'eine': 'f', 'einen': 'm', 'einem': null, 'einer': 'f',
      'dem': null, 'den': 'm',
      'kein': null, 'keine': 'f', 'keinen': 'm', 'keinem': null, 'keiner': 'f',
      'mein': null, 'meine': 'f', 'meinen': 'm',
      'dein': null, 'deine': 'f', 'deinen': 'm',
      'sein': null, 'seine': 'f', 'seinen': 'm',
      'ihre': 'f', 'ihren': 'm',
      'unsere': 'f', 'unseren': 'm',
      'dieser': 'm', 'diese': 'f', 'dieses': 'n', 'diesem': null, 'diesen': 'm',
      'jeder': 'm', 'jede': 'f', 'jedes': 'n',
      'welcher': 'm', 'welche': 'f', 'welches': 'n',
    },
    es: {
      'el': 'm', 'la': 'f', 'los': 'm', 'las': 'f',
      'un': 'm', 'una': 'f', 'unos': 'm', 'unas': 'f',
      'nuestro': 'm', 'nuestra': 'f', 'nuestros': 'm', 'nuestras': 'f',
      'este': 'm', 'esta': 'f', 'estos': 'm', 'estas': 'f',
      'ese': 'm', 'esa': 'f', 'esos': 'm', 'esas': 'f',
      'aquel': 'm', 'aquella': 'f',
      'mi': null, 'tu': null, 'su': null,
      'mis': null, 'tus': null, 'sus': null,
    },
    fr: {
      'le': 'm', 'la': 'f', 'les': null,
      'un': 'm', 'une': 'f', 'des': null,
      'du': 'm',
      'mon': null, 'ma': 'f', 'mes': null,
      'ton': null, 'ta': 'f', 'tes': null,
      'son': null, 'sa': 'f', 'ses': null,
      'notre': null, 'votre': null, 'leur': null,
      'ce': 'm', 'cet': 'm', 'cette': 'f', 'ces': null,
      'quel': 'm', 'quelle': 'f', 'quels': 'm', 'quelles': 'f',
    },
    nb: {
      // Only unambiguous determiners (den/det/de are also pronouns → handled there)
      'en': 'm', 'ei': 'f', 'et': 'n',
      'min': 'm', 'mi': 'f', 'mitt': 'n',
      'din': 'm', 'di': 'f', 'ditt': 'n',
      'si': 'f', 'sitt': 'n',
      'vårt': 'n', 'denne': null, 'dette': 'n',
      'noe': 'n', 'intet': 'n', 'hvert': 'n',
      'noen': null, 'ingen': null, 'hver': null, 'alle': null,
    },
    nn: {
      'ein': 'm', 'ei': 'f', 'eit': 'n',
      'min': 'm', 'mi': 'f', 'mitt': 'n',
      'din': 'm', 'di': 'f', 'ditt': 'n',
      'si': 'f', 'sitt': 'n',
      'vårt': 'n', 'denne': null, 'dette': 'n',
      'noko': 'n', 'inkje': 'n', 'kvart': 'n',
      'nokon': null, 'ingen': null, 'kvar': null, 'alle': null,
    }
  };

  // NB/NN number + definiteness hints from determiners, demonstratives, quantifiers.
  // Parallel to DETERMINERS_BY_LANG (which carries gender) — this one drives
  // noun/adjective form agreement for Norwegian.
  const NB_NN_AGREEMENT_CONTEXT = {
    nb: {
      'en': { number: 'entall', definiteness: 'ubestemt' },
      'ei': { number: 'entall', definiteness: 'ubestemt' },
      'et': { number: 'entall', definiteness: 'ubestemt' },
      'den': { number: 'entall', definiteness: 'bestemt' },
      'det': { number: 'entall', definiteness: 'bestemt' },
      'de': { number: 'flertall', definiteness: 'bestemt' },
      'denne': { number: 'entall', definiteness: 'bestemt' },
      'dette': { number: 'entall', definiteness: 'bestemt' },
      'disse': { number: 'flertall', definiteness: 'bestemt' },
      'mange': { number: 'flertall' },
      'flere': { number: 'flertall' },
      'noen': { number: 'flertall' },
      'få': { number: 'flertall' },
      'alle': { number: 'flertall' },
      'begge': { number: 'flertall' },
    },
    nn: {
      'ein': { number: 'entall', definiteness: 'ubestemt' },
      'ei': { number: 'entall', definiteness: 'ubestemt' },
      'eit': { number: 'entall', definiteness: 'ubestemt' },
      'den': { number: 'entall', definiteness: 'bestemt' },
      'det': { number: 'entall', definiteness: 'bestemt' },
      'dei': { number: 'flertall', definiteness: 'bestemt' },
      'denne': { number: 'entall', definiteness: 'bestemt' },
      'dette': { number: 'entall', definiteness: 'bestemt' },
      'desse': { number: 'flertall', definiteness: 'bestemt' },
      'mange': { number: 'flertall' },
      'fleire': { number: 'flertall' },
      'nokon': { number: 'flertall' },
      'få': { number: 'flertall' },
      'alle': { number: 'flertall' },
      'begge': { number: 'flertall' },
    },
  };

  // German preposition → grammatical case mapping
  // Used to boost the correct case form after a preposition
  const PREPOSITION_CASE = {
    // Accusative only (durch, für, gegen, ohne, um, bis)
    'durch': 'akkusativ', 'für': 'akkusativ', 'gegen': 'akkusativ',
    'ohne': 'akkusativ', 'um': 'akkusativ', 'bis': 'akkusativ',
    // Dative only (aus, bei, mit, nach, seit, von, gegenüber)
    'aus': 'dativ', 'bei': 'dativ', 'mit': 'dativ', 'nach': 'dativ',
    'seit': 'dativ', 'von': 'dativ', 'gegenüber': 'dativ',
    // Genitive (während, wegen, trotz, statt)
    'während': 'genitiv', 'wegen': 'genitiv', 'trotz': 'genitiv', 'statt': 'genitiv',
    // Two-way / Wechselpräpositionen (acc or dat depending on motion vs location)
    'an': 'wechsel', 'auf': 'wechsel', 'hinter': 'wechsel', 'in': 'wechsel',
    'neben': 'wechsel', 'über': 'wechsel', 'unter': 'wechsel', 'vor': 'wechsel',
    'zwischen': 'wechsel',
  };

  // Prepositions — moderate noun/adj signal (no verb demote, since
  // constructions like "ir a + infinitive" or "de + infinitive" exist)
  const PREPOSITIONS_BY_LANG = {
    de: new Set(['in', 'auf', 'mit', 'für', 'an', 'bei', 'nach', 'von', 'aus',
      'über', 'unter', 'vor', 'hinter', 'zwischen', 'neben', 'gegen', 'ohne',
      'um', 'durch', 'bis', 'seit', 'während', 'wegen', 'trotz', 'statt']),
    es: new Set(['en', 'de', 'a', 'por', 'para', 'con', 'sin', 'sobre', 'entre',
      'hacia', 'hasta', 'desde', 'durante', 'contra', 'tras']),
    fr: new Set(['à', 'de', 'en', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour',
      'par', 'entre', 'vers', 'chez', 'contre', 'depuis', 'pendant',
      'avant', 'après', 'devant', 'derrière', 'malgré']),
    nb: new Set(['i', 'på', 'med', 'for', 'til', 'fra', 'av', 'om', 'hos', 'mot',
      'over', 'under', 'ved', 'etter', 'mellom', 'gjennom', 'blant',
      'langs', 'rundt', 'uten', 'innen', 'utenfor', 'innenfor']),
    nn: new Set(['i', 'på', 'med', 'for', 'til', 'frå', 'av', 'om', 'hos', 'mot',
      'over', 'under', 'ved', 'etter', 'mellom', 'gjennom', 'blant',
      'langs', 'rundt', 'utan', 'innan', 'utanfor', 'innanfor']),
  };

  // ── Prefix index for fast candidate lookup ──
  // Rebuilt from VOCAB.getWordList() whenever the seam signals ready.
  function buildPrefixIndex() {
    prefixIndex.clear();
    const wordList = VOCAB.getWordList();
    for (let i = 0; i < wordList.length; i++) {
      const w = wordList[i].word;
      for (let len = 2; len <= Math.min(3, w.length); len++) {
        const prefix = w.slice(0, len);
        if (!prefixIndex.has(prefix)) prefixIndex.set(prefix, []);
        prefixIndex.get(prefix).push(i);
      }
    }
  }

  // ── Tense-detection sets ──
  // Reconstructs presens/preteritum verb-form sets from the seam's wordList.
  // Mirrors the old loadWordList tense tracking (word-prediction.js:559–599
  // pre-refactor). NB/NN uses entry.formKey ('presens'/'preteritum'); other
  // languages use entry.tenseKey ('present'/'past') — both precomputed by
  // vocab-seam-core.js.
  function buildTenseSets() {
    knownPresens.clear();
    knownPreteritum.clear();
    const wordList = VOCAB.getWordList();
    const isNorwegian = currentLang === 'nb' || currentLang === 'nn';
    for (const entry of wordList) {
      if (entry.type !== 'conjugation') continue;
      if (isNorwegian) {
        if (entry.formKey === 'presens') knownPresens.add(entry.word);
        else if (entry.formKey === 'preteritum') knownPreteritum.add(entry.word);
      } else {
        if (entry.tenseKey === 'present') knownPresens.add(entry.word);
        else if (entry.tenseKey === 'past') knownPreteritum.add(entry.word);
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
    if (!VOCAB.isTextInput(el)) return;
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
    if (!VOCAB.isTextInput(el)) return;
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
    if (lexiPaused) return;
    activeElement = el;
    const { currentWord, previousWord, hasModalVerb, detectedTense, expectedPOS, genderContext, posStrength, caseContext, previousTwoWords, numberContext, definitenessContext } = getTextContext(el);

    if (currentWord && currentWord.length >= 2) {
      // Detect pronoun context for smart verb suggestions
      const pronounContext = getPronounContext(previousWord);
      // Infinitive markers (å, zu) only count when immediately preceding
      const hasInfinitiveMarker = hasModalVerb || INFINITIVE_MARKERS.has(previousWord);
      const suggestions = findSuggestions(currentWord, 8, pronounContext, hasInfinitiveMarker, detectedTense, expectedPOS, genderContext, posStrength, caseContext, previousWord, previousTwoWords, numberContext, definitenessContext);

      // NB/NN: check for compound word matches (særskriving detection)
      // If student typed "skole sekk", search for "skolesekk" as a compound
      if ((currentLang === 'nb' || currentLang === 'nn') && previousWord && previousWord.length >= 2) {
        const compound = (previousWord + currentWord).toLowerCase();
        const compoundHits = findSuggestions(compound, 3, null, false, null);
        const replaceLen = previousWord.length + 1 + currentWord.length; // prev + space + current
        for (const hit of compoundHits) {
          // Only include when the combined text is an exact prefix of a real word
          if (hit.word.startsWith(compound) && hit.word.length >= compound.length) {
            suggestions.unshift({
              ...hit,
              type: 'compound',
              score: hit.score + 300,
              compoundReplaceLen: replaceLen
            });
          }
        }
        // Pitfall 6 (05-RESEARCH.md): splice cap must equal the max-reveal cap
        // (VISIBLE_EXPANDED=8), not the visible-default cap. Otherwise a
        // 4-hit compound unshift would knock out regular top-3 candidates
        // before renderDropdownBody gets a chance to slice for the view.
        suggestions.splice(8);
      }

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
    if (!dropdown || !dropdown.classList.contains('visible')) return;

    const items = dropdown.querySelectorAll('.lh-pred-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      // Auto-reveal path: if stepping past the last visible item AND more
      // candidates are available in lastSuggestions, expand in place and
      // advance selection onto the first newly-revealed row (zero extra
      // keystrokes for keyboard users). Pitfall 5: expanded is reset on
      // every new showDropdown() call so reveal state doesn't leak across
      // keystrokes.
      if (
        selectedIndex === items.length - 1 &&
        !expanded &&
        lastSuggestions.length > items.length
      ) {
        expanded = true;
        renderDropdownBody(activeElement);
        const newItems = dropdown.querySelectorAll('.lh-pred-item');
        // Advance selection onto the first newly-revealed row. items.length
        // is the pre-expand visible count (e.g. 3); clamp to newItems.length-1
        // defensively in case renderDropdownBody revealed fewer than expected.
        selectedIndex = Math.min(items.length, newItems.length - 1);
        updateSelection(newItems);
      } else {
        selectedIndex = (selectedIndex + 1) % items.length;
        updateSelection(items);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      updateSelection(items);
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        e.preventDefault();
        e.stopPropagation();
        const item = items[selectedIndex];
        applySuggestion(item.dataset.word, parseInt(item.dataset.compoundLen) || 0);
      }
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  }

  function handleClick(e) {
    if (!dropdown || dropdown.contains(e.target)) return;
    const item = e.target.closest('.lh-pred-item');
    if (item) {
      e.preventDefault();
      applySuggestion(item.dataset.word, parseInt(item.dataset.compoundLen) || 0);
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
      if (!sel.rangeCount) return { currentWord: '', previousWord: '', hasModalVerb: false, detectedTense: null, expectedPOS: null, genderContext: null, posStrength: 0, caseContext: null, previousTwoWords: '' };
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
          return { currentWord: '', previousWord: '', hasModalVerb: false, detectedTense: null, expectedPOS: null, genderContext: null, posStrength: 0, caseContext: null, previousTwoWords: '' };
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

    // Detect dominant tense in surrounding text (all languages)
    // Scans recent words for known present/past verb forms to detect tense consistency
    let detectedTense = null;
    {
      let presensCount = 0;
      let preteritumCount = 0;
      const recentTokens = wordsBeforeCursor.slice(-20);
      for (const w of recentTokens) {
        if (knownPresens.has(w)) presensCount++;
        if (knownPreteritum.has(w)) preteritumCount++;
      }
      // Need at least 2 verb hits to be confident, and a clear majority
      const total = presensCount + preteritumCount;
      if (total >= 2) {
        if (presensCount > preteritumCount) detectedTense = 'present';
        else if (preteritumCount > presensCount) detectedTense = 'past';
      }
    }

    // German: detect grammatical case from governing preposition
    // Checks previous word and 2 words back (for "mit dem H..." pattern)
    let caseContext = null;
    if (currentLang === 'de') {
      if (previousWord) caseContext = PREPOSITION_CASE[previousWord] || null;
      if (!caseContext && wordsBeforeCursor.length >= 2) {
        const twoBack = wordsBeforeCursor[wordsBeforeCursor.length - 2];
        if (twoBack) caseContext = PREPOSITION_CASE[twoBack] || null;
      }
    }

    // Detect POS expectation and gender context from determiners/prepositions
    let expectedPOS = null;  // 'noun_adj' when next word is likely a noun/adjective
    let genderContext = null; // gender hint ('m', 'f', 'n') from determiner
    let posStrength = 0;     // 2 = strong (determiner), 1 = moderate (preposition)

    const detMap = DETERMINERS_BY_LANG[currentLang];
    if (detMap) {
      // Check immediate previous word for a determiner
      if (previousWord && detMap[previousWord] !== undefined) {
        expectedPOS = 'noun_adj';
        genderContext = detMap[previousWord];
        posStrength = 2;
      } else if (wordsBeforeCursor.length >= 2) {
        // 2-word lookback: handles "die große Sch..." (article + adjective + noun)
        const twoBack = wordsBeforeCursor[wordsBeforeCursor.length - 2];
        if (twoBack && detMap[twoBack] !== undefined) {
          expectedPOS = 'noun_adj';
          genderContext = detMap[twoBack];
          posStrength = 2;
        }
      }
    }

    // Prepositions: moderate noun/adj signal (no verb demote)
    if (!expectedPOS) {
      const prepSet = PREPOSITIONS_BY_LANG[currentLang];
      if (prepSet && previousWord && prepSet.has(previousWord)) {
        expectedPOS = 'noun_adj';
        posStrength = 1;
      }
    }

    // NB/NN number + definiteness agreement signal
    let numberContext = null;
    let definitenessContext = null;
    if (currentLang === 'nb' || currentLang === 'nn') {
      const agreeMap = NB_NN_AGREEMENT_CONTEXT[currentLang];
      let agree = previousWord && agreeMap[previousWord];
      if (!agree && wordsBeforeCursor.length >= 2) {
        const twoBack = wordsBeforeCursor[wordsBeforeCursor.length - 2];
        agree = twoBack && agreeMap[twoBack];
      }
      if (agree) {
        numberContext = agree.number || null;
        definitenessContext = agree.definiteness || null;
      }
    }

    // Two-word lookback for multi-word bigram keys (e.g. "ha det" → "bra")
    const previousTwoWords = wordsBeforeCursor.length >= 2
      ? wordsBeforeCursor.slice(-2).join(' ')
      : '';

    return { currentWord, previousWord, hasModalVerb, detectedTense, expectedPOS, genderContext, posStrength, caseContext, previousTwoWords, numberContext, definitenessContext };
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
    ],
    nb: [
      // Double vs single consonants (most common Norwegian spelling error)
      ['ll', 'l'], ['mm', 'm'], ['nn', 'n'], ['tt', 't'],
      ['kk', 'k'], ['pp', 'p'], ['ss', 's'], ['dd', 'd'],
      ['gg', 'g'], ['ff', 'f'], ['bb', 'b'], ['rr', 'r'],
      // Sibilant confusions
      ['skj', 'sj'], ['sk', 'sj'],
      ['kj', 'tj'], ['kj', 'k'],
      // Silent/weak consonants
      ['hv', 'v'],       // hva/va, hvor/vor
      ['gj', 'j'],       // gjøre/jøre
      ['hj', 'j'],       // hjemme/jemme
      ['lj', 'j'],       // ljug/jug
      // Final devoicing / confusion
      ['d', 't'], ['g', 'k'],
      ['nd', 'nn'],       // band/bann
      // Vowel confusions
      ['æ', 'e'], ['ø', 'o'], ['å', 'o'],
      ['ei', 'e'], ['ai', 'e'],
      ['au', 'ø'],
      ['y', 'i'],
    ],
    nn: [
      // Double vs single consonants
      ['ll', 'l'], ['mm', 'm'], ['nn', 'n'], ['tt', 't'],
      ['kk', 'k'], ['pp', 'p'], ['ss', 's'], ['dd', 'd'],
      ['gg', 'g'], ['ff', 'f'], ['bb', 'b'], ['rr', 'r'],
      // Sibilant confusions
      ['skj', 'sj'], ['sk', 'sj'],
      ['kj', 'tj'], ['kj', 'k'],
      // Silent/weak consonants
      ['hv', 'v'],
      ['gj', 'j'],
      ['hj', 'j'],
      ['lj', 'j'],
      // Final devoicing / confusion
      ['d', 't'], ['g', 'k'],
      ['nd', 'nn'],
      // Vowel confusions
      ['æ', 'e'], ['ø', 'o'], ['å', 'o'],
      ['ei', 'e'], ['ai', 'e'],
      ['au', 'ø'],
      ['y', 'i'],
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
  function findSuggestions(input, maxResults, pronounContext = null, hasModalVerb = false, detectedTense = null, expectedPOS = null, genderContext = null, posStrength = 0, caseContext = null, previousWord = '', previousTwoWords = '', numberContext = null, definitenessContext = null) {
    const q = input.toLowerCase();
    const qPhonetic = phoneticNormalize(q);

    // Read wordList fresh from the seam each call. Prefix-index entries hold
    // indices into whatever wordList was live when buildPrefixIndex ran — and
    // refreshFromVocab ensures the two stay in sync across LANGUAGE_CHANGED
    // and GRAMMAR_FEATURES_CHANGED (pitfall: a stale capture here would break
    // every suggestion after a language switch).
    const wordList = VOCAB.getWordList();

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
            applyBoosts(entry, score, scored, pronounContext, hasModalVerb, detectedTense, q, expectedPOS, genderContext, posStrength, caseContext, previousWord, previousTwoWords, numberContext, definitenessContext);
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
                applyBoosts(entry, score, scored, pronounContext, hasModalVerb, detectedTense, q, expectedPOS, genderContext, posStrength, caseContext, previousWord, previousTwoWords, numberContext, definitenessContext);
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
          applyBoosts(entry, score, scored, pronounContext, hasModalVerb, detectedTense, q, expectedPOS, genderContext, posStrength, caseContext, previousWord, previousTwoWords, numberContext, definitenessContext);
        }
      }
    }

    // Sort by score descending, with deterministic tiebreakers (WP-03):
    //   1. higher score wins
    //   2. higher effective frequency wins (Zipf sidecar > entry.zipf > 0)
    //   3. closer-to-query-length wins (favours exact-length matches)
    //   4. longer shared suffix wins (favours conjugations of the same stem)
    //   5. alphabetical — last resort, gives dev-readable, reproducible output
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const fa = getEffectiveFreq(a), fb = getEffectiveFreq(b);
      if (fa !== fb) return fb - fa;
      const la = Math.abs(a.word.length - q.length);
      const lb = Math.abs(b.word.length - q.length);
      if (la !== lb) return la - lb;
      const sa = sharedSuffixLen(q, a.word);
      const sb = sharedSuffixLen(q, b.word);
      if (sa !== sb) return sb - sa;
      return a.word.localeCompare(b.word);
    });

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

  function applyBoosts(entry, score, scored, pronounContext, hasModalVerb, detectedTense, query, expectedPOS, genderContext, posStrength, caseContext, previousWord, previousTwoWords, numberContext = null, definitenessContext = null) {
    // Phase 3-04 refactor: signal-table-style accumulation. Each numbered
    // block contributes a score delta; unlike the pre-refactor version we
    // never mutate `entry` directly — `workingEntry` carries the (possibly
    // re-typed) variant through the chain so the final push is unambiguous.
    // CALLER sites (lines ~826/840/856) are unchanged.

    let workingEntry = entry;

    // 1. Typo matches — type may flip to 'base' if input is too short relative
    //    to the correct word (kept first because it can re-type workingEntry).
    if (entry.type === 'typo' && score >= 50) {
      if (query && query.length / entry.display.length >= 0.6) {
        score += 150; // Genuine misspelling — boost and keep typo hint
      } else {
        // Input too short relative to the correct word — demote to regular suggestion
        workingEntry = { ...entry, type: 'base' };
        score += 30;
      }
    }

    // 2. Recency
    if (recentWordsSet.has(workingEntry.word)) {
      score += 50;
    }

    // 3. Modal verb + infinitive boost (DE/NB/NN/etc — guarded by entry shape)
    if (hasModalVerb && workingEntry.type === 'base' && workingEntry.bank === 'verbbank') {
      score += 250;
    }
    if (hasModalVerb && workingEntry.type === 'conjugation' && workingEntry.formKey === 'infinitiv') {
      score += 250;
    }

    // 4. Pronoun + tense (per-language signals; field-presence guards are
    //    sufficient — non-NB/NN entries don't carry _nb_pronoun, etc.)
    if (!hasModalVerb && pronounContext && workingEntry.type === 'conjugation') {
      if (workingEntry.pronoun === pronounContext) {
        score += 200;
      }
    }
    if (!hasModalVerb && pronounContext === '_nb_pronoun') {
      const targetTense = detectedTense || 'present';
      if (workingEntry.type === 'base' && workingEntry.bank === 'verbbank') {
        score += 150;
      }
      if (workingEntry.type === 'conjugation' && workingEntry.tenseKey === targetTense) {
        score += 200;
      }
    }
    if (detectedTense && workingEntry.type === 'conjugation' && workingEntry.tenseKey) {
      if (workingEntry.tenseKey === detectedTense) {
        score += 180;
      }
    }

    // 5. POS expectation: after determiners/prepositions, boost nouns/adjectives
    if (expectedPOS === 'noun_adj') {
      const isNounOrAdj = workingEntry.bank === 'nounbank' || workingEntry.bank === 'adjectivebank' ||
        workingEntry.type === 'nounform' || workingEntry.type === 'plural' || workingEntry.type === 'case' ||
        workingEntry.type === 'comparative' || workingEntry.type === 'superlative' || workingEntry.type === 'adjform';
      const isVerb = workingEntry.bank === 'verbbank' || workingEntry.type === 'conjugation';

      if (isNounOrAdj) {
        score += posStrength >= 2 ? 150 : 100;
      } else if (isVerb && posStrength >= 2) {
        score -= 100;
      }
    }

    // 6. Gender agreement (DE/ES/FR/NB/NN — non-NB/NN/non-DE entries lack
    //    `genus` so this naturally no-ops for languages without gender hints)
    if (genderContext && workingEntry.genus === genderContext) {
      score += 120;
    }

    // 7. NB/NN number + definiteness agreement (self-guards via field presence:
    //    only nounform/adjform entries carry both `number` and `definiteness`)
    if ((numberContext || definitenessContext) && (workingEntry.type === 'nounform' || workingEntry.type === 'adjform')) {
      const numMatch = numberContext && workingEntry.number === numberContext;
      const defMatch = definitenessContext && workingEntry.definiteness === definitenessContext;
      const adjFlertall = workingEntry.type === 'adjform' && workingEntry.number === 'flertall' && workingEntry.definiteness == null;
      if (numMatch && (defMatch || !definitenessContext || adjFlertall)) {
        score += 130;
      } else if (numMatch || defMatch) {
        score += 60;
      } else {
        const numConflict = numberContext && workingEntry.number && workingEntry.number !== numberContext;
        const defConflict = definitenessContext && workingEntry.definiteness && workingEntry.definiteness !== definitenessContext;
        if (numConflict || defConflict) score -= 80;
      }
    }

    // 8. DE case from prepositions (self-guards via workingEntry.caseName presence)
    if (caseContext && workingEntry.type === 'case' && workingEntry.caseName) {
      if (caseContext === 'wechsel') {
        if (workingEntry.caseName === 'akkusativ' || workingEntry.caseName === 'dativ') {
          score += 80;
        }
      } else if (workingEntry.caseName === caseContext) {
        score += 150;
      }
    }

    // 9. Bigram frequency: 40/80/120 based on weight 1/2/3
    const bigramData = VOCAB.getBigrams();
    if (bigramData) {
      let bigramWeight = 0;
      if (previousTwoWords) {
        const pairs2 = bigramData[previousTwoWords];
        if (pairs2) bigramWeight = pairs2[workingEntry.word] || 0;
      }
      if (!bigramWeight && previousWord) {
        const pairs1 = bigramData[previousWord];
        if (pairs1) bigramWeight = pairs1[workingEntry.word] || 0;
      }
      if (bigramWeight > 0) {
        score += bigramWeight * 40;
      }
    }

    // 10. Frequency signal (WP-01): Zipf sidecar for NB/NN; seam-normalized
    //     entry.zipf for DE/ES/FR/EN. Top-Zipf (~7) adds ~140 — comparable
    //     to bigram cap (+120) so neither signal dominates.
    score += freqSignal(workingEntry);

    // 11. Low-frequency demotion (WP-04): -80 for entries below Zipf 1.5
    //     (≈ occurs <30/million). Zipf-0 entries are left alone — see helper.
    score += lowFreqDemotion(workingEntry);

    scored.push({ ...workingEntry, score });
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
  //
  // Thin wrapper: (a) captures the full suggestions array for reveal-click
  // re-render, (b) resets expanded state (Pitfall 5 — reveal doesn't leak
  // across keystrokes), (c) delegates rendering to renderDropdownBody so
  // the reveal-click path can re-render in place without re-running
  // findSuggestions.
  function showDropdown(suggestions, el) {
    selectedIndex = 0;
    expanded = false;                 // Pitfall 5: reset on every new dropdown session
    lastSuggestions = suggestions;    // capture for reveal-click re-render path
    renderDropdownBody(el);
    positionDropdown(el);
    dropdown.classList.add('visible');
  }

  // renderDropdownBody: assembles dropdown.innerHTML + attaches handlers.
  // Called by showDropdown (initial render) AND by the Vis-flere reveal
  // handler / ArrowDown auto-reveal path (re-render in place). Reads the
  // module-scoped expanded flag to pick the visible cap.
  function renderDropdownBody(el) {
    const visibleCap = expanded ? VISIBLE_EXPANDED : VISIBLE_DEFAULT;
    const visible = lastSuggestions.slice(0, visibleCap);
    const hasMore = lastSuggestions.length > visible.length;
    const visLabel = expanded ? t('pred_vis_faerre') : t('pred_vis_flere');
    // ⌃ (U+2303) for collapse (expanded state), ⌄ (U+2304) for expand.
    const visChevron = expanded ? '\u2303' : '\u2304';

    const itemsHtml = visible.map((s, i) => {
      const posLabel = s.bank ? bankToPosShort(s.bank) : '';
      const typoHint = s.type === 'typo' ? `<span class="lh-pred-typo">${escapeHtml(t('pred_typo_hint'))}</span>` : '';
      const compoundHint = s.type === 'compound' ? `<span class="lh-pred-typo">${escapeHtml(t('pred_compound_hint'))}</span>` : '';
      const compoundAttr = s.compoundReplaceLen ? ` data-compound-len="${s.compoundReplaceLen}"` : '';
      return `
      <div class="lh-pred-item ${i === selectedIndex ? 'selected' : ''}" data-word="${escapeAttr(s.display)}"${compoundAttr}>
        <span class="lh-pred-word">${escapeHtml(s.display)}${typoHint}${compoundHint}</span>
        ${posLabel ? `<span class="lh-pred-pos">${escapeHtml(posLabel)}</span>` : ''}
        <span class="lh-pred-translation">${escapeHtml(s.translation)}</span>
      </div>`;
    }).join('');

    // Vis-flere link: shown when either more candidates are available
    // (hasMore) OR we're currently expanded (so users can collapse back).
    const visFlereHtml = hasMore || expanded
      ? `<div class="lh-pred-vis-flere" role="button" tabindex="-1">${escapeHtml(visLabel)} ${visChevron}</div>`
      : '';

    dropdown.innerHTML = itemsHtml + visFlereHtml + `<div class="lh-pred-footer"><img src="${chrome.runtime.getURL('assets/icon-16.png')}" class="lh-pred-icon" alt=""><button class="lh-pred-lang" title="${escapeAttr(t('pred_switch_lang'))}">${LANG_LABELS[currentLang] || currentLang.toUpperCase()}</button><span class="lh-pred-hint">${escapeHtml(t('pred_tab_hint'))}</span><button class="lh-pred-pause" title="${escapeAttr(lexiPaused ? t('pred_resume') : t('pred_pause'))}">${lexiPaused ? '\u25B6' : '\u23F8'}</button></div>`;

    attachDropdownHandlers(el);
  }

  // attachDropdownHandlers: wires up language switcher, pause button,
  // item-click handlers, AND the Vis-flere reveal link. Called from
  // renderDropdownBody after every (re-)render — event listeners on the
  // previous innerHTML are discarded when innerHTML is replaced, so
  // re-attaching is mandatory on each render pass.
  function attachDropdownHandlers(el) {
    // Attach language switcher handler
    const langBtn = dropdown.querySelector('.lh-pred-lang');
    if (langBtn) {
      langBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showLangPicker();
      });
    }

    // Attach pause button handler
    const pauseBtn = dropdown.querySelector('.lh-pred-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePause();
      });
    }

    // Attach click handlers — preventDefault keeps focus in the editor,
    // stopPropagation prevents CKEditor from seeing the click and blurring.
    dropdown.querySelectorAll('.lh-pred-item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        applySuggestion(item.dataset.word, parseInt(item.dataset.compoundLen) || 0);
      });
    });

    // Attach Vis-flere reveal handler (flip expanded + re-render in place).
    // Mirrors the .lh-pred-item mousedown guard: preventDefault keeps the
    // editor focused; stopPropagation prevents the click from bubbling to
    // the item-level handler and triggering applySuggestion.
    const visFlereEl = dropdown.querySelector('.lh-pred-vis-flere');
    if (visFlereEl) {
      visFlereEl.addEventListener('mousedown', (e) => {
        e.preventDefault();           // keep focus in the editor
        e.stopPropagation();          // don't bubble into item-click
        expanded = !expanded;
        renderDropdownBody(el);       // NOT showDropdown — that would reset expanded
      });
    }
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

  // ── Language picker (inline in dropdown footer) ──
  const LANG_PICKER_FLAGS = { de: '\uD83C\uDDE9\uD83C\uDDEA', es: '\uD83C\uDDEA\uD83C\uDDF8', fr: '\uD83C\uDDEB\uD83C\uDDF7', en: '\uD83C\uDDEC\uD83C\uDDE7', nb: '\uD83C\uDDF3\uD83C\uDDF4', nn: '\uD83C\uDDF3\uD83C\uDDF4' };
  const BUNDLED_PREDICTION_LANGS = ['nb', 'nn', 'en'];

  async function getAvailableLangs() {
    const langs = [...BUNDLED_PREDICTION_LANGS];
    if (window.__lexiVocabStore) {
      try {
        const cached = await window.__lexiVocabStore.listCachedLanguages();
        for (const c of cached) {
          if (!langs.includes(c.language)) langs.push(c.language);
        }
      } catch {}
    }
    return langs;
  }

  async function showLangPicker() {
    const langs = await getAvailableLangs();
    const footer = dropdown.querySelector('.lh-pred-footer');
    if (!footer) return;

    footer.innerHTML = langs.map(lang =>
      `<button class="lh-pred-lang-option ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">${LANG_PICKER_FLAGS[lang] || ''} ${LANG_LABELS[lang] || lang.toUpperCase()}</button>`
    ).join('');

    footer.querySelectorAll('.lh-pred-lang-option').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lang = btn.dataset.lang;
        if (lang === currentLang) return;
        switchPredictionLang(lang);
      });
    });
  }

  async function switchPredictionLang(lang) {
    // Persist + broadcast. The service worker re-broadcasts LANGUAGE_CHANGED
    // to all tabs (including this one), which triggers:
    //   1. vocab-seam.js → loadForLanguage(lang) rebuilds indexes + bigrams
    //      + freq, re-reading enabledGrammarFeatures from storage in the
    //      process (so no separate loadGrammarFeatures call is needed here).
    //   2. word-prediction.js onMessage (line ~107) → awaits loadRecentWords
    //      then queues refreshFromVocab via VOCAB.onReady, which rebuilds
    //      prefixIndex + knownPresens/knownPreteritum once the seam finishes.
    // Pre-refactor (pre-Plan 01-02) this function called loadGrammarFeatures
    // and loadWordList directly; both were deleted during the seam cutover
    // (see 01-02-SUMMARY.md line 80) leaving ReferenceErrors on the inline-
    // picker click path. Phase 3-04 verification surfaced the latent bug —
    // the popup-driven switch path was unaffected because it already
    // broadcasts LANGUAGE_CHANGED without going through this helper.
    currentLang = lang;
    await chromeStorageSet({ language: lang });
    chrome.runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: lang });
    hideDropdown();
    // Re-prediction on the active field is driven by the user's next keystroke;
    // schedulePrediction here would race the seam's async reload.
  }

  function chromeStorageSet(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, resolve));
  }

  function togglePause() {
    lexiPaused = !lexiPaused;
    chrome.storage.local.set({ lexiPaused });
    // Cancel any pending prediction timer
    if (predictionTimer) {
      clearTimeout(predictionTimer);
      predictionTimer = null;
    }
    // Broadcast to other tabs via the service worker
    chrome.runtime.sendMessage({ type: 'LEXI_PAUSED', paused: lexiPaused });
    updatePauseBadge();
    if (lexiPaused) {
      hideDropdown();
    } else {
      // Resuming — re-run prediction on current element if available
      if (activeElement) schedulePrediction(activeElement);
    }
  }

  function hideDropdown() {
    if (!dropdown) return;
    dropdown.classList.remove('visible');
    selectedIndex = -1;
  }

  // ── Pause badge (shows when predictions are paused, allows resume) ──
  let pauseBadge = null;

  function updatePauseBadge() {
    if (lexiPaused) {
      if (!pauseBadge) {
        pauseBadge = document.createElement('div');
        pauseBadge.id = 'lexi-pause-badge';
        pauseBadge.innerHTML = `<img src="${chrome.runtime.getURL('assets/icon-16.png')}" alt=""><span>${escapeHtml(t('pred_paused'))}</span><button title="${escapeAttr(t('pred_resume_short'))}">\u25B6</button>`;
        pauseBadge.querySelector('button').addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          togglePause();
        });
        document.documentElement.appendChild(pauseBadge);
      }
      pauseBadge.classList.add('visible');
    } else {
      if (pauseBadge) pauseBadge.classList.remove('visible');
    }
  }

  // ── Sentence-start capitalization ──
  function shouldCapitalize(textBefore) {
    const trimmed = textBefore.trim();
    if (trimmed.length === 0) return true; // Start of document
    return /[.!?]\s*$/.test(textBefore) || /\n\s*$/.test(textBefore);
  }

  function capitalizeFirst(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // ── Apply suggestion ──
  // compoundReplaceLen: if > 0, replace this many chars before cursor (prev word + space + current word)
  function applySuggestion(word, compoundReplaceLen = 0) {
    if (!activeElement) return;

    if (activeElement.isContentEditable) {
      applyToContentEditable(word, compoundReplaceLen);
    } else {
      applyToInput(word, compoundReplaceLen);
    }

    trackRecentWord(word);
    hideDropdown();
  }

  function applyToInput(word, compoundReplaceLen = 0) {
    const el = activeElement;
    const text = el.value || '';
    const cursorPos = el.selectionStart || 0;

    // Find the current word boundaries
    const before = text.slice(0, cursorPos);
    const after = text.slice(cursorPos);
    const match = before.match(/[\wáàâäãåæéèêëíìîïóòôöõøúùûüñçß]+$/i);

    if (match) {
      // Compound: replace previous word + space + current word
      const replaceStart = compoundReplaceLen > 0
        ? cursorPos - compoundReplaceLen
        : cursorPos - match[0].length;
      if (shouldCapitalize(text.slice(0, replaceStart))) {
        word = capitalizeFirst(word);
      }
      el.value = text.slice(0, replaceStart) + word + after;
      const newPos = replaceStart + word.length;
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

  function applyToContentEditable(word, compoundReplaceLen = 0) {
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
      // Compound: replace previous word + space + current word
      const wordStart = compoundReplaceLen > 0
        ? cursorPos - compoundReplaceLen
        : cursorPos - match[0].length;

      if (shouldCapitalize(text.slice(0, wordStart))) {
        word = capitalizeFirst(word);
      }

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
  // isTextInput is now sourced from VOCAB.isTextInput (ported to vocab-seam.js
  // at Plan 01). spell-check.js consumes vocab directly from __lexiVocab; no
  // prediction-side export remains.

  function escapeHtml(str) {
    const d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
