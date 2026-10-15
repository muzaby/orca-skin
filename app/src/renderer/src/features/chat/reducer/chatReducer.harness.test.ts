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
  ] satisfies ChatAction[])('routes OpenCode task entry to plan via $type', (action) => {
    const state = chatReducer(chatReducer(initialChatState, select), action)
    expect(flattenColumns(state.rightPanelTiles)).toEqual(['plan'])
  })
  it('keeps OpenCode review available', () => {
    const state = chatReducer(initialChatState, select)
    expect(
      flattenColumns(
        chatReducer(state, { type: 'TOGGLE_RIGHT_PANEL_TILE', id: 'diff' }).rightPanelTiles
      )
    ).toEqual(['diff'])
  })
})
