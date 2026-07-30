// UUID generator
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Safe notification helper — never throws
function notify(title, message) {
  try {
    chrome.notifications.create('linkhive-' + Date.now(), {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: title,
      message: message
    });
  } catch (e) {
    console.error('[LinkHive] Notification failed:', e);
  }
}

// --- Event Listeners ---

chrome.commands.onCommand.addListener((command) => {
  console.log('[LinkHive] Command received:', command);
  if (command === 'quick-save') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[LinkHive] Active tab:', tabs[0]?.url);
      if (tabs[0]) processQuickSave(tabs[0]);
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[LinkHive] Message received:', msg.type);
  
  if (msg.type === 'GET_SHORTCUT') {
    chrome.commands.getAll((commands) => {
      const quickSaveCmd = commands.find(c => c.name === 'quick-save');
      sendResponse({ shortcut: quickSaveCmd && quickSaveCmd.shortcut ? quickSaveCmd.shortcut : null });
    });
    return true; // async response
  }
  
  if (msg.type === 'QUICK_SAVE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      console.log('[LinkHive] QUICK_SAVE active tab:', tabs[0]?.url);
      if (tabs[0]) processQuickSave(tabs[0]);
    });
  }
});

// --- Storage Helpers ---

function getStorageData(key, defaultVal) {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([key], (localRes) => {
        if (chrome.runtime.lastError) {
          console.warn('[LinkHive] Local storage read error:', chrome.runtime.lastError.message);
          resolve(defaultVal);
          return;
        }
        if (localRes[key] !== undefined) {
          resolve(localRes[key]);
        } else {
          // Try sync as fallback
          chrome.storage.sync.get([key], (syncRes) => {
            if (chrome.runtime.lastError) {
              resolve(defaultVal);
              return;
            }
            resolve(syncRes[key] !== undefined ? syncRes[key] : defaultVal);
          });
        }
      });
    } catch (e) {
      console.error('[LinkHive] getStorageData error:', e);
      resolve(defaultVal);
    }
  });
}

function setStorageData(key, val) {
  const data = { [key]: val };
  return new Promise(resolve => {
    try {
      // Always save to local first (reliable, no quota issues)
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.warn('[LinkHive] Local storage write error:', chrome.runtime.lastError.message);
        }
        // Try sync as best-effort backup
        try {
          chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
              console.warn('[LinkHive] Sync storage write failed (quota?):', chrome.runtime.lastError.message);
              // Remove from sync to avoid stale data
              chrome.storage.sync.remove(key, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
              });
            }
          });
        } catch (e) {
          // Sync is optional, ignore errors
        }
        resolve();
      });
    } catch (e) {
      console.error('[LinkHive] setStorageData error:', e);
      resolve();
    }
  });
}

// --- Quick Save Logic ---

