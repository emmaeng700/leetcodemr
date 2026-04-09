import Navbar from '@/components/Navbar'
import ScrollRestorer from '@/components/ScrollRestorer'
import OfflineSetup from '@/components/OfflineSetup'
import { Toaster } from 'react-hot-toast'
import QuestionSearchGate from '@/components/QuestionSearchGate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 overflow-x-hidden">
      <ScrollRestorer />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <QuestionSearchGate />
      </div>
      <main className="overflow-x-hidden">{children}</main>
      <OfflineSetup />
      <Toaster position="bottom-right" />
    </div>
  )
}
