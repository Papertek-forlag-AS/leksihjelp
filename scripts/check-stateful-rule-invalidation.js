#!/usr/bin/env node
/**
 * Leksihjelp -- Stateful Rule Invalidation Release Gate (INFRA-10, Phase 13)
 *
 * Validates that document-level rules (kind: 'document') produce correct
 * findings on drifting text, zero findings on fixed text, and correct
 * findings again on re-drifted text. This proves the "fresh recompute"
 * design: no ghost flags from cached state between calls.
 *
 * The gate PASSES when no doc-drift rule files exist yet (Plans 02/03
 * haven't run). It only fires assertions when actual rule files are found.
 *
 * Usage:
 *   node scripts/check-stateful-rule-invalidation.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE_PATH = path.join(ROOT, 'extension/content/spell-check-core.js');
const GRAMMAR_TABLES_PATH = path.join(ROOT, 'extension/content/spell-rules/grammar-tables.js');

// Doc-drift rule files that Plans 02/03 will create.
const DOC_DRIFT_RULES = [
  {
    file: 'extension/content/spell-rules/doc-drift-de-address.js',
    lang: 'de',
    vocabFile: 'extension/data/de.json',
    driftText: 'Du bist nett. Du kommst morgen. Hast du Zeit? Können Sie mir helfen?',
    fixedText: 'Du bist nett. Du kommst morgen. Hast du Zeit? Kannst du mir helfen?',
    ruleId: 'doc-drift-de-address',
  },
  {
    file: 'extension/content/spell-rules/doc-drift-fr-address.js',
    lang: 'fr',
    vocabFile: 'extension/data/fr.json',
    driftText: 'Tu es gentil. Tu viens demain. Tu chantes bien. Vous etes aimable.',
    fixedText: 'Tu es gentil. Tu viens demain. Tu chantes bien. Tu es aimable.',
    ruleId: 'doc-drift-fr-address',
  },
  {
    file: 'extension/content/spell-rules/doc-drift-nb-register.js',
    lang: 'nb',
    vocabFile: 'extension/data/nb.json',
    driftText: 'Jenta gikk til skolen. Hun leste boken efter lunsj. Solen skinte og det var sne i gata.',
    fixedText: 'Jenta gikk til skolen. Hun leste boka etter lunsj. Sola skinte og det var sno i gata.',
    ruleId: 'doc-drift-nb-register',
  },
  {
    file: 'extension/content/spell-rules/doc-drift-nn-infinitive.js',
    lang: 'nn',
    vocabFile: 'extension/data/nn.json',
    driftText: 'Eg vil akseptere tilbodet. Han prover a analysera situasjonen. Ho likar a dansere.',
    fixedText: 'Eg vil akseptere tilbodet. Han prover a analysere situasjonen. Ho likar a dansere.',
    ruleId: 'doc-drift-nn-infinitive',
  },
];

function resetGlobals() {
  if (typeof global.self === 'undefined') global.self = global;
  global.self.__lexiSpellRules = [];
  delete global.self.__lexiSpellCore;
  delete global.self.__lexiGrammarTables;
}

function clearAllCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes('spell-check-core') ||
        key.includes('spell-rules') ||
        key.includes('grammar-tables')) {
      delete require.cache[key];
    }
  }
}

function loadVocabIndexes(vocabPath) {
  if (!fs.existsSync(vocabPath)) return {};
  const data = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));

  // Build minimal vocab indexes matching what vocab-seam-core provides
  const validWords = new Set();
  const verbInfinitive = new Set();
  const nounGenus = new Map();
  const knownPresens = new Set();
  const knownPreteritum = new Set();

  const BANK_TO_POS = {
    verbbank: 'verb', nounbank: 'noun', adjectivebank: 'adjective',
    articlesbank: 'article', generalbank: 'other', numbersbank: 'number',
    phrasesbank: 'phrase', pronounsbank: 'pronoun',
  };

  for (const bank of Object.keys(BANK_TO_POS)) {
    const bankData = data[bank];
    if (!bankData) continue;
    for (const [, entry] of Object.entries(bankData)) {
      const w = (entry.word || '').toLowerCase();
      if (w) validWords.add(w);
      if (bank === 'verbbank') {
        verbInfinitive.add(w);
        if (entry.conjugations) {
          for (const [, forms] of Object.entries(entry.conjugations)) {
            if (typeof forms === 'object' && forms !== null) {
              for (const f of Object.values(forms)) {
                if (typeof f === 'string') {
                  const parts = f.toLowerCase().split(/\s+/);
                  for (const p of parts) if (p) validWords.add(p);
                }
              }
            }
          }
        }
      }
      if (bank === 'nounbank' && entry.genus) {
        nounGenus.set(w, entry.genus);
      }
    }
  }

  return { validWords, verbInfinitive, nounGenus, knownPresens, knownPreteritum };
}

function main() {
  let testedCount = 0;

  for (const spec of DOC_DRIFT_RULES) {
    const ruleAbsPath = path.join(ROOT, spec.file);
    if (!fs.existsSync(ruleAbsPath)) {
      // Rule file doesn't exist yet — Plans 02/03 will create it. Skip gracefully.
      continue;
    }

    const vocabAbsPath = path.join(ROOT, spec.vocabFile);
    const vocab = loadVocabIndexes(vocabAbsPath);

    // Fresh load for each rule
    resetGlobals();
    clearAllCache();
    require(CORE_PATH);
    require(GRAMMAR_TABLES_PATH);
    require(ruleAbsPath);

    const core = global.self.__lexiSpellCore;
    if (!core || typeof core.check !== 'function') {
      process.stderr.write('[check-stateful-rule-invalidation] FAIL: spell-check-core did not load properly\n');
      process.exit(1);
    }

    // Step 1: Run on drifting text — expect findings from this rule
    const findings1 = core.check(spec.driftText, vocab, { lang: spec.lang });
    const driftFindings1 = findings1.filter(f => f.rule_id === spec.ruleId);
    if (driftFindings1.length === 0) {
      process.stderr.write(
        '[check-stateful-rule-invalidation] FAIL: ' + spec.ruleId +
        ' produced 0 findings on drifting text\n' +
        '  text: ' + spec.driftText.slice(0, 100) + '\n'
      );
      process.exit(1);
    }

    // Step 2: Run on fixed text (no drift) — expect zero findings from this rule
    const findings2 = core.check(spec.fixedText, vocab, { lang: spec.lang });
    const driftFindings2 = findings2.filter(f => f.rule_id === spec.ruleId);
    if (driftFindings2.length !== 0) {
      process.stderr.write(
        '[check-stateful-rule-invalidation] FAIL: ' + spec.ruleId +
        ' produced ' + driftFindings2.length + ' ghost findings on fixed text\n' +
        '  text: ' + spec.fixedText.slice(0, 100) + '\n'
      );
      process.exit(1);
    }

    // Step 3: Run on drifting text again — findings must return (no stale cache)
    const findings3 = core.check(spec.driftText, vocab, { lang: spec.lang });
    const driftFindings3 = findings3.filter(f => f.rule_id === spec.ruleId);
    if (driftFindings3.length === 0) {
      process.stderr.write(
        '[check-stateful-rule-invalidation] FAIL: ' + spec.ruleId +
        ' produced 0 findings on re-drifted text (stale cache?)\n'
      );
      process.exit(1);
    }

    testedCount++;
  }

  if (testedCount === 0) {
    console.log('[check-stateful-rule-invalidation] PASS: no doc-drift rule files found yet (Plans 02/03 pending) — gate passes gracefully');
  } else {
    console.log('[check-stateful-rule-invalidation] PASS: ' + testedCount + '/' + DOC_DRIFT_RULES.length + ' doc-drift rules validated (drift -> clean -> drift cycle)');
  }
  process.exit(0);
}

main();
