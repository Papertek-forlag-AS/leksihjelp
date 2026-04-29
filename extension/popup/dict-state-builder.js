/**
 * dict-state-builder.js — shared dictionary helpers (Phase 30-04 Task 4)
 *
 * Helpers consumed by both the extension popup (popup.js) and downstream
 * embedders (lockdown sidepanel host) when building the dictionary view's
 * state from raw bank-structured language data.
 *
 * Exports (via host.__lexiDictStateBuilder + module.exports):
 *  - BANK_TO_POS                    bank-name → part-of-speech mapping (raw codes)
 *  - flattenBanks(dict, opts?)      flatten banks into [{ ...entry, _wordId, _bank, partOfSpeech, genus, gender? }]
 *  - getTranslation(entry, state, uiLang)   resolve translation via linkedTo / direct / nbTranslationIndex
 *  - generatedFromRefs(entry)       parse _generatedFrom into array
 *  - NORWEGIAN_IRREGULAR_VERBS      irregular form → infinitive
 *  - norwegianInfinitive(form)      best-effort form-to-infinitive heuristic
 *
 * Why this exists:
 *  popup.js used to own these helpers; the lockdown sidepanel host inlined
 *  copies in 2.8.2 to make search work. This module is the single source of
 *  truth — both consumers import from here. Adding a new bank or a new
 *  irregular verb happens in one place.
 *
 * Loaded via:
 *  - Extension popup: popup.html includes <script src="dict-state-builder.js"> before popup.js
 *  - Lockdown: leksihjelp-loader.js LEKSI_BUNDLE injects 'leksihjelp/popup/dict-state-builder.js'
 *    BEFORE the view modules
 */
