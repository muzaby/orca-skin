import { useCallback, type ReactNode } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { RightPanelTileId } from '../../lib/rightPanelTiles'
import { useI18n, type MessageKey } from '../../../../shared/i18n'

interface RightPanelTileProps {
  id: RightPanelTileId
  defaultLabelKey: MessageKey
  children: ReactNode
  // 닫기 버튼 앞에 놓이는 타일별 액션(예: 계획 타일의 복사 버튼). registry 가 주입한다.
  headerActions?: ReactNode
  // 타이틀 영역 전체를 대체하는 타일별 헤더 콘텐츠(예: 서브에이전트 타일의 뒤로가기+동적 제목).
  // 미지정 시 기본 라벨 span 을 렌더한다. registry 가 주입한다.
  headerContent?: ReactNode
  className?: string
  expanded?: boolean
  onToggleExpand?: () => void
}

export function RightPanelTile({
  id,
  defaultLabelKey,
  children,
  headerActions,
  headerContent,
  expanded = false,
  onToggleExpand,
  className = ''
}: RightPanelTileProps): React.JSX.Element {
  const { tr } = useI18n()
  const label = useChatSession((s) => s.rightPanelTileLabels[id]) ?? tr(defaultLabelKey)
  const isDiff = id === 'diff'
  const agentKind = useChatSession((s) => s.agentKind)
  const isWorkTask = agentKind === 'work' && id === 'task'
  const expandButton = (isWorkTask || id === 'plan') && onToggleExpand && (
    <Button
      iconOnly
      size="small"
      leadingIcon={expanded ? 'collapse' : 'expand'}
      pressed={expanded}
      aria-pressed={expanded}
      onClick={onToggleExpand}
      title={tr(expanded ? 'chat.rightpanel.restoreTile' : 'chat.rightpanel.expandTile', { label })}
      aria-label={tr(expanded ? 'chat.rightpanel.restoreTile' : 'chat.rightpanel.expandTile', {
        label
      })}
    />
  )

  const remove = useCallback((): void => {
    chatActions.removeRightPanelTile(id)
  }, [id])

  return (
    <div
      className={`app-frame-tile effect-primary-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-r6 border border-border bg-panel ${className}`}
      data-context={id}
    >
      {isWorkTask ? (
        <div className="absolute right-3 top-3 z-10">{expandButton}</div>
      ) : (
        <div
          data-diff-tile-header={isDiff || undefined}
          className={`app-frame-tile-header flex shrink-0 items-center ${isDiff ? 'h-[32px] gap-[2px] px-[4px] font-sans' : 'gap-2 border-b border-t5 px-3 py-2'}`}
        >
          {headerContent ?? (
            <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
              {label}
            </span>
          )}
          <div className={`ml-auto flex shrink-0 items-center ${isDiff ? 'gap-[2px]' : 'gap-g2'}`}>
            {headerActions}
            {expandButton}
            <Button
              iconOnly
              size={isDiff ? 'compact' : 'small'}
              leadingIcon="x"
              onClick={remove}
              title={tr('chat.rightpanel.closeTile', { label })}
              aria-label={tr('chat.rightpanel.closeTile', { label })}
            />
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
