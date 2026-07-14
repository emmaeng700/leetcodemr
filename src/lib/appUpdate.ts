/** Wipe SW + caches and reload so the browser fetches the live deployment. */
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

  const url = new URL(window.location.href)
  url.searchParams.set('_refresh', String(Date.now()))
  window.location.replace(url.toString())
}
