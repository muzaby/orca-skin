import { useMemo } from 'react'
import { StatusLine } from '../StatusLine'
import { chatActions, useChatActivity, useChatSession, useLiveText } from '../../store/chatStore'
export function PendingAssistantStatus(): React.JSX.Element {
  const backend = useChatSession((s) => s.backend)
  const agentKind = useChatSession((s) => s.agentKind)
  const turnStartedAt = useChatSession((s) => s.turnStartedAt)
  // 0143 listen 대기 — 개별 알림 턴 종료가 turnStartedAt 을 비워도(TURN_END_RESET) listening
  // 구간의 앵커(listenStartedAt)로 폴백해 StatusLine 애니메이션이 끊기지 않는다.
  const listenStartedAt = useChatSession((s) => s.listenStartedAt)
  const activity = useChatActivity()
  const prepareStep = useChatSession((s) => s.worktreePrepareStep)
  const text = useLiveText()
  // 활동 값이 같으면 같은 객체를 유지해 상태 줄의 파생·번역을 실제 변화에만 묶는다.
  const activityView = useMemo(
    () => ({
      foreground: activity.activityForeground,
      queuedCount: activity.activityQueuedCount,
      deliveryPendingCount: activity.activityDeliveryPendingCount,
      residualCount: activity.activityResidualCount,
      backgroundTaskCount: activity.activityBackgroundTaskCount,
      sessionSchedules: activity.sessionSchedules,
      pendingSessionWakeup: activity.pendingSessionWakeup,
      listening: activity.listening
    }),
    [
      activity.activityForeground,
      activity.activityQueuedCount,
      activity.activityDeliveryPendingCount,
      activity.activityResidualCount,
      activity.activityBackgroundTaskCount,
      activity.sessionSchedules,
      activity.pendingSessionWakeup,
      activity.listening
    ]
  )
  return (
    <StatusLine
      backend={backend}
      turnStartedAt={turnStartedAt ?? listenStartedAt}
      outputApproxFromText={text}
      activity={activityView}
      prepareStep={prepareStep}
      onOpenBackground={() =>
        chatActions.setRightPanelTileActive(agentKind === 'work' ? 'task' : 'subagent', true)
      }
    />
  )
}
