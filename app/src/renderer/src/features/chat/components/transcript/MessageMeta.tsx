import { CopyIconButton } from '../../../../shared/ui/CopyIconButton'
import { formatTimeFull, formatTimeShort } from '../../format'

interface MessageMetaProps {
  text: string
  createdAt: number
  align: 'left' | 'right'
}

export function MessageMeta({ text, createdAt, align }: MessageMetaProps): React.JSX.Element {
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-ink3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {text && <CopyIconButton text={text} />}
      <span className="font-mono text-[10.5px]" title={formatTimeFull(createdAt)}>
        {formatTimeShort(createdAt)}
      </span>
    </div>
  )
}
