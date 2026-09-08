import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'
import { flattenColumns, rightPanelColumnsForAgent } from '../lib/rightPanelLayout'
import { rightPanelTileDefinitionsForAgent, rightPanelTarget } from '../lib/rightPanelTiles'

const work = (): ChatState =>
  chatReducer(initialChatState, { type: 'SET_AGENT_KIND', kind: 'work' })

describe('0224 r2 agent panel policy', () => {
  it('offers only task to Work and integrates Coding tasks under plan', () => {
    expect(rightPanelTileDefinitionsForAgent('work').map((tile) => tile.id)).toEqual(['task'])
    expect(rightPanelTileDefinitionsForAgent('coding').map((tile) => tile.id)).toEqual([
      'plan',
      'subagent',
      'diff'
    ])
    expect(rightPanelTarget('task', 'coding')).toBe('plan')
    for (const id of ['plan', 'subagent', 'diff'] as const)
      expect(rightPanelTarget(id, 'work')).toBeNull()
  })
  it('shows task on landing selection and preserves draft data when switching back', () => {
    const draft = { ...initialChatState, cwd: 'C:/project', extraDirs: ['C:/docs'] }
    const selected = chatReducer(draft, { type: 'SET_AGENT_KIND', kind: 'work' })
    expect(flattenColumns(selected.rightPanelTiles)).toEqual(['task'])
    const coding = chatReducer(selected, { type: 'SET_AGENT_KIND', kind: 'coding' })
    expect(flattenColumns(coding.rightPanelTiles)).toEqual([])
    expect(coding.cwd).toBe(draft.cwd)
    expect(coding.extraDirs).toBe(draft.extraDirs)
  })
  it.each([
    { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' },
    { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'task' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'task', active: false },
    { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true },
    { type: 'OPEN_TASK', key: 'agent:1' },
    { type: 'OPEN_SUBAGENT_TASK', toolRunId: 'child' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'diff', active: true },
    { type: 'BEGIN_TURN' }
  ] satisfies ChatAction[])('keeps Work task through $type', (action) => {
    expect(flattenColumns(chatReducer(work(), action).rightPanelTiles)).toEqual(['task'])
  })
  it('preserves Work plan approval and its source while suppressing plan auto-open', () => {
    const next = chatReducer(work(), {
      type: 'RECV_EVENT',
      event: {
        type: 'permission.requested',
        approvalId: 'p',
        origin: 'agent',
        action: { kind: 'plan_review', request: { requestId: 'p', plan: '# Work plan' } }
      }
    })
    expect(next.pendingPlanReview?.plan).toBe('# Work plan')
    expect(next.planContent).toBe('# Work plan')
    expect(flattenColumns(next.rightPanelTiles)).toEqual(['task'])
  })
  it('filters stale columns at the final renderer boundary, without allocating for a valid layout', () => {
    const dirty = [{ id: 'old', tiles: ['diff', 'task'] as const }].map((col) => ({
      ...col,
      tiles: [...col.tiles]
    }))
    expect(flattenColumns(rightPanelColumnsForAgent(dirty, 'work'))).toEqual(['task'])
    expect(flattenColumns(rightPanelColumnsForAgent(dirty, 'coding'))).toEqual(['diff'])
    const clean = work().rightPanelTiles
    expect(rightPanelColumnsForAgent(clean, 'work')).toBe(clean)
  })
})
