#!/usr/bin/env node

/**
 * Vocabulary Sync Script
 *
 * Fetches vocabulary data from the Papertek API and writes to extension/data/*.json
 *
 * Usage:
 *   node scripts/sync-vocab.js                    # Sync all languages (no audio)
 *   node scripts/sync-vocab.js de                 # Sync only German
 *   node scripts/sync-vocab.js --with-audio       # Sync all languages with audio ZIP files
 *   node scripts/sync-vocab.js de --with-audio    # Sync German with audio
 *   node scripts/sync-vocab.js --with-audio --force-audio  # Re-download audio even if exists
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const API_BASE = process.env.PAPERTEK_API_BASE || 'https://www.papertek.no';
const OUTPUT_DIR = path.join(__dirname, '..', 'extension', 'data');
const AUDIO_DIR = path.join(__dirname, '..', 'extension', 'audio');

// Audio ZIP download URLs
const AUDIO_ZIPS = {
  de: `${API_BASE}/shared/vocabulary/downloads/audio-de.zip`,
  es: `${API_BASE}/shared/vocabulary/downloads/audio-es.zip`,
  fr: `${API_BASE}/shared/vocabulary/downloads/audio-fr.zip`
};

const LANGUAGES = {
  de: {
    code: 'de',
    name: 'Tysk',
    coreEndpoint: '/api/vocab/v1/core/german',
    translationEndpoint: '/api/vocab/v1/translations/de-nb'
  },
  es: {
    code: 'es',
    name: 'Spansk',
    coreEndpoint: '/api/vocab/v1/core/spanish',
    translationEndpoint: '/api/vocab/v1/translations/es-nb'
  },
  fr: {
    code: 'fr',
    name: 'Fransk',
    coreEndpoint: '/api/vocab/v1/core/french',
    translationEndpoint: '/api/vocab/v1/translations/fr-nb'
  }
};

const BANKS = [
  'verbbank',
  'nounbank',
  'adjectivebank',
  'articlesbank',
  'generalbank',
  'numbersbank',
  'phrasesbank',
  'pronounsbank'
];

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Download and extract audio ZIP file for a language
 */
