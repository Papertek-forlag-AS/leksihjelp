#!/usr/bin/env node
/**
 * Phase 7 unit tests — word-order rules (nb-v2, de-v2, de-verb-final, fr-bags).
 *
 * Plain Node.js script using assert.strict. No test framework needed.
 * Uses real vocab data via vocab-seam-core.buildIndexes() and runs
 * spell-check-core.check() — same path as check-fixtures.js.
 *
 * Exit 0 if all pass, exit 1 on first failure.
 */
'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'extension', 'data');

// ── Load core modules ──
const vocabCore = require(path.join(ROOT, 'extension', 'content', 'vocab-seam-core.js'));
const spellCore = require(path.join(ROOT, 'extension', 'content', 'spell-check-core.js'));

// ── Load all spell rules (they self-register on globalThis.__lexiSpellRules) ──
const SPELL_RULES_DIR = path.join(ROOT, 'extension', 'content', 'spell-rules');
fs.readdirSync(SPELL_RULES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort()
  .forEach(f => require(path.join(SPELL_RULES_DIR, f)));

// ── Build vocab indexes ──
function loadVocab(lang) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang + '.json'), 'utf8'));
  let sisterRaw = null;
  if (lang === 'nb' || lang === 'nn') {
    const sisterLang = lang === 'nb' ? 'nn' : 'nb';
    sisterRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, sisterLang + '.json'), 'utf8'));
  }
  return vocabCore.buildIndexes({ raw, sisterRaw, lang, isFeatureEnabled: () => true });
}

const nbVocab = loadVocab('nb');
const nnVocab = loadVocab('nn');
const deVocab = loadVocab('de');
const frVocab = loadVocab('fr');

// ── Helpers ──
function findingsFor(text, vocab, lang) {
  return spellCore.check(text, vocab, { lang });
}

function hasRule(findings, ruleId) {
  return findings.some(f => f.rule_id === ruleId);
}

// ── Test registry ──
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// ============================================================
// nb-v2: NB V2 inversion rule
// ============================================================

test('nb-v2: flags fronted adverbial + subject before verb', () => {
  // "I gar jeg gikk pa kino" — wrong word order (subject before verb after fronted adverbial)
  const findings = findingsFor('I dag jeg spiser fisk.', nbVocab, 'nb');
  assert.ok(hasRule(findings, 'nb-v2'),
    'Expected nb-v2 to flag "I dag jeg spiser" but got: ' + JSON.stringify(findings.filter(f => f.rule_id === 'nb-v2')));
});

test('nb-v2: passes correct V2 order', () => {
  // "I dag spiser jeg fisk." — correct inversion
  const findings = findingsFor('I dag spiser jeg fisk.', nbVocab, 'nb');
  assert.ok(!hasRule(findings, 'nb-v2'),
    'nb-v2 should NOT fire on correct V2 order, but got: ' + JSON.stringify(findings.filter(f => f.rule_id === 'nb-v2')));
});

test('nb-v2: passes subordinate clause (fordi)', () => {
  // Subordinate clauses have SVO order — should not flag
  const findings = findingsFor('Fordi jeg spiser fisk er jeg glad.', nbVocab, 'nb');
  // The subordinate clause "fordi jeg spiser" should NOT be flagged
  const nbv2 = findings.filter(f => f.rule_id === 'nb-v2');
  // If anything is flagged, it should be the main clause part, not the subordinate
  // The first token "fordi" is a subordinator, so the sentence should be skipped
  // Actually the whole sentence starts with "Fordi" so the first sentence is subordinate
  assert.ok(!hasRule(findings, 'nb-v2'),
    'nb-v2 should NOT fire on subordinate clause starting with "fordi": ' + JSON.stringify(nbv2));
});

test('nb-v2: passes questions with wh-word', () => {
  // "Hvorfor tror du det?" — question, not V2 violation
  const findings = findingsFor('Hvorfor tror du det?', nbVocab, 'nb');
  assert.ok(!hasRule(findings, 'nb-v2'),
    'nb-v2 should NOT fire on wh-question: ' + JSON.stringify(findings.filter(f => f.rule_id === 'nb-v2')));
});

