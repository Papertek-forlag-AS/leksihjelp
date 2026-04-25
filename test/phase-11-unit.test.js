#!/usr/bin/env node
/**
 * Phase 11 unit tests — ES/FR mood & aspect rules.
 *
 * Plain Node.js + assert.strict. No test framework required.
 * Exit 0 = all pass, exit 1 = first failure.
 */
'use strict';
const assert = require('assert').strict;
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// ── Load core + rules ──
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));

const SPELL_RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');
fs.readdirSync(SPELL_RULES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort()
  .forEach(f => require(path.join(SPELL_RULES_DIR, f)));

const tables = require(path.join(SPELL_RULES_DIR, 'grammar-tables.js'));

// ── Build vocab from real data ──
const esRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'es.json'), 'utf8'));
const esVocab = vocabCore.buildIndexes({ raw: esRaw, lang: 'es', isFeatureEnabled: () => true });
esVocab.isFeatureEnabled = () => true;

const frRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'fr.json'), 'utf8'));
const frVocab = vocabCore.buildIndexes({ raw: frRaw, lang: 'fr', isFeatureEnabled: () => true });
frVocab.isFeatureEnabled = () => true;

function esFindingsFor(text, ruleId) {
  const all = spellCore.check(text, esVocab, { lang: 'es' });
  return all.filter(f => f.rule_id === ruleId);
}

function frFindingsFor(text, ruleId) {
  const all = spellCore.check(text, frVocab, { lang: 'fr' });
  return all.filter(f => f.rule_id === ruleId);
}

// ── Test runner ──
const results = [];
let failed = false;

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
  } catch (e) {
    results.push({ name, status: 'FAIL', error: e.message });
    failed = true;
  }
}

// =====================================================================
// grammar-tables.js — Phase 11 table shape and content
// =====================================================================

test('ES_SUBJUNTIVO_TRIGGERS is a Set with core triggers', () => {
  const t = tables.ES_SUBJUNTIVO_TRIGGERS;
  assert.ok(t instanceof Set, 'should be a Set');
  assert.ok(t.has('quiero que'), 'missing quiero que');
  assert.ok(t.has('espero que'), 'missing espero que');
  assert.ok(t.has('dudo que'), 'missing dudo que');
  assert.ok(t.has('es importante que'), 'missing es importante que');
  assert.ok(t.has('ojala que') || t.has('ojalá que'), 'missing ojala/ojalá que');
  assert.ok(t.has('no creo que'), 'missing no creo que');
  assert.ok(t.size >= 20, `expected >= 20 triggers, got ${t.size}`);
});

test('ES_PRETERITO/IMPERFECTO adverbs and phrases have expected entries', () => {
  const pa = tables.ES_PRETERITO_ADVERBS;
  assert.ok(pa instanceof Set, 'PRETERITO_ADVERBS should be a Set');
  assert.ok(pa.has('ayer'), 'missing ayer');
  assert.ok(pa.has('anoche'), 'missing anoche');

  const pp = tables.ES_PRETERITO_PHRASES;
  assert.ok(Array.isArray(pp), 'PRETERITO_PHRASES should be an array');
  assert.ok(pp.some(p => p.includes('semana pasada')), 'missing la semana pasada');

  const ia = tables.ES_IMPERFECTO_ADVERBS;
  assert.ok(ia instanceof Set, 'IMPERFECTO_ADVERBS should be a Set');
  assert.ok(ia.has('siempre'), 'missing siempre');
  assert.ok(ia.has('normalmente'), 'missing normalmente');

  const ip = tables.ES_IMPERFECTO_PHRASES;
  assert.ok(Array.isArray(ip), 'IMPERFECTO_PHRASES should be an array');
  assert.ok(ip.some(p => p.includes('cada dia') || p.includes('cada día')), 'missing cada dia');
});

test('FR_SUBJONCTIF_TRIGGERS is a Set with core triggers including quoique', () => {
  const t = tables.FR_SUBJONCTIF_TRIGGERS;
  assert.ok(t instanceof Set, 'should be a Set');
  assert.ok(t.has('il faut que'), 'missing il faut que');
  assert.ok(t.has('avant que'), 'missing avant que');
  assert.ok(t.has('pour que'), 'missing pour que');
  assert.ok(t.has('bien que'), 'missing bien que');
  assert.ok(t.has('quoique'), 'missing quoique (single-word trigger)');
  assert.ok(t.has('je veux que'), 'missing je veux que');
  assert.ok(t.size >= 15, `expected >= 15 triggers, got ${t.size}`);
});

// =====================================================================
// vocab-seam-core.js — buildMoodIndexes
// =====================================================================

test('ES: esPresensToVerb maps indicative forms to {inf, person}', () => {
  const m = esVocab.esPresensToVerb;
  assert.ok(m instanceof Map, 'should be a Map');
  assert.ok(m.size > 0, 'should have entries');
  const info = m.get('viene');
  assert.ok(info, 'viene should be in the map');
  assert.equal(info.inf, 'venir');
  assert.equal(info.person, 'él/ella');
});

