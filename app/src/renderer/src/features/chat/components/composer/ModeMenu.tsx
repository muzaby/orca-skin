import { useState } from 'react'
import { Icon } from '../../../../shared/ui/Icon'
import { useI18n } from '../../../../shared/i18n'
import type { NormalizedPermissionMode } from '../../../../../../shared/permission-mode'
import { MODE_MENU_OPTIONS, type ModeOption } from './modes'
import { MenuItem, MenuTitle } from '../../../../shared/ui/MenuItem'

interface ModeMenuProps {
  mode: NormalizedPermissionMode
  // 이 세션의 선택 모델에서 고를 수 있는 항목. 미전달이면 제약 없는 기본 목록(0215).
  options?: ModeOption[]
  onPick: (mode: NormalizedPermissionMode) => void
}

// 모드 목록 — 라벨(+설명) 좌측, 현재 모드 체크는 우측. 좌측 글리프는 두지 않는다.
// 위험 모드(승인 게이트 무력화)는 2-스텝 확인으로 가드: 첫 클릭은 경고를 띄우고,
// 같은 항목의 '확인'을 눌러야 실제 전환된다 (보안 베이스라인).
export function ModeMenu({ mode, options, onPick }: ModeMenuProps): React.JSX.Element {
  const { tr } = useI18n()
  const [armed, setArmed] = useState<NormalizedPermissionMode | null>(null)

  return (
    <div role="none" className="flex w-[260px] flex-col">
      <MenuTitle>{tr('chat.composer.modes.title')}</MenuTitle>
      {(options ?? MODE_MENU_OPTIONS).map((opt) => {
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
          <MenuItem
            key={opt.mode}
            role="menuitemradio"
            aria-checked={active}
            align="start"
            onClick={handleClick}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-ink">{tr(opt.labelKey)}</span>
              {opt.descKey && (
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink2">
                  {tr(opt.descKey)}
                </span>
              )}
              {isArmed && (
                <span className="mt-1 block text-[11.5px] font-medium leading-snug text-[var(--color-danger,#dc2626)]">
                  {tr('chat.composer.modes.riskyConfirm')}
                </span>
              )}
            </span>
            {active && <Icon name="check" size={12} className="mt-1 shrink-0" />}
          </MenuItem>
        )
      })}
    </div>
  )
}
