// Donut progress indicator — mirrors the Claude Code desktop "usage" circle.
// r=5 → circumference 2πr ≈ 31.4159 (= stroke-dasharray); the progress arc's
// dashoffset = circumference × (1 − ratio). Rotated -90° so it fills from
// 12 o'clock. Track (`--color-t3`) under the accent progress arc.
const CIRCUMFERENCE = 31.4159

export interface UsageCircleProps {
  /** 0..1 fraction filled. Clamped. */
  ratio: number
  size?: number
  title?: string
  'aria-label'?: string
}

export function UsageCircle({
  ratio,
  size = 12,
  title,
  'aria-label': ariaLabel
}: UsageCircleProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, ratio))
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className="-rotate-90"
      role="img"
      aria-label={ariaLabel}
    >
      {title && <title>{title}</title>}
      <circle cx="6" cy="6" r="5" fill="none" strokeWidth="2" stroke="var(--color-t3)" />
      <circle
        cx="6"
        cy="6"
        r="5"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        stroke="var(--color-accent)"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  )
}
