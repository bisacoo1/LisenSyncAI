export interface FriendConnection {
  friendship_id: string
  user_id: string
  display_name: string
  avatar_id: string | null
  avatar_path: string | null
  avatar_border: string | null
  level: number
  status: 'pending' | 'accepted'
  direction: 'incoming' | 'outgoing' | 'friend'
}

export interface PublicLearnerProfile {
  user_id: string
  display_name: string
  avatar_id: string | null
  avatar_path: string | null
  avatar_border: string | null
  level: number
  subjects_count: number
  practice_accuracy: number | string
  total_attempts: number
  friendship_id: string | null
  friendship_status: 'self' | 'none' | 'friends' | 'incoming_pending' | 'outgoing_pending'
}

export interface PublicLearnerSearchResult {
  user_id: string
  display_name: string
  avatar_id: string | null
  avatar_path: string | null
  avatar_border: string | null
  level: number
  friendship_id: string | null
  friendship_status: PublicLearnerProfile['friendship_status']
}
