const CACHE     = 'lm-v5'
const IMG_CACHE = 'lm-images'   // stable — never wiped on SW updates

// Only cache resources that don't require auth cookies.
// App pages are cached by the network-first handler as the user visits them,
// OR via CACHE_PAGES message sent from the client (with auth cookies).
const PRECACHE = [
  '/offline.html',
  '/questions_full.json',
  '/behavioral_questions.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

// Inline fallback — used if /offline.html itself isn't cached yet.
// Never shows a blank page or Safari's "This page couldn't load".
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Offline — LeetMastery</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f9fafb;min-height:100vh;display:flex;flex-direction:column;
         align-items:center;justify-content:center;padding:1.5rem;gap:1.25rem}
    .card{background:#fff;border-radius:1.25rem;padding:2rem 1.75rem;
          max-width:380px;width:100%;text-align:center;
          box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{width:52px;height:52px;background:#eef2ff;border-radius:1rem;
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 1rem;font-size:1.6rem}
    h1{font-size:1.1rem;font-weight:700;color:#111827;margin-bottom:.4rem}
    p{font-size:.85rem;color:#6b7280;line-height:1.6;margin-bottom:1.25rem}
    .btn{background:#4f46e5;color:#fff;border:none;border-radius:.75rem;
         padding:.6rem 1.25rem;font-size:.85rem;font-weight:600;
         cursor:pointer;width:100%;margin-bottom:.5rem;
         text-decoration:none;display:block}
    .nav{background:#fff;border-radius:1.25rem;padding:1.25rem 1.75rem;
         max-width:380px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.06)}
    .nav-label{font-size:.7rem;font-weight:700;text-transform:uppercase;
               letter-spacing:.06em;color:#9ca3af;margin-bottom:.75rem}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
    a.link{display:flex;align-items:center;gap:.5rem;padding:.6rem .75rem;
           background:#f3f4f6;border-radius:.625rem;text-decoration:none;
           font-size:.8rem;font-weight:500;color:#374151}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>This page needs internet</h1>
    <p>You're offline. Go back or visit a page that works without internet.</p>
    <a class="btn" onclick="history.length>1?history.back():location.href='/'" href="/">← Go back</a>
  </div>
  <div class="nav">
    <div class="nav-label">Works offline</div>
    <div class="grid">
      <a class="link" href="/">🏠 Questions</a>
      <a class="link" href="/flashcards">🃏 Flashcards</a>
      <a class="link" href="/speedster">⚡ Speedster</a>
      <a class="link" href="/behavioral">🎯 Behavioral</a>
      <a class="link" href="/system-design">🏗️ System Design</a>
      <a class="link" href="/dsa">📐 DSA</a>
      <a class="link" href="/gems">💎 Gems</a>
      <a class="link" href="/patterns">🔁 Patterns</a>
      <a class="link" href="/quick-review">⚡ Quick Review</a>
      <a class="link" href="/about">ℹ️ About</a>
    </div>
  </div>
</body>
</html>`

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache each item individually — one failure never breaks the whole install
      await Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(() => {})
        )
      )
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // Delete old page caches; KEEP lm-images so images survive SW updates
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // ── Question images: dedicated stable cache ───────────────────────────────
  if (url.pathname.startsWith('/question-images/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(imgCache =>
        imgCache.match(e.request).then(cached => {
          if (cached) return cached
          return fetch(e.request)
            .then(res => {
              if (res.ok) imgCache.put(e.request, res.clone())
              return res
            })
            .catch(() => new Response('', { status: 404 }))
        })
      )
    )
    return
  }

  // ── Static assets: cache-first ────────────────────────────────────────────
  const isStatic =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/data/')   ||
    url.pathname.startsWith('/icons/')        ||
    url.pathname.endsWith('.json')            ||
    url.pathname.endsWith('.jpg')             ||
    url.pathname.endsWith('.png')             ||
    url.pathname.endsWith('.svg')             ||
    url.pathname.endsWith('.ico')             ||
    url.pathname.endsWith('.woff2')           ||
    url.pathname.endsWith('.woff')            ||
    url.pathname === '/offline.html'

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request)
          .then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
            return res
          })
          .catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // ── Pages: network-first → cache → inline offline page ───────────────────
  // Never lets the browser show its own "couldn't load" error.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      })
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached

        if (e.request.mode === 'navigate') {
          // Try the cached offline.html first, fall back to inline HTML
          const offlinePage = await caches.match('/offline.html')
          return offlinePage || offlineResponse()
        }

        return new Response('', { status: 503 })
      })
  )
})

// ── Cache app pages message (sent from client with auth cookies) ──────────────
// Pages require auth, so they can only be cached after the user is logged in.
// The client sends this message with credentials already in the cookie jar.
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_PAGES') {
    const pages = e.data.pages || []
    caches.open(CACHE).then(async cache => {
      for (const url of pages) {
        try {
          const existing = await cache.match(url)
          if (!existing) {
            const res = await fetch(url, { credentials: 'include' })
            if (res.ok) await cache.put(url, res)
          }
        } catch {}
      }
    })
  }
})

// ── Cache all images message from the app ─────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_ALL_IMAGES') {
    const ids = e.data.ids || []
    caches.open(IMG_CACHE).then(async imgCache => {
      let done = 0
      for (const id of ids) {
        const url = `/question-images/${id}.jpg`
        try {
          const existing = await imgCache.match(url)
          if (!existing) {
            const res = await fetch(url)
            if (res.ok) await imgCache.put(url, res)
          }
        } catch {}
        done++
        const clients = await self.clients.matchAll()
        clients.forEach(c => c.postMessage({ type: 'CACHE_PROGRESS', done, total: ids.length }))
      }
      const clients = await self.clients.matchAll()
      clients.forEach(c => c.postMessage({ type: 'CACHE_DONE' }))
    })
  }
})
