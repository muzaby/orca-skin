import type { ReactNode } from 'react'
import { useState } from 'react'
import { Icon, type IconName } from '../../components/primitives/Icon'
import { ToggleSwitch } from '../../components/primitives/ToggleSwitch'

export interface SettingsProps {
  onClose?: () => void
}

interface NavSpec {
  id: string
  label: string
  badge?: string
}

const SETTINGS_NAV: NavSpec[] = [
  { id: 'general', label: '일반' },
  { id: 'account', label: '계정' },
  { id: 'privacy', label: '개인정보보호' },
  { id: 'billing', label: '결제' },
  { id: 'usage', label: '사용량' },
  { id: 'features', label: '기능' },
  { id: 'connect', label: '커넥터' },
  { id: 'code', label: 'Claude Code' },
  { id: 'cowork', label: '협업' },
  { id: 'chrome', label: 'Chrome용 Claude', badge: '베타' }
]

const SETTINGS_DESKTOP_NAV: NavSpec[] = [
  { id: 'd-general', label: '일반' },
  { id: 'd-ext', label: '확장 프로그램' },
  { id: 'd-dev', label: '개발자' }
]

/** v5 Settings page (DESIGN.md §5 #19).
 *  Header (back + title) → 2-col body (left tab rail + right form sections).
 *  Currently only the 일반 tab is implemented; clicking another tab updates the
 *  active highlight but the body stays the same (placeholder for future). */
export function Settings({ onClose }: SettingsProps): React.JSX.Element {
  const [active, setActive] = useState('general')
  const [notifyDone, setNotifyDone] = useState(true)
  const [notifyApproval, setNotifyApproval] = useState(true)
  const [notifySound, setNotifySound] = useState(false)
  const [appearance, setAppearance] = useState<'system' | 'light' | 'dark'>('light')

  return (
    <main
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'var(--bg)'
      }}
    >
      <div style={{ padding: '20px 32px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={onClose}
          className="tb-icon-btn"
          style={{ width: 30, height: 30, borderRadius: 6, display: 'grid', placeItems: 'center', background: 'transparent', border: 0, cursor: 'pointer' }}
        >
          <Icon name="arrowL" size={16} />
        </button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--ink)' }}>설정</h1>
      </div>

      <div
        className="scroll"
        style={{ flex: 1, minHeight: 0, display: 'flex', gap: 36, padding: '20px 36px 64px' }}
      >
        <aside style={{ width: 200, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {SETTINGS_NAV.map((s) => (
            <TabButton key={s.id} active={active === s.id} onClick={() => setActive(s.id)}>
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.badge && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '1px 5px',
                    background: 'rgba(0,0,0,.06)',
                    borderRadius: 4,
                    color: 'var(--ink-3)'
                  }}
                >
                  {s.badge}
                </span>
              )}
            </TabButton>
          ))}
          <div
            style={{
              margin: '18px 14px 6px',
              fontSize: 11,
              color: 'var(--ink-4)',
              letterSpacing: 0.2
            }}
          >
            데스크톱 앱
          </div>
          {SETTINGS_DESKTOP_NAV.map((s) => (
            <TabButton key={s.id} active={active === s.id} onClick={() => setActive(s.id)}>
              {s.label}
            </TabButton>
          ))}
        </aside>

        <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
          <SectionHeader>프로필</SectionHeader>
          <SettingsField label="아바타">
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#e8e3d6',
                color: 'var(--ink-2)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 12,
                fontWeight: 700
              }}
            >
              D
            </div>
          </SettingsField>
          <SettingsField label="성명">
            <input className="field-input" defaultValue="Dy" style={{ width: 200, padding: '6px 10px', fontSize: 13 }} />
          </SettingsField>
          <SettingsField label="Claude가 어떻게 불러드릴까요?">
            <input className="field-input" defaultValue="Dy" style={{ width: 200, padding: '6px 10px', fontSize: 13 }} />
          </SettingsField>
          <SettingsField label="귀하의 업무를 가장 잘 설명하는 것은 무엇입니까?">
            <DropdownButton width={200}>엔지니어링</DropdownButton>
          </SettingsField>
          <div style={{ padding: '18px 0 14px' }}>
            <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>Claude 지침</div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: 'var(--ink-3)' }}>
              Claude는 <a href="#">Anthropic의 가이드라인</a> 내에서 채팅 및 Cowork 전반에 걸쳐 이를 기억합니다.{' '}
              <a href="#">자세히 알아보기</a>
            </div>
            <textarea
              className="field-input"
              style={{
                marginTop: 12,
                minHeight: 96,
                fontFamily: 'var(--font-mono)',
                fontSize: 12.5,
                lineHeight: 1.6
              }}
              defaultValue={`- 질문의 맥락 확인이 어려울 때에는 질문의 의도를 명확히 하는 질문을 해야 함.
- 설명을 간단명료하게 유지하되 핵심 내용은 상세하게 설명
- 품질을 떨어뜨리는 행위 (추측하여 생성 등) 는 지양`}
            />
          </div>

          <SectionHeader>환경설정</SectionHeader>
          <SettingsField label="모양">
            <AppearancePicker value={appearance} onChange={setAppearance} />
          </SettingsField>
          <SettingsField label="채팅 글꼴">
            <DropdownButton width={160}>Anthropic Serif</DropdownButton>
          </SettingsField>
          <SettingsField label="언어">
            <DropdownButton width={160}>한국어</DropdownButton>
          </SettingsField>

          <SectionHeader>알림</SectionHeader>
          <SettingsField label="예약된 작업 완료 알림">
            <ToggleSwitch on={notifyDone} onChange={setNotifyDone} />
          </SettingsField>
          <SettingsField label="승인 요청 시 알림">
            <ToggleSwitch on={notifyApproval} onChange={setNotifyApproval} />
          </SettingsField>
          <SettingsField label="시스템 알림 소리">
            <ToggleSwitch on={notifySound} onChange={setNotifySound} />
          </SettingsField>
        </div>
      </div>
    </main>
  )
}

