'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw, Save } from 'lucide-react'

type Tool = 'pen' | 'eraser'

type WhiteboardNotesProps = {
  storageKey: string
  className?: string
}

function safeLoad(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSave(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

export default function WhiteboardNotes({ storageKey, className = '' }: WhiteboardNotesProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)

  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const activePtrIdRef = useRef<number | null>(null)
  const savingTimerRef = useRef<number | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [baseSize, setBaseSize] = useState(4)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const color = useMemo(() => (tool === 'pen' ? '#111827' : '#000000'), [tool])

  const scheduleSave = useCallback(() => {
    if (savingTimerRef.current) window.clearTimeout(savingTimerRef.current)
    savingTimerRef.current = window.setTimeout(() => {
      const c = canvasRef.current
      if (!c) return
      const data = c.toDataURL('image/png')
      safeSave(storageKey, data)
      setSavedAt(Date.now())
    }, 250)
  }, [storageKey])

  const rebuildCanvas = useCallback(
    (w: number, h: number, restoreDataUrl?: string | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
      const pxW = Math.max(1, Math.floor(w * dpr))
      const pxH = Math.max(1, Math.floor(h * dpr))

      // Snapshot existing pixels first (so resizing doesn't wipe drawings).
      const prev = canvas.toDataURL('image/png')

      canvas.width = pxW
      canvas.height = pxH
      canvas.style.width = `${Math.floor(w)}px`
      canvas.style.height = `${Math.floor(h)}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctxRef.current = ctx
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // draw in CSS pixels
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.imageSmoothingEnabled = true

      // Whiteboard background (white) even on dark mode.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)

      const toRestore = restoreDataUrl ?? prev
      if (toRestore) {
        const img = new Image()
        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0, w, h)
          } catch {
            /* ignore */
          }
        }
        img.src = toRestore
      }
    },
    [],
  )

  // Initial mount: size to container and restore stored drawing.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const stored = safeLoad(storageKey)
    const rect = wrap.getBoundingClientRect()
    rebuildCanvas(rect.width, rect.height, stored)

    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (!r) return
      rebuildCanvas(r.width, r.height)
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [rebuildCanvas, storageKey])

  useEffect(() => {
    return () => {
      if (savingTimerRef.current) window.clearTimeout(savingTimerRef.current)
    }
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
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    lastPtRef.current = { x, y }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (activePtrIdRef.current !== e.pointerId) return
    const canvas = canvasRef.current
    const last = lastPtRef.current
    if (!canvas || !last) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const next = { x, y }
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
    safeSave(storageKey, c.toDataURL('image/png'))
    setSavedAt(Date.now())
  }

  return (
    <div className={`h-full min-h-[320px] flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTool('pen')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              tool === 'pen' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Pencil size={14} /> Pen
          </button>
          <button
            type="button"
            onClick={() => setTool('eraser')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              tool === 'eraser' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Eraser size={14} /> Eraser
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Size</label>
          <input
            type="range"
            min={2}
            max={12}
            value={baseSize}
            onChange={e => setBaseSize(parseInt(e.target.value, 10))}
          />
          <button
            type="button"
            onClick={clearBoard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:border-gray-300 transition-colors"
            title="Clear"
          >
            <RotateCcw size={14} /> Clear
          </button>
          <button
            type="button"
            onClick={saveNow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 bg-white hover:border-gray-300 transition-colors"
            title="Save now"
          >
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      <div className="text-[11px] text-gray-400 flex items-center gap-2">
        <span>Tip: use your stylus — pressure changes stroke width.</span>
        {savedAt && <span className="ml-auto">Saved</span>}
      </div>

      <div
        ref={wrapRef}
        className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
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

