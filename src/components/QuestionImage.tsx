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
          'rounded-xl border border-[var(--border)] bg-slate-100 dark:bg-slate-900 p-2',
          className,
        ].join(' ')}
      >
        <img
          src={`/question-images/${questionId}.jpg`}
          alt={alt}
          loading="lazy"
          className={[
            // Let the image size itself naturally, but cap height so it stays neat on all devices.
            // Bigger cap on phones so tall screenshots remain readable.
            'w-full h-auto max-h-[68vh] sm:max-h-[28rem] md:max-h-[34rem] object-contain object-center block rounded-lg',
            zoomable ? 'cursor-zoom-in' : '',
            imgClassName,
          ].join(' ')}
          onClick={zoomable ? () => setOpen(true) : undefined}
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

