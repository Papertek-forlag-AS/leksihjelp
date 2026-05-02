/**
 * Tests for vocab-store.js — v1 cache adapter against
 * papertek-vocabulary.vercel.app/api/vocab/v1/*.
 *
 * Strategy:
 *   - `fake-indexeddb/auto` provides a real-shape IndexedDB on globalThis.
 *   - `chrome.runtime.sendMessage` and `globalThis.fetch` are stubbed.
 *   - vocab-store.js is loaded as text and evaluated inside a fresh sandbox
 *     for each test so module-level state (DB handle, queue) is reset.
 *
 * Surfaces under test (per plan 23-02 contract):
 *   - SUPPORTED_SCHEMA_VERSION  = 1
 *   - API_BASE                  ends with `/api/vocab/v1`
 *   - getCachedBundle(lang)     → null | {schema_version, revision, fetched_at, payload}
 *   - putCachedBundle(lang, e)  stamps fetched_at automatically
 *   - getCachedRevisions()      → { lang: revision } map from cache
 *   - fetchBundle(lang, opts)   → 200 / 304 / schema-mismatch / error
 *
 * The audio-cache surface is NOT tested here; plan 23-02 leaves it untouched.
 */

require('fake-indexeddb/auto');

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');

const STORE_SRC = fs.readFileSync(
  path.join(__dirname, 'vocab-store.js'),
  'utf8'
);

function freshSandbox({ fetchImpl, sentMessages } = {}) {
  // Wipe IndexedDB between tests to avoid cross-test contamination.
  // fake-indexeddb's reset is exposed on the auto-imported global.
  const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
  globalThis.indexedDB = new FDBFactory();

  const win = {};
  const sandbox = {
    window: win,
    self: win,
    globalThis: win,
    indexedDB: globalThis.indexedDB,
    IDBKeyRange: globalThis.IDBKeyRange,
    location: { protocol: 'chrome-extension:' },
    fetch: fetchImpl || (async () => { throw new Error('fetch not stubbed'); }),
    chrome: {
      runtime: {
        sendMessage: (msg, cb) => {
          if (sentMessages) sentMessages.push(msg);
          if (typeof cb === 'function') cb(null);
        },
        lastError: null,
      },
    },
    console,
    setTimeout, clearTimeout, queueMicrotask, Promise,
    TextDecoder, Blob, DecompressionStream, DataView, Uint8Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(STORE_SRC, sandbox);
  return sandbox.window.__lexiVocabStore;
}

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    json: async () => body,
  };
}

test('API_BASE points at v1', () => {
  const store = freshSandbox();
  assert.match(store.API_BASE, /\/api\/vocab\/v1$/);
});

test('SUPPORTED_SCHEMA_VERSION is 1', () => {
  const store = freshSandbox();
  assert.strictEqual(store.SUPPORTED_SCHEMA_VERSION, 1);
});

test('getCachedBundle returns null when no entry stored', async () => {
  const store = freshSandbox();
  const result = await store.getCachedBundle('de');
  assert.strictEqual(result, null);
});

test('putCachedBundle stamps fetched_at and roundtrips through getCachedBundle', async () => {
  const store = freshSandbox();
  const before = Date.now();
  await store.putCachedBundle('de', {
    schema_version: 1,
    revision: '2026-04-27-deadbeef',
    payload: { verbbank: { sein_verb: { word: 'sein' } } },
  });
  const after = Date.now();
  const got = await store.getCachedBundle('de');
  assert.ok(got, 'expected a cache entry');
  assert.strictEqual(got.schema_version, 1);
  assert.strictEqual(got.revision, '2026-04-27-deadbeef');
  assert.deepStrictEqual(got.payload, { verbbank: { sein_verb: { word: 'sein' } } });
  const ts = new Date(got.fetched_at).getTime();
  assert.ok(ts >= before && ts <= after + 1000, `fetched_at out of range: ${got.fetched_at}`);
});

test('getCachedRevisions returns {lang: revision} from existing entries', async () => {
  const store = freshSandbox();
  await store.putCachedBundle('de', { schema_version: 1, revision: 'rev-de', payload: {} });
  await store.putCachedBundle('es', { schema_version: 1, revision: 'rev-es', payload: {} });
  const revs = await store.getCachedRevisions();
  // Convert to plain object — vm sandbox values may have a different
  // prototype than the test realm's Object.
  assert.deepStrictEqual({ ...revs }, { de: 'rev-de', es: 'rev-es' });
});

test('fetchBundle 200 with matching schema returns body', async () => {
  const fetchImpl = async (url, opts) => {
    assert.match(url, /\/api\/vocab\/v1\/bundle\/de$/);
    return jsonResponse(200, {
      schema_version: 1,
      revision: 'rev-1',
      verbbank: {},
    }, { etag: '"rev-1"' });
  };
  const store = freshSandbox({ fetchImpl });
  const r = await store.fetchBundle('de');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.schema_version, 1);
  assert.strictEqual(r.body.revision, 'rev-1');
});

