import { useLayoutEffect, useReducer, type ComponentProps } from 'react'
import { TilePanel, type TilePanelDetail } from '../../../components/rightpanel/TilePanel'
import { RightPanelTile } from '../../../components/rightpanel/RightPanelTile'
import { tileById } from '../../../components/rightpanel/tileRegistry'
import { useChatStore } from '../../../store/chatStore'
import {
  initialOpenCodeDetailState,
  openCodeDetailReducer,
  OpenCodePanelNavigationContext,
  type OpenCodePanelNavigation
} from './navigation'

export function OpenCodeRightPanel(
  props: Omit<ComponentProps<typeof TilePanel>, 'detail'>
): React.JSX.Element {
  const [state, dispatch] = useReducer(openCodeDetailReducer, initialOpenCodeDetailState)
  const activeKey = useChatStore((store) => store.activeKey)
  const reveal = useChatStore((store) => store.sessions[store.activeKey]?.panelReveal)
  // Explicit title-menu / transcript tile navigation reveals the requested base tile.
  useLayoutEffect(() => dispatch({ type: 'close' }), [reveal])
  const navigation: OpenCodePanelNavigation = {
    open: (selection, origin) => dispatch({ type: 'open', selection, origin })
  }
  let detail: TilePanelDetail | undefined
  if (state.selection) {
    const tile = tileById(state.selection.id, 'opencode')
    const { Content, HeaderContent, HeaderActions } = tile
    const toggleExpand = (): void => dispatch({ type: 'expand' })
    const close = (): void => dispatch({ type: 'close' })
    detail = {
      key: `${activeKey}:${state.request}`,
      origin: state.origin,
      expanded: state.expanded,
      width: state.width,
      onWidthChange: (width) => dispatch({ type: 'resize', width }),
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
