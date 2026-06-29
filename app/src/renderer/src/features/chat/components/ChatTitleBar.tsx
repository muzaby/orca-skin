import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Icon } from '../../../shared/ui/Icon'
import { Popover } from '../../../shared/ui/Popover'
import { chatActions, getActiveChatSession, useChatSession } from '../store/chatStore'
import { partsText } from '../lib/parts'
import type { ChatState } from '../reducer/chatReducer'
import { defaultRightPanelTileLabel, type RightPanelTileId } from '../lib/rightPanelTiles'
import { flattenColumns } from '../lib/rightPanelLayout'
import { tileRegistry } from './rightpanel/tileRegistry'

// 타이틀바 아이콘 버튼 — 3-상태(idle/pressed/disabled)를 시맨틱 토큰으로 표현한다.
// pressed 는 press 표면 토큰(t3), idle hover 는 중립 ink 오버레이. (구 Button 의 warm
// fill-selected 대신 press 표면 토큰을 써 화이트/다크 모두에서 중립적으로 보이게 한다.)
const ICON_BTN_BASE =
  'grid h-7 w-7 place-items-center rounded-r4 border-0 outline-none hide-focus-ring ring-focus transition-colors'
const ICON_BTN_IDLE =
  'cursor-default bg-transparent text-t6 hover:bg-fill-uncontained-hover hover:text-t7'
const ICON_BTN_PRESSED = 'cursor-default bg-t3 text-t8'
// 비활성(준비 중) — 빗금 배경 + 클릭 차단. Sidebar 의 NAV_DISABLED_HATCH 와 동일한
// 테마 border 토큰 기반 사선 패턴(신규 CSS 없이 arbitrary value).
const ICON_BTN_DISABLED =
  'cursor-not-allowed bg-transparent text-t5 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,var(--color-border)_4px,var(--color-border)_5px)]'
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

// 채팅 타일 titlebar — 제목 + 우측 액션. selector 가 primitive 를 반환하므로
// 스트리밍 커밋(messages 교체)에도 제목 문자열이 같으면 재렌더되지 않는다.
export const ChatTitleBar = memo(function ChatTitleBar(): React.JSX.Element {
  const title = useChatSession(selectTitle)
  // 열 구조(stable ref)를 구독하고 평탄 뷰는 메모로 파생 — selector 가 새 배열을 반환하면
  // zustand Object.is 비교가 매번 깨져 불필요 재렌더가 난다.
  const tileColumns = useChatSession((s) => s.rightPanelTiles)
  const activeTiles = useMemo(() => flattenColumns(tileColumns), [tileColumns])
  const labels = useChatSession((s) => s.rightPanelTileLabels)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const target = activeTiles.at(-1)

  // 전체 대화를 마크다운으로 직렬화해 클립보드에 복사한다. text 파트만 추출(partsText)하므로
  // 도구 호출/첨부는 제외 — 사람이 읽을 대화 본문 위주.
  const copyConversation = useCallback(async (): Promise<void> => {
    const { messages } = getActiveChatSession()
    const text = messages
      .map((m) => {
        const body = partsText(m.parts).trim()
        if (!body) return ''
        return `## ${m.role === 'user' ? '사용자' : 'Claude'}\n\n${body}`
      })
      .filter(Boolean)
      .join('\n\n')
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* 클립보드 접근 거부 시 조용히 무시 */
    }
  }, [])

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
      </div>
      <div className="ml-auto flex gap-1">
        <button
          className={`${ICON_BTN_BASE} ${ICON_BTN_DISABLED}`}
          disabled
          title="검색 (준비 중)"
          aria-label="검색 (준비 중)"
        >
          <Icon name="search" size={14} />
        </button>
        <button
          className={`${ICON_BTN_BASE} ${ICON_BTN_IDLE}`}
          onClick={() => void copyConversation()}
          title={copied ? '복사됨' : '전체 대화 복사'}
          aria-label="전체 대화 복사"
        >
          <Icon name={copied ? 'check' : 'copy'} size={14} />
        </button>
        <button
          ref={anchorRef}
          className={`${ICON_BTN_BASE} ${open ? ICON_BTN_PRESSED : ICON_BTN_IDLE}`}
          onClick={() => setOpen((v) => !v)}
          aria-pressed={open}
          title="우측 패널 타일"
          aria-label="우측 패널 타일"
        >
          <Icon name="kebab" size={14} />
        </button>
        <Popover
          open={open}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
          placement="bottom"
          align="end"
          className="min-w-[200px]"
        >
          <div className="px-2 py-1 text-[11px] font-medium text-t6">타일 표시</div>
          {tileRegistry.map((tile) => {
            const active = activeTiles.includes(tile.id)
            return (
              <button
                key={tile.id}
                type="button"
                className={MENU_ITEM}
                onClick={() => {
                  chatActions.toggleRightPanelTile(tile.id)
                  setOpen(false)
                }}
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
