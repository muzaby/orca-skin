import { WinControls } from '../components/atoms/WinControls'
import { V1 } from './theme'

export interface TitlebarProps {
  project?: string
  breadcrumb?: string | null
}

export function Titlebar({
  project = 'cam-validation-v3',
  breadcrumb
}: TitlebarProps): React.JSX.Element {
  return (
    <div
      className="titlebar"
      style={{ background: V1.sidebar, borderBottom: `1px solid ${V1.border}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: V1.rust,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            fontFamily: 'var(--serif)',
            fontWeight: 700,
            fontSize: 12
          }}
        >
          O
        </div>
        <span
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 600,
            fontSize: 13,
            color: V1.ink,
            letterSpacing: -0.2
          }}
        >
          Orca
        </span>
        <span style={{ color: V1.ink3, fontSize: 11 }}>—</span>
        <span style={{ color: V1.ink2, fontSize: 12 }}>{project}</span>
        {breadcrumb && (
          <>
            <span style={{ color: V1.ink3, fontSize: 11, margin: '0 4px' }}>›</span>
            <span style={{ color: V1.ink2, fontSize: 12 }}>{breadcrumb}</span>
          </>
        )}
      </div>
      <WinControls />
    </div>
  )
}
