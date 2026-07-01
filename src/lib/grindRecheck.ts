import { runGrindCodePipeline, persistGrindPipelineResult } from '@/lib/grindPipeline'
import type { GrindPipelineResult } from '@/lib/grindPipeline'
import { resolveGrindCodeForLoad } from '@/lib/grindSync'
import type { GrindLang } from '@/lib/grindStorage'

/** Merge remote/local when online, then stamp + interview upgrade + persist. */
export async function runGrindRecheckPipeline(
  questionId: number,
  lang: GrindLang,
  currentCode: string,
  starter: string,
  interviewApproach: string | undefined,
): Promise<GrindPipelineResult & { synced: boolean }> {
  const online = typeof navigator !== 'undefined' && navigator.onLine
  let code = currentCode
  let synced = false

  if (online) {
    const loaded = await resolveGrindCodeForLoad(questionId, lang, starter, interviewApproach)
    code = loaded.code
    synced = loaded.synced
  }

  const piped = runGrindCodePipeline(questionId, lang, code, starter, interviewApproach)
  const persist = await persistGrindPipelineResult(questionId, lang, piped, online)
  return { ...piped, synced: synced || persist.synced }
}
