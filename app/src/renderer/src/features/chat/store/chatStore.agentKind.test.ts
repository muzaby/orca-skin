import { describe, expect, it } from 'vitest'
import {
  chatActions,
  getActiveChatSession,
  ingestChatEvent,
  seedLandingAgentKind,
  useChatStore
} from './chatStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { chatReducer, initialChatState } from '../reducer/chatReducer'
import { flattenColumns } from '../lib/rightPanelLayout'
import { SettingsSchema } from '../../../../../shared/protocol'

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
    chatActions.setAgentKind('code')
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
  it('loads legacy as code and keeps a closed Work task hidden on the next turn', () => {
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
        session: { agentKind: 'code', id: 'old', backend: 'claude', title: null, messages: [] }
      }).agentKind
    ).toBe('code')
  })
  // 0228 D-001 — 랜딩 기억의 입력은 토글 선택뿐이고, 리듀서가 받아들였을 때만 영속한다.
  it('수용된 토글 선택만 lastAgentKind 로 영속한다', () => {
    const { settingsSet } = installChatStoreHarness({ sessionId: null })
    chatActions.setAgentKind('work')
    expect(settingsSet).toHaveBeenCalledExactlyOnceWith({ lastAgentKind: 'work' })

    const locked = installChatStoreHarness({
      sessionId: null,
      agentKind: 'work',
      agentKindLocked: true
    })
    chatActions.setAgentKind('code')
    expect(getActiveChatSession().agentKind).toBe('work')
    expect(locked.settingsSet).not.toHaveBeenCalled()
  })

  // 0228 §10 EP-02 — 시드는 잠기지 않은 미전송 초안에만 닿는다.
  it('시드는 미전송 초안만 바꾸고 잠긴/확정 세션은 건드리지 않는다', () => {
    installChatStoreHarness({ sessionId: null })
    seedLandingAgentKind('code')
    expect(getActiveChatSession().agentKind).toBe('code')

    installChatStoreHarness({ sessionId: 's', agentKind: 'work', agentKindLocked: true })
    seedLandingAgentKind('code')
    expect(getActiveChatSession().agentKind).toBe('work')
  })

  // 0228 D-002 — 저장값이 없거나 손상되면 첫 실행 고정값이다.
  it('설정 기본값과 손상 복구값이 work 다', () => {
    expect(SettingsSchema.parse({}).lastAgentKind).toBe('work')
    expect(SettingsSchema.parse({ lastAgentKind: 'bogus' }).lastAgentKind).toBe('work')
    expect(SettingsSchema.parse({ lastAgentKind: 'code' }).lastAgentKind).toBe('code')
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
