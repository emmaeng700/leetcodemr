'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/auth'
import { Shield, Users, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  created_at: string
  behavioral_generated: boolean
  behavioral_regen_count: number
  solved_count: number
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email ?? null
      setUserEmail(email)

      if (!isAdmin(email)) {
        router.push('/')
        return
      }

      // Load profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, behavioral_generated, behavioral_regen_count, notification_email, created_at')

      if (!profiles) {
        setLoading(false)
        return
      }

      // Get solved counts per user
      const userIds = profiles.map(p => p.id)
      const rows: UserRow[] = []

      for (const p of profiles) {
        // Get solved count from progress table
        const { count } = await supabase
          .from('progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', p.id)
          .eq('solved', true)

        // Get email from auth - we use notification_email if set, or profile id
        rows.push({
          id: p.id,
          email: p.notification_email || p.id,
          created_at: p.created_at || '',
          behavioral_generated: p.behavioral_generated || false,
          behavioral_regen_count: p.behavioral_regen_count || 0,
          solved_count: count || 0,
        })
      }

      setUsers(rows)
      setLoading(false)
    })
  }, [router])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteResult(null)

    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    })

    if (res.ok) {
      setInviteResult({ ok: true, msg: `Invite sent to ${inviteEmail}` })
      setInviteEmail('')
    } else {
      const err = await res.json()
      setInviteResult({ ok: false, msg: err.error || 'Failed to invite' })
    }
    setInviting(false)
  }

  if (loading) {
    return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  }

  if (!isAdmin(userEmail)) {
    return <div className="text-center py-32 text-red-500 text-sm">Access denied.</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <Shield className="text-indigo-500" /> Admin Panel
      </h1>
      <p className="text-sm text-gray-400 mb-8">Manage users and send invites.</p>

      {/* Invite user */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-8">
        <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
          <Mail size={15} /> Invite User
        </h2>
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="Email address"
            required
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {inviting && <Loader2 size={14} className="animate-spin" />}
            Send Invite
          </button>
        </form>
        {inviteResult && (
          <div className={`flex items-center gap-2 mt-2 text-sm font-semibold ${inviteResult.ok ? 'text-green-600' : 'text-red-500'}`}>
            {inviteResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            {inviteResult.msg}
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-50">
          <Users size={15} className="text-gray-500" />
          <h2 className="font-bold text-gray-700 text-sm">Users ({users.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email / ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Solved</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Behavioral</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Regens</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-xs">{u.email}</div>
                    <div className="text-gray-400 text-xs font-mono">{u.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-indigo-600">{u.solved_count}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.behavioral_generated
                      ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                      : <XCircle size={16} className="text-gray-300 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      u.behavioral_regen_count >= 3
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {u.behavioral_regen_count}/3
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
