import { useId } from 'react'
import { Link } from 'react-router-dom'
import logoMark from '@/assets/logo-mark.png'

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const blushId = `brand-owl-blush-${uid}`
  const smileGlowId = `brand-owl-smile-glow-${uid}`

  return (
    <Link
      to="/"
      className={`brand-lockup${inverse ? ' brand-lockup--inverse' : ''}${compact ? ' brand-lockup--compact' : ''}`}
      aria-label="Pharmora AI BS Pharmacy study space home"
    >
      <span className="brand-lockup-mark" aria-hidden="true">
        <img src={logoMark} alt="" className="brand-lockup-owl" draggable={false} />
        <svg viewBox="0 0 1254 1254" className="brand-lockup-smile" aria-hidden="true">
          <defs>
            <radialGradient id={blushId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ff7b72" stopOpacity="0.88" />
              <stop offset="65%" stopColor="#ff7b72" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ff7b72" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={smileGlowId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fde68a" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g className="brand-owl-cheeks">
            <ellipse cx="532" cy="586" rx="68" ry="42" transform="rotate(-16 532 586)" fill={`url(#${blushId})`} />
            <ellipse cx="876" cy="500" rx="64" ry="40" transform="rotate(-16 876 500)" fill={`url(#${blushId})`} />
          </g>
          <ellipse cx="704" cy="608" rx="68" ry="48" transform="rotate(-16 704 608)" fill={`url(#${smileGlowId})`} className="brand-owl-smile-glow" />
          <g className="brand-owl-sparkles" fill="#fffbeb">
            <path d="M588 430l8 20 20 8-20 8-8 20-8-20-20-8 20-8z" />
            <path d="M788 366l7 17 17 7-17 7-7 17-7-17-17-7 17-7z" />
            <path d="M384 316l10 24 24 10-24 10-10 24-10-24-24-10 24-10z" fill="#fde68a" />
          </g>
        </svg>
      </span>
      <span className="brand-lockup-name">
        Pharmora <span>AI</span> <small>BS PHARMACY & PhLE</small>
      </span>
    </Link>
  )
}


