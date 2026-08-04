# Feature: Granular Cloud Sync

## Overview
Replaces the legacy monolithic cloud persistence architecture with a domain-scoped, granular synchronization model. Each data entity (bookmarks, todos, notepads, cards, tabs, settings) lives in its own dedicated Supabase table and is synchronized independently when dirty.

## User Stories
- As a user checking off a todo or typing a note, I want my change synchronized to the cloud instantly without re-uploading hundreds of kilobytes of bookmarks and wallpapers.
- As a user with multiple devices, I want conflicting changes in one domain (e.g., todos) not to overwrite or wipe out bookmarks edited on another device.
- As an existing user with legacy data in `user_data`, I want my data to seamlessly and automatically migrate to the new modular tables upon sign-in.

## Technical Implementation
- **Files Modified:**
  - `supabase_schema.sql`: SQL definitions for `user_bookmarks`, `user_todos`, `user_notes`, `user_cards`, `user_tabs`, and `user_settings` with Row-Level Security (RLS) policies and `last_modified` triggers.
  - `supabase.js`: Added modular sync helpers (`fetchModularUserData`, `upsertModularData`).
  - `script.js`:
    - Updated `state.domainLastModified` dictionary for granular staleness checking.
    - Updated `saveData(scopes)` to accept domain scopes and maintain `pendingCloudSyncDomains`.
    - Updated `debouncedSupabaseSync()` to upload only dirty domains.
    - Updated `loadData()` to compare timestamps per domain and migrate legacy monolithic data.
    - Audited and updated all UI event listeners to pass precise scopes.
- **Dependencies:** Supabase JS client.
- **Permissions:** Standard storage and identity permissions (no new Manifest V3 permissions required).

## Edge Cases
- **Offline / Network Interruption:** Local changes persist in `chrome.storage.local`. Dirty domains remain in `pendingCloudSyncDomains` until the next successful sync cycle.
- **Legacy Migration:** If a user logs in and the new modular tables are empty, `loadData()` checks `user_data` and populates the modular tables automatically.
- **Concurrent Tab / Window Updates:** `chrome.storage.onChanged` triggers UI refreshes while avoiding self-save loops via a debounced flag.

## Testing Strategy
- Manual verification of todo creation, bookmark creation, notepad editing, and settings changes.
- Verify network console logs confirm only dirty domain tables are upserted.
- Verify full backup export and import functionality remain intact.
