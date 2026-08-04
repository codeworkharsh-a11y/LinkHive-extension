// Default Data
const DEFAULT_TABS = [{ id: 'tab-home', name: 'Home' }];
const DEFAULT_CARDS = [
  { id: 'card-work', tabId: 'tab-home', name: 'Work' },
  { id: 'card-social', tabId: 'tab-home', name: 'Social' },
  { id: 'card-dev', tabId: 'tab-home', name: 'Dev' },
  { id: 'card-ent', tabId: 'tab-home', name: 'Entertainment' }
];
const DEFAULT_BOOKMARKS = [
  { id: '1', title: 'Google', url: 'https://google.com', cardId: 'card-work', description: 'Search the world\'s information, including webpages, images, videos and more.' },
  { id: '2', title: 'YouTube', url: 'https://youtube.com', cardId: 'card-ent', description: 'Enjoy the videos and music you love.' }
];

const DEFAULT_TODOS = [
  { id: 't1', text: 'Review Project Proposal', completed: true },
  { id: 't2', text: 'Client Meeting Notes', completed: true },
  { id: 't3', text: 'Prepare Presentation Slides', completed: false },
  { id: 't4', text: 'Update Weekly Report', completed: false },
];

const DEFAULT_SETTINGS = {
  blur: '21',
  neonHex: '#2f9844',
  neonRgb: '47 152 68',
  wallpaper: 'silk-wave',
  weatherCity: 'San Francisco',
  showWeather: true,
  showTodo: true,
  showCalendar: true,
  activeTab: 'tab-home',
  tabStyle: 'capsule',
  compactMode: false,
  groupTools: false,
  hideExtraBookmarks: false,
  shortenTitles: false,
  openNewTab: true,
  showDescriptions: true,
  quickSaveDest: 'Home',
  quickSaveShortcut: 'Alt+Shift+S',
  weatherWidgetPos: { colIndex: 0, order: -2 },
  todoWidgetPos: { colIndex: 0, order: -1 },
  calendarWidgetPos: { colIndex: 1, order: -2 }
};

const WALLPAPERS = [
  'silk-wave',           // Animated silk background (default)
  '#0b1121',
  'linear-gradient(to right bottom, #0f172a, #312e81)',
  'linear-gradient(to right bottom, #171717, #7f1d1d)',
  'linear-gradient(to right bottom, #064e3b, #020617)',
  "url('Wallpapers/silk_dark.png')",
  "url('Wallpapers/10000.jpg')",
  "url('Wallpapers/10091.jpg')",
  "url('Wallpapers/10129.jpg')",
  "url('Wallpapers/10148.jpg')",
  "url('Wallpapers/10172.jpg')",
  "url('Wallpapers/10180.jpg')",
  "url('Wallpapers/10188.jpg')",
  "url('Wallpapers/10189.jpg')",
  "url('Wallpapers/10212.jpg')",
  "url('Wallpapers/10238.jpg')",
  "url('Wallpapers/10263.jpg')",
  "url('Wallpapers/10301.jpg')",
  "url('Wallpapers/10303.jpg')",
  "url('Wallpapers/10304.jpg')",
  "url('Wallpapers/10409.jpg')",
  "url('Wallpapers/10416.jpg')",
  "url('Wallpapers/wallpaperflare.com_wallpaper (1).jpg')"
];

// State
let state = {
  tabs: [],
  cards: [],
  bookmarks: [],
  todos: [],
  settings: {},
  notepads: [],
  lastModified: 0,
  domainLastModified: {
    bookmarks: 0,
    todos: 0,
    notes: 0,
    cards: 0,
    tabs: 0,
    settings: 0
  }
};

// Queue to track dirty domains for granular cloud sync
const pendingCloudSyncDomains = new Set();


// Global widget references for JS Masonry
let g_weatherWidget = null;
let g_todoWidget = null;
let g_calendarWidget = null;
let expandedCards = new Set();
let resizeTimer = null;

let g_placeholder = document.createElement('div');
g_placeholder.className = 'bg-glass-bg !backdrop-blur-[var(--glass-blur)] border border-glass-border transition-[transform,box-shadow,border-color,backdrop-filter] duration-200 ease-in hover:border-glass-border-hover hover:shadow-glass-hover border-2 border-dashed border-slate-500/50 bg-slate-800/30 rounded-xl mb-6';

window.addEventListener('DOMContentLoaded', () => {
  g_weatherWidget = document.getElementById('weather-widget-container');
  g_todoWidget = document.getElementById('todo-widget-container');
  g_calendarWidget = document.getElementById('calendar-widget-container');

  [g_weatherWidget, g_todoWidget, g_calendarWidget].forEach(widget => {
    if (widget) {
      widget.addEventListener('dragstart', () => {
        g_placeholder.style.height = `${widget.offsetHeight}px`;
        setTimeout(() => {
          widget.classList.add('hidden');
          widget.parentNode.insertBefore(g_placeholder, widget.nextSibling);
        }, 0);
      });
      widget.addEventListener('dragend', async () => {
        widget.classList.remove('hidden');
        if (g_placeholder.parentNode) {
          g_placeholder.parentNode.insertBefore(widget, g_placeholder);
          g_placeholder.parentNode.removeChild(g_placeholder);
        }
        await saveDragDropOrder();
      });
    }
  });

  // Tab scroll buttons logic
  const navLeftBtn = document.getElementById('nav-scroll-left');
  const navRightBtn = document.getElementById('nav-scroll-right');
  const navContainer = document.getElementById('nav-container');
  if (navLeftBtn && navRightBtn && navContainer) {
    navLeftBtn.addEventListener('click', () => navContainer.scrollBy({ left: -200, behavior: 'smooth' }));
    navRightBtn.addEventListener('click', () => navContainer.scrollBy({ left: 200, behavior: 'smooth' }));
    navContainer.addEventListener('scroll', updateNavScrollVisibility);
  }

  // Settings Tab Switching logic
  const tabBtnAccount = document.getElementById('tab-btn-account');
  const tabBtnGeneral = document.getElementById('tab-btn-general');
  const tabBtnWallpapers = document.getElementById('tab-btn-wallpapers');
  const tabBtnWidgets = document.getElementById('tab-btn-widgets');

  const tabAccount = document.getElementById('settings-tab-account');
  const tabGeneral = document.getElementById('settings-tab-general');
  const tabWallpapers = document.getElementById('settings-tab-wallpapers');
  const tabWidgets = document.getElementById('settings-tab-widgets');
  const settingsTitle = document.getElementById('settings-header-title');

  if (tabBtnGeneral && tabBtnWallpapers && tabBtnWidgets && tabBtnAccount) {
    const setTabActive = (btn) => {
      btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-slate-800/50', 'border-transparent');
      btn.classList.add('bg-neon-green/10', 'text-neon-green', 'border-neon-green/20');
    };
    const setTabInactive = (btn) => {
      btn.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-slate-800/50', 'border-transparent');
      btn.classList.remove('bg-neon-green/10', 'text-neon-green', 'border-neon-green/20');
    };
    const hideAllTabs = () => {
      tabAccount.classList.add('hidden');
      tabGeneral.classList.add('hidden');
      tabWallpapers.classList.add('hidden');
      tabWidgets.classList.add('hidden');
      setTabInactive(tabBtnAccount);
      setTabInactive(tabBtnGeneral);
      setTabInactive(tabBtnWallpapers);
      setTabInactive(tabBtnWidgets);
    };

    tabBtnAccount.addEventListener('click', () => {
      hideAllTabs();
      setTabActive(tabBtnAccount);
      tabAccount.classList.remove('hidden');
      if (settingsTitle) settingsTitle.textContent = 'Account & Sync';
    });

    tabBtnGeneral.addEventListener('click', () => {
      hideAllTabs();
      setTabActive(tabBtnGeneral);
      tabGeneral.classList.remove('hidden');
      if (settingsTitle) settingsTitle.textContent = 'General Settings';
    });

    tabBtnWallpapers.addEventListener('click', () => {
      hideAllTabs();
      setTabActive(tabBtnWallpapers);
      tabWallpapers.classList.remove('hidden');
      if (settingsTitle) settingsTitle.textContent = 'Wallpaper Selection';
    });

    tabBtnWidgets.addEventListener('click', () => {
      hideAllTabs();
      setTabActive(tabBtnWidgets);
      tabWidgets.classList.remove('hidden');
      if (settingsTitle) settingsTitle.textContent = 'Widgets';
    });
  }


});

window.addEventListener('resize', () => {
  updateNavScrollVisibility();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (document.getElementById('dashboard-grid')) {
      renderBookmarks(document.getElementById('search-input').value);
    }
  }, 200);
});

// Storage Utilities
async function getStorageData(key, defaultVal) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : defaultVal;
  }

  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (res) => {
      if (chrome.runtime.lastError || res[key] === undefined) {
        chrome.storage.local.get([key], (localRes) => {
          resolve(localRes[key] !== undefined ? localRes[key] : defaultVal);
        });
      } else {
        resolve(res[key]);
      }
    });
  });
}

async function setStorageData(key, val) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    localStorage.setItem(key, JSON.stringify(val));
    return;
  }

  const data = { [key]: val };
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        console.warn(`Sync failed for ${key}, falling back to local storage. Error: ${chrome.runtime.lastError.message}`);
        chrome.storage.sync.remove(key, () => {
          chrome.storage.local.set(data, resolve);
        });
      } else {
        chrome.storage.local.set(data, resolve);
      }
    });
  });
}

async function setMultipleStorageData(dataObj) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    for (const key in dataObj) {
      localStorage.setItem(key, JSON.stringify(dataObj[key]));
    }
    return;
  }

  return new Promise((resolve) => {
    chrome.storage.sync.set(dataObj, () => {
      if (chrome.runtime.lastError) {
        console.warn(`Sync failed for multiple keys, falling back to local storage. Error: ${chrome.runtime.lastError.message}`);
        const keys = Object.keys(dataObj);
        chrome.storage.sync.remove(keys, () => {
          chrome.storage.local.set(dataObj, resolve);
        });
      } else {
        chrome.storage.local.set(dataObj, resolve);
      }
    });
  });
}

async function getLocalData(key, defaultVal) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    const local = localStorage.getItem(key);
    return local ? JSON.parse(local) : defaultVal;
  }
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (res) => {
      resolve(res[key] !== undefined ? res[key] : defaultVal);
    });
  });
}

async function setLocalData(key, val) {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    localStorage.setItem(key, JSON.stringify(val));
    return;
  }
  const data = { [key]: val };
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

async function loadLocalData() {
  // 1. Load Local Data First (0ms instant paint from disk)
  state.tabs = await getStorageData('tabs', null);
  state.cards = await getStorageData('cards', null);
  state.todos = await getStorageData('todos', DEFAULT_TODOS);
  const storedSettings = await getStorageData('settings', null);
  state.settings = { ...DEFAULT_SETTINGS, ...(storedSettings || {}) };

  let localNotepads = await getLocalData('notepads', null);
  if (!localNotepads) {
    localNotepads = await getStorageData('notepads', null);
    if (localNotepads) {
      await setLocalData('notepads', localNotepads);
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.remove('notepads');
      }
    }
  }
  state.notepads = localNotepads;
  state.weatherCache = await getLocalData('weatherCache', null);

  // Load domain timestamps (or fallback to legacy lastModified)
  state.lastModified = await getStorageData('lastModified', 0);
  const storedDomainTimestamps = await getStorageData('domainLastModified', null);
  state.domainLastModified = {
    bookmarks: storedDomainTimestamps?.bookmarks || state.lastModified || 0,
    todos: storedDomainTimestamps?.todos || state.lastModified || 0,
    notes: storedDomainTimestamps?.notes || state.lastModified || 0,
    cards: storedDomainTimestamps?.cards || state.lastModified || 0,
    tabs: storedDomainTimestamps?.tabs || state.lastModified || 0,
    settings: storedDomainTimestamps?.settings || state.lastModified || 0
  };

  // 2. Perform any needed migrations on the local data
  if (!state.notepads) {
    state.notepads = [];
    if (state.notepadText !== undefined || state.settings.showNotepad !== undefined) {
      state.notepads.push({
        id: 'notepad-' + uuid(),
        name: 'Notepad',
        text: state.notepadText || '',
        show: state.settings.showNotepad ?? true,
        tabId: 'tab-home',
        pos: state.settings.notepadPos || { colIndex: 0, order: -3 }
      });
      delete state.notepadText;
      delete state.settings.showNotepad;
      delete state.settings.notepadPos;
    }
  } else {
    // Ensure all notepads have a tabId
    state.notepads.forEach(n => {
      if (!n.tabId) n.tabId = 'tab-home';
    });
  }

  if (!state.tabs) {
    const oldCategories = await getStorageData('categories', null);
    const homeTabId = 'tab-home';
    state.tabs = [{ id: homeTabId, name: 'Home' }];

    if (oldCategories && oldCategories.length > 0) {
      state.cards = oldCategories.map(c => ({ id: uuid(), name: c, tabId: homeTabId }));
    } else {
      state.cards = DEFAULT_CARDS;
    }

    let oldBookmarks = await getStorageData('bookmarks', DEFAULT_BOOKMARKS);
    state.bookmarks = oldBookmarks.map(bm => {
      const card = state.cards.find(c => c.name === bm.category) || state.cards[0];
      return { id: bm.id, title: bm.title, url: bm.url, cardId: card ? card.id : null };
    }).filter(bm => bm.cardId !== null);

    if (state.settings.activeCategory) {
      state.settings.activeTab = homeTabId;
      delete state.settings.activeCategory;
    }
  } else {
    state.bookmarks = await getStorageData('bookmarks', DEFAULT_BOOKMARKS);
  }

  let customWall = null;
  let customWallType = null;
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const res = await new Promise(resolve => chrome.storage.local.get(['customWallpaper', 'customWallpaperType', 'customWallpapers'], resolve));
    customWall = res.customWallpaper;
    customWallType = res.customWallpaperType;
    state.settings.customWallpapers = res.customWallpapers || [];
  } else {
    customWall = localStorage.getItem('customWallpaper');
    customWallType = localStorage.getItem('customWallpaperType');
    try {
      state.settings.customWallpapers = JSON.parse(localStorage.getItem('customWallpapers') || '[]');
    } catch (e) {
      state.settings.customWallpapers = [];
    }
  }
  if (customWall) {
    state.settings.customWallpaper = customWall;
    state.settings.customWallpaperType = customWallType || 'image';
    state.settings.wallpaper = state.settings.customWallpaperType === 'video' ? 'transparent' : `url(${customWall})`;
  }
}

// Background Cloud Synchronization (non-blocking, checks Supabase and silently merges newer changes)
async function syncCloudData(triggerUIRefresh = true, forcePull = false) {
  if (typeof getCurrentUser !== 'function') return false;

  try {
    const loggedInUser = await getCurrentUser();
    if (!loggedInUser || typeof fetchModularUserData !== 'function') return false;

    let cloudModularData = await fetchModularUserData(loggedInUser.id);
    let cloudLegacyData = null;

    if ((!cloudModularData || !cloudModularData.hasAnyData) && typeof fetchLegacyUserData === 'function') {
      cloudLegacyData = await fetchLegacyUserData(loggedInUser.id);
    }

    let hasChanges = false;

    // Granular Modular Merge from Cloud
    if (cloudModularData && cloudModularData.hasAnyData) {
      const { data: cData, timestamps: cTimestamps } = cloudModularData;

      // Merge Bookmarks
      if (cData.bookmarks && (forcePull || (cTimestamps.bookmarks || 0) >= (state.domainLastModified.bookmarks || 0))) {
        state.bookmarks = cData.bookmarks;
        state.domainLastModified.bookmarks = cTimestamps.bookmarks;
        hasChanges = true;
      }
      // Merge Todos
      if (cData.todos && (forcePull || (cTimestamps.todos || 0) >= (state.domainLastModified.todos || 0))) {
        state.todos = cData.todos;
        state.domainLastModified.todos = cTimestamps.todos;
        hasChanges = true;
      }
      // Merge Notes
      if (cData.notes && (forcePull || (cTimestamps.notes || 0) >= (state.domainLastModified.notes || 0))) {
        state.notepads = cData.notes;
        state.domainLastModified.notes = cTimestamps.notes;
        hasChanges = true;
      }
      // Merge Cards
      if (cData.cards && (forcePull || (cTimestamps.cards || 0) >= (state.domainLastModified.cards || 0))) {
        state.cards = cData.cards;
        state.domainLastModified.cards = cTimestamps.cards;
        hasChanges = true;
      }
      // Merge Tabs
      if (cData.tabs && (forcePull || (cTimestamps.tabs || 0) >= (state.domainLastModified.tabs || 0))) {
        state.tabs = cData.tabs;
        state.domainLastModified.tabs = cTimestamps.tabs;
        hasChanges = true;
      }
      // Merge Settings
      if (cData.settings && (forcePull || (cTimestamps.settings || 0) >= (state.domainLastModified.settings || 0))) {
        state.settings = { ...state.settings, ...cData.settings };
        state.domainLastModified.settings = cTimestamps.settings;
        hasChanges = true;
      }

      if (hasChanges) {
        const { customWallpaper, customWallpaperType, customWallpapers, ...syncSettings } = state.settings;
        await setMultipleStorageData({
          lastModified: state.lastModified,
          domainLastModified: state.domainLastModified,
          tabs: state.tabs,
          cards: state.cards,
          bookmarks: state.bookmarks,
          todos: state.todos,
          settings: syncSettings
        });
        await setLocalData('notepads', state.notepads);
        console.log('[LinkHive Sync] Merged newer cloud data into local storage.');

        if (triggerUIRefresh) {
          applyTheme(false);
          renderNav();
          renderBookmarks(document.getElementById('search-input')?.value || '');
          renderTodos();
          syncUI();
        }
      }
    } else if (cloudLegacyData) {
      const cloudLastModified = cloudLegacyData.lastModified || 0;
      if (cloudLastModified >= (state.lastModified || 0)) {
        if (cloudLegacyData.tabs) state.tabs = cloudLegacyData.tabs;
        if (cloudLegacyData.cards) state.cards = cloudLegacyData.cards;
        if (cloudLegacyData.todos) state.todos = cloudLegacyData.todos;
        if (cloudLegacyData.notepads) state.notepads = cloudLegacyData.notepads;
        if (cloudLegacyData.bookmarks) state.bookmarks = cloudLegacyData.bookmarks;
        state.lastModified = cloudLastModified;
        Object.keys(state.domainLastModified).forEach(k => {
          state.domainLastModified[k] = cloudLastModified;
        });

        const { customWallpaper, customWallpaperType, customWallpapers, ...syncSettings } = state.settings;
        await setMultipleStorageData({
          lastModified: state.lastModified,
          domainLastModified: state.domainLastModified,
          tabs: state.tabs,
          cards: state.cards,
          bookmarks: state.bookmarks,
          todos: state.todos,
          settings: syncSettings
        });
        await setLocalData('notepads', state.notepads);

        console.log('[LinkHive Sync] Auto-migrating legacy snapshot to modular tables...');
        ['bookmarks', 'todos', 'notes', 'cards', 'tabs', 'settings'].forEach(d => pendingCloudSyncDomains.add(d));
        debouncedSupabaseSync();

        if (triggerUIRefresh) {
          applyTheme(false);
          renderNav();
          renderBookmarks(document.getElementById('search-input')?.value || '');
          renderTodos();
          syncUI();
        }
      }
    }
    return hasChanges;
  } catch (e) {
    console.error('[LinkHive Sync] Background cloud sync error:', e);
    return false;
  }
}

