'use client'
import {
  BookOpen, CheckCircle, Layers, BarChart2, MessageSquare, Gem,
  Server, Calendar, Code2, Brain, Zap, Timer, Map, GraduationCap, BookMarked, Trophy,
} from 'lucide-react'

const FEATURES = [
  {
    icon: CheckCircle,
    color: 'text-green-500',
    label: 'Questions Library',
    desc: '331 LeetCode questions with Python & C++ solutions, difficulty badges, and source tags (Grind 169, Denny Zhang, Premium 98, CodeSignal). Filter by difficulty, source, starred, or solved status. Study filtered sets as Flashcards or in Learn mode.',
  },
  {
    icon: Layers,
    color: 'text-indigo-500',
    label: 'Flashcard Mode',
    desc: 'Study questions as flashcards. Flip to reveal the solution. Filter by difficulty, source, starred or solved status — filters carry over from the home page. Keyboard navigation and shuffle support.',
  },
  {
    icon: GraduationCap,
    color: 'text-violet-500',
    label: 'Learn Mode',
    desc: 'Work through questions one-by-one in a focused split-panel view. Tabs: live LeetCode description, Notes, Solution (with official editorial fetched from LeetCode), and My Solutions (last 3 accepted submissions). Real LeetCode editor on the right — SR review auto-completes on Accepted submit. Carries filter state from the home page.',
  },
  {
    icon: Map,
    color: 'text-cyan-500',
    label: 'Patterns',
    desc: 'Study by algorithm pattern — Arrays & Hashing, Two Pointers, Sliding Window, Trees, Graphs, DP, and more. Each pattern opens a flashcard deck or list view. Progress bar per pattern. Solved and visited tracking.',
  },
  {
    icon: Code2,
    color: 'text-blue-500',
    label: 'Practice Editor — Real LeetCode',
    desc: 'Full split-panel IDE: live LeetCode description on the left, real code editor on the right. Run and submit directly to LeetCode using your session. Supports Python 3 and C++. Tabs: Description, Solution, and My Solutions (last 3 accepted submissions with syntax-highlighted code). SR review auto-completes when you get Accepted on a due problem. Time tracker included.',
  },
  {
    icon: Trophy,
    color: 'text-green-500',
    label: 'LeetCode Section',
    desc: 'Standalone LeetCode workspace. Search any problem by URL, slug, or keyword. Tabs: Description, Editorial (official LeetCode editorial with syntax-highlighted code blocks), My Solutions (last 3 accepted submissions), and Profile (LeetCode stats for any username). Daily Challenge pill auto-loads today\'s problem. Full Run/Submit with your LeetCode session.',
  },
  {
    icon: BookMarked,
    color: 'text-emerald-500',
    label: 'DSA Templates & Tutorials',
    desc: 'Two-tab reference library. Templates: code snippets for common patterns (binary search, BFS/DFS, sliding window, union-find, etc.) in Python and C++. Tutorials: algorithm explanations with complexity analysis and highlighted code (Arrays, Sorting, Graphs, Math, Strings, and more). Click any card to flip open or closed.',
  },
  {
    icon: Timer,
    color: 'text-orange-500',
    label: 'Mock Interview',
    desc: 'Simulated interview mode with a countdown timer. Pick a random or specific question, code under time pressure using the real LeetCode editor, and mark the outcome (solved, gave up, timeout). Session history logged with difficulty and elapsed time.',
  },
  {
    icon: Zap,
    color: 'text-yellow-500',
    label: 'Quick Review',
    desc: 'Rapid-fire flashcard blitz — 15 seconds to read the question, 15 seconds to view the solution, then auto-advance. Deck ordered Easy → Medium → Hard for progressive difficulty. Filter by difficulty and source.',
  },
  {
    icon: Brain,
    color: 'text-teal-500',
    label: 'Spaced Repetition',
    desc: 'Mark questions solved to start a personalised review schedule. Intervals grow by alternating +5/+9 days via formula (no cap): 7 → 12 → 21 → 26 → 35 → 40 → 49 → ... automatically increases forever. Due reviews surface as a banner on the home page. Accepting a submission on a due problem auto-completes the review. Dedicated Review page shows your full queue with overdue indicators.',
  },
  {
    icon: Calendar,
    color: 'text-orange-400',
    label: 'Daily Study Plan (LeetCode Police)',
    desc: 'Generate a locked daily plan across all 331 questions ordered Easy → Medium → Hard. Set questions per day, start date, and a lock code to hold yourself accountable. Tracks today\'s progress, past day history (last 14 days), and unlocks sneak-peek bonus days once today is done. Daily email at 8 AM CT includes today\'s questions and any spaced repetition reviews due.',
  },
  {
    icon: BarChart2,
    color: 'text-yellow-500',
    label: 'Stats Dashboard',
    desc: 'Solved count, progress by difficulty, total practice time. Two heatmaps: an activity heatmap (any day you solved something goes green) and a daily plan heatmap (red/yellow/green vs your daily target). LeetCode live solve count synced from your actual LeetCode profile.',
  },
  {
    icon: MessageSquare,
    color: 'text-purple-500',
    label: 'Behavioral Prep',
    desc: '63 behavioral questions with 3 STAR stories each covering all major categories (Leadership, Conflict, Failure, Teamwork, and more). Tabbed story view, category filter, and shuffle mode. Mark questions as visited to track coverage.',
  },
  {
    icon: Server,
    color: 'text-sky-500',
    label: 'System Design',
    desc: 'System design flashcards covering classic design problems, core concepts, cloud patterns, and trade-offs. Includes interview tips and case studies.',
  },
  {
    icon: Gem,
    color: 'text-rose-500',
    label: 'Gems',
    desc: 'Curated career resources: recruiter email templates, interview strategies, salary negotiation scripts, big-O cheat sheet, and more. Flip-card format.',
  },
]

