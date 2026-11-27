import type { RightPanelAgentPolicy } from '../../lib/panelTiles'
import type { MessageKey } from '../../../../shared/i18n'

export const planEmptyDescriptionKey: MessageKey = 'chat.rightpanel.planEmptyDescOpenCode'
export const planSelectHintKey: MessageKey = 'chat.rightpanel.planSelectHintOpenCode'
export const OPEN_CODE_PANEL_POLICY: RightPanelAgentPolicy = {
  visibleIds: ['plan', 'subagent', 'task', 'diff', 'process', 'source'],
  menuIds: ['task'],
  taskTarget: 'task',
  taskBadgeTile: 'task',
  initialTile: 'task',
  taskTileChrome: 'opencode-overview'
}

export const OPEN_CODE_WORK_PANEL_POLICY: RightPanelAgentPolicy = {
  ...OPEN_CODE_PANEL_POLICY,
  menuIds: ['task']
}

export const rightPanelAppearance = {
  tile: 'rounded-r6 border border-oc-border bg-oc-surface text-oc-ink shadow-oc-raised',
  title: 'font-sans text-oc-ink'
}
