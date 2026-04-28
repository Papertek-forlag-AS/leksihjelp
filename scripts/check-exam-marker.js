#!/usr/bin/env node
/**
 * Leksihjelp — Exam-Mode Marker Release Gate (Phase 27, Plan 27-02)
 *
 * Every spell-check rule under `extension/content/spell-rules/` and every
 * entry in `extension/exam-registry.js` MUST carry an exam-mode marker:
 *
 *   exam: {
 *     safe: boolean,           // required
 *     reason: string,          // required, non-empty
 *     category?: string        // optional on rules; required on registry entries
 *   }
 *
 * `category` (when present) must be in the closed set:
 *   spellcheck | grammar-lookup | dictionary | tts | prediction |
 *   pedagogy   | popup          | widget
 *
 * Per-surface markers: when a rule's `explain` is a function and additionally
 * carries `explain.exam`, that marker is validated with the same shape.
 *
 * Exits 0 when every rule + every registry entry passes. Exits 1 with a
 * per-failure diagnostic on any deviation.
 *
 * Why this gate exists: Phase 27 ships exam-mode as a school-deployment
 * feature. A new feature added without an exam marker would silently default
 * to "unclassified" — the worst possible failure mode for an exam-compliance
 * feature, since teachers couldn't trust that the extension is in fact
 * suppressing every non-exam-safe surface. This gate hard-fails by default
 * (no permissive escape hatch) per the explicit decision in CONTEXT.md.
 *
 * Self-test injection seam:
 *   Set LEXI_EXAM_MARKER_EXTRA_TARGETS to a comma-separated list of absolute
 *   .js paths. Each is loaded as an additional rule file (NOT a registry
 *   entry — the registry path stays fixed). Mirrors the pattern decided in
 *   Phase 26-02 (LEXI_PEDAGOGY_GATE_EXTRA_TARGETS).
 *
 * Usage:
 *   node scripts/check-exam-marker.js
 *
 * Zero npm deps. Node 18+. CommonJS. Mirrors check-explain-contract.js style.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SPELL_RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const REGISTRY_PATH = path.join(ROOT, 'extension/exam-registry.js');
const CORE_PATH = path.join(ROOT, 'extension/content/spell-check-core.js');

const VALID_CATEGORIES = new Set([
  'spellcheck',
  'grammar-lookup',
  'dictionary',
  'tts',
  'prediction',
  'pedagogy',
  'popup',
  'widget',
]);

// Files in spell-rules/ that are NOT rule registrants — skip them.
const SKIP_FILES = new Set(['grammar-tables.js', 'README.md']);

/**
 * Validate an exam marker shape. Returns array of human-readable error
 * strings (empty when valid).
 *
 * @param {*} marker - the value to validate (typically rule.exam)
 * @param {string} contextLabel - short label used in error messages
 * @param {object} opts - { categoryRequired: boolean }
 */
function validateMarker(marker, contextLabel, opts) {
  const errors = [];
  const categoryRequired = !!(opts && opts.categoryRequired);

  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) {
    errors.push(contextLabel + ': exam marker must be a non-null object (got ' +
      (marker === null ? 'null' : Array.isArray(marker) ? 'array' : typeof marker) + ')');
    return errors;
  }

  if (typeof marker.safe !== 'boolean') {
    errors.push(contextLabel + ': exam.safe must be boolean (got ' + typeof marker.safe + ')');
  }

  if (typeof marker.reason !== 'string') {
    errors.push(contextLabel + ': exam.reason must be string (got ' + typeof marker.reason + ')');
  } else if (marker.reason.trim().length === 0) {
    errors.push(contextLabel + ': exam.reason must be non-empty');
  }

  if (marker.category === undefined) {
    if (categoryRequired) {
      errors.push(contextLabel + ': exam.category is required (must be one of: ' +
        Array.from(VALID_CATEGORIES).join(', ') + ')');
    }
  } else {
    if (typeof marker.category !== 'string') {
      errors.push(contextLabel + ': exam.category must be string when present (got ' + typeof marker.category + ')');
    } else if (!VALID_CATEGORIES.has(marker.category)) {
      errors.push(contextLabel + ': exam.category "' + marker.category + '" is not in the closed set (' +
        Array.from(VALID_CATEGORIES).join(', ') + ')');
    }
  }

  return errors;
}

function resetGlobals() {
  if (typeof global.self === 'undefined') global.self = global;
  global.self.__lexiSpellRules = [];
  global.self.__lexiSpellCore = global.self.__lexiSpellCore || {};
  delete global.self.__lexiExamRegistry;
  delete global.self.__lexiExamRegistryVersion;
}

function clearRequireCache(absPath) {
  try {
    const resolved = require.resolve(absPath);
    if (require.cache[resolved]) delete require.cache[resolved];
  } catch (_) {
    /* not loaded yet, fine */
  }
}

function loadCore() {
  clearRequireCache(CORE_PATH);
  try {
    require(CORE_PATH);
  } catch (e) {
    // Core may have browser-only dependencies; degrade gracefully — rules
    // that need core helpers fall back to inline implementations.
  }
}

