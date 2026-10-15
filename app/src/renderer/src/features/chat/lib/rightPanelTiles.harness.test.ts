import { describe, expect, it } from 'vitest'
import {
  rightPanelGroups,
  rightPanelPolicy,
  rightPanelTarget,
  rightPanelTileDefinitionsForAgent
} from './rightPanelTiles'
import { rightPanelColumnsForAgent } from './rightPanelLayout'

describe('harness panel categories', () => {
  it('groups only supported OpenCode categories and filters persisted columns', () => {
    expect(
      rightPanelGroups('code', 'opencode').map((group) => [
        group.id,
        group.tiles.map((tile) => tile.id)
      ])
    ).toEqual([
      ['review', ['diff']],
      ['session', ['plan', 'source']],
      ['tasks', ['subagent', 'task', 'process']]
    ])
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
  })
})
