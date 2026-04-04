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
// Matches srInterval() in db.ts exactly, capped at 70 days so every
// learned question is reviewed at least once every 70 days.
export function nextIntervalDays(reviewCount: number): number {
  return Math.min(70, Math.floor(reviewCount / 2) * 14 + (reviewCount % 2 === 0 ? 7 : 12))
}
