import type { StudyTrack } from '@/types'

export interface StudyTrackOption {
  value: StudyTrack
  title: string
  description: string
}

interface StudyTrackSelectorProps {
  value: StudyTrack
  onChange: (track: StudyTrack) => void
  options: StudyTrackOption[]
}

export function StudyTrackSelector({ value, onChange, options }: StudyTrackSelectorProps) {
  return (
    <fieldset className="study-track-selector">
      <legend>How are you preparing?</legend>
      <div className="study-track-options">
        {options.map((option) => (
          <label
            key={option.value}
            className={`study-track-option${value === option.value ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name="study-track"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="study-track-option-copy">
              <strong>{option.title}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
