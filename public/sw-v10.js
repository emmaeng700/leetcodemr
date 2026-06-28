const CACHE     = 'lm-v10'
const IMG_CACHE = 'lm-images'

// Static offline Grind (always precached — no Next.js chunks required).
const GRIND_OFFLINE = '/grind-offline.html'

function offlineShellPath(pathname) {
  const p = pathname.replace(/\/$/, '') || '/'
  if (p === GRIND_OFFLINE) return GRIND_OFFLINE
  if (p.startsWith('/grind')) return GRIND_OFFLINE
  return null
}

const PRECACHE = [
  '/offline.html',
  GRIND_OFFLINE,
  '/grind_questions.json',
  '/questions_full.json',
  '/behavioral_questions.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Offline - LeetMastery</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f9fafb;min-height:100vh;display:flex;align-items:center;
         justify-content:center;padding:1.5rem}
    .card{background:#fff;border-radius:1.25rem;padding:2rem 1.75rem;
          max-width:380px;width:100%;text-align:center;
          box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .icon{width:52px;height:52px;background:#ecfdf5;border-radius:1rem;
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 1rem;font-size:1.6rem}
    h1{font-size:1.1rem;font-weight:700;color:#111827;margin-bottom:.4rem}
    p{font-size:.85rem;color:#6b7280;line-height:1.6;margin-bottom:1.25rem}
    .btn{background:#059669;color:#fff;border:none;border-radius:.75rem;
         padding:.75rem 1.25rem;font-size:.9rem;font-weight:600;
         cursor:pointer;width:100%;margin-bottom:.5rem;
         text-decoration:none;display:block}
    .btn-secondary{background:#f3f4f6;color:#374151;font-weight:500}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128225;</div>
    <h1>You're offline</h1>
    <p>Grind still works without internet. Write code from memory on all 727 questions.</p>
    <a class="btn" href="/grind-offline.html">Grind - write code offline</a>
    <a class="btn btn-secondary" onclick="history.length>1?history.back():location.href='/grind-offline.html'" href="/grind-offline.html">Go back</a>
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
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k))
      ))
      .then(async () => {
        const cache = await caches.open(CACHE)
        for (const url of ['/offline.html', GRIND_OFFLINE, '/grind_questions.json']) {
          await cache.delete(url).catch(() => {})
          try {
            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
          } catch {}
        }
      })
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

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

  const isNextBuildAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/data/')

  if (isNextBuildAsset) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(async () => {
          const cached = await caches.match(e.request)
          return cached || new Response('', { status: 503 })
        })
    )
    return
  }

  if (url.pathname === GRIND_OFFLINE) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request)
          .then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
            return res
          })
          .catch(() => offlineResponse())
      })
    )
    return
  }

  if (url.pathname === '/offline.html') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request).then(c => c || offlineResponse()))
    )
    return
  }

  const isStatic =
    url.pathname.startsWith('/icons/')        ||
    url.pathname.endsWith('.json')            ||
    url.pathname.endsWith('.jpg')             ||
    url.pathname.endsWith('.png')             ||
    url.pathname.endsWith('.svg')             ||
    url.pathname.endsWith('.ico')             ||
    url.pathname.endsWith('.woff2')           ||
    url.pathname.endsWith('.woff')

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
          const shell = offlineShellPath(url.pathname)
          if (shell) {
            const shellCached = await caches.match(shell)
            if (shellCached) return shellCached
          }
          return offlineResponse()
        }

        return new Response('', { status: 503 })
      })
  )
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_PAGES') {
    const pages = e.data.pages || []
    caches.open(CACHE).then(async cache => {
      for (const url of pages) {
        try {
          const res = await fetch(url, { credentials: 'include' })
          if (res.ok) await cache.put(url, res)
        } catch {}
      }
    })
  }
})

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
