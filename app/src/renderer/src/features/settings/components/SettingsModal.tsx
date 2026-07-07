import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '../../../shared/ui/Icon'
import type { UsageLimitsView } from '../../../../../shared/usage/limits'
import { GeneralTab } from './GeneralTab'
import { UsageTab } from './UsageTab'
import { useSettingsModalStore, type SettingsTabId } from '../store/settingsModalStore'

const TABS: { id: SettingsTabId; label: string; icon: IconName }[] = [
  { id: 'general', label: '일반', icon: 'settings' },
  { id: 'usage', label: '사용량', icon: 'chart' }
]

interface SettingsModalProps {
  // 사용량 한도 뷰모델 — 컴포지션 루트(SidebarUserButton)가 실사용 SSOT(costStore)+월 한도로
  // 파생(computeUsageLimits)해 주입. 도넛과 동일 함수 참조 — settings 가 재계산하지 않는다.
  usageLimits: UsageLimitsView | null
}

// 설정 모달 — 배경을 어둡게 하고 중앙에 2-pane(좌: 일반/사용량 탭 레일, 우: 내용) 패널을
// 띄운다. 열림/탭 상태는 전역 스토어(settingsModalStore)가 보유해 도넛 `>` 등 다른 트리거가
// 특정 탭으로 열 수 있다. 닫힘=null 렌더(내용 상태는 각 탭이 언마운트 시 리셋).
export function SettingsModal({ usageLimits }: SettingsModalProps): React.JSX.Element | null {
  const open = useSettingsModalStore((s) => s.open)
  const tab = useSettingsModalStore((s) => s.tab)
  const setTab = useSettingsModalStore((s) => s.setTab)
  const hide = useSettingsModalStore((s) => s.hide)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, hide])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={hide}
      data-context="overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        className="flex h-[600px] max-h-[85vh] w-[860px] max-w-[92vw] overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 좌: 탭 레일 */}
        <nav className="flex w-[210px] flex-none flex-col gap-1 border-r border-border bg-sidebar p-3">
          <div className="px-2 pb-2 pt-1 font-serif text-[15px] font-semibold text-ink">설정</div>
          {TABS.map((it) => {
            const active = tab === it.id
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setTab(it.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-r4 border-0 px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  active
                    ? 'bg-fill-uncontained-active font-medium text-t9'
                    : 'bg-transparent text-t7 hover:bg-fill-uncontained-hover hover:text-t9'
                }`}
              >
                <Icon name={it.icon} size={15} />
                <span>{it.label}</span>
              </button>
            )
          })}
        </nav>

        {/* 우: 내용 */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <button
            type="button"
            onClick={hide}
            aria-label="닫기"
            className="absolute right-3 top-3 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-r4 border-0 bg-transparent text-ink3 hover:bg-fill-uncontained-hover hover:text-ink2"
          >
            <Icon name="x" size={15} />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
            {tab === 'general' ? <GeneralTab /> : <UsageTab usageLimits={usageLimits} />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
