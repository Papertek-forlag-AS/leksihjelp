#!/usr/bin/env node
/**
 * Leksihjelp — Governance Data Release Gate (INFRA-09, Phase 06-02)
 *
 * Validates that governance data banks (registerbank, collocationbank, phrasebank)
 * exist and have correct shape in bundled vocab data files when present.
 *
 * Behavior:
 * - If no governance banks found in any language: PASS with "no governance data" note.
 *   This is the expected state before papertek-vocabulary lands governance banks.
 * - If governance banks ARE present: validate structural shape per bank type.
 * - Fails only when found banks have entries that fail shape validation.
 *
 * Shape requirements:
 *   registerbank:    entries must have `word` and `formal` fields
 *   collocationbank: entries must have `trigger` and `fix` fields
 *   phrasebank:      entries must have `trigger` and `suggestion` fields
 *
 * Exit 0 on pass, 1 on any shape validation failure.
 *
 * Usage:
 *   node scripts/check-governance-data.js
 *
 * Zero npm deps. Node 18+. CommonJS.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'extension', 'data');

const EXPECTED_BANKS = ['registerbank', 'collocationbank', 'phrasebank'];

const BANK_SHAPE = {
  registerbank: {
    required: ['word', 'formal'],
    description: 'registerbank entries require "word" and "formal" fields',
  },
  collocationbank: {
    required: ['trigger', 'fix'],
    description: 'collocationbank entries require "trigger" and "fix" fields',
  },
  phrasebank: {
    required: ['trigger', 'suggestion'],
    description: 'phrasebank entries require "trigger" and "suggestion" fields',
  },
};

// Languages to check — matches the sync-vocab supported set
const LANGUAGES = ['nb', 'nn', 'de', 'es', 'fr', 'en'];

function main() {
  let totalBanksFound = 0;
  let totalEntriesChecked = 0;
  let failures = [];

  for (const lang of LANGUAGES) {
    const dataFile = path.join(DATA_DIR, lang + '.json');
    if (!fs.existsSync(dataFile)) {
      console.log('  [' + lang + '] SKIP: no data file');
      continue;
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (e) {
      failures.push({ lang, bank: '<parse>', reason: 'Failed to parse ' + lang + '.json: ' + e.message });
      continue;
    }

    let langBanks = 0;
    for (const bankName of EXPECTED_BANKS) {
      const bank = data[bankName];
      if (!bank || typeof bank !== 'object') continue;

      const entries = Object.entries(bank);
      if (entries.length === 0) continue;

      langBanks++;
      totalBanksFound++;
      const shape = BANK_SHAPE[bankName];

      for (const [entryId, entry] of entries) {
        totalEntriesChecked++;
        if (!entry || typeof entry !== 'object') {
          failures.push({
            lang,
            bank: bankName,
            reason: 'entry "' + entryId + '" is not an object',
          });
          continue;
        }

        for (const field of shape.required) {
          if (entry[field] === undefined || entry[field] === null) {
            failures.push({
              lang,
              bank: bankName,
              reason: 'entry "' + entryId + '" missing required field "' + field + '"',
            });
          }
        }
      }

      console.log('  [' + lang + '/' + bankName + '] ' + entries.length + ' entries checked');
    }

    if (langBanks === 0) {
      console.log('  [' + lang + '] no governance banks found');
    }
  }

  // Print failures
  if (failures.length > 0) {
    console.log('\n[check-governance-data] Shape validation failures:');
    for (const f of failures) {
      console.log('  [' + f.lang + '/' + f.bank + '] ' + f.reason);
    }
  }

  // Summary
  if (totalBanksFound === 0) {
    console.log('\n[check-governance-data] PASS: no governance data banks found in any language (pre-data-sync state)');
    process.exit(0);
  }

  if (failures.length > 0) {
    console.log('\n[check-governance-data] FAIL: ' + failures.length + ' shape violation(s) across ' + totalBanksFound + ' bank(s), ' + totalEntriesChecked + ' entries');
    process.exit(1);
  }

  console.log('\n[check-governance-data] PASS: ' + totalBanksFound + ' governance bank(s), ' + totalEntriesChecked + ' entries — all shapes valid');
  process.exit(0);
}

main();
