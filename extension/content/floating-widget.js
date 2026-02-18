/**
 * Leksihjelp — Floating TTS Widget (content script)
 *
 * Shows a glassmorphism widget when user selects text.
 * Uses ElevenLabs (authenticated) or browser speechSynthesis (fallback).
 */

(function () {
  'use strict';

  const BACKEND_URL = 'https://leksihjelp.vercel.app';

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
    no: 'Norsk'
  };

  // Browser TTS voice name patterns per language
  const BROWSER_VOICE_LANGS = {
    es: 'es',
    de: 'de',
    fr: 'fr',
    no: 'nb' // Norwegian Bokmål
  };

  let widget = null;
  let currentAudio = null;
  let currentUtterance = null;
  let isAuthenticated = false;
  let currentLang = 'es'; // Target language (from settings)
  let selectedText = '';
  let readingLang = 'target'; // 'target' or 'no' - which language to read aloud
  let widgetWordSpans = []; // DOM span references for each word in the widget text area
  let wordCharPositions = []; // [{word, charStart, charEnd}] for timing sync
  let wordTimingInterval = null; // For ElevenLabs word timing estimation
  let lexiPaused = false; // Global pause state
  let justDragged = false; // Prevents hideWidget after drag ends

  // Font size settings
  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 24;
  const FONT_SIZE_STEP = 1;
  const FONT_SIZE_DEFAULT = 15;
  let widgetFontSize = FONT_SIZE_DEFAULT;

  // ── Init ──
  init();

  async function init() {
    const stored = await chromeStorageGet(['isAuthenticated', 'language', 'lexiPaused', 'widgetFontSize']);
    isAuthenticated = stored.isAuthenticated || false;
    currentLang = stored.language || 'es';
    lexiPaused = stored.lexiPaused || false;
    widgetFontSize = stored.widgetFontSize || FONT_SIZE_DEFAULT;

    createWidget();
    attachListeners();

    // Listen for setting changes and context menu actions
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'LANGUAGE_CHANGED') currentLang = msg.language;
      if (msg.type === 'AUTH_CHANGED') isAuthenticated = msg.isAuthenticated;
      if (msg.type === 'LEXI_PAUSED') {
        lexiPaused = msg.paused;
        if (lexiPaused) hideWidget();
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

  // ── Widget DOM ──
  function createWidget() {
    widget = document.createElement('div');
    widget.id = 'lexi-tts-widget';
    widget.innerHTML = `
      <div class="lh-header">
        <span class="lh-title">Leksihjelp — Uttale</span>
        <button class="lh-close" title="Lukk">&times;</button>
      </div>
      <div class="lh-lang-toggle">
        <button class="lh-lang-btn active" data-lang="target" title="Les på målspråket">Målspråk</button>
        <button class="lh-lang-btn" data-lang="no" title="Les på norsk">Norsk</button>
      </div>
      <div class="lh-text-area-wrapper">
        <div class="lh-font-controls">
          <button class="lh-font-btn lh-font-decrease" title="Mindre skrift">A&minus;</button>
          <button class="lh-font-btn lh-font-increase" title="Større skrift">A+</button>
        </div>
        <div class="lh-text-area" role="region" aria-label="Valgt tekst"></div>
      </div>
      <div class="lh-controls">
        <button class="lh-play-btn" title="Spill av">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="lh-slider-group">
          <div class="lh-slider-row">
            <span class="lh-slider-label">Hastighet</span>
            <input type="range" class="lh-slider" id="lh-speed" min="0.5" max="1.5" step="0.1" value="1.0">
            <span class="lh-speed-value">1.0×</span>
          </div>
        </div>
      </div>
      <select class="lh-voice-select" id="lh-voice"></select>
      <div class="lh-mode-badge"></div>
    `;
    document.documentElement.appendChild(widget);

    // Attach widget event listeners
    widget.querySelector('.lh-close').addEventListener('click', hideWidget);
    widget.querySelector('.lh-play-btn').addEventListener('click', handlePlay);
    widget.querySelector('#lh-speed').addEventListener('input', (e) => {
      widget.querySelector('.lh-speed-value').textContent = `${parseFloat(e.target.value).toFixed(1)}×`;
    });

    // Font size controls
    widget.querySelector('.lh-font-decrease').addEventListener('click', () => adjustFontSize(-FONT_SIZE_STEP));
    widget.querySelector('.lh-font-increase').addEventListener('click', () => adjustFontSize(FONT_SIZE_STEP));

    // Language toggle buttons
    widget.querySelectorAll('.lh-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        widget.querySelectorAll('.lh-lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        readingLang = btn.dataset.lang;
        updateVoiceOptions();
        updateLangToggleLabels();
      });
    });

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
      // Don't drag when clicking the close button
      if (e.target.closest('.lh-close')) return;
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
      if (isDragging) justDragged = true;
      isDragging = false;
    });

  }

  function updateLangToggleLabels() {
    const targetBtn = widget.querySelector('.lh-lang-btn[data-lang="target"]');
    if (targetBtn) {
      targetBtn.textContent = LANG_NAMES[currentLang] || 'Målspråk';
    }
  }

  function attachListeners() {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideWidget();
    });
  }

  // ── Text Selection ──
  function handleTextSelection(e) {
    // Don't show widget when Leksihjelp is paused
    if (lexiPaused) return;
    // Ignore mouseup that ends a drag operation
    if (justDragged) { justDragged = false; return; }
    // Ignore clicks inside the widget
    if (widget.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (text.length > 0 && text.length < 2000) {
        selectedText = text;
        showWidget();
      } else if (!widget.contains(e.target)) {
        hideWidget();
      }
    }, 10);
  }

  function showWidget() {
    stopPlayback();
    removeWordHighlight();
    updateVoiceOptions();
    updateModeBadge();
    updateLangToggleLabels();

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

    // Show widget (CSS positions it at bottom center unless dragged)
    widget.classList.add('visible');
  }

  function hideWidget() {
    widget.classList.remove('visible');
    stopPlayback();
    removeWordHighlight();
  }

  // ── Text Area Population ──
  function populateTextArea(text) {
    const textArea = widget.querySelector('.lh-text-area');
    textArea.innerHTML = '';
    widgetWordSpans = [];
    wordCharPositions = [];

    // Apply stored font size
    textArea.style.fontSize = widgetFontSize + 'px';

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
    chrome.storage.local.set({ widgetFontSize });
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

    const spanRect = span.getBoundingClientRect();
    const widgetRect = widget.getBoundingClientRect();

    // If the word is below the visible area, scroll down
    if (spanRect.bottom > widgetRect.bottom) {
      widget.scrollTop += (spanRect.bottom - widgetRect.bottom) + 8;
    }
    // If the word is above the visible area, scroll up
    else if (spanRect.top < widgetRect.top) {
      widget.scrollTop -= (widgetRect.top - spanRect.top) + 8;
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

  function updateVoiceOptions() {
    const select = widget.querySelector('#lh-voice');
    select.innerHTML = '';

    // Determine which language to use for voices
    const voiceLang = readingLang === 'no' ? 'no' : currentLang;

    if (isAuthenticated) {
      const voices = ELEVENLABS_VOICES[voiceLang] || ELEVENLABS_VOICES.es;
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
      const langCode = BROWSER_VOICE_LANGS[voiceLang] || 'es';
      const matching = allVoices.filter(v => v.lang.startsWith(langCode));

      if (matching.length === 0) {
        const opt = document.createElement('option');
        opt.value = '__default';
        opt.textContent = 'Standard stemme';
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
      badge.textContent = 'ElevenLabs — Naturlig uttale';
      badge.style.background = 'rgba(34, 197, 94, 0.1)';
      badge.style.color = '#16a34a';
    } else {
      badge.textContent = 'Nettleser-uttale (gratis)';
      badge.style.background = 'rgba(99, 102, 241, 0.1)';
      badge.style.color = '#6366f1';
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
    const voiceLang = readingLang === 'no' ? 'no' : currentLang;
    const langCode = voiceLang || null;

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

      const res = await fetch(`${BACKEND_URL}/api/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error('TTS response:', res.status, errBody);

        // Handle specific error cases
        try {
          const errJson = JSON.parse(errBody);
          if (errJson.quotaExceeded) {
            // Quota exceeded — fall back to browser TTS with notice
            console.log('TTS character quota exceeded, falling back to browser TTS');
            updateModeBadgeQuota();
            throw new Error('quota_exceeded');
          }
          if (errJson.subscriptionRequired) {
            throw new Error('subscription_required');
          }
          if (errJson.tokenExpired) {
            // Clear expired token
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

        throw new Error(`TTS ${res.status}: ${errBody}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      currentAudio = new Audio(blobUrl);
      currentAudio.playbackRate = 1; // Speed is applied server-side

      // Start word highlighting when audio metadata is loaded
      currentAudio.addEventListener('loadedmetadata', () => {
        if (currentAudio && currentAudio.duration && currentAudio.duration > 0) {
          startWordHighlightTimer(currentAudio);
        }
      });

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
      badge.textContent = 'Kvoten brukt opp — nettleser-uttale';
      badge.style.background = 'rgba(245, 158, 11, 0.1)';
      badge.style.color = '#d97706';
    }
  }

  // ── Browser TTS ──
  function playBrowserTTS(text, voiceURI, speed, playBtn) {
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
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Find word index by character position
        const wordIndex = wordCharPositions.findIndex(
          w => event.charIndex >= w.charStart && event.charIndex < w.charEnd
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
      browserTtsWordIndex = 0;
      highlightWordInWidget(0); // Highlight first word
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
    removeWordHighlight();
  }

  // Bank name to Norwegian part of speech mapping
  const BANK_TO_POS = {
    verbbank: 'verb',
    nounbank: 'substantiv',
    adjectivebank: 'adjektiv',
    articlesbank: 'artikkel',
    generalbank: 'ord',
    numbersbank: 'tall',
    phrasesbank: 'frase',
    pronounsbank: 'pronomen'
  };

  // Genus to Norwegian gender mapping
  const GENUS_TO_GENDER = {
    m: 'maskulin',
    f: 'feminin',
    n: 'nøytrum',
    pl: 'flertall'
  };

  // ── Inline dictionary lookup (context menu) ──
  async function showInlineLookup(word) {
    // Load dictionary if not cached
    let dict = null;
    try {
      const url = chrome.runtime.getURL(`data/${currentLang}.json`);
      const res = await fetch(url);
      dict = await res.json();
    } catch { return; }

    const q = word.toLowerCase().trim();

    // Search across all banks for the word
    let match = null;
    const banks = Object.keys(BANK_TO_POS);
    for (const bank of banks) {
      const bankData = dict[bank];
      if (!bankData || typeof bankData !== 'object') continue;

      for (const entry of Object.values(bankData)) {
        if (!entry.word) continue;
        const wordMatch = entry.word.toLowerCase() === q;
        const translationMatch = entry.translation && entry.translation.toLowerCase() === q;
        if (wordMatch || translationMatch) {
          match = {
            ...entry,
            partOfSpeech: BANK_TO_POS[bank] || bank.replace('bank', ''),
            gender: entry.genus ? GENUS_TO_GENDER[entry.genus] || entry.genus : null,
            grammar: entry.explanation?._description || null,
            examples: entry.examples || []
          };
          break;
        }
      }
      if (match) break;
    }

    // Remove old lookup card
    const old = document.getElementById('lexi-lookup-card');
    if (old) old.remove();

    const card = document.createElement('div');
    card.id = 'lexi-lookup-card';
    card.style.cssText = `
      position: fixed; z-index: 2147483647; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      min-width: 280px; max-width: 360px; padding: 18px;
      background: rgba(255,255,255,0.88); backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.4); border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b; animation: lexi-fadein 0.2s ease-out;
    `;

    if (match) {
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6366f1;">Leksihjelp — Oppslag</span>
          <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
        </div>
        <div style="font-size:20px;font-weight:700;color:#6366f1;margin-bottom:2px;">${escapeHtml(match.word)}</div>
        <div style="font-size:15px;margin-bottom:6px;">${escapeHtml(match.translation)}</div>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.08);color:#6366f1;font-weight:500;">${escapeHtml(match.partOfSpeech)}</span>
          ${match.gender ? `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.08);color:#6366f1;font-weight:500;">${escapeHtml(match.gender)}</span>` : ''}
        </div>
        ${match.examples.length ? `<div style="font-style:italic;font-size:13px;color:#475569;margin-bottom:4px;">"${escapeHtml(match.examples[0].sentence)}"</div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">${escapeHtml(match.examples[0].translation)}</div>` : ''}
        ${match.grammar ? `<div style="font-size:12px;color:#64748b;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);"><strong>Grammatikk:</strong> ${escapeHtml(match.grammar)}</div>` : ''}
      `;
    } else {
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6366f1;">Leksihjelp — Oppslag</span>
          <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
        </div>
        <div style="text-align:center;padding:16px 0;color:#94a3b8;">
          <div style="font-size:15px;margin-bottom:4px;">"${escapeHtml(word)}"</div>
          <div style="font-size:13px;">Fant ikke ordet i ordboken</div>
        </div>
      `;
    }

    document.documentElement.appendChild(card);
    card.querySelector('#lh-lookup-close').addEventListener('click', () => card.remove());
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { card.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('span');
    d.textContent = str;
    return d.innerHTML;
  }

  // Ensure browser voices are loaded
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {};
    window.speechSynthesis.getVoices();
  }
})();
