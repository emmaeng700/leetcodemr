import React, { useState } from 'react'

export default function QuestionImage({
  questionId,
  alt,
  className = '',
  imgClassName = '',
  onError,
}: {
  questionId: number
  alt: string
  className?: string
  imgClassName?: string
  onError?: () => void
}) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null

  // eslint-disable-next-line @next/next/no-img-element
  return (
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
          'w-full h-auto max-h-[52vh] sm:max-h-[28rem] md:max-h-[34rem] object-contain object-center block rounded-lg',
          imgClassName,
        ].join(' ')}
        onError={() => {
          setHidden(true)
          onError?.()
        }}
      />
    </div>
  )
}

