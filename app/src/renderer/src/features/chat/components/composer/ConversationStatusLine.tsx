import { forwardRef } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
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
    const { tr } = useI18n()
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
        {/* 경고등 펄스(0122) — 톤 currentColor 를 따라 warn=노랑/danger=빨강.
            reduced-motion 에선 animation 이 꺼져 정적 ring-4 halo 로 폴백한다. */}
        <span
          className="flex h-2 w-2 rounded-full bg-current ring-4 ring-current/15 animate-status-beacon"
          aria-hidden
        />
        <span className="text-ink">{tr(model.labelKeys.pill)}</span>
        <span className="flex items-center gap-0.5 text-current">
          {tr(model.labelKeys.detail)}
          <Icon name="chevU" size={11} />
        </span>
      </button>
    )
  }
)
