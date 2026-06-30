import { getGrindSession, saveGrindSession } from '@/lib/db'
import { upgradeCodeWithLearning } from '@/lib/grindInterviewInStarter'
import {
  readGrindDraft,
  readGrindDraftUpdatedAt,
  writeGrindDraft,
  type GrindLang,
} from '@/lib/grindStorage'
import { ensureGrindStampOnLoad, normalizeGrindCode } from '@/lib/grindStamp'

export type GrindLoadSource = 'starter' | 'local' | 'remote' | 'merged'

export type GrindLoadResult = {
  code: string
  source: GrindLoadSource
  synced: boolean
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
  description: string | undefined,
  interviewApproach: string | undefined,
  online: boolean,
): { code: string; synced: boolean } {
  let finalCode = source !== 'starter' ? ensureGrindStampOnLoad(questionId, lang, code) : code
  const withLearning = upgradeCodeWithLearning(
    finalCode,
    starter,
    lang,
    description,
    interviewApproach,
  )
  if (withLearning === finalCode) {
    return { code: finalCode, synced: false }
  }

  writeGrindDraft(questionId, lang, withLearning)
  if (online) {
    saveGrindSession(questionId, lang, withLearning).catch(() => {})
  }
  return { code: withLearning, synced: online }
}

/** Pick the newest draft between this device and Supabase when online. */
export async function resolveGrindCodeForLoad(
  questionId: number,
  lang: GrindLang,
  starter: string,
  description?: string,
  interviewApproach?: string,
): Promise<GrindLoadResult> {
  const localDraft = readGrindDraft(questionId, lang)
  const localUpdatedMs = parseTime(readGrindDraftUpdatedAt(questionId, lang))
  const online = typeof navigator !== 'undefined' && navigator.onLine

  if (!online) {
    const raw = localDraft ?? starter
    const source: GrindLoadSource = localDraft !== null ? 'local' : 'starter'
    const { code } = finalizeLoadedCode(questionId, lang, raw, starter, source, description, interviewApproach, false)
    return { code, source, synced: false }
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

  const finalized = finalizeLoadedCode(questionId, lang, code, starter, source, description, interviewApproach, online)
  return { code: finalized.code, source, synced: synced || finalized.synced }
}
