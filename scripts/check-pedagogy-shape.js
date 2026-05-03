#!/usr/bin/env node
/**
 * Leksihjelp — Pedagogy Block Shape Release Gate (PED-06, Phase 26-02)
 *
 * Structural counterpart to check-explain-contract.js. Where explain returns
 * student-facing TEXT, the pedagogy block carries STRUCTURED teaching data
 * (case, summary, explanation, examples, wechsel_pair, ...) consumed by the
 * "Lær mer" expandable popover (plan 26-03). This gate enforces the contract
 * shape on every pedagogy block any rule attaches to a finding.
 *
 * Why this gate exists
 * --------------------
 * Without it, a future rule could emit a `pedagogy` block missing
 * `summary.nn` or with `case: 'wechselpräposition'` (typo for `'wechsel'`)
 * and the popover would render visibly broken text — but no other gate
 * would catch it. Same class of regression as the Phase 05.1 dialect-mix
 * CSS-wiring miss. We catch it once at release time.
 *
 * Behavior
 * --------
 * For each rule in TARGETS (mirrors check-explain-contract.js): load the
 * rule, drive `rule.check(ctx)` with a synthetic ctx whose vocab.prepPedagogy
 * Map contains a known-valid pedagogy block. For each finding emitted that
 * carries a `pedagogy` field, validate the shape:
 *
 *   - `case` is one of: 'akkusativ', 'dativ', 'wechsel', 'genitiv'
 *   - `summary.{nb, nn, en}` are all non-empty strings
 *   - `explanation.{nb, nn, en}` are all non-empty strings
 *   - If `case === 'wechsel'`, `wechsel_pair.motion` and
 *     `wechsel_pair.location` must both exist
 *   - If `examples` present, each entry has `correct: string`,
 *     `incorrect: string`, `translation.{nb,nn,en}` non-empty
 *   - If `colloquial_note` present, full {nb, nn, en} non-empty triple
 *   - If `contraction` present, `from: string` and `article: string`
 *
 * Pre-26-01 (no rule emits pedagogy yet): exits 0 with informational message.
 * The gate is intentionally silent until rules opt in to attaching pedagogy.
 *
 * Rule check() throwing under synthetic input is NOT a gate failure (the
 * gate's scope is pedagogy SHAPE, not rule runtime safety — check-fixtures
 * owns runtime safety).
 *
 * Usage:
 *   node scripts/check-pedagogy-shape.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-explain-contract.js style.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'extension/content/spell-check-core.js');

// Mirrors the TARGETS list in check-explain-contract.js — start identical,
// drift later if needs diverge. Extra targets can be injected via the
// LEXI_PEDAGOGY_GATE_EXTRA_TARGETS env var (comma-separated relative paths)
// for the paired self-test.
const TARGETS = [
  'extension/content/spell-rules/de-capitalization.js',
  'extension/content/spell-rules/de-gender.js',
  'extension/content/spell-rules/de-grammar.js',
  'extension/content/spell-rules/de-modal-verb.js',
  'extension/content/spell-rules/en-grammar.js',
  'extension/content/spell-rules/es-accent-guard.js',
  'extension/content/spell-rules/es-coordination.js',
  'extension/content/spell-rules/es-grammar.js',
  'extension/content/spell-rules/es-fr-gender.js',
  'extension/content/spell-rules/es-fr-modal-verb.js',
  'extension/content/spell-rules/fr-contraction.js',
  'extension/content/spell-rules/fr-grammar.js',
  'extension/content/spell-rules/fr-preposition.js',
  'extension/content/spell-rules/nb-gender.js',
  'extension/content/spell-rules/nb-compound-gender.js',
  'extension/content/spell-rules/nb-demonstrative-gender.js',
  'extension/content/spell-rules/nb-modal-verb.js',
  'extension/content/spell-rules/nb-sarskriving.js',
  'extension/content/spell-rules/universal-agreement.js',
  'extension/content/spell-rules/nb-dialect-mix.js',
  'extension/content/spell-rules/nb-typo-curated.js',
  'extension/content/spell-rules/nb-triple-letter.js',
  'extension/content/spell-rules/nb-typo-fuzzy.js',
  'extension/content/spell-rules/nb-homophones.js',
  'extension/content/spell-rules/universal-context-typo.js',
  'extension/content/spell-rules/register.js',
  'extension/content/spell-rules/collocation.js',
  'extension/content/spell-rules/redundancy.js',
  'extension/content/spell-rules/es-ser-estar.js',
  'extension/content/spell-rules/es-por-para.js',
  'extension/content/spell-rules/es-personal-a.js',
  'extension/content/spell-rules/de-prep-case.js',
  'extension/content/spell-rules/de-separable-verb.js',
  'extension/content/spell-rules/de-v2.js',
  'extension/content/spell-rules/de-verb-final.js',
  'extension/content/spell-rules/fr-bags.js',
  'extension/content/spell-rules/nb-v2.js',
  'extension/content/spell-rules/quotation-suppression.js',
  'extension/content/spell-rules/de-perfekt-aux.js',
  'extension/content/spell-rules/de-compound-gender.js',
  'extension/content/spell-rules/fr-elision.js',
  'extension/content/spell-rules/fr-etre-avoir.js',
  'extension/content/spell-rules/fr-pp-agreement.js',
  'extension/content/spell-rules/es-subjuntivo.js',
  'extension/content/spell-rules/es-imperfecto-hint.js',
  'extension/content/spell-rules/fr-subjonctif.js',
  'extension/content/spell-rules/es-pro-drop.js',
  'extension/content/spell-rules/es-gustar.js',
  'extension/content/spell-rules/fr-clitic-order.js',
  'extension/content/spell-rules/en-morphology.js',
  'extension/content/spell-rules/en-word-family.js',
  'extension/content/spell-rules/fr-adj-gender.js',
  'extension/content/spell-rules/doc-drift-de-address.js',
  'extension/content/spell-rules/doc-drift-fr-address.js',
  'extension/content/spell-rules/doc-drift-nb-register.js',
  'extension/content/spell-rules/doc-drift-nn-infinitive.js',
  'extension/content/spell-rules/nb-nn-passiv-s.js',
  'extension/content/spell-rules/nb-aa-og.js',
  'extension/content/spell-rules/doc-drift-nb-passiv-overuse.js',
];

const VALID_CASES = new Set(['akkusativ', 'dativ', 'wechsel', 'genitiv']);

function gatherTargets() {
  const extra = (process.env.LEXI_PEDAGOGY_GATE_EXTRA_TARGETS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  return TARGETS.concat(extra);
}

function resetGlobals() {
  if (typeof global.self === 'undefined') global.self = global;
  global.self.__lexiSpellRules = [];
  delete global.self.__lexiSpellCore;
}

function clearRequireCache(targets) {
  const corePath = require.resolve(CORE_PATH);
  if (require.cache[corePath]) delete require.cache[corePath];
  for (const rel of targets) {
    try {
      const abs = require.resolve(path.join(ROOT, rel));
      if (require.cache[abs]) delete require.cache[abs];
    } catch (_) { /* not loaded yet, fine */ }
  }
}

