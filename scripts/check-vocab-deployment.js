#!/usr/bin/env node
/**
 * Leksihjelp - Vocab Deployment Pre-Flight (HYG-07, Phase 37-03)
 *
 * Verifies that the local sibling repo at /Users/geirforbord/Papertek/papertek-vocabulary
 * is git-clean AND in sync with origin AND that papertek-vocabulary.vercel.app/api/vocab/v1/revisions
 * advertises the SAME content-hash revisions that local HEAD would produce.
 *
 * This is a PRE-FLIGHT script for Phase 38 UAT walkthroughs (per CONTEXT decision):
 *   - It is callable via `npm run check-vocab-deployment` for ad-hoc invocation.
 *   - It is NOT inserted into the CLAUDE.md Release Workflow numbered list.
 *     Promoting this to a release gate would couple every extension release to
 *     Vercel + sibling-repo state and is explicitly deferred (see RESEARCH "Deferred Ideas").
 *
 * Vercel API response shape (verified live 2026-05-01 via curl):
 *   {
 *     "schema_version": 1,
 *     "revisions": {
 *       "nb": "YYYY-MM-DD-<hex8>",
 *       "nn": "YYYY-MM-DD-<hex8>",
 *       "de": "YYYY-MM-DD-<hex8>",
 *       "es": "YYYY-MM-DD-<hex8>",
 *       "fr": "YYYY-MM-DD-<hex8>",
 *       "en": "YYYY-MM-DD-<hex8>"
 *     }
 *   }
 *
 * Important shape note: revisions are NOT git SHAs. They are
 *   `<UTC-date>-<sha256(language + sorted bank-file bytes)[0:8]>`
 * computed at request time by `lib/_bundle.js#computeRevision` in the sibling
 * repo. The date prefix shifts on UTC-day rollover even with no content change;
 * only the hex8 suffix is content-meaningful. The script therefore compares the
 * hex8 suffix (computed locally with the same algorithm against the sibling
 * repo's working tree) against the Vercel-advertised hex8.
 *
 * If the API response shape changes (e.g. schema_version bump, revision format
 * change), update the parser AND bump the verified-shape comment above.
 *
 * Usage:
 *   node scripts/check-vocab-deployment.js
 *   npm run check-vocab-deployment
 *
 * Zero npm deps. Node 18+. CommonJS. Built-in fetch with 10s AbortController timeout (Pitfall 4).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PAPERTEK_REPO = '/Users/geirforbord/Papertek/papertek-vocabulary';
const REVISIONS_URL = 'https://papertek-vocabulary.vercel.app/api/vocab/v1/revisions';
const TIMEOUT_MS = 10000;
const SUPPORTED_LANGUAGES = ['nb', 'nn', 'de', 'es', 'fr', 'en'];

const PAPERTEK_VOCAB_API_KEY = process.env.PAPERTEK_VOCAB_API_KEY;
if (!PAPERTEK_VOCAB_API_KEY) {
  process.stderr.write('[check-vocab-deployment] FAIL: PAPERTEK_VOCAB_API_KEY env var is required.\n');
  process.stderr.write('  fix: set it in your shell or CI secret store before running. See README.\n');
  process.exit(1);
}

/**
 * Re-implementation of papertek-vocabulary/lib/_bundle.js#computeRevision.
 * Kept inline so this script stays zero-dep and CommonJS. If the upstream
 * algorithm changes, this must change in lockstep.
 */
function computeRevisionLocal(language) {
  const vocabBase = path.join(PAPERTEK_REPO, 'vocabulary');
  const candidates = [
    path.join(vocabBase, 'lexicon', language),
    path.join(vocabBase, 'banks', language),
    path.join(vocabBase, 'core', language),
  ];
  let langPath = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { langPath = c; break; }
  }
  if (!langPath) return null;

  const hash = crypto.createHash('sha256');
  hash.update(language);
  const files = fs.readdirSync(langPath).filter((f) => f.endsWith('bank.json')).sort();
  for (const f of files) {
    hash.update(f);
    hash.update(fs.readFileSync(path.join(langPath, f)));
  }
  return hash.digest('hex').substring(0, 8);
}

function extractHexSuffix(rev) {
  // Format: "YYYY-MM-DD-<hex8>" — return the hex8 (last 8 chars after final dash).
  if (typeof rev !== 'string') return null;
  const m = rev.match(/-([0-9a-f]{8})$/);
  return m ? m[1] : null;
}

function fail(msg, details) {
  process.stderr.write('[check-vocab-deployment] FAIL: ' + msg + '\n');
  if (details) process.stderr.write(details.replace(/^/gm, '  ') + '\n');
  process.exit(1);
}

