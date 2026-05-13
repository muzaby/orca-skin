import { Icon, type IconName } from '../components/atoms/Icon'
import { Avatar } from '../components/atoms/Avatar'
import { V1 } from './theme'
import type { ScreenId } from './screens'

export interface SidebarProps {
  active?: ScreenId
  collapsed?: boolean
  onSelect?: (screen: ScreenId) => void
}

interface NavItem {
  i: IconName
  l: string
  count?: number
  screen: ScreenId
}

const NAV: NavItem[] = [
  { i: 'chat', l: '채팅', count: 12, screen: 'chat' },
  { i: 'folder', l: '프로젝트', count: 4, screen: 'projects' },
  { i: 'flask', l: '캡처 & 분석', count: 38, screen: 'captures' },
  { i: 'cpu', l: '엔진 & 모델', screen: 'engine' },
  { i: 'bolt', l: 'Skills & MCP', count: 9, screen: 'skills' }
]

const PROJECTS: {
  id: string
  name: string
  engine: 'claude' | 'opencode' | 'local'
  active?: boolean
}[] = [
  { id: 'cam', name: 'cam-validation-v3', engine: 'claude', active: true },
  { id: 'snr', name: 'snr-regression-2026', engine: 'opencode' },
  { id: 'aec', name: 'aec-tuning-suite', engine: 'claude' },
  { id: 'bay', name: 'bayer-debug', engine: 'local' }
]

const RECENT: { id: string; t: string; time: string; active?: boolean }[] = [
  { id: 's1', t: 'Low-light SNR at G2 channel', time: '14m', active: true },
  { id: 's2', t: 'AE convergence delay analysis', time: '2h' },
  { id: 's3', t: 'Capture batch — 240 frames', time: 'Yesterday' },
  { id: 's4', t: 'IR cut filter verification', time: '2d' },
  { id: 's5', t: '센서 EVS 캘리브레이션', time: '4d' }
]

const engineDot = (e: 'claude' | 'opencode' | 'local'): string =>
  e === 'claude' ? 'green' : e === 'opencode' ? 'amber' : 'slate'

export function Sidebar({
  active = 'chat',
  collapsed = false,
  onSelect
}: SidebarProps): React.JSX.Element {
  if (collapsed) {
    const icons: IconName[] = ['plus', 'chat', 'folder', 'flask', 'cpu', 'settings']
    return (
      <aside
        style={{
          width: 56,
          background: V1.sidebar,
          borderRight: `1px solid ${V1.border}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 0',
          gap: 4,
          alignItems: 'center',
          flex: '0 0 auto'
        }}
      >
        {icons.map((n, i) => (
          <button
            key={n}
            style={{
              width: 36,
              height: 36,
              border: 0,
              background: i === 1 ? V1.rustSoft : 'transparent',
              color: i === 1 ? V1.rust : V1.ink2,
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <Icon name={n} size={17} />
          </button>
        ))}
      </aside>
    )
  }

  return (
    <aside
      style={{
        width: 248,
        background: V1.sidebar,
        borderRight: `1px solid ${V1.border}`,
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 auto'
      }}
    >
      <div style={{ padding: '10px 12px 6px' }}>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            border: `1px solid ${V1.border}`,
            background: V1.panel,
            borderRadius: 8,
            cursor: 'pointer',
            color: V1.ink,
            fontWeight: 500
          }}
        >
          <Icon name="plus" size={14} /> 새 대화
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
            <span className="kbd" style={{ fontSize: 10 }}>
              ⌘
            </span>
            <span className="kbd" style={{ fontSize: 10 }}>
              N
            </span>
          </span>
        </button>
      </div>

      <nav style={{ padding: '4px 6px' }}>
        {NAV.map((it) => {
          const isActive = it.screen === active
          return (
            <div
              key={it.i}
              onClick={() => onSelect?.(it.screen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '6px 10px',
                borderRadius: 6,
                color: isActive ? V1.ink : V1.ink2,
                background: isActive ? 'rgba(0,0,0,.04)' : 'transparent',
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer'
              }}
            >
              <Icon name={it.i} size={14} />
              <span>{it.l}</span>
              {it.count != null && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: V1.ink3,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {it.count}
                </span>
              )}
            </div>
          )
        })}
      </nav>

      <div
        style={{
          padding: '14px 12px 4px',
          fontFamily: 'var(--serif)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: V1.ink3,
          textTransform: 'uppercase'
        }}
      >
        프로젝트
      </div>
      <div style={{ padding: '0 6px' }}>
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 10px',
              borderRadius: 6,
              background: p.active ? V1.rustSoft : 'transparent',
              color: p.active ? V1.ink : V1.ink2,
              fontSize: 12.5,
              cursor: 'pointer'
            }}
          >
            <span className={`dot ${engineDot(p.engine)}`} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.name}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '14px 12px 4px',
          fontFamily: 'var(--serif)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: V1.ink3,
          textTransform: 'uppercase'
        }}
      >
        최근 대화
      </div>
      <div style={{ padding: '0 6px', flex: 1, overflow: 'hidden' }}>
        {RECENT.map((s) => (
          <div
            key={s.id}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: s.active ? 'rgba(0,0,0,.04)' : 'transparent',
              cursor: 'pointer'
            }}
          >
            <div
              style={{
                fontSize: 12.5,
                color: s.active ? V1.ink : V1.ink2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: s.active ? 500 : 400
              }}
            >
              {s.t}
            </div>
            <div style={{ fontSize: 10.5, color: V1.ink3, marginTop: 1 }}>{s.time}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 10,
          borderTop: `1px solid ${V1.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        <Avatar kind="claude" size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: V1.ink, fontWeight: 500 }}>Claude Code</div>
          <div
            style={{
              fontSize: 10.5,
              color: V1.ink3,
              display: 'flex',
              gap: 6,
              alignItems: 'center'
            }}
          >
            <span className="dot green" /> claude-sonnet-4.5
          </div>
        </div>
        <button
          style={{
            width: 26,
            height: 26,
            border: 0,
            background: 'transparent',
            borderRadius: 6,
            color: V1.ink3,
            cursor: 'pointer'
          }}
        >
          <Icon name="settings" size={14} />
        </button>
      </div>
    </aside>
  )
}
