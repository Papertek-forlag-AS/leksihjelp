#!/usr/bin/env node

/**
 * build-bigrams.js — DATA-03 (Phase 2, Plan 02-02)
 *
 * Stream-parses the NB N-gram 2021 `digibok-bigram.csv.gz` corpus (~7.15 GB
 * gzipped, ~50 GB decompressed — MUST stream, never buffer), derives
 * weight-bucketed NB and NN bigrams matching the existing
 * `{prev: {next: weight}}` schema, max-merges against the hand-authored
 * bigrams already shipped in `extension/data/bigrams-{nb,nn}.json`, enforces
 * a 50 KB gzipped per-file budget, and writes the expanded files back.
 *
 * Discipline (carried over from the Phase-1 style + research notes):
 *   - Zero npm dependencies (Node core only: https, fs, path, zlib, readline).
 *   - CommonJS. Paths resolved from __dirname so the script works from any CWD.
 *   - Output JSON is sorted + compact for idempotency (byte-identical re-runs).
 *   - Hand-authored idioms (the 50–60 curated multi-word + single-word
 *     collocations in the pre-run file) MUST survive unchanged — max-merge
 *     enforces this invariant internally; the plan's external verify block
 *     sweeps the full pre-run file and re-asserts.
 *
 * Usage:
 *   node scripts/build-bigrams.js              # Use cached corpus if present
 *   node scripts/build-bigrams.js --refresh-corpus  # Force re-download
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');
const https = require('https');

const { buildIndexes } = require('../extension/content/vocab-seam-core.js');

// ── Constants ──────────────────────────────────────────────────────────────

const CORPUS_URL  = 'https://www.nb.no/sbfil/ngram/ngram_2021/ngram-2021-digibok-bigram.csv.gz';
const CORPUS_DIR  = path.join(__dirname, '..', 'corpus');
const CORPUS_FILE = path.join(CORPUS_DIR, 'ngram-2021-digibok-bigram.csv.gz');
const DATA_DIR    = path.join(__dirname, '..', 'extension', 'data');

// Internal → ISO 639-3 mapping used by the corpus' `lang` column.
const LANG_MAP = { nb: 'nob', nn: 'nno' };

// Bundle-size budget (Pattern 5 + Pitfall 3). Per-file cap.
const MAX_GZIP_BYTES = 50_000;

// Initial knobs for coverage vs. budget — the enforce-budget step backs off
// from these if the 50 KB gzipped ceiling is exceeded.
const INITIAL_TOP_PREDECESSORS = 2000; // top-N unigrams by corpus freq
const INITIAL_TOP_CONTINUATIONS = 8;   // top-K continuations per predecessor

const MIN_TOP_CONTINUATIONS = 4;       // hard floor on the back-off
const MIN_TOP_PREDECESSORS  = 500;     // hard floor on the back-off

// Noise floor — drop pairs seen fewer than this many times across the
// digibok corpus. 580k books × tens of millions of word-pair rows means
// freq=50 is a conservative "at least seen repeatedly" signal.
const MIN_BIGRAM_FREQ = 50;

// OCR-noise filter — same regex as Plan 02-01's build-frequencies.js.
// Allows Norwegian letters + apostrophe + hyphen. Requires at least one
// letter (prevents bare punctuation like "'" or "-" from slipping through
// as valid "words").
const WORD_RE = /^(?=.*[a-zæøåöü])[a-zæøåöü'-]+$/;

// Weight-bucket thresholds — derived from the research's Pattern 5.
// ratio = pairFreq / firstTotal (concentration of this continuation within
// all observed continuations of `first`).
const WEIGHT_3_THRESHOLD = 0.05;  // ≥5% of first-word's continuations → strong
const WEIGHT_2_THRESHOLD = 0.015; // ≥1.5% → moderate; else weight 1

// ── Corpus acquisition ─────────────────────────────────────────────────────

// HEAD request to get the total size (content-length) so we can verify a
// cached download is complete and know what to resume to.
function fetchExpectedSize(url) {
  return new Promise((resolve, reject) => {
    const tryFetch = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('too many redirects'));
      const req = https.request(u, { method: 'HEAD' }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return tryFetch(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HEAD ${u} → HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        resolve(total);
      });
      req.on('error', reject);
      req.end();
    };
    tryFetch(url);
  });
}

// Stream-download `url` to `destPath`. If the destination already has some
// bytes and the server advertises Accept-Ranges, resume with a Range
// request; otherwise truncate and start fresh. Returns when the downloaded
// byte count matches `expectedSize` — or throws if the connection ends
// early, so ensureCorpus() can retry.
function downloadRange({ url, destPath, expectedSize }) {
  return new Promise((resolve, reject) => {
    const startBytes = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;

    if (startBytes >= expectedSize && expectedSize > 0) {
      return resolve({ bytes: startBytes, resumed: false });
    }

    const headers = startBytes > 0 ? { Range: `bytes=${startBytes}-` } : {};
    const tryFetch = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('too many redirects'));
      https.get(u, { headers }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return tryFetch(res.headers.location, redirects + 1);
        }
        // Accept both 200 (full) and 206 (partial — range honoured).
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          return reject(new Error(`GET ${u} → HTTP ${res.statusCode}`));
        }

        // If we asked for a range but got 200 back, the server ignored
        // Range and is streaming the whole file — truncate our local file
        // so we don't append to stale bytes.
        let appendMode = startBytes > 0 && res.statusCode === 206;
        const out = fs.createWriteStream(destPath, {
          flags: appendMode ? 'a' : 'w',
        });

        const contentLen = parseInt(res.headers['content-length'] || '0', 10);
        const baseOffset = appendMode ? startBytes : 0;
        let seenInThisRequest = 0;
        let lastLog = Date.now();
        console.log(
          `[corpus] ${res.statusCode === 206 ? 'resuming' : 'starting'} from ${(baseOffset / 1e9).toFixed(2)} GB, ` +
          `expected total ${(expectedSize / 1e9).toFixed(2)} GB`
        );

        res.on('data', (chunk) => {
          seenInThisRequest += chunk.length;
          const now = Date.now();
          if (now - lastLog > 10_000) {
            const totalSeen = baseOffset + seenInThisRequest;
            const pct = expectedSize ? ((totalSeen / expectedSize) * 100).toFixed(1) : '?';
            console.log(`[corpus] ${(totalSeen / 1e9).toFixed(2)} GB / ${(expectedSize / 1e9).toFixed(2)} GB (${pct}%)`);
            lastLog = now;
          }
        });
        res.on('error', reject);

        res.pipe(out);
        out.on('error', reject);
        out.on('finish', () => {
          out.close(() => {
            const diskSize = fs.statSync(destPath).size;
            if (diskSize < expectedSize) {
              // Connection was dropped mid-stream. Surface this so
              // ensureCorpus() can retry with a Range request.
              return reject(new Error(
                `short read: disk has ${diskSize} bytes, expected ${expectedSize} ` +
                `(connection likely dropped after ${seenInThisRequest} bytes in this request)`
              ));
            }
            resolve({ bytes: diskSize, resumed: appendMode });
          });
        });
      }).on('error', reject);
    };
    tryFetch(url);
  });
}

async function ensureCorpus({ refresh = false } = {}) {
  if (!fs.existsSync(CORPUS_DIR)) fs.mkdirSync(CORPUS_DIR, { recursive: true });

  if (refresh && fs.existsSync(CORPUS_FILE)) {
    console.log(`[corpus] --refresh-corpus set, removing cached file`);
    fs.unlinkSync(CORPUS_FILE);
  }

  console.log(`[corpus] resolving expected size for ${CORPUS_URL}`);
  const expectedSize = await fetchExpectedSize(CORPUS_URL);
  if (!expectedSize) {
    throw new Error('server did not advertise Content-Length; cannot verify download completeness');
  }

  if (fs.existsSync(CORPUS_FILE)) {
    const onDisk = fs.statSync(CORPUS_FILE).size;
    if (onDisk === expectedSize) {
      console.log(`[corpus] cached at ${CORPUS_FILE} (${(onDisk / 1e9).toFixed(2)} GB, size matches server)`);
      return;
    }
    console.log(`[corpus] cached file is ${(onDisk / 1e9).toFixed(2)} GB but server advertises ${(expectedSize / 1e9).toFixed(2)} GB — resuming`);
  } else {
    console.log(`[corpus] no cache, downloading from scratch — this is ~7.15 GB gzipped and may take a while`);
  }

  // Retry until either the full file is on disk or MAX_ATTEMPTS consecutive
  // failures without progress. The NB file server tends to drop connections
  // after ~1 GB, so we expect ~7-10 successful resumes for the full 7.15 GB
  // file. A "successful" attempt resets the no-progress counter — we only
  // bail out if many retries in a row fail to advance the byte counter.
  const MAX_NO_PROGRESS = 10;
  let lastErr = null;
  let lastBytes = fs.existsSync(CORPUS_FILE) ? fs.statSync(CORPUS_FILE).size : 0;
  let noProgressStreak = 0;
  let attempt = 0;
  while (noProgressStreak < MAX_NO_PROGRESS) {
    attempt++;
    try {
      await downloadRange({ url: CORPUS_URL, destPath: CORPUS_FILE, expectedSize });
      const sizeGB = (fs.statSync(CORPUS_FILE).size / 1e9).toFixed(2);
      console.log(`[corpus] download complete (${sizeGB} GB, ${attempt} attempt${attempt === 1 ? '' : 's'})`);
      return;
    } catch (err) {
      lastErr = err;
      const bytesNow = fs.existsSync(CORPUS_FILE) ? fs.statSync(CORPUS_FILE).size : 0;
      if (bytesNow > lastBytes) {
        noProgressStreak = 0;
      } else {
        noProgressStreak++;
      }
      lastBytes = bytesNow;
      console.warn(`[corpus] attempt ${attempt} failed (${(bytesNow / 1e9).toFixed(2)} GB on disk, no-progress streak ${noProgressStreak}/${MAX_NO_PROGRESS}): ${err.message}`);
      if (noProgressStreak < MAX_NO_PROGRESS) {
        const backoffSec = Math.min(30, 2 ** Math.min(noProgressStreak, 5));
        console.log(`[corpus] retrying in ${backoffSec}s`);
        await new Promise((r) => setTimeout(r, backoffSec * 1000));
      }
    }
  }
  throw new Error(`corpus download failed after ${attempt} attempts with no byte-progress in the last ${MAX_NO_PROGRESS}: ${lastErr && lastErr.message}`);
}

// Strip surrounding double-quotes from a CSV cell and collapse `""` → `"`
// inside. The bigram corpus quotes every word column (`"Råholt"`) but
// leaves symbol columns bare (`!`, `$`). This is a narrow helper —
// we only need it for the word-position columns, and any cell that still
// contains a `"` after unquoting will be rejected by WORD_RE anyway.
function unquote(cell) {
  if (cell.length >= 2 && cell.charCodeAt(0) === 34 && cell.charCodeAt(cell.length - 1) === 34) {
    return cell.slice(1, -1).replace(/""/g, '"');
  }
  return cell;
}

// ── Stream-parse the bigram CSV ────────────────────────────────────────────

/**
 * Reads the digibok-bigram.csv.gz streamed through gunzip + readline.
 * Accumulates bigram counts for rows whose lang column matches
 * `targetCorpusLang` ('nob' | 'nno'). Never loads the full gunzipped file
 * into memory.
 *
 * Returns:
 *   bigramCounts: Map<first, Map<second, freq>>
 *   firstTotals:  Map<first, totalFreq>  (sum over all `second` for `first`)
 *   totalRows:    number  (kept lines — after filtering)
 */
