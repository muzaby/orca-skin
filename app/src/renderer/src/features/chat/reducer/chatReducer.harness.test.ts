import { describe, expect, it } from 'vitest'
import { chatReducer, initialChatState, type ChatAction } from './chatReducer'
import { flattenColumns } from '../lib/rightPanelLayout'

const select: ChatAction = {
  type: 'SET_MODEL',
  adapter: 'opencode',
  providerKey: 'opencode-local',
  modelFamily: 'vendor/model',
  modelAlias: 'Model'
}
describe('harness identity and panel enforcement', () => {
  it('keeps the original OpenCode tool input alongside its normalized arguments', () => {
    const raw = { name: 'read', input: { filePath: 'src/a.ts' } }
    const next = chatReducer(
      { ...initialChatState, sessionId: 's', backend: 'opencode' },
      {
        type: 'RECV_EVENT',
        event: {
          type: 'tool.call.started',
          sessionId: 's',
          toolRunId: 'tool',
          toolName: 'Read',
          args: { file_path: 'src/a.ts' },
          providerTool: raw
        }
      }
    )
    expect(next.messages.flatMap((message) => message.parts)).toContainEqual(
      expect.objectContaining({
        type: 'tool_call',
        toolName: 'Read',
        args: { file_path: 'src/a.ts' },
        providerTool: raw
      })
    )
  })
  it('switches an unsent Work draft to OpenCode Code without losing context', () => {
    const before = {
      ...initialChatState,
      agentKind: 'work' as const,
      cwd: 'C:/project',
      extraDirs: ['C:/ref']
    }
    const selected = chatReducer(before, select)
    expect(selected).toMatchObject({
      backend: 'opencode',
      agentKind: 'code',
      cwd: 'C:/project',
      extraDirs: ['C:/ref']
    })
    expect(chatReducer(selected, { type: 'SET_AGENT_KIND', kind: 'work' })).toBe(selected)
  })
  it.each([{ sessionId: 's' }, { agentKindLocked: true }])(
    'rejects changing a created or admitted draft harness: %j',
    (lock) => {
      const before = { ...initialChatState, backend: 'claude' as const, ...lock }
      expect(chatReducer(before, select)).toBe(before)
    }
  )
  it('restores the stored harness and ignores conflicting updates', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: { id: 's', backend: 'opencode', agentKind: 'code', title: null, messages: [] }
    })
    const updated = chatReducer(loaded, {
      type: 'RECV_EVENT',
      event: { type: 'session.updated', sessionId: 's', patch: { backend: 'claude' } }
    })
    expect(updated.backend).toBe('opencode')
    expect(chatReducer(loaded, { ...select, adapter: 'claude' })).toBe(loaded)
  })
  it.each([
    { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'subagent' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'subagent', active: true },
    { type: 'OPEN_SUBAGENT_TASK', toolRunId: 'child' }
  ] satisfies ChatAction[])('opens OpenCode subagents via $type', (action) => {
    const state = chatReducer(chatReducer(initialChatState, select), action)
    expect(flattenColumns(state.rightPanelTiles)).toEqual(['subagent'])
    if (action.type === 'OPEN_SUBAGENT_TASK') {
      expect(state.selectedSubagentTaskId).toBe('child')
    }
  })
  it.each([
    { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' },
    { type: 'SET_RIGHT_PANEL_TILE_ACTIVE', id: 'task', active: true }
  ] satisfies ChatAction[])('opens the OpenCode task summary via $type', (action) => {
    const state = chatReducer(chatReducer(initialChatState, select), action)
    expect(flattenColumns(state.rightPanelTiles)).toEqual(['task'])
  })
  it('keeps OpenCode review available', () => {
    const state = chatReducer(initialChatState, select)
    expect(
      flattenColumns(
        chatReducer(state, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' }).rightPanelTiles
      )
    ).toEqual(['diff'])
  })
  it('opens the task summary once and preserves explicit close on later turns and reload', () => {
    const session = {
      id: 's',
      backend: 'opencode' as const,
      agentKind: 'code' as const,
      title: null,
      messages: []
    }
    const started = chatReducer(chatReducer(initialChatState, select), { type: 'BEGIN_TURN' })
    expect(flattenColumns(started.rightPanelTiles)).toEqual(['task'])
    const turnClosed = chatReducer(started, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'task' })
    expect(flattenColumns(chatReducer(turnClosed, { type: 'BEGIN_TURN' }).rightPanelTiles)).toEqual(
      []
    )
    const loaded = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    expect(flattenColumns(loaded.rightPanelTiles)).toEqual(['task'])
    const closed = chatReducer(loaded, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'task' })
    expect(
      flattenColumns(chatReducer(closed, { type: 'LOAD_SESSION', session }).rightPanelTiles)
    ).toEqual([])
    const other = chatReducer(closed, {
      type: 'LOAD_SESSION',
      session: { ...session, id: 'other' }
    })
    expect(flattenColumns(other.rightPanelTiles)).toEqual(['task'])
  })
  it('preserves same-session selections on reload and clears them for another session', () => {
    const session = {
      id: 's',
      backend: 'opencode' as const,
      agentKind: 'code' as const,
      title: null,
      messages: []
    }
    let state = chatReducer(initialChatState, { type: 'LOAD_SESSION', session })
    state = chatReducer(state, { type: 'OPEN_PROCESS_TOOL', toolRunId: 'shell' })
    state = chatReducer(state, { type: 'OPEN_SUBAGENT_TASK', toolRunId: 'child' })
    const refreshed = chatReducer(state, { type: 'LOAD_SESSION', session })
    expect(refreshed.selectedProcessToolId).toBe('shell')
    expect(refreshed.selectedSubagentTaskId).toBe('child')
    expect(refreshed.rightPanelTiles).toBe(state.rightPanelTiles)
    const other = chatReducer(state, { type: 'LOAD_SESSION', session: { ...session, id: 'other' } })
    expect(other.selectedProcessToolId).toBeNull()
    expect(other.selectedSubagentTaskId).toBeNull()
  })
  it.each(['code', 'work'] as const)('rejects process selection for Claude %s', (agentKind) => {
    const state = { ...initialChatState, backend: 'claude' as const, agentKind }
    expect(chatReducer(state, { type: 'OPEN_PROCESS_TOOL', toolRunId: 'shell' })).toBe(state)
    expect(chatReducer(state, { type: 'SELECT_PROCESS_TOOL', toolRunId: 'shell' })).toBe(state)
  })
})
