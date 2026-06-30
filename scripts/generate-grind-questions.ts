import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'

async function main() {
  execSync('python3 scripts/rebuild_questions_data_descriptions.py', { stdio: 'inherit' })
  execSync('python3 scripts/enrich_all_grind_starters.py', { stdio: 'inherit' })

  const { getSet2Questions, getSet3Questions } = await import('../src/lib/questionSets')
  const { buildGrindQuestions } = await import('../src/lib/grindQuestions')

  type Set1Row = { id: number; title: string; slug: string; difficulty: string; starter_python?: string; starter_cpp?: string }
  type PlaybookEntry = { title: string; script: string }
  type QuestionsDataEntry = { id: number; description: string }

  const qs = JSON.parse(readFileSync('public/questions_full.json', 'utf8')) as Set1Row[]
  const mainIds = new Set<number>(qs.map(q => q.id))

  const playbookRaw = JSON.parse(readFileSync('public/playbook_data_all.json', 'utf8')) as Record<string, PlaybookEntry>
  const playbookMap: Record<number, string> = {}
  for (const [id, entry] of Object.entries(playbookRaw)) playbookMap[Number(id)] = entry.script

  const questionsDataRaw = JSON.parse(readFileSync('public/questions_data_all.json', 'utf8')) as Record<string, QuestionsDataEntry>
  const descriptionMap: Record<number, string> = {}
  for (const [id, entry] of Object.entries(questionsDataRaw)) descriptionMap[Number(id)] = entry.description

  const rows = buildGrindQuestions(
    qs,
    getSet2Questions(mainIds, qs),
    getSet3Questions(mainIds, qs),
    playbookMap,
    descriptionMap,
  )
  writeFileSync('public/grind_questions.json', JSON.stringify(rows))

  const withDesc = rows.filter(r => r.description).length
  const withIa = rows.filter(r => r.interviewApproach).length
  const pyWithDescInStarter = rows.filter(r => r.starterPython && r.starterPython.includes('Problem Description')).length
  const pyWithIaInStarter = rows.filter(r => r.starterPython && r.starterPython.includes('Interview Approach')).length
  const pyWithExInStarter = rows.filter(r => r.starterPython && (r.starterPython.includes('── Examples') || r.starterPython.includes('── Test'))).length
  console.log(
    `Wrote public/grind_questions.json (${rows.length} questions, ${withDesc} descriptions, ${withIa} interview approaches, ${pyWithExInStarter} python starters include Examples/Test, ${pyWithDescInStarter} include description, ${pyWithIaInStarter} include interview)`,
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
