#!/usr/bin/env node
/**
 * Self-test for scripts/check-stateful-rule-invalidation.js (INFRA-10 gate).
 *
 * 1. Baseline: Run gate on current repo (no doc-drift rules exist yet) — exit 0.
 * 2. Plant a BROKEN doc-drift rule with module-level mutable state that caches
 *    findings between calls (ghost-flag bug). Assert gate fires (exit 1).
 * 3. Plant a well-formed doc-drift rule with fresh recompute. Assert gate
 *    passes (exit 0).
 *
 * Usage:
 *   node scripts/check-stateful-rule-invalidation.test.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'check-stateful-rule-invalidation.js');
const SCRATCH_RULE = path.join(ROOT, 'extension/content/spell-rules/doc-drift-de-address.js');

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  if (fs.existsSync(SCRATCH_RULE)) {
    try { fs.unlinkSync(SCRATCH_RULE); } catch (_) { /* best-effort */ }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });

// Ensure no leftover scratch from a previous aborted run
if (fs.existsSync(SCRATCH_RULE)) fs.unlinkSync(SCRATCH_RULE);

// Step 1: Baseline — no doc-drift rule files exist = exit 0
const baselineRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
if (baselineRun.status !== 0) {
  console.error('FAIL step 1: gate did not exit 0 on baseline (no doc-drift rules).');
  console.error('  exit status:', baselineRun.status);
  console.error('  stdout:', (baselineRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (baselineRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 2: Plant BROKEN rule — module-level mutable state that caches findings
// The bug: _cachedFindings is populated on the first checkDocument call and
// returned on subsequent calls WITHOUT recomputing. When the text changes to
// a non-drifting version, the stale findings persist (ghost flags).
const brokenRule = `(function () {
  'use strict';
  var host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  // BUG: module-level mutable state
  var _cachedFindings = null;

  var rule = {
    id: 'doc-drift-de-address',
    kind: 'document',
    languages: ['de'],
    priority: 201,
    severity: 'warning',
    check: function() { return []; },
    checkDocument: function(ctx) {
      // BUG: returns cached findings from previous call
      if (_cachedFindings !== null) return _cachedFindings;

      var markers = [];
      var DU_SET = new Set(['du', 'dich', 'dir', 'dein', 'deine', 'deinem', 'deinen', 'deiner']);
      var SIE_SET = new Set(['sie', 'ihnen', 'ihr', 'ihre', 'ihrem', 'ihren', 'ihrer']);
      for (var i = 0; i < ctx.tokens.length; i++) {
        var w = ctx.tokens[i].word;
        if (DU_SET.has(w)) markers.push({register:'du',tokenIndex:i,start:ctx.tokens[i].start,end:ctx.tokens[i].end,display:ctx.tokens[i].display});
        if (SIE_SET.has(w) && ctx.tokens[i].display[0] === ctx.tokens[i].display[0].toUpperCase()) markers.push({register:'Sie',tokenIndex:i,start:ctx.tokens[i].start,end:ctx.tokens[i].end,display:ctx.tokens[i].display});
      }
      var tables = host.__lexiGrammarTables || {};
      var drift = tables.detectDrift ? tables.detectDrift(markers, 3) : null;
      if (!drift) { _cachedFindings = []; return []; }
      var findings = drift.minority.map(function(m) {
        return { rule_id: 'doc-drift-de-address', start: m.start, end: m.end, original: m.display, fix: '', message: 'drift' };
      });
      _cachedFindings = findings;
      return findings;
    },
    explain: function() { return { nb: 'test', nn: 'test' }; },
  };
  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();`;

fs.writeFileSync(SCRATCH_RULE, brokenRule, 'utf8');

const brokenRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
fs.unlinkSync(SCRATCH_RULE);

if (brokenRun.status !== 1) {
  console.error('FAIL step 2: gate did not exit 1 on broken rule (module-level cached state).');
  console.error('  exit status:', brokenRun.status);
  console.error('  stdout:', (brokenRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (brokenRun.stderr || '').slice(0, 500));
  cleanup();
  process.exit(1);
}

// Step 3: Plant well-formed rule — fresh recompute each call
const goodRule = `(function () {
  'use strict';
  var host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  var rule = {
    id: 'doc-drift-de-address',
    kind: 'document',
    languages: ['de'],
    priority: 201,
    severity: 'warning',
    check: function() { return []; },
    checkDocument: function(ctx) {
      // CORRECT: fresh recompute each call, no cached state
      var markers = [];
      var DU_SET = new Set(['du', 'dich', 'dir', 'dein', 'deine', 'deinem', 'deinen', 'deiner']);
      var SIE_SET = new Set(['sie', 'ihnen', 'ihr', 'ihre', 'ihrem', 'ihren', 'ihrer']);
      for (var i = 0; i < ctx.tokens.length; i++) {
        var w = ctx.tokens[i].word;
        if (DU_SET.has(w)) markers.push({register:'du',tokenIndex:i,start:ctx.tokens[i].start,end:ctx.tokens[i].end,display:ctx.tokens[i].display});
        if (SIE_SET.has(w) && ctx.tokens[i].display[0] === ctx.tokens[i].display[0].toUpperCase()) markers.push({register:'Sie',tokenIndex:i,start:ctx.tokens[i].start,end:ctx.tokens[i].end,display:ctx.tokens[i].display});
      }
      var tables = host.__lexiGrammarTables || {};
      var drift = tables.detectDrift ? tables.detectDrift(markers, 3) : null;
      if (!drift) return [];
      return drift.minority.map(function(m) {
        return { rule_id: 'doc-drift-de-address', start: m.start, end: m.end, original: m.display, fix: '', message: 'drift' };
      });
    },
    explain: function() { return { nb: 'test', nn: 'test' }; },
  };
  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();`;

fs.writeFileSync(SCRATCH_RULE, goodRule, 'utf8');

const goodRun = spawnSync(process.execPath, [GATE], { cwd: ROOT, encoding: 'utf8' });
cleanup();

if (goodRun.status !== 0) {
  console.error('FAIL step 3: gate did not exit 0 on well-formed rule.');
  console.error('  exit status:', goodRun.status);
  console.error('  stdout:', (goodRun.stdout || '').slice(0, 500));
  console.error('  stderr:', (goodRun.stderr || '').slice(0, 500));
  process.exit(1);
}

// Step 4: Verify scratch is cleaned up
if (fs.existsSync(SCRATCH_RULE)) {
  console.error('FAIL: scratch file still on disk after cleanup');
  fs.unlinkSync(SCRATCH_RULE);
  process.exit(1);
}

console.log('PASS: self-test confirms gate rejects broken stateful rule (exit 1), accepts well-formed rule (exit 0), and passes on no-rules baseline (exit 0).');
process.exit(0);
