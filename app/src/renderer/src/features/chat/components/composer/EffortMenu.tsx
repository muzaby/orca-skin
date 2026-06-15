import { Icon } from '../../../../shared/ui/Icon'
import type { EffortLevel } from '../../../../../../shared/ipc'

import { EFFORT_LABELS } from './effort'

const EFFORT_DESCRIPTIONS: Record<EffortLevel, string> = {
  low: '빠른 응답을 우선합니다.',
  medium: '속도와 사고 깊이를 균형 있게 사용합니다.',
  high: '기본값. 충분한 사고 깊이로 작업합니다.',
  xhigh: '복잡한 작업에 더 깊게 사고합니다.',
  max: '가장 깊은 사고 예산을 사용합니다.'
}

const EFFORT_OPTIONS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']
const MENU_ITEM =
  'flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar'

interface EffortMenuProps {
  effort: EffortLevel
  onPick: (effort: EffortLevel) => void
}

export function EffortMenu({ effort, onPick }: EffortMenuProps): React.JSX.Element {
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
                {EFFORT_LABELS[level]}
                {active && <Icon name="check" size={12} />}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
                {EFFORT_DESCRIPTIONS[level]}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
