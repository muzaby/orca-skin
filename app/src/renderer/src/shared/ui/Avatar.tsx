export type AvatarKind = 'user' | 'claude' | 'opencode'

export interface AvatarProps {
  kind?: AvatarKind
  size?: number
}

export function Avatar({ kind = 'user', size = 28 }: AvatarProps): React.JSX.Element {
  if (kind === 'claude') {
    return (
      <div
        className="grid flex-none place-items-center rounded-full bg-rust font-serif font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        ★
      </div>
    )
  }
  if (kind === 'opencode') {
    return (
      <div
        className="grid flex-none place-items-center rounded-md bg-ink-900 font-mono font-semibold tracking-tighter text-white"
        style={{ width: size, height: size, fontSize: size * 0.36 }}
      >
        oc
      </div>
    )
  }
  return (
    <div
      className="grid flex-none place-items-center rounded-full bg-cream-200 font-semibold text-ink-700"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      JK
    </div>
  )
}
