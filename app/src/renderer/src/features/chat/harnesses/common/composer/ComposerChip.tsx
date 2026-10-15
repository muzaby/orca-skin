import type { ComposerChipProps } from '../../contracts'
export type { ComposerChipProps } from '../../contracts'
import { forwardRef } from 'react'
import { Icon } from '../../../../../shared/ui/Icon'
import { chipSurface } from './chipSurface'

// mockup `project/variations/v1-shell.jsx:186-188` 의 chip1 — composer 좌측 하단의
// 행위 chip. composer-repo zone (첨부/현재 프레임/Skill) 의 원자 단위.

export const ComposerChip = forwardRef<HTMLButtonElement, ComposerChipProps>(function ComposerChip(
  {
    icon,
    label,
    disabled,
    title,
    onClick,
    ariaHasPopup,
    ariaExpanded,
    ariaPressed,
    variant = 'flat',
    className = ''
  },
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
      aria-pressed={ariaPressed}
      className={`${chipSurface(variant, label === undefined, ariaPressed)} cursor-default outline-none hide-focus-ring ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon && <Icon name={icon} size={12} className="shrink-0" />}
      {label && <span className="min-w-0 truncate">{label}</span>}
    </button>
  )
})
