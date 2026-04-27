/**
 * Tests for vocab-updater.js — startup revision check + atomic refresh.
 *
 * Strategy:
 *   - Stub vocab-store.js exports (API_BASE, getCachedRevisions, fetchBundle,
 *     putCachedBundle) on a sandbox.
 *   - Stub `fetch` for the /revisions endpoint.
 *   - Stub `chrome.runtime.sendMessage` to capture emitted events.
 *   - Load vocab-updater.js as text into a vm sandbox (mirrors
 *     vocab-store.test.js / vocab-seam.test.js patterns).
 *
 * Behaviors asserted (per plan 23-04):
 *   1. checkForUpdates with all-fresh cache: returns all 'fresh', emits no
 *      'lexi:updates-available'.
 *   2. checkForUpdates with one stale: returns mixed map, emits
 *      'lexi:updates-available' with the stale langs.
 *   3. refreshLanguage success: fetches bundle, calls putCachedBundle, emits
 *      'lexi:refresh-done'.
 *   4. refreshLanguage schema-mismatch: leaves cache untouched, emits
 *      'lexi:hydration' state='error'.
 *   5. refreshAll: per-language failure does not abort the rest.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');

const UPDATER_SRC = fs.readFileSync(
  path.join(__dirname, 'vocab-updater.js'),
  'utf8'
);

function freshSandbox({
  fetchImpl,
  cachedRevisions = {},
  fetchBundleImpl,
  putCachedBundleImpl,
  sentMessages,
} = {}) {
  const calls = {
    putCachedBundle: [],
    fetchBundle: [],
  };

  const vocabStore = {
    API_BASE: 'https://papertek-vocabulary.vercel.app/api/vocab/v1',
    getCachedRevisions: async () => cachedRevisions,
    fetchBundle: fetchBundleImpl || (async (lang, opts) => {
      calls.fetchBundle.push({ lang, opts });
      return { status: 200, body: { schema_version: 1, revision: 'srv-' + lang } };
    }),
    putCachedBundle: putCachedBundleImpl || (async (lang, entry) => {
      calls.putCachedBundle.push({ lang, entry });
    }),
  };

  const sandbox = {
    self: {},
    globalThis: {},
    fetch: fetchImpl || (async () => { throw new Error('fetch not stubbed'); }),
    chrome: {
      runtime: {
        sendMessage: (msg, cb) => {
          if (sentMessages) sentMessages.push(msg);
          if (typeof cb === 'function') cb(null);
        },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: () => {} },
        lastError: null,
      },
    },
    console,
    setTimeout, clearTimeout, queueMicrotask, Promise,
    // Wire vocab-store into the sandbox so vocab-updater.js can locate it.
    __lexiVocabStore: vocabStore,
  };
  sandbox.self.__lexiVocabStore = vocabStore;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(UPDATER_SRC, sandbox);

  // The IIFE exposes the API as self.__lexiVocabUpdater
  return { api: sandbox.self.__lexiVocabUpdater, calls, vocabStore };
}

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    json: async () => body,
  };
}

test('checkForUpdates: all fresh → returns fresh map and emits no updates message', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /\/api\/vocab\/v1\/revisions$/);
    return jsonResponse(200, {
      schema_version: 1,
      revisions: { de: 'rev-de', es: 'rev-es' },
    });
  };
  const sentMessages = [];
  const { api } = freshSandbox({
    fetchImpl,
    cachedRevisions: { de: 'rev-de', es: 'rev-es' },
    sentMessages,
  });
  const result = await api.checkForUpdates();
  assert.deepStrictEqual({ ...result }, { de: 'fresh', es: 'fresh' });
  const updateMsg = sentMessages.find(m => m.type === 'lexi:updates-available');
  assert.strictEqual(updateMsg, undefined, 'no updates-available message expected');
});

test('checkForUpdates: one stale → returns mixed map and emits updates-available', async () => {
  const fetchImpl = async () => jsonResponse(200, {
    schema_version: 1,
    revisions: { de: 'rev-de-NEW', es: 'rev-es' },
  });
  const sentMessages = [];
  const { api } = freshSandbox({
    fetchImpl,
    cachedRevisions: { de: 'rev-de-OLD', es: 'rev-es' },
    sentMessages,
  });
  const result = await api.checkForUpdates();
  assert.strictEqual(result.de, 'stale');
  assert.strictEqual(result.es, 'fresh');
  const updateMsg = sentMessages.find(m => m.type === 'lexi:updates-available');
  assert.ok(updateMsg, 'expected lexi:updates-available message');
  assert.deepStrictEqual([...updateMsg.langs], ['de']);
});

test('checkForUpdates: language with no cache returns missing and is excluded from updates-available', async () => {
  const fetchImpl = async () => jsonResponse(200, {
    schema_version: 1,
    revisions: { de: 'rev-de', fr: 'rev-fr' },
  });
  const sentMessages = [];
  const { api } = freshSandbox({
    fetchImpl,
    cachedRevisions: { de: 'rev-de' }, // fr not cached
    sentMessages,
  });
  const result = await api.checkForUpdates();
  assert.strictEqual(result.de, 'fresh');
  // fr should not appear since it's not in cache (bootstrap handles it)
  assert.strictEqual(result.fr, undefined);
  const updateMsg = sentMessages.find(m => m.type === 'lexi:updates-available');
  assert.strictEqual(updateMsg, undefined);
});

test('refreshLanguage success: writes cache atomically, emits refresh-done', async () => {
  const sentMessages = [];
  const { api, calls } = freshSandbox({
    cachedRevisions: { de: 'old' },
    sentMessages,
    fetchBundleImpl: async (lang) => {
      assert.strictEqual(lang, 'de');
      return {
        status: 200,
        body: { schema_version: 1, revision: 'new', verbbank: {} },
      };
    },
  });
  await api.refreshLanguage('de');
  assert.strictEqual(calls.putCachedBundle.length, 1);
  assert.strictEqual(calls.putCachedBundle[0].lang, 'de');
  assert.strictEqual(calls.putCachedBundle[0].entry.revision, 'new');
  assert.strictEqual(calls.putCachedBundle[0].entry.schema_version, 1);
  const done = sentMessages.find(m => m.type === 'lexi:refresh-done');
  assert.ok(done, 'expected lexi:refresh-done');
  assert.strictEqual(done.lang, 'de');
});

test('refreshLanguage schema-mismatch: cache untouched, emits hydration error', async () => {
  const sentMessages = [];
  const { api, calls } = freshSandbox({
    sentMessages,
    fetchBundleImpl: async () => ({
      status: 'schema-mismatch',
      cachedSchema: 1,
      serverSchema: 99,
    }),
  });
  await api.refreshLanguage('de');
  assert.strictEqual(calls.putCachedBundle.length, 0, 'cache must NOT be written on schema-mismatch');
  const err = sentMessages.find(m => m.type === 'lexi:hydration' && m.state === 'error');
  assert.ok(err, 'expected lexi:hydration error event');
  assert.strictEqual(err.lang, 'de');
});

test('refreshLanguage error: cache untouched, emits hydration error', async () => {
  const sentMessages = [];
  const { api, calls } = freshSandbox({
    sentMessages,
    fetchBundleImpl: async () => ({ status: 'error', error: new Error('net') }),
  });
  await api.refreshLanguage('de');
  assert.strictEqual(calls.putCachedBundle.length, 0);
  const err = sentMessages.find(m => m.type === 'lexi:hydration' && m.state === 'error');
  assert.ok(err);
});

test('refreshAll: per-lang failure does not abort the rest', async () => {
  const sentMessages = [];
  const { api, calls } = freshSandbox({
    sentMessages,
    fetchBundleImpl: async (lang) => {
      if (lang === 'de') return { status: 'error', error: new Error('boom') };
      return { status: 200, body: { schema_version: 1, revision: 'r-' + lang } };
    },
  });
  await api.refreshAll(['de', 'es', 'fr']);
  // de failed → no put; es + fr succeeded → 2 puts
  assert.strictEqual(calls.putCachedBundle.length, 2);
  const langs = calls.putCachedBundle.map(c => c.lang).sort();
  assert.deepStrictEqual(langs, ['es', 'fr']);
  // refresh-done emitted for the two successes
  const dones = sentMessages.filter(m => m.type === 'lexi:refresh-done');
  assert.strictEqual(dones.length, 2);
});
