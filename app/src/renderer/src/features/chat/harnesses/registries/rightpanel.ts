import type { Backend } from '../../../../../../shared/ipc'
import type { RightPanelModule } from '../contracts'
import { ClaudeRightPanel } from '../claude/rightpanel/Panel'
import { claudeTileById, claudeTiles } from '../claude/rightpanel/tileRegistry'
import { rightPanelAppearance as claudeAppearance } from '../claude/rightPanel'
import { OpenCodeRightPanel } from '../opencode/rightpanel/Panel'
import { openCodeTileById, openCodeTiles } from '../opencode/rightpanel/tileRegistry'
import { rightPanelAppearance as openCodeAppearance } from '../opencode/rightPanel'

const panels = {
  claude: {
    Panel: ClaudeRightPanel,
    configuration: { backend: 'claude', appearance: claudeAppearance, tileById: claudeTileById },
    tiles: claudeTiles,
    resetBySession: false
  },
  opencode: {
    Panel: OpenCodeRightPanel,
    configuration: {
      backend: 'opencode',
      appearance: openCodeAppearance,
      tileById: openCodeTileById
    },
    tiles: openCodeTiles,
    resetBySession: true
  }
} satisfies Record<Backend, RightPanelModule>

export function harnessRightPanel(backend: Backend | null = 'claude'): RightPanelModule {
  return panels[backend ?? 'claude']
}
