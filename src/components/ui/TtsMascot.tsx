import avatar512 from '@/assets/mascot/mascot-avatar-512.png'
import avatar256 from '@/assets/mascot/mascot-avatar-256.png'
import avatarRound from '@/assets/mascot/mascot-avatar-round-256.png'
import speaking from '@/assets/mascot/mascot-speaking-1200.png'

/**
 * Mascot: "Lilo" — the LisenSync AI pharmacist owl.
 * The face of the text-to-speech (read-aloud) feature in Practice Mode.
 *
 * Visual rules
 * - Small sizes (<= 64px): use the round avatar, no glow, no ring.
 * - Idle companion: 128-256px round avatar with a soft cyan dish when speaking.
 * - Speaking: use the full-body `state="speaking"` art for hero/empty states.
 * - Always decorative (`alt=""`) unless it is the only label on a control.
 */

export const MASCOT_NAME = 'Lilo'

export type TtsMascotVariant = 'auto' | 'round' | 'square' | 'speaking'

type Props = {
  size?: number
  variant?: TtsMascotVariant
  /** Visually indicates TTS is currently playing (adds a cyan pulse ring). */
  speaking?: boolean
  /** Accessible label; omit for purely decorative placements. */
  label?: string
  className?: string
  style?: React.CSSProperties
}

const SOURCES = {
  round: avatarRound,
  square: avatar512,
  squareHi: avatar256,
  speaking,
}

export function TtsMascot({
  size = 96,
  variant = 'auto',
  speaking: isSpeaking = false,
  label,
  className,
  style,
}: Props) {
  const resolved: TtsMascotVariant =
    variant === 'auto' ? (size <= 160 ? 'round' : 'speaking') : variant

  const src =
    resolved === 'round'
      ? SOURCES.round
      : resolved === 'square'
        ? size <= 256
          ? SOURCES.squareHi
          : SOURCES.square
        : SOURCES.speaking

  const width =
    resolved === 'speaking' ? size * 1.25 : size

  return (
    <span
      className={[
        'tts-mascot',
        `tts-mascot--${resolved}`,
        isSpeaking ? 'is-speaking' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width, ...style }}
    >
      <img
        src={src}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        width={width}
        height={resolved === 'speaking' ? undefined : width}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </span>
  )
}

/**
 * Drop-in button label for a "Read aloud" / "Listen" control.
 * Use inside an existing <Button> or as the trigger for practice-mode TTS.
 */
export function TtsListenButtonContent({
  playing = false,
  idleText = 'Read aloud',
  playingText = 'Reading aloud…',
}: {
  playing?: boolean
  idleText?: string
  playingText?: string
}) {
  return (
    <>
      <TtsMascot size={24} variant="round" speaking={playing} />
      <span>{playing ? playingText : idleText}</span>
    </>
  )
}
