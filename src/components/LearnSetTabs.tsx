'use client'
import { useRouter } from 'next/navigation'
import { learnHubHref, learnSetLabel, type LearnSet } from '@/lib/learnNav'

interface Props {
  activeSet: LearnSet
  hubTab?: 'questions' | 'cycles'
}

export default function LearnSetTabs({ activeSet, hubTab = 'questions' }: Props) {
  const router = useRouter()
  const sets: LearnSet[] = [1, 2, 3]

  return (
    <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
      {sets.map(set => {
        const active = set === activeSet
        return (
          <button
            key={set}
            type="button"
            onClick={() => router.push(learnHubHref(set, hubTab))}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              active
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            {learnSetLabel(set)}
          </button>
        )
      })}
    </div>
  )
}
