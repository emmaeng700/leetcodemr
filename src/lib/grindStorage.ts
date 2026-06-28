import { normalizeGrindCode } from '@/lib/grindStamp'

export type GrindLang = 'python3' | 'cpp'

export function grindDraftKey(questionId: number, lang: GrindLang): string {
  return `lm_grind_${questionId}_${lang}`
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
  } catch {
    /* quota */
  }
}

export function clearGrindDraft(questionId: number, lang: GrindLang): void {
  try {
    localStorage.removeItem(grindDraftKey(questionId, lang))
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
