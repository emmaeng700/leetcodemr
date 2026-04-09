'use client'

import { usePathname } from 'next/navigation'
import QuestionSearch from '@/components/QuestionSearch'

export default function QuestionSearchGate() {
  const pathname = usePathname()
  const show = pathname === '/' || pathname === '/flashcards' || pathname === '/sr-queue' || pathname.startsWith('/learn')
  if (!show) return null
  return (
    <div className="border-b border-white/8 bg-slate-900/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <QuestionSearch />
      </div>
    </div>
  )
}
