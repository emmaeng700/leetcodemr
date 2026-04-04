import Navbar from '@/components/Navbar'
import ScrollRestorer from '@/components/ScrollRestorer'
import OfflineSetup from '@/components/OfflineSetup'
import { Toaster } from 'react-hot-toast'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <ScrollRestorer />
      <Navbar />
      <main className="overflow-x-hidden">{children}</main>
      <OfflineSetup />
      <Toaster position="bottom-right" />
    </div>
  )
}