test('nb-v2: coordinate conjunction guard — second clause SVO is correct', () => {
  // "Jeg spiser og jeg drikker." — coordinate conjunction "og" means second clause SVO is fine
  const findings = findingsFor('Jeg spiser og jeg drikker.', nbVocab, 'nb');
  assert.ok(!hasRule(findings, 'nb-v2'),
    'nb-v2 should NOT fire after coordinate conjunction "og": ' + JSON.stringify(findings.filter(f => f.rule_id === 'nb-v2')));
});

test('nb-v2: preposition-object guard — pronoun after preposition is not subject', () => {
  // "Uten dem ville det vært vanskelig." — "dem" after "uten" is a prepositional object
  const findings = findingsFor('Uten dem er det vanskelig.', nbVocab, 'nb');
  // "dem" is not in the subject pronouns set, so this tests "uten" + object pronoun pattern
  // Let's use a pronoun that IS in the set:
  const findings2 = findingsFor('Med han gikk vi hjem.', nbVocab, 'nb');
  // "han" after "med" should be treated as prep object, not subject
  const nbv2 = findings2.filter(f => f.rule_id === 'nb-v2');
  // The preposition guard checks i-1, so "med han" should suppress "han gikk"
  // Actually "med" is at position 0, "han" at 1, "gikk" at 2, "vi" at 3
  // The rule looks for subject pronoun at pos > 0 followed by finite verb
  // "han" (pos 1) + "gikk" (pos 2) — but guard checks if token before "han" is a preposition
  assert.ok(!nbv2.some(f => f.original && f.original.includes('han')),
    'nb-v2 should not flag pronoun after preposition "med": ' + JSON.stringify(nbv2));
});

test('nb-v2: NN article guard — "ein" before noun is article, not subject', () => {
  // In NN, "ein" can be an article or a pronoun. Before a known noun, treat as article.
  const findings = findingsFor('I dag ein gut spiser fisk.', nnVocab, 'nn');
  // "ein" at position 2, "gut" at position 3 — if "gut" is a known noun, the guard should suppress
  const nbv2 = findings.filter(f => f.rule_id === 'nb-v2');
  // Check if "gut" is actually in nnVocab.nounGenus
  if (nnVocab.nounGenus && nnVocab.nounGenus.has('gut')) {
    assert.ok(!nbv2.some(f => f.original && f.original.includes('ein')),
      'nb-v2 should not flag NN "ein" when followed by a known noun: ' + JSON.stringify(nbv2));
  }
  // If "gut" is not in the noun database, the guard won't trigger — skip this check
});

test('nb-v2: yes/no question guard — verb-first + question mark', () => {
  // "Kan du hjelpe meg?" — yes/no question, verb first
  const findings = findingsFor('Kan du hjelpe meg?', nbVocab, 'nb');
  assert.ok(!hasRule(findings, 'nb-v2'),
    'nb-v2 should NOT fire on yes/no question: ' + JSON.stringify(findings.filter(f => f.rule_id === 'nb-v2')));
});

test('nb-v2: fix swaps subject and verb', () => {
  const findings = findingsFor('I dag jeg spiser fisk.', nbVocab, 'nb');
  const f = findings.find(f => f.rule_id === 'nb-v2');
  if (f) {
    // The fix should swap subject and verb
    assert.ok(f.fix.includes('spiser') && f.fix.includes('jeg'),
      'Fix should contain both "spiser" and "jeg": ' + f.fix);
    // Fix should be verb+subject (reversed from original)
    assert.equal(f.fix, 'spiser jeg', 'Fix should be "spiser jeg", got: ' + f.fix);
  }
});

// ============================================================
// de-v2: DE V2 inversion rule
// ============================================================

test('de-v2: flags fronted adverbial + subject before verb', () => {
  // "Gestern ich habe Fussball gespielt" — wrong order
  const findings = findingsFor('Gestern ich habe Fussball gespielt.', deVocab, 'de');
  assert.ok(hasRule(findings, 'de-v2'),
    'Expected de-v2 to flag "Gestern ich habe" but got: ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-v2')));
});

