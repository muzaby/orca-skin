import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  useChatStore,
  applyHarnessAvailability,
  seedLandingBackend,
  chatActions,
  getActiveChatSession
} from './chatStore'
import { useHarnessAvailabilityStore } from '../../../shared/stores/harnessAvailabilityStore'
import { installChatStoreHarness } from './chatStore.testHarness'
import { settingsApi } from '../../../shared/api/ipc'
const before = useChatStore.getState()
let set: ReturnType<typeof vi.fn<typeof settingsApi.set>>
const preferenceWrites = (): Parameters<typeof settingsApi.set>[] =>
  set.mock.calls.filter(([patch]) => 'lastBackend' in patch)
function availability(
  usable: boolean,
  reason: 'missing' | 'unsupported' | 'failed' = 'missing'
): void {
  useHarnessAvailabilityStore.setState(({ byId }) => ({
    byId: {
      ...byId,
      opencode: {
        id: 'opencode',
        installed: usable,
        usable,
        ...(!usable ? { unavailableReason: reason } : {})
      }
    }
  }))
}
beforeEach(() => {
  installChatStoreHarness()
  set = vi.spyOn(settingsApi, 'set').mockResolvedValue({} as never)
  availability(true)
  seedLandingBackend('claude')
  useChatStore.setState(before, true)
})
afterEach(() => {
  seedLandingBackend('claude')
  useChatStore.setState(before, true)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
it('falls back main/project drafts once while preserving stored, busy, locked and continuation sessions and retaining Claude after recovery', () => {
  seedLandingBackend('opencode')
  const entry = before.sessions[before.activeKey]
  const draft = {
    ...entry,
    session: {
      ...entry.session,
      sessionId: null,
      backend: 'opencode' as const,
      harnessExplicitlySelected: true
    }
  }
  const saved = { ...draft, session: { ...draft.session, sessionId: 'saved' } }
  const claude = { ...entry, session: { ...entry.session, backend: 'claude' as const } }
  const busy = { ...draft, session: { ...draft.session, inflight: true } }
  const locked = { ...draft, session: { ...draft.session, agentKindLocked: true } }
  const fork = { ...draft, session: { ...draft.session, forkFrom: 'saved' } }
  const handoff = { ...draft, session: { ...draft.session, handoffFrom: 'saved' } }
  useChatStore.setState({
    activeKey: 'draft',
    sessions: {
      draft,
      project: { ...draft, session: { ...draft.session, pendingProjectId: 'project' } },
      saved,
      claude,
      busy,
      locked,
      fork,
      handoff
    }
  })
  availability(false)
  applyHarnessAvailability()
  const result = useChatStore.getState().sessions
  expect(result.draft.session.backend).toBe('claude')
  expect(result.project.session.backend).toBe('claude')
  for (const [key, value] of Object.entries({ saved, claude, busy, locked, fork, handoff }))
    expect(result[key]).toBe(value)
  expect(preferenceWrites()).toEqual([[{ lastBackend: 'claude' }]])
  applyHarnessAvailability()
  expect(preferenceWrites()).toHaveLength(1)
  availability(true)
  applyHarnessAvailability()
  chatActions.newChat()
  expect(getActiveChatSession().backend).toBe('claude')
  chatActions.newChat('project', '/repo')
  expect(getActiveChatSession()).toMatchObject({ backend: 'claude', pendingProjectId: 'project' })
  expect(preferenceWrites()).toHaveLength(1)
})
it('seeds Claude for an unavailable lastBackend once and keeps ready OpenCode selections without rewriting settings', () => {
  const entry = before.sessions[before.activeKey]
  useChatStore.setState({
    sessions: {
      [before.activeKey]: {
        ...entry,
        session: {
          ...entry.session,
          sessionId: null,
          agentKindLocked: false,
          harnessExplicitlySelected: false
        }
      }
    }
  })
  availability(false, 'failed')
  seedLandingBackend('opencode')
  expect(getActiveChatSession().backend).toBe('claude')
  expect(preferenceWrites()).toEqual([[{ lastBackend: 'claude' }]])
  availability(true)
  seedLandingBackend('opencode')
  expect(getActiveChatSession().backend).toBe('opencode')
  seedLandingBackend('claude')
  seedLandingBackend(null)
  expect(preferenceWrites()).toHaveLength(1)
})
it('remembers automatic model selection and later OpenCode picks only for ordinary new conversations', () => {
  availability(false)
  seedLandingBackend('opencode')
  chatActions.newChat()
  set.mockClear()
  chatActions.setModel('claude-local', 'claude/model', 'Claude', 'claude')
  expect(preferenceWrites()).toEqual([[{ lastBackend: 'claude' }]])
  availability(true)
  chatActions.setModel('opencode-local', 'opencode/model', 'OpenCode', 'opencode')
  expect(preferenceWrites()).toEqual([[{ lastBackend: 'claude' }], [{ lastBackend: 'opencode' }]])
  chatActions.newChat()
  expect(getActiveChatSession().backend).toBe('opencode')
})
it.each(['fork', 'handoff', 'saved'] as const)(
  'keeps the new-conversation backend unchanged when selecting a model in a %s conversation',
  (kind) => {
    seedLandingBackend('opencode')
    const entry = before.sessions[before.activeKey]
    const source = {
      ...entry,
      session: {
        ...entry.session,
        backend: 'claude' as const,
        sessionId: 'source',
        modelFamily: 'old',
        messages: [
          { role: 'user' as const, createdAt: 1, parts: [{ type: 'text' as const, text: 'one' }] },
          {
            role: 'assistant' as const,
            createdAt: 2,
            parts: [{ type: 'text' as const, text: 'answer' }]
          },
          { role: 'user' as const, createdAt: 3, parts: [{ type: 'text' as const, text: 'two' }] }
        ]
      }
    }
    useChatStore.setState({ activeKey: 'source', sessions: { source } })
    if (kind === 'fork') expect(chatActions.startForkDraft()).toBe(true)
    if (kind === 'handoff') expect(chatActions.startHandoff()).toBe(true)
    chatActions.setModel('claude-other', 'different', 'Other', 'claude')
    expect(getActiveChatSession().backend).toBe('claude')
    expect(preferenceWrites()).toEqual([])
    chatActions.newChat()
    expect(getActiveChatSession().backend).toBe('opencode')
  }
)
it('starts with Claude before any landing backend is seeded', async () => {
  vi.resetModules()
  const fresh = await import('./chatStore')
  fresh.chatActions.newChat()
  expect(fresh.getActiveChatSession().backend).toBe('claude')
})
