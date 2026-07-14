export const DESC_IMAGES_MANIFEST = '/description-images-manifest.json'
/** Bump when cache logic changes so we re-fill lm-images (v1 was often marked done early). */
export const DESC_IMAGES_CACHE_KEY = 'lm_desc_images_cached_v2'
export const DESC_IMAGES_CACHE_NAME = 'lm-images'

function isUsableImageResponse(res: Response, path: string): boolean {
  if (!res.ok) return false
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  // Auth redirect used to cache /login HTML into lm-images — never treat as image.
  if (ct.includes('text/html') || ct.includes('application/json') || ct.includes('text/plain')) {
    return false
  }
  if (ct.startsWith('image/')) return true
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(path)
}

async function isUsableCached(res: Response | undefined, path: string): Promise<boolean> {
  if (!res) return false
  return isUsableImageResponse(res, path)
}

export async function loadDescriptionImagePaths(): Promise<string[]> {
  try {
    const res = await fetch(DESC_IMAGES_MANIFEST, { cache: 'reload' })
    if (res.ok) {
      const paths = (await res.json()) as string[]
      if (Array.isArray(paths) && paths.length > 0) return paths
    }
  } catch {
    /* offline or network error */
  }

  if (typeof caches !== 'undefined') {
    for (const cacheName of [
      'lm-v30', 'lm-v29', 'lm-v28', 'lm-v27', 'lm-v26', 'lm-v25', 'lm-v24',
      'lm-v23', 'lm-v22', 'lm-v21', 'lm-v20', 'lm-v16', 'lm-v15', 'lm-v13',
    ]) {
      try {
        const cache = await caches.open(cacheName)
        const cached = await cache.match(DESC_IMAGES_MANIFEST, { ignoreSearch: true })
        if (cached) {
          const paths = (await cached.json()) as string[]
          if (Array.isArray(paths) && paths.length > 0) return paths
        }
      } catch {
        /* ignore */
      }
    }
  }

  return []
}

export async function countCachedDescriptionImages(
  paths?: string[],
): Promise<{ cached: number; total: number }> {
  const list = paths ?? (await loadDescriptionImagePaths())
  if (list.length === 0 || typeof caches === 'undefined') {
    return { cached: 0, total: list.length }
  }
  const cache = await caches.open(DESC_IMAGES_CACHE_NAME)
  const opts = { ignoreSearch: true, ignoreVary: true }
  let cached = 0
  // Sample in parallel batches for speed
  const batch = 40
  for (let i = 0; i < list.length; i += batch) {
    const slice = list.slice(i, i + batch)
    const hits = await Promise.all(
      slice.map(async path => {
        const hit = await cache.match(path, opts)
        return isUsableCached(hit, path)
      }),
    )
    cached += hits.filter(Boolean).length
  }
  return { cached, total: list.length }
}

export async function areDescriptionImagesReady(paths?: string[]): Promise<boolean> {
  const { cached, total } = await countCachedDescriptionImages(paths)
  if (total === 0) return true
  // Allow a few misses (deleted assets) but require nearly full set for offline.
  return cached >= Math.max(1, Math.floor(total * 0.95))
}

function markDescriptionImagesDone() {
  try {
    localStorage.setItem(DESC_IMAGES_CACHE_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

async function cachePathsDirect(
  paths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (!('caches' in window)) return 0
  const cache = await caches.open(DESC_IMAGES_CACHE_NAME)
  const opts = { ignoreSearch: true, ignoreVary: true }
  let cached = 0
  const batch = 10
  for (let i = 0; i < paths.length; i += batch) {
    const slice = paths.slice(i, i + batch)
    await Promise.all(
      slice.map(async path => {
        try {
          const existing = await cache.match(path, opts)
          if (await isUsableCached(existing, path)) {
            cached++
            return
          }
          if (existing) await cache.delete(path, opts)
          const res = await fetch(path, { cache: 'reload', credentials: 'same-origin' })
          if (isUsableImageResponse(res, path)) {
            await cache.put(path, res.clone())
            cached++
          }
        } catch {
          /* ignore */
        }
      }),
    )
    onProgress?.(Math.min(i + batch, paths.length), paths.length)
  }
  return cached
}

/** Cache every /description-images asset for offline Grind. */
export async function cacheAllDescriptionImages(
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  if (typeof window === 'undefined' || !navigator.onLine) return 0

  const paths = await loadDescriptionImagePaths()
  if (paths.length === 0) return 0

  if (await areDescriptionImagesReady(paths)) {
    markDescriptionImagesDone()
    onProgress?.(paths.length, paths.length)
    return paths.length
  }

  // Kick SW (keeps going via waitUntil even if we fall through to direct).
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const worker = reg.active || reg.waiting || reg.installing
      if (worker) {
        await new Promise<void>(resolve => {
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            navigator.serviceWorker.removeEventListener('message', onMsg)
            resolve()
          }
          const onMsg = (ev: MessageEvent) => {
            const data = ev.data as { type?: string; done?: number; total?: number }
            if (data?.type === 'DESC_IMG_PROGRESS' && data.done != null && data.total != null) {
              onProgress?.(data.done, data.total)
            }
            if (data?.type === 'DESC_IMG_DONE') finish()
          }
          navigator.serviceWorker.addEventListener('message', onMsg)
          worker.postMessage({ type: 'CACHE_DESCRIPTION_IMAGES', paths })
          // Do not mark complete on timeout — just stop waiting and finish via direct put.
          setTimeout(finish, 90_000)
        })
        if (await areDescriptionImagesReady(paths)) {
          markDescriptionImagesDone()
          return paths.length
        }
      }
    } catch {
      /* fall through */
    }
  }

  const n = await cachePathsDirect(paths, onProgress)
  if (await areDescriptionImagesReady(paths)) {
    markDescriptionImagesDone()
  } else {
    // Clear false "done" from older versions so next online session retries.
    try {
      localStorage.removeItem(DESC_IMAGES_CACHE_KEY)
    } catch {
      /* ignore */
    }
  }
  return n
}

export function descriptionImagesCached(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return !!localStorage.getItem(DESC_IMAGES_CACHE_KEY)
  } catch {
    return false
  }
}
