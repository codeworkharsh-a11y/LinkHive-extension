const supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

async function signInWithGoogle() {
  const redirectUrl = chrome.identity.getRedirectURL();
  console.log('Redirect URL for OAuth:', redirectUrl);

  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true // Crucial for Chrome extensions
    }
  });

  if (error || !data.url) {
    console.error('Error getting OAuth URL:', error);
    alert('Failed to connect to Google via Supabase! Please make sure you have fully enabled and configured the Google Provider in your Supabase dashboard (Authentication -> Providers -> Google). Error: ' + (error ? error.message : 'No URL returned'));
    return null;
  }

  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow({
      url: data.url,
      interactive: true
    }, async (callbackUrl) => {
      if (chrome.runtime.lastError) {
        let msg = chrome.runtime.lastError.message;
        if (!msg) msg = JSON.stringify(chrome.runtime.lastError);
        if (typeof msg !== 'string') msg = String(msg);

        console.error('Auth flow error:', chrome.runtime.lastError);

        if (msg.toLowerCase().includes('user cancel')) {
          console.log('Login window was closed by the user.');
        } else if (msg.toLowerCase().includes('could not be loaded')) {
          alert('Google Login failed! ' + msg + '\n\nThis usually means your Google Provider in Supabase is incomplete, disabled, or missing the Client ID/Secret. \n\nI will now open the raw login link in a new tab so you can read the exact error from Supabase.');
          window.open(data.url, '_blank');
        } else {
          alert('Google Login failed! ');
        }

        resolve(null);
        return;
      }

      if (!callbackUrl) {
        resolve(null);
        return;
      }

      const urlObj = new URL(callbackUrl);
      const hashParams = urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)) : new URLSearchParams();
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const code = urlObj.searchParams.get('code');
      const error_desc = urlObj.searchParams.get('error_description') || hashParams.get('error_description');

      if (error_desc) {
        console.error('Login Error:', error_desc);
        alert('Google Login Failed: ' + error_desc);
        resolve(null);
        return;
      }

      if (code) {
        // Handle PKCE Flow
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.exchangeCodeForSession(code);
        if (sessionError) {
          console.error('Error exchanging code:', sessionError);
          alert('Could not establish session: ' + sessionError.message);
          resolve(null);
        } else {
          resolve(sessionData.user);
        }
      } else if (access_token && refresh_token) {
        // Handle Implicit Flow
        const { data: sessionData, error: sessionError } = await supabaseClient.auth.setSession({
          access_token,
          refresh_token
        });
        if (sessionError) {
          console.error('Error setting session:', sessionError);
          alert('Could not establish session: ' + sessionError.message);
          resolve(null);
        } else {
          resolve(sessionData.user);
        }
      } else {
        console.error('No auth tokens found in callback:', callbackUrl);
        alert('Authentication failed. No tokens returned by Google/Supabase.');
        resolve(null);
      }
    });
  });
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function getCurrentUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session ? session.user : null;
}

// Modular Sync Tables
const SYNC_TABLES = {
  BOOKMARKS: 'user_bookmarks',
  TODOS: 'user_todos',
  NOTES: 'user_notes',
  CARDS: 'user_cards',
  TABS: 'user_tabs',
  SETTINGS: 'user_settings'
};

/**
 * Fetch all modular user data in parallel from individual Supabase tables.
 * Returns an object containing the data and updated_at timestamps for each domain.
 */
async function fetchModularUserData(userId) {
  if (!userId || !supabaseClient) return null;

  const tableKeys = [
    { key: 'bookmarks', table: SYNC_TABLES.BOOKMARKS },
    { key: 'todos', table: SYNC_TABLES.TODOS },
    { key: 'notes', table: SYNC_TABLES.NOTES },
    { key: 'cards', table: SYNC_TABLES.CARDS },
    { key: 'tabs', table: SYNC_TABLES.TABS },
    { key: 'settings', table: SYNC_TABLES.SETTINGS }
  ];

  const results = await Promise.allSettled(
    tableKeys.map(async ({ key, table }) => {
      const { data, error } = await supabaseClient
        .from(table)
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn(`[LinkHive Sync] Fetch warning for ${table}:`, error.message);
        return { key, table, data: null, updatedAt: null, error };
      }
      return {
        key,
        table,
        data: data ? data.data : null,
        updatedAt: data && data.updated_at ? new Date(data.updated_at).getTime() : null,
        error: null
      };
    })
  );

  const modularData = {};
  const timestamps = {};
  let hasAnyData = false;

  results.forEach(res => {
    if (res.status === 'fulfilled' && res.value) {
      const { key, data, updatedAt } = res.value;
      if (data !== null && data !== undefined) {
        modularData[key] = data;
        timestamps[key] = updatedAt;
        hasAnyData = true;
      }
    }
  });

  return { hasAnyData, data: modularData, timestamps };
}

/**
 * Fetch data from the legacy single-row 'user_data' table (for backward compatibility / auto-migration)
 */
async function fetchLegacyUserData(userId) {
  if (!userId || !supabaseClient) return null;
  try {
    const { data, error } = await supabaseClient
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[LinkHive Sync] Legacy user_data fetch warning:', error.message);
    }
    return data && data.data ? data.data : null;
  } catch (e) {
    console.warn('[LinkHive Sync] Legacy fetch exception:', e);
    return null;
  }
}

/**
 * Upsert a single domain's data to its respective table in Supabase.
 */
async function upsertModularData(userId, tableName, domainData, timestamp = Date.now()) {
  if (!userId || !supabaseClient) return { success: false, error: 'No user or client' };

  const payload = {
    user_id: userId,
    data: domainData,
    updated_at: new Date(timestamp).toISOString()
  };

  const { error } = await supabaseClient
    .from(tableName)
    .upsert(payload);

  if (error) {
    console.error(`[LinkHive Sync] Upsert failed for ${tableName}:`, error.message || error);
    return { success: false, error };
  }

  return { success: true };
}

