/**
 * Leksihjelp — Background Service Worker
 *
 * Handles:
 * - Context menu for dictionary lookup + TTS
 * - Message routing between popup and content scripts
 * - Extension install/setup
 */

const BACKEND_URL = 'https://leksihjelp.vercel.app';

// ── Install / Update ──
chrome.runtime.onInstalled.addListener((details) => {
  // Set defaults
  chrome.storage.local.get(['language'], (result) => {
    if (!result.language) {
      chrome.storage.local.set({
        language: 'es',
        predictionEnabled: true,
        isAuthenticated: false
      });
    }
  });

  // Create context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lexi-lookup',
      title: 'Slå opp "%s" i Leksihjelp',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'lexi-tts',
      title: 'Les opp "%s" med Leksihjelp',
      contexts: ['selection']
    });
  });
});

// ── Context Menu Click ──
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === 'lexi-lookup') {
    // Open popup with the word — since we can't programmatically open popup,
    // store the word and open a small window, or send to content script
    chrome.storage.local.set({ pendingLookup: info.selectionText });
    // Open the popup by simulating action click is not possible in MV3,
    // so we'll send a message to the content script to show an inline result
    chrome.tabs.sendMessage(tab.id, {
      type: 'LOOKUP_WORD',
      word: info.selectionText
    });
  }

  if (info.menuItemId === 'lexi-tts') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'PLAY_TTS',
      text: info.selectionText
    });
  }
});

// ── Keyboard shortcut commands ──
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'lookup-selection') {
    // Get selected text and trigger lookup
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_LOOKUP' }).catch(() => {});
  }

  if (command === 'read-selection') {
    // Get selected text and trigger TTS
    chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_TTS' }).catch(() => {});
  }

  if (command === 'toggle-pause') {
    // Toggle pause state
    chrome.storage.local.get('lexiPaused', (result) => {
      const newState = !result.lexiPaused;
      chrome.storage.local.set({ lexiPaused: newState });
      // Broadcast to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(t => {
          if (t.id) {
            chrome.tabs.sendMessage(t.id, { type: 'LEXI_PAUSED', paused: newState }).catch(() => {});
          }
        });
      });
    });
  }
});

// ── Message routing ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Relay settings changes to all content scripts
  if (msg.type === 'LANGUAGE_CHANGED' || msg.type === 'PREDICTION_TOGGLED' || msg.type === 'AUTH_CHANGED' || msg.type === 'LEXI_PAUSED') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
        }
      });
    });
  }

  // Verify access code
  if (msg.type === 'VERIFY_CODE') {
    verifyCode(msg.code).then(sendResponse);
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
