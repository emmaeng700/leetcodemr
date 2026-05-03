import Navbar from '@/components/Navbar'
import ScrollRestorer from '@/components/ScrollRestorer'
import { Toaster } from 'react-hot-toast'
import QuestionSearchGate from '@/components/QuestionSearchGate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] overflow-x-hidden">
      <ScrollRestorer />
      <Navbar />
      <QuestionSearchGate />
      <main className="overflow-x-hidden">{children}</main>
      <Toaster position="bottom-right" />
    </div>
  )
}