test('ES: esPresensToVerb includes accent-stripped variants', () => {
  const m = esVocab.esPresensToVerb;
  const withAccent = m.get('vienes');
  assert.ok(withAccent, 'vienes should be in the map');
  // camináis has accent; stripped form caminais should also be present
  if (m.has('camináis')) {
    assert.ok(m.has('caminais'), 'accent-stripped caminais should also be present');
  }
});

test('ES: esSubjuntivoForms maps inf|person to subjunctive form', () => {
  const m = esVocab.esSubjuntivoForms;
  assert.ok(m instanceof Map, 'should be a Map');
  assert.ok(m.size > 0, 'should have entries');
  assert.equal(m.get('venir|él/ella'), 'venga');
  assert.equal(m.get('hablar|yo'), 'hable');
  assert.equal(m.get('comer|tú'), 'comas');
});

test('ES: esPreteritumToVerb maps preterito forms to {inf, person}', () => {
  const m = esVocab.esPreteritumToVerb;
  assert.ok(m instanceof Map, 'should be a Map');
  assert.ok(m.size > 0, 'should have entries');
  // caminé -> caminar
  const info = m.get('caminé') || m.get('camine');
  assert.ok(info, 'caminé should be in the map');
  assert.equal(info.inf, 'caminar');
});

test('ES: esImperfectoForms maps inf|person to imperfecto form', () => {
  const m = esVocab.esImperfectoForms;
  assert.ok(m instanceof Map, 'should be a Map');
  assert.ok(m.size > 0, 'should have entries');
  assert.equal(m.get('caminar|yo'), 'caminaba');
  assert.equal(m.get('comer|yo'), 'comía');
});

test('FR: frPresensToVerb maps indicative forms to {inf, person}', () => {
  const m = frVocab.frPresensToVerb;
  assert.ok(m instanceof Map, 'should be a Map');
  assert.ok(m.size > 0, 'should have entries');
  const info = m.get('fais');
  assert.ok(info, 'fais should be in the map');
  assert.equal(info.inf, 'faire');
  const allons = m.get('allons');
  assert.ok(allons, 'allons should be in the map');
  assert.equal(allons.inf, 'aller');
});

test('FR: frSubjonctifDiffers is true for irregular, false for regular -er', () => {
  const differs = frVocab.frSubjonctifDiffers;
  assert.ok(differs instanceof Map, 'should be a Map');
  // faire je: fais vs fasse -> true (differ)
  assert.equal(differs.get('faire|je'), true, 'faire|je should differ');
  // faire tu: fais vs fasses -> true
  assert.equal(differs.get('faire|tu'), true, 'faire|tu should differ');
  // parler je: parle vs parle -> false (same, homophonous)
  assert.equal(differs.get('parler|je'), false, 'parler|je should NOT differ');
  // parler nous: parlons vs parlions -> true
  assert.equal(differs.get('parler|nous'), true, 'parler|nous should differ');
  // aller je: vais vs aille -> true
  assert.equal(differs.get('aller|je'), true, 'aller|je should differ');
});

// =====================================================================
// es-subjuntivo.js — rule behavior
// =====================================================================

test('es-subjuntivo: flags indicative after trigger', () => {
  const hits = esFindingsFor('Quiero que mi hermano viene conmigo.', 'es-subjuntivo');
  assert.ok(hits.length >= 1, `expected >= 1 finding, got ${hits.length}`);
  assert.equal(hits[0].original.toLowerCase(), 'viene');
  assert.equal(hits[0].fix.toLowerCase(), 'venga');
  assert.equal(hits[0].severity, 'warning');
});

test('es-subjuntivo: no false positive on relative clause', () => {
  const hits = esFindingsFor('El libro que viene es interesante.', 'es-subjuntivo');
  assert.equal(hits.length, 0, 'relative clause "libro que" should not trigger');
});

test('es-subjuntivo: handles subject NP skip', () => {
  const hits = esFindingsFor('Espero que tu hermano habla mejor.', 'es-subjuntivo');
  assert.ok(hits.length >= 1, `expected >= 1 finding after NP skip, got ${hits.length}`);
  assert.equal(hits[0].fix.toLowerCase(), 'hable');
});

test('es-subjuntivo: explain() returns nb, nn, severity warning', () => {
  const rule = require(path.join(SPELL_RULES_DIR, 'es-subjuntivo.js'));
  const result = rule.explain({ original: 'viene', fix: 'venga', trigger: 'quiero que' });
  assert.ok(result.nb && result.nb.length > 0, 'nb should be non-empty');
  assert.ok(result.nn && result.nn.length > 0, 'nn should be non-empty');
  assert.equal(result.severity, 'warning');
});

test('es-subjuntivo: does not fire on non-ES context', () => {
  const all = spellCore.check('Quiero que mi hermano viene conmigo.', frVocab, { lang: 'fr' });
  const hits = all.filter(f => f.rule_id === 'es-subjuntivo');
  assert.equal(hits.length, 0, 'should not fire on lang=fr');
});

