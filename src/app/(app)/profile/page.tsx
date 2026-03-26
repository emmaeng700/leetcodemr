'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { User, FileText, Zap, RefreshCw, CheckCircle, Loader2, Upload, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Profile data
  const [resumeText, setResumeText] = useState('')
  const [regenCount, setRegenCount] = useState(0)
  const [behavioralGenerated, setBehavioralGenerated] = useState(false)
  const [lcConnected, setLcConnected] = useState(false)
  const [notificationEmail, setNotificationEmail] = useState('')

  // LC update
  const [showLCForm, setShowLCForm] = useState(false)
  const [lcSession, setLcSession] = useState('')
  const [lcCsrf, setLcCsrf] = useState('')
  const [savingLC, setSavingLC] = useState(false)

  // Resume update
  const [showResumeForm, setShowResumeForm] = useState(false)
  const [newResumeText, setNewResumeText] = useState('')
  const [uploadingResume, setUploadingResume] = useState(false)

  // Regen
  const [regenerating, setRegenerating] = useState(false)
  const [regenProgress, setRegenProgress] = useState(0)

  // Notification email
  const [savingNotifEmail, setSavingNotifEmail] = useState(false)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      const email = data.user?.email ?? null
      setUserId(uid)
      setUserEmail(email)

      if (!uid) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single()

      if (profile) {
        setResumeText(profile.resume_text || '')
        setRegenCount(profile.behavioral_regen_count || 0)
        setBehavioralGenerated(profile.behavioral_generated || false)
        setLcConnected(!!(profile.leetcode_session && profile.leetcode_csrf))
        setNotificationEmail(profile.notification_email || email || '')
        // Pre-populate localStorage with resume for regeneration
        if (profile.resume_text) {
          localStorage.setItem('onboarding_resume', profile.resume_text)
        }
      }

      setLoading(false)
    })
  }, [])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingResume(true)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData })
    if (res.ok) {
      const { text } = await res.json()
      setNewResumeText(text)
    } else {
      toast.error('Failed to parse PDF')
    }
    setUploadingResume(false)
  }

  async function handleSaveResume() {
    if (!userId || !newResumeText.trim()) return
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, resume_text: newResumeText }, { onConflict: 'id' })

    if (!error) {
      setResumeText(newResumeText)
      localStorage.setItem('onboarding_resume', newResumeText)
      setShowResumeForm(false)
      toast.success('Resume updated!')
    } else {
      toast.error('Failed to save resume')
    }
  }

  async function handleSaveLC() {
    if (!lcSession.trim() || !lcCsrf.trim()) return
    setSavingLC(true)
    const res = await fetch('/api/profile/save-lc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leetcode_session: lcSession, leetcode_csrf: lcCsrf }),
    })
    if (res.ok) {
      setLcConnected(true)
      setShowLCForm(false)
      setLcSession('')
      setLcCsrf('')
      toast.success('LeetCode credentials updated!')
    } else {
      toast.error('Failed to save credentials')
    }
    setSavingLC(false)
  }

  async function handleRegenerate() {
    if (regenCount >= 3) return
    // resumeText is loaded from the DB on mount; localStorage is also kept in sync
    const savedResume = resumeText || localStorage.getItem('onboarding_resume') || ''
    if (!savedResume.trim()) {
      toast.error('No resume found. Please update your resume first.')
      return
    }

    setRegenerating(true)
    setRegenProgress(0)

    const interval = setInterval(() => {
      setRegenProgress(p => Math.min(p + 2, 60))
    }, 500)

    const res = await fetch('/api/generate-behavioral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: savedResume }),
    })

    clearInterval(interval)

    if (res.ok) {
      setRegenCount(c => c + 1)
      setBehavioralGenerated(true)
      setRegenProgress(63)
      toast.success('Behavioral answers regenerated!')
    } else {
      const err = await res.json()
      toast.error(err.error || 'Regeneration failed')
    }
    setRegenerating(false)
    setRegenProgress(0)
  }

  async function handleSaveNotifEmail() {
    if (!userId || !notificationEmail.trim()) return
    setSavingNotifEmail(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, notification_email: notificationEmail }, { onConflict: 'id' })

    if (!error) {
      toast.success('Notification email updated!')
    } else {
      toast.error('Failed to save')
    }
    setSavingNotifEmail(false)
  }

  if (loading) {
    return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <User className="text-indigo-500" /> Profile Settings
      </h1>
      <p className="text-sm text-gray-400 mb-8">Manage your account and preferences.</p>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-bold text-gray-700 text-sm mb-3">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <User size={18} className="text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{userEmail}</p>
            <p className="text-xs text-gray-400 font-mono">{userId?.slice(0, 16)}...</p>
          </div>
        </div>
      </div>

      {/* Notification email */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-bold text-gray-700 text-sm mb-3 flex items-center gap-2">
          <Mail size={14} /> Notification Email
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={notificationEmail}
            onChange={e => setNotificationEmail(e.target.value)}
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={handleSaveNotifEmail}
            disabled={savingNotifEmail}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {savingNotifEmail ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Resume section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <FileText size={14} /> Resume
          </h2>
          <button
            onClick={() => setShowResumeForm(s => !s)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {showResumeForm ? 'Cancel' : 'Update resume'}
          </button>
        </div>

        {resumeText ? (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 font-mono leading-relaxed line-clamp-3">
            {resumeText.slice(0, 300)}{resumeText.length > 300 ? '...' : ''}
          </p>
        ) : (
          <p className="text-xs text-gray-400">No resume uploaded yet.</p>
        )}

        {showResumeForm && (
          <div className="mt-4 space-y-3">
            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              {uploadingResume ? (
                <div className="flex items-center gap-2 text-indigo-500 text-xs">
                  <Loader2 size={14} className="animate-spin" /> Parsing PDF...
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <Upload size={14} /> Upload new PDF
                </div>
              )}
            </label>
            <p className="text-xs text-gray-400 text-center">Or paste text below</p>
            <textarea
              value={newResumeText}
              onChange={e => setNewResumeText(e.target.value)}
              placeholder="Paste resume text..."
              rows={6}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
            <button
              onClick={handleSaveResume}
              disabled={!newResumeText.trim()}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              Save Resume
            </button>
          </div>
        )}
      </div>

      {/* LeetCode section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <Zap size={14} /> LeetCode Integration
          </h2>
          <div className="flex items-center gap-2">
            {lcConnected
              ? <span className="flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle size={12} /> Connected</span>
              : <span className="text-xs text-gray-400">Not connected</span>
            }
            <button
              onClick={() => setShowLCForm(s => !s)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              {showLCForm ? 'Cancel' : lcConnected ? 'Update' : 'Connect'}
            </button>
          </div>
        </div>

        {showLCForm && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">LEETCODE_SESSION</label>
              <input
                type="password"
                value={lcSession}
                onChange={e => setLcSession(e.target.value)}
                placeholder="Paste LEETCODE_SESSION cookie..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">csrftoken</label>
              <input
                type="password"
                value={lcCsrf}
                onChange={e => setLcCsrf(e.target.value)}
                placeholder="Paste csrftoken cookie..."
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <button
              onClick={handleSaveLC}
              disabled={savingLC || !lcSession.trim() || !lcCsrf.trim()}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingLC && <Loader2 size={14} className="animate-spin" />}
              Save Credentials
            </button>
          </div>
        )}
      </div>

      {/* Regenerate behavioral */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <h2 className="font-bold text-gray-700 text-sm mb-1 flex items-center gap-2">
          <RefreshCw size={14} /> Behavioral Answers
        </h2>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            {behavioralGenerated ? 'Generated from your resume.' : 'Not generated yet.'}
          </p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            regenCount >= 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}>
            {regenCount}/3 regenerations used
          </span>
        </div>

        {regenerating && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm text-indigo-600 mb-1">
              <Loader2 size={14} className="animate-spin" /> Regenerating... {regenProgress}/63
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${(regenProgress / 63) * 100}%` }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleRegenerate}
          disabled={regenCount >= 3 || regenerating}
          className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {regenerating
            ? <><Loader2 size={14} className="animate-spin" /> Regenerating...</>
            : regenCount >= 3
            ? 'Max regenerations reached'
            : <><RefreshCw size={14} /> Regenerate Answers</>
          }
        </button>
        <p className="text-xs text-gray-400 mt-2">
          Make sure your resume is up to date before regenerating.
        </p>
      </div>
    </div>
  )
}
