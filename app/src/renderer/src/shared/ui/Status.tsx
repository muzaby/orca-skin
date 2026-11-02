export type StatusTone = 'green' | 'amber' | 'red' | 'slate' | 'blue'

const DOT_TONE: Record<StatusTone, string> = {
  blue: 'bg-selected ring-selected/20',
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