function logFail(relPath, ruleId, detail) {
  const idLabel = ruleId ? ' rule=' + ruleId : '';
  process.stderr.write('[FAIL] ' + relPath + idLabel + ' :: ' + detail + '\n');
  process.exitCode = 1;
}

function discoverRuleFiles() {
  const files = [];
  const entries = fs.readdirSync(SPELL_RULES_DIR);
  for (const entry of entries) {
    if (SKIP_FILES.has(entry)) continue;
    if (!entry.endsWith('.js')) continue;
    files.push(path.join(SPELL_RULES_DIR, entry));
  }

  // Append extra targets from env (used by self-test).
  const extra = process.env.LEXI_EXAM_MARKER_EXTRA_TARGETS;
  if (extra && extra.trim()) {
    for (const p of extra.split(',').map(s => s.trim()).filter(Boolean)) {
      files.push(p);
    }
  }

  return files;
}

function validateRuleFile(absPath) {
  const relPath = path.relative(ROOT, absPath);
  if (!fs.existsSync(absPath)) {
    logFail(relPath, null, 'rule file not found on disk');
    return 0;
  }

  resetGlobals();
  loadCore();
  clearRequireCache(absPath);

  let loaded;
  try {
    loaded = require(absPath);
  } catch (e) {
    logFail(relPath, null, 'require() threw: ' + (e && e.message || e));
    return 0;
  }

  // Rules register onto host.__lexiSpellRules during their IIFE. Some rule
  // files may push more than one rule (e.g. quotation-suppression.js).
  const registered = (global.self && global.self.__lexiSpellRules) || [];
  const rules = registered.length > 0
    ? registered
    : (loaded && typeof loaded === 'object' && loaded.id ? [loaded] : []);

  if (rules.length === 0) {
    logFail(relPath, null, 'no rule registered (host.__lexiSpellRules empty and no module.exports rule object)');
    return 0;
  }

  let validatedCount = 0;
  for (const rule of rules) {
    const ruleId = (rule && rule.id) || '<no id>';

    // Validate rule.exam (required).
    const errs = validateMarker(rule && rule.exam, 'rule.exam', { categoryRequired: false });
    if (errs.length) {
      for (const err of errs) logFail(relPath, ruleId, err);
      continue;
    }

    // Per-surface marker: rule.explain.exam (validated when present).
    if (typeof rule.explain === 'function' && rule.explain.exam !== undefined) {
      const surfaceErrs = validateMarker(rule.explain.exam, 'rule.explain.exam', { categoryRequired: false });
      if (surfaceErrs.length) {
        for (const err of surfaceErrs) logFail(relPath, ruleId, err);
        continue;
      }
    }

    validatedCount++;
  }

  return validatedCount;
}

function validateRegistry() {
  const relPath = path.relative(ROOT, REGISTRY_PATH);
  if (!fs.existsSync(REGISTRY_PATH)) {
    logFail(relPath, null, 'exam-registry.js not found on disk');
    return 0;
  }

  // Reset and require.
  if (typeof global.self === 'undefined') global.self = global;
  delete global.self.__lexiExamRegistry;
  delete global.self.__lexiExamRegistryVersion;
  clearRequireCache(REGISTRY_PATH);

  try {
    require(REGISTRY_PATH);
  } catch (e) {
    logFail(relPath, null, 'require() threw: ' + (e && e.message || e));
    return 0;
  }

  const registry = global.self && global.self.__lexiExamRegistry;
  if (!Array.isArray(registry)) {
    logFail(relPath, null, 'host.__lexiExamRegistry is not an array (got ' + typeof registry + ')');
    return 0;
  }
  if (registry.length === 0) {
    logFail(relPath, null, 'host.__lexiExamRegistry is empty');
    return 0;
  }

  let count = 0;
  for (const entry of registry) {
    if (!entry || typeof entry !== 'object') {
      logFail(relPath, null, 'registry entry is not an object');
      continue;
    }
    const id = entry.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      logFail(relPath, '<no id>', 'registry entry id must be a non-empty string');
      continue;
    }
    // Registry is the strict surface: category is REQUIRED.
    const errs = validateMarker(entry.exam, 'registry[' + id + '].exam', { categoryRequired: true });
    if (errs.length) {
      for (const err of errs) logFail(relPath, id, err);
      continue;
    }
    count++;
  }

  return count;
}

function main() {
  const ruleFiles = discoverRuleFiles();
  let ruleCount = 0;
  for (const absPath of ruleFiles) {
    ruleCount += validateRuleFile(absPath);
  }

  const registryCount = validateRegistry();

  if (process.exitCode) {
    console.error('\n[check-exam-marker] FAILED — fix the markers above. See .planning/phases/27-exam-mode/27-CONTEXT.md decisions section for the marker shape.');
    process.exit(1);
  }

  console.log('[OK] check-exam-marker — ' + ruleCount + ' rules + ' + registryCount + ' registry entries validated');
  process.exit(0);
}

main();