async function loadData(waitForCloud = false, forcePull = false) {
  await loadLocalData();
  if (waitForCloud) {
    await syncCloudData(false, forcePull);
  } else {
    syncCloudData(true, forcePull).catch(e => console.error('[LinkHive Sync] Background sync error:', e));
  }
}

async function saveData(scopes) {
  const now = Date.now();
  state.lastModified = now;

  // Normalize target domain scopes
  const ALL_DOMAINS = ['bookmarks', 'todos', 'notes', 'cards', 'tabs', 'settings'];
  let targetDomains = ALL_DOMAINS;

  if (typeof scopes === 'string') {
    targetDomains = [scopes === 'notepads' ? 'notes' : scopes];
  } else if (Array.isArray(scopes) && scopes.length > 0) {
    targetDomains = scopes.map(s => s === 'notepads' ? 'notes' : s);
  }

  // Update domain timestamps and mark domain dirty for cloud sync
  targetDomains.forEach(domain => {
    if (state.domainLastModified[domain] !== undefined) {
      state.domainLastModified[domain] = now;
    }
    pendingCloudSyncDomains.add(domain);
  });

  const { customWallpaper, customWallpaperType, customWallpapers, ...syncSettings } = state.settings;

  await setMultipleStorageData({
    lastModified: state.lastModified,
    domainLastModified: state.domainLastModified,
    tabs: state.tabs,
    cards: state.cards,
    bookmarks: state.bookmarks,
    todos: state.todos,
    settings: syncSettings
  });

  await setLocalData('notepads', state.notepads);
  await setLocalData('weatherCache', state.weatherCache);

  const toSaveLocal = { customWallpapers: customWallpapers || [] };
  if (customWallpaper) {
    toSaveLocal.customWallpaper = customWallpaper;
    toSaveLocal.customWallpaperType = customWallpaperType || 'image';
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise(resolve => chrome.storage.local.set(toSaveLocal, resolve));
    } else {
      localStorage.setItem('customWallpaper', customWallpaper);
      localStorage.setItem('customWallpaperType', customWallpaperType || 'image');
      localStorage.setItem('customWallpapers', JSON.stringify(customWallpapers || []));
    }
  } else {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await new Promise(resolve => chrome.storage.local.set(toSaveLocal, () => {
        chrome.storage.local.remove(['customWallpaper', 'customWallpaperType'], resolve);
      }));
    } else {
      localStorage.removeItem('customWallpaper');
      localStorage.removeItem('customWallpaperType');
      localStorage.setItem('customWallpapers', JSON.stringify(customWallpapers || []));
    }
  }

  // Push dirty domains to Supabase with debounce
  debouncedSupabaseSync();
}

let supabaseSyncTimeout = null;
function debouncedSupabaseSync(immediate = false) {
  if (supabaseSyncTimeout) clearTimeout(supabaseSyncTimeout);

  const executeSync = async () => {
    if (typeof getCurrentUser !== 'function' || pendingCloudSyncDomains.size === 0) return;

    try {
      const user = await getCurrentUser();
      if (!user) return;

      const domainsToSync = Array.from(pendingCloudSyncDomains);
      const { customWallpaper, customWallpaperType, customWallpapers, ...syncSettings } = state.settings;

      const domainDataMap = {
        bookmarks: { table: SYNC_TABLES.BOOKMARKS, data: state.bookmarks },
        todos: { table: SYNC_TABLES.TODOS, data: state.todos },
        notes: { table: SYNC_TABLES.NOTES, data: state.notepads },
        cards: { table: SYNC_TABLES.CARDS, data: state.cards },
        tabs: { table: SYNC_TABLES.TABS, data: state.tabs },
        settings: { table: SYNC_TABLES.SETTINGS, data: syncSettings }
      };

      const syncTasks = domainsToSync.map(async (domain) => {
        const item = domainDataMap[domain];
        if (!item) return { domain, success: true };

        const timestamp = state.domainLastModified[domain] || state.lastModified || Date.now();
        const res = await upsertModularData(user.id, item.table, item.data, timestamp);

        const bytes = JSON.stringify(item.data).length;
        return { domain, table: item.table, bytes, success: res?.success, error: res?.error };
      });

      const results = await Promise.allSettled(syncTasks);
      let totalBytesSynced = 0;
      const syncedTables = [];

      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          const { domain, table, bytes, success } = res.value;
          if (success) {
            pendingCloudSyncDomains.delete(domain);
            totalBytesSynced += bytes || 0;
            if (table) syncedTables.push(`${table} (${((bytes || 0) / 1024).toFixed(2)} KB)`);
          }
        }
      });

      if (syncedTables.length > 0) {
        console.log(`[LinkHive Sync] Granular sync completed: [${syncedTables.join(', ')}] — Total: ${(totalBytesSynced / 1024).toFixed(2)} KB`);
      }
    } catch (e) {
      console.error('[LinkHive Sync] Cloud sync exception:', e);
    }
  };

  if (immediate) {
    executeSync();
  } else {
    supabaseSyncTimeout = setTimeout(executeSync, 1500); // 1.5 seconds debounce
  }
}

// Generates a random ID
function uuid() {
  return Math.random().toString(36).substring(2, 11);
}

// --- Smart Title Cleaner ---
// Strips page-specific text to derive a short, clean site name.
function smartTitle(rawTitle, url) {
  let title = rawTitle || '';
  // Step 1: Split on separators like " - ", " | ", " — " and keep site name (usually first)
  title = title.split(/\s[\-\|—–·•]\s/)[0].trim();
  // Step 2: If still too long (> 32 chars) or empty, derive from hostname
  if (title.length > 32 || !title) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      let parts = hostname.split('.');
      if (parts.length > 1) parts.pop(); // remove TLD
      const domainName = parts.join(' ');
      // Capitalize words
      title = domainName.split(/[\s\-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } catch (e) { /* keep existing title */ }
  }
  return title || url;
}

// --- UI Rendering ---

