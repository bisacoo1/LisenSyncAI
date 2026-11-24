import { useState } from 'react'
import { Button } from '@/components/ui'

interface SavedStudyHintProps {
  hint?: string | null
}

export default function SavedStudyHint({ hint }: SavedStudyHintProps) {
  const [visible, setVisible] = useState(false)
  if (!hint?.trim()) return null

  return (
    <div className="saved-study-hint">
      <Button
        variant="ghost"
        size="sm"
        leftIcon="lightbulb"
        aria-expanded={visible}
        onClick={() => setVisible(value => !value)}
      >
        {visible ? 'Hide hint' : 'Show hint'}
      </Button>
      {visible && <p role="note">{hint}</p>}
    </div>
  )
}
