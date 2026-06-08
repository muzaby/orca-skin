import { Markdown } from '../markdown/Markdown'
import { ReasoningBlock } from './ReasoningBlock'
import { StatusLine } from '../../../../shared/ui/StatusLine'

interface PendingAssistantProps {
  turnStartedAt: number | null
  pendingDelta: string
  pendingReasoning: string
}

export function PendingAssistant({
  turnStartedAt,
  pendingDelta,
  pendingReasoning
}: PendingAssistantProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      {pendingReasoning && <ReasoningBlock items={[{ text: pendingReasoning }]} defaultOpen />}
      {pendingDelta && <Markdown source={pendingDelta} />}
      <StatusLine turnStartedAt={turnStartedAt} outputApproxFromText={pendingDelta} />
    </div>
  )
}
