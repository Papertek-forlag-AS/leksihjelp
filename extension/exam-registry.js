/**
 * Leksihjelp — Exam-Mode Surface Registry
 *
 * Phase 27 (Exam Mode). Single source of truth for non-rule user-visible
 * surfaces (dictionary popup, conjugation tables, TTS, word prediction,
 * pedagogy panel, side panel, grammar-features popover, popup search).
 * Spell-check rules carry their own `exam` marker on the rule object pushed
 * to `host.__lexiSpellRules`; this registry covers everything that is NOT a
 * spell-check rule.
 *
 * Marker shape (matches the rule-side contract from CONTEXT.md):
 *   { id: string, exam: { safe: boolean, reason: string, category: string } }
 *
 * Categories (closed set, mirrors rule-side): 'spellcheck', 'grammar-lookup',
 * 'dictionary', 'tts', 'prediction', 'pedagogy', 'popup', 'widget'.
 *
 * Plan 02 (check-exam-marker gate) reads this registry to enforce the
 * contract; Plan 03 (runtime suppression) reads it to gate non-rule
 * surfaces when exam mode is on. This file is inert metadata until those
 * plans land.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;

  host.__lexiExamRegistryVersion = 1;

  host.__lexiExamRegistry = Object.freeze([
    Object.freeze({
      id: 'popup.search',
      exam: Object.freeze({
        safe: false,
        reason: 'Dictionary lookup results in popup exceed browser native spellcheck parity',
        category: 'dictionary',
      }),
    }),
    Object.freeze({
      id: 'popup.conjugationTable',
      exam: Object.freeze({
        safe: false,
        reason: 'Conjugation tables in popup are reference material beyond browser native parity',
        category: 'dictionary',
      }),
    }),
    Object.freeze({
      id: 'popup.ttsButton',
      exam: Object.freeze({
        safe: false,
        reason: 'TTS playback in popup gives pronunciation assistance beyond browser native parity',
        category: 'tts',
      }),
    }),
    Object.freeze({
      id: 'popup.grammarFeaturesPopover',
      exam: Object.freeze({
        safe: false,
        reason: 'Grammar-features descriptions are pedagogical content beyond browser native parity',
        category: 'pedagogy',
      }),
    }),
    Object.freeze({
      id: 'widget.dictionary',
      exam: Object.freeze({
        safe: false,
        reason: 'Floating-widget inline dictionary lookup exceeds browser native spellcheck parity',
        category: 'dictionary',
      }),
    }),
    Object.freeze({
      id: 'widget.conjugation',
      exam: Object.freeze({
        safe: false,
        reason: 'Floating-widget conjugation surface is reference material beyond browser native parity',
        category: 'dictionary',
      }),
    }),
    Object.freeze({
      id: 'widget.tts',
      exam: Object.freeze({
        safe: false,
        reason: 'Floating-widget TTS button gives pronunciation assistance beyond browser native parity',
        category: 'tts',
      }),
    }),
    Object.freeze({
      id: 'widget.pedagogyPanel',
      exam: Object.freeze({
        safe: false,
        reason: 'Lær mer expanded pedagogy panel exceeds browser native parity',
        category: 'pedagogy',
      }),
    }),
    Object.freeze({
      id: 'wordPrediction.dropdown',
      exam: Object.freeze({
        safe: false,
        reason: 'Autocomplete suggestions in text inputs provide writing assistance beyond browser native parity',
        category: 'prediction',
      }),
    }),
    Object.freeze({
      id: 'sidePanel.fest',
      exam: Object.freeze({
        safe: false,
        reason: 'Chrome side-panel dictionary surface exceeds browser native parity',
        category: 'dictionary',
      }),
    }),
  ]);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = host.__lexiExamRegistry;
  }
})();