const TECH_STACK = [
  { label: 'Next.js 16', desc: 'App Router · React 19 · Turbopack' },
  { label: 'TypeScript', desc: 'End-to-end type safety' },
  { label: 'Tailwind CSS 4', desc: 'Utility-first styling' },
  { label: 'Supabase', desc: 'Postgres database · progress & plan storage' },
  { label: 'LeetCode GraphQL', desc: 'Real test & submit via your LC session' },
  { label: 'CodeMirror 6', desc: 'In-browser code editor' },
  { label: 'highlight.js', desc: 'Syntax highlighting (DSA templates)' },
  { label: 'Resend', desc: 'Daily email reminders (cron at 8 AM CT)' },
  { label: 'Lucide React', desc: 'Icon library' },
  { label: 'react-hot-toast', desc: 'Toast notifications' },
]

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-2xl mb-5 shadow-lg">
          <BookOpen size={40} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2">LeetMastery</h1>
        <p className="text-gray-500 text-base max-w-lg mx-auto">
          A private, all-in-one interview preparation hub. Study LeetCode questions, practise under timed conditions, track spaced repetition, and prep for behavioural and system design — all in one place.
        </p>
      </div>

      {/* Features */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Features</h2>
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4">
              <div className={`shrink-0 mt-0.5 ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">{label}</h3>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="bg-gray-900 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-white mb-4">Tech Stack</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TECH_STACK.map(({ label, desc }) => (
            <div key={label} className="bg-gray-800 rounded-xl p-3">
              <div className="text-sm font-bold text-indigo-400">{label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-800 text-sm mb-3">Data & Privacy</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>All progress — solved status, notes, spaced repetition schedules, practice code, mock sessions, and daily plan — is stored in Supabase, private to your account.</p>
          <p>Questions data is loaded from a static JSON file bundled with the app — no external API calls for question content.</p>
          <p>Code execution goes directly to LeetCode's own judge using your personal LeetCode session cookie. Your code is run on LeetCode's servers exactly as if you submitted on the site — no third-party execution engine involved.</p>
          <p>Your LeetCode session token is stored in your browser only and never sent to our servers beyond proxying the request.</p>
        </div>
      </div>
    </div>
  )
}
