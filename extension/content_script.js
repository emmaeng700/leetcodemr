// Bridge between the LeetMastery web app and the extension service worker.
//
// Content scripts run in an isolated world — window.foo set here is NOT visible
// to the page's main-world JS. DOM attributes ARE shared, so we set one as the
// presence flag instead of window.__LEETMASTERY_LC_BRIDGE__.
//
// window.postMessage / window.addEventListener('message') DO cross the isolated-
// world boundary, so message relay works without any extra indirection.

;(() => {
  // Signal presence via a DOM attribute readable by the React app.
  try {
    ;(document.documentElement || document.body)?.setAttribute('data-lm-bridge', 'true')
  } catch {}

  function postToPage(msg) {
    window.postMessage(msg, '*')
  }

  // Relay page→ext messages to the service worker.
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
