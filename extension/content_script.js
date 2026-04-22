// Bridge between the LeetMastery web app and the extension service worker.
// The web app uses window.postMessage; this content script forwards to chrome.runtime.

(() => {
  // Mark presence for quick detection.
  try {
    window.__LEETMASTERY_LC_BRIDGE__ = true
  } catch {}

  function postToPage(msg) {
    window.postMessage(msg, '*')
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const data = event.data
    if (!data || data.__lm_lc_bridge__ !== true) return
    if (data.direction !== 'page->ext') return

    chrome.runtime.sendMessage(
      { ...data, direction: 'ext->bg' },
      (resp) => {
        const err = chrome.runtime.lastError
        if (err) {
          postToPage({
            __lm_lc_bridge__: true,
            direction: 'ext->page',
            id: data.id,
            ok: false,
            error: String(err.message || err),
          })
          return
        }
        postToPage({ __lm_lc_bridge__: true, direction: 'ext->page', id: data.id, ...resp })
      },
    )
  })
})()

