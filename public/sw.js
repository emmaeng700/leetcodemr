const CACHE     = 'lm-v4'
const IMG_CACHE = 'lm-images'   // stable — never wiped on SW updates

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
      // Delete old page caches but KEEP lm-images so cached images survive SW updates
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

  // ── Question images: use dedicated stable cache ──────────────────────────
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

  // ── Other static assets: cache-first in main cache ───────────────────────
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
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // ── Pages: network-first, fall back to cache, then offline.html ──────────
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      })
      .catch(() =>
        caches.match(e.request).then(cached => {
          if (cached) return cached
          if (e.request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
          return new Response('', { status: 503 })
        })
      )
  )
})

// ── Cache all images message from the app ────────────────────────────────────
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
