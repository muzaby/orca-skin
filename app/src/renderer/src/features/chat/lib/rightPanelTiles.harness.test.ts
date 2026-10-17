import { describe, expect, it } from 'vitest'
import {
  rightPanelPolicy,
  rightPanelMenuTileDefinitionsForAgent,
  rightPanelTarget,
  rightPanelTileDefinitionsForAgent,
  type RightPanelTileId
} from './rightPanelTiles'
import { rightPanelColumnsForAgent } from './rightPanelLayout'

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
    const columns = [
      { id: 'first', tiles: ids.slice(0, 3) },
      { id: 'second', tiles: ids.slice(3) }
    ]
    expect(rightPanelColumnsForAgent(columns, 'code', 'opencode')).toEqual(columns)
  })

  it('retains supported OpenCode targets and persisted columns', () => {
    expect(rightPanelTarget('subagent', 'code', 'opencode')).toBe('subagent')
    expect(
      rightPanelColumnsForAgent(
        [
          { id: '1', tiles: ['subagent'] },
          { id: '2', tiles: ['diff'] }
        ],
        'code',
        'opencode'
      )
    ).toEqual([
      { id: '1', tiles: ['subagent'] },
      { id: '2', tiles: ['diff'] }
    ])
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
      const columns = [{ id: 'old', tiles: ['process', 'source'] as const }]
      expect(
        rightPanelColumnsForAgent(
          columns.map((column) => ({ ...column, tiles: [...column.tiles] })),
          kind,
          'claude'
        )
      ).toEqual([])
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
