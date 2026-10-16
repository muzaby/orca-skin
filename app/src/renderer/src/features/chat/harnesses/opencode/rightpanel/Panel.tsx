import { useLayoutEffect, useReducer, type ComponentProps } from 'react'
import { TilePanel, type TilePanelDetail } from '../../common/rightpanel/TilePanel'
import { RightPanelTile } from '../../common/rightpanel/RightPanelTile'
import { openCodeTileById } from './tileRegistry'
import { PANEL_DEFAULT_WIDTH } from '../../../reducer/chatReducer'
import { chatActions, useChatSession, useChatStore } from '../../../store/chatStore'
import {
  initialOpenCodeDetailState,
  openCodeDetailReducer,
  openCodePanelFallbackOrigin,
  OpenCodePanelNavigationContext,
  type OpenCodePanelNavigation
} from './navigation'

export function OpenCodeRightPanel(
  props: Omit<ComponentProps<typeof TilePanel>, 'detail'>
): React.JSX.Element {
  const [state, dispatch] = useReducer(openCodeDetailReducer, initialOpenCodeDetailState)
  const activeKey = useChatStore((store) => store.activeKey)
  const reveal = useChatStore((store) => store.sessions[store.activeKey]?.panelReveal)
  const widths = useChatSession((session) => session.rightPanelColWidths)
  const parentColumn =
    props.layout.columns.find((column) => column.tiles.includes('task'))?.col ?? 0
  // The detail occupies the parent's column, including its resize separator.
  const parentWidth = widths[parentColumn] ?? PANEL_DEFAULT_WIDTH
  useLayoutEffect(() => {
    dispatch(
      reveal?.detail
        ? { type: 'open', selection: reveal.detail, origin: reveal.origin }
        : { type: 'close' }
    )
  }, [reveal, activeKey])
  const navigation: OpenCodePanelNavigation = {
    open: (selection, origin) =>
      dispatch({
        type: 'open',
        selection,
        origin,
        fallbackOrigin: openCodePanelFallbackOrigin(origin)
      })
  }
  let detail: TilePanelDetail | undefined
  if (state.selection) {
    const tile = openCodeTileById(state.selection.id)
    const { Content, HeaderContent, HeaderActions } = tile
    const toggleExpand = (): void => dispatch({ type: 'expand' })
    const close = (): void => {
      dispatch({ type: 'close' })
      chatActions.closePanelDetail()
    }
    detail = {
      key: `${activeKey}:${state.request}`,
      origin: state.origin,
      fallbackOrigin: state.fallbackOrigin,
      expanded: state.expanded,
      width: parentWidth + 8,
      onWidthChange: (width) => chatActions.setRightPanelColWidth(parentColumn, width - 8),
      onClose: close,
      content: (
        <OpenCodePanelNavigationContext.Provider
          value={{
            ...navigation,
            selection: state.selection,
            select: (selection) => dispatch({ type: 'select', selection })
          }}
        >
          <RightPanelTile
            configuration={props.configuration}
            id={tile.id}
            defaultLabelKey={tile.defaultLabelKey}
            taskTileChrome="opencode-overview"
            headerActions={HeaderActions ? <HeaderActions /> : undefined}
            headerContent={
              HeaderContent ? (
                <HeaderContent expanded={state.expanded} onToggleExpand={toggleExpand} />
              ) : undefined
            }
            expanded={state.expanded}
            onToggleExpand={toggleExpand}
            onClose={close}
          >
            <Content />
          </RightPanelTile>
        </OpenCodePanelNavigationContext.Provider>
      )
    }
  }
  return (
    <OpenCodePanelNavigationContext.Provider value={navigation}>
      <TilePanel {...props} detail={detail} />
    </OpenCodePanelNavigationContext.Provider>
  )
}
