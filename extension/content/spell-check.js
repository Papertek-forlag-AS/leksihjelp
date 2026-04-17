/**
 * Leksihjelp — Spell / Grammar Check (content script)
 *
 * Scans Norwegian (NB/NN) text in the active input for learner errors that
 * browsers miss. Surfaces findings in a compact floating bar.
 *
 * Kept as a standalone module: it consumes vocab through __lexiPrediction
 * so it can later be decoupled from word-prediction and shipped independently
 * (as a separate setting, a standalone feature, or in skriv.papertek.app).
 *
 * v1 error classes:
 *   - Gender article mismatch       ("en hus"       → "et hus")
 *   - Wrong verb form after modal   ("kan spiser"   → "kan spise")
 *   - Særskriving                   ("skole sekk"   → "skolesekk")
 *   - Known typo                    ("komer"        → "kommer")
 */

(function () {
  'use strict';

  const PREDICTION = self.__lexiPrediction;
  if (!PREDICTION) return; // word-prediction.js must load first

  // ── State ──
  let enabled = false;
  let lang = 'en';
  let paused = false;
  let activeEl = null;
  let debounceTimer = null;

  // Lookup indexes (rebuilt on language change)
  const nounGenus = new Map();         // 'hus' → 'n'
  const verbInfinitive = new Map();    // 'spiser' → 'spise'
  const validWords = new Set();        // every known word form
  const typoFix = new Map();           // 'komer' → 'kommer'
  const compoundNouns = new Set();     // noun-bank entries, used for særskriving

  // UI
  let bar = null;

  // ── Config ──
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

  // ── Init ──
  init();

  async function init() {
    const stored = await storageGet(['language', 'predictionEnabled', 'spellCheckEnabled', 'lexiPaused']);
    lang = stored.language || 'en';
    paused = !!stored.lexiPaused;
    const predictionEnabled = stored.predictionEnabled !== false;
    // Default: tracks prediction (same users, same gating).
    // Explicit spellCheckEnabled=false disables even if prediction is on.
    enabled = predictionEnabled && stored.spellCheckEnabled !== false;

    PREDICTION.onReady(() => {
      rebuildIndexes();
    });

    attachListeners();

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  }

  function handleRuntimeMessage(msg) {
    if (msg.type === 'LANGUAGE_CHANGED') {
      lang = msg.language;
      hideBar();
      PREDICTION.onReady(rebuildIndexes);
    } else if (msg.type === 'PREDICTION_TOGGLED') {
      // Prediction off → spell-check off (honor the umbrella toggle).
      if (!msg.enabled) { enabled = false; hideBar(); }
    } else if (msg.type === 'SPELL_CHECK_TOGGLED') {
      enabled = !!msg.enabled;
      if (!enabled) hideBar();
    } else if (msg.type === 'LEXI_PAUSED') {
      paused = !!msg.paused;
      if (paused) hideBar();
    }
  }

  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }

  // ── Vocab indexing ──

  function rebuildIndexes() {
    nounGenus.clear();
    verbInfinitive.clear();
    validWords.clear();
    typoFix.clear();
    compoundNouns.clear();

    const wl = PREDICTION.getWordList();
    for (const entry of wl) {
      const w = entry.word;
      if (!w) continue;
      validWords.add(w);
      // Verb infinitives are stored as "å sykle" / "å være" — also accept the
      // bare infinitive so unprefixed usage doesn't get flagged as unknown.
      if (w.startsWith('å ')) validWords.add(w.slice(2));

      if ((entry.bank === 'nounbank' || entry.type === 'nounform' || entry.type === 'plural') && entry.genus) {
        // Only set genus if not already present, so the base form wins
        // for common ambiguous words.
        if (!nounGenus.has(w)) nounGenus.set(w, entry.genus);
      }

      // For særskriving: only consider noun-bank base entries, to avoid
      // flagging "stor by" (valid phrase) as a compound of the adjective form.
      if (entry.bank === 'nounbank' && entry.type !== 'typo') {
        compoundNouns.add(w);
      }

      if (entry.type === 'conjugation' && entry.baseWord) {
        const inf = entry.baseWord.replace(/^å\s+/i, '').trim();
        if (inf && inf !== w) verbInfinitive.set(w, inf);
      }

      if (entry.type === 'typo' && entry.display) {
        typoFix.set(w, entry.display);
      }
    }
  }

  // ── Tokenization ──

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
        end: m.index + m[0].length,
      });
    }
    return out;
  }

  // ── Checker ──

  function check(text, cursorPos) {
    const findings = [];
    if (!enabled || paused || !text || text.length < 3) return findings;
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
              type: 'gender',
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
            type: 'modal_form',
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
          type: 'sarskriving',
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
          type: 'typo',
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
        const fuzzy = findFuzzyNeighbor(t.word);
        if (fuzzy) {
          findings.push({
            type: 'typo',
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

  function findFuzzyNeighbor(word) {
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
      // Tiebreak by shared prefix length — with "komer", "kommer" (shares
      // "kom") beats "koner" (shares "ko"). Subtract d so lower distance
      // still wins across the board.
      const shared = sharedPrefixLen(word, cand);
      const score = shared - d * 10;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    return best;
  }

  function sharedPrefixLen(a, b) {
    const n = Math.min(a.length, b.length);
    let i = 0;
    while (i < n && a[i] === b[i]) i++;
    return i;
  }

  // When two findings cover overlapping spans (e.g., særskriving + typo on
  // the same word), keep the earlier-listed one — order in the checker loop
  // mirrors pedagogical priority.
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

  // ── Input wiring ──

  function attachListeners() {
    document.addEventListener('input', onInput, true);
    document.addEventListener('keyup', onInput, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('blur', onBlur, true);
    window.addEventListener('scroll', positionBar, true);
    window.addEventListener('resize', positionBar);
  }

  function onFocus(e) {
    if (!enabled || paused) return;
    if (!PREDICTION.isTextInput(e.target)) return;
    activeEl = e.target;
    schedule();
  }

  function onInput(e) {
    if (!enabled || paused) return;
    if (!PREDICTION.isTextInput(e.target)) return;
    activeEl = e.target;
    schedule();
  }

  function onBlur() {
    // Keep bar briefly so users can click fixes; hide after a short grace.
    setTimeout(() => {
      if (document.activeElement !== activeEl && bar && !bar.contains(document.activeElement)) {
        hideBar();
      }
    }, 200);
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runCheck();
    }, 800);
  }

  function runCheck() {
    if (!activeEl || !enabled || paused) { hideBar(); return; }
    const { text, cursor } = readInput(activeEl);
    if (!text || text.length < 3) { hideBar(); return; }
    const findings = check(text, cursor);
    if (findings.length === 0) { hideBar(); return; }
    renderBar(findings);
  }

  function readInput(el) {
    if (el.isContentEditable) {
      // contenteditable — just read the textContent. Applying fixes in
      // contenteditable is non-trivial (v1 renders read-only suggestions).
      return { text: el.textContent || '', cursor: null };
    }
    return { text: el.value || '', cursor: el.selectionEnd };
  }

  // ── UI ──

  function ensureBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'lexi-spell-bar';
    bar.addEventListener('mousedown', e => e.preventDefault()); // prevent blur
    document.body.appendChild(bar);
    return bar;
  }

  function renderBar(findings) {
    const el = ensureBar();
    const top = findings.slice(0, 3);
    const isEditable = activeEl && activeEl.isContentEditable;

    const items = top.map((f, idx) => `
      <div class="lh-spell-item" data-idx="${idx}">
        <span class="lh-spell-msg">${escapeHtml(f.message)}</span>
        ${isEditable ? '' : `<button class="lh-spell-fix" data-idx="${idx}">Fiks</button>`}
      </div>
    `).join('');

    const more = findings.length > top.length ? `<div class="lh-spell-more">+${findings.length - top.length} til</div>` : '';

    el.innerHTML = `
      <div class="lh-spell-header">Skrivehjelp (${findings.length})</div>
      ${items}
      ${more}
    `;

    el.querySelectorAll('.lh-spell-fix').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        const idx = Number(btn.dataset.idx);
        applyFix(findings[idx]);
      });
    });

    el.classList.add('visible');
    positionBar();
  }

  function positionBar() {
    if (!bar || !activeEl) return;
    const r = activeEl.getBoundingClientRect();
    // Place just below the input, within viewport.
    const top = Math.min(window.innerHeight - 40, r.bottom + 4 + window.scrollY - window.scrollY);
    bar.style.top = `${r.bottom + window.scrollY + 4}px`;
    bar.style.left = `${r.left + window.scrollX}px`;
    bar.style.maxWidth = `${Math.max(280, r.width)}px`;
  }

  function hideBar() {
    if (bar) bar.classList.remove('visible');
  }

  function applyFix(finding) {
    if (!activeEl || !finding) return;
    if (activeEl.isContentEditable) return; // v1: read-only for contenteditable

    const value = activeEl.value || '';
    const before = value.slice(0, finding.start);
    const after = value.slice(finding.end);
    const next = before + finding.fix + after;
    activeEl.value = next;
    const newCursor = before.length + finding.fix.length;
    try { activeEl.setSelectionRange(newCursor, newCursor); } catch (_) { /* noop */ }
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Re-check immediately — fixing one error may reveal a cascading one.
    schedule();
  }

  function escapeHtml(s) {
    const d = document.createElement('span');
    d.textContent = s;
    return d.innerHTML;
  }
})();
