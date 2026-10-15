import { describe, expect, it } from 'vitest'
import {
  rightPanelGroups,
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
      ['session', ['plan']],
      ['tasks', ['subagent']]
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
