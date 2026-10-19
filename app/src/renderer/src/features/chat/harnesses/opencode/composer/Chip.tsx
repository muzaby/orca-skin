import { OpenCodeIcon } from '../Icon'
import { forwardRef } from 'react'
import { Icon } from '../../../../../shared/ui/Icon'
import type { ComposerChipProps } from '../../common/composer/ComposerChip'

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
      className={`${'inline-flex h-[28px] shrink-0 items-center gap-[6px] rounded-[6px] border-0 bg-transparent px-[8px] text-[13px] font-[440] leading-[20px] text-oc-ink hover:bg-oc-hover'} cursor-default outline-none hide-focus-ring ring-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon &&
        (icon === 'plus' ? (
          <OpenCodeIcon name="plus" />
        ) : (
          <Icon name={icon} size={16} className="shrink-0" />
        ))}
      {label && <span className="max-w-[220px] truncate">{label}</span>}
      {label && ariaHasPopup && (
        <OpenCodeIcon name="chevron-down" size={14} className="text-oc-faint" />
      )}
    </button>
  )
})
