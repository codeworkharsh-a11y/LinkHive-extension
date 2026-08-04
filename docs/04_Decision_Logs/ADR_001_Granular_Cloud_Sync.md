# ADR 001: Granular Cloud Sync Architecture

**Date:** 2026-08-04
**Status:** Accepted

## Context
Previously, all user state (bookmarks, todos, notes, tabs, settings, cards) was stored as a single monolithic JSON snapshot in the `user_data` Supabase table. Every change (e.g. toggling a single todo checkbox) triggered a full-state upload (often hundreds of KB), causing high bandwidth usage, database write overhead, and increased risk of write collisions.

## Decision
1. **Modular Relational Database Schema:** Split data into domain-specific tables:
   - `user_bookmarks`
   - `user_todos`
   - `user_notes`
   - `user_cards`
   - `user_tabs`
   - `user_settings`
   Each row contains `user_id` (PK / FK to auth.users), `data` (JSONB), and `last_modified` (TIMESTAMPTZ).
2. **Domain-Scoped Dirty State Tracking:** Added `pendingCloudSyncDomains` set and updated `saveData(scopes)` to accept domain names (`'bookmarks'`, `'todos'`, `'notes'`, `'cards'`, `'tabs'`, `'settings'`).
3. **Targeted Debounced Sync:** `debouncedSupabaseSync()` processes only the dirty domains and invokes `upsertModularData(user.id, domain, data)`.
4. **Backward Compatibility:** `loadData()` checks modular tables on load; if empty but legacy monolithic record exists, it automatically migrates existing user data into modular tables.

## Consequences
- **Positive:** Bandwidth consumption drops significantly per action (e.g., editing a single todo uploads ~1-5 KB instead of >300 KB).
- **Positive:** Database row locking and throughput improve significantly.
- **Positive:** Local `chrome.storage.local` caching remains fast and unchanged.
