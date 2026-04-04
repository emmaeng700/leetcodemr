'use client'
import { useEffect, useState } from 'react'
import { Download, CheckCircle, WifiOff, X } from 'lucide-react'

const IMG_CACHE = 'lm-images'
const DONE_KEY  = 'lm_offline_ready'

export default function OfflineSetup() {
  const [status,   setStatus]   = useState<'idle' | 'downloading' | 'done' | 'hidden'>('hidden')
  const [progress, setProgress] = useState(0)
  const [total,    setTotal]    = useState(0)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return

    async function check() {
      // If previously marked done, verify images are actually still cached
      if (localStorage.getItem(DONE_KEY)) {
        try {
          const cache = await caches.open(IMG_CACHE)
          const keys  = await cache.keys()
          if (keys.length === 0) {
            // Cache was wiped (e.g. SW version bump) — prompt again
            localStorage.removeItem(DONE_KEY)
            setStatus('idle')
          }
          // else: images still there, stay hidden
        } catch {
          setStatus('idle')
        }
        return
      }
      setStatus('idle')
    }
    check()
  }, [])

  async function cacheAllImages() {
    setStatus('downloading')
    setProgress(0)
    try {
      const questions: Array<{ id: number }> = await fetch('/questions_full.json').then(r => r.json())
      setTotal(questions.length)
      const cache = await caches.open(IMG_CACHE)
      let done = 0
      for (const q of questions) {
        const url = `/question-images/${q.id}.jpg`
        try {
          const existing = await cache.match(url)
          if (!existing) {
            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
          }
        } catch { /* skip missing */ }
        done++
        setProgress(done)
      }
      localStorage.setItem(DONE_KEY, '1')
      setStatus('done')
      setTimeout(() => setStatus('hidden'), 4000)
    } catch {
      setStatus('idle')
    }
  }

  if (status === 'hidden') return null

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  if (status === 'done') return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg">
      <CheckCircle size={16} />
      All images cached — app works fully offline!
    </div>
  )

  if (status === 'downloading') return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">Caching images for offline…</span>
        <span className="text-xs font-mono text-indigo-600">{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-100"
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">{progress} / {total} images</p>
    </div>
  )

  // idle
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-white border border-gray-200 rounded-2xl shadow-xl px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
            <WifiOff size={15} className="text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Save for offline use</p>
            <p className="text-xs text-gray-400 mt-0.5">Cache all 331 question images so the app works fully offline after saving to home screen.</p>
          </div>
        </div>
        <button onClick={() => setStatus('hidden')} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5">
          <X size={15} />
        </button>
      </div>
      <button onClick={cacheAllImages}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
        <Download size={14} /> Download all images for offline
      </button>
    </div>
  )
}
