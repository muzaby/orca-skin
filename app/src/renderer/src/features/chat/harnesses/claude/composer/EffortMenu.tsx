import { Icon } from '../../../../../shared/ui/Icon'
import { useI18n } from '../../../../../shared/i18n'
import type { EffortLevel } from '../../../../../../../shared/ipc'

import { EFFORT_LABEL_KEYS } from './effort'
import { MenuItem, MenuTitle } from '../../../../../shared/ui/MenuItem'

const EFFORT_OPTIONS: EffortLevel[] = ['low', 'medium', 'high', 'xhigh', 'max']

interface EffortMenuProps {
  effort: EffortLevel
  defaultEffort: EffortLevel
  onPick: (effort: EffortLevel) => void
}

export function EffortMenu({ effort, defaultEffort, onPick }: EffortMenuProps): React.JSX.Element {
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
            onClick={() => onPick(level)}
          >
            {/* 0257 D-013 — 수준별 설명 문구 없이 라벨(+추천 태그·체크)만 한 줄로 보인다. */}
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium text-ink">
              {tr(EFFORT_LABEL_KEYS[level])}
              {level === defaultEffort && (
                <span className="shrink-0 text-[11.5px] text-rust">
                  {tr('chat.composer.effort.recommendedTag')}
                </span>
              )}
              {active && <Icon name="check" size={12} />}
            </span>
          </MenuItem>
        )
      })}
    </div>
  )
}
