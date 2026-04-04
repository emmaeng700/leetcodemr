const CACHE = 'lm-v4'

// Pages and assets to pre-cache on install
const PRECACHE = [
  '/',
  '/offline.html',
  '/flashcards',
  '/speedster',
  '/behavioral',
  '/system-design',
  '/dsa',
  '/gems',
  '/patterns',
  '/quick-review',
  '/about',
  '/daily',
  '/review',
  '/sr-queue',
  '/stats',
  '/line-game',
  '/mock',
  '/leetcode-api',
  '/questions_full.json',
  '/behavioral_questions.json',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache each item individually so one failure doesn't break the whole install
      await Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(() => { /* skip if unavailable */ })
        )
      )
      return self.skipWaiting()
    })
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Only handle GET from same origin
  if (e.request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // Never intercept API routes (need live network)
  if (url.pathname.startsWith('/api/')) return

  const isStatic =
    url.pathname.startsWith('/_next/static/') ||   // JS/CSS chunks
    url.pathname.startsWith('/_next/data/') ||      // RSC payloads
    url.pathname.startsWith('/question-images/') || // question images
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname === '/offline.html'

  if (isStatic) {
    // Cache-first: serve instantly, fetch & store if missing
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => {
          // For images, return empty 404 rather than breaking the page
          if (url.pathname.startsWith('/question-images/')) {
            return new Response('', { status: 404 })
          }
          return new Response('', { status: 503 })
        })
      })
    )
    return
  }

  // Network-first for pages: try network (update cache), fall back to cache, then offline.html
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached
          // Fall back to offline page for navigation requests
          if (e.request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
          return new Response('', { status: 503 })
        })
      )
  )
})

// Listen for cache-images message from the app
self.addEventListener('message', e => {
  if (e.data?.type === 'CACHE_ALL_IMAGES') {
    const ids = e.data.ids || []
    caches.open(CACHE).then(async cache => {
      let done = 0
      for (const id of ids) {
        const url = `/question-images/${id}.jpg`
        try {
          const existing = await cache.match(url)
          if (!existing) {
            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
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
