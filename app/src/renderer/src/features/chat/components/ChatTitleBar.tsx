import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Button } from '../../../shared/ui/Button'
import { MenuItem } from '../../../shared/ui/MenuItem'
import { Popover } from '../../../shared/ui/Popover'
import { RenameInput } from '../../../shared/ui/RenameInput'
import { openConfirmDialog } from '../../../shared/ui/confirmDialogStore'
import { useI18n } from '../../../shared/i18n'
import { chatActions, getActiveChatSession, useChatSession } from '../store/chatStore'
import { partsText } from '../lib/parts'
import type { ChatState } from '../reducer/chatReducer'
import type { RightPanelTileId } from '../lib/rightPanelTiles'
import { flattenColumns } from '../lib/rightPanelLayout'
import { tileRegistry } from './rightpanel/tileRegistry'
import { CwdButton } from './CwdButton'

// 예약 타일(reserved1/2)은 Future Scope — 메뉴에서 숨긴다. tileRegistry 는 모듈 상수라
// 결과가 불변이므로 모듈 로드 시 1회만 계산한다(인스턴스별 useMemo 불필요).
const VISIBLE_TILE_REGISTRY = tileRegistry.filter(
  (tile) => tile.id !== 'reserved1' && tile.id !== 'reserved2'
)

// 사이드바 메타 (state.title) 가 즉시 채워지므로 사용자가 세션을 선택한 순간부터
// 헤더에 정확한 제목 표시. 메타가 없는 부팅 자동 복원 1회만 첫 user 메시지에서 fallback.
// selector 는 i18n 밖(순수) — 빈 문자열 sentinel 을 돌려주고 렌더에서 tr() 폴백을 채운다.
function selectTitle(s: ChatState): string {
  const meta = s.title?.trim()
  if (meta) return meta
  const u = s.messages.find((m) => m.role === 'user')
  return (u && partsText(u.parts).slice(0, 60)) || ''
}

