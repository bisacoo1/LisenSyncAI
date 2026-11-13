import type { ReactNode } from 'react'

export function WorkspacePageHeader({
  eyebrow,
  index,
  title,
  description,
  action
}: {
  eyebrow: string
  index: string
  title: ReactNode
  description: string
  action?: ReactNode
}) {
  return (
    <header className="workspace-page-header">
      <div>
        <div className="section-kicker">
          <span className="eyebrow-dot" /> {eyebrow} <span>/ {index}</span>
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="workspace-page-header-action">{action}</div>}
    </header>
  )
}
