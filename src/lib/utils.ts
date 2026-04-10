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

/** Strip <script> tags from HTML strings before dangerouslySetInnerHTML */
export function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
}
