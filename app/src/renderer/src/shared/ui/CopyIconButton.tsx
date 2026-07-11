import { useState } from 'react'
import { Button } from './Button'
import { useI18n } from '../i18n'

export interface CopyIconButtonProps {
  text: string
  title?: string
  /** Extra classes appended to the underlying Button (sizing/spacing tweaks). */
  className?: string
}

// Epitaxy 복사 버튼 — Button(iconOnly/uncontained/small) 위에 구현해 btn-squish 배경
// 레이어 + relative isolate + ring-focus + fill-uncontained hover/active 토큰을 그대로 획득.
export function CopyIconButton({ text, title, className }: CopyIconButtonProps): React.JSX.Element {
  const { tr } = useI18n()
  const label = title ?? tr('common.copyMessage')
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
    <Button
      iconOnly
      variant="uncontained"
      size="small"
      leadingIcon={copied ? 'check' : 'copy'}
      onClick={onClick}
      title={copied ? tr('common.copied') : label}
      aria-label={label}
      className={className}
    />
  )
}
