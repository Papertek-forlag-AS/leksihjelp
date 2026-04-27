importScripts('/i18n/strings.js');
// Plan 23-04: vocab-store + vocab-updater in service-worker scope so
// startup revision check + manual refresh handler can run without a popup.
// vocab-store.js is an IIFE that exposes self.__lexiVocabStore; vocab-updater
// reads that surface to drive checkForUpdates / refreshAll. Both files are
// safe in service-worker scope (no DOM access; IndexedDB available).
importScripts('/content/vocab-store.js');
importScripts('/background/vocab-updater.js');

/**
 * Leksihjelp — Background Service Worker
 *
 * Handles:
 * - Context menu for dictionary lookup + TTS
 * - Message routing between popup and content scripts
 * - Extension install/setup
 */

const BACKEND_URL = 'https://leksihjelp.no';
const { t, initI18n, setUiLanguage, getUiLanguage } = self.__lexiI18n;

// ── Install / Update ──
chrome.runtime.onInstalled.addListener((details) => {
  // Set defaults
  chrome.storage.local.get(['language'], (result) => {
    if (!result.language) {
      // Don't set a default language — let the popup show the first-run picker
      chrome.storage.local.set({
        predictionEnabled: true,
        isAuthenticated: false
      });
    }
  });

  // Create context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lexi-lookup',
      title: t('ctx_lookup'),
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'lexi-tts',
      title: t('ctx_read'),
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'lexi-separator',
      type: 'separator',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'lexi-toggle-predictions',
      title: t('ctx_pause_predictions'),
      contexts: ['editable']
    });
  });

  // Set initial context menu title based on stored pause state
  chrome.storage.local.get('lexiPaused', (result) => {
    const paused = result.lexiPaused || false;
    chrome.contextMenus.update('lexi-toggle-predictions', {
      title: paused ? t('ctx_resume_predictions') : t('ctx_pause_predictions')
    }).catch(() => {});
  });
});

// ── Helpers ──
async function broadcastToAllTabs(msg) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}

async function togglePause() {
  const result = await chrome.storage.local.get('lexiPaused');
  const newState = !result.lexiPaused;
  await chrome.storage.local.set({ lexiPaused: newState });
  chrome.contextMenus.update('lexi-toggle-predictions', {
    title: newState ? t('ctx_resume_predictions') : t('ctx_pause_predictions')
  }).catch(() => {});
  await broadcastToAllTabs({ type: 'LEXI_PAUSED', paused: newState });
}

// ── Context Menu Click ──
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'lexi-lookup') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'LOOKUP_WORD',
      word: info.selectionText
    }).catch(() => {});
  }

  if (info.menuItemId === 'lexi-tts') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'PLAY_TTS',
      text: info.selectionText
    }).catch(() => {});
  }

  if (info.menuItemId === 'lexi-toggle-predictions') {
    await togglePause();
  }
});

// ── Keyboard shortcut commands ──
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'lookup-selection') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_LOOKUP' }).catch(() => {});
  }

  if (command === 'read-selection') {
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_TTS' }).catch(() => {});
  }

  if (command === 'toggle-pause') {
    await togglePause();
  }
});

