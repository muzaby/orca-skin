import { useRef, useState } from 'react'
import { MenuItem } from '../shared/ui/MenuItem'
import { Popover } from '../shared/ui/Popover'
import { Icon } from '../shared/ui/Icon'
import { useTweakContext } from '../shared/theme'
import { useI18n, type UiLocale } from '../shared/i18n'
import { useAuthStore } from '../features/auth'
import { SettingsModal, useSettingsModalStore } from '../features/settings'
import { useProviderUsage } from '../features/cost'

// 언어 서브메뉴 목록 — UI 표시 언어(settings.uiLocale) 스위처(0096).
// 언어 이름은 해당 언어 자체 표기라 번역하지 않는다.
const LANGUAGES: { value: UiLocale; label: string }[] = [
  { value: 'en', label: 'English (United States)' },
  { value: 'ko', label: '한국어 (대한민국)' }
]

// 사이드바 footer 의 사용자 버튼(app 레이어 조립 — 인증 스토어[features/auth] +
// 설정 모달[features/settings] 를 함께 참조하므로 교차-feature 회피 위해 여기 둔다).
// 썸네일 아이콘 없이 이메일 텍스트만 표기하고(bypass=developer), 클릭 시 팝오버 메뉴를 연다.
export function SidebarUserButton(): React.JSX.Element {
  const bypass = useAuthStore((s) => s.bypass)
  const email = useAuthStore((s) => s.email)
  const displayName = bypass ? 'developer' : (email ?? 'developer')

  const anchorRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const showSettings = useSettingsModalStore((s) => s.show)
  const { t, setTweak } = useTweakContext()
  const { tr } = useI18n()
  // provider별 사용량(0080 항목 4) — 교차-feature 회피 위해 app 레이어가 features/cost 훅을
  // 호출해 features/settings 모달에 props 로 주입한다. 전역 사용량 탭은 /cost 플레이스홀더로
  // 축소돼(0081) usageLimits/costRefresh 주입은 불필요(도넛 경로는 page 가 별도 주입).
  const providerUsage = useProviderUsage()

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
        <MenuItem
          role="menuitem"
          icon="settings"
          onClick={() => {
            closeMenu()
            showSettings('general')
          }}
        >
          <span>{tr('userMenu.settings')}</span>
        </MenuItem>

        {/* 언어 — 클릭 시 우측으로 확장되는 플라이아웃 팝오버(서브메뉴).
            부모 팝오버 패널 내부에 absolute left-full 로 두어 부모 dismiss 트리에
            함께 묶는다(패널 밖 클릭만 닫힘). */}
        <div className="relative">
          <MenuItem
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={langOpen}
            icon="globe"
            onClick={() => setLangOpen((v) => !v)}
            className={langOpen ? 'bg-fill-uncontained-active' : ''}
          >
            <span className="flex-1">{tr('userMenu.language')}</span>
            <Icon name="chevR" size={13} />
          </MenuItem>
          {langOpen && (
            <div
              role="menu"
              className="absolute bottom-0 left-full z-10 ml-1 flex min-w-[200px] flex-col rounded-lg border border-border bg-panel p-1 shadow-lg"
            >
              {/* 그룹 헤더 — LLM 응답 언어(settings.language)와 구분: 이 스위처는 UI 표시 언어. */}
              <div className="px-2.5 py-1.5 text-[11.5px] text-ink3">
                {tr('userMenu.displayLanguage')}
              </div>
              {LANGUAGES.map((lang) => {
                const active = t.uiLocale === lang.value
                return (
                  <MenuItem
                    key={lang.value}
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setTweak('uiLocale', lang.value)
                      closeMenu()
                    }}
                  >
                    <span className="flex-1">{lang.label}</span>
                    {active && <Icon name="check" size={13} />}
                  </MenuItem>
                )
              })}
            </div>
          )}
        </div>
      </Popover>

      <SettingsModal providerUsage={providerUsage} />
    </>
  )
}
