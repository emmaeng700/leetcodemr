import { saveGrindSession } from '@/lib/db'
import { upgradeCodeWithInterview } from '@/lib/grindInterviewInStarter'
import { normalizeGrindCode, stripGrindStamp } from '@/lib/grindStamp'
import { writeGrindDraft, type GrindLang } from '@/lib/grindStorage'

export type GrindPipelineResult = {
  code: string
  changed: boolean
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
  const cleaned = isStarter ? code : stripGrindStamp(normalizeGrindCode(code), lang)
  const result = upgradeCodeWithInterview(cleaned, starter, lang, interviewApproach)
  return {
    code: result,
    changed: result !== code,
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