// ── Message routing ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Relay settings changes to all content scripts
  if (msg.type === 'LANGUAGE_CHANGED' || msg.type === 'PREDICTION_TOGGLED' || msg.type === 'AUTH_CHANGED' || msg.type === 'LEXI_PAUSED') {
    broadcastToAllTabs(msg);
    if (msg.type === 'LEXI_PAUSED') {
      chrome.contextMenus.update('lexi-toggle-predictions', {
        title: msg.paused ? t('ctx_resume_predictions') : t('ctx_pause_predictions')
      }).catch(() => {});
    }
  }

  // UI language changed — update context menu titles
  if (msg.type === 'UI_LANGUAGE_CHANGED') {
    setUiLanguage(msg.uiLanguage);
    chrome.contextMenus.update('lexi-lookup', { title: t('ctx_lookup') }).catch(() => {});
    chrome.contextMenus.update('lexi-tts', { title: t('ctx_read') }).catch(() => {});
    chrome.storage.local.get('lexiPaused', (res) => {
      const paused = res.lexiPaused || false;
      chrome.contextMenus.update('lexi-toggle-predictions', {
        title: paused ? t('ctx_resume_predictions') : t('ctx_pause_predictions')
      }).catch(() => {});
    });
  }

  // Error report — delegated from spell-check content script (SC-06 network silence)
  if (msg.type === 'SEND_REPORT') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get(['sessionToken', 'siteUrl']);
        const base = stored.siteUrl || 'https://leksihjelp.no';
        const headers = { 'Content-Type': 'application/json', 'X-Lexi-Client': 'lexi-extension' };
        if (stored.sessionToken) headers['Authorization'] = 'Bearer ' + stored.sessionToken;
        const resp = await fetch(base + '/api/report', { method: 'POST', headers, body: JSON.stringify(msg.data) });
        sendResponse(resp.ok);
      } catch (_) { sendResponse(false); }
    })();
    return true; // async sendResponse
  }

  // Verify access code
  if (msg.type === 'VERIFY_CODE') {
    verifyCode(msg.code).then(sendResponse);
    return true; // async
  }

  // Vipps login — run in service worker so popup can close without breaking the flow
  if (msg.type === 'START_VIPPS_LOGIN') {
    handleVippsLogin().then(sendResponse);
    return true; // async
  }

  // TTS fetch — route through service worker to avoid content script CORS issues
  if (msg.type === 'FETCH_TTS') {
    handleTtsFetch(msg.url, msg.headers, msg.body).then(sendResponse);
    return true; // async
  }

  // Vocab data proxy — content scripts can't access extension-origin IndexedDB
  if (msg.type === 'VOCAB_GET_CACHED') {
    getVocabRecord(msg.language).then(record => {
      sendResponse(record?.data || null);
    }).catch(() => sendResponse(null));
    return true; // async
  }

  if (msg.type === 'VOCAB_GET_GRAMMAR') {
    getVocabRecord(msg.language).then(record => {
      sendResponse(record?.grammarFeatures || null);
    }).catch(() => sendResponse(null));
    return true; // async
  }

  if (msg.type === 'VOCAB_LIST_CACHED') {
    listVocabLanguages().then(sendResponse).catch(() => sendResponse([]));
    return true; // async
  }
});

// ── Code verification (legacy) ──
async function verifyCode(code) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      },
      body: JSON.stringify({ code })
    });
    if (res.status === 429) {
      return { valid: false, rateLimited: true };
    }
    return await res.json();
  } catch {
    // Server unreachable — no offline fallback
    return { valid: false, offline: true };
  }
}

// ── Vocab data proxy (content scripts can't access extension-origin IndexedDB) ──
const VOCAB_DB_NAME = 'leksihjelp-vocab';
const VOCAB_DB_VERSION = 2;

function openVocabDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VOCAB_DB_NAME, VOCAB_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('languages')) {
        db.createObjectStore('languages', { keyPath: 'language' });
      }
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getVocabRecord(lang) {
  const db = await openVocabDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('languages', 'readonly');
    const req = tx.objectStore('languages').get(lang);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function listVocabLanguages() {
  const db = await openVocabDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('languages', 'readonly');
    const req = tx.objectStore('languages').getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result || []).map(r => ({
        language: r.language,
        version: r.version,
        totalWords: r.data?._metadata?.totalWords || 0,
        cachedAt: r.cachedAt
      })));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ── TTS fetch (routes through service worker to avoid content script CORS) ──
async function handleTtsFetch(url, headers, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return { error: true, status: res.status, errorBody };
    }

    // Backend now returns JSON with audioBase64 + wordTimings
    const data = await res.json();
    return { error: false, audioBase64: data.audioBase64, wordTimings: data.wordTimings };
  } catch (err) {
    return { error: true, status: 0, errorBody: err.message };
  }
}

