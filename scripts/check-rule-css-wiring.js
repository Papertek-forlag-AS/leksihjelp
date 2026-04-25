#!/usr/bin/env node
/**
 * Leksihjelp — Rule-CSS Wiring Release Gate (Phase 05.1 Gap D follow-up)
 *
 * For every popover-surfacing spell-check rule, assert that
 * `extension/styles/content.css` contains a matching
 * `#lexi-spell-overlay .lh-spell-<rule.id> { background: ...; }` rule.
 *
 * Why this gate exists:
 *   Phase 05.1-05 shipped the `dialect-mix` rule without a matching CSS
 *   underline colour. The 3px `.lh-spell-dot` element painted transparent
 *   because no `.lh-spell-dialect-mix` selector existed, so the marker was
 *   invisible in the browser despite the rule firing correctly and
 *   producing well-formed findings. All other release gates passed —
 *   including check-fixtures, check-explain-contract, check-network-silence.
 *   Users clicked Chrome's native red squiggle, not our marker, and
 *   concluded the rule was silent.
 *
 *   This gate catches that class of regression: a new popover-surfacing
 *   rule whose id has no matching dot-colour CSS wiring.
 *
 * Contract:
 *   For each rule file in TARGETS (sourced verbatim from
 *   check-explain-contract.js — MUST stay in sync):
 *     1. Require the rule file, extract `rule.id`.
 *     2. Read extension/styles/content.css as text.
 *     3. Assert regex match for
 *          \.lh-spell-<ruleId>\s*{[^}]*background
 *        (any colour, just require the key exists).
 *
 * Exit 0 on all-pass; exit 1 on any missing wiring with a file:line pointer
 * and a fix suggestion mirroring the existing palette entries.
 *
 * Usage:
 *   node scripts/check-rule-css-wiring.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-explain-contract.js
 * style (same require-rule harness, same reset-globals isolation, same
 * fail() shape).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const CORE_PATH = path.join(ROOT, 'extension/content/spell-check-core.js');
const CSS_PATH = path.join(ROOT, 'extension/styles/content.css');

// The popover-surfacing rule files. MUST stay in sync with
// check-explain-contract.js TARGETS. If you add a new rule that surfaces to
// the popover, add it to both gates.
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
  'extension/content/spell-rules/nb-modal-verb.js',
  'extension/content/spell-rules/nb-sarskriving.js',
  'extension/content/spell-rules/universal-agreement.js',
  'extension/content/spell-rules/nb-dialect-mix.js',
  'extension/content/spell-rules/nb-typo-curated.js',
  'extension/content/spell-rules/nb-typo-fuzzy.js',
  'extension/content/spell-rules/nb-homophones.js',
  'extension/content/spell-rules/universal-context-typo.js',
  'extension/content/spell-rules/register.js',
  'extension/content/spell-rules/collocation.js',
  'extension/content/spell-rules/redundancy.js',
  'extension/content/spell-rules/es-ser-estar.js',
  'extension/content/spell-rules/es-por-para.js',
  'extension/content/spell-rules/de-prep-case.js',
  'extension/content/spell-rules/de-separable-verb.js',
  'extension/content/spell-rules/de-v2.js',
  'extension/content/spell-rules/de-verb-final.js',
  'extension/content/spell-rules/fr-bags.js',
  'extension/content/spell-rules/nb-v2.js',
  'extension/content/spell-rules/quotation-suppression.js',
  'extension/content/spell-rules/de-perfekt-aux.js',
  'extension/content/spell-rules/de-compound-gender.js',
];

function resetGlobals() {
  if (typeof global.self === 'undefined') global.self = global;
  global.self.__lexiSpellRules = [];
  delete global.self.__lexiSpellCore;
}

function clearRequireCache() {
  const corePath = require.resolve(CORE_PATH);
  if (require.cache[corePath]) delete require.cache[corePath];
  for (const rel of TARGETS) {
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
    '[check-rule-css-wiring] FAIL: ' + code + ' ' +
    (ruleId || '<no id>') + ' ' +
    path.relative(ROOT, file) + ' :: ' + detail + '\n'
  );
  process.exit(1);
}

// Returns the 1-based line number of the first match of `pattern` in `src`,
// or -1 if no match. Used to produce a helpful file:line pointer in the CSS
// file on failure (pointing at the block where the palette lives).
function findLineOfPattern(src, pattern) {
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1;
  }
  return -1;
}

function cssHasBindingForId(cssSrc, ruleId) {
  // Escape any regex metacharacters in the rule id (e.g. 'dialect-mix' has
  // a '-' which is fine, but be defensive for future ids like 'å/og' or
  // 'modal.form'). The id is interpolated into a regex source string.
  const escaped = ruleId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the selector (anywhere in the file — we don't require
  // `#lexi-spell-overlay` scoping because someone could later add an
  // unscoped fallback) followed by an opening brace and a `background`
  // property inside the block. Use a lookahead [^}]*background so we only
  // match when the binding actually sets a colour, not just declares the
  // selector.
  const re = new RegExp('\\.lh-spell-' + escaped + '\\s*\\{[^}]*background');
  return re.test(cssSrc);
}

function main() {
  if (!fs.existsSync(CSS_PATH)) {
    fail('CSS_FILE_MISSING', '<no id>', CSS_PATH, 'expected content.css not found on disk');
  }
  const cssSrc = fs.readFileSync(CSS_PATH, 'utf8');

  // Track ids we've already validated to avoid duplicate output: typo-curated
  // and typo-fuzzy both carry id='typo' and share the .lh-spell-typo binding.
  const seenIds = new Set();
  let passed = 0;

  for (const rel of TARGETS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      fail('RULE_FILE_MISSING', '<no id>', abs, 'expected rule file not found on disk');
    }

    resetGlobals();
    clearRequireCache();
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

    if (!rule || typeof rule !== 'object') {
      fail('RULE_NOT_OBJECT', '<no id>', abs, 'require() did not return a rule object');
    }
    const ruleId = rule.id;
    if (typeof ruleId !== 'string' || ruleId.length === 0) {
      fail('RULE_ID_MISSING', '<no id>', abs, 'rule.id must be a non-empty string');
    }

    if (seenIds.has(ruleId)) {
      // Already validated via another rule file (e.g. typo-curated covered
      // typo-fuzzy). Count it as a pass to keep the summary honest.
      passed++;
      continue;
    }

    if (!cssHasBindingForId(cssSrc, ruleId)) {
      // Point to the palette block — the line where sarskriving (or any
      // existing dot colour) lives — so the fix location is obvious.
      const anchorLine = findLineOfPattern(cssSrc, /\.lh-spell-sarskriving\s*\{/);
      const pointer = anchorLine > 0
        ? path.relative(ROOT, CSS_PATH) + ':' + anchorLine
        : path.relative(ROOT, CSS_PATH);
      fail(
        'MISSING_CSS_BINDING',
        ruleId,
        CSS_PATH,
        pointer + ' — missing CSS binding for rule \'' + ruleId + '\' — add ' +
        '`#lexi-spell-overlay .lh-spell-' + ruleId + ' { background: <color>; }` ' +
        'to content.css (next to the existing dot-colour palette)'
      );
    }

    seenIds.add(ruleId);
    passed++;
  }

  console.log(
    '[check-rule-css-wiring] PASS: ' + passed + '/' + TARGETS.length +
    ' popover-surfacing rules have CSS wiring (' + seenIds.size + ' unique ids: ' +
    Array.from(seenIds).sort().join(', ') + ')'
  );
  process.exit(0);
}

main();