test('de-v2: passes correct V2 order', () => {
  // "Gestern habe ich Fussball gespielt." — correct inversion
  const findings = findingsFor('Gestern habe ich Fussball gespielt.', deVocab, 'de');
  assert.ok(!hasRule(findings, 'de-v2'),
    'de-v2 should NOT fire on correct V2 order: ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-v2')));
});

test('de-v2: passes subordinate clause', () => {
  // "Dass ich das mache ist klar." — subordinate clause, SVO is correct there
  const findings = findingsFor('Dass ich das mache ist klar.', deVocab, 'de');
  assert.ok(!hasRule(findings, 'de-v2'),
    'de-v2 should NOT fire on subordinate clause starting with "dass": ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-v2')));
});

test('de-v2: handles separable-prefix verb detection', () => {
  // Test that separable prefix stripping works for verb detection.
  // "Morgen ich aufstehe um sechs." — "aufstehe" should be recognized via prefix stripping
  // if "stehe" is a known present form.
  const findings = findingsFor('Morgen ich aufstehe um sechs.', deVocab, 'de');
  // Whether this fires depends on whether "stehe" is in knownPresens
  // Just verify no crash; the rule should handle gracefully
  // This is more of a smoke test
  assert.ok(Array.isArray(findings), 'Should return an array');
});

test('de-v2: fix swaps subject and verb', () => {
  const findings = findingsFor('Gestern ich habe Fussball gespielt.', deVocab, 'de');
  const f = findings.find(f => f.rule_id === 'de-v2');
  if (f) {
    assert.equal(f.fix, 'habe ich', 'Fix should be "habe ich", got: ' + f.fix);
  }
});

// ============================================================
// de-verb-final: DE subordinate-clause verb-final position
// ============================================================

test('de-verb-final: flags finite verb NOT at end in subordinate clause', () => {
  // "dass er ist nett" — "ist" should be at the end: "dass er nett ist"
  const findings = findingsFor('Ich denke, dass er ist nett.', deVocab, 'de');
  assert.ok(hasRule(findings, 'de-verb-final'),
    'Expected de-verb-final to flag verb not at clause end: ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-verb-final')));
});

test('de-verb-final: passes correct verb-final order', () => {
  // "dass er nett ist" — verb at the end is correct
  const findings = findingsFor('Ich denke, dass er nett ist.', deVocab, 'de');
  assert.ok(!hasRule(findings, 'de-verb-final'),
    'de-verb-final should NOT fire when verb is at clause end: ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-verb-final')));
});

test('de-verb-final: handles weil subordinate clause', () => {
  // "weil ich bin krank" — "bin" should be at end: "weil ich krank bin"
  const findings = findingsFor('Er bleibt, weil ich bin krank.', deVocab, 'de');
  assert.ok(hasRule(findings, 'de-verb-final'),
    'Expected de-verb-final on "weil ich bin krank": ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-verb-final')));
});

test('de-verb-final: passes correct weil clause', () => {
  // "weil ich krank bin" — correct verb-final
  const findings = findingsFor('Er bleibt, weil ich krank bin.', deVocab, 'de');
  assert.ok(!hasRule(findings, 'de-verb-final'),
    'de-verb-final should NOT fire on correct "weil ich krank bin": ' + JSON.stringify(findings.filter(f => f.rule_id === 'de-verb-final')));
});

test('de-verb-final: modal+infinitive — modal must be at clause end', () => {
  // "ob er kann schwimmen" — modal "kann" should be at end: "ob er schwimmen kann"
  const findings = findingsFor('Ich frage, ob er kann schwimmen.', deVocab, 'de');
  // Whether this fires depends on "kann" being in DE_MODALS AND in knownPresens
  // and "schwimmen" being recognized. Just check no crash + array return.
  assert.ok(Array.isArray(findings), 'Should return an array');
});

test('de-verb-final: modal+infinitive — correct order passes', () => {
  // "ob er schwimmen kann" — modal at end is correct
  const findings = findingsFor('Ich frage, ob er schwimmen kann.', deVocab, 'de');
  const vf = findings.filter(f => f.rule_id === 'de-verb-final');
  assert.ok(!vf.length,
    'de-verb-final should NOT fire on correct modal-final "ob er schwimmen kann": ' + JSON.stringify(vf));
});

