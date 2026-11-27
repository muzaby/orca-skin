import { CanonicalBackgroundContent } from './CanonicalBackgroundContent'
import { LegacySubAgentContent, LegacySubAgentHeader } from './LegacySubAgentTile'
import {
  backgroundCallTitle,
  backgroundPanelSelection,
  hasCanonicalBackground,
  projectBackgroundPanel
} from '../../../lib/canonicalBackground'
import { useBackgroundStore } from '../../../store/backgroundStore'
import { useSubagentDetail } from '../../common/rightpanel/panelNavigation'
import { useI18n } from '../../../../../shared/i18n'
import { useChatSession, useChatStore } from '../../../store/chatStore'

// 백그라운드 타일 — **어느 모델로 그릴지만 고른다**(0313). 정본 상태에 호출·작업이 있으면 정본
// 화면, 없거나 비어 있으면 구 모델 화면(`LegacySubAgentTile.tsx`)이다. 선택은 boolean 만 구독하므로
// 정본 상태가 갱신돼도 이 컴포넌트는 다시 그리지 않고, 정본으로 그릴 때는 구 모델의 구독·계산이
// 아예 올라오지 않는다.

// 타일 헤더 콘텐츠 — RightPanelTile 의 기본 라벨 span 을 대체한다(tileRegistry 주입).
export function SubAgentTileHeader(): React.JSX.Element {
  return useCanonicalBackgroundLayer() ? <CanonicalSubAgentHeader /> : <LegacySubAgentHeader />
}

function useCanonicalBackgroundLayer(): boolean {
  const sessionId = useChatSession((s) => s.sessionId)
  const detail = useSubagentDetail()
  return useBackgroundStore((s) => {
    if (detail?.backgroundKind) return true
    const view = sessionId ? s.sessions[sessionId] : undefined
    if (!view) return false
    return detail?.selectedId
      ? !!backgroundPanelSelection(view.state, detail)
      : hasCanonicalBackground(view.state)
  })
}

// 정본 헤더 — 선택한 작업·호출이 있으면 제목, 없으면 '백그라운드 작업'.
// 제목 폰트/톤은 기본 라벨과 일치.
function CanonicalSubAgentHeader(): React.JSX.Element {
  const { tr } = useI18n()
  const sessionId = useChatSession((s) => s.sessionId)
  const activeKey = useChatStore((s) => s.activeKey)
  const panel = useBackgroundStore((s) => s.panels[sessionId ?? activeKey])
  const canonical = useBackgroundStore((s) => (sessionId ? s.sessions[sessionId] : undefined))
  // 선택 컴포넌트가 정본일 때만 올린다. view 가 사라진 한 프레임에는 기본 제목으로 떨어진다.
  const detail = useSubagentDetail()
  const { selectedTask, selectedCall } = canonical
    ? projectBackgroundPanel(
        canonical.state,
        backgroundPanelSelection(canonical.state, detail),
        panel
      )
    : {}
  if (selectedTask || selectedCall) {
    const title = selectedTask
      ? selectedTask.description || selectedTask.taskType || selectedTask.taskId
      : backgroundCallTitle(selectedCall!)
    return (
      <div className="flex min-w-0 flex-1 items-center gap-g1">
        <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
          {title}
        </span>
      </div>
    )
  }
  return (
    <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
      {tr('chat.subagentTile.headerTitle')}
    </span>
  )
}

export function SubAgentTileContent(): React.JSX.Element {
  return useCanonicalBackgroundLayer() ? <CanonicalBackgroundContent /> : <LegacySubAgentContent />
}