async function processQuickSave(tab) {
  console.log('[LinkHive] processQuickSave called for:', tab?.url);
  
  try {
    // Check if the tab is a valid saveable page
    if (!tab || !tab.url) {
      console.log('[LinkHive] No tab or URL');
      notify('LinkHive', 'Cannot quick save — no active page.');
      return;
    }
    
    const url = tab.url;
    if (url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('brave://') || url.startsWith('chrome-extension://')) {
      if (url === 'chrome://newtab/' || url === 'edge://newtab/' || url === 'brave://newtab/') {
        chrome.tabs.sendMessage(tab.id, { type: 'QUICK_SAVE_TRIGGERED' }).catch(() => {});
      } else {
        notify('LinkHive', 'Cannot quick save internal browser pages.');
      }
      return;
    }

    console.log('[LinkHive] Reading storage...');
    const settings = await getStorageData('settings', {});
    const allTabs = await getStorageData('tabs', []) || [];
    let allCards = await getStorageData('cards', []) || [];
    const allBookmarks = await getStorageData('bookmarks', []) || [];
    
    console.log('[LinkHive] Storage loaded — tabs:', allTabs.length, 'cards:', allCards.length, 'bookmarks:', allBookmarks.length);

    // Determine target tab based on quickSaveDest setting
    let targetTabId = null;
    const dest = settings.quickSaveDest || 'Current Page';
    console.log('[LinkHive] Quick save dest:', dest, 'activeTab:', settings.activeTab);
    
    if (dest === 'Current Page') {
      targetTabId = settings.activeTab;
    } else if (dest === 'Home') {
      const homeTab = allTabs.find(t => t && t.name && t.name.toLowerCase() === 'home');
      if (homeTab) targetTabId = homeTab.id;
    } else {
      // dest is a specific tab ID
      const matchedTab = allTabs.find(t => t && t.id === dest);
      if (matchedTab) targetTabId = matchedTab.id;
    }
    
    // Fallback: if no target tab found, use first tab
    if (!targetTabId && allTabs.length > 0) {
      targetTabId = allTabs[0].id;
      console.log('[LinkHive] Using fallback tab:', targetTabId);
    }
    
    if (!targetTabId) {
      console.log('[LinkHive] No target tab found');
      notify('LinkHive Error', 'No tabs available. Open the new tab page first!');
      try { chrome.tabs.sendMessage(tab.id, { type: 'QUICK_SAVE_ERROR', message: 'No tabs available. Open the new tab page first!' }); } catch(e) {}
      return;
    }
    
    // Find or auto-create a "Quick Save" card in the target tab
    let quickSaveCard = allCards.find(c => c && c.tabId === targetTabId && c.name === 'Quick Save');
    
    if (!quickSaveCard) {
      console.log('[LinkHive] Creating Quick Save card in tab:', targetTabId);
      quickSaveCard = {
        id: 'card-qs-' + uuid(),
        tabId: targetTabId,
        name: 'Quick Save',
        colIndex: 0,
        order: allCards.filter(c => c && c.tabId === targetTabId).length
      };
      allCards.push(quickSaveCard);
      await setStorageData('cards', allCards);
    }
    
    // Check if this URL is already saved
    const alreadySaved = allBookmarks.find(b => b && b.url === tab.url);
    if (alreadySaved) {
      console.log('[LinkHive] URL already saved');
      const destTab = allTabs.find(t => t && t.id === targetTabId);
      const destName = destTab ? destTab.name : 'Quick Save';
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'QUICK_SAVE_ALREADY_SAVED', title: tab.title, destName: destName });
      } catch(e) {
        notify('Already Saved', `${tab.title || tab.url} is already in LinkHive`);
      }
      return;
    }

    // Get proper page title and description via scripting
    let pageTitle = tab.title || tab.url;
    let pageDesc = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const title = document.title || '';
          const metaDesc = document.querySelector('meta[name="description"]')?.content || 
                           document.querySelector('meta[property="og:description"]')?.content || '';
          return { title, desc: metaDesc };
        }
      });
      if (results && results[0] && results[0].result) {
        if (results[0].result.title) pageTitle = results[0].result.title;
        if (results[0].result.desc) pageDesc = results[0].result.desc;
      }
    } catch (e) {
      console.log('[LinkHive] Scripting failed, using tab.title:', e.message);
    }

    // Create and save the bookmark
    const newBookmark = {
      id: 'link-' + uuid(),
      cardId: quickSaveCard.id,
      title: pageTitle,
      url: tab.url,
      desc: pageDesc,
      icon: tab.favIconUrl || ''
    };
    
    allBookmarks.push(newBookmark);
    await setStorageData('bookmarks', allBookmarks);
    console.log('[LinkHive] Bookmark saved:', pageTitle);
    
    // Show success notification
    const destTab = allTabs.find(t => t && t.id === targetTabId);
    const destName = destTab ? destTab.name : 'Quick Save';
    
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'QUICK_SAVE_SUCCESS', title: pageTitle, destName: destName });
    } catch(e) {
      notify('Saved to LinkHive', `${pageTitle} → ${destName}/Quick Save`);
    }
  } catch (err) {
    console.error('[LinkHive] processQuickSave error:', err);
    notify('LinkHive Error', err.message || 'Unknown error occurred');
  }
}
