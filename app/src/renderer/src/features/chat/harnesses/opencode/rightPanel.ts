import type { RightPanelAgentPolicy } from '../../lib/rightPanelTiles'
import type { MessageKey } from '../../../../shared/i18n'

export const planEmptyDescriptionKey: MessageKey = 'chat.rightpanel.planEmptyDescOpenCode'
export const planSelectHintKey: MessageKey = 'chat.rightpanel.planSelectHintOpenCode'
export const OPEN_CODE_PANEL_POLICY: RightPanelAgentPolicy = {
  visibleIds: ['plan', 'subagent', 'task', 'diff', 'process', 'source'],
  taskTarget: 'task',
  taskBadgeTile: 'task',
  initialTile: 'task',
  columnMode: 'standard-grid',
  taskTileChrome: 'opencode-overview'
}

export const rightPanelAppearance = {
  tile: 'rounded-[10px] border border-oc-border bg-oc-surface text-oc-ink shadow-oc-raised',
  title: 'font-sans text-oc-ink'
}
