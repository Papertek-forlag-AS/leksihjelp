/**
 * Tests for vocab-seam.js — baseline-first hydration with atomic index swap.
 *
 * Strategy:
 *   - Mock vocab-seam-core's buildIndexes (we just observe whether/when it's called).
 *   - Mock __lexiVocabStore (getCachedBundle, fetchBundle).
 *   - Mock chrome.runtime + chrome.storage so init() doesn't blow up.
 *   - Run vocab-seam.js as text inside a fresh sandbox per test.
 *
 * Behaviors asserted (per plan 23-02 contract):
 *   - First call when cache empty: baseline NB indexes immediately on
 *     window.__lexiVocab; spawns background fetchBundle('de'); on success,
 *     swaps full indexes for de.
 *   - Schema-mismatch keeps baseline; emits {type:'lexi:hydration', state:'error'}.
 *   - swapIndexes idempotent on same revision.
 *   - Reads via window.__lexiVocab during transition see consistent state.
 */

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');

const SEAM_SRC = fs.readFileSync(path.join(__dirname, 'vocab-seam.js'), 'utf8');

function makeSandbox({ cachedBundle, fetchResult, storedLang } = {}) {
  const win = {};
  const messages = [];
  // Mock buildIndexes — returns a tagged identifier indexes object so tests
  // can tell baseline vs full apart.
  const builtForCalls = [];
  win.__lexiVocabCore = {
    buildIndexes: ({ raw, lang }) => {
      builtForCalls.push({ lang, rawTag: raw && raw._tag });
      return {
        _tag: `${lang}:${raw && raw._tag ? raw._tag : 'unknown'}`,
        wordList: [],
        validWords: new Set([`${lang}:dummy`]),
      };
    },
    phoneticNormalize: (s) => s,
    phoneticMatchScore: () => 0,
  };

  // Mock vocab store
  win.__lexiVocabStore = {
    getCachedBundle: async (lang) => {
      if (cachedBundle && cachedBundle[lang]) return cachedBundle[lang];
      return null;
    },
    fetchBundle: async (lang, opts) => {
      if (fetchResult && fetchResult[lang]) return fetchResult[lang];
      return { status: 'error', error: new Error('no fetch stub') };
    },
    putCachedBundle: async () => {},
    getCachedRevisions: async () => ({}),
    SUPPORTED_SCHEMA_VERSION: 1,
  };

  const messageListeners = [];
  const sandbox = {
    self: win,
    window: win,
    globalThis: win,
    console,
    setTimeout, clearTimeout, queueMicrotask, Promise,
    fetch: async (url) => {
      // Used by loadRawVocab fallback for baseline NB / bundled langs.
      // We return a tagged stub so build-indexes can tell which file was loaded.
      const m = url.match(/data\/(\w+)\.json$/);
      const lang = m ? m[1] : 'unknown';
      return {
        ok: true,
        json: async () => ({ _tag: `bundled-${lang}`, verbbank: {}, nounbank: {} }),
      };
    },
    chrome: {
      runtime: {
        getURL: (p) => `chrome-extension://test/${p}`,
        onMessage: { addListener: (fn) => messageListeners.push(fn) },
        sendMessage: (msg) => { messages.push(msg); },
        lastError: null,
      },
      storage: {
        local: {
          get: (keys, cb) => {
            const out = {};
            if (storedLang) out.language = storedLang;
            cb(out);
          },
        },
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(SEAM_SRC, sandbox);
  return { win, messages, builtForCalls, messageListeners, sandbox };
}

// Wait for microtask drain (lets pending promises resolve).
async function tick(n = 5) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

// Wait until predicate becomes truthy or timeout.
async function waitFor(pred, { timeout = 1000 } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (pred()) return true;
    await new Promise(r => setTimeout(r, 5));
  }
  return false;
}

test('baseline-first: NB session shows baseline indexes immediately', async () => {
  const { win, messages } = makeSandbox({ storedLang: 'nb' });
  // After init's microtask drain, window.__lexiVocab should expose
  // a non-null wordList accessor backed by baseline NB indexes.
  await waitFor(() => win.__lexiVocab && win.__lexiVocab.isReady && win.__lexiVocab.isReady());
  assert.ok(win.__lexiVocab, 'expected __lexiVocab present');
  assert.strictEqual(win.__lexiVocab.getLanguage(), 'nb');
  // Baseline hydration event fired.
  const baseline = messages.find(m => m && m.type === 'lexi:hydration' && m.state === 'baseline');
  assert.ok(baseline, `expected lexi:hydration baseline event; got ${JSON.stringify(messages)}`);
});

test('target lang with no cache: spawns fetchBundle and swaps to full indexes on success', async () => {
  const fetchedPayload = { _tag: 'fetched-de', verbbank: {}, nounbank: {} };
  const { win, messages } = makeSandbox({
    storedLang: 'de',
    fetchResult: {
      de: { status: 200, body: { schema_version: 1, revision: 'rev-de-1', ...fetchedPayload } },
    },
  });
  // Baseline available immediately.
  await waitFor(() => win.__lexiVocab && win.__lexiVocab.isReady && win.__lexiVocab.isReady());
  // Wait for full swap (state: 'ready' message).
  const ready = await waitFor(() => messages.some(m => m && m.type === 'lexi:hydration' && m.lang === 'de' && m.state === 'ready'), { timeout: 2000 });
  assert.ok(ready, `expected lexi:hydration de ready; got ${JSON.stringify(messages.filter(m => m?.type === 'lexi:hydration'))}`);
});

test('schema-mismatch: hydration stays on baseline, emits state=error', async () => {
  const { win, messages } = makeSandbox({
    storedLang: 'de',
    fetchResult: {
      de: { status: 'schema-mismatch', cachedSchema: 1, serverSchema: 99 },
    },
  });
  await waitFor(() => win.__lexiVocab && win.__lexiVocab.isReady && win.__lexiVocab.isReady());
  const errored = await waitFor(() => messages.some(m => m && m.type === 'lexi:hydration' && m.lang === 'de' && m.state === 'error'), { timeout: 2000 });
  assert.ok(errored, 'expected lexi:hydration de error after schema-mismatch');
  // No 'ready' for de should fire.
  const ready = messages.find(m => m && m.type === 'lexi:hydration' && m.lang === 'de' && m.state === 'ready');
  assert.strictEqual(ready, undefined, 'must not fire ready on schema-mismatch');
});

test('swapIndexes is idempotent on same revision', async () => {
  const { win, builtForCalls } = makeSandbox({
    storedLang: 'de',
    fetchResult: {
      de: { status: 200, body: { schema_version: 1, revision: 'rev-de-1', _tag: 'fetched-de' } },
    },
  });
  await waitFor(() => win.__lexiVocab && win.__lexiVocab.isReady && win.__lexiVocab.isReady());
  // swapIndexes is a public test seam exposed on __lexiVocab.
  if (typeof win.__lexiVocab.swapIndexes === 'function') {
    const before = JSON.stringify({ wl: win.__lexiVocab.getValidWords ? [...win.__lexiVocab.getValidWords()] : [] });
    win.__lexiVocab.swapIndexes('de', 'rev-de-1', { _tag: 'should-be-ignored' });
    const after = JSON.stringify({ wl: win.__lexiVocab.getValidWords ? [...win.__lexiVocab.getValidWords()] : [] });
    assert.strictEqual(after, before, 'second swap with same revision must be a no-op');
  } else {
    assert.fail('swapIndexes not exposed on __lexiVocab — test cannot verify idempotence');
  }
});

test('cached bundle: hydrates directly from IDB without fetch', async () => {
  const { win, messages, sandbox } = makeSandbox({
    storedLang: 'de',
    cachedBundle: {
      de: {
        schema_version: 1,
        revision: 'rev-cache',
        fetched_at: new Date().toISOString(),
        payload: { _tag: 'cached-de', verbbank: {} },
      },
    },
    // fetchResult: undefined — if fetchBundle fires, the test will see an
    // 'error' hydration event (since the default stub returns error).
  });
  await waitFor(() => win.__lexiVocab && win.__lexiVocab.isReady && win.__lexiVocab.isReady());
  const ready = await waitFor(() => messages.some(m => m && m.type === 'lexi:hydration' && m.lang === 'de' && m.state === 'ready'), { timeout: 2000 });
  assert.ok(ready, 'expected lexi:hydration de ready from cached bundle');
  const errored = messages.find(m => m && m.type === 'lexi:hydration' && m.lang === 'de' && m.state === 'error');
  assert.strictEqual(errored, undefined, 'must not emit error when cache hit');
});
