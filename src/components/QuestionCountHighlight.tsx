'use client'

type Variant = 'total' | 'exclusive' | 'notIn331'

const VARIANT_CLASS: Record<Variant, string> = {
  total: 'from-indigo-500/15 to-violet-500/15 border-indigo-400/60 text-indigo-700 dark:text-indigo-200',
  exclusive: 'from-emerald-500/15 to-teal-500/15 border-emerald-400/60 text-emerald-800 dark:text-emerald-200',
  notIn331: 'from-amber-500/15 to-orange-500/15 border-amber-400/60 text-amber-800 dark:text-amber-200',
}

const VALUE_CLASS: Record<Variant, string> = {
  total: 'text-indigo-600 dark:text-indigo-300',
  exclusive: 'text-emerald-600 dark:text-emerald-300',
  notIn331: 'text-amber-600 dark:text-amber-300',
}

interface Props {
  value: number
  label: string
  variant?: Variant
  className?: string
}

export function QuestionCountHighlight({ value, label, variant = 'total', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-gradient-to-r text-xs font-semibold ${VARIANT_CLASS[variant]} ${className}`}
    >
      <span className={`text-lg font-black leading-none tabular-nums ${VALUE_CLASS[variant]}`}>{value}</span>
      <span>{label}</span>
    </span>
  )
}

export function SetExclusiveCountLabel(set: 2 | 3, count: number): { value: number; label: string } {
  if (set === 2) {
    return { value: count, label: 'exclusive - not in Set 1 (331)' }
  }
  return { value: count, label: 'exclusive - not in Set 1 or NC150' }
}
