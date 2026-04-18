/**
 * Leksihjelp — Spell / Grammar Check Core (pure rule evaluation)
 *
 * Pure, side-effect-free rule evaluator used by both:
 *   - extension/content/spell-check.js (browser DOM adapter)
 *   - scripts/check-fixtures.js        (Node fixture harness, Plan 03)
 *
 * Dual-export footer: writes `self.__lexiSpellCore` in the browser and
 * `module.exports` in Node — same API, same code path.
 *
 * Contents — moved verbatim from extension/content/spell-check.js
 * (pre-Plan-02: lines 42–66 constants, 177–192 tokenization,
 * 196–317 check() body, 322–467 helpers).
 *
 * This file MUST NOT reference DOM globals (the "document" object), the
 * chrome extension runtime, timers, or any other browser-only API. It
 * takes vocabulary indexes as arguments and returns an array of Finding
 * objects.
 *
 * Span convention: start is inclusive, end is exclusive (Python-style).
 * end = start + word.length. Plan 03 fixtures reference this comment.
 *
 * Output field name: findings use `rule_id` (not `type`). The DOM adapter
 * in spell-check.js may alias `f.type = f.rule_id` for legacy UI code.
 * Fixture files reference `rule_id`; mismatched names silently fail.
 */

(function () {
  'use strict';

  // ── Config (copied verbatim from spell-check.js:42–66) ──

  const ARTICLE_GENUS = {
    nb: { 'en': 'm', 'ei': 'f', 'et': 'n' },
    nn: { 'ein': 'm', 'ei': 'f', 'eit': 'n' },
  };
  const GENUS_ARTICLE = {
    nb: { 'm': 'en', 'f': 'ei', 'n': 'et' },
    nn: { 'm': 'ein', 'f': 'ei', 'n': 'eit' },
  };
  const MODAL_VERBS = new Set([
    'kan', 'kunne', 'kunna',
    'må', 'måtte',
    'vil', 'ville',
    'skal', 'skulle',
    'bør', 'burde',
    'får', 'fikk', 'fekk',
  ]);
  // Words that should never trigger særskriving even when the concatenation happens
  // to exist as a compound. Tuned conservatively to avoid false positives.
  const SARSKRIVING_BLOCKLIST = new Set([
    'i', 'på', 'av', 'til', 'med', 'for', 'om', 'er', 'og', 'å', 'at',
    'som', 'en', 'ei', 'et', 'ein', 'eit', 'det', 'den', 'de', 'dei',
    'du', 'jeg', 'eg', 'han', 'hun', 'ho', 'vi', 'dere', 'dykk', 'meg',
    'deg', 'oss', 'dem', 'seg', 'min', 'din', 'sin', 'vår', 'ikke',
    'ikkje', 'nei', 'ja',
  ]);

  // ── Tokenization (copied verbatim from spell-check.js:177–192) ──

  const WORD_RE = /[\p{L}]+/gu;

  function tokenize(text) {
    const out = [];
    WORD_RE.lastIndex = 0;
    let m;
    while ((m = WORD_RE.exec(text))) {
      out.push({
        word: m[0].toLowerCase(),
        display: m[0],
        start: m.index,
        end: m.index + m[0].length,  // end is exclusive (past-the-end)
      });
    }
    return out;
  }

  // ── Rule evaluation (copied verbatim from spell-check.js:196–317) ──
  //
  // Rule evaluation order inside check() is LOAD-BEARING — dedupeOverlapping
  // keeps the earlier-listed finding when two rules conflict. Do not reorder
  // for style. The fixture suite in Plan 03 tests this precedence.
  function check(text, vocab, opts = {}) {
    const { cursorPos = null, lang = 'nb' } = opts;
    const vocabRef = vocab || {};
    const nounGenus      = vocabRef.nounGenus      || new Map();
    const verbInfinitive = vocabRef.verbInfinitive || new Map();
    const validWords     = vocabRef.validWords     || new Set();
    const typoFix        = vocabRef.typoFix        || new Map();
    const compoundNouns  = vocabRef.compoundNouns  || new Set();

    const findings = [];
    if (!text || text.length < 3) return findings;
    if (lang !== 'nb' && lang !== 'nn') return findings;

    const toks = tokenize(text);
    if (toks.length < 2) return findings;
    const articles = ARTICLE_GENUS[lang];
    const genusArticle = GENUS_ARTICLE[lang];

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const prev = toks[i - 1];
      const prevPrev = toks[i - 2];

      // Skip the token currently being typed — the cursor is inside or right
      // after it, so it's likely incomplete. Flagging incomplete words would
      // be jarring while the user is mid-thought.
      if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

      // 1) Gender article mismatch. Check both immediately previous word and
      //    2-back (to catch "en stor hus" where an adjective sits between).
      let articleTok = null;
      if (prev && articles[prev.word]) articleTok = prev;
      else if (prevPrev && articles[prevPrev.word]) articleTok = prevPrev;

      if (articleTok && nounGenus.has(t.word)) {
        const expected = articles[articleTok.word];
        const actual = nounGenus.get(t.word);
        // In Bokmål, feminine nouns accept the common-gender article "en" too:
        // "en bok" and "ei bok" are both correct. Only flag when the article
        // and noun genus are strictly incompatible.
        const acceptable = (
          actual === expected ||
          (lang === 'nb' && actual === 'f' && articleTok.word === 'en')
        );
        if (actual && !acceptable) {
          const correctArticle = genusArticle[actual];
          if (correctArticle) {
            findings.push({
              rule_id: 'gender',
              start: articleTok.start,
              end: articleTok.end,
              original: articleTok.display,
              fix: matchCase(articleTok.display, correctArticle),
              message: `Kjønn: "${articleTok.display} ${t.display}" skulle vært "${correctArticle} ${t.display}"`,
            });
          }
        }
      }

      // 2) Wrong verb form after modal.
      if (prev && MODAL_VERBS.has(prev.word) && verbInfinitive.has(t.word)) {
        const inf = verbInfinitive.get(t.word);
        if (inf && inf !== t.word) {
          findings.push({
            rule_id: 'modal_form',
            start: t.start,
            end: t.end,
            original: t.display,
            fix: matchCase(t.display, inf),
            message: `Etter "${prev.display}" skal verbet stå i infinitiv: "${inf}"`,
          });
        }
      }

      // 3) Særskriving: prev + t forms a compound noun in the dictionary.
      if (
        prev &&
        prev.word.length >= 2 && t.word.length >= 2 &&
        !SARSKRIVING_BLOCKLIST.has(prev.word) &&
        !SARSKRIVING_BLOCKLIST.has(t.word) &&
        compoundNouns.has(prev.word + t.word)
      ) {
        findings.push({
          rule_id: 'sarskriving',
          start: prev.start,
          end: t.end,
          original: `${prev.display} ${t.display}`,
          fix: prev.display + t.display.toLowerCase(),
          message: `Særskriving: "${prev.display} ${t.display}" skrives som ett ord`,
        });
      }

      // 4) Known typo (curated in vocab data).
      if (typoFix.has(t.word) && !validWords.has(t.word)) {
        const correct = typoFix.get(t.word);
        findings.push({
          rule_id: 'typo',
          start: t.start,
          end: t.end,
          original: t.display,
          fix: matchCase(t.display, correct),
          message: `Skrivefeil: "${t.display}" → "${correct}"`,
        });
        continue;
      }

      // 5) Fuzzy typo — unknown word with a close neighbor in the vocabulary.
      //    Skips proper nouns (capitalized outside sentence-start) and words
      //    already handled by the curated typo branch above.
      if (
        t.word.length >= 4 &&
        !validWords.has(t.word) &&
        !isLikelyProperNoun(t, i, toks, text)
      ) {
        const fuzzy = findFuzzyNeighbor(t.word, validWords);
        if (fuzzy) {
          findings.push({
            rule_id: 'typo',
            start: t.start,
            end: t.end,
            original: t.display,
            fix: matchCase(t.display, fuzzy),
            message: `Skrivefeil: "${t.display}" → "${fuzzy}"`,
          });
        }
      }
    }

    return dedupeOverlapping(findings);
  }

  // Detect proper-noun-like tokens: capitalized first letter AND not at the
  // start of a sentence. Sentence starts are either position 0 in the text or
  // immediately preceded by a sentence-ending punctuation.
  function isLikelyProperNoun(tok, idx, toks, text) {
    const first = tok.display[0];
    if (first !== first.toUpperCase() || first === first.toLowerCase()) return false;
    if (idx === 0) return false;
    // Look at chars between previous token and this one
    const prevTok = toks[idx - 1];
    const between = text.slice(prevTok.end, tok.start);
    if (/[.!?]/.test(between)) return false;
    return true;
  }

  // Bounded Damerau-Levenshtein. Returns edit distance between a and b, or
  // k + 1 if known to exceed k (early abort). Treats a single transposition
  // of adjacent characters as one edit, so "nrosk"/"norsk" is distance 1 —
  // the most common class of typing error for learners.
  //
  // Existing implementation beats `fast-levenshtein` because it handles the
  // adjacent-transposition case ("berde" → "bedre" is distance 1, not 2).
  // Do not replace with a library.
  function editDistance(a, b, k) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > k) return k + 1;
    // Full matrix — word lengths are small, so memory isn't a concern and
    // we need three rows of history for the transposition case.
    const dp = [];
    for (let i = 0; i <= la; i++) {
      dp.push(new Array(lb + 1).fill(0));
      dp[i][0] = i;
    }
    for (let j = 0; j <= lb; j++) dp[0][j] = j;
    for (let i = 1; i <= la; i++) {
      let rowMin = dp[i][0];
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(
          dp[i - 1][j] + 1,       // delete
          dp[i][j - 1] + 1,       // insert
          dp[i - 1][j - 1] + cost // substitute
        );
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, dp[i - 2][j - 2] + 1); // transpose
        }
        dp[i][j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > k) return k + 1;
    }
    return dp[la][lb];
  }

  function findFuzzyNeighbor(word, validWords) {
    const len = word.length;
    // Tighter threshold for short words — 1 edit out of 4 chars is already
    // a lot of signal to drop, but 1 edit out of 8+ is common.
    const k = len <= 6 ? 1 : 2;
    let best = null;
    let bestScore = -Infinity; // higher is better
    const first = word[0];
    for (const cand of validWords) {
      const cl = cand.length;
      if (Math.abs(cl - len) > k) continue;
      if (cand[0] !== first) continue; // Very common typos keep the first char
      if (cand === word) continue;
      const d = editDistance(word, cand, k);
      if (d > k) continue;
      const score = scoreCandidate(word, cand, d);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return best;
  }

  // Scoring heuristic, higher is better:
  //   + 15 × prefix chars shared (start of word rarely typo'd)
  //   + 10 × suffix chars shared (Norwegian inflection often at the end)
  //   - 100 × edit distance (distance-1 beats distance-2 comfortably)
  //   - 50 if the candidate is shorter than the query (users rarely type
  //         extra letters they didn't intend, so prefer
  //         transpositions/insertions over deletions). This is what makes
  //         "Skirver" pick "Skriver" over "Skiver".
  //   + 40 if the candidate is an adjacent-char transposition of the query.
  //         Transposed-adjacent typos are the most common typing error,
  //         so "berde" → "bedre" (transposition) beats "berde" → "berre"
  //         (substitution) even though both are 1-edit.
  function scoreCandidate(query, cand, d) {
    const pref = sharedPrefixLen(query, cand);
    const suff = sharedSuffixLen(query, cand);
    let s = pref * 15 + suff * 10 - d * 100;
    if (cand.length < query.length) s -= 50;
    if (isAdjacentTransposition(query, cand)) s += 40;
    return s;
  }

  // True iff `cand` is `query` with exactly one pair of adjacent characters
  // swapped. Same length. "berde" vs "bedre" → true.
  function isAdjacentTransposition(a, b) {
    if (a.length !== b.length) return false;
    let firstDiff = -1;
    let diffCount = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        if (firstDiff === -1) firstDiff = i;
        diffCount++;
        if (diffCount > 2) return false;
      }
    }
    return diffCount === 2 &&
      firstDiff + 1 < a.length &&
      a[firstDiff] === b[firstDiff + 1] &&
      a[firstDiff + 1] === b[firstDiff];
  }

  function sharedPrefixLen(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a[i] === b[i]) i++;
    return i;
  }

  function sharedSuffixLen(a, b) {
    const la = a.length;
    const lb = b.length;
    const n = Math.min(la, lb);
    let i = 0;
    while (i < n && a[la - 1 - i] === b[lb - 1 - i]) i++;
    return i;
  }

  // When two findings cover overlapping spans (e.g., særskriving + typo on
  // the same word), keep the earlier-listed one — order in the checker loop
  // mirrors pedagogical priority. This ordering is exercised by the fixture
  // suite in Plan 03; do not reorder the rules in check() above.
  function dedupeOverlapping(findings) {
    const kept = [];
    for (const f of findings) {
      const conflict = kept.some(k => !(f.end <= k.start || f.start >= k.end));
      if (!conflict) kept.push(f);
    }
    return kept;
  }

  function matchCase(original, replacement) {
    if (!original || !replacement) return replacement;
    if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  // ── Dual-export footer ──
  // Writes `self.__lexiSpellCore` in the browser (content script) AND
  // `module.exports` in Node — same API, same code path. `self` is defined
  // both in content scripts and in Node 18+.
  const api = {
    check,
    // Helpers exposed for potential direct testing / future rule-plugin extraction.
    tokenize,
    editDistance,
    matchCase,
    dedupeOverlapping,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') self.__lexiSpellCore = api;
})();
