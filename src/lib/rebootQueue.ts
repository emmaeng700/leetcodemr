const KEY = 'lm_reboot_queue_v1'

function readIds(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(Number).filter(n => Number.isFinite(n) && n > 0)
  } catch {
    return []
  }
}

function writeIds(ids: number[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]))
}

export function getRebootQueue(): number[] {
  return readIds()
}

export function addToRebootQueue(questionId: number) {
  const ids = readIds()
  if (!ids.includes(questionId)) ids.push(questionId)
  writeIds(ids)
}

export function removeFromRebootQueue(questionId: number) {
  const ids = readIds().filter(id => id !== questionId)
  writeIds(ids)
}

export function popFromRebootQueue(count: number): number[] {
  const ids = readIds()
  const picked = ids.slice(0, Math.max(0, count))
  writeIds(ids.slice(picked.length))
  return picked
}

