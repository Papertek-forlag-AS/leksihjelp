#!/usr/bin/env node

/**
 * Vocabulary Sync Script (v3)
 *
 * Fetches vocabulary data from the Papertek Vocabulary API v3 (lexicon)
 * and writes to extension/data/*.json
 *
 * v3 provides:
 *   - All data in a single lookup (no separate translations fetch)
 *   - Bidirectional links (linkedTo) with examples
 *   - Typos and acceptedForms for fuzzy matching
 *   - Norwegian (nb, nn) and English (en) vocabularies
 *   - Grammar features from manifest
 *
 * Usage:
 *   node scripts/sync-vocab.js                    # Sync all languages (no audio)
 *   node scripts/sync-vocab.js de                 # Sync only German
 *   node scripts/sync-vocab.js --with-audio       # Sync all with audio
 *   node scripts/sync-vocab.js de --with-audio    # Sync German with audio
 *   node scripts/sync-vocab.js --with-audio --force-audio  # Re-download audio
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const V3_API_BASE = process.env.PAPERTEK_VOCAB_API || 'https://papertek-vocabulary.vercel.app/api/vocab';
const LEGACY_API_BASE = process.env.PAPERTEK_API_BASE || 'https://www.papertek.no';

// Build-time API key for the Papertek vocabulary API. SEPARATE from the
// extension's bundled `lk_…` key so CI can rotate the build-time key
// independently of shipped extension code. Initial value can be the same
// as the extension key during rollout, but should be issued as a distinct
// key (e.g. `ck_…` ci-tier) once available.
const PAPERTEK_VOCAB_API_KEY = process.env.PAPERTEK_VOCAB_API_KEY;
if (!PAPERTEK_VOCAB_API_KEY) {
  console.error('Error: PAPERTEK_VOCAB_API_KEY env var is required.');
  console.error('  Set it in your shell or CI secret store before running this script.');
  console.error('  See README ("Vocab API authentication") for context.');
  process.exit(1);
}
const VOCAB_AUTH_HEADERS = { 'X-API-Key': PAPERTEK_VOCAB_API_KEY };
const OUTPUT_DIR = path.join(__dirname, '..', 'extension', 'data');
const AUDIO_DIR = path.join(__dirname, '..', 'extension', 'audio');

// Audio ZIP download URLs (from legacy API)
const AUDIO_ZIPS = {
  de: `${LEGACY_API_BASE}/shared/vocabulary/downloads/audio-de.zip`,
  es: `${LEGACY_API_BASE}/shared/vocabulary/downloads/audio-es.zip`,
  fr: `${LEGACY_API_BASE}/shared/vocabulary/downloads/audio-fr.zip`
};

// Language display names
const LANG_NAMES = {
  de: 'Tysk',
  es: 'Spansk',
  fr: 'Fransk',
  nb: 'Norsk bokmål',
  nn: 'Norsk nynorsk',
  en: 'Engelsk'
};

const BANKS = [
  'verbbank',
  'nounbank',
  'adjectivebank',
  'articlesbank',
  'generalbank',
  'numbersbank',
  'phrasesbank',
  'pronounsbank',
  'languagesbank',      // Phase 05.1 Gap B
  'nationalitiesbank',  // Phase 05.1 Gap B
  'collocationbank',    // v2.0 data migration
  'grammarbank',        // v2.0 data migration
];

// Banks fetched via export endpoint (entries don't have searchable words)
const GOVERNANCE_BANKS = ['collocationbank', 'grammarbank'];

async function fetchJson(url) {
  const response = await fetch(url, { headers: VOCAB_AUTH_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch the v3 manifest to discover languages, banks, and grammar features.
 */
async function fetchManifest() {
  console.log('Fetching v3 manifest...');
  const manifest = await fetchJson(`${V3_API_BASE}/v3/manifest`);
  console.log(`  Languages: ${Object.keys(manifest.languages).join(', ')}`);
  console.log(`  Link pairs: ${manifest.links.length}`);
  return manifest;
}

/**
 * Collect all word IDs using the bulk list endpoint (preferred)
 * or fall back to letter-by-letter search.
 */
