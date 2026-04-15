'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw, Save } from 'lucide-react'
import { getQuestionNotes, updateProgress } from '@/lib/db'

type Tool = 'pen' | 'eraser'

type WhiteboardNotesProps = {
  questionId: number
  className?: string
  /** Minimum drawing area height in viewport-heights. Default: 200 (≈ 2 pages). */
  minVh?: number
}

function safeLocal(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function saveLocal(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export default function WhiteboardNotes({ questionId, className = '', minVh = 200 }: WhiteboardNotesProps) {
  const storageKey = `lm_whiteboard:${questionId}`

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const activePtrIdRef = useRef<number | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [baseSize, setBaseSize] = useState(4)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)

  const color = useMemo(() => (tool === 'pen' ? '#111827' : '#000000'), [tool])

  const persistToSupabase = useCallback(async (dataUrl: string) => {
    setSyncing(true)
    try {
      await updateProgress(questionId, { notes: dataUrl })
    } finally {
      setSyncing(false)
    }
  }, [questionId])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const c = canvasRef.current
      if (!c) return
      const data = c.toDataURL('image/png')
      saveLocal(storageKey, data)
      setSavedAt(Date.now())
      persistToSupabase(data)
    }, 500)
  }, [storageKey, persistToSupabase])

  const rebuildCanvas = useCallback(
    (w: number, h: number, restoreDataUrl?: string | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
      const pxW = Math.max(1, Math.floor(w * dpr))
      const pxH = Math.max(1, Math.floor(h * dpr))

      const prev = canvas.toDataURL('image/png')

      canvas.width = pxW
      canvas.height = pxH
      canvas.style.width = `${Math.floor(w)}px`
      canvas.style.height = `${Math.floor(h)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctxRef.current = ctx
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.imageSmoothingEnabled = true

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      const toRestore = restoreDataUrl ?? prev
      if (toRestore) {
        const img = new Image()
        img.onload = () => { try { ctx.drawImage(img, 0, 0, w, h) } catch { /* ignore */ } }
        img.src = toRestore
      }
    },
    [],
  )

  // Mount: load from localStorage instantly, then check Supabase for fresher data
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const local = safeLocal(storageKey)
    const rect = wrap.getBoundingClientRect()
    rebuildCanvas(rect.width, rect.height, local)

    // Fetch from Supabase — overwrite if it has data (cross-device sync)
    getQuestionNotes(questionId).then(remote => {
      if (remote && remote.startsWith('data:image/')) {
        saveLocal(storageKey, remote) // update local cache
        const r = wrap.getBoundingClientRect()
        rebuildCanvas(r.width, r.height, remote)
      }
    })

    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (!r) return
      rebuildCanvas(r.width, r.height)
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const clearBoard = () => {
    const wrap = wrapRef.current
    const ctx = ctxRef.current
    if (!wrap || !ctx) return
    const rect = wrap.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    scheduleSave()
  }

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }, pressure: number) => {
    const ctx = ctxRef.current
    if (!ctx) return
    const lineWidth = Math.max(1, baseSize * (pressure > 0 ? (0.4 + pressure * 0.9) : 1))
    ctx.strokeStyle = tool === 'pen' ? color : '#ffffff'
    ctx.lineWidth = tool === 'eraser' ? Math.max(10, baseSize * 3) : lineWidth
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (activePtrIdRef.current != null) return
    const canvas = canvasRef.current
    if (!canvas) return
    activePtrIdRef.current = e.pointerId
    canvas.setPointerCapture(e.pointerId)
    const rect = canvas.getBoundingClientRect()
    lastPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (activePtrIdRef.current !== e.pointerId) return
    const canvas = canvasRef.current
    const last = lastPtRef.current
    if (!canvas || !last) return
    const rect = canvas.getBoundingClientRect()
    const next = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    drawSegment(last, next, e.pressure ?? 0)
    lastPtRef.current = next
    scheduleSave()
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (activePtrIdRef.current !== e.pointerId) return
    activePtrIdRef.current = null
    lastPtRef.current = null
    scheduleSave()
  }

  const saveNow = () => {
    const c = canvasRef.current
    if (!c) return
    const data = c.toDataURL('image/png')
    saveLocal(storageKey, data)
    setSavedAt(Date.now())
    persistToSupabase(data)
  }

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-2 pb-3 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTool('pen')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                tool === 'pen' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <Pencil size={14} /> Pen
            </button>
            <button type="button" onClick={() => setTool('eraser')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                tool === 'eraser' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              <Eraser size={14} /> Eraser
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500">Size</label>
            <input type="range" min={2} max={12} value={baseSize}
              onChange={e => setBaseSize(parseInt(e.target.value, 10))} />
            <button type="button" onClick={clearBoard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:border-gray-300 transition-colors">
              <RotateCcw size={14} /> Clear
            </button>
            <button type="button" onClick={saveNow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:border-gray-300 transition-colors">
              <Save size={14} /> Save
            </button>
          </div>
        </div>
        <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-2">
          <span>Tip: use your stylus — pressure changes stroke width.</span>
          {syncing && <span className="ml-auto text-amber-500">Syncing…</span>}
          {!syncing && savedAt && <span className="ml-auto text-green-500">✓ Saved to account</span>}
        </div>
      </div>

      <div ref={wrapRef}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ touchAction: 'none', minHeight: `${Math.max(120, minVh)}vh` }}>
        <canvas ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block w-full h-full"
        />
      </div>
    </div>
  )
}
