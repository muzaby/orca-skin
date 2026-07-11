import { StreamingMarkdown } from '../markdown/StreamingMarkdown'
import { ReasoningBlock } from './ReasoningBlock'
import { StatusLine } from '../StatusLine'
import { useChatSession, useLiveReasoning, useLiveText } from '../../store/chatStore'
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
  const text = useLiveText()
  return <StatusLine turnStartedAt={turnStartedAt} outputApproxFromText={text} />
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
