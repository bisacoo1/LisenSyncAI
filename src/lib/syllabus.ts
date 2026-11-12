import { BoardProgram, BoardProgramKey } from '@/types'

export const BOARD_PROGRAMS: Record<BoardProgramKey, BoardProgram> = {
  criminology: {
    key: 'criminology',
    name: 'BS Criminology (Criminologist Licensure Examination)',
    description: 'Review aligned to core criminology licensure subjects and PRC-style situational competencies.',
    subjects: [
      'Criminal Law and Jurisprudence',
      'Law Enforcement Administration',
      'Crime Detection and Investigation',
      'Criminalistics',
      'Correctional Administration',
      'Criminology'
    ],
    tos: [
      { subject: 'Criminal Law and Jurisprudence', items: 20, weightPercent: 20 },
      { subject: 'Law Enforcement Administration', items: 20, weightPercent: 20 },
      { subject: 'Crime Detection and Investigation', items: 15, weightPercent: 15 },
      { subject: 'Criminalistics', items: 20, weightPercent: 20 },
      { subject: 'Correctional Administration', items: 10, weightPercent: 10 },
      { subject: 'Criminology', items: 15, weightPercent: 15 }
    ],
    mockDurationMinutes: 240
  },
  pharmacy: {
    key: 'pharmacy',
    name: 'BS Pharmacy (Pharmacist Licensure Examination)',
    description: 'Review aligned to pharmacy practice, sciences, and PRC-style clinical/case competencies.',
    subjects: [
      'Pharmaceutical Chemistry',
      'Pharmacognosy',
      'Practice of Pharmacy',
      'Pharmacology-Pharmacokinetics',
      'Pharmaceutics',
      'Quality Assurance/Quality Control'
    ],
    tos: [
      { subject: 'Pharmaceutical Chemistry', items: 20, weightPercent: 20 },
      { subject: 'Pharmacognosy', items: 15, weightPercent: 15 },
      { subject: 'Practice of Pharmacy', items: 17, weightPercent: 17 },
      { subject: 'Pharmacology-Pharmacokinetics', items: 15, weightPercent: 15 },
      { subject: 'Pharmaceutics', items: 17, weightPercent: 17 },
      { subject: 'Quality Assurance/Quality Control', items: 16, weightPercent: 16 }
    ],
    mockDurationMinutes: 300
  },
  civil_engineering: {
    key: 'civil_engineering',
    name: 'BS Civil Engineering (Civil Engineer Licensure Examination)',
    description: 'Review aligned to civil engineering board subjects, computations, and situational problem solving.',
    subjects: [
      'Mathematics, Surveying and Transportation Engineering',
      'Hydraulics and Geotechnical Engineering',
      'Structural Engineering and Construction'
    ],
    tos: [
      { subject: 'Mathematics, Surveying and Transportation Engineering', items: 35, weightPercent: 35 },
      { subject: 'Hydraulics and Geotechnical Engineering', items: 30, weightPercent: 30 },
      { subject: 'Structural Engineering and Construction', items: 35, weightPercent: 35 }
    ],
    mockDurationMinutes: 300
  }
}

export const PROGRAM_LIST = Object.values(BOARD_PROGRAMS)

export function getProgram(key: BoardProgramKey) {
  return BOARD_PROGRAMS[key]
}