async function streamBigrams({ targetCorpusLang }) {
  const bigramCounts = new Map();
  const firstTotals  = new Map();
  let totalRows = 0;
  let linesSeen = 0;

  const readStream = fs.createReadStream(CORPUS_FILE);
  const gunzip     = zlib.createGunzip();
  const rl         = readline.createInterface({
    input: readStream.pipe(gunzip),
    crlfDelay: Infinity,
  });

  const startTs = Date.now();
  let headerSkipped = false;

  for await (const line of rl) {
    linesSeen++;
    if (linesSeen % 20_000_000 === 0) {
      const secs = ((Date.now() - startTs) / 1000).toFixed(1);
      console.log(`[parse:${targetCorpusLang}] ${linesSeen.toLocaleString()} lines scanned, ${totalRows.toLocaleString()} kept (${secs}s)`);
    }

    // Columns: first,second,lang,freq,year_json
    // The CSV is comma-delimited; the last (json) column is quoted with
    // embedded commas, but we only need the first four columns. We split
    // into 5 parts max — the 5th part becomes the entire remainder.
    // Non-word `first`/`second` values (symbols, quotes, digits) get
    // rejected by WORD_RE below, so we don't need a general CSV parser.
    if (!headerSkipped) {
      headerSkipped = true;
      if (line.startsWith('first,second,lang,freq')) continue;
    }

    // Split on the first four commas only. We find positions manually
    // to avoid allocating a full array when later columns have embedded
    // commas in the quoted json.
    const c1 = line.indexOf(',');
    if (c1 < 0) continue;
    const c2 = line.indexOf(',', c1 + 1);
    if (c2 < 0) continue;
    const c3 = line.indexOf(',', c2 + 1);
    if (c3 < 0) continue;
    const c4 = line.indexOf(',', c3 + 1);
    if (c4 < 0) continue;

    const firstRaw  = line.slice(0, c1);
    const secondRaw = line.slice(c1 + 1, c2);
    const lang      = line.slice(c2 + 1, c3);
    const freqRaw   = line.slice(c3 + 1, c4);

    if (lang !== targetCorpusLang) continue;

    // Word cells are quoted ("word"), symbol cells are bare (!, $, %, -).
    // Strip surrounding double-quotes if present. The corpus also uses ""
    // (doubled) inside a quoted field to escape a literal ", but that's
    // punctuation and the WORD_RE filter drops those rows anyway.
    const first  = unquote(firstRaw).toLowerCase();
    const second = unquote(secondRaw).toLowerCase();
    if (!WORD_RE.test(first) || !WORD_RE.test(second)) continue;

    const freq = parseInt(freqRaw, 10);
    if (!Number.isFinite(freq) || freq < MIN_BIGRAM_FREQ) continue;

    let inner = bigramCounts.get(first);
    if (!inner) {
      inner = new Map();
      bigramCounts.set(first, inner);
    }
    inner.set(second, (inner.get(second) || 0) + freq);
    firstTotals.set(first, (firstTotals.get(first) || 0) + freq);
    totalRows++;
  }

  const secs = ((Date.now() - startTs) / 1000).toFixed(1);
  console.log(`[parse:${targetCorpusLang}] done — ${linesSeen.toLocaleString()} lines scanned, ${totalRows.toLocaleString()} kept in ${secs}s`);
  return { bigramCounts, firstTotals, totalRows };
}

