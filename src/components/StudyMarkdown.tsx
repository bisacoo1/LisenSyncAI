import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { formatStudyText } from '@/lib/formatStudyText'

export default function StudyMarkdown({ children }: { children: string }) {
  return (
    <div className="reader-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {formatStudyText(children)}
      </ReactMarkdown>
    </div>
  )
}
