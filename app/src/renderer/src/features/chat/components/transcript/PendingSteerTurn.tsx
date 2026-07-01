import { memo } from 'react'
import { chatActions, type FlushedSteerState, type PendingSteerState } from '../../store/chatStore'

type SteerOverlayItem =
  | (PendingSteerState & { state: 'queued' })
  | (FlushedSteerState & { state: 'flushed' })

interface PendingSteerTurnProps {
  items: SteerOverlayItem[]
  onRestoreDraft?: (text: string) => void
}

export const PendingSteerTurn = memo(function PendingSteerTurn({
  items,
  onRestoreDraft
}: PendingSteerTurnProps): React.JSX.Element | null {
  if (items.length === 0) return null
  return (
    <div className="group/msg flex flex-col items-end gap-[var(--chat-item-gap)]">
      {items.map((item) => (
        <div key={item.id} className="flex max-w-[80%] items-start gap-2">
          {item.state === 'queued' && (
            <button
              type="button"
              className="mt-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-ink3 opacity-0 transition-opacity hover:bg-fill-uncontained-hover group-hover/msg:opacity-100"
              onClick={() => {
                const restored = chatActions.cancelSteer(item.id)
                if (restored) onRestoreDraft?.(restored)
              }}
            >
              취소
            </button>
          )}
          <div
            data-state={item.state === 'queued' ? 'pending-steer' : 'flushed-steer'}
            className={`whitespace-pre-wrap rounded-r6 bg-bubble-user px-p7 py-p5 text-body ${
              item.state === 'queued' ? 'italic text-ink3' : 'text-ink'
            }`}
          >
            {item.text}
          </div>
        </div>
      ))}
    </div>
  )
})
