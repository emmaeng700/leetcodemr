import { normalizeGrindCode } from '@/lib/grindStamp'

export type GrindLang = 'python3' | 'cpp'

export const GRIND_LAST_QUESTION_KEY = 'lm_grind_last_question_id'

export function readGrindLastQuestionId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const id = Number.parseInt(localStorage.getItem(GRIND_LAST_QUESTION_KEY) ?? '', 10)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function writeGrindLastQuestionId(questionId: number): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(questionId) || questionId <= 0) return
  try {
    localStorage.setItem(GRIND_LAST_QUESTION_KEY, String(questionId))
  } catch {
    /* quota */
  }
}

export function grindHrefForLastQuestion(): string {
  const id = readGrindLastQuestionId()
  return id ? `/grind?id=${id}` : '/grind'
}

export function grindDraftKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_${questionId}_${lang}`
}

export function grindDraftUpdatedKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_updated_${questionId}_${lang}`
}

export function grindStarterKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_starter_${questionId}_${lang}`
}

export function readGrindDraft(questionId: number, lang: GrindLang): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(grindDraftKey(questionId, lang))
    return raw !== null ? normalizeGrindCode(raw) : null
  } catch {
    return null
  }
}

export function writeGrindDraft(questionId: number, lang: GrindLang, code: string): void {
  try {
    localStorage.setItem(grindDraftKey(questionId, lang), code)
    localStorage.setItem(grindDraftUpdatedKey(questionId, lang), new Date().toISOString())
  } catch {
    /* quota */
  }
}

export function readGrindDraftUpdatedAt(questionId: number, lang: GrindLang): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(grindDraftUpdatedKey(questionId, lang))
  } catch {
    return null
  }
}

export function clearGrindDraft(questionId: number, lang: GrindLang): void {
  try {
    localStorage.removeItem(grindDraftKey(questionId, lang))
    localStorage.removeItem(grindDraftUpdatedKey(questionId, lang))
  } catch {
    /* ignore */
  }
}

export { clearGrindStartedAt } from '@/lib/grindStamp'

export function readCachedStarter(questionId: number, lang: GrindLang): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(grindStarterKey(questionId, lang))
    return raw !== null ? normalizeGrindCode(raw) : null
  } catch {
    return null
  }
}

export function writeCachedStarter(questionId: number, lang: GrindLang, code: string): void {
  try {
    localStorage.setItem(grindStarterKey(questionId, lang), code)
  } catch {
    /* quota */
  }
}