async function collectAllWordIds(langCode) {
  // Try bulk list endpoint first
  try {
    const res = await fetchJson(`${V3_API_BASE}/v3/list/${langCode}`);
    if (res.ids && res.ids.length > 0) {
      return res.ids;
    }
  } catch {
    console.log('  Bulk list not available, falling back to letter search...');
  }

  // Fallback: search by each letter
  const alphabet = 'abcdefghijklmnopqrstuvwxyzäöüáéíóúàèùâêîôûçñ'.split('');
  const allIds = new Set();

  for (const letter of alphabet) {
    try {
      const res = await fetchJson(`${V3_API_BASE}/v3/search/${langCode}?q=${encodeURIComponent(letter)}&limit=10000`);
      for (const r of res.results) {
        allIds.add(r.id);
      }
    } catch {
      // Some letters may return 0 results, that's fine
    }
  }

  return [...allIds];
}

/**
 * Fetch all word entries for a language via v3 lookup.
 */
async function fetchAllEntries(langCode, manifest) {
  const langInfo = manifest.languages[langCode];
  if (!langInfo) {
    throw new Error(`Language ${langCode} not found in manifest`);
  }

  console.log(`  Total words in API: ${langInfo.totalWords}`);

  // Collect all word IDs via search
  console.log('  Collecting word IDs...');
  const allIds = await collectAllWordIds(langCode);
  console.log(`  Found ${allIds.length} unique word IDs`);

  // Fetch full lookups in batches
  const BATCH_SIZE = 50;
  const entries = {};

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batch = allIds.slice(i, i + BATCH_SIZE);
    const lookups = await Promise.all(
      batch.map(id =>
        fetchJson(`${V3_API_BASE}/v3/lookup/${langCode}/${id}`)
          .catch(err => {
            console.warn(`    Warning: Failed to fetch ${id}: ${err.message}`);
            return null;
          })
      )
    );

    for (const entry of lookups) {
      if (!entry || !entry._meta) continue;
      entries[entry._meta.wordId] = entry;
    }

    const progress = Math.min(allIds.length, i + BATCH_SIZE);
    process.stdout.write(`\r  Fetching entries: ${progress}/${allIds.length}`);
  }
  console.log('');

  return entries;
}

/**
 * Organize entries into banks and build the extension-compatible data structure.
 */
function buildLanguageData(langCode, entries, manifest, nbEntries = null) {
  const result = {
    _metadata: {
      language: langCode,
      languageName: LANG_NAMES[langCode] || langCode,
      generatedAt: new Date().toISOString(),
      source: 'papertek-api-v3',
      apiBase: V3_API_BASE
    }
  };

  let totalWords = 0;

  for (const bank of BANKS) {
    result[bank] = {};
  }

  for (const [wordId, entry] of Object.entries(entries)) {
    const bank = entry._meta?.bank;
    if (!bank || !result[bank]) continue;

    // Remove _meta and _generatedFrom from the entry (extension doesn't need them)
    const { _meta, _generatedFrom, _enriched, ...cleanEntry } = entry;

    // Resolve translations from linkedTo
    if (cleanEntry.linkedTo) {
      if (langCode === 'nn') {
        // Nynorsk → resolve translation from bokmål link
        const nbLink = cleanEntry.linkedTo.nb;
        if (nbLink?.primary && !cleanEntry.translation) {
          if (nbEntries && nbEntries[nbLink.primary]) {
            cleanEntry.translation = nbEntries[nbLink.primary].word || null;
          } else {
            cleanEntry.translation = nbLink.primary.replace(/_[a-z]+$/, '');
          }
        }
      } else if (langCode === 'en') {
        // English → resolve translation from bokmål link
        const nbLink = cleanEntry.linkedTo.nb || cleanEntry.linkedTo.nn;
        if (nbLink?.primary && !cleanEntry.translation) {
          if (nbEntries && nbEntries[nbLink.primary]) {
            cleanEntry.translation = nbEntries[nbLink.primary].word || null;
          } else {
            cleanEntry.translation = nbLink.primary.replace(/_[a-z]+$/, '');
          }
        }
        if ((!cleanEntry.examples || cleanEntry.examples.length === 0) && nbLink?.examples) {
          cleanEntry.examples = nbLink.examples;
        }
      } else if (langCode !== 'nb') {
        // Foreign languages (de, es, fr) → resolve from nb link
        const nbLink = cleanEntry.linkedTo.nb || cleanEntry.linkedTo.nn;
        if (nbLink) {
          if (!cleanEntry.translation && nbLink.primary) {
            if (nbEntries && nbEntries[nbLink.primary]) {
              cleanEntry.translation = nbEntries[nbLink.primary].word || null;
            } else {
              cleanEntry.translation = nbLink.primary.replace(/_[a-z]+$/, '');
            }
          }
          if ((!cleanEntry.examples || cleanEntry.examples.length === 0) && nbLink.examples) {
            cleanEntry.examples = nbLink.examples;
          }
          if (!cleanEntry.explanation && nbLink.explanation) {
            cleanEntry.explanation = { _description: nbLink.explanation };
          }
        }
      }
    }

    result[bank][wordId] = cleanEntry;
    totalWords++;
  }

  // Log bank counts
  for (const bank of BANKS) {
    const count = Object.keys(result[bank]).length;
    if (count > 0) {
      console.log(`  ${bank}: ${count} words`);
    } else {
      delete result[bank]; // Don't include empty banks
    }
  }

  result._metadata.totalWords = totalWords;
  return result;
}

