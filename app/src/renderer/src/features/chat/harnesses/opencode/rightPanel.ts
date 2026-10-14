import type { RightPanelAgentPolicy } from '../../lib/rightPanelTiles'
export const OPEN_CODE_PANEL_POLICY: RightPanelAgentPolicy = {
  visibleIds: ['plan', 'diff'],
  taskTarget: 'plan',
  taskBadgeTile: 'plan',
  initialTile: null,
  columnMode: 'standard-grid',
  taskTileChrome: 'standard'
}

export const rightPanelAppearance = {
  tile: 'rounded-[10px] border border-oc-border bg-oc-surface text-oc-ink shadow-oc-raised',
  title: 'font-sans text-oc-ink'
}
