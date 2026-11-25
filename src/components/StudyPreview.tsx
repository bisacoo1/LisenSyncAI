import { useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Flame,
  LayoutDashboard,
  LibraryBig,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import type { StudyTrack } from '@/types'

/** A local, interactive example. It never reads or writes a student's study progress. */
export function StudyPreview({ track = 'board' }: { track?: StudyTrack }) {
  const [answer, setAnswer] = useState<number | null>(null)
  const options = [
    'Inhibits bacterial cell wall synthesis',
    'Blocks bacterial protein synthesis',
    'Inhibits bacterial DNA replication',
  ]
  return (
    <div
      className="study-preview"
      aria-label="Interactive Pharmora workspace preview"
    >
      <div className="preview-chrome">
        <span className="preview-dots">
          <i />
          <i />
          <i />
        </span>
        <span>My Pharmora workspace</span>
        <span className="preview-example">Example preview</span>
      </div>
      <div className="preview-body">
        <div className="preview-sidebar" aria-hidden="true">
          <span className="preview-mini-logo">
            <BookOpen size={19} />
          </span>
          <span className="active">
            <LayoutDashboard size={18} />
          </span>
          <span>
            <LibraryBig size={18} />
          </span>
          <span>
            <BookOpen size={18} />
          </span>
          <span>
            <Target size={18} />
          </span>
          <span>
            <Trophy size={18} />
          </span>
          <span className="preview-user">Y</span>
        </div>
        <div className="preview-content">
          <div className="preview-welcome">
            <div>
              <span>Your next chapter starts here</span>
              <h3>You’ve got this, future RPh.</h3>
            </div>
            <span className="preview-streak">
              <Flame size={15} /> 3 days
            </span>
          </div>
          <div className="preview-plan">
            <span className="preview-plan-icon">
              <Target size={21} />
            </span>
            <div>
              <strong>
                {track === 'board'
                  ? 'A little closer to exam-ready'
                  : 'Make today a good study day'}
              </strong>
              <span>
                {track === 'board'
                  ? 'Your PhLE review, one topic at a time.'
                  : 'Your subjects. Your pace. Your progress.'}
              </span>
            </div>
            <span className="preview-ring">
              75<small>%</small>
            </span>
          </div>
          <div className="preview-section-title">
            <strong>Let’s put your knowledge to work</strong>
            <span>Quick practice</span>
          </div>
          <div className="preview-question">
            <div className="preview-question-meta">
              <span>
                <Sparkles size={12} /> Pharmacology
              </span>
              <span>Sample question</span>
            </div>
            <h4>What is the primary mechanism of action of amoxicillin?</h4>
            <div className="preview-options">
              {options.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAnswer(index)}
                  aria-pressed={answer === index}
                  className={
                    answer !== null && index === 0
                      ? 'is-correct'
                      : answer === index
                        ? 'is-incorrect'
                        : ''
                  }
                >
                  <span>
                    {answer !== null && index === 0 ? (
                      <Check size={13} />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </span>
                  {option}
                </button>
              ))}
            </div>
            <div className="preview-feedback" aria-live="polite">
              {answer === null ? (
                <span>Try a question. See how it feels.</span>
              ) : (
                <span>
                  {answer === 0 ? 'That’s right!' : 'Not quite.'} Amoxicillin
                  inhibits bacterial cell wall synthesis.
                </span>
              )}
              {answer !== null && (
                <button type="button" onClick={() => setAnswer(null)}>
                  Reset <ChevronRight size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="preview-bottom">
            <span>
              <Check size={13} /> Learn the why, not just the answer.
            </span>
            <span>
              Keep going <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
