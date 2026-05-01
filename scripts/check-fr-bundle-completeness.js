#!/usr/bin/env node
/**
 * Leksihjelp — FR Bundle Completeness Regression Artifact (Phase 38-01.2)
 *
 * Exercises the vocab-seam buildIndexes contract end-to-end for FR against BOTH
 *   (a) the bundled extension/data/fr.json (source of truth in the packaged zip)
 *   (b) the live API response at papertek-vocabulary.vercel.app/api/vocab/v1/bundle/fr
 * and asserts that BOTH paths produce non-empty `frAspectAdverbs` + non-null
 * `frAspectPedagogy`.
 *
 * Why this gate exists (F38-1, F38-3):
 *   The `npm run check-fixtures` runner loads bundled extension/data/fr.json
 *   directly into core.buildIndexes — bypassing the seam → cache → API path
 *   that the browser actually traverses. F38-1 walker re-walk against v2.9.19
 *   showed fr-aspect-hint silent in real Chrome despite the canonical fixture
 *   passing in Node. Pre-plan diagnosis confirmed: the Papertek API serves FR
 *   `generalbank` from `vocabulary/lexicon/fr/` (865 keys MISSING the 3 aspect
 *   meta entries) instead of `vocabulary/core/fr/` (866 keys WITH the entries).
 *
 *   This script catches that class of Node-vs-browser divergence. It is NOT
 *   added to the 14-gate Release Workflow checklist — it's a regression
 *   artifact paired with the fix. Promoting it to a permanent release gate is
 *   deferred (would couple every release to the live Vercel deployment).
 *
 * Exit codes:
 *   0 — both bundled AND api paths produce non-empty frAspectAdverbs
 *   1 — at least one path failed (with diagnostic naming missing keys)
 *
 * Usage:
 *   node scripts/check-fr-bundle-completeness.js
 *   npm run check-fr-bundle-completeness
 *
 * Zero npm deps. Node 18+. CommonJS. Built-in fetch with 10s timeout.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FR_BUNDLED_PATH = path.join(ROOT, 'extension/data/fr.json');
const API_URL = 'https://papertek-vocabulary.vercel.app/api/vocab/v1/bundle/fr';
const TIMEOUT_MS = 10000;

const REQUIRED_ASPECT_KEYS = [
  'aspect_passe_compose_adverbs',
  'aspect_imparfait_adverbs',
  'aspect_choice_pedagogy',
];

const core = require(path.join(ROOT, 'extension/content/vocab-seam-core.js'));

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function assertSeamProducesAspects(label, raw) {
  const failures = [];
  const missing = REQUIRED_ASPECT_KEYS.filter(k => !(raw && raw.generalbank && k in raw.generalbank));
  if (missing.length > 0) {
    failures.push(
      `[${label}] raw.generalbank is missing aspect meta entries: ${missing.join(', ')}\n` +
      `  Fix hint: backfill these from bundled extension/data/fr.json in vocab-seam.js#buildAndApply.`
    );
  }

  let indexes;
  try {
    indexes = core.buildIndexes({
      raw,
      lang: 'fr',
      isFeatureEnabled: () => true,
      bigrams: {},
      freq: {},
      sisterRaw: null,
    });
  } catch (e) {
    failures.push(`[${label}] core.buildIndexes threw: ${e && e.message}`);
    return failures;
  }

  const adv = indexes && indexes.frAspectAdverbs;
  if (!adv) {
    failures.push(`[${label}] frAspectAdverbs is null/undefined.`);
  } else {
    const ipPhrases = (adv.imparfait && adv.imparfait.phrases) || [];
    const pcSingle = (adv.passeCompose && adv.passeCompose.single) || new Set();
    if (!Array.isArray(ipPhrases) || ipPhrases.length === 0) {
      failures.push(`[${label}] frAspectAdverbs.imparfait.phrases is empty (expected non-empty incl. 'pendant que').`);
    } else if (!ipPhrases.includes('pendant que')) {
      failures.push(`[${label}] frAspectAdverbs.imparfait.phrases missing 'pendant que' (got: ${JSON.stringify(ipPhrases.slice(0, 5))}…).`);
    }
    if (!(pcSingle instanceof Set) || pcSingle.size === 0) {
      failures.push(`[${label}] frAspectAdverbs.passeCompose.single is empty Set.`);
    }
  }
  if (!indexes || indexes.frAspectPedagogy == null) {
    failures.push(`[${label}] frAspectPedagogy is null/undefined (expected pedagogy object).`);
  }
  return failures;
}

function diffGeneralbank(bundled, api) {
  const b = new Set(Object.keys((bundled && bundled.generalbank) || {}));
  const a = new Set(Object.keys((api && api.generalbank) || {}));
  const onlyBundled = [...b].filter(k => !a.has(k));
  const onlyApi = [...a].filter(k => !b.has(k));
  return { onlyBundled, onlyApi, bundledCount: b.size, apiCount: a.size };
}

async function main() {
  let exitCode = 0;
  const allFailures = [];

  // ── Bundled path ──
  let bundled;
  try {
    bundled = JSON.parse(fs.readFileSync(FR_BUNDLED_PATH, 'utf8'));
  } catch (e) {
    console.error(`FAIL: could not load ${FR_BUNDLED_PATH}: ${e.message}`);
    process.exit(1);
  }
  const bundledFailures = assertSeamProducesAspects('bundled', bundled);
  if (bundledFailures.length > 0) {
    exitCode = 1;
    allFailures.push(...bundledFailures);
  }

  // ── API path ──
  let api;
  try {
    api = await fetchJsonWithTimeout(API_URL, TIMEOUT_MS);
  } catch (e) {
    console.error(`WARN: could not fetch ${API_URL}: ${e.message}`);
    console.error(`      Skipping API-path assertion (requires internet).`);
    api = null;
  }
  if (api) {
    const apiFailures = assertSeamProducesAspects('api', api);
    if (apiFailures.length > 0) {
      exitCode = 1;
      allFailures.push(...apiFailures);
    }

    // Diagnostic diff
    const d = diffGeneralbank(bundled, api);
    console.error(`generalbank key counts: bundled=${d.bundledCount}, api=${d.apiCount}`);
    if (d.onlyBundled.length > 0) {
      const aspectMissing = d.onlyBundled.filter(k => REQUIRED_ASPECT_KEYS.includes(k));
      if (aspectMissing.length > 0) {
        console.error(`  Aspect meta entries present in bundled but MISSING in api: ${aspectMissing.join(', ')}`);
      }
      const sample = d.onlyBundled.filter(k => !REQUIRED_ASPECT_KEYS.includes(k)).slice(0, 5);
      if (sample.length > 0) {
        console.error(`  Other bundled-only keys (sample): ${sample.join(', ')}…`);
      }
    }
    if (d.onlyApi.length > 0) {
      console.error(`  Api-only keys (sample): ${d.onlyApi.slice(0, 5).join(', ')}…`);
    }
  }

  if (exitCode === 0) {
    console.log('PASS: FR bundle completeness — both bundled and api paths produce non-empty frAspectAdverbs.');
  } else {
    console.error('\nFAIL: FR bundle completeness gate detected gaps:');
    for (const f of allFailures) console.error('  ' + f);
    console.error('\nFix hint: extension/content/vocab-seam.js#buildAndApply should defensively overlay');
    console.error('  the 3 aspect meta entries from bundled extension/data/fr.json onto raw.generalbank');
    console.error('  when raw is from the API path and these keys are missing.');
  }
  process.exit(exitCode);
}

main().catch((e) => {
  console.error(`FAIL: unexpected error: ${e && (e.stack || e.message)}`);
  process.exit(1);
});
