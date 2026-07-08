// Donut progress indicator — mirrors the Claude Code desktop "usage" circle.
// r=5 → circumference 2πr ≈ 31.4159 (= stroke-dasharray); the progress arc's
// dashoffset = circumference × (1 − ratio). Rotated -90° so it fills from
// 12 o'clock. Track (`--color-t3`) under the accent progress arc.
import { usageToneForRatio, type UsageTone } from './usageTone'

const CIRCUMFERENCE = 31.4159

// 톤 → progress arc CSS 변수. 임계(0.6/0.85)는 usageToneForRatio 가 Meter 와 공유.
const STROKE_VAR: Record<UsageTone, string> = {
  info: 'var(--color-indigo)',
  warn: 'var(--color-warn)',
  bad: 'var(--color-bad)'
}

export interface UsageCircleProps {
  /** 0..1 fraction filled. Clamped. */
  ratio: number
  size?: number
  title?: string
  /** compaction 임박 등 경고 상태 — progress arc 를 강제로 위험색(bad)으로 칠한다. */
  warn?: boolean
  'aria-label'?: string
}

// progress arc 색 — 사용량에 따라 파랑(여유)→노랑(주의)→빨강(임박). 임계는
// Composer 의 conversationStatus(0.6/0.85)와 일치. warn prop 은 강제 위험색.
function progressStroke(clamped: number, warn?: boolean): string {
  return STROKE_VAR[warn ? 'bad' : usageToneForRatio(clamped)]
}

export function UsageCircle({
  ratio,
  size = 12,
  title,
  warn,
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
        stroke={progressStroke(clamped, warn)}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        className="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
  )
}
