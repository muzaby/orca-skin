import { describe, expect, it } from 'vitest'
import {
  rightPanelPolicy,
  rightPanelMenuTileDefinitionsForAgent,
  rightPanelTarget,
  rightPanelTileDefinitionsForAgent,
  type RightPanelTileId
} from './panelTiles'

describe('harness panel policy', () => {
  it('limits only the OpenCode menu while retaining every supported target', () => {
    const ids: RightPanelTileId[] = ['plan', 'subagent', 'task', 'diff', 'process', 'source']
    expect(
      rightPanelMenuTileDefinitionsForAgent('code', 'opencode').map((tile) => tile.id)
    ).toEqual(['task'])
    expect(rightPanelTileDefinitionsForAgent('code', 'opencode').map((tile) => tile.id)).toEqual(
      ids
    )
    expect(ids.map((id) => rightPanelTarget(id, 'code', 'opencode'))).toEqual(ids)
  })

  it('offers the task summary and independent process/source tiles only to OpenCode', () => {
    expect(rightPanelTileDefinitionsForAgent('code', 'opencode').map((tile) => tile.id)).toEqual([
      'plan',
      'subagent',
      'task',
      'diff',
      'process',
      'source'
    ])
    expect(rightPanelPolicy('code', 'opencode')).toMatchObject({
      initialTile: 'task',
      taskTarget: 'task',
      taskTileChrome: 'opencode-overview'
    })
    expect(rightPanelTarget('task', 'code', 'opencode')).toBe('task')
    for (const kind of ['code', 'work'] as const) {
      expect(rightPanelTarget('process', kind, 'claude')).toBeNull()
      expect(rightPanelTarget('source', kind, 'claude')).toBeNull()
    }
  })
  it('retains Claude Code and Work panel sets', () => {
    expect(rightPanelTileDefinitionsForAgent('code', 'claude').map((tile) => tile.id)).toEqual([
      'plan',
      'subagent',
      'diff'
    ])
    expect(rightPanelTileDefinitionsForAgent('work', 'claude').map((tile) => tile.id)).toEqual([
      'task'
    ])
    for (const kind of ['code', 'work'] as const) {
      expect(rightPanelMenuTileDefinitionsForAgent(kind, 'claude')).toEqual(
        rightPanelTileDefinitionsForAgent(kind, 'claude')
      )
      expect(rightPanelMenuTileDefinitionsForAgent(kind, null)).toEqual(
        rightPanelTileDefinitionsForAgent(kind, 'claude')
      )
    }
  })
})

it.each(['claude', 'opencode'] as const)(
  'keeps the %s Work task menu and preserves its supported columns',
  (backend) => {
    expect(rightPanelMenuTileDefinitionsForAgent('work', backend).map((tile) => tile.id)).toEqual([
      'task'
    ])
  }
)
