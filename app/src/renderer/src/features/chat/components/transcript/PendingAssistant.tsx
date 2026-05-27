import { Markdown } from '../markdown/Markdown'
import { StatusLine } from '../../../../shared/ui/StatusLine'

interface PendingAssistantProps {
  turnStartedAt: number | null
  pendingDelta: string
}

export function PendingAssistant({
  turnStartedAt,
  pendingDelta
}: PendingAssistantProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 text-[14px] leading-[1.7] text-ink">
      {pendingDelta && <Markdown source={pendingDelta} />}
      <StatusLine turnStartedAt={turnStartedAt} outputApproxFromText={pendingDelta} />
    </div>
  )
}
