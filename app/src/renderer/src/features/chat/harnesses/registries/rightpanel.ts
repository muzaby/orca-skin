import type { Backend } from '../../../../../../shared/ipc'
import type { RightPanelModule } from '../contracts'
import { PanelScreen } from '../common/rightpanel/PanelScreen'
import { claudeTileById, claudeTiles } from '../claude/rightpanel/tileRegistry'
import { rightPanelAppearance as claudeAppearance } from '../claude/rightPanel'
import { OpenCodePanelScreen } from '../opencode/rightpanel/OpenCodePanelScreen'
import { openCodeTileById, openCodeTiles } from '../opencode/rightpanel/tileRegistry'
import { rightPanelAppearance as openCodeAppearance } from '../opencode/rightPanel'

const panels = {
  claude: {
    screen: PanelScreen,
    configuration: { backend: 'claude', appearance: claudeAppearance, tileById: claudeTileById },
    tiles: claudeTiles
  },
  opencode: {
    screen: OpenCodePanelScreen,
    configuration: {
      backend: 'opencode',
      appearance: openCodeAppearance,
      tileById: openCodeTileById
    },
    tiles: openCodeTiles
  }
} satisfies Record<Backend, RightPanelModule>

export function harnessRightPanel(backend: Backend | null = 'claude'): RightPanelModule {
  return panels[backend ?? 'claude']
}
