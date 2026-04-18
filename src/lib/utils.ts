// ── Array utils ───────────────────────────────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── URL helpers ───────────────────────────────────────────────────────────────
/** Slug fixes for outdated entries in bundled question data (LeetCode titleSlug is canonical). */
const LEETCODE_SLUG_FIX_BY_QUESTION_ID: Record<number, string> = {
  787: 'cheapest-flights-within-k-stops',
}

export function resolveLeetCodeSlug(questionId: number, slug: string | null | undefined): string {
  const raw = String(slug ?? '').trim()
  return LEETCODE_SLUG_FIX_BY_QUESTION_ID[questionId] ?? raw
}

/** Canonical problem URL (LeetCode serves the description UI on this path). */
export function leetCodeUrl(slug: string | null | undefined): string {
  const s = String(slug ?? '').trim()
  if (!s) return 'https://leetcode.com/problemset/all/'
  return `https://leetcode.com/problems/${encodeURIComponent(s)}/description/`
}

// ── Time formatting ───────────────────────────────────────────────────────────
export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Date utilities ────────────────────────────────────────────────────────────
export function formatLocalDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function isDue(nextReview: string | null): boolean {
  if (!nextReview) return false
  const [y, m, d] = nextReview.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return date <= today
}

// ── Spaced repetition ────────────────────────────────────────────────────────
// Single source of truth — imported by db.ts too so both stay in sync.
export function srInterval(n: number): number {
  const LADDER = [1, 3, 7]
  if (!Number.isFinite(n) || n < 0) return LADDER[0]
  return LADDER[Math.min(n, LADDER.length - 1)]
}

export function nextIntervalDays(reviewCount: number): number {
  return srInterval(reviewCount)
}

/**
 * Sanitize LeetCode HTML before dangerouslySetInnerHTML:
 * - Strip <script> tags
 * - Remove hardcoded width/height attributes on <img> so CSS controls sizing
 * - Wrap <table> in a scroll container div so wide tables don't break layout
 */
export function stripScripts(html: string): string {
  let out = html

  // 1. Strip script tags
  out = out.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  const normalizeLcUrl = (raw: string): string => {
    const url = raw.trim()
    if (!url) return url
    if (url.startsWith('data:')) return url
    if (url.startsWith('//')) return 'https:' + url
    if (url.startsWith('/')) return 'https://leetcode.com' + url
    return url
  }

  const pickAttr = (attrs: string, name: string): string | null => {
    const m = attrs.match(new RegExp(`\\s${name}=["']([^"']+)["']`, 'i'))
    return m?.[1] ?? null
  }

  const replaceAttr = (attrs: string, name: string, value: string): string => {
    if (new RegExp(`\\s${name}=`, 'i').test(attrs)) {
      return attrs.replace(new RegExp(`\\s${name}=["'][^"']*["']`, 'i'), ` ${name}="${value}"`)
    }
    return `${attrs} ${name}="${value}"`
  }

  // 2. Normalize LeetCode image tags:
  //    - remove hardcoded width/height/style attrs so CSS controls sizing
  //    - fix lazy-loaded images (data-src) by copying to src
  //    - normalize src/srcset URLs (//... or /... -> https://...)
  out = out.replace(/<img([^>]*?)>/gi, (_m, attrs: string) => {
    let cleaned = attrs
      .replace(/\s+width=["'][^"']*["']/gi, '')
      .replace(/\s+height=["'][^"']*["']/gi, '')
      .replace(/\s+style=["'][^"']*["']/gi, '')

    const src = pickAttr(cleaned, 'src')
    const dataSrc = pickAttr(cleaned, 'data-src') ?? pickAttr(cleaned, 'dataSrc') ?? pickAttr(cleaned, 'data-original')
    const finalSrc = normalizeLcUrl(src ?? dataSrc ?? '')
    if (finalSrc) cleaned = replaceAttr(cleaned, 'src', finalSrc)

    const srcSet = pickAttr(cleaned, 'srcset') ?? pickAttr(cleaned, 'data-srcset')
    if (srcSet) {
      const normalized = srcSet
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const [u, descriptor] = part.split(/\s+/, 2)
          const nu = normalizeLcUrl(u)
          return descriptor ? `${nu} ${descriptor}` : nu
        })
        .join(', ')
      cleaned = replaceAttr(cleaned, 'srcset', normalized)
    }

    // Drop common lazy-load attrs to avoid browser picking the empty one.
    cleaned = cleaned
      .replace(/\s+data-src=["'][^"']*["']/gi, '')
      .replace(/\s+dataSrc=["'][^"']*["']/gi, '')
      .replace(/\s+data-original=["'][^"']*["']/gi, '')
      .replace(/\s+data-srcset=["'][^"']*["']/gi, '')

    return `<img${cleaned}>`
  })

  // 3. Wrap every <table> in a scrollable div so wide tables scroll horizontally
  //    instead of breaking out of the container
  out = out.replace(/<table/gi, '<div class="lc-table-wrap"><table')
  out = out.replace(/<\/table>/gi, '</table></div>')

  return out
}
