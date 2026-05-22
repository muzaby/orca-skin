import type { ReactNode } from 'react'
import { Icon, type IconName } from '../primitives/Icon'

export interface AccountMenuProps {
  email?: string
  /** Whether the language submenu is open. Controls highlight on 언어 row. */
  langOpen?: boolean
  onToggleLang?: () => void
  onOpenSettings?: () => void
  onLogout?: () => void
}

interface MenuItem {
  icon: IconName
  label: string
  right?: ReactNode
  onClick?: () => void
  active?: boolean
}

/** AccountMenu — bottom-left drop-up shown above the account row.
 *  Floats absolutely; the parent positions/clips it (typically inside the
 *  sidebar column). Use `langOpen` to highlight the 언어 row when its
 *  submenu is visible.  */
export function AccountMenu({
  email = 'rlaeodud13@gmail.com',
  langOpen = false,
  onToggleLang,
  onOpenSettings,
  onLogout
}: AccountMenuProps): React.JSX.Element {
  const groups: MenuItem[][] = [
    [
      { icon: 'cog', label: '설정', right: <span className="kbd">Ctrl,</span>, onClick: onOpenSettings },
      {
        icon: 'globe',
        label: '언어',
        right: <Icon name="chevronR" size={13} color="var(--ink-4)" />,
        active: langOpen,
        onClick: onToggleLang
      },
      { icon: 'question', label: '도움 받기' }
    ],
    [
      { icon: 'list', label: '모든 요금제 보기' },
      { icon: 'download', label: '앱 및 확장 프로그램 받기' },
      { icon: 'gift', label: 'Claude 선물하기' },
      { icon: 'info', label: '자세히 알아보기', right: <Icon name="chevronR" size={13} color="var(--ink-4)" /> }
    ],
    [{ icon: 'logout', label: '로그아웃', onClick: onLogout }]
  ]
  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        bottom: 50,
        width: 256,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: 6,
        zIndex: 50,
        pointerEvents: 'auto'
      }}
    >
      <div style={{ padding: '8px 10px 6px', fontSize: 12, color: 'var(--ink-3)' }}>{email}</div>
      {groups.map((group, gi) => (
        <div key={gi}>
          <div style={{ height: 1, background: 'var(--line-soft)', margin: '4px 2px' }} />
          {group.map((row) => (
            <MenuRow key={row.label} {...row} />
          ))}
        </div>
      ))}
      {langOpen && <LanguageSubmenu />}
    </div>
  )
}

function MenuRow({ icon, label, right, active, onClick }: MenuItem): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="suggest-row"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 10px',
        borderRadius: 7,
        background: active ? 'var(--press)' : 'transparent',
        color: 'var(--ink)',
        fontSize: 13.5,
        textAlign: 'left',
        border: 0,
        cursor: 'pointer'
      }}
    >
      <Icon name={icon} size={15} color="var(--ink-3)" />
      <span style={{ flex: 1 }}>{label}</span>
      {right && (
        <span style={{ color: 'var(--ink-3)', fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>{right}</span>
      )}
    </button>
  )
}

const LANGUAGES: { label: string; selected?: boolean }[] = [
  { label: 'English (United States)' },
  { label: 'Français (France)' },
  { label: 'Deutsch (Deutschland)' },
  { label: 'हिन्दी (भारत)' },
  { label: 'Indonesia (Indonesia)' },
  { label: 'Italiano (Italia)' },
  { label: '日本語 (日本)' },
  { label: '한국어(대한민국)', selected: true },
  { label: 'Português (Brasil)' },
  { label: 'Español (Latinoamérica)' },
  { label: 'Español (España)' }
]

export interface LanguageSubmenuProps {
  selected?: string
  onPick?: (lang: string) => void
}

/** LanguageSubmenu — fly-out to the right of AccountMenu (`langOpen=true`).
 *  Anchored to the parent AccountMenu via `position: absolute` with
 *  `left: calc(100% + 8px)` and `bottom: 0`. */
export function LanguageSubmenu({
  selected = '한국어(대한민국)',
  onPick
}: LanguageSubmenuProps): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: 'calc(100% + 8px)',
        bottom: 0,
        width: 248,
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: 6
      }}
    >
      {LANGUAGES.map((lang) => {
        const isSel = lang.label === selected || (lang.selected && selected === '한국어(대한민국)')
        return (
          <button
            key={lang.label}
            type="button"
            onClick={() => onPick?.(lang.label)}
            className="suggest-row"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '7px 10px',
              borderRadius: 7,
              background: isSel ? 'var(--press)' : 'transparent',
              color: 'var(--ink)',
              fontSize: 13,
              textAlign: 'left',
              border: 0,
              cursor: 'pointer'
            }}
          >
            <span style={{ flex: 1 }}>{lang.label}</span>
            {isSel && <Icon name="check" size={14} color="var(--info)" stroke={2.2} />}
          </button>
        )
      })}
    </div>
  )
}
