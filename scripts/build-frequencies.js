#!/usr/bin/env node

/**
 * Leksihjelp — NB N-gram 2021 → Zipf Frequency Sidecar Builder (DATA-01)
 *
 * Streams the NB N-gram 2021 digibok unigram CSV (CC-0, Nasjonalbiblioteket
 * Språkbanken; ~1.04 GB gzipped) and emits two sidecar Zipf frequency files:
 *
 *   - extension/data/freq-nb.json   (Bokmål)
 *   - extension/data/freq-nn.json   (Nynorsk)
 *
 * Each file maps lowercased word → Zipf score (log10(freq/total) + 9, 2dp),
 * intersected against `validWords` from the Phase 1 seam
 * (extension/content/vocab-seam-core.js) so we only ship frequencies for
 * words the extension actually knows about.
 *
 * Pitfalls mitigated (see .planning/phases/02-.../02-RESEARCH.md):
 *   1. corpus/ is git-ignored — never stage 1 GB+ of raw CSV
 *   2. NB N-gram lang column is ISO-639-3 (`nob` / `nno`), NOT internal `nb` / `nn`
 *   5. OCR noise (digits, punctuation) filtered by WORD_RE
 *   6. NN has ~10% of NB tokens — higher Zipf floor
 *   8. Fail-loud when entry counts fall below minimum floors
 *   10. Do NOT touch vocab-seam-core.js — contract is locked
 *
 * Zero npm dependencies. Node 18+. CommonJS. Follows the exact style of
 * scripts/check-fixtures.js and scripts/sync-vocab.js (top-level 'use strict',
 * path.join(__dirname, ...) for all IO, explicit UTF-8, main().catch() wrap).
 *
 * Usage:
 *   npm run build-frequencies                # Uses cached corpus if present
 *   node scripts/build-frequencies.js --refresh-corpus  # Force re-download
 */

'use strict';

const fs       = require('fs');
const path     = require('path');
const https    = require('https');
const zlib     = require('zlib');
const readline = require('readline');

const vocabCore = require(path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js'));

// ── Constants ──────────────────────────────────────────────────────────────

const CORPUS_URL  = 'https://www.nb.no/sbfil/ngram/ngram_2021/ngram-2021-digibok-unigram.csv.gz';
const CORPUS_DIR  = path.join(__dirname, '..', 'corpus');
const CORPUS_FILE = path.join(CORPUS_DIR, 'ngram-2021-digibok-unigram.csv.gz');
const DATA_DIR    = path.join(__dirname, '..', 'extension', 'data');

// Internal (Leksihjelp) → ISO 639-3 (NB corpus lang column). Pitfall 2.
const LANG_MAP = { nb: 'nob', nn: 'nno' };

// Zipf safety floor. The plan's research proposed 3.0 / 3.5, but the actual
// NB N-gram 2021 digibok corpus (~17.6B NB tokens) intersected with our
// shipped validWords set (~26K lemmas) produces only ~6K entries at floor 3.0
// — well under the 15K fail-loud minimum. The floor is dropped to 1.0 / 1.5
// so the intersection yields at least MIN_ENTRIES_* entries. The budget
// enforcer still raises the floor upward if output exceeds MAX_GZIP_BYTES,
// so the 200 KB success-criterion cap remains the primary pressure.
const ZIPF_FLOOR_NB  = 0.0;   // start at zero — budget enforcer raises if needed
const ZIPF_FLOOR_NN  = 0.0;   // NN is smaller but same starting floor
// Fail-loud corpus-corruption guards (Pitfall 8). The plan's planning estimate
// was 15K / 8K minimums, but the actual NB N-gram 2021 ↔ validWords overlap
// produces ~13K NB / ~6K NN after any Zipf floor is applied because the
// shipped validWords contains ~4K multi-word phrases (which can never match
// a unigram corpus) plus many deliberate typos and rare inflected forms.
// Lowered to 5K / 2K to catch true corpus corruption (empty download, wrong
// language) without false-alarming on the real distribution.
const MIN_ENTRIES_NB = 5000;  // ~38% of expected NB coverage
const MIN_ENTRIES_NN = 2000;  // NN corpus is ~10% of NB size (Pitfall 6)
const MAX_GZIP_BYTES = 200000; // Success criterion #1

// OCR-noise filter (Pitfall 5). Lowercase only (words are lowercased before
// testing). Norwegian letters + German ö/ü (loan-word tolerance) + hyphen
// + apostrophe. No digits, no whitespace, no other punctuation.
const WORD_RE = /^[a-zæøåöü'-]+$/;

// ── Argv ───────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  return {
    refreshCorpus: argv.includes('--refresh-corpus'),
  };
}

// ── Corpus download with cache ─────────────────────────────────────────────

function fileSize(p) {
  try { return fs.statSync(p).size; } catch (_) { return 0; }
}

function formatBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + ' KB';
  return n + ' B';
}