// ── Vipps login (runs in service worker to survive popup close) ──
let vippsLoginInProgress = false;
async function handleVippsLogin() {
  if (vippsLoginInProgress) {
    return { success: false, error: 'Login already in progress' };
  }
  vippsLoginInProgress = true;
  try {
    const redirectUrl = chrome.identity.getRedirectURL('vipps');
    const authUrl = `${BACKEND_URL}/api/auth/vipps-login?source=extension&redirect_uri=${encodeURIComponent(redirectUrl)}`;

    const responseUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Login timed out')), 120_000);
      chrome.identity.launchWebAuthFlow(
        { url: authUrl, interactive: true },
        (callbackUrl) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(callbackUrl);
          }
        }
      );
    });

    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error') || url.searchParams.get('login_error');

    if (error) throw new Error(`Vipps error: ${error}`);
    if (!code) throw new Error('No code received');

    // Exchange code for session token
    const res = await fetch(`${BACKEND_URL}/api/auth/exchange-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Lexi-Client': 'lexi-extension'
      },
      body: JSON.stringify({ code })
    });

    if (!res.ok) throw new Error(`Exchange failed: ${res.status}`);

    const data = await res.json();
    const user = data.user || {};
    const isActive = user.subscriptionStatus === 'active';

    await chrome.storage.local.set({
      sessionToken: data.token,
      userName: user.name || '',
      userEmail: user.email || '',
      subscriptionStatus: user.subscriptionStatus || 'none',
      quotaBalance: user.quotaBalance ?? 10000,
      quotaMaxBalance: user.quotaMaxBalance || 20000,
      isAuthenticated: isActive
    });

    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    vippsLoginInProgress = false;
  }
}

// ── Session refresh (Vipps login) ──
async function refreshSession() {
  try {
    const result = await chrome.storage.local.get('sessionToken');
    if (!result.sessionToken) return;

    const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${result.sessionToken}`,
        'X-Lexi-Client': 'lexi-extension'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const isActive = data.user.subscriptionStatus === 'active';
      chrome.storage.local.set({
        userName: data.user.name,
        userEmail: data.user.email,
        subscriptionStatus: data.user.subscriptionStatus,
        quotaBalance: data.user.quotaBalance ?? 0,
        quotaMaxBalance: data.user.quotaMaxBalance || 20000,
        isAuthenticated: isActive
      });
    } else if (res.status === 401) {
      // Token expired — clear session
      chrome.storage.local.set({
        sessionToken: null,
        isAuthenticated: false,
        subscriptionStatus: null
      });
    }
  } catch {
    // Offline — keep cached session data
  }
}

// Refresh session on service worker startup
refreshSession();

// Initialize i18n for service worker
initI18n();

// ── Plan 23-04: startup revision check + manual refresh ──
// Fire-and-forget; checkForUpdates internally handles its own 30s timeout
// and offline-tolerant error paths. Emits 'lexi:updates-available' when any
// cached language has a stale revision; popup picks that up.
function runStartupVocabCheck() {
  try {
    const updater = self.__lexiVocabUpdater;
    if (updater && typeof updater.checkForUpdates === 'function') {
      updater.checkForUpdates().catch((e) => {
        console.warn('Leksihjelp: startup checkForUpdates failed', e && e.message);
      });
    }
  } catch (e) {
    console.warn('Leksihjelp: startup vocab check threw', e && e.message);
  }
}
chrome.runtime.onStartup.addListener(runStartupVocabCheck);
// Also run once on this service-worker boot — onStartup only fires when the
// browser starts, but the worker may also wake from idle. Idempotent.
runStartupVocabCheck();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Plan 23-04: popup polls "do we have updates?" on open.
  if (msg && msg.type === 'lexi:check-updates-now') {
    const updater = self.__lexiVocabUpdater;
    if (updater && typeof updater.checkForUpdates === 'function') {
      updater.checkForUpdates()
        .then(result => sendResponse({ ok: true, result }))
        .catch(err => sendResponse({ ok: false, error: err && err.message }));
      return true; // async sendResponse
    }
    sendResponse({ ok: false, error: 'updater unavailable' });
    return false;
  }

  // Plan 23-04: popup "Oppdater ordlister nå" button → refresh listed langs.
  if (msg && msg.type === 'lexi:refresh-now') {
    const updater = self.__lexiVocabUpdater;
    if (updater && typeof updater.refreshAll === 'function') {
      updater.refreshAll(msg.langs || [])
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err && err.message }));
      return true; // async sendResponse
    }
    sendResponse({ ok: false, error: 'updater unavailable' });
    return false;
  }
});
