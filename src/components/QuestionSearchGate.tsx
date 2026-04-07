'use client'

import { usePathname } from 'next/navigation'
import QuestionSearch from '@/components/QuestionSearch'

export default function QuestionSearchGate() {
  const pathname = usePathname()
  const show = pathname === '/' || pathname === '/flashcards' || pathname === '/sr-queue' || pathname.startsWith('/learn')
  if (!show) return null
  return <QuestionSearch />
}

