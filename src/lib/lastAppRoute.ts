/** Persist last in-app URL so mobile PWAs can resume after background/kill. */

export const LAST_APP_ROUTE_KEY = 'lm_last_app_route'

const DEFAULT_LANDING_ROUTES = new Set(['/grind'])

const SKIP_PREFIXES = ['/login']

export function isDefaultLandingRoute(pathname: string): boolean {
  return DEFAULT_LANDING_ROUTES.has(pathname)
}

export function shouldRememberAppRoute(pathname: string): boolean {
  if (!pathname || pathname === '/') return false
  return !SKIP_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

export function readLastAppRoute(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LAST_APP_ROUTE_KEY)?.trim()
    if (!raw || !raw.startsWith('/')) return null
    const path = raw.split('?')[0] ?? raw
    if (!shouldRememberAppRoute(path)) return null
    return raw
  } catch {
    return null
  }
}

export function writeLastAppRoute(fullPath: string): void {
  if (typeof window === 'undefined') return
  const path = fullPath.split('?')[0] ?? fullPath
  if (!shouldRememberAppRoute(path)) return
  try {
    localStorage.setItem(LAST_APP_ROUTE_KEY, fullPath)
  } catch { /* quota / private mode */ }
}

export function currentAppRoute(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname}${window.location.search}`
}
