/** Last problem the user had open — used so /answers can auto-load without manual search. */

const KEY = 'lm_open_question'

export type OpenQuestionRef = {
  id: number
  slug: string
  title?: string
}

export function setOpenQuestionContext(q: OpenQuestionRef | null): void {
  if (typeof window === 'undefined') return
  if (!q || !Number.isFinite(q.id) || q.id <= 0 || !q.slug?.trim()) {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    return
  }
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        id: q.id,
        slug: q.slug.trim(),
        title: q.title?.trim() || undefined,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function getOpenQuestionContext(): OpenQuestionRef | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { id?: unknown; slug?: unknown; title?: unknown }
    const id = Number(o.id)
    const slug = String(o.slug ?? '').trim()
    if (!Number.isFinite(id) || id <= 0 || !slug) return null
    const title = o.title != null && String(o.title).trim() ? String(o.title).trim() : undefined
    return { id, slug, title }
  } catch {
    return null
  }
}
