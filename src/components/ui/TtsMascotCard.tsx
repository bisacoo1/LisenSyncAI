import { TtsMascot, MASCOT_NAME, type TtsMascotVariant } from './TtsMascot'

/**
 * The mascot as a small "study buddy" callout.
 * The copy is not narration; the mascot's visual variant is selected by the caller.
 */
export function TtsMascotCard({
  text,
  subtitle,
  size = 72,
  variant = 'round',
  speaking = false,
  className,
}: {
  text: string
  subtitle?: string
  size?: number
  variant?: TtsMascotVariant
  speaking?: boolean
  className?: string
}) {
  return (
    <div className={['tts-mascot-card', className ?? ''].filter(Boolean).join(' ')}>
      <TtsMascot size={size} variant={variant} speaking={speaking} />
      <div className="tts-mascot-card__body">
        <span className="tts-mascot-card__name">{MASCOT_NAME}</span>
        <span className="tts-mascot-card__text">{text}</span>
        {subtitle ? <span className="tts-mascot-card__text">{subtitle}</span> : null}
      </div>
    </div>
  )
}
