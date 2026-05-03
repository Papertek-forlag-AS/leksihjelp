/**
 * Leksihjelp — Dictionary View Module (Phase 30-01)
 *
 * Mountable dictionary view: search input, lang switcher, direction toggle,
 * result rendering, "Lær mer" pedagogy popovers.
 *
 * The host (extension popup.js or lockdown sidepanel) passes a `container`
 * element (typically `<section id="view-dictionary">`) and a `deps` object
 * with explicit dependencies. The view does NOT touch chrome.* globals,
 * window.__lexi*, or document.getElementById directly — every external
 * dependency arrives via deps.
 *
 * @typedef {Object} DictionaryViewDeps
 * @property {Object} state    - shared mutable state: { currentLang, searchDirection,
 *                               dictionary, noDictionary, allWords, noWords,
 *                               inflectionIndex, nounGenusMap, noNounGenusMap,
 *                               nbEnrichmentIndex, nbTranslationIndex,
 *                               nbIdToTargetIndex, currentIndexes, compoundNavStack }
 *                               Host owns it; view reads + mutates via this handle
 *                               so language switches done in settings reflect here.
 * @property {Object} vocab    - { listCachedLanguages, getCachedLanguage,
 *                                 hasAudioCached, getAudioFile, decomposeCompound,
 *                                 BUNDLED_LANGUAGES (Set), LANG_FLAGS (Map),
 *                                 norwegianInfinitive, getTranslation,
 *                                 generatedFromRefs }
 * @property {Object} storage  - { get(key), set(obj) }
 * @property {Object} runtime  - { sendMessage, getURL }
 * @property {Function} t                  - i18n string resolver (key, vars?)
 * @property {Function} getUiLanguage      - returns 'nb' | 'nn' | 'en'
 * @property {Function} langName           - (code) => display name
 * @property {Function} isFeatureEnabled   - (featureId) => bool
 * @property {Function} getAllowedPronouns - () => Set<string> | null
 * @property {Function} loadDictionary     - async (lang) => void; reloads state
 * @property {Function} loadGrammarFeatures - async (lang) => void
 * @property {Function} initGrammarSettings - () => void; refresh grammar UI in settings
 * @property {boolean}  audioEnabled       - when false, audio buttons NOT rendered
 * @property {string}   [BACKEND_URL]      - used for audio TTS endpoint
 * @property {Function} [getAllowedLanguages] - optional fn returning array of
 *   lang codes to limit which language pills are rendered. Returning null /
 *   undefined / empty array means no filter (show all). Used by lockdown to
 *   scope sidepanel pills to NB + active foreign language.
 *
 * @returns {{ destroy(): void, refresh(query?: string): void,
 *             rebuildLangSwitcher(): void, updateLangLabels(): void }}
 */
