import { forwardRef } from 'react'
import { Icon, type IconName } from '../../../../shared/ui/Icon'

// mockup `project/variations/v1-shell.jsx:186-188` 의 chip1 — composer 좌측 하단의
// 행위 chip. composer-repo zone (첨부/현재 프레임/Skill) 의 원자 단위.
interface ComposerChipProps {
  icon?: IconName
  label?: string
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
      className="inline-flex h-7 cursor-default items-center gap-g3 rounded-r4 bg-transparent px-p5 text-footnote text-t6 outline-none hide-focus-ring ring-focus transition-colors hover:bg-fill-contained-hover hover:text-t7 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon && <Icon name={icon} size={12} />}
      {label && <span>{label}</span>}
    </button>
  )
})
