import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured, supabaseConfigError } from '@/lib/supabase'
import type { Profile, BoardProgramKey, StudyTrack } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (uid: string) => {
    if (!supabaseConfigured) {
      setProfile(null)
      return
    }

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
      if (error) {
        console.error('Failed to load profile:', error)
        setProfile(null)
        return
      }

      setProfile((data as Profile | null) ?? null)
    } catch (error) {
      console.error('Unexpected profile load failure:', error)
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true

    ;(async () => {
      if (!supabaseConfigured) {
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        return
      }

      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return

        setSession(data.session)
        setUser(data.session?.user ?? null)

        if (data.session?.user) {
          await fetchProfile(data.session.user.id)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Failed to initialize auth session:', error)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)

      if (s?.user) {
        await fetchProfile(s.user.id)
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    profile,
    loading,
    refreshProfile: async () => {
      if (!user) return
      await fetchProfile(user.id)
    },
    signOut: async () => {
      if (!supabaseConfigured) {
        setSession(null)
        setUser(null)
        setProfile(null)
        return
      }

      await supabase.auth.signOut()
      setProfile(null)
    }
  }), [session, user, profile, loading])

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
