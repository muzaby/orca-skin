import { useLayoutEffect, useRef, useState } from 'react'
import { ResizableSidePane } from '../../../../shared/ui/ResizableSidePane'
import type { RightPanelAgentPolicy, RightPanelTileId } from '../../lib/rightPanelTiles'
import type { deriveRightPanelLayout } from '../../lib/rightPanelLayout'
import { tileById } from './tileRegistry'
import { RightPanelTile } from './RightPanelTile'
import { RowSeparator } from './PanelResizeSeparators'

// 행 grow 트랜지션이 끝난 뒤 justify-end 고정을 푸는 시각.
const ROW_GROW_MS = 230

export function RightPanelColumn({
  sessionKey,
  col,
  tiles,
  width,
  split,
  expandedTile,
  onToggleExpand,
  taskTileChrome
}: {
  sessionKey: string
  col: number
  tiles: ReturnType<typeof deriveRightPanelLayout>['columns'][number]['tiles']
  width: number
  split: number
  expandedTile: RightPanelTileId | null
  onToggleExpand: (id: RightPanelTileId) => void
  taskTileChrome: RightPanelAgentPolicy['taskTileChrome']
}): React.JSX.Element {
  const columnRef = useRef<HTMLDivElement>(null)
  // 2행→1행 제거 시 남은 행이 자라는 방향을 잡는다. 위(0번) 행이 제거되면 남은 행을 바닥에
  // 고정(justify-end)해 *위로* 자라게, 아래(1번) 행이 제거되면 상단 고정(기본)으로 *아래로*
  // 자라게 한다 — flex-basis 트랜지션이 크기를 애니메이션(타일은 keyed 라 remount 안 됨).
  const [anchorBottom, setAnchorBottom] = useState(false)
  const prevTiles = useRef(tiles)

  useLayoutEffect(() => {
    const prev = prevTiles.current
    prevTiles.current = tiles
    if (prev.length === 2 && tiles.length === 1) {
      const topRemoved = prev.findIndex((id) => !tiles.includes(id)) === 0
      setAnchorBottom(topRemoved)
      if (topRemoved) {
        const t = window.setTimeout(() => setAnchorBottom(false), ROW_GROW_MS)
        return () => window.clearTimeout(t)
      }
    } else {
      setAnchorBottom(false)
    }
    return undefined
  }, [tiles])

  const children: React.JSX.Element[] = []
  tiles.forEach((id, index) => {
    const tile = tileById(id)
    const Content = tile.Content
    const HeaderActions = tile.HeaderActions
    const HeaderContent = tile.HeaderContent
    const basis =
      tiles.length === 1 ? '100%' : index === 0 ? `${split * 100}%` : `${(1 - split) * 100}%`
    // 분리자/타일을 평탄한 keyed 배열로 — Fragment 로 묶으면 분리자 유무에 따라 자식 위치가
    // 밀려 살아남는 타일이 remount(애니메이션 재생 + 트랜지션 소실)된다. key=id 로 보존한다.
    // 열이 안정 id 로 keyed 라(RightPanel) 기존 타일은 remount 되지 않으므로, animate-tile-in
    // 은 무조건 둬도 실제 새로 mount 되는(토글로 켜진) 타일만 등장 연출된다.
    if (index > 0) {
      children.push(<RowSeparator key={`sep-${id}`} col={col} columnRef={columnRef} />)
    }
    children.push(
      <div
        key={id}
        inert={!!expandedTile && expandedTile !== id}
        data-work-panel-available={
          taskTileChrome === 'work-overview' && id === 'task' ? '' : undefined
        }
        className={`flex min-h-0 ${expandedTile === id ? '' : 'animate-tile-in overflow-hidden transition-[flex-basis] duration-200 ease-out motion-reduce:animate-none motion-reduce:transition-none'} ${taskTileChrome === 'work-overview' && id === 'task' && expandedTile !== id ? 'items-start [container-type:size]' : ''}`}
        style={{ flexBasis: basis }}
      >
        <ResizableSidePane expanded={expandedTile === id} lifecycleKey={`${sessionKey}:${id}`}>
          <RightPanelTile
            id={id}
            defaultLabelKey={tile.defaultLabelKey}
            headerActions={HeaderActions ? <HeaderActions /> : undefined}
            headerContent={
              HeaderContent ? (
                <HeaderContent
                  expanded={expandedTile === id}
                  onToggleExpand={() => onToggleExpand(id)}
                />
              ) : undefined
            }
            expanded={expandedTile === id}
            onToggleExpand={() => onToggleExpand(id)}
            taskTileChrome={taskTileChrome}
          >
            <Content key={sessionKey} />
          </RightPanelTile>
        </ResizableSidePane>
      </div>
    )
  })

  return (
    <div
      ref={columnRef}
      className={`flex min-h-0 shrink-0 flex-col${anchorBottom ? ' justify-end' : ''}`}
      style={{ width }}
    >
      {children}
    </div>
  )
}
