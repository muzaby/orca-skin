import { useEffect } from 'react'
import { type IconName } from '../../../shared/ui/Icon'
import { Modal } from '../../../shared/ui/Modal'
import { Rail, RailItem } from '../../../shared/ui/Rail'
import { useI18n } from '../../../shared/i18n'
import { useAgentStore } from '../../../shared/stores/agentStore'
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

// 라벨은 언어 전환 시 stale 해지지 않도록 키만 상수로 두고 렌더에서 t() 해석.
const TABS = [
  { id: 'general', labelKey: 'settings.tabs.general', icon: 'settings' },
  { id: 'usage', labelKey: 'settings.tabs.usage', icon: 'chart' }
] as const satisfies readonly { id: SettingsTabId; labelKey: string; icon: IconName }[]

// 0186 — 구 `ProviderUsageController` prop 과 app 레이어 주입 배선이 사라졌다. 사용량 상태가
// `shared/stores/usageStore` 로 올라가 features 에서 직접 읽을 수 있게 됐기 때문이다
// (renderer boundaries 는 `features → shared` 를 허용한다).

// 설정 모달 — 배경을 어둡게 하고 중앙에 2-pane(좌: 일반/사용량 탭 레일, 우: 내용) 패널을
// 띄운다. 백드롭/portal/Esc 는 공용 Modal(크롬리스, panelClassName override). 열림/탭 상태는
// 전역 스토어(settingsModalStore)가 보유해 도넛 `>` 등 다른 트리거가 특정 탭으로 열 수 있다.
// 닫힘=null 렌더(내용 상태는 각 탭이 언마운트 시 리셋).
export function SettingsModal(): React.JSX.Element | null {
  const open = useSettingsModalStore((s) => s.open)
  const tab = useSettingsModalStore((s) => s.tab)
  const setTab = useSettingsModalStore((s) => s.setTab)
  const hide = useSettingsModalStore((s) => s.hide)
  const { tr } = useI18n()
  const activeProviderKey = providerKeyFromTab(tab)
  // provider 카탈로그는 공유 agentStore 가 갖는다(사용량 전용 컨트롤러를 따로 두지 않는다).
  const providers = useAgentStore((s) => s.agents)
  const ensureAgentsLoaded = useAgentStore((s) => s.ensureLoaded)
  const activeProvider = providers.find((p) => p.key === activeProviderKey)

  // 엔진&모델 페이지를 거치지 않고 설정을 열어도 provider 서브항목이 나오도록 최초 1회 확보.
  useEffect(() => {
    if (open) void ensureAgentsLoaded()
  }, [open, ensureAgentsLoaded])

  return (
    <Modal
      open={open}
      onClose={hide}
      ariaLabel={tr('settings.title')}
      panelClassName="flex h-[600px] max-h-[85vh] w-[860px] max-w-[92vw] overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      {/* 좌: 탭 레일 — 플러그인 카탈로그 모달과 같은 shared/ui/Rail 을 소비한다(0159 r5). */}
      <Rail title={tr('settings.title')}>
        {TABS.map((it) => (
          <div key={it.id}>
            <RailItem
              icon={it.icon}
              label={tr(it.labelKey)}
              active={tab === it.id}
              onClick={() => setTab(it.id)}
            />
            {/* 사용량 하위: 구성된 provider 서브항목(0080 항목 4). 각자의 한도/설정. */}
            {it.id === 'usage' &&
              providers.map((p) => {
                const pid = providerTabId(p.key)
                return (
                  <RailItem
                    key={p.key}
                    nested
                    label={providerLabel(p)}
                    active={tab === pid}
                    onClick={() => setTab(pid)}
                  />
                )
              })}
          </div>
        ))}
      </Rail>

      {/* 우: 내용 — 닫기는 Esc·백드롭 클릭 (X 아이콘 없음, 0121 사용자 피드백) */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {tab === 'general' && <GeneralTab />}
          {tab === 'usage' && <UsageTab />}
          {activeProvider && <ProviderUsageTab provider={activeProvider} />}
          {/* provider 탭인데 해당 provider 가 목록에 없으면(삭제됨) 안내. */}
          {activeProviderKey != null && !activeProvider && (
            <p className="text-[12.5px] text-ink3">{tr('settings.providerNotFound')}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
