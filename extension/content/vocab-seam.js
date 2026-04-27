/**
 * Leksihjelp — Vocab Seam (browser IIFE)
 *
 * Plan 23-02 owns this layer's hydration policy:
 *
 *   Phase 1 (sync, no network):
 *     - Build baseline indexes from the bundled NB vocab (data/nb.json).
 *     - Set self.__lexiVocab so spell-check + word-prediction render
 *       immediately. NO awaits before this point — popup must work offline.
 *     - Emit {type: 'lexi:hydration', lang: 'nb', state: 'baseline'}.
 *
 *   Phase 2 (async, target language):
 *     a) vocabStore.getCachedBundle(lang) → if present, build full indexes
 *        off-thread (requestIdleCallback / setTimeout fallback) and swap.
 *     b) On cache miss, vocabStore.fetchBundle(lang) → on 200, putCachedBundle
 *        + build + swap. On 304 (somehow with no cache), treat as error. On
 *        schema-mismatch: keep baseline, emit state:'error'. On error: same.
 *
 *   Atomic swap: self.__lexiVocab is a stable wrapper object. Internal state
 *   is held in a module-level mutable `state`; the wrapper's getters read
 *   `state.<index>` at call time. This means a consumer that captures
 *   `self.__lexiVocab` once (spell-check, word-prediction) sees the swap
 *   without re-grabbing — and sees a consistent indexes object on every read,
 *   never a half-built mix.
 *
 *   Idempotence: each swap records `lastRevision[lang]`. A second swap with
 *   the same revision is a no-op (used by plan 04 update detection — if the
 *   revision didn't change, don't rebuild).
 *
 * Network-silence: vocab-seam.js is NOT in the SC-06 scan target list. The
 * fetchBundle call lives in vocab-store.js (also outside the scan list) and
 * is the single carve-out plan 06 will document.
 */

