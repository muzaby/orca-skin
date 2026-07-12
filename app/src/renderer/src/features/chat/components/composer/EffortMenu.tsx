import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import type { EffortLevel } from '../../../../../../shared/ipc'

import { EFFORT_DESC_KEYS, EFFORT_LABEL_KEYS } from './effort'
import { MENU_ITEM } from './menuItem'

const EFFORT_OPTIONS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']

interface EffortMenuProps {
  effort: EffortLevel
  onPick: (effort: EffortLevel) => void
}

export function EffortMenu({ effort, onPick }: EffortMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <div role="none" className="flex w-[240px] flex-col">
      {EFFORT_OPTIONS.map((level) => {
        const active = level === effort
        return (
          <button
            key={level}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => onPick(level)}
            className={MENU_ITEM}
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
          </button>
        )
      })}
    </div>
  )
}
