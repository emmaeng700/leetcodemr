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
export function leetCodeUrl(slug: string): string {
  return `https://leetcode.com/problems/${slug}/`
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
  const LADDER = [1, 3, 7, 14, 30, 60, 90, 180]
  if (!Number.isFinite(n) || n <= 0) return LADDER[0]
  return LADDER[Math.min(n, LADDER.length) - 1]
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

  // 2. Strip fixed width / height / style attrs from <img> tags so CSS max-width
  //    and height:auto can fully control sizing without being overridden
  out = out.replace(/<img([^>]*?)>/gi, (_m, attrs: string) => {
    const cleaned = attrs
      .replace(/\s+width=["'][^"']*["']/gi, '')
      .replace(/\s+height=["'][^"']*["']/gi, '')
      .replace(/\s+style=["'][^"']*["']/gi, '')
    return `<img${cleaned}>`
  })

  // 3. Wrap every <table> in a scrollable div so wide tables scroll horizontally
  //    instead of breaking out of the container
  out = out.replace(/<table/gi, '<div class="lc-table-wrap"><table')
  out = out.replace(/<\/table>/gi, '</table></div>')

  return out
}
