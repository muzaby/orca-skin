import type { RefObject } from 'react'
import type { GitDirtyResolution } from '../../../../../../shared/ipc'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { MenuItem } from '../../../../shared/ui/MenuItem'
import { Popover } from '../../../../shared/ui/Popover'

export interface DirtyActionOption {
  value: GitDirtyResolution
  label: string
}

interface BranchSwitchActionsProps {
  options: readonly DirtyActionOption[]
  resolution: GitDirtyResolution
  menuOpen: boolean
  busy: boolean
  cancelLabel: string
  menuAriaLabel: string
  menuButtonRef: RefObject<HTMLButtonElement | null>
  onCancel: () => void
  onSelect: (resolution: GitDirtyResolution) => void
  onToggleMenu: () => void
  onCloseMenu: () => void
  onConfirm: (resolution: GitDirtyResolution) => void
}

// 더티 트리 모달의 분할 버튼 — **훅을 쓰지 않는다**. 상태(선택된 방식·메뉴 열림)는 부모가
// 들고 여기는 배선만 한다. 훅이 없으므로 렌더 하네스 없이도 이 함수를 그대로 불러
// 반환된 엘리먼트 트리에서 "무엇이 무엇에 연결됐는가" 를 확인할 수 있다.
//
// **메뉴는 선택만 바꾸고 실행은 왼쪽 버튼이다**(D-004). 메뉴 항목의 onClick 에는 `onConfirm`
// 이 닿지 않는다 — `변경 사항 취소` 가 한 번의 오클릭으로 날아가지 않게 하는 것이 이 분리의
// 목적이므로, 두 핸들러를 한 곳에서 합치지 말 것.
export function BranchSwitchActions({
  options,
  resolution,
  menuOpen,
  busy,
  cancelLabel,
  menuAriaLabel,
  menuButtonRef,
  onCancel,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onConfirm
}: BranchSwitchActionsProps): React.JSX.Element {
  const activeLabel = options.find((option) => option.value === resolution)?.label ?? ''

  return (
    <div className="flex w-full items-center justify-between">
      <Button variant="contained" size="small" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </Button>
      {/* 분할 버튼 — 왼쪽이 현재 선택된 처리 방식의 실행, 오른쪽 chevron 이 방식 선택. */}
      <div className="flex items-stretch">
        <Button
          variant="contained"
          size="small"
          busy={busy}
          data-action="dirty-confirm"
          onClick={() => onConfirm(resolution)}
          className="rounded-r-none"
        >
          {activeLabel}
        </Button>
        <Button
          ref={menuButtonRef}
          variant="contained"
          size="small"
          iconOnly
          leadingIcon="chevD"
          disabled={busy}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={menuAriaLabel}
          onClick={onToggleMenu}
          className="-ml-px rounded-l-none"
        />
      </div>
      <Popover open={menuOpen} anchorRef={menuButtonRef} onClose={onCloseMenu} align="end">
        <div role="none" className="flex w-[200px] flex-col">
          {options.map((option) => (
            <MenuItem
              key={option.value}
              role="menuitemradio"
              aria-checked={option.value === resolution}
              // 선택만 바꾼다 — 실행은 위 왼쪽 버튼에만 있다.
              onClick={() => onSelect(option.value)}
            >
              <span className="min-w-0 flex-1">{option.label}</span>
              {option.value === resolution && <Icon name="check" size={12} className="shrink-0" />}
            </MenuItem>
          ))}
        </div>
      </Popover>
    </div>
  )
}