// ── Weight bucketing ───────────────────────────────────────────────────────

function bucketize(pairFreq, firstTotal) {
  const ratio = pairFreq / firstTotal;
  if (ratio >= WEIGHT_3_THRESHOLD) return 3;
  if (ratio >= WEIGHT_2_THRESHOLD) return 2;
  return 1;
}

// ── Derivation ─────────────────────────────────────────────────────────────

/**
 * Pick the top-K predecessors (by firstTotal desc), then the top-N
 * continuations of each (by pair freq desc), filtered through validWords
 * (both predecessor and continuation must exist as a known form).
 * Returns the derived bigram shape { first: { second: weight } }.
 */
function deriveBigrams({ bigramCounts, firstTotals, validWords, topPredecessors, topContinuations }) {
  // Rank predecessors by their total occurrence across all continuations.
  const rankedFirsts = [...firstTotals.entries()]
    .filter(([first]) => validWords.has(first))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topPredecessors)
    .map(([first]) => first);

  const out = {};
  for (const first of rankedFirsts) {
    const inner = bigramCounts.get(first);
    if (!inner) continue;
    const firstTotal = firstTotals.get(first);

    const ranked = [...inner.entries()]
      .filter(([second]) => validWords.has(second))
      .sort((a, b) => b[1] - a[1])
      .slice(0, topContinuations);

    if (ranked.length === 0) continue;

    const outInner = {};
    for (const [second, pairFreq] of ranked) {
      outInner[second] = bucketize(pairFreq, firstTotal);
    }
    out[first] = outInner;
  }
  return out;
}

