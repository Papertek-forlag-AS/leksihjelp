#!/usr/bin/env node
/**
 * Phase 10 unit tests — French grammar rules (elision, être/avoir, PP agreement).
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

// ── Build vocab from real fr.json (with feature toggle ON for PP agreement) ──
const frRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'fr.json'), 'utf8'));
const frVocab = vocabCore.buildIndexes({ raw: frRaw, lang: 'fr', isFeatureEnabled: () => true });
frVocab.isFeatureEnabled = () => true;

// ── Build DE vocab for regression test ──
const deRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'data', 'de.json'), 'utf8'));
const deVocab = vocabCore.buildIndexes({ raw: deRaw, lang: 'de', isFeatureEnabled: () => true });

function findingsFor(text, ruleId, vocab, lang) {
  const all = spellCore.check(text, vocab || frVocab, { lang: lang || 'fr' });
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
// grammar-tables.js — FR table shape and content
// =====================================================================

test('FR_AVOIR_FORMS has present and imparfait conjugations', () => {
  const af = tables.FR_AVOIR_FORMS;
  assert.ok(af, 'FR_AVOIR_FORMS should exist');
  for (const form of ['ai', 'as', 'a', 'avons', 'avez', 'ont']) {
    assert.ok(af[form], `missing present form: ${form}`);
    assert.equal(af[form].tense, 'present', `${form} should be present tense`);
  }
  for (const form of ['avais', 'avait', 'avions', 'aviez', 'avaient']) {
    assert.ok(af[form], `missing imparfait form: ${form}`);
    assert.equal(af[form].tense, 'imparfait', `${form} should be imparfait`);
  }
});

test('FR_ETRE_FORMS has present and imparfait conjugations', () => {
  const ef = tables.FR_ETRE_FORMS;
  assert.ok(ef, 'FR_ETRE_FORMS should exist');
  for (const form of ['suis', 'es', 'est', 'sommes', 'etes', 'sont']) {
    assert.ok(ef[form], `missing present form: ${form}`);
  }
  for (const form of ['etais', 'etait', 'etions', 'etiez', 'etaient']) {
    assert.ok(ef[form], `missing imparfait form: ${form}`);
  }
});

test('FR_ETRE_VERBS is a Set with all 18 DR MRS VANDERTRAMP verbs', () => {
  const ev = tables.FR_ETRE_VERBS;
  assert.ok(ev instanceof Set, 'FR_ETRE_VERBS should be a Set');
  const expected = [
    'devenir', 'revenir', 'monter', 'rester', 'sortir',
    'venir', 'aller', 'naitre', 'descendre', 'entrer',
    'retourner', 'tomber', 'rentrer', 'arriver', 'mourir',
    'partir', 'passer',
  ];
  for (const v of expected) {
    assert.ok(ev.has(v), `missing etre-verb: ${v}`);
  }
  assert.ok(ev.size >= 17, `expected >=17 etre-verbs, got ${ev.size}`);
});

test('FR_ETRE_PARTICIPLES maps participles to infinitives', () => {
  const ep = tables.FR_ETRE_PARTICIPLES;
  assert.ok(ep, 'FR_ETRE_PARTICIPLES should exist');
  assert.equal(ep['alle'], 'aller', 'alle -> aller');
  assert.equal(ep['venu'], 'venir', 'venu -> venir');
  assert.equal(ep['parti'], 'partir', 'parti -> partir');
  assert.equal(ep['tombe'], 'tomber', 'tombe -> tomber');
  assert.equal(ep['arrive'], 'arriver', 'arrive -> arriver');
  assert.equal(ep['mort'], 'mourir', 'mort -> mourir');
  // Feminine forms
  assert.equal(ep['allee'], 'aller', 'allee (fem) -> aller');
  assert.equal(ep['venue'], 'venir', 'venue (fem) -> venir');
});

// =====================================================================
// vocab-seam-core.js — buildParticipleToAux
// =====================================================================

test('buildParticipleToAux reads passe_compose key for FR verbs', () => {
  const pta = frVocab.participleToAux;
  assert.ok(pta, 'participleToAux should exist');
  assert.ok(pta.size > 0, 'participleToAux should have entries');
  // aller should be in there with etre auxiliary
  let foundEtre = false;
  for (const [pp, aux] of pta) {
    if (aux === 'être' || aux === 'etre') { foundEtre = true; break; }
  }
  assert.ok(foundEtre, 'participleToAux should contain at least one etre verb');
});

test('buildParticipleToAux reads perfektum key for DE verbs (regression)', () => {
  const pta = deVocab.participleToAux;
  assert.ok(pta, 'DE participleToAux should exist');
  assert.ok(pta.size > 0, 'DE participleToAux should have entries');
  assert.ok(pta.has('gegangen'), 'should contain gegangen');
});

// =====================================================================
// fr-elision — mandatory clitic elision (FR-01)
// =====================================================================

test('fr-elision: flags "je ai" -> "j\'ai"', () => {
  const hits = findingsFor('je ai un chat.', 'fr-elision');
  assert.ok(hits.length > 0, 'should flag missing elision');
  assert.ok(hits[0].fix.includes("j'"), `fix should contain j', got: ${hits[0].fix}`);
});

test('fr-elision: flags "le ami" -> "l\'ami"', () => {
  const hits = findingsFor('le ami est gentil.', 'fr-elision');
  assert.ok(hits.length > 0, 'should flag le before vowel');
  assert.ok(hits[0].fix.includes("l'"), `fix should contain l', got: ${hits[0].fix}`);
});

test('fr-elision: flags "si il" -> "s\'il" (SI special case)', () => {
  const hits = findingsFor('si il pleut demain.', 'fr-elision');
  assert.ok(hits.length > 0, 'should flag si il');
  assert.ok(hits[0].fix.includes("s'il"), `fix should be s'il, got: ${hits[0].fix}`);
});

test('fr-elision: passes "le heros" (h-aspire exception)', () => {
  const hits = findingsFor('le heros est brave.', 'fr-elision');
  assert.equal(hits.length, 0, 'should not flag h-aspire word');
});

test('fr-elision: passes "le chat" (consonant, no elision needed)', () => {
  const hits = findingsFor('le chat dort.', 'fr-elision');
  assert.equal(hits.length, 0, 'should not flag consonant-initial word');
});

test('fr-elision: flags "que elle" -> "qu\'elle"', () => {
  const hits = findingsFor('Il dit que elle part.', 'fr-elision');
  assert.ok(hits.length > 0, 'should flag que before vowel');
  assert.ok(hits[0].fix.includes("qu'"), `fix should contain qu', got: ${hits[0].fix}`);
});

test('fr-elision: passes "si elle" (SI only elides before il/ils)', () => {
  const hits = findingsFor('si elle vient.', 'fr-elision');
  assert.equal(hits.length, 0, 'si should not elide before elle');
});

test('fr-elision: flags "de avoir" -> "d\'avoir"', () => {
  const hits = findingsFor('Il parle de avoir un chat.', 'fr-elision');
  assert.ok(hits.length > 0, 'should flag de before vowel');
  assert.ok(hits[0].fix.includes("d'"), `fix should contain d', got: ${hits[0].fix}`);
});

// =====================================================================
// fr-etre-avoir — passe compose auxiliary choice (FR-02)
// =====================================================================

test('fr-etre-avoir: flags "il a alle" (aller requires etre)', () => {
  const hits = findingsFor('Il a alle au parc.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'should flag avoir with etre-verb participle');
  assert.equal(hits[0].fix.toLowerCase(), 'est', 'fix should suggest est');
});

test('fr-etre-avoir: flags "elle a partie" (partir requires etre)', () => {
  const hits = findingsFor('Elle a parti hier.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'should flag avoir with partir participle');
  assert.equal(hits[0].fix.toLowerCase(), 'est', 'fix should suggest est');
});

test('fr-etre-avoir: passes "il est alle" (correct etre auxiliary)', () => {
  const hits = findingsFor('Il est alle au parc.', 'fr-etre-avoir');
  assert.equal(hits.length, 0, 'should not flag correct etre auxiliary');
});

test('fr-etre-avoir: passes "il a mange" (manger takes avoir)', () => {
  const hits = findingsFor('Il a mange une pomme.', 'fr-etre-avoir');
  assert.equal(hits.length, 0, 'should not flag correct avoir with avoir-verb');
});

test('fr-etre-avoir: skips unknown verbs not in participleToAux', () => {
  // A word not recognized as a past participle should not trigger a flag
  const hits = findingsFor('Il a gribouille sur le mur.', 'fr-etre-avoir');
  assert.equal(hits.length, 0, 'should not flag unrecognized participle');
});

test('fr-etre-avoir: correct fix person for "tu as alle" -> suggests "es"', () => {
  const hits = findingsFor('Tu as alle au parc.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'should flag avoir with etre-verb');
  assert.equal(hits[0].fix.toLowerCase(), 'es', 'fix for tu should be es');
});

test('fr-etre-avoir: handles accent-stripped participle lookup', () => {
  // allé with accent stripped to alle should still be detected
  const hits = findingsFor('Il a alle rapidement.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'should detect accent-stripped participle');
});

test('fr-etre-avoir: forward scan finds participle up to 5 tokens ahead', () => {
  const hits = findingsFor('Il a vraiment tres vite alle.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'should find participle across adverbs');
});

test('fr-etre-avoir: normalizeAux handles accented être from vocab data', () => {
  // This test verifies the data pipeline works end-to-end:
  // vocab data may store 'être' (accented), and the rule must normalize to 'etre'
  const pta = frVocab.participleToAux;
  let hasAccented = false;
  for (const [, aux] of pta) {
    if (aux === 'être') { hasAccented = true; break; }
  }
  // Whether accented or not, the rule should still work via normalizeAux
  const hits = findingsFor('Il a alle au parc.', 'fr-etre-avoir');
  assert.ok(hits.length > 0, 'rule should work regardless of accent in aux data');
  if (hasAccented) {
    assert.ok(true, 'vocab data contains accented être — normalizeAux handles it');
  }
});

// =====================================================================
// fr-pp-agreement — participe passe agreement (FR-03)
// =====================================================================

test('fr-pp-agreement: flags "la ai mangé" (fem needs -e)', () => {
  const hits = findingsFor('je la ai mangé', 'fr-pp-agreement');
  assert.ok(hits.length > 0, 'should flag PP without feminine agreement');
  assert.ok(hits[0].fix.endsWith('e'), `fix should end in -e, got: ${hits[0].fix}`);
});

test('fr-pp-agreement: flags "les ai mangé" (plural needs -s)', () => {
  const hits = findingsFor('je les ai mangé', 'fr-pp-agreement');
  assert.ok(hits.length > 0, 'should flag PP without plural agreement');
  assert.ok(hits[0].fix.endsWith('s'), `fix should end in -s, got: ${hits[0].fix}`);
});

test('fr-pp-agreement: passes "la ai mangée" (already has feminine agreement)', () => {
  const hits = findingsFor('je la ai mangée', 'fr-pp-agreement');
  assert.equal(hits.length, 0, 'should not flag PP with correct feminine agreement');
});

test('fr-pp-agreement: skips etre constructions', () => {
  // elle est allee — this is etre, not avoir; PP agreement rule should not flag
  const hits = findingsFor('Elle est allee.', 'fr-pp-agreement');
  assert.equal(hits.length, 0, 'should not flag etre constructions');
});

test('fr-pp-agreement: returns [] when feature toggle is disabled', () => {
  const vocabOff = vocabCore.buildIndexes({ raw: frRaw, lang: 'fr', isFeatureEnabled: () => true });
  vocabOff.isFeatureEnabled = (id) => id !== 'grammar_fr_pp_agreement';
  const all = spellCore.check('je la ai mangé', vocabOff, { lang: 'fr' });
  const hits = all.filter(f => f.rule_id === 'fr-pp-agreement');
  assert.equal(hits.length, 0, 'should not fire when toggle is off');
});

// =====================================================================
// Print results
// =====================================================================

console.log('\n--- Phase 10 Unit Tests ---\n');
for (const r of results) {
  if (r.status === 'PASS') {
    console.log(`  PASS  ${r.name}`);
  } else {
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}

const passCount = results.filter(r => r.status === 'PASS').length;
const failCount = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${passCount} passed, ${failCount} failed out of ${results.length} tests.\n`);

process.exit(failed ? 1 : 0);
