import { BoardProgramKey, PracticeItem, PracticeType } from '@/types'
import { getProgram } from './syllabus'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const MODEL = (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || 'gpt-4o-mini'
const BASE_URL = (import.meta.env.VITE_OPENAI_BASE_URL as string | undefined) || 'https://api.openai.com/v1'

export function aiConfigured() {
  return !!API_KEY && !API_KEY.includes('your-')
}

async function chat(system: string, user: string): Promise<string> {
  if (!aiConfigured()) throw new Error('AI API is not configured. Set VITE_OPENAI_API_KEY in .env.')
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  if (!res.ok) throw new Error(`AI request failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('[') !== -1 || raw.indexOf('{') !== -1 ? raw : text
  const firstArr = start.indexOf('[')
  const firstObj = start.indexOf('{')
  let s = -1
  if (firstArr === -1) s = firstObj
  else if (firstObj === -1) s = firstArr
  else s = Math.min(firstArr, firstObj)
  if (s === -1) throw new Error('AI did not return JSON')
  const candidate = raw.slice(s)
  // try to parse by trimming trailing text
  for (let end = candidate.length; end > 0; end--) {
    const ch = candidate[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(candidate.slice(0, end)) } catch { /* continue */ }
  }
  throw new Error('Failed to parse AI JSON output')
}

export interface GeneratedFlashcard { front: string; back: string }

export async function generateFlashcards(params: {
  text: string
  subject: string
  program: BoardProgramKey
  count?: number
}): Promise<GeneratedFlashcard[]> {
  const prog = getProgram(params.program)
  const system = `You are an expert PRC licensure exam reviewer for ${prog.name}. Create concise, accurate active-recall flashcards strictly aligned to the official board syllabus. Return ONLY valid JSON array.`
  const user = `Subject: ${params.subject}\nGenerate ${params.count || 10} flashcards from the reviewer text below.\nEach item: {"front":"question/prompt","back":"answer with key facts"}.\nReviewer text:\n${params.text.slice(0, 12000)}`
  const out = extractJson(await chat(system, user))
  return (Array.isArray(out) ? out : []).filter(x => x?.front && x?.back)
}

export async function generatePracticeItems(params: {
  text: string
  subject: string
  program: BoardProgramKey
  type: PracticeType
  count?: number
}): Promise<Partial<PracticeItem>[]> {
  const prog = getProgram(params.program)
  const count = params.count || 5
  const common = `Program: ${prog.name}\nSubject: ${params.subject}\nAll questions must be board-exam level, aligned to the syllabus, and include step-by-step rationale. Return ONLY valid JSON array.`
  let spec = ''
  if (params.type === 'mcq') {
    spec = `Generate ${count} PRC-style situational multiple-choice questions (higher-order thinking). Each: {"type":"mcq","question":{"stem":"scenario-based stem","options":["A text","B text","C text","D text"]},"answer":{"correctIndex":0},"rationale":"step-by-step rationale explaining why correct and others are not"}`
  } else if (params.type === 'diagnosis') {
    spec = `Generate ${count} case/concept diagnosis items. Each: {"type":"diagnosis","question":{"scenario":"clinical/legal/mathematical scenario","prompt":"Identify the exact principle, disease, law, or formula that applies"},"answer":{"expected":"exact expected identification","acceptable":["synonyms/variants"]},"rationale":"step-by-step rationale"}`
  } else if (params.type === 'sequence') {
    spec = `Generate ${count} priority/sequence ordering items. Each: {"type":"sequence","question":{"prompt":"Arrange the following in the correct chronological/priority order","items":["step A","step B","step C","step D"]},"answer":{"order":["step ... in correct order"]},"rationale":"step-by-step rationale for the order"}. Ensure answer.order is a permutation of question.items.`
  } else {
    spec = `Generate ${count} active-recall drills. Each: {"type":"flashcard_drill","question":{"stem":"drill prompt"},"answer":{"expected":"answer"},"rationale":"brief rationale"}`
  }
  const user = `${common}\n${spec}\nReviewer text:\n${params.text.slice(0, 12000)}`
  const system = `You create rigorous PRC licensure exam assessment items. No casual trivia. Focus on 75% passing benchmark readiness.`
  const out = extractJson(await chat(system, user))
  const arr = Array.isArray(out) ? out : []
  return arr.map((it: any) => ({
    type: params.type,
    subject: params.subject,
    board_program: params.program,
    question: it.question,
    answer: it.answer,
    rationale: it.rationale || null
  }))
}