test('fetchBundle sends X-API-Key header on every request (auth rollout)', async () => {
  // Papertek API enforces X-API-Key authentication. The key is bundled into
  // vocab-store.js as a plain constant — see the comment near API_KEY in
  // vocab-store.js for why that's intentional. This test pins the contract:
  // every fetchBundle call must include the header, regardless of opts.
  let seenHeaders = null;
  const fetchImpl = async (url, opts) => {
    seenHeaders = opts?.headers || {};
    return jsonResponse(200, { schema_version: 1, revision: 'rev-1' });
  };
  const store = freshSandbox({ fetchImpl });
  await store.fetchBundle('de');
  assert.ok(seenHeaders, 'fetch was not invoked');
  assert.match(
    String(seenHeaders['X-API-Key'] || ''),
    /^lk_[0-9a-f]{64}$/,
    'X-API-Key header missing or wrong shape'
  );
  // Header should also be present alongside If-None-Match on revalidation.
  await store.fetchBundle('de', { ifNoneMatch: '"rev-1"' });
  assert.match(String(seenHeaders['X-API-Key'] || ''), /^lk_/);
  assert.strictEqual(seenHeaders['If-None-Match'], '"rev-1"');
  // And API_KEY must be exposed on the store surface for non-fetchBundle
  // callers (vocab-updater /revisions, popup /v3/manifest) to read.
  assert.match(String(store.API_KEY || ''), /^lk_[0-9a-f]{64}$/);
  assert.strictEqual(store.V3_API_BASE, 'https://papertek-vocabulary.vercel.app/api/vocab');
});

test('fetchBundle forwards If-None-Match header when ifNoneMatch supplied', async () => {
  let seenHeaders = null;
  const fetchImpl = async (url, opts) => {
    seenHeaders = opts?.headers || {};
    return jsonResponse(304, null);
  };
  const store = freshSandbox({ fetchImpl });
  const r = await store.fetchBundle('de', { ifNoneMatch: '"rev-1"' });
  assert.strictEqual(r.status, 304);
  assert.strictEqual(seenHeaders['If-None-Match'], '"rev-1"');
});

test('fetchBundle 200 with schema mismatch returns schema-mismatch and emits chrome message', async () => {
  const fetchImpl = async () => jsonResponse(200, {
    schema_version: 99,
    revision: 'future-rev',
    verbbank: {},
  });
  const sentMessages = [];
  const store = freshSandbox({ fetchImpl, sentMessages });
  // Pre-populate cache so we can verify it's preserved.
  await store.putCachedBundle('de', { schema_version: 1, revision: 'old', payload: { a: 1 } });
  const r = await store.fetchBundle('de');
  assert.strictEqual(r.status, 'schema-mismatch');
  assert.strictEqual(r.cachedSchema, 1);
  assert.strictEqual(r.serverSchema, 99);
  // Cache must NOT have been overwritten by fetchBundle (it only reports;
  // putCachedBundle is the caller's call to make).
  const cached = await store.getCachedBundle('de');
  assert.strictEqual(cached.revision, 'old');
  assert.deepStrictEqual(cached.payload, { a: 1 });
  // chrome.runtime.sendMessage must have been called with schema-mismatch event.
  const mismatch = sentMessages.find(m => m.type === 'lexi:schema-mismatch');
  assert.ok(mismatch, 'expected lexi:schema-mismatch message');
  assert.strictEqual(mismatch.lang, 'de');
  assert.strictEqual(mismatch.cachedSchema, 1);
  assert.strictEqual(mismatch.serverSchema, 99);
});

test('fetchBundle network error returns {status: error, error}', async () => {
  const fetchImpl = async () => { throw new Error('boom'); };
  const store = freshSandbox({ fetchImpl });
  const r = await store.fetchBundle('de');
  assert.strictEqual(r.status, 'error');
  assert.ok(r.error instanceof Error);
  assert.match(r.error.message, /boom/);
});

test('public methods are safe to call before IDB ready (concurrent puts before any get)', async () => {
  const store = freshSandbox();
  // Fire a bunch concurrently — internal queue must serialize and not throw.
  await Promise.all([
    store.putCachedBundle('de', { schema_version: 1, revision: 'a', payload: {} }),
    store.putCachedBundle('es', { schema_version: 1, revision: 'b', payload: {} }),
    store.putCachedBundle('fr', { schema_version: 1, revision: 'c', payload: {} }),
  ]);
  const revs = await store.getCachedRevisions();
  assert.deepStrictEqual(
    Object.keys(revs).sort(),
    ['de', 'es', 'fr']
  );
});
