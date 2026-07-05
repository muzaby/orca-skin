import { useRef, useState } from 'react'
import { Popover } from '../shared/ui/Popover'
import { Icon } from '../shared/ui/Icon'
import { useLoginStore } from '../features/login'
import { SettingsModal } from '../features/settings'

// 언어 서브메뉴 목록 — 참조 디자인(이미지1)의 언어들을 나열하되 한국어만 활성/체크,
// 나머지는 비활성(inert) 표기. (실제 배선은 한국어 1개.)
const LANGUAGES: { label: string; active: boolean }[] = [
  { label: 'English (United States)', active: false },
  { label: 'Français (France)', active: false },
  { label: 'Deutsch (Deutschland)', active: false },
  { label: '日本語 (日本)', active: false },
  { label: '한국어 (대한민국)', active: true },
  { label: 'Português (Brasil)', active: false },
  { label: 'Español (España)', active: false }
]

const MENU_ITEM =
  'flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-ink hover:bg-sidebar'

// 사이드바 footer 의 사용자 버튼(app 레이어 조립 — 로그인 스토어[features/login] +
// 설정 모달[features/settings] 를 함께 참조하므로 교차-feature 회피 위해 여기 둔다).
// 썸네일 아이콘 없이 이메일 텍스트만 표기하고(bypass=developer), 클릭 시 팝오버 메뉴를 연다.
export function SidebarUserButton(): React.JSX.Element {
  const bypass = useLoginStore((s) => s.bypass)
  const email = useLoginStore((s) => s.email)
  const displayName = bypass ? 'developer' : (email ?? 'developer')

  const anchorRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const closeMenu = (): void => {
    setMenuOpen(false)
    setLangOpen(false)
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-r4 border-0 px-2.5 py-1.5 text-left text-footnote transition-colors ${
          menuOpen
            ? 'bg-fill-uncontained-active text-t9'
            : 'bg-transparent text-t7 hover:bg-fill-uncontained-hover hover:text-t9'
        }`}
      >
        <Icon name="user" size={14} />
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
        <Icon name="chevU" size={13} />
      </button>

      <Popover
        open={menuOpen}
        anchorRef={anchorRef}
        onClose={closeMenu}
        placement="top"
        align="start"
        className="min-w-[220px]"
      >
        {/* 이메일 그룹 헤더 */}
        <div className="truncate px-2.5 py-1.5 text-[11.5px] text-ink3">{displayName}</div>
        <div className="my-1 border-t border-border" />

        {/* 설정 */}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeMenu()
            setSettingsOpen(true)
          }}
          className={MENU_ITEM}
        >
          <Icon name="settings" size={14} />
          <span>설정</span>
        </button>

        {/* 언어 — 클릭 시 인라인 서브메뉴 확장 */}
        <button
          type="button"
          role="menuitem"
          aria-expanded={langOpen}
          onClick={() => setLangOpen((v) => !v)}
          className={MENU_ITEM}
        >
          <Icon name="chat" size={14} />
          <span className="flex-1">언어</span>
          <Icon name={langOpen ? 'chevD' : 'chevR'} size={13} />
        </button>
        {langOpen && (
          <div className="mt-0.5 flex flex-col border-t border-border pt-0.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.label}
                type="button"
                role="menuitemradio"
                aria-checked={lang.active}
                disabled={!lang.active}
                onClick={lang.active ? closeMenu : undefined}
                className={`flex w-full items-center gap-2 rounded-md border-0 bg-transparent py-1.5 pl-8 pr-2.5 text-left text-[12.5px] ${
                  lang.active
                    ? 'cursor-pointer text-ink hover:bg-sidebar'
                    : 'cursor-not-allowed text-ink3'
                }`}
              >
                <span className="flex-1">{lang.label}</span>
                {lang.active && <Icon name="check" size={13} />}
              </button>
            ))}
          </div>
        )}
      </Popover>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
