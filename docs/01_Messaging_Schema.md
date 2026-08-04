# Messaging Schema

This document defines the schema for all cross-script messaging (`chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`) used within the extension.

## Message Format

All messages should follow this consistent JSON structure:

```json
{
  "type": "ACTION_TYPE",
  "payload": {
    // Data specific to the action
  }
}
```

## Defined Message Types

### 1. `QUICK_SAVE_PAGE`
* **Direction:** Content Script / Popup -> Background Worker
* **Description:** Initiates saving a page.
* **Payload:**
  ```json
  {
    "url": "https://example.com",
    "title": "Example Page"
  }
  ```
* **Response:**
  ```json
  {
    "success": true,
    "bookmarkId": "12345"
  }
  ```

*(Add more message types here as they are implemented)*
