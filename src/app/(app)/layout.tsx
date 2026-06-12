import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import ScrollRestorer from '@/components/ScrollRestorer'
import { Toaster } from 'react-hot-toast'
import QuestionSearchGate from '@/components/QuestionSearchGate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      <ScrollRestorer />
      <Suspense fallback={<div className="sticky top-0 z-[90] h-14 border-b border-[var(--border)] bg-[var(--bg-card)]" />}>
        <Navbar />
      </Suspense>
      <QuestionSearchGate />
      <main className="overflow-x-hidden pb-[env(safe-area-inset-bottom)]">{children}</main>
      <Toaster position="bottom-right" />
    </div>
  )
}
