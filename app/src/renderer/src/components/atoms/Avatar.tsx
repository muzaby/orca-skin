export type AvatarKind = 'user' | 'claude' | 'opencode'

export interface AvatarProps {
  kind?: AvatarKind
  size?: number
}

export function Avatar({ kind = 'user', size = 28 }: AvatarProps): React.JSX.Element {
  if (kind === 'claude') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#c96442',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontFamily: 'var(--serif)',
          fontWeight: 600,
          fontSize: size * 0.42,
          flex: '0 0 auto'
        }}
      >
        ★
      </div>
    )
  }
  if (kind === 'opencode') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: 'var(--ink-900)',
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontWeight: 600,
          fontSize: size * 0.36,
          flex: '0 0 auto',
          letterSpacing: -0.5
        }}
      >
        oc
      </div>
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--cream-200)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--ink-700)',
        fontWeight: 600,
        fontSize: size * 0.4,
        flex: '0 0 auto'
      }}
    >
      JK
    </div>
  )
}
