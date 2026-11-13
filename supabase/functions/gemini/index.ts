import { createClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding/base64'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_DOCUMENT_CHARS = 30_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Action = 'extract' | 'flashcards' | 'practice' | 'explain'

interface RequestBody {
  action?: Action
  storagePath?: string
  mimeType?: string
  inlineData?: string
  documentText?: string
  subject?: string
  programName?: string
  count?: number
  type?: 'mcq' | 'diagnosis' | 'sequence' | 'flashcard_drill'
  selectedText?: string
  followUp?: string
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function models(): string[] {
  const primary = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash-lite'
  return [primary, 'gemini-3-flash', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']
    .filter((model, index, list) => list.indexOf(model) === index)
}

function extractJson(text: string): unknown {
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
    try { return JSON.parse(candidate.slice(0, end)) } catch { /* keep scanning */ }
  }
  throw new Error('Failed to parse AI JSON output')
}

async function geminiGenerate(parts: Record<string, unknown>[], temperature: number) {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY is not set on the Supabase project.')

  let lastDetail = 'All Gemini models are currently unavailable.'
  for (const model of models()) {
    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?key=${key}`, {
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
    lastDetail = `Gemini request failed: ${res.status} ${detail.slice(0, 300)}`
    const retryable = res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504
    if (!retryable) throw new Error(lastDetail)
  }
  throw new Error(lastDetail)
}

async function fileParts(supabase: ReturnType<typeof createClient>, userId: string, body: RequestBody) {
  if (body.documentText?.trim()) {
    return [{ text: body.documentText.trim().slice(0, MAX_DOCUMENT_CHARS) }]
  }

  let bytes: Uint8Array | null = null
  let mimeType = body.mimeType || 'application/pdf'

  if (body.storagePath) {
    if (body.storagePath.includes('..') || !body.storagePath.startsWith(`${userId}/`)) {
      throw new Error('You can only use your own uploaded files.')
    }
    const { data, error } = await supabase.storage.from('review-materials').download(body.storagePath)
    if (error || !data) throw new Error(error?.message || 'Could not read the uploaded file.')
    if (data.size > MAX_FILE_BYTES) throw new Error('File must be 10MB or smaller.')
    bytes = new Uint8Array(await data.arrayBuffer())
    if (data.type) mimeType = data.type
  } else if (body.inlineData) {
    const estimated = Math.floor(body.inlineData.length * 0.75)
    if (estimated > MAX_FILE_BYTES) throw new Error('File must be 10MB or smaller.')
    return [{ inlineData: { mimeType, data: body.inlineData } }]
  }

  if (!bytes) throw new Error('A saved file or extracted text is required.')
  return [{ inlineData: { mimeType, data: encodeBase64(bytes) } }]
}

function practiceSpec(type: RequestBody['type'], count: number) {
  if (type === 'mcq') {
    return `Generate ${count} PRC-style situational multiple-choice questions (higher-order thinking). Each: {"type":"mcq","question":{"stem":"scenario-based stem","options":["A text","B text","C text","D text"]},"answer":{"correctIndex":0},"rationale":"step-by-step rationale explaining why correct and others are not"}`
  }
  if (type === 'diagnosis') {
    return `Generate ${count} case/concept diagnosis items. Each: {"type":"diagnosis","question":{"scenario":"clinical/legal/mathematical scenario","prompt":"Identify the exact principle, disease, law, or formula that applies"},"answer":{"expected":"exact expected identification","acceptable":["synonyms/variants"]},"rationale":"step-by-step rationale"}`
  }
  if (type === 'sequence') {
    return `Generate ${count} priority/sequence ordering items. Each: {"type":"sequence","question":{"prompt":"Arrange the following in the correct chronological/priority order","items":["step A","step B","step C","step D"]},"answer":{"order":["step ... in correct order"]},"rationale":"step-by-step rationale for the order"}. Ensure answer.order is a permutation of question.items.`
  }
  return `Generate ${count} active-recall drills. Each: {"type":"flashcard_drill","question":{"stem":"drill prompt"},"answer":{"expected":"answer"},"rationale":"brief rationale"}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json(401, { error: 'Sign in is required.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) return json(500, { error: 'Supabase function environment is incomplete.' })

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json(401, { error: 'Sign in is required.' })

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'Invalid request body.' })
  }

  try {
    if (body.action === 'extract') {
      const parts = await fileParts(supabase, userData.user.id, body)
      const { text } = await geminiGenerate([
        ...parts,
        { text: 'Extract all the text content from this document. Return ONLY the raw text content, preserving paragraphs and line breaks. Do not add any commentary, formatting, or analysis — just the raw text as it appears in the document.' },
      ], 0.1)
      return json(200, { text })
    }

    if (body.action === 'flashcards') {
      const count = Math.min(Math.max(body.count || 10, 1), 20)
      const parts = await fileParts(supabase, userData.user.id, body)
      const { text, model } = await geminiGenerate([
        ...parts,
        { text: `You are an expert PRC licensure exam reviewer for ${body.programName || 'a PRC board program'}. Create concise, accurate active-recall flashcards strictly aligned to the official board syllabus. Subject: ${body.subject || 'General'}. Generate ${count} flashcards from the uploaded document. Each item: {"front":"question/prompt","back":"answer with key facts"}. Return ONLY a valid JSON array.` },
      ], 0.4)
      const out = extractJson(text)
      const cards = (Array.isArray(out) ? out : []).filter((card) => card?.front && card?.back)
      return json(200, { cards, model })
    }

    if (body.action === 'practice') {
      const count = Math.min(Math.max(body.count || 5, 1), 15)
      const parts = await fileParts(supabase, userData.user.id, body)
      const common = `Program: ${body.programName || 'a PRC board program'}\nSubject: ${body.subject || 'General'}\nAll questions must be board-exam level, aligned to the syllabus, and include step-by-step rationale. Return ONLY a valid JSON array.`
      const { text, model } = await geminiGenerate([
        ...parts,
        { text: `${common}\n${practiceSpec(body.type, count)}\nGenerate items from the uploaded document.` },
      ], 0.4)
      const out = extractJson(text)
      return json(200, { items: Array.isArray(out) ? out : [], model })
    }

    if (body.action === 'explain') {
      if (!body.selectedText?.trim()) return json(400, { error: 'Selected text is required.' })
      const prompt = body.followUp
        ? `The user previously asked about this text and you explained it. Now they have a follow-up question. Selected text: "${body.selectedText}". Follow-up question: "${body.followUp}". Answer the follow-up question based on the context of the selected text. Be concise and educational.`
        : `You are an expert ${body.programName || 'PRC board'} board exam reviewer. Explain the following selected text from a review document. Subject: ${body.subject || 'General'}. Provide a clear, educational explanation that helps the student understand the concept. Include key points, definitions, and any important details. Selected text: "${body.selectedText}"`
      const { text, model } = await geminiGenerate([{ text: prompt }], 0.5)
      return json(200, { explanation: text || 'No explanation generated.', model })
    }

    return json(400, { error: 'Unknown action.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed.'
    const status = message.includes('your own uploaded files') ? 403 : 502
    return json(status, { error: message })
  }
})
