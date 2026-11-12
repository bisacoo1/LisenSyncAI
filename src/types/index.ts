export type BoardProgramKey = 'criminology' | 'pharmacy' | 'civil_engineering'

export interface BoardProgram {
  key: BoardProgramKey
  name: string
  description: string
  subjects: string[]
  tos: TosAllocation[]
  mockDurationMinutes: number
}

export interface TosAllocation {
  subject: string
  items: number
  weightPercent: number
}

export interface Profile {
  id: string
  full_name: string | null
  board_program: BoardProgramKey
  target_exam_date: string | null
  created_at?: string
}

export interface ReviewMaterial {
  id: string
  user_id: string
  title: string
  board_program: BoardProgramKey
  subject: string
  source_filename: string | null
  extracted_text: string | null
  created_at: string
}

export interface Flashcard {
  id: string
  user_id: string
  material_id: string | null
  board_program: BoardProgramKey
  subject: string
  front: string
  back: string
}

export type PracticeType = 'mcq' | 'diagnosis' | 'sequence' | 'flashcard_drill'

export interface McqQuestion {
  stem: string
  options: string[]
}
export interface McqAnswer { correctIndex: number }

export interface DiagnosisQuestion {
  scenario: string
  prompt: string
}
export interface DiagnosisAnswer { expected: string; acceptable?: string[] }

export interface SequenceQuestion {
  prompt: string
  items: string[]
}
export interface SequenceAnswer { order: string[] }

export interface PracticeItem {
  id: string
  user_id?: string
  material_id: string | null
  board_program: BoardProgramKey
  subject: string
  type: PracticeType
  question: McqQuestion | DiagnosisQuestion | SequenceQuestion | Record<string, unknown>
  answer: McqAnswer | DiagnosisAnswer | SequenceAnswer | Record<string, unknown>
  rationale: string | null
  difficulty?: string
}

export interface Attempt {
  id?: string
  user_id: string
  practice_item_id: string | null
  board_program: BoardProgramKey
  subject: string
  type: PracticeType | string
  user_response: unknown
  is_correct: boolean
  created_at?: string
}

export interface MockExam {
  id: string
  user_id: string
  board_program: BoardProgramKey
  title: string
  duration_minutes: number
  tos: TosAllocation[] | null
  total_items: number
  status: 'in_progress' | 'submitted'
  started_at: string
  submitted_at: string | null
  score: number | null
  passed: boolean | null
}

export interface MockExamItem {
  id: string
  exam_id: string
  practice_item_id: string | null
  subject: string
  type: PracticeType
  question: McqQuestion | DiagnosisQuestion | SequenceQuestion | Record<string, unknown>
  answer: McqAnswer | DiagnosisAnswer | SequenceAnswer | Record<string, unknown>
  rationale: string | null
  user_response: unknown | null
  is_correct: boolean | null
  position: number
}

export interface SubjectStat {
  subject: string
  correct: number
  total: number
  percent: number
  weak: boolean
}

export const PASSING_RATE = 75
