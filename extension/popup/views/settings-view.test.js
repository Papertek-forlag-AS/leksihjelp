/**
 * Unit tests for settings-view.js (Phase 30-01 Task 1 scaffold).
 *
 * Same approach as dictionary-view.test.js — Node --test, hand-rolled DOM
 * stub, no jsdom. Task 1 contract only; Task 2 will expand with mock storage
 * + showSection assertions.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

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
    storage: { get: async () => null, set: async () => {} },
    runtime: { sendMessage: () => {} },
    t: (k) => k,
    getUiLanguage: () => 'nb',
    setUiLanguage: () => {},
    langName: () => 'Spansk',
    loadGrammarFeatures: async () => {},
    saveAndNotifyGrammarChange: () => {},
    showSection: { language: true, grammar: true, darkmode: true, prediction: true, spellcheckAlternates: true },
  };
}

if (typeof global.self === 'undefined') global.self = global;

const MOD = require(path.join(__dirname, 'settings-view.js'));

test('settings-view module loads and exposes a mount function', () => {
  assert.equal(typeof MOD.mount, 'function');
  assert.equal(typeof MOD.mountSettingsView, 'function');
  assert.equal(typeof global.self.__lexiSettingsView, 'object');
  assert.equal(typeof global.self.__lexiSettingsView.mount, 'function');
});

test('mountSettingsView returns { destroy } when called correctly', () => {
  const handle = MOD.mount(stubElement(), minimalDeps());
  assert.equal(typeof handle, 'object');
  assert.equal(typeof handle.destroy, 'function');
});

test('mountSettingsView throws when container is missing', () => {
  assert.throws(() => MOD.mount(null, minimalDeps()), /container required/);
});

test('mountSettingsView throws when deps is missing', () => {
  assert.throws(() => MOD.mount(stubElement(), null), /deps required/);
});