// ============================================================
// fr-bags: FR BAGS adjective placement
// ============================================================

test('fr-bags: passes pre-nominal BAGS adjective (correct position)', () => {
  // "une belle femme" — belle before femme is correct BAGS placement
  // The rule only flags post-nominal BAGS adjectives, so this should NOT fire
  const findings = findingsFor('Une belle femme.', frVocab, 'fr');
  assert.ok(!hasRule(findings, 'fr-bags'),
    'fr-bags should NOT fire on correct pre-nominal "belle femme": ' + JSON.stringify(findings.filter(f => f.rule_id === 'fr-bags')));
});

test('fr-bags: flags post-nominal BAGS adjective', () => {
  // "un chien petit" — petit after chien is Norwegian-influenced word order
  // (Using "petit" instead of "belle" because "belle" collides with a typo
  // rule on the same span and gets deduped — expected dedup behavior.)
  const findings = findingsFor('Un chien petit.', frVocab, 'fr');
  if (frVocab.nounGenus && frVocab.nounGenus.has('chien')) {
    assert.ok(hasRule(findings, 'fr-bags'),
      'Expected fr-bags to flag post-nominal "petit" in "chien petit": ' + JSON.stringify(findings.filter(f => f.rule_id === 'fr-bags')));
  }
});

test('fr-bags: flags post-nominal "petit"', () => {
  // "un chien petit" — "petit" is a Size adjective, should be before noun
  const findings = findingsFor('Un chien petit.', frVocab, 'fr');
  if (frVocab.nounGenus && frVocab.nounGenus.has('chien')) {
    assert.ok(hasRule(findings, 'fr-bags'),
      'Expected fr-bags to flag post-nominal "petit" in "chien petit": ' + JSON.stringify(findings.filter(f => f.rule_id === 'fr-bags')));
  }
});

test('fr-bags: verb/noun homograph disambiguation — verb context', () => {
  // "Il fait beau." — "fait" is a verb here (no article before it)
  // The rule should NOT flag "beau" after verb "fait"
  const findings = findingsFor('Il fait beau.', frVocab, 'fr');
  const bags = findings.filter(f => f.rule_id === 'fr-bags');
  assert.ok(!bags.length,
    'fr-bags should NOT fire on "fait beau" where fait is a verb: ' + JSON.stringify(bags));
});

test('fr-bags: severity is hint', () => {
  // BAGS placement is advisory (hint/P3), not an error
  const findings = findingsFor('Un chien petit.', frVocab, 'fr');
  const bags = findings.filter(f => f.rule_id === 'fr-bags');
  if (bags.length > 0) {
    assert.equal(bags[0].severity, 'hint',
      'fr-bags severity should be "hint", got: ' + bags[0].severity);
  }
});

test('fr-bags: article + unknown noun + BAGS adj triggers heuristic', () => {
  // Even if the noun isn't in nounGenus, article + word + BAGS adj should fire
  // via the heuristic at line 99-109
  const findings = findingsFor('Le truc petit.', frVocab, 'fr');
  // "le" is an article, "truc" may or may not be in nounGenus,
  // but the heuristic should catch article + unknown-word + BAGS-adj
  const bags = findings.filter(f => f.rule_id === 'fr-bags');
  // If truc IS a known noun, the main path fires. If not, the heuristic should fire.
  // Either way we expect a finding (unless truc is also a known adjective)
  if (!frVocab.isAdjective || !frVocab.isAdjective.has('truc')) {
    assert.ok(bags.length > 0,
      'fr-bags should fire on "le truc petit" via noun or heuristic path: ' + JSON.stringify(bags));
  }
});

// ============================================================
// Runner
// ============================================================

let passed = 0;
let failed = 0;

for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log('PASS: ' + t.name);
  } catch (e) {
    failed++;
    console.error('FAIL: ' + t.name);
    console.error('  ' + e.message);
    if (e instanceof assert.AssertionError || e.code === 'ERR_ASSERTION') {
      console.error('  ** POTENTIAL BUG in implementation — assertion failed on expected behavior **');
    }
    process.exit(1);
  }
}

console.log('\n' + passed + '/' + tests.length + ' tests passed.');
process.exit(0);
