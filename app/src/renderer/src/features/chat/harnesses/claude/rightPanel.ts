import type { AgentKind } from '../../../../../../shared/agent-kind'
import type { RightPanelAgentPolicy } from '../../lib/rightPanelTiles'
import type { MessageKey } from '../../../../shared/i18n'

export const planEmptyDescriptionKey: MessageKey = 'chat.rightpanel.planEmptyDesc'
export const RIGHT_PANEL_POLICY = {
  work: {
    visibleIds: ['task'],
    taskTarget: 'task',
    taskBadgeTile: 'task',
    initialTile: 'task',
    columnMode: 'task-focus',
    taskTileChrome: 'work-overview'
  },
  code: {
    visibleIds: ['plan', 'subagent', 'diff'],
    taskTarget: 'plan',
    taskBadgeTile: 'plan',
    initialTile: null,
    columnMode: 'standard-grid',
    taskTileChrome: 'standard'
  }
} as const satisfies Record<AgentKind, RightPanelAgentPolicy>

export const rightPanelAppearance = {
  tile: 'effect-primary-elevated rounded-r6 border border-border bg-panel',
  title: 'font-serif text-t9'
}
