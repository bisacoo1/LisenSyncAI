import { BoardProgramKey, PracticeItem, PracticeType } from '@/types'
import { getProgram } from './syllabus'
import { supabase, supabaseConfigured } from './supabase'

export function geminiConfigured() {
  return supabaseConfigured
}

export const aiConfigured = geminiConfigured

async function invokeGemini<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabaseConfigured) {
    throw new Error('Supabase is not configured. Copy .env.example to .env and set your project keys.')
  }
  const { data, error } = await supabase.functions.invoke('gemini', { body })
  if (error) {
    let message = error.message || 'AI request failed'
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.json()
        if (payload?.error) message = payload.error
      } catch { /* keep the invoke error */ }
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

export interface GeneratedFlashcard { front: string; back: string }

export interface MaterialSource {
  documentText?: string
  storagePath?: string
  mimeType?: string
  inlineData?: string
}

export async function extractTextFromFile(source: MaterialSource): Promise<string> {
  const data = await invokeGemini<{ text: string }>({ action: 'extract', ...source })
  return data.text || ''
}

export async function generateFlashcardsFromFile(params: MaterialSource & {
  subject: string
  program: BoardProgramKey
  count?: number
}): Promise<GeneratedFlashcard[]> {
  const prog = getProgram(params.program)
  const data = await invokeGemini<{ cards: GeneratedFlashcard[] }>({
    action: 'flashcards',
    documentText: params.documentText,
    storagePath: params.storagePath,
    mimeType: params.mimeType,
    inlineData: params.inlineData,
    subject: params.subject,
    programName: prog.name,
    count: params.count || 10,
  })
  return data.cards || []
}

export async function generatePracticeItemsFromFile(params: MaterialSource & {
  subject: string
  program: BoardProgramKey
  type: PracticeType
  count?: number
}): Promise<Partial<PracticeItem>[]> {
  const prog = getProgram(params.program)
  const data = await invokeGemini<{ items: Array<Record<string, unknown>> }>({
    action: 'practice',
    documentText: params.documentText,
    storagePath: params.storagePath,
    mimeType: params.mimeType,
    inlineData: params.inlineData,
    subject: params.subject,
    programName: prog.name,
    type: params.type,
    count: params.count || 5,
  })
  return (data.items || []).map((it) => ({
    type: params.type,
    subject: params.subject,
    board_program: params.program,
    question: it.question as PracticeItem['question'],
    answer: it.answer as PracticeItem['answer'],
    rationale: (it.rationale as string | null) || null,
  }))
}

export async function explainText(params: {
  selectedText: string
  followUp?: string
  program: BoardProgramKey
  subject: string
}): Promise<{ explanation: string; model: string }> {
  const prog = getProgram(params.program)
  return invokeGemini<{ explanation: string; model: string }>({
    action: 'explain',
    selectedText: params.selectedText,
    followUp: params.followUp,
    programName: prog.name,
    subject: params.subject,
  })
}
