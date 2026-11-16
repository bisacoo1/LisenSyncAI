import { Link } from 'react-router-dom'
import logoMark from '@/assets/logo-mark.png'

export function Brand({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand-lockup${inverse ? ' brand-lockup--inverse' : ''}${compact ? ' brand-lockup--compact' : ''}`}
      aria-label="LisenSync AI BS Pharmacy study space home"
    >
      <img src={logoMark} alt="" className="brand-lockup-mark" />
      <span className="brand-lockup-name">
        LisenSync <span>AI</span> <small>PHARMACY REVIEW</small>
      </span>
    </Link>
  )
}
