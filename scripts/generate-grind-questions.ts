import { readFileSync, writeFileSync } from 'fs'
import { getSet2Questions, getSet3Questions } from '../src/lib/questionSets'
import { buildGrindQuestions } from '../src/lib/grindQuestions'

type Set1Row = { id: number; title: string; slug: string; difficulty: string; starter_python?: string; starter_cpp?: string }

const qs = JSON.parse(readFileSync('public/questions_full.json', 'utf8')) as Set1Row[]
const mainIds = new Set<number>(qs.map(q => q.id))
const rows = buildGrindQuestions(qs, getSet2Questions(mainIds, qs), getSet3Questions(mainIds, qs))
writeFileSync('public/grind_questions.json', JSON.stringify(rows))
console.log(`Wrote public/grind_questions.json (${rows.length} questions)`)
