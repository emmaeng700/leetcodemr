import type { GrindListEntry } from '@/lib/grindList'

type DividerEntry = Extract<GrindListEntry, { type: 'divider' }>

export default function GrindListDivider({ entry }: { entry: DividerEntry }) {
  return (
    <div
      className={`sticky top-0 z-10 px-3 py-1.5 border-b border-[var(--border-soft)] shrink-0 flex items-center justify-between gap-2 ${
        entry.variant === 'set'
          ? 'bg-indigo-100/90 dark:bg-indigo-950/80 text-[10px] font-bold uppercase tracking-wide text-indigo-800 dark:text-indigo-200'
          : 'bg-[var(--bg-muted)] text-[9px] font-semibold text-[var(--text-subtle)]'
      }`}
    >
      <span className="truncate min-w-0">{entry.label}</span>
      <span
        className={`shrink-0 tabular-nums font-mono rounded px-1.5 py-0.5 ${
          entry.variant === 'set'
            ? 'bg-indigo-200/80 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-100'
            : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
        }`}
      >
        {entry.count}
      </span>
    </div>
  )
}
