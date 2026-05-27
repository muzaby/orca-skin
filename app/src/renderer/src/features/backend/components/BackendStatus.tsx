import { Avatar } from '../../../shared/ui/Avatar'
import { Dot } from '../../../shared/ui/Status'
import { Icon } from '../../../shared/ui/Icon'
import { useBackendContext } from '../../../app/providers/BackendProvider'

// Sidebar 의 footer 슬롯에 주입되는 도메인 컴포넌트. 이름은 *위치* (footer) 가
// 아닌 *역할* (현재 활성 백엔드 정보 표시) 기준. BackendContext 자체 구독.
export function BackendStatus(): React.JSX.Element {
  const { backendLabel, claudeCodeInstalled } = useBackendContext()
  return (
    <>
      <Avatar kind="claude" size={24} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-ink">{backendLabel}</div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink3">
          <Dot tone={claudeCodeInstalled ? 'green' : 'amber'} />
          {claudeCodeInstalled ? '설치됨' : '설치 필요'}
        </div>
      </div>
      <button className="h-[26px] w-[26px] cursor-pointer rounded-md border-0 bg-transparent text-ink3">
        <Icon name="settings" size={14} />
      </button>
    </>
  )
}
