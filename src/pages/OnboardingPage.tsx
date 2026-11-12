import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, upsertProfile } from '@/context/AuthContext'
import { PROGRAM_LIST } from '@/lib/syllabus'
import type { BoardProgramKey } from '@/types'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [program, setProgram] = useState<BoardProgramKey>((profile?.board_program as BoardProgramKey) || 'criminology')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setError(null); setSaving(true)
    try {
      await upsertProfile(user.id, program, fullName)
      await refreshProfile()
      nav('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <div className="card">
        <h1 className="section-title">Board Program Onboarding</h1>
        <p className="muted">Select your specific licensure course. All subjects, AI prompts, and analytics will align with your official board syllabus and the 75% PRC passing benchmark.</p>
        {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={onSave}>
          <div className="field"><label>Full name</label><input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="field">
            <label>PRC Board Program</label>
            <select value={program} onChange={e => setProgram(e.target.value as BoardProgramKey)}>
              {PROGRAM_LIST.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            <small className="muted">{PROGRAM_LIST.find(p => p.key === program)?.description}</small>
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save and continue'}</button>
        </form>
      </div>
    </div>
  )
}
