/** App routes that work offline (static JSON + localStorage). Precached by the service worker. */
export const OFFLINE_PAGES = [
  '/',
  '/grind',
  '/flashcards',
  '/cycles',
  '/daily',
  '/behavioral',
  '/system-design',
  '/dsa',
  '/gems',
  '/patterns',
  '/quick-review',
  '/about',
] as const

/** Links shown on public/offline.html */
export const OFFLINE_NAV_LINKS: { href: string; emoji: string; label: string }[] = [
  { href: '/', label: 'Questions', emoji: '??' },
  { href: '/grind', label: 'Grind', emoji: '??' },
  { href: '/flashcards', label: 'Flashcards', emoji: '??' },
  { href: '/daily', label: 'Daily', emoji: '??' },
  { href: '/cycles', label: 'Cycles', emoji: '??' },
  { href: '/behavioral', label: 'Behavioral', emoji: '??' },
  { href: '/system-design', label: 'System Design', emoji: '???' },
  { href: '/dsa', label: 'DSA', emoji: '??' },
  { href: '/gems', label: 'Gems', emoji: '??' },
  { href: '/patterns', label: 'Patterns', emoji: '??' },
  { href: '/quick-review', label: 'Quick Review', emoji: '?' },
  { href: '/about', label: 'About', emoji: '??' },
]
