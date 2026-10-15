import type { ReactNode } from 'react'
import { Icon, type IconName } from '../../../../../shared/ui/Icon'

export function PanelRow({
  icon,
  children,
  onClick,
  title,
  focusKey,
  disabled = false
}: {
  icon: IconName
  children: ReactNode
  onClick?: () => void
  title?: string
  focusKey?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-panel-focus={focusKey}
      disabled={disabled}
      className="flex w-full min-w-0 items-center gap-3 rounded-md py-2 text-left text-footnote text-oc-muted outline-none hover:bg-oc-layer-2 ring-focus disabled:opacity-40"
    >
      <Icon name={icon} size={16} className="shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  )
}

export function AgentAvatar({ index }: { index: number }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
        index % 3 === 0
          ? 'bg-oc-accent/15 text-oc-accent'
          : index % 3 === 1
            ? 'bg-oc-good/15 text-oc-good'
            : 'bg-oc-muted/15 text-oc-muted'
      }`}
    >
      <Icon name="sparkle" size={15} />
    </span>
  )
}