(function () {
  'use strict';

  const BANK_TO_POS = {
    verbbank: 'verb',
    nounbank: 'substantiv',
    adjectivebank: 'adjektiv',
    articlesbank: 'artikkel',
    generalbank: 'ord',
    numbersbank: 'tall',
    phrasesbank: 'frase',
    pronounsbank: 'pronomen',
    languagesbank: 'språk',
    nationalitiesbank: 'nasjonalitet',
  };

  /**
   * @param {Object} dict           raw bank-structured language dict
   * @param {Object} [opts]
   * @param {Function} [opts.genusMapper]    optional (genus) => translatedGender. If
   *                                         provided, entries get a `gender` field.
   * @param {Function} [opts.posMapper]      optional (bank) => translatedPos. If
   *                                         provided, entries' partOfSpeech is the
   *                                         translation; otherwise the raw code from
   *                                         BANK_TO_POS.
   * @returns {Array} flattened word entries
   */
  function flattenBanks(dict, opts) {
    const out = [];
    if (!dict || typeof dict !== 'object') return out;
    const genusMapper = opts && opts.genusMapper;
    const posMapper = opts && opts.posMapper;

    for (const bank of Object.keys(BANK_TO_POS)) {
      const bankData = dict[bank];
      if (!bankData || typeof bankData !== 'object') continue;
      for (const wordId in bankData) {
        if (!Object.prototype.hasOwnProperty.call(bankData, wordId)) continue;
        if (wordId.startsWith('_')) continue;
        const entry = bankData[wordId];
        if (!entry || typeof entry !== 'object') continue;
        out.push({
          ...entry,
          _wordId: wordId,
          _bank: bank,
          partOfSpeech: posMapper ? posMapper(bank) : BANK_TO_POS[bank],
          genus: entry.genus || null,
          gender: entry.genus && genusMapper ? genusMapper(entry.genus) : null,
          grammar: entry.explanation && entry.explanation._description || null,
        });
      }
    }
    return out;
  }

  function generatedFromRefs(entry) {
    const g = entry && entry._generatedFrom;
    if (!g) return [];
    if (Array.isArray(g)) return g;
    return String(g).split(',').map(s => s.trim()).filter(Boolean);
  }

  /**
   * @param {Object} entry
   * @param {Object} state    expects { noDictionary, nbTranslationIndex } (Map or null)
   * @param {string} uiLang   'nb' | 'nn' | other
   */
  function getTranslation(entry, state, uiLang) {
    if (!entry) return '';
    const ui = uiLang || 'nb';
    if (ui === 'nn' && entry.linkedTo && entry.linkedTo.nn && entry.linkedTo.nn.translation) {
      return entry.linkedTo.nn.translation;
    }
    if (ui === 'nb' && entry.linkedTo && entry.linkedTo.nb && entry.linkedTo.nb.translation) {
      return entry.linkedTo.nb.translation;
    }
    if (entry.translation) return entry.translation;
    const link = (entry.linkedTo && (entry.linkedTo[ui] || entry.linkedTo.nb || entry.linkedTo.nn)) || null;
    if (link && link.primary && state && state.noDictionary) {
      for (const bank of Object.keys(BANK_TO_POS)) {
        const resolved = state.noDictionary[bank] && state.noDictionary[bank][link.primary];
        if (resolved && resolved.word) return resolved.word;
      }
    }
    if (entry._wordId && state && state.nbTranslationIndex && state.nbTranslationIndex.size > 0) {
      const nbWord = state.nbTranslationIndex.get(entry._wordId);
      if (nbWord) return nbWord;
    }
    return '';
  }

  // Norwegian irregular verb forms → infinitive (without "å" prefix).
  const NORWEGIAN_IRREGULAR_VERBS = {
    'er': 'være', 'var': 'være', 'har': 'ha', 'hadde': 'ha',
    'kan': 'kunne', 'kunne': 'kunne', 'vil': 'ville', 'ville': 'ville',
    'skal': 'skulle', 'skulle': 'skulle', 'må': 'måtte',
    'vet': 'vite', 'visste': 'vite', 'går': 'gå', 'gikk': 'gå',
    'får': 'få', 'fikk': 'få', 'gjør': 'gjøre', 'gjorde': 'gjøre',
    'ser': 'se', 'så': 'se', 'sier': 'si', 'sa': 'si',
    'tar': 'ta', 'tok': 'ta', 'kommer': 'komme', 'kom': 'komme',
    'finner': 'finne', 'fant': 'finne', 'gir': 'gi', 'gav': 'gi',
    'ligger': 'ligge', 'lå': 'ligge', 'sitter': 'sitte', 'satt': 'sitte',
    'står': 'stå', 'stod': 'stå', 'drar': 'dra', 'dro': 'dra',
    'legger': 'legge', 'la': 'legge', 'setter': 'sette', 'satte': 'sette',
    'skriver': 'skrive', 'skrev': 'skrive', 'spiser': 'spise', 'spiste': 'spise',
    'liker': 'like', 'likte': 'like', 'bor': 'bo', 'bodde': 'bo',
    'heter': 'hete', 'het': 'hete', 'snakker': 'snakke', 'snakket': 'snakke',
    'leser': 'lese', 'leste': 'lese', 'lærer': 'lære', 'lærte': 'lære',
    'synger': 'synge', 'sang': 'synge', 'danser': 'danse', 'danset': 'danse',
    'svømmer': 'svømme', 'lager': 'lage', 'lagde': 'lage',
    'leker': 'leke', 'lekte': 'leke',
  };

  function norwegianInfinitive(form) {
    if (!form) return null;
    const lower = String(form).toLowerCase();
    if (NORWEGIAN_IRREGULAR_VERBS[lower]) return NORWEGIAN_IRREGULAR_VERBS[lower];
    // Regular heuristic: present "-er" → infinitive "-e"
    if (lower.endsWith('er') && lower.length > 3) return lower.slice(0, -1);
    return null;
  }

  const exports = {
    BANK_TO_POS,
    NORWEGIAN_IRREGULAR_VERBS,
    flattenBanks,
    getTranslation,
    generatedFromRefs,
    norwegianInfinitive,
  };

  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiDictStateBuilder = exports;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
})();
