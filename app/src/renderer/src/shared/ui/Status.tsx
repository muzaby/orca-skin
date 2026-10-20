export type StatusTone = 'green' | 'amber' | 'red' | 'slate'

export interface StatusProps {
  tone?: StatusTone
  label?: string
}

const DOT_TONE: Record<StatusTone, string> = {
  green: 'bg-good ring-good/20',
  amber: 'bg-warn ring-warn/20',
  red: 'bg-bad ring-bad/20',
  slate: 'bg-slate-dot ring-transparent'
}

export function Dot({ tone }: { tone: StatusTone }): React.JSX.Element {
  return (
    <span
      className={`inline-block h-[7px] w-[7px] flex-none rounded-full ring-2 ${DOT_TONE[tone]}`}
    />
  )
}

/** Compact connection indicator; activity stays inside the same circle. */
export function StatusBall({
  tone,
  busy = false
}: {
  tone: StatusTone
  busy?: boolean
}): React.JSX.Element {
  const color: Record<StatusTone, string> = {
    green: 'text-good',
    amber: 'text-warn',
    red: 'text-bad',
    slate: 'text-slate-dot'
  }
  return (
    <span
      data-status-tone={tone}
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${color[tone]}`}
    >
      {busy ? (
        <svg
          data-status-spinner
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3 animate-spin motion-reduce:animate-none"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="8" cy="8" r="6" opacity="0.25" />
          <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
        </svg>
      ) : (
        <Dot tone={tone} />
      )}
    </span>
  )
}

export function Status({ tone = 'green', label }: StatusProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink2">
      <Dot tone={tone} />
      {label}
    </span>
  )
}