(function () {
  'use strict';

  // ── Dependencies ──
  const core = self.__lexiVocabCore;
  if (!core) {
    console.error('[lexi-vocab] __lexiVocabCore not loaded — check manifest content_scripts order');
    return;
  }

  // ── Module state ──
  // `state` holds the currently-published indexes. Wrappers below capture
  // `state` by closure but read live through it, so a swap is observed by
  // every existing __lexiVocab reference.
  let state = null;
  let currentLang = 'en';
  let ready = false;
  let paused = false;
  let enabledFeatures = new Set();
  const readyCallbacks = [];

  // Per-language last-applied revision; gates idempotent swaps.
  const lastRevision = new Map();

  // Languages with bundled JSON in extension/data/. NB is the baseline; others
  // are kept bundled today and trimmed by plan 23-03.
  const BUNDLED_LANGS = ['nb', 'nn', 'en'];
  const BASELINE_LANG = 'nb';

  // ── Hydration progress emitter ──
  const hydrationListeners = new Set();
  function emitHydration(lang, hydrationState) {
    const msg = { type: 'lexi:hydration', lang, state: hydrationState };
    for (const l of hydrationListeners) {
      try { l(msg); } catch (_) { /* swallow */ }
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(msg);
      }
    } catch (_) { /* no receiver — fine */ }
  }

  function onHydrationProgress(handler) {
    if (typeof handler === 'function') hydrationListeners.add(handler);
    return () => hydrationListeners.delete(handler);
  }

  // ── Storage helpers ──
  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }

  // ── Grammar-feature predicate ──
  function buildFeaturePredicate(lang) {
    if (enabledFeatures.size === 0) return () => true;
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

  // ── Off-thread scheduler ──
  // Build full indexes during browser-idle so we don't compete with input
  // events during typing. Falls back to setTimeout(0) when rIC is missing.
  function scheduleIdle(fn) {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => { try { fn(); } catch (e) { console.warn('[lexi-vocab] swap build failed', e); } });
    } else {
      setTimeout(() => { try { fn(); } catch (e) { console.warn('[lexi-vocab] swap build failed', e); } }, 0);
    }
  }

  // ── Bundled-data loaders (chrome.runtime.getURL — SC-06 whitelisted) ──
  async function loadBundledRaw(lang) {
    if (!BUNDLED_LANGS.includes(lang)) return null;
    try {
      const url = chrome.runtime.getURL(`data/${lang}.json`);
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('[lexi-vocab] bundled load failed for ' + lang, e);
      return null;
    }
  }

  async function loadBundledSidecar(filename) {
    try {
      const url = chrome.runtime.getURL(`data/${filename}`);
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function loadBigrams(lang) { return loadBundledSidecar(`bigrams-${lang}.json`); }
  async function loadFrequency(lang) { return loadBundledSidecar(`freq-${lang}.json`); }
  async function loadPitfalls(lang) { return loadBundledSidecar(`pitfalls-${lang}.json`); }
  async function loadSister(lang) {
    const sister = lang === 'nb' ? 'nn' : lang === 'nn' ? 'nb' : null;
    if (!sister) return null;
    return loadBundledRaw(sister);
  }

  // ── Index building + swap ──
  async function buildAndApply(lang, raw, source) {
    if (!raw) return false;
    // Refresh enabled features (popup may have toggled mid-flight).
    const stored = await storageGet(['enabledGrammarFeatures']);
    if (stored.enabledGrammarFeatures && stored.enabledGrammarFeatures[lang]) {
      enabledFeatures = new Set(stored.enabledGrammarFeatures[lang]);
    } else {
      enabledFeatures = new Set();
    }
    const [bigrams, freq, sisterRaw, pitfalls] = await Promise.all([
      loadBigrams(lang), loadFrequency(lang), loadSister(lang), loadPitfalls(lang),
    ]);
    const isFeatureEnabled = buildFeaturePredicate(lang);
    const fresh = core.buildIndexes({ raw, bigrams, freq, sisterRaw, lang, isFeatureEnabled });
    fresh.pitfalls = pitfalls || {};
    fresh._sourceTag = source; // diagnostic
    state = fresh;
    return true;
  }

  /**
   * Public swap: idempotent on (lang, revision). Used by plan 04 update
   * detection and exposed as a test seam on __lexiVocab.
   */
  function swapIndexes(lang, revision, freshIndexes) {
    if (!freshIndexes) return;
    if (revision && lastRevision.get(lang) === revision) return;
    state = freshIndexes;
    if (revision) lastRevision.set(lang, revision);
  }

  // ── Sync baseline init ──
  // Async only because chrome.runtime.getURL + fetch is the standard MV3 way
  // to read bundled JSON, but no network hits the wire (chrome-extension://
  // scheme). Consumers can still call __lexiVocab synchronously after this
  // initial promise resolves; the readyCallbacks queue handles the gap.
  // Plan 23-03: trimmed baseline (data/nb-baseline.json) replaces full nb.json
  // as the bundled fallback. The trimmed file embeds its own freq + (empty)
  // bigrams maps; use those when present so we don't hit nb.json/freq-nb.json
  // (which plan 23-05 will remove from the bundle). Falls back to the legacy
  // full file path if nb-baseline.json is missing — keeps the seam working in
  // older installs / lockdown contexts where the baseline hasn't been built.
  async function initBaseline() {
    let raw = await loadBundledSidecar('nb-baseline.json');
    let usingTrimmedBaseline = !!raw;
    if (!raw) {
      raw = await loadBundledRaw(BASELINE_LANG);
    }
    if (!raw) {
      console.error('[lexi-vocab] baseline NB load failed — extension unusable');
      return;
    }
    let bigrams, freq, sisterRaw, pitfalls;
    if (usingTrimmedBaseline) {
      // Trimmed baseline carries its own freq + bigrams in-payload. Pitfalls
      // and the sister-language word list aren't in the baseline; load them
      // out-of-band when those sidecars happen to still be bundled, otherwise
      // an empty fallback is fine for spell-check on the baseline path.
      bigrams = (raw && raw.bigrams) || {};
      freq = (raw && raw.freq) || {};
      [sisterRaw, pitfalls] = await Promise.all([
        loadSister(BASELINE_LANG), loadPitfalls(BASELINE_LANG),
      ]);
    } else {
      [bigrams, freq, sisterRaw, pitfalls] = await Promise.all([
        loadBigrams(BASELINE_LANG), loadFrequency(BASELINE_LANG), loadSister(BASELINE_LANG), loadPitfalls(BASELINE_LANG),
      ]);
    }
    const baseline = core.buildIndexes({
      raw, bigrams, freq, sisterRaw, lang: BASELINE_LANG, isFeatureEnabled: () => true,
    });
    baseline.pitfalls = pitfalls || {};
    baseline._sourceTag = usingTrimmedBaseline ? 'baseline-nb-trimmed' : 'baseline-nb';
    state = baseline;
    ready = true;
    emitHydration(BASELINE_LANG, 'baseline');
    drainReady();
  }

  function drainReady() {
    const toRun = readyCallbacks.splice(0);
    for (const cb of toRun) {
      try { cb(); } catch (_) { /* swallow */ }
    }
  }

  // ── Target-language hydration ──
  async function hydrateTarget(lang) {
    if (lang === BASELINE_LANG) return; // baseline already serving NB
    const store = (typeof window !== 'undefined' && window.__lexiVocabStore) || self.__lexiVocabStore;
    if (!store) {
      // No cache layer (rare — vocab-store.js not yet loaded). Fall back to
      // bundled raw if available.
      const raw = await loadBundledRaw(lang);
      if (raw) {
        await buildAndApply(lang, raw, 'bundled');
        currentLang = lang;
        emitHydration(lang, 'ready');
      } else {
        emitHydration(lang, 'error');
      }
      return;
    }

    // 1. IndexedDB hit?
    let cached = null;
    try { cached = await store.getCachedBundle(lang); } catch (_) { cached = null; }
    if (cached && cached.payload) {
      // Build off-thread to avoid jank during typing.
      scheduleIdle(async () => {
        const built = await buildAndApply(lang, cached.payload, 'cache');
        if (built) {
          lastRevision.set(lang, cached.revision);
          currentLang = lang;
          emitHydration(lang, 'ready');
        } else {
          emitHydration(lang, 'error');
        }
      });
      return;
    }

    // 2. Cache miss → fetch from API.
    emitHydration(lang, 'fetching');
    let result;
    try {
      result = await store.fetchBundle(lang, {});
    } catch (e) {
      result = { status: 'error', error: e };
    }
    if (result.status === 200) {
      const body = result.body;
      // Persist before swap so a reload sees the same data without re-fetching.
      try {
        await store.putCachedBundle(lang, {
          schema_version: body.schema_version,
          revision: body.revision,
          payload: body,
        });
      } catch (e) {
        console.warn('[lexi-vocab] putCachedBundle failed (continuing with in-memory build)', e);
      }
      scheduleIdle(async () => {
        const built = await buildAndApply(lang, body, 'fetched');
        if (built) {
          lastRevision.set(lang, body.revision);
          currentLang = lang;
          emitHydration(lang, 'ready');
        } else {
          emitHydration(lang, 'error');
        }
      });
      return;
    }
    if (result.status === 304) {
      // Server says unchanged but we have nothing cached — treat as error.
      emitHydration(lang, 'error');
      return;
    }
    if (result.status === 'schema-mismatch') {
      // Stay on baseline; popup surfaces the diagnostic.
      emitHydration(lang, 'error');
      return;
    }
    // 'error' or anything else
    emitHydration(lang, 'error');
  }

  // ── Init ──
  async function init() {
    const stored = await storageGet(['language', 'lexiPaused']);
    currentLang = stored.language || 'en';
    paused = !!stored.lexiPaused;

    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(onMessage);
    }

    await initBaseline();
    // Spawn target hydration without awaiting — popup + lookups are already
    // serving baseline NB.
    hydrateTarget(currentLang);
  }

  function onMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'LANGUAGE_CHANGED') {
      currentLang = msg.language;
      hydrateTarget(currentLang);
    } else if (msg.type === 'GRAMMAR_FEATURES_CHANGED') {
      hydrateTarget(currentLang);
    } else if (msg.type === 'LEXI_PAUSED') {
      paused = !!msg.paused;
    }
  }

  // ── isTextInput — copied verbatim from word-prediction.js ──
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

  // ── Public surface ──
  // Wrapper object reads `state` live so the swap is atomic to consumers
  // that captured __lexiVocab once. Every getter null-guards on state.
  self.__lexiVocab = {
    getWordList: () => (state && state.wordList) ? state.wordList : [],
    getLanguage: () => currentLang,
    isReady: () => ready,
    isPaused: () => paused,
    isTextInput,
    onReady(cb) {
      if (typeof cb !== 'function') return;
      if (ready) { try { cb(); } catch (_) {} return; }
      readyCallbacks.push(cb);
    },

    // Plan 23-02 surfaces (consumed by plans 03/04/05 popup + tests):
    onHydrationProgress,
    swapIndexes,

    // Data getters
    getFrequency: (word) => {
      if (!state || !state.freq || typeof word !== 'string') return null;
      const v = state.freq.get(word.toLowerCase());
      return typeof v === 'number' ? v : null;
    },
    getBigrams: () => (state && state.bigrams) ? state.bigrams : null,
    getTypoBank: () => (state && state.typoBank) ? state.typoBank : null,
    getNounGenus: () => (state && state.nounGenus) ? state.nounGenus : new Map(),
    getNounForms: () => (state && state.nounForms) ? state.nounForms : new Map(),
    getIsAdjective: () => (state && state.isAdjective) ? state.isAdjective : new Set(),
    getKnownPresens: () => (state && state.knownPresens) ? state.knownPresens : new Set(),
    getKnownPreteritum: () => (state && state.knownPreteritum) ? state.knownPreteritum : new Set(),
    getVerbForms: () => (state && state.verbForms) ? state.verbForms : new Map(),
    getVerbInfinitive: () => (state && state.verbInfinitive) ? state.verbInfinitive : new Map(),
    getValidWords: () => (state && state.validWords) ? state.validWords : new Set(),
    getTypoFix: () => (state && state.typoFix) ? state.typoFix : new Map(),
    getCompoundNouns: () => (state && state.compoundNouns) ? state.compoundNouns : new Set(),
    getPitfalls: () => (state && state.pitfalls) ? state.pitfalls : {},
    phoneticNormalize: (str) => core.phoneticNormalize(str, currentLang),
    phoneticMatchScore: (queryPhonetic, targetPhonetic) => core.phoneticMatchScore(queryPhonetic, targetPhonetic),
    getFreq: () => (state && state.freq instanceof Map) ? state.freq : new Map(),
    getSisterValidWords: () => (state && state.sisterValidWords instanceof Set) ? state.sisterValidWords : new Set(),
    getRegisterWords: () => (state && state.registerWords) ? state.registerWords : new Map(),
    getCollocations: () => (state && state.collocations) ? state.collocations : [],
    getRedundancyPhrases: () => (state && state.redundancyPhrases) ? state.redundancyPhrases : [],
    getParticipleToAux: () => (state && state.participleToAux) ? state.participleToAux : new Map(),
    getNNInfinitiveClasses: () => (state && state.nnInfinitiveClasses) ? state.nnInfinitiveClasses : new Map(),
    getEsPresensToVerb: () => (state && state.esPresensToVerb) ? state.esPresensToVerb : new Map(),
    getEsSubjuntivoForms: () => (state && state.esSubjuntivoForms) ? state.esSubjuntivoForms : new Map(),
    getEsImperfectoForms: () => (state && state.esImperfectoForms) ? state.esImperfectoForms : new Map(),
    getEsPreteritumToVerb: () => (state && state.esPreteritumToVerb) ? state.esPreteritumToVerb : new Map(),
    getFrPresensToVerb: () => (state && state.frPresensToVerb) ? state.frPresensToVerb : new Map(),
    getFrSubjonctifForms: () => (state && state.frSubjonctifForms) ? state.frSubjonctifForms : new Map(),
    getFrSubjonctifDiffers: () => (state && state.frSubjonctifDiffers) ? state.frSubjonctifDiffers : new Map(),
    getIrregularForms: () => (state && state.irregularForms) ? state.irregularForms : new Map(),
    getDecomposeCompound: () => (state && state.decomposeCompound) ? state.decomposeCompound : null,
    getDecomposeCompoundStrict: () => (state && state.decomposeCompoundStrict) ? state.decomposeCompoundStrict : null,
    getGrammarTables: () => (state && state.grammarTables) ? state.grammarTables : {},
    getSPassivForms: () => (state && state.sPassivForms) ? state.sPassivForms : new Map(),
    isFeatureEnabled: (featureId) => {
      if (enabledFeatures.size === 0) return true;
      return enabledFeatures.has(featureId);
    },
  };

  init();
})();
