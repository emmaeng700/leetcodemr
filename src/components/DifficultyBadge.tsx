export default function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const styles: Record<string, string> = {
    Easy:   'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/60 dark:text-green-400 dark:border-green-500/30',
    Medium: 'bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-900/60 dark:text-yellow-400 dark:border-yellow-500/30',
    Hard:   'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/60 dark:text-red-400 dark:border-red-500/30',
  }
  const cls = styles[difficulty] ?? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700/60 dark:text-slate-400 dark:border-white/10'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {difficulty}
    </span>
  )
}