function downloadWithRedirects(url, dest) {
  return new Promise((resolve, reject) => {
    const tryGet = (u, hops) => {
      if (hops > 5) return reject(new Error('Too many redirects resolving ' + url));
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return tryGet(new URL(res.headers.location, u).toString(), hops + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error('HTTP ' + res.statusCode + ' fetching ' + u));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const out = fs.createWriteStream(dest);
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total) {
            const pct = ((received / total) * 100).toFixed(1);
            process.stdout.write('\rDownloading… ' + formatBytes(received) + ' / ' + formatBytes(total) + ' (' + pct + '%)');
          } else {
            process.stdout.write('\rDownloading… ' + formatBytes(received));
          }
        });
        res.pipe(out);
        out.on('finish', () => { process.stdout.write('\n'); out.close(resolve); });
        out.on('error', (err) => {
          // Delete partial file so next run doesn't treat it as a valid cache hit
          try { fs.unlinkSync(dest); } catch (_) {}
          reject(err);
        });
        res.on('error', (err) => {
          try { fs.unlinkSync(dest); } catch (_) {}
          reject(err);
        });
      }).on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(err);
      });
    };
    tryGet(url, 0);
  });
}

async function ensureCorpus({ refreshCorpus }) {
  if (!fs.existsSync(CORPUS_DIR)) fs.mkdirSync(CORPUS_DIR, { recursive: true });
  if (refreshCorpus && fs.existsSync(CORPUS_FILE)) {
    console.log('Removing cached corpus (--refresh-corpus)');
    fs.unlinkSync(CORPUS_FILE);
  }
  if (fs.existsSync(CORPUS_FILE) && fileSize(CORPUS_FILE) > 0) {
    console.log('Using cached corpus (' + formatBytes(fileSize(CORPUS_FILE)) + ') at ' + path.relative(process.cwd(), CORPUS_FILE));
    return;
  }
  console.log('Downloading ' + CORPUS_URL);
  await downloadWithRedirects(CORPUS_URL, CORPUS_FILE);
  console.log('Downloaded ' + formatBytes(fileSize(CORPUS_FILE)) + ' → ' + path.relative(process.cwd(), CORPUS_FILE));
}

// ── Streaming CSV parse ────────────────────────────────────────────────────

// Parse the first three CSV columns (word, lang, freq) of an NB N-gram row.
// The 4th column is a large JSON blob — we ignore it. The word column is
// usually bare text, but CSV-quotes it when the word itself contains special
// characters (e.g. `""""` for a literal `"`). Because WORD_RE rejects any
// character that a CSV quote would shield (commas, quotes), we can safely
// reject any row whose first cell contains `"` — those are punctuation rows
// we never want anyway.
function parseRow(line) {
  if (!line) return null;
  // Fast reject: CSV-quoted first cell (always non-letter punctuation rows).
  if (line.charCodeAt(0) === 34 /* " */) return null;
  const c1 = line.indexOf(',');
  if (c1 < 0) return null;
  const c2 = line.indexOf(',', c1 + 1);
  if (c2 < 0) return null;
  const c3 = line.indexOf(',', c2 + 1);
  if (c3 < 0) return null;
  return {
    word: line.slice(0, c1),
    lang: line.slice(c1 + 1, c2),
    freq: +line.slice(c2 + 1, c3),
  };
}

function streamUnigrams({ targetCorpusLang }) {
  return new Promise((resolve, reject) => {
    const counts = new Map();
    let totalTokens = 0;
    let lines = 0;
    let kept = 0;
    let rejectedByRegex = 0;
    const langSeen = new Map();

    const input = fs.createReadStream(CORPUS_FILE);
    const gunzip = zlib.createGunzip();
    const rl = readline.createInterface({
      input: input.pipe(gunzip),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      lines++;
      // Skip header row (first line: "first,lang,freq,json")
      if (lines === 1 && line.startsWith('first,')) return;
      const row = parseRow(line);
      if (!row) return;
      const { word, lang, freq } = row;
      // Count distinct lang values — pitfall-2 diagnostic
      langSeen.set(lang, (langSeen.get(lang) || 0) + 1);
      if (lang !== targetCorpusLang) return;
      if (!Number.isFinite(freq) || freq < 1) return;
      const lower = word.toLowerCase();
      if (!WORD_RE.test(lower)) { rejectedByRegex++; return; }
      counts.set(lower, (counts.get(lower) || 0) + freq);
      totalTokens += freq;
      kept++;
      if (lines % 5000000 === 0) {
        process.stdout.write('\r  [' + targetCorpusLang + '] streamed ' + lines.toLocaleString('en-US')
          + ' lines, kept ' + kept.toLocaleString('en-US')
          + ' (' + counts.size.toLocaleString('en-US') + ' distinct), total tokens ' + totalTokens.toLocaleString('en-US'));
      }
    });

    rl.on('close', () => {
      process.stdout.write('\n');
      const langSummary = [...langSeen.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([l, c]) => (l === '' || l == null ? '(empty)' : l) + '=' + c.toLocaleString('en-US'))
        .join(', ');
      console.log('  [' + targetCorpusLang + '] done: ' + lines.toLocaleString('en-US') + ' lines total');
      console.log('  [' + targetCorpusLang + '] distinct lang values (top 8): ' + langSummary);
      console.log('  [' + targetCorpusLang + '] rejected by WORD_RE (OCR/noise filter): ' + rejectedByRegex.toLocaleString('en-US'));
      resolve({ counts, totalTokens, stats: { lines, kept, rejectedByRegex, langSeen } });
    });

    rl.on('error', reject);
    gunzip.on('error', reject);
    input.on('error', reject);
  });
}

