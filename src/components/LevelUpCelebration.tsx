import { useEffect, useMemo } from 'react'
import { Button, Icon } from './ui'

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444', '#a855f7', '#f97316', '#06b6d4', '#ec4899']
const SHAPES = ['square', 'circle', 'triangle'] as const

interface Piece {
  left: number
  delay: number
  duration: number
  size: number
  color: string
  shape: (typeof SHAPES)[number]
  rotate: number
}

function randomPieces(count: number): Piece[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2.5 + Math.random() * 2.5,
    size: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    rotate: Math.random() * 360,
  }))
}

export default function LevelUpCelebration({ level, onClose }: { level: number; onClose: () => void }) {
  const pieces = useMemo(() => randomPieces(90), [])

  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Level up to level ${level}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 200ms ease',
      }}
      onClick={onClose}
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.shape === 'triangle' ? p.size * 1.2 : p.size,
            background: p.shape === 'circle' ? p.color : 'transparent',
            borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'square' ? 2 : 0,
            border: p.shape === 'triangle' ? 'none' : undefined,
            clipPath: p.shape === 'triangle' ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
            backgroundColor: p.shape === 'triangle' ? p.color : p.shape === 'circle' ? p.color : p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          textAlign: 'center',
          padding: '40px 48px',
          background: 'var(--panel)',
          border: '1px solid var(--primary-border, var(--border))',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          animation: 'scaleIn 300ms ease, slideUp 300ms ease',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--warning) 0%, #f97316 100%)',
            marginBottom: 16,
            animation: 'pulse 1.2s ease-in-out infinite',
          }}
        >
          <Icon name="trophy" size={36} style={{ color: '#fff' }} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 8 }}>
          Level Up!
        </div>
        <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          Level {level}
        </div>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14 }}>
          Keep practicing to reach the next level.
        </p>
        <Button variant="primary" onClick={onClose}>Keep going</Button>
      </div>
    </div>
  )
}
