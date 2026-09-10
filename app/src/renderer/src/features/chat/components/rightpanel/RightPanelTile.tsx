import { useCallback, type ReactNode } from 'react'
import { PanelCloseButton, PanelExpandButton } from '../../../../shared/ui/PanelControls'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { RightPanelAgentPolicy, RightPanelTileId } from '../../lib/rightPanelTiles'
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
  taskTileChrome: RightPanelAgentPolicy['taskTileChrome']
}

export function RightPanelTile({
  id,
  defaultLabelKey,
  children,
  headerActions,
  headerContent,
  expanded = false,
  onToggleExpand,
  taskTileChrome,
  className = ''
}: RightPanelTileProps): React.JSX.Element {
  const { tr } = useI18n()
  const label = useChatSession((s) => s.rightPanelTileLabels[id]) ?? tr(defaultLabelKey)
  const isDiff = id === 'diff'
  const isWorkTask = taskTileChrome === 'work-overview' && id === 'task'
  const expandButton = (id === 'plan' || id === 'task') && onToggleExpand && (
    <PanelExpandButton expanded={expanded} targetLabel={label} onClick={onToggleExpand} />
  )

  const remove = useCallback((): void => {
    if (expanded) onToggleExpand?.()
    chatActions.removeRightPanelTile(id)
  }, [expanded, id, onToggleExpand])

  return (
    <div
      className={`app-frame-tile effect-primary-elevated relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-r6 border border-border bg-panel ${isWorkTask ? 'max-h-full' : ''} ${className}`}
      data-context={id}
    >
      {isWorkTask && <div className="absolute right-2 top-1 z-10">{expandButton}</div>}
      {!isWorkTask && (
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
            <PanelCloseButton
              size={isDiff ? 'compact' : 'small'}
              onClick={remove}
              label={tr('chat.rightpanel.closeTile', { label })}
            />
          </div>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
