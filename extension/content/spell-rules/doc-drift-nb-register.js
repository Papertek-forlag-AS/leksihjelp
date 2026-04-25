/**
 * Document-drift rule: NB bokmal/riksmal register mixing (DOC-03, priority 203).
 *
 * Phase 13 Plan 03. Detects inconsistent register within a NB document:
 * when a text mixes modern bokmal forms (boka, gata, etter) with
 * conservative riksmal forms (boken, gaten, efter), the minority register's
 * tokens are flagged with a fix suggestion toward the dominant register.
 *
 * Uses BOKMAL_RIKSMAL_MAP from grammar-tables.js (Plan 01) for high-confidence
 * riksmal<->bokmal form pairs. Both lexical markers (efter/etter, sne/sno,
 * nu/na) and morphological markers (boken/boka, gaten/gata) are detected.
 *
 * Design: fresh-recompute per checkDocument() call. No module-level mutable
 * state. The text IS the state.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { escapeHtml } = host.__lexiSpellCore || {};

  // Lazy access: grammar-tables.js may load after this file alphabetically.
  function getDetectDrift() {
    return host.__lexiGrammarTables && host.__lexiGrammarTables.detectDrift;
  }
  function getMap() {
    return host.__lexiGrammarTables && host.__lexiGrammarTables.BOKMAL_RIKSMAL_MAP;
  }

  // Reverse map (bokmal-form -> riksmal-form) built lazily on first call.
  // Deterministic derivation from immutable BOKMAL_RIKSMAL_MAP — safe to cache.
  let _reverseMap = null;
  function getReverseMap() {
    if (_reverseMap) return _reverseMap;
    const map = getMap();
    if (!map) return null;
    _reverseMap = new Map();
    for (const [riksmal, bokmal] of map) {
      _reverseMap.set(bokmal, riksmal);
    }
    return _reverseMap;
  }

  const rule = {
    id: 'doc-drift-nb-register',
    kind: 'document',
    languages: ['nb'],
    priority: 203,
    severity: 'warning',

    explain(finding) {
      const esc = escapeHtml || (s => s);
      const dom = finding.dominant || 'bokmal';
      const word = finding.original || '';
      const fix = finding.fix || '';
      const base = `<em>${esc(word)}</em>`;
      const nb = `Du blandar bokmalformer og riksmalformer i teksten. Mesteparten brukar ${dom}. Endre ${base} til <em>${esc(fix)}</em>.`;
      const nn = `Du blandar bokmalformer og riksmalformer i teksta. Mesteparten nyttar ${dom}. Endre ${base} til <em>${esc(fix)}</em>.`;
      return { nb, nn, severity: 'warning' };
    },

    check(/* ctx */) {
      return [];
    },

    checkDocument(ctx, findings) {
      const detectDrift = getDetectDrift();
      const MAP = getMap();
      const REVERSE = getReverseMap();
      if (!MAP || !detectDrift || !REVERSE) return [];

      const suppStruct = ctx.suppressedFor && ctx.suppressedFor.structural;
      const markers = [];

      // Build a set of already-flagged spans from pass-1
      const flaggedSpans = new Set();
      for (const f of findings) {
        flaggedSpans.add(f.start + ':' + f.end);
      }

      for (let i = 0; i < ctx.tokens.length; i++) {
        if (suppStruct && suppStruct.has(i)) continue;
        const tok = ctx.tokens[i];
        const w = tok.word; // lowercased

        // Check riksmal: key in BOKMAL_RIKSMAL_MAP
        if (MAP.has(w)) {
          markers.push({
            register: 'riksmal',
            tokenIndex: i,
            start: tok.start,
            end: tok.end,
            display: tok.display,
            counterpart: MAP.get(w), // bokmal equivalent
          });
          continue;
        }

        // Check bokmal: key in reverse map
        if (REVERSE.has(w)) {
          markers.push({
            register: 'bokmal',
            tokenIndex: i,
            start: tok.start,
            end: tok.end,
            display: tok.display,
            counterpart: REVERSE.get(w), // riksmal equivalent
          });
          continue;
        }
      }

      const drift = detectDrift(markers, 3);
      if (!drift) return [];

      const out = [];
      for (const m of drift.minority) {
        // Skip if pass-1 already flagged this span
        if (flaggedSpans.has(m.start + ':' + m.end)) continue;

        out.push({
          rule_id: rule.id,
          priority: rule.priority,
          start: m.start,
          end: m.end,
          original: m.display,
          dominant: drift.dominant,
          fix: m.counterpart,
          message: `Registerblanding: "${m.display}" er ${m.register}, men teksten bruker mest ${drift.dominant}`,
        });
      }

      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();
