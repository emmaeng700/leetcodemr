import type { GrindLang } from '@/lib/grindStorage'

export function grindStartedKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_started_${questionId}_${lang}`
}

export function grindDayKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_day_${questionId}_${lang}`
}

/** Fix drafts saved with literal backslash-n instead of real newlines (offline page bug). */
export function normalizeGrindCode(code: string): string {
  let out = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!out.includes('\n') && out.includes('\\n')) {
    out = out.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  }
  return out
}

export function localCalendarDayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatGrindStamp(lang: GrindLang, date = new Date()): string {
  const label = formatGrindSessionChip(date)
  return lang === 'python3' ? `# Grind: ${label}` : `// Grind: ${label}`
}

export function formatGrindSessionLabel(date: Date, lang: GrindLang = 'python3'): string {
  const label = formatGrindSessionChip(date)
  return lang === 'python3' ? `# ${label}` : `// ${label}`
}

/** Human-readable session label for the footer chip (no comment prefix). */
export function formatGrindSessionChip(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function hasGrindStamp(code: string, lang: GrindLang): boolean {
  const first = code.split('\n')[0]?.trim() ?? ''
  return lang === 'python3' ? first.startsWith('# Grind:') : first.startsWith('// Grind:')
}

/** Parse the date embedded in a `# Grind:` / `// Grind:` header line. */
export function readStampDateFromCode(code: string, lang: GrindLang): Date | null {
  const first = code.split('\n')[0]?.trim() ?? ''
  const prefix = lang === 'python3' ? '# Grind:' : '// Grind:'
  if (!first.startsWith(prefix)) return null
  const label = first.slice(prefix.length).trim()
  const parsed = new Date(label)
  return Number.isFinite(parsed.getTime()) ? parsed : null
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

export function readGrindDay(questionId: number, lang: GrindLang): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(grindDayKey(questionId, lang))
  } catch {
    return null
  }
}

export function writeGrindDay(questionId: number, lang: GrindLang, dayKey: string): void {
  try {
    localStorage.setItem(grindDayKey(questionId, lang), dayKey)
  } catch {
    /* quota */
  }
}

export function clearGrindDay(questionId: number, lang: GrindLang): void {
  try {
    localStorage.removeItem(grindDayKey(questionId, lang))
  } catch {
    /* ignore */
  }
}

export function clearGrindStartedAt(questionId: number, lang: GrindLang): void {
  try {
    localStorage.removeItem(grindStartedKey(questionId, lang))
    clearGrindDay(questionId, lang)
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

export function sameCalendarDay(a: Date, b: Date): boolean {
  return localCalendarDayKey(a) === localCalendarDayKey(b)
}

function hasGrindAttempt(questionId: number, lang: GrindLang, code: string): boolean {
  return (
    hasGrindStamp(code, lang) ||
    readGrindDay(questionId, lang) !== null ||
    readGrindStartedAt(questionId, lang) !== null
  )
}

function inferSessionDay(questionId: number, lang: GrindLang, code: string): string | null {
  const explicit = readGrindDay(questionId, lang)
  if (explicit) return explicit
  const fromCode = readStampDateFromCode(code, lang)
  if (fromCode) return localCalendarDayKey(fromCode)
  const started = readGrindStartedAt(questionId, lang)
  if (started) return localCalendarDayKey(new Date(started))
  return null
}

export function getGrindSessionDate(
  questionId: number,
  lang: GrindLang,
  code: string,
): Date | null {
  if (!hasGrindAttempt(questionId, lang, code)) return null
  const started = readGrindStartedAt(questionId, lang)
  if (started) {
    const parsed = new Date(started)
    if (Number.isFinite(parsed.getTime())) return parsed
  }
  const fromCode = readStampDateFromCode(code, lang)
  if (fromCode) return fromCode
  const day = inferSessionDay(questionId, lang, code)
  if (!day) return null
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function getGrindSessionChipLabel(
  questionId: number,
  lang: GrindLang,
  code: string,
): string | null {
  const date = getGrindSessionDate(questionId, lang, code)
  return date ? formatGrindSessionChip(date) : null
}

export function prependGrindStamp(code: string, lang: GrindLang, date: Date): string {
  const body = stripGrindStamp(code, lang)
  const stamp = formatGrindStamp(lang, date)
  if (!body.trim()) return stamp
  return `${stamp}\n${body}`
}

/** Re-apply or bump the Grind date header when revisiting on a new day. */
export function refreshGrindStampOnRecheck(
  questionId: number,
  lang: GrindLang,
  code: string,
): string {
  const normalized = normalizeGrindCode(code)
  const today = localCalendarDayKey()

  if (!hasGrindAttempt(questionId, lang, normalized)) return normalized

  const sessionDay = inferSessionDay(questionId, lang, normalized)
  const storedDay = readGrindDay(questionId, lang)

  if (sessionDay === today && hasGrindStamp(normalized, lang)) {
    if (!storedDay) writeGrindDay(questionId, lang, today)
    return normalized
  }

  const now = new Date()
  writeGrindStartedAt(questionId, lang, now.toISOString())
  writeGrindDay(questionId, lang, today)
  return prependGrindStamp(normalized, lang, now)
}

/** First edit stamps the file so you know you attempted this question before. */
export function applyGrindStampOnEdit(questionId: number, lang: GrindLang, code: string): string {
  const normalized = normalizeGrindCode(code)
  if (hasGrindStamp(normalized, lang)) {
    return refreshGrindStampOnRecheck(questionId, lang, normalized)
  }

  if (hasGrindAttempt(questionId, lang, normalized)) {
    const stampDate = getGrindSessionDate(questionId, lang, normalized) ?? new Date()
    return prependGrindStamp(normalized, lang, stampDate)
  }

  const now = new Date()
  writeGrindStartedAt(questionId, lang, now.toISOString())
  writeGrindDay(questionId, lang, localCalendarDayKey(now))
  return prependGrindStamp(normalized, lang, now)
}

/** Re-apply stamp on load when we have a saved start time but the draft lost its header. */
export function ensureGrindStampOnLoad(questionId: number, lang: GrindLang, code: string): string {
  return refreshGrindStampOnRecheck(questionId, lang, code)
}