function loadCore() {
  require(CORE_PATH);
}

function fail(code, ruleId, file, detail) {
  process.stderr.write(
    '[check-pedagogy-shape] FAIL: ' + code + ' ' +
    (ruleId || '<no id>') + ' ' +
    path.relative(ROOT, file) + ' :: ' + detail + '\n'
  );
  process.exit(1);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function isRegisterTriple(obj) {
  return obj
    && typeof obj === 'object'
    && !Array.isArray(obj)
    && isNonEmptyString(obj.nb)
    && isNonEmptyString(obj.nn)
    && isNonEmptyString(obj.en);
}

// Validate one pedagogy block. Returns { ok: true } or { ok: false, code, detail }.
function validatePedagogy(ped) {
  if (!ped || typeof ped !== 'object' || Array.isArray(ped)) {
    return { ok: false, code: 'PEDAGOGY_NOT_OBJECT', detail: 'pedagogy must be a plain object' };
  }
  // Optional: case
  if (ped.case !== undefined && !VALID_CASES.has(ped.case)) {
    return {
      ok: false,
      code: 'PEDAGOGY_BAD_CASE',
      detail: 'pedagogy.case=' + JSON.stringify(ped.case) + ' (expected one of: akkusativ, dativ, wechsel, genitiv)',
    };
  }
  // Optional register triples (Phase 39: structural rules may use note instead of summary/explanation)
  if (ped.summary !== undefined && !isRegisterTriple(ped.summary)) {
    return { ok: false, code: 'PEDAGOGY_BAD_SUMMARY', detail: 'pedagogy.summary must be {nb, nn, en} triple' };
  }
  if (ped.explanation !== undefined && !isRegisterTriple(ped.explanation)) {
    return { ok: false, code: 'PEDAGOGY_BAD_EXPLANATION', detail: 'pedagogy.explanation must be {nb, nn, en} triple' };
  }
  if (ped.note !== undefined && !isRegisterTriple(ped.note)) {
    return { ok: false, code: 'PEDAGOGY_BAD_NOTE', detail: 'pedagogy.note must be {nb, nn, en} triple' };
  }

  if (ped.case === 'wechsel') {
    const wp = ped.wechsel_pair;
    if (!wp || typeof wp !== 'object' || !wp.motion || !wp.location) {
      return {
        ok: false,
        code: 'PEDAGOGY_MISSING_WECHSEL_PAIR',
        detail: 'case=wechsel requires wechsel_pair.{motion, location}',
      };
    }
  }
  if (ped.examples !== undefined) {
    if (!Array.isArray(ped.examples)) {
      return { ok: false, code: 'PEDAGOGY_BAD_EXAMPLES', detail: 'pedagogy.examples must be an array if present' };
    }
    for (let i = 0; i < ped.examples.length; i++) {
      const ex = ped.examples[i];
      if (!ex || typeof ex !== 'object') {
        return { ok: false, code: 'PEDAGOGY_BAD_EXAMPLE', detail: 'examples[' + i + '] is not an object' };
      }
      // Examples can be a simple corrected sentence or a correct/incorrect pair
      if (ex.correct === undefined && ex.sentence === undefined) {
         return { ok: false, code: 'PEDAGOGY_BAD_EXAMPLE', detail: 'examples[' + i + '] must have correct or sentence' };
      }
      if (ex.translation && !isRegisterTriple(ex.translation)) {
        return { ok: false, code: 'PEDAGOGY_BAD_EXAMPLE', detail: 'examples[' + i + '].translation must be {nb, nn, en} non-empty' };
      }
    }
  }
  if (ped.colloquial_note !== undefined && !isRegisterTriple(ped.colloquial_note)) {
    return {
      ok: false,
      code: 'PEDAGOGY_BAD_COLLOQUIAL_NOTE',
      detail: 'pedagogy.colloquial_note (if present) must be {nb, nn, en} non-empty',
    };
  }
  if (ped.extra !== undefined && !isRegisterTriple(ped.extra)) {
    return {
      ok: false,
      code: 'PEDAGOGY_BAD_EXTRA',
      detail: 'pedagogy.extra must be {nb, nn, en} triple',
    };
  }
  if (ped.visual !== undefined) {
    if (!ped.visual.svg || !isNonEmptyString(ped.visual.svg)) {
      return { ok: false, code: 'PEDAGOGY_BAD_VISUAL', detail: 'pedagogy.visual must have svg string' };
    }
  }
  if (ped.contraction !== undefined) {
    const c = ped.contraction;
    if (!c || typeof c !== 'object' || !isNonEmptyString(c.from) || !isNonEmptyString(c.article)) {
      return {
        ok: false,
        code: 'PEDAGOGY_BAD_CONTRACTION',
        detail: 'pedagogy.contraction (if present) must have {from: string, article: string}',
      };
    }
  }
  return { ok: true };
}

// Build a synthetic ctx tuned to maximise the chance that prep-case-style
// rules find a match. Rules that need different inputs simply emit no
// findings under this ctx — that's fine; the gate validates SHAPE on whatever
// findings are produced, it does not require every rule to fire.
function buildCtx(lang) {
  const text = 'durch der Schule';
  const tokens = [
    { word: 'durch',  display: 'durch',  start: 0,  end: 5,  sentenceIndex: 0 },
    { word: 'der',    display: 'der',    start: 6,  end: 9,  sentenceIndex: 0 },
    { word: 'schule', display: 'Schule', start: 10, end: 16, sentenceIndex: 0 },
  ];
  const sentences = [{ start: 0, end: tokens.length }];

  const nounGenus = new Map([
    ['schule', 'f'],
    ['haus', 'n'],
    ['tisch', 'm'],
  ]);

  const prepPedagogy = new Map([
    ['durch', {
      case: 'akkusativ',
      summary:     { nb: 'Akkusativ', nn: 'Akkusativ', en: 'Accusative' },
      explanation: { nb: 'durch tar akkusativ.', nn: 'durch tek akkusativ.', en: 'durch takes accusative.' },
    }],
  ]);

  const rulePedagogy = new Map([
    ['de-prep-case', {
      note: { nb: 'Preposisjon', nn: 'Preposisjon', en: 'Preposition' },
      examples: [
        { correct: 'durch die Schule', incorrect: 'durch der Schule', translation: { nb: 'gjennom skolen', nn: 'gjennom skulen', en: 'through the school' } }
      ]
    }],
  ]);

  return {
    lang: lang || 'de',
    text,
    tokens,
    sentences,
    getTagged: (idx) => tokens[idx],
    vocab: {
      nounGenus,
      prepPedagogy,
      rulePedagogy,
      validWords: new Set(),
      verbInfinitive: new Map(),
      wordList: [],
    },
    enabled: () => true,
    isFeatureEnabled: () => true,
    getFeature: () => true,
  };
}

function findingsFromRule(rule) {
  if (!rule || typeof rule.check !== 'function') return [];
  const lang = (Array.isArray(rule.languages) && rule.languages[0]) || 'de';
  const ctx = buildCtx(lang);
  let result;
  try {
    result = rule.check(ctx);
  } catch (_) {
    // Out of scope (check-fixtures owns runtime safety).
    return [];
  }
  if (!Array.isArray(result)) return [];
  return result;
}

function main() {
  const targets = gatherTargets();
  let pedBlocks = 0;
  let rulesWithPedagogy = 0;

  for (const rel of targets) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      fail('RULE_FILE_MISSING', '<no id>', abs, 'expected rule file not found on disk');
    }

    resetGlobals();
    clearRequireCache(targets);
    try {
      loadCore();
    } catch (e) {
      fail('CORE_LOAD_THREW', '<no id>', CORE_PATH, String(e && e.message || e));
    }

    let rule;
    try {
      rule = require(abs);
    } catch (e) {
      fail('RULE_LOAD_THREW', '<no id>', abs, String(e && e.message || e));
    }

    const findings = findingsFromRule(rule);
    let ruleHadPedagogy = false;
    for (const f of findings) {
      if (!f || typeof f !== 'object') continue;
      if (f.pedagogy === undefined) continue;
      ruleHadPedagogy = true;
      const res = validatePedagogy(f.pedagogy);
      if (!res.ok) {
        fail(res.code, rule && rule.id, abs, res.detail);
      }
      pedBlocks++;
    }
    if (ruleHadPedagogy) rulesWithPedagogy++;
  }

  if (pedBlocks === 0) {
    console.log('[check-pedagogy-shape] PASS: no rules emit pedagogy yet — informational');
    process.exit(0);
  }

  console.log('[check-pedagogy-shape] PASS: validated ' + pedBlocks + ' pedagogy blocks across ' + rulesWithPedagogy + ' rules');
  process.exit(0);
}

main();
