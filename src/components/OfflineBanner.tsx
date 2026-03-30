'use client'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function OfflineBanner({ feature }: { feature?: string }) {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 m-4">
      <WifiOff size={16} className="text-amber-500 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-amber-800">You're offline</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {feature ?? 'This section'} needs an internet connection to load.
        </p>
      </div>
    </div>
  )
}
