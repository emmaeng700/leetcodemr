'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BookOpen, Menu, X, LogOut, Home, BarChart2, Brain,
  Layers, GitBranch, MessageSquare, Gem, Server, Clock,
  Calendar, Info, Timer, Code2, Zap, User, Shield
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/auth'

const NAV_LINKS = [
  { href: '/',              label: 'Questions',    icon: Home },
  { href: '/daily',         label: 'Daily',        icon: Calendar },
  { href: '/stats',         label: 'Stats',        icon: BarChart2 },
  { href: '/review',        label: 'Reviews',      icon: Brain },
  { href: '/learn/0',       label: 'Learn',        icon: BookOpen },
  { href: '/flashcards',    label: 'Flashcards',   icon: Layers },
  { href: '/quick-review',  label: 'Quick Review', icon: Clock },
  { href: '/patterns',      label: 'Patterns',     icon: GitBranch },
  { href: '/behavioral',    label: 'Behavioral',   icon: MessageSquare },
  { href: '/gems',          label: 'Gems',         icon: Gem },
  { href: '/system-design', label: 'System Design',icon: Server },
  { href: '/mock',          label: 'Mock',         icon: Timer },
  { href: '/dsa',           label: 'DSA',          icon: Code2 },
  { href: '/leetcode-api',  label: 'LeetCode',     icon: Zap },
  { href: '/about',         label: 'About',        icon: Info },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top row: logo + logout/hamburger */}
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 font-black text-indigo-600 text-lg shrink-0">
            <BookOpen size={22} />
            <span className="hidden sm:inline">LeetMastery</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Profile link */}
            <Link
              href="/profile"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <User size={15} />
              <span>Profile</span>
            </Link>

            {/* Admin link — only for admins */}
            {isAdmin(userEmail) && (
              <Link
                href="/admin"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              >
                <Shield size={15} />
                <span>Admin</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={15} />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-800 rounded-lg"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Desktop Nav — wraps onto next row(s) if needed, no scrollbar */}
        <div className="hidden md:flex flex-wrap items-center gap-1 pb-2">
          {NAV_LINKS.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <User size={16} />
            Profile
          </Link>
          {isAdmin(userEmail) && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50"
            >
              <Shield size={16} />
              Admin
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 w-full transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      )}
    </nav>
  )
}
