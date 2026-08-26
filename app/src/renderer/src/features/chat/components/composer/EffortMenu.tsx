import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import type { EffortLevel } from '../../../../../../shared/ipc'

import { EFFORT_DESC_KEYS, EFFORT_LABEL_KEYS } from './effort'
import { MenuItem, MenuTitle } from '../../../../shared/ui/MenuItem'

const EFFORT_OPTIONS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']

interface EffortMenuProps {
  effort: EffortLevel
  onPick: (effort: EffortLevel) => void
}

export function EffortMenu({ effort, onPick }: EffortMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="none" className="flex w-[240px] flex-col">
      <MenuTitle>{tr('chat.composer.effort.title')}</MenuTitle>
      {EFFORT_OPTIONS.map((level) => {
        const active = level === effort
        return (
          <MenuItem
            key={level}
            role="menuitemradio"
            aria-checked={active}
            align="start"
            onClick={() => onPick(level)}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                {tr(EFFORT_LABEL_KEYS[level])}
                {active && <Icon name="check" size={12} />}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
                {tr(EFFORT_DESC_KEYS[level])}
              </span>
            </span>
          </MenuItem>
        )
      })}
    </div>
  )
}
