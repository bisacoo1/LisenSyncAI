import { BoardProgramKey, PracticeItem, PracticeType, StudyTrack } from '@/types'
import { getProgram } from './syllabus'
import { supabase } from './supabase'
import { validateGeneratedPracticeItems } from './practiceItemValidation'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-3.5-flash-lite'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_DOCUMENT_CHARS = 30_000

// Fallback model chain: if the primary model is unavailable, try the next one
const FALLBACK_MODELS: string[] = [
  GEMINI_MODEL,
  'gemini-3.5-flash-lite',
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

async function geminiGenerate(
  parts: Record<string, unknown>[],
  temperature: number,
  responseMimeType?: 'application/json'
): Promise<{ text: string; model: string }> {
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
          generationConfig: {
            temperature,
            ...(responseMimeType ? { responseMimeType } : {}),
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        return { text, model }
      }
      const detail = await res.text()
      lastError = `Gemini request failed: ${res.status} ${detail.slice(0, 300)}`
      if (res.status === 404) continue
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
  const raw = (fenced ? fenced[1] : text).trim()

  try {
    return JSON.parse(raw)
  } catch {
    // The model may include a short preface or trailing note around the JSON.
  }

  for (let start = 0; start < raw.length; start++) {
    if (raw[start] !== '[' && raw[start] !== '{') continue

    const stack: string[] = []
    let inString = false
    let escaped = false

    for (let end = start; end < raw.length; end++) {
      const character = raw[end]
      if (inString) {
        if (escaped) escaped = false
        else if (character === '\\') escaped = true
        else if (character === '"') inString = false
        continue
      }

      if (character === '"') {
        inString = true
      } else if (character === '[' || character === '{') {
        stack.push(character)
      } else if (character === ']' || character === '}') {
        const opening = stack.pop()
        if ((character === ']' && opening !== '[') || (character === '}' && opening !== '{')) break
        if (stack.length === 0) {
          try {
            return JSON.parse(raw.slice(start, end + 1))
          } catch {
            break
          }
        }
      }
    }
  }

  throw new Error('AI did not return valid JSON. Please try generating the study set again.')
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
  track?: StudyTrack
  count?: number
}): Promise<GeneratedFlashcard[]> {
  const prog = getProgram(params.program)
  const parts = await sourceParts(params)
  const prompt = params.track === 'course'
    ? `You are an expert BS Pharmacy course tutor. Create concise, accurate active-recall flashcards based strictly on the uploaded course document. Subject: ${params.subject}. Generate ${params.count || 10} flashcards. Each item: {"front":"question/prompt","back":"answer with key facts"}. Return ONLY a valid JSON array.`
    : `You are an expert PRC licensure exam reviewer for ${prog.name}. Create concise, accurate active-recall flashcards strictly aligned to the official board syllabus. Subject: ${params.subject}. Generate ${params.count || 10} flashcards from the uploaded document. Each item: {"front":"question/prompt","back":"answer with key facts"}. Return ONLY a valid JSON array.`
  const { text } = await geminiGenerate([
    ...parts,
    { text: prompt },
  ], 0.4, 'application/json')
  const out = extractJson(text)
  return (Array.isArray(out) ? out : []).filter((card: any) => card?.front && card?.back)
}

