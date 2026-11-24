import academicScholar from '@/assets/avatar-borders/academic-scholar.png'
import capsuleSpecialist from '@/assets/avatar-borders/capsule-specialist.png'
import goldenGraduate from '@/assets/avatar-borders/golden-graduate.png'
import labWizard from '@/assets/avatar-borders/lab-wizard.png'
import masterAlchemist from '@/assets/avatar-borders/master-alchemist.png'
import mortalAndPestleChampion from '@/assets/avatar-borders/mortal-and-pestle-champion.png'
import prescribingExpert from '@/assets/avatar-borders/prescribing-expert.png'
import superbHealer from '@/assets/avatar-borders/superb-healer.png'
import type { ProfileAvatarBorderId } from '@/types'

export interface ProfileAvatarBorder {
  id: ProfileAvatarBorderId
  label: string
  image?: string
  locked: boolean
}

export const PROFILE_AVATAR_BORDERS: readonly ProfileAvatarBorder[] = [
  { id: 'default-circle', label: 'Default Border', locked: false },
  { id: 'capsule-specialist', label: 'Capsule Specialist', image: capsuleSpecialist, locked: false },
  { id: 'prescribing-expert', label: 'The Prescribing Expert', image: prescribingExpert, locked: true },
  { id: 'golden-graduate', label: 'The Golden Graduate', image: goldenGraduate, locked: true },
  { id: 'superb-healer', label: 'Superb Healer', image: superbHealer, locked: true },
  { id: 'lab-wizard', label: 'The Lab Wizard', image: labWizard, locked: true },
  { id: 'academic-scholar', label: 'The Academic Scholar', image: academicScholar, locked: true },
  { id: 'master-alchemist', label: 'The Master Alchemist', image: masterAlchemist, locked: true },
  { id: 'mortal-and-pestle-champion', label: 'The Mortal and Pestle Champion', image: mortalAndPestleChampion, locked: true },
]
