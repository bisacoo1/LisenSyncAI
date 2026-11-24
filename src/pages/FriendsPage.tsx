import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { WorkspacePageHeader } from '@/components/WorkspacePageHeader'
import { Button, Card, CardContent, Icon, Input, Modal, useToast } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { FriendConnection, PublicLearnerSearchResult } from '@/lib/social'

export default function FriendsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<FriendConnection | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicLearnerSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [searchBusyId, setSearchBusyId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (!profile?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    void (async () => {
      const { data, error: resultError } = await supabase.rpc('get_friend_connections')
      if (!active) return
      if (resultError) {
        setError(resultError.message)
      } else {
        setConnections((data || []) as FriendConnection[])
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [profile?.id, retry])

  async function runConnectionAction(connection: FriendConnection, action: 'accept' | 'remove') {
    setBusyId(connection.friendship_id)
    try {
      const { error: actionError } = action === 'accept'
        ? await supabase.rpc('accept_friend_request', { p_friendship_id: connection.friendship_id })
        : await supabase.rpc('remove_friend_connection', { p_friendship_id: connection.friendship_id })
      if (actionError) throw new Error(actionError.message)
      setRemoveTarget(null)
      setRetry(value => value + 1)
      addToast({
        type: 'success',
        title: action === 'accept' ? 'Friend request accepted' : 'Friend connection updated',
        message: action === 'accept' ? `${connection.display_name} is now your friend.` : 'The connection was removed.',
      })
    } catch (actionError) {
      addToast({
        type: 'error',
        title: 'Could not update friend connection',
        message: actionError instanceof Error ? actionError.message : 'Please try again.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function searchLearners(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchQuery.trim()
    setSearchSubmitted(true)
    setSearchResults([])
    setSearchError(null)
    if (query.length < 2) {
      setSearchError('Enter at least 2 characters to search.')
      return
    }

    setSearchLoading(true)
    try {
      const { data, error: resultError } = await supabase.rpc('search_public_learners', { p_query: query })
      if (resultError) throw new Error(resultError.message)
      setSearchResults((data || []) as PublicLearnerSearchResult[])
    } catch (searchError) {
      setSearchError(searchError instanceof Error ? searchError.message : 'Could not search learners.')
    } finally {
      setSearchLoading(false)
    }
  }

  async function runSearchFriendAction(learner: PublicLearnerSearchResult, action: 'send' | 'accept' | 'decline') {
    setSearchBusyId(learner.user_id)
    try {
      let result
      if (action === 'send') {
        result = await supabase.rpc('send_friend_request', { p_user_id: learner.user_id })
      } else {
        if (!learner.friendship_id) throw new Error('Friend request could not be updated.')
        result = action === 'accept'
          ? await supabase.rpc('accept_friend_request', { p_friendship_id: learner.friendship_id })
          : await supabase.rpc('remove_friend_connection', { p_friendship_id: learner.friendship_id })
      }
      if (result.error) throw new Error(result.error.message)

      const friendshipStatus = action === 'send' ? 'outgoing_pending' : action === 'accept' ? 'friends' : 'none'
      setSearchResults(current => current.map(result => result.user_id === learner.user_id
        ? {
          ...result,
          friendship_id: action === 'send' ? null : action === 'decline' ? null : result.friendship_id,
          friendship_status: friendshipStatus,
        }
        : result))
      setRetry(value => value + 1)
      addToast({
        type: 'success',
        title: action === 'send' ? 'Friend request sent' : action === 'accept' ? 'Friend request accepted' : 'Friend request declined',
        message: action === 'send' ? `Your request was sent to ${learner.display_name}.` : undefined,
      })
    } catch (actionError) {
      addToast({
        type: 'error',
        title: 'Could not update friend request',
        message: actionError instanceof Error ? actionError.message : 'Please try again.',
      })
    } finally {
      setSearchBusyId(null)
    }
  }

  const incoming = connections.filter(connection => connection.direction === 'incoming')
  const outgoing = connections.filter(connection => connection.direction === 'outgoing')
  const friends = connections.filter(connection => connection.direction === 'friend')

  function renderConnection(connection: FriendConnection) {
    const initials = connection.display_name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()
    return (
      <li className="social-person-row" key={connection.friendship_id}>
        <ProfileAvatar
          className="social-person-avatar"
          avatarId={connection.avatar_id}
          avatarPath={connection.avatar_path}
          avatarBorderId={connection.avatar_border}
          initials={initials}
        />
        <div className="social-person-copy">
          <strong>{connection.display_name}</strong>
          <span>Level {connection.level}</span>
        </div>
        {connection.direction === 'incoming' ? (
          <div className="social-person-actions">
            <Button
              variant="primary"
              size="sm"
              leftIcon="check"
              loading={busyId === connection.friendship_id}
              onClick={() => void runConnectionAction(connection, 'accept')}
            >
              Accept
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId === connection.friendship_id}
              onClick={() => void runConnectionAction(connection, 'remove')}
            >
              Decline
            </Button>
          </div>
        ) : connection.direction === 'outgoing' ? (
          <div className="social-person-actions">
            <span className="social-pending-label">Request sent</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busyId === connection.friendship_id}
              onClick={() => void runConnectionAction(connection, 'remove')}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="social-person-actions">
            <span className="social-friend-label"><Icon name="check-circle" size={15} aria-hidden="true" /> Friend</span>
            <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(connection)}>
              Remove
            </Button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="container workspace-page friends-page">
      <WorkspacePageHeader
        eyebrow="YOUR WORKSPACE"
        index="FRIENDS"
        title="Friends"
        description="Accept requests to connect. Friends can share generated reviewer decks that appear in your My Reviewers library."
        action={<Button variant="secondary" leftIcon="search" onClick={() => setSearchOpen(true)}>Find learners</Button>}
      />

      {loading ? (
        <div className="social-status" role="status">Loading your friend connections…</div>
      ) : error ? (
        <div className="social-status social-error" role="alert">
          <span>Could not load friends: {error}</span>
          <Button variant="secondary" leftIcon="refresh-cw" onClick={() => setRetry(value => value + 1)}>Try again</Button>
        </div>
      ) : (
        <div className="friends-sections">
          <Card variant="elevated" className="friends-card">
            <CardContent>
              <h2>Friend requests <span>{incoming.length}</span></h2>
              {incoming.length ? (
                <ul className="social-person-list">{incoming.map(renderConnection)}</ul>
              ) : (
                <p className="social-empty">No incoming requests right now.</p>
              )}
              {outgoing.length > 0 && (
                <>
                  <h3>Sent requests <span>{outgoing.length}</span></h3>
                  <ul className="social-person-list">{outgoing.map(renderConnection)}</ul>
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="elevated" className="friends-card">
            <CardContent>
              <h2>Your friends <span>{friends.length}</span></h2>
              {friends.length ? (
                <ul className="social-person-list">{friends.map(renderConnection)}</ul>
              ) : (
                <div className="social-empty-state">
                  <Icon name="users" size={28} aria-hidden="true" />
                  <strong>You haven’t added friends yet.</strong>
                  <span>Open a learner’s leaderboard profile to send a friend request.</span>
                  <Button variant="outline" onClick={() => navigate('/leaderboard')}>Browse leaderboards</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Find learners"
        size="md"
      >
        <Card variant="elevated" className="friends-search-card">
          <CardContent>
            <h2>Find friends</h2>
            <p className="friends-search-description">Search by name or user ID to connect with other learners.</p>
            <form className="friends-search-form" onSubmit={event => void searchLearners(event)}>
              <Input
                type="search"
                label="Learner name or user ID"
                leftIcon="search"
                fullWidth
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder="Enter a name or ID"
                hint="Names need 2+ characters; user ID prefixes need 6+."
              />
              <Button type="submit" leftIcon="search" loading={searchLoading}>Search</Button>
            </form>
            {searchError && <p className="friends-search-message social-error" role="alert">{searchError}</p>}
            {searchLoading && <p className="friends-search-message" role="status">Searching learners…</p>}
            {searchSubmitted && !searchLoading && !searchError && searchResults.length === 0 && (
              <p className="friends-search-message" role="status">No learners found. Try another name or user ID.</p>
            )}
            {searchResults.length > 0 && (
              <ul className="social-person-list friends-search-results" aria-label="Learner search results">
                {searchResults.map(learner => {
                  const initials = learner.display_name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()
                  const isBusy = searchBusyId === learner.user_id
                  return (
                    <li className="social-person-row" key={learner.user_id}>
                      <ProfileAvatar
                        className="social-person-avatar"
                        avatarId={learner.avatar_id}
                        avatarPath={learner.avatar_path}
                        avatarBorderId={learner.avatar_border}
                        initials={initials}
                      />
                      <div className="social-person-copy">
                        <strong>{learner.display_name}</strong>
                        <span>Level {learner.level}</span>
                        <span className="social-user-id" title={learner.user_id}>ID: {learner.user_id}</span>
                      </div>
                      <div className="social-person-actions">
                        {learner.friendship_status === 'none' ? (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon="user"
                            loading={isBusy}
                            onClick={() => void runSearchFriendAction(learner, 'send')}
                          >
                            Add friend
                          </Button>
                        ) : learner.friendship_status === 'incoming_pending' ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon="check"
                              loading={isBusy}
                              onClick={() => void runSearchFriendAction(learner, 'accept')}
                            >
                              Accept
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => void runSearchFriendAction(learner, 'decline')}
                            >
                              Decline
                            </Button>
                          </>
                        ) : (
                          <span className={learner.friendship_status === 'friends' ? 'social-friend-label' : 'social-pending-label'}>
                            {learner.friendship_status === 'friends' ? 'Friend' : learner.friendship_status === 'self' ? 'You' : 'Request sent'}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </Modal>

      <Modal
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove this friend?"
        description={removeTarget ? `You and ${removeTarget.display_name} will no longer be able to share reviewer decks.` : undefined}
        size="sm"
        footer={(
          <div className="social-modal-actions">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)} disabled={busyId !== null}>Cancel</Button>
            {removeTarget && (
              <Button
                variant="danger"
                loading={busyId === removeTarget.friendship_id}
                onClick={() => void runConnectionAction(removeTarget, 'remove')}
              >
                Remove friend
              </Button>
            )}
          </div>
        )}
      >
        <p>They’ll no longer appear in your share list. Previously received reviewer copies stay in each person’s library.</p>
      </Modal>
    </div>
  )
}