async function syncAudioFiles(langCode) {
  const zipUrl = AUDIO_ZIPS[langCode];
  if (!zipUrl) {
    console.log(`\n  No audio ZIP available for ${langCode}`);
    return;
  }

  console.log(`\n  Syncing audio files...`);

  // Ensure audio directory exists
  const langAudioDir = path.join(AUDIO_DIR, langCode);
  if (!fs.existsSync(langAudioDir)) {
    fs.mkdirSync(langAudioDir, { recursive: true });
  }

  // Check if audio files already exist
  const existingFiles = fs.existsSync(langAudioDir) ? fs.readdirSync(langAudioDir) : [];
  if (existingFiles.length > 0 && !forceAudio) {
    console.log(`  Audio folder already has ${existingFiles.length} files (skipping)`);
    console.log(`  Use --force-audio to re-download`);
    return;
  }

  const zipPath = path.join(AUDIO_DIR, `audio-${langCode}.zip`);

  try {
    // Download ZIP file
    console.log(`  Downloading ${zipUrl}...`);
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1);
    console.log(`  Downloaded ${sizeMB} MB`);

    // Extract ZIP file
    console.log(`  Extracting to ${langAudioDir}...`);
    execSync(`unzip -o -q "${zipPath}" -d "${langAudioDir}"`, { stdio: 'pipe' });

    // Count extracted files
    const extractedFiles = fs.readdirSync(langAudioDir).filter(f => f.endsWith('.mp3'));
    console.log(`  Extracted ${extractedFiles.length} audio files`);

    // Clean up ZIP file
    fs.unlinkSync(zipPath);
    console.log(`  Audio sync complete`);

  } catch (error) {
    console.error(`  Error syncing audio: ${error.message}`);
    // Clean up partial ZIP if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

async function syncGrammarFeatures(langCode) {
  console.log(`\nSyncing grammar features for ${langCode}...`);

  try {
    const features = await fetchJson(`${API_BASE}/api/vocab/v1/grammarfeatures?language=${langCode}`);

    // Write to file
    const outputPath = path.join(OUTPUT_DIR, `grammarfeatures-${langCode}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(features, null, 2));
    const count = features.features ? features.features.length : 0;
    console.log(`  Written ${count} features to ${outputPath}`);

    return features;
  } catch (error) {
    console.error(`  Error fetching grammar features: ${error.message}`);
    return null;
  }
}

async function syncLanguage(langConfig, withAudio = false) {
  console.log(`\nSyncing ${langConfig.name} (${langConfig.code})...`);

  // Fetch core vocabulary
  console.log(`  Fetching core vocabulary...`);
  let coreData;
  try {
    coreData = await fetchJson(`${API_BASE}${langConfig.coreEndpoint}`);
  } catch (error) {
    console.error(`  Error fetching core data: ${error.message}`);
    return null;
  }

  // Fetch translations
  console.log(`  Fetching translations...`);
  let translationData;
  try {
    translationData = await fetchJson(`${API_BASE}${langConfig.translationEndpoint}`);
  } catch (error) {
    console.error(`  Error fetching translations: ${error.message}`);
    // Continue without translations - we can still use core data
    translationData = {};
  }

  // Fetch grammar features
  await syncGrammarFeatures(langConfig.code);

  // Build merged structure
  const result = {
    _metadata: {
      language: langConfig.code,
      languageName: langConfig.name,
      generatedAt: new Date().toISOString(),
      source: 'papertek-api',
      apiBase: API_BASE
    }
  };

  let totalWords = 0;

  for (const bank of BANKS) {
    const coreBank = coreData[bank];
    const transBank = translationData[bank] || {};

    if (coreBank && typeof coreBank === 'object') {
      result[bank] = {};

      for (const [wordId, wordData] of Object.entries(coreBank)) {
        // Skip metadata entries
        if (wordId.startsWith('_')) continue;

        // Merge core data with translation
        const translation = transBank[wordId] || {};

        result[bank][wordId] = {
          ...wordData,
          // Add translation fields
          translation: translation.translation || null,
          explanation: translation.explanation || null,
          synonyms: translation.synonyms || [],
          examples: translation.examples || []
        };

        totalWords++;
      }

      const bankCount = Object.keys(result[bank]).length;
      if (bankCount > 0) {
        console.log(`  ${bank}: ${bankCount} words`);
      }
    }
  }

  result._metadata.totalWords = totalWords;

  // Write to file
  const outputPath = path.join(OUTPUT_DIR, `${langConfig.code}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`  Written to ${outputPath}`);
  console.log(`  Total: ${totalWords} words`);

  // Sync audio files if requested
  if (withAudio) {
    await syncAudioFiles(langConfig.code);
  }

  return result;
}

// Global flag for force re-download
let forceAudio = false;

async function main() {
  const args = process.argv.slice(2);

  // Check for flags
  const withAudio = args.includes('--with-audio');
  forceAudio = args.includes('--force-audio');
  const langArgs = args.filter(arg => !arg.startsWith('--'));

  // Determine which languages to sync
  let langsToSync;
  if (langArgs.length === 0) {
    langsToSync = Object.keys(LANGUAGES);
  } else {
    langsToSync = langArgs.filter(arg => LANGUAGES[arg]);
    if (langsToSync.length === 0) {
      console.error(`Unknown language(s): ${langArgs.join(', ')}`);
      console.error(`Available: ${Object.keys(LANGUAGES).join(', ')}`);
      process.exit(1);
    }
  }

  console.log('Papertek Vocabulary Sync');
  console.log('========================');
  console.log(`API: ${API_BASE}`);
  console.log(`Languages: ${langsToSync.join(', ')}`);
  console.log(`Audio: ${withAudio ? 'Yes' : 'No (use --with-audio to include)'}`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Sync each language
  for (const lang of langsToSync) {
    await syncLanguage(LANGUAGES[lang], withAudio);
  }

  console.log('\nDone!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