// ── Max-merge (Pitfall 7 guard) ────────────────────────────────────────────

/**
 * Combine hand-authored `existing` with derived `derived` using per-(prev,
 * next) max weight. Existing entries are never downgraded or removed.
 * Multi-word prev-keys in `existing` (containing a space) are impossible
 * to collide with derived (corpus emits word-pair tokens only), so they
 * pass through untouched.
 *
 * The `_metadata` top-level key is preserved verbatim if present.
 */
function mergeBigrams(existing, derived) {
  // Deep-clone `existing` to preserve its structure and any _metadata block.
  const out = JSON.parse(JSON.stringify(existing));
  for (const [first, nextMap] of Object.entries(derived)) {
    if (!out[first] || typeof out[first] !== 'object' || Array.isArray(out[first])) {
      out[first] = {};
    }
    for (const [second, w] of Object.entries(nextMap)) {
      const prev = out[first][second];
      out[first][second] = Math.max(typeof prev === 'number' ? prev : 0, w);
    }
  }
  return out;
}

// ── Serialisation (sorted + compact for idempotency) ───────────────────────

function sortObjectKeys(obj) {
  // Metadata first (if present), then the rest alphabetically. Inner
  // objects: alphabetical by `next`. Weight-desc inner ordering would
  // marginally improve gz ratio but complicates diff review — alpha is
  // cheaper to reason about.
  const keys = Object.keys(obj).sort((a, b) => {
    if (a === '_metadata') return -1;
    if (b === '_metadata') return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const sorted = {};
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // Do NOT recursively sort the _metadata block (keep its order).
      if (k === '_metadata') {
        sorted[k] = v;
      } else {
        const innerKeys = Object.keys(v).sort();
        const innerOut = {};
        for (const ik of innerKeys) innerOut[ik] = v[ik];
        sorted[k] = innerOut;
      }
    } else {
      sorted[k] = v;
    }
  }
  return sorted;
}

