import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { Popover } from '../../../../shared/ui/Popover'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { RightPanelTileId } from '../../lib/rightPanelTiles'

interface RightPanelTileProps {
  id: RightPanelTileId
  defaultLabel: string
  children: ReactNode
  className?: string
}

const MENU_ITEM =
  'flex w-full cursor-default items-center gap-2 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-footnote text-t8 outline-none hide-focus-ring ring-focus hover:bg-fill-uncontained-hover'

export function RightPanelTile({
  id,
  defaultLabel,
  children,
  className = ''
}: RightPanelTileProps): React.JSX.Element {
  const label = useChatSession((s) => s.rightPanelTileLabels[id] ?? defaultLabel)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const rename = useCallback((): void => {
    setOpen(false)
    const next = window.prompt('타일 이름 변경', label)
    if (next !== null) chatActions.renameRightPanelTile(id, next)
  }, [id, label])

  const resetName = useCallback((): void => {
    setOpen(false)
    chatActions.renameRightPanelTile(id, '')
  }, [id])

  const remove = useCallback((): void => {
    setOpen(false)
    chatActions.removeRightPanelTile(id)
  }, [id])

  return (
    <div
      className={`app-frame-tile effect-primary-elevated flex min-h-0 flex-1 flex-col overflow-hidden rounded-r6 border border-border bg-panel ${className}`}
      data-context={id}
    >
      <div className="app-frame-tile-header flex items-center gap-2 border-b border-t5 px-4 pb-2.5 pt-3.5">
        <span className="min-w-0 truncate font-serif text-[15px] font-semibold tracking-tight text-t9">
          {label}
        </span>
        <div className="ml-auto flex items-center gap-g2">
          <Button
            ref={anchorRef}
            iconOnly
            size="small"
            leadingIcon="kebab"
            onClick={() => setOpen((v) => !v)}
            title={`${label} 메뉴`}
            aria-label={`${label} 메뉴`}
          />
          <Popover
            open={open}
            anchorRef={anchorRef}
            onClose={() => setOpen(false)}
            placement="bottom"
            align="end"
            className="min-w-[180px]"
          >
            <button type="button" className={MENU_ITEM} onClick={remove} role="menuitem">
              <Icon name="x" size={13} /> 비활성화
            </button>
            <button type="button" className={MENU_ITEM} onClick={rename} role="menuitem">
              <Icon name="edit" size={13} /> 이름 변경
            </button>
            <button type="button" className={MENU_ITEM} onClick={resetName} role="menuitem">
              <Icon name="refresh" size={13} /> 기본 이름
            </button>
            <div className="my-1 h-px bg-border" />
            <button type="button" className={MENU_ITEM} onClick={remove} role="menuitem">
              <Icon name="trash" size={13} /> 삭제
            </button>
          </Popover>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
