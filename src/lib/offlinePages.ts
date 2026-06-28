/** Static assets precached for offline Grind (see public/sw-v10.js). */
export const OFFLINE_PAGES = ['/grind-offline.html'] as const

export const GRIND_OFFLINE_PATH = '/grind-offline.html'

/** Links shown on public/offline.html */
export const OFFLINE_NAV_LINKS: { href: string; emoji: string; label: string }[] = [
  { href: GRIND_OFFLINE_PATH, label: 'Grind', emoji: '??' },
]
