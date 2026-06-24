import { useCallback, type ReactNode } from 'react'
import { Button } from '../../../../shared/ui/Button'
import { chatActions, useChatSession } from '../../store/chatStore'
import type { RightPanelTileId } from '../../lib/rightPanelTiles'

interface RightPanelTileProps {
  id: RightPanelTileId
  defaultLabel: string
  children: ReactNode
  // 닫기 버튼 앞에 놓이는 타일별 액션(예: 계획 타일의 복사 버튼). registry 가 주입한다.
  headerActions?: ReactNode
  // 타이틀 영역 전체를 대체하는 타일별 헤더 콘텐츠(예: 서브에이전트 타일의 뒤로가기+동적 제목).
  // 미지정 시 기본 라벨 span 을 렌더한다. registry 가 주입한다.
  headerContent?: ReactNode
  className?: string
}

export function RightPanelTile({
  id,
  defaultLabel,
  children,
  headerActions,
  headerContent,
  className = ''
}: RightPanelTileProps): React.JSX.Element {
  const label = useChatSession((s) => s.rightPanelTileLabels[id] ?? defaultLabel)

  const remove = useCallback((): void => {
    chatActions.removeRightPanelTile(id)
  }, [id])

  return (
    <div
      className={`app-frame-tile effect-primary-elevated flex min-h-0 flex-1 flex-col overflow-hidden rounded-r6 border border-border bg-panel ${className}`}
      data-context={id}
    >
      <div className="app-frame-tile-header flex items-center gap-2 border-b border-t5 px-3 py-2">
        {headerContent ?? (
          <span className="min-w-0 truncate font-serif text-[13px] font-semibold tracking-tight text-t9">
            {label}
          </span>
        )}
        <div className="ml-auto flex items-center gap-g2">
          {headerActions}
          <Button
            iconOnly
            size="small"
            leadingIcon="x"
            onClick={remove}
            title={`${label} 닫기`}
            aria-label={`${label} 닫기`}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
