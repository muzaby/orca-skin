import { SidePanel } from '../../components/shell/SidePanel'
import { NavItem, NavBadge } from '../../components/primitives/NavItem'
import { Icon, type IconName } from '../../components/primitives/Icon'

export type V5NavId = 'newTask' | 'projects' | 'scheduled' | 'artifacts' | 'dispatch' | 'customize'

interface NavSpec {
  id: V5NavId
  icon: IconName
  label: string
  primary?: boolean
  badge?: string
}

const NAV: NavSpec[] = [
  { id: 'newTask', icon: 'plus', label: 'New task', primary: true },
  { id: 'projects', icon: 'projects', label: 'Projects' },
  { id: 'scheduled', icon: 'schedule', label: 'Scheduled' },
  { id: 'artifacts', icon: 'fish', label: 'Live artifacts' },
  { id: 'dispatch', icon: 'dispatch', label: 'Dispatch', badge: '베타' },
  { id: 'customize', icon: 'customize', label: 'Customize' }
]

export interface RecentItem {
  id: string
  title: string
  active?: boolean
}

export interface V5SidebarProps {
  active?: V5NavId
  recents?: RecentItem[]
  onNav?: (id: V5NavId) => void
  onRecent?: (id: string) => void
  /** Temporary escape hatch back to legacy app screens during migration. */
  onLeaveV5?: () => void
}

/** v5 Sidebar — composed from SidePanel + NavItem.
 *  Mirrors `project/versions/v5-orca-skin/orca-skin/shell.jsx` <Sidebar>. */
export function V5Sidebar({
  active = 'newTask',
  recents = [],
  onNav,
  onRecent,
  onLeaveV5
}: V5SidebarProps): React.JSX.Element {
  return (
    <SidePanel
      side="left"
      surface="bg-2"
      header={
        <nav style={{ padding: '12px 8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV.map((it) => (
            <NavItem
              key={it.id}
              icon={it.icon}
              label={it.label}
              primary={it.primary}
              active={it.id === active}
              trailing={it.badge ? <NavBadge>{it.badge}</NavBadge> : undefined}
              onClick={() => onNav?.(it.id)}
            />
          ))}
        </nav>
      }
      footer={<AccountFooter onLeaveV5={onLeaveV5} />}
    >
      {recents.length > 0 && (
        <>
          <div
            style={{
              marginTop: 14,
              padding: '0 18px 6px',
              fontSize: 11,
              color: 'var(--ink-4)',
              fontWeight: 500
            }}
          >
            Recents
          </div>
          <div style={{ padding: '0 8px' }}>
            {recents.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onRecent?.(r.id)}
                className="sb-nav-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: r.active ? 'var(--press)' : 'transparent',
                  color: r.active ? 'var(--ink)' : 'var(--ink-2)',
                  fontSize: 12.5,
                  textAlign: 'left'
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: r.active ? 'var(--rust)' : 'transparent',
                    border: r.active ? 'none' : '1px solid var(--ink-4)',
                    flex: '0 0 auto'
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {r.title}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </SidePanel>
  )
}

function AccountFooter({ onLeaveV5 }: { onLeaveV5?: () => void }): React.JSX.Element {
  return (
    <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        className="sb-nav-btn"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '6px 8px',
          borderRadius: 7
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#2d8a6a',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: 11
          }}
        >
          D
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>Dy</span>
        <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>· Pro</span>
        <Icon name="chevronD" size={12} color="var(--ink-4)" style={{ marginLeft: 'auto' }} />
      </button>
      {onLeaveV5 ? (
        <button
          type="button"
          onClick={onLeaveV5}
          className="sb-nav-btn"
          title="레거시 화면으로"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <Icon name="arrowL" size={15} color="var(--ink-3)" />
        </button>
      ) : (
        <button
          type="button"
          className="sb-nav-btn"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            display: 'grid',
            placeItems: 'center'
          }}
        >
          <Icon name="cloudDown" size={15} color="var(--ink-3)" />
        </button>
      )}
    </div>
  )
}
