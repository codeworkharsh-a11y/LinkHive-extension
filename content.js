let currentShortcut = null;
let currentNeonAccent = '#10b981';

function fetchShortcut() {
  chrome.runtime.sendMessage({ type: 'GET_SHORTCUT' }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.shortcut) {
      currentShortcut = response.shortcut;
    }
  });
}

// Initial fetch
fetchShortcut();
window.addEventListener('focus', fetchShortcut);

chrome.storage.local.get(['settings'], (res) => {
  if (res.settings && res.settings.neonAccent) {
    currentNeonAccent = res.settings.neonAccent;
  }
});

// Keep settings in sync
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    const newSettings = changes.settings.newValue || {};
    if (newSettings.neonAccent) currentNeonAccent = newSettings.neonAccent;
  }
});

document.addEventListener('keydown', (e) => {
  if (!currentShortcut || currentShortcut === 'Not set') return;
  
  // Ignore if typing in input fields
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.target.isContentEditable) return;

  const keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.altKey) keys.push('Alt');
  if (e.shiftKey) keys.push('Shift');
  if (e.metaKey) keys.push('Meta');
  
  // Don't trigger if only modifier keys are pressed
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
  
  keys.push(e.key.toUpperCase());
  const shortcutStr = keys.join('+').replace(/\s+/g, '').toUpperCase();
  const normalizedCurrent = currentShortcut.replace(/\s+/g, '').toUpperCase();

  if (shortcutStr === normalizedCurrent) {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'QUICK_SAVE' });
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'QUICK_SAVE_SUCCESS') {
    const dest = msg.destName ? ` → ${msg.destName}/Quick Save` : '';
    showToast(`✓ Saved: ${msg.title}${dest}`, currentNeonAccent);
  } else if (msg.type === 'QUICK_SAVE_ALREADY_SAVED') {
    showToast(`⚠ Already saved: ${msg.title}`, '#f59e0b');
  } else if (msg.type === 'QUICK_SAVE_ERROR') {
    showToast(`✕ Quick Save Failed: ${msg.message}`, '#ef4444');
  }
});

function showToast(message, accentColor) {
  const color = accentColor || currentNeonAccent;
  const toast = document.createElement('div');
  
  toast.style.position = 'fixed';
  toast.style.top = '24px';
  toast.style.right = '24px';
  toast.style.backgroundColor = 'rgba(15, 23, 42, 0.9)'; // slate-900
  toast.style.backdropFilter = 'blur(12px)';
  toast.style.color = 'white';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '12px';
  toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '500';
  toast.style.boxShadow = `0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 15px ${color}40`;
  toast.style.borderLeft = `4px solid ${color}`;
  toast.style.zIndex = '9999999';
  toast.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  toast.style.transform = 'translateY(-100px) scale(0.9)';
  toast.style.opacity = '0';
  toast.style.maxWidth = '350px';
  toast.style.whiteSpace = 'nowrap';
  toast.style.overflow = 'hidden';
  toast.style.textOverflow = 'ellipsis';
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Animate in (slide down from top)
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0) scale(1)';
    toast.style.opacity = '1';
  });
  
  // Animate out (slide up)
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px) scale(0.95)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
