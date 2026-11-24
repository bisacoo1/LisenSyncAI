import { useEffect, useRef, useState } from 'react'
import achievementBadgePopSound from '@/assets/achievement-badge-pop.mp3'
import clinicalTherapeuticsBadge from '@/assets/achievement-clinical-therapeutics.png'
import compoundingMathBadge from '@/assets/achievement-compounding-math.png'
import courseMasteryBadge from '@/assets/achievement-course-mastery.png'
import medChemKineticsBadge from '@/assets/achievement-medchem-kinetics.png'
import pharmacologyMicroBadge from '@/assets/achievement-pharmacology-micro.png'
import reviewQueueRecoveryBadge from '@/assets/achievement-review-queue-recovery.png'
import studyConsistencyBadge from '@/assets/achievement-study-consistency.png'
import { useAuth } from '@/context/AuthContext'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { Badge, Icon, Modal, ProgressBar } from '@/components/ui'
import type { IconName } from '@/components/ui/Icon'
import { calculateAchievementProgress, type AchievementProgress, type AchievementProgressId } from '@/lib/achievementProgress'
import { parseCompletedStudyModes, studyModeProgressKey } from '@/lib/studyModeProgress'
import { gameSound } from '@/lib/gameSound'
import { supabase } from '@/lib/supabase'
import type { Attempt, Flashcard, PracticeItem, ReviewMaterial, UserSubject } from '@/types'

const ATTEMPT_PAGE_SIZE = 1000

