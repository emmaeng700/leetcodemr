import type { GrindLang } from '@/lib/grindStorage'

export function grindStartedKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_started_${questionId}_${lang}`
}

/** Fix drafts saved with literal backslash-n instead of real newlines (offline page bug). */
export function normalizeGrindCode(code: string): string {
  let out = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!out.includes('\n') && out.includes('\\n')) {
    out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  }
  return out
}

export function formatGrindStamp(lang: GrindLang, date = new Date()): string {
  const label = date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  return lang === 'python3' ? `# Grind: ${label}` : `// Grind: ${label}`
}

export function hasGrindStamp(code: string, lang: GrindLang): boolean {
  const first = code.split('\n')[0]?.trim() ?? ''
  return lang === 'python3' ? first.startsWith('# Grind:') : first.startsWith('// Grind:')
}

export function readGrindStartedAt(questionId: number, lang: GrindLang): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(grindStartedKey(questionId, lang))
  } catch {
    return null
  }
}

export function writeGrindStartedAt(questionId: number, lang: GrindLang, iso: string): void {
  try {
    localStorage.setItem(grindStartedKey(questionId, lang), iso)
  } catch {
    /* quota */
  }
}

export function clearGrindStartedAt(questionId: number, lang: GrindLang): void {
  try {
    localStorage.removeItem(grindStartedKey(questionId, lang))
  } catch {
    /* ignore */
  }
}

export function stripGrindStamp(code: string, lang: GrindLang): string {
  const lines = code.split('\n')
  if (lines.length === 0) return code
  if (hasGrindStamp(code, lang)) return lines.slice(1).join('\n')
  return code
}

export function prependGrindStamp(code: string, lang: GrindLang, date: Date): string {
  const body = stripGrindStamp(code, lang)
  const stamp = formatGrindStamp(lang, date)
  if (!body.trim()) return stamp
  return `${stamp}\n${body}`
}

/** First edit (or reconnect) stamps the file so you know you attempted this question before. */
export function applyGrindStampOnEdit(questionId: number, lang: GrindLang, code: string): string {
  const normalized = normalizeGrindCode(code)
  if (hasGrindStamp(normalized, lang)) return normalized

  let started = readGrindStartedAt(questionId, lang)
  if (!started) {
    started = new Date().toISOString()
    writeGrindStartedAt(questionId, lang, started)
  }
  return prependGrindStamp(normalized, lang, new Date(started))
}

/** Re-apply stamp on load when we have a saved start time but the draft lost its header. */
export function ensureGrindStampOnLoad(questionId: number, lang: GrindLang, code: string): string {
  const normalized = normalizeGrindCode(code)
  const started = readGrindStartedAt(questionId, lang)
  if (!started) return normalized
  return prependGrindStamp(normalized, lang, new Date(started))
}
