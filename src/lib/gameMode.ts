export type GameObstacleKind = 'low' | 'overhead' | 'tall'
export type PlayerAction = 'run' | 'jump' | 'slide'

export function obstacleDodged(kind: GameObstacleKind, action: PlayerAction): boolean {
  if (kind === 'low') return action === 'jump'
  if (kind === 'overhead') return action === 'slide'
  return false
}