async function loadAllAttempts(userId: string): Promise<Pick<Attempt, 'practice_item_id' | 'type' | 'is_correct' | 'created_at'>[]> {
  const attempts: Pick<Attempt, 'practice_item_id' | 'type' | 'is_correct' | 'created_at'>[] = []
  for (let from = 0; ; from += ATTEMPT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('attempts')
      .select('practice_item_id,type,is_correct,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, from + ATTEMPT_PAGE_SIZE - 1)
    if (error) throw error
    const page = (data as Pick<Attempt, 'practice_item_id' | 'type' | 'is_correct' | 'created_at'>[] | null) || []
    attempts.push(...page)
    if (page.length < ATTEMPT_PAGE_SIZE) return attempts
  }
}

const achievements: {
  id: AchievementProgressId
  title: string
  category: string
  icon: IconName
  badgeImage?: string
  requirement: string
}[] = [
  {
    id: 'study-consistency',
    title: 'Study Consistency',
    category: 'Habit',
    icon: 'calendar',
    badgeImage: studyConsistencyBadge,
    requirement: 'Maintain a 14-day study streak and review 300 flashcards from your spaced-repetition decks.'
  },
  {
    id: 'otc-error-recovery',
    title: 'Review Queue Recovery',
    category: 'Remediation',
    icon: 'refresh-cw',
    badgeImage: reviewQueueRecoveryBadge,
    requirement: 'Correctly answer 50 previously missed questions from your review queue. Missed questions stay in the queue until you answer them correctly.'
  },
  {
    id: 'compounding-math',
    title: 'Compounding & Math',
    category: 'Skill',
    icon: 'flask',
    badgeImage: compoundingMathBadge,
    requirement: 'Correctly answer 30 practice questions from reviewer materials covering compounding, dosage forms, or pharmaceutical calculations.'
  },
  {
    id: 'pharmacology-micro',
    title: 'Pharmacology & Micro',
    category: 'Accuracy',
    icon: 'timer',
    badgeImage: pharmacologyMicroBadge,
    requirement: 'Reach at least 90% accuracy after answering 10 or more multiple-choice questions from reviewer materials covering pharmacology, pharmacokinetics, or microbiology.'
  },
  {
    id: 'medchem-kinetics',
    title: 'MedChem & Kinetics',
    category: 'Precision',
    icon: 'target',
    badgeImage: medChemKineticsBadge,
    requirement: 'Answer at least 10 multiple-choice questions from reviewer materials covering medicinal chemistry, pharmacokinetics, or drug interactions with 100% accuracy.'
  },
  {
    id: 'clinical-therapeutics',
    title: 'Clinical Therapeutics',
    category: 'Applied',
    icon: 'stethoscope',
    badgeImage: clinicalTherapeuticsBadge,
    requirement: 'Complete 25 practice questions from your uploaded clinical pharmacy or therapeutics materials using the study modes available in your track.'
  },
  {
    id: 'course-mastery',
    title: 'Course Mastery',
    category: 'End-Game',
    icon: 'graduation-cap',
    badgeImage: courseMasteryBadge,
    requirement: 'For each uploaded reviewer, complete every study mode available in your study track.'
  }
]

export default function AchievementsPage() {
  const { profile } = useAuth()
  const achievementAudio = useRef<HTMLAudioElement | null>(null)
  const [achievementProgress, setAchievementProgress] = useState<Record<AchievementProgressId, AchievementProgress> | null>(null)
  const [progressLoading, setProgressLoading] = useState(true)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [selectedAchievement, setSelectedAchievement] = useState<(typeof achievements)[number] | null>(null)

  useEffect(() => {
    const userId = profile?.id
    if (!userId) {
      setProgressLoading(false)
      return
    }

    let active = true
    setProgressLoading(true)
    setProgressError(null)
    setAchievementProgress(null)

    void (async () => {
      try {
        const [attempts, flashcardResult, practiceItemResult, materialResult, subjectResult] = await Promise.all([
          loadAllAttempts(userId),
          supabase.from('flashcards').select('material_id,last_reviewed_at').eq('user_id', userId),
          supabase.from('practice_items').select('id,material_id,subject,type').eq('user_id', userId),
          supabase.from('review_materials').select('id,title,subject,subject_folder_id').eq('user_id', userId),
          supabase.from('user_subjects').select('id,name').eq('user_id', userId),
        ])
        const error = flashcardResult.error || practiceItemResult.error || materialResult.error || subjectResult.error
        if (error) throw new Error(error.message)

        const flashcards = (flashcardResult.data as Pick<Flashcard, 'material_id' | 'last_reviewed_at'>[] | null) || []
        const practiceItems = (practiceItemResult.data as Pick<PracticeItem, 'id' | 'material_id' | 'subject' | 'type'>[] | null) || []
        const reviewMaterials = (materialResult.data as Pick<ReviewMaterial, 'id' | 'title' | 'subject' | 'subject_folder_id'>[] | null) || []
        const subjects = (subjectResult.data as Pick<UserSubject, 'id' | 'name'>[] | null) || []
        const completedModesByMaterial: Record<string, string[]> = {}
        for (const material of reviewMaterials) {
          const key = studyModeProgressKey(userId, material.id, material.subject)
          completedModesByMaterial[material.id] = parseCompletedStudyModes(localStorage.getItem(key))
        }

        const nextProgress = calculateAchievementProgress({
          attempts,
          flashcards,
          practiceItems,
          reviewMaterials,
          subjects,
          completedModesByMaterial,
          currentStreakDays: profile?.current_streak || 0,
          track: profile?.track || 'board',
        })
        if (active) setAchievementProgress(nextProgress)
      } catch (error) {
        if (active) setProgressError(error instanceof Error ? error.message : 'Could not load your study records.')
      } finally {
        if (active) setProgressLoading(false)
      }
    })()

    return () => { active = false }
  }, [profile?.id, profile?.current_streak, profile?.track])

  const openAchievement = (achievement: (typeof achievements)[number]) => {
    setSelectedAchievement(achievement)
    if (!gameSound.isEnabled) return

    if (!achievementAudio.current) {
      achievementAudio.current = new Audio(achievementBadgePopSound)
      achievementAudio.current.volume = 0.7
    }

    achievementAudio.current.currentTime = 0
    void achievementAudio.current.play()
      .catch((error: unknown) => {
        console.warn('Could not play the achievement sound.', error)
      })
  }

  return (
    <div className="container workspace-page achievements-page">
      <WorkspacePageHeader
        eyebrow="MILESTONE ROADMAP"
        index="06"
        title={<>Your <em>achievements.</em></>}
        description="Build consistent study habits, sharpen clinical skills, and celebrate the milestones that move you toward pharmacy mastery."
        action={
          <Badge variant="primary" size="lg">
            <Icon name="trophy" size={15} />
            {achievements.length} milestones
          </Badge>
        }
      />

      <section className="achievement-grid" aria-label="Achievement milestones">
        {achievements.map((achievement, index) => (
          <article className="achievement-card" key={achievement.id}>
            <div className="achievement-card-top">
              {achievement.badgeImage ? (
                <img
                  className="achievement-badge-image"
                  src={achievement.badgeImage}
                  alt={`${achievement.title} achievement badge`}
                />
              ) : (
                <span className="achievement-icon" aria-hidden="true">
                  <Icon name={achievement.icon} size={22} />
                </span>
              )}
              <span className="achievement-number" aria-label={`Milestone ${index + 1}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <div className="achievement-category">{achievement.category}</div>
            <h2>{achievement.title}</h2>
            <div className="achievement-progress">
              {progressLoading ? (
                <p className="achievement-progress-message">Loading task progress…</p>
              ) : progressError ? (
                <p className="achievement-progress-message" role="alert">
                  Progress unavailable: {progressError}
                </p>
              ) : achievementProgress ? (
                <>
                  <div className="achievement-progress-label">
                      <span>Task completion</span>
                      <strong>{achievementProgress[achievement.id].percentage}%</strong>
                      <Icon name="chevron-right" size={15} />
                  </div>
                  <ProgressBar
                    value={achievementProgress[achievement.id].percentage}
                    max={100}
                    size="sm"
                    ariaLabel={`${achievement.title} task completion`}
                  />
                </>
              ) : null}
            </div>
            <button
              type="button"
              className="achievement-card-trigger"
              aria-haspopup="dialog"
              aria-label={`View ${achievement.title} task details`}
              onClick={() => openAchievement(achievement)}
            />
          </article>
        ))}
      </section>
      <Modal
        open={selectedAchievement !== null}
        onClose={() => setSelectedAchievement(null)}
        title={selectedAchievement?.title || 'Achievement task'}
        description={selectedAchievement ? `${selectedAchievement.category} achievement details` : undefined}
        size="sm"
      >
        {selectedAchievement && (
          <div className="achievement-task-modal">
            <p>{selectedAchievement.requirement}</p>
            {progressLoading ? (
              <p role="status">Loading task progress…</p>
            ) : progressError ? (
              <p role="alert">Progress unavailable: {progressError}</p>
            ) : achievementProgress ? (
              <>
                <div className="achievement-progress-label">
                  <span>Task completion</span>
                  <strong>{achievementProgress[selectedAchievement.id].percentage}%</strong>
                </div>
                <ProgressBar
                  value={achievementProgress[selectedAchievement.id].percentage}
                  max={100}
                  size="sm"
                  ariaLabel={`${selectedAchievement.title} task completion`}
                />
                <p className="achievement-progress-detail">
                  {achievementProgress[selectedAchievement.id].detail}
                </p>
              </>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
