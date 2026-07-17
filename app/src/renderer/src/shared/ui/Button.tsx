import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * Epitaxy (Claude Code desktop) button primitive.
 *
 * Every variant separates its background into an aria-hidden `btn-squish`
 * span layered behind the label (`-z-[1]`). The body keeps `relative isolate`
 * so the span's negative z never escapes into sibling stacking contexts
 * (e.g. Popover/overlay). Colours resolve through theme tokens, so the
 * button re-themes with white/dark automatically.
 */

export type ButtonVariant = 'uncontained' | 'contained' | 'primary' | 'danger'
export type ButtonSize = 'small' | 'base' | 'large'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Square icon button — centers a single glyph. */
  iconOnly?: boolean
  /** Renders a trailing chevron that rotates when `expanded`. */
  dropdown?: boolean
  /** Expanded/open state for dropdown + `aria-expanded`. */
  expanded?: boolean
  /** Toggle (pressed) state — paints the selected fill + `aria-pressed`. */
  pressed?: boolean
  /** Busy/working — disables interaction and shimmers the label. */
  busy?: boolean
  /** Optional leading/trailing glyphs (ignored when `iconOnly`). */
  leadingIcon?: IconName
  trailingIcon?: IconName
  /** Keyboard-shortcut badge slot, e.g. `Ctrl+Enter`. */
  kbd?: ReactNode
  children?: ReactNode
}

const SIZE: Record<ButtonSize, { box: string; text: string; icon: number; radius: string }> = {
  small: { box: 'h-[1.7rem]', text: 'text-caption', icon: 13, radius: 'rounded-r3' },
  base: { box: 'h-[2rem]', text: 'text-footnote', icon: 14, radius: 'rounded-r4' },
  large: { box: 'h-[2.5rem]', text: 'text-body', icon: 16, radius: 'rounded-r4' }
}

const PAD: Record<ButtonSize, { icon: string; text: string }> = {
  small: { icon: 'px-p3', text: 'px-p5 gap-g2' },
  base: { icon: 'px-p3', text: 'px-p6 gap-g3' },
  large: { icon: 'px-p4', text: 'px-p6 gap-g3' }
}

const TEXT: Record<ButtonVariant, string> = {
  uncontained: 'text-t6 enabled:group-hover/btn:text-t7',
  contained: 'text-t9',
  // 모노크롬 통일 — primary = 반전 중립(잉크 위 bg-색 글리프), warm rust 폐기.
  primary: 'text-bg',
  // 파괴적 확정(삭제 등) 전용 rust 솔리드 — ModalActions danger 와 동일 톤.
  danger: 'text-bg'
}

function squishClass(variant: ButtonVariant, pressed: boolean): string {
  if (pressed) {
    return 'bg-fill-uncontained-active group-hover/btn:bg-fill-uncontained-active'
  }
  switch (variant) {
    case 'primary':
      // 중립 다크(잉크) 채움 — 엔진 '다음' 버튼과 동일 톤. hover 는 살짝 밝은 t8.
      return 'bg-ink group-hover/btn:bg-t8'
    case 'danger':
      return 'bg-rust group-hover/btn:brightness-110'
    case 'contained':
      return 'border border-t5 bg-fill-contained group-hover/btn:bg-fill-contained-hover'
    case 'uncontained':
    default:
      return 'bg-transparent group-hover/btn:bg-fill-uncontained-hover enabled:group-active/btn:bg-fill-uncontained-active'
  }
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'uncontained',
    size = 'base',
    iconOnly = false,
    dropdown = false,
    expanded = false,
    pressed = false,
    busy = false,
    leadingIcon,
    trailingIcon,
    kbd,
    children,
    className = '',
    type = 'button',
    disabled,
    ...rest
  },
  ref
) {
  const s = SIZE[size]
  const pad = iconOnly ? PAD[size].icon : PAD[size].text
  const isDisabled = disabled || busy
  const toneClass = pressed && variant === 'uncontained' ? 'text-t9' : TEXT[variant]

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-pressed={pressed || undefined}
      aria-expanded={dropdown ? expanded : undefined}
      aria-busy={busy || undefined}
      className={`group/btn relative isolate inline-flex select-none items-center justify-center whitespace-nowrap border-0 bg-transparent ${s.box} ${s.text} ${s.radius} ${pad} ${toneClass} cursor-default outline-none hide-focus-ring ring-focus transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${iconOnly ? 'aspect-square' : ''} ${className}`}
      {...rest}
    >
      <span
        aria-hidden="true"
        className={`btn-squish absolute inset-0 -z-[1] rounded-[inherit] ${squishClass(variant, pressed)}`}
      />
      {leadingIcon && !iconOnly && <Icon name={leadingIcon} size={s.icon} />}
      {iconOnly && leadingIcon ? (
        <Icon name={leadingIcon} size={s.icon} />
      ) : (
        <span className={busy ? 'epitaxy-text-shine' : undefined}>{children}</span>
      )}
      {trailingIcon && !iconOnly && <Icon name={trailingIcon} size={s.icon} />}
      {kbd && <kbd className="ml-g2 shrink-0 opacity-60">{kbd}</kbd>}
      {dropdown && (
        <Icon
          name="chevD"
          size={s.icon - 2}
          style={{
            transition: 'transform 120ms ease',
            transform: expanded ? 'rotate(180deg)' : undefined
          }}
        />
      )}
    </button>
  )
})
