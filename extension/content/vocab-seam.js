/**
 * Leksihjelp — Vocab Seam (browser IIFE)
 *
 * Owns vocabulary loading end-to-end for content scripts:
 *   1. Reads language + pause state + grammar toggles from chrome.storage
 *   2. Loads raw vocab via __lexiVocabStore (IndexedDB) with fetch fallback
 *      for bundled languages (nb/nn/en)
 *   3. Loads bigrams via fetch (silently null if missing — many languages
 *      have no bigram file yet)
 *   4. Delegates all derived-index building to __lexiVocabCore.buildIndexes
 *   5. Exposes the full self.__lexiVocab surface consumed by spell-check.js
 *      and word-prediction.js (wired up in Plan 02)
 *   6. Rebuilds on LANGUAGE_CHANGED and GRAMMAR_FEATURES_CHANGED; tracks
 *      pause state from LEXI_PAUSED
 *
 * Manifest ordering (applied in Plan 02) guarantees vocab-store.js and
 * vocab-seam-core.js load before this file.
 */

(function () {
  'use strict';

  // ── Dependencies ──
  const core = self.__lexiVocabCore;
  if (!core) {
    console.error('[lexi-vocab] __lexiVocabCore not loaded — check manifest content_scripts order');
    return;
  }

  // ── Internal state ──
  let currentLang = 'en';
  let state = null;            // output of core.buildIndexes(...)
  let ready = false;
  let paused = false;
  let enabledFeatures = new Set();
  const readyCallbacks = [];   // drained when ready flips true

  // Bundled languages shipped inside the extension package.
  // For non-bundled languages (de/es/fr), we require the IndexedDB cache
  // to be populated via __lexiVocabStore.downloadLanguage before usage.
  const BUNDLED_LANGS = ['nb', 'nn', 'en'];

  // ── Storage helpers ──
  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }

  // ── Grammar-feature predicate ──
  // Builds an isFeatureEnabled(featureId) predicate mirroring word-prediction.js:108–126.
  // Default when the stored value is missing: treat as "all enabled" so the seam
  // emits the superset of forms. Consumers (spell-check, word-prediction) apply
  // their own view-level filtering per CONTEXT.
  function buildFeaturePredicate(lang) {
    if (enabledFeatures.size === 0) {
      return () => true;
    }
    const langPrefix = `grammar_${lang}_`;
    const genericToLangMap = {
      'grammar_articles': [`${langPrefix}genus`],
      'grammar_plural': [`${langPrefix}flertall`, `${langPrefix}fleirtal`],
      'grammar_present': [`${langPrefix}presens`],
      'grammar_preteritum': [`${langPrefix}preteritum`],
      'grammar_perfektum': [`${langPrefix}perfektum`],
      'grammar_imperativ': [`${langPrefix}imperativ`],
      'grammar_comparative': [`${langPrefix}komparativ`],
      'grammar_superlative': [`${langPrefix}superlativ`],
    };
    return function isFeatureEnabled(featureId) {
      if (enabledFeatures.has(featureId)) return true;
      const langIds = genericToLangMap[featureId];
      if (langIds) return langIds.some(id => enabledFeatures.has(id));
      return false;
    };
  }

  // ── Vocab loading ──
  async function loadRawVocab(lang) {
    // Try IndexedDB cache first (served by vocab-store.js)
    try {
      if (typeof window !== 'undefined' && window.__lexiVocabStore) {
        const cached = await window.__lexiVocabStore.getCachedLanguage(lang);
        if (cached) return cached;
      }
    } catch (e) {
      // Fall through to bundled fetch
    }

    // Fall back to bundled file — only NB/NN/EN ship inside the extension.
    // Non-bundled languages (de/es/fr) must be downloaded first.
    if (!BUNDLED_LANGS.includes(lang)) return null;
    try {
      const url = chrome.runtime.getURL(`data/${lang}.json`);
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[lexi-vocab] Failed to load bundled vocab for ' + lang, e);
      return null;
    }
  }

  async function loadRawBigrams(lang) {
    try {
      const url = chrome.runtime.getURL(`data/bigrams-${lang}.json`);
      const res = await fetch(url);
      if (!res.ok) return null; // Not an error — many languages have no bigrams yet
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function loadRawFrequency(lang) {
    try {
      const url = chrome.runtime.getURL(`data/freq-${lang}.json`);
      const res = await fetch(url);
      if (!res.ok) return null; // No sidecar for this language — OK
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function loadForLanguage(lang) {
    ready = false;

    // Refresh enabled features from storage (they may have been updated by
    // the popup between message events)
    const stored = await storageGet(['enabledGrammarFeatures']);
    if (stored.enabledGrammarFeatures && stored.enabledGrammarFeatures[lang]) {
      enabledFeatures = new Set(stored.enabledGrammarFeatures[lang]);
    } else {
      enabledFeatures = new Set();
    }

    const raw = await loadRawVocab(lang);
    if (!raw) {
      // Non-bundled language with no cache — leave state null and ready=false.
      // Consumers will see isReady()=false and onReady callbacks stay queued
      // until LANGUAGE_CHANGED flips to a language we can load.
      state = null;
      return;
    }

    const [bigrams, freq] = await Promise.all([
      loadRawBigrams(lang),
      loadRawFrequency(lang),
    ]);
    const isFeatureEnabled = buildFeaturePredicate(lang);

    state = core.buildIndexes({ raw, bigrams, freq, lang, isFeatureEnabled });
    ready = true;

    // Drain ready callbacks. splice(0) so late subscribers arriving during
    // drain go into the fresh (empty) queue, not the one we're iterating.
    const toRun = readyCallbacks.splice(0);
    for (const cb of toRun) {
      try { cb(); } catch (_) { /* swallow: one broken listener must not break the rest */ }
    }
  }

  // ── Init ──
  async function init() {
    const stored = await storageGet(['language', 'lexiPaused']);
    currentLang = stored.language || 'en';
    paused = !!stored.lexiPaused;

    chrome.runtime.onMessage.addListener(onMessage);

    await loadForLanguage(currentLang);
  }

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'LANGUAGE_CHANGED') {
      currentLang = msg.language;
      // Fire-and-forget: callers use onReady() to await the rebuild.
      loadForLanguage(currentLang);
    } else if (msg.type === 'GRAMMAR_FEATURES_CHANGED') {
      // Toggles affect which forms buildIndexes emits → full rebuild.
      loadForLanguage(currentLang);
    } else if (msg.type === 'LEXI_PAUSED') {
      paused = !!msg.paused;
    }
    // Intentionally ignored: PREDICTION_TOGGLED, SPELL_CHECK_TOGGLED —
    // these are consumer-local policy flags, not vocab-level concerns
    // (RESEARCH.md open-question #3).
  }

  // ── isTextInput — copied verbatim from word-prediction.js:1805–1815 ──
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

  // ── Public surface: self.__lexiVocab ──
  self.__lexiVocab = {
    // Legacy surface (ported from the old prediction seam at word-prediction.js:1829)
    getWordList: () => (state && state.wordList) ? state.wordList : [],
    getLanguage: () => currentLang,
    isReady: () => ready,
    isPaused: () => paused,
    isTextInput,
    onReady(cb) {
      if (typeof cb !== 'function') return;
      if (ready) {
        try { cb(); } catch (_) { /* swallow */ }
        return;
      }
      readyCallbacks.push(cb);
    },

    // New data getters (INFRA-01: frequency tables + bigrams are part of the
    // shared surface — Phase 2 DATA-01 populates freq, this file just exposes it)
    getFrequency: (word) => {
      if (!state || !state.freq || typeof word !== 'string') return null;
      const v = state.freq.get(word.toLowerCase());
      return typeof v === 'number' ? v : null;
    },
    // Bigrams: null when no bigrams file was available for this language.
    // Consumers already handle null today (see word-prediction.js bigramData usage).
    getBigrams: () => (state && state.bigrams) ? state.bigrams : null,
    getTypoBank: () => (state && state.typoBank) ? state.typoBank : null,

    // Pre-built lookup indexes (previously rebuilt inside spell-check.js:136–172).
    // Return empty Map/Set (never null) so consumers can skip null-guards.
    getNounGenus: () => (state && state.nounGenus) ? state.nounGenus : new Map(),
    getVerbInfinitive: () => (state && state.verbInfinitive) ? state.verbInfinitive : new Map(),
    getValidWords: () => (state && state.validWords) ? state.validWords : new Set(),
    getTypoFix: () => (state && state.typoFix) ? state.typoFix : new Map(),
    getCompoundNouns: () => (state && state.compoundNouns) ? state.compoundNouns : new Set(),
  };

  // Kick off loading. Content scripts run at document_idle which is late
  // enough — no need to wait on DOMContentLoaded.
  init();
})();
