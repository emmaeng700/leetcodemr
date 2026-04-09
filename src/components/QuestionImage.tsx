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
        'rounded-xl overflow-hidden border border-[var(--border)] bg-slate-100 dark:bg-slate-900',
        className,
      ].join(' ')}
    >
      <img
        src={`/question-images/${questionId}.jpg`}
        alt={alt}
        loading="lazy"
        className={[
          'w-full h-56 sm:h-72 md:h-80 object-contain object-center block',
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

