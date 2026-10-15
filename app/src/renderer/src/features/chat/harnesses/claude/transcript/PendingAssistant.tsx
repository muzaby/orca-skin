import { StreamingMarkdown } from '../../../components/markdown/StreamingMarkdown'
import { PendingAssistantStatus } from '../../../components/transcript/PendingAssistantStatus'
import { useLiveText, useLiveReasoning, useChatSession } from '../../../store/chatStore'
import { useI18n } from '../../../../../shared/i18n'
import { errorCategoryKey } from '../../../lib/errorLabels'
import { ReasoningBlock } from './ReasoningBlock'
import { surfaces } from '../surfaces'

// 라이브 델타 구독을 리프에 유지해 정적 셸과 이미 확정된 transcript를 재렌더하지 않는다.
function LiveText(): React.JSX.Element | null {
  const text = useLiveText()
  return text === '' ? null : <StreamingMarkdown source={text} />
}

function LiveReasoning(): React.JSX.Element | null {
  const text = useLiveReasoning()
  return text === '' ? null : <ReasoningBlock items={[{ text }]} defaultOpen streaming />
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

export function PendingAssistant({
  showStatus = true
}: {
  showStatus?: boolean
}): React.JSX.Element {
  return (
    <div
      className={`flex flex-col gap-2.5 text-[calc(14px*var(--transcript-text-scale,1))] ${surfaces.message}`}
    >
      <LiveReasoning />
      <LiveText />
      <RetryStatus />
      {showStatus && <PendingAssistantStatus />}
    </div>
  )
}
