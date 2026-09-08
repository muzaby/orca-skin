import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatAction, type ChatState } from './chatReducer'
import { flattenColumns, rightPanelColumnsForAgent } from '../lib/rightPanelLayout'
import {
  rightPanelTileDefinitionsForAgent,
  rightPanelTarget,
  showsUnseenTaskBadge
} from '../lib/rightPanelTiles'

const draft = (): ChatState =>
  chatReducer(initialChatState, { type: 'SET_AGENT_KIND', kind: 'work' })
const started = (): ChatState => chatReducer(draft(), { type: 'BEGIN_TURN' })
const closed = (): ChatState =>
  chatReducer(started(), { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
const ids = (s: ChatState): string[] => flattenColumns(s.rightPanelTiles)

describe('0224 r3 agent panel policy', () => {
  it('offers only task to Work and integrates Coding tasks under plan', () => {
    expect(rightPanelTileDefinitionsForAgent('work').map((t) => t.id)).toEqual(['task'])
    expect(rightPanelTileDefinitionsForAgent('coding').map((t) => t.id)).toEqual([
      'plan',
      'subagent',
      'diff'
    ])
    expect(rightPanelTarget('task', 'coding')).toBe('plan')
    for (const id of ['plan', 'subagent', 'diff'] as const)
      expect(rightPanelTarget(id, 'work')).toBeNull()
  })
  it('keeps landing panels empty and preserves draft data across kind selection', () => {
    const original = { ...initialChatState, cwd: 'C:/project', extraDirs: ['C:/docs'] }
    const selected = chatReducer(original, { type: 'SET_AGENT_KIND', kind: 'work' })
    expect(ids(selected)).toEqual([])
    const coding = chatReducer(selected, { type: 'SET_AGENT_KIND', kind: 'coding' })
    expect(ids(coding)).toEqual([])
    expect(coding.cwd).toBe(original.cwd)
    expect(coding.extraDirs).toBe(original.extraDirs)
  })
  it('opens once on first turn, allows toggling, and honors close on later turns', () => {
    expect(ids(started())).toEqual(['task'])
    expect(ids(closed())).toEqual([])
    expect(ids(chatReducer(closed(), { type: 'BEGIN_TURN' }))).toEqual([])
    const reopened = chatReducer(closed(), { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(ids(reopened)).toEqual(['task'])
    expect(ids(chatReducer(reopened, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' }))).toEqual([])
  })
  it.each([
    { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'task' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'task', active: false }
  ] satisfies ChatAction[])('honors explicit task close $type', (action) => {
    expect(ids(chatReducer(started(), action))).toEqual([])
  })
  it.each([
    { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'plan' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true },
    { type: 'OPEN_SUBAGENT_TASK', toolRunId: 'child' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'diff', active: true }
  ] satisfies ChatAction[])('does not reopen a hidden Work panel via $type', (action) => {
    expect(ids(chatReducer(closed(), action))).toEqual([])
    expect(ids(chatReducer(started(), action))).toEqual(['task'])
  })
  it('explicit task entry opens the task and selects it', () => {
    const next = chatReducer(closed(), { type: 'OPEN_TASK', key: 'agent:1' })
    expect(ids(next)).toEqual(['task'])
    expect(next.selectedTaskKey).toBe('agent:1')
  })
  it('keeps plan approval data without reopening a closed Work panel', () => {
    const next = chatReducer(closed(), {
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
    expect(ids(next)).toEqual([])
  })
  it('loads Work open once and keeps the same cached session closed on refresh', () => {
    const session = {
      id: 'w',
      backend: 'claude' as const,
      title: null,
      messages: [],
      agentKind: 'work' as const
    }
    const loaded = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    expect(ids(loaded)).toEqual(['task'])
    const hidden = chatReducer(loaded, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(ids(chatReducer(hidden, { type: 'LOAD_SESSION', session }))).toEqual([])
    expect(
      ids(chatReducer(hidden, { type: 'LOAD_SESSION', session: { ...session, id: 'other' } }))
    ).toEqual(['task'])
  })
  it('filters stale columns without reopening an empty layout or allocating valid layouts', () => {
    const dirty = [{ id: 'old', tiles: ['diff', 'task', 'plan'] as ('diff' | 'task' | 'plan')[] }]
    expect(flattenColumns(rightPanelColumnsForAgent(dirty, 'work'))).toEqual(['task'])
    expect(flattenColumns(rightPanelColumnsForAgent(dirty, 'coding'))).toEqual(['diff', 'plan'])
    const empty: [] = []
    expect(rightPanelColumnsForAgent(empty, 'work')).toBe(empty)
    const clean = started().rightPanelTiles
    expect(rightPanelColumnsForAgent(clean, 'work')).toBe(clean)
  })
  it('shows unseen task feedback only when Work task is hidden', () => {
    expect(showsUnseenTaskBadge(2, [], [], 'work')).toBe(true)
    expect(showsUnseenTaskBadge(2, ['task'], [], 'work')).toBe(false)
    expect(showsUnseenTaskBadge(0, [], [], 'work')).toBe(false)
  })
  it('records explicit Work cwd selection once while retaining Coding cwd policy', () => {
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
