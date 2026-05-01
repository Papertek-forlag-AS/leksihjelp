#!/usr/bin/env node
/**
 * F36-1 multi-rule regression smoke (Plan 36-03 Task 2).
 *
 * Pins the canonical UAT outcome: with both `nb-typo-fuzzy` and
 * `fr-aspect-hint` rules registered against an FR-built vocab, the sentence
 * `Hier il mangeait une pomme.` produces ONLY `fr-aspect-hint` on the
 * `mangeait` token (offset 8). No `typo` finding may overlap.
 *
 * Also pins the desync defence: when ctx.lang === 'nb' but vocab carries FR
 * indexes (the partial-hydration failure mode), the cross-language verb-form
 * guard in nb-typo-fuzzy must still suppress the typo emission on `mangeait`.
 *
 * Not registered as a release gate (single-shot regression check). Exits 0
 * on success, 1 on mismatch with diagnostic output.
 */
'use strict';
globalThis.self = globalThis;
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'extension/content/spell-check-core.js'));
require(path.join(ROOT, 'extension/content/spell-rules/nb-typo-fuzzy.js'));
require(path.join(ROOT, 'extension/content/spell-rules/fr-aspect-hint.js'));
const core = self.__lexiSpellCore;
const vc = require(path.join(ROOT, 'extension/content/vocab-seam-core.js'));
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/data/fr.json'), 'utf8'));
const vocab = vc.buildIndexes({ raw, lang: 'fr', isFeatureEnabled: () => true });

const SENTENCE = 'Hier il mangeait une pomme.';
let failed = 0;

// Scenario 1: ctx.lang === 'fr' (canonical UAT).
const out_fr = core.check(SENTENCE, vocab, { lang: 'fr' });
const ids_fr = out_fr.map(f => f.rule_id + '@' + f.start);
const aspectFires = out_fr.some(f => f.rule_id === 'fr-aspect-hint' && f.start === 8);
const noTypo_fr = !out_fr.some(f => f.rule_id === 'typo');
if (!aspectFires || !noTypo_fr) {
  console.error('FAIL [ctx=fr, vocab=fr]: expected fr-aspect-hint@8 only, got', ids_fr);
  failed++;
} else {
  console.log('PASS [ctx=fr, vocab=fr]:', ids_fr);
}

// Scenario 2: ctx.lang === 'nb' (desync defence — guard must suppress typo).
const out_nb = core.check(SENTENCE, vocab, { lang: 'nb' });
const ids_nb = out_nb.map(f => f.rule_id + '@' + f.start);
const noTypoOnMangeait = !out_nb.some(f => f.rule_id === 'typo' && f.start === 8);
if (!noTypoOnMangeait) {
  console.error('FAIL [ctx=nb, vocab=fr]: typo flagged mangeait despite cross-lang guard, got', ids_nb);
  failed++;
} else {
  console.log('PASS [ctx=nb, vocab=fr]: no typo on mangeait, findings =', ids_nb);
}

if (failed > 0) {
  console.error(`check-f36-1-multi-rule: ${failed}/2 scenarios failed`);
  process.exit(1);
}
console.log('check-f36-1-multi-rule: PASS — 2/2 scenarios green');
process.exit(0);