// =====================================================================
// es-imperfecto-hint.js — rule behavior
// =====================================================================

test('es-imperfecto-hint: flags imperfecto with preterito adverb', () => {
  const hits = esFindingsFor('Ayer yo caminaba por el parque.', 'es-imperfecto-hint');
  assert.ok(hits.length >= 1, `expected >= 1 finding, got ${hits.length}`);
  assert.equal(hits[0].original.toLowerCase(), 'caminaba');
  assert.ok(hits[0].fix, 'should suggest a preterito form');
  assert.equal(hits[0].expectedAspect, 'preterito');
});

test('es-imperfecto-hint: flags preterito with imperfecto adverb', () => {
  const hits = esFindingsFor('Siempre yo caminé al parque.', 'es-imperfecto-hint');
  assert.ok(hits.length >= 1, `expected >= 1 finding, got ${hits.length}`);
  assert.equal(hits[0].expectedAspect, 'imperfecto');
  assert.equal(hits[0].fix.toLowerCase(), 'caminaba');
});

test('es-imperfecto-hint: mientras que does NOT trigger', () => {
  const hits = esFindingsFor('Mientras que yo caminé, ella leyó.', 'es-imperfecto-hint');
  // "mientras que" is contrastive — should not trigger imperfecto hint
  const mientrasHits = hits.filter(h => h.adverb && h.adverb.toLowerCase().includes('mientras'));
  assert.equal(mientrasHits.length, 0, '"mientras que" should not trigger');
});

test('es-imperfecto-hint: bare mientras DOES trigger', () => {
  const hits = esFindingsFor('Mientras yo caminé al parque.', 'es-imperfecto-hint');
  assert.ok(hits.length >= 1, `bare "mientras" should trigger, got ${hits.length}`);
  assert.equal(hits[0].expectedAspect, 'imperfecto');
});

test('es-imperfecto-hint: severity is always hint', () => {
  const hits = esFindingsFor('Ayer yo caminaba por el parque.', 'es-imperfecto-hint');
  for (const h of hits) {
    assert.equal(h.severity, 'hint', `expected hint, got ${h.severity}`);
  }
});

// =====================================================================
// fr-subjonctif.js — rule behavior
// =====================================================================

test('fr-subjonctif: flags indicative after trigger with irregular verb', () => {
  const hits = frFindingsFor('Je veux que tu fais tes devoirs.', 'fr-subjonctif');
  assert.ok(hits.length >= 1, `expected >= 1 finding, got ${hits.length}`);
  assert.equal(hits[0].original.toLowerCase(), 'fais');
  assert.equal(hits[0].fix.toLowerCase(), 'fasses');
  assert.equal(hits[0].severity, 'warning');
});

test('fr-subjonctif: homophony guard — regular -er je form does NOT flag', () => {
  // parler: je parle (presens) = je parle (subjonctif) — identical, so guard blocks
  const hits = frFindingsFor('Je veux que je parle mieux.', 'fr-subjonctif');
  const parleHits = hits.filter(h => h.original && h.original.toLowerCase() === 'parle');
  assert.equal(parleHits.length, 0, 'homophonous parle should not flag');
});

test('fr-subjonctif: person disambiguation — je fais -> fasse not fasses', () => {
  const hits = frFindingsFor('Je veux que je fais bien.', 'fr-subjonctif');
  assert.ok(hits.length >= 1, `expected >= 1 finding, got ${hits.length}`);
  assert.equal(hits[0].fix.toLowerCase(), 'fasse', 'should suggest fasse for je, not fasses');
});

test('fr-subjonctif: single-word trigger quoique works', () => {
  const hits = frFindingsFor('Quoique tu fais cela.', 'fr-subjonctif');
  assert.ok(hits.length >= 1, `quoique should trigger, got ${hits.length}`);
  assert.equal(hits[0].fix.toLowerCase(), 'fasses');
});

test('fr-subjonctif: explain() returns nb, nn, severity warning', () => {
  const rule = require(path.join(SPELL_RULES_DIR, 'fr-subjonctif.js'));
  const result = rule.explain({ original: 'fais', fix: 'fasses', trigger: 'je veux que' });
  assert.ok(result.nb && result.nb.length > 0, 'nb should be non-empty');
  assert.ok(result.nn && result.nn.length > 0, 'nn should be non-empty');
  assert.equal(result.severity, 'warning');
});

// =====================================================================
// Report
// =====================================================================

console.log('\n' + '='.repeat(60));
console.log('Phase 11 Unit Tests');
console.log('='.repeat(60));
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}`);
  if (r.error) console.log(`    ${r.error}`);
}
const passed = results.filter(r => r.status === 'PASS').length;
console.log(`\n${passed}/${results.length} passed`);
if (failed) {
  console.log('\nFAILED');
  process.exit(1);
} else {
  console.log('\nALL PASSED');
}
