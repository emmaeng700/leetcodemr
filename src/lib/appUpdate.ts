const FALLBACK_PRODUCTION_ORIGIN = 'https://leetcodemr.vercel.app'

/** Canonical production origin (baked at build from Vercel when available). */
export function getProductionOrigin(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_APP_ORIGIN || '').trim().replace(/\/$/, '')
  return fromEnv || FALLBACK_PRODUCTION_ORIGIN
}

/**
 * True for per-deploy Vercel preview hosts like
 * leetcodemr-opc96rb3s-emmanuels-projects-….vercel.app
 * (not the stable production alias).
 */
export function isVercelPreviewHost(hostname: string): boolean {
  if (!hostname.endsWith('.vercel.app')) return false
  try {
    const prodHost = new URL(getProductionOrigin()).hostname
    if (hostname === prodHost) return false
  } catch {
    /* ignore */
  }
  // Deployment / branch previews always contain a hash segment before the team slug.
  return /-[a-z0-9]+-/.test(hostname) || hostname.includes('-git-')
}

/** Wipe SW + caches and reload onto production so you get the newest main deploy. */
export async function forceAppReload(): Promise<void> {
  if (typeof window === 'undefined') return

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map(reg => reg.unregister()))
  }

  const current = new URL(window.location.href)
  let target: URL
  if (isVercelPreviewHost(current.hostname)) {
    // Stay on the same path, but leave the frozen preview deployment.
    target = new URL(current.pathname + current.search + current.hash, getProductionOrigin())
  } else {
    target = current
  }
  target.searchParams.set('_refresh', String(Date.now()))
  window.location.replace(target.toString())
}
