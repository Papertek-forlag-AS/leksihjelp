#!/usr/bin/env node
/**
 * One-off mirror script: copy the gustar-class enrichment from
 * papertek-vocabulary/lexicon/es/{verbbank,grammarbank}.json into
 * extension/data/es.json, so leksihjelp can ship Phase 32-03 without
 * waiting for a papertek-vocabulary deploy + npm run sync-vocab.
 *
 * The canonical source is papertek-vocabulary; the next sync-vocab
 * run will overwrite this file with the API copy and pick up the
 * same enrichment.
 *
 * Usage:
 *   node scripts/_apply-gustar-class.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const VOCAB_ROOT = path.resolve(__dirname, '..', '..', 'papertek-vocabulary', 'vocabulary', 'lexicon', 'es');
const SRC_VERB = path.join(VOCAB_ROOT, 'verbbank.json');
const SRC_GRAMMAR = path.join(VOCAB_ROOT, 'grammarbank.json');
const DST = path.join(__dirname, '..', 'extension', 'data', 'es.json');

const GUSTAR_VERBS = new Set([
  'gustar', 'encantar', 'interesar', 'doler', 'faltar',
  'sobrar', 'parecer', 'quedar', 'apetecer', 'molestar',
]);

const srcVerb = JSON.parse(fs.readFileSync(SRC_VERB, 'utf8'));
const srcGrammar = JSON.parse(fs.readFileSync(SRC_GRAMMAR, 'utf8'));
const dst = JSON.parse(fs.readFileSync(DST, 'utf8'));

// 1. Mirror verb_class markers and any new entries onto dst.verbbank.
let marked = 0;
let added = 0;
for (const [srcId, srcEntry] of Object.entries(srcVerb)) {
  if (srcId === '_metadata') continue;
  if (!srcEntry || srcEntry.verb_class !== 'gustar-class') continue;

  // Find matching entry in dst by word.
  let dstId = null;
  for (const [id, e] of Object.entries(dst.verbbank)) {
    if (e && e.word === srcEntry.word && e.type === 'verb') {
      dstId = id;
      break;
    }
  }

  if (dstId) {
    if (dst.verbbank[dstId].verb_class !== 'gustar-class') {
      dst.verbbank[dstId].verb_class = 'gustar-class';
      marked++;
    }
  } else {
    // Not present — copy the lexicon entry over. The lexicon entry
    // carries all the fields leksihjelp needs (word, type, conjugations,
    // verb_class). It will likely lack search-index/audio/CEFR fields,
    // but those don't affect spell-check rule operation.
    dst.verbbank[srcId] = JSON.parse(JSON.stringify(srcEntry));
    added++;
  }
}

// 2. Mirror pedagogy.gustar_class onto dst.grammarbank.
if (!dst.grammarbank) dst.grammarbank = {};
if (!dst.grammarbank.pedagogy) dst.grammarbank.pedagogy = {};
dst.grammarbank.pedagogy.gustar_class = JSON.parse(JSON.stringify(srcGrammar.pedagogy.gustar_class));

fs.writeFileSync(DST, JSON.stringify(dst, null, 2) + '\n', 'utf8');

// Verify.
const flagged = Object.values(dst.verbbank)
  .filter(v => v && v.verb_class === 'gustar-class')
  .map(v => v.word)
  .sort();
const expected = [...GUSTAR_VERBS].sort();
if (JSON.stringify(flagged) !== JSON.stringify(expected)) {
  throw new Error(`mismatch. flagged=${flagged.join(',')} expected=${expected.join(',')}`);
}
console.log(`[ok] mirrored to ${path.relative(process.cwd(), DST)}: marked ${marked}, added ${added}, pedagogy.gustar_class set`);
