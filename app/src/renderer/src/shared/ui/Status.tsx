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

export function Status({ tone = 'green', label }: StatusProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink2">
      <Dot tone={tone} />
      {label}
    </span>
  )
}
