'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Upload, FileText, ChevronRight, CheckCircle, Loader2, Zap, SkipForward } from 'lucide-react'

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Step 1
  const [resumeText, setResumeText] = useState('')
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file')
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [step1Error, setStep1Error] = useState('')

  // Step 2
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(0)
  const [genTotal] = useState(63)
  const [genDone, setGenDone] = useState(false)
  const [genError, setGenError] = useState('')

  // Step 3
  const [lcSession, setLcSession] = useState('')
  const [lcCsrf, setLcCsrf] = useState('')
  const [savingLC, setSavingLC] = useState(false)
  const [lcSaved, setLcSaved] = useState(false)
  const [lcError, setLcError] = useState('')

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
        return
      }
      setUserId(data.user.id)
      setUserEmail(data.user.email ?? null)
    })
  }, [router])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setStep1Error('')
    setFileName(file.name)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/parse-resume', {
      method: 'POST',
      body: formData,
    })

    if (res.ok) {
      const { text } = await res.json()
      setResumeText(text)
    } else {
      setStep1Error('Failed to parse PDF. Try pasting the text instead.')
    }
    setUploading(false)
  }

  async function handleStep1Next() {
    if (!resumeText.trim()) {
      setStep1Error('Please provide your resume text.')
      return
    }
    localStorage.setItem('onboarding_resume', resumeText)
    setStep(2)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenError('')
    setGenProgress(0)

    const savedResume = localStorage.getItem('onboarding_resume') || resumeText

    // Simulate progress while generating
    const progressInterval = setInterval(() => {
      setGenProgress(p => Math.min(p + 2, 60))
    }, 500)

    const res = await fetch('/api/generate-behavioral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: savedResume }),
    })

    clearInterval(progressInterval)

    if (res.ok) {
      const data = await res.json()
      setGenProgress(genTotal)
      setGenDone(true)
      localStorage.removeItem('onboarding_resume')
    } else {
      const err = await res.json()
      setGenError(err.error || 'Generation failed. Please try again.')
    }
    setGenerating(false)
  }

  async function handleSaveLC() {
    if (!lcSession.trim() || !lcCsrf.trim()) {
      setLcError('Please enter both fields.')
      return
    }
    setSavingLC(true)
    setLcError('')

    const res = await fetch('/api/profile/save-lc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leetcode_session: lcSession, leetcode_csrf: lcCsrf }),
    })

    if (res.ok) {
      setLcSaved(true)
    } else {
      setLcError('Failed to save credentials.')
    }
    setSavingLC(false)
  }

  function handleFinish() {
    router.push('/')
  }

  if (!userId) {
    return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-gray-900">Welcome to LeetMastery</h1>
          <p className="text-gray-500 text-sm mt-1">Let's set up your personalized experience</p>
          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {([1, 2, 3] as Step[]).map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step > s ? 'bg-green-500 text-white' :
                  step === s ? 'bg-indigo-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? <CheckCircle size={16} /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Resume Upload */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Step 1 — Your Resume</h2>
            <p className="text-sm text-gray-500 mb-5">We'll use this to generate personalized behavioral answers.</p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition-colors ${
                  uploadMode === 'file' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setUploadMode('text')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border-2 transition-colors ${
                  uploadMode === 'text' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Paste Text
              </button>
            </div>

            {uploadMode === 'file' ? (
              <div>
                <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                  fileName ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                }`}>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-indigo-500">
                      <Loader2 size={24} className="animate-spin" />
                      <span className="text-xs font-medium">Parsing PDF...</span>
                    </div>
                  ) : fileName ? (
                    <div className="flex flex-col items-center gap-2 text-green-600">
                      <CheckCircle size={24} />
                      <span className="text-xs font-medium">{fileName}</span>
                      <span className="text-xs text-gray-400">Click to replace</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Upload size={24} />
                      <span className="text-xs font-medium">Click to upload PDF</span>
                    </div>
                  )}
                </label>
                {resumeText && (
                  <p className="text-xs text-green-600 mt-2 font-medium">
                    {resumeText.length} characters extracted from PDF
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={resumeText}
                onChange={e => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..."
                rows={10}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 resize-none text-gray-800"
              />
            )}

            {step1Error && (
              <p className="text-red-500 text-xs font-semibold mt-2">{step1Error}</p>
            )}

            <button
              onClick={handleStep1Next}
              disabled={!resumeText.trim() || uploading}
              className="w-full mt-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Generate Behavioral Answers */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Step 2 — Behavioral Answers</h2>
            <p className="text-sm text-gray-500 mb-5">
              We'll generate 3 personalized STAR stories for each of your 63 behavioral questions using your resume.
            </p>

            {!genDone && !generating && (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-sm text-gray-600 mb-6">
                  Click below to start generating. This takes about 30-60 seconds.
                </p>
                {genError && (
                  <p className="text-red-500 text-xs font-semibold mb-4">{genError}</p>
                )}
                <button
                  onClick={handleGenerate}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Zap size={16} /> Generate my personalized behavioral answers
                </button>
              </div>
            )}

            {generating && (
              <div className="text-center py-4">
                <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                <p className="text-sm font-semibold text-gray-700 mb-2">Generating your answers...</p>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${(genProgress / genTotal) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">{genProgress} / {genTotal} questions processed</p>
              </div>
            )}

            {genDone && (
              <div className="text-center py-4">
                <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-gray-800 mb-1">All done!</p>
                <p className="text-sm text-gray-500 mb-6">Your personalized STAR stories are ready.</p>
                <button
                  onClick={() => setStep(3)}
                  className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Connect LeetCode */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Step 3 — Connect LeetCode (Optional)</h2>
            <p className="text-sm text-gray-500 mb-5">
              Add your LeetCode session to run and submit code directly from the app.
            </p>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">LEETCODE_SESSION</label>
                <input
                  type="password"
                  value={lcSession}
                  onChange={e => setLcSession(e.target.value)}
                  placeholder="Paste your LEETCODE_SESSION cookie..."
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">csrftoken</label>
                <input
                  type="password"
                  value={lcCsrf}
                  onChange={e => setLcCsrf(e.target.value)}
                  placeholder="Paste your csrftoken cookie..."
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Find these in your browser's DevTools → Application → Cookies → leetcode.com.
            </p>

            {lcError && <p className="text-red-500 text-xs font-semibold mb-2">{lcError}</p>}

            {lcSaved ? (
              <div className="mb-4 flex items-center gap-2 text-green-600 text-sm font-semibold">
                <CheckCircle size={16} /> LeetCode connected!
              </div>
            ) : (
              <button
                onClick={handleSaveLC}
                disabled={savingLC || !lcSession.trim() || !lcCsrf.trim()}
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 mb-3"
              >
                {savingLC ? 'Saving...' : 'Save LeetCode Credentials'}
              </button>
            )}

            <button
              onClick={handleFinish}
              className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              {lcSaved ? 'Go to App →' : <><SkipForward size={16} /> Skip for now &rarr;</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
