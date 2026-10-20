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
    const ids: RightPanelTileId[] = [
      'plan',
      'subagent',
      'task',
      'diff',
      'process',
      'source',
      'nativeStatus'
    ]
    expect(
      rightPanelMenuTileDefinitionsForAgent('code', 'opencode').map((tile) => tile.id)
    ).toEqual(['task', 'nativeStatus'])
    expect(rightPanelTileDefinitionsForAgent('code', 'opencode').map((tile) => tile.id)).toEqual(
      ids
    )
    expect(ids.map((id) => rightPanelTarget(id, 'code', 'opencode'))).toEqual(ids)
    const columns = [
      { id: 'first', tiles: ids.slice(0, 3) },
      { id: 'second', tiles: ids.slice(3) }
    ]
    expect(rightPanelColumnsForAgent(columns, 'code', 'opencode')).toEqual(
      columns.map((column) => ({
        ...column,
        tiles: column.tiles.filter((id) => id !== 'nativeStatus')
      }))
    )
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
      'source',
      'nativeStatus'
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
      'diff',
      'nativeStatus'
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
  'limits %s status to Code and filters persisted Work columns',
  (backend) => {
    expect(rightPanelMenuTileDefinitionsForAgent('work', backend).map((tile) => tile.id)).toEqual([
      'task'
    ])
    expect(rightPanelTarget('nativeStatus', 'work', backend)).toBeNull()
    expect(rightPanelTarget('nativeStatus', 'code', backend)).toBe('nativeStatus')
    const columns = [{ id: 'retained', tiles: ['nativeStatus', 'task'] as RightPanelTileId[] }]
    expect(rightPanelColumnsForAgent(columns, 'work', backend)).toEqual([
      { id: 'retained', tiles: ['task'] }
    ])
    expect(columns[0].tiles).toContain('nativeStatus')
  }
)