async function main() {
  // 1. Sibling repo introspection: clean working tree + in-sync with origin.
  if (!fs.existsSync(PAPERTEK_REPO)) {
    fail(
      'sibling repo not found at ' + PAPERTEK_REPO,
      'fix: clone papertek-vocabulary as a sibling of leksihjelp before running this pre-flight.'
    );
  }

  let localHead;
  try {
    localHead = execSync('git rev-parse HEAD', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
  } catch (e) {
    fail('cannot read git HEAD in ' + PAPERTEK_REPO, e.message);
  }

  let dirty;
  try {
    dirty = execSync('git status --porcelain', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
  } catch (e) {
    fail('git status failed in ' + PAPERTEK_REPO, e.message);
  }
  if (dirty) {
    fail(
      'papertek-vocabulary working tree is not clean.',
      dirty + '\nfix: commit or stash changes in ' + PAPERTEK_REPO + ' before proceeding.'
    );
  }

  try {
    execSync('git fetch --quiet', { cwd: PAPERTEK_REPO });
  } catch (e) {
    fail('git fetch failed in ' + PAPERTEK_REPO, e.message + '\nfix: verify network + remote access, then retry.');
  }

  let aheadBehind;
  try {
    aheadBehind = execSync('git rev-list --left-right --count HEAD...@{upstream}', { cwd: PAPERTEK_REPO, encoding: 'utf8' }).trim();
  } catch (e) {
    fail('cannot compare HEAD with upstream in ' + PAPERTEK_REPO, e.message + '\nfix: ensure the current branch tracks an upstream.');
  }
  const [ahead, behind] = aheadBehind.split(/\s+/).map(Number);
  if (ahead || behind) {
    fail(
      'papertek-vocabulary diverged from origin (ahead=' + ahead + ', behind=' + behind + ').',
      'fix: pull/push in ' + PAPERTEK_REPO + ' to align with origin before proceeding.'
    );
  }

  // 2. Vercel API fetch (Pitfall 4: AbortController + 10s timeout, never hang).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(REVISIONS_URL, {
      signal: ctrl.signal,
      headers: { 'X-API-Key': PAPERTEK_VOCAB_API_KEY },
    });
  } catch (e) {
    clearTimeout(timer);
    fail(
      'Vercel API unreachable — verify manually before proceeding.',
      'url: ' + REVISIONS_URL + '\nerror: ' + e.message +
      '\nfix: do NOT silently bypass — confirm the deployment is alive at https://vercel.com/dashboard before running UAT.'
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    fail(
      'Vercel API returned HTTP ' + res.status + ' — verify manually before proceeding.',
      'url: ' + REVISIONS_URL +
      '\nfix: check Vercel deploy logs; do NOT silently bypass.'
    );
  }

  let body;
  try {
    body = await res.json();
  } catch (e) {
    fail('Vercel API response is not JSON', e.message);
  }

  if (!body || typeof body !== 'object' || !body.revisions || typeof body.revisions !== 'object') {
    fail(
      'Vercel API response shape unexpected — parser may need updating.',
      JSON.stringify(body, null, 2).slice(0, 400) +
      '\nfix: re-curl the endpoint and update the verified-shape comment in this script.'
    );
  }

  // 3. Compare per-language hex8 suffix of API revision against locally-computed value.
  const drift = [];
  const matched = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    const apiRev = body.revisions[lang];
    if (!apiRev) {
      drift.push({ lang, reason: 'absent from API response', api: '(missing)', local: '(n/a)' });
      continue;
    }
    const apiHex = extractHexSuffix(apiRev);
    if (!apiHex) {
      drift.push({ lang, reason: 'API revision string did not match YYYY-MM-DD-<hex8> format', api: apiRev, local: '(n/a)' });
      continue;
    }
    const localHex = computeRevisionLocal(lang);
    if (!localHex) {
      drift.push({ lang, reason: 'no local source data for language (looked under vocabulary/{lexicon,banks,core}/' + lang + ')', api: apiRev, local: '(missing)' });
      continue;
    }
    if (apiHex !== localHex) {
      drift.push({ lang, reason: 'content hash mismatch', api: apiHex, local: localHex });
    } else {
      matched.push({ lang, hex: localHex });
    }
  }

  if (drift.length > 0) {
    process.stderr.write('[check-vocab-deployment] FAIL: ' + drift.length + ' language(s) show drift between local HEAD and Vercel deployment.\n');
    process.stderr.write('  papertek-vocabulary HEAD: ' + localHead + '\n');
    for (const d of drift) {
      process.stderr.write('  ' + d.lang + ': ' + d.reason + ' (api=' + d.api + ', local=' + d.local + ')\n');
    }
    process.stderr.write('  fix: wait for the Vercel deploy to finish (https://vercel.com/dashboard) or trigger a redeploy of papertek-vocabulary.\n');
    process.stderr.write('  fix: if local is ahead of origin, push papertek-vocabulary first.\n');
    process.exit(1);
  }

  // Success path.
  console.log('[check-vocab-deployment] PASS: all ' + matched.length + ' language(s) at HEAD ' + localHead.slice(0, 8) + '.');
  for (const m of matched) {
    console.log('  ' + m.lang + ': ' + m.hex);
  }
  console.log('');
  console.log('  Side-patch reconciliation (recommended next steps):');
  console.log('    1. `npm run sync-vocab` — refresh extension/data/*.json from upstream.');
  console.log('    2. `git diff extension/data/` — empty means side-patches reconciled into upstream.');
  console.log('       Non-empty means an upstream gap; investigate per CLAUDE.md data-logic separation philosophy.');
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write('[check-vocab-deployment] FAIL: unexpected error\n  ' + (e && e.stack ? e.stack : String(e)) + '\n');
  process.exit(1);
});
