/**
 * Leksihjelp — Floating TTS Widget (content script)
 *
 * Shows a glassmorphism widget when user selects text.
 * Uses ElevenLabs (authenticated) or browser speechSynthesis (fallback).
 */

(function () {
  'use strict';

  const { t, initI18n, setUiLanguage, getUiLanguage, langName } = self.__lexiI18n;

  /** Pick the right Norwegian translation based on UI language (nn vs nb). */
  function getTranslation(entry) {
    if (!entry) return '';
    const ui = getUiLanguage();
    if (ui === 'nn' && entry.linkedTo?.nn?.translation) return entry.linkedTo.nn.translation;
    if (ui === 'nb' && entry.linkedTo?.nb?.translation) return entry.linkedTo.nb.translation;
    return entry.translation || '';
  }

  const BACKEND_URL = 'https://leksihjelp.no';

  // Predefined ElevenLabs voices per language
  const ELEVENLABS_VOICES = {
    es: [
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Carolina (feminin)' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'Alejandro (maskulin)' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lucía (feminin)' }
    ],
    de: [
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Hannah (feminin)' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Lukas (maskulin)' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Anna (feminin)' }
    ],
    fr: [
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (feminin)' },
      { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Henri (maskulin)' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Sophie (feminin)' }
    ],
    en: [
      { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Emily (feminin)' },
      { id: 'VR6AewLTigWG4xSOukaG', name: 'James (maskulin)' },
      { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Sophie (feminin)' }
    ],
    no: [
      { id: '2dhHLsmg0MVma2t041qT', name: 'Johannes (maskulin)' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (feminin)' },
      { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura (feminin)' }
    ]
  };

  // Language display names
  const LANG_NAMES = {
    es: 'Spansk',
    de: 'Tysk',
    fr: 'Fransk',
    en: 'Engelsk',
    nn: 'Nynorsk',
    no: 'Norsk'
  };

  // Map language codes to ElevenLabs voice keys
  // NB/NN both use the 'no' Norwegian voices
  const VOICE_LANG_MAP = { nb: 'no', nn: 'no' };

  // Browser TTS voice name patterns per language
  const BROWSER_VOICE_LANGS = {
    es: 'es',
    de: 'de',
    fr: 'fr',
    en: 'en',
    nb: 'nb',
    nn: 'nb', // Nynorsk uses same voice as Bokmål
    no: 'nb'
  };

  let widget = null;
  let currentAudio = null;
  let currentUtterance = null;
  let isAuthenticated = false;
  let currentLang = 'en'; // Target language (from settings)
  let selectedText = '';
  // Phase 27: cached exam-mode flag. Updated on init + storage.onChanged.
  let examMode = false;
  let readingLang = 'target'; // 'target' or 'no' - which language to read aloud
  let widgetWordSpans = []; // DOM span references for each word in the widget text area
  let wordCharPositions = []; // [{word, charStart, charEnd}] for timing sync
  let wordTimingInterval = null; // For ElevenLabs word timing estimation
  let browserTtsCharIndex = 0; // Last known charIndex for browser TTS restart
  let widgetEnabled = true;       // Hurtigoppslag (double-click → lookup card)
  let ttsWidgetEnabled = true;    // Uttaleknapp (TTS bubble on text selection)
  let justDragged = false; // Prevents hideWidget after drag ends
  let justDblClicked = false; // Prevents TTS widget on double-click (lookup handles it)

  // Font size settings
  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 36;
  const FONT_SIZE_STEP = 1;
  const FONT_SIZE_DEFAULT = 15;
  let widgetFontSize = FONT_SIZE_DEFAULT;
  let fontSizeMode = 'auto'; // 'auto' or 'fixed'

  // ── Init ──
  init();

  async function init() {
    await initI18n();
    const stored = await chromeStorageGet(['isAuthenticated', 'language', 'widgetEnabled', 'ttsWidgetEnabled', 'widgetFontSize', 'fontSizeMode', 'examMode', 'widgetPos']);
    isAuthenticated = stored.isAuthenticated || false;
    currentLang = stored.language || 'en';
    widgetEnabled = stored.widgetEnabled !== false;
    // Migrate from legacy combined widgetEnabled if ttsWidgetEnabled was
    // never written, so users who turned the old combined toggle off keep
    // both surfaces off until they explicitly re-enable each one.
    ttsWidgetEnabled = stored.ttsWidgetEnabled !== undefined && stored.ttsWidgetEnabled !== null
      ? stored.ttsWidgetEnabled !== false
      : stored.widgetEnabled !== false;
    widgetFontSize = stored.widgetFontSize || FONT_SIZE_DEFAULT;
    fontSizeMode = stored.fontSizeMode || 'auto';
    examMode = !!stored.examMode;
    const widgetPos = stored.widgetPos;

    createWidget();
    if (widgetPos) {
      widget.classList.add('dragged');
      widget.style.setProperty('left', widgetPos.left + 'px', 'important');
      widget.style.setProperty('top', widgetPos.top + 'px', 'important');
    }
    applyExamModeClass();
    attachListeners();

    // Phase 27: live-toggle awareness. The widget itself stays visible in
    // exam mode (dictionary lookup + TTS are allowed static reference); only
    // surfaces flagged unsafe in __lexiExamRegistry close. We close the
    // pedagogy panel here so a Lær mer expansion doesn't survive the flip.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if ('examMode' in changes) {
        examMode = !!changes.examMode.newValue;
        applyExamModeClass();
        if (examMode && !isSurfaceAllowed('widget.pedagogyPanel')) {
          collapsePedagogyPanelIfOpen();
        }
      }
    });

    function collapsePedagogyPanelIfOpen() {
      // Best-effort: if any "Lær mer" disclosure is currently open inside the
      // widget, close it. The widget renders pedagogy via a <details> element
      // (or an .lh-pedagogy-open class) — both shapes covered.
      if (!widget) return;
      const det = widget.querySelectorAll('details[open]');
      det.forEach(d => d.removeAttribute('open'));
      const open = widget.querySelectorAll('.lh-pedagogy-open');
      open.forEach(n => n.classList.remove('lh-pedagogy-open'));
    }

    // Listen for setting changes and context menu actions
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'LANGUAGE_CHANGED') currentLang = msg.language;
      if (msg.type === 'AUTH_CHANGED') isAuthenticated = msg.isAuthenticated;
      if (msg.type === 'UI_LANGUAGE_CHANGED') {
        setUiLanguage(msg.uiLanguage);
      }
      if (msg.type === 'WIDGET_ENABLED_CHANGED') {
        widgetEnabled = msg.enabled;
        // Hurtigoppslag controls the double-click lookup card; the TTS
        // floater has its own toggle (ttsWidgetEnabled) and is not hidden
        // here. If a lookup card is open, close it.
        const card = document.getElementById('lexi-lookup-card');
        if (!widgetEnabled && card) card.remove();
      }
      if (msg.type === 'TTS_WIDGET_ENABLED_CHANGED') {
        ttsWidgetEnabled = msg.enabled;
        if (!ttsWidgetEnabled) hideWidget();
      }
      if (msg.type === 'PLAY_TTS' && msg.text) {
        selectedText = msg.text;
        showWidget();
        handlePlay();
      }
      if (msg.type === 'LOOKUP_WORD' && msg.word) {
        showInlineLookup(msg.word);
      }
      if (msg.type === 'TRIGGER_LOOKUP') {
        const sel = window.getSelection().toString().trim();
        if (sel) showInlineLookup(sel);
      }
      if (msg.type === 'TRIGGER_TTS') {
        const sel = window.getSelection().toString().trim();
        if (sel) {
          selectedText = sel;
          showWidget();
          handlePlay();
        }
      }
    });
  }

  function chromeStorageGet(keys) {
    return new Promise(resolve => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  // Phase 27: apply/remove the exam-mode amber-border class on the widget root.
  // CSS hook lives in styles/content.css (.lh-exam-mode) and ALSO ships to
  // lockdown via the sync pipeline (see CLAUDE.md "Downstream consumer").
  function applyExamModeClass() {
    if (!widget) return;
    widget.classList.toggle('lh-exam-mode', !!examMode);
  }

  // Phase 27: surface gate using the shared helper. Returns true when the
  // surface should be SHOWN (safe), false when it should be hidden.
  function isSurfaceAllowed(surfaceId) {
    const helper = self.__lexiExam;
    if (!helper) return !examMode; // fail-safe: if helper missing, off==allowed, on==hidden
    return helper.isSurfaceSafe(surfaceId, examMode);
  }

  // ── Widget DOM ──
  function createWidget() {
    widget = document.createElement('div');
    widget.id = 'lexi-tts-widget';
    const initialModeClass = fontSizeMode === 'auto' ? 'mode-auto' : 'mode-fixed';
    widget.innerHTML = `
      <div class="lh-header">
        <span class="lh-title">${t('widget_title')}</span>
        <div class="lh-font-controls ${initialModeClass}">
          <button class="lh-font-btn lh-font-mode" title="${t('widget_font_auto_tooltip')}">${fontSizeMode === 'auto' ? t('widget_font_auto') : t('widget_font_fixed')}</button>
          <button class="lh-font-btn lh-font-decrease" title="${t('widget_font_smaller')}">A&minus;</button>
          <button class="lh-font-btn lh-font-increase" title="${t('widget_font_larger')}">A+</button>
        </div>
        <div class="lh-header-actions">
          <button class="lh-pause-widget" title="${t('pause_tts_widget_title')}">⏸</button>
          <button class="lh-close" title="${t('widget_close')}">&times;</button>
        </div>
      </div>
      <div class="lh-lang-toggle"></div>
      <div class="lh-text-area-wrapper">
        <div class="lh-text-area" role="region" aria-label="${t('widget_selected_text')}"></div>
      </div>
      <div class="lh-controls">
        <button class="lh-play-btn" title="${t('widget_play')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="lh-slider-group">
          <div class="lh-slider-row">
            <span class="lh-slider-label">${t('widget_speed')}</span>
            <input type="range" class="lh-slider" id="lh-speed" min="0.7" max="1.2" step="0.1" value="1.0">
            <span class="lh-speed-value">1.0×</span>
          </div>
        </div>
      </div>
      <select class="lh-voice-select" id="lh-voice"></select>
      <div class="lh-mode-badge"></div>
    `;
    (document.fullscreenElement || document.documentElement).appendChild(widget);

    // Attach widget event listeners
    widget.querySelector('.lh-close').addEventListener('click', hideWidget);
    widget.querySelector('.lh-pause-widget').addEventListener('click', disableWidgetQuick);
    widget.querySelector('.lh-play-btn').addEventListener('click', handlePlay);
    widget.querySelector('#lh-speed').addEventListener('input', (e) => {
      widget.querySelector('.lh-speed-value').textContent = `${parseFloat(e.target.value).toFixed(1)}×`;
      // Live speed update for browser TTS: restart from current position with new rate
      if (currentUtterance) {
        const newSpeed = parseFloat(e.target.value);
        const remainingText = selectedText.substring(browserTtsCharIndex);
        if (!remainingText.trim()) return;
        const voiceURI = widget.querySelector('#lh-voice').value;
        window.speechSynthesis.cancel();
        currentUtterance = null;
        playBrowserTTS(remainingText, voiceURI, newSpeed, widget.querySelector('.lh-play-btn'), browserTtsCharIndex);
      }
    });

    // Font size controls
    widget.querySelector('.lh-font-decrease').addEventListener('click', () => {
      fontSizeMode = 'fixed';
      adjustFontSize(-FONT_SIZE_STEP);
      updateFontModeButton();
    });
    widget.querySelector('.lh-font-increase').addEventListener('click', () => {
      fontSizeMode = 'fixed';
      adjustFontSize(FONT_SIZE_STEP);
      updateFontModeButton();
    });
    widget.querySelector('.lh-font-mode').addEventListener('click', toggleFontMode);

    // Language picker is populated dynamically in buildLangPicker()

    // Prevent widget clicks from deselecting text,
    // but allow interaction with form controls (slider, select)
    widget.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      e.preventDefault();
    });

    // ── Drag to reposition ──
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const header = widget.querySelector('.lh-header');
    header.addEventListener('mousedown', (e) => {
      // Don't drag when clicking control buttons
      if (e.target.closest('.lh-close') || e.target.closest('.lh-pause-widget')) return;
      isDragging = true;
      const rect = widget.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - widget.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - widget.offsetHeight));
      widget.classList.add('dragged');
      // Use !important to override the stylesheet !important rules
      widget.style.setProperty('left', x + 'px', 'important');
      widget.style.setProperty('top', y + 'px', 'important');
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        justDragged = true;
        const rect = widget.getBoundingClientRect();
        chrome.storage.local.set({ widgetPos: { left: rect.left, top: rect.top } });
      }
      isDragging = false;
    });

    // ── Resize handles ──
    const resizeRight = document.createElement('div');
    resizeRight.className = 'lh-resize-handle lh-resize-right';
    widget.appendChild(resizeRight);

    const resizeBottom = document.createElement('div');
    resizeBottom.className = 'lh-resize-handle lh-resize-bottom';
    widget.appendChild(resizeBottom);

    const resizeCorner = document.createElement('div');
    resizeCorner.className = 'lh-resize-handle lh-resize-corner';
    widget.appendChild(resizeCorner);

    let isResizing = false;
    let resizeType = '';
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartW = 0;
    let resizeStartH = 0;

    function startResize(e, type) {
      isResizing = true;
      resizeType = type;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      resizeStartW = widget.offsetWidth;
      resizeStartH = widget.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    }

    resizeRight.addEventListener('mousedown', (e) => startResize(e, 'right'));
    resizeBottom.addEventListener('mousedown', (e) => startResize(e, 'bottom'));
    resizeCorner.addEventListener('mousedown', (e) => startResize(e, 'corner'));

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;

      if (resizeType === 'right' || resizeType === 'corner') {
        const newW = Math.max(320, Math.min(window.innerWidth * 0.9, resizeStartW + dx));
        widget.style.setProperty('width', newW + 'px', 'important');
        widget.style.setProperty('min-width', newW + 'px', 'important');
        widget.style.setProperty('max-width', newW + 'px', 'important');
      }
      if (resizeType === 'bottom' || resizeType === 'corner') {
        const newH = Math.max(300, Math.min(window.innerHeight * 0.9, resizeStartH + dy));
        widget.style.setProperty('max-height', newH + 'px', 'important');
        widget.style.setProperty('height', newH + 'px', 'important');
      }
      widget.classList.add('resized');
      applyAutoFontSize();
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) justDragged = true;
      isResizing = false;
    });

  }

  const WIDGET_LANG_FLAGS = { de: '\uD83C\uDDE9\uD83C\uDDEA', es: '\uD83C\uDDEA\uD83C\uDDF8', fr: '\uD83C\uDDEB\uD83C\uDDF7', en: '\uD83C\uDDEC\uD83C\uDDE7', nb: '\uD83C\uDDF3\uD83C\uDDF4', nn: '\uD83C\uDDF3\uD83C\uDDF4' };
  const WIDGET_LANG_LABELS = { de: 'DE', es: 'ES', fr: 'FR', en: 'EN', nb: 'NB', nn: 'NN' };
  const BUNDLED_WIDGET_LANGS = ['nb', 'nn', 'en'];

  async function buildLangPicker() {
    const toggle = widget.querySelector('.lh-lang-toggle');
    if (!toggle) return;

    // Discover available languages
    const langs = [...BUNDLED_WIDGET_LANGS];
    if (window.__lexiVocabStore) {
      try {
        const cached = await window.__lexiVocabStore.listCachedLanguages();
        for (const c of cached) {
          if (!langs.includes(c.language)) langs.push(c.language);
        }
      } catch {}
    }

    toggle.innerHTML = langs.map(lang =>
      `<button class="lh-lang-btn ${lang === currentLang ? 'active' : ''}" data-lang="${lang}">${WIDGET_LANG_FLAGS[lang] || ''} ${WIDGET_LANG_LABELS[lang] || lang.toUpperCase()}</button>`
    ).join('');

    toggle.querySelectorAll('.lh-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (lang === currentLang) return;
        currentLang = lang;
        readingLang = 'target';
        // Update active state
        toggle.querySelectorAll('.lh-lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Phase 30-04 Task 6: floating-widget language is now LOCAL state.
        // Do NOT write to shared `language` storage and do NOT broadcast
        // LANGUAGE_CHANGED. The widget's lang controls TTS voice + the lookup
        // card's source-language reading, not the student's spellcheck/dict
        // global state. Decouples "I'm peeking at an EN PDF" from "I'm
        // writing in NB". The incoming LANGUAGE_CHANGED listener at line 148
        // still pulls global lang INTO the widget when the popup or
        // lockdown's Aa pill changes the writing language.
        updateVoiceOptions();
      });
    });
  }

  function attachListeners() {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideWidget();
    });
  }

  function handleDoubleClick() {
    // Double-click → Hurtigoppslag (lookup card). Gated on the
    // Hurtigoppslag toggle (widgetEnabled), independent of the TTS
    // bubble's own toggle.
    if (!widgetEnabled) return;
    justDblClicked = true;
    setTimeout(() => { justDblClicked = false; }, 50);
    setTimeout(() => {
      const selection = window.getSelection();
      const word = selection.toString().trim();
      if (word && word.length > 0 && !/\s/.test(word)) {
        hideWidget();
        showInlineLookup(word);
      }
    }, 10);
  }

  // ── Text Selection ──
  function handleTextSelection(e) {
    // Text-selection → TTS bubble. Gated on the TTS-widget toggle
    // (ttsWidgetEnabled), independent of Hurtigoppslag.
    if (!ttsWidgetEnabled) return;
    // Ignore mouseup that ends a drag operation
    if (justDragged) { justDragged = false; return; }
    // Ignore clicks inside the widget
    if (widget.contains(e.target)) return;

    setTimeout(() => {
      if (justDblClicked) return;
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0 && text.length < 2000) {
        const editor = document.getElementById('writing-editor');
        if (editor && selection.anchorNode && editor.contains(selection.anchorNode) && /\s/.test(text)) return;
        selectedText = text;
        showWidget();
      } else if (!widget.contains(e.target)) {
        hideWidget();
      }
    }, 10);
  }

  function showWidget() {
    // Phase 27: TTS widget is non-exam-safe (widget.tts). Bail out so the
    // widget never appears during exams. The amber border class is only
    // visible if a non-suppressed surface (none today) ever rendered.
    if (!isSurfaceAllowed('widget.tts')) return;

    stopPlayback();
    removeWordHighlight();
    updateVoiceOptions();
    updateModeBadge();
    buildLangPicker();

    // Populate the text area with word spans
    populateTextArea(selectedText);

    // Reset play button
    const playBtn = widget.querySelector('.lh-play-btn');
    playBtn.disabled = false;
    playBtn.classList.remove('loading');
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

    // Reset language toggle to target language
    readingLang = 'target';
    widget.querySelectorAll('.lh-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === 'target');
    });

    // Keep the user's dragged position if they moved the widget;
    // only use the default center-bottom position on first appearance.
    if (!widget.classList.contains('dragged')) {
      widget.style.removeProperty('left');
      widget.style.removeProperty('top');
    }

    // Reset size if not manually resized
    if (!widget.classList.contains('resized')) {
      widget.style.removeProperty('width');
      widget.style.removeProperty('min-width');
      widget.style.removeProperty('max-width');
      widget.style.removeProperty('height');
      widget.style.removeProperty('max-height');
    }

    updateFontModeButton();

    // Show widget (CSS positions it at bottom center unless dragged)
    widget.classList.add('visible');
  }

  function hideWidget() {
    widget.classList.remove('visible');
    widget.classList.remove('resized');
    widget.style.removeProperty('width');
    widget.style.removeProperty('min-width');
    widget.style.removeProperty('max-width');
    widget.style.removeProperty('height');
    widget.style.removeProperty('max-height');
    stopPlayback();
    removeWordHighlight();
  }

  function disableWidgetQuick() {
    // Pause button on the TTS bubble — disables ONLY the TTS bubble
    // (Uttaleknapp), not Hurtigoppslag. Persists ttsWidgetEnabled so the
    // choice survives reloads, broadcasts so other tabs sync immediately.
    ttsWidgetEnabled = false;
    chrome.storage.local.set({ ttsWidgetEnabled: false });
    try { chrome.runtime.sendMessage({ type: 'TTS_WIDGET_ENABLED_CHANGED', enabled: false }); } catch (_) {}
    hideWidget();
    showToast(t('toast_tts_widget_disabled'));
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'lh-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('visible');
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }, 10);
  }

  // ── Text Area Population ──
  function calculateAutoFontSize(textLength, widgetWidth) {
    // Factor in both text length and available width
    // Wider widget = can use larger font, narrower = smaller font
    const w = widgetWidth || 420;
    const widthFactor = Math.min(1, w / 500); // 0.56 at 280px, 1.0 at 500px+

    let baseSize;
    if (textLength <= 20) baseSize = 32;
    else if (textLength <= 50) baseSize = 28;
    else if (textLength <= 100) baseSize = 24;
    else if (textLength <= 200) baseSize = 22;
    else if (textLength <= 500) baseSize = 19;
    else if (textLength <= 1000) baseSize = 17;
    else baseSize = 15;

    // Scale by widget width, but never below 13px
    return Math.max(13, Math.round(baseSize * widthFactor));
  }

  function applyAutoFontSize() {
    if (fontSizeMode !== 'auto' || !selectedText) return;
    const textArea = widget.querySelector('.lh-text-area');
    if (!textArea) return;
    const autoSize = calculateAutoFontSize(selectedText.length, widget.offsetWidth);
    textArea.style.fontSize = autoSize + 'px';
  }

  function populateTextArea(text) {
    const textArea = widget.querySelector('.lh-text-area');
    textArea.innerHTML = '';
    widgetWordSpans = [];
    wordCharPositions = [];

    // Apply font size based on mode
    if (fontSizeMode === 'auto') {
      const autoSize = calculateAutoFontSize(text.length, widget.offsetWidth);
      textArea.style.fontSize = autoSize + 'px';
    } else {
      textArea.style.fontSize = widgetFontSize + 'px';
    }

    // Split by whitespace, preserving whitespace segments
    const segments = text.split(/(\s+)/);
    let wordIndex = 0;
    let charIndex = 0;

    for (const segment of segments) {
      if (/^\s+$/.test(segment)) {
        // Whitespace: preserve as a text node (rendered via white-space: pre-wrap)
        textArea.appendChild(document.createTextNode(segment));
        charIndex += segment.length;
      } else if (segment.length > 0) {
        // Word: wrap in a span
        const span = document.createElement('span');
        span.className = 'lh-word';
        span.dataset.wordIndex = wordIndex;
        span.textContent = segment;
        textArea.appendChild(span);
        widgetWordSpans.push(span);
        wordCharPositions.push({
          word: segment,
          charStart: charIndex,
          charEnd: charIndex + segment.length
        });
        wordIndex++;
        charIndex += segment.length;
      }
    }

    // Scroll widget to top
    widget.scrollTop = 0;
  }

  function adjustFontSize(delta) {
    widgetFontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, widgetFontSize + delta));
    const textArea = widget.querySelector('.lh-text-area');
    if (textArea) {
      textArea.style.fontSize = widgetFontSize + 'px';
    }
    // Persist preference
    chrome.storage.local.set({ widgetFontSize, fontSizeMode });
  }

  function toggleFontMode() {
    fontSizeMode = fontSizeMode === 'auto' ? 'fixed' : 'auto';
    chrome.storage.local.set({ fontSizeMode });
    updateFontModeButton();
    // Re-render text with new mode
    if (selectedText) populateTextArea(selectedText);
  }

  function updateFontModeButton() {
    const btn = widget?.querySelector('.lh-font-mode');
    if (btn) {
      btn.textContent = fontSizeMode === 'auto' ? t('widget_font_auto') : t('widget_font_fixed');
      btn.title = fontSizeMode === 'auto'
        ? t('widget_font_auto_tooltip')
        : t('widget_font_fixed_tooltip');
    }
    const controls = widget?.querySelector('.lh-font-controls');
    if (controls) {
      controls.classList.toggle('mode-auto', fontSizeMode === 'auto');
      controls.classList.toggle('mode-fixed', fontSizeMode !== 'auto');
    }
  }

  // ── Word-by-Word Highlighting (in-widget) ──
  function highlightWordInWidget(index) {
    clearWidgetWordHighlight();

    if (index < 0 || index >= widgetWordSpans.length) return;

    const span = widgetWordSpans[index];
    span.classList.add('lh-word-active');

    // Auto-scroll to keep the highlighted word visible
    autoScrollToWord(span);
  }

  function clearWidgetWordHighlight() {
    for (const span of widgetWordSpans) {
      span.classList.remove('lh-word-active');
    }
  }

  function autoScrollToWord(span) {
    if (!widget) return;
    const textArea = widget.querySelector('.lh-text-area');
    if (!textArea) return;

    const spanRect = span.getBoundingClientRect();
    const areaRect = textArea.getBoundingClientRect();

    // If the word is below the visible area, scroll down
    if (spanRect.bottom > areaRect.bottom) {
      textArea.scrollTop += (spanRect.bottom - areaRect.bottom) + 8;
    }
    // If the word is above the visible area, scroll up
    else if (spanRect.top < areaRect.top) {
      textArea.scrollTop -= (areaRect.top - spanRect.top) + 8;
    }
  }

  // Remove highlight and stop the timing interval (used when stopping playback)
  function removeWordHighlight() {
    clearWidgetWordHighlight();
    if (wordTimingInterval) {
      cancelAnimationFrame(wordTimingInterval);
      wordTimingInterval = null;
    }
  }

  // Start word-by-word highlighting for ElevenLabs (synced with audio.currentTime)
  function startWordHighlightTimer(audio) {
    if (wordCharPositions.length === 0) return;

    const totalDuration = audio.duration;
    const totalChars = wordCharPositions.reduce((sum, w) => sum + w.word.length, 0);
    if (totalChars === 0 || !totalDuration) return;

    // Pre-calculate the time range for each word based on character proportion
    let charsSoFar = 0;
    const wordTimeRanges = wordCharPositions.map(w => {
      const startTime = (charsSoFar / totalChars) * totalDuration;
      charsSoFar += w.word.length;
      const endTime = (charsSoFar / totalChars) * totalDuration;
      return { startTime, endTime };
    });

    let lastHighlightedIndex = -1;

    // Poll audio.currentTime to stay in sync
    function updateHighlight() {
      if (!currentAudio) {
        removeWordHighlight();
        return;
      }

      const currentTime = audio.currentTime;

      // Find which word should be highlighted based on current time
      let wordIndex = wordTimeRanges.findIndex(
        range => currentTime >= range.startTime && currentTime < range.endTime
      );

      // If past all words, highlight last word
      if (wordIndex === -1 && currentTime >= wordTimeRanges[wordTimeRanges.length - 1]?.startTime) {
        wordIndex = wordCharPositions.length - 1;
      }

      // Only update if word changed
      if (wordIndex !== -1 && wordIndex !== lastHighlightedIndex) {
        highlightWordInWidget(wordIndex);
        lastHighlightedIndex = wordIndex;
      }

      // Continue polling while audio is playing
      if (!audio.paused && !audio.ended) {
        wordTimingInterval = requestAnimationFrame(updateHighlight);
      }
    }

    // Start polling
    wordTimingInterval = requestAnimationFrame(updateHighlight);
  }

  // Start precise word highlighting using real ElevenLabs timing data
  function startPreciseWordHighlight(audio, wordTimings) {
    if (!wordTimings || wordTimings.length === 0 || widgetWordSpans.length === 0) return;

    let lastHighlightedIndex = -1;

    function updateHighlight() {
      if (!currentAudio) {
        removeWordHighlight();
        return;
      }

      const currentTime = audio.currentTime;

      // Find which word should be highlighted based on real timing
      let wordIndex = wordTimings.findIndex(
        w => currentTime >= w.start && currentTime < w.end
      );

      // If past all words, highlight last word
      if (wordIndex === -1 && wordTimings.length > 0 &&
          currentTime >= wordTimings[wordTimings.length - 1].start) {
        wordIndex = wordTimings.length - 1;
      }

      // Clamp to widget word span count (in case of mismatch)
      if (wordIndex >= widgetWordSpans.length) {
        wordIndex = widgetWordSpans.length - 1;
      }

      if (wordIndex !== -1 && wordIndex !== lastHighlightedIndex) {
        highlightWordInWidget(wordIndex);
        lastHighlightedIndex = wordIndex;
      }

      if (!audio.paused && !audio.ended) {
        wordTimingInterval = requestAnimationFrame(updateHighlight);
      }
    }

    wordTimingInterval = requestAnimationFrame(updateHighlight);
  }

  function updateVoiceOptions() {
    const select = widget.querySelector('#lh-voice');
    select.innerHTML = '';

    // Determine which language to use for voices
    // Map nb/nn → no for ElevenLabs voice lookup
    const rawLang = readingLang === 'no' ? 'no' : currentLang;
    const voiceLang = VOICE_LANG_MAP[rawLang] || rawLang;

    if (isAuthenticated) {
      const voices = ELEVENLABS_VOICES[voiceLang] || ELEVENLABS_VOICES.no;
      voices.forEach((v, i) => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.name;
        if (i === 0) opt.selected = true;
        select.appendChild(opt);
      });
    } else {
      // Browser voices for the language
      const synth = window.speechSynthesis;
      const allVoices = synth.getVoices();
      const langCode = BROWSER_VOICE_LANGS[voiceLang] || BROWSER_VOICE_LANGS[rawLang] || 'nb';
      const matching = allVoices.filter(v => v.lang.startsWith(langCode));

      if (matching.length === 0) {
        const opt = document.createElement('option');
        opt.value = '__default';
        opt.textContent = t('widget_default_voice');
        select.appendChild(opt);
      } else {
        matching.forEach((v, i) => {
          const opt = document.createElement('option');
          opt.value = v.voiceURI;
          opt.textContent = v.name.replace(/Google |Microsoft |Apple /, '');
          if (i === 0) opt.selected = true;
          select.appendChild(opt);
        });
      }
    }
  }

  function updateModeBadge() {
    const badge = widget.querySelector('.lh-mode-badge');
    if (isAuthenticated) {
      badge.textContent = t('widget_badge_elevenlabs');
      badge.style.background = 'rgba(34, 197, 94, 0.1)';
      badge.style.color = '#16a34a';
    } else {
      badge.textContent = t('widget_badge_browser');
      badge.style.background = 'rgba(17, 180, 154, 0.1)';
      badge.style.color = '#11B49A';
    }
  }

  // ── Playback ──
  async function handlePlay() {
    const playBtn = widget.querySelector('.lh-play-btn');
    const speed = parseFloat(widget.querySelector('#lh-speed').value);
    const voiceId = widget.querySelector('#lh-voice').value;

    // If already playing, stop
    if (currentAudio || currentUtterance) {
      stopPlayback();
      removeWordHighlight();
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      return;
    }

    // Pass the language code so the backend can enforce the correct language.
    // This prevents ElevenLabs from misidentifying Norwegian as Danish.
    // Map nb/nn → 'no' because eleven_flash_v2_5 doesn't recognize the
    // bokmål/nynorsk codes — only the generic 'no'.
    const rawLang = readingLang === 'no' ? 'no' : currentLang;
    const langCode = VOICE_LANG_MAP[rawLang] || rawLang || null;

    if (isAuthenticated) {
      await playElevenLabs(selectedText, voiceId, speed, langCode, playBtn);
    } else {
      playBrowserTTS(selectedText, voiceId, speed, playBtn);
    }
  }

  // ── ElevenLabs ──
  async function playElevenLabs(text, voiceId, speed, language, playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('loading');
    playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

    try {
      // Build headers — prefer Bearer token, fall back to legacy access code
      const stored = await chromeStorageGet(['sessionToken', 'accessCode']);
      const headers = {
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      };

      let body = { text, voiceId, speed, language };

      if (stored.sessionToken) {
        headers['Authorization'] = `Bearer ${stored.sessionToken}`;
      } else if (stored.accessCode) {
        body.code = stored.accessCode;
      }

      // Use chrome.runtime.sendMessage to route through service worker
      // Content scripts in MV3 fetch with the page's origin, which may be blocked
      const ttsResult = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('TTS request timed out')), 30_000);
        chrome.runtime.sendMessage(
          { type: 'FETCH_TTS', url: `${BACKEND_URL}/api/tts`, headers, body },
          (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      if (ttsResult.error) {
        // Re-create an error-like object with the response details
        const errBody = ttsResult.errorBody || '';
        console.error('TTS response:', ttsResult.status, errBody);

        try {
          const errJson = JSON.parse(errBody);
          if (errJson.quotaExceeded) {
            console.log('TTS character quota exceeded, falling back to browser TTS');
            updateModeBadgeQuota();
            throw new Error('quota_exceeded');
          }
          if (errJson.subscriptionRequired) {
            throw new Error('subscription_required');
          }
          if (errJson.tokenExpired) {
            chrome.storage.local.set({ sessionToken: null, isAuthenticated: false });
            throw new Error('token_expired');
          }
        } catch (parseErr) {
          if (parseErr.message === 'quota_exceeded' ||
              parseErr.message === 'subscription_required' ||
              parseErr.message === 'token_expired') {
            throw parseErr;
          }
        }

        throw new Error(`TTS ${ttsResult.status}: ${errBody}`);
      }

      // Convert base64 audio back to blob
      const audioBytes = Uint8Array.from(atob(ttsResult.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(blobUrl);
      currentAudio.playbackRate = 1;

      // Use real word timings from ElevenLabs for precise highlighting
      if (ttsResult.wordTimings && ttsResult.wordTimings.length > 0) {
        currentAudio.addEventListener('loadedmetadata', () => {
          startPreciseWordHighlight(currentAudio, ttsResult.wordTimings);
        });
      }

      currentAudio.play();

      playBtn.disabled = false;
      playBtn.classList.remove('loading');
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

      currentAudio.addEventListener('ended', () => {
        URL.revokeObjectURL(blobUrl);
        currentAudio = null;
        removeWordHighlight();
        playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      });

      currentAudio.addEventListener('error', () => {
        URL.revokeObjectURL(blobUrl);
      });
    } catch (err) {
      console.warn('ElevenLabs failed, falling back to browser TTS:', err);
      playBtn.disabled = false;
      playBtn.classList.remove('loading');
      // Fallback to browser TTS — find a matching browser voice for the language
      const voiceLang = language === 'no' ? 'no' : currentLang;
      const fallbackLangCode = BROWSER_VOICE_LANGS[voiceLang] || 'nb';
      const synth = window.speechSynthesis;
      const allVoices = synth.getVoices();
      const match = allVoices.find(v => v.lang.startsWith(fallbackLangCode));
      playBrowserTTS(text, match ? match.voiceURI : null, speed, playBtn);
    }
  }

  function updateModeBadgeQuota() {
    const badge = widget.querySelector('.lh-mode-badge');
    if (badge) {
      badge.textContent = t('widget_badge_quota');
      badge.style.background = 'rgba(245, 158, 11, 0.1)';
      badge.style.color = '#d97706';
    }
  }

  // ── Browser TTS ──
  function playBrowserTTS(text, voiceURI, speed, playBtn, charOffset = 0) {
    const synth = window.speechSynthesis;
    synth.cancel();

    const voiceLang = readingLang === 'no' ? 'no' : currentLang;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = speed;
    utterance.lang = BROWSER_VOICE_LANGS[voiceLang] || 'es';

    if (voiceURI && voiceURI !== '__default') {
      const voices = synth.getVoices();
      const match = voices.find(v => v.voiceURI === voiceURI);
      if (match) utterance.voice = match;
    }

    // Word-by-word highlighting using boundary event
    let browserTtsWordIndex = 0;
    browserTtsCharIndex = charOffset;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Track absolute character position for live speed restart
        browserTtsCharIndex = charOffset + event.charIndex;
        // Find word index by absolute character position
        const absCharIndex = charOffset + event.charIndex;
        const wordIndex = wordCharPositions.findIndex(
          w => absCharIndex >= w.charStart && absCharIndex < w.charEnd
        );
        if (wordIndex !== -1) {
          highlightWordInWidget(wordIndex);
          browserTtsWordIndex = wordIndex;
        } else {
          // Fallback: just advance to next word
          browserTtsWordIndex++;
          highlightWordInWidget(browserTtsWordIndex);
        }
      }
    };

    utterance.onstart = () => {
      currentUtterance = utterance;
      if (charOffset === 0) {
        browserTtsWordIndex = 0;
        highlightWordInWidget(0);
      }
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    };

    utterance.onend = () => {
      currentUtterance = null;
      removeWordHighlight();
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    };

    utterance.onerror = () => {
      currentUtterance = null;
      removeWordHighlight();
      playBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    };

    synth.speak(utterance);
  }

  function stopPlayback() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (currentUtterance) {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    }
    browserTtsCharIndex = 0;
    removeWordHighlight();
  }

  // Bank name to part of speech i18n key mapping
  const BANK_TO_POS_KEY = {
    verbbank: 'pos_verb',
    nounbank: 'pos_noun',
    adjectivebank: 'pos_adjective',
    articlesbank: 'pos_article',
    generalbank: 'pos_general',
    numbersbank: 'pos_number',
    phrasesbank: 'pos_phrase',
    pronounsbank: 'pos_pronoun',
    languagesbank: 'pos_language',       // Phase 05.1 Gap B
    nationalitiesbank: 'pos_nationality' // Phase 05.1 Gap B
  };

  function bankToPos(bank) {
    const key = BANK_TO_POS_KEY[bank];
    return key ? t(key) : bank.replace('bank', '');
  }

  // Genus to gender i18n key mapping
  const GENUS_TO_GENDER_KEY = {
    m: 'gender_masculine',
    f: 'gender_feminine',
    n: 'gender_neuter',
    pl: 'gender_plural'
  };

  function genusToGender(genus) {
    const key = GENUS_TO_GENDER_KEY[genus];
    return key ? t(key) : genus;
  }

  const LANG_FLAGS = { de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', nb: '🇳🇴', nn: '🇳🇴', no: '🇳🇴' };

  // ── Inline dictionary lookup (context menu) ──
  async function showInlineLookup(word) {
    // Phase 27: inline dictionary is non-exam-safe (widget.dictionary). Bail
    // before any DOM/network work so the lookup never appears during exams.
    if (!isSurfaceAllowed('widget.dictionary')) return;
    // Load dictionary. Bundled langs (nb/nn/en) read from the shipped JSON
    // first — bundled data is source of truth and refreshed by sync-vocab.
    // Cache-first would serve stale data after a sync.
    async function getDictForLang(lang) {
      const isBundled = lang === 'nb' || lang === 'nn' || lang === 'en';
      let d = null;
      try {
        if (isBundled) {
          try {
            const url = chrome.runtime.getURL(`data/${lang}.json`);
            const res = await fetch(url);
            if (res.ok) d = await res.json();
          } catch { /* fall through to cache */ }
        }
        if (!d && window.__lexiVocabStore) {
          d = await window.__lexiVocabStore.getCachedLanguage(lang);
        }
        if (!d && !isBundled) {
          try {
            const url = chrome.runtime.getURL(`data/${lang}.json`);
            const res = await fetch(url);
            if (res.ok) d = await res.json();
          } catch { /* bundled file missing */ }
        }
        if (!d && window.__lexiVocabStore) {
          try { d = await window.__lexiVocabStore.downloadLanguage(lang, () => {}); } catch { /* */ }
        }
      } catch (e) { console.warn('Leksihjelp: inline lookup dictionary load failed', lang, e); }
      return d;
    }

    let dict = await getDictForLang(currentLang);
    if (!dict) return;

    // Load NB dictionary for falseFriends/senses enrichment
    let nbDict = null;
    if (currentLang !== 'nb' && currentLang !== 'nn') {
      nbDict = await getDictForLang('nb');
    }

    const q = word.toLowerCase().trim();

    function searchDictBanks(dictData, query) {
      if (!dictData) return null;
      const banks = Object.keys(BANK_TO_POS_KEY);
      for (const bank of banks) {
        const bankData = dictData[bank];
        if (!bankData || typeof bankData !== 'object') continue;
        for (const [entryId, entry] of Object.entries(bankData)) {
          if (!entry.word) continue;
          if (entry.word.toLowerCase() === query ||
              (getTranslation(entry) || '').toLowerCase() === query) {
            return {
              ...entry,
              _wordId: entryId,
              translation: getTranslation(entry),
              partOfSpeech: bankToPos(bank),
              gender: entry.genus ? genusToGender(entry.genus) : null,
              grammar: entry.explanation?._description || null,
              examples: entry.examples || []
            };
          }
        }
      }
      return null;
    }

    let match = searchDictBanks(dict, q);
    let conjugatedFrom = null;

    // Conjugation/declension fallback: "schreibe" → "schreiben"
    if (!match) {
      const vocab = self.__lexiVocab;
      if (vocab) {
        const inf = vocab.getVerbInfinitive?.()?.get?.(q);
        if (inf && inf !== q) {
          const baseMatch = searchDictBanks(dict, inf);
          if (baseMatch) {
            match = baseMatch;
            conjugatedFrom = word;
          }
        }
      }
    }

    // NB-side fallback: when reading a Norwegian page with a foreign target
    // language (de/es/fr/en) selected, the user double-clicks an NB word
    // ("opplevde"). It won't be in the foreign dict directly, but it IS in the
    // NB dict — and the NB entry's linkedTo[currentLang].primary points us to
    // the right foreign entry. Without this fallback the popover just says
    // "not found" on NB pages.
    if (!match && nbDict) {
      let nbHit = searchDictBanks(nbDict, q);
      let nbConjugatedFrom = null;
      if (!nbHit) {
        // Fallback for conjugated NB words
        const inf = self.__lexiVocab?.getVerbInfinitive?.()?.get?.(q);
        if (inf && inf !== q) {
          nbHit = searchDictBanks(nbDict, inf);
          if (nbHit) nbConjugatedFrom = word;
        } else if (q.length > 3) {
          // Heuristic infinitive for NB
          const infs = [q.replace(/er$/, 'e'), q.replace(/te$/, 'e'), q.replace(/de$/, 'e')];
          for (const inf of infs) {
            if (inf === q) continue;
            for (const bank of Object.keys(BANK_TO_POS_KEY)) {
              const bankData = nbDict[bank];
              if (!bankData || typeof bankData !== 'object') continue;
              for (const [, nbEntry] of Object.entries(bankData)) {
                const w = (nbEntry.word || '').toLowerCase().replace(/^å\s+/, '');
                if (w === inf) { nbHit = nbEntry; nbConjugatedFrom = word; break; }
              }
              if (nbHit) break;
            }
          }
        }
      }
      // Resolve NB hit → foreign entry via linkedTo.
      const targetId = nbHit?.linkedTo?.[currentLang]?.primary;
      if (targetId) {
        for (const bank of Object.keys(BANK_TO_POS_KEY)) {
          const targetEntry = dict[bank]?.[targetId];
          if (targetEntry) {
            match = {
              ...targetEntry,
              _wordId: targetId,
              translation: nbHit.word,
              partOfSpeech: bankToPos(bank),
              gender: targetEntry.genus ? genusToGender(targetEntry.genus) : null,
              grammar: targetEntry.explanation?._description || null,
              examples: targetEntry.examples || nbHit.examples || [],
            };
            if (nbConjugatedFrom) conjugatedFrom = nbConjugatedFrom;
            break;
          }
        }
      }
    }

    // Enrich match with NB falseFriends/senses via reverse linkedTo scan
    if (match && nbDict && match._wordId) {
      for (const bank of Object.keys(nbDict)) {
        const bankData = nbDict[bank];
        if (!bankData || typeof bankData !== 'object') continue;
        for (const [, nbEntry] of Object.entries(bankData)) {
          if (!nbEntry.linkedTo?.[currentLang]?.primary) continue;
          if (nbEntry.linkedTo[currentLang].primary !== match._wordId) continue;
          if (nbEntry.falseFriends) {
            match.falseFriends = [...(match.falseFriends || []), ...nbEntry.falseFriends];
          }
          if (nbEntry.senses) {
            match.senses = [...(match.senses || []), ...nbEntry.senses];
          }
        }
      }
    }

    // Remove old lookup card
    const old = document.getElementById('lexi-lookup-card');
    if (old) old.remove();

    // Restore saved position if any. Stored as { left, top } in viewport coords.
    let savedPos = null;
    try {
      const stored = await new Promise(resolve => {
        chrome.storage.local.get('lookupCardPos', r => resolve(r.lookupCardPos || null));
      });
      // Validate the saved position is still on-screen (window may have resized
      // since last drag). If off-screen, fall back to centred default.
      if (stored && typeof stored.left === 'number' && typeof stored.top === 'number'
          && stored.left >= 0 && stored.top >= 0
          && stored.left < window.innerWidth - 80 && stored.top < window.innerHeight - 80) {
        savedPos = stored;
      }
    } catch (_) { /* storage unavailable in some test contexts */ }

    const card = document.createElement('div');
    card.id = 'lexi-lookup-card';
    const positionCss = savedPos
      ? `top: ${savedPos.top}px; left: ${savedPos.left}px;`
      : `top: 50%; left: 50%; transform: translate(-50%, -50%);`;
    card.style.cssText = `
      position: fixed; z-index: 2147483647; ${positionCss}
      min-width: 280px; max-width: 360px; padding: 18px;
      background: rgba(255,255,255,0.88); backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.4); border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b; animation: lexi-fadein 0.2s ease-out;
    `;

    const LANG_FLAGS = { de: '\u{1F1E9}\u{1F1EA}', es: '\u{1F1EA}\u{1F1F8}', fr: '\u{1F1EB}\u{1F1F7}', en: '\u{1F1EC}\u{1F1E7}', nb: '\u{1F1F3}\u{1F1F4}', nn: '\u{1F1F3}\u{1F1F4}', no: '\u{1F1F3}\u{1F1F4}' };
    const langFlag = LANG_FLAGS[currentLang] || '';
    const langSuffix = currentLang === 'nb' ? ' NB' : currentLang === 'nn' ? ' NN' : '';

    if (match) {
      const conjugHint = conjugatedFrom
        ? `<div style="font-size:12px;color:#64748b;margin-bottom:6px;padding:4px 8px;background:rgba(17,180,154,0.06);border-radius:6px;border-left:3px solid #11B49A;">${escapeHtml(conjugatedFrom)} → <strong>${escapeHtml(match.word)}</strong></div>`
        : '';

      // False-friend banner (FF-04)
      let falseFriendHtml = '';
      if (match.falseFriends && match.falseFriends.length) {
        const pairs = match.falseFriends.filter(f => f.lang === currentLang);
        if (pairs.length) {
          const items = pairs.map(f => `
            <div style="font-size:12px;color:#1e293b;">
              <strong>${escapeHtml(f.form)}</strong> — ${escapeHtml(f.meaning || '')}
              ${f.warning ? `<p style="margin:2px 0 0;font-size:11px;color:#64748b;">${sanitizeWarning(f.warning)}</p>` : ''}
            </div>
          `).join('');
          falseFriendHtml = `
            <div class="lh-ff-banner" style="margin:8px 0;padding:8px 10px;background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;border-radius:6px;">
              <div style="font-size:11px;font-weight:700;color:#f59e0b;margin-bottom:4px;">⚠ ${t('result_false_friend_heading')}</div>
              ${items}
            </div>
          `;
        }
      }

      // Sense-grouped translations (POLY-04) — replace flat translation when present
      let translationHtml = '';
      const sensesForLang = (match.senses || []).filter(s => s.translations && s.translations[currentLang]);
      if (sensesForLang.length) {
        const senseItems = sensesForLang.map(s => {
          const tr = s.translations[currentLang];
          const forms = Array.isArray(tr.forms) ? tr.forms : (tr.form ? [tr.form] : []);
          const ex = tr.example || {};
          return `
            <div class="lh-sense-group" style="margin-bottom:6px;padding:4px 0;border-bottom:1px solid rgba(0,0,0,0.04);">
              <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;">${escapeHtml(s.trigger || '')}</div>
              <div style="font-size:14px;color:#1e293b;">${forms.map(escapeHtml).join(', ')}</div>
              ${ex.sentence ? `<div style="font-size:11px;font-style:italic;color:#94a3b8;">${escapeHtml(ex.sentence)}${ex.translation ? ` — ${escapeHtml(ex.translation)}` : ''}</div>` : ''}
            </div>
          `;
        }).join('');
        translationHtml = `<div style="margin-bottom:8px;">${senseItems}</div>`;
      } else {
        translationHtml = `<div style="font-size:15px;margin-bottom:6px;">${escapeHtml(match.translation)}</div>`;
      }

      card.innerHTML = `
        <div class="lh-lookup-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#11B49A;">${t('widget_lookup_header')}</span>
          <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
        </div>
        ${conjugHint}
        <div style="font-size:20px;font-weight:700;color:#11B49A;margin-bottom:2px;">${langFlag ? `<span style="margin-right:4px">${langFlag}${langSuffix}</span>` : ''}${escapeHtml(match.word)}</div>
        ${falseFriendHtml}
        ${translationHtml}
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${escapeHtml(match.partOfSpeech)}</span>
          ${match.gender ? `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${escapeHtml(match.gender)}</span>` : ''}
        </div>
        ${match.examples.length ? `<div style="font-style:italic;font-size:13px;color:#475569;margin-bottom:4px;">"${escapeHtml(match.examples[0].sentence)}"</div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">${escapeHtml(match.examples[0].translation)}</div>` : ''}
        ${match.grammar ? `<div style="font-size:12px;color:#64748b;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);"><strong>${t('widget_lookup_grammar')}</strong> ${escapeHtml(match.grammar)}</div>` : ''}
      `;
    } else {
      // Phase 17 COMP-01: try compound decomposition before showing not-found
      const vocabSurface = self.__lexiVocab;
      const decompose = vocabSurface && vocabSurface.getDecomposeCompound();
      let decompResult = null;
      if (decompose) {
        decompResult = decompose(word.toLowerCase());
      }

      if (decompResult) {
        // Show compound breakdown: "hverdagsmas = hverdag + s + mas (hankjonn)"
        const breakdownParts = [];
        for (const part of decompResult.parts) {
          breakdownParts.push(escapeHtml(part.word));
          if (part.linker) breakdownParts.push(escapeHtml(part.linker));
        }
        const breakdownStr = breakdownParts.join(' + ');
        const genderStr = decompResult.gender ? ` (${genusToGender(decompResult.gender)})` : '';
        card.innerHTML = `
          <div class="lh-lookup-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#11B49A;">${t('widget_lookup_header')}</span>
            <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
          </div>
          <div style="font-size:18px;font-weight:700;color:#11B49A;margin-bottom:2px;">${escapeHtml(word)}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.08);color:#7c3aed;font-weight:600;">${t('compound_label')}</span>
            <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${t('pos_noun')}</span>
          </div>
          <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px;">${breakdownStr}${escapeHtml(genderStr)}</div>
        `;
      } else {
        card.innerHTML = `
          <div class="lh-lookup-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#11B49A;">${t('widget_lookup_header')}</span>
            <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
          </div>
          <div style="text-align:center;padding:16px 0;color:#94a3b8;">
            <div style="font-size:15px;margin-bottom:4px;">"${escapeHtml(word)}"</div>
            <div style="font-size:13px;">${t('widget_lookup_not_found')}</div>
          </div>
        `;
      }
    }

    // Always-visible widget language pill row inside the lookup card so the
    // student can see which language the lookup is using and switch on the
    // fly. Phase 30-04 Task 6 keeps the widget's lang LOCAL — clicking a
    // pill here re-runs the lookup but does NOT touch shared `language`
    // storage or broadcast LANGUAGE_CHANGED (intentional decoupling from
    // popup writing-language).
    {
      const langsForPicker = [...BUNDLED_WIDGET_LANGS];
      if (window.__lexiVocabStore) {
        try {
          const cached = await window.__lexiVocabStore.listCachedLanguages();
          for (const c of cached) {
            if (!langsForPicker.includes(c.language)) langsForPicker.push(c.language);
          }
        } catch {}
      }
      const pillStyle = (active) => `font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid ${active ? '#11B49A' : 'rgba(0,0,0,0.08)'};background:${active ? 'rgba(17,180,154,0.12)' : 'rgba(255,255,255,0.6)'};color:${active ? '#11B49A' : '#475569'};font-weight:${active ? '700' : '500'};cursor:pointer;`;
      const pillHtml = `<div class="lh-lookup-langs" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">`
        + langsForPicker.map(lang => {
            const active = lang === currentLang;
            return `<button class="lh-lookup-lang" data-lang="${lang}" style="${pillStyle(active)}">${WIDGET_LANG_FLAGS[lang] || ''} ${WIDGET_LANG_LABELS[lang] || lang.toUpperCase()}</button>`;
          }).join('')
        + `</div>`;
      const dragEl = card.querySelector('.lh-lookup-drag');
      if (dragEl) dragEl.insertAdjacentHTML('afterend', pillHtml);
      card.querySelectorAll('.lh-lookup-lang').forEach(btn => {
        btn.addEventListener('click', () => {
          const lang = btn.dataset.lang;
          if (lang === currentLang) return;
          currentLang = lang;
          readingLang = 'target';
          if (typeof updateVoiceOptions === 'function') updateVoiceOptions();
          showInlineLookup(word);
        });
      });
    }

    (document.fullscreenElement || document.documentElement).appendChild(card);
    card.querySelector('#lh-lookup-close').addEventListener('click', () => card.remove());
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { card.remove(); document.removeEventListener('keydown', esc); }
    });

    // Make the card draggable by its header. On drag-end the position is
    // persisted to chrome.storage so the next lookup opens at the same spot.
    const dragHandle = card.querySelector('.lh-lookup-drag');
    if (dragHandle) {
      let dragging = false;
      let offsetX = 0;
      let offsetY = 0;
      dragHandle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.lh-close') || e.target.closest('.lh-pause-widget')) return;
        const rect = card.getBoundingClientRect();
        // Drop the centring transform once the user takes manual control.
        card.style.transform = 'none';
        card.style.left = rect.left + 'px';
        card.style.top = rect.top + 'px';
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        dragging = true;
        e.preventDefault();
      });
      const onMove = (e) => {
        if (!dragging) return;
        const x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - card.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - card.offsetHeight));
        card.style.left = x + 'px';
        card.style.top = y + 'px';
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        const left = parseFloat(card.style.left);
        const top = parseFloat(card.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) {
          try { chrome.storage.local.set({ lookupCardPos: { left, top } }); } catch (_) { /* */ }
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      // Clean up listeners when the card goes away.
      const cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      // Observe removal so we don't leak listeners across multiple lookups.
      const obs = new MutationObserver(() => {
        if (!card.isConnected) { cleanup(); obs.disconnect(); }
      });
      obs.observe(card.parentNode, { childList: true });
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  // Sanitize pedagogical warning HTML — allow em, strong, and SVG tags for visual aids.
  function sanitizeWarning(html) {
    return escapeHtml(html)
      .replace(/&lt;(\/?)(em|strong)&gt;/gi, '<$1$2>')
      .replace(/&lt;svg(.*?)&gt;/gi, '<svg$1>')
      .replace(/&lt;\/svg&gt;/gi, '</svg>')
      .replace(/&lt;g(.*?)&gt;/gi, '<g$1>')
      .replace(/&lt;\/g&gt;/gi, '</g>')
      .replace(/&lt;(circle|rect|line|polyline|polygon|path|text|tspan|ellipse)(.*?)&gt;/gi, '<$1$2>')
      .replace(/&lt;\/(circle|rect|line|polyline|polygon|path|text|tspan|ellipse)&gt;/gi, '</$1>')
      .replaceAll('&quot;', '"'); // restore attributes
  }

  // Ensure browser voices are loaded
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {};
    window.speechSynthesis.getVoices();
  }
})();
