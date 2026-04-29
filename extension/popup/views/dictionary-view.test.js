/**
 * Unit tests for dictionary-view.js (Phase 30-01 Task 1 scaffold).
 *
 * These tests run under Node's built-in --test runner (matches the existing
 * test:vocab-store / test:vocab-seam pattern). They DO NOT use jsdom — the
 * view module never imports jsdom; in production it runs inside the popup's
 * browser context where `document` exists. The test mocks the minimum DOM
 * surface the view actually touches.
 *
 * Task 1 contract (no behavior yet):
 *   1. The module loads without throwing.
 *   2. mountDictionaryView returns an object with destroy + refresh fns
 *      when called with stub container + minimal deps.
 *   3. Calling with missing container or deps throws.
 *
 * Task 2 will expand: mock vocab → call refresh → assert markup includes
 * expected lemma/article; with audioEnabled: false → assert no audio button.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Hand-rolled DOM stub. Only what the view actually touches.
function stubElement() {
  return {
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {},
    removeChild: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    innerHTML: '',
    textContent: '',
    value: '',
    style: {},
    dataset: {},
    children: [],
  };
}

function minimalDeps() {
  return {
    vocab: {
      getLanguage: () => 'es',
      isReady: () => true,
      onReady: () => {},
      getWordList: () => [],
      getDictionary: () => ({}),
      flattenBanks: () => [],
    },
    storage: { get: async () => null, set: async () => {} },
    runtime: { sendMessage: () => {} },
    t: (k) => k,
    getUiLanguage: () => 'nb',
    langName: () => 'Spansk',
    isFeatureEnabled: () => true,
    getAllowedPronouns: () => null,
    audioEnabled: true,
    playAudio: () => {},
    BACKEND_URL: 'https://example.invalid',
    onSearch: null,
  };
}

// Establish `self` for the IIFE before requiring.
if (typeof global.self === 'undefined') global.self = global;

const MOD = require(path.join(__dirname, 'dictionary-view.js'));

test('dictionary-view module loads and exposes a mount function', () => {
  assert.equal(typeof MOD.mount, 'function', 'expected MOD.mount to be a function');
  assert.equal(typeof MOD.mountDictionaryView, 'function');
  assert.equal(typeof global.self.__lexiDictionaryView, 'object');
  assert.equal(typeof global.self.__lexiDictionaryView.mount, 'function');
});

test('mountDictionaryView returns { destroy, refresh } when called correctly', () => {
  const handle = MOD.mount(stubElement(), minimalDeps());
  assert.equal(typeof handle, 'object');
  assert.equal(typeof handle.destroy, 'function');
  assert.equal(typeof handle.refresh, 'function');
});

test('mountDictionaryView throws when container is missing', () => {
  assert.throws(() => MOD.mount(null, minimalDeps()), /container required/);
  assert.throws(() => MOD.mount(undefined, minimalDeps()), /container required/);
});

test('mountDictionaryView throws when deps is missing', () => {
  assert.throws(() => MOD.mount(stubElement(), null), /deps required/);
  assert.throws(() => MOD.mount(stubElement(), undefined), /deps required/);
});