function serialise(obj) {
  return JSON.stringify(sortObjectKeys(obj));
}

// ── Budget enforcement ─────────────────────────────────────────────────────

/**
 * If the merged bigram file exceeds the gzipped cap, back off:
 *   1. Reduce topContinuations 8 → 7 → 6 … down to MIN_TOP_CONTINUATIONS.
 *   2. If still over: reduce topPredecessors by 200 at a time, down to
 *      MIN_TOP_PREDECESSORS.
 *   3. If still over at the floors: throw — the planner needs to reconsider.
 *
 * Returns { obj, topContinuations, topPredecessors, gzBytes, backoffLog[] }.
 */
function enforceBudget({ existing, bigramCounts, firstTotals, validWords, maxGzipBytes, lang }) {
  let topPredecessors  = INITIAL_TOP_PREDECESSORS;
  let topContinuations = INITIAL_TOP_CONTINUATIONS;
  const backoffLog = [];

  while (true) {
    const derived = deriveBigrams({
      bigramCounts, firstTotals, validWords,
      topPredecessors, topContinuations,
    });
    const merged  = mergeBigrams(existing, derived);
    const gzBytes = zlib.gzipSync(serialise(merged)).length;

    if (gzBytes <= maxGzipBytes) {
      return { obj: merged, topPredecessors, topContinuations, gzBytes, backoffLog };
    }

    // Over budget — back off.
    if (topContinuations > MIN_TOP_CONTINUATIONS) {
      backoffLog.push(`bigrams-${lang}.json over budget (${gzBytes} gz bytes > ${maxGzipBytes}), reducing topContinuations: ${topContinuations} → ${topContinuations - 1}`);
      console.log(`[budget:${lang}] ${backoffLog[backoffLog.length - 1]}`);
      topContinuations--;
      continue;
    }

    if (topPredecessors > MIN_TOP_PREDECESSORS) {
      const next = Math.max(MIN_TOP_PREDECESSORS, topPredecessors - 200);
      backoffLog.push(`bigrams-${lang}.json over budget at topContinuations=${topContinuations} (${gzBytes} gz bytes), reducing topPredecessors: ${topPredecessors} → ${next}`);
      console.log(`[budget:${lang}] ${backoffLog[backoffLog.length - 1]}`);
      topPredecessors = next;
      continue;
    }

    throw new Error(
      `bigrams-${lang}.json still over budget at topPredecessors=${MIN_TOP_PREDECESSORS} × topContinuations=${MIN_TOP_CONTINUATIONS} (${gzBytes} gz bytes > ${maxGzipBytes}). ` +
      `Research target no longer achievable with current thresholds — planner must reconsider MIN_BIGRAM_FREQ or the 50 KB cap.`
    );
  }
}

// ── Write + post-write sanity ──────────────────────────────────────────────

function writeBigrams(outPath, obj) {
  const json = serialise(obj);
  fs.writeFileSync(outPath, json);
}

/**
 * External-to-the-merge sanity check: after writing the merged file,
 * re-load it from disk and assert every (prev, next) triple from `existing`
 * survives with weight >= original. The in-memory `mergeBigrams` already
 * guarantees this via Math.max, but this is defence-in-depth — it catches
 * serialisation bugs (e.g. a stringifier that silently drops a key).
 *
 * Also assert the 10× growth floor.
 */
