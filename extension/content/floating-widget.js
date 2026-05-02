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

    const LANG_FLAGS = { de: '🇩🇪', es: '🇪🇸', fr: '🇫🇷', en: '🇬🇧', nb: '🇳🇴', nn: '🇳🇴', no: '🇳🇴' };

    function renderCard() {
      const langFlag = LANG_FLAGS[currentLang] || '';
      const langSuffix = currentLang === 'nb' ? ' NB' : currentLang === 'nn' ? ' NN' : '';
      
      const headerHtml = `
        <div class="lh-lookup-drag" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;cursor:move;user-select:none;">
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#11B49A;">${t('widget_lookup_header')}</span>
            <button id="lh-lookup-lang-btn" title="${t('pred_switch_lang')}" style="background:rgba(17,180,154,0.1);border:none;border-radius:4px;padding:2px 6px;font-size:10px;font-weight:700;color:#11B49A;cursor:pointer;">${langFlag}${langSuffix}</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button id="lh-lookup-pause" title="${t('nav_pause_title')}" style="background:none;border:none;font-size:14px;color:#94a3b8;cursor:pointer;padding:0 4px;">⏸</button>
            <button id="lh-lookup-close" style="background:none;border:none;font-size:18px;color:#94a3b8;cursor:pointer;">&times;</button>
          </div>
        </div>
      `;

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
          ${headerHtml}
          ${conjugHint}
          <div style="font-size:20px;font-weight:700;color:#11B49A;margin-bottom:2px;">${escapeHtml(match.word)}</div>
          ${falseFriendHtml}
          ${translationHtml}
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${escapeHtml(match.partOfSpeech)}</span>
            ${match.gender ? `<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${escapeHtml(match.gender)}</span>` : ''}
          </div>
          ${match.examples && match.examples.length ? `<div style="font-style:italic;font-size:13px;color:#475569;margin-bottom:4px;">"${escapeHtml(match.examples[0].sentence)}"</div><div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">${escapeHtml(match.examples[0].translation)}</div>` : ''}
          ${match.grammar ? `<div style="font-size:12px;color:#64748b;padding-top:8px;border-top:1px solid rgba(0,0,0,0.06);"><strong>${t('widget_lookup_grammar')}</strong> ${escapeHtml(match.grammar)}</div>` : ''}
        `;
      } else {
        // Fallback: check if it's a compound word (NB/NN only)
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
            ${headerHtml}
            <div style="font-size:18px;font-weight:700;color:#11B49A;margin-bottom:2px;">${escapeHtml(word)}</div>
            <div style="display:flex;gap:6px;margin-bottom:8px;">
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(124,58,237,0.08);color:#7c3aed;font-weight:600;">${t('compound_label')}</span>
              <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(17,180,154,0.08);color:#11B49A;font-weight:500;">${t('pos_noun')}</span>
            </div>
            <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:4px;">${breakdownStr}${escapeHtml(genderStr)}</div>
          `;
        } else {
          card.innerHTML = `
            ${headerHtml}
            <div style="text-align:center;padding:16px 0;color:#94a3b8;">
              <div style="font-size:15px;margin-bottom:4px;">"${escapeHtml(word)}"</div>
              <div style="font-size:13px;">${t('widget_lookup_not_found')}</div>
            </div>
          `;
        }
      }

      card.querySelector('#lh-lookup-close').addEventListener('click', () => card.remove());
      card.querySelector('#lh-lookup-pause').addEventListener('click', () => {
        card.remove();
        disableWidgetQuick();
      });

      const langBtn = card.querySelector('#lh-lookup-lang-btn');
      if (langBtn) {
        langBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const langs = ['nb', 'nn', 'en', 'de', 'es', 'fr'];
          const nextIdx = (langs.indexOf(currentLang) + 1) % langs.length;
          currentLang = langs[nextIdx];
          await chrome.storage.local.set({ language: currentLang });
          // Re-trigger search with the same word
          showInlineLookup(word);
        });
      }
    }

    renderCard();
    (document.fullscreenElement || document.documentElement).appendChild(card);
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
        if (e.target.closest('#lh-lookup-close') || e.target.closest('#lh-lookup-lang-btn') || e.target.closest('#lh-lookup-pause')) return;
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