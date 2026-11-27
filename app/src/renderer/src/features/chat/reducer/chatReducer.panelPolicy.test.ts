import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatState } from './chatReducer'
import {
  rightPanelTileDefinitionsForAgent,
  rightPanelTarget,
  showsUnseenTaskBadge
} from '../lib/panelTiles'

const draft = (): ChatState =>
  chatReducer(initialChatState, { type: 'SET_AGENT_KIND', kind: 'work' })

describe('0224 r3 agent panel policy', () => {
  it('offers only task to Work and integrates Code tasks under plan', () => {
    expect(rightPanelTileDefinitionsForAgent('work').map((t) => t.id)).toEqual(['task'])
    expect(rightPanelTileDefinitionsForAgent('code').map((t) => t.id)).toEqual([
      'plan',
      'subagent',
      'diff'
    ])
    expect(rightPanelTarget('task', 'code')).toBe('plan')
    for (const id of ['plan', 'subagent', 'diff'] as const)
      expect(rightPanelTarget(id, 'work')).toBeNull()
  })
  it('keeps landing panels empty and preserves draft data across kind selection', () => {
    const original = { ...initialChatState, cwd: 'C:/project', extraDirs: ['C:/docs'] }
    const selected = chatReducer(original, { type: 'SET_AGENT_KIND', kind: 'work' })
    const code = chatReducer(selected, { type: 'SET_AGENT_KIND', kind: 'code' })
    expect(code.cwd).toBe(original.cwd)
    expect(code.extraDirs).toBe(original.extraDirs)
  })
  it('explicit task entry opens the task and selects it', () => {
    const next = chatReducer(draft(), { type: 'OPEN_TASK', key: 'agent:1' })
    expect(next.selectedTaskKey).toBe('agent:1')
  })
  it('keeps plan approval data without reopening a closed Work panel', () => {
    const next = chatReducer(draft(), {
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
  })
  it('shows unseen task feedback only when Work task is hidden', () => {
    expect(showsUnseenTaskBadge(2, [], [], 'work')).toBe(true)
    expect(showsUnseenTaskBadge(2, ['task'], [], 'work')).toBe(false)
    expect(showsUnseenTaskBadge(0, [], [], 'work')).toBe(false)
  })
  it('records explicit Work cwd selection once while retaining Code cwd policy', () => {
    const work = { ...draft(), cwd: 'C:/Downloads' }
    const added = chatReducer(work, { type: 'ADD_EXTRA_DIR', dir: 'C:/Downloads' })
    expect(added.extraDirs).toEqual(['C:/Downloads'])
    expect(chatReducer(added, { type: 'ADD_EXTRA_DIR', dir: 'c:\\downloads' }).extraDirs).toEqual([
      'C:/Downloads'
    ])
    expect(
      chatReducer(
        { ...initialChatState, cwd: 'C:/Downloads' },
        { type: 'ADD_EXTRA_DIR', dir: 'C:/Downloads' }
      ).extraDirs
    ).toEqual([])
  })
})