function applyTheme(autoUpdateColor = false) {
  const blurVal = Number(state.settings.blur) || 0;
  document.documentElement.style.setProperty('--glass-blur-val', blurVal);
  document.documentElement.style.setProperty('--glass-blur', `${blurVal}px`);

  // Opacity is now handled by CSS calc() using --glass-blur-val to support theme-light overriding

  const neonHex = state.settings.neonHex || DEFAULT_SETTINGS.neonHex || '#2f9844';
  const neonRgb = state.settings.neonRgb || DEFAULT_SETTINGS.neonRgb || '47 152 68';
  document.documentElement.style.setProperty('--neon-hex', neonHex);
  document.documentElement.style.setProperty('--neon-rgb', neonRgb);

  const bgBlurOverlay = document.getElementById('bg-blur-overlay');
  if (bgBlurOverlay) {
    bgBlurOverlay.style.backdropFilter = `blur(${state.settings.bgBlur || 0}px)`;
  }

  const bgVideo = document.getElementById('bg-video');
  if (state.settings.customWallpaperType === 'video' && state.settings.customWallpaper) {
    stopSilkWave();
    if (bgVideo && bgVideo.src !== state.settings.customWallpaper) {
      bgVideo.src = state.settings.customWallpaper;
    }
    if (bgVideo && bgVideo.classList) bgVideo.classList.remove('hidden');
    document.documentElement.style.setProperty('--bg-wallpaper', '#0b1121');
    analyzeBackgroundBrightness(state.settings.customWallpaper, true, autoUpdateColor);
  } else if (state.settings.wallpaper === 'silk-wave') {
    // Animated silk wave canvas background
    if (bgVideo && bgVideo.classList) { bgVideo.classList.add('hidden'); bgVideo.src = ''; }
    document.documentElement.style.setProperty('--bg-wallpaper', '#050e07');
    startSilkWave();
    if (document.body && document.body.classList) document.body.classList.remove('theme-light');
    currentBgSrc = null;
    // Silk-wave default accent: #2f9844 (rich forest green, feels premium not neon)
    if (autoUpdateColor) _applyAccentColor('#2f9844');
  } else {
    stopSilkWave();
    if (bgVideo && bgVideo.classList) {
      bgVideo.classList.add('hidden');
      bgVideo.src = '';
    }
    let finalBg = state.settings.wallpaper;
    if (finalBg && finalBg.startsWith('url') && finalBg.includes('Wallpapers/')) {
      finalBg = finalBg.replace("')", `?v=${Date.now()}')`);
    }
    document.documentElement.style.setProperty('--bg-wallpaper', finalBg);

    if (state.settings.customWallpaper) {
      analyzeBackgroundBrightness(state.settings.customWallpaper, false, autoUpdateColor);
    } else if (state.settings.wallpaper && state.settings.wallpaper.startsWith('url')) {
      const srcMatch = state.settings.wallpaper.match(/url\(['"]?(.*?)['"]?\)/);
      if (srcMatch && srcMatch[1]) {
        analyzeBackgroundBrightness(srcMatch[1], false, autoUpdateColor);
      } else {
        if (document.body && document.body.classList) document.body.classList.remove('theme-light');
        currentBgSrc = null;
      }
    } else {
      // Solid color or CSS gradient — use curated luxe accents keyed to the palette
      if (autoUpdateColor) {
        const w = state.settings.wallpaper || '';
        if (w.includes('312e81') || w.includes('0f172a')) {
          // Deep indigo/midnight → soft periwinkle lavender
          setLuxeAccent(245, false);
        } else if (w.includes('7f1d1d') || w.includes('171717')) {
          // Dark crimson/charcoal → muted rose gold
          setLuxeAccent(345, false);
        } else if (w.includes('064e3b') || w.includes('020617')) {
          // Dark forest/deep space → soft teal-jade
          setLuxeAccent(160, false);
        } else {
          // Pure dark (#0b1121 and similar) → cool steel blue
          setLuxeAccent(215, false);
        }
      }
      if (document.body && document.body.classList) document.body.classList.remove('theme-light');
      currentBgSrc = null;
    }
  }
}

// ── Welcome Modal Helpers (module-scope so any function can call them) ──────
function showWelcomeModal() {
  const modal = document.getElementById('cloud-sync-modal');
  const card = document.getElementById('welcome-card');
  const rightTools = document.getElementById('right-tools-container');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  void modal.offsetWidth;
  modal.classList.remove('opacity-0');
  if (card) setTimeout(() => card.classList.add('modal-visible'), 20);
  if (rightTools) rightTools.style.display = 'none';
}

function hideWelcomeModal() {
  const modal = document.getElementById('cloud-sync-modal');
  const card = document.getElementById('welcome-card');
  const rightTools = document.getElementById('right-tools-container');
  if (!modal) return;
  modal.classList.add('opacity-0');
  if (card) card.classList.remove('modal-visible');
  setTimeout(() => {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    if (rightTools) rightTools.style.display = '';
  }, 300);
}
// ────────────────────────────────────────────────────────────────────────────

// ── Silk Wave Canvas Engine (newtab background) ───────────────────────────────
let _silkAnimId = null;
let _silkCtx = null;
let _silkT = 0;

const SILK_WAVES = Array.from({ length: 7 }, (_, i) => ({
  amp: 55 + i * 18,
  freq: 0.0014 + i * 0.0004,
  speed: 0.00035 + i * 0.00012,
  phase: (Math.PI * 2 * i) / 7,
  yBase: 0.3 + (i / 7) * 0.6,
  thickness: 1.2 + i * 0.6,
  hue: 140 + i * 6,
  lightness: 5 + i * 2.5,
  alpha: 0.55 - i * 0.05,
}));

function _silkDraw() {
  const canvas = document.getElementById('bg-silk-canvas');
  if (!canvas) return;
  const ctx = _silkCtx || (canvas.getContext('2d'));
  if (!_silkCtx) _silkCtx = ctx;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#030d05');
  bg.addColorStop(1, '#060f08');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  for (let wi = SILK_WAVES.length - 1; wi >= 0; wi--) {
    const w = SILK_WAVES[wi];
    const yMid = H * w.yBase;

    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 3) {
      const y = yMid
        + Math.sin(x * w.freq + _silkT * w.speed + w.phase) * w.amp
        + Math.sin(x * w.freq * 1.7 + _silkT * w.speed * 0.6 + w.phase * 1.3) * (w.amp * 0.45)
        + Math.cos(x * w.freq * 0.5 + _silkT * w.speed * 1.4 + w.phase * 0.7) * (w.amp * 0.25);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, yMid - w.amp, 0, yMid + w.amp + H * 0.1);
    grad.addColorStop(0, `hsla(${w.hue},55%,${w.lightness + 5}%,${w.alpha})`);
    grad.addColorStop(0.5, `hsla(${w.hue},60%,${w.lightness}%,${w.alpha * 0.7})`);
    grad.addColorStop(1, `hsla(${w.hue},45%,${w.lightness - 2}%,0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // Silk sheen ridge
    ctx.beginPath();
    for (let x = 0; x <= W; x += 3) {
      const y = yMid
        + Math.sin(x * w.freq + _silkT * w.speed + w.phase) * w.amp
        + Math.sin(x * w.freq * 1.7 + _silkT * w.speed * 0.6 + w.phase * 1.3) * (w.amp * 0.45)
        + Math.cos(x * w.freq * 0.5 + _silkT * w.speed * 1.4 + w.phase * 0.7) * (w.amp * 0.25);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsla(${w.hue + 20},70%,${w.lightness + 18}%,${w.alpha * 0.35})`;
    ctx.lineWidth = w.thickness;
    ctx.stroke();
  }

  // Top vignette
  const vig = ctx.createLinearGradient(0, 0, 0, H * 0.35);
  vig.addColorStop(0, 'rgba(3,13,5,0.7)');
  vig.addColorStop(1, 'rgba(3,13,5,0)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  _silkT++;
  _silkAnimId = requestAnimationFrame(_silkDraw);
}

function startSilkWave() {
  const canvas = document.getElementById('bg-silk-canvas');
  if (!canvas) return;
  // Size canvas
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  if (!_silkAnimId) _silkDraw();
  // Handle resize
  if (!startSilkWave._resizeListener) {
    startSilkWave._resizeListener = () => {
      if (_silkAnimId) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        _silkCtx = canvas.getContext('2d');
      }
    };
    window.addEventListener('resize', startSilkWave._resizeListener);
  }
}

function stopSilkWave() {
  if (_silkAnimId) { cancelAnimationFrame(_silkAnimId); _silkAnimId = null; }
  const canvas = document.getElementById('bg-silk-canvas');
  if (canvas) canvas.style.display = 'none';
}
// ─────────────────────────────────────────────────────────────────────────────

async function syncAccountUI() {
  if (typeof getCurrentUser !== 'function') return;
  const user = await getCurrentUser();
  const btn = document.getElementById('btn-account-action');
  const email = document.getElementById('account-email');
  const status = document.getElementById('account-status');
  const avatar = document.getElementById('account-avatar');

  if (!btn || !email) return;

  if (user) {
    email.textContent = user.email || 'Logged In';
    status.textContent = 'Cloud sync active';
    status.className = 'text-neon-green text-xs mt-0.5 font-semibold';
    btn.textContent = 'Log Out';
    btn.className = 'px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20';
    btn.onclick = async () => {
      if (confirm('Are you sure you want to log out? This will completely reset the extension to its default state on this device (your cloud data remains safe).')) {
        await signOut();
        
        // Wipe all local storage
        localStorage.clear();
        if (typeof chrome !== 'undefined' && chrome.storage) {
          await new Promise(resolve => chrome.storage.local.clear(resolve));
          await new Promise(resolve => chrome.storage.sync.clear(resolve));
        }
        
        // Reload to fresh state
        window.location.reload();
      }
    };
    if (user.user_metadata && user.user_metadata.avatar_url) {
      avatar.innerHTML = `<img src="${user.user_metadata.avatar_url}" class="w-full h-full object-cover">`;
      avatar.classList.remove('bg-slate-700');
    }
  } else {
    email.textContent = 'Not logged in';
    status.textContent = 'Local storage only';
    status.className = 'text-slate-500 text-xs mt-0.5';
    btn.textContent = 'Log In';
    btn.className = 'px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors';
    btn.onclick = () => {
      document.getElementById('close-sidebar').click(); // close settings sidebar first
      setTimeout(() => showWelcomeModal(), 150); // slight delay so sidebar closes cleanly
    };
    avatar.innerHTML = `<span class="material-symbols-outlined">person</span>`;
    avatar.classList.add('bg-slate-700');
  }
}

function syncUI() {
  document.getElementById('blur-slider').value = state.settings.blur;
  const bgBlurSlider = document.getElementById('bg-blur-slider');
  if (bgBlurSlider) bgBlurSlider.value = state.settings.bgBlur || 0;
  
  document.getElementById('color-picker').value = state.settings.neonHex;
  document.getElementById('color-hex').textContent = state.settings.neonHex;

  document.getElementById('toggle-weather').checked = state.settings.showWeather;
  document.getElementById('toggle-todo').checked = state.settings.showTodo;
  document.getElementById('toggle-calendar').checked = state.settings.showCalendar !== false;
  document.getElementById('weather-city').value = state.settings.weatherCity || '';

  // New General Settings
  document.getElementById('toggle-compact-mode').checked = state.settings.compactMode;
  document.getElementById('toggle-group-tools').checked = state.settings.groupTools;
  document.getElementById('toggle-hide-extra').checked = state.settings.hideExtraBookmarks;
  document.getElementById('toggle-shorten-titles').checked = state.settings.shortenTitles;
  document.getElementById('toggle-open-new-tab').checked = state.settings.openNewTab;
  document.getElementById('toggle-show-descriptions').checked = state.settings.showDescriptions;
  document.getElementById('toggle-privacy-hide').checked = !!state.settings.privacyHide;

  // Tab Style UI Sync
  const isRoundedTab = state.settings.tabStyle === 'rounded';
  const capsuleBtn = document.getElementById('tab-style-capsule');
  const roundedBtn = document.getElementById('tab-style-rounded');
  if (capsuleBtn && roundedBtn) {
    if (isRoundedTab) {
      roundedBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-white bg-slate-700/80 shadow-sm flex items-center gap-1.5';
      capsuleBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-400 hover:text-slate-200 flex items-center gap-1.5';
    } else {
      capsuleBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-white bg-slate-700/80 shadow-sm flex items-center gap-1.5';
      roundedBtn.className = 'px-3 py-1.5 text-xs font-medium rounded-lg transition-all text-slate-400 hover:text-slate-200 flex items-center gap-1.5';
    }
  }
  
  // Dynamically populate quick save destination dropdown with all tabs
  const quickSaveSelect = document.getElementById('select-quick-save-dest');
  quickSaveSelect.innerHTML = '';
  // Add "Current Page" option
  const currentPageOpt = document.createElement('option');
  currentPageOpt.value = 'Current Page';
  currentPageOpt.textContent = 'Current Page';
  quickSaveSelect.appendChild(currentPageOpt);
  // Add each tab as an option (using tab ID as value)
  state.tabs.forEach(tab => {
    const opt = document.createElement('option');
    opt.value = tab.id;
    opt.textContent = tab.name;
    quickSaveSelect.appendChild(opt);
  });
  // Set selected value
  quickSaveSelect.value = state.settings.quickSaveDest || 'Current Page';
  
  function refreshShortcutDisplay() {
    if (typeof chrome !== 'undefined' && chrome.commands) {
      chrome.commands.getAll((commands) => {
        const quickSaveCmd = commands.find(c => c.name === 'quick-save');
        if (quickSaveCmd && quickSaveCmd.shortcut) {
          document.getElementById('quick-save-shortcut-display').textContent = quickSaveCmd.shortcut;
        } else {
          document.getElementById('quick-save-shortcut-display').textContent = 'Not set';
        }
      });
    } else {
      document.getElementById('quick-save-shortcut-display').textContent = 'Not set';
    }
  }
  
  refreshShortcutDisplay();
  window.addEventListener('focus', refreshShortcutDisplay);

  if (g_weatherWidget) {
    if (state.settings.showWeather) g_weatherWidget.classList.remove('hidden');
    else g_weatherWidget.classList.add('hidden');
  }

  if (g_todoWidget) {
    if (state.settings.showTodo) g_todoWidget.classList.remove('hidden');
    else g_todoWidget.classList.add('hidden');
  }

  renderWallpapers();
  renderNotepadSettings();
  if (typeof updateGroupToolsMenu === 'function') updateGroupToolsMenu();
}

function renderNotepadSettings() {
  const list = document.getElementById('notepad-settings-list');
  if (!list) return;
  list.innerHTML = '';

  if (!state.notepads || state.notepads.length === 0) {
    list.innerHTML = `
      <div class="text-center py-6 px-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-900/30">
        <span class="material-symbols-outlined text-slate-500 text-3xl mb-1">note_stack</span>
        <p class="text-xs text-slate-400 font-medium">No notepads created yet</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Click "+ Add Notepad" above to create one on any tab.</p>
      </div>
    `;
    return;
  }

  state.notepads.forEach((notepad) => {
    if (!notepad.tabId) {
      notepad.tabId = state.tabs[0]?.id || 'tab-home';
    }

    const currentTab = state.tabs.find(t => t.id === notepad.tabId) || state.tabs[0];
    const tabName = currentTab ? currentTab.name : 'Home';

    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-900/60 hover:bg-slate-900/90 border border-slate-700/50 hover:border-slate-600/80 rounded-xl px-3.5 py-3 transition-all duration-200 group';

    item.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1 pr-3">
        <label class="relative inline-block w-[38px] h-[22px] shrink-0">
          <input type="checkbox" class="opacity-0 w-0 h-0 peer np-toggle" ${notepad.show ? 'checked' : ''}>
          <span class="absolute cursor-pointer inset-0 bg-slate-700 border border-slate-500 peer-checked:border-neon-green transition-all duration-300 rounded-full before:absolute before:content-[''] before:h-[16px] before:w-[16px] before:left-[2px] before:bottom-[2px] before:bg-white before:transition-all before:duration-300 before:rounded-full before:shadow-[0_2px_4px_rgba(0,0,0,0.2)] peer-checked:bg-neon-green peer-focus:shadow-[0_0_1px_var(--neon-hex)] peer-checked:before:translate-x-[16px]"></span>
        </label>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5 group/name cursor-pointer np-name-wrap">
            <span class="text-sm font-semibold text-slate-200 truncate group-hover/name:text-neon-green transition-colors np-name" title="Click to rename">${notepad.name}</span>
            <span class="material-symbols-outlined text-[13px] text-slate-500 group-hover/name:text-neon-green opacity-0 group-hover/name:opacity-100 transition-all">edit</span>
          </div>
          <span class="text-[11px] text-slate-400 mt-0.5 truncate np-tab-badge">Visible on <span class="text-slate-300 font-medium np-tab-name">${tabName}</span></span>
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <div class="relative flex items-center">
          <span class="material-symbols-outlined text-[15px] text-slate-400 absolute left-2.5 pointer-events-none">folder_open</span>
          <select class="np-tab-select bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 hover:border-slate-500 focus:border-neon-green text-xs font-medium text-slate-200 pl-8 pr-8 py-1.5 rounded-lg outline-none cursor-pointer transition-all focus:ring-1 focus:ring-neon-green/30">
          </select>
          <span class="material-symbols-outlined text-[16px] text-slate-400 absolute right-2 pointer-events-none">expand_more</span>
        </div>

        <div class="flex items-center gap-0.5">
          <button class="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors np-rename" title="Rename Notepad">
            <span class="material-symbols-outlined text-[17px]">edit</span>
          </button>
          <button class="text-slate-400 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors np-delete" title="Delete Notepad">
            <span class="material-symbols-outlined text-[17px]">delete</span>
          </button>
        </div>
      </div>
    `;

    // Populate Tab options
    const tabSelect = item.querySelector('.np-tab-select');
    const tabBadge = item.querySelector('.np-tab-name');
    state.tabs.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      opt.className = 'bg-slate-900 text-slate-200';
      tabSelect.appendChild(opt);
    });
    tabSelect.value = notepad.tabId;

    tabSelect.addEventListener('change', async (e) => {
      notepad.tabId = e.target.value;
      const matched = state.tabs.find(t => t.id === notepad.tabId);
      if (tabBadge && matched) tabBadge.textContent = matched.name;
      await saveData('notes');
      renderBookmarks(document.getElementById('search-input').value);
    });

    // Toggle
    item.querySelector('.np-toggle').addEventListener('change', async (e) => {
      notepad.show = e.target.checked;
      await saveData('notes');
      renderBookmarks(document.getElementById('search-input').value);
    });

    // Rename (clicking name or edit icon)
    const handleRename = async () => {
      const newName = prompt('Enter new name for notepad:', notepad.name);
      if (newName && newName.trim()) {
        notepad.name = newName.trim();
        await saveData('notes');
        renderNotepadSettings();
        renderBookmarks(document.getElementById('search-input').value);
      }
    };
    item.querySelector('.np-name-wrap').addEventListener('click', handleRename);
    item.querySelector('.np-rename').addEventListener('click', handleRename);

    // Delete
    item.querySelector('.np-delete').addEventListener('click', async () => {
      if (confirm(`Delete notepad "${notepad.name}"? This action cannot be undone.`)) {
        state.notepads = state.notepads.filter(n => n.id !== notepad.id);
        await saveData('notes');
        renderNotepadSettings();
        renderBookmarks(document.getElementById('search-input').value);
      }
    });

    list.appendChild(item);
  });
}

function updateNavScrollVisibility() {
  const container = document.getElementById('nav-container');
  const leftBtn = document.getElementById('nav-scroll-left');
  const rightBtn = document.getElementById('nav-scroll-right');

  if (!container || !leftBtn || !rightBtn) return;

  const isScrollable = container.scrollWidth > container.clientWidth;

  if (isScrollable) {
    const isAtStart = container.scrollLeft <= 1;
    const isAtEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;

    leftBtn.classList.toggle('hidden', isAtStart);
    rightBtn.classList.toggle('hidden', isAtEnd);
  } else {
    leftBtn.classList.add('hidden');
    rightBtn.classList.add('hidden');
  }
}

function renderNav() {
  const container = document.getElementById('nav-container');
  container.innerHTML = '';

  const isRounded = state.settings.tabStyle === 'rounded';
  const radiusClass = isRounded ? 'rounded-xl' : 'rounded-full';

  // Update left/right scroll button radius
  const leftBtn = document.getElementById('nav-scroll-left');
  const rightBtn = document.getElementById('nav-scroll-right');
  if (leftBtn && rightBtn) {
    leftBtn.classList.remove('rounded-full', 'rounded-xl');
    rightBtn.classList.remove('rounded-full', 'rounded-xl');
    leftBtn.classList.add(radiusClass);
    rightBtn.classList.add(radiusClass);
  }

  state.tabs.forEach(tab => {
    const wrap = document.createElement('div');
    wrap.className = 'relative flex-shrink-0';

    const isActive = state.settings.activeTab === tab.id;

    // Main tab button
    const btn = document.createElement('button');
    btn.className = `px-5 py-2 ${radiusClass} text-sm font-semibold transition-all duration-300 cursor-pointer flex items-center justify-center border outline-none whitespace-nowrap min-w-[60px]`;

    if (isActive) {
      btn.style.backgroundColor = 'var(--neon-hex)';
      btn.style.color = '#ffffff';
      btn.style.borderColor = 'transparent';
      btn.style.boxShadow = '0 0 14px rgba(var(--neon-rgb), 0.55)';
    } else {
      btn.style.backgroundColor = 'rgba(30,41,59,0.6)';
      btn.style.color = '#94a3b8';
      btn.style.borderColor = 'rgba(51,65,85,0.6)';
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = tab.name;
    nameSpan.className = 'truncate max-w-[160px]';
    btn.appendChild(nameSpan);

    const arrowWrap = document.createElement('div');
    arrowWrap.className = 'flex items-center justify-center transition-all duration-300 overflow-hidden';

    const isHome = tab.id === 'tab-home';

    if (isActive && !isHome) {
      arrowWrap.style.maxWidth = '20px';
      arrowWrap.style.marginLeft = '4px';
      arrowWrap.style.opacity = '1';
    } else {
      arrowWrap.style.maxWidth = '0px';
      arrowWrap.style.marginLeft = '0px';
      arrowWrap.style.opacity = '0';
    }

    const arrow = document.createElement('span');
    arrow.className = 'material-symbols-outlined text-[18px] flex-shrink-0 cursor-pointer rounded-full leading-none';
    arrow.textContent = 'arrow_drop_down';
    arrow.style.opacity = isActive ? '0.75' : '1';
    if (!isHome) arrowWrap.appendChild(arrow);
    btn.appendChild(arrowWrap);

    btn.onmouseenter = () => {
      if (!isActive) {
        btn.style.backgroundColor = 'rgba(51,65,85,0.7)';
        btn.style.color = '#e2e8f0';
        if (!isHome) {
          arrowWrap.style.maxWidth = '20px';
          arrowWrap.style.marginLeft = '4px';
          arrowWrap.style.opacity = '0.6';
        }
      }
    };
    btn.onmouseleave = () => {
      if (!isActive) {
        btn.style.backgroundColor = 'rgba(30,41,59,0.6)';
        btn.style.color = '#94a3b8';
        if (!isHome) {
          arrowWrap.style.maxWidth = '0px';
          arrowWrap.style.marginLeft = '0px';
          arrowWrap.style.opacity = '0';
        }
      }
    };

    // Click tab body → switch tab
    btn.onclick = async (e) => {
      if (e.target === arrowWrap || arrowWrap.contains(e.target)) return;
      if (state.settings.activeTab !== tab.id) {
        state.settings.activeTab = tab.id;
        await saveData('settings');
        renderNav();
        renderBookmarks();
      }
    };

    // Click arrow → open dropdown menu
    if (!isHome) {
      arrowWrap.onclick = (e) => {
        e.stopPropagation();

        const existingMenu = document.querySelector('.tab-ctx-menu');
        const wasOpenForThisTab = existingMenu && existingMenu.dataset.tabId === tab.id;

        document.querySelectorAll('.tab-ctx-menu').forEach(m => m.remove());

        if (wasOpenForThisTab) return;

        const menu = document.createElement('div');
        menu.dataset.tabId = tab.id;
        menu.className = 'tab-ctx-menu absolute w-44 rounded-xl shadow-2xl z-[200] overflow-hidden py-1';
        menu.style.cssText = 'background:#1e293b; border:1px solid rgba(255,255,255,0.08);';
        const rect = wrap.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
        let leftPos = rect.left + window.scrollX;
        if (leftPos + 176 > window.innerWidth) leftPos = window.innerWidth - 180;
        menu.style.left = `${leftPos}px`;

        const mkItem = (icon, label, color, cb) => {
          const item = document.createElement('div');
          item.className = 'px-4 py-2.5 text-sm flex items-center gap-3 cursor-pointer';
          item.style.color = color;
          item.onmouseenter = () => item.style.background = 'rgba(255,255,255,0.06)';
          item.onmouseleave = () => item.style.background = '';
          item.innerHTML = `<span class="material-symbols-outlined text-[16px]">${icon}</span><span>${label}</span>`;
          item.onclick = cb;
          return item;
        };

        menu.appendChild(mkItem('edit', 'Rename', '#e2e8f0', async () => {
          menu.remove();
          
          const modal = document.createElement('div');
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';
          
          modal.innerHTML = `
            <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
              <div class="p-6 flex flex-col" style="gap: 20px;">
                <h3 class="text-xl font-bold custom-modal-title">Rename Tab</h3>
                
                <div class="flex flex-col" style="gap: 8px;">
                  <label class="text-sm font-semibold custom-modal-label">Tab Name *</label>
                  <input type="text" id="edit-tab-name" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input" value="${tab.name}">
                </div>
                
                <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
                  <button id="edit-tab-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
                  <button id="edit-tab-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Save</button>
                </div>
              </div>
            </div>
          `;
          
          document.body.appendChild(modal);
          
          const nameInput = modal.querySelector('#edit-tab-name');
          const cancelBtn = modal.querySelector('#edit-tab-cancel');
          const saveBtn = modal.querySelector('#edit-tab-save');
          
          nameInput.focus();
          
          cancelBtn.onclick = () => modal.remove();
          
          const saveChanges = async () => {
            const newName = nameInput.value.trim();
            if (!newName) {
              nameInput.style.borderColor = '#ef4444';
              return;
            }
            if (newName !== tab.name) {
              tab.name = newName;
              await saveData('tabs');
              renderNav();
            }
            modal.remove();
          };
          
          saveBtn.onclick = saveChanges;
          nameInput.onkeydown = (ev) => {
            if (ev.key === 'Enter') saveChanges();
            if (ev.key === 'Escape') modal.remove();
          };
          nameInput.oninput = () => nameInput.style.borderColor = 'rgba(255,255,255,0.1)';
        }));

        if (state.tabs.length > 1) {
          const sep = document.createElement('div');
          sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.08);margin:2px 0;';
          menu.appendChild(sep);
          menu.appendChild(mkItem('delete', 'Delete', '#f87171', async () => {
            menu.remove();
            if (confirm(`Delete tab '${tab.name}' and all its cards/links?`)) {
              state.tabs = state.tabs.filter(t => t.id !== tab.id);
              state.cards = state.cards.filter(c => c.tabId !== tab.id);
              const ids = new Set(state.cards.map(c => c.id));
              state.bookmarks = state.bookmarks.filter(b => ids.has(b.cardId));
              const fallbackTabId = state.tabs[0]?.id || 'tab-home';
              state.notepads.forEach(n => {
                if (n.tabId === tab.id) {
                  n.tabId = fallbackTabId;
                }
              });
              if (state.settings.activeTab === tab.id) state.settings.activeTab = fallbackTabId;
              await saveData(['tabs', 'cards', 'bookmarks', 'settings', 'notes']);
              renderNav();
              renderBookmarks();
              renderNotepadSettings();
            }
          }));
        }

        document.body.appendChild(menu);
        setTimeout(() => {
          document.addEventListener('click', function close() {
            menu.remove(); document.removeEventListener('click', close);
          });
        }, 0);
      };
    }

    wrap.appendChild(btn);
    container.appendChild(wrap);
  });

  // "+" add tab button — same height and radius as tabs
  const addBtn = document.createElement('button');
  addBtn.className = `px-3 py-2 ${radiusClass} flex-shrink-0 flex items-center justify-center cursor-pointer border outline-none transition-all duration-200`;
  addBtn.style.cssText = 'background:rgba(30,41,59,0.6); color:#94a3b8; border-color:rgba(51,65,85,0.6);';
  addBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">add</span>';
  addBtn.onmouseenter = () => { addBtn.style.color = 'var(--neon-hex)'; addBtn.style.borderColor = 'var(--neon-hex)'; addBtn.style.background = 'rgba(30,41,59,0.8)'; };
  addBtn.onmouseleave = () => { addBtn.style.color = '#94a3b8'; addBtn.style.borderColor = 'rgba(51,65,85,0.6)'; addBtn.style.background = 'rgba(30,41,59,0.6)'; };
  addBtn.onclick = (e) => {
    e.preventDefault();

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';

    modal.innerHTML = `
      <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
        <div class="p-6 flex flex-col" style="gap: 20px;">
          <h3 class="text-xl font-bold custom-modal-title">Add New Tab</h3>
          
          <div class="flex flex-col" style="gap: 8px;">
            <label class="text-sm font-semibold custom-modal-label">Tab Name *</label>
            <input type="text" id="add-page-name" placeholder="Enter tab name..." class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input">
          </div>
          
          <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
            <button id="add-page-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
            <button id="add-page-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Add Tab</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const nameInput = modal.querySelector('#add-page-name');
    const cancelBtn = modal.querySelector('#add-page-cancel');
    const saveBtn = modal.querySelector('#add-page-save');

    nameInput.focus();

    cancelBtn.onclick = () => modal.remove();

    const createPage = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.style.borderColor = '#ef4444';
        return;
      }
      const newTab = { id: uuid(), name: name };
      state.tabs.push(newTab);
      state.settings.activeTab = newTab.id;
      await saveData(['tabs', 'settings']);
      renderNav();
      renderBookmarks();
      renderNotepadSettings();
      modal.remove();
    };

    saveBtn.onclick = createPage;
    nameInput.onkeydown = (ev) => {
      if (ev.key === 'Enter') createPage();
      if (ev.key === 'Escape') modal.remove();
    };
    nameInput.oninput = () => nameInput.style.borderColor = 'rgba(255,255,255,0.1)';
  };
  container.appendChild(addBtn);
  setTimeout(updateNavScrollVisibility, 0);
}

function renderBookmarks(searchQuery = '') {
  const grid = document.getElementById('dashboard-grid');

  if (g_weatherWidget && g_weatherWidget.parentNode) g_weatherWidget.parentNode.removeChild(g_weatherWidget);
  if (g_todoWidget && g_todoWidget.parentNode) g_todoWidget.parentNode.removeChild(g_todoWidget);
  if (g_calendarWidget && g_calendarWidget.parentNode) g_calendarWidget.parentNode.removeChild(g_calendarWidget);

  grid.innerHTML = '';

  let cols = 1;
  if (window.innerWidth >= 1280) cols = 4;
  else if (window.innerWidth >= 1024) cols = 3;
  else if (window.innerWidth >= 768) cols = 2;

  const colDivs = [];
  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'flex flex-col gap-3 flex-1 min-w-[280px] max-w-[400px] drag-col min-h-[300px] pb-32 group/col relative';
    col.dataset.colIndex = i;
    grid.appendChild(col);
    colDivs.push(col);
  }

  const q = searchQuery.toLowerCase();
  const showWidgets = !q && state.settings.activeTab === 'tab-home';
  let renderables = [];

  if (g_weatherWidget) {
    if (state.settings.showWeather && showWidgets) {
      g_weatherWidget.classList.remove('hidden');
      renderables.push({
        el: g_weatherWidget,
        colIndex: state.settings.weatherWidgetPos?.colIndex ?? 0,
        order: state.settings.weatherWidgetPos?.order ?? -2
      });
    } else {
      g_weatherWidget.classList.add('hidden');
    }
  }

  let hasMatchingTodo = false;
  if (q) {
    hasMatchingTodo = state.todos.some(t => t.text.toLowerCase().includes(q));
  }

  if (g_todoWidget) {
    if (state.settings.showTodo && (showWidgets || hasMatchingTodo)) {
      g_todoWidget.classList.remove('hidden');
      renderables.push({
        el: g_todoWidget,
        colIndex: state.settings.todoWidgetPos?.colIndex ?? 0,
        order: state.settings.todoWidgetPos?.order ?? -1
      });
    } else {
      g_todoWidget.classList.add('hidden');
    }
  }

  if (g_calendarWidget) {
    if (state.settings.showCalendar && showWidgets) {
      g_calendarWidget.classList.remove('hidden');
      renderables.push({
        el: g_calendarWidget,
        colIndex: state.settings.calendarWidgetPos?.colIndex ?? 1,
        order: state.settings.calendarWidgetPos?.order ?? -2
      });
    } else {
      g_calendarWidget.classList.add('hidden');
    }
  }

  state.notepads.forEach(notepad => {
    if (notepad.show) {
      const targetTabId = notepad.tabId || state.tabs[0]?.id || 'tab-home';
      if (q) {
        const match = notepad.name.toLowerCase().includes(q) || (notepad.text && notepad.text.toLowerCase().includes(q));
        if (!match) return;
      } else if (state.settings.activeTab !== targetTabId) {
        return; // Only show on its assigned tab when not searching
      }
      const npEl = document.createElement('div');
      npEl.className = 'break-inside-avoid bg-glass-bg !backdrop-blur-[var(--glass-blur)] border border-glass-border rounded-2xl transition-[transform,box-shadow,border-color,backdrop-filter] duration-200 ease-in hover:border-glass-border-hover hover:shadow-glass-hover p-5 mb-3 group/card draggable-card cursor-grab active:cursor-grabbing flex flex-col';
      npEl.dataset.cardId = notepad.id;
      npEl.draggable = true;

      npEl.innerHTML = `
          <div class="flex justify-between items-center mb-4 pb-2 border-b border-card-divider">
            <h2 class="text-sm font-semibold text-slate-300">Notepad: ${notepad.name}</h2>
            <div class="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
              <button class="text-slate-500 hover:text-white p-1.5 hover:bg-white/[0.05] rounded-md transition-colors notepad-copy-btn" title="Copy">
                <span class="material-symbols-outlined text-[18px] leading-none">content_copy</span>
              </button>
              <button class="text-slate-500 hover:text-white p-1.5 hover:bg-white/[0.05] rounded-md transition-colors notepad-paste-btn" title="Paste">
                <span class="material-symbols-outlined text-[18px] leading-none">content_paste</span>
              </button>
              <button class="text-slate-500 hover:text-red-400 p-1.5 hover:bg-white/[0.05] rounded-md transition-colors notepad-clear-btn" title="Clear">
                <span class="material-symbols-outlined text-[18px] leading-none">delete</span>
              </button>
            </div>
          </div>
          <textarea class="notepad-textarea w-full flex-grow bg-transparent border-transparent focus:border-transparent focus:ring-0 outline-none text-slate-300 text-sm resize-none overflow-hidden min-h-[120px]" placeholder="Type your notes here..."></textarea>
        `;

      const textarea = npEl.querySelector('.notepad-textarea');
      textarea.value = notepad.text || '';

      const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };

      textarea.addEventListener('input', async (e) => {
        autoResize();
        notepad.text = e.target.value;
        await saveData('notes');
      });

      // Initial resize
      setTimeout(autoResize, 0);

      const copyBtn = npEl.querySelector('.notepad-copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(textarea.value);
        const icon = copyBtn.querySelector('span');
        icon.textContent = 'check';
        setTimeout(() => icon.textContent = 'content_copy', 1500);
      });

      const pasteBtn = npEl.querySelector('.notepad-paste-btn');
      pasteBtn.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          textarea.value += (textarea.value ? '\n' : '') + text;
          notepad.text = textarea.value;
          await saveData('notes');
        } catch (err) {
          console.error('Failed to read clipboard contents: ', err);
        }
      });

      const clearBtn = npEl.querySelector('.notepad-clear-btn');
      clearBtn.addEventListener('click', async () => {
        textarea.value = '';
        notepad.text = '';
        await saveData('notes');
      });

      npEl.addEventListener('dragstart', () => {
        g_placeholder.style.height = `${npEl.offsetHeight}px`;
        setTimeout(() => {
          npEl.classList.add('hidden');
          npEl.parentNode.insertBefore(g_placeholder, npEl.nextSibling);
        }, 0);
      });

      npEl.addEventListener('dragend', async () => {
        npEl.classList.remove('hidden');
        if (g_placeholder.parentNode) {
          g_placeholder.parentNode.insertBefore(npEl, g_placeholder);
          g_placeholder.parentNode.removeChild(g_placeholder);
        }
        await saveDragDropOrder();
      });

      renderables.push({
        el: npEl,
        colIndex: notepad.pos?.colIndex ?? 0,
        order: notepad.pos?.order ?? -3
      });
    }
  });

  let visibleCards = state.cards;
  if (!q) {
    visibleCards = state.cards.filter(c => c.tabId === state.settings.activeTab);
  }

  let fallbackCol = cols > 1 ? 1 : 0;

  visibleCards.forEach(card => {
    let bms = state.bookmarks.filter(b => b.cardId === card.id);
    if (q) {
      bms = bms.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
    }

    if (bms.length === 0 && q) return;

    const cardEl = document.createElement('div');
    const padding = state.settings.compactMode ? 'p-3' : 'p-5';
    cardEl.className = `break-inside-avoid bg-glass-bg !backdrop-blur-[var(--glass-blur)] border border-glass-border rounded-2xl transition-[transform,box-shadow,border-color,backdrop-filter] duration-200 ease-in hover:border-glass-border-hover hover:shadow-glass-hover ${padding} group/card mb-3 draggable-card min-w-0 w-full`;
    cardEl.draggable = true;
    cardEl.dataset.cardId = card.id;

    cardEl.addEventListener('dragstart', (e) => {
      // Only allow drag from the header area, not from links/buttons/inputs
      const target = e.target;
      if (target.closest('a, button, input, textarea, .add-link-inline-form')) {
        e.preventDefault();
        return;
      }
      g_placeholder.style.height = `${cardEl.offsetHeight}px`;
      setTimeout(() => {
        cardEl.classList.add('hidden');
        cardEl.parentNode.insertBefore(g_placeholder, cardEl.nextSibling);
      }, 0);
    });

    cardEl.addEventListener('dragend', async () => {
      cardEl.classList.remove('hidden');
      if (g_placeholder.parentNode) {
        g_placeholder.parentNode.insertBefore(cardEl, g_placeholder);
        g_placeholder.parentNode.removeChild(g_placeholder);
      }
      await saveDragDropOrder();
    });

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4 pb-2 border-b border-card-divider cursor-grab active:cursor-grabbing';
    header.innerHTML = `
      <h2 class="text-sm font-semibold text-slate-300">${card.name}</h2>
      <div class="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button class="text-slate-500 hover:text-neon-green p-1.5 hover:bg-white/[0.05] rounded-md transition-colors" title="Add Link" id="add-link-btn-${card.id}">
          <span class="material-symbols-outlined text-[20px] leading-none">add_link</span>
        </button>
        <button class="text-slate-500 hover:text-blue-400 p-1.5 hover:bg-white/[0.05] rounded-md transition-colors" title="Rename Card" id="rename-card-btn-${card.id}">
          <span class="material-symbols-outlined text-[20px] leading-none">edit</span>
        </button>
        <button class="text-slate-500 hover:text-red-400 p-1.5 hover:bg-white/[0.05] rounded-md transition-colors" title="Delete Card" id="del-card-btn-${card.id}">
          <span class="material-symbols-outlined text-[20px] leading-none">delete</span>
        </button>
      </div>
    `;

    const renameCardBtn = header.querySelector(`#rename-card-btn-${card.id}`);
    renameCardBtn.onclick = (e) => {
      e.preventDefault();

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';

      modal.innerHTML = `
        <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
          <div class="p-6 flex flex-col" style="gap: 20px;">
            <h3 class="text-xl font-bold custom-modal-title">Edit Card Name</h3>
            
            <div class="flex flex-col" style="gap: 8px;">
              <label class="text-sm font-semibold custom-modal-label">Card Name *</label>
              <input type="text" id="edit-board-name" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input" value="${card.name}">
            </div>
            
            <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
              <button id="edit-board-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
              <button id="edit-board-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Save Changes</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const nameInput = modal.querySelector('#edit-board-name');
      const cancelBtn = modal.querySelector('#edit-board-cancel');
      const saveBtn = modal.querySelector('#edit-board-save');

      nameInput.focus();

      cancelBtn.onclick = () => modal.remove();

      const saveChanges = async () => {
        const newName = nameInput.value.trim();
        if (!newName) {
          nameInput.style.borderColor = '#ef4444';
          return;
        }
        if (newName !== card.name) {
          card.name = newName;
          await saveData('cards');
          renderBookmarks();
        }
        modal.remove();
      };

      saveBtn.onclick = saveChanges;
      nameInput.onkeydown = (ev) => {
        if (ev.key === 'Enter') saveChanges();
        if (ev.key === 'Escape') modal.remove();
      };
      nameInput.oninput = () => nameInput.style.borderColor = 'rgba(255,255,255,0.1)';
    };

    const delCardBtn = header.querySelector(`#del-card-btn-${card.id}`);
    delCardBtn.onclick = async () => {
      if (confirm(`Delete card '${card.name}' and all its links?`)) {
        state.cards = state.cards.filter(c => c.id !== card.id);
        state.bookmarks = state.bookmarks.filter(b => b.cardId !== card.id);
        await saveData(['cards', 'bookmarks']);
        renderBookmarks();
      }
    };

    const addLinkBtn = header.querySelector(`#add-link-btn-${card.id}`);
    addLinkBtn.onclick = () => {
      let existingForm = cardEl.querySelector('.add-link-inline-form');
      if (existingForm) {
        existingForm.remove();
        return;
      }

      const form = document.createElement('div');
      form.className = 'add-link-inline-form flex flex-col gap-3 mt-4 p-3 rounded-xl border border-glass-border';
      form.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';

      form.innerHTML = `
        <input type="text" id="add-link-url-${card.id}" placeholder="https://example.com" class="w-full bg-glass-bg border border-glass-border rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none neon-focus-ring focus:bg-white/[0.08] transition-all">
        
        <div id="add-link-extra-${card.id}" class="hidden flex-col gap-3">
          <input type="text" id="add-link-title-${card.id}" placeholder="Enter a title for this link" class="w-full bg-glass-bg border border-glass-border rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none neon-focus-ring focus:bg-white/[0.08] transition-all">
          <div class="relative">
            <textarea id="add-link-desc-${card.id}" placeholder="Optional description (shown below title)" class="w-full bg-glass-bg border border-glass-border rounded-lg px-3 py-2.5 text-sm text-slate-200 outline-none neon-focus-ring focus:bg-white/[0.08] transition-all resize-none h-20"></textarea>
          </div>
        </div>
        
        <div class="flex items-center gap-3 mt-1 w-full">
          <button id="submit-link-${card.id}" class="font-semibold py-2 rounded-lg hover:brightness-110 transition-all text-sm shadow-md" style="flex: 1.5; background-color: var(--neon-hex, #10b981); color: #0f172a;">Add Link</button>
          <button id="cancel-link-${card.id}" class="font-semibold py-2 rounded-lg transition-all text-sm" style="flex: 1; background-color: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3);">Cancel</button>
        </div>
      `;

      cardEl.appendChild(form);

      const urlInput = form.querySelector(`#add-link-url-${card.id}`);
      const extraDiv = form.querySelector(`#add-link-extra-${card.id}`);
      const titleInput = form.querySelector(`#add-link-title-${card.id}`);
      const descInput = form.querySelector(`#add-link-desc-${card.id}`);
      const submitBtn = form.querySelector(`#submit-link-${card.id}`);
      const cancelBtn = form.querySelector(`#cancel-link-${card.id}`);

      let step = 1;
      urlInput.focus();

      cancelBtn.onclick = () => form.remove();

      submitBtn.onclick = async () => {
        let url = urlInput.value.trim();

        if (step === 1) {
          if (!url) {
            urlInput.classList.add('border-red-500');
            return;
          }
          if (!url.startsWith('http')) url = 'https://' + url;
          urlInput.value = url;

          // Show step 2
          extraDiv.classList.remove('hidden');
          extraDiv.classList.add('flex');
          step = 2;

          titleInput.value = "Fetching title...";
          submitBtn.disabled = true;
          submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

          try {
            const res = await fetch(url, { mode: 'cors' }).catch(() => null);
            if (res && res.ok) {
              const text = await res.text();
              const match = text.match(/<title>([^<]*)<\/title>/i);
              if (match && match[1]) {
                titleInput.value = smartTitle(match[1].trim(), url);
              } else {
                throw new Error('no title');
              }
            } else {
              throw new Error('fetch failed');
            }
          } catch (e) {
            titleInput.value = smartTitle('', url);
          }

          submitBtn.disabled = false;
          submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          titleInput.focus();
          return;
        }

        const title = titleInput.value.trim();
        const desc = descInput.value.trim();

        if (!title) {
          titleInput.classList.add('border-red-500');
          return;
        }

        const bm = {
          id: uuid(),
          title,
          description: desc,
          url,
          cardId: card.id
        };

        state.bookmarks.push(bm);
        await saveData('bookmarks');
        renderBookmarks();
      };

      urlInput.addEventListener('input', () => urlInput.classList.remove('border-red-500'));
      titleInput.addEventListener('input', () => titleInput.classList.remove('border-red-500'));
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitBtn.click();
      });
      titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitBtn.click();
      });
    };

    cardEl.appendChild(header);

    const ul = document.createElement('ul');
    ul.className = 'space-y-1';

    let renderedBms = bms;
    const hideExtra = state.settings.hideExtraBookmarks && !q;
    const maxVisible = 5;
    const isExpanded = expandedCards.has(card.id);

    if (hideExtra && bms.length > maxVisible && !isExpanded) {
      renderedBms = bms.slice(0, maxVisible);
    }

    renderedBms.forEach(bm => {
      const li = document.createElement('li');
      const liPadding = state.settings.compactMode ? 'p-1' : 'p-2';
      li.className = `flex justify-between items-start ${liPadding} transition-[background-color,transform] duration-200 hover:bg-white/5 hover:rounded-lg hover:translate-x-1 group min-w-0 w-full`;

      const a = document.createElement('a');
      a.href = bm.url;
      a.target = state.settings.openNewTab ? '_blank' : '_self';
      a.className = 'flex items-start gap-3 flex-1 min-w-0 cursor-pointer';

      a.onclick = (e) => {
        if (window.isIncognitoMode) {
          e.preventDefault();
          if (typeof chrome !== 'undefined' && chrome.windows) {
            chrome.windows.create({ url: bm.url, incognito: true });
          } else {
            window.open(bm.url, '_blank');
          }
        }
      };

      let hostname = '';
      try { hostname = new URL(bm.url).hostname; } catch (e) { }

      const iconWrapper = document.createElement('div');
      let domainHue = 210;
      if (hostname) {
        let hash = 0;
        for (let i = 0; i < hostname.length; i++) {
          hash = (hostname.charCodeAt(i) + ((hash << 5) - hash)) | 0;
        }
        domainHue = Math.abs(hash) % 360;
      }
      iconWrapper.className = 'favicon-wrapper w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-105 shadow-sm relative overflow-hidden border';
      iconWrapper.style.setProperty('--domain-hue', domainHue);

      const innerGlow = document.createElement('div');
      innerGlow.className = 'favicon-inner-glow absolute inset-0 pointer-events-none transition-opacity duration-300';
      iconWrapper.appendChild(innerGlow);

      const iconImg = document.createElement('img');
      iconImg.className = 'w-5 h-5 rounded flex-shrink-0 object-contain relative z-10 transition-transform duration-300 group-hover:scale-110';
      applySmartFaviconTheme(iconImg);
      if (hostname) {
        if (hostname.includes('gmail.com') || hostname.includes('mail.google.com')) {
          iconImg.src = 'icons/gmail.svg';
        } else {
          iconImg.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
        }
      } else {
        iconImg.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NDk0YTMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCI+PC9jaXJjbGU+PGxpbmUgeDE9IjIiIHkxPSIxMiIgeDI9IjIyIiB5Mj0iMTIiPjwvbGluZT48cGF0aCBkPSJNMTIgMmExNS4zIDE1LjMgMCAwIDEgNCAxMGExNS4zIDE1LjMgMCAwIDEtNCAxMCAxNS4zIDE1LjMgMCAwIDEtNC0xMEExNS4zIDE1LjMgMCAwIDEgMTIgMnoiPjwvcGF0aD48L3N2Zz4=';
      }
      iconImg.setAttribute('alt', '');
      iconWrapper.appendChild(iconImg);

      const textDiv = document.createElement('div');
      textDiv.className = 'flex flex-col min-w-0 w-full';

      const textSpan = document.createElement('span');
      textSpan.className = 'block text-sm text-slate-300 break-all';
      if (state.settings.shortenTitles) {
        textSpan.style.display = '-webkit-box';
        textSpan.style.webkitLineClamp = '2';
        textSpan.style.webkitBoxOrient = 'vertical';
        textSpan.style.overflow = 'hidden';
      }
      textSpan.textContent = bm.title;
      textDiv.appendChild(textSpan);

      if (state.settings.showDescriptions && bm.description) {
        const descSpan = document.createElement('span');
        descSpan.className = 'block text-xs text-slate-500 mt-0.5 break-all';
        if (state.settings.shortenTitles) {
          descSpan.style.display = '-webkit-box';
          descSpan.style.webkitLineClamp = '2';
          descSpan.style.webkitBoxOrient = 'vertical';
          descSpan.style.overflow = 'hidden';
        }
        descSpan.textContent = bm.description;
        textDiv.appendChild(descSpan);
      }

      a.appendChild(iconWrapper);
      a.appendChild(textDiv);

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0';

      const editBtn = document.createElement('button');
      editBtn.className = 'text-slate-500 hover:text-blue-400';
      editBtn.title = 'Rename Link';
      editBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">edit</span>';
      editBtn.onclick = async (e) => {
        e.preventDefault();

        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';

        modal.innerHTML = `
          <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
            <div class="p-6 flex flex-col" style="gap: 20px;">
              <h3 class="text-xl font-bold custom-modal-title">Edit Bookmark</h3>
              
              <div class="flex flex-col" style="gap: 8px;">
                <label class="text-sm font-semibold custom-modal-label">URL *</label>
                <input type="text" id="edit-bm-url" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input" value="${bm.url}">
              </div>
              
              <div class="flex flex-col" style="gap: 8px;">
                <div class="flex justify-between items-center">
                  <label class="text-sm font-semibold custom-modal-label">Title *</label>
                  <button id="edit-bm-fetch" class="text-xs rounded px-2 py-0.5 transition-colors" style="color: var(--neon-hex, #10b981); border: 1px solid var(--neon-hex, #10b981); background-color: transparent;">Fetch Title</button>
                </div>
                <input type="text" id="edit-bm-title" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input" value="${bm.title}">
              </div>
              
              <div class="flex flex-col" style="gap: 8px;">
                <label class="text-sm font-semibold custom-modal-label">Description</label>
                <div class="relative flex flex-col">
                  <textarea id="edit-bm-desc" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all resize-none custom-modal-input" style="height: 96px;">${bm.description || ''}</textarea>
                  <div class="absolute text-xs text-slate-500" style="bottom: 8px; right: 8px;">2000</div>
                </div>
              </div>
              
              <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
                <button id="edit-bm-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
                <button id="edit-bm-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Save Changes</button>
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        const urlInput = modal.querySelector('#edit-bm-url');
        const titleInput = modal.querySelector('#edit-bm-title');
        const descInput = modal.querySelector('#edit-bm-desc');
        const fetchBtn = modal.querySelector('#edit-bm-fetch');
        const cancelBtn = modal.querySelector('#edit-bm-cancel');
        const saveBtn = modal.querySelector('#edit-bm-save');

        urlInput.focus();

        fetchBtn.onclick = async () => {
          let url = urlInput.value.trim();
          if (!url) return;
          if (!url.startsWith('http')) url = 'https://' + url;

          const origText = fetchBtn.textContent;
          fetchBtn.textContent = '...';
          fetchBtn.disabled = true;

          try {
            const res = await fetch(url, { mode: 'cors' }).catch(() => null);
            if (res && res.ok) {
              const text = await res.text();
              const match = text.match(/<title>([^<]*)<\/title>/i);
              if (match && match[1]) {
                titleInput.value = smartTitle(match[1].trim(), url);
              } else throw new Error('no title');
            } else throw new Error('fetch failed');
          } catch (e) {
            titleInput.value = smartTitle('', url);
          }

          fetchBtn.textContent = origText;
          fetchBtn.disabled = false;
        };

        cancelBtn.onclick = () => modal.remove();

        saveBtn.onclick = async () => {
          let url = urlInput.value.trim();
          const title = titleInput.value.trim();
          const desc = descInput.value.trim();

          if (!url || !title) {
            if (!url) urlInput.classList.add('border-red-500');
            if (!title) titleInput.classList.add('border-red-500');
            return;
          }
          if (!url.startsWith('http')) url = 'https://' + url;

          bm.url = url;
          bm.title = title;
          bm.description = desc;

          await saveData('bookmarks');
          renderBookmarks();
          modal.remove();
        };

        urlInput.addEventListener('input', () => urlInput.classList.remove('border-red-500'));
        titleInput.addEventListener('input', () => titleInput.classList.remove('border-red-500'));
      };

      const delBtn = document.createElement('button');
      delBtn.className = 'text-slate-500 hover:text-red-400';
      delBtn.title = 'Delete Link';
      delBtn.innerHTML = '<span class="material-symbols-outlined text-[16px]">close</span>';
      delBtn.onclick = async (e) => {
        e.preventDefault();
        state.bookmarks = state.bookmarks.filter(b => b.id !== bm.id);
        await saveData('bookmarks');
        renderBookmarks(document.getElementById('search-input').value);
      };

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);

      li.appendChild(a);
      li.appendChild(actionsDiv);
      ul.appendChild(li);
    });

    if (hideExtra && bms.length > maxVisible) {
      const moreLi = document.createElement('li');
      moreLi.className = 'text-center pt-2 pb-1 cursor-pointer hover:opacity-80 transition-opacity';

      if (!isExpanded) {
        moreLi.innerHTML = `<button class="text-xs text-slate-500 font-medium bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1 rounded-full transition-colors">+${bms.length - maxVisible} more</button>`;
        moreLi.onclick = () => {
          expandedCards.add(card.id);
          renderBookmarks(document.getElementById('search-input').value);
        };
      } else {
        moreLi.innerHTML = `<button class="text-xs text-slate-500 font-medium bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1 rounded-full transition-colors">Show less</button>`;
        moreLi.onclick = () => {
          expandedCards.delete(card.id);
          renderBookmarks(document.getElementById('search-input').value);
        };
      }

      ul.appendChild(moreLi);
    }

    cardEl.appendChild(ul);

    let targetCol = card.colIndex !== undefined ? card.colIndex : fallbackCol;
    if (targetCol >= cols) targetCol = targetCol % cols;

    renderables.push({
      el: cardEl,
      colIndex: targetCol,
      order: card.order || 0
    });

    if (card.colIndex === undefined) {
      fallbackCol++;
      if (fallbackCol >= cols) fallbackCol = cols > 1 ? 1 : 0;
    }
  });

  for (let i = 0; i < cols; i++) {
    const colItems = renderables.filter(r => r.colIndex === i);
    colItems.sort((a, b) => a.order - b.order);
    colItems.forEach(item => {
      colDivs[i].appendChild(item.el);
    });
  }

  if (!q) {
    colDivs.forEach(col => {
      const addBtn = document.createElement('div');
      const defaultHTML = `
        <div class="text-slate-400 flex flex-col items-center gap-2 pointer-events-none">
          <span class="material-symbols-outlined text-3xl">add_circle</span>
          <span class="text-sm">Add Card</span>
        </div>
      `;
      const defaultClass = "add-card-btn-container mt-4 border-2 border-dotted border-slate-500/50 bg-transparent rounded-2xl p-5 flex items-center justify-center cursor-pointer hover:border-neon-green mb-6 opacity-0 group-hover/col:opacity-100 transition-opacity duration-300 shrink-0";
      const formClass = "add-card-btn-container mt-4 bg-glass-bg border border-glass-border rounded-xl p-4 flex flex-col justify-center relative shadow-lg mb-6 shrink-0 w-64";

      addBtn.className = defaultClass;
      addBtn.innerHTML = defaultHTML;

      addBtn.onclick = (e) => {
        if (addBtn.classList.contains('form-active')) return;

        addBtn.className = formClass + " form-active";
        addBtn.innerHTML = `
          <div class="flex items-center gap-2 w-full">
            <input type="text" id="add-card-input" placeholder="Enter card name..." class="flex-1 min-w-0 border border-glass-border rounded-lg px-2.5 py-2 text-sm text-slate-200 outline-none neon-focus-ring transition-colors" style="background-color: rgba(0,0,0,0.25);">
            <button id="add-card-submit" class="px-3 py-2 rounded-lg text-sm font-bold text-slate-900 transition-colors shadow-md shrink-0" style="background-color: var(--neon-hex, #10b981);">Add</button>
            <button id="add-card-cancel" class="px-2 py-2 rounded-lg flex items-center justify-center transition-colors shrink-0" style="background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4);">
              <span class="material-symbols-outlined text-[18px] leading-none text-red-400">close</span>
            </button>
          </div>
        `;

        const input = addBtn.querySelector('#add-card-input');
        const submit = addBtn.querySelector('#add-card-submit');
        const cancel = addBtn.querySelector('#add-card-cancel');

        input.focus();

        const resetForm = (ev) => {
          if (ev) ev.stopPropagation();
          addBtn.className = defaultClass;
          addBtn.innerHTML = defaultHTML;
        };

        cancel.onclick = resetForm;

        const saveCard = async (ev) => {
          if (ev) ev.stopPropagation();
          const name = input.value.trim();
          if (name) {
            state.cards.push({ id: uuid(), name: name, tabId: state.settings.activeTab, colIndex: parseInt(col.dataset.colIndex), order: col.children.length });
            await saveData('cards');
            renderBookmarks();
          } else {
            input.style.borderColor = '#ef4444';
          }
        };

        submit.onclick = saveCard;
        input.onkeydown = (ev) => {
          if (ev.key === 'Enter') saveCard(ev);
          if (ev.key === 'Escape') resetForm(ev);
        };
        input.oninput = () => input.style.borderColor = '';
      };
      col.appendChild(addBtn);
    });
  }

  // Drag and Drop Logic
  colDivs.forEach(col => {
    col.addEventListener('dragenter', e => e.preventDefault());

    col.addEventListener('dragover', e => {
      e.preventDefault();
      const dragging = g_placeholder;
      if (!dragging.parentNode) return;

      const afterElement = getDragAfterElement(col, e.clientY);
      if (afterElement == null) {
        const addBtnContainer = col.querySelector('.add-card-btn-container');
        if (addBtnContainer) {
          col.insertBefore(dragging, addBtnContainer);
        } else {
          col.appendChild(dragging);
        }
      } else {
        col.insertBefore(dragging, afterElement);
      }
    });

    // We no longer rely on 'drop' for saving state, as 'dragend' covers it.
    // But we still prevent default on drop to be safe.
    col.addEventListener('drop', e => e.preventDefault());
  });

  renderTodos(searchQuery);
}

async function showAddLinkPrompt(cardId, cardName) {
  const url = prompt(`Add new link to ${cardName}\nEnter URL (e.g. https://example.com):`);
  if (!url) return;
  const title = prompt('Enter Title:');
  if (!title) return;
  const description = prompt('Enter Description (optional):') || '';

  const bm = {
    id: uuid(),
    title,
    description,
    url: url.startsWith('http') ? url : 'https://' + url,
    cardId: cardId
  };

  state.bookmarks.push(bm);
  await saveData('bookmarks');
  renderBookmarks();
}

document.getElementById('search-input').addEventListener('input', (e) => {
  renderBookmarks(e.target.value);
});

// --- Todos ---

function renderTodos(searchQuery = '') {
  const list = document.getElementById('todo-list');
  if (!list) return;
  list.innerHTML = '';

  let doneCount = 0;
  const q = searchQuery.toLowerCase();

  state.todos.forEach((todo, idx) => {
    if (todo.completed) doneCount++;
    if (q && !todo.text.toLowerCase().includes(q)) return;

    const li = document.createElement('li');
    li.className = 'flex items-start justify-between gap-3 group';

    const left = document.createElement('div');
    left.className = 'flex items-start gap-3 flex-1 cursor-pointer';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'appearance-none bg-transparent m-0 w-[1.15em] h-[1.15em] border border-slate-600 rounded grid place-content-center transition-all duration-200 before:content-[\'\'] before:w-[0.65em] before:h-[0.65em] before:scale-0 before:transition-transform before:duration-120 before:ease-in-out before:shadow-[inset_1em_1em_#0f172a] before:bg-slate-900 before:origin-center before:[clip-path:polygon(14%_44%,0_65%,50%_100%,100%_16%,80%_0%,43%_62%)] checked:!bg-neon-green checked:!border-neon-green checked:before:scale-100 mt-1';
    cb.checked = todo.completed;

    const span = document.createElement('span');
    span.className = `text-sm flex-1 ${todo.completed ? 'line-through text-slate-500' : 'text-slate-200'}`;
    span.textContent = todo.text;

    left.onclick = async (e) => {
      if (e.target === left || e.target === span) cb.checked = !cb.checked;
      todo.completed = cb.checked;
      await saveData('todos');
      renderTodos();
    };
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = async () => {
      todo.completed = cb.checked;
      await saveData('todos');
      renderTodos();
    };

    left.appendChild(cb);
    left.appendChild(span);

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1';

    const editBtn = document.createElement('button');
    editBtn.className = 'text-slate-600 hover:text-neon-green transition-colors p-0.5';
    editBtn.innerHTML = '<span class="material-symbols-outlined text-sm">edit</span>';
    editBtn.onclick = (e) => {
      e.stopPropagation();

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';

      modal.innerHTML = `
        <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
          <div class="p-6 flex flex-col" style="gap: 20px;">
            <h3 class="text-xl font-bold custom-modal-title">Edit Task</h3>
            
            <div class="flex flex-col" style="gap: 8px;">
              <label class="text-sm font-semibold custom-modal-label">Task Description *</label>
              <input type="text" id="edit-task-name" class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input" value="${todo.text}">
            </div>
            
            <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
              <button id="edit-task-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
              <button id="edit-task-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Save Changes</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const nameInput = modal.querySelector('#edit-task-name');
      const cancelBtn = modal.querySelector('#edit-task-cancel');
      const saveBtn = modal.querySelector('#edit-task-save');

      nameInput.focus();

      cancelBtn.onclick = () => modal.remove();

      const saveChanges = async () => {
        const val = nameInput.value.trim();
        if (!val) {
          nameInput.style.borderColor = '#ef4444';
          return;
        }
        if (val !== todo.text) {
          todo.text = val;
          await saveData('todos');
        }
        renderTodos();
        modal.remove();
      };

      saveBtn.onclick = saveChanges;
      nameInput.onkeydown = (ev) => {
        if (ev.key === 'Enter') saveChanges();
        if (ev.key === 'Escape') modal.remove();
      };
      nameInput.oninput = () => nameInput.style.borderColor = 'var(--glass-border)';
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'text-slate-600 hover:text-red-400 transition-colors p-0.5';
    delBtn.innerHTML = '<span class="material-symbols-outlined text-sm">close</span>';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      state.todos.splice(idx, 1);
      await saveData('todos');
      renderTodos();
    };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(actions);
    list.appendChild(li);
  });

  const total = state.todos.length;
  const percentage = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  const circle = document.getElementById('todo-progress-ring');
  if (circle) {
    const circumference = 251.2;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  const progressText = document.getElementById('todo-progress-text');
  if (progressText) {
    progressText.textContent = `${percentage}%`;
  }
}

document.getElementById('add-todo-btn').onclick = (e) => {
  e.preventDefault();

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 custom-modal-overlay transition-all';

  modal.innerHTML = `
    <div class="w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden custom-modal-content" style="max-width: 448px;">
      <div class="p-6 flex flex-col" style="gap: 20px;">
        <h3 class="text-xl font-bold custom-modal-title">Add New Task</h3>
        
        <div class="flex flex-col" style="gap: 8px;">
          <label class="text-sm font-semibold custom-modal-label">Task Description *</label>
          <input type="text" id="add-task-name" placeholder="Enter task..." class="w-full rounded-lg px-3 py-2.5 text-sm outline-none neon-focus-ring transition-all custom-modal-input">
        </div>
        
        <div class="flex items-center justify-end" style="gap: 12px; margin-top: 8px;">
          <button id="add-task-cancel" class="px-5 py-2 rounded-lg text-sm font-semibold transition-colors custom-modal-cancel">Cancel</button>
          <button id="add-task-save" class="px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-md custom-modal-save">Add Task</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const nameInput = modal.querySelector('#add-task-name');
  const cancelBtn = modal.querySelector('#add-task-cancel');
  const saveBtn = modal.querySelector('#add-task-save');

  nameInput.focus();

  cancelBtn.onclick = () => modal.remove();

  const saveChanges = async () => {
    const text = nameInput.value.trim();
    if (!text) {
      nameInput.style.borderColor = '#ef4444';
      return;
    }
    state.todos.push({ id: uuid(), text, completed: false });
    await saveData('todos');
    renderTodos();
    modal.remove();
  };

  saveBtn.onclick = saveChanges;
  nameInput.onkeydown = (ev) => {
    if (ev.key === 'Enter') saveChanges();
    if (ev.key === 'Escape') modal.remove();
  };
  nameInput.oninput = () => nameInput.style.borderColor = 'var(--glass-border)';
};

// --- Weather ---

async function fetchWeather() {
  if (!state.settings.showWeather || !state.settings.weatherCity) return;
  const c = document.getElementById('weather-content');
  if (!c) return;

  const now = Date.now();
  if (state.weatherCache && state.weatherCache.city === state.settings.weatherCity) {
    c.innerHTML = state.weatherCache.html;
    if (now - state.weatherCache.timestamp < 30 * 60 * 1000) return;
  }

  try {
    // 1. Geocode
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(state.settings.weatherCity)}&count=1`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      c.innerHTML = `City '${state.settings.weatherCity}' not found.`;
      return;
    }
    const { latitude, longitude, name } = geoData.results[0];

    // 2. Weather
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&timezone=auto`);
    const wData = await wRes.json();

    const curTemp = Math.round(wData.current.temperature_2m);
    const code = wData.current.weather_code;

    // Simple icon map
    const getIcon = (c) => {
      if (c <= 1) return '☀️';
      if (c <= 3) return '⛅';
      if (c <= 49) return '☁️';
      if (c <= 69) return '🌧️';
      if (c <= 79) return '❄️';
      return '🌩️';
    };

    let html = `
      <div class="flex items-center gap-2 mb-4">
        <span class="text-2xl">${getIcon(code)}</span>
        <span class="text-sm text-slate-300">${name}</span>
      </div>
      <div class="flex items-end justify-between">
        <div class="text-4xl font-light text-white">${curTemp}°C</div>
        <div class="flex gap-3 text-xs text-slate-400">
    `;

    // Next 3 days
    for (let i = 1; i <= 3; i++) {
      const date = new Date(wData.daily.time[i]);
      const day = date.toLocaleDateString('en-US', { weekday: 'short' });
      const maxT = Math.round(wData.daily.temperature_2m_max[i]);
      const icn = getIcon(wData.daily.weather_code[i]);
      html += `
        <div class="text-center">
          <div>${day}</div>
          <div>${icn}</div>
          <div>${maxT}°</div>
        </div>
      `;
    }
    html += `</div></div>`;
    c.innerHTML = html;

    state.weatherCache = { city: state.settings.weatherCity, html: html, timestamp: Date.now() };
    await setLocalData('weatherCache', state.weatherCache);

  } catch (err) {
    console.error(err);
    c.innerHTML = "Error fetching weather.";
  }
}

// --- Settings ---

function renderWallpapers() {
  const grid = document.getElementById('wallpaper-grid');
  grid.innerHTML = '';

  const allBgs = [...WALLPAPERS];
  if (state.settings.customWallpapers && Array.isArray(state.settings.customWallpapers)) {
    state.settings.customWallpapers.forEach(img => {
      const formatted = img.startsWith('url(') ? img : `url(${img})`;
      if (!allBgs.includes(formatted)) {
        allBgs.push(formatted);
      }
    });
  }
  if (state.settings.customWallpaper && state.settings.customWallpaperType !== 'video') {
    const formatted = state.settings.customWallpaper.startsWith('url(') ? state.settings.customWallpaper : `url(${state.settings.customWallpaper})`;
    if (!allBgs.includes(formatted)) {
      allBgs.push(formatted);
    }
  }

  allBgs.forEach(bg => {
    const isCustom = !WALLPAPERS.includes(bg);
    const btn = document.createElement('div');
    const isSelected = (state.settings.wallpaper === bg) ||
      (isCustom && state.settings.customWallpaper && (`url(${state.settings.customWallpaper})` === bg || state.settings.customWallpaper === bg));

    btn.className = `h-20 rounded-lg border-2 overflow-hidden relative cursor-pointer group ${isSelected ? 'border-neon-green' : 'border-transparent hover:border-slate-500'}`;

    // Special tile for silk-wave animated wallpaper
    if (bg === 'silk-wave') {
      btn.innerHTML = `
        <canvas class="absolute inset-0 w-full h-full silk-preview-canvas" width="200" height="80"></canvas>
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-0.5 z-10">
          <span class="text-[9px] font-bold text-emerald-400 tracking-widest uppercase drop-shadow-md">✦ Silk Wave</span>
          <span class="text-[8px] text-emerald-300/70">Animated</span>
        </div>
      `;
      btn.onclick = async () => {
        state.settings.wallpaper = 'silk-wave';
        state.settings.customWallpaper = null;
        state.settings.customWallpaperType = null;
        await saveData('settings');
        applyTheme(true);
        syncUI();
        renderWallpapers();
      };
      // Mini silk wave animation for the preview tile
      requestAnimationFrame(() => {
        const pc = btn.querySelector('.silk-preview-canvas');
        if (!pc) return;
        const pctx = pc.getContext('2d');
        let pt = 0;
        const PW = pc.width, PH = pc.height;
        const previewWaves = SILK_WAVES.map(w => ({ ...w, amp: w.amp * 0.28, freq: w.freq * 0.7 }));
        function drawPreview() {
          if (!pc.isConnected) return;
          pctx.clearRect(0, 0, PW, PH);
          const pbg = pctx.createLinearGradient(0, 0, 0, PH);
          pbg.addColorStop(0, '#030d05'); pbg.addColorStop(1, '#060f08');
          pctx.fillStyle = pbg; pctx.fillRect(0, 0, PW, PH);
          for (let wi = previewWaves.length - 1; wi >= 0; wi--) {
            const w = previewWaves[wi];
            const yMid = PH * w.yBase;
            pctx.beginPath();
            pctx.moveTo(0, PH);
            for (let x = 0; x <= PW; x += 2) {
              const y = yMid + Math.sin(x * w.freq + pt * w.speed + w.phase) * w.amp
                + Math.sin(x * w.freq * 1.7 + pt * w.speed * 0.6 + w.phase * 1.3) * (w.amp * 0.45);
              if (x === 0) pctx.moveTo(x, y); else pctx.lineTo(x, y);
            }
            pctx.lineTo(PW, PH); pctx.closePath();
            const g = pctx.createLinearGradient(0, yMid - w.amp, 0, yMid + w.amp + PH * 0.1);
            g.addColorStop(0, `hsla(${w.hue},55%,${w.lightness + 5}%,${w.alpha})`);
            g.addColorStop(1, `hsla(${w.hue},45%,${w.lightness - 2}%,0)`);
            pctx.fillStyle = g; pctx.fill();
          }
          pt++;
          requestAnimationFrame(drawPreview);
        }
        drawPreview();
      });
      grid.appendChild(btn);
      return; // skip normal rendering
    }

    let displayBg = bg;
    if (bg.startsWith('url') && bg.includes('Wallpapers/')) {
      displayBg = bg.replace("')", `?v=${Date.now()}')`);
    }
    const styleStr = bg.startsWith('url')
      ? `background-color: #0b1121; background-image: ${displayBg}; background-size: cover; background-position: center;`
      : `background: ${bg}; background-size: cover; background-position: center;`;

    let innerHtml = `<div class="absolute inset-0" style="${styleStr}"></div>`;
    if (isCustom) {
      innerHtml += `
        <button class="absolute top-1 right-1 bg-black/70 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs z-10 del-custom-bg" title="Remove wallpaper">
          ×
        </button>
      `;
    }
    btn.innerHTML = innerHtml;

    btn.onclick = async (e) => {
      if (e.target.closest('.del-custom-bg')) {
        e.stopPropagation();
        const raw = bg.startsWith('url(') ? bg.slice(4, -1).replace(/['"]/g, '') : bg;
        if (state.settings.customWallpapers) {
          state.settings.customWallpapers = state.settings.customWallpapers.filter(item => item !== raw && `url(${item})` !== bg);
        }
        if (state.settings.customWallpaper === raw || `url(${state.settings.customWallpaper})` === bg) {
          state.settings.customWallpaper = null;
          state.settings.customWallpaperType = null;
          state.settings.wallpaper = WALLPAPERS[0];
          applyTheme();
        }
        await saveData('settings');
        renderWallpapers();
        return;
      }

      if (isCustom) {
        const raw = bg.startsWith('url(') ? bg.slice(4, -1).replace(/['"]/g, '') : bg;
        state.settings.wallpaper = `url(${raw})`;
        state.settings.customWallpaper = raw;
        state.settings.customWallpaperType = 'image';
      } else {
        state.settings.wallpaper = bg;
        state.settings.customWallpaper = null;
        state.settings.customWallpaperType = null;
      }
      await saveData('settings');
      applyTheme(true);
      syncUI();
    };
    grid.appendChild(btn);
  });
}

function updateGroupToolsMenu() {
  const toggleBtn = document.getElementById('group-tools-toggle');
  const toggleIcon = document.getElementById('group-tools-icon');
  const wrapper = document.getElementById('floating-tools-wrapper');
  if (!toggleBtn || !wrapper) return;

  if (!state.settings.groupTools) {
    toggleBtn.classList.add('hidden');
    toggleBtn.classList.remove('flex');
    wrapper.classList.remove('max-h-0', 'opacity-0', 'pointer-events-none', 'scale-75', 'translate-y-8', 'overflow-hidden');
    wrapper.classList.add('max-h-[350px]', 'opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');
    window.isGroupToolsOpen = false;
    if (toggleIcon) {
      toggleIcon.textContent = 'menu';
      toggleIcon.style.transform = 'rotate(0deg) scale(1)';
    }
  } else {
    toggleBtn.classList.remove('hidden');
    toggleBtn.classList.add('flex');
    if (!window.isGroupToolsOpen) {
      wrapper.classList.remove('max-h-[350px]', 'opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');
      wrapper.classList.add('max-h-0', 'opacity-0', 'pointer-events-none', 'scale-75', 'translate-y-8', 'overflow-hidden');
      if (toggleIcon) toggleIcon.textContent = 'menu';
    } else {
      wrapper.classList.remove('max-h-0', 'opacity-0', 'pointer-events-none', 'scale-75', 'translate-y-8', 'overflow-hidden');
      wrapper.classList.add('max-h-[350px]', 'opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');
      if (toggleIcon) toggleIcon.textContent = 'close';
    }
  }
}

function initSettings() {
  const sidebar = document.getElementById('settings-sidebar');
  const modalContent = document.getElementById('settings-modal-content');

  document.getElementById('settings-btn').onclick = () => {
    sidebar.classList.remove('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  };

  const privacyBtn = document.getElementById('privacy-btn');
  const privacyIcon = document.getElementById('privacy-icon');
  let isPrivacyMode = false;
  if (privacyBtn) {
    privacyBtn.onclick = () => {
      isPrivacyMode = !isPrivacyMode;
      document.body.classList.toggle('privacy-mode', isPrivacyMode);
      document.body.classList.toggle('privacy-hide', isPrivacyMode && !!state.settings.privacyHide);

      // Animate eye icon with a pop effect
      privacyIcon.style.transform = 'scale(0)';
      setTimeout(() => {
        privacyIcon.textContent = isPrivacyMode ? 'visibility_off' : 'visibility';
        privacyIcon.style.transform = 'scale(1)';
      }, 150);
    };
  }

  window.isIncognitoMode = false;
  const incognitoBtn = document.getElementById('incognito-btn');
  const incognitoIcon = document.getElementById('incognito-icon');
  if (incognitoBtn) {
    incognitoBtn.onclick = () => {
      window.isIncognitoMode = !window.isIncognitoMode;

      if (window.isIncognitoMode) {
        incognitoBtn.style.backgroundColor = 'var(--neon-hex)';
        incognitoBtn.classList.add('text-slate-900');
        incognitoBtn.classList.remove('bg-glass-bg', 'text-slate-300', 'border-glass-border', 'hover:text-neon-green');
      } else {
        incognitoBtn.style.backgroundColor = '';
        incognitoBtn.classList.remove('text-slate-900');
        incognitoBtn.classList.add('bg-glass-bg', 'text-slate-300', 'border-glass-border', 'hover:text-neon-green');
      }

      incognitoIcon.style.transform = 'scale(0.8)';
      setTimeout(() => {
        incognitoIcon.style.transform = 'scale(1)';
      }, 150);
    };
  }

  window.isGroupToolsOpen = false;
  const groupToolsToggle = document.getElementById('group-tools-toggle');
  const groupToolsIcon = document.getElementById('group-tools-icon');
  if (groupToolsToggle) {
    groupToolsToggle.onclick = () => {
      window.isGroupToolsOpen = !window.isGroupToolsOpen;
      if (groupToolsIcon) {
        groupToolsIcon.style.transform = window.isGroupToolsOpen ? 'rotate(180deg) scale(0)' : 'rotate(-180deg) scale(0)';
        setTimeout(() => {
          groupToolsIcon.textContent = window.isGroupToolsOpen ? 'close' : 'menu';
          groupToolsIcon.style.transform = 'rotate(0deg) scale(1)';
        }, 150);
      }
      updateGroupToolsMenu();
    };
  }

  document.getElementById('close-sidebar').onclick = () => {
    sidebar.classList.add('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
  };

  // Close on outside click
  sidebar.addEventListener('click', (e) => {
    if (e.target === sidebar) {
      document.getElementById('close-sidebar').click();
    }
  });

  // Blur
  document.getElementById('blur-slider').oninput = (e) => {
    state.settings.blur = e.target.value;
    applyTheme(false);
  };
  document.getElementById('blur-slider').onchange = async () => {
    await saveData('settings');
  };

  const bgBlurSlider = document.getElementById('bg-blur-slider');
  if (bgBlurSlider) {
    bgBlurSlider.oninput = (e) => {
      state.settings.bgBlur = e.target.value;
      applyTheme(false);
    };
    bgBlurSlider.onchange = async () => {
      await saveData('settings');
    };
  }

  // Color Picker
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : '34 197 94';
  }

  document.getElementById('color-picker').oninput = (e) => {
    const hex = e.target.value;
    state.settings.neonHex = hex;
    state.settings.neonAccent = hex;
    state.settings.neonRgb = hexToRgb(hex);
    applyTheme(false);
    document.getElementById('color-hex').textContent = hex;
  };
  document.getElementById('color-picker').onchange = async () => {
    await saveData('settings');
  };

  // Toggles
  document.getElementById('toggle-weather').onchange = async (e) => {
    state.settings.showWeather = e.target.checked;
    await saveData('settings');
    syncUI();
    if (state.settings.showWeather) fetchWeather();
  };

  document.getElementById('toggle-todo').onchange = async (e) => {
    state.settings.showTodo = e.target.checked;
    await saveData('settings');
    syncUI();
  };

  document.getElementById('toggle-calendar').onchange = async (e) => {
    state.settings.showCalendar = e.target.checked;
    await saveData('settings');
    syncUI();
    renderBookmarks(document.getElementById('search-input').value);
  };

  document.getElementById('add-notepad-btn').onclick = async () => {
    const name = prompt('Enter notepad name:', 'New Notepad');
    if (name && name.trim()) {
      const activeTabId = state.settings.activeTab || (state.tabs[0]?.id || 'tab-home');
      state.notepads.push({
        id: 'notepad-' + uuid(),
        name: name.trim(),
        text: '',
        show: true,
        tabId: activeTabId,
        pos: { colIndex: 0, order: -3 }
      });
      await saveData('notes');
      renderNotepadSettings();
      renderBookmarks(document.getElementById('search-input').value);
    }
  };

  // General Settings Toggles
  const genSettings = [
    { id: 'toggle-compact-mode', key: 'compactMode', render: true },
    { id: 'toggle-group-tools', key: 'groupTools', render: false },
    { id: 'toggle-hide-extra', key: 'hideExtraBookmarks', render: true },
    { id: 'toggle-shorten-titles', key: 'shortenTitles', render: true },
    { id: 'toggle-open-new-tab', key: 'openNewTab', render: true },
    { id: 'toggle-show-descriptions', key: 'showDescriptions', render: true },
    { id: 'toggle-privacy-hide', key: 'privacyHide', render: false }
  ];

  genSettings.forEach(s => {
    document.getElementById(s.id).onchange = async (e) => {
      state.settings[s.key] = e.target.checked;
      await saveData('settings');
      if (s.render) renderBookmarks(document.getElementById('search-input').value);
      
      if (s.key === 'privacyHide' && isPrivacyMode) {
        document.body.classList.toggle('privacy-hide', state.settings.privacyHide);
      }
      if (s.key === 'groupTools') {
        window.isGroupToolsOpen = false;
        updateGroupToolsMenu();
      }
    };
  });

  // Tab button style selector (Capsule vs Rounded Rectangle)
  const capsuleStyleBtn = document.getElementById('tab-style-capsule');
  const roundedStyleBtn = document.getElementById('tab-style-rounded');
  if (capsuleStyleBtn && roundedStyleBtn) {
    capsuleStyleBtn.onclick = async () => {
      if (state.settings.tabStyle !== 'capsule') {
        state.settings.tabStyle = 'capsule';
        await saveData('settings');
        syncUI();
        renderNav();
      }
    };
    roundedStyleBtn.onclick = async () => {
      if (state.settings.tabStyle !== 'rounded') {
        state.settings.tabStyle = 'rounded';
        await saveData('settings');
        syncUI();
        renderNav();
      }
    };
  }

  document.getElementById('select-quick-save-dest').onchange = async (e) => {
    state.settings.quickSaveDest = e.target.value;
    await saveData('settings');
  };

  const btnChangeShortcut = document.getElementById('btn-change-shortcut');
  const shortcutDisplay = document.getElementById('quick-save-shortcut-display');

  btnChangeShortcut.onclick = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } else {
      alert('Cannot open shortcut settings in this environment.');
    }
  };

  // City
  document.getElementById('save-city').onclick = async () => {
    const city = document.getElementById('weather-city').value.trim();
    if (city) {
      state.settings.weatherCity = city;
      await saveData('settings');
      const msg = document.getElementById('weather-msg');
      msg.classList.remove('hidden');
      setTimeout(() => msg.classList.add('hidden'), 2000);
      fetchWeather();
    }
  };

  // Import Browser Bookmarks — custom dropdown implementation
  const btnImportBookmarks = document.getElementById('btn-import-bookmarks');
  const importModal = document.getElementById('import-bookmarks-modal');
  const importContent = document.getElementById('import-bookmarks-content');
  const btnCloseImport = document.getElementById('close-import-modal');
  const btnCancelImport = document.getElementById('btn-cancel-import');
  const btnConfirmImport = document.getElementById('btn-confirm-import');

  // State for custom dropdowns
  let selectedFolderId = null;
  let selectedFolderName = null;
  let selectedTabId = null;
  let selectedTabName = null;
  let fetchedBrowserFolders = [];

  // --- Custom Dropdown Helper ---
  function buildCustomDropdown({ triggerId, labelId, chevronId, menuId, optionsId }) {
    const trigger = document.getElementById(triggerId);
    const menu = document.getElementById(menuId);
    const chevron = document.getElementById(chevronId);

    function openMenu() {
      menu.classList.remove('hidden');
      chevron.style.transform = 'rotate(180deg)';
      trigger.classList.add('border-neon-green');
      trigger.classList.remove('border-slate-700');
    }
    function closeMenu() {
      menu.classList.add('hidden');
      chevron.style.transform = '';
      trigger.classList.remove('border-neon-green');
      trigger.classList.add('border-slate-700');
    }
    function toggle() {
      if (menu.classList.contains('hidden')) openMenu(); else closeMenu();
    }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!trigger.closest(`#${optionsId}`)?.contains(e.target) && !trigger.contains(e.target) && !menu.contains(e.target)) {
        closeMenu();
      }
    });

    return { openMenu, closeMenu };
  }

  const folderDropdown = buildCustomDropdown({
    triggerId: 'import-folder-trigger',
    labelId: 'import-folder-label',
    chevronId: 'import-folder-chevron',
    menuId: 'import-folder-menu',
    optionsId: 'import-folder-options'
  });
  const tabDropdown = buildCustomDropdown({
    triggerId: 'import-tab-trigger',
    labelId: 'import-tab-label',
    chevronId: 'import-tab-chevron',
    menuId: 'import-tab-menu',
    optionsId: 'import-tab-options'
  });

  function makeDropdownItem(label, onClick, isSelected = false) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 ${
      isSelected
        ? 'text-neon-green bg-neon-green/10'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;
    if (isSelected) {
      item.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span><span>${label}</span>`;
    } else {
      item.innerHTML = `<span class="material-symbols-outlined text-[16px] opacity-0">check</span><span>${label}</span>`;
    }
    item.addEventListener('click', onClick);
    return item;
  }

  function populateFolderDropdown(folders) {
    const optionsContainer = document.getElementById('import-folder-options');
    const labelEl = document.getElementById('import-folder-label');
    optionsContainer.innerHTML = '';

    if (folders.length === 0) {
      optionsContainer.innerHTML = '<p class="px-4 py-3 text-sm text-slate-500">No folders found</p>';
      return;
    }

    folders.forEach(folder => {
      const item = makeDropdownItem(folder.label, () => {
        selectedFolderId = folder.id;
        selectedFolderName = folder.title;
        labelEl.textContent = folder.label;
        labelEl.classList.remove('text-slate-400');
        labelEl.classList.add('text-slate-200');
        folderDropdown.closeMenu();
        // Re-render to show checkmark
        populateFolderDropdown(folders);
      }, folder.id === selectedFolderId);
      optionsContainer.appendChild(item);
    });
  }

  function populateTabDropdown() {
    const optionsContainer = document.getElementById('import-tab-options');
    const labelEl = document.getElementById('import-tab-label');
    optionsContainer.innerHTML = '';

    state.tabs.forEach(tab => {
      const item = makeDropdownItem(tab.name, () => {
        selectedTabId = tab.id;
        selectedTabName = tab.name;
        labelEl.textContent = tab.name;
        labelEl.classList.remove('text-slate-400');
        labelEl.classList.add('text-slate-200');
        tabDropdown.closeMenu();
        populateTabDropdown();
      }, tab.id === selectedTabId);
      optionsContainer.appendChild(item);
    });
  }

  if (btnImportBookmarks) {
    btnImportBookmarks.onclick = () => {
      // Close settings modal first
      const closeSidebarBtn = document.getElementById('close-sidebar');
      if (closeSidebarBtn) closeSidebarBtn.click();

      // Reset state
      selectedFolderId = null;
      selectedFolderName = null;
      selectedTabId = state.settings.activeTab;
      const activeTab = state.tabs.find(t => t.id === state.settings.activeTab);
      selectedTabName = activeTab ? activeTab.name : 'Home';

      // Reset folder label
      const folderLabel = document.getElementById('import-folder-label');
      folderLabel.textContent = 'Loading folders...';
      folderLabel.className = 'truncate text-slate-400';

      // Set tab label to current active tab
      const tabLabel = document.getElementById('import-tab-label');
      tabLabel.textContent = selectedTabName;
      tabLabel.className = 'truncate text-slate-200';

      // Show modal
      importModal.classList.remove('opacity-0', 'pointer-events-none');
      importContent.classList.remove('scale-95');
      importContent.classList.add('scale-100');

      // Fetch bookmark folders — deduplicated by ID and root title
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        chrome.bookmarks.getTree((tree) => {
          fetchedBrowserFolders = [];
          const seenIds = new Set();

          function traverse(nodes, depth = 0) {
            nodes.forEach(node => {
              if (node.children) {
                // Brave sometimes returns duplicate root folders (Bookmarks bar, Other bookmarks)
                const isDuplicateRoot = depth === 0 && seenIds.has(`root_${node.title}`);

                if (node.id !== '0' && !seenIds.has(node.id) && !isDuplicateRoot) {
                  seenIds.add(node.id);
                  if (depth === 0) seenIds.add(`root_${node.title}`);

                  fetchedBrowserFolders.push({
                    id: node.id,
                    title: node.title,
                    label: '  '.repeat(depth) + node.title,
                    children: node.children
                  });
                }
                traverse(node.children, node.id === '0' ? 0 : depth + 1);
              }
            });
          }
          traverse(tree);
          populateFolderDropdown(fetchedBrowserFolders);
        });
      } else {
        document.getElementById('import-folder-options').innerHTML =
          '<p class="px-4 py-3 text-sm text-slate-500">Bookmarks API not available</p>';
      }

      // Populate tabs
      populateTabDropdown();
    };
  }

  function closeImportModal() {
    importModal.classList.add('opacity-0', 'pointer-events-none');
    importContent.classList.remove('scale-100');
    importContent.classList.add('scale-95');
    folderDropdown.closeMenu();
    tabDropdown.closeMenu();
  }

  if (btnCloseImport) btnCloseImport.onclick = closeImportModal;
  if (btnCancelImport) btnCancelImport.onclick = closeImportModal;

  if (btnConfirmImport) {
    btnConfirmImport.onclick = async () => {
      if (!selectedFolderId) return;
      const folder = fetchedBrowserFolders.find(f => f.id === selectedFolderId);
      if (!folder) return;

      const targetTabId = selectedTabId || state.settings.activeTab;

      // Create new card
      const cardId = uuid();
      const newCard = {
        id: cardId,
        name: folder.title || 'Imported Bookmarks',
        tabId: targetTabId,
        colIndex: 0,
        order: state.cards.filter(c => c.tabId === targetTabId && c.colIndex === 0).length
      };
      state.cards.push(newCard);

      // Extract links recursively
      function extractLinks(nodes) {
        nodes.forEach(node => {
          if (node.url) {
            let hostname = '';
            try { hostname = new URL(node.url).hostname; } catch (e) { hostname = node.url; }
            state.bookmarks.push({
              id: uuid(),
              cardId: cardId,
              url: node.url,
              title: smartTitle(node.title, node.url),
              description: '',
              favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
            });
          } else if (node.children) {
            extractLinks(node.children);
          }
        });
      }
      extractLinks(folder.children || []);

      await saveData(['tabs', 'cards', 'bookmarks']);
      renderBookmarks(document.getElementById('search-input').value);
      closeImportModal();
    };
  }


  // Export/Import
  const exportDataBtn = document.getElementById('export-data');
  if (exportDataBtn) {
    exportDataBtn.onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productivity-hub-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  const fileInput = document.getElementById('import-file');
  const importDataBtn = document.getElementById('import-data-btn');
  if (fileInput && importDataBtn) {
    importDataBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (data.categories && data.bookmarks) {
            state = data;
            await saveData();
            window.location.reload();
          } else {
            alert('Invalid backup file.');
          }
        } catch (err) {
          alert('Error parsing JSON.');
        }
      };
      reader.readAsText(file);
    };
  }

  // Custom Wallpaper Upload
  const uploadInput = document.getElementById('upload-wallpaper');
  document.getElementById('upload-wallpaper-btn').onclick = () => {
    uploadInput.click();
  };
  uploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        state.settings.customWallpaperType = isVideo ? 'video' : 'image';
        state.settings.wallpaper = isVideo ? '#0b1121' : `url(${dataUrl})`;
        state.settings.customWallpaper = dataUrl;
        if (!isVideo) {
          state.settings.customWallpapers = state.settings.customWallpapers || [];
          if (!state.settings.customWallpapers.includes(dataUrl)) {
            state.settings.customWallpapers.unshift(dataUrl);
            if (state.settings.customWallpapers.length > 12) {
              state.settings.customWallpapers = state.settings.customWallpapers.slice(0, 12);
            }
          }
        }
        await saveData('settings');
        applyTheme();
        syncUI();
      };
      reader.readAsDataURL(file);
    }
  };
}

// --- Drag and Drop Helpers ---
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.draggable-card:not(.hidden)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function saveDragDropOrder() {
  const grid = document.getElementById('dashboard-grid');
  const cols = grid.querySelectorAll('.drag-col');

  cols.forEach((col) => {
    const colIndex = parseInt(col.dataset.colIndex, 10);
    const cards = col.querySelectorAll('.draggable-card');
    cards.forEach((cardEl, order) => {
      const cardId = cardEl.dataset.cardId;
      if (cardId === 'widget-weather') {
        state.settings.weatherWidgetPos = { colIndex, order };
      } else if (cardId === 'widget-todo') {
        state.settings.todoWidgetPos = { colIndex, order };
      } else if (cardId === 'widget-calendar') {
        state.settings.calendarWidgetPos = { colIndex, order };
      } else if (cardId.startsWith('notepad-')) {
        const np = state.notepads.find(n => n.id === cardId);
        if (np) {
          np.pos = { colIndex, order };
        }
      } else {
        const card = state.cards.find(c => c.id === cardId);
        if (card) {
          card.colIndex = colIndex;
          card.order = order;
        }
      }
    });
  });

  await saveData(['settings', 'notes', 'cards']);
  debouncedSupabaseSync(true);
  renderBookmarks(document.getElementById('search-input').value);
}

let currentBgSrc = null;

function rgbToHsl(r, g, b) {
  r /= 255, g /= 255, b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = x => { const hex = Math.round(x * 255).toString(16); return hex.length === 1 ? '0' + hex : hex; };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function applySmartFaviconTheme(imgElement) {
  if (!imgElement) return;
  imgElement.crossOrigin = 'anonymous';
  const originalSrc = imgElement.src;
  imgElement.onerror = () => {
    if (imgElement.crossOrigin) {
      imgElement.crossOrigin = null;
      imgElement.src = originalSrc;
    }
  };
  imgElement.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElement, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;

      let totalPixels = 0;
      let transparentPixels = 0;
      let darkPixels = 0;
      let lightPixels = 0;
      let colorPixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        totalPixels++;
        if (a < 50) {
          transparentPixels++;
          continue;
        }
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const chroma = max - min;
        if (chroma > 35 && max > 60) {
          colorPixels++;
        } else if (max < 85) {
          darkPixels++;
        } else if (min > 185) {
          lightPixels++;
        }
      }

      const opaquePixels = totalPixels - transparentPixels;
      if (opaquePixels > 10 && (transparentPixels / totalPixels) > 0.15) {
        if ((darkPixels / opaquePixels) > 0.70 && (colorPixels / opaquePixels) < 0.20) {
          imgElement.classList.add('smart-favicon-dark');
        } else if ((lightPixels / opaquePixels) > 0.70 && (colorPixels / opaquePixels) < 0.20) {
          imgElement.classList.add('smart-favicon-light');
        }
      }
    } catch (e) {
      // Ignore if CORS restricted canvas inspection
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Luxe Accent Color Engine
// Philosophy: rich, muted, never harsh — think jewel tones and silk, not neon.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply a curated accent from just a hue angle.
 * Saturation is kept in the "jewel tone" range (48-62%) and lightness is tuned
 * so the glow reads clearly on dark glass without screaming.
 * @param {number} hue  - 0-360 hue angle
 * @param {boolean} isLight - whether the background is light
 */
function setLuxeAccent(hue, isLight) {
  // Jewel-tone saturation — rich but never garish
  const s = isLight ? 0.52 : 0.58;
  // Lightness: bright enough to glow on dark glass, restrained enough to feel premium
  const l = isLight ? 0.36 : 0.62;
  // hslToHex expects h in 0-1, not degrees
  const hex = hslToHex(hue / 360, s, l);
  _applyAccentColor(hex);
}

/**
 * Commits an accent hex to state, CSS vars, and the settings UI.
 */
function _applyAccentColor(hex) {
  state.settings.neonHex = hex;
  state.settings.neonAccent = hex;
  document.documentElement.style.setProperty('--neon-hex', hex);

  // Derive RGB triple for CSS custom property (used in box-shadows, etc.)
  const tempDiv = document.createElement('div');
  tempDiv.style.color = hex;
  document.body.appendChild(tempDiv);
  const rgbStr = window.getComputedStyle(tempDiv).color.match(/\d+,?\s*\d+,?\s*\d+/);
  if (rgbStr) {
    const neonRgbVal = rgbStr[0].replace(/,/g, '');
    document.documentElement.style.setProperty('--neon-rgb', neonRgbVal);
    state.settings.neonRgb = neonRgbVal;
  }
  document.body.removeChild(tempDiv);

  const colorPicker = document.getElementById('color-picker');
  if (colorPicker) colorPicker.value = hex;
  const colorHexSpan = document.getElementById('color-hex');
  if (colorHexSpan) colorHexSpan.textContent = hex;
}
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeBackgroundBrightness(src, isVideo, autoUpdateColor = true) {
  if (!src) {
    if (document.body && document.body.classList) document.body.classList.remove('theme-light');
    return;
  }

  if (currentBgSrc === src && !autoUpdateColor) return;
  currentBgSrc = src;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = 120;
    canvas.height = 120;

    let imageOrVideoElement;

    if (isVideo) {
      imageOrVideoElement = document.createElement('video');
      imageOrVideoElement.muted = true;
      imageOrVideoElement.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        let loaded = false;
        imageOrVideoElement.onloadeddata = () => {
          if (imageOrVideoElement.readyState >= 2) {
            imageOrVideoElement.currentTime = Math.min(0.5, imageOrVideoElement.duration || 0);
          }
        };
        imageOrVideoElement.onseeked = () => { loaded = true; resolve(); };
        imageOrVideoElement.onerror = (e) => { console.warn('Video load error', e); reject(e); };
        imageOrVideoElement.src = src;
        imageOrVideoElement.load();
        setTimeout(() => { if (!loaded) resolve(); }, 2000);
      });
    } else {
      imageOrVideoElement = new Image();
      imageOrVideoElement.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        imageOrVideoElement.onload = resolve;
        imageOrVideoElement.onerror = reject;
        imageOrVideoElement.src = src;
      });
    }

    ctx.drawImage(imageOrVideoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // ── Pass 1: brightness & temperature ──────────────────────────────────
    let totalR = 0, totalG = 0, totalB = 0, validPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      totalR += data[i]; totalG += data[i + 1]; totalB += data[i + 2];
      validPixels++;
    }
    if (validPixels === 0) return;

    const avgR = totalR / validPixels;
    const avgG = totalG / validPixels;
    const avgB = totalB / validPixels;
    const brightness = (avgR * 299 + avgG * 587 + avgB * 114) / 1000;
    const isLight = brightness > 140;

    if (isLight) {
      if (document.body && document.body.classList) document.body.classList.add('theme-light');
    } else {
      if (document.body && document.body.classList) document.body.classList.remove('theme-light');
    }

    if (!autoUpdateColor) return;

    // ── Pass 2: Luxe hue bucketing ────────────────────────────────────────
    // 72 fine-grained buckets (5° each) for more precise hue detection.
    // We weight pixels by:
    //   • Saturation squared   (rewards vivid over muddy)
    //   • Midtone proximity    (avoids blown highlights & crushed shadows)
    //   • Perceptual salience  (warm hues weighted ~1.15×, cool hues 1×)
    const NUM_BUCKETS = 72;
    const buckets = Array.from({ length: NUM_BUCKETS }, () => ({
      hSum: 0, sSum: 0, lSum: 0, weight: 0, count: 0
    }));

    for (let i = 0; i < data.length; i += 4) {
      const pa = data[i + 3];
      if (pa < 128) continue;
      const pr = data[i], pg = data[i + 1], pb = data[i + 2];
      const [ph, ps, pl] = rgbToHsl(pr, pg, pb);

      // Skip near-black, near-white, and heavily desaturated pixels
      if (ps < 0.10 || pl < 0.08 || pl > 0.92) continue;

      // Midtone reward: peaks at pl=0.45 for dark themes (where glow looks best)
      const midReward = 1 - Math.abs(pl - (isLight ? 0.50 : 0.42)) * 2.2;
      if (midReward <= 0) continue;

      // Perceptual warmth bias: warm hues (reds/oranges/golds) feel richer
      const warmBias = (ph >= 0 && ph <= (60/360)) || (ph >= (300/360) && ph <= 1) ? 1.18 : 1.0;

      const w = ps * ps * midReward * warmBias;
      const bi = Math.floor((ph * 360 % 360) / (360 / NUM_BUCKETS));
      buckets[bi].hSum += ph * w;
      buckets[bi].sSum += ps * w;
      buckets[bi].lSum += pl * w;
      buckets[bi].weight += w;
      buckets[bi].count++;
    }

    // Smooth buckets with a 3-bucket Gaussian window so adjacent hues reinforce
    const smoothed = buckets.map((b, i) => {
      const prev = buckets[(i - 1 + NUM_BUCKETS) % NUM_BUCKETS];
      const next = buckets[(i + 1) % NUM_BUCKETS];
      return {
        weight: prev.weight * 0.25 + b.weight * 0.5 + next.weight * 0.25,
        hSum: prev.hSum * 0.25 + b.hSum * 0.5 + next.hSum * 0.25,
        sSum: prev.sSum * 0.25 + b.sSum * 0.5 + next.sSum * 0.25,
        lSum: prev.lSum * 0.25 + b.lSum * 0.5 + next.lSum * 0.25,
        count: b.count,
      };
    });

    // Pick the highest-weight smoothed bucket
    let best = null, maxW = 0;
    for (const b of smoothed) {
      if (b.weight > maxW && b.count > 0) { maxW = b.weight; best = b; }
    }

    if (best && maxW > 1.5) {
      // Dominant hue found — extract raw values
      const rawH_norm = best.hSum / best.weight;   // 0-1 normalized hue
      const rawH = rawH_norm * 360;                // degrees for nudge logic
      const rawS = best.sSum / best.weight;
      const rawL = best.lSum / best.weight;

      // ── Luxe Saturation & Lightness shaping ──────────────────────────────
      const luxeS = 0.48 + (rawS - 0.10) / (0.90 - 0.10) * (0.62 - 0.48);
      const clampedS = Math.min(0.65, Math.max(0.45, luxeS));

      const luxeL = isLight
        ? 0.34 + (1 - rawL) * 0.08
        : 0.58 + rawL * 0.08;
      const clampedL = isLight
        ? Math.min(0.44, Math.max(0.32, luxeL))
        : Math.min(0.68, Math.max(0.55, luxeL));

      // The nudge is small (±8°) and only applied in certain ranges.
      let elegantH = rawH;
      if (rawH >= 0   && rawH < 30)  elegantH = rawH + 6;   // orange → amber gold
      if (rawH >= 30  && rawH < 65)  elegantH = rawH - 5;   // yellow-green → gold
      if (rawH >= 120 && rawH < 165) elegantH = rawH + 8;   // green → jade/teal
      if (rawH >= 165 && rawH < 210) elegantH = rawH - 6;   // cyan → aqua
      if (rawH >= 260 && rawH < 310) elegantH = rawH + 5;   // violet → amethyst
      if (rawH >= 310 && rawH < 360) elegantH = rawH - 8;   // magenta → rose gold
      elegantH = ((elegantH % 360) + 360) % 360;

      // hslToHex expects h in 0-1, not degrees
      const luxeHex = hslToHex(elegantH / 360, clampedS, clampedL);
      _applyAccentColor(luxeHex);

    } else {
      // ── Graceful fallback for low-colour / monochrome wallpapers ─────────
      // Choose a curated jewel based on the image's color temperature.
      const tempDiff = avgR - avgB;
      let fallbackHue;
      if      (tempDiff > 15)  fallbackHue = 38;   // warm sepia/cream → antique gold
      else if (tempDiff > 5)   fallbackHue = 28;   // slightly warm → amber
      else if (tempDiff < -15) fallbackHue = 210;  // cool ice/steel → sapphire
      else if (tempDiff < -5)  fallbackHue = 195;  // slightly cool → aquamarine
      else                     fallbackHue = 250;  // neutral → soft amethyst
      setLuxeAccent(fallbackHue, isLight);
    }

    // Persist — but don't block the UI
    saveData('settings');

  } catch (error) {
    console.error('Error analyzing background:', error);
    if (document.body && document.body.classList) document.body.classList.remove('theme-light');
  }
}

// Bootstrap
function startClock() {
  const timeEl = document.getElementById('clock-time');
  const dateEl = document.getElementById('clock-date');
  if (!timeEl || !dateEl) return;

  function update() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  update();
  setInterval(update, 1000);
}

// Quick Save Native Command Listener
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'QUICK_SAVE_TRIGGERED') {
      const dest = state.settings.quickSaveDest || 'Current Page';
      let targetTabId = state.settings.activeTab;
      
      if (dest === 'Current Page') {
        targetTabId = state.settings.activeTab;
      } else {
        // dest is a tab ID
        const matchedTab = state.tabs.find(t => t.id === dest);
        if (matchedTab) targetTabId = matchedTab.id;
      }
      
      if (!targetTabId && state.tabs.length > 0) {
        targetTabId = state.tabs[0].id;
      }
      
      // Find or create a "Quick Save" card
      let quickSaveCard = state.cards.find(c => c.tabId === targetTabId && c.name === 'Quick Save');
      
      if (!quickSaveCard) {
        quickSaveCard = {
          id: uuid(),
          tabId: targetTabId,
          name: 'Quick Save',
          colIndex: 0,
          order: state.cards.filter(c => c.tabId === targetTabId).length
        };
        state.cards.push(quickSaveCard);
        saveData('cards');
        renderBookmarks();
      }
      
      // Switch to the target tab if needed
      if (state.settings.activeTab !== targetTabId) {
        const tabBtn = document.getElementById(`tab-btn-${targetTabId}`);
        if (tabBtn) tabBtn.click();
      }
      
      // Click the add link button on the Quick Save card
      const addLinkBtn = document.getElementById(`add-link-btn-${quickSaveCard.id}`);
      if (addLinkBtn) {
        const cardEl = document.getElementById(`card-${quickSaveCard.id}`);
        if (cardEl && !cardEl.querySelector('.add-link-inline-form')) {
          addLinkBtn.click();
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  });
}

// --- Calendar Widget ---
let currentDateForCalendar = new Date();

function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const gridEl = document.getElementById('calendar-grid');
  if (!monthYearEl || !gridEl) return;

  const year = currentDateForCalendar.getFullYear();
  const month = currentDateForCalendar.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  monthYearEl.textContent = `${monthNames[month]} ${year}`;
  gridEl.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const currentDay = today.getDate();

  // Previous month trailing days
  for (let i = 0; i < firstDay; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'text-slate-600/50 p-1 flex items-center justify-center';
    dayDiv.textContent = ''; // Blank out previous month days
    gridEl.appendChild(dayDiv);
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'flex items-center justify-center mx-auto transition-colors';
    dayDiv.style.width = '32px';
    dayDiv.style.height = '28px';
    
    if (isCurrentMonth && i === currentDay) {
      dayDiv.className += ' font-bold shadow-md';
      dayDiv.style.backgroundColor = 'var(--neon-hex)';
      dayDiv.style.color = '#ffffff';
      dayDiv.style.borderRadius = '10px';
    } else {
      dayDiv.className += ' text-slate-300 hover:bg-slate-700/50 cursor-default p-1';
      dayDiv.style.borderRadius = '6px';
    }
    
    dayDiv.textContent = i;
    gridEl.appendChild(dayDiv);
  }

  // Next month leading days
  const totalCells = firstDay + daysInMonth;
  const nextDays = (7 - (totalCells % 7)) % 7;
  if (nextDays < 7) {
    for (let i = 1; i <= nextDays; i++) {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'text-slate-600/50 p-1 flex items-center justify-center';
      dayDiv.textContent = ''; // Blank out next month days
      gridEl.appendChild(dayDiv);
    }
  }
}

function initCalendar() {
  const prevBtn = document.getElementById('calendar-prev-month');
  const nextBtn = document.getElementById('calendar-next-month');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      currentDateForCalendar.setMonth(currentDateForCalendar.getMonth() - 1);
      renderCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentDateForCalendar.setMonth(currentDateForCalendar.getMonth() + 1);
      renderCalendar();
    });
  }
  renderCalendar();
}

async function init() {
  await loadLocalData();
  applyTheme(false);
  syncUI();
  renderNav();
  renderBookmarks();
  renderTodos();
  initSettings();
  fetchWeather();
  startClock();
  initCalendar();

  // Non-blocking background tasks
  syncAccountUI().catch(e => console.error('[LinkHive Sync] Background account UI error:', e));
  syncCloudData(true).catch(e => console.error('[LinkHive Sync] Background cloud sync error:', e));

  // Attach Welcome Modal listeners unconditionally so they work if opened from Settings
  const modal = document.getElementById('cloud-sync-modal');

  if (modal) {
    document.getElementById('btn-skip-login').onclick = async () => {
      hideWelcomeModal();
      await setLocalData('hasSeenWelcome', true);
    };

    document.getElementById('btn-login-google').onclick = async () => {
      const btn = document.getElementById('btn-login-google');
      const originalHTML = btn.innerHTML;
      btn.innerHTML = 'Connecting...';
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.7';

      const newUser = await signInWithGoogle();
      
      // Always restore button state (so it's ready if they log out and log in again)
      btn.innerHTML = originalHTML;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';

      if (newUser) {
        hideWelcomeModal();
        await setLocalData('hasSeenWelcome', true);
        
        await loadData(true, true); // wait for cloud, force pull
        applyTheme(false);
        renderNav();
        renderBookmarks();
        renderTodos();
        await syncAccountUI();
        syncUI();
      }
    };
  }

  // Check for first-time login (non-blocking)
  (async () => {
    const hasSeenWelcome = await getLocalData('hasSeenWelcome', false);
    if (!hasSeenWelcome && typeof getCurrentUser === 'function') {
      const user = await getCurrentUser();
      if (!user && modal) {
        showWelcomeModal();
      } else if (user) {
        await setLocalData('hasSeenWelcome', true);
      }
    }
  })().catch(e => console.error(e));

  // Listen for storage changes from background script (e.g. quick save)
  // so the new tab page auto-refreshes without needing a reload
  if (typeof chrome !== 'undefined' && chrome.storage) {
    let selfSaving = false;
    const origSaveData = saveData;
    saveData = async function(scopes) {
      selfSaving = true;
      await origSaveData(scopes);
      // Reset after a short delay to allow storage events to propagate
      setTimeout(() => { selfSaving = false; }, 500);
    };

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (selfSaving) return; // Ignore our own saves
      
      const relevantKeys = ['bookmarks', 'cards', 'tabs', 'settings'];
      const hasRelevantChange = relevantKeys.some(key => key in changes);
      
      if (hasRelevantChange) {
        // Reload data from storage and re-render
        (async () => {
          await loadData();
          applyTheme(false);
          renderNav();
          renderBookmarks();
          syncUI();
        })();
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('click', (e) => {
  if (!e.target.closest('.group.relative.flex.flex-col')) {
    document.querySelectorAll('.tab-dropdown').forEach(d => d.classList.add('hidden'));
  }
});
