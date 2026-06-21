import { memo, useCallback, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Button } from '../../../shared/ui/Button'
import { Dot } from '../../../shared/ui/Status'
import { Popover } from '../../../shared/ui/Popover'
import { chatActions, useChatSession } from '../store/chatStore'
import { partsText } from '../lib/parts'
import type { ChatState } from '../reducer/chatReducer'
import { defaultRightPanelTileLabel, type RightPanelTileId } from '../lib/rightPanelTiles'
import { tileRegistry } from './rightpanel/tileRegistry'

const ICON_BTN =
  'grid h-7 w-7 cursor-default place-items-center rounded-r4 border-0 bg-transparent text-t6 outline-none hide-focus-ring ring-focus transition-colors hover:bg-fill-uncontained-hover hover:text-t7'
const MENU_ITEM =
  'flex w-full cursor-default items-center gap-2 rounded-r4 border-0 bg-transparent px-2.5 py-1.5 text-left text-footnote text-t8 outline-none hide-focus-ring ring-focus hover:bg-fill-uncontained-hover disabled:opacity-50'

// 사이드바 메타 (state.title) 가 즉시 채워지므로 사용자가 세션을 선택한 순간부터
// 헤더에 정확한 제목 표시. 메타가 없는 부팅 자동 복원 1회만 첫 user 메시지에서 fallback.
function selectTitle(s: ChatState): string {
  const meta = s.title?.trim()
  if (meta) return meta
  const u = s.messages.find((m) => m.role === 'user')
  return (u && partsText(u.parts).slice(0, 60)) || '새 대화'
}

// 채팅 타일 titlebar — 제목·백엔드·세션 ID·우측 액션. selector 가 primitive 를 반환하므로
// 스트리밍 커밋(messages 교체)에도 제목 문자열이 같으면 재렌더되지 않는다.
export const ChatTitleBar = memo(function ChatTitleBar({
  backendLabel
}: {
  backendLabel: string
}): React.JSX.Element {
  const title = useChatSession(selectTitle)
  const sessionId = useChatSession((s) => s.sessionId)
  const activeTiles = useChatSession((s) => s.rightPanelTiles)
  const labels = useChatSession((s) => s.rightPanelTileLabels)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const target = activeTiles.at(-1)

  const renameTarget = useCallback((): void => {
    if (!target) return
    setOpen(false)
    const current = labels[target] ?? defaultRightPanelTileLabel(target)
    const next = window.prompt('타일 이름 변경', current)
    if (next !== null) chatActions.renameRightPanelTile(target, next)
  }, [labels, target])

  const removeTarget = useCallback((): void => {
    if (!target) return
    setOpen(false)
    chatActions.removeRightPanelTile(target)
  }, [target])

  return (
    <div className="app-frame-titlebar flex items-center gap-3 px-6 pb-2 pt-3">
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink">
          {title}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink3">
          <span className="inline-flex items-center gap-1">
            <Dot tone="green" /> {backendLabel}
          </span>
          {sessionId && (
            <>
              <span>·</span>
              <span className="font-mono text-[10.5px]">{sessionId.slice(0, 8)}</span>
            </>
          )}
        </div>
      </div>
      <div className="ml-auto flex gap-1">
        <button className={ICON_BTN} title="검색">
          <Icon name="search" size={14} />
        </button>
        <button className={ICON_BTN} title="복사">
          <Icon name="copy" size={14} />
        </button>
        <button className={ICON_BTN} title="설정">
          <Icon name="settings" size={14} />
        </button>
        <Button
          ref={anchorRef}
          iconOnly
          size="small"
          leadingIcon="kebab"
          onClick={() => setOpen((v) => !v)}
          pressed={open || activeTiles.length > 0}
          title="우측 패널 타일"
          aria-label="우측 패널 타일"
        />
        <Popover
          open={open}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
          placement="bottom"
          align="end"
        >
          <div className="px-2 py-1 text-[11px] font-medium text-t6">타일 표시</div>
          {tileRegistry.map((tile) => {
            const active = activeTiles.includes(tile.id)
            return (
              <button
                key={tile.id}
                type="button"
                className={MENU_ITEM}
                onClick={() => chatActions.toggleRightPanelTile(tile.id)}
                role="menuitemcheckbox"
                aria-checked={active}
              >
                <Icon name={active ? 'check' : 'plus'} size={13} />
                <span>{labels[tile.id as RightPanelTileId] ?? tile.defaultLabel}</span>
              </button>
            )
          })}
          <div className="my-1 h-px bg-border" />
          <button type="button" className={MENU_ITEM} onClick={renameTarget} disabled={!target}>
            <Icon name="edit" size={13} /> 이름 변경
          </button>
          <button type="button" className={MENU_ITEM} onClick={removeTarget} disabled={!target}>
            <Icon name="trash" size={13} /> 삭제
          </button>
        </Popover>
      </div>
    </div>
  )
})