(function () {
  'use strict';

  // Bank → POS mapping (display only).
  const BANK_TO_POS = {
    verbbank: 'verb',
    nounbank: 'substantiv',
    adjectivebank: 'adjektiv',
    articlesbank: 'artikkel',
    generalbank: 'ord',
    numbersbank: 'tall',
    phrasesbank: 'frase',
    pronounsbank: 'pronomen',
    languagesbank: 'språk',
    nationalitiesbank: 'nasjonalitet',
  };

  function mountDictionaryView(container, deps) {
    if (!container) throw new Error('mountDictionaryView: container required');
    if (!deps) throw new Error('mountDictionaryView: deps required');

    const {
      state, vocab, storage: _storage, runtime, t,
      getUiLanguage, langName,
      isFeatureEnabled, getAllowedPronouns,
      loadDictionary, loadGrammarFeatures, initGrammarSettings,
      audioEnabled, BACKEND_URL,
    } = deps;

    // Local audio playback handle (per-view; not shared).
    let currentAudio = null;
    let currentAudioBlobUrl = null;

    // Per-view DOM lookups (scoped to container).
    const input = container.querySelector('#search-input');
    const clearBtn = container.querySelector('#search-clear');
    const dirNoTarget = container.querySelector('#dir-no-target');
    const dirTargetNo = container.querySelector('#dir-target-no');
    const langSwitcher = container.querySelector('#lang-switcher');
    const results = container.querySelector('#search-results');

    function escapeHtml(str) {
      // Use a fresh element. View can rely on document being present (popup
      // / sidepanel context) — this is render-time, not init-time.
      const d = container.ownerDocument.createElement('div');
      d.textContent = str == null ? '' : str;
      return d.innerHTML;
    }

    function sanitizeWarning(html) {
      return escapeHtml(html)
        .replace(/&lt;(\/?)(em|strong)&gt;/gi, '<$1$2>')
        .replace(/&lt;svg(.*?)&gt;/gi, '<svg$1>')
        .replace(/&lt;\/svg&gt;/gi, '</svg>')
        .replace(/&lt;g(.*?)&gt;/gi, '<g$1>')
        .replace(/&lt;\/g&gt;/gi, '</g>')
        .replace(/&lt;(circle|rect|line|polyline|polygon|text|path|ellipse)(.*?)&gt;/gi, '<$1$2>')
        .replace(/&lt;\/(circle|rect|line|polyline|polygon|text|path|ellipse)&gt;/gi, '</$1>')
        .replaceAll('&quot;', '"'); // restore attributes
    }

    function bankToPos(bank) {
      const keys = {
        verbbank: 'pos_verb', nounbank: 'pos_noun', adjectivebank: 'pos_adjective',
        articlesbank: 'pos_article', generalbank: 'pos_general', numbersbank: 'pos_number',
        phrasesbank: 'pos_phrase', pronounsbank: 'pos_pronoun',
      };
      return t(keys[bank] || 'pos_general');
    }

    function genusToGender(genus) {
      const keys = { m: 'gender_m', f: 'gender_f', n: 'gender_n', pl: 'gender_pl' };
      return keys[genus] ? t(keys[genus]) : genus;
    }

    function getPlayIcon() {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    }
    function getPauseIcon() {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }

    function getTranslation(entry) {
      return vocab.getTranslation(entry, state, getUiLanguage());
    }

    function showPlaceholder() {
      results.innerHTML = `<div class="results-placeholder"><p>${t('search_placeholder_text')}</p></div>`;
      container.classList.remove('has-searched');
    }

    function tryDecomposeQuery(query) {
      if (!vocab.decomposeCompound) return null;
      const q = query.toLowerCase();
      if (state.nounGenusMap && state.nounGenusMap.size > 0) {
        const result = vocab.decomposeCompound(q, state.nounGenusMap, state.currentLang);
        if (result) return result;
      }
      if (state.noNounGenusMap && state.noNounGenusMap.size > 0) {
        const noLang = getUiLanguage() === 'nn' ? 'nn' : 'nb';
        return vocab.decomposeCompound(q, state.noNounGenusMap, noLang);
      }
      return null;
    }

    function performSearch(query) {
      if (!query || !state.allWords || !state.allWords.length) {
        showPlaceholder();
        return;
      }

      const q = query.toLowerCase();
      const isMonolingual = getUiLanguage() === state.currentLang;
      const allWords = state.allWords;
      const noWords = state.noWords || [];
      const dictionary = state.dictionary;
      const inflectionIndex = state.inflectionIndex;

      // Phase 1: Direct matches
      const directResults = [];
      for (const entry of allWords) {
        if (isMonolingual) {
          if (entry.word && entry.word.toLowerCase().includes(q)) {
            directResults.push({ entry, inflectionHint: null });
          }
        } else if (state.searchDirection === 'no-target') {
          const trans = getTranslation(entry);
          if (trans && trans.toLowerCase().includes(q)) {
            directResults.push({ entry, inflectionHint: null });
          }
        } else {
          if (entry.word && entry.word.toLowerCase().includes(q)) {
            directResults.push({ entry, inflectionHint: null });
          }
        }
      }

      // Phase 1b: Two-way lookup via NB
      if (state.searchDirection === 'no-target' && noWords.length > 0) {
        const directEntryWords = new Set(directResults.map(r => r.entry.word?.toLowerCase()));
        const langPrefix = `${state.currentLang}-nb/`;

        for (const noEntry of noWords) {
          if (!noEntry.word || !noEntry.word.toLowerCase().includes(q)) continue;

          let targetWordId = noEntry.linkedTo?.[state.currentLang]?.primary || null;

          if (!targetWordId && noEntry._generatedFrom) {
            for (const trimmed of vocab.generatedFromRefs(noEntry)) {
              if (trimmed.startsWith(langPrefix)) {
                const colonIdx = trimmed.indexOf(':');
                if (colonIdx !== -1) {
                  targetWordId = trimmed.substring(colonIdx + 1);
                  break;
                }
              }
            }
          }

          if (!targetWordId && noEntry._wordId && state.nbIdToTargetIndex && state.nbIdToTargetIndex.size > 0) {
            targetWordId = state.nbIdToTargetIndex.get(noEntry._wordId);
          }

          if (!targetWordId) continue;

          for (const bank of Object.keys(BANK_TO_POS)) {
            const targetEntry = dictionary?.[bank]?.[targetWordId];
            if (targetEntry && !directEntryWords.has(targetEntry.word?.toLowerCase())) {
              const flatEntry = allWords.find(w => w.word === targetEntry.word);
              if (flatEntry) {
                directResults.push({
                  entry: flatEntry,
                  inflectionHint: `«${noEntry.word}» → ${flatEntry.word}`,
                });
                directEntryWords.add(flatEntry.word?.toLowerCase());
              }
            }
          }
        }
      }

      // Phase 2: Inflection
      const inflectionResults = [];
      const directEntrySet = new Set(directResults.map(r => r.entry));

      if (state.searchDirection === 'target-no') {
        if (inflectionIndex) {
          const matches = inflectionIndex.get(q) || [];
          for (const match of matches) {
            if (directEntrySet.has(match.entry)) continue;
            const hint = match.matchType === 'conjugation'
              ? t('result_inflection_conjugation', { query, word: match.entry.word })
              : match.matchType === 'typo'
                ? t('result_inflection_typo', { query, word: match.entry.word })
                : t('result_inflection_plural', { query, word: match.entry.word });
            inflectionResults.push({ entry: match.entry, inflectionHint: hint });
          }
        }
      } else {
        const infinitive = vocab.norwegianInfinitive(q);
        if (infinitive) {
          for (const entry of allWords) {
            if (directEntrySet.has(entry)) continue;
            const entryTrans = getTranslation(entry);
            if (!entryTrans) continue;
            const trans = entryTrans.toLowerCase();
            const stripped = trans.startsWith('å ') ? trans.slice(2) : trans;
            if (stripped === infinitive || stripped.startsWith(infinitive + ' ')
                || stripped.startsWith(infinitive + ',') || stripped.includes(', ' + infinitive)) {
              inflectionResults.push({
                entry,
                inflectionHint: t('result_inflection_conjugation', { query, word: infinitive }),
              });
            }
          }
        }
      }

      // Phase 3: Sort
      const useWord = isMonolingual || state.searchDirection === 'target-no';
      directResults.sort((a, b) => {
        const fieldA = useWord ? a.entry.word : getTranslation(a.entry);
        const fieldB = useWord ? b.entry.word : getTranslation(b.entry);
        const la = (fieldA || '').toLowerCase();
        const lb = (fieldB || '').toLowerCase();
        if (la === q && lb !== q) return -1;
        if (lb === q && la !== q) return 1;
        if (la.startsWith(q) && !lb.startsWith(q)) return -1;
        if (lb.startsWith(q) && !la.startsWith(q)) return 1;
        return la.localeCompare(lb);
      });

      const directStartsWith = [];
      const directContains = [];
      for (const r of directResults) {
        const field = ((useWord ? r.entry.word : getTranslation(r.entry)) || '').toLowerCase();
        if (field === q || field.startsWith(q)) directStartsWith.push(r);
        else directContains.push(r);
      }

      inflectionResults.sort((a, b) => (a.entry.word || '').localeCompare(b.entry.word || ''));

      const combined = [...directStartsWith, ...inflectionResults, ...directContains];

      // Compound decomposition
      if (combined.length === 0) {
        const decomp = tryDecomposeQuery(q);
        if (decomp) {
          renderCompoundCard(q, decomp);
          return;
        }
      }

      // Fallback opposite direction
      if (combined.length === 0 && !isMonolingual) {
        const fallbackResults = [];
        if (state.searchDirection === 'no-target') {
          for (const entry of allWords) {
            if (entry.word && entry.word.toLowerCase().includes(q)) {
              fallbackResults.push({ entry, inflectionHint: null });
            }
          }
          if (inflectionIndex) {
            const fallbackSet = new Set(fallbackResults.map(r => r.entry));
            const matches = inflectionIndex.get(q) || [];
            for (const match of matches) {
              if (fallbackSet.has(match.entry)) continue;
              const hint = match.matchType === 'conjugation'
                ? t('result_inflection_conjugation', { query, word: match.entry.word })
                : t('result_inflection_plural', { query, word: match.entry.word });
              fallbackResults.push({ entry: match.entry, inflectionHint: hint });
            }
          }
        } else {
          for (const entry of allWords) {
            const trans = getTranslation(entry);
            if (trans && trans.toLowerCase().includes(q)) {
              fallbackResults.push({ entry, inflectionHint: null });
            }
          }
        }

        if (fallbackResults.length > 0) {
          const fbUseWord = state.searchDirection === 'no-target';
          fallbackResults.sort((a, b) => {
            const fieldA = ((fbUseWord ? a.entry.word : getTranslation(a.entry)) || '').toLowerCase();
            const fieldB = ((fbUseWord ? b.entry.word : getTranslation(b.entry)) || '').toLowerCase();
            if (fieldA.startsWith(q) && !fieldB.startsWith(q)) return -1;
            if (fieldB.startsWith(q) && !fieldA.startsWith(q)) return 1;
            return fieldA.localeCompare(fieldB);
          });
          const noLang = getUiLanguage() === 'nn' ? 'nn' : 'nb';
          const searchLang = state.searchDirection === 'no-target' ? langName(noLang) : langName(state.currentLang);
          const resultLang = state.searchDirection === 'no-target' ? langName(state.currentLang) : langName(noLang);
          renderResults(fallbackResults.slice(0, 50), { fallbackHint: true, searchLang, resultLang });
          return;
        }
      }

      // Compound prediction
      if (combined.length === 0 && state.currentIndexes && state.currentIndexes.predictCompound) {
        const predictions = state.currentIndexes.predictCompound(q);
        if (predictions.length > 0) {
          renderCompoundSuggestions(query, predictions);
          return;
        }
      }

      renderResults(combined.slice(0, 50));
    }

    function renderCompoundSuggestions(query, predictions) {
      const heading = `<div class="compound-suggestions-heading">${t('compound_suggestions_heading')}</div>`;

      const cards = predictions.map(pred => {
        const { parts, gender } = pred.decomposition;
        const breakdownParts = [];
        for (const part of parts) {
          breakdownParts.push(escapeHtml(part.word));
          if (part.linker) breakdownParts.push(escapeHtml(part.linker));
        }
        const breakdownHtml = breakdownParts.map(p =>
          `<span class="compound-breakdown-part">${p}</span>`
        ).join('<span class="compound-breakdown-sep"> + </span>');

        const genderBadge = gender
          ? `<span class="result-gender">${genusToGender(gender)}</span>`
          : '';

        return `
          <div class="result-card compound-suggestion glass" data-compound-word="${escapeHtml(pred.word)}">
            <div class="result-basic">
              <div class="result-word-row">
                <span class="result-word">${escapeHtml(pred.word)}</span>
              </div>
              <div class="result-meta">
                <span class="compound-badge">${t('compound_label')}</span>
                <span class="result-pos">${t('pos_noun')}</span>
                ${genderBadge}
              </div>
            </div>
            <div class="compound-breakdown compound-breakdown-compact">${breakdownHtml}</div>
          </div>
        `;
      }).join('');

      results.innerHTML = heading + cards;

      results.querySelectorAll('.compound-suggestion').forEach(card => {
        card.addEventListener('click', () => {
          const word = card.dataset.compoundWord;
          if (input) input.value = word;
          performSearch(word);
        });
      });
    }

    function getComponentTranslation(word) {
      const lw = word.toLowerCase();
      for (const entry of state.allWords) {
        if (entry.word && entry.word.toLowerCase() === lw) {
          const trans = getTranslation(entry);
          if (trans) return trans;
        }
      }
      return null;
    }

    function renderCompoundCard(query, decomposition) {
      const { parts, gender } = decomposition;

      const breakdownParts = [];
      for (const part of parts) {
        breakdownParts.push(escapeHtml(part.word));
        if (part.linker) breakdownParts.push(escapeHtml(part.linker));
      }
      const breakdownHtml = breakdownParts.map((p) =>
        `<span class="compound-breakdown-part">${p}</span>`
      ).join('<span class="compound-breakdown-sep"> + </span>');

      const componentBtns = parts.map(part =>
        `<button class="compound-component-btn" data-word="${escapeHtml(part.word)}">${escapeHtml(part.word)}</button>`
      ).join('');

      const genderBadge = gender
        ? `<span class="result-gender">${genusToGender(gender)}</span>`
        : '';

      const lastComponent = parts[parts.length - 1];
      const lastComponentWord = lastComponent ? lastComponent.word : '';
      const pedagogyNote = lastComponentWord
        ? `<div class="compound-pedagogy">${t('compound_pedagogy', { lastComponent: `<a class="compound-pedagogy-link" data-word="${escapeHtml(lastComponentWord)}">${escapeHtml(lastComponentWord)}</a>` })}</div>`
        : '';

      const guessSegments = parts.map(part => {
        const trans = getComponentTranslation(part.word);
        return trans || `(${part.word})`;
      });
      const guessHtml = `
        <div class="compound-guess">
          <span class="compound-guess-label">${t('compound_translation_guess')}:</span>
          <span class="compound-guess-text">${escapeHtml(guessSegments.join(' + '))}</span>
        </div>
      `;

      const compoundNavStack = state.compoundNavStack || [];
      const backLinkHtml = compoundNavStack.length > 0
        ? `<a class="compound-back-link" href="#">${t('compound_back_link', { word: compoundNavStack[compoundNavStack.length - 1].query })}</a>`
        : '';

      results.innerHTML = `
        ${backLinkHtml}
        <div class="result-card compound-card glass">
          <div class="result-basic">
            <div class="result-word-row">
              <span class="result-word">${escapeHtml(query)}</span>
            </div>
            <div class="result-meta">
              <span class="compound-badge">${t('compound_label')}</span>
              <span class="result-pos">${t('pos_noun')}</span>
              ${genderBadge}
            </div>
          </div>
          <div class="compound-breakdown">${breakdownHtml}</div>
          <div class="compound-components">${componentBtns}</div>
          ${pedagogyNote}
          ${guessHtml}
        </div>
      `;

      results.querySelectorAll('.compound-component-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const word = btn.dataset.word;
          state.compoundNavStack.push({ query, decomposition });
          if (input) input.value = word;
          performSearch(word);
        });
      });

      results.querySelectorAll('.compound-pedagogy-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const word = link.dataset.word;
          state.compoundNavStack.push({ query, decomposition });
          if (input) input.value = word;
          performSearch(word);
        });
      });

      const backLink = results.querySelector('.compound-back-link');
      if (backLink) {
        backLink.addEventListener('click', (e) => {
          e.preventDefault();
          const prev = state.compoundNavStack.pop();
          if (prev) {
            if (input) input.value = prev.query;
            renderCompoundCard(prev.query, prev.decomposition);
          }
        });
      }
    }

    function renderPedagogy(entry) {
      if (!host.__lexiSpellRules || !entry.word) return '';
      // Only for DE word-order rules currently
      if (state.currentLang !== 'de') return '';
      
      const rules = host.__lexiSpellRules.filter(r => r.id === 'de-v2' || r.id === 'de-verb-final');
      let html = '';
      
      for (const rule of rules) {
        if (typeof rule.explain !== 'function') continue;
        const explanation = rule.explain({ original: entry.word, fix: '...', display: entry.word });
        const text = explanation[getUiLanguage()] || explanation.nb || '';
        if (text) {
          html += `<div class="result-pedagogy">
            <span class="pedagogy-icon">💡</span>
            <span class="pedagogy-text">${sanitizeWarning(text)}</span>
          </div>`;
        }
      }
      return html;
    }

    function renderResults(resultsList, options = {}) {
      if (!resultsList.length) {
        results.innerHTML = `<div class="results-placeholder"><p>${t('search_no_results')}</p></div>`;
        container.classList.remove('has-searched');
        return;
      }
      container.classList.add('has-searched');

      const compoundNavStack = state.compoundNavStack || [];
      const backLinkHtml = compoundNavStack.length > 0
        ? `<a class="compound-back-link" href="#">${t('compound_back_link', { word: compoundNavStack[compoundNavStack.length - 1].query })}</a>`
        : '';

      const hintHtml = options.fallbackHint
        ? `<div class="fallback-hint">${t('search_fallback_hint', { searchLang: options.searchLang || '', resultLang: options.resultLang || '' })}</div>`
        : '';

      results.innerHTML = backLinkHtml + hintHtml + resultsList.map(({ entry, inflectionHint }) => {
        const enrichment = entry._wordId && state.nbEnrichmentIndex
          ? state.nbEnrichmentIndex.get(entry._wordId)
          : null;
        const enrichedEntry = enrichment ? {
          ...entry,
          falseFriends: [...(entry.falseFriends || []), ...(enrichment.falseFriends || [])],
          senses: [...(entry.senses || []), ...(enrichment.senses || [])],
        } : entry;
        const audioBtnHtml = (audioEnabled && entry.audio)
          ? `<button class="audio-btn" data-audio="${escapeHtml(entry.audio)}" title="${t('widget_play')}">${getPlayIcon()}</button>`
          : '';
        return `
        <div class="result-card glass" data-id="${entry._id || ''}">
          <div class="result-basic">
            <div class="result-word-row">
              <span class="result-word">${escapeHtml(entry.word || '')}</span>
              ${audioBtnHtml}
            </div>
            ${renderFalseFriends(enrichedEntry)}
            ${renderSenses(enrichedEntry) || `<div class="result-translation">${escapeHtml(getTranslation(entry))}</div>`}
            ${renderPedagogy(entry)}
            ${inflectionHint ? `<div class="inflection-hint">${escapeHtml(inflectionHint)}</div>` : ''}            <div class="result-meta">
              <span class="result-pos">${escapeHtml(entry.partOfSpeech || '')}</span>
              ${entry.gender && isFeatureEnabled('grammar_articles') ? `<span class="result-gender">${escapeHtml(entry.gender)}</span>` : ''}
              ${entry.plural && isFeatureEnabled('grammar_plural') ? `<span class="result-plural">${escapeHtml(entry.plural)}</span>` : ''}
              ${entry.cefr ? `<span class="result-cefr">${escapeHtml(entry.cefr)}</span>` : ''}
            </div>
          </div>
          <button class="explore-btn">${t('result_explore')}</button>
          <div class="result-expanded hidden">
            ${renderVerbConjugations(entry)}
            ${renderNounCases(entry)}
            ${renderNounForms(entry)}
            ${renderAdjectiveComparison(entry)}
            ${entry.synonyms && entry.synonyms.length ? `
              <div class="expanded-section">
                <h4>${t('result_synonyms')}</h4>
                <p>${entry.synonyms.map(s => escapeHtml(s)).join(', ')}</p>
              </div>
            ` : ''}
            ${entry.grammar ? `
              <div class="expanded-section">
                <h4>${t('result_grammar')}</h4>
                <p>${escapeHtml(entry.grammar)}</p>
              </div>
            ` : ''}
            ${renderExamples(entry)}
          </div>
        </div>
      `;
      }).join('');

      results.querySelectorAll('.explore-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const expanded = btn.nextElementSibling;
          const isHidden = expanded.classList.contains('hidden');
          expanded.classList.toggle('hidden');
          btn.textContent = isHidden ? t('result_collapse') : t('result_explore');
        });
      });

      if (audioEnabled) {
        results.querySelectorAll('.audio-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const audioFile = btn.dataset.audio;
            if (audioFile) playAudio(audioFile, btn);
          });
        });
      }

      const backLink = results.querySelector('.compound-back-link');
      if (backLink) {
        backLink.addEventListener('click', (e) => {
          e.preventDefault();
          const prev = state.compoundNavStack.pop();
          if (prev) {
            if (input) input.value = prev.query;
            renderCompoundCard(prev.query, prev.decomposition);
          }
        });
      }
    }

    function renderSenses(entry) {
      if (!entry.senses || !entry.senses.length) return null;
      const relevant = entry.senses.filter(s => s.translations && s.translations[state.currentLang]);
      if (!relevant.length) return null;
      const items = relevant.map(s => {
        const tr = s.translations[state.currentLang];
        const forms = Array.isArray(tr.forms) ? tr.forms : (tr.form ? [tr.form] : []);
        const ex = tr.example || {};
        return `
          <div class="sense-item">
            <div class="sense-trigger">${escapeHtml(s.trigger || '')}</div>
            <div class="sense-forms">${forms.map(escapeHtml).join(', ')}</div>
            ${ex.sentence ? `
              <div class="sense-example">
                <span class="sense-example-src">${escapeHtml(ex.sentence)}</span>
                ${ex.translation ? `<span class="sense-example-tr"> — ${escapeHtml(ex.translation)}</span>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
      return `<div class="senses-block">${items}</div>`;
    }

    function renderFalseFriends(entry) {
      if (!entry.falseFriends || !entry.falseFriends.length) return '';
      const pairs = entry.falseFriends.filter(f => f.lang === state.currentLang);
      if (!pairs.length) return '';
      const items = pairs.map(f => `
        <div class="false-friend-item">
          <span class="false-friend-form">${escapeHtml(f.form)}</span>
          <span class="false-friend-meaning">${escapeHtml(f.meaning || '')}</span>
          <p class="false-friend-warning">${sanitizeWarning(f.warning || '')}</p>
        </div>
      `).join('');
      return `
        <div class="false-friend-banner" role="note">
          <span class="false-friend-heading">⚠ ${t('result_false_friend_heading')}</span>
          ${items}
        </div>
      `;
    }

    function renderExamples(entry) {
      const examples = [];
      const uiLang = getUiLanguage();
      const hideExampleTranslations = (uiLang === 'nb' || uiLang === 'nn') && (state.currentLang === 'nb' || state.currentLang === 'nn');

      if (entry.examples && entry.examples.length) {
        for (const ex of entry.examples) {
          if (!hideExampleTranslations || !ex.lang || ex.lang === state.currentLang) {
            examples.push({
              sentence: ex.sentence || ex.source || '',
              translation: (!hideExampleTranslations) ? (ex.translation || ex.target || '') : '',
              lang: ex.lang,
            });
          } else if (hideExampleTranslations && ex.lang) {
            const sentence = ex.sentence || ex.source || '';
            if (sentence) examples.push({ sentence, translation: '', lang: ex.lang });
          }
        }
      }

      if (entry.linkedTo && !hideExampleTranslations) {
        const link = entry.linkedTo.nb || entry.linkedTo.nn;
        if (link?.examples) {
          for (const ex of link.examples) {
            const sentence = ex.source || ex.sentence || '';
            const translation = ex.target || ex.translation || '';
            if (sentence && !examples.some(e => e.sentence === sentence)) {
              examples.push({ sentence, translation });
            }
          }
        }
      }

      if (examples.length === 0) return '';

      return `
        <div class="expanded-section">
          <h4>${t('result_examples')}</h4>
          ${examples.map(ex => `
            <div class="example">
              <p class="example-sentence">"${escapeHtml(ex.sentence)}"</p>
              ${ex.translation ? `<p class="example-translation">${escapeHtml(ex.translation)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    function renderVerbConjugations(entry) {
      if (!entry.conjugations) return '';

      const allowedPronouns = getAllowedPronouns();
      const sections = [];

      const presensData = entry.conjugations.presens;
      if (presensData?.former?.infinitiv !== undefined) {
        const forms = presensData.former;
        const labels = {
          infinitiv: t('tense_infinitive'),
          presens: t('tense_presens'),
          preteritum: t('tense_preteritum'),
          perfektum_partisipp: t('tense_past_participle'),
          imperativ: t('tense_imperative'),
        };
        const rows = Object.entries(labels)
          .filter(([key]) => forms[key] !== undefined)
          .map(([key, label]) => `<tr><td>${label}</td><td>${escapeHtml(forms[key])}</td></tr>`)
          .join('');
        if (rows) {
          sections.push(`
            <div class="expanded-section">
              <h4>${t('result_conjugation')}</h4>
              <table class="conjugation-table">${rows}</table>
            </div>
          `);
        }
        return sections.join('');
      }

      if (entry.conjugations.present || entry.conjugations.past || entry.conjugations.perfect) {
        const enTenses = [
          { key: 'present', featureIds: ['grammar_present', 'grammar_en_present'], nameKey: 'tense_presens' },
          { key: 'past', featureIds: ['grammar_preteritum', 'grammar_en_past'], nameKey: 'tense_preteritum' },
          { key: 'perfect', featureIds: ['grammar_perfektum', 'grammar_en_perfect'], nameKey: 'tense_perfektum' },
        ];
        for (const config of enTenses) {
          const isEnabled = config.featureIds.some(id => isFeatureEnabled(id));
          if (!isEnabled) continue;
          const tenseData = entry.conjugations[config.key];
          if (!tenseData) continue;
          if (tenseData.former) {
            const rows = Object.entries(tenseData.former)
              .filter(([pronoun, form]) => !pronoun.startsWith('_') && typeof form === 'string')
              .map(([pronoun, form]) => `<tr><td>${escapeHtml(pronoun)}</td><td>${escapeHtml(form)}</td></tr>`)
              .join('');
            if (rows) {
              sections.push(`
                <div class="expanded-section">
                  <h4>${t(config.nameKey)}</h4>
                  <table class="conjugation-table">${rows}</table>
                </div>
              `);
            }
          } else if (tenseData.participle || tenseData.present_participle) {
            const parts = [];
            if (tenseData.participle) parts.push(`${t('tense_past_participle')}: ${escapeHtml(tenseData.participle)}`);
            if (tenseData.present_participle) parts.push(`Present participle: ${escapeHtml(tenseData.present_participle)}`);
            sections.push(`
              <div class="expanded-section">
                <h4>${t(config.nameKey)}</h4>
                <p>${parts.join('<br>')}</p>
              </div>
            `);
          }
        }
        return sections.join('');
      }

      const tenseConfig = [
        { keys: ['presens', 'presente'], featureIds: ['grammar_present', 'grammar_de_presens', 'grammar_es_presente', 'grammar_fr_present', 'grammar_nb_presens', 'grammar_nn_presens', 'grammar_presens'], nameKey: 'tense_presens' },
        { keys: ['preteritum', 'preterito'], featureIds: ['grammar_preteritum', 'grammar_de_preteritum', 'grammar_es_preterito', 'grammar_preterito', 'grammar_nb_preteritum', 'grammar_nn_preteritum'], nameKey: 'tense_preteritum' },
        { keys: ['perfektum', 'perfecto', 'passe_compose'], featureIds: ['grammar_perfektum', 'grammar_de_perfektum', 'grammar_es_perfecto', 'grammar_fr_passe_compose', 'grammar_perfecto', 'grammar_nb_perfektum', 'grammar_nn_perfektum'], nameKey: 'tense_perfektum' },
      ];

      for (const config of tenseConfig) {
        const isEnabled = config.featureIds.some(id => isFeatureEnabled(id));
        if (!isEnabled) continue;

        let tenseData = null;
        for (const key of config.keys) {
          if (entry.conjugations[key]) { tenseData = entry.conjugations[key]; break; }
        }
        if (!tenseData) continue;

        if (tenseData.former) {
          const filtered = filterPronouns(tenseData.former, allowedPronouns);
          if (Object.keys(filtered).length > 0) {
            sections.push(`
              <div class="expanded-section">
                <h4>${t(config.nameKey)}</h4>
                ${renderConjugationTable(filtered)}
              </div>
            `);
          }
        } else if (tenseData.auxiliary || tenseData.participle) {
          sections.push(`
            <div class="expanded-section">
              <h4>${t(config.nameKey)}</h4>
              <p>${escapeHtml(tenseData.auxiliary || '')} + ${escapeHtml(tenseData.participle || '')}</p>
            </div>
          `);
        }
      }
      return sections.join('');
    }

    function filterPronouns(forms, allowedPronouns) {
      const pronounLabels = {
        es: ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes'],
        fr: ['je', 'tu', 'il/elle/on', 'nous', 'vous', 'ils/elles'],
      };
      if (Array.isArray(forms)) {
        const labels = pronounLabels[state.currentLang] || [];
        const result = {};
        forms.forEach((form, i) => {
          if (!form) return;
          const pronoun = labels[i] || `${i}`;
          if (!allowedPronouns || allowedPronouns.has(pronoun)) result[pronoun] = form;
        });
        return result;
      }
      const filtered = {};
      for (const [pronoun, form] of Object.entries(forms)) {
        if (pronoun.startsWith('_')) continue;
        if (allowedPronouns && !allowedPronouns.has(pronoun)) continue;
        filtered[pronoun] = form;
      }
      return filtered;
    }

    function renderConjugationTable(forms) {
      return `<table class="conjugation-table">
        ${Object.entries(forms).map(([pronoun, form]) =>
          `<tr><td>${escapeHtml(pronoun)}</td><td>${escapeHtml(form)}</td></tr>`
        ).join('')}
      </table>`;
    }

    function renderNounCases(entry) {
      if (!entry.cases) return '';
      const caseConfig = [
        { key: 'nominativ', label: 'Nominativ', feature: null },
        { key: 'akkusativ', label: 'Akkusativ', feature: ['grammar_accusative_indefinite', 'grammar_accusative_definite', 'grammar_accusative_nouns'] },
        { key: 'dativ', label: 'Dativ', feature: ['grammar_dative'] },
        { key: 'genitiv', label: 'Genitiv', feature: ['grammar_genitiv'] },
      ];
      const enabledCases = caseConfig.filter(c => {
        if (!c.feature) return true;
        return c.feature.some(f => isFeatureEnabled(f));
      });
      if (enabledCases.length <= 1) return '';
      const rows = enabledCases.map(c => {
        const caseData = entry.cases[c.key];
        const singular = caseData?.forms?.singular || {};
        const plural = caseData?.forms?.plural || {};
        return `<tr>
          <td><strong>${c.label}</strong></td>
          <td>${escapeHtml(singular.definite || '-')}</td>
          <td>${escapeHtml(singular.indefinite || '-')}</td>
          <td>${escapeHtml(plural.definite || '-')}</td>
          <td>${escapeHtml(plural.indefinite || '-')}</td>
        </tr>`;
      }).join('');
      return `
        <div class="expanded-section">
          <h4>${t('result_cases')}</h4>
          <table class="conjugation-table declension-table">
            <thead>
              <tr>
                <th></th>
                <th>${t('decl_def_sg')}</th>
                <th>${t('decl_indef_sg')}</th>
                <th>${t('decl_def_pl')}</th>
                <th>${t('decl_indef_pl')}</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    function fmtForm(val) {
      if (!val) return '-';
      return Array.isArray(val) ? val.join(' / ') : val;
    }

    function renderNounForms(entry) {
      if (!entry.forms) return '';
      const ub = entry.forms.ubestemt;
      const be = entry.forms.bestemt;
      if (!ub && !be) return '';
      return `
        <div class="expanded-section">
          <h4>${t('result_conjugation')}</h4>
          <table class="conjugation-table declension-table">
            <thead>
              <tr><th></th><th>${t('decl_singular')}</th><th>${t('decl_plural')}</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>${t('decl_indefinite')}</strong></td><td>${escapeHtml(fmtForm(ub?.entall))}</td><td>${escapeHtml(fmtForm(ub?.flertall))}</td></tr>
              <tr><td><strong>${t('decl_definite')}</strong></td><td>${escapeHtml(fmtForm(be?.entall))}</td><td>${escapeHtml(fmtForm(be?.flertall))}</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }

    function renderAdjectiveComparison(entry) {
      if (!entry.comparison) return '';
      const sections = [];
      const komparativ = entry.comparison.komparativ || entry.comparison.comparativo || entry.comparison.comparative;
      if (isFeatureEnabled('grammar_comparative') && komparativ) {
        sections.push(`
          <div class="expanded-section">
            <h4>${t('tense_comparative')}</h4>
            <p>${escapeHtml(komparativ)}</p>
          </div>
        `);
      }
      const superlativ = entry.comparison.superlativ || entry.comparison.superlativo || entry.comparison.superlative;
      if (isFeatureEnabled('grammar_superlative') && superlativ) {
        sections.push(`
          <div class="expanded-section">
            <h4>${t('tense_superlative')}</h4>
            <p>${escapeHtml(superlativ)}</p>
          </div>
        `);
      }
      return sections.join('');
    }

    // ── Audio ──────────────────────────────────────
    function cleanupAudio() {
      if (currentAudioBlobUrl) {
        URL.revokeObjectURL(currentAudioBlobUrl);
        currentAudioBlobUrl = null;
      }
    }

    async function playAudio(audioFilename, button) {
      if (!audioEnabled) return;
      if (currentAudio) {
        currentAudio.pause();
        cleanupAudio();
        currentAudio = null;
        results.querySelectorAll('.audio-btn.playing').forEach(btn => {
          btn.classList.remove('playing');
          btn.innerHTML = getPlayIcon();
        });
      }

      if (!audioFilename || !state.dictionary?._metadata) return;
      const lang = state.dictionary._metadata.language;
      const langsToTry = lang === 'nn' ? ['nn', 'nb'] : lang === 'nb' ? ['nb', 'nn'] : [lang];

      let audioUrl = null;
      if (vocab.getAudioFile) {
        for (const tryLang of langsToTry) {
          const blob = await vocab.getAudioFile(tryLang, audioFilename);
          if (blob) {
            audioUrl = URL.createObjectURL(blob);
            currentAudioBlobUrl = audioUrl;
            break;
          }
        }
      }

      if (!audioUrl && runtime.getURL) {
        for (const tryLang of langsToTry) {
          try {
            const url = runtime.getURL(`audio/${tryLang}/${audioFilename}`);
            const check = await fetch(url, { method: 'HEAD' });
            if (check.ok) { audioUrl = url; break; }
          } catch { /* not found */ }
        }
      }

      if (!audioUrl) {
        // Browser TTS fallback
        const wordEl = button.closest('.result-word-row')?.querySelector('.result-word');
        const word = wordEl?.textContent?.trim();
        if (word && self.speechSynthesis) {
          const VOICE_LANGS = { de: 'de', es: 'es', fr: 'fr', en: 'en', nb: 'nb', nn: 'nb', no: 'nb' };
          const synth = self.speechSynthesis;
          synth.cancel();
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = VOICE_LANGS[lang] || 'nb';
          const voices = synth.getVoices();
          const match = voices.find(v => v.lang.startsWith(utterance.lang));
          if (match) utterance.voice = match;
          button.classList.add('playing');
          button.innerHTML = getPauseIcon();
          utterance.onend = () => { button.classList.remove('playing'); button.innerHTML = getPlayIcon(); };
          utterance.onerror = () => { button.classList.remove('playing'); button.innerHTML = getPlayIcon(); };
          synth.speak(utterance);
        }
        return;
      }

      currentAudio = new Audio(audioUrl);
      button.classList.add('playing');
      button.innerHTML = getPauseIcon();

      currentAudio.play().catch(err => {
        // eslint-disable-next-line no-console
        console.warn('Audio playback failed:', err);
        button.classList.remove('playing');
        button.innerHTML = getPlayIcon();
        cleanupAudio();
        currentAudio = null;
      });
      currentAudio.addEventListener('ended', () => {
        button.classList.remove('playing');
        button.innerHTML = getPlayIcon();
        cleanupAudio();
        currentAudio = null;
      });
      currentAudio.addEventListener('error', () => {
        button.classList.remove('playing');
        button.innerHTML = getPlayIcon();
        cleanupAudio();
        currentAudio = null;
      });
    }

    // ── Lang switcher + labels ─────────────────────────────
    async function rebuildLangSwitcher() {
      if (!langSwitcher) return;

      const available = [];
      const bundled = vocab.BUNDLED_LANGUAGES || new Set(['nb', 'nn', 'en']);
      for (const lang of bundled) available.push(lang);

      if (vocab.listCachedLanguages) {
        const cached = await vocab.listCachedLanguages();
        for (const c of cached) {
          if (!available.includes(c.language)) available.push(c.language);
        }
      }

      // deps.getAllowedLanguages (optional fn): return an array of lang
      // codes to limit which pills render. Used by lockdown to scope the
      // sidepanel to NB + the active foreign language — Norwegian
      // students study one foreign language at a time, so French and
      // Spanish pills in a German test are noise. Returning null/undefined
      // means no filter (show all). The extension popup leaves it unset.
      let filtered = available;
      if (typeof deps.getAllowedLanguages === 'function') {
        const allowed = deps.getAllowedLanguages();
        if (Array.isArray(allowed) && allowed.length > 0) {
          const allowSet = new Set(allowed);
          filtered = available.filter(l => allowSet.has(l));
        }
      }

      filtered.sort((a, b) => {
        if (a === state.currentLang) return -1;
        if (b === state.currentLang) return 1;
        return langName(a).localeCompare(langName(b));
      });

      const flags = vocab.LANG_FLAGS || { de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', nn: '🇳🇴', nb: '🇳🇴' };

      langSwitcher.innerHTML = filtered.map(lang => `
        <button class="lang-switch-btn ${lang === state.currentLang ? 'active' : ''}" data-lang="${lang}">
          <span class="lang-switch-flag">${flags[lang] || ''}</span>
          ${langName(lang)}
        </button>
      `).join('');

      langSwitcher.querySelectorAll('.lang-switch-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const lang = btn.dataset.lang;
          if (lang === state.currentLang) return;

          langSwitcher.querySelectorAll('.lang-switch-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          state.currentLang = lang;
          // deps.broadcastLanguageChange (default true): when true, the
          // pill click is a SSO write — sets shared `language` storage and
          // broadcasts LANGUAGE_CHANGED so floating-widget, spell-check, and
          // editor.lang follow. Default for the extension popup (the popup
          // IS the writing surface so the user expects it to drive everything).
          //
          // Lockdown opts out (false): the sidepanel pills are dictionary-
          // scoped only — switching to NB to look up a Norwegian word doesn't
          // disrupt a student writing German. The bottom-right Aa picker
          // (and leksihjelp's green Aa in leksihjelp mode) remain the SSO.
          if (deps.broadcastLanguageChange !== false) {
              await deps.storage.set({ language: state.currentLang });
          }
          await loadDictionary(state.currentLang);
          await loadGrammarFeatures(state.currentLang);
          if (initGrammarSettings) initGrammarSettings();
          updateLangLabels();
          if (deps.broadcastLanguageChange !== false) {
              runtime.sendMessage({ type: 'LANGUAGE_CHANGED', language: state.currentLang });
          }

          if (input?.value.trim()) performSearch(input.value.trim());

          // Notify host so it can refresh its language-list status (in settings).
          if (deps.onLanguageChanged) deps.onLanguageChanged(state.currentLang);
        });
      });
    }

    function updateLangLabels() {
      const dict = state.dictionary;
      if (!dict || !dict._metadata) return;
      const code = dict._metadata.language.toUpperCase();
      const uiCode = getUiLanguage().toUpperCase();
      const isMonolingual = getUiLanguage() === state.currentLang;

      container.querySelectorAll('.target-lang-code').forEach(el => {
        el.textContent = code;
      });

      if (dirNoTarget && dirTargetNo) {
        if (isMonolingual) {
          dirNoTarget.innerHTML = `<span class="target-lang-code">${code}</span> ${t('search_monolingual')}`;
          dirTargetNo.style.display = 'none';
          dirNoTarget.classList.add('active');
        } else {
          dirTargetNo.style.display = '';
          dirNoTarget.innerHTML = `${uiCode} → <span class="target-lang-code">${code}</span>`;
          dirTargetNo.innerHTML = `<span class="target-lang-code">${code}</span> → ${uiCode}`;
        }
      }
    }

    // ── Wiring ─────────────────────────────────
    let searchDebounceTimer;
    function onInput() {
      if (clearBtn) clearBtn.classList.toggle('hidden', !input.value);
      if (state.compoundNavStack) state.compoundNavStack.length = 0;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => performSearch(input.value.trim()), 150);
    }
    function onClear() {
      if (input) input.value = '';
      if (clearBtn) clearBtn.classList.add('hidden');
      showPlaceholder();
    }
    function onDirNoTarget() {
      state.searchDirection = 'no-target';
      dirNoTarget.classList.add('active');
      dirTargetNo.classList.remove('active');
      if (input?.value.trim()) performSearch(input.value.trim());
    }
    function onDirTargetNo() {
      state.searchDirection = 'target-no';
      dirTargetNo.classList.add('active');
      dirNoTarget.classList.remove('active');
      if (input?.value.trim()) performSearch(input.value.trim());
    }

    if (input) input.addEventListener('input', onInput);
    if (clearBtn) clearBtn.addEventListener('click', onClear);
    if (dirNoTarget) dirNoTarget.addEventListener('click', onDirNoTarget);
    if (dirTargetNo) dirTargetNo.addEventListener('click', onDirTargetNo);

    if (input && typeof input.focus === 'function') input.focus();

    rebuildLangSwitcher();

    return {
      destroy() {
        clearTimeout(searchDebounceTimer);
        if (currentAudio) { currentAudio.pause(); cleanupAudio(); currentAudio = null; }
        if (input) input.removeEventListener('input', onInput);
        if (clearBtn) clearBtn.removeEventListener('click', onClear);
        if (dirNoTarget) dirNoTarget.removeEventListener('click', onDirNoTarget);
        if (dirTargetNo) dirTargetNo.removeEventListener('click', onDirTargetNo);
      },
      refresh(query) {
        const q = query != null ? query : (input?.value || '').trim();
        if (q) performSearch(q); else showPlaceholder();
      },
      rebuildLangSwitcher,
      updateLangLabels,
    };
  }

  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiDictionaryView = { mount: mountDictionaryView };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mount: mountDictionaryView, mountDictionaryView };
  }
})();
