import { forwardRef } from 'react'
import { Icon, type IconName } from '../../../../shared/ui/Icon'
import { chipSurface, type ChipVariant } from './chipSurface'

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
  // 기본은 입력 아래 컨트롤 행의 flat. 입력 위 작업 컨텍스트 행은 outlined 를 쓴다(chipSurface).
  variant?: ChipVariant
  // 폭 제한 같은 배치 전용 클래스. 색·테두리·높이는 chipSurface 가 소유하므로 여기서 덮지 않는다.
  className?: string
}

export const ComposerChip = forwardRef<HTMLButtonElement, ComposerChipProps>(function ComposerChip(
  {
    icon,
    label,
    disabled,
    title,
    onClick,
    ariaHasPopup,
    ariaExpanded,
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
      className={`${chipSurface(variant, label === undefined)} cursor-default outline-none hide-focus-ring ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon && <Icon name={icon} size={12} className="shrink-0" />}
      {label && <span className="min-w-0 truncate">{label}</span>}
    </button>
  )
})