function TabButton({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick?: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="suggest-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 8,
        background: active ? 'var(--press)' : 'transparent',
        color: 'var(--ink)',
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        border: active ? '1px solid var(--line)' : '1px solid transparent',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

function SectionHeader({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <h2
      style={{
        margin: '4px 0 14px',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--ink)'
      }}
    >
      {children}
    </h2>
  )
}

function SettingsField({
  label,
  children,
  hint
}: {
  label: ReactNode
  children: ReactNode
  hint?: ReactNode
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 24,
        padding: '14px 0',
        borderBottom: '1px solid var(--line-soft)'
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--ink)' }}>{label}</div>
      <div style={{ color: 'var(--ink-2)' }}>{children}</div>
      {hint && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function DropdownButton({ width, children }: { width: number; children: ReactNode }): React.JSX.Element {
  return (
    <button
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--paper)',
        fontSize: 13,
        color: 'var(--ink)',
        minWidth: width,
        justifyContent: 'space-between',
        cursor: 'pointer'
      }}
    >
      {children}
      <Icon name="chevronD" size={12} color="var(--ink-3)" />
    </button>
  )
}

interface AppearanceOpt {
  v: 'system' | 'light' | 'dark'
  icon: IconName
}
const APPEARANCE_OPTS: AppearanceOpt[] = [
  { v: 'system', icon: 'monitor' },
  { v: 'light', icon: 'sunSimple' },
  { v: 'dark', icon: 'moon' }
]

function AppearancePicker({
  value,
  onChange
}: {
  value: AppearanceOpt['v']
  onChange?: (v: AppearanceOpt['v']) => void
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 2,
        background: 'rgba(0,0,0,.04)',
        borderRadius: 999
      }}
    >
      {APPEARANCE_OPTS.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange?.(o.v)}
          style={{
            width: 30,
            height: 26,
            borderRadius: 999,
            background: o.v === value ? 'var(--paper)' : 'transparent',
            boxShadow: o.v === value ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
            display: 'grid',
            placeItems: 'center',
            border: 0,
            cursor: 'pointer'
          }}
        >
          <Icon name={o.icon} size={14} color={o.v === value ? 'var(--ink)' : 'var(--ink-3)'} />
        </button>
      ))}
    </div>
  )
}
