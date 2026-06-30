import type { GrindQuestion } from '@/lib/grindQuestions'
import { upgradeCodeWithInterview } from '@/lib/grindInterviewInStarter'
import { resolveGrindStarterSync } from '@/lib/grindStarter'
import { readGrindDraft, writeGrindDraft, type GrindLang } from '@/lib/grindStorage'

const MIGRATION_KEY = 'lm_grind_interview_all_v1'

/** One-time upgrade of every saved draft so STAR-LC scripts appear under the checks. */
export function migrateAllGrindDrafts(questions: GrindQuestion[]): number {
  if (typeof window === 'undefined') return 0
  try {
    if (localStorage.getItem(MIGRATION_KEY)) return 0
  } catch {
    return 0
  }

  let upgraded = 0
  for (const q of questions) {
    for (const lang of ['python3', 'cpp'] as const) {
      const draft = readGrindDraft(q.id, lang)
      if (draft === null) continue
      const starter = resolveGrindStarterSync(q, lang)
      const next = upgradeCodeWithInterview(draft, starter, lang, q.interviewApproach)
      if (next !== draft) {
        writeGrindDraft(q.id, lang, next)
        upgraded++
      }
    }
  }

  try {
    localStorage.setItem(MIGRATION_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }

  return upgraded
}
