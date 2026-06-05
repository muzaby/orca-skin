import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import type { NormalizedPermissionMode } from '../../../../../../shared/permission-mode'
import { MODE_OPTIONS } from './modes'

const MENU_ITEM =
  'flex w-full cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-left hover:bg-sidebar'

interface ModeMenuProps {
  mode: NormalizedPermissionMode
  onPick: (mode: NormalizedPermissionMode) => void
}

// Skill picker 와 동일한 Popover 콘텐츠 패턴. 현재 모드에 check 표시.
// 위험 모드(bypass/dont_ask — 승인 게이트 무력화)는 2-스텝 확인으로 가드: 첫 클릭은 경고를 띄우고,
// 같은 항목의 '확인'을 눌러야 실제 전환된다 (보안 베이스라인).
export function ModeMenu({ mode, onPick }: ModeMenuProps): React.JSX.Element {
  const [armed, setArmed] = useState<NormalizedPermissionMode | null>(null)

  return (
    <div role="none" className="flex w-[260px] flex-col">
      {MODE_OPTIONS.map((opt) => {
        const active = opt.mode === mode
        const isArmed = armed === opt.mode
        const handleClick = (): void => {
          if (opt.risky && !isArmed) {
            setArmed(opt.mode)
            return
          }
          setArmed(null)
          onPick(opt.mode)
        }
        return (
          <button
            key={opt.mode}
            type="button"
            role="menuitemradio"
            aria-checked={active}
            onClick={handleClick}
            className={MENU_ITEM}
          >
            <Icon name={opt.icon} size={13} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                {opt.label}
                {active && <Icon name="check" size={12} />}
                {opt.risky && <Icon name="alert" size={11} />}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
                {opt.description}
              </span>
              {isArmed && (
                <span className="mt-1 block text-[11.5px] font-medium leading-snug text-[var(--color-danger,#dc2626)]">
                  모든 승인 게이트가 해제됩니다. 한 번 더 눌러 확인하세요.
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
