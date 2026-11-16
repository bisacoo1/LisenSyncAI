import { BoardProgram, BoardProgramKey, SubjectDetail } from '@/types'

export const DEFAULT_PROGRAM: BoardProgramKey = 'pharmacy'

export const PHARMACY_SUBJECTS: SubjectDetail[] = [
  {
    name: 'Pharmaceutical Chemistry',
    moduleNumber: '01',
    moduleCode: 'Module 1',
    description: 'Inorganic & organic medicinal chemistry, structure-activity relationships, and drug analysis.',
    items: 20,
    weightPercent: 20,
    icon: 'flask',
  },
  {
    name: 'Pharmacognosy',
    moduleNumber: '02',
    moduleCode: 'Module 2',
    description: 'Natural products, phytochemistry, plant-derived therapeutics, and herbal monographs.',
    items: 15,
    weightPercent: 15,
    icon: 'leaf',
  },
  {
    name: 'Practice of Pharmacy',
    moduleNumber: '03',
    moduleCode: 'Module 3',
    description: 'Dispensing, clinical pharmacy, pharmacotherapy, jurisprudence, and patient counseling.',
    items: 18,
    weightPercent: 17.5,
    icon: 'stethoscope',
  },
  {
    name: 'Pharmacology-Pharmacokinetics',
    moduleNumber: '04',
    moduleCode: 'Module 4',
    description: 'Mechanisms of action, ADME, clinical toxicology, drug interactions, and biopharmaceutics.',
    items: 15,
    weightPercent: 15,
    icon: 'heart-pulse',
  },
  {
    name: 'Pharmaceutics',
    moduleNumber: '05',
    moduleCode: 'Module 5',
    description: 'Dosage form design, compounding, physical pharmacy, and pharmaceutical calculations.',
    items: 17,
    weightPercent: 17,
    icon: 'pill',
  },
  {
    name: 'Quality Assurance/Quality Control',
    moduleNumber: '06',
    moduleCode: 'Module 6',
    description: 'cGMP standards, pharmaceutical testing, stability, microbiology, and regulatory compliance.',
    items: 15,
    weightPercent: 15,
    icon: 'shield-check',
  },
]

export const PHARMACY_PROGRAM: BoardProgram = {
  key: 'pharmacy',
  name: 'BS Pharmacy (Pharmacist Licensure Examination)',
  shortName: 'BS Pharmacy · PhLE',
  examAcronym: 'PhLE',
  description:
    'Focused review aligned to all 6 PRC Pharmacist Licensure Examination (PhLE) modules, clinical cases, and pharmaceutical sciences.',
  subjects: PHARMACY_SUBJECTS.map((s) => s.name),
  subjectDetails: PHARMACY_SUBJECTS,
  tos: PHARMACY_SUBJECTS.map((s) => ({
    subject: s.name,
    items: s.items,
    weightPercent: s.weightPercent,
  })),
  // Real PhLE runs two days (~5.5h of testing per day).
  mockDurationMinutes: 660,
}

// Aligned to the official PRC Program of the Pharmacists Licensure Examination
// (PhLE): six subjects weighted per the board's Table of Specifications.
// Passing rule (RA 10918): 75% general weighted average with no subject below 50%.
export const BOARD_PROGRAMS: Record<BoardProgramKey, BoardProgram> = {
  pharmacy: PHARMACY_PROGRAM,
}

export const PROGRAM_LIST = [PHARMACY_PROGRAM]

export const PROGRAM_SHORT_NAMES: Record<BoardProgramKey, string> = {
  pharmacy: 'Pharmacy'
}

export function getProgram(_key?: BoardProgramKey | string | null): BoardProgram {
  return PHARMACY_PROGRAM
}

export function getSubjectDetail(subjectName: string): SubjectDetail | undefined {
  return PHARMACY_SUBJECTS.find((s) => s.name === subjectName)
}
