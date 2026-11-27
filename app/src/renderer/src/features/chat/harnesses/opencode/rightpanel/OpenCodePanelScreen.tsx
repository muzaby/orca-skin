import type { PanelScreenProps } from '../../contracts'
import { PanelScreen } from '../../common/rightpanel/PanelScreen'
import { panelActions } from '../../../store/rightPanelStore'
import { OpenCodePanelNavigationContext, openCodePanelFallbackOrigin } from './navigation'

export function OpenCodePanelScreen(props: PanelScreenProps): React.JSX.Element {
  return (
    <OpenCodePanelNavigationContext.Provider
      value={{
        open: (selection, origin) =>
          panelActions.navigate({
            kind: 'detail',
            selection,
            origin,
            fallbackOrigin: openCodePanelFallbackOrigin(origin)
          }),
        selection: props.layer.kind === 'detail' ? props.layer.selection : undefined,
        select: (selection) => panelActions.updateDetail({ kind: 'detail', selection })
      }}
    >
      <PanelScreen {...props} />
    </OpenCodePanelNavigationContext.Provider>
  )
}
