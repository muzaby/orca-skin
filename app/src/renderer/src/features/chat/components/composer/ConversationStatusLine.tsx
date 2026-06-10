import { forwardRef } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import type { StatusLineModel } from './statusViewModel'

interface ConversationStatusLineProps {
  model: StatusLineModel | null
  open: boolean
  onToggle: () => void
  popoverId: string
}

const TONE_CLASS: Record<StatusLineModel['state'], string> = {
  warn: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-bad/35 bg-bad/10 text-bad'
}

export const ConversationStatusLine = forwardRef<HTMLButtonElement, ConversationStatusLineProps>(
  function ConversationStatusLine({ model, open, onToggle, popoverId }, ref) {
    if (!model) return null

    return (
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        className={`mx-auto mb-2 flex max-w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-sm outline-none hide-focus-ring ring-focus transition hover:-translate-y-px hover:bg-fill-contained-hover focus-visible:ring-1 ${TONE_CLASS[model.state]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={popoverId}
        data-behavior="action:toggle-conversation-status"
      >
        <span className="flex h-2 w-2 rounded-full bg-current ring-4 ring-current/15" aria-hidden />
        <span className="text-ink">{model.labels.pill}</span>
        <span className="flex items-center gap-0.5 text-current">
          {model.labels.detail}
          <Icon name="chevU" size={11} />
        </span>
      </button>
    )
  }
)
