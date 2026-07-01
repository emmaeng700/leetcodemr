import { saveGrindSession } from '@/lib/db'
import { upgradeCodeWithInterview } from '@/lib/grindInterviewInStarter'
import {
  getGrindSessionChipLabel,
  refreshGrindStampOnRecheck,
} from '@/lib/grindStamp'
import { writeGrindDraft, type GrindLang } from '@/lib/grindStorage'

export type GrindPipelineResult = {
  code: string
  changed: boolean
  sessionLabel: string | null
}

export function runGrindCodePipeline(
  questionId: number,
  lang: GrindLang,
  code: string,
  starter: string,
  interviewApproach: string | undefined,
  options?: { isStarter?: boolean },
): GrindPipelineResult {
  const isStarter = options?.isStarter ?? false
  const stamped = isStarter ? code : refreshGrindStampOnRecheck(questionId, lang, code)
  const result = upgradeCodeWithInterview(stamped, starter, lang, interviewApproach)
  return {
    code: result,
    changed: result !== code,
    sessionLabel: getGrindSessionChipLabel(questionId, lang, result),
  }
}

export async function persistGrindPipelineResult(
  questionId: number,
  lang: GrindLang,
  piped: GrindPipelineResult,
  online: boolean,
): Promise<{ synced: boolean }> {
  if (!piped.changed) return { synced: false }

  writeGrindDraft(questionId, lang, piped.code)
  if (!online) return { synced: false }

  try {
    await saveGrindSession(questionId, lang, piped.code)
    return { synced: true }
  } catch {
    return { synced: false }
  }
}

/** Fire at each local midnight while the app stays open. */
export function scheduleMidnightGrindRefresh(onMidnight: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: ReturnType<typeof setTimeout> | null = null

  const schedule = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(24, 0, 0, 0)
    const delay = Math.max(1_000, next.getTime() - now.getTime())
    timer = setTimeout(() => {
      onMidnight()
      schedule()
    }, delay)
  }

  schedule()
  return () => {
    if (timer !== null) clearTimeout(timer)
  }
}