// 채팅 타일 titlebar — 제목 + 우측 액션. selector 가 primitive 를 반환하므로
// 스트리밍 커밋(messages 교체)에도 제목 문자열이 같으면 재렌더되지 않는다.
interface ChatTitleBarProps {
  projectId?: string | null
  projectName?: string | null
  onOpenProject?: (projectId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
}

export const ChatTitleBar = memo(function ChatTitleBar({
  projectId,
  projectName,
  onOpenProject,
  onDeleteSession,
  onRenameSession
}: ChatTitleBarProps): React.JSX.Element {
  const { tr } = useI18n()
  const title = useChatSession(selectTitle) || tr('common.newChat')
  const cwd = useChatSession((s) => s.cwd)
  const sessionId = useChatSession((s) => s.sessionId)
  // 열 구조(stable ref)를 구독하고 평탄 뷰는 메모로 파생 — selector 가 새 배열을 반환하면
  // zustand Object.is 비교가 매번 깨져 불필요 재렌더가 난다.
  const tileColumns = useChatSession((s) => s.rightPanelTiles)
  const activeTiles = useMemo(() => flattenColumns(tileColumns), [tileColumns])
  const labels = useChatSession((s) => s.rightPanelTileLabels)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const canRenameSession = sessionId != null && onRenameSession != null
  const canDeleteSession = sessionId != null && onDeleteSession != null

  // 인라인 편집 커밋 — 빈 값/기존 제목과 동일하면 무시. onRenameSession 이 chat store 와
  // sessions store 를 함께 갱신하므로 헤더와 사이드바 '최근 대화' 라벨이 동시에 반영된다.
  const commitRename = useCallback(
    (next: string): void => {
      setRenaming(false)
      const trimmed = next.trim()
      if (trimmed === '' || trimmed === title) return
      if (sessionId && onRenameSession) onRenameSession(sessionId, trimmed)
    },
    [sessionId, onRenameSession, title]
  )

  // 전체 대화를 마크다운으로 직렬화해 클립보드에 복사한다. text 파트만 추출(partsText)하므로
  // 도구 호출/첨부는 제외 — 사람이 읽을 대화 본문 위주.
  const copyConversation = useCallback(async (): Promise<void> => {
    const { messages } = getActiveChatSession()
    const text = messages
      .map((m) => {
        const body = partsText(m.parts).trim()
        if (!body) return ''
        return `## ${m.role === 'user' ? tr('chat.titleBar.roleUser') : 'Claude'}\n\n${body}`
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
  }, [tr])

  return (
    <div className="app-frame-titlebar flex items-center gap-3 px-6 pb-2 pt-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {projectId && projectName && onOpenProject && (
          <>
            <button
              type="button"
              className="min-w-0 shrink-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-r4 border-0 bg-transparent px-p5 py-1 text-footnote font-medium text-t7 transition-colors hover:bg-fill-uncontained-hover hover:text-t9"
              onClick={() => onOpenProject(projectId)}
              title={projectName}
            >
              {projectName}
            </button>
            <span className="shrink-0 text-t5">/</span>
          </>
        )}
        {renaming ? (
          <RenameInput
            initial={title}
            onCommit={commitRename}
            onCancel={() => setRenaming(false)}
            ariaLabel={tr('chat.titleBar.renameAria')}
            className="min-w-0 flex-1 rounded-r4 border border-border-strong bg-panel px-1.5 py-0.5 text-[13px] font-medium text-ink outline-none"
          />
        ) : (
          <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-ink">
            {title}
          </div>
        )}
        <CwdButton cwd={cwd} sessionStarted className="shrink-0" />
      </div>
      <div className="ml-auto flex gap-1">
        <Button
          iconOnly
          leadingIcon={copied ? 'check' : 'copy'}
          size="small"
          onClick={() => void copyConversation()}
          title={copied ? tr('common.copied') : tr('chat.titleBar.copyAll')}
          aria-label={tr('chat.titleBar.copyAll')}
        />
        <Button
          ref={anchorRef}
          iconOnly
          leadingIcon="kebab"
          size="small"
          pressed={open}
          onClick={() => setOpen((v) => !v)}
          title={tr('chat.titleBar.tilesButton')}
          aria-label={tr('chat.titleBar.tilesButton')}
        />
        <Popover
          open={open}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
          placement="bottom"
          align="end"
          className="min-w-[200px]"
        >
          <div className="px-2 py-1 text-[11px] font-medium text-t6">
            {tr('chat.titleBar.tilesHeader')}
          </div>
          {VISIBLE_TILE_REGISTRY.map((tile) => {
            const active = activeTiles.includes(tile.id)
            return (
              <MenuItem
                key={tile.id}
                icon={active ? 'check' : 'plus'}
                iconSize={13}
                onClick={() => {
                  chatActions.toggleRightPanelTile(tile.id)
                  setOpen(false)
                }}
                role="menuitemcheckbox"
                aria-checked={active}
              >
                <span>{labels[tile.id as RightPanelTileId] ?? tr(tile.defaultLabelKey)}</span>
              </MenuItem>
            )
          })}
          <div className="my-1 h-px bg-border" />
          <MenuItem
            icon="edit"
            iconSize={13}
            onClick={() => {
              setOpen(false)
              setRenaming(true)
            }}
            disabled={!canRenameSession}
          >
            {tr('common.rename')}
          </MenuItem>
          <MenuItem
            danger
            icon="trash"
            iconSize={13}
            onClick={() => {
              if (!sessionId || !onDeleteSession) return
              setOpen(false)
              openConfirmDialog({
                title: tr('sessions.deleteDialogTitle'),
                message: tr('sessions.deleteDialogMessage'),
                confirmLabel: tr('common.delete'),
                danger: true,
                onConfirm: () => onDeleteSession(sessionId)
              })
            }}
            disabled={!canDeleteSession}
          >
            {tr('common.delete')}
          </MenuItem>
        </Popover>
      </div>
    </div>
  )
})
