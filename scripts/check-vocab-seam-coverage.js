#!/usr/bin/env node
/**
 * Leksihjelp — Vocab-Seam Coverage Release Gate (INFRA-10, Phase 36-02)
 *
 * Asserts that every index produced by `vocab-seam-core.buildIndexes` is
 * surfaced through:
 *   1. `extension/content/vocab-seam.js`  — a `get<PascalCase>` getter on
 *      the `self.__lexiVocab = { ... }` object.
 *   2. `extension/content/spell-check.js` — an entry on the `const vocab = {`
 *      object inside `runCheck()` (the consumer composition).
 *
 * Background:
 *   Phase 26-01, 32-01, and 32-03 each added a new index to `buildIndexes`
 *   without wiring the corresponding seam getter or spell-check.js entry.
 *   All 11 release gates stayed green because the Node fixture-runner passes
 *   the raw indexes object directly to `core.check()`, bypassing the browser
 *   seam. Browser users got empty Maps/Sets and silent rules. The seam fix
 *   shipped in v2.9.15. This gate prevents the next instance.
 *
 * Algorithm:
 *   1. Static-parse the buildIndexes return literal in vocab-seam-core.js,
 *      capturing every key (including spread-source keys via recursive
 *      lookup of the spread variable's declaration).
 *   2. Apply the EXEMPT list (diagnostic / hydrated-elsewhere keys).
 *   3. For each remaining key, derive `get<PascalCase>` and assert it
 *      appears as a property in vocab-seam.js's `self.__lexiVocab = { ... }`.
 *   4. Assert the key itself appears as a property in spell-check.js's
 *      `const vocab = { ... }` literal.
 *   5. On any violation, print per-violation diagnostic with copy-paste
 *      fix line; exit 1. On clean pass, exit 0.
 *
 * Zero npm deps. Node 18+. CommonJS. Style mirrors check-explain-contract.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE_PATH       = path.join(ROOT, 'extension/content/vocab-seam-core.js');
const SEAM_PATH       = path.join(ROOT, 'extension/content/vocab-seam.js');
const SPELLCHECK_PATH = path.join(ROOT, 'extension/content/spell-check.js');

// Indexes intentionally exempt from the seam-coverage gate. Each entry is
// either diagnostic-only, hydrated post-build, or consumed via a non-
// spell-check pathway (word-prediction, internal closure). Every key on
// this list was triaged against `grep -r "ctx.vocab.<key>"` across
// extension/content/spell-rules/ + spell-check-core.js — none of them
// surface to the spell-check ctx.vocab object today.
const EXEMPT = new Set([
  '_sourceTag',          // diagnostic only
  'pitfalls',            // hydrated post-build via setPitfalls()
  'wordList',            // word-prediction surface, not spell-check (uses validWords)
  'nounLemmaGenus',      // closure-bound inside decomposeCompoundStrict; not on ctx.vocab
  'bigrams',             // surfaced via getBigrams() to typo-fuzzy via different path
  'typoBank',            // alias of typoFix (same Map ref); spell-check uses typoFix
  'grammarTables',       // not consumed via ctx.vocab today
  'predictCompound',     // word-prediction surface, not spell-check
]);

// Indexes whose seam getter follows a non-default capitalisation convention
// (typically all-caps acronyms). Without these overrides the default
// `get<PascalCase>` derivation would produce the wrong getter name and
// raise a false-positive violation.
const GETTER_OVERRIDES = {
  nnInfinitiveClasses: 'getNNInfinitiveClasses',
};

// The plan's <how-to-verify> contract: produce per-violation diagnostics
// that include both file paths and the exact copy-paste fix line, so a
// human running the gate after a regression can patch in <30 seconds.

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// Find the buildIndexes return-object literal in vocab-seam-core.js source.
// The literal is the LAST `return {` inside the buildIndexes function and
// closes with `};` followed by a newline at the function's tail (`  }\n\n`).
//
// Strategy: locate the buildIndexes function body, then within it find the
// `return {` token and walk braces to capture the matching `}`.
function extractBuildIndexesReturn(source) {
  const fnIdx = source.indexOf('function buildIndexes');
  if (fnIdx < 0) {
    // Variant: const buildIndexes = (raw, lang) => { ... }
    // Not used today, but be defensive.
    const arrowIdx = source.indexOf('buildIndexes =');
    if (arrowIdx < 0) {
      throw new Error('check-vocab-seam-coverage: could not locate buildIndexes definition in vocab-seam-core.js');
    }
  }
  // Find `return {` after the function start.
  // Multiple `return {` may exist for early-returns (`return { ...someEmpty }`)
  // — we want the LAST one before the function closes. Use the simpler
  // heuristic: scan all `return {` positions, take the last one that
  // successfully balances to a `};`.
  const returnRe = /return\s*\{/g;
  const candidates = [];
  let m;
  while ((m = returnRe.exec(source)) !== null) {
    candidates.push({ idx: m.index, openIdx: m.index + m[0].length - 1 });
  }
  if (!candidates.length) {
    throw new Error('check-vocab-seam-coverage: no `return {` found in vocab-seam-core.js');
  }
  // Walk from the LAST candidate first.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    const slice = walkObjectLiteral(source, c.openIdx);
    if (slice) {
      return { body: slice, startIdx: c.idx };
    }
  }
  throw new Error('check-vocab-seam-coverage: could not balance any `return {` literal');
}

// Given source and an index pointing at an opening `{`, walk the source and
// return the substring from `{` to the matching `}` inclusive. Skips over
// strings, template literals, and line/block comments. Returns null on
// malformed input.
function walkObjectLiteral(source, openIdx) {
  if (source[openIdx] !== '{') return null;
  let depth = 0;
  let i = openIdx;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    // Comment: line
    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i);
      if (nl < 0) return null;
      i = nl + 1;
      continue;
    }
    // Comment: block
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) return null;
      i = end + 2;
      continue;
    }
    // String literals
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(source, i, ch);
      if (end < 0) return null;
      i = end + 1;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.substring(openIdx, i + 1);
      }
    }
    i++;
  }
  return null;
}

function findStringEnd(source, start, quote) {
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') { i += 2; continue; }
    if (quote === '`' && ch === '$' && source[i + 1] === '{') {
      // Skip ${...} interpolation
      const end = walkObjectLiteral(source, i + 1);
      if (end == null) return -1;
      i += end.length + 1;
      continue;
    }
    if (ch === quote) return i;
    i++;
  }
  return -1;
}

// Parse the keys (including spread sources) from an object-literal source body
// like `{ a, b: x, ...spread, c }`. Returns array of { key, isSpread, spreadVar }.
function parseObjectLiteralKeys(body) {
  // Strip outer braces.
  if (body[0] !== '{' || body[body.length - 1] !== '}') {
    throw new Error('check-vocab-seam-coverage: parseObjectLiteralKeys expects {…} input');
  }
  const inner = body.substring(1, body.length - 1);
  // Tokenize at top-level commas (depth-0 only) — skip strings/comments/nested braces/parens/brackets.
  const segments = splitTopLevelCommas(inner);
  const out = [];
  for (const segRaw of segments) {
    const seg = segRaw.trim();
    if (!seg) continue;
    // Strip leading line comments inside segment (already handled by splitter,
    // but defensive in case // appears at start).
    const segNoComment = stripLeadingComments(seg);
    if (!segNoComment) continue;

    // Spread: `...identifier` or `...expr` (we only support the identifier form;
    // other forms throw because the gate's recursion needs a name to resolve).
    if (segNoComment.startsWith('...')) {
      const rest = segNoComment.substring(3).trim();
      const idMatch = rest.match(/^([A-Za-z_$][\w$]*)/);
      if (!idMatch) {
        throw new Error('check-vocab-seam-coverage: spread expression too complex: ' + segNoComment.slice(0, 80));
      }
      out.push({ key: null, isSpread: true, spreadVar: idMatch[1] });
      continue;
    }

    // `key: value`, shorthand `key`, or method-shorthand `key(args) { … }`.
    // Take the leading identifier (allow it to be quoted, though not seen in core today).
    const idMatch = segNoComment.match(/^([A-Za-z_$][\w$]*)\s*(:|\(|$|,)/);
    if (idMatch) {
      out.push({ key: idMatch[1], isSpread: false });
      continue;
    }
    // Quoted key form (e.g. `'foo': bar`). Not used in core today, but be defensive.
    const qMatch = segNoComment.match(/^['"]([^'"]+)['"]\s*:/);
    if (qMatch) {
      out.push({ key: qMatch[1], isSpread: false });
      continue;
    }
    throw new Error('check-vocab-seam-coverage: could not parse segment: ' + segNoComment.slice(0, 80));
  }
  return out;
}

function stripLeadingComments(seg) {
  let s = seg;
  // Repeatedly strip leading // line and /* */ block comments + whitespace.
  let changed = true;
  while (changed) {
    changed = false;
    s = s.replace(/^\s+/, '');
    if (s.startsWith('//')) {
      const nl = s.indexOf('\n');
      if (nl < 0) return '';
      s = s.substring(nl + 1);
      changed = true;
    } else if (s.startsWith('/*')) {
      const end = s.indexOf('*/');
      if (end < 0) return '';
      s = s.substring(end + 2);
      changed = true;
    }
  }
  return s;
}

