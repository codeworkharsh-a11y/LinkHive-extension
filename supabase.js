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
          alert('Login window was closed.\n\nIf the window got stuck on a blank page or localhost, it means you MUST add this exact URL to your Supabase "Redirect URLs" list:\n\n' + redirectUrl + '\n\nPlease add it in Supabase -> Authentication -> URL Configuration -> Redirect URLs.');
        } else if (msg.toLowerCase().includes('could not be loaded')) {
          alert('Google Login failed! ' + msg + '\n\nThis usually means your Google Provider in Supabase is incomplete, disabled, or missing the Client ID/Secret. \n\nI will now open the raw login link in a new tab so you can read the exact error from Supabase.');
          window.open(data.url, '_blank');
        } else {
          alert('Google Login failed! ' + msg + '\n\nTip: Make sure you added ' + redirectUrl + ' to the Redirect URLs in your Supabase dashboard.');
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
