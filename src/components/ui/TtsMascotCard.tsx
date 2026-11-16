import { TtsMascot, MASCOT_NAME } from './TtsMascot'

/**
 * The mascot as a small "study buddy" callout.
 * Intentionally static — it carries copy you control, not the owl's voice.
 */
export function TtsMascotCard({
  text,
  subtitle,
  size = 72,
  speaking = false,
  className,
}: {
  text: string
  subtitle?: string
  size?: number
  speaking?: boolean
  className?: string
}) {
  return (
    <div className={['tts-mascot-card', className ?? ''].filter(Boolean).join(' ')}>
      <TtsMascot size={size} variant="round" speaking={speaking} />
      <div className="tts-mascot-card__body">
        <span className="tts-mascot-card__name">{MASCOT_NAME}</span>
        <span className="tts-mascot-card__text">{text}</span>
        {subtitle ? <span className="tts-mascot-card__text">{subtitle}</span> : null}
      </div>
    </div>
  )
}