/**
 * Fetch governance banks (collocationbank, grammarbank) from the export endpoint.
 * These banks have abstract IDs not discoverable via search, so we pull them
 * directly from the streaming export response.
 */
async function fetchGovernanceBanks(langCode) {
  try {
    const url = `${V3_API_BASE}/v3/export/${langCode}`;
    const response = await fetch(url, { headers: VOCAB_AUTH_HEADERS });
    if (!response.ok) return {};
    const data = await response.json();
    const result = {};
    for (const bank of GOVERNANCE_BANKS) {
      if (data[bank] && Object.keys(data[bank]).length > 0) {
        result[bank] = data[bank];
      }
    }
    return result;
  } catch (err) {
    console.warn(`  Warning: Failed to fetch governance banks for ${langCode}: ${err.message}`);
    return {};
  }
}

/**
 * Sync grammar features from the v3 manifest.
 */
function syncGrammarFeaturesFromManifest(langCode, manifest) {
  console.log(`  Syncing grammar features...`);

  const grammarData = manifest.grammarFeatures?.[langCode];
  if (!grammarData) {
    console.log(`  No grammar features in manifest for ${langCode}`);
    // Fall back to v1 grammar features for existing languages
    return syncLegacyGrammarFeatures(langCode);
  }

  const outputPath = path.join(OUTPUT_DIR, `grammarfeatures-${langCode}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(grammarData, null, 2));
  const count = grammarData.features ? grammarData.features.length : 0;
  console.log(`  Written ${count} grammar features to grammarfeatures-${langCode}.json`);
  return grammarData;
}

/**
 * Fall back to v1 grammar features endpoint for languages not yet in v3 manifest.
 */
async function syncLegacyGrammarFeatures(langCode) {
  const outputPath = path.join(OUTPUT_DIR, `grammarfeatures-${langCode}.json`);

  // If file already exists, keep it
  if (fs.existsSync(outputPath)) {
    console.log(`  Using existing grammarfeatures-${langCode}.json`);
    return JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  }

  console.log(`  Fetching legacy grammar features for ${langCode}...`);
  try {
    const features = await fetchJson(`${LEGACY_API_BASE}/api/vocab/v1/grammarfeatures?language=${langCode}`);
    fs.writeFileSync(outputPath, JSON.stringify(features, null, 2));
    const count = features.features ? features.features.length : 0;
    console.log(`  Written ${count} features (legacy) to grammarfeatures-${langCode}.json`);
    return features;
  } catch (error) {
    console.error(`  Error fetching legacy grammar features: ${error.message}`);
    return null;
  }
}

/**
 * Download and extract audio ZIP file for a language.
 */
async function syncAudioFiles(langCode) {
  const zipUrl = AUDIO_ZIPS[langCode];
  if (!zipUrl) {
    console.log(`  No audio ZIP available for ${langCode}`);
    return;
  }

  console.log(`  Syncing audio files...`);

  const langAudioDir = path.join(AUDIO_DIR, langCode);
  if (!fs.existsSync(langAudioDir)) {
    fs.mkdirSync(langAudioDir, { recursive: true });
  }

  const existingFiles = fs.existsSync(langAudioDir) ? fs.readdirSync(langAudioDir) : [];
  if (existingFiles.length > 0 && !forceAudio) {
    console.log(`  Audio folder already has ${existingFiles.length} files (skipping)`);
    console.log(`  Use --force-audio to re-download`);
    return;
  }

  const zipPath = path.join(AUDIO_DIR, `audio-${langCode}.zip`);

  try {
    console.log(`  Downloading ${zipUrl}...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`  Downloaded ${sizeMB} MB`);

    console.log(`  Extracting to ${langAudioDir}...`);
    execSync(`unzip -o -q "${zipPath}" -d "${langAudioDir}"`, { stdio: 'pipe' });

    const extractedFiles = fs.readdirSync(langAudioDir).filter(f => f.endsWith('.mp3'));
    console.log(`  Extracted ${extractedFiles.length} audio files`);

    fs.unlinkSync(zipPath);
    console.log(`  Audio sync complete`);
  } catch (error) {
    console.error(`  Error syncing audio: ${error.message}`);
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

/**
 * Sync a single language.
 */
// Cache for Norwegian entries (used for translation resolution)
let nbEntriesCache = null;

async function ensureNbEntries(manifest) {
  if (nbEntriesCache) return nbEntriesCache;
  if (!manifest.languages.nb) return null;
  console.log('\nPre-fetching Norwegian (nb) entries for translation resolution...');
  nbEntriesCache = await fetchAllEntries('nb', manifest);
  return nbEntriesCache;
}

async function syncLanguage(langCode, manifest, withAudio = false) {
  console.log(`\nSyncing ${LANG_NAMES[langCode] || langCode} (${langCode})...`);

  // Pre-fetch Norwegian entries for translation resolution (all languages except nb itself)
  let nbEntries = null;
  if (langCode !== 'nb') {
    nbEntries = await ensureNbEntries(manifest);
  }

  // Fetch all entries from v3
  const entries = await fetchAllEntries(langCode, manifest);

  // Build extension-compatible data structure
  const data = buildLanguageData(langCode, entries, manifest, nbEntries);

  // Fetch governance banks directly from export (not discoverable via search)
  const govBanks = await fetchGovernanceBanks(langCode);
  for (const [bankName, bankData] of Object.entries(govBanks)) {
    const count = Object.keys(bankData).length;
    if (count > 0) {
      data[bankName] = bankData;
      console.log(`  ${bankName}: ${count} entries (from export)`);
    }
  }

  // Write to file
  const outputPath = path.join(OUTPUT_DIR, `${langCode}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`  Written to ${langCode}.json`);
  console.log(`  Total: ${data._metadata.totalWords} words`);

  // Sync grammar features
  syncGrammarFeaturesFromManifest(langCode, manifest);

  // Sync audio if requested
  if (withAudio) {
    await syncAudioFiles(langCode);
  }

  return data;
}

// Global flag for force re-download
let forceAudio = false;

async function main() {
  const args = process.argv.slice(2);

  // Check for flags
  const withAudio = args.includes('--with-audio');
  forceAudio = args.includes('--force-audio');
  const langArgs = args.filter(arg => !arg.startsWith('--'));

  // Fetch manifest
  const manifest = await fetchManifest();
  const availableLangs = Object.keys(manifest.languages);

  // Determine which languages to sync
  let langsToSync;
  if (langArgs.length === 0) {
    // Default: sync all languages used by the extension
    langsToSync = ['de', 'es', 'fr', 'en', 'nb', 'nn'].filter(l => availableLangs.includes(l));
  } else {
    langsToSync = langArgs.filter(arg => availableLangs.includes(arg));
    if (langsToSync.length === 0) {
      console.error(`Unknown language(s): ${langArgs.join(', ')}`);
      console.error(`Available: ${availableLangs.join(', ')}`);
      process.exit(1);
    }
  }

  console.log('\nPapertek Vocabulary Sync (v3)');
  console.log('=============================');
  console.log(`API: ${V3_API_BASE}`);
  console.log(`Languages: ${langsToSync.join(', ')}`);
  console.log(`Audio: ${withAudio ? 'Yes' : 'No (use --with-audio to include)'}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Sync each language
  for (const lang of langsToSync) {
    await syncLanguage(lang, manifest, withAudio);
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
