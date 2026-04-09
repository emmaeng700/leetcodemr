import React, { useEffect, useState } from 'react'

export default function QuestionImage({
  questionId,
  alt,
  className = '',
  imgClassName = '',
  onError,
  zoomable = true,
}: {
  questionId: number
  alt: string
  className?: string
  imgClassName?: string
  onError?: () => void
  zoomable?: boolean
}) {
  const [hidden, setHidden] = useState(false)
  const [open, setOpen] = useState(false)
  if (hidden) return null

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <>
      <div
        className={[
          // Avoid clipping screenshot edges (question text often touches borders).
          // Use a scrollable frame so tall screenshots can still fill width.
          'relative rounded-xl border border-[var(--border)] bg-slate-100 dark:bg-slate-900 p-2 max-h-[70vh] sm:max-h-[32rem] md:max-h-[36rem] overflow-y-auto',
          className,
        ].join(' ')}
      >
        {zoomable && (
          <button
            type="button"
            onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
            className="absolute right-2 top-2 z-10 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-black/70"
            style={{ touchAction: 'manipulation' }}
            aria-label="Expand image"
            title="Expand"
          >
            Zoom
          </button>
        )}
        <img
          src={`/question-images/${questionId}.jpg`}
          alt={alt}
          loading="lazy"
          className={[
            // Fill available width; let height grow naturally inside scroll frame.
            'w-full h-auto block rounded-lg',
            zoomable ? 'cursor-default' : '',
            imgClassName,
          ].join(' ')}
          onError={() => {
            setHidden(true)
            onError?.()
          }}
        />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            aria-label="Close image"
            className="absolute inset-0 bg-black/70"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/question-images/${questionId}.jpg`}
              alt={alt}
              className="w-full max-h-[90vh] object-contain object-center rounded-xl shadow-2xl bg-black"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -top-2 -right-2 sm:top-0 sm:right-0 rounded-full bg-white/90 text-gray-800 text-xs font-bold px-3 py-1.5 shadow hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

