import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured, supabaseConfigError } from '@/lib/supabase'
import type { Profile, BoardProgramKey, StudyTrack } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  refreshProfile: (uid?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [profileError, setProfileError] = useState<string | null>(null)
  const currentUserId = useRef<string | null>(null)
  const requestId = useRef(0)
  const mounted = useRef(false)

  const fetchProfile = async (uid: string) => {
    const request = ++requestId.current
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (error) throw error
      if (mounted.current && currentUserId.current === uid && requestId.current === request) {
        setProfile((data as Profile | null) ?? null)
        setProfileError(null)
        setLoading(false)
      }
    } catch (error: any) {
      if (mounted.current && currentUserId.current === uid && requestId.current === request) {
        setProfile(null)
        setProfileError(error?.message || 'Could not load your profile.')
        setLoading(false)
      }
      throw error
    }
  }

  useEffect(() => {
    mounted.current = true
    let authEventSeen = false
    const applySession = (nextSession: Session | null, deferProfile: boolean) => {
      if (!mounted.current) return
      const uid = nextSession?.user.id ?? null
      const changed = currentUserId.current !== uid
      currentUserId.current = uid
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!uid) {
        requestId.current += 1
        setProfile(null)
        setProfileError(null)
        setLoading(false)
        return
      }
      if (changed) {
        setProfile(null)
        setProfileError(null)
        setLoading(true)
      }
      const load = () => {
        if (!mounted.current || currentUserId.current !== uid) return
        void fetchProfile(uid).catch(() => {})
      }
      // Supabase warns against awaiting further Supabase calls inside its auth callback.
      if (deferProfile) setTimeout(load, 0)
      else load()
    }

    if (!supabaseConfigured) {
      setLoading(false)
      return () => { mounted.current = false; requestId.current += 1 }
    }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeen = true
      applySession(nextSession, true)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error
      if (!authEventSeen) applySession(data.session, false)
    }).catch(error => {
      if (!mounted.current || authEventSeen) return
      console.error('Failed to initialize auth session:', error)
      setLoading(false)
    })
    return () => {
      mounted.current = false
      requestId.current += 1
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    loading,
    profileError,
    refreshProfile: async (uid) => {
      const id = uid || currentUserId.current
      if (!id || currentUserId.current !== id) return
      await fetchProfile(id)
    },
    signOut: async () => {
      if (!supabaseConfigured) {
        setSession(null)
        setUser(null)
        setProfile(null)
        return
      }

      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
  }), [session, user, profile, loading, profileError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export async function upsertProfile(id: string, board_program: BoardProgramKey = 'pharmacy', full_name?: string, target_exam_date?: string | null, track?: StudyTrack) {
  if (!supabaseConfigured) {
    throw new Error(supabaseConfigError || 'Supabase is not configured.')
  }

  const { error } = await supabase.from('profiles').upsert({ id, board_program, full_name: full_name || null, target_exam_date: target_exam_date ?? null, track: track || 'board', updated_at: new Date().toISOString() })
  if (error) throw error
}
