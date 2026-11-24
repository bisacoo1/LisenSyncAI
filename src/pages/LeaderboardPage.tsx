import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { Button, Card, CardContent, Icon, Modal, useToast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { PublicLearnerProfile } from '@/lib/social'

type LeaderboardPeriod = 'week' | 'month'

interface LeaderboardEntry {
  rank: number | null
  user_id: string
  display_name: string
  avatar_id: string | null
  avatar_path: string | null
  avatar_border: string | null
  level: number
  points: number
  is_current_user: boolean
}

const periods: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

export default function LeaderboardPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null)
  const [learner, setLearner] = useState<PublicLearnerProfile | null>(null)
  const [learnerLoading, setLearnerLoading] = useState(false)
  const [learnerError, setLearnerError] = useState<string | null>(null)
  const [learnerReload, setLearnerReload] = useState(0)
  const [friendActionBusy, setFriendActionBusy] = useState(false)

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: resultError } = await supabase.rpc('get_leaderboard', {
        p_period: period,
      })
      if (!active) return
      if (resultError) {
        setError(resultError.message)
        setEntries([])
      } else {
        setEntries((data || []) as LeaderboardEntry[])
      }
      setLoading(false)
    })()

    return () => { active = false }
  }, [profile?.id, period, reloadKey])

  useEffect(() => {
    if (!selectedLearnerId) {
      setLearner(null)
      return
    }

    let active = true
    setLearnerLoading(true)
    setLearnerError(null)
    setLearner(null)
    void (async () => {
      const { data, error: resultError } = await supabase.rpc('get_public_learner_profile', {
        p_learner_id: selectedLearnerId,
      })
      if (!active) return
      if (resultError) {
        setLearnerError(resultError.message)
      } else {
        const row = Array.isArray(data) ? data[0] : data
        if (row) setLearner(row as PublicLearnerProfile)
        else setLearnerError('Learner profile was not found.')
      }
      setLearnerLoading(false)
    })()
    return () => { active = false }
  }, [selectedLearnerId, learnerReload])

  async function runFriendAction(action: 'send' | 'accept' | 'decline' | 'cancel') {
    if (!learner) return
    setFriendActionBusy(true)
    try {
      const result = action === 'send'
        ? await supabase.rpc('send_friend_request', { p_user_id: learner.user_id })
        : action === 'accept' && learner.friendship_id
          ? await supabase.rpc('accept_friend_request', { p_friendship_id: learner.friendship_id })
          : learner.friendship_id
            ? await supabase.rpc('remove_friend_connection', { p_friendship_id: learner.friendship_id })
            : null
      if (!result) throw new Error('Friend request could not be updated.')
      if (result.error) throw new Error(result.error.message)
      setLearnerReload(value => value + 1)
      addToast({
        type: 'success',
        title: action === 'send' ? 'Friend request sent' : action === 'accept' ? 'Friend request accepted' : 'Friend request removed',
        message: action === 'send' ? `Your request was sent to ${learner.display_name}.` : undefined,
      })
    } catch (actionError) {
      addToast({
        type: 'error',
        title: 'Could not update friend request',
        message: actionError instanceof Error ? actionError.message : 'Please try again.',
      })
    } finally {
      setFriendActionBusy(false)
    }
  }

  const currentEntry = entries.find(entry => entry.is_current_user)
  const periodLabel = period === 'week' ? 'Calendar week · Monday to Sunday' : 'Calendar month'
  const learnerAccuracy = learner ? Number(learner.practice_accuracy) : 0

  function learnerInitials(name: string) {
    return name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()
  }

  return (
    <div className="container workspace-page leaderboard-page">
      <WorkspacePageHeader
        eyebrow="YOUR WORKSPACE"
        index="LEADERBOARDS"
        title="Study leaderboards"
        description="See how your study points compare with other Pharmora students."
      />

      <Card variant="elevated" className="leaderboard-card">
        <CardContent>
          <div className="leaderboard-toolbar">
            <div>
              <h2>Leaderboard</h2>
              <p>{periodLabel} · Philippine time</p>
            </div>
            <div className="leaderboard-period-tabs" role="group" aria-label="Leaderboard period">
              {periods.map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={period === option.value}
                  className={period === option.value ? 'active' : ''}
                  onClick={() => setPeriod(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="leaderboard-scoring">
            <span><Icon name="check-circle" size={16} aria-hidden="true" /> +10 for each correct MCQ, identification, or enumeration answer</span>
            <span><Icon name="trophy" size={16} aria-hidden="true" /> +20 for a completed practice set with at least 75% accuracy</span>
          </div>

          {currentEntry && (
            <div className="leaderboard-my-rank" aria-live="polite">
              <span>Your rank</span>
              <strong>{currentEntry.rank ? `#${currentEntry.rank}` : 'Not ranked yet'}</strong>
              <span>{currentEntry.points.toLocaleString()} points this {period}</span>
            </div>
          )}

          <div id="leaderboard-results" aria-busy={loading}>
            {loading ? (
              <div className="leaderboard-status" role="status">Loading leaderboard…</div>
            ) : error ? (
              <div className="leaderboard-status leaderboard-error" role="alert">
                <span>Could not load the leaderboard: {error}</span>
                <Button variant="secondary" leftIcon="refresh-cw" onClick={() => setReloadKey(value => value + 1)}>
                  Try again
                </Button>
              </div>
            ) : entries.length === 0 || entries.every(entry => entry.points === 0) ? (
              <div className="leaderboard-status">
                <Icon name="trophy" size={28} aria-hidden="true" />
                <strong>No points yet this {period}.</strong>
                <span>Answer practice questions to get on the board.</span>
              </div>
            ) : (
              <ol className="leaderboard-list" aria-label={`${period === 'week' ? 'Weekly' : 'Monthly'} leaderboard`}>
                {entries.map(entry => (
                  <li
                    key={entry.user_id}
                    className={`leaderboard-entry${entry.is_current_user ? ' leaderboard-entry--current' : ''}`}
                  >
                    <span className="leaderboard-rank" aria-label={entry.rank ? `Rank ${entry.rank}` : 'Not ranked'}>
                      {entry.rank ? `#${entry.rank}` : '—'}
                    </span>
                    <button
                      type="button"
                      className="leaderboard-profile-trigger"
                      aria-label={`View ${entry.display_name}${entry.is_current_user ? ' (you)' : ''}'s profile`}
                      onClick={() => setSelectedLearnerId(entry.user_id)}
                    >
                      <ProfileAvatar
                        className="leaderboard-avatar"
                        avatarId={entry.avatar_id}
                        avatarPath={entry.avatar_path}
                        avatarBorderId={entry.avatar_border}
                        initials={learnerInitials(entry.display_name)}
                      />
                      <span className="leaderboard-student">
                        <strong>{entry.display_name}{entry.is_current_user ? ' (You)' : ''}</strong>
                        <small>Level {entry.level}</small>
                      </span>
                    </button>
                    <strong className="leaderboard-points">
                      {entry.points.toLocaleString()} <span>pts</span>
                    </strong>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        open={Boolean(selectedLearnerId)}
        onClose={() => setSelectedLearnerId(null)}
        title={learner?.display_name || 'Learner profile'}
        description="Learner stats are visible to signed-in leaderboard users."
        size="sm"
      >
        {learnerLoading ? (
          <div className="social-status" role="status">Loading learner profile…</div>
        ) : learnerError ? (
          <div className="social-status social-error" role="alert">{learnerError}</div>
        ) : learner ? (
          <div className="learner-profile">
            <div className="learner-profile-identity">
              <ProfileAvatar
                className="learner-profile-avatar"
                avatarId={learner.avatar_id}
                avatarPath={learner.avatar_path}
                avatarBorderId={learner.avatar_border}
                initials={learnerInitials(learner.display_name)}
              />
              <div>
                <strong>{learner.display_name}</strong>
                <span>Level {learner.level}</span>
              </div>
            </div>
            <div className="learner-profile-stats">
              <div><strong>{learner.total_attempts ? `${learnerAccuracy.toFixed(1)}%` : '—'}</strong><span>Practice accuracy</span></div>
              <div><strong>{learner.subjects_count}</strong><span>Subjects in My Reviewers</span></div>
              <div><strong>{learner.total_attempts.toLocaleString()}</strong><span>Answers recorded</span></div>
            </div>
            {learner.friendship_status === 'self' ? (
              <p className="learner-profile-note">This is your profile. Your practice stats are visible to signed-in learners on the leaderboard.</p>
            ) : learner.friendship_status === 'friends' ? (
              <div className="learner-profile-actions">
                <span className="social-friend-label"><Icon name="check-circle" size={16} aria-hidden="true" /> Friends</span>
                <Button variant="primary" leftIcon="share" onClick={() => { setSelectedLearnerId(null); navigate('/reviewers') }}>
                  Share a reviewer
                </Button>
              </div>
            ) : learner.friendship_status === 'incoming_pending' ? (
              <div className="learner-profile-actions">
                <Button variant="primary" leftIcon="check" loading={friendActionBusy} onClick={() => void runFriendAction('accept')}>
                  Accept request
                </Button>
                <Button variant="ghost" disabled={friendActionBusy} onClick={() => void runFriendAction('decline')}>Decline</Button>
              </div>
            ) : learner.friendship_status === 'outgoing_pending' ? (
              <div className="learner-profile-actions">
                <Button variant="secondary" disabled>Request sent</Button>
                <Button variant="ghost" disabled={friendActionBusy} onClick={() => void runFriendAction('cancel')}>Cancel</Button>
              </div>
            ) : (
              <Button variant="primary" leftIcon="user" loading={friendActionBusy} onClick={() => void runFriendAction('send')}>
                Add friend
              </Button>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
