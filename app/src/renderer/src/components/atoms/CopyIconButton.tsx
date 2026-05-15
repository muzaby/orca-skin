import { useState } from 'react'
import { Icon } from './Icon'

export interface CopyIconButtonProps {
  text: string
  title?: string
  className?: string
}

export function CopyIconButton({
  text,
  title = '메시지 복사',
  className
}: CopyIconButtonProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const onClick = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — silent no-op
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        'grid h-6 w-6 cursor-pointer place-items-center rounded border-0 bg-transparent text-ink3 hover:bg-cream-100 hover:text-ink2'
      }
      title={copied ? '복사됨' : title}
      aria-label={title}
    >
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  )
}