function splitTopLevelCommas(inner) {
  const segments = [];
  let buf = '';
  let depth = 0;
  let i = 0;
  while (i < inner.length) {
    const ch = inner[i];
    const next = inner[i + 1];

    // Line comment
    if (ch === '/' && next === '/') {
      // include up to and through newline (we'll strip later)
      const nl = inner.indexOf('\n', i);
      if (nl < 0) { buf += inner.substring(i); break; }
      buf += inner.substring(i, nl + 1);
      i = nl + 1;
      continue;
    }
    // Block comment
    if (ch === '/' && next === '*') {
      const end = inner.indexOf('*/', i + 2);
      if (end < 0) { buf += inner.substring(i); break; }
      buf += inner.substring(i, end + 2);
      i = end + 2;
      continue;
    }
    // String
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = findStringEnd(inner, i, ch);
      if (end < 0) { buf += inner.substring(i); break; }
      buf += inner.substring(i, end + 1);
      i = end + 1;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;

    if (ch === ',' && depth === 0) {
      segments.push(buf);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim().length) segments.push(buf);
  return segments;
}

// Find a `const NAME = { … };` literal in source. Returns the object body
// (`{...}`) substring, or null if not found / not balanced.
function findConstObjectLiteral(source, name) {
  const re = new RegExp('\\bconst\\s+' + name + '\\s*=\\s*\\{');
  const m = source.match(re);
  if (!m) return null;
  const openIdx = source.indexOf('{', m.index);
  if (openIdx < 0) return null;
  return walkObjectLiteral(source, openIdx);
}

// Find a `return { … };` literal inside a function declaration `name`. Used
// for resolving spread variables that are themselves the result of a builder
// function (e.g. `const moodIndexes = buildMoodIndexes(...)` → recurse into
// buildMoodIndexes' return object).
function findFunctionReturnLiteral(source, fnName) {
  const re = new RegExp('\\bfunction\\s+' + fnName + '\\s*\\(');
  const m = source.match(re);
  if (!m) return null;
  // Find the function body opening brace.
  const parenStart = source.indexOf('(', m.index);
  if (parenStart < 0) return null;
  // Find matching ) — naive scan since args are simple.
  let depth = 0, i = parenStart;
  for (; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  // Skip whitespace, expect `{` (function body)
  while (i < source.length && /\s/.test(source[i])) i++;
  if (source[i] !== '{') return null;
  const body = walkObjectLiteral(source, i);
  if (!body) return null;
  // Now find LAST `return { … }` inside body.
  const returnRe = /return\s*\{/g;
  let lastMatch = null;
  let mm;
  while ((mm = returnRe.exec(body)) !== null) {
    lastMatch = mm;
  }
  if (!lastMatch) return null;
  const objOpen = lastMatch.index + lastMatch[0].length - 1;
  return walkObjectLiteral(body, objOpen);
}

function resolveSpreadKeys(source, spreadVar) {
  // Try `const spreadVar = { … }` first.
  const constLit = findConstObjectLiteral(source, spreadVar);
  if (constLit) {
    return parseObjectLiteralKeys(constLit).filter(e => !e.isSpread).map(e => e.key);
  }
  // Try `const spreadVar = funcName(...)` then recurse into that function's
  // last return literal.
  const reAssign = new RegExp('\\bconst\\s+' + spreadVar + '\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\(');
  const m = source.match(reAssign);
  if (m) {
    const fnName = m[1];
    const fnLit = findFunctionReturnLiteral(source, fnName);
    if (fnLit) {
      // Recurse: that function's return may itself spread further.
      return collectAllKeys(source, fnLit);
    }
  }
  throw new Error('check-vocab-seam-coverage: could not resolve spread source `' + spreadVar + '` in vocab-seam-core.js');
}

function collectAllKeys(source, objLiteralBody) {
  const entries = parseObjectLiteralKeys(objLiteralBody);
  const keys = [];
  for (const e of entries) {
    if (e.isSpread) {
      const sub = resolveSpreadKeys(source, e.spreadVar);
      for (const k of sub) keys.push(k);
    } else {
      keys.push(e.key);
    }
  }
  return keys;
}

function toGetter(key) {
  if (Object.prototype.hasOwnProperty.call(GETTER_OVERRIDES, key)) {
    return GETTER_OVERRIDES[key];
  }
  return 'get' + key[0].toUpperCase() + key.slice(1);
}

function fail(violations) {
  process.stderr.write('[check-vocab-seam-coverage] FAIL\n');
  for (const v of violations) {
    process.stderr.write(v + '\n');
  }
  process.exit(1);
}

function main() {
  const coreSrc = readFile(CORE_PATH);
  const seamSrc = readFile(SEAM_PATH);
  const consumerSrc = readFile(SPELLCHECK_PATH);

  // 1. Extract buildIndexes return literal + collect all keys.
  const { body: returnBody } = extractBuildIndexesReturn(coreSrc);
  const allKeys = collectAllKeys(coreSrc, returnBody);

  // 2. Apply exempt list + dedupe (defensive — should not have duplicates).
  const seen = new Set();
  const canonical = [];
  for (const k of allKeys) {
    if (!k) continue;
    if (EXEMPT.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    canonical.push(k);
  }

  if (canonical.length === 0) {
    process.stderr.write('[check-vocab-seam-coverage] FAIL: no canonical keys extracted from buildIndexes return literal — parser drift?\n');
    process.exit(1);
  }

  // 3. Locate seam's __lexiVocab object literal.
  // Pattern: `self.__lexiVocab = { … };`
  const seamObjMatch = seamSrc.match(/self\.__lexiVocab\s*=\s*\{/);
  if (!seamObjMatch) {
    process.stderr.write('[check-vocab-seam-coverage] FAIL: could not locate `self.__lexiVocab = {` in vocab-seam.js\n');
    process.exit(1);
  }
  const seamObjOpen = seamSrc.indexOf('{', seamObjMatch.index);
  const seamObjBody = walkObjectLiteral(seamSrc, seamObjOpen);
  if (!seamObjBody) {
    process.stderr.write('[check-vocab-seam-coverage] FAIL: could not balance `self.__lexiVocab = {…}` literal\n');
    process.exit(1);
  }
  const seamEntries = parseObjectLiteralKeys(seamObjBody);
  const seamGetterNames = new Set(seamEntries.filter(e => !e.isSpread).map(e => e.key));

  // 4. Locate spell-check.js consumer literal: `const vocab = {` inside runCheck().
  // The first occurrence is the right one (Phase 27 introduced an exam-filter
  // block AFTER it, but no second `const vocab =` literal).
  const consumerMatch = consumerSrc.match(/const\s+vocab\s*=\s*\{/);
  if (!consumerMatch) {
    process.stderr.write('[check-vocab-seam-coverage] FAIL: could not locate `const vocab = {` in spell-check.js\n');
    process.exit(1);
  }
  const consumerObjOpen = consumerSrc.indexOf('{', consumerMatch.index);
  const consumerObjBody = walkObjectLiteral(consumerSrc, consumerObjOpen);
  if (!consumerObjBody) {
    process.stderr.write('[check-vocab-seam-coverage] FAIL: could not balance `const vocab = {…}` literal\n');
    process.exit(1);
  }
  const consumerEntries = parseObjectLiteralKeys(consumerObjBody);
  const consumerKeyNames = new Set(consumerEntries.filter(e => !e.isSpread).map(e => e.key));

  // 5. Per-key validation.
  const violations = [];
  for (const key of canonical) {
    const getter = toGetter(key);
    if (!seamGetterNames.has(getter)) {
      violations.push(
        '  FAIL extension/content/vocab-seam.js: missing getter for index `' + key + '`\n' +
        '    Add this line near the existing getters:\n' +
        '      ' + getter + ': () => (state && state.' + key + ') ? state.' + key + ' : new Map(),'
      );
    }
    if (!consumerKeyNames.has(key)) {
      violations.push(
        '  FAIL extension/content/spell-check.js: missing entry for index `' + key + '`\n' +
        '    Add this line inside the `const vocab = { … }` literal:\n' +
        '      ' + key + ': VOCAB.' + getter + '(),'
      );
    }
  }

  if (violations.length) {
    fail(violations);
  }

  // POPULATION PROBE — defends against wired-but-empty regressions.
  // Each tuple is a canary: a known sample key that buildIndexes MUST
  // populate from the corresponding bundled raw data. Add a tuple when
  // shipping a new lang-specific index or fixing a population-path bug.
  const POPULATION_CANARIES = [
    // Phase 32-01 / Phase 36-03 (F36-1):
    { lang: 'fr', dataPath: 'extension/data/fr.json', indexKey: 'frImparfaitToVerb', sampleKey: 'mangeait', shape: 'map' },
    { lang: 'fr', dataPath: 'extension/data/fr.json', indexKey: 'frPasseComposeParticiples', sampleKey: 'mangé', shape: 'map' },
    { lang: 'fr', dataPath: 'extension/data/fr.json', indexKey: 'frAuxPresensForms', sampleKey: 'ai', shape: 'set' },
  ];

  // Make the seam-core's host bindings (`self` / `globalThis`) safe to require
  // from a Node CLI: the file unconditionally writes `self.__lexiVocabCore`
  // at the end of its IIFE, so we have to satisfy the `self` reference.
  if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
  const seamCore = require(CORE_PATH);
  let canariesChecked = 0;
  for (const c of POPULATION_CANARIES) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(ROOT, c.dataPath), 'utf8')); }
    catch (e) {
      // Bundled data file missing (post-Phase-23 NB baseline, etc.) — skip
      // canary, log informational.
      process.stdout.write('[check-vocab-seam-coverage] SKIP canary ' + c.lang + '.' + c.indexKey + ' (data file missing: ' + c.dataPath + ')\n');
      continue;
    }
    const built = seamCore.buildIndexes({ raw, lang: c.lang, isFeatureEnabled: () => true });
    const idx = built[c.indexKey];
    const has = idx && typeof idx.has === 'function' && idx.has(c.sampleKey);
    if (!has) {
      process.stderr.write('[check-vocab-seam-coverage] FAIL population canary: `' + c.lang + '.' + c.indexKey + '` is wired through the seam but does NOT contain `' + c.sampleKey + '` after buildIndexes.\n');
      process.stderr.write('  This means the population path in vocab-seam-core.buildIndexes is broken or starved by feature-gating.\n');
      process.stderr.write('  See Phase 36 F36-1 gap closure for the canonical fix shape.\n');
      process.exit(1);
    }
    canariesChecked++;
  }
  process.stdout.write('[check-vocab-seam-coverage] population canaries — ' + canariesChecked + '/' + POPULATION_CANARIES.length + ' populated\n');

  process.stdout.write('[check-vocab-seam-coverage] PASS — ' + canonical.length + ' indexes, all surfaced through seam + consumer\n');
  process.exit(0);
}

main();
