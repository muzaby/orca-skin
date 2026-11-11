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
  return (
    <StatusLine
      backend={backend}
      turnStartedAt={turnStartedAt ?? listenStartedAt}
      outputApproxFromText={text}
      activity={activity}
      prepareStep={prepareStep}
      onOpenBackground={() =>
        chatActions.setRightPanelTileActive(agentKind === 'work' ? 'task' : 'subagent', true)
      }
    />
  )
}