function assertPreserved({ outPath, existing, lang }) {
  const post = JSON.parse(fs.readFileSync(outPath, 'utf8'));

  // Growth floor: at least 10× the pre-run head-word count (excluding
  // _metadata). This guards against "we ran the builder but filters are
  // wrong and nothing came out". Only applied on a first fresh run
  // (pre-count ≤ 100); subsequent re-runs idempotently re-emit ~the same
  // output, so requiring 10× again would make the script non-idempotent.
  const preHeads  = Object.keys(existing).filter((k) => k !== '_metadata').length;
  const postHeads = Object.keys(post).filter((k) => k !== '_metadata').length;
  if (preHeads <= 100 && postHeads < preHeads * 10) {
    throw new Error(`bigrams-${lang}.json: coverage growth below target — pre=${preHeads}, post=${postHeads}, expected ≥ ${preHeads * 10}`);
  }

  // Pitfall-7 assertion: every pre-run (prev, next) triple still present with weight >= original.
  const downgrades = [];
  for (const [prev, nextMap] of Object.entries(existing)) {
    if (prev === '_metadata') continue;
    if (!post[prev]) {
      downgrades.push(`MISSING predecessor: "${prev}"`);
      continue;
    }
    for (const [next, wPre] of Object.entries(nextMap)) {
      const wPost = post[prev][next];
      if (wPost === undefined) {
        downgrades.push(`MISSING continuation: "${prev}" → "${next}" (was weight ${wPre})`);
      } else if (wPost < wPre) {
        downgrades.push(`DOWNGRADED: "${prev}" → "${next}" was ${wPre}, now ${wPost}`);
      }
    }
  }
  if (downgrades.length > 0) {
    throw new Error(`DOWNGRADE DETECTED in bigrams-${lang}.json — ${downgrades.length} hand-authored triples violated:\n  ${downgrades.slice(0, 10).join('\n  ')}${downgrades.length > 10 ? `\n  ... and ${downgrades.length - 10} more` : ''}`);
  }
}

// ── Per-language pipeline ──────────────────────────────────────────────────

async function buildForLang(lang) {
  const existingPath = path.join(DATA_DIR, `bigrams-${lang}.json`);
  const rawVocabPath = path.join(DATA_DIR, `${lang}.json`);

  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const rawVocab = JSON.parse(fs.readFileSync(rawVocabPath, 'utf8'));
  const { validWords } = buildIndexes({
    raw: rawVocab,
    bigrams: null,
    lang,
    isFeatureEnabled: () => true,
  });

  const existingHeads = Object.keys(existing).filter((k) => k !== '_metadata').length;
  const existingGz    = zlib.gzipSync(serialise(existing)).length;
  console.log(`[build:${lang}] pre-run: ${existingHeads} head-words, ${existingGz} gz bytes`);

  const { bigramCounts, firstTotals, totalRows } = await streamBigrams({
    targetCorpusLang: LANG_MAP[lang],
  });
  console.log(`[build:${lang}] parsed: ${bigramCounts.size.toLocaleString()} distinct predecessors, ${totalRows.toLocaleString()} rows kept`);

  const { obj, topPredecessors, topContinuations, gzBytes, backoffLog } = enforceBudget({
    existing, bigramCounts, firstTotals, validWords,
    maxGzipBytes: MAX_GZIP_BYTES,
    lang,
  });

  writeBigrams(existingPath, obj);
  assertPreserved({ outPath: existingPath, existing, lang });

  const postHeads = Object.keys(obj).filter((k) => k !== '_metadata').length;
  console.log(`[build:${lang}] post-run: ${postHeads} head-words (${((postHeads / existingHeads) || 0).toFixed(1)}×), ${gzBytes} gz bytes, topPredecessors=${topPredecessors}, topContinuations=${topContinuations}`);
  if (backoffLog.length > 0) {
    console.log(`[build:${lang}] budget backoffs: ${backoffLog.length}`);
  }
  return { lang, existingHeads, postHeads, existingGz, gzBytes, topPredecessors, topContinuations, backoffLog };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh-corpus');

  await ensureCorpus({ refresh });

  const results = [];
  for (const lang of ['nb', 'nn']) {
    results.push(await buildForLang(lang));
  }

  console.log('\n── build-bigrams summary ──');
  for (const r of results) {
    console.log(
      `  ${r.lang}: ${r.existingHeads} → ${r.postHeads} head-words ` +
      `(${((r.postHeads / r.existingHeads) || 0).toFixed(1)}×), ` +
      `${r.existingGz} → ${r.gzBytes} gz bytes ` +
      `(budget: ${MAX_GZIP_BYTES}, used ${((r.gzBytes / MAX_GZIP_BYTES) * 100).toFixed(1)}%)`
    );
    if (r.backoffLog.length > 0) {
      console.log(`    backoffs: ${r.backoffLog.join('; ')}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
