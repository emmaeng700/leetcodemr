'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { ALLOWED_EMAILS } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [show, setShow] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Check email whitelist
    if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
      setError('This email is not authorized to access LeetMastery.')
      setLoading(false)
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Store userId in localStorage so all pages can read it reliably
    if (authData.user?.id) {
      localStorage.setItem('lc_user_id', authData.user.id)
      localStorage.setItem('lc_user_email', authData.user.email ?? '')
    }

    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <BookOpen size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-black text-gray-900">LeetMastery</h1>
          <p className="text-gray-500 text-sm mt-1">Your personal interview prep hub</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Lock size={18} className="text-indigo-600" />
            <h2 className="font-bold text-gray-800">Sign in to continue</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email address"
                autoFocus
                required
                className="w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors text-gray-900 placeholder-gray-400 border-gray-200 focus:border-indigo-400 bg-white"
                style={{ color: '#111827', WebkitTextFillColor: '#111827', fontSize: '16px' }}
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                required
                className={`w-full pl-10 pr-11 py-3 border-2 rounded-xl focus:outline-none transition-colors text-gray-900 placeholder-gray-400 ${
                  error ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-indigo-400 bg-white'
                }`}
                style={{ color: '#111827', WebkitTextFillColor: '#111827', fontSize: '16px' }}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p className="text-red-500 text-xs font-semibold">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          LeetMastery · Private access only
        </p>
      </div>
    </div>
  )
}
