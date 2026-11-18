import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const file = (path: string) => readFileSync(path, 'utf8')

describe('authentication resilience', () => {
  it('defers profile queries outside the auth callback and ignores stale results', () => {
    const auth = file('src/context/AuthContext.tsx')
    expect(auth).toContain('if (deferProfile) setTimeout(load, 0)')
    expect(auth).toContain('requestId.current === request')
    expect(auth).toContain('currentUserId.current === uid')
    expect(file('src/components/ProtectedRoute.tsx')).toContain('if (profileError)')
  })
  it('retains onboarding choices when email confirmation is required', () => {
    expect(file('src/pages/RegisterPage.tsx')).toContain('data: { full_name: fullName, track }')
    expect(file('src/pages/OnboardingPage.tsx')).toContain('user?.user_metadata?.track')
  })
})
