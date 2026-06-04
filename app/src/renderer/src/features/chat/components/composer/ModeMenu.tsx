import { Icon } from '../../../../shared/ui/Icon'
import type { PermissionMode } from '../../../../../../shared/ipc'
import { MODE_OPTIONS } from './modes'

const MENU_ITEM =
  'flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar'

interface ModeMenuProps {
  mode: PermissionMode
  onPick: (mode: PermissionMode) => void
}

// Skill picker 와 동일한 Popover 콘텐츠 패턴. 현재 모드에 check 표시.
export function ModeMenu({ mode, onPick }: ModeMenuProps): React.JSX.Element {
  return (
    <div role="none" className="flex w-[260px] flex-col">
      {MODE_OPTIONS.map((opt) => {
        const active = opt.mode === mode
        return (
          <button
            key={opt.mode}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={() => onPick(opt.mode)}
            className={MENU_ITEM}
          >
            <Icon name={opt.icon} size={13} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                {opt.label}
                {active && <Icon name="check" size={12} />}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
                {opt.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
