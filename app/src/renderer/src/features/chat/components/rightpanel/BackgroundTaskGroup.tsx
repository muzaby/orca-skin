import type { ReactNode } from 'react'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import type { BackgroundGroup } from '../../store/backgroundStore'

export function BackgroundTaskGroup({
  group,
  count,
  collapsed,
  onToggle,
  onClear,
  children
}: {
  group: BackgroundGroup
  count: number
  collapsed: boolean
  onToggle: () => void
  onClear?: () => void
  children: ReactNode
}): React.JSX.Element | null {
  const { tr } = useI18n()
  if (!count) return null
  return (
    <section data-background-group={group}>
      <div className="mb-g3 mt-g1 flex items-center justify-between gap-g2 text-footnote text-t6">
        <button
          type="button"
          className="flex min-w-0 items-center gap-g2 rounded-r3 px-p2 py-g1 hover:text-t9 focus:outline-none hide-focus-ring ring-focus"
          aria-expanded={!collapsed}
          data-background-group-toggle={group}
          onClick={onToggle}
        >
          <Icon name={collapsed ? 'chevR' : 'chevD'} size={14} />
          <span>
            {tr(group === 'running' ? 'background.groupRunning' : 'background.groupCompleted')}
          </span>
          <span>{count}</span>
        </button>
        {group === 'completed' && onClear && (
          <Button
            iconOnly
            size="small"
            leadingIcon="trash"
            aria-label={tr('background.clearCompleted')}
            data-background-clear="completed"
            onClick={onClear}
          />
        )}
      </div>
      {!collapsed && <div className="flex flex-col gap-g3">{children}</div>}
    </section>
  )
}
