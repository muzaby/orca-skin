import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../../../shared/i18n'
import { Popover } from '../../../../../shared/ui/Popover'
import { ConversationStatusLine } from './ConversationStatusLine'
import { StatusPopover } from './StatusPopover'
import { conversationStatusModel as conversationStatusModelFactory } from './statusViewModel'
import type { ConversationStatus } from './statusCopy'
import { contextTokens } from '../../../lib/telemetry'
import { contextWindowOf, nearCompaction } from '../../../lib/contextWindow'
import { chatActions, useChatBusy, useChatSession } from '../../../store/chatStore'
export function ClaudeConversationStatus({
  onHandoffStarted
}: {
  onHandoffStarted: () => void
}): React.JSX.Element {
  const { tr } = useI18n()
  const leaseBusy = useChatBusy()
  const sessionId = useChatSession((s) => s.sessionId)
  const userTurnCount = useChatSession((s) =>
    s.messages.reduce((n, m) => (m.role === 'user' ? n + 1 : n), 0)
  )
  const lastTelemetry = useChatSession((s) => s.lastTelemetry)
  const sessionCostUsd = useChatSession((s) => s.sessionCostUsd)
  const conversationStatusButtonRef = useRef<HTMLButtonElement>(null)
  const [conversationStatusOpen, setConversationStatusOpen] = useState(false)
  const conversationStatusPopoverId = 'conversation-status-popover'
  const conversationStatusModel = useMemo(() => {
    // TODO(후속 핸드오프): 정식 상태 판정 신호로 교체 — 현재는 임시 근사
    let conversationStatus: ConversationStatus = 'safe'
    let usage: { tokens: number; window: number } | undefined
    if (lastTelemetry) {
      const tokens = contextTokens(lastTelemetry)
      const window = contextWindowOf(lastTelemetry)
      const ratio = tokens / window
      usage = { tokens, window }
      if (nearCompaction(tokens, window) || ratio >= 0.85) {
        conversationStatus = 'danger'
      } else if (ratio >= 0.6) {
        conversationStatus = 'warn'
      }
    }
    return conversationStatusModelFactory(conversationStatus, usage, sessionCostUsd)
  }, [lastTelemetry, sessionCostUsd])

  const toggleConversationStatus = (): void => {
    if (!conversationStatusModel) return
    setConversationStatusOpen((v) => !v)
  }

  // warn 단계 권장 액션(0064 r2, 사용자 확정) — 현재 세션에 `/compact` 를 사용자 턴으로
  // 전송한다. SDK 네이티브 압축이 돌고 완료 시 session.compacted → 압축 경계 구분선 표시.
  const onCompact = (): void => {
    if (chatActions.send('/compact')) setConversationStatusOpen(false)
  }

  // 0064 handoff — 가드 3종: 확정 세션(sessionId) · mid-turn 거부(inflight) · 사용자 턴 2회
  // 미만 제외. 클릭 = 즉시 물질화(startHandoff, 재클릭은 activeKey 전환으로 자연 차단).
  const handoffDisabledReason =
    sessionId == null
      ? tr('chat.composer.handoffNoSession')
      : leaseBusy
        ? tr('chat.composer.handoffWaitTurn')
        : userTurnCount < 2
          ? tr('chat.composer.handoffNeedMoreTurns')
          : null
  const onHandoff = (): void => {
    if (handoffDisabledReason != null) return
    if (chatActions.startHandoff()) {
      setConversationStatusOpen(false)
      onHandoffStarted()
    }
  }

  return (
    <>
      {' '}
      {
        <ConversationStatusLine
          ref={conversationStatusButtonRef}
          model={conversationStatusModel}
          open={conversationStatusOpen}
          onToggle={toggleConversationStatus}
          popoverId={conversationStatusPopoverId}
        />
      }
      {conversationStatusModel && (
        <Popover
          open={conversationStatusOpen}
          anchorRef={conversationStatusButtonRef}
          onClose={() => setConversationStatusOpen(false)}
          placement="top"
          align="center"
          className="p-0"
        >
          <StatusPopover
            id={conversationStatusPopoverId}
            model={conversationStatusModel}
            onCompact={onCompact}
            onHandoff={onHandoff}
            handoffDisabledReason={handoffDisabledReason}
          />
        </Popover>
      )}
    </>
  )
}
