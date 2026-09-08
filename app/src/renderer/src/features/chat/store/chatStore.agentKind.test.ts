import { describe, expect, it } from 'vitest'
import { chatActions, getActiveChatSession, ingestChatEvent, useChatStore } from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { flattenColumns } from '../lib/rightPanelLayout'

describe('product agent kind', () => {
  it('changes only the unsent draft, sends its kind and retains the lock after failure', () => {
    const { chatSend } = installChatStoreHarness({
      sessionId: null,
      cwd: 'C:/work',
      extraDirs: ['C:/refs']
    })
    chatActions.setAgentKind('work')
    expect(getActiveChatSession()).toMatchObject({
      agentKind: 'work',
      cwd: 'C:/work',
      extraDirs: ['C:/refs']
    })
    expect(chatActions.send('report')).toBe(true)
    expect(chatSend.mock.calls[0][0]).toMatchObject({ agentKind: 'work', text: 'report' })
    ingestChatEvent({ type: 'turn.aborted', reason: 'user_cancelled' })
    chatActions.setAgentKind('coding')
    expect(getActiveChatSession().agentKind).toBe('work')
    expect(getActiveChatSession().agentKindLocked).toBe(true)
  })
  it('keeps the kind on busy sends and fork drafts', () => {
    const { chatSend } = installChatStoreHarness({ agentKind: 'work', inflight: true })
    chatActions.send('follow up')
    expect(chatSend.mock.calls[0][0].agentKind).toBe('work')
    installChatStoreHarness({ agentKind: 'work' })
    expect(chatActions.startForkDraft()).toBe(true)
    expect(getActiveChatSession()).toMatchObject({ agentKind: 'work', agentKindLocked: true })
  })
  it('loads legacy as coding and keeps a closed Work task hidden on the next turn', () => {
    const loaded = chatReducer(initialChatState, {
      type: 'LOAD_SESSION',
      session: {
        id: 's',
        backend: 'claude',
        title: null,
        messages: [],
        agentKind: 'work'
      }
    })
    expect(loaded.agentKind).toBe('work')
    expect(flattenColumns(loaded.rightPanelTiles)).toContain('task')
    const closed = chatReducer(loaded, { type: 'REMOVE_RIGHT_PANEL_TILE', id: 'task' })
    const next = chatReducer(closed, { type: 'BEGIN_TURN' })
    expect(flattenColumns(closed.rightPanelTiles)).toEqual([])
    expect(flattenColumns(next.rightPanelTiles)).toEqual([])
    expect(
      chatReducer(initialChatState, {
        type: 'LOAD_SESSION',
        session: {
          id: 'old',
          backend: 'claude',
          title: null,
          messages: []
        }
      }).agentKind
    ).toBe('coding')
  })
  it('routes boundaries only to the owning live session without starting a turn', () => {
    installChatStoreHarness({ agentKind: 'work' })
    const before = useChatStore.getState()
    ingestChatEvent({
      type: 'response.boundary',
      sessionId: 'gone',
      boundary: { phase: 'begin', id: 'x' }
    })
    expect(useChatStore.getState()).toBe(before)
    ingestChatEvent({
      type: 'response.boundary',
      sessionId: 's',
      boundary: { phase: 'begin', id: 'r' }
    })
    expect(getActiveChatSession().inflight).toBe(false)
    expect(getActiveChatSession().messages[0].parts[0]).toEqual({
      type: 'response_boundary',
      boundary: { phase: 'begin', id: 'r' }
    })
  })
})
