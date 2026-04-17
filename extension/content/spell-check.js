/**
 * Leksihjelp — Spell / Grammar Check (content script)
 *
 * Scans Norwegian (NB/NN) text in the active input for learner errors that
 * browsers miss. Each error gets a small dot anchored under the word;
 * clicking opens a popover with accept/dismiss actions.
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

  // UI state lives in the "Overlay + markers + popover" section below.

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
      hideOverlay();
      PREDICTION.onReady(rebuildIndexes);
    } else if (msg.type === 'PREDICTION_TOGGLED') {
      // Prediction off → spell-check off (honor the umbrella toggle).
      if (!msg.enabled) { enabled = false; hideOverlay(); }
    } else if (msg.type === 'SPELL_CHECK_TOGGLED') {
      enabled = !!msg.enabled;
      if (!enabled) hideOverlay();
    } else if (msg.type === 'LEXI_PAUSED') {
      paused = !!msg.paused;
      if (paused) hideOverlay();
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
    window.addEventListener('scroll', schedulePositionRefresh, true);
    window.addEventListener('resize', schedulePositionRefresh);
    document.addEventListener('click', onDocClick, true);
  }

  // Walk up to find the element that actually declared contenteditable, not a
  // nested text node or span that merely inherits it. Rich editors (TipTap,
  // Lexical, ProseMirror) fire focus/input on the root div — but third-party
  // code sometimes bubbles events from deeper nodes, and reading text from a
  // child would miss the rest of the document.
  function resolveEditable(target) {
    if (!target || target.nodeType !== 1) return null;
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      return PREDICTION.isTextInput(target) ? target : null;
    }
    let cur = target;
    while (cur && cur.nodeType === 1) {
      const attr = cur.getAttribute && cur.getAttribute('contenteditable');
      if (attr === 'true' || attr === '') return cur;
      cur = cur.parentElement;
    }
    return target.isContentEditable ? target : null;
  }

  function onFocus(e) {
    if (!enabled || paused) return;
    const el = resolveEditable(e.target);
    if (!el) return;
    if (activeEl !== el) {
      // Reset dismissals when moving to a new input — they're session-scoped
      // to the currently focused element.
      dismissed.clear();
    }
    activeEl = el;
    schedule();
  }

  function onInput(e) {
    if (!enabled || paused) return;
    const el = resolveEditable(e.target);
    if (!el) return;
    activeEl = el;
    schedule();
  }

  function onBlur() {
    // Keep overlay briefly so users can click markers after the input
    // blurs; hide once focus has truly left the editable and our overlay.
    setTimeout(() => {
      const ae = document.activeElement;
      if (!activeEl) return;
      const focusStillInside = activeEl === ae || activeEl.contains(ae);
      const focusInOverlay = overlay && overlay.contains(ae);
      if (!focusStillInside && !focusInOverlay) {
        hideOverlay();
      }
    }, 250);
  }

  function onDocClick(e) {
    if (!popover) return;
    if (popover.contains(e.target)) return;
    for (const m of markers) if (m.el.contains(e.target)) return;
    hidePopover();
  }

  function schedule() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runCheck();
    }, 800);
  }

  function runCheck() {
    if (!activeEl || !enabled || paused) { hideOverlay(); return; }
    const { text, cursor } = readInput(activeEl);
    if (!text || text.length < 3) { hideOverlay(); return; }
    let findings = check(text, cursor);
    // Filter dismissed (original+fix keyed, session-scoped per input).
    findings = findings.filter(f => !dismissed.has(dismissKey(f)));
    if (findings.length === 0) { hideOverlay(); return; }
    lastFindings = findings;
    renderMarkers(findings);
  }

  function dismissKey(f) {
    return `${f.original}|${f.fix}`;
  }

  function readInput(el) {
    if (el.isContentEditable) return { text: el.textContent || '', cursor: null };
    return { text: el.value || '', cursor: el.selectionEnd };
  }

  // ── Overlay + markers + popover ──

  let overlay = null;
  const markers = []; // [{ el, finding, rect }]
  let popover = null;
  let activePopoverIdx = -1;
  let lastFindings = [];
  const dismissed = new Set();
  let posRefreshRaf = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lexi-spell-overlay';
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderMarkers(findings) {
    clearMarkers();
    ensureOverlay();

    findings.forEach((finding, idx) => {
      const rect = positionForRange(activeEl, finding.start, finding.end);
      if (!rect || !isInsideElement(activeEl, rect)) return;
      const dot = document.createElement('div');
      dot.className = `lh-spell-dot lh-spell-${finding.type}`;
      dot.dataset.idx = String(idx);
      dot.title = finding.message;
      dot.addEventListener('mousedown', e => e.preventDefault()); // prevent blur
      dot.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        showPopover(idx, finding);
      });
      overlay.appendChild(dot);
      markers.push({ el: dot, finding, rect });
      positionDot(dot, rect);
    });
  }

  function positionDot(dot, rect) {
    // Thin underline-style bar, full width of the error span, just below it.
    dot.style.top = `${rect.top + rect.height}px`;
    dot.style.left = `${rect.left}px`;
    dot.style.width = `${Math.max(rect.width, 12)}px`;
  }

  // Keep markers aligned with their words when the input scrolls or the
  // viewport resizes. Skip the work if the text itself has changed —
  // schedule() will rerun check().
  function schedulePositionRefresh() {
    if (posRefreshRaf) return;
    posRefreshRaf = requestAnimationFrame(() => {
      posRefreshRaf = null;
      if (!activeEl || markers.length === 0) return;
      for (const m of markers) {
        const rect = positionForRange(activeEl, m.finding.start, m.finding.end);
        if (!rect || !isInsideElement(activeEl, rect)) {
          m.el.style.display = 'none';
          continue;
        }
        m.el.style.display = '';
        positionDot(m.el, rect);
        m.rect = rect;
      }
      if (popover && activePopoverIdx >= 0 && markers[activePopoverIdx]) {
        positionPopover(markers[activePopoverIdx].rect);
      }
    });
  }

  function isInsideElement(el, rect) {
    const er = el.getBoundingClientRect();
    // Keep a few-pixel tolerance so a word at the very top/bottom line still
    // shows its marker.
    return rect.bottom >= er.top - 2 && rect.top <= er.bottom + 2 &&
           rect.right >= er.left - 2 && rect.left <= er.right + 2;
  }

  function clearMarkers() {
    for (const m of markers) m.el.remove();
    markers.length = 0;
    hidePopover();
  }

  function hideOverlay() {
    clearMarkers();
    if (overlay) overlay.remove();
    overlay = null;
  }

  function showPopover(idx, finding) {
    hidePopover();
    activePopoverIdx = idx;
    popover = document.createElement('div');
    popover.className = `lh-spell-popover lh-spell-popover-${finding.type}`;
    popover.addEventListener('mousedown', e => e.preventDefault());
    popover.innerHTML = `
      <div class="lh-spell-head">
        <span class="lh-spell-orig">${escapeHtml(finding.original)}</span>
        <span class="lh-spell-arrow">→</span>
        <span class="lh-spell-fix-text">${escapeHtml(finding.fix)}</span>
      </div>
      <div class="lh-spell-note">${escapeHtml(typeLabel(finding.type))}</div>
      <div class="lh-spell-actions">
        <button type="button" class="lh-spell-btn lh-spell-accept">✓ Fiks</button>
        <button type="button" class="lh-spell-btn lh-spell-decline">✕ Avvis</button>
      </div>
    `;
    popover.querySelector('.lh-spell-accept').addEventListener('click', () => applyFix(finding));
    popover.querySelector('.lh-spell-decline').addEventListener('click', () => {
      dismissed.add(dismissKey(finding));
      hidePopover();
      runCheck();
    });
    overlay.appendChild(popover);
    positionPopover(markers[idx]?.rect);
  }

  function typeLabel(t) {
    switch (t) {
      case 'typo': return 'Skrivefeil';
      case 'gender': return 'Kjønn';
      case 'modal_form': return 'Verbform etter hjelpeverb';
      case 'sarskriving': return 'Særskriving';
      default: return '';
    }
  }

  function positionPopover(rect) {
    if (!popover || !rect) return;
    // Size must be known — force layout.
    const pw = popover.offsetWidth || 240;
    const ph = popover.offsetHeight || 80;
    const margin = 6;
    let top = rect.top - ph - margin;
    if (top < margin) top = rect.bottom + margin + 4; // drop below word if no room above
    let left = rect.left;
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
    if (left < margin) left = margin;
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
  }

  function hidePopover() {
    if (popover) popover.remove();
    popover = null;
    activePopoverIdx = -1;
  }

  // ── Apply fix ──

  function applyFix(finding) {
    if (!activeEl || !finding) return;
    if (activeEl.isContentEditable) {
      applyFixCE(finding);
    } else {
      applyFixTextarea(finding);
    }
    hidePopover();
    // Re-check so markers refresh with updated offsets.
    schedule();
  }

  function applyFixTextarea(finding) {
    const value = activeEl.value || '';
    const before = value.slice(0, finding.start);
    const after = value.slice(finding.end);
    activeEl.value = before + finding.fix + after;
    const cursor = before.length + finding.fix.length;
    try { activeEl.setSelectionRange(cursor, cursor); } catch (_) { /* noop */ }
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function applyFixCE(finding) {
    // Route through the editor's input pipeline so frameworks (TipTap,
    // Lexical, etc.) don't overwrite the DOM mutation on their next render.
    const range = rangeForOffsets(activeEl, finding.start, finding.end);
    if (!range) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    // beforeinput first for modern editors; execCommand fallback for older ones
    let ok = false;
    try {
      const ev = new InputEvent('beforeinput', {
        bubbles: true, cancelable: true,
        inputType: 'insertReplacementText',
        data: finding.fix,
      });
      const dispatched = activeEl.dispatchEvent(ev);
      if (dispatched && !ev.defaultPrevented) {
        ok = document.execCommand && document.execCommand('insertText', false, finding.fix);
      } else {
        // Editor handled it — we're done
        ok = true;
      }
    } catch (_) { ok = false; }
    if (!ok) {
      // Last-ditch: replace the text node content directly. Works in plain
      // contenteditable but may be reverted by some frameworks.
      try {
        range.deleteContents();
        range.insertNode(document.createTextNode(finding.fix));
      } catch (_) { /* noop */ }
    }
    sel.removeAllRanges();
  }

  // ── Range / position helpers ──

  function positionForRange(el, start, end) {
    if (el.isContentEditable) return rectFromCE(el, start, end);
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return rectFromTextarea(el, start, end);
    return null;
  }

  function rangeForOffsets(el, start, end) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startNode = null, startOff = 0, endNode = null, endOff = 0;
    let n;
    while ((n = walker.nextNode())) {
      const len = n.textContent.length;
      const nextOff = offset + len;
      // Use strict > for start: when the start offset lands exactly on a text-node
      // boundary (e.g., between two paragraphs), the character at `start` belongs
      // to the NEXT node, not this one. Using >= here would anchor the range to
      // the very end of the previous node and the Range would span whitespace
      // instead of the target word.
      if (startNode === null && nextOff > start) {
        startNode = n;
        startOff = start - offset;
      }
      if (endNode === null && nextOff >= end) {
        endNode = n;
        endOff = end - offset;
        break;
      }
      offset = nextOff;
    }
    if (!startNode || !endNode) return null;
    try {
      const r = document.createRange();
      r.setStart(startNode, Math.max(0, Math.min(startOff, startNode.textContent.length)));
      r.setEnd(endNode, Math.max(0, Math.min(endOff, endNode.textContent.length)));
      return r;
    } catch (_) { return null; }
  }

  function rectFromCE(el, start, end) {
    const r = rangeForOffsets(el, start, end);
    if (!r) return null;
    const rect = r.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }

  // Mirror-div technique for textarea. Build a hidden clone of the textarea
  // with the same layout, insert a marker span at the target offsets, read
  // its rect. Adjust for the textarea's scroll position.
  function rectFromTextarea(el, start, end) {
    const cs = window.getComputedStyle(el);
    const eRect = el.getBoundingClientRect();
    const mirror = document.createElement('div');
    const copyProps = [
      'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
      'letterSpacing', 'textTransform', 'wordSpacing', 'lineHeight',
      'tabSize', 'overflowWrap', 'wordBreak',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    ];
    for (const p of copyProps) mirror.style[p] = cs[p];
    mirror.style.position = 'fixed';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.top = `${eRect.top}px`;
    mirror.style.left = `${eRect.left}px`;
    mirror.style.width = `${el.clientWidth + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)}px`;
    mirror.style.height = 'auto';

    const value = el.value || '';
    const before = document.createTextNode(value.slice(0, start));
    const marker = document.createElement('span');
    marker.textContent = value.slice(start, end) || '\u200b';
    const after = document.createTextNode(value.slice(end));
    mirror.appendChild(before);
    mirror.appendChild(marker);
    mirror.appendChild(after);
    document.body.appendChild(mirror);
    const mRect = marker.getBoundingClientRect();
    mirror.remove();

    return {
      top: mRect.top - el.scrollTop,
      left: mRect.left - el.scrollLeft,
      width: mRect.width,
      height: mRect.height,
    };
  }

  function escapeHtml(s) {
    const d = document.createElement('span');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }
})();
