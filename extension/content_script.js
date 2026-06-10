// Stamp the extension ID onto the DOM so the page can reach the service worker
// directly via chrome.runtime.sendMessage(extensionId, ...) — externally_connectable
// makes chrome.runtime available on permitted origins without a postMessage relay.
try {
  document.documentElement.setAttribute('data-lm-ext-id', chrome.runtime.id)
} catch {}
