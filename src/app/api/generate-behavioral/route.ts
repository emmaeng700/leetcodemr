import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { join } from 'path'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check regen count
    const { data: profile } = await supabase
      .from('profiles')
      .select('behavioral_regen_count')
      .eq('id', user.id)
      .single()

    const regenCount = profile?.behavioral_regen_count ?? 0
    if (regenCount >= 3) {
      return NextResponse.json({ error: 'Maximum regenerations (3) reached.' }, { status: 403 })
    }

    const { resume_text } = await req.json()
    if (!resume_text?.trim()) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 })
    }

    // Read behavioral questions
    const questionsPath = join(process.cwd(), 'public', 'behavioral_questions.json')
    const questionsRaw = readFileSync(questionsPath, 'utf-8')
    const allQuestions: Array<{ id: number; category: string; question: string }> = JSON.parse(questionsRaw)

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    // Process in batches of 5
    const BATCH_SIZE = 5
    const allAnswers: Array<{
      question_index: number
      story_index: number
      situation: string
      task_text: string
      action: string
      result: string
    }> = []

    for (let batchStart = 0; batchStart < allQuestions.length; batchStart += BATCH_SIZE) {
      const batch = allQuestions.slice(batchStart, batchStart + BATCH_SIZE)
      // Use local indices 0-N so the AI returns 0,1,2... and we add batchStart ourselves
      const questionsJson = JSON.stringify(batch.map((q, i) => ({
        index: i,
        question: q.question,
        category: q.category,
      })))

      const prompt = `You are helping someone prepare for behavioral interviews. Based on their resume below, generate 3 distinct STAR (Situation, Task, Action, Result) stories for each behavioral question. Make answers specific, realistic, and tailored to their actual experience.

RESUME:
${resume_text}

Generate exactly 3 STAR stories for each of these ${batch.length} behavioral questions. Return ONLY valid JSON in this exact format:
[
  {
    "questionIndex": 0,
    "stories": [
      { "situation": "...", "task": "...", "action": "...", "result": "..." },
      { "situation": "...", "task": "...", "action": "...", "result": "..." },
      { "situation": "...", "task": "...", "action": "...", "result": "..." }
    ]
  }
]

QUESTIONS:
${questionsJson}`

      const result = await model.generateContent(prompt)
      const text = result.response.text()

      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) continue

      const parsed: Array<{ questionIndex: number; stories: Array<{ situation: string; task: string; action: string; result: string }> }> = JSON.parse(jsonMatch[0])

      for (const item of parsed) {
        const actualIndex = batchStart + item.questionIndex
        item.stories.forEach((story, si) => {
          allAnswers.push({
            question_index: actualIndex,
            story_index: si,
            situation: story.situation || '',
            task_text: story.task || '',
            action: story.action || '',
            result: story.result || '',
          })
        })
      }

      // Small delay between batches to respect rate limits
      if (batchStart + BATCH_SIZE < allQuestions.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Save answers to database
    if (allAnswers.length > 0) {
      // Delete old answers
      await supabase.from('behavioral_answers').delete().eq('user_id', user.id)

      // Insert new answers
      await supabase.from('behavioral_answers').insert(
        allAnswers.map(a => ({ ...a, user_id: user.id }))
      )
    }

    // Update profile — also persist resume_text so the user can regenerate later
    await supabase.from('profiles').upsert({
      id: user.id,
      behavioral_generated: true,
      behavioral_regen_count: regenCount + 1,
      resume_text: resume_text.trim(),
    }, { onConflict: 'id' })

    return NextResponse.json({ success: true, count: allAnswers.length })
  } catch (err) {
    console.error('[generate-behavioral]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
