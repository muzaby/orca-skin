export type StatusTone = 'green' | 'amber' | 'red' | 'slate'

export interface StatusProps {
  tone?: StatusTone
  label?: string
}

export function Status({ tone = 'green', label }: StatusProps): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: 'var(--ink-500)'
      }}
    >
      <span className={`dot ${tone}`} />
      {label}
    </span>
  )
}
