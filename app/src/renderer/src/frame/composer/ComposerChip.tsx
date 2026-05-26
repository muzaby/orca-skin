import { forwardRef } from 'react'
import { Icon, type IconName } from '../../components/atoms/Icon'

// mockup `project/variations/v1-shell.jsx:186-188` 의 chip1 — composer 좌측 하단의
// 행위 chip. composer-repo zone (첨부/현재 프레임/Skill) 의 원자 단위.
interface ComposerChipProps {
  icon: IconName
  label: string
  disabled?: boolean
  title?: string
  onClick?: () => void
  ariaHasPopup?: boolean
  ariaExpanded?: boolean
}

export const ComposerChip = forwardRef<HTMLButtonElement, ComposerChipProps>(function ComposerChip(
  { icon, label, disabled, title, onClick, ariaHasPopup, ariaExpanded },
  ref
): React.JSX.Element {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-haspopup={ariaHasPopup ? 'menu' : undefined}
      aria-expanded={ariaHasPopup ? ariaExpanded : undefined}
      className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-bg px-2 text-[12px] text-ink2 hover:bg-sidebar disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon name={icon} size={12} />
      <span>{label}</span>
    </button>
  )
})
