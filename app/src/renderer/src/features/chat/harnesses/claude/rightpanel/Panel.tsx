import { TilePanel } from '../../common/rightpanel/TilePanel'
import type { RightPanelHostProps } from '../../contracts'

export function ClaudeRightPanel(props: RightPanelHostProps): React.JSX.Element | null {
  return <TilePanel {...props} />
}
