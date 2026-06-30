import { readFileSync, writeFileSync } from 'fs'
import { getSet2Questions, getSet3Questions } from '../src/lib/questionSets'
import { buildGrindQuestions } from '../src/lib/grindQuestions'

type Set1Row = { id: number; title: string; slug: string; difficulty: string; starter_python?: string; starter_cpp?: string }
type PlaybookEntry = { title: string; script: string }

const qs = JSON.parse(readFileSync('public/questions_full.json', 'utf8')) as Set1Row[]
const mainIds = new Set<number>(qs.map(q => q.id))

const playbookRaw = JSON.parse(readFileSync('public/playbook_data_all.json', 'utf8')) as Record<string, PlaybookEntry>
const playbookMap: Record<number, string> = {}
for (const [id, entry] of Object.entries(playbookRaw)) playbookMap[Number(id)] = entry.script

const rows = buildGrindQuestions(qs, getSet2Questions(mainIds, qs), getSet3Questions(mainIds, qs), playbookMap)
writeFileSync('public/grind_questions.json', JSON.stringify(rows))

const withIa = rows.filter(r => r.interviewApproach).length
console.log(`Wrote public/grind_questions.json (${rows.length} questions, ${withIa} with interview approach)`)