export async function generatePracticeItemsFromFile(params: MaterialSource & {
  subject: string
  program: BoardProgramKey
  type: PracticeType
  track?: StudyTrack
  count?: number
}): Promise<Partial<PracticeItem>[]> {
  const prog = getProgram(params.program)
  const count = params.count || 5
  const parts = await sourceParts(params)
  const common = params.track === 'course'
    ? `Program: ${prog.name}\nCourse subject: ${params.subject}\nCreate accurate university-level BS Pharmacy study questions based only on the uploaded course document. Include a clear rationale. Return ONLY a valid JSON array.`
    : `Program: ${prog.name}\nPhLE Module / Subject: ${params.subject}\nAll questions must be PRC Pharmacist Licensure Examination (PhLE) board-exam level, aligned to the official BS Pharmacy syllabus, and include step-by-step rationale. Return ONLY a valid JSON array.`
  let spec = ''
  if (params.type === 'mcq') {
    spec = params.track === 'course'
      ? `Generate ${count} university-level multiple-choice questions from the material. Each: {"type":"mcq","question":{"stem":"clear question or scenario","options":["A text","B text","C text","D text"]},"answer":{"correctIndex":0},"rationale":"brief explanation of the correct answer"}`
      : `Generate ${count} PRC PhLE-style situational multiple-choice questions (higher-order clinical, dispensing, or pharmaceutical science thinking). Each: {"type":"mcq","question":{"stem":"scenario-based stem","options":["A text","B text","C text","D text"]},"answer":{"correctIndex":0},"rationale":"step-by-step rationale explaining why correct and others are not"}`
  } else if (params.type === 'diagnosis') {
    spec = `Generate ${count} clinical/pharmaceutical case & concept diagnosis items. Each: {"type":"diagnosis","question":{"scenario":"clinical, dispensing, pharmacokinetic, pharmacognosy, compounding, or pharmacy jurisprudence scenario","prompt":"Identify the exact drug, mechanism, condition, pharmaceutical principle, law, or calculation formula that applies"},"answer":{"expected":"exact expected identification","acceptable":["synonyms/variants"]},"rationale":"step-by-step rationale"}`
  } else if (params.type === 'sequence') {
    spec = `Generate ${count} priority/sequence ordering items for pharmacy practice, compounding, QC testing, or clinical intervention. Each: {"type":"sequence","question":{"prompt":"Arrange the following steps in the correct chronological/priority order","items":["step A","step B","step C","step D"]},"answer":{"order":["step ... in correct order"]},"rationale":"step-by-step rationale for the order"}. Ensure answer.order is a permutation of question.items.`
  } else if (params.type === 'enumeration') {
    spec = `Generate ${count} enumeration/listing items appropriate for a university course subject (e.g., list the parts, steps, classifications, or examples covered in the material). Each: {"type":"enumeration","question":{"prompt":"Enumerate/list the following"},"answer":{"items":["item 1","item 2","item 3"]},"rationale":"brief explanation of the complete list"}`
  } else if (params.type === 'identification') {
    spec = `Generate ${count} identification items appropriate for a university course subject (identify a term, concept, structure, process, or classification from a description). Each: {"type":"identification","question":{"scenario":"description or context","prompt":"Identify the term/concept that applies"},"answer":{"expected":"exact expected identification","acceptable":["synonyms/variants"]},"rationale":"brief explanation"}`
  } else {
    spec = `Generate ${count} active-recall drills. Each: {"type":"flashcard_drill","question":{"stem":"drill prompt"},"answer":{"expected":"answer"},"rationale":"brief rationale"}`
  }
  const { text } = await geminiGenerate([
    ...parts,
    { text: `${common}\n${spec}\nGenerate items from the uploaded document.` },
  ], 0.4, 'application/json')
  return validateGeneratedPracticeItems(
    extractJson(text),
    params.type,
    params.subject,
    prog.key,
  )
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

export async function generateStudyHint(params: {
  contextText: string
  program: BoardProgramKey
  subject: string
  previousHints?: string[]
  forbiddenAnswers?: string[]
}): Promise<string> {
  if (!params.contextText.trim()) throw new Error('There is no question available to hint on.')

  const prog = getProgram(params.program)
  const previousHints = params.previousHints || []
  const prompt = [
    `You are a supportive ${prog.name} study tutor for ${params.subject}.`,
    `Give exactly one brief, progressively more specific study hint (${previousHints.length + 1} of 2) for the question below.`,
    'Do not state or quote the answer, identify the correct option, solve the problem, or list expected items.',
    'Point the student toward a concept, clue, or reasoning step they should consider. Use 1–2 sentences and return only the hint.',
    previousHints.length ? `Hints already given; do not repeat them:\n${previousHints.join('\n')}` : '',
    `Question context:\n${params.contextText}`,
  ].filter(Boolean).join('\n\n')
  const { text } = await geminiGenerate([{ text: prompt }], 0.35)
  const hint = text.trim()
  if (!hint) throw new Error('AI did not return a study hint. Please try again.')

  const normalizedHint = hint.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const includesAnswer = (params.forbiddenAnswers || []).some(answer => {
    const normalizedAnswer = answer.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    return normalizedAnswer.length >= 4 && normalizedHint.includes(normalizedAnswer)
  })
  if (includesAnswer) {
    throw new Error('That hint was too close to the answer. Try again or answer the question first.')
  }

  return hint
}
