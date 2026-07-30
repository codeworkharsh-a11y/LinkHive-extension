# Architecture

## Overview
LinkHive is a Chrome Extension (Manifest V3) that serves as a personal bookmark and productivity dashboard for the new tab page.

## Tech Stack
- **Core:** HTML, Vanilla JavaScript
- **Styling:** Tailwind CSS (built via PostCSS)
- **Manifest Version:** MV3

## Key Components
- **Background Service Worker (`background.js`):** Handles background tasks and event listening.
- **Content Script (`content.js`):** Injected into all URLs (`<all_urls>`) to interact with web pages.
- **New Tab Override (`newtab.html` & `script.js`):** The primary UI of the extension, replacing the default new tab page.

## Permissions
- `storage`: For saving settings and bookmarks locally.
- `unlimitedStorage`: To store larger amounts of data without quota restrictions.
- `tabs`: To interact with the browser's tab system.
- `scripting`: To execute scripts in tabs.
- `activeTab`: To get temporary access to the currently active tab.
- `notifications`: To display system notifications.

## Host Permissions
- `<all_urls>`: Broad access for content scripts and network requests.

## Commands
- `quick-save` (Alt+Shift+S): Quick Save current page to LinkHive.
