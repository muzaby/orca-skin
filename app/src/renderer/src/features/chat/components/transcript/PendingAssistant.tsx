import { useMemo } from 'react'
import { StreamingMarkdown } from '../markdown/StreamingMarkdown'
import { ReasoningBlock } from './ReasoningBlock'
import { StatusLine } from '../StatusLine'
import {
  useChatActivity,
  useChatSession,
  useLiveReasoning,
  useLiveText
} from '../../store/chatStore'
import { useI18n } from '../../../../shared/i18n'
import { errorCategoryKey } from '../../lib/errorLabels'

// 진행 중 턴의 라이브 표면 — 셸은 정적이고, 스트림 종류별 리프가 store 의 live 슬라이스를
// 직접 구독해 델타 프레임의 재렌더를 자기 자신으로 한정한다 (0008):
//   · text 델타      → LiveText(꼬리 블록만 재파스) + LiveStatus(토큰 근사)
//   · reasoning 델타 → LiveReasoning (streaming — 확정 블록 memo, 꼬리만 재파스)
// transcript(커밋 메시지)·Composer·셸은 어느 델타에도 재렌더되지 않는다.
export function PendingAssistant(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      <LiveReasoning />
      <LiveText />
      <RetryStatus />
      <LiveStatus />
    </div>
  )
}

function LiveReasoning(): React.JSX.Element | null {
  const reasoning = useLiveReasoning()
  if (reasoning === '') return null
  return <ReasoningBlock items={[{ text: reasoning }]} defaultOpen streaming />
}

function LiveText(): React.JSX.Element | null {
  const text = useLiveText()
  if (text === '') return null
  return <StreamingMarkdown source={text} />
}

function LiveStatus(): React.JSX.Element {
  const turnStartedAt = useChatSession((s) => s.turnStartedAt)
  // 0143 listen 대기 — 개별 알림 턴 종료가 turnStartedAt 을 비워도(TURN_END_RESET) listening
  // 구간의 앵커(listenStartedAt)로 폴백해 StatusLine 애니메이션이 끊기지 않는다.
  const listenStartedAt = useChatSession((s) => s.listenStartedAt)
  const activity = useChatActivity()
  const prepareStep = useChatSession((s) => s.worktreePrepareStep)
  const text = useLiveText()
  // StatusLine 은 심볼 애니메이션 때문에 200ms 마다 다시 그려진다. 여기서 매번 새 객체를 만들면
  // 그 아래 라벨 파생·번역이 값이 그대로인데도 5회/초로 다시 돈다 — 값이 같으면 **같은 객체**를
  // 유지해 파생을 실제 변화에만 묶는다.
  const activityView = useMemo(
    () => ({
      foreground: activity.activityForeground,
      queuedCount: activity.activityQueuedCount,
      deliveryPendingCount: activity.activityDeliveryPendingCount,
      residualCount: activity.activityResidualCount,
      backgroundTaskCount: activity.activityBackgroundTaskCount,
      listening: activity.listening
    }),
    [
      activity.activityForeground,
      activity.activityQueuedCount,
      activity.activityDeliveryPendingCount,
      activity.activityResidualCount,
      activity.activityBackgroundTaskCount,
      activity.listening
    ]
  )
  return (
    <StatusLine
      turnStartedAt={turnStartedAt ?? listenStartedAt}
      outputApproxFromText={text}
      activity={activityView}
      prepareStep={prepareStep}
    />
  )
}

function RetryStatus(): React.JSX.Element | null {
  const { tr } = useI18n()
  const retry = useChatSession((s) => s.retry)
  if (!retry) return null
  const categoryKey = errorCategoryKey(retry.category)
  return (
    <div className="text-caption font-medium text-bad">
      {tr('errors.retrying', { attempt: retry.attempt, max: retry.max })} ·{' '}
      {categoryKey ? tr(categoryKey) : retry.category}
    </div>
  )
}
