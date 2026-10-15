import { beforeEach, describe, expect, it } from 'vitest'
import { chatActions, getActiveChatSession, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { flattenColumns } from '../lib/rightPanelLayout'
import { initialChatState } from '../reducer/chatReducer'

beforeEach(() => {
  installChatStoreHarness({
    backend: 'opencode',
    agentKind: 'code',
    agentPanelInitialized: true,
    rightPanelTiles: [{ id: 'summary', tiles: ['task'] }]
  })
})

describe('OpenCode independent panel state', () => {
  it('keeps the summary and other selections while opening and revealing each target', () => {
    chatActions.setRightPanelTileActive('diff', true)
    chatActions.openSubagentTask('child')
    chatActions.openProcessTool('shell-1')
    chatActions.setRightPanelTileActive('source', true)
    expect(flattenColumns(getActiveChatSession().rightPanelTiles)).toEqual([
      'task',
      'diff',
      'subagent',
      'process',
      'source'
    ])
    expect(getActiveChatSession().selectedSubagentTaskId).toBe('child')
    expect(getActiveChatSession().selectedProcessToolId).toBe('shell-1')
    expect(useChatStore.getState().sessions.s.panelReveal?.id).toBe('source')
    const columns = getActiveChatSession().rightPanelTiles
    chatActions.openProcessTool('shell-2')
    expect(getActiveChatSession().rightPanelTiles).toBe(columns)
    expect(getActiveChatSession().selectedSubagentTaskId).toBe('child')
    expect(getActiveChatSession().selectedProcessToolId).toBe('shell-2')
    expect(useChatStore.getState().sessions.s.panelReveal?.id).toBe('process')
    chatActions.openProcessTool('shell-2')
    expect(getActiveChatSession().rightPanelTiles).toBe(columns)
  })

  it.each(['toggle', 'deactivate', 'remove'] as const)(
    'clears only the closed process selection through %s',
    (method) => {
      chatActions.openSubagentTask('child')
      chatActions.openProcessTool('shell')
      if (method === 'toggle') chatActions.toggleRightPanelTile('process')
      if (method === 'deactivate') chatActions.setRightPanelTileActive('process', false)
      if (method === 'remove') chatActions.removeRightPanelTile('process')
      expect(getActiveChatSession().selectedProcessToolId).toBeNull()
      expect(getActiveChatSession().selectedSubagentTaskId).toBe('child')
      expect(flattenColumns(getActiveChatSession().rightPanelTiles)).toEqual(['task', 'subagent'])
      chatActions.setRightPanelTileActive('process', true)
      expect(getActiveChatSession().selectedProcessToolId).toBeNull()
      chatActions.toggleRightPanelTile('subagent')
      expect(getActiveChatSession().selectedSubagentTaskId).toBeNull()
    }
  )

  it('keeps selections and closed tiles in their own cached session', async () => {
    chatActions.openProcessTool('shell-a')
    chatActions.toggleRightPanelTile('task')
    const selectedA = useChatStore.getState().sessions.s
    useChatStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        other: {
          ...selectedA,
          session: {
            ...initialChatState,
            sessionId: 'other',
            backend: 'opencode',
            agentKind: 'code'
          }
        }
      }
    }))
    await chatActions.loadSession('other')
    expect(getActiveChatSession().selectedProcessToolId).toBeNull()
    chatActions.openProcessTool('shell-b')
    await chatActions.loadSession('s')
    expect(useChatStore.getState().sessions.s).toBe(selectedA)
    expect(getActiveChatSession().selectedProcessToolId).toBe('shell-a')
    expect(flattenColumns(getActiveChatSession().rightPanelTiles)).toEqual(['process'])
    expect(useChatStore.getState().sessions.other.session.selectedProcessToolId).toBe('shell-b')
  })

  it('does not open process/source tiles in either Claude mode', () => {
    for (const agentKind of ['code', 'work'] as const) {
      installChatStoreHarness({ backend: 'claude', agentKind })
      const initial = getActiveChatSession()
      chatActions.openProcessTool('shell')
      expect(getActiveChatSession()).toBe(initial)
      chatActions.setRightPanelTileActive('source', true)
      expect(flattenColumns(getActiveChatSession().rightPanelTiles)).toEqual([])
      expect(useChatStore.getState().sessions.s.panelReveal).toBeUndefined()
    }
  })
})
