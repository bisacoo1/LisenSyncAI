import { BoardProgramKey, PracticeItem, PracticeType } from '@/types'
import { getProgram } from './syllabus'
import { supabase } from './supabase'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.5-flash-lite'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_DOCUMENT_CHARS = 30_000

// Fallback model chain: if the primary model is unavailable, try the next one
const FALLBACK_MODELS: string[] = [
  GEMINI_MODEL,
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
].filter((m, i, list) => list.indexOf(m) === i)

export function geminiConfigured() {
  return !!GEMINI_API_KEY && !GEMINI_API_KEY.includes('your-')
}

export const aiConfigured = geminiConfigured

function isRetryableError(status: number): boolean {
  return status === 429 || status === 503 || status === 500 || status === 502 || status === 504
}

async function geminiGenerate(parts: Record<string, unknown>[], temperature: number): Promise<{ text: string; model: string }> {
  if (!geminiConfigured()) {
    throw new Error('AI is not configured. Set VITE_GEMINI_API_KEY in your environment.')
  }
  let lastError = 'All Gemini models are currently unavailable. Please try again later.'
  for (const model of FALLBACK_MODELS) {
    try {
      const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return { text, model }
      }
      const detail = await res.text()
      lastError = `Gemini request failed: ${res.status} ${detail.slice(0, 300)}`
      if (!isRetryableError(res.status)) throw new Error(lastError)
    } catch (e: any) {
      if (e.message?.startsWith('Gemini request failed')) throw e
      lastError = e.message || lastError
    }
  }
  throw new Error(lastError)
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const firstArr = raw.indexOf('[')
  const firstObj = raw.indexOf('{')
  let s = -1
  if (firstArr === -1) s = firstObj
  else if (firstObj === -1) s = firstArr
  else s = Math.min(firstArr, firstObj)
  if (s === -1) throw new Error('AI did not return JSON')
  const candidate = raw.slice(s)
  for (let end = candidate.length; end > 0; end--) {
    const ch = candidate[end - 1]
    if (ch !== ']' && ch !== '}') continue
    try { return JSON.parse(candidate.slice(0, end)) } catch { /* keep scanning */ }
  }
  throw new Error('Failed to parse AI JSON output')
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export interface MaterialSource {
  documentText?: string
  storagePath?: string
  mimeType?: string
  inlineData?: string
}

async function sourceParts(source: MaterialSource): Promise<Record<string, unknown>[]> {
  if (source.documentText?.trim()) {
    return [{ text: source.documentText.trim().slice(0, MAX_DOCUMENT_CHARS) }]
  }
  if (source.inlineData) {
    return [{ inlineData: { mimeType: source.mimeType || 'application/pdf', data: source.inlineData } }]
  }
  if (source.storagePath) {
    const { data, error } = await supabase.storage.from('review-materials').download(source.storagePath)
    if (error || !data) throw new Error(error?.message || 'Could not read the uploaded file.')
    const buf = await data.arrayBuffer()
    return [{ inlineData: { mimeType: data.type || source.mimeType || 'application/pdf', data: arrayBufferToBase64(buf) } }]
  }
  throw new Error('A saved file or extracted text is required.')
}

export interface GeneratedFlashcard { front: string; back: string }

export async function extractTextFromFile(source: MaterialSource): Promise<string> {
  if (source.documentText?.trim()) return source.documentText.trim()
  const parts = await sourceParts(source)
  const { text } = await geminiGenerate([
    ...parts,
    { text: 'Extract all the text content from this document. Return ONLY the raw text content, preserving paragraphs and line breaks. Do not add any commentary, formatting, or analysis — just the raw text as it appears in the document.' },
  ], 0.1)
  return text || ''
}

export async function generateFlashcardsFromFile(params: MaterialSource & {
  subject: string
  program: BoardProgramKey
  count?: number
}): Promise<GeneratedFlashcard[]> {
  const prog = getProgram(params.program)
  const parts = await sourceParts(params)
  const { text } = await geminiGenerate([
    ...parts,
    { text: `You are an expert PRC licensure exam reviewer for ${prog.name}. Create concise, accurate active-recall flashcards strictly aligned to the official board syllabus. Subject: ${params.subject}. Generate ${params.count || 10} flashcards from the uploaded document. Each item: {"front":"question/prompt","back":"answer with key facts"}. Return ONLY a valid JSON array.` },
  ], 0.4)
  const out = extractJson(text)
  return (Array.isArray(out) ? out : []).filter((card: any) => card?.front && card?.back)
}

export async function generatePracticeItemsFromFile(params: MaterialSource & {
  subject: string
  program: BoardProgramKey
  type: PracticeType
  count?: number
}): Promise<Partial<PracticeItem>[]> {
  const prog = getProgram(params.program)
  const count = params.count || 5
  const parts = await sourceParts(params)
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
  const { text } = await geminiGenerate([
    ...parts,
    { text: `${common}\n${spec}\nGenerate items from the uploaded document.` },
  ], 0.4)
  const out = extractJson(text)
  const arr = Array.isArray(out) ? out : []
  return arr.map((it: any) => ({
    type: params.type,
    subject: params.subject,
    board_program: params.program,
    question: it.question,
    answer: it.answer,
    rationale: it.rationale || null,
  }))
}

export async function explainText(params: {
  selectedText: string
  followUp?: string
  program: BoardProgramKey
  subject: string
}): Promise<{ explanation: string; model: string }> {
  const prog = getProgram(params.program)
  const prompt = params.followUp
    ? `The user previously asked about this text and you explained it. Now they have a follow-up question. Selected text: "${params.selectedText}". Follow-up question: "${params.followUp}". Answer the follow-up question based on the context of the selected text. Be concise and educational.`
    : `You are an expert ${prog.name} board exam reviewer. Explain the following selected text from a review document. Subject: ${params.subject}. Provide a clear, educational explanation that helps the student understand the concept. Include key points, definitions, and any important details. Selected text: "${params.selectedText}"`
  const { text, model } = await geminiGenerate([{ text: prompt }], 0.5)
  return { explanation: text || 'No explanation generated.', model }
}
