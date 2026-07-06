import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import SwRegister from '@/components/SwRegister'
import ChunkLoadRecovery from '@/components/ChunkLoadRecovery'
import ThemeProvider from '@/components/ThemeProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LeetMastery',
  description: 'Personal LeetCode study app — 331 questions with solutions, spaced repetition and practice zone.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <Script
          id="dev-sw-purge"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){var h=location.hostname;if(h!=='localhost'&&h!=='127.0.0.1'&&!h.endsWith('.local'))return;if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister()})})}if('caches'in window){caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})})}})();`,
          }}
        />
        <ThemeProvider>
          <ChunkLoadRecovery />
          <SwRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
