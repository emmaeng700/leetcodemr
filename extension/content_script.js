// Bridge between the LeetMastery web app and the extension service worker.
// The web app uses window.postMessage; this content script forwards to chrome.runtime.
//
// Content scripts run in an isolated world — window.foo set here is NOT visible
// to the page's main-world JavaScript. We inject a tiny <script> element to set
// the flag and the postMessage listener inside the main world instead.

;(() => {
  // ── Part 1: inject main-world shim ──────────────────────────────────────────
  // Sets __LEETMASTERY_LC_BRIDGE__ and a message relay so the page's React code
  // can detect the extension and send requests through it.
  const mainWorldCode = `
;(function() {
  if (window.__LEETMASTERY_LC_BRIDGE__) return; // already injected
  window.__LEETMASTERY_LC_BRIDGE__ = true;

  // Forward page->ext messages to the isolated content-script world.
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.__lm_lc_bridge__ !== true) return;
    if (data.direction !== 'page->ext') return;
    // Re-dispatch with a marker so the isolated-world listener can pick it up.
    window.dispatchEvent(new CustomEvent('__lm_lc_relay__', { detail: data }));
  });
})();
`
  const s = document.createElement('script')
  s.textContent = mainWorldCode
  ;(document.head || document.documentElement).appendChild(s)
  s.remove()

  // ── Part 2: isolated-world relay ────────────────────────────────────────────
  // Listens for the CustomEvent fired by the main-world shim and forwards it to
  // the service worker via chrome.runtime.sendMessage, then posts the response
  // back to the page.
  function postToPage(msg) {
    window.postMessage(msg, '*')
  }

  window.addEventListener('__lm_lc_relay__', function(event) {
    const data = event.detail
    if (!data) return

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
