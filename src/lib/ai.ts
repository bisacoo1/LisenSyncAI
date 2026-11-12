import { BoardProgramKey, PracticeItem, PracticeType } from '@/types'
import { getProgram } from './syllabus'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.5-flash-lite'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Fallback model chain: if the primary model is unavailable, try the next one
const FALLBACK_MODELS: string[] = [
  GEMINI_MODEL,
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
]

export function geminiConfigured() {
  return !!GEMINI_API_KEY && !GEMINI_API_KEY.includes('your-')
}

export const aiConfigured = geminiConfigured

function isRetryableError(status: number): boolean {
  // Retry on server errors and rate limits; give up on client/config errors
  return status === 429 || status === 503 || status === 500 || status === 502 || status === 504
}

async function geminiRequestWithFallback(model: string, body: Record<string, unknown>): Promise<any> {
  const lastError = await (async () => {
    for (const m of FALLBACK_MODELS) {
      try {
        const res = await fetch(`${GEMINI_BASE}/models/${m}:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, model: `models/${m}` })
        })
        if (res.ok) return res.json()
        const text = await res.text()
        if (!isRetryableError(res.status)) throw new Error(`Gemini request failed: ${res.status} ${text}`)
        // retryable: continue to next model
        continue
      } catch (e: any) {
        if (e.message && !e.message.includes('Gemini request failed')) throw e
        continue
      }
    }
    throw new Error('All Gemini models are currently unavailable. Please try again later.')
  })()
  return lastError
}

async function geminiRequest(path: string, body: unknown) {
  const res = await fetch(`${GEMINI_BASE}/${path}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
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
  for (let end = candidate.length; end > 0; end--) {
    const ch = candidate[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(candidate.slice(0, end)) } catch { /* continue */ }
  }
  throw new Error('Failed to parse AI JSON output')
}

export interface GeneratedFlashcard { front: string; back: string }

export async function generateFlashcardsFromFile(params: {
  dataUrl: string
  mimeType: string
  subject: string
  program: BoardProgramKey
  count?: number
}): Promise<GeneratedFlashcard[]> {
  const prog = getProgram(params.program)
  const body = {
    model: `models/${GEMINI_MODEL}`,
    contents: [{
      parts: [
        { inlineData: { mimeType: params.mimeType, data: params.dataUrl.split(',')[1] } },
        { text: `You are an expert PRC licensure exam reviewer for ${prog.name}. Create concise, accurate active-recall flashcards strictly aligned to the official board syllabus. Subject: ${params.subject}. Generate ${params.count || 10} flashcards from the uploaded document. Each item: {"front":"question/prompt","back":"answer with key facts"}. Return ONLY a valid JSON array.` }
      ]
    }],
    generationConfig: { temperature: 0.4 }
  }
  const data = await geminiRequestWithFallback(GEMINI_MODEL, body)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const out = extractJson(text)
  return (Array.isArray(out) ? out : []).filter(x => x?.front && x?.back)
}

export async function generatePracticeItemsFromFile(params: {
  dataUrl: string
  mimeType: string
  subject: string
  program: BoardProgramKey
  type: PracticeType
  count?: number
}): Promise<Partial<PracticeItem>[]> {
  const prog = getProgram(params.program)
  const count = params.count || 5
  const common = `Program: ${prog.name}\nSubject: ${params.subject}\nAll questions must be board-exam level, aligned to the syllabus, and include step-by-step rationale. Return ONLY a valid JSON array.`
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
  const body = {
    model: `models/${GEMINI_MODEL}`,
    contents: [{
      parts: [
        { inlineData: { mimeType: params.mimeType, data: params.dataUrl.split(',')[1] } },
        { text: `${common}\n${spec}\nGenerate items from the uploaded document.` }
      ]
    }],
    generationConfig: { temperature: 0.4 }
  }
  const data = await geminiRequestWithFallback(GEMINI_MODEL, body)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const out = extractJson(text)
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
