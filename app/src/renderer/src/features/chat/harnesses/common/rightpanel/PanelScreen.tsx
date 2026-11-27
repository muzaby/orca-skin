import type { PanelScreenProps } from '../../contracts'
import { RightPanelTile } from './RightPanelTile'

export function PanelScreen({
  layer,
  configuration,
  panelPolicy,
  ...header
}: PanelScreenProps): React.JSX.Element {
  const id = layer.kind === 'detail' ? layer.selection.id : layer.id
  const tile = configuration.tileById(id)
  const { HeaderActions, HeaderContent, Content } = tile
  return (
    <RightPanelTile
      id={id}
      configuration={configuration}
      defaultLabelKey={tile.defaultLabelKey}
      taskTileChrome={panelPolicy.taskTileChrome}
      headerActions={HeaderActions && <HeaderActions />}
      headerContent={HeaderContent && <HeaderContent {...header} />}
      expanded={header.expanded}
      onToggleExpand={header.onToggleExpand}
    >
      <Content />
    </RightPanelTile>
  )
}
