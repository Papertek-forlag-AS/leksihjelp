#!/usr/bin/env node
/**
 * Leksihjelp — Pedagogy ID Coverage Release Gate
 *
 * Cross-checks rule_ids (authored in extension/content/spell-rules/*.js)
 * against pedagogy entry ids (authored in papertek-vocabulary, synced into
 * extension/data/<lang>.json under grammarbank.pedagogy.<id>).
 *
 * Why this gate exists
 * --------------------
 * After Phase 39 the spell-check-core engine auto-attaches pedagogy by
 * `finding.rule_id`, so authoring a "Lær mer" lesson in papertek-vocabulary
 * is now zero-touch on the leksihjelp side — for an *existing* rule whose
 * id matches the pedagogy key. The class of mistake this gate catches:
 *
 *   - Typo in a pedagogy id (`de-v3` instead of `de-v2`) → silent miss in
 *     the popover; no other gate notices.
 *   - Rename of a rule_id without updating pedagogy keys → silent miss.
 *   - Pedagogy authored for a rule that no longer exists → dead data.
 *
 * Behavior
 * --------
 * Loads every spell-rule, collects rule.id values. Reads every
 * extension/data/<lang>.json, collects grammarbank.pedagogy.<id> keys
 * (excluding the `type`/`word` metadata stubs added by the sync layer).
 *
 *   - Pedagogy ids with no matching rule.id AND not in ALLOWLIST → FAIL.
 *   - Rule ids with no pedagogy → informational only (not all rules need
 *     pedagogy; many use inline `rule.pedagogy` literals or none at all).
 *
 * ALLOWLIST contains intentional non-rule_id pedagogy keys (e.g.
 * `gustar_class`, which is keyed by the Spanish verb-class concept rather
 * than the rule_id `es-gustar`). Add to this list with care — every entry
 * is a place where the engine's auto-attach won't help.
 *
 * Usage: node scripts/check-pedagogy-id-coverage.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RULES_DIR = path.join(ROOT, 'extension/content/spell-rules');
const DATA_DIR = path.join(ROOT, 'extension/data');

// Pedagogy ids that are deliberately not rule_ids. Each entry is a piece
// of debt: the engine's auto-attach-by-rule_id can't reach these, so the
// consuming rule has to look them up explicitly. Keep this list small.
const ALLOWLIST = new Set([
  'gustar_class', // es-gustar looks up by verb-class concept, not rule_id
]);

// Sync-layer metadata stubs that appear inside grammarbank.pedagogy but
// aren't real entries — skip them.
const META_KEYS = new Set(['type', 'word']);

function loadHostStubs() {
  const host = {
    __lexiSpellRules: [],
    __lexiSpellCore: { runConjugationCheck: () => null },
  };
  global.self = host;
  global.__lexiSpellRules = host.__lexiSpellRules;
  return host;
}

function collectRuleIds() {
  const host = loadHostStubs();
  const ids = new Set();
  for (const file of fs.readdirSync(RULES_DIR)) {
    if (!file.endsWith('.js') || file.endsWith('.test.js')) continue;
    if (file === 'README.md') continue;
    const full = path.join(RULES_DIR, file);
    host.__lexiSpellRules.length = 0;
    try {
      delete require.cache[require.resolve(full)];
      require(full);
    } catch (_) {
      // Rule files self-register on load; if they throw without a host
      // adapter, we still want any ids they pushed before the throw.
    }
    for (const r of host.__lexiSpellRules) {
      if (r && typeof r.id === 'string') ids.add(r.id);
    }
  }
  return ids;
}

function collectPedagogyIds() {
  const out = new Map(); // id → [lang, ...]
  for (const file of fs.readdirSync(DATA_DIR)) {
    if (!file.endsWith('.json')) continue;
    const lang = file.replace(/\.json$/, '');
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    } catch (_) {
      continue;
    }
    const ped = data && data.grammarbank && data.grammarbank.pedagogy;
    if (!ped || typeof ped !== 'object') continue;
    for (const id of Object.keys(ped)) {
      if (META_KEYS.has(id)) continue;
      if (!out.has(id)) out.set(id, []);
      out.get(id).push(lang);
    }
  }
  return out;
}

function main() {
  const ruleIds = collectRuleIds();
  const pedagogyIds = collectPedagogyIds();

  const orphans = [];
  for (const [id, langs] of pedagogyIds) {
    if (ruleIds.has(id)) continue;
    if (ALLOWLIST.has(id)) continue;
    orphans.push({ id, langs });
  }

  if (orphans.length > 0) {
    console.error('[check-pedagogy-id-coverage] FAIL: pedagogy ids do not match any rule_id and are not in ALLOWLIST:');
    for (const { id, langs } of orphans) {
      console.error('  - ' + id + '  (in: ' + langs.join(', ') + ')');
    }
    console.error('');
    console.error('Fix one of:');
    console.error('  1. Rename the pedagogy entry in papertek-vocabulary so it matches an existing rule.id, then re-sync.');
    console.error('  2. Add a rule with id matching the pedagogy entry (extension/content/spell-rules/<id>.js).');
    console.error('  3. If the id is intentional cross-key (rare), add it to ALLOWLIST in this script and document why.');
    process.exit(1);
  }

  // Informational coverage stats — never fails on these.
  const rulesWithPedagogy = [...ruleIds].filter(id => pedagogyIds.has(id));
  const rulesWithoutPedagogy = [...ruleIds].filter(id => !pedagogyIds.has(id));
  console.log('[check-pedagogy-id-coverage] PASS — '
    + pedagogyIds.size + ' pedagogy id(s), all match a rule.id or ALLOWLIST.');
  console.log('  rules with central pedagogy: ' + rulesWithPedagogy.length);
  console.log('  rules without (use inline rule.pedagogy or none): ' + rulesWithoutPedagogy.length);
}

main();
