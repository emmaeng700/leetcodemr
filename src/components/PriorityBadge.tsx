import { PATTERN_PRIORITY } from '@/lib/constants'

const STYLES = {
  High: 'bg-red-500/15 text-red-400 border-red-500/30',
  Mid:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Low:  'bg-gray-500/15 text-gray-400 border-gray-500/30',
} as const

const STYLES_ACTIVE = 'bg-white/20 text-white border-white/30'

interface Props {
  pattern: string
  active?: boolean
  className?: string
}

export default function PriorityBadge({ pattern, active = false, className = '' }: Props) {
  const priority = PATTERN_PRIORITY[pattern]
  if (!priority) return null
  return (
    <span className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border leading-none ${
      active ? STYLES_ACTIVE : STYLES[priority]
    } ${className}`}>
      {priority}
    </span>
  )
}
