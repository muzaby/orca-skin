import { Icon, type IconName } from '../../../shared/ui/Icon'
import { Modal } from '../../../shared/ui/Modal'
import type { AgentEnvironment, ProviderUsageEntry } from '../../../../../shared/ipc'
import { GeneralTab } from './GeneralTab'
import { UsageTab } from './UsageTab'
import { ProviderUsageTab } from './ProviderUsageTab'
import { providerLabel } from '../lib/usageFormat'
import {
  useSettingsModalStore,
  providerTabId,
  providerKeyFromTab,
  type SettingsTabId
} from '../store/settingsModalStore'

const TABS: { id: SettingsTabId; label: string; icon: IconName }[] = [
  { id: 'general', label: '일반', icon: 'settings' },
  { id: 'usage', label: '사용량', icon: 'chart' }
]

// provider별 사용량 컨트롤러(0080 항목 4). 정의는 features/cost 의 useProviderUsage 이지만,
// 교차-feature import 회피를 위해 settings 가 구조적으로 동일한 형태를 선언(app 레이어가 주입).
export interface ProviderUsageController {
  providers: AgentEnvironment[]
  entryFor: (key: string) => ProviderUsageEntry | undefined
  refreshing: boolean
  refresh: () => void
  setLimit: (key: string, limitUsd: number | null) => Promise<void>
}

interface SettingsModalProps {
  // provider별 사용량 컨트롤러(0080 항목 4) — nav 서브항목 + provider 서브탭 데이터/저장.
  // 전역 '사용량' 탭은 /cost 플레이스홀더로 축소돼(0081) 더는 usageLimits/costRefresh 를
  // 받지 않는다. 도넛/컴포저의 usageLimits 는 별도 경로(page→Composer)로 무관.
  providerUsage: ProviderUsageController
}

// 설정 모달 — 배경을 어둡게 하고 중앙에 2-pane(좌: 일반/사용량 탭 레일, 우: 내용) 패널을
// 띄운다. 백드롭/portal/Esc 는 공용 Modal(크롬리스, panelClassName override). 열림/탭 상태는
// 전역 스토어(settingsModalStore)가 보유해 도넛 `>` 등 다른 트리거가 특정 탭으로 열 수 있다.
// 닫힘=null 렌더(내용 상태는 각 탭이 언마운트 시 리셋).
export function SettingsModal({ providerUsage }: SettingsModalProps): React.JSX.Element | null {
  const open = useSettingsModalStore((s) => s.open)
  const tab = useSettingsModalStore((s) => s.tab)
  const setTab = useSettingsModalStore((s) => s.setTab)
  const hide = useSettingsModalStore((s) => s.hide)
  const activeProviderKey = providerKeyFromTab(tab)
  const activeProvider = providerUsage.providers.find((p) => p.key === activeProviderKey)

  return (
    <Modal
      open={open}
      onClose={hide}
      ariaLabel="설정"
      panelClassName="flex h-[600px] max-h-[85vh] w-[860px] max-w-[92vw] overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      {/* 좌: 탭 레일 */}
      <nav className="flex w-[210px] flex-none flex-col gap-1 border-r border-border bg-sidebar p-3">
        <div className="px-2 pb-2 pt-1 font-serif text-[15px] font-semibold text-ink">설정</div>
        {TABS.map((it) => {
          const active = tab === it.id
          return (
            <div key={it.id}>
              <button
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
              {/* 사용량 하위: 구성된 provider 서브항목(0080 항목 4). 각자의 한도/설정. */}
              {it.id === 'usage' &&
                providerUsage.providers.map((p) => {
                  const pid = providerTabId(p.key)
                  const pactive = tab === pid
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setTab(pid)}
                      aria-current={pactive ? 'page' : undefined}
                      className={`mt-0.5 flex w-full cursor-pointer items-center gap-2 rounded-r4 border-0 py-1 pl-9 pr-2.5 text-left text-[12.5px] transition-colors ${
                        pactive
                          ? 'bg-fill-uncontained-active font-medium text-t9'
                          : 'bg-transparent text-t6 hover:bg-fill-uncontained-hover hover:text-t9'
                      }`}
                    >
                      <span className="min-w-0 truncate">{providerLabel(p)}</span>
                    </button>
                  )
                })}
            </div>
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
          {tab === 'general' && <GeneralTab />}
          {tab === 'usage' && <UsageTab />}
          {activeProvider && (
            <ProviderUsageTab
              provider={activeProvider}
              entry={providerUsage.entryFor(activeProvider.key)}
              refreshing={providerUsage.refreshing}
              onRefresh={providerUsage.refresh}
              onSetLimit={(v) => providerUsage.setLimit(activeProvider.key, v)}
            />
          )}
          {/* provider 탭인데 해당 provider 가 목록에 없으면(삭제됨) 안내. */}
          {activeProviderKey != null && !activeProvider && (
            <p className="text-[12.5px] text-ink3">provider 를 찾을 수 없습니다.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
