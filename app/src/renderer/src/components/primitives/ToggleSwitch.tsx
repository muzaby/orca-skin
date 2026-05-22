import type { CSSProperties } from 'react'

export interface ToggleSwitchProps {
  on: boolean
  onChange?: (next: boolean) => void
  label?: string
  /** Override the on-state track color. Default --info-ish blue. */
  onColor?: string
  style?: CSSProperties
}

/** ToggleSwitch — small pill toggle used in Settings rows and Schedule cards. */
export function ToggleSwitch({
  on,
  onChange,
  label,
  onColor = '#3a6ad9',
  style
}: ToggleSwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange?.(!on)}
      style={{
        width: 30,
        height: 16,
        borderRadius: 999,
        background: on ? onColor : 'rgba(0,0,0,.18)',
        position: 'relative',
        display: 'inline-block',
        transition: 'background .15s',
        cursor: onChange ? 'pointer' : 'default',
        border: 0,
        padding: 0,
        ...style
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 16 : 2,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          transition: 'left .15s'
        }}
      />
    </button>
  )
}
