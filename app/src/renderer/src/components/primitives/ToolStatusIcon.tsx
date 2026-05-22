import type { CSSProperties } from 'react'
import { Icon } from './Icon'

export type ToolStatus = 'done' | 'running' | 'pending'

export interface ToolStatusIconProps {
  status: ToolStatus
  size?: number
  /** Optional override of the running tone (defaults to --rust). */
  runningColor?: string
  style?: CSSProperties
}

/** ToolStatusIcon — running spinner / done check / pending dot.
 *  Absorbed: v5 ToolBlock header indicator (terminal / spin / cog),
 *  step-circle (number → check on completion). */
export function ToolStatusIcon({
  status,
  size = 14,
  runningColor = 'var(--rust)',
  style
}: ToolStatusIconProps): React.JSX.Element {
  if (status === 'running') {
    return (
      <div
        className="spin"
        style={{
          width: size,
          height: size,
          border: '1.6px solid ' + runningColor,
          borderTopColor: 'transparent',
          borderRadius: '50%',
          ...style
        }}
      />
    )
  }
  if (status === 'done') {
    return <Icon name="terminal" size={size} color="var(--ink-3)" style={style} />
  }
  return <Icon name="cog" size={size} color="var(--ink-3)" style={style} />
}

/** Step circle for progress lists (RightPanel.진행상황). When `done` is true,
 *  shows a filled blue check; otherwise an outlined number. */
export function StepCircle({
  index,
  done,
  size = 22
}: {
  index: number
  done: boolean
  size?: number
}): React.JSX.Element {
  if (done) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--info)',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flex: '0 0 auto'
        }}
      >
        <Icon name="check" size={Math.floor(size * 0.6)} color="#fff" stroke={2.2} />
      </div>
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1.5px solid var(--ink-4)',
        color: 'var(--ink-3)',
        fontSize: Math.floor(size * 0.5),
        fontWeight: 600,
        display: 'grid',
        placeItems: 'center',
        flex: '0 0 auto'
      }}
    >
      {index}
    </div>
  )
}
