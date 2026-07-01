import { getGrindSession, saveGrindSession } from '@/lib/db'
import { runGrindCodePipeline } from '@/lib/grindPipeline'
import {
  readGrindDraft,
  readGrindDraftUpdatedAt,
  writeGrindDraft,
  type GrindLang,
} from '@/lib/grindStorage'
import { normalizeGrindCode } from '@/lib/grindStamp'

export type GrindLoadSource = 'starter' | 'local' | 'remote' | 'merged'

export type GrindLoadResult = {
  code: string
  source: GrindLoadSource
  synced: boolean
  sessionLabel: string | null
}

function parseTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : 0
}

function finalizeLoadedCode(
  questionId: number,
  lang: GrindLang,
  code: string,
  starter: string,
  source: GrindLoadSource,
  interviewApproach: string | undefined,
  online: boolean,
): GrindLoadResult {
  const piped = runGrindCodePipeline(
    questionId,
    lang,
    code,
    starter,
    interviewApproach,
    { isStarter: source === 'starter' },
  )

  let synced = false
  if (piped.changed) {
    writeGrindDraft(questionId, lang, piped.code)
    if (online) {
      saveGrindSession(questionId, lang, piped.code).catch(() => {})
      synced = true
    }
  }

  return {
    code: piped.code,
    source,
    synced,
    sessionLabel: piped.sessionLabel,
  }
}

/** Pick the newest draft between this device and Supabase when online. */
export async function resolveGrindCodeForLoad(
  questionId: number,
  lang: GrindLang,
  starter: string,
  interviewApproach?: string,
): Promise<GrindLoadResult> {
  const localDraft = readGrindDraft(questionId, lang)
  const localUpdatedMs = parseTime(readGrindDraftUpdatedAt(questionId, lang))
  const online = typeof navigator !== 'undefined' && navigator.onLine

  if (!online) {
    const raw = localDraft ?? starter
    const source: GrindLoadSource = localDraft !== null ? 'local' : 'starter'
    return finalizeLoadedCode(questionId, lang, raw, starter, source, interviewApproach, false)
  }

  let remote: Awaited<ReturnType<typeof getGrindSession>> = null
  try {
    remote = await getGrindSession(questionId, lang)
  } catch {
    /* offline / network blip */
  }

  const remoteCode = remote?.code ? normalizeGrindCode(remote.code) : null
  const remoteUpdatedMs = parseTime(remote?.updated_at)

  let code = starter
  let source: GrindLoadSource = 'starter'
  let synced = false

  if (remoteCode && localDraft !== null) {
    if (remoteUpdatedMs >= localUpdatedMs) {
      code = remoteCode
      source = 'remote'
      writeGrindDraft(questionId, lang, remoteCode)
      synced = true
    } else {
      code = localDraft
      source = 'local'
      try {
        await saveGrindSession(questionId, lang, localDraft)
        synced = true
      } catch {
        synced = false
      }
    }
  } else if (remoteCode) {
    code = remoteCode
    source = 'remote'
    writeGrindDraft(questionId, lang, remoteCode)
    synced = true
  } else if (localDraft !== null) {
    code = localDraft
    source = 'local'
    try {
      await saveGrindSession(questionId, lang, localDraft)
      synced = true
    } catch {
      synced = false
    }
  }

  const finalized = finalizeLoadedCode(questionId, lang, code, starter, source, interviewApproach, online)
  return {
    ...finalized,
    synced: synced || finalized.synced,
  }
}
