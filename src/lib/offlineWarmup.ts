import {
  cacheGrindOfflineAssets,
  GRIND_OFFLINE_ASSETS,
  OFFLINE_PAGES,
} from '@/lib/offlinePages'
import {
  buildGrindQuestions,
  loadGrindQuestionsBundle,
  loadPlaybookMap,
  loadQuestionsFullJson,
} from '@/lib/grindQuestions'
import { ensureGrindStarterCached } from '@/lib/grindStarter'
import { readCachedStarter } from '@/lib/grindStorage'
import type { GrindQuestion } from '@/lib/grindQuestions'
import { cacheAllDescriptionImages, areDescriptionImagesReady } from '@/lib/descriptionImageCache'

export const OFFLINE_WARMUP_KEY = 'lm_offline_warmup_v25'

export type WarmupPhase = 'pages' | 'questions' | 'starters' | 'done'

export type WarmupProgress = {
  phase: WarmupPhase
  label: string
  done: number
  total: number
}

export function isOfflineWarmupComplete(): boolean {
  if (typeof window === 'undefined') return true
  return !!localStorage.getItem(OFFLINE_WARMUP_KEY)
}

export function markOfflineWarmupComplete(status: 'done' | 'partial' | 'skipped-offline' | 'dev-skip' | 'skipped' = 'done') {
  try {
    localStorage.setItem(OFFLINE_WARMUP_KEY, status === 'done' ? String(Date.now()) : status)
  } catch {
    /* ignore */
  }
}

function postCachePagesToSw() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then(reg => {
      const worker = reg.active || reg.waiting || reg.installing
      worker?.postMessage({ type: 'CACHE_PAGES', pages: [...OFFLINE_PAGES] })
      worker?.postMessage({ type: 'CACHE_GRIND_ASSETS' })
    })
    .catch(() => {})
}

function startersNeedingFetch(questions: GrindQuestion[]): GrindQuestion[] {
  return questions.filter(q => {
    if (q.set === 1) return false
    const needsPy = !q.starterPython && !readCachedStarter(q.id, 'python3')
    const needsCpp = !q.starterCpp && !readCachedStarter(q.id, 'cpp')
    return needsPy || needsCpp
  })
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Kick off diagram caching without blocking the rest of warm-up. */
function startDescriptionImagesInBackground() {
  void areDescriptionImagesReady()
    .then(ready => {
      if (!ready) return cacheAllDescriptionImages()
    })
    .catch(() => {})
}

/** One-time warm-up: cache offline Grind page, questions JSON, and starter code. */
export async function runOfflineWarmup(
  onProgress: (p: WarmupProgress) => void,
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    markOfflineWarmupComplete('skipped-offline')
    onProgress({ phase: 'done', label: 'Offline - skipped warm-up', done: 1, total: 1 })
    return
  }

  postCachePagesToSw()

  const pageTotal = 4 + GRIND_OFFLINE_ASSETS.length
  let done = 0

  const tickPages = (label: string) => {
    onProgress({ phase: 'pages', label, done, total: pageTotal })
  }

  tickPages('Loading question bank...')
  await loadQuestionsFullJson()
  done += 1

  tickPages('Saving interview approach info...')
  try {
    await fetch('/playbook_data_all.json', { cache: 'reload' })
  } catch {
    /* continue */
  }
  done += 1

  tickPages('Saving problem descriptions...')
  try {
    await fetch('/questions_data_all.json', { cache: 'reload' })
  } catch {
    /* continue */
  }
  done += 1

  // Diagrams are large (~445 images) — do not block the gate on them.
  tickPages('Queuing description diagrams...')
  startDescriptionImagesInBackground()
  done += 1

  for (const path of GRIND_OFFLINE_ASSETS) {
    const label =
      path === '/grind-offline.html'
        ? 'Saving offline Grind page...'
        : path === '/grind-offline-editor.js'
          ? 'Saving code editor...'
          : 'Saving Grind question list...'
    tickPages(label)
    try {
      await fetch(path, { cache: 'reload' })
    } catch {
      /* continue */
    }
    done += 1
    await sleep(40)
  }

  tickPages('Writing offline cache...')
  await cacheGrindOfflineAssets()
  done += 1

  onProgress({ phase: 'questions', label: 'Building Grind catalog...', done: pageTotal, total: pageTotal })
  let grindQuestions = await loadGrindQuestionsBundle()
  if (grindQuestions.length === 0) {
    const qs = await loadQuestionsFullJson()
    const { getSet2Questions, getSet3Questions } = await import('@/lib/questionSets')
    const mainIds = new Set(qs.map(q => q.id))
    const playbookMap = await loadPlaybookMap()
    grindQuestions = buildGrindQuestions(
      qs,
      getSet2Questions(mainIds, qs),
      getSet3Questions(mainIds, qs),
      playbookMap,
    )
  }
  const needStarters = startersNeedingFetch(grindQuestions)
  const starterTotal = needStarters.length
  const grandTotal = pageTotal + starterTotal

  onProgress({
    phase: 'starters',
    label: starterTotal
      ? `Saving starter code (0/${starterTotal})...`
      : 'Starter code already cached',
    done: pageTotal,
    total: grandTotal,
  })

  for (let i = 0; i < needStarters.length; i++) {
    const q = needStarters[i]
    onProgress({
      phase: 'starters',
      label: `Saving starter code (${i + 1}/${starterTotal}) - #${q.id} ${q.title}`,
      done: pageTotal + i + 1,
      total: grandTotal,
    })
    await Promise.all([
      !q.starterPython && !readCachedStarter(q.id, 'python3')
        ? ensureGrindStarterCached(q, 'python3')
        : Promise.resolve(),
      !q.starterCpp && !readCachedStarter(q.id, 'cpp')
        ? ensureGrindStarterCached(q, 'cpp')
        : Promise.resolve(),
    ])
    await sleep(200)
  }

  onProgress({ phase: 'done', label: 'Ready for offline use', done: grandTotal, total: grandTotal })
  markOfflineWarmupComplete('done')
}