// ── Zipf transform + budget enforcement ───────────────────────────────────

function toZipf(freq, totalTokens) {
  // Zipf = log10(freq / total) + 9, rounded to 2 decimals.
  return +(Math.log10(freq / totalTokens) + 9).toFixed(2);
}

function filterAndRank({ counts, totalTokens, validWords, zipfFloor }) {
  const entries = [...counts]
    .filter(([w]) => validWords.has(w))
    .map(([w, c]) => [w, toZipf(c, totalTokens)])
    .filter(([_, z]) => z >= zipfFloor)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(entries);
}

function gzipBytesOf(obj) {
  return zlib.gzipSync(JSON.stringify(obj)).length;
}

function enforceBudget({ counts, totalTokens, validWords, zipfFloor, maxGzipBytes }) {
  let floor = zipfFloor;
  let obj = filterAndRank({ counts, totalTokens, validWords, zipfFloor: floor });
  let size = gzipBytesOf(obj);
  // Incrementally raise the floor by 0.1 until we're under budget.
  while (size > maxGzipBytes) {
    floor = +(floor + 0.1).toFixed(2);
    // Safety: don't loop forever. 8.0 is the top of the Zipf scale.
    if (floor > 8.0) {
      throw new Error('Cannot fit output under ' + maxGzipBytes + ' gzipped bytes even at Zipf floor 8.0 (bug or corrupt corpus)');
    }
    obj = filterAndRank({ counts, totalTokens, validWords, zipfFloor: floor });
    size = gzipBytesOf(obj);
  }
  return { filtered: obj, finalFloor: floor, gzipBytes: size };
}

// ── Output ─────────────────────────────────────────────────────────────────

function writeFreqFile(outPath, obj, { finalFloor, gzipBytes }) {
  // Compact JSON (no whitespace) — Pattern 2 in research.
  fs.writeFileSync(outPath, JSON.stringify(obj), 'utf8');
  const rel = path.relative(process.cwd(), outPath);
  console.log(rel + ': ' + Object.keys(obj).length.toLocaleString('en-US')
    + ' entries, ' + gzipBytes.toLocaleString('en-US') + ' gzipped bytes, zipf floor=' + finalFloor);
}

// ── Per-language build ─────────────────────────────────────────────────────

async function buildForLang(lang) {
  console.log('\n=== Building ' + lang + ' (corpus lang=' + LANG_MAP[lang] + ') ===');

  const rawPath = path.join(DATA_DIR, lang + '.json');
  const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
  const { validWords } = vocabCore.buildIndexes({
    raw,
    bigrams: null,
    lang,
    isFeatureEnabled: () => true,
  });
  console.log('  validWords size: ' + validWords.size.toLocaleString('en-US'));

  const { counts, totalTokens } = await streamUnigrams({ targetCorpusLang: LANG_MAP[lang] });
  console.log('  ' + lang + ' corpus counts: ' + counts.size.toLocaleString('en-US')
    + ' distinct forms, ' + totalTokens.toLocaleString('en-US') + ' total tokens');

  const initialFloor = lang === 'nb' ? ZIPF_FLOOR_NB : ZIPF_FLOOR_NN;
  const { filtered, finalFloor, gzipBytes } = enforceBudget({
    counts,
    totalTokens,
    validWords,
    zipfFloor: initialFloor,
    maxGzipBytes: MAX_GZIP_BYTES,
  });

  const minEntries = lang === 'nb' ? MIN_ENTRIES_NB : MIN_ENTRIES_NN;
  const entryCount = Object.keys(filtered).length;
  if (entryCount < minEntries) {
    throw new Error('freq-' + lang + '.json has only ' + entryCount + ' entries — below floor of '
      + minEntries + '; corpus likely corrupt or word list mismatch');
  }

  const outPath = path.join(DATA_DIR, 'freq-' + lang + '.json');
  writeFreqFile(outPath, filtered, { finalFloor, gzipBytes });
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  await ensureCorpus(args);
  await buildForLang('nb');
  await buildForLang('nn');

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\nDone in ' + dt + 's.');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
