/**
 * Leksihjelp — Spell / Grammar Check (content script, DOM adapter)
 *
 * Scans Norwegian (NB/NN) text in the active input for learner errors that
 * browsers miss. Each error gets a small dot anchored under the word;
 * clicking opens a popover with accept/dismiss actions.
 *
 * This file is the DOM/UI adapter only. Rule evaluation lives in
 * `spell-check-core.js` (pure, Node-requireable). Vocab comes from the
 * shared `__lexiVocab` seam (vocab-seam.js), so this module no longer
 * rebuilds its own indexes and has zero references to word-prediction.js
 * internals or premium/subscription state — it could later be extracted
 * to skriv.papertek.app as a standalone product (INFRA-04).
 *
 * v1 error classes (emitted by the core as `rule_id`):
 *   - Gender article mismatch       ("en hus"       → "et hus")
 *   - Wrong verb form after modal   ("kan spiser"   → "kan spise")
 *   - Særskriving                   ("skole sekk"   → "skolesekk")
 *   - Known typo                    ("komer"        → "kommer")
 */

(function () {
  'use strict';

  // ── Seam bindings ──
  const VOCAB = self.__lexiVocab;
  const CORE  = self.__lexiSpellCore;
  if (!VOCAB || !CORE) return; // vocab-seam.js + spell-check-core.js must load first

  // ── State ──
  let enabled = false;
  let paused = false;
  let activeEl = null;
  let debounceTimer = null;

  // ── Init ──
  init();

  // Temporary diagnostic logger — helps pinpoint why markers aren't
  // rendering on third-party editors. Enable in devtools with
  // `window.__lexiSpellDebug = true` or it runs anyway with reduced volume.
  function dbg(...args) {
    if (typeof window !== 'undefined' && window.__lexiSpellDebug) {
      console.log('[lexi-spell]', ...args);
    }
  }
  function warn(...args) {
    console.log('[lexi-spell]', ...args);
  }

  async function init() {
    const stored = await storageGet(['predictionEnabled', 'spellCheckEnabled', 'lexiPaused']);
    paused = !!stored.lexiPaused;
    const predictionEnabled = stored.predictionEnabled !== false;
    // Default: tracks prediction (same users, same gating).
    // Explicit spellCheckEnabled=false disables even if prediction is on.
    enabled = predictionEnabled && stored.spellCheckEnabled !== false;

    warn('init', { lang: VOCAB.getLanguage(), enabled, paused, predictionEnabled, spellCheckEnabled: stored.spellCheckEnabled });

    // Vocab is loaded by vocab-seam.js; just wait for it to be ready.
    // The seam's onReady queue handles late subscribers deterministically.
    VOCAB.onReady(() => {
      warn('vocab ready', {
        validWords: VOCAB.getValidWords().size,
        typos: VOCAB.getTypoFix().size,
        nouns: VOCAB.getNounGenus().size,
      });
    });

    attachListeners();

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    // Phase 5 / UX-02: hydrate + subscribe to the alternates-visible toggle
    // (storage key written by popup.js initSettings — Plan 04). A live flip
    // re-renders the active popover in place so the user sees the layout
    // change without having to close and re-open it.
    chrome.storage.local.get('spellCheckAlternatesVisible', (r) => {
      alternatesVisible = r && r.spellCheckAlternatesVisible === true;
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if ('spellCheckAlternatesVisible' in changes) {
        alternatesVisible = changes.spellCheckAlternatesVisible.newValue === true;
        if (popover && activePopoverIdx >= 0 && lastFindings[activePopoverIdx]) {
          showPopover(activePopoverIdx, lastFindings[activePopoverIdx]);
        }
      }
    });

    // Expose state for ad-hoc inspection from devtools.
    if (typeof window !== 'undefined') {
      window.__lexiSpell = {
        state: () => ({
          lang: VOCAB.getLanguage(),
          enabled,
          paused,
          activeEl,
          findings: lastFindings,
          markers: markers.length,
        }),
        recheck: () => runCheck(),
        validWordsSize: () => VOCAB.getValidWords().size,
      };
    }
  }

  function handleRuntimeMessage(msg) {
    if (msg.type === 'LANGUAGE_CHANGED') {
      // vocab-seam.js owns the rebuild; we just clear overlay and re-check
      // once vocab is ready again.
      hideOverlay();
      VOCAB.onReady(() => { /* no-op: next user input will trigger a check */ });
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
      return VOCAB.isTextInput(target) ? target : null;
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
    if (!enabled || paused) { dbg('skip focus — disabled/paused', { enabled, paused }); return; }
    const el = resolveEditable(e.target);
    if (!el) { dbg('skip focus — no editable', e.target?.tagName); return; }
    if (activeEl !== el) {
      // Reset dismissals when moving to a new input — they're session-scoped
      // to the currently focused element.
      dismissed.clear();
    }
    activeEl = el;
    warn('focus → active', { tag: el.tagName, cls: el.className, ce: el.isContentEditable });
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
    if (!activeEl || !enabled || paused) {
      dbg('runCheck skip', { activeEl: !!activeEl, enabled, paused });
      hideOverlay();
      return;
    }
    const { text, cursor } = readInput(activeEl);
    if (!text || text.length < 3) { hideOverlay(); return; }
    const lang = VOCAB.getLanguage();
    const supported = ['nb', 'nn', 'en', 'de', 'es', 'fr'];
    if (!supported.includes(lang)) { hideOverlay(); return; }

    const vocab = {
      nounGenus:        VOCAB.getNounGenus(),
      nounForms:        VOCAB.getNounForms(),
      verbInfinitive:   VOCAB.getVerbInfinitive(),
      validWords:       VOCAB.getValidWords(),
      isAdjective:      VOCAB.getIsAdjective(),
      knownPresens:     VOCAB.getKnownPresens(),
      knownPreteritum:  VOCAB.getKnownPreteritum(),
      verbForms:        VOCAB.getVerbForms(),
      typoFix:          VOCAB.getTypoFix(),
      compoundNouns:    VOCAB.getCompoundNouns(),
      pitfalls:         VOCAB.getPitfalls(),
      freq:             VOCAB.getFreq(),  // Phase 03.1 / SC-01: Zipf tiebreaker Map (nb/nn populated, empty for others)
      sisterValidWords: VOCAB.getSisterValidWords(),  // Phase 4 / SC-03: cross-dialect tolerance
      // Phase 6: governance bank data for register/collocation/redundancy rules.
      registerWords:      VOCAB.getRegisterWords(),
      collocations:       VOCAB.getCollocations(),
      redundancyPhrases:  VOCAB.getRedundancyPhrases(),
      isFeatureEnabled:   VOCAB.isFeatureEnabled || (() => true),
      // Phase 13: NN infinitive classification for DOC-04 register-drift rule.
      nnInfinitiveClasses: VOCAB.getNNInfinitiveClasses(),
      // Phase 8: DE/FR auxiliary choice
      participleToAux:    VOCAB.getParticipleToAux(),
      // Phase 11: ES mood/aspect indexes
      esPresensToVerb:    VOCAB.getEsPresensToVerb(),
      esSubjuntivoForms:  VOCAB.getEsSubjuntivoForms(),
      esImperfectoForms:  VOCAB.getEsImperfectoForms(),
      esPreteritumToVerb: VOCAB.getEsPreteritumToVerb(),
      // Phase 11: FR mood indexes
      frPresensToVerb:    VOCAB.getFrPresensToVerb(),
      frSubjonctifForms:  VOCAB.getFrSubjonctifForms(),
      frSubjonctifDiffers: VOCAB.getFrSubjonctifDiffers(),
      // Phase 14: EN irregular forms
      irregularForms:     VOCAB.getIrregularForms(),
    };

    let findings = CORE.check(text, vocab, { cursorPos: cursor, lang });
    // Legacy-UI shim: the popover + marker CSS classes read `f.type`. The core
    // emits `rule_id` (the fixture-harness contract), so we alias here. UI code
    // elsewhere in this file can keep reading `f.type` unchanged.
    for (const f of findings) f.type = f.rule_id;
    findings = findings.filter(f => !dismissed.has(dismissKey(f)));

    warn('check', {
      lang,
      vocabSize: vocab.validWords.size,
      textHead: (text || '').slice(0, 80),
      findingsCount: findings.length,
    });
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
  // Phase 5 / UX-02: popup Settings toggle subscriber. Plan 04 writes the key;
  // this module hydrates on init and re-reads via chrome.storage.onChanged so
  // a live toggle flips the active popover layout without a re-open.
  let alternatesVisible = false;

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

    let rendered = 0, skipped = 0;
    findings.forEach((finding, idx) => {
      const rect = positionForRange(activeEl, finding.start, finding.end);
      if (!rect) {
        skipped++;
        warn('skip — no rect', finding.original, { start: finding.start, end: finding.end, elRect: activeEl.getBoundingClientRect() });
        return;
      }
      const er = activeEl.getBoundingClientRect();
      if (!isInsideElement(activeEl, rect)) {
        skipped++;
        warn('skip — outside el', finding.original, { rect, elRect: { top: er.top, left: er.left, right: er.right, bottom: er.bottom } });
        return;
      }
      const dot = document.createElement('div');
      // Phase 6: severity-aware CSS class suffix
      const severitySuffix = finding.severity === 'warning' ? ' lh-spell-warn'
                           : finding.severity === 'hint'    ? ' lh-spell-hint'
                           : '';
      dot.className = `lh-spell-dot lh-spell-${finding.type}${severitySuffix}`;
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
      // Phase 6: hint markers span the full word width instead of being a small dot
      if (finding.severity === 'hint') {
        const wordWidth = rect.width || (rect.right - rect.left);
        dot.style.width = wordWidth + 'px';
        dot.style.height = '0';
        dot.style.top = (rect.bottom || (rect.top + rect.height)) + 'px';
        dot.style.left = rect.left + 'px';
      }
      rendered++;
    });
    warn('markers rendered', { rendered, skipped, total: findings.length });
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
    // Phase 6: severity-aware popover class
    const popoverSeveritySuffix = finding.severity === 'warning' ? ' lh-spell-popover-warn'
                                : finding.severity === 'hint'    ? ' lh-spell-popover-hint'
                                : '';
    popover.className = `lh-spell-popover lh-spell-popover-${finding.type}${popoverSeveritySuffix}`;
    popover.addEventListener('mousedown', e => e.preventDefault());

    const lang = VOCAB.getLanguage();
    const suggestions = Array.isArray(finding.suggestions) && finding.suggestions.length
      ? finding.suggestions
      : [finding.fix];

    const useMulti = alternatesVisible && suggestions.length > 1;

    // Phase 05.1-05 inline UX gap-closure: small register-badge pill in the
    // popover header so the student can tell which Norwegian standard the
    // rule pipeline is running in (disambiguates the "skrevet valid NB but
    // unknown NN" class of confusion when pages carry mixed-register text).
    // Resolved per-target-locale: the label for "Bokmål" / "Nynorsk" is read
    // from that locale's strings block, mirroring the nb-gender three-beat
    // pattern. Rendered in BOTH the single- and multi-suggest branches.
    const registerBadgeHtml = renderRegisterBadge(lang);

    if (useMulti) {
      const topK = suggestions.slice(0, 3);
      const rest = suggestions.slice(3, 8);
      const rowsHtml = topK.map(s =>
        `<button type="button" class="lh-spell-sugg-row" data-fix="${escapeAttr(s)}">${escapeHtml(s)}</button>`
      ).join('');
      const visFlereHtml = rest.length
        ? `<button type="button" class="lh-spell-vis-flere" data-state="collapsed">Vis flere \u2304</button>`
        : '';
      popover.innerHTML = `
        <div class="lh-spell-head">
          <span class="lh-spell-orig">${escapeHtml(finding.original)}</span>
          ${registerBadgeHtml}
        </div>
        <div class="lh-spell-explain">${renderExplain(finding, lang)}</div>
        <div class="lh-spell-suggestions">${rowsHtml}${visFlereHtml}</div>
        <div class="lh-spell-actions">
          <button type="button" class="lh-spell-btn lh-spell-decline">\u2715 Avvis</button>
          <button type="button" class="lh-spell-btn lh-spell-report">\u26a0 Feil?</button>
        </div>
      `;
      popover.querySelectorAll('.lh-spell-sugg-row').forEach(row => {
        row.addEventListener('click', () => applyFix({ ...finding, fix: row.dataset.fix }));
      });
      if (rest.length) {
        const visFlereBtn = popover.querySelector('.lh-spell-vis-flere');
        visFlereBtn.addEventListener('click', () => {
          const state = visFlereBtn.dataset.state;
          const suggList = popover.querySelector('.lh-spell-suggestions');
          if (state === 'collapsed') {
            rest.forEach(s => {
              const row = document.createElement('button');
              row.type = 'button';
              row.className = 'lh-spell-sugg-row';
              row.dataset.fix = s;
              row.textContent = s;
              row.addEventListener('click', () => applyFix({ ...finding, fix: s }));
              suggList.insertBefore(row, visFlereBtn);
            });
            visFlereBtn.textContent = 'Vis f\u00e6rre \u2303';
            visFlereBtn.dataset.state = 'expanded';
          } else {
            const extraRows = popover.querySelectorAll('.lh-spell-sugg-row');
            for (let i = 3; i < extraRows.length; i++) extraRows[i].remove();
            visFlereBtn.textContent = 'Vis flere \u2304';
            visFlereBtn.dataset.state = 'collapsed';
          }
        });
      }
    } else {
      popover.innerHTML = `
        <div class="lh-spell-head">
          <span class="lh-spell-orig">${escapeHtml(finding.original)}</span>
          <span class="lh-spell-arrow">\u2192</span>
          <span class="lh-spell-fix-text">${escapeHtml(suggestions[0])}</span>
          ${registerBadgeHtml}
        </div>
        <div class="lh-spell-explain">${renderExplain(finding, lang)}</div>
        <div class="lh-spell-actions">
          <button type="button" class="lh-spell-btn lh-spell-accept">\u2713 Fiks</button>
          <button type="button" class="lh-spell-btn lh-spell-decline">\u2715 Avvis</button>
          <button type="button" class="lh-spell-btn lh-spell-report">\u26a0 Feil?</button>
        </div>
      `;
      popover.querySelector('.lh-spell-accept').addEventListener('click', () => applyFix(finding));
    }

    popover.querySelector('.lh-spell-decline').addEventListener('click', () => {
      dismissed.add(dismissKey(finding));
      hidePopover();
      runCheck();
    });
    const reportBtn = popover.querySelector('.lh-spell-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        reportBtn.textContent = '…';
        reportBtn.disabled = true;
        const surrounding = activeEl ? (activeEl.value || activeEl.textContent || '').slice(
          Math.max(0, finding.start - 40), finding.end + 40
        ) : '';
        sendReport({
          type: 'spell',
          ruleId: finding.rule_id || finding.type,
          original: finding.original,
          suggestion: finding.fix || (finding.suggestions && finding.suggestions[0]) || '',
          context: surrounding,
          language: lang,
          url: window.location.href,
        }).then(ok => {
          reportBtn.textContent = ok ? '✓ Sendt' : '✗ Feil';
          setTimeout(() => { hidePopover(); runCheck(); }, 1200);
        });
      });
    }
    overlay.appendChild(popover);
    positionPopover(markers[idx]?.rect);
  }

  function typeLabel(t) {
    switch (t) {
      case 'typo': return 'Skrivefeil';
      case 'homophone': return 'Forveksling';
      case 'context-typo': return 'Kontekst-feil';
      case 'gender': return 'Kjønn';
      case 'agreement': return 'Samsvarsfeil';
      case 'modal_form': return 'Verbform etter hjelpeverb';
      case 'sarskriving': return 'Særskriving';
      case 'de-capitalization': return 'Stor forbokstav';
      case 'de-grammar': return 'Tysk grammatikk';
      case 'en-grammar': return 'Engelsk grammatikk';
      case 'es-accent': return 'Aksent / spesialtegn';
      case 'es-coordination': return 'Sammenbinding';
      case 'es-grammar': return 'Spansk grammatikk';
      case 'fr-grammar': return 'Fransk grammatikk';
      case 'fr-contraction': return 'Kontraksjon';
      case 'fr-preposition': return 'Sammenslåing';
      default: return '';
    }
  }

  // Phase 05.1-05 inline UX gap-closure: resolve the human-readable label for
  // the active Norwegian standard (nb → "Bokmål", nn → "Nynorsk") and wrap it
  // in a small pill, so the popover always tells the student which register
  // the rule pipeline is running in. Uses __lexiSpellCore.getString so the
  // label reads out of the SAME locale it names (per-target-locale pattern,
  // matching nb-gender Gap C). Gracefully no-ops if i18n isn't loaded or lang
  // is anything other than nb/nn (shouldn't happen — runCheck() early-exits
  // for other locales — but belt-and-braces so we never render a raw key).
  function renderRegisterBadge(lang) {
    if (lang !== 'nb' && lang !== 'nn') return '';
    const key = 'register_label_' + lang;
    let label = key;
    try {
      if (CORE && typeof CORE.getString === 'function') {
        label = CORE.getString(key, lang);
      }
    } catch (_) { /* noop — fall through to key fallback */ }
    // If i18n wasn't loaded yet, getString returns the raw key. Prefer a
    // short upper-case two-letter code over displaying the key itself.
    if (!label || label === key) label = lang.toUpperCase();
    return `<span class="lh-spell-register-badge" data-register="${escapeAttr(lang)}">${escapeHtml(label)}</span>`;
  }

  // Phase 5 / UX-01: look up the per-rule `explain` callable and return the
  // NB- or NN-register student-friendly sentence (already HTML-safe:
  // rule.explain() templates call escapeHtml on every interpolated token).
  // Graceful fallback chain (Pitfall 9): callable.lang → callable.nb → string
  // → typeLabel. Curated-typo (priority 40) vs fuzzy-typo (priority 50) share
  // rule_id 'typo' — route by (id, priority) to hit the correct callable
  // (Pitfall 1 disambiguation).
  function renderExplain(finding, lang) {
    const host = typeof self !== 'undefined' ? self : globalThis;
    const rules = host.__lexiSpellRules || [];
    let rule = rules.find(r =>
      r.id === finding.rule_id &&
      r.priority === finding.priority &&
      Array.isArray(r.languages) && r.languages.includes(lang)
    );
    if (!rule) {
      rule = rules.find(r =>
        r.id === finding.rule_id &&
        Array.isArray(r.languages) && r.languages.includes(lang)
      );
    }
    if (!rule) return escapeHtml(typeLabel(finding.type || finding.rule_id));

    let result;
    try {
      result = typeof rule.explain === 'function' ? rule.explain(finding) : rule.explain;
    } catch (e) {
      console.warn('[lexi-spell] rule.explain threw', rule.id, e);
      return escapeHtml(typeLabel(finding.type || finding.rule_id));
    }

    if (typeof result === 'string') return result;
    if (result && typeof result[lang] === 'string') return result[lang];
    if (result && typeof result.nb === 'string') return result.nb;
    return escapeHtml(typeLabel(finding.type || finding.rule_id));
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
    return {
      top: rect.top, left: rect.left,
      width: rect.width, height: rect.height,
      bottom: rect.top + rect.height, right: rect.left + rect.width,
    };
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

    const top = mRect.top - el.scrollTop;
    const left = mRect.left - el.scrollLeft;
    return {
      top, left,
      width: mRect.width, height: mRect.height,
      bottom: top + mRect.height, right: left + mRect.width,
    };
  }

  async function sendReport(data) {
    try {
      const stored = await new Promise(r => chrome.storage.local.get(['sessionToken', 'siteUrl'], r));
      const base = stored.siteUrl || 'https://leksihjelp.no';
      const headers = { 'Content-Type': 'application/json', 'X-Lexi-Client': 'lexi-extension' };
      if (stored.sessionToken) headers['Authorization'] = 'Bearer ' + stored.sessionToken;
      const resp = await fetch(base + '/api/report', { method: 'POST', headers, body: JSON.stringify(data) });
      return resp.ok;
    } catch (_) { return false; }
  }

  function escapeHtml(s) {
    const d = document.createElement('span');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  }

  // escapeHtml escapes &, <, >. Attribute values must ALSO escape " since
  // the multi-suggest branch interpolates each suggestion into a data-fix="..."
  // attribute. Layered on top of escapeHtml — same shape as word-prediction.js.
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
})();
