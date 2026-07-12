import type { ProviderDescriptor } from '../../../../../shared/ipc'
import { Avatar } from '../../../shared/ui/Avatar'
import { Dot } from '../../../shared/ui/Status'
import { Icon } from '../../../shared/ui/Icon'
import { useI18n, type MessageKey } from '../../../shared/i18n'
import {
  useBackendCapabilities,
  useBackendLabel,
  useClaudeCodeInstalled
} from '../store/backendStore'

// Sidebar 의 footer 슬롯에 주입되는 도메인 컴포넌트. 이름은 *위치* (footer) 가
// 아닌 *역할* (현재 활성 백엔드 정보 표시) 기준. backendStore 자체 구독.
export function BackendStatus(): React.JSX.Element {
  const { tr } = useI18n()
  const backendLabel = useBackendLabel()
  const claudeInstalled = useClaudeCodeInstalled()
  const capabilities = useBackendCapabilities()
  // 활성 백엔드 지원 기능의 사람-가시 지표(§15 게이팅 데이터의 소비자). 능력 서술자가 true 인
  // 라이프사이클 기능만 칩으로 노출 — UI 가 무엇을 사전 게이팅하는지 디버깅·관찰용.
  const supported = capabilities
    ? supportedSessionFeatureKeys(capabilities).map((key) => tr(key))
    : []
  return (
    <>
      <Avatar kind="claude" size={24} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-ink">{backendLabel}</div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink3">
          <Dot tone={claudeInstalled ? 'green' : 'amber'} />
          {claudeInstalled ? tr('backend.installed') : tr('backend.notInstalled')}
        </div>
        {supported.length > 0 && (
          <div
            className="mt-0.5 truncate text-[10px] text-ink3"
            title={tr('backend.supportedTitle', { list: supported.join(', ') })}
          >
            {supported.join(' · ')}
          </div>
        )}
      </div>
      <button className="h-[26px] w-[26px] cursor-pointer rounded-md border-0 bg-transparent text-ink3">
        <Icon name="settings" size={14} />
      </button>
    </>
  )
}

// 능력 서술자의 session 플래그 중 true 인 것만 카탈로그 키로. 라벨 해석은 렌더의 tr() 몫(0097).
function supportedSessionFeatureKeys(cap: ProviderDescriptor): MessageKey[] {
  const labels: [keyof ProviderDescriptor['session'], MessageKey][] = [
    ['continue', 'backend.capability.continue'],
    ['resume', 'backend.capability.resume'],
    ['fork', 'backend.capability.fork'],
    ['abort', 'backend.capability.abort'],
    ['structuredOutput', 'backend.capability.structuredOutput']
  ]
  return labels.filter(([key]) => cap.session[key]).map(([, labelKey]) => labelKey)
}
