import { describe, expect, it } from 'vitest'
import { obstacleDodged } from '@/lib/gameMode'

describe('runner obstacle evasions', () => {
  it('requires a jump over a low obstacle', () => {
    expect(obstacleDodged('low', 'jump')).toBe(true)
    expect(obstacleDodged('low', 'run')).toBe(false)
    expect(obstacleDodged('low', 'slide')).toBe(false)
  })

  it('requires a slide under an overhead obstacle', () => {
    expect(obstacleDodged('overhead', 'slide')).toBe(true)
    expect(obstacleDodged('overhead', 'run')).toBe(false)
    expect(obstacleDodged('overhead', 'jump')).toBe(false)
  })

  it('requires changing lanes to avoid a tall obstacle', () => {
    expect(obstacleDodged('tall', 'run')).toBe(false)
    expect(obstacleDodged('tall', 'jump')).toBe(false)
    expect(obstacleDodged('tall', 'slide')).toBe(false)
  })
})
